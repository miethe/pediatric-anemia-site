// modules/cbc_suite_v1 — E0 vertical-slice module package (parent plan's OQ-1 resolution,
// docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
// "Decisions & OQ Resolutions").
//
// `deriveFacts`/`assertInScope`/`summarize`/`limitations` delegate directly to the already-
// registered `anemia` module's hook descriptor (modules/anemia/index.js, itself backed by
// modules/anemia/facts.anemia.js) — explicit cross-module delegation, not duplication or a
// stub. All 4 slice rules this module will carry (Phase 4) consume exactly the fact shape
// `anemia` already derives (hemoglobin, ferritin, morphology, marrow-flag facts);
// CBC-Suite-specific fact derivation is out of scope for E0 and is one of E1's build items
// (`02 §7.3` item 7).
//
// `modules/cbc_suite_v1/reference-ranges.json` is a byte-identical copy of
// `modules/anemia/reference-ranges.json` (module package-shape contract), but this module is
// deliberately NOT registered in `src/ranges/registry.js` — the delegated `deriveFacts` call
// above already resolves ranges through `anemia`'s existing registration (see
// `modules/anemia/ranges.js`'s hardcoded `MODULE_ID = 'anemia'`), so a second registration
// would be dead code, not a real second range source.
//
// Units are different: `src/units.js#validateUnits` is keyed on the moduleId `assess()` is
// actually called with, and runs before `deriveFacts`, so it does NOT inherit through the
// deriveFacts delegation above the way ranges do. `./units.js` registers this module's own
// `'cbc_suite_v1'` unit specs (found missing, and fixed, while implementing P4-T5 — see that
// file's header comment for why).
import anemiaModule from '../anemia/index.js';
import './units.js';

export default {
  id: 'cbc_suite_v1',
  manifest: {
    engineLabel: 'Pediatric CBC Suite Deterministic CDSS',
    knowledgeBaseVersion: '0.1.0-2026-07-21',
    evidenceReviewedThrough: '2026-07-21',
  },
  deriveFacts: anemiaModule.deriveFacts,
  assertInScope: anemiaModule.assertInScope,
  summarize: anemiaModule.summarize,
  limitations: anemiaModule.limitations,
};
