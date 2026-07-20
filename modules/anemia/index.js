import { deriveFacts } from './facts.anemia.js';

function summarize(facts) {
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

function limitations(facts) {
  const items = [];

  if (!facts.scope.supportedAge) {
    items.push(
      'Built-in CBC reference intervals are not validated for this age. A neonatal/young-infant or adult-specific pathway and local intervals are required.',
    );
  }
  if (facts.patient.recentTransfusion === 'true') {
    items.push(
      'Recent transfusion can obscure MCV, reticulocyte response, hemoglobin analysis, red-cell enzyme assays, and hemolysis interpretation.',
    );
  }
  if (facts.patient.highAltitude === 'true') {
    items.push(
      'High-altitude hemoglobin interpretation requires locally appropriate adjustment; no altitude correction is applied in this prototype.',
    );
  }
  if (!facts.retic.known && facts.anemia.present) {
    items.push('Reticulocyte response is missing, limiting discrimination between production failure and blood loss/hemolysis.');
  }
  return items;
}

export default {
  id: 'anemia',
  manifest: {
    engineLabel: 'Pediatric Anemia Deterministic CDSS',
    knowledgeBaseVersion: '0.1.0-2026-07-15',
    evidenceReviewedThrough: '2026-07-15',
  },
  deriveFacts,
  summarize,
  limitations,
};
