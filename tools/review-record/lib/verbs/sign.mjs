// tools/review-record/lib/verbs/sign.mjs — `sign` verb (Clinical Review Workflow v1, Phase 2,
// P2-T1, FR-6/FR-25, OQ-1, F1).
//
// Frozen command signature: `sign --draft <path> --module <id> --root <dir>` (all three required —
// no bracket-optional flags on this verb; see this tool's `--help` text and `cli.mjs`'s own header).
//
// `sign` is the CLI-facing entry point that turns a staged, unsigned draft into a committed
// `modules/<moduleId>/reviews/*.yaml` file. It reads EXCLUSIVELY from the `.review-drafts/
// <moduleId>/` staging area `scaffold --draft` (`lib/verbs/scaffold.mjs`'s `draftFilePathFor`, this
// feature's P1-T3(c)/CRW-F2 gap-closure addition) writes to — NEVER a path already inside
// `reviews/` (F1/R10). On a `synthetic: true` draft with `signature: null`, it calls
// `lib/signature.mjs`'s `signRecordDryRun` — a fresh, ephemeral, in-memory-only Ed25519 keypair,
// self-certifying `TESTKEY-` `keyId`, private key discarded the instant that call returns (see that
// module's own header for the full custody guarantee) — and then performs the record's FIRST and
// ONLY committed write through `lib/store.mjs`'s append-only `writeNewReviewRecordFile`.
//
// OQ-1 resolved (TESTKEY-only, no keyfile seam): this file contains no `--keyfile`/`--key`/
// `--test-keys` handling, no environment-variable key-material read, and no `--record` flag
// pointing at an already-committed file — the absence is structural (there is simply no code path
// here that reads any such thing), not a convention this file merely follows. Real signing stays
// impossible pre-G1/G2 regardless: `signRecordDryRun` itself refuses (fail-closed) to sign anything
// but a `synthetic: true` record with no signature already attached (`lib/signature.mjs`'s own
// header). P2-T2 (a later, sibling task — same target file, `lib/verbs/sign.mjs`, per the phase
// plan's target-surfaces list) adds the explicit G1/G2-naming refusal message text and the
// `--keyfile`/`--record`-over-committed-file grep test (FR-7/23, R1) on top of what this task ships
// — this task relies on `signRecordDryRun`'s own built-in fail-closed refusal for the
// `synthetic:false` case (already a real `UsageError`, just not yet carrying that specific G1/G2
// wording) rather than pre-empting that sibling task's own acceptance criteria.
//
// F1/R10 (sign never opens or rewrites a path already inside reviews/) is enforced TWICE,
// independently:
//   (1) the `--draft` path must resolve STRICTLY inside `<root>/.review-drafts/<moduleId>/` — the
//       exact staging directory `scaffold --draft` itself writes to (`draftsDirFor`, imported from
//       `../store.mjs` — the same module `scaffold.mjs` re-exports it from, CRW-F6 — so both verbs
//       and every caller share one path convention, never two that could drift).
//   (2) a belt-and-suspenders check that the resolved path never falls inside
//       `modules/<moduleId>/reviews/`, even though check (1) already excludes it by construction
//       (`.review-drafts/` and `modules/<id>/reviews/` are disjoint trees under any `--root`).
// Neither check reads any bytes from `reviews/` at any point — this file calls `readFile` on
// exactly one path, the `--draft` argument itself, after both checks above have already passed.

import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { draftsDirFor, reviewsDirFor, writeNewReviewRecordFile } from '../store.mjs';
import { signRecordDryRun } from '../signature.mjs';
import { parseYamlDocument } from '../../../rf-bundle-to-kb-pack/lib/yaml-lite.mjs';
import { EXIT_OK, UsageError } from '../errors.mjs';

function requireString(options, flag, key = flag) {
  const value = options[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new UsageError(`sign requires --${flag} <value>`);
  }
  return value;
}

/**
 * Whether `candidatePath` resolves to a path STRICTLY inside `dirPath` (never equal to it — a
 * directory itself is never a valid file argument here).
 *
 * @param {string} candidatePath
 * @param {string} dirPath
 * @returns {boolean}
 */
