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
//   2. Is module-generic (multi-bundle-conversion-e1-finish, Phase 2, P2-T3/P2-T7, FR-F10): selects
//      this module's hand-authored drafting content, if any, via `RULE_PROPOSAL_REGISTRY[moduleId]`/
//      `CANDIDATE_REGISTRY[moduleId]` (rule-candidate-drafts.mjs), defaulting to `[]`/`{}` for any
//      module with no hand-authored content yet -- today, only `cbc_suite_v1` has any (P3-T1..T6).
//      There is no prose-inference path here at all, ever (FR-14: never infer clinical Boolean
//      logic from prose) -- only pre-authored, reviewable content keyed by module id, and the
//      empty default is exactly as inert as "no content" should be: an empty registry entry can
//      never itself pass the emission gate below (permitted requires at least one referenced,
//      approved decision id; zero proposals means zero referenced decisions).
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
//        release-manifest.unsigned.json -- NEW P5-T1 (FR-18, `02 §4.18` minus the `signature`
//                                     block): binds `rfInputs[]`, `converter`, `testCorpusHash`,
//                                     `traceabilityHash`. See the P5-T1 block near the bottom of
//                                     this file for the four pure builder functions this emission
//                                     uses.
//        conversion-report.json    -- NEW this task (P5-T2, FR-19): enumerates every claim the
//                                     P3-T4 `../claim-routing.mjs` routing excluded from rule
//                                     evidence, each with its specific rejection reason, built
//                                     directly from this same run's `routingReport` -- no schema
//                                     exists for this file either (same OQ-7 ruling as
//                                     pack-provenance.json above). See the P5-T2 block near the
//                                     bottom of this file for `buildConversionReport`.
//        semantic-diff.json        -- NEW this task (P5-T3, FR-21, OQ-4): for `cbc_suite_v1` only,
//                                     a MINIMAL, rule-id-level added/removed/changed comparison
//                                     between this run's staged head rules.json and the active
//                                     modules/anemia/rules.json -- no impact-graph traversal, no
//                                     dedicated schema (same OQ-7 posture). multi-bundle-conversion-
//                                     e1-finish Phase 4 (P4-T4, FR-F16) ADDS a second mode for
//                                     `anemia`/`kidney_suite_v1`/`growth_suite_v1` -- an
//                                     assertionId-level comparison between this run's freshly-
//                                     produced evidence-assertions.json and that module's own
//                                     currently-committed one (these 3 modules emit no rule, so a
//                                     rule-id comparison is meaningless for them). See
//                                     `../semantic-diff.mjs`.
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
import { parseYamlDocument } from '../yaml-lite.mjs';
import { RULE_PROPOSAL_REGISTRY, writeDraftPack } from '../rule-candidate-drafts.mjs';
import { writeStagedRulesAndProvenance } from '../../../../scripts/evidence/govern-staged-rules.mjs';
import { buildSemanticDiffReport, buildEvidenceAssertionsDiffReport } from '../semantic-diff.mjs';
import {
  EXIT_OK,
  GovernanceError,
  RuleEmissionRefusedError,
  SchemaError,
  UnresolvedClaimReferenceError,
  UsageError,
} from '../errors.mjs';

// This file lives at tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs -- 4 directories below the
// repository root, 2 below this converter's own root. Used only to locate (a) this module's own
// generated test corpus (tests/ef-<moduleId>-*.test.mjs, P4-T5..T8) for `testCorpusHash`, and (b)
// this converter's own `.mjs` source tree for `converter.configSha256` (P5-T1, FR-18) -- purely
// local filesystem paths, never a network boundary.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CONVERTER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * `semantic-diff.json`'s (P5-T3, FR-21, OQ-4) fixed comparison baseline: `modules/anemia/rules.json`
 * -- the only module that existed before this feature, per this plan's own binding OQ-4 text
 * ("comparing the cbc_suite_v1 proposal against modules/anemia/rules.json -- exactly as FR-21
 * already states"). Never `modules/cbc_suite_v1/rules.json` -- see `../semantic-diff.mjs`'s header
 * comment for why.
 */
const SEMANTIC_DIFF_BASE_MODULE_ID = 'anemia';
const SEMANTIC_DIFF_BASE_RULES_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'rules.json');

/**
 * multi-bundle-conversion-e1-finish Phase 4 (P4-T4, FR-F16): the ONE module whose `semantic-diff.
 * json` still uses the original rule-id-level comparison mode (`buildSemanticDiffReport`, OQ-4,
 * above) -- every other module (`anemia`/`kidney_suite_v1`/`growth_suite_v1`) emits no rule content
 * at all, so a rule-id comparison has nothing meaningful to say for them; `run()` below selects the
 * evidence-projection mode (`buildEvidenceAssertionsDiffReport`, `../semantic-diff.mjs`) for those
 * 3 instead. Named explicitly, never inferred from `emissionGate.permitted` or any other proxy --
 * `cbc_suite_v1` keeps the rule-id mode even on a hypothetical future run where its own emission
 * gate is refused, because `cbc_suite_v1` is a real, hand-authored-content module this plan's own
 * OQ-4 resolution scopes that comparison to, not merely "whichever module happens to emit rules
 * this run."
 */
