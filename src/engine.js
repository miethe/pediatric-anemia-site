import { deriveFacts } from './facts.js';
import { runRules } from './ruleEngine.js';
import { KNOWLEDGE_BASE_VERSION, REVIEWED_THROUGH } from './evidence.js';

function classificationSummary(facts) {
  const rangeSource = facts.thresholds.provenance?.hbLower?.source;
  return {
    anemiaStatus: facts.anemia.status,
    hemoglobin: facts.cbc.hb,
    hemoglobinLowerLimit: facts.thresholds.hbLower,
    morphology: facts.morphology.value,
    mcv: facts.cbc.mcv,
    mcvLowerLimit: facts.thresholds.mcvLower,
    mcvUpperLimit: facts.thresholds.mcvUpper,
    rdw: facts.cbc.rdw,
    rdwHigh: facts.morphology.rdwHigh,
    reticulocyteResponse: facts.retic.response,
    thresholdSource: rangeSource,
    ageBand: facts.thresholds.provenance?.builtInAgeBand ?? null,
  };
}

function globalLimitations(facts) {
  const limitations = [
    'This output is a deterministic clinical decision-support reference, not a diagnosis, treatment order, or substitute for examination and specialist judgment.',
    'The ranking is rule priority—not a calibrated probability, sensitivity, specificity, or risk score.',
    'Only supplied data are evaluated; missing, mistyped, or unit-mismatched data can materially change the output.',
    'Local laboratory reference intervals, specimen methods, and clinical context override built-in fallback intervals.',
  ];

  if (!facts.scope.supportedAge) {
    limitations.push(
      'Built-in CBC reference intervals are not validated for this age. A neonatal/young-infant or adult-specific pathway and local intervals are required.',
    );
  }
  if (facts.patient.recentTransfusion) {
    limitations.push(
      'Recent transfusion can obscure MCV, reticulocyte response, hemoglobin analysis, red-cell enzyme assays, and hemolysis interpretation.',
    );
  }
  if (facts.patient.highAltitude) {
    limitations.push(
      'High-altitude hemoglobin interpretation requires locally appropriate adjustment; no altitude correction is applied in this prototype.',
    );
  }
  if (!facts.retic.known && facts.anemia.present) {
    limitations.push('Reticulocyte response is missing, limiting discrimination between production failure and blood loss/hemolysis.');
  }
  return limitations;
}

export function assessPediatricAnemia(input, rules, catalog) {
  if (!Array.isArray(rules)) throw new TypeError('rules must be an array');
  const facts = deriveFacts(input);
  const ruleOutput = runRules(facts, rules, catalog);

  return {
    meta: {
      engine: 'Pediatric Anemia Deterministic CDSS',
      knowledgeBaseVersion: KNOWLEDGE_BASE_VERSION,
      evidenceReviewedThrough: REVIEWED_THROUGH,
      generatedAt: new Date().toISOString(),
      intendedUser: 'Licensed health care professional',
      status: 'Research prototype—not clinically validated',
    },
    classification: classificationSummary(facts),
    alerts: ruleOutput.alerts,
    rankedDifferential: ruleOutput.candidates,
    nextQuestions: ruleOutput.questions,
    interpretiveNotes: ruleOutput.notes,
    limitations: globalLimitations(facts),
    provenance: {
      evaluatedRuleCount: ruleOutput.audit.length,
      matchedRuleIds: ruleOutput.audit.filter((entry) => entry.matched).map((entry) => entry.ruleId),
      ruleAudit: ruleOutput.audit,
    },
  };
}
