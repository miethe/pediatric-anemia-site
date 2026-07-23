// src/moduleManifests.js — D-2 / FR-12 (docs/project_plans/PRDs/features/spa-module-switcher-v1.md).
//
// The banner truth source for every registered module: four literal JSON import statements,
// exported as a single frozen moduleId-keyed map. This file performs NO verification of any
// kind — it is a static data module, nothing else.
//
// Why no verification: SQ-2 proved a client-side re-check of manifest content-provenance is
// impossible once the build has run. The stored provenance value on each manifest is computed
// over the raw bytes of ranges.js/facts.anemia.js (see src/kbVerify.js), but
// scripts/build-static.mjs:139-153 rewrites every .js file to append a `?v=` cache-busting stamp
// before writing it into the built output — so a value recomputed from that rewritten output can
// never match the manifest's stored one (measured: 49a597cb… from the source tree vs. d154a20c…
// from the built output, for the same file). Separately, the build's own summary artifact does
// not exist in the dev layout and is explicitly excluded from the browser's static import/fetch
// surface by scripts/check-app-imports.mjs:137-141. There is no honest way for the browser to
// re-check a manifest against its own build output, so this module doesn't try.
//
// Import specifiers below are LITERAL (never template-built): a template-built specifier
// (`` import(`../modules/${id}/module.json`) ``) would defeat both static analysis
// (scripts/check-app-imports.mjs's specifier resolution) and, for the KB-loading equivalent of
// this pattern, the build's `?v=` stamping (see src/moduleKbLoaders.js, a later phase, for that
// failure mode).
import anemia from '../modules/anemia/module.json' with { type: 'json' };
import cbc_suite_v1 from '../modules/cbc_suite_v1/module.json' with { type: 'json' };
import growth_suite_v1 from '../modules/growth_suite_v1/module.json' with { type: 'json' };
import kidney_suite_v1 from '../modules/kidney_suite_v1/module.json' with { type: 'json' };

// Cross-phase hardening (post-P2 second-opinion review finding 1, applied here to the P1 file it
// concerns): `__proto__: null` in the object-literal position below is special-cased object
// literal syntax (not a regular property assignment) that gives this map a null prototype instead
// of `Object.prototype`. This is belt-and-braces alongside src/moduleEligibility.js's
// `Object.hasOwn()` guard, which is the primary, load-bearing fix — an id like `'constructor'` or
// `'toString'` now resolves to `undefined` here even without that guard, closing the same
// fail-open-on-inherited-property class of bug at its source. The map is still exactly the four
// literal, moduleId-keyed manifests; nothing about D-2/FR-12's shape changes.
export const MODULE_MANIFESTS = Object.freeze({
  __proto__: null,
  anemia,
  cbc_suite_v1,
  growth_suite_v1,
  kidney_suite_v1,
});
