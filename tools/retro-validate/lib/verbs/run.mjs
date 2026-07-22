// tools/retro-validate/lib/verbs/run.mjs -- `run` verb. Real as of P4-T3 (FR-19, version-pinned
// deterministic replay):
//
//   run --corpus <dir> --candidate-digest <registry digest> --registry <path>
//
// ADR-0006 binding clause (P4-T2): this verb calls the BOUNDARY module
// (`../boundary.mjs#checkFixtures`) FIRST, unconditionally, before any of its own logic --
// `check-fixtures` is the structural gate every other verb calls first, and it is never
// bypassable by a later verb. A corpus that is unchecked (no `--corpus` given) or failing (any
// FR-20 violation) causes this verb to refuse to start: a missing `--corpus` throws `UsageError`,
// and a failing corpus throws `BoundaryError` (fail-closed, non-zero exit, no partial output) --
// in both cases BEFORE any replay work below is ever reached. This call site does not move.
//
// P4-T3: once the boundary gate clears, this verb requires BOTH `--candidate-digest` and
// `--registry` (a corpus passing FR-20 alone is not sufficient to replay -- there is still no
// candidate identified). It then delegates to the REPLAY module (`../replay.mjs`):
// `resolveCandidate()` (version-pinned candidate resolution, fails closed on any digest
// mismatch/drift -- see that function's own header for the full fail-closed taxonomy), then
// `replayCorpus()` (deterministic replay: sorted case order, canonical serialization, no
// timestamps in the written bytes), then `writeReplayOutput()` writes the ONE artifact this verb
// produces, `replay-output.json`, to a deterministic, digest-derived output directory (see
// `replay.mjs#defaultOutputDir` -- not a CLI flag; this verb's signature is exactly the 3 flags
// above). A failure at ANY stage (boundary, usage, or candidate resolution) leaves zero output on
// disk -- `writeReplayOutput` is the LAST statement in the success path, never called speculatively.
//
// P4-T7 (FR-22, ADR-0006 audit clause): the FIRST statement of `run()` below unconditionally
// appends one entry to the access log (`../access-log.mjs#logAccessAttempt`) -- BEFORE even the
// boundary gate, so an unchecked/failing/candidate-resolution-failed invocation is audited exactly
// like a successful one. This does not move the boundary gate's own call-site (still the first
// REAL logic after the usage check) -- see `tests/ef-retro-boundary.test.mjs` for the call-order
// proof that remains true unchanged.

import { checkFixtures } from '../boundary.mjs';
import { logAccessAttempt } from '../access-log.mjs';
import { loadCorpusDocument } from '../corpus.mjs';
import {
  resolveCandidate,
  replayCorpus,
  writeReplayOutput,
  defaultOutputDir,
} from '../replay.mjs';
import { EXIT_OK, UsageError } from '../errors.mjs';

/**
 * @param {{ corpus?: string, candidateDigest?: string, registry?: string, actor?: string, purpose?: string, accessLogPath?: string }} options
 * @returns {Promise<number>} process exit code (EXIT_OK on success)
 * @throws {UsageError} no `--corpus` given, or the boundary check passed but `--candidate-digest`/`--registry` are missing
 * @throws {import('../errors.mjs').BoundaryError} the corpus fails the FR-20 boundary (checked FIRST)
 * @throws {import('../errors.mjs').RegistryError} candidate resolution failed (see `../replay.mjs#resolveCandidate`)
 */
export async function run(options) {
  await logAccessAttempt('run', options);
  const corpusDir = options?.corpus;
  if (!corpusDir || typeof corpusDir !== 'string') {
    throw new UsageError('run requires --corpus <dir>');
  }
  // ADR-0006 binding clause: the boundary gate runs FIRST, unconditionally -- a failing or
  // unchecked corpus never reaches this verb's own logic below.
  await checkFixtures(corpusDir);

  const registryPath = options?.registry;
  const candidateDigest = options?.candidateDigest;
  if (!registryPath || typeof registryPath !== 'string' || !candidateDigest || typeof candidateDigest !== 'string') {
    throw new UsageError(
      'run requires --candidate-digest <registry digest> and --registry <path> -- a corpus '
        + 'passing the FR-20 boundary check alone is not enough to replay; this tool never runs '
        + 'against an unpinned candidate.',
    );
  }

  const candidate = await resolveCandidate({ registryPath, candidateDigest });
  const { parsed: corpusDoc } = await loadCorpusDocument(corpusDir);
  const document = replayCorpus({ corpusDoc, candidate });
  const outputDir = defaultOutputDir({ corpusId: corpusDoc.corpusId, candidateDigest });
  const { outputPath } = await writeReplayOutput({ outputDir, document });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    corpusId: corpusDoc.corpusId,
    moduleId: candidate.moduleId,
    candidateVersion: candidate.version,
    candidateDigest,
    caseCount: document.caseCount,
    outputPath,
  }, null, 2)}\n`);
  return EXIT_OK;
}