const RULE_ID_SEMANTIC_DIFF_MODULE_ID = 'cbc_suite_v1';

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

// =================================================================================================
// multi-bundle-conversion-e1-finish Phase 1 (FR-F6/FR-F7/FR-F8, R-2/OQ-1, OQ-3): the fail-closed
// emission gate becomes CODE, not prose. Two independent, pure, unit-testable functions:
//
//   resolveDecisionReferences  -- referential-integrity guard (P1-T4). Every decision's
//                                  basis.rf_claim_ids[]/exact_assertion_ids[] must resolve to a
//                                  real id in the bundle's own claim_ledger.yaml / this module's
//                                  own evidence-assertions.json. An unresolvable id is a genuine
//                                  content defect (fabrication guard) -- it throws
//                                  UnresolvedClaimReferenceError, exit 2 SCHEMA, unconditionally,
//                                  regardless of any decision's status. NEVER caught/downgraded to
//                                  a non-fatal signal by the emission gate below.
//
//   resolveRuleEmissionGate    -- the live ALLOWLIST gate (P1-T2/T3). For every decision_id a
//                                  drafted rule/candidate proposal (RULE_PROPOSALS) cites, this
//                                  checks ONE positive condition: `decision.status ===
//                                  'approved_for_rule_draft'`. This MUST stay a membership check
//                                  against that single permitted value -- never an enumerated
//                                  denylist of 'rejected'/'withdrawn'/'drafted_pending_human_
//                                  approval' (a denylist fails OPEN the instant a new enum member
//                                  is added; this allowlist fails CLOSED on the same event,
//                                  including on a status string this schema has never seen before).
//                                  A missing decision_id reference (the cited decision does not
//                                  exist in this file at all) is treated identically to any other
//                                  non-approving value -- refused, never silently permitted.
// =================================================================================================

/**
 * P1-T4 (FR-F7, OQ-3): cross-checks EVERY decision in `decisions` (regardless of its `status` --
 * this is a referential-integrity guard, not a governance gate) against the two real id spaces a
 * `authoring-decisions.yaml` decision may legally cite. `schemas/authoring-decisions.schema.json`
 * documents that it "cannot verify that cross-file resolution itself" for either field -- this is
 * the runtime extension that does. Throws `UnresolvedClaimReferenceError` (exit 2 SCHEMA) naming
 * the specific invented id and the decision that cites it, on the FIRST unresolvable reference
 * found (decisions in array order, `rf_claim_ids` before `exact_assertion_ids` within a decision) --
 * pure function, no I/O, so it can run before any output is written.
 *
 * @param {ReadonlyArray<object>} decisions `authoring-decisions.yaml`'s parsed `decisions[]`
 * @param {{ claimIds: ReadonlySet<string>|null, assertionIds: ReadonlySet<string> }} universes the
 *   real id spaces to resolve against -- the bundle's own `claim_ledger.yaml.claims[].claim_id`s
 *   and this module's own `evidence-assertions.json.assertions[].assertionId`s. `claimIds` accepts
 *   `null` only as a defensive/unit-testable capability of this pure function itself -- `run()`'s
 *   call site below (multi-bundle-conversion-e1-finish, Phase 1 hardening) NEVER passes `null`: it
 *   always resolves a real claim-id universe via `loadDeclaredBundleClaimIds()` before calling this,
 *   so in production the `rf_claim_ids[]` half of this check is never skipped, regardless of
 *   whether the run's loaded bundle matches the decisions file's declared provenance
 *   (`exact_assertion_ids[]` is likewise never skipped; `evidence-assertions.json` is
 *   bundle-independent, unlike `claim_ledger.yaml`).
 * @returns {void}
 */
export function resolveDecisionReferences(decisions, { claimIds, assertionIds }) {
  for (const decision of decisions ?? []) {
    const decisionId = decision?.decision_id ?? null;
    if (claimIds) {
      for (const claimId of decision?.basis?.rf_claim_ids ?? []) {
        if (!claimIds.has(claimId)) {
          throw new UnresolvedClaimReferenceError({ kind: 'clm', id: claimId, decisionId });
        }
      }
    }
    for (const assertionId of decision?.basis?.exact_assertion_ids ?? []) {
      if (!assertionIds.has(assertionId)) {
        throw new UnresolvedClaimReferenceError({ kind: 'evas', id: assertionId, decisionId });
      }
    }
  }
}

