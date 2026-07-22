// tools/rf-bundle-to-kb-pack/lib/verbs/inspect.mjs — `inspect` verb
// (P2-T6, 02 §4.5).
//
//   inspect --run-dir <dir> --module <module.json path>
//
// Contract this file satisfies (see the module boundary table in ../../README.md):
//   - Runs loader.loadBundle (P2-T2) -> hashing.pinArtifacts (P2-T3) -> eligibility.checkEligibility
//     (P2-T4), in that fixed order, then prints a structured, non-empty summary (artifact list,
//     per-artifact SHA-256 hashes, per-claim eligibility pass/fail) to stdout as JSON.
//   - Emits NO pack output — this verb never writes to `build/kb-pack/` or anywhere else on disk.
//     "Inspect" is read-only observation; drafting a proposal is `propose`'s job (Phase 3).
//   - Zero network calls, zero LLM/generative-model invocations (FR-10) — this file imports only
//     the three pipeline stages above plus `../errors.mjs`; none of those import `node:http`,
//     `node:https`, `node:dgram`, `fetch`, or any AI/model SDK (see README "Zero network / zero
//     LLM, structurally"). `tests/ef-converter-inspect.test.mjs` asserts this both structurally
//     (source-import scan) and at runtime (network-hook spies during a live `run()` call).
//   - A `ConverterError` thrown by any of the three pipeline stages (e.g. `BundleNotVerifiedError`,
//     `VerificationStateMismatchError`, `DecisionsNotFoundError`) propagates unchanged — `inspect`
//     adds no error-remapping of its own, so `cli.mjs`'s `dispatchVerb` forwards the original
//     `exitCode` verbatim per the fail-closed error taxonomy (P2-T5).
//
// Verb-handler contract (applies to every file in this directory): an async `run(options)`
// function that either resolves to a numeric exit code (see `lib/errors.mjs`'s `EXIT_*`
// constants) or throws a `ConverterError` (or subclass) — `cli.mjs` forwards a thrown
// `ConverterError`'s `exitCode` untouched.

import path from 'node:path';

import { loadBundle } from '../loader.mjs';
import { pinArtifacts } from '../hashing.mjs';
import { checkEligibility } from '../eligibility.mjs';
import { UsageError, EXIT_OK } from '../errors.mjs';

// Single-file artifact keys, in the same fixed order `hashing.mjs`'s `hashes` map uses (seam
// invariant 13: deterministic output for identical input bytes) — this order is what ends up in
// the printed summary's `artifacts[]` array, so it must not depend on object-key iteration order.
const SINGLE_FILE_ARTIFACT_LABELS = [
  ['module', 'module.json (module envelope)'],
  ['decisions', 'authoring-decisions.yaml'],
  ['bundle', 'evidence_bundle.yaml'],
  ['researchBrief', 'research_brief.md'],
  ['swarmPlan', 'swarm_plan.yaml'],
  ['claimLedger', 'claim_ledger.yaml'],
  ['report', 'report_draft.md'],
  ['verification', 'verification.yaml'],
  ['ccdashEvent', 'ccdash_event.yaml'],
];

/**
 * Builds the structured `inspect` summary from a fully pinned bundle + eligibility report. Pure
 * function — no I/O, no pack output; exported separately from `run` so its shape is directly unit
 * testable without re-running the whole loader/hashing/eligibility pipeline each time.
 *
 * @param {object} pinnedBundle the value `hashing.pinArtifacts()` (P2-T3) resolves to
 * @param {ReturnType<typeof checkEligibility>} eligibility the value `eligibility.checkEligibility()` (P2-T4) resolves to
 * @returns {object} a plain, JSON-serializable summary object
 */
export function buildSummary(pinnedBundle, eligibility) {
  const artifacts = [];

  for (const [key, label] of SINGLE_FILE_ARTIFACT_LABELS) {
    const entry = pinnedBundle[key] ?? pinnedBundle?.artifacts?.[key];
    if (!entry) continue;
    artifacts.push({ label, path: entry.path, sha256: entry.sha256 });
  }

  for (const card of pinnedBundle?.artifacts?.sourceCards ?? []) {
    artifacts.push({
      label: `source_card:${path.basename(card.path)}`,
      path: card.path,
      sha256: card.sha256,
    });
  }
  for (const card of pinnedBundle?.artifacts?.extractionCards ?? []) {
    artifacts.push({
      label: `extraction_card:${path.basename(card.path)}`,
      path: card.path,
      sha256: card.sha256,
    });
  }

  const claims = eligibility.claims.map(({ claimId, status, category, eligible, reasons }) => ({
    claimId,
    status,
    category,
    eligible,
    reasons,
  }));

  return {
    verb: 'inspect',
    runId: pinnedBundle.runId ?? null,
    bundleId: pinnedBundle.bundleId ?? null,
    moduleId: pinnedBundle.moduleId ?? null,
    runDir: pinnedBundle.runDir ?? null,
    bundle: eligibility.bundle,
    artifacts,
    claims,
    counts: {
      artifacts: artifacts.length,
      claims: claims.length,
      eligible: eligibility.eligibleClaimIds.length,
      rejected: eligibility.rejectedClaims.length,
    },
    packOutput: null, // inspect NEVER emits pack output — explicit, not merely absent.
  };
}

/**
 * @param {{ runDir?: string, module?: string }} options parsed CLI flags for this verb
 * @returns {Promise<number>} process exit code
 */
export async function run(options) {
  const runDir = options?.runDir;
  const modulePath = options?.module;

  if (typeof runDir !== 'string' || runDir === '') {
    throw new UsageError('inspect requires a non-empty --run-dir <dir>');
  }
  if (typeof modulePath !== 'string' || modulePath === '') {
    throw new UsageError('inspect requires a non-empty --module <module.json path>');
  }

  // Fixed pipeline order (README "Data flow for inspect/verify"): loader -> hashing -> eligibility.
  // Each stage's own `ConverterError` propagates unchanged — this verb performs no remapping.
  const loaded = await loadBundle({ runDir, modulePath });
  const pinned = await pinArtifacts(loaded);
  const eligibility = checkEligibility(pinned);

  const summary = buildSummary(pinned, eligibility);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  return EXIT_OK;
}
