// tools/review-record/lib/verbs/list.mjs — `list` verb (P2-T1, OQ-2, FR-7).
//
// `list --module <module_id> [--root <dir>]`: reads `modules/<module_id>/reviews/` (via
// `store.mjs`) and prints a structured, human-readable per-module review-record state summary —
// this task's own concrete OQ-2 deliverable ("`list` prints per-module review state"). Read-only:
// this verb never writes anything, and its chain-linkage column is informational only (see
// `chain.mjs`'s own header — P2-T3 owns fail-closed chain ENFORCEMENT, not this verb).
//
// `--root` defaults to `process.cwd()` (the real repo root in normal use) but lets tests point this
// verb at a fixture tree under `tests/fixtures/` without ever touching the real `modules/` tree —
// this is deliberate: hand-authored CLI-test fixtures must never be mistaken for (or accidentally
// collide with) real per-module review records, and must never fire `scripts/validate-kb.mjs`'s
// runtime `modules/<id>/reviews/*.yaml` scan.

import { listModuleReviewRecords } from '../store.mjs';
import { checkModuleChainLinkage } from '../chain.mjs';
import { EXIT_OK, UsageError } from '../errors.mjs';

const NON_QUALIFYING_BANNER =
  'Structural review-record state only -- not a clinical-validity, safety, or approval claim.';

/**
 * Pure formatter (exported separately so tests can assert on structure without capturing stdout).
 *
 * @param {string} moduleId
 * @param {{ reviewId: string, record: object }[]} records seq-ordered
 * @param {Map<string, { ok: boolean, reason: string|null }>} linkageByReviewId
 * @returns {string}
 */
export function formatModuleState(moduleId, records, linkageByReviewId) {
  const lines = [NON_QUALIFYING_BANNER, '', `Module: ${moduleId}`, `Reviews: ${records.length}`];

  if (records.length === 0) {
    lines.push('(no review records found under modules/<module_id>/reviews/)');
    return lines.join('\n');
  }

  lines.push('');
  for (const entry of records) {
    const rec = entry.record ?? {};
    const linkage = linkageByReviewId.get(entry.reviewId);
    const linkageText = linkage
      ? (linkage.ok ? 'ok' : `BROKEN -- ${linkage.reason}`)
      : 'unknown';
    lines.push(entry.reviewId);
    lines.push(`  role: ${rec.role ?? '(missing)'}`);
    lines.push(`  reviewerId: ${rec.reviewerId ?? '(missing)'}`);
    lines.push(`  decision: ${rec.decision ?? '(missing)'}`);
    lines.push(`  synthetic: ${typeof rec.synthetic === 'boolean' ? rec.synthetic : '(missing)'}`);
    lines.push(`  reviewedAt: ${rec.reviewedAt ?? '(missing)'}`);
    lines.push(`  supersedes: ${rec.supersedes ?? 'null'}`);
    lines.push(`  previousRecordHash: ${rec.previousRecordHash ?? 'null'}`);
    lines.push(`  chainLinkage (informational, see P2-T3 for enforcement): ${linkageText}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

/**
 * @param {{ module?: string, root?: string }} options
 * @returns {Promise<number>}
 */
export async function run(options = {}) {
  const moduleId = options.module;
  if (typeof moduleId !== 'string' || moduleId.length === 0) {
    throw new UsageError('list requires --module <module_id>');
  }
  const rootDir = typeof options.root === 'string' && options.root.length > 0
    ? options.root
    : process.cwd();

  const records = await listModuleReviewRecords(rootDir, moduleId);
  const linkage = checkModuleChainLinkage(records);
  const linkageByReviewId = new Map(linkage.map((entry) => [entry.reviewId, entry]));

  process.stdout.write(`${formatModuleState(moduleId, records, linkageByReviewId)}\n`);
  return EXIT_OK;
}
