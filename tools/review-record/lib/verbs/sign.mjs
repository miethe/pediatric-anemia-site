// tools/review-record/lib/verbs/sign.mjs — `sign` verb (Clinical Review Workflow v1, Phase 2,
// P2-T1/P2-T2, FR-6/FR-7/FR-23/FR-25, OQ-1, F1, R1).
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
// OQ-1 resolved (TESTKEY-only, no keyfile seam): this file contains no code path that ever reads a
// key from a file or an environment variable — the absence is structural, proven by a static grep
// test (`tests/ef-review-record-cli.test.mjs`), not a convention this file merely follows. Real
// signing stays impossible pre-G1/G2 regardless: `signRecordDryRun` itself refuses (fail-closed) to
// sign anything but a `synthetic: true` record with no signature already attached
// (`lib/signature.mjs`'s own header).
//
// P2-T2 (FR-7/23/25, R1) additions, on top of what P2-T1 shipped:
//   - `run` refuses `--keyfile`/`--key`/`--test-keys` and `--record` UNCONDITIONALLY, before any
//     other flag is even validated — "for any input" (the plan's own wording): a call carrying one
//     of these flags is refused for THAT reason specifically, even when `--draft`/`--module`/
//     `--root` are themselves missing or invalid. `--record` is refused whether or not it happens
//     to name a real committed `modules/<id>/reviews/*.yaml` file — sign has no code path that ever
//     opens a `--record`-named path at all.
//   - `run` now ALSO checks `draft.synthetic !== true` itself, before ever calling
//     `signRecordDryRun`, and throws its own `UsageError` naming both **G1** (named credentialed
//     reviewer roster — `governance/reviewer-roster.yaml` ships synthetic-only pre-G1) and **G2**
//     (signing custodian + offline key ceremony, ADR-0005) by name. This is an earlier, more
//     specifically-worded restatement of the guarantee `signRecordDryRun` (P2-T5, `lib/signature.mjs`,
//     a file this task does not own or modify) already enforces on its own synthetic:true-only
//     writable-signature invariant — defense in depth, not a replacement for it, matching this
//     tool's established FR-4 "two ways" precedent (see this tool's README).
//
// F1/R10 (sign never opens or rewrites a path already inside reviews/) is enforced TWICE,
// independently:
//   (1) the `--draft` path must resolve STRICTLY inside `<root>/.review-drafts/<moduleId>/` — the
//       exact staging directory `scaffold --draft` itself writes to (`draftsDirFor`, imported from
//       `../store.mjs` — the same module `scaffold.mjs` re-exports it from, CRW-F8 — so both verbs
//       and every caller share one path convention, never two that could drift).
//   (2) a belt-and-suspenders check that the resolved path never falls inside
//       `modules/<moduleId>/reviews/`, even though check (1) already excludes it by construction
//       (`.review-drafts/` and `modules/<id>/reviews/` are disjoint trees under any `--root`).
// Neither check reads any bytes from `reviews/` at any point — this file calls `readFile` on
// exactly one path, the `--draft` argument itself, after both checks above have already passed.
//
// clinical-review-workflow-v1 Wave-2 codex gate, BLOCKER 1 (defense in depth, on top of everything
// above): checks (1)/(2) validate only the `--draft` FILE ARGUMENT's own location -- neither says
// anything about the CONTENT of the parsed draft. Before this fix, `run` validated only the parsed
// draft's `moduleId`/`synthetic` fields before handing it to `signRecordDryRun` and then
// `writeNewReviewRecordFile(rootDir, moduleId, draft.review_id, signed)` -- a staged file whose OWN
// `review_id` field was a path-traversal payload (e.g. `"../../escape"`), or whose shape was
// otherwise schema-invalid in a way that had nothing to do with `synthetic`, could reach that write
// call unchecked. Two additional, independent checks close this:
//   (b) `draft.review_id` is validated against the SAME canonical `"rr-<seq4>-<role>"` pattern
//       `schemas/review-record.schema.json`'s own `review_id` property carries -- reusing
//       `../store.mjs`'s own `parseReviewId` (the tool's one canonical parser for this shape,
//       already used by `list`/`render`) rather than a second, independently-maintained regex.
//       Runs immediately after the draft is parsed, well before `writeNewReviewRecordFile` (or
//       anything else) ever constructs a path from `review_id`.
//   (a) the FULLY-SIGNED record (`signed`, not `draft`) is validated against the complete,
//       committed `schemas/review-record.schema.json` -- the SAME `scripts/lib/json-schema-lite.mjs`
//       `validate` function `lib/verbs/validate.mjs` itself calls post-commit, reused here rather
//       than forked. This runs on `signed`, not `draft`: a `synthetic: true` draft's
//       `signature: null` cannot itself satisfy the schema (a synthetic:true record's signature
//       slot MUST be a populated object per the schema's own `allOf`), so `signed` -- the exact
//       record about to be committed -- is the honest point to prove full schema conformance. A
//       malformed, non-scaffold-produced draft (a missing required field, a role/review_id
//       mismatch, an out-of-enum `decision`, ...) is refused here, fail-closed, before any
//       committed write.
// Both checks are additive: a well-formed, scaffold-produced draft is unaffected by either.

