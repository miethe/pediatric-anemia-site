// tools/review-record/lib/verbs/validate.mjs — `validate` verb, P2-T2's first increment
// (FR-3/FR-4/FR-7). Full fail-closed behavior still lands incrementally, one dimension per later
// task, over this exact same verb:
//   - P2-T2 (this task): per-record schema shape (`schemas/review-record.schema.json`, reused
//     additively — see this tool's README "Why this tool exists"), D-4 roster resolution
//     (`lib/roster.mjs`, mirrors `scripts/validate-kb.mjs`'s own cross-check), and the FR-4
//     reviewer-2 textual-independence heuristic (`lib/independence.mjs`).
//   - P2-T3: `previousRecordHash` chain recomputation (`lib/chain.mjs`) + `validate --history`
//     git-history append-only check.
//   - P2-T4: authorship-union computation + adjudicator-not-in-authorship-union enforcement.
//   - P2-T5: Ed25519 signature verification, fail closed on tamper.
//
// `validate --module <id> [--root <dir>] [--record <review_id>]`: loads every committed record for
// `moduleId` (or a `--root` fixture tree standing in for it), schema- and roster-validates each one
// (all of them, or just `--record`'s one if given — that flag narrows ONLY the schema/roster pass;
// the reviewer-2 independence check is inherently pairwise and always runs over the whole module's
// `clinical-1`/`clinical-2` pair when both exist, regardless of `--record`). Collects every
// violation found (does not stop at the first) and fails closed with `ValidationFailedError` if the
// collected list is non-empty.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate as validateAgainstSchema } from '../../../../scripts/lib/json-schema-lite.mjs';
import { listModuleReviewRecords } from '../store.mjs';
import { loadRosterIndex, resolveReviewer } from '../roster.mjs';
import { checkReviewerIndependence } from '../independence.mjs';
import { EXIT_OK, UsageError, ValidationFailedError } from '../errors.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'review-record.schema.json');
const REVIEW_ID_RE = /^rr-[0-9]{4}-(clinical-1|clinical-2|lab|adjudication|release-auth)$/;

async function loadSchema() {
  return JSON.parse(await readFile(SCHEMA_PATH, 'utf8'));
}

/**
 * @param {{ module?: string, root?: string, record?: string }} options
 * @returns {Promise<number>}
 */
export async function run(options = {}) {
  const moduleId = options.module;
  if (typeof moduleId !== 'string' || moduleId.length === 0) {
    throw new UsageError('validate requires --module <module_id>');
  }
  const rootDir = typeof options.root === 'string' && options.root.length > 0 ? options.root : process.cwd();

  if (typeof options.record === 'string' && !REVIEW_ID_RE.test(options.record)) {
    throw new UsageError(`--record "${options.record}" must be a valid review_id (rr-<seq4>-<role>)`);
  }

  const allRecords = await listModuleReviewRecords(rootDir, moduleId);

  let scoped = allRecords;
  if (typeof options.record === 'string') {
    scoped = allRecords.filter((r) => r.reviewId === options.record);
    if (scoped.length === 0) {
      throw new UsageError(`--record "${options.record}" was not found under modules/${moduleId}/reviews/`);
    }
  }

  const violations = [];
  const schema = await loadSchema();
  const rosterIndex = await loadRosterIndex(rootDir);

  for (const entry of scoped) {
    for (const schemaError of validateAgainstSchema(schema, entry.record)) {
      violations.push(`${entry.reviewId}: schema ${schemaError.path}: ${schemaError.message}`);
    }

    const reviewerId = entry.record?.reviewerId;
    if (typeof reviewerId === 'string') {
      try {
        resolveReviewer(rosterIndex, reviewerId, moduleId);
      } catch (err) {
        violations.push(`${entry.reviewId}: ${err.message}`);
      }
    }
  }

  // Reviewer-2 independence (FR-4) is pairwise and module-scoped, not per-record — always computed
  // over the module's full clinical-1/clinical-2 pair (if both exist), independent of --record.
  const clinical1 = allRecords.find((r) => r.role === 'clinical-1');
  const clinical2 = allRecords.find((r) => r.role === 'clinical-2');
  violations.push(...checkReviewerIndependence(clinical1?.record, clinical2?.record));

  if (violations.length > 0) throw new ValidationFailedError(violations);

  process.stdout.write(
    `OK — ${scoped.length} record(s) validated for module "${moduleId}" (schema shape + D-4 roster ` +
      'resolution + FR-4 reviewer-2 independence heuristic; chain/adjudication/signature checks land ' +
      'in P2-T3/T4/T5).\n' +
      'Structural review-record state only -- not a clinical-validity, safety, or approval claim.\n',
  );
  return EXIT_OK;
}