function resolvesStrictlyInside(candidatePath, dirPath) {
  const resolvedCandidate = path.resolve(candidatePath);
  const resolvedDir = path.resolve(dirPath);
  const rel = path.relative(resolvedDir, resolvedCandidate);
  return rel !== '' && rel !== '.' && !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel);
}

/**
 * @param {{ draft?: string, module?: string, root?: string }} options all three required — see
 *   this file's header for the frozen, no-optional-flags signature.
 * @returns {Promise<number>}
 */
export async function run(options = {}) {
  const draftArg = requireString(options, 'draft');
  const moduleId = requireString(options, 'module');
  const rootDir = requireString(options, 'root');

  // (1) --draft must resolve STRICTLY inside <root>/.review-drafts/<moduleId>/ — the exact staging
  // directory scaffold --draft itself writes to. This is checked BEFORE any file read.
  const expectedDraftsDir = draftsDirFor(rootDir, moduleId);
  if (!resolvesStrictlyInside(draftArg, expectedDraftsDir)) {
    throw new UsageError(
      `--draft "${draftArg}" does not resolve inside the expected staging directory ` +
        `"<root>/.review-drafts/${moduleId}/" — sign reads ONLY a staged draft that scaffold ` +
        '--draft itself produced at that exact path; it never opens any other location, including ' +
        'any path already inside reviews/ (F1).',
    );
  }

  // (2) Belt-and-suspenders: the resolved path must never fall inside modules/<moduleId>/reviews/
  // — structurally impossible given check (1) above (the two trees are disjoint), asserted a
  // second time regardless, independent of check (1)'s own reasoning (F1/R10).
  const resolvedReviewsDir = reviewsDirFor(rootDir, moduleId);
  if (resolvesStrictlyInside(draftArg, resolvedReviewsDir) || path.resolve(draftArg) === path.resolve(resolvedReviewsDir)) {
    throw new UsageError(
      `--draft "${draftArg}" resolves inside modules/${moduleId}/reviews/ — sign never opens or ` +
        'rewrites a path already inside reviews/ (F1/R10).',
    );
  }

  const resolvedDraftPath = path.resolve(draftArg);
  let raw;
  try {
    raw = await readFile(resolvedDraftPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new UsageError(
        `--draft "${draftArg}" was not found — sign reads ONLY a staged draft already written by ` +
          '`scaffold --draft`; run that first.',
      );
    }
    throw err;
  }

  const draft = parseYamlDocument(raw);
  if (draft === null || typeof draft !== 'object' || Array.isArray(draft)) {
    throw new UsageError(`--draft "${draftArg}" did not parse to a review-record document`);
  }
  if (draft.moduleId !== moduleId) {
    throw new UsageError(
      `the staged draft's moduleId "${draft.moduleId}" does not match --module "${moduleId}" — ` +
        'sign refuses to proceed on a moduleId mismatch between the draft\'s own content and the ' +
        'flag naming which module\'s reviews/ directory to write into.',
    );
  }

  // signRecordDryRun (lib/signature.mjs) itself refuses, fail-closed, to sign anything but a
  // synthetic:true record with no signature already attached — see this file's header. This verb
  // adds no separate duplicate check here; that refusal lives in exactly one place.
  const signed = signRecordDryRun(draft);

  // The record's FIRST and ONLY committed write — the sole append-only path into
  // modules/<moduleId>/reviews/ (lib/store.mjs's own header names writeNewReviewRecordFile as the
  // ONE writer in this whole tool).
  const filePath = await writeNewReviewRecordFile(rootDir, moduleId, draft.review_id, signed);

  // Best-effort cleanup of the now-consumed staging file. A cleanup failure must never turn an
  // already-SUCCESSFUL committed write into a reported failure — it is noted, not thrown.
  let cleanupNote = '';
  try {
    await rm(resolvedDraftPath);
  } catch {
    cleanupNote = ` (staged draft file could not be removed — not fatal; the committed write above already succeeded)`;
  }

  process.stdout.write(
    `Wrote ${filePath}\n` +
      `Signed with an ephemeral TESTKEY- Ed25519 key (keyId "${signed.signature.keyId}") — the ` +
      'private key was discarded when the signing call returned; it was never written to disk.\n' +
      `Staged draft consumed${cleanupNote}.\n` +
      'Structural review-record content only -- not a clinical-validity, safety, or approval claim.\n',
  );
  return EXIT_OK;
}