import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { draftsDirFor, parseReviewId, reviewsDirFor, writeNewReviewRecordFile } from '../store.mjs';
import { signRecordDryRun } from '../signature.mjs';
import { parseYamlDocument } from '../../../rf-bundle-to-kb-pack/lib/yaml-lite.mjs';
import { validate as validateAgainstSchema } from '../../../../scripts/lib/json-schema-lite.mjs';
import { EXIT_OK, UsageError } from '../errors.mjs';

// Mirrors `lib/verbs/validate.mjs`'s own identically-computed `REPO_ROOT`/`SCHEMA_PATH` constants
// exactly (same directory depth: both files live at `tools/review-record/lib/verbs/`) -- one
// canonical schema file, read the same way by both verbs, never two independently-derived paths.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');

/**
 * Loads and parses `schemas/review-record.schema.json` fresh on every call -- mirrors
 * `lib/verbs/validate.mjs`'s own unexported `loadSchema` helper exactly (no caching either place;
 * this is a single-shot CLI tool). The VALIDATION LOGIC itself (`validateAgainstSchema`, imported
 * above from `scripts/lib/json-schema-lite.mjs`) is the exact same function `validate.mjs` calls --
 * this helper only reads and parses the schema document, it does not implement any check of its
 * own (BLOCKER 1(a): "reuse the exact validation the validate verb uses," never fork a second one).
 *
 * @returns {Promise<object>}
 */
async function loadSchema() {
  return JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
}

function requireString(options, flag, key = flag) {
  const value = options[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new UsageError(`sign requires --${flag} <value>`);
  }
  return value;
}

/**
 * P2-T2 (OQ-1, FR-7/23, R1): the flag names `run` refuses unconditionally — keyed by the camelCase
 * option name `cli.mjs`'s `parseFlags` produces (`--test-keys` -> `testKeys`), valued by the exact
 * `--kebab-case` spelling to name in the refusal message. Naming these flags here (so `run` can
 * detect and REJECT them) is not "key-reading code" — nothing keyed off this object is ever passed
 * to a file-open call or dereferenced as an environment-variable name anywhere in this file; see
 * `tests/ef-review-record-cli.test.mjs`'s static grep test, which checks for that directly.
 */
const FORBIDDEN_KEY_FLAGS = Object.freeze({
  keyfile: '--keyfile',
  key: '--key',
  testKeys: '--test-keys',
});

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
 *   this file's header for the frozen, no-optional-flags signature. `--keyfile`/`--key`/
 *   `--test-keys`/`--record` are never legal on this verb (P2-T2, FR-7/23/25, R1) — passing any of
 *   them is refused unconditionally, before every other check.
 * @returns {Promise<number>}
 */
