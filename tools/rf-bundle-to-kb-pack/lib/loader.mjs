// tools/rf-bundle-to-kb-pack/lib/loader.mjs — read-only rf-bundle loader + artifact resolution
// (P2-T1 scaffold; implemented by P2-T2, FR-6, 02 §4.3).
//
// Module boundary (defined here, filled in by P2-T2):
//
//   loadBundle({ runDir, modulePath }) -> Promise<LoadedBundle>
//
// Contract P2-T2 must satisfy (do not weaken when implementing):
//   - Resolves every artifact path (`evidence_bundle.yaml`, `claims/claim_ledger.yaml`,
//     `reviews/verification.yaml`, `sources/src_*.md`, `extractions/ext_*.yaml`) relative to
//     `evidence_bundle.yaml.artifacts` — never a hard-coded relative-path assumption (02 §4.3's
//     closing line: "The converter MUST resolve artifact paths from
//     `evidence_bundle.yaml.artifacts`; hard-coded assumptions are fallback validation only.").
//   - Also resolves `modules/<module_id>/module.json` (envelope; current-tree name per the
//     path-mapping worknote — 02 doc's `module.yaml` is stale) and
//     `modules/<module_id>/authoring-decisions.yaml`.
//   - `authoring-decisions.yaml` legitimately does not exist until P3-T1 lands. Its absence MUST
//     fail closed with a *specific* error (e.g. a named `UsageError`/`SchemaError` subclass whose
//     message names the missing file and the reason), never a generic stack trace.
//   - MUST NOT write to `runDir` under any circumstance (seam invariant 6, 02 §2.3 item 6). A test
//     asserting `runDir` file mtimes/permissions are unchanged after a full loader pass is part of
//     P2-T2's acceptance criteria.
//   - Reads YAML from disk (seam invariant 2) — this repo has a deliberate zero-runtime-dependency
//     posture (see `scripts/lib/json-schema-lite.mjs` and `scripts/evidence/vendor-rf-bundle.mjs`'s
//     header comments, both already-merged precedent). P2-T2 should hand-roll (or extend a shared
//     hand-rolled) YAML-subset parser rather than adding a `yaml` npm dependency — see this
//     directory's README "Design decisions" section for the full rationale.
//
// LoadedBundle shape is intentionally left for P2-T2 to define precisely; at minimum it must carry
// enough to let hashing.mjs (P2-T3) and eligibility.mjs (P2-T4) work purely from what this function
// returns, without re-reading the filesystem themselves.

import { NotImplementedError } from './errors.mjs';

/**
 * @param {{ runDir: string, modulePath: string }} _options
 * @returns {Promise<object>} the resolved, read-only bundle representation (shape defined by P2-T2)
 */
export async function loadBundle(_options) {
  throw new NotImplementedError('P2-T2', 'lib/loader.js#loadBundle');
}
