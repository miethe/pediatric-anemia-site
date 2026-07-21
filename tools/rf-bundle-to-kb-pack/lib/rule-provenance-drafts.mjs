// tools/rf-bundle-to-kb-pack/lib/rule-provenance-drafts.mjs — strict runtime rule projection +
// companion rule-provenance content (P3-T6, evidence-foundry-buildout Phase 3, FR-15, `02 §4.13`).
//
// `02 §4.13`: the current `schemas/rule.schema.json` permits an exact, closed set of governance
// fields on every rule record (`additionalProperties: false`) and rejects everything else. This
// module is the small, deterministic, pure-data step that:
//
//   1. projects each `RULE_PROPOSALS` entry (P3-T5, rule-candidate-drafts.mjs) down to the subset
//      of fields the strict schema actually allows — `projectPartialStrictRule()` below returns
//      every one of those fields EXCEPT the closed, always-empty clinical-approver-list field (see
//      note below for why that one field is deliberately finished elsewhere, not here); and
//   2. builds the companion `rule-provenance.json` sidecar (`buildRuleProvenanceDocument()`) that
//      carries every field the strict projection has no slot for at all — `decisionId`,
//      `rfClaimIds`, `evidenceAssertionIds`, `missingness`, `localProfileRequirement`, `testIds`,
//      `reviewStatus`, `reviewBy`, `supersedes`, `authoringNotes` — joined back to the strict rule
//      by `ruleId`, so nothing a drafted proposal carried is silently discarded.
//
// NOTE on the clinical-approver-list field (Invariant 15, tests/ef-converter-invariants.test.mjs):
// no file under tools/rf-bundle-to-kb-pack/ may ever set or even name that field — clinical sign-off
// is a human/governance-process outcome this converter feeds, never something it can grant itself.
// The one remaining governance field `schemas/rule.schema.json` requires (always the fixed empty
// list) is therefore added by a small finisher OUTSIDE this converter tree, at
// scripts/evidence/govern-staged-rules.mjs — mirroring exactly how `modules/anemia/rules.json`'s own
// 91 rules got that field, via the equally out-of-tree `scripts/evidence/backfill-rule-governance.mjs`
// codemod, never via anything under tools/rf-bundle-to-kb-pack/.
//
// Nothing here infers clinical Boolean logic (FR-14) — every value below is either copied verbatim
// from the already hand-authored `RULE_PROPOSALS` (P3-T5) or a plain, code-grounded description of
// this module's ACTUAL existing runtime behavior (modules/anemia/facts.anemia.js's fact derivation,
// src/ruleEngine.js's leaf-comparison semantics) — never an invented clinical claim.

import { MODULE_ID, RF_PROVENANCE, RULE_PROPOSALS } from './rule-candidate-drafts.mjs';
import moduleManifest from '../../../modules/cbc_suite_v1/module.json' with { type: 'json' };

export { MODULE_ID, RF_PROVENANCE };

// `schemas/rule.schema.json`'s `version` field requires plain `MAJOR.MINOR.PATCH` (no pre-release
// suffix) and its `effectiveDate` field is REQUIRED and non-nullable (unlike `retireDate`) — the
// authoring `RULE_PROPOSALS.version`/`effectiveDate` values (`'0.1.0-proposal'`/`null`) are honest
// AUTHORING-record signals ("not yet an effective, numbered release") the strict schema simply has
// no room to express. Rather than silently reshape those fields with no trace, this projection
// derives its own schema-legal values from the same governance-stamp convention
// `scripts/evidence/backfill-rule-governance.mjs` already established for `modules/anemia/rules.json`
// (a fixed pack version and the module manifest's own `evidenceReviewedThrough` date — a governance
// housekeeping stamp, never a per-rule clinical review date) and the AUTHORING record's own
// `RULE_PROPOSALS.version`/`reviewBy` strings are still preserved verbatim in this same object's
// `changeRationale` text and in the joined rule-provenance.json entry (`reviewBy`), so nothing is
// lost, only reshaped to fit the strict schema's stricter type.
const STRICT_PROJECTION_VERSION = '0.1.0';
const STRICT_PROJECTION_EFFECTIVE_DATE = moduleManifest.evidenceReviewedThrough;

