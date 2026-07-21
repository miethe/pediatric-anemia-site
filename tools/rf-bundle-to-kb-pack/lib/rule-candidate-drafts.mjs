// tools/rf-bundle-to-kb-pack/lib/rule-candidate-drafts.mjs — hand-authored rule-proposal +
// candidate drafting content (P3-T5, evidence-foundry-buildout Phase 3, `02 §4.13`/`02 §4.14`).
//
// FR-14 (`02 §4.5`) forbids the converter from inferring clinical Boolean logic from prose on its
// own. Exactly like `modules/cbc_suite_v1/authoring-decisions.yaml` (P3-T1), the content below is
// HAND-AUTHORED, not code-generated from the rf bundle — it is the human/reviewer-proxy act of
// translating an `approved_for_rule_draft` decision record into a drafted rule/candidate skeleton.
// This module is the committed, reviewable home for that content (the same role
// `authoring-decisions.yaml` plays for decisions); `writeDraftPack()` below is the small,
// deterministic, pure-I/O helper that materializes it at the `02 §4.4` output path
// (`build/kb-pack/cbc_suite_v1/0.1.0-proposal/`, gitignored per P1-T7) — nothing here infers
// clinical logic at write time, it only serializes what was authored above.
//
// Per this task's own binding scope: this output is NOT committed into `modules/cbc_suite_v1/`
// (that is Phase 4's job, P4-T1..T4) and `rule-proposals.json` is NOT validated against the
// strict runtime `schemas/rule.schema.json` (that strict 5-field projection is P3-T6's job,
// `02 §4.13`) — no dedicated schema for `rule-proposals.json` exists or is planned (this plan's
// binding OQ-7 resolution names exactly 4 new schema files, none of them a rule-proposal schema).
//
// Every `decisionId` below MUST match a real `decision_id` in the committed
// `modules/cbc_suite_v1/authoring-decisions.yaml` (P3-T1) — proven by
// `tests/ef-converter-rule-candidate-drafting.test.mjs`, which parses the real YAML file and
// cross-checks every join key against it (not merely against a second hardcoded string list here).
//
// KNOWN LIMITATIONS surfaced here, not silently resolved (mirrors the transparency posture
// `modules/cbc_suite_v1/authoring-decisions.yaml`'s own header already established):
//
//   1. FR-16(c) originally named this slice role "iron-deficiency-anemia candidate pattern," but
//      the RF-CBC-001 fixture (this plan's binding OQ-2 evidentiary source) is scoped to the
//      neutropenia / marrow-failure-risk evidence base and contains ZERO ferritin/iron claims.
//      P3-T1 flagged this and authored `dec_cbc_benign_neutropenia_differential_pattern_001` as the
//      genuinely-evidenced RF-CBC-001 analog of that slice role (a benign-vs-referral differential
//      candidate pattern) rather than mislabel neutropenia evidence as iron-deficiency evidence.
//      RESOLVED (P3-GATE remediation): the parent plan's binding "FR-16(c) candidate identity"
//      decision formally re-scopes FR-16(c) to this benign-ethnic/Duffy-null neutropenia
//      differential identity — no iron-deficiency candidate is authored, migrated, or referenced
//      anywhere in the E0 vertical slice. The drafted candidate below is named and evidenced for
//      what it actually is.
//   2. `02 §4.13`'s own field-mapping table sends "version/effective/review dates," the rule's
//      credentialed-approver list, "test IDs," and "supersession" to `rule-provenance.json` (a
//      P3-T6 sidecar) on the premise that the CURRENT `schemas/rule.schema.json` permits only
//      `id`/`category`/`when`/`evidence`/`output`. That premise is stale against the actual
//      current-tree schema (post EP-3/EP-4 governance hardening): `schemas/rule.schema.json` now
//      REQUIRES 9 additional governance fields directly on the rule record itself (`version`,
//      `effectiveDate`, `retireDate`, `owner`, `safetyClass`, `requiredTestCaseIds`,
//      `changeRationale`, `sourcePassageId`, and the always-empty approver-list field),
//      `additionalProperties: false`. This module still carries most of those fields on each
//      proposal (per the field-mapping table's intent — they need to live SOMEWHERE reviewable)
//      so P3-T6 has them ready to project either onto the strict `rules.json` record or into
//      `rule-provenance.json`, whichever that task determines reconciles correctly with the
//      actual schema; this file does not attempt to resolve that schema-vs-plan divergence itself
//      (out of P3-T5's scope; noted in `.claude/findings/evidence-foundry-buildout-findings.md`).
//      The approver-list field itself is deliberately NOT reproduced anywhere in this file or
//      elsewhere under tools/rf-bundle-to-kb-pack/ — `tests/ef-converter-invariants.test.mjs`'s
//      Invariant 15 asserts no file in this converter ever even NAMES that field, since clinical
//      approval is a human/governance-process outcome the converter must never reference, not
//      even as an always-empty placeholder. P3-T6/Phase 4 must add that field only on the
//      strict, committed rule record (matching modules/anemia/rules.json's existing pattern),
//      never inside this converter's own drafting tree.
//   3. `cbc_suite_v1`'s `deriveFacts` is delegated wholesale to `modules/anemia/facts.anemia.js`
//      (OQ-1) — real facts exist for the age-6-months boundary (`scope.neonatalOrYoungInfant`),
//      hemoglobin/MCV local-range availability (`scope.needsLocalRanges`), and a neutropenia
//      tri-state + raw ANC value (`cbc.neutropenia`, `cbc.anc`). No CBC-suite-specific fact yet
//      exists for: an ANC/analyzer-specific local-range-availability flag (rule b reuses the
//      HB/MCV-scoped `scope.needsLocalRanges` as the nearest available proxy), infection-history
//      absence or ancestry/Duffy context (rule c), or persistence/duration of a low ANC beyond a
//      single snapshot (rule d) — CBC-suite-specific fact derivation is an explicit E1 item (OQ-1,
//      `02 §7.3` item 7), not silently assumed to already exist. Each proposal's `authoringNotes`
//      below names its specific gap so Phase 4's migration (P4-T1..T4) inherits the caveat instead
//      of rediscovering it.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MODULE_ID = 'cbc_suite_v1';

