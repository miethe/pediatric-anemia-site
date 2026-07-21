// tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs — `propose` verb (P3-T7, evidence-foundry-
// buildout Phase 3, `02 §4.5`, `02 §4.6` phases 4-9).
//
//   propose --run-dir <dir> --module <module.json path> --decisions <authoring-decisions.yaml>
//           --out <build/kb-pack/... dir>
//
// This verb WIRES TOGETHER the pieces P3-T1..T6 already built -- it invents nothing new about
// clinical content. Concretely:
//
//   1. Runs the same fixed loader -> hashing -> eligibility pipeline `inspect`/`verify` already
//      use (P2-T2/T3/T4), so `propose` gets every seam-invariant guarantee those stages already
//      enforce (verified bundle only, hash pinning, fail-closed claim eligibility) for free.
//   2. Fails closed if the loaded module id is not the one module this converter has hand-authored
//      drafting content for (`cbc_suite_v1`, P3-T1..T6) -- `propose` does not attempt to draft
//      content for any other module (FR-14: never infer clinical Boolean logic from prose; there
//      is no prose-inference path here at all, only pre-authored, reviewable content keyed to one
//      module).
//   3. Routes the bundle's claims through `../claim-routing.mjs` (P3-T4) and asserts the seam
//      invariant 8 guarantee (02 §2.3 item 8, this task's own AC): no drafted rule proposal may be
//      grounded SOLELY by a mixed/contradicted (or otherwise non-anchoring) claim.
//   4. Assembles the full `02 §4.4` staged-pack file set at `--out`:
//        pack-provenance.json      -- NEW this task: `02 §4.8`'s bundle-mapping table, computed
//                                     from the pinned bundle (no schema exists for this file --
//                                     this plan's binding OQ-7 ruling names exactly 4 new schema
//                                     files, none of them pack-provenance).
//        evidence.json             -- byte-verbatim copy of the module's own committed P3-T2
//                                     projection (modules/<id>/evidence.json).
//        evidence-assertions.json  -- byte-verbatim copy of the module's own committed P3-T3
//                                     projection (modules/<id>/evidence-assertions.json).
//        candidates.json,
//        rule-proposals.json       -- via `../rule-candidate-drafts.mjs#writeDraftPack` (P3-T5).
//        rules.json,
//        rule-provenance.json      -- via `scripts/evidence/govern-staged-rules.mjs`
//                                     `#writeStagedRulesAndProvenance` (P3-T6).
//        release-manifest.unsigned.json -- NEW this task (P5-T1, FR-18, `02 §4.18` minus the
//                                     `signature` block): binds `rfInputs[]`, `converter`,
//                                     `testCorpusHash`, `traceabilityHash`. See the P5-T1 block
//                                     near the bottom of this file for the four pure builder
//                                     functions this emission uses.
//
// Zero network calls, zero LLM/generative-model invocations, ever (FR-10) -- this file imports
// only `node:fs/promises`, `node:path`, `node:crypto`, `node:url`, the already-vetted converter
// pipeline modules, and the two P3-T5/P3-T6 drafting modules; none of those import `node:http`,
// `node:https`, `node:dgram`, `fetch`, or any AI/model SDK (tests/ef-converter-inspect.test.mjs's
// structural scan already covers every `.mjs` file under this tree, this one included).
//
// Verb-handler contract: see `./inspect.mjs`'s header comment (same contract applies here).

import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { loadBundle } from '../loader.mjs';
import { pinArtifacts } from '../hashing.mjs';
import { checkEligibility } from '../eligibility.mjs';
import { routeClaims } from '../claim-routing.mjs';
import { MODULE_ID, RULE_PROPOSALS, writeDraftPack } from '../rule-candidate-drafts.mjs';
import { writeStagedRulesAndProvenance } from '../../../../scripts/evidence/govern-staged-rules.mjs';
import { EXIT_OK, GovernanceError, SchemaError, UsageError } from '../errors.mjs';

