// tools/review-record/lib/subject.mjs — `subjectContentHash` computation for the `dry-run` verb
// (P2-T8, FR-11/OQ-2).
//
// `schemas/review-record.schema.json`'s `subjectContentHash` field is "SHA-256 of the exact
// target-artifact bytes this review act reviewed." For the `dry-run` verb's default invocation over
// a real module (`cbc_suite_v1`), the honest "target artifact" is that module's own already-committed
// proposal content — everything under `modules/<moduleId>/` — not an invented or hand-picked value.
// This module computes that hash directly from the real files on disk, deterministically, so the
// value baked into every dry-run record can be independently recomputed and checked by anyone with
// the same tree, rather than being an opaque constant a task author typed in.
//
// Hashing convention: relative path (POSIX-separated, platform-independent) + a newline + raw file
// bytes, sorted by path so directory-listing order never affects the result — this mirrors
// `tools/release-sign/lib/pack-digest.mjs`'s `computePackDigest` convention (itself matching
// `tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs`'s own file-set hashing) byte-for-byte, rather
// than inventing a third variant of "hash a directory" in this repository. This module does NOT
// import `tools/release-sign` (a sibling, independently-owned Phase 3 tool this task's own worktree
// may be mutating concurrently, per this program's parallel wave-2 workstream design) — it is a
// small, independently-reasoned re-implementation of the same convention, the same "don't cross tool
// boundaries" posture `lib/roster.mjs`'s own header already documents for this tool's roster reader.
//
// `modules/<moduleId>/reviews/` — the review-record store this exact tool writes into — is always
// EXCLUDED from the hashed file set: a review act's own subject can never include the review chain
// reviewing it (that would make every later record change what an earlier one attested to).

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { UsageError } from './errors.mjs';

/** Directory name, direct child of `modules/<moduleId>/`, never included in the hashed file set. */
export const EXCLUDED_TOP_LEVEL_DIR = 'reviews';

/**
 * Recursively collects every regular file under `moduleDir`, as paths RELATIVE to `moduleDir` with
 * POSIX (`/`) separators regardless of host OS, sorted lexicographically — reproducible run to run
 * and machine to machine. The one exception: a direct child directory of `moduleDir` itself named
 * `reviews` (see this file's header) is skipped entirely, at any depth-zero encounter only — a
 * module's own content never nests a second `reviews/` directory deeper than that, so this check
 * does not need to recurse to find out.
 *
 * @param {string} moduleDir
 * @returns {Promise<string[]>}
 */
async function collectModuleFilesRelative(moduleDir) {
  const collected = [];
  async function walk(current, isModuleRoot) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new UsageError(
          `computeModuleContentHash: no module directory found at "${moduleDir}" — dry-run's default ` +
            'subjectContentHash computation requires the target module\'s content to already exist on ' +
            'disk; pass --subject explicitly to bypass this computation.',
        );
      }
      throw err;
    }
    for (const entry of entries) {
      if (isModuleRoot && entry.isDirectory() && entry.name === EXCLUDED_TOP_LEVEL_DIR) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full, false);
      } else if (entry.isFile()) {
        collected.push(path.relative(moduleDir, full).split(path.sep).join('/'));
      }
    }
  }
  await walk(moduleDir, true);
  return collected.sort();
}

/**
 * SHA-256 over every regular file under `modules/<moduleId>/` (excluding `reviews/`, see this
 * file's header) — relative path + raw content, sorted by path. Fails closed on a missing or
 * empty module directory: a `subjectContentHash` computed over zero files would silently
 * misrepresent "no proposal content was found" as "an empty proposal was reviewed."
 *
 * @param {string} rootDir repo root (or a fixture/tmp root standing in for it)
 * @param {string} moduleId
 * @returns {Promise<string>} `sha256:<64 hex>`, matching every hash-shaped field in
 *   `schemas/review-record.schema.json`
 */
export async function computeModuleContentHash(rootDir, moduleId) {
  if (typeof rootDir !== 'string' || rootDir.length === 0) {
    throw new UsageError('computeModuleContentHash requires a root directory path');
  }
  if (typeof moduleId !== 'string' || moduleId.length === 0) {
    throw new UsageError('computeModuleContentHash requires a moduleId');
  }
  const moduleDir = path.join(rootDir, 'modules', moduleId);
  const relFiles = await collectModuleFilesRelative(moduleDir);
  if (relFiles.length === 0) {
    throw new UsageError(
      `computeModuleContentHash: "modules/${moduleId}/" (excluding reviews/) contains no files to ` +
        'hash — dry-run refuses to compute a subjectContentHash over an empty proposal.',
    );
  }
  const hash = createHash('sha256');
  for (const rel of relFiles) {
    const raw = await readFile(path.join(moduleDir, ...rel.split('/')));
    hash.update(`${rel}\n`);
    hash.update(raw);
  }
  return `sha256:${hash.digest('hex')}`;
}