export const RF_PROVENANCE = Object.freeze({
  rfRunId: 'rf_run_20260717_rf_cbc_001_pediatric_cds_establish',
  rfBundleId: 'bundle_20260718_intent_research_20260717_rf_cbc_001',
  fixturePath: 'tests/fixtures/rf-cbc-001/',
});

/** The one candidate pattern this slice authors (rule c's `output.candidateId` target). Schema-
 * conformant against `schemas/candidate.schema.json` verbatim (object keyed by `id`, 7 required
 * keys, `additionalProperties: false`) — this is the exact shape Phase 4 (P4-T3) will copy into
 * `modules/cbc_suite_v1/candidates.json` unmodified, so it is authored schema-legal now rather
 * than adapted later. */
export const CANDIDATES = Object.freeze({
  'benign-ethnic-neutropenia-differential-pattern': Object.freeze({
    id: 'benign-ethnic-neutropenia-differential-pattern',
    label: 'Benign ethnic/Duffy-null neutropenia differential pattern',
    category: 'differential (hematology — neutropenia)',
    summary:
      'A reviewable pattern, not a confirmed diagnosis, toward a benign ethnic/Duffy-null-'
      + 'phenotype-associated etiology for isolated mild neutropenia. Drawn from evidence that '
      + 'this etiology accounts for the large majority of pediatric neutropenia referrals in '
      + 'ancestrally relevant subgroups (77.7% overall; up to 96.6% and 91% in specific referral '
      + 'subgroups) and that absence of recurrent, frequent, or serious infection is the named '
      + 'discriminator from pathologic neutropenia. This pattern is always conflict-visible '
      + 'against, and must never suppress or downrank, a co-occurring marrow-red-flag safety '
      + 'alert (see the CBC-NEUT-MARROWFLAG-001 proposal) — the two may legitimately co-occur in '
      + 'the same patient, and the red-flag alert must dominate.',
    defaultNextSteps: [
      'Confirm absence of recurrent, frequent, or serious infection history.',
      'Consider Duffy-null phenotype / ancestrally relevant context where clinically available.',
      'If any marrow-red-flag feature is present, do not use this pattern to defer, downrank, or '
        + 'suppress the referral pathway.',
    ],
    evidence: ['JPEDS2023_DUFFY_NULL_NEUTROPENIA', 'PEDS2020_ISOLATED_NEUTROPENIA_OUTCOMES'],
    sourcePassageId: 'JPEDS2023_DUFFY_NULL_NEUTROPENIA#implementation-proposal',
  }),
});

/**
 * The 4 FR-16 slice-rule proposals, one per `modules/cbc_suite_v1/authoring-decisions.yaml`
 * record (P3-T1), joined by `decisionId`. Fields follow the `02 §4.13` authoring/runtime/sidecar
 * mapping table (see file header note 2 for why the governance-field set also mirrors the
 * ACTUAL current `schemas/rule.schema.json` shape, not just the plan doc's stale description of
 * it). `output` sub-objects already conform to `schemas/rule.schema.json`'s `$defs` output shapes
 * (`alertOutput`/`noteOutput`/`candidateOutput`) so P3-T6's strict-projection step has no
 * reshaping to do there, only field extraction.
 */
