import unitData from './units.json' with { type: 'json' };
import { registerAnalyteUnit, registerUnitModule } from '../../src/units.js';

const MODULE_ID = 'anemia';

registerUnitModule(MODULE_ID);
for (const spec of unitData) {
  registerAnalyteUnit(MODULE_ID, spec.analyte, spec);
}
