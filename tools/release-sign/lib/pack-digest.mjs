// tools/release-sign/lib/pack-digest.mjs — deterministic whole-pack content digest (P3-T4,
// FR-14/OQ-4, schemas/release-registry.schema.json's `packDigest` field).
//
// `schemas/release-registry.schema.json` describes `packDigest` as "SHA-256 of the canonicalized
// kb-pack contents this registry entry attests to" — deliberately DISTINCT from `manifestDigest`
// (`./canonical-bytes.mjs`'s signing preimage over `release-manifest.unsigned.json` alone): a
// staged kb-pack directory (`build/kb-pack/<moduleId>/<packVersion>/`) is a whole FILE SET —
// `pack-provenance.json`, `evidence.json`, `evidence-assertions.json`, `candidates.json`,
// `rule-proposals.json`, `rules.json`, `rule-provenance.json`, `release-manifest.unsigned.json`,
// `conversion-report.json`, `semantic-diff.json` (`tools/rf-bundle-to-kb-pack/lib/verbs/
// propose.mjs`'s own `02 §4.4` file-set assembly) — and `packDigest` is this registry entry's
// integrity record over ALL of it, not just the one manifest file `manifestDigest` already covers.
//
// This module never re-implements E0's own file-set assembly or content — it only reads bytes
// back off disk (recursively, every regular file under `packDir`), exactly like
// `./canonical-bytes.mjs` does for the single manifest file. The hashing convention itself —
// relative path (POSIX-separated, so the digest is platform-independent) + raw content, sorted by
// path so directory-listing order never affects the result — mirrors
// `tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs`'s own `computeConverterConfigSha256`/
// `computeTraceabilityHash` convention byte-for-byte (name + content, sorted, no timestamps),
// rather than inventing a new one; this is the same "one canonical hashing shape across the repo"
// discipline `./canonical-bytes.mjs`'s own header describes for the signing preimage.

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { UsageError } from './errors.mjs';

/**
 * Recursively collects every regular file under `dir`, as paths RELATIVE to `dir` with POSIX
 * (`/`) separators regardless of host OS, sorted lexicographically — independent of both the
 * underlying filesystem's `readdir` ordering and the host platform's own path separator, so the
 * digest below is reproducible run to run and machine to machine (FR-19/FR-20-adjacent
 * determinism posture, same reasoning as `propose.mjs`'s own `collectConverterSourceFilesRelative`).
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collectPackFilesRelative(dir) {
  const collected = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new UsageError(
          `computePackDigest: no pack directory found at ${dir} — register requires an already ` +
            'staged kb-pack (rf-bundle-to-kb-pack propose output), not a directory this tool builds ' +
            'itself.',
        );
      }
      throw err;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        collected.push(path.relative(dir, full).split(path.sep).join('/'));
      }
    }
  }
  await walk(dir);
  return collected.sort();
}

/**
 * SHA-256 over every regular file under `packDir` — relative path + raw content, sorted by path
 * (see `collectPackFilesRelative`'s own header for exactly why). Fails closed on a missing or
 * empty pack directory: a `packDigest` computed over zero files would silently misrepresent "no
 * pack was found" as "an empty pack was hashed," and `register` (P3-T4) must never append a
 * registry entry that attests to content that was never actually staged.
 *
 * @param {string} packDir a `build/kb-pack/<moduleId>/<packVersion>/` directory already produced
 *   by `rf-bundle-to-kb-pack propose` (directly, or via `./manifest.mjs`'s `--run-dir` path).
 * @returns {Promise<{ sha256: string, files: string[] }>} lowercase hex SHA-256 digest (no
 *   `sha256:` prefix — callers that need the prefixed form, e.g. `registries entries' packDigest`,
 *   add it themselves, matching every other digest field's convention in this tool) plus the
 *   sorted relative file list that was hashed (useful for tests/audit, not itself hashed).
 */
export async function computePackDigest(packDir) {
  if (typeof packDir !== 'string' || packDir.length === 0) {
    throw new UsageError('computePackDigest requires a pack directory path');
  }
  const relFiles = await collectPackFilesRelative(packDir);
  if (relFiles.length === 0) {
    throw new UsageError(
      `computePackDigest: pack directory ${packDir} contains no files to hash — register requires ` +
        'a fully staged kb-pack, not an empty directory.',
    );
  }
  const hash = createHash('sha256');
  for (const rel of relFiles) {
    const raw = await readFile(path.join(packDir, ...rel.split('/')));
    hash.update(`${rel}\n`);
    hash.update(raw);
  }
  return { sha256: hash.digest('hex'), files: relFiles };
}