/**
 * P1-T2/T3 (FR-F6, R-2/OQ-1 -- "the single most load-bearing implementation detail in this plan"):
 * the live, runtime ALLOWLIST gate. For every distinct `decisionId` a `ruleProposals` entry cites,
 * resolves the matching decision record (by `decision_id`) in `decisions` and checks the ONE
 * permitting condition -- `status === 'approved_for_rule_draft'`. Emission is permitted only when
 * at least one referenced decision exists AND every referenced decision passes that check; any
 * referenced decision that is missing entirely, or carries any other status value (including a
 * value this schema/enum has never seen before), refuses via this SAME branch -- there is no
 * separate code path for "known-bad" statuses. Pure function, no I/O.
 *
 * @param {ReadonlyArray<object>} decisions `authoring-decisions.yaml`'s parsed `decisions[]`
 * @param {ReadonlyArray<{ decisionId: string }>} ruleProposals the drafted rule/candidate
 *   proposals whose `decisionId` join key names which decisions are actually relevant here
 * @returns {{
 *   permitted: boolean,
 *   referencedDecisionIds: string[],
 *   approvedDecisionIds: string[],
 *   refusedDecisions: Array<{ decisionId: string, status: string|null }>,
 * }}
 */
export function resolveRuleEmissionGate(decisions, ruleProposals) {
  const decisionsById = new Map((decisions ?? []).map((decision) => [decision?.decision_id, decision]));
  const referencedDecisionIds = [...new Set((ruleProposals ?? []).map((proposal) => proposal.decisionId))];

  const approvedDecisionIds = [];
  const refusedDecisions = [];
  for (const decisionId of referencedDecisionIds) {
    const decision = decisionsById.get(decisionId);
    const status = decision?.status ?? null;
    // The ONLY permitting condition -- a positive membership check, never a denylist branch.
    if (status === 'approved_for_rule_draft') {
      approvedDecisionIds.push(decisionId);
    } else {
      refusedDecisions.push({ decisionId, status });
    }
  }

  return {
    permitted: referencedDecisionIds.length > 0 && refusedDecisions.length === 0,
    referencedDecisionIds,
    approvedDecisionIds,
    refusedDecisions,
  };
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

// =================================================================================================
// multi-bundle-conversion-e1-finish hardening (adversarial-review follow-up to Phase 1's P1-T4):
// the `rf_claim_ids[]` half of `resolveDecisionReferences`'s cross-check must NEVER be skipped, even
// when this run's loaded bundle (`--run-dir`) differs from the bundle `authoring-decisions.yaml`
// itself declares as its evidentiary source (`rfProvenance.rfBundleId`/`rfProvenance.fixturePath`) --
// that mismatch is the documented, legitimate `batch.mjs` cbc/rf-cbc-002 pairing (see `run()`'s call
// site below), but a mismatched run is exactly the case a fabricated `clm_*` id could otherwise slip
// through unchecked in. `loadDeclaredBundleClaimIds` resolves the real claim-id universe from the
// bundle the decisions ACTUALLY declare, independent of which bundle this run loaded.
// =================================================================================================

/**
 * Resolves the real `claim_ledger.yaml.claims[].claim_id` universe for `rf_claim_ids[]`
 * cross-checking FROM THE BUNDLE `authoring-decisions.yaml` ITSELF DECLARES
 * (`rfProvenance.rfBundleId` / `rfProvenance.fixturePath`) -- never from whichever bundle a given
 * `propose` invocation happens to have loaded via `--run-dir`. This is the fabrication guard's
 * fail-closed replacement for the old "bundle mismatch -> skip the check" behavior: a decision
 * citing an invented claim id must throw regardless of which bundle the run is projecting.
 *
 * Deliberately a NARROW, independent `evidence_bundle.yaml` -> `claim_ledger` artifact read (same
 * posture as `../multi-bundle-report.mjs`'s `readFixtureClaimCount`) rather than a second
 * `loadBundle()` call: the declared bundle's source cards, extraction cards, verification record,
 * etc. are irrelevant to this one id-universe lookup, and `loadBundle()` additionally requires an
 * `authoring-decisions.yaml` to sit next to whatever `modulePath` it is given -- machinery this
 * lookup has no use for and should not depend on. Unlike that read-only aggregator, though, this
 * function is a security guard, not a best-effort reporter: every failure mode below throws a
 * `SchemaError` (fail closed) rather than returning `null`/an empty set.
 *
 * @param {object} decisionsParsed `authoring-decisions.yaml`'s parsed document
 * @param {string} repoRootDir absolute repository root `rfProvenance.fixturePath` is relative to
 * @returns {Promise<Set<string>>}
 */
/**
 * Fail-closed containment guard: `resolved` must sit inside `repoRootDir`. A declared provenance
 * path that escapes the repo tree (via `../` or an absolute path) is a hard `SchemaError`, never a
 * silently-trusted read.
 * @param {string} resolved an already-`path.resolve`d absolute path
 * @param {string} repoRootDir absolute repository root
 * @param {string} fieldName the decisions/bundle field the raw value came from (for the message)
 * @param {string} rawValue the raw declared value (for the message)
 * @returns {void}
 */
function assertWithinRepo(resolved, repoRootDir, fieldName, rawValue) {
  const rootWithSep = repoRootDir.endsWith(path.sep) ? repoRootDir : repoRootDir + path.sep;
  if (resolved !== repoRootDir && !resolved.startsWith(rootWithSep)) {
    throw new SchemaError(
      `${fieldName} ${JSON.stringify(rawValue)} resolves to ${resolved}, which escapes the ` +
        'repository tree -- a declared provenance path may not point outside the repo. Fail closed.',
    );
  }
}

export async function loadDeclaredBundleClaimIds(decisionsParsed, repoRootDir) {
  const rfProvenance = decisionsParsed?.rfProvenance ?? {};
  const declaredBundleId = rfProvenance.rfBundleId ?? null;
  const fixturePath = rfProvenance.fixturePath;
  if (typeof fixturePath !== 'string' || fixturePath === '') {
    throw new SchemaError(
      'authoring-decisions.yaml has no rfProvenance.fixturePath -- cannot resolve the declared ' +
        'bundle\'s claims/claim_ledger.yaml to cross-check basis.rf_claim_ids[] against. Fail ' +
        'closed: this check is never skipped, regardless of which bundle the current run loaded.',
    );
  }

  const fixtureDir = path.resolve(repoRootDir, fixturePath);
  // Containment guard (defense-in-depth): a committed authoring-decisions.yaml already requires
  // clinical review to change, but its declared provenance path must never escape the repository
  // tree -- otherwise a `../`/absolute fixturePath could redirect this security check at an
  // out-of-tree, attacker-supplied claim_ledger that "resolves" a fabricated id. Fail closed.
  assertWithinRepo(fixtureDir, repoRootDir, 'rfProvenance.fixturePath', fixturePath);
  const bundlePath = path.join(fixtureDir, 'evidence_bundle.yaml');
  let bundleRaw;
  try {
    bundleRaw = await readFile(bundlePath, 'utf8');
  } catch (err) {
    throw new SchemaError(
      `authoring-decisions.yaml declares rfProvenance.fixturePath ${JSON.stringify(fixturePath)} ` +
        `but ${bundlePath} could not be read (${err.message}) -- cannot resolve the declared ` +
        'bundle\'s claim_ledger.yaml. Fail closed rather than skip the rf_claim_ids[] check.',
      { cause: err },
    );
  }
  let bundleParsed;
  try {
    bundleParsed = parseYamlDocument(bundleRaw);
  } catch (err) {
    throw new SchemaError(`failed to parse ${bundlePath}: ${err.message}`, { cause: err });
  }

  if (declaredBundleId !== null && bundleParsed?.id !== declaredBundleId) {
    throw new SchemaError(
      `authoring-decisions.yaml declares rfProvenance.rfBundleId ${JSON.stringify(declaredBundleId)} ` +
        `but the bundle at its declared rfProvenance.fixturePath (${bundlePath}) is bundle ` +
        `${JSON.stringify(bundleParsed?.id ?? null)} -- the declared identity does not match the ` +
        'fixture at the declared path. Fail closed rather than trust a mismatched claim ledger.',
    );
  }

  const claimLedgerRel = bundleParsed?.artifacts?.claim_ledger;
  if (typeof claimLedgerRel !== 'string' || claimLedgerRel === '') {
    throw new SchemaError(
      `${bundlePath} (the declared bundle) has no artifacts.claim_ledger entry -- cannot resolve ` +
        'its claim_ledger.yaml.',
    );
  }
  const claimLedgerPath = path.resolve(fixtureDir, claimLedgerRel);
  // Same containment guard for the bundle-declared claim_ledger relative path.
  assertWithinRepo(claimLedgerPath, repoRootDir, 'artifacts.claim_ledger', claimLedgerRel);
  let claimLedgerRaw;
  try {
    claimLedgerRaw = await readFile(claimLedgerPath, 'utf8');
  } catch (err) {
    throw new SchemaError(
      `could not read the declared bundle's claims/claim_ledger.yaml at ${claimLedgerPath} ` +
        `(${err.message})`,
      { cause: err },
    );
  }
  let claimLedgerParsed;
  try {
    claimLedgerParsed = parseYamlDocument(claimLedgerRaw);
  } catch (err) {
    throw new SchemaError(`failed to parse ${claimLedgerPath}: ${err.message}`, { cause: err });
  }

  return new Set(
    (claimLedgerParsed?.claims ?? [])
      .map((claim) => claim?.claim_id)
      .filter((claimId) => typeof claimId === 'string' && claimId !== ''),
  );
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
 * multi-bundle-conversion-e1-finish Phase 4 (Step 0, MBF-5 fix): `run()` below ONLY calls this
 * function when the Phase 1 rule-emission gate (`resolveRuleEmissionGate`) actually PERMITTED
 * emission for this run. A module that emits no rules has no rule test corpus to hash at all --
 * there is nothing dishonest about that being `null`; what would be dishonest is either (a)
 * throwing `UsageError` for a module that was never going to emit a rule in the first place
 * (`kidney_suite_v1`/`growth_suite_v1` today -- they have zero hand-authored `RULE_PROPOSAL_
 * REGISTRY` content, so their emission gate can never be `permitted: true` regardless of whether a
 * test corpus exists), or (b) hashing a pre-existing, UNRELATED test corpus that happens to share
 * the module id (`anemia`'s own `tests/ef-anemia-backfill-integrity.test.mjs`, authored for a
 * different purpose entirely) and presenting that hash as if it verified rule content this run
 * never emitted. See `buildReleaseManifest`'s own doc comment for how `testCorpusSha256: null`
 * threads through to `testCorpusHash: null` on the emitted manifest.
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
 * `testCorpusSha256` (multi-bundle-conversion-e1-finish Phase 4, Step 0/MBF-5 fix): `null` when
 * this run's rule-emission gate refused emission (no rule test corpus binds a proposal that was
 * never drafted) -- emitted verbatim as `testCorpusHash: null`, never a fabricated `"sha256:null"`
 * string. A non-null `testCorpusSha256` (a real hex digest) is still wrapped in the repo-standard
 * `sha256:` prefix, unchanged from this function's original behavior.
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
    testCorpusHash: testCorpusSha256 === null ? null : `sha256:${testCorpusSha256}`,
    traceabilityHash: `sha256:${traceabilityHashHex}`,
  };
}