/**
 * The strict-schema-allowed fields every `RULE_PROPOSALS` entry already carries verbatim, plus the
 * derived fields (`version`/`effectiveDate`/`sourcePassageId`) this projection step computes.
 * Deliberately does NOT include the one remaining schema-required governance field (see file
 * header) — that is added by the out-of-tree finisher, never here.
 *
 * @param {(typeof RULE_PROPOSALS)[number]} proposal
 * @returns {object} every `schemas/rule.schema.json`-allowed field except the one added downstream
 */
export function projectPartialStrictRule(proposal) {
  const primarySourceId = proposal.evidence[0];
  return {
    id: proposal.id,
    category: proposal.category,
    when: proposal.when,
    evidence: proposal.evidence,
    output: proposal.output,
    version: STRICT_PROJECTION_VERSION,
    effectiveDate: STRICT_PROJECTION_EFFECTIVE_DATE,
    retireDate: proposal.retireDate,
    owner: proposal.owner,
    safetyClass: proposal.safetyClass,
    requiredTestCaseIds: proposal.requiredTestCaseIds,
    changeRationale: proposal.changeRationale,
    // D-EP3-6 fallback default (backfill-rule-governance.mjs's own `computeSourcePassageId`
    // convention): every one of these 4 proposals' `decisionBasisKind` is `implementation_proposal`
    // (no proposal here claims a directly reviewed, human-attested passage binding), so each falls
    // back to its primary evidence source's `<sourceId>#implementation-proposal` sentinel.
    sourcePassageId: `${primarySourceId}#implementation-proposal`,
  };
}

/** All 4 slice rules, strict-projected (still missing the one out-of-tree governance field). */
export const PARTIAL_STRICT_RULES = Object.freeze(RULE_PROPOSALS.map(projectPartialStrictRule));

/**
 * Per-rule `missingness`/`localProfileRequirement` content — a plain, honest description of this
 * module's ACTUAL current runtime behavior when the rule's `when`-clause fact(s) are absent/unknown
 * (grounded in modules/anemia/facts.anemia.js's fact derivation and src/ruleEngine.js's leaf-
 * comparison semantics, which cbc_suite_v1 delegates to wholesale per OQ-1) — never an invented
 * clinical claim. Keyed by `decisionId` (the same join key `RULE_PROPOSALS` already uses) so a test
 * can prove every proposal has a matching provenance-content record and vice versa.
 */
const PROVENANCE_CONTENT_BY_DECISION_ID = Object.freeze({
  dec_cbc_young_infant_scope_abstention_001: {
    missingness:
      'scope.neonatalOrYoungInfant is a plain boolean derived from patient.ageMonths '
      + '(modules/anemia/facts.anemia.js): when ageMonths is absent it resolves to false, not to a '
      + 'missing/unknown state, so this rule does NOT fire and does NOT abstain when age is '
      + 'unrecorded. This vertical slice carries no missing-age question rule of its own in '
      + 'modules/cbc_suite_v1/rules.json (unlike modules/anemia\'s committed Q-001) — an unrecorded '
      + 'age is silently treated as "not a young infant" rather than prompted for. Flagged as a '
      + 'known E1 gap (`02 §7.3` item 7), not silently treated as safe.',
    localProfileRequirement: null,
  },
  dec_cbc_local_range_precedence_001: {
    missingness:
      'scope.needsLocalRanges is a plain boolean, always defined once age-derived hemoglobin/MCV '
      + 'reference ranges are resolved (modules/anemia/facts.anemia.js): it is true whenever the '
      + 'effective hbLower/mcvLower/mcvUpper bounds are unresolved, so this rule fires '
      + 'deterministically — there is no runtime state where the underlying fact itself is absent.',
    localProfileRequirement: 'hemoglobin_and_mcv_local_reference_range_profile',
  },
  dec_cbc_benign_neutropenia_differential_pattern_001: {
    missingness:
      'cbc.neutropenia is a tri-state fact (\'true\'/\'false\'/\'unknown\', '
      + 'modules/anemia/facts.anemia.js\'s cytopeniaTri): it resolves \'unknown\' when no local '
      + 'neutropenia flag and no ANC value/local lower bound are supplied. Because this rule\'s '
      + '`when` clause compares for equality against the string \'true\' (src/ruleEngine.js\'s '
      + '`eq` leaf op), an \'unknown\' ANC/neutropenia state does not match and the rule silently '
      + 'does not fire — no missing-data question is emitted by this module for an absent ANC in '
      + 'this vertical slice (same E1 gap as the young-infant rule above).',
    localProfileRequirement: null,
  },
  dec_cbc_marrow_red_flag_001: {
    missingness:
      'Both conjuncts fail closed on missing data via src/ruleEngine.js\'s evaluateLeaf: '
      + '`cbc.anc lt 0.5` requires Number.isFinite(actual), so an absent ANC value evaluates to '
      + 'false rather than triggering the alert, and `cbc.neutropenia eq \'true\'` independently '
      + 'fails to match its \'unknown\' tri-state value for the same reason as the benign-'
      + 'differential rule above. This is the module\'s safety-critical rule, so a missing ANC '
      + 'value silently suppressing this alert (rather than prompting for it) is the highest-'
      + 'priority known gap this vertical slice surfaces — flagged explicitly, not silently '
      + 'treated as reassuring, and named as an item Phase 4 must resolve before this rule is '
      + 'treated as release-ready.',
    localProfileRequirement: null,
  },
});