export const RULE_PROPOSALS = Object.freeze([
  Object.freeze({
    id: 'CBC-NEUT-YOUNGINF-001',
    decisionId: 'dec_cbc_young_infant_scope_abstention_001',
    category: 'safety',
    when: { fact: 'scope.neonatalOrYoungInfant', op: 'eq', value: true },
    evidence: ['HEMATOLREP2024_NEUTROPENIA_REVIEW', 'CALIPER2020_HEMATOLOGY_I'],
    output: {
      type: 'alert',
      severity: 'important',
      title: 'Neutropenia/CBC interpretation out of scope below 6 months',
      detail:
        'Neutropenia is defined by distinct age-banded ANC cutoffs (<2500x10^9/L in neonates/'
        + 'infants vs <1500x10^9/L in toddlers/older children); applying the older-child cutoff '
        + 'to a neonate or young infant would under-flag neutropenia. This module\'s supported '
        + 'age range begins at 6 months.',
      actions: [
        'Do not interpret this patient\'s CBC/ANC result against this module\'s thresholds — the '
          + 'age-appropriate infant reference range and clinical pathway are out of scope here.',
        'Route to an age-appropriate neonatal/young-infant hematology pathway.',
      ],
    },
    rfClaimIds: ['clm_018', 'clm_inf02'],
    evidenceAssertionIds: ['evas_cbc_young_infant_anc_001', 'evas_cbc_young_infant_anc_002'],
    decisionBasisKind: 'implementation_proposal',
    version: '0.1.0-proposal',
    effectiveDate: null,
    retireDate: null,
    reviewBy: '2027-07-21',
    owner: 'team:pediatric-cds-kb-maintainers',
    safetyClass: 'safety-critical',
    requiredTestCaseIds: [],
    changeRationale:
      'Drafted proposal (P3-T5) joined to dec_cbc_young_infant_scope_abstention_001 — no clinical '
      + 're-review has occurred; no credentialed clinician has approved this proposal.',
    supersedes: null,
    authoringNotes:
      'Reuses the existing `scope.neonatalOrYoungInfant` fact — already derived by '
      + 'modules/anemia/facts.anemia.js for the same age-6-months boundary and delegated to '
      + 'cbc_suite_v1 per OQ-1 — no new fact is required for this rule.',
  }),

  Object.freeze({
    id: 'CBC-NEUT-LOCALRANGE-001',
    decisionId: 'dec_cbc_local_range_precedence_001',
    category: 'informational',
    when: { fact: 'scope.needsLocalRanges', op: 'eq', value: true },
    evidence: ['CALIPER2020_HEMATOLOGY_I', 'CALIPER2023_MINDRAY_79PARAM'],
    output: {
      type: 'note',
      title: 'Local, analyzer-specific reference interval required',
      detail:
        'Pediatric hematology reference intervals are age- and analyzer-specific — two '
        + 'independent CALIPER cohorts (Beckman Coulter DxH 900; Mindray BC-6800Plus) each found '
        + 'age-specific differences statistically significant for the large majority of measured '
        + 'hematologic parameters. A universal cutoff must not be applied when no compatible '
        + 'local/analyzer-verified reference interval is available; prefer the configured local '
        + 'profile and abstain rather than silently apply a universal threshold.',
    },
    rfClaimIds: ['clm_009', 'clm_027', 'clm_inf07', 'clm_inf01'],
    evidenceAssertionIds: [
      'evas_cbc_age_interval_001',
      'evas_cbc_analyzer_specificity_001',
      'evas_cbc_unit_normalization_001',
    ],
    decisionBasisKind: 'implementation_proposal',
    version: '0.1.0-proposal',
    effectiveDate: null,
    retireDate: null,
    reviewBy: '2027-07-21',
    owner: 'team:pediatric-cds-kb-maintainers',
    safetyClass: 'informational',
    requiredTestCaseIds: [],
    changeRationale:
      'Drafted proposal (P3-T5) joined to dec_cbc_local_range_precedence_001 — no clinical '
      + 're-review has occurred; no credentialed clinician has approved this proposal.',
    supersedes: null,
    authoringNotes:
      'KNOWN LIMITATION: reuses `scope.needsLocalRanges` — an existing fact scoped to '
      + 'hemoglobin/MCV/RDW reference-range availability (modules/anemia/ranges.js) — as the '
      + 'nearest available proxy for "no compatible local ANC/CBC-parameter reference interval '
      + 'configured." cbc_suite_v1 does not yet derive an ANC/analyzer-specific local-range-'
      + 'availability fact of its own (CBC-suite-specific fact derivation is an E1 build item per '
      + 'OQ-1/`02 §7.3` item 7). Phase 4\'s migration of this rule must either confirm this proxy '
      + 'is acceptable for the vertical slice or add the narrower fact before committing.',
  }),

  Object.freeze({
    id: 'CBC-NEUT-BENIGNDIFF-001',
    decisionId: 'dec_cbc_benign_neutropenia_differential_pattern_001',
    category: 'differential',
    when: { fact: 'cbc.neutropenia', op: 'eq', value: 'true' },
    evidence: ['JPEDS2023_DUFFY_NULL_NEUTROPENIA', 'PEDS2020_ISOLATED_NEUTROPENIA_OUTCOMES'],
    output: {
      type: 'candidate',
      candidateId: 'benign-ethnic-neutropenia-differential-pattern',
      level: 'possible',
      points: 40,
      support: [
        'Duffy-null phenotype-associated (benign ethnic) neutropenia is the dominant etiology of '
          + 'pediatric neutropenia referrals in this evidence base (77.7% overall; up to 96.6% and '
          + '91% in ancestrally relevant referral subgroups).',
        'Absence of recurrent, frequent, or serious infection is the clinician-usable '
          + 'discriminator this evidence names between benign and pathologic neutropenia.',
      ],
      cautions: [
        'This is a reviewable pattern, not a confirmed diagnosis — Duffy phenotype/genotype '
          + 'testing and infection history are not yet represented as discrete facts in this '
          + 'module (E1 item).',
        'Never suppress or downrank a co-occurring marrow-red-flag alert '
          + '(dec_cbc_marrow_red_flag_001) because this pattern also matched — the red-flag rule '
          + 'must always dominate ranking when both are present.',
      ],
      nextSteps: [
        'Confirm absence of recurrent, frequent, or serious infection history.',
        'Consider Duffy-null phenotype/ancestrally relevant context where clinically available.',
        'If any marrow-red-flag feature is present, treat this pattern as non-reassuring and '
          + 'pursue the red-flag referral pathway instead.',
      ],
    },
    rfClaimIds: ['clm_039', 'clm_040', 'clm_041', 'clm_074', 'clm_043', 'clm_inf05'],
    evidenceAssertionIds: [
      'evas_cbc_benign_neutropenia_differential_001',
      'evas_cbc_benign_neutropenia_differential_002',
    ],
    decisionBasisKind: 'implementation_proposal',
    version: '0.1.0-proposal',
    effectiveDate: null,
    retireDate: null,
    reviewBy: '2027-07-21',
    owner: 'team:pediatric-cds-kb-maintainers',
    safetyClass: 'diagnostic',
    requiredTestCaseIds: [],
    changeRationale:
      'Drafted proposal (P3-T5) joined to dec_cbc_benign_neutropenia_differential_pattern_001 — '
      + 'no clinical re-review has occurred; no credentialed clinician has approved this proposal.',
    supersedes: null,
    authoringNotes:
      'RESOLVED IDENTITY (P3-GATE remediation): FR-16(c) originally named this slice role '
      + '"iron-deficiency-anemia candidate pattern," but the RF-CBC-001 fixture (this plan\'s '
      + 'binding OQ-2 evidentiary source) is scoped to neutropenia/marrow-failure evidence and '
      + 'contains zero ferritin/iron claims. The parent plan\'s binding "FR-16(c) candidate '
      + 'identity" decision formally re-scopes FR-16(c) to this proposal\'s true evidentiary '
      + 'identity (benign-ethnic/Duffy-null neutropenia differential), joined to '
      + 'dec_cbc_benign_neutropenia_differential_pattern_001 — no iron-deficiency candidate is '
      + 'authored, migrated, or referenced anywhere in this slice. `when` uses the existing '
      + '`cbc.neutropenia` tri-state fact; the infection-history-absence and ancestry-context '
      + 'refinements named in the evidence (clm_043, clm_inf05) are not yet derivable facts in '
      + 'this module (separate, still-open E1 item) — flagged, not silently assumed.',
  }),

  Object.freeze({
    id: 'CBC-NEUT-MARROWFLAG-001',
    decisionId: 'dec_cbc_marrow_red_flag_001',
    category: 'safety',
    when: {
      all: [
        { fact: 'cbc.neutropenia', op: 'eq', value: 'true' },
        { fact: 'cbc.anc', op: 'lt', value: 0.5 },
      ],
    },
    evidence: ['SCNIR2022_GCSF_OUTCOMES', 'COH2015_ELANE_MUTATIONS'],
    output: {
      type: 'alert',
      severity: 'urgent',
      title: 'Possible marrow-failure/myeloid-malignancy-risk neutropenia pattern',
      detail:
        'An ANC below 0.5x10^9/L is the diagnostic threshold used across this evidence base for '
        + 'severe/congenital neutropenia. Myeloid malignancy (MDS/AML) risk concentrates '
        + 'specifically in the persistent congenital neutropenia pattern (11.3%-16% across two '
        + 'independent SCNIR/registry cohorts) versus 0% in cyclic and autoimmune/idiopathic '
        + 'neutropenia — this is a hematology/oncology referral trigger, distinct from favorable-'
        + 'prognosis etiologies.',
      actions: [
        'Refer to pediatric hematology/oncology for confirmatory evaluation — do not diagnose '
          + 'marrow failure or malignancy from this result alone.',
        'This alert must dominate ranking/surface above any co-occurring benign differential '
          + 'candidate (e.g., benign-ethnic-neutropenia-differential-pattern) rather than being '
          + 'suppressed by it.',
      ],
    },
    rfClaimIds: ['clm_004', 'clm_005', 'clm_053', 'clm_inf04'],
    evidenceAssertionIds: [
      'evas_cbc_marrow_malignancy_risk_001',
      'evas_cbc_marrow_malignancy_risk_002',
    ],
    decisionBasisKind: 'implementation_proposal',
    version: '0.1.0-proposal',
    effectiveDate: null,
    retireDate: null,
    reviewBy: '2027-07-21',
    owner: 'team:pediatric-cds-kb-maintainers',
    safetyClass: 'safety-critical',
    requiredTestCaseIds: [],
    changeRationale:
      'Drafted proposal (P3-T5) joined to dec_cbc_marrow_red_flag_001 — no clinical re-review has '
      + 'occurred; no credentialed clinician has approved this proposal.',
    supersedes: null,
    authoringNotes:
      'KNOWN LIMITATION: the underlying evidence (clm_004/clm_053) specifically concerns '
      + 'PERSISTENT congenital neutropenia ("beyond infancy," "beyond age 0.25-1.0 years"); this '
      + 'module\'s deriveFacts operates on a single snapshot with no serial/duration fact, so this '
      + 'proposal cannot yet distinguish a persistent congenital pattern from a single transient '
      + 'low count. The rule is drafted to fail toward MORE caution accordingly: it alerts on any '
      + 'ANC<0.5x10^9/L, prompting confirmatory hematology/oncology evaluation rather than '
      + 'asserting persistence or a diagnosis. Phase 4\'s migration (P4-T4) should confirm this '
      + 'framing resolves to `02 §5.4`\'s hazard wording exactly, per that task\'s own AC.',
  }),
]);

