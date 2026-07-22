// tools/review-record/lib/verbs/validate.mjs — `validate` verb (P2-T1 dispatch scaffold only).
//
// Not yet implemented as a CLI verb. Its full fail-closed behavior lands incrementally, one
// dimension per later task, all against the same `schemas/review-record.schema.json` +
// `governance/reviewer-roster.yaml` contracts `scripts/validate-kb.mjs` already structurally
// validates at `npm run validate` time:
//   - P2-T3: `previousRecordHash` chain recomputation (`lib/chain.mjs`) + `validate --history`
//     git-history append-only check.
//   - P2-T4: authorship-union computation + adjudicator-not-in-authorship-union enforcement.
//   - P2-T5: Ed25519 signature verification, fail closed on tamper.
// This stub exists purely so `cli.mjs --help` can list all five verbs today (OQ-1) and so a caller
// gets a clear, named, fail-closed error rather than a silent no-op.

import { NotImplementedError } from '../errors.mjs';

export async function run() {
  throw new NotImplementedError('validate', 'P2-T3 (chain) / P2-T4 (adjudication) / P2-T5 (signature)');
}
