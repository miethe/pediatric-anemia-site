// tools/review-record/lib/verbs/render.mjs — `render` verb (P2-T1 dispatch scaffold only).
//
// Not yet implemented. P2-T6 ("Read-only static render, FR-8/FR-31/OQ-3") implements
// `render --module <id> [--record <review_id>]`: self-contained static HTML to
// `build/review-render/` (gitignored) showing the passage -> decision -> rule -> test chain from
// committed artifacts only. This stub exists purely so `cli.mjs --help` can list all five verbs
// today (OQ-1) and so a caller gets a clear, named, fail-closed error rather than a silent no-op.

import { NotImplementedError } from '../errors.mjs';

export async function run() {
  throw new NotImplementedError('render', 'P2-T6');
}
