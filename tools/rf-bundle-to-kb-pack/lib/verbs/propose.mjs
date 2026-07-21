// tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs — `propose` verb stub.
//
// P2-T1's own acceptance criteria requires `propose` to exit "not yet implemented" until Phase 3
// wires it up (02 §4.5, phase-3-5 plan file) — unlike `inspect`/`verify` (which get real verb
// dispatch this phase, P2-T6/P2-T7), `propose` is intentionally inert for the entire duration of
// Phase 2. Do not add real logic here before Phase 3.
//
// Future contract (Phase 3, do not implement yet): `propose --run-dir <dir> --module <path>
// --decisions <authoring-decisions.yaml path> --out <build/kb-pack/... dir>` drafts a full
// `kb-pack` proposal (02 §4.4 outputs, §4.6 phases 5-11). It "can emit rule skeletons only where
// an approved authoring decision exists. It MUST NOT infer clinical Boolean logic from prose on
// its own" (02 §4.5).

import { UsageError } from '../errors.mjs';

/**
 * @param {object} _options parsed CLI flags for this verb (unused until Phase 3)
 * @returns {Promise<number>} never resolves — always throws
 */
export async function run(_options) {
  throw new UsageError(
    'propose: not yet implemented — wired in Phase 3 (02 §4.5; ' +
      'see docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/' +
      'phase-3-5-projection-slice-manifest.md). Phase 2 (EF-WP0 converter core) supports ' +
      'inspect/verify only.',
  );
}