// =================================================================================================
// P5-T2: conversion-report.json (FR-19, decisions block Phase 5 exit gate)
// =================================================================================================

/**
 * `conversion-report.json`'s full document shape (FR-19, PRD §"Observability": "the audit surface
 * for this feature ... structured JSON, not free text, enumerating every accept/reject decision
 * with its reason"). No dedicated schema exists for this file (this plan's binding OQ-7 ruling
 * names exactly 4 new schema files — `evidence-assertions`, `authoring-decisions`,
 * `rule-provenance`, `release-manifest` — none of them `conversion-report`) — same "checked
 * structurally, not schema-validated" posture as `pack-provenance.json`/`rule-proposals.json`
 * (P3-T7).
 *
 * Enumerates every claim `../claim-routing.mjs`'s `routeClaims()` (P3-T4) excluded from rule
 * evidence at all (`routingReport.rejected` — `ruleEvidenceEligible: false`), each with its
 * specific, already-computed rejection reason(s) — never a bare pass/fail summary, and never a
 * silently-dropped exclusion (mirrors `eligibility.mjs`/`claim-routing.mjs`'s own "retain rejected
 * items with reason" posture). `sources`/`candidates` exclusion arrays are carried in the shape now
 * (FR-19 names "claim, source, or candidate item" together) but are empty for this fixture/module:
 * this converter has zero independent source- or candidate-level exclusion logic distinct from the
 * claim-level rejection above (the fixture's only drafted candidate,
 * `benign-ethnic-neutropenia-differential-pattern`, is used by rule (c) and is never excluded) —
 * a future module/bundle that DOES exclude a source or candidate item on its own has a place to
 * report it without a shape change.
 *
 * Pure function of its inputs — no I/O — directly unit-testable, matching `buildReleaseManifest`'s
 * own convention (P5-T1).
 *
 * `ruleEmission` (multi-bundle-conversion-e1-finish, Phase 1, FR-F8): the P1-T2/T3 emission gate's
 * own outcome, folded into this SAME report rather than a second file -- this is the "named,
 * non-zero refusal reason in conversion-report.json" the Phase 1 exit gate and FR-F8 require.
 * `refusalReason` is `null` when emission was permitted; a specific, non-empty string (never a
 * bare "refused" or a boolean) naming exactly which decision(s) failed to reach
 * `approved_for_rule_draft` when it was not.
 *
 * @param {{
 *   moduleId: string,
 *   packVersion: string,
 *   routingReport: import('../claim-routing.mjs').RoutingReport,
 *   ruleEmission?: {
 *     permitted: boolean,
 *     referencedDecisionIds: string[],
 *     approvedDecisionIds: string[],
 *     refusedDecisions: Array<{ decisionId: string, status: string|null }>,
 *     refusalReason: string|null,
 *   },
 * }} args
 * @returns {object}
 */