// This file lives at tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs -- 4 directories below the
// repository root, 2 below this converter's own root. Used only to locate (a) this module's own
// generated test corpus (tests/ef-<moduleId>-*.test.mjs, P4-T5..T8) for `testCorpusHash`, and (b)
// this converter's own `.mjs` source tree for `converter.configSha256` (P5-T1, FR-18) -- purely
// local filesystem paths, never a network boundary.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CONVERTER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** This converter build's own identity, recorded in `pack-provenance.json.converter` (`02 §4.8`
 * implies a converter identity belongs on the provenance record; nothing else in this repo names
 * one yet, so this is the first and only place it is defined). Bump `CONVERTER_VERSION` only when
 * this tool's OWN behavior changes in a way that could change emitted bytes for identical inputs
 * (seam invariant 13) -- never on a whim, and never derived from wall-clock time. */
export const CONVERTER_NAME = 'rf-bundle-to-kb-pack';
export const CONVERTER_VERSION = '0.1.0';

/** Matches the staged-pack directory name every P3 drafting module already writes into
 * (`build/kb-pack/cbc_suite_v1/0.1.0-proposal/`) -- recorded on `pack-provenance.json` so a reader
 * of that one file alone knows which pack-version directory it describes. */
export const PACK_VERSION = '0.1.0-proposal';

/**
 * A drafted rule proposal (P3-T5's `RULE_PROPOSALS`) has no claim in its `rfClaimIds` that is
 * eligible to serve as its SOLE positive basis -- every cited claim is conflict-visible (mixed/
 * contradicted), rejected, or otherwise unresolvable against the routing report. Exit 3
 * (GOVERNANCE): this is exactly `02 §5.2`'s "block; never override in the converter" case --
 * seam invariant 8 has no override path.
 */
export class ConflictedSoleBasisError extends GovernanceError {
  constructor(proposalId, claimIds) {
    super(
      `rule proposal "${proposalId}" has no claim eligible as its sole positive basis -- every ` +
        `cited claim (${JSON.stringify(claimIds)}) is conflict-visible (mixed/contradicted), ` +
        'rejected, or unresolved against the routing report. Seam invariant 8 (02 §2.3 item 8, ' +
        'FR-13): mixed/contradicted claims may never directly ground a one-sided rule.',
    );
    this.proposalId = proposalId;
    this.claimIds = claimIds;
  }
}

/**
 * Seam invariant 8 guard (02 §2.3 item 8, FR-13, this task's own AC): for every drafted proposal,
 * at least one of its `rfClaimIds` must resolve, in `routingReport`, to a claim with
 * `eligibleAsSolePositiveBasis === true` (a `supported` claim with a resolved exact passage, or an
 * `inference` claim with a populated `inference_basis.from_claims`). A proposal backed only by
 * mixed/contradicted/rejected/unresolved claim ids throws `ConflictedSoleBasisError` -- fail
 * closed, never a silently-accepted one-sided rule.
 *
 * Pure function -- no I/O -- so it is directly unit-testable against a synthetic stub proposal and
 * a synthetic routing report, exactly like this task's own AC names ("a stub mixed/contradicted
 * claim never produces a one-sided rule"), independent of any real `rf` bundle.
 *
 * @param {ReadonlyArray<{ id: string, rfClaimIds: string[] }>} proposals
 * @param {import('../claim-routing.mjs').RoutingReport} routingReport
 * @returns {void}
 */
export function assertNoSoleConflictedBasis(proposals, routingReport) {
  const routedById = new Map(routingReport.routed.map((routed) => [routed.claimId, routed]));
  for (const proposal of proposals) {
    const claimIds = proposal.rfClaimIds ?? [];
    const hasSoleBasisClaim = claimIds.some(
      (claimId) => routedById.get(claimId)?.eligibleAsSolePositiveBasis === true,
    );
    if (!hasSoleBasisClaim) {
      throw new ConflictedSoleBasisError(proposal.id, claimIds);
    }
  }
}