/**
 * Materializes this module's hand-authored content at the `02 §4.4` staged-pack output path.
 * Pure I/O (mkdir + 2 writeFile calls) — no clinical inference happens here, only serialization
 * of the constants already defined above. `outDir` defaults to this repo's own
 * `build/kb-pack/cbc_suite_v1/0.1.0-proposal/` (gitignored per P1-T7) so a caller (a test, or
 * Phase 3's forthcoming `propose` verb, P3-T7) gets the exact path this task's AC names without
 * having to recompute it.
 *
 * @param {{ outDir?: string }} [options]
 * @returns {Promise<{ ruleProposalsPath: string, candidatesPath: string }>}
 */
export async function writeDraftPack({ outDir } = {}) {
  const targetDir = outDir
    ?? path.join(process.cwd(), 'build', 'kb-pack', MODULE_ID, '0.1.0-proposal');
  await mkdir(targetDir, { recursive: true });

  const ruleProposalsDoc = {
    schemaVersion: '1.0',
    moduleId: MODULE_ID,
    rfProvenance: RF_PROVENANCE,
    proposals: RULE_PROPOSALS,
  };
  const ruleProposalsPath = path.join(targetDir, 'rule-proposals.json');
  await writeFile(ruleProposalsPath, `${JSON.stringify(ruleProposalsDoc, null, 2)}\n`, 'utf8');

  const candidatesPath = path.join(targetDir, 'candidates.json');
  await writeFile(candidatesPath, `${JSON.stringify(CANDIDATES, null, 2)}\n`, 'utf8');

  return { ruleProposalsPath, candidatesPath };
}
