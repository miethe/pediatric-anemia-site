// modules/cbc_suite_v1 units registration — required plumbing gap found and fixed while
// implementing P4-T5 (test corpus), NOT a rule/evidence content change.
//
// Unlike range-band resolution (see modules/cbc_suite_v1/index.js's header comment: ranges
// resolve through anemia's hardcoded `MODULE_ID = 'anemia'` inside modules/anemia/ranges.js, so a
// second registration there would be dead code), `src/units.js#validateUnits` is keyed on the
// ACTUAL moduleId passed to `assess()` (here, `'cbc_suite_v1'`), and runs BEFORE `deriveFacts` is
// ever called — delegating `deriveFacts` to `anemia` does nothing to satisfy it. Before this file
// existed, `assess(input, 'cbc_suite_v1', rules, candidates)` threw `UnitRejectionError` (reason:
// `'unregistered-module'`) for every input, unconditionally, because no module had ever called
// `registerUnitModule('cbc_suite_v1')`. This was previously undetected because no prior test
// exercised the real `assess()`/`src/engine.js` path with `moduleId: 'cbc_suite_v1'` — P4-T5 is the
// first to do so.
//
// `./units.json` is a byte-identical copy of `modules/anemia/units.json`, matching the same
// module-package-shape convention already established for `reference-ranges.json`.
import unitData from './units.json' with { type: 'json' };
import { registerAnalyteUnit, registerUnitModule } from '../../src/units.js';

const MODULE_ID = 'cbc_suite_v1';

registerUnitModule(MODULE_ID);
for (const spec of unitData) {
  registerAnalyteUnit(MODULE_ID, spec.analyte, spec);
}
