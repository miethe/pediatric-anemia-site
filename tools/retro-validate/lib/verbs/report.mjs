// tools/retro-validate/lib/verbs/report.mjs -- `report` verb. Real as of P4-T4 (FR-21, OQ-5,
// software-agreement metrics + provenance sidecar):
//
//   report --corpus <dir> --run <replay output dir> [--protocol <protocol doc>]
//
// ADR-0006 binding clause (P4-T2, unchanged by this task): this verb calls the BOUNDARY module
// (`../boundary.mjs#checkFixtures`) FIRST, unconditionally, before any of its own logic -- the
// same refusal contract `run.mjs` carries (see that file's header for the full rationale). A
// corpus that is unchecked (no `--corpus` given) or failing (any FR-20 violation) causes this verb
// to refuse to start, BEFORE any of the P4-T4 logic below is ever reached. This call site does not
// move.
//
// P4-T4: once the boundary gate clears, this verb requires `--run <replay output dir>` -- the
// directory `run` (P4-T3) already wrote `replay-output.json` into (`../replay.mjs#defaultOutputDir`).
// It reads that ALREADY-REPLAYED document (never re-runs the engine itself -- `report` is a pure
// metrics/aggregation step over `run`'s own output), confirms it names the SAME corpus this
// invocation's own `--corpus` resolved (a cross-check against a mismatched `--run`/`--corpus`
// pairing), computes the 5 OQ-5 software-agreement measures (`../metrics.mjs#computeAgreementMeasures`),
// evaluates the FR-24 protocol-qualification banner (`../metrics.mjs#evaluateProtocolQualification`
// -- structurally always non-qualifying in Evidence Foundry E1, see that function's own doc
// comment), and writes BOTH `agreement-report.json` (canonical, timestamp-free, determinism-
// compared bytes) and its `run-provenance.json` sidecar (the ONE sanctioned timestamp location)
// into that same `--run` directory, alongside `replay-output.json`.
//
// An optional `--protocol <path>` is read (if given) purely so its content can be recorded in the
// non-qualifying banner's `populatedFields`/`reason` detail -- it can never flip a report to
// "qualifying" (see `../metrics.mjs#evaluateProtocolQualification`). `tools/retro-validate/schemas/
// protocol.schema.json` (P4-T6, lands after this task) is a SEPARATE, later-authored structural
// gate on what a protocol document may even contain; this verb does not depend on it existing.
//
// P4-T7 (FR-22, ADR-0006 audit clause): the FIRST statement of `run()` below unconditionally
// appends one entry to the access log (`../access-log.mjs#logAccessAttempt`) -- BEFORE even the
// boundary gate, so an unchecked/failing/usage-rejected invocation is audited exactly like a
// successful one. This does not move the boundary gate's own call-site -- see
// `tests/ef-retro-boundary.test.mjs` for the call-order proof that remains true unchanged.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { checkFixtures } from '../boundary.mjs';
import { logAccessAttempt } from '../access-log.mjs';
import {
  computeAgreementMeasures,
  evaluateProtocolQualification,
  buildAgreementReportDocument,
  buildRunProvenanceDocument,
  writeAgreementReport,
  writeRunProvenance,
} from '../metrics.mjs';
import { REPLAY_OUTPUT_FILENAME } from '../replay.mjs';
import { EXIT_OK, UsageError } from '../errors.mjs';

async function readJsonOrThrow(filePath, describe) {
  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new UsageError(`no ${describe} found at "${filePath}"`);
    }
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new UsageError(`"${filePath}" is not valid JSON: ${err.message}`);
  }
}

/**
 * @param {{ corpus?: string, run?: string, protocol?: string, actor?: string, purpose?: string, accessLogPath?: string }} options
 * @returns {Promise<number>} process exit code (EXIT_OK on success)
 * @throws {UsageError} no `--corpus`/`--run` given, `--run` names no `replay-output.json`, that
 *   document's `corpusId` does not match `--corpus`'s own resolved id, or `--protocol` names an
 *   unreadable/unparsable file
 * @throws {import('../errors.mjs').BoundaryError} the corpus fails the FR-20 boundary (checked FIRST)
 */
export async function run(options) {
  await logAccessAttempt('report', options);
  const corpusDir = options?.corpus;
  if (!corpusDir || typeof corpusDir !== 'string') {
    throw new UsageError('report requires --corpus <dir>');
  }
  // ADR-0006 binding clause: the boundary gate runs FIRST, unconditionally -- a failing or
  // unchecked corpus never reaches this verb's own logic below.
  const corpusSummary = await checkFixtures(corpusDir);

  const runDir = options?.run;
  if (!runDir || typeof runDir !== 'string') {
    throw new UsageError(
      'report requires --run <replay output dir> -- a corpus passing the FR-20 boundary check '
        + 'alone is not enough to report on; this verb reads an already-replayed replay-output.json '
        + '(see the `run` verb, P4-T3), it never re-runs the engine itself.',
    );
  }

  const replayOutputPath = path.join(runDir, REPLAY_OUTPUT_FILENAME);
  const replayDocument = await readJsonOrThrow(replayOutputPath, `a ${REPLAY_OUTPUT_FILENAME} (from the \`run\` verb)`);

  if (replayDocument.corpusId !== corpusSummary.corpusId) {
    throw new UsageError(
      `--run replay output at "${replayOutputPath}" was produced from corpus id `
        + `"${replayDocument.corpusId}", which does not match --corpus "${corpusDir}"'s own `
        + `resolved corpus id "${corpusSummary.corpusId}" -- refusing to report metrics against a `
        + 'mismatched replay/corpus pairing.',
    );
  }

  let protocolDoc;
  const protocolPath = options?.protocol;
  if (protocolPath !== undefined) {
    if (typeof protocolPath !== 'string') {
      throw new UsageError('--protocol, if given, must be a file path');
    }
    protocolDoc = await readJsonOrThrow(protocolPath, 'a --protocol document');
  }

  // computeAgreementMeasures/evaluateProtocolQualification are also called (again, purely) inside
  // buildAgreementReportDocument -- invoked here first only so this verb's own stdout summary can
  // report a small preview without re-reading files; both calls are pure and idempotent.
  const measures = computeAgreementMeasures(replayDocument);
  const qualification = evaluateProtocolQualification(protocolDoc);

  const reportDocument = buildAgreementReportDocument({ replayDocument, protocolDoc });
  const { outputPath: reportPath } = await writeAgreementReport({ outputDir: runDir, document: reportDocument });

  const provenanceDocument = buildRunProvenanceDocument({ replayDocument });
  const { outputPath: provenancePath } = await writeRunProvenance({ outputDir: runDir, document: provenanceDocument });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    corpusId: corpusSummary.corpusId,
    labeledCaseCount: measures.caseCoverage.labeledCaseCount,
    totalCaseCount: measures.caseCoverage.totalCaseCount,
    protocolQualifying: qualification.qualifying,
    reportPath,
    provenancePath,
  }, null, 2)}\n`);
  return EXIT_OK;
}
