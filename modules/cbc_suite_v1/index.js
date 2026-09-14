// modules/cbc_suite_v1 — E0 vertical-slice module package (parent plan's OQ-1 resolution,
// docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
// "Decisions & OQ Resolutions").
//
// `facts.cbc.js` reuses anemia's established CBC measurement, unit, and local-range facts, then
// adds this module's fail-closed local-profile substrate. Pending platelet, pancytopenia, and
// smear-integration proposals deliberately do not execute. It remains a
// research-prototype package: local flags/ranges decide count status, no portable threshold is
// introduced, and the leukocytosis/eosinophilia branches remain explicitly unavailable.
//
// `modules/cbc_suite_v1/reference-ranges.json` is a byte-identical copy of
// `modules/anemia/reference-ranges.json` (module package-shape contract), but this module is
// deliberately NOT registered in `src/ranges/registry.js` — the CBC fact provider still resolves
// shared ranges through anemia's existing registration (see
// `modules/anemia/ranges.js`'s hardcoded `MODULE_ID = 'anemia'`), so a second registration
// would be dead code, not a real second range source.
//
// Units are different: `src/units.js#validateUnits` is keyed on the moduleId `assess()` is
// actually called with, and runs before `deriveFacts`, so it does not inherit through the shared
// fact provider the way ranges do. `./units.js` registers this module's own
// `'cbc_suite_v1'` unit specs (found missing, and fixed, while implementing P4-T5 — see that
// file's header comment for why).
import { deriveFacts, assertAgeWithinSupportedScope } from './facts.cbc.js';
import './units.js';

function summarize(facts) {
  return {
    neutropenia: facts.cbc.neutropenia,
    thrombocytopenia: facts.cbc.thrombocytopenia,
  };
}

function limitations() {
  return [
    'Leukocytosis, lymphocytosis, and eosinophilia are intentionally not classified: this module has no source-linked RF-CBC-004 passage for those branches.',
    'Platelet-disorder expansion, three-lineage cytopenia composition, and smear-review integration remain non-executable proposals pending distinct human approval.',
  ];
}

export default {
  id: 'cbc_suite_v1',
  manifest: {
    engineLabel: 'Pediatric CBC Suite Deterministic CDSS',
    knowledgeBaseVersion: '0.1.0-2026-07-21',
    evidenceReviewedThrough: '2026-07-21',
  },
  deriveFacts,
  assertInScope: assertAgeWithinSupportedScope,
  summarize,
  limitations,
};