/**
 * `02 §4.8`'s per-artifact half of the bundle-mapping table: every artifact the loader/hashing
 * pipeline already pinned, as a flat, deterministically-ordered (loader-sorted by filename) list
 * of `{ key, path (relative to runDir), sha256, sizeBytes, mediaType }` records.
 *
 * @param {object} pinnedBundle the value `hashing.pinArtifacts()` (P2-T3) resolves to
 * @returns {Array<{ key: string, path: string, sha256: string, sizeBytes: number, mediaType: string }>}
 */
export function buildUpstreamArtifacts(pinnedBundle) {
  const entries = [];
  const runDir = pinnedBundle.runDir;

  const pushEntry = (key, entry, mediaType) => {
    if (!entry) return;
    entries.push({
      key,
      path: path.relative(runDir, entry.path),
      sha256: entry.sha256,
      sizeBytes: entry.raw.length,
      mediaType,
    });
  };

  pushEntry('module', pinnedBundle.module, 'application/json');
  pushEntry('authoring_decisions', pinnedBundle.decisions, 'application/yaml');
  pushEntry('evidence_bundle', pinnedBundle.bundle, 'application/yaml');
  pushEntry('research_brief', pinnedBundle.artifacts.researchBrief, 'text/markdown');
  pushEntry('swarm_plan', pinnedBundle.artifacts.swarmPlan, 'application/yaml');
  pushEntry('claim_ledger', pinnedBundle.artifacts.claimLedger, 'application/yaml');
  pushEntry('report', pinnedBundle.artifacts.report, 'text/markdown');
  pushEntry('verification', pinnedBundle.artifacts.verification, 'application/yaml');
  pushEntry('ccdash_event', pinnedBundle.artifacts.ccdashEvent, 'application/yaml');
  for (const card of pinnedBundle.artifacts.sourceCards ?? []) {
    pushEntry(`source_card:${path.basename(card.path)}`, card, 'text/markdown');
  }
  for (const card of pinnedBundle.artifacts.extractionCards ?? []) {
    pushEntry(`extraction_card:${path.basename(card.path)}`, card, 'application/yaml');
  }

  return entries;
}

// `evidence_bundle.yaml.counts` field names this recalculation reconciles against (`02 §4.8`:
// "copy for audit; recalculate and compare").
const RECALCULATED_COUNT_KEYS = [
  'source_cards',
  'extraction_cards',
  'claims_total',
  'claims_supported',
  'claims_mixed',
  'claims_contradicted',
  'claims_inference',
  'claims_speculation',
  'claims_unsupported',
];

/**
 * `02 §4.8`'s `counts` row: copy the bundle's own recorded counts for audit, but also recalculate
 * them from the actually-pinned/actually-classified artifacts and claims, and record whether the
 * two agree -- never silently trust the recorded numbers alone.
 *
 * @param {object} pinnedBundle
 * @param {ReturnType<import('../eligibility.mjs').checkEligibility>} eligibility
 * @returns {{ recorded: object, recalculated: Record<string, number>, matches: boolean }}
 */
export function buildUpstreamCounts(pinnedBundle, eligibility) {
  const recorded = pinnedBundle.bundle.parsed?.counts ?? {};

  const recalculated = {
    source_cards: (pinnedBundle.artifacts.sourceCards ?? []).length,
    extraction_cards: (pinnedBundle.artifacts.extractionCards ?? []).length,
    claims_total: eligibility.claims.length,
    claims_supported: 0,
    claims_mixed: 0,
    claims_contradicted: 0,
    claims_inference: 0,
    claims_speculation: 0,
    claims_unsupported: 0,
  };
  for (const claim of eligibility.claims) {
    const key = `claims_${claim.status}`;
    if (Object.hasOwn(recalculated, key)) recalculated[key] += 1;
  }

  const matches = RECALCULATED_COUNT_KEYS.every((key) => recorded[key] === recalculated[key]);

  return { recorded, recalculated, matches };
}

