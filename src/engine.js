import { runRules, assertNoClaimedClinicalApproval } from './ruleEngine.js';
import { getModule } from './modules/registry.js';
import { prepareUnitValidatedInput } from './units.js';
import { passageByIdForModule } from './evidence/registry.js';
import { hasCredentialedClinicalApproval, isActive } from './governance.js';

const CORE_LIMITATIONS = [
  'This output is a deterministic clinical decision-support reference, not a diagnosis, treatment order, or substitute for examination and specialist judgment.',
  'The ranking is rule priority—not a calibrated probability, sensitivity, specificity, or risk score.',
  'Only supplied data are evaluated; missing, mistyped, or unit-mismatched data can materially change the output.',
  'Local laboratory reference intervals, specimen methods, and clinical context override built-in fallback intervals.',
];

// D-4 runtime guarantee now lives at the lowest exported evaluation entry point
// (src/ruleEngine.js#assertNoClaimedClinicalApproval), so a direct runRules() caller cannot
// bypass it — the reviewer's fourth pass showed that runRules() was exported and unguarded.
// assess() still calls it explicitly so the refusal happens before any other work.

export function assess(input, moduleId, rules, candidates) {
  if (!Array.isArray(rules)) throw new TypeError('rules must be an array');
  assertNoClaimedClinicalApproval(rules);
  const module = getModule(moduleId);
  const { input: snapshot, unitValidation } = prepareUnitValidatedInput(moduleId, input);
  const facts = module.deriveFacts(snapshot);
  // ARCH §10 condition 2 (EP5-T6): a module may declare an optional `assertInScope` hook that
  // refuses to produce an assessment for facts outside its supported scope (e.g. anemia's
  // age-outside-supported-range-with-no-local-limits case). Generic and module-agnostic by
  // design — this file has no anemia-specific knowledge; see
  // modules/anemia/facts.anemia.js#assertAgeWithinSupportedScope for the concrete anemia policy.
  module.assertInScope?.(facts);
  const ruleOutput = runRules(facts, rules, candidates);
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
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
      //
      // FIX-E (reviewer re-review, finding E): resolved through src/evidence/registry.js's
      // moduleId-scoped accessor rather than src/evidence.js's anemia-only singleton — this
      // `moduleId` (the one passed into assess(), not a hardcoded default) selects which module's
      // evidence to search, and an unregistered moduleId throws instead of silently resolving
      // against anemia's data.
      //
      // FIX-F (reviewer re-review, finding F): src/governance.js's honest, non-throwing boolean
      // predicates are wired into this real output path (previously unused production code, only
      // exercised by its own isolated test) — additive to the existing entry shape.
      ruleAudit: ruleOutput.audit.map((entry) => {
        const rule = ruleById.get(entry.ruleId);
        return {
          ...entry,
          sourcePassageStatus: passageByIdForModule(moduleId, entry.sourcePassageId)?.status ?? null,
          hasCredentialedClinicalApproval: rule ? hasCredentialedClinicalApproval(rule) : false,
          isActive: rule ? isActive(rule) : false,
        };
      }),
      unitsAssumed,
    },
  };
}

export function assessPediatricAnemia(input, rules, catalog) {
  return assess(input, 'anemia', rules, catalog);
}
