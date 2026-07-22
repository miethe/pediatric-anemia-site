// tools/review-record/lib/verbs/dry-run.mjs — `dry-run` verb (P2-T1 dispatch scaffold only).
//
// Not yet implemented. P2-T8 ("Five-role synthetic dry-run, FR-11") implements `dry-run`: one full
// end-to-end scaffold -> sign (TESTKEY) -> chain-validate cycle across all five roles, using
// labeled synthetic personas, committing the resulting record set to
// `modules/cbc_suite_v1/reviews/` with explicit non-qualifying language on every artifact. This
// stub exists purely so `cli.mjs --help` can list all five verbs today (OQ-1) and so a caller gets
// a clear, named, fail-closed error rather than a silent no-op.

import { NotImplementedError } from '../errors.mjs';

export async function run() {
  throw new NotImplementedError('dry-run', 'P2-T8');
}