export function buildConversionReport({ moduleId, packVersion, routingReport, ruleEmission }) {
  const claimExclusions = routingReport.rejected
    .map((routed) => ({
      itemType: 'claim',
      itemId: routed.claimId,
      status: routed.status ?? null,
      reasons: routed.reasons,
    }))
    // Sorted by itemId so the emitted file is deterministic (seam invariant 13) independent of
    // claim_ledger.yaml's own on-disk ordering.
    .sort((a, b) => String(a.itemId ?? '').localeCompare(String(b.itemId ?? '')));

  return {
    schemaVersion: '1.0',
    moduleId,
    packVersion,
    summary: {
      claimsTotal: routingReport.routed.length,
      claimsEligibleForRuleEvidence: routingReport.eligibleForRuleEvidence.length,
      claimsConflictVisible: routingReport.conflictObjects.length,
      claimsExcluded: claimExclusions.length,
      sourcesExcluded: 0,
      candidatesExcluded: 0,
    },
    exclusions: {
      claims: claimExclusions,
      sources: [],
      candidates: [],
    },
    ruleEmission: {
      permitted: ruleEmission?.permitted ?? false,
      referencedDecisionIds: ruleEmission?.referencedDecisionIds ?? [],
      approvedDecisionIds: ruleEmission?.approvedDecisionIds ?? [],
      refusedDecisions: ruleEmission?.refusedDecisions ?? [],
      refusalReason: ruleEmission?.permitted ? null : (ruleEmission?.refusalReason ?? null),
    },
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

  // Module-generic (multi-bundle-conversion-e1-finish, Phase 2, P2-T3, FR-F10): the old
  // module-identity hard-code ("propose only has content for cbc_suite_v1") is removed entirely.
  // Every module reaches this point and the emission gate below decides emission on decisions-file
  // content alone -- never on which module happens to be running.
  const ruleProposals = RULE_PROPOSAL_REGISTRY[pinned.moduleId] ?? [];

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

  // ---- P1-T4 (FR-F7, OQ-3): runtime clm_*/evas_* cross-resolution -- BEFORE any output is written,
  // BEFORE the emission-gate computation below, and unconditionally with respect to any decision's
  // status. A decision citing an invented claim or evidence-assertion id is a genuine content
  // defect (fabrication guard), never a caught/non-fatal governance signal -- this throws
  // `UnresolvedClaimReferenceError` (exit 2 SCHEMA) straight out of `run()`.
  const decisionsList = pinned.decisions.parsed?.decisions ?? [];
  const realAssertionIds = new Set(
    (evidenceAssertionsDoc.assertions ?? [])
      .map((assertion) => assertion?.assertionId)
      .filter((assertionId) => typeof assertionId === 'string' && assertionId !== ''),
  );
  // `rf_claim_ids[]` resolves against the bundle `authoring-decisions.yaml` ITSELF DECLARES
  // (`rfProvenance.rfBundleId`/`rfProvenance.fixturePath`), never merely against whichever bundle
  // this run happened to load via `--run-dir` -- see `loadDeclaredBundleClaimIds`'s own doc comment
  // above for the full rationale (multi-bundle-conversion-e1-finish, adversarial-review follow-up
  // to P1-T4: the prior "bundle mismatch -> skip the check" behavior was a fabrication-guard hole,
  // not a legitimate exemption). When this run's loaded bundle (`pinned.bundleId`) already IS the
  // declared bundle -- the common case -- this reuses the already-pinned claim ledger
  // (`pinned.artifacts.claimLedger`) with zero extra I/O, byte-identical to the prior behavior on
  // that path. When they differ -- e.g. `lib/batch.mjs`'s own `BATCH_PAIRS` legitimately pairing
  // `cbc_suite_v1` with the `rf-cbc-002` fixture while the committed
  // `modules/cbc_suite_v1/authoring-decisions.yaml` declares its own provenance as `rf-cbc-001` and
  // cites that bundle's own claim ids (e.g. `clm_inf07`) -- the declared bundle's OWN claim ledger
  // is loaded independently and resolved against instead, so a real cbc/rf-cbc-001 claim id still
  // resolves cleanly (no false rejection) while a fabricated id throws regardless of which bundle
  // the run projects. `claimIds` is NEVER `null` here. `exact_assertion_ids[]` is unaffected --
  // `modules/<id>/evidence-assertions.json` is read from the committed module package, not the
  // run's bundle, so it is bundle-independent and always resolvable regardless of which fixture a
  // given `propose` invocation was run against.
  const bundleMatchesDecisionsProvenance =
    pinned.decisions.parsed?.rfProvenance?.rfBundleId === pinned.bundleId;
  const realClaimIds = bundleMatchesDecisionsProvenance
    ? new Set(
        (pinned.artifacts.claimLedger.parsed?.claims ?? [])
          .map((claim) => claim?.claim_id)
          .filter((claimId) => typeof claimId === 'string' && claimId !== ''),
      )
    : await loadDeclaredBundleClaimIds(pinned.decisions.parsed, REPO_ROOT);
  resolveDecisionReferences(decisionsList, { claimIds: realClaimIds, assertionIds: realAssertionIds });

  // ---- P1-T2/T3 (FR-F6, R-2/OQ-1): the live, code-enforced ALLOWLIST emission gate -- computed
  // here, as a value, BEFORE `writeStagedRulesAndProvenance()` is ever called (P1-T8: the refusal
  // is captured, not discovered via a caught filesystem exception on a later, now-conditional read).
  const emissionGate = resolveRuleEmissionGate(decisionsList, ruleProposals);
  // Constructed (never thrown) purely to reuse this class's own canonical, named refusal message --
  // see errors.mjs's RuleEmissionRefusedError doc comment for why this is a caught, non-fatal
  // signal on this path rather than a thrown GOVERNANCE exception.
  const ruleEmissionRefusal = emissionGate.permitted
    ? null
    : new RuleEmissionRefusedError(emissionGate);

  // rfRunId-scoped (multi-bundle-conversion-e1, P4-T5, FR-7/FR-8): modules/cbc_suite_v1/
  // evidence-assertions.json may now hold more than one upstream rf run's assertions (RF-CBC-001 +
  // RF-CBC-002, appended by P4-T5) sharing the same clm_NNN claim-id namespace -- this run's own
  // routing must only ever match against ITS OWN bundle's assertions (see
  // ../claim-routing.mjs's routeClaims() rfRunId option doc for the full rationale), never a
  // different bundle's identically-numbered claim.
  const routingReport = routeClaims(
    pinned.artifacts.claimLedger.parsed.claims,
    evidenceAssertionsDoc.assertions,
    { rfRunId: pinned.runId },
  );

  // Seam invariant 8 (02 §2.3 item 8, FR-13, this task's own AC): fail closed before writing
  // anything if any drafted proposal is grounded solely by a conflict-visible/rejected claim.
  assertNoSoleConflictedBasis(ruleProposals, routingReport);

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
  const { ruleProposalsPath, candidatesPath } = await writeDraftPack({ outDir, moduleId: pinned.moduleId });

  // ---- P1-T3/T8 (FR-F6/FR-F8/FR-F11): writeStagedRulesAndProvenance() is called CONDITIONALLY --
  // ONLY when the emission gate above permits it. On refusal, `rulesPath`/`ruleProvenancePath` stay
  // `null` (never created, never read -- the seam task's "never calls writeStagedRulesAndProvenance
  // at all" property, provable by `fs.access` ENOENT on the two paths this run never writes) and
  // `rulesRaw`/`ruleProvenanceRaw` are each the deterministic empty string `''`, never a file read.
  // `computeTraceabilityHash` below is still the SAME pure function over the two real inputs plus
  // these two empty-string placeholders -- no special-cased hash logic for a refused run.
  let rulesPath = null;
  let ruleProvenancePath = null;
  let rulesRaw = '';
  let ruleProvenanceRaw = '';
  if (emissionGate.permitted) {
    ({ rulesPath, ruleProvenancePath } = await writeStagedRulesAndProvenance({ outDir }));
    // ---- release-manifest.unsigned.json (P5-T1, FR-18, `02 §4.18` minus `signature`) -----------
    // Re-reads the just-written rules.json/rule-provenance.json bytes from disk (mirrors
    // hashing.mjs's own "hash what is actually on disk, not what memory claims" posture) rather
    // than re-serializing the in-memory objects, so a hash mismatch would be caught rather than
    // papered over.
    rulesRaw = await readFile(rulesPath, 'utf8');
    ruleProvenanceRaw = await readFile(ruleProvenancePath, 'utf8');
  }
  const decisionsRaw = pinned.decisions.raw.toString('utf8');

  const converterConfigSha256 = await computeConverterConfigSha256(CONVERTER_ROOT);
  // ---- Step 0 fix (multi-bundle-conversion-e1-finish Phase 4, MBF-5) -----------------------------
  // `computeTestCorpusHash` is gated on `emissionGate.permitted`, exactly parallel to
  // `writeStagedRulesAndProvenance` above: a module with no rule content emitted this run has no
  // rule test corpus to hash, so `testCorpusSha256` stays the honest `null` rather than either (a)
  // throwing UsageError for a module that was never going to emit a rule regardless of whether a
  // test corpus exists (`kidney_suite_v1`/`growth_suite_v1` -- zero `RULE_PROPOSAL_REGISTRY`
  // content), or (b) hashing an unrelated pre-existing test corpus that happens to share the module
  // id (`anemia`'s own `tests/ef-anemia-backfill-integrity.test.mjs`) and presenting it as if it
  // verified rule content this run never emitted.
  const testCorpusSha256 = emissionGate.permitted
    ? (await computeTestCorpusHash(REPO_ROOT, pinned.moduleId)).sha256
    : null;
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

  // ---- conversion-report.json (P5-T2, FR-19) -----------------------------------------------------
  // Built from the SAME `routingReport` this run already computed above (P3-T4's claim-routing
  // output) -- never a separately-recomputed or re-summarized report, so this file can never drift
  // from the `routing.*` counts this verb has always printed in its stdout summary.
  const conversionReport = buildConversionReport({
    moduleId: pinned.moduleId,
    packVersion: PACK_VERSION,
    routingReport,
    ruleEmission: {
      permitted: emissionGate.permitted,
      referencedDecisionIds: emissionGate.referencedDecisionIds,
      approvedDecisionIds: emissionGate.approvedDecisionIds,
      refusedDecisions: emissionGate.refusedDecisions,
      refusalReason: ruleEmissionRefusal?.message ?? null,
    },
  });
  const conversionReportPath = path.join(outDir, 'conversion-report.json');
  await writeFile(conversionReportPath, `${JSON.stringify(conversionReport, null, 2)}\n`, 'utf8');

  // ---- semantic-diff.json (P5-T3/P4-T4, FR-21/FR-F16, OQ-4) ---------------------------------------
  // Two independent, mode-selected-by-moduleId comparisons -- see `RULE_ID_SEMANTIC_DIFF_MODULE_ID`'s
  // own doc comment above and `../semantic-diff.mjs`'s header comment for the full rationale for why
  // these are two different tools, not one generalized comparison.
  let semanticDiffReport;
  if (pinned.moduleId === RULE_ID_SEMANTIC_DIFF_MODULE_ID) {
    // cbc_suite_v1 (unchanged, OQ-4): rule-id-level comparison against modules/anemia/rules.json.
    // Re-reads modules/anemia/rules.json fresh from disk each run (never cached across runs) so the
    // comparison always reflects the file actually on disk, matching this file's own "hash/diff what
    // is actually on disk" posture (see the release-manifest block above). `rulesRaw` (this run's
    // freshly-written staged head, already read above for the release-manifest's hash) is re-parsed
    // here rather than re-serialized from an in-memory object, for the same reason. P1-T8: on a
    // refused run `rulesRaw` is the deterministic empty string, never valid JSON -- `headRules` is
    // set to `[]` directly here (the caller), never via `JSON.parse(rulesRaw)`; `buildSemanticDiffReport`
    // already tolerates `headRules: []` via its own `?? []` defaults.
    const anemiaRulesRaw = await readFile(SEMANTIC_DIFF_BASE_RULES_PATH, 'utf8');
    semanticDiffReport = buildSemanticDiffReport({
      baseModuleId: SEMANTIC_DIFF_BASE_MODULE_ID,
      baseRulesPath: path.relative(REPO_ROOT, SEMANTIC_DIFF_BASE_RULES_PATH),
      baseRules: JSON.parse(anemiaRulesRaw),
      headModuleId: pinned.moduleId,
      headRules: emissionGate.permitted ? JSON.parse(rulesRaw) : [],
    });
  } else {
    // anemia/kidney_suite_v1/growth_suite_v1 (P4-T4, FR-F16): evidence-projection comparison --
    // this run's freshly-produced evidence-assertions.json (the byte-verbatim copy just written to
    // `evidenceAssertionsPath` above) against this SAME module's own currently-committed
    // evidence-assertions.json (re-read fresh from `modules/<id>/evidence-assertions.json`,
    // independent of the already-in-memory `evidenceAssertionsDoc` -- matching this file's "diff
    // what is actually on disk" posture, same as the rule-id branch above). Both reads resolve to
    // the SAME source file today (`propose` only ever copies that file verbatim -- P3-T7's own
    // header comment), so this comparison is, by construction, a self-comparison proving the copy
    // is faithful; it becomes a real generation-to-generation comparison the moment this module
    // gains a genuinely independent evidence-generation step (P4-T6's own closure-path framing).
    const committedEvidenceAssertionsPath = path.join(resolvedModuleDir, 'evidence-assertions.json');
    const freshRaw = await readFile(evidenceAssertionsPath, 'utf8');
    const committedRaw = await readFile(committedEvidenceAssertionsPath, 'utf8');
    semanticDiffReport = buildEvidenceAssertionsDiffReport({
      baseModuleId: pinned.moduleId,
      basePath: path.relative(REPO_ROOT, committedEvidenceAssertionsPath),
      baseAssertions: JSON.parse(committedRaw).assertions ?? [],
      headModuleId: pinned.moduleId,
      headAssertions: JSON.parse(freshRaw).assertions ?? [],
    });
  }
  const semanticDiffPath = path.join(outDir, 'semantic-diff.json');
  await writeFile(semanticDiffPath, `${JSON.stringify(semanticDiffReport, null, 2)}\n`, 'utf8');

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
      conversionReportPath,
      semanticDiffPath,
    },
    routing: {
      eligibleForRuleEvidence: routingReport.eligibleForRuleEvidence.length,
      conflictObjects: routingReport.conflictObjects.length,
      rejected: routingReport.rejected.length,
    },
    ruleEmission: {
      permitted: emissionGate.permitted,
      refusalReason: ruleEmissionRefusal?.message ?? null,
    },
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  return EXIT_OK;
}
