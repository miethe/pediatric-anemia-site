/**
 * Shim: reference-range lookups bound to the 'anemia' module.
 *
 * The generic registry lives in `src/ranges/registry.js`; the anemia-specific band
 * registrations and the composition wrapper reproducing this module's legacy output shapes
 * live in `modules/anemia/ranges.js`. This file exists only so existing importers
 * (`tests/engine.test.mjs`) need no edit.
 */

export {
  getBuiltInRange,
  getEffectiveRanges,
  getFerritinThreshold,
  REFERENCE_RANGE_SOURCE,
  BUILT_IN_RANGES,
} from '../modules/anemia/ranges.js';
