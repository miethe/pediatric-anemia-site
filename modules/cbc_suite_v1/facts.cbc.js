// CBC Suite fact provider.
//
// The anemia fact provider remains the source for shared CBC measurements, unit handling, and
// local-range tri-state resolution. This wrapper adds only a fail-closed local-profile substrate
// and explicit unsupported high-count states; it does not execute the pending pancytopenia,
// platelet-expansion, or smear-integration proposals and introduces no portable count threshold.
import { deriveFacts as deriveAnemiaFacts, assertAgeWithinSupportedScope } from '../anemia/facts.anemia.js';
import { toTri } from '../../src/facts/tristate.js';

export function deriveFacts(input = {}) {
  const base = deriveAnemiaFacts(input);
  const inputCbc = input.cbc ?? {};
  const inputFlags = inputCbc.localFlags ?? {};
  const suppliedCytopeniaStatuses = [
    ['wbc', 'leukopenia'],
    ['anc', 'neutropenia'],
    ['platelets', 'thrombocytopenia'],
  ].flatMap(([countKey, flagKey]) => (
    Number.isFinite(inputCbc[countKey])
      || [true, false, 'true', 'false', 'unknown'].includes(inputFlags[flagKey])
      ? [base.cbc[flagKey]]
      : []
  ));
  const localProfileIncomplete = suppliedCytopeniaStatuses.some((value) => toTri(value) === 'unknown')
    ? 'true'
    : 'false';

  return {
    ...base,
    cbc: {
      ...base.cbc,
      urgency: {
        localProfileIncomplete,
      },
      // These branches have no RF-CBC-004 source-linked passage in this module.  Deliberately
      // expose their unknown state rather than manufacture a high-count/eosinophil cutoff.
      leukocytosis: 'unknown',
      eosinophilia: 'unknown',
    },
  };
}

export { assertAgeWithinSupportedScope };
