// tools/review-record/lib/verbs/scaffold.mjs — `scaffold` verb (P2-T1 dispatch scaffold only).
//
// Not yet implemented. P2-T2 ("Role scaffolding + roster checks + reviewer-2 independence") wires
// this up: `scaffold --module <id> --role <role> --subject <content-hash>` creating a schema-valid
// record for one of the five roles, requiring `reviewerId` to resolve against
// `governance/reviewer-roster.yaml` (fail closed on an unknown identity), and structurally
// preventing the `clinical-2` flow from ever reading/printing/embedding any `clinical-1` decision
// content (FR-4). This stub exists purely so `cli.mjs --help` can list all five verbs today (OQ-1)
// and so a caller gets a clear, named, fail-closed error rather than a silent no-op.

import { NotImplementedError } from '../errors.mjs';

export async function run() {
  throw new NotImplementedError('scaffold', 'P2-T2');
}
