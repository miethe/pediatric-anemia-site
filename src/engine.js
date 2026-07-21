import { runRules } from './ruleEngine.js';
import { getModule } from './modules/registry.js';
import { prepareUnitValidatedInput } from './units.js';
import { passageById } from './evidence.js';

const CORE_LIMITATIONS = [
  'This output is a deterministic clinical decision-support reference, not a diagnosis, treatment order, or substitute for examination and specialist judgment.',
  'The ranking is rule priority—not a calibrated probability, sensitivity, specificity, or risk score.',
  'Only supplied data are evaluated; missing, mistyped, or unit-mismatched data can materially change the output.',
  'Local laboratory reference intervals, specimen methods, and clinical context override built-in fallback intervals.',
];

/**
 * D-4 RUNTIME GUARANTEE (reviewer gate 2026-07-21, finding 4, second pass).
 *
 * Static checks over rules.json and dist/ were both defeatable: `npm run check` runs tests BEFORE
 * the build, and an in-memory transform could populate `clinicalApprovers` on the rules array after
 * every file-level check had already passed. The engine is the one place every evaluation path must
 * go through, so the guarantee is enforced HERE, on the actual array being evaluated.
 *
 * No credentialed human clinician has approved any rule in this knowledge base. Until that changes
 * through a deliberate, reviewed process, a rule arriving at the engine with a non-empty
 * `clinicalApprovers` is not a rule to be evaluated cautiously — it is a false claim of clinical
 * sign-off, and the engine refuses to run rather than produce output carrying it.
 */
function assertNoClaimedClinicalApproval(rules) {
  const offenders = rules
    .filter((rule) => Array.isArray(rule?.clinicalApprovers) && rule.clinicalApprovers.length > 0)
    .map((rule) => rule.id);
  if (offenders.length > 0) {
    throw new Error(
      `D-4 VIOLATION — refusing to evaluate: ${offenders.length} rule(s) claim credentialed clinical `
      + `approval that does not exist (${offenders.slice(0, 5).join(', ')}${offenders.length > 5 ? ', …' : ''}). `
      + 'clinicalApprovers[] must be empty; no synthetic review (ARC council, council-review, rf '
      + 'verification, or model self-attestation) may populate it.',
    );
  }
}

export function assess(input, moduleId, rules, candidates) {
  if (!Array.isArray(rules)) throw new TypeError('rules must be an array');
  assertNoClaimedClinicalApproval(rules);
  const module = getModule(moduleId);
  const { input: snapshot, unitValidation } = prepareUnitValidatedInput(moduleId, input);
  const facts = module.deriveFacts(snapshot);
  const ruleOutput = runRules(facts, rules, candidates);
  const unitsAssumed = unitValidation.fields
    .filter((field) => field.unitAssumed)
    .map((field) => field.field);
  const unitLimitations = unitsAssumed.length > 0
    ? [`Documented default units were assumed for supplied measurements: ${unitsAssumed.join(', ')}.`]
    : [];

  return {
    meta: {
      engine: module.manifest.engineLabel,
      knowledgeBaseVersion: module.manifest.knowledgeBaseVersion,
      evidenceReviewedThrough: module.manifest.evidenceReviewedThrough,
      generatedAt: new Date().toISOString(),
      intendedUser: 'Licensed health care professional',
      status: 'Research prototype—not clinically validated',
    },
    classification: module.summarize(facts),
    alerts: ruleOutput.alerts,
    rankedDifferential: ruleOutput.candidates,
    nextQuestions: ruleOutput.questions,
    interpretiveNotes: ruleOutput.notes,
    limitations: [...CORE_LIMITATIONS, ...module.limitations(facts), ...unitLimitations],
    provenance: {
      evaluatedRuleCount: ruleOutput.audit.length,
      matchedRuleIds: ruleOutput.audit.filter((entry) => entry.matched).map((entry) => entry.ruleId),
      // Reviewer-gate fix-5 (finding 3, scope-bounded): additive per-rule passage provenance.
      // ruleEngine.js only carries the raw `sourcePassageId` pointer through (it does not load
      // src/evidence.js); this is where that pointer gets resolved to the passage's own `status`
      // (source-supported / quarantined / implementation-proposal / null if unresolved), so a
      // consumer of this audit trail can see not just THAT a rule cites a passage but WHAT KIND of
      // grounding claim it is, without a second lookup. Out of scope for this fix: candidate-level
      // passage pointers and SPA/algorithm-explorer rendering of this field (see the reviewer-gate
      // fix note) — those remain follow-up work.
      ruleAudit: ruleOutput.audit.map((entry) => ({
        ...entry,
        sourcePassageStatus: passageById(entry.sourcePassageId)?.status ?? null,
      })),
      unitsAssumed,
    },
  };
}

export function assessPediatricAnemia(input, rules, catalog) {
  return assess(input, 'anemia', rules, catalog);
}