/**
 * Builds one `rule-provenance.json` entry for a drafted proposal, joined by `ruleId`. Carries
 * forward every field the strict `schemas/rule.schema.json` projection has no slot for
 * (`decisionId`, `rfClaimIds`, `evidenceAssertionIds`, `reviewBy`, `supersedes`, `authoringNotes`)
 * plus the hand-grounded `missingness`/`localProfileRequirement` content above and the fixed
 * `testIds: []` / `reviewStatus: 'draft'` this drafting stage's own honest state (`02 §4.13`).
 *
 * @param {(typeof RULE_PROPOSALS)[number]} proposal
 * @returns {object}
 */
export function buildRuleProvenanceEntry(proposal) {
  const content = PROVENANCE_CONTENT_BY_DECISION_ID[proposal.decisionId];
  if (!content) {
    throw new Error(
      `rule-provenance-drafts: no missingness/localProfileRequirement content authored for `
      + `decisionId "${proposal.decisionId}" (proposal ${proposal.id}) — add one to `
      + 'PROVENANCE_CONTENT_BY_DECISION_ID rather than silently defaulting',
    );
  }
  return {
    ruleId: proposal.id,
    moduleId: MODULE_ID,
    basis: {
      kind: proposal.decisionBasisKind,
      decisionId: proposal.decisionId,
      rfClaimIds: proposal.rfClaimIds,
      evidenceAssertionIds: proposal.evidenceAssertionIds,
    },
    missingness: content.missingness,
    localProfileRequirement: content.localProfileRequirement,
    testIds: [...proposal.requiredTestCaseIds],
    reviewStatus: 'draft',
    reviewBy: proposal.reviewBy,
    supersedes: proposal.supersedes,
    authoringNotes: proposal.authoringNotes ?? null,
  };
}

/** All 4 slice rules' provenance entries, in `RULE_PROPOSALS` order. */
export const RULE_PROVENANCE_ENTRIES = Object.freeze(
  RULE_PROPOSALS.map((proposal) => Object.freeze(buildRuleProvenanceEntry(proposal))),
);

/**
 * The full `rule-provenance.json` document shape (mirrors `evidence-assertions.json`'s and
 * `authoring-decisions.yaml`'s own `{ schemaVersion, moduleId, rfProvenance, ... }` document
 * envelope, P3-T3/P3-T1).
 *
 * @returns {{ schemaVersion: string, moduleId: string, rfProvenance: object, entries: object[] }}
 */
export function buildRuleProvenanceDocument() {
  return {
    schemaVersion: '1.0',
    moduleId: MODULE_ID,
    rfProvenance: RF_PROVENANCE,
    entries: RULE_PROVENANCE_ENTRIES,
  };
}