/**
 * `pack-provenance.json`'s full document shape (`02 §4.8`'s bundle-mapping table). No dedicated
 * schema exists for this file (this plan's binding OQ-7 ruling names exactly 4 new schema files,
 * none of them pack-provenance) -- every field here is either copied verbatim from the pinned
 * bundle or computed by the two pure helpers above, never invented.
 *
 * @param {object} pinnedBundle
 * @param {ReturnType<import('../eligibility.mjs').checkEligibility>} eligibility
 * @returns {object}
 */
export function buildPackProvenance(pinnedBundle, eligibility) {
  const bundleParsed = pinnedBundle.bundle.parsed ?? {};
  const governance = bundleParsed.governance ?? {};

  return {
    schemaVersion: '1.0',
    moduleId: pinnedBundle.moduleId,
    packVersion: PACK_VERSION,
    converter: { name: CONVERTER_NAME, version: CONVERTER_VERSION },
    rfBundleId: bundleParsed.id ?? null,
    rfRunId: bundleParsed.run_id ?? null,
    rfIntentId: bundleParsed.intent_id ?? null,
    upstreamVerification: {
      bundleStatus: eligibility.bundle.status,
      bundleCreatedAt: bundleParsed.created_at ?? null,
      bundleSha256: pinnedBundle.hashes.bundle,
      exitCode: eligibility.bundle.verification.exitCode,
      passed: eligibility.bundle.verification.passed,
    },
    upstreamArtifacts: buildUpstreamArtifacts(pinnedBundle),
    upstreamCounts: buildUpstreamCounts(pinnedBundle, eligibility),
    dataClassification: governance.sensitivity ?? null,
    rfWritebackApproved: governance.approved_for_writeback ?? null,
    rfLineage: bundleParsed.lineage ?? null,
  };
}

/**
 * Reads `modules/<id>/<filename>` (a P3-T2/P3-T3 committed projection), failing closed with a
 * named error rather than a generic ENOENT stack trace if it is missing -- mirrors
 * `loader.mjs`'s `DecisionsNotFoundError` posture for the same class of "a prerequisite task's
 * output has not landed yet" failure.
 *
 * @param {string} moduleDir
 * @param {string} filename
 * @returns {Promise<{ path: string, raw: string }>}
 */
async function readModuleProjectionFile(moduleDir, filename) {
  const filePath = path.join(moduleDir, filename);
  try {
    const raw = await readFile(filePath, 'utf8');
    return { path: filePath, raw };
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new UsageError(
        `propose requires modules/<id>/${filename} to already exist at ${filePath} (P3-T2/P3-T3) ` +
          '-- run those tasks before propose, do not expect propose to author it.',
      );
    }
    throw err;
  }
}

// =================================================================================================
// P5-T1: release-manifest.unsigned.json (FR-18, `02 §4.18` minus the `signature` block)
// =================================================================================================

/**
 * Recursively collects every `.mjs` file under `dir`, as an array of paths RELATIVE to `dir`,
 * sorted lexicographically -- independent of the underlying filesystem's `readdir` ordering, so
 * the result is deterministic run to run (seam invariant 13) regardless of traversal order.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collectConverterSourceFilesRelative(dir) {
  const collected = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
        collected.push(path.relative(dir, full));
      }
    }
  }
  await walk(dir);
  return collected.sort();
}

/**
 * `release-manifest.unsigned.json`'s `converter.configSha256` (FR-18, `02 §4.18`): a SHA-256 over
 * every `.mjs` source file this converter build ships (name + content, sorted, no timestamps), so
 * two runs of the SAME converter build against the SAME inputs hash identically (FR-20 seam
 * invariant 13), while any change to this tool's own behavior-defining code changes the hash even
 * if `CONVERTER_VERSION` was not manually bumped. A technical integrity hash over this tool's own
 * code -- never a clinical value; it carries no threshold, dose, or diagnostic content.
 *
 * @param {string} converterRoot tools/rf-bundle-to-kb-pack/ (this converter's own root)
 * @returns {Promise<string>} lowercase hex SHA-256 digest (no "sha256:" prefix)
 */