export async function run(options = {}) {
  // P2-T2 (FR-7/23, R1): refused FIRST, before --draft/--module/--root are even checked for
  // presence — "for any input" (the plan's own phrasing). No key material is ever read as a result
  // of any of these flags being present; they are named here ONLY to detect and reject them.
  for (const [optionKey, flagName] of Object.entries(FORBIDDEN_KEY_FLAGS)) {
    if (options[optionKey] !== undefined) {
      throw new UsageError(
        `sign does not accept ${flagName} -- there is no keyfile/key-material seam anywhere in ` +
          'this tool (OQ-1). Signing is TESTKEY-only: lib/signature.mjs\'s signRecordDryRun ' +
          'generates a fresh, ephemeral, in-memory-only Ed25519 keypair on every call and never ' +
          'reads a key from a file, a CLI flag, or an environment variable. Real signing requires ' +
          'gate G2 (signing custodian + offline key ceremony, ADR-0005), which has not cleared.',
      );
    }
  }

  // P2-T2 (FR-25, R1): sign never accepts a --record flag pointing at an already-committed file —
  // refused unconditionally, whether or not the named id resolves to a real modules/<id>/reviews/
  // record. sign has no code path that ever opens a --record-named path at all.
  if (options.record !== undefined) {
    throw new UsageError(
      'sign does not accept --record -- it operates exclusively on a staged "scaffold --draft" ' +
        'file at <root>/.review-drafts/<moduleId>/<review_id>.draft.yaml, never on an ' +
        'already-committed modules/<moduleId>/reviews/*.yaml record (FR-25); sign never opens or ' +
        'rewrites a path already inside reviews/ (F1/R10).',
    );
  }

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

  // BLOCKER 1(b) (clinical-review-workflow-v1 Wave-2 codex gate): validate review_id against the
  // schema's own canonical "rr-<seq4>-<role>" pattern BEFORE any path is ever constructed from it
  // -- reuses lib/store.mjs's own canonical parser (parseReviewId), the exact same pattern
  // schemas/review-record.schema.json's `review_id` property carries, rather than a second,
  // independently-maintained regex. A staged draft whose review_id is NOT this shape (e.g. a
  // path-traversal payload like "../../escape") is refused here -- fail closed
  // (`MalformedReviewIdError`, a `UsageError`) -- well before `signRecordDryRun` or
  // `writeNewReviewRecordFile` ever see it.
  parseReviewId(draft.review_id);

  if (draft.moduleId !== moduleId) {
    throw new UsageError(
      `the staged draft's moduleId "${draft.moduleId}" does not match --module "${moduleId}" — ` +
        'sign refuses to proceed on a moduleId mismatch between the draft\'s own content and the ' +
        'flag naming which module\'s reviews/ directory to write into.',
    );
  }

  // P2-T2 (FR-7, R1): explicit, sign-owned fail-closed refusal of a synthetic:false draft, naming
  // both G1 and G2 by name. Runs BEFORE signRecordDryRun so the caller sees this specific wording
  // rather than lib/signature.mjs's own generic synthetic:true-only message (a file this task does
  // not own or modify — see this file's header).
  if (draft.synthetic !== true) {
    throw new UsageError(
      `sign refuses to sign moduleId="${draft.moduleId}" review_id="${draft.review_id ?? '?'}" -- ` +
        'this draft is synthetic:false (a real-identity record). Real signing remains structurally ' +
        'impossible in this feature until BOTH gates below have cleared -- neither has: gate G1 ' +
        '(named credentialed reviewer roster -- a human out-of-band verifies a real clinician ' +
        'identity and records it in governance/reviewer-roster.yaml, which ships synthetic-only ' +
        'today) and gate G2 (signing custodian + offline key ceremony, ADR-0005). This refusal is ' +
        'the correct terminal state, not a missing feature -- see docs/governance/gates-registry.md.',
    );
  }

  // signRecordDryRun (lib/signature.mjs) itself ALSO refuses, fail-closed, to sign anything but a
  // synthetic:true record with no signature already attached — see this file's header. The explicit
  // check above is an earlier, independent, more specifically-worded restatement of that same
  // guarantee (defense in depth), not a replacement for it.
  const signed = signRecordDryRun(draft);

  // BLOCKER 1(a) (clinical-review-workflow-v1 Wave-2 codex gate): validate the fully-signed record
  // against the SAME committed review-record schema `validate` checks post-commit -- reusing
  // scripts/lib/json-schema-lite.mjs's own `validate` function (this file's `validateAgainstSchema`
  // import), never a second, independently-maintained validator. See this file's header for why
  // this runs against `signed`, not `draft`. A malformed, non-scaffold-produced draft (a missing
  // required field, a role/review_id mismatch, an out-of-enum value, ...) is refused here,
  // fail-closed, before any committed write.
  const schemaViolations = validateAgainstSchema(await loadSchema(), signed);
  if (schemaViolations.length > 0) {
    throw new UsageError(
      `sign refuses to commit moduleId="${signed.moduleId}" review_id="${signed.review_id}" -- the ` +
        'signed record does not conform to schemas/review-record.schema.json (defense in depth; ' +
        'the same schema this tool\'s `validate` verb checks post-commit):\n' +
        schemaViolations.map((e) => `  - ${e.path}: ${e.message}`).join('\n'),
    );
  }

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
