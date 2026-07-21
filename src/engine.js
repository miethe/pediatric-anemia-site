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

export function assess(input, moduleId, rules, candidates) {
  if (!Array.isArray(rules)) throw new TypeError('rules must be an array');
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