export async function computeConverterConfigSha256(converterRoot) {
  const relFiles = await collectConverterSourceFilesRelative(converterRoot);
  const hash = createHash('sha256');
  for (const rel of relFiles) {
    const raw = await readFile(path.join(converterRoot, rel), 'utf8');
    hash.update(`${rel}\n${raw}`);
  }
  return hash.digest('hex');
}

/**
 * `release-manifest.unsigned.json`'s `testCorpusHash` (FR-18, FR-20): a SHA-256 over every
 * generated engine-test file for this module (`tests/ef-<moduleId>-*.test.mjs`, P4-T5..T8 --
 * positive/negative/boundary/missingness/dangerous-miss), name + content, sorted by filename so
 * the digest does not depend on directory-listing order. Fails closed (`UsageError`) if the module
 * has no generated test corpus yet -- a manifest asserting a test-corpus hash over zero files would
 * silently misrepresent "no tests exist" as "tests were hashed."
 *
 * @param {string} repoRoot repository root (this repo, not the `rf` run's own directory)
 * @param {string} moduleId e.g. "cbc_suite_v1"
 * @returns {Promise<{ sha256: string, files: string[] }>}
 */
export async function computeTestCorpusHash(repoRoot, moduleId) {
  const testsDir = path.join(repoRoot, 'tests');
  const pattern = new RegExp(`^ef-${moduleId}-.*\\.test\\.mjs$`);
  const entries = await readdir(testsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (files.length === 0) {
    throw new UsageError(
      `propose requires at least one generated test-corpus file matching tests/ef-${moduleId}-*.test.mjs ` +
        '(P4-T5..T8) before a release manifest can be emitted -- none were found.',
    );
  }
  const hash = createHash('sha256');
  for (const file of files) {
    const raw = await readFile(path.join(testsDir, file), 'utf8');
    hash.update(`${file}\n${raw}`);
  }
  return { sha256: hash.digest('hex'), files };
}

/**
 * `release-manifest.unsigned.json`'s `traceabilityHash` (FR-18, `02 §4.16`/`02 §4.18`): pending
 * P5-T4's dedicated `source -> passage -> claim -> decision -> rule -> test -> output` index
 * artifact, this is a SHA-256 over the traceability-bearing artifacts this run already has in
 * hand -- authoring-decisions.yaml (claim -> decision), evidence-assertions.json
 * (passage -> claim), rule-provenance.json (decision -> rule), and rules.json (the compiled rule
 * itself) -- name + raw bytes, sorted by name so the digest is independent of call-site argument
 * order. Pure function of its string inputs -- no I/O -- directly unit-testable.
 *
 * @param {{ decisionsRaw: string, evidenceAssertionsRaw: string, ruleProvenanceRaw: string, rulesRaw: string }} parts
 * @returns {string} lowercase hex SHA-256 digest (no "sha256:" prefix)
 */
export function computeTraceabilityHash(parts) {
  const entries = [
    ['authoring-decisions.yaml', parts.decisionsRaw],
    ['evidence-assertions.json', parts.evidenceAssertionsRaw],
    ['rule-provenance.json', parts.ruleProvenanceRaw],
    ['rules.json', parts.rulesRaw],
  ].sort(([a], [b]) => a.localeCompare(b));
  const hash = createHash('sha256');
  for (const [label, raw] of entries) {
    hash.update(`${label}\n${raw}`);
  }
  return hash.digest('hex');
}

/**
 * Assembles `release-manifest.unsigned.json`'s full document (FR-18, `02 §4.18` MINUS the
 * `signature` block -- this build is never signed; `modules/cbc_suite_v1/module.json`'s `status`
 * stays `"unsigned-stub"`). Binds exactly the fields this task's own acceptance criteria names --
 * `rfInputs[].{runId, bundleSha256, claimLedgerSha256, verificationExitCode}`,
 * `converter.{name, version, configSha256}`, `testCorpusHash`, `traceabilityHash` -- and no others:
 * `knowledgeBaseVersion`/`approvedBy`/`validationRunId`/`releasedAt`/`signature` etc. are E1+
 * production-manifest fields this unsigned E0 manifest deliberately does not carry (inventing them
 * here would misrepresent an unvalidated, unsigned staged proposal as release-ready). Pure
 * function of its inputs -- no I/O -- directly unit-testable.
 *
 * @returns {object}
 */
export function buildReleaseManifest({
  moduleId,
  packVersion,
  pinnedBundle,
  eligibility,
  converterConfigSha256,
  testCorpusSha256,
  traceabilityHashHex,
}) {
  return {
    schemaVersion: '1.0',
    moduleId,
    packVersion,
    rfInputs: [
      {
        runId: pinnedBundle.runId,
        bundleSha256: `sha256:${pinnedBundle.hashes.bundle}`,
        claimLedgerSha256: `sha256:${pinnedBundle.hashes.claimLedger}`,
        verificationExitCode: eligibility.bundle.verification.exitCode,
      },
    ],
    converter: {
      name: CONVERTER_NAME,
      version: CONVERTER_VERSION,
      configSha256: `sha256:${converterConfigSha256}`,
    },
    testCorpusHash: `sha256:${testCorpusSha256}`,
    traceabilityHash: `sha256:${traceabilityHashHex}`,
  };
}

/**
 * @param {{ runDir?: string, module?: string, decisions?: string, out?: string }} options parsed
 *   CLI flags for this verb
 * @returns {Promise<number>} process exit code
 */
export async function run(options) {
  const runDir = options?.runDir;
  const modulePath = options?.module;
  const decisionsPath = options?.decisions;
  const outDir = options?.out;

  if (typeof runDir !== 'string' || runDir === '') {
    throw new UsageError('propose requires a non-empty --run-dir <dir>');
  }
  if (typeof modulePath !== 'string' || modulePath === '') {
    throw new UsageError('propose requires a non-empty --module <module.json path>');
  }
  if (typeof decisionsPath !== 'string' || decisionsPath === '') {
    throw new UsageError('propose requires a non-empty --decisions <authoring-decisions.yaml path>');
  }
  if (typeof outDir !== 'string' || outDir === '') {
    throw new UsageError('propose requires a non-empty --out <dir>');
  }

  // `loadBundle` (P2-T2) always resolves authoring-decisions.yaml relative to `--module`, never
  // from a separately-supplied path -- so a `--decisions` flag pointing anywhere else would
  // silently be ignored rather than honored. Enforce the two agree instead of pretending the flag
  // does something it cannot.
  const resolvedModuleDir = path.dirname(path.resolve(modulePath));
  const expectedDecisionsPath = path.join(resolvedModuleDir, 'authoring-decisions.yaml');
  const resolvedDecisionsPath = path.resolve(decisionsPath);
  if (resolvedDecisionsPath !== expectedDecisionsPath) {
    throw new UsageError(
      `--decisions must be the module's own authoring-decisions.yaml (expected ` +
        `${expectedDecisionsPath}, got ${resolvedDecisionsPath})`,
    );
  }

  // Fixed pipeline order (README "Data flow for inspect/verify/propose"): loader -> hashing ->
  // eligibility. Each stage's own `ConverterError` propagates unchanged -- propose performs no
  // remapping, same posture as inspect.mjs/verify.mjs.
  const loaded = await loadBundle({ runDir, modulePath });
  const pinned = await pinArtifacts(loaded);
  const eligibility = checkEligibility(pinned);

  if (pinned.moduleId !== MODULE_ID) {
    throw new UsageError(
      `propose has hand-authored drafting content (P3-T1..T6, FR-14) only for module ` +
        `"${MODULE_ID}" -- got module id "${pinned.moduleId}" from ${modulePath}. Drafting ` +
        'content for a different module is not yet implemented; propose refuses to silently ' +
        `draft "${MODULE_ID}" content under a different module's identity.`,
    );
  }

  const evidenceFile = await readModuleProjectionFile(resolvedModuleDir, 'evidence.json');
  const evidenceAssertionsFile = await readModuleProjectionFile(
    resolvedModuleDir,
    'evidence-assertions.json',
  );

  let evidenceAssertionsDoc;
  try {
    evidenceAssertionsDoc = JSON.parse(evidenceAssertionsFile.raw);
  } catch (err) {
    throw new SchemaError(`${evidenceAssertionsFile.path} is not valid JSON: ${err.message}`, { cause: err });
  }

  const routingReport = routeClaims(
    pinned.artifacts.claimLedger.parsed.claims,
    evidenceAssertionsDoc.assertions,
  );

  // Seam invariant 8 (02 §2.3 item 8, FR-13, this task's own AC): fail closed before writing
  // anything if any drafted proposal is grounded solely by a conflict-visible/rejected claim.
  assertNoSoleConflictedBasis(RULE_PROPOSALS, routingReport);

  const packProvenance = buildPackProvenance(pinned, eligibility);

  await mkdir(outDir, { recursive: true });

  const packProvenancePath = path.join(outDir, 'pack-provenance.json');
  await writeFile(packProvenancePath, `${JSON.stringify(packProvenance, null, 2)}\n`, 'utf8');

  const evidencePath = path.join(outDir, 'evidence.json');
  await copyFile(evidenceFile.path, evidencePath);

  const evidenceAssertionsPath = path.join(outDir, 'evidence-assertions.json');
  await copyFile(evidenceAssertionsFile.path, evidenceAssertionsPath);

  // P3-T5/P3-T6's own writers -- reused verbatim, not re-implemented, so this verb's output is
  // byte-identical to what those tasks' own tests already prove those functions produce.
  const { ruleProposalsPath, candidatesPath } = await writeDraftPack({ outDir });
  const { rulesPath, ruleProvenancePath } = await writeStagedRulesAndProvenance({ outDir });

  // ---- release-manifest.unsigned.json (P5-T1, FR-18, `02 §4.18` minus `signature`) -------------
  // Re-reads the just-written rules.json/rule-provenance.json bytes from disk (mirrors hashing.mjs's
  // own "hash what is actually on disk, not what memory claims" posture) rather than re-serializing
  // the in-memory objects, so a hash mismatch would be caught rather than papered over.
  const rulesRaw = await readFile(rulesPath, 'utf8');
  const ruleProvenanceRaw = await readFile(ruleProvenancePath, 'utf8');
  const decisionsRaw = pinned.decisions.raw.toString('utf8');

  const converterConfigSha256 = await computeConverterConfigSha256(CONVERTER_ROOT);
  const { sha256: testCorpusSha256 } = await computeTestCorpusHash(REPO_ROOT, pinned.moduleId);
  const traceabilityHashHex = computeTraceabilityHash({
    decisionsRaw,
    evidenceAssertionsRaw: evidenceAssertionsFile.raw,
    ruleProvenanceRaw,
    rulesRaw,
  });

  const releaseManifest = buildReleaseManifest({
    moduleId: pinned.moduleId,
    packVersion: PACK_VERSION,
    pinnedBundle: pinned,
    eligibility,
    converterConfigSha256,
    testCorpusSha256,
    traceabilityHashHex,
  });
  const releaseManifestPath = path.join(outDir, 'release-manifest.unsigned.json');
  await writeFile(releaseManifestPath, `${JSON.stringify(releaseManifest, null, 2)}\n`, 'utf8');

  const summary = {
    verb: 'propose',
    moduleId: pinned.moduleId,
    outDir,
    packOutput: {
      packProvenancePath,
      evidencePath,
      evidenceAssertionsPath,
      candidatesPath,
      ruleProposalsPath,
      rulesPath,
      ruleProvenancePath,
      releaseManifestPath,
    },
    routing: {
      eligibleForRuleEvidence: routingReport.eligibleForRuleEvidence.length,
      conflictObjects: routingReport.conflictObjects.length,
      rejected: routingReport.rejected.length,
    },
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  return EXIT_OK;
}
