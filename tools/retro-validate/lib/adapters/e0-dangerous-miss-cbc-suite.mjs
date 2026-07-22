// tools/retro-validate/lib/adapters/e0-dangerous-miss-cbc-suite.mjs -- P4-T8 (FR-26, PRD OQ-6):
// deterministic adapter promoting E0's existing dangerous-miss fixture
// (`tests/ef-cbc_suite_v1-dangerous-miss.test.mjs`) into a harness fixture-corpus document
// (`schemas/../schemas/fixture-corpus.schema.json`, P4-T1).
//
// PRD OQ-6 resolution (binding): "promote via a deterministic adapter (P4-T8) wrapping the E0
// fixtures in the harness envelope -- one source of truth, no content mutation, stability pinned
// by test. Re-derivation was rejected as a silent-divergence risk." This file is that adapter.
//
// -----------------------------------------------------------------------------------------------
// Why this file reads the E0 test file's SOURCE TEXT instead of `import()`-ing it
// -----------------------------------------------------------------------------------------------
//
// `tests/ef-cbc_suite_v1-dangerous-miss.test.mjs` is a `node:test` file: importing it as an ES
// module executes its top-level `test(...)` registrations as a side effect (proven at this task's
// authoring time -- a plain `import()` of that file, run outside `node --test`, immediately prints
// TAP output for both of its tests). Doing that from inside this tool would (a) make a "build the
// corpus" call silently re-run someone else's engine assertions, and (b) under `npm test` -- where
// this adapter's OWN test file and the E0 file are both matched by the `tests/*.test.mjs` glob and
// may run in separate worker/child-process test contexts -- risks a second, out-of-context
// execution of the E0 suite's `test()` blocks with no isolated access-log/tmp-dir setup of its own.
//
// Instead, this module reads the E0 file's raw bytes and mechanically extracts exactly two things
// via brace-balanced text extraction + a small, well-known-marker regex -- NOT a hand-copied
// literal duplicate. This is what makes the adapter track upstream drift automatically (PRD OQ-6's
// "one source of truth, no content mutation" requirement): if a human edits
// `dangerousMissInput()`'s body, or renames either matched id, in the E0 file, the very next
// `buildE0DangerousMissCorpus()` call reflects that change -- there is no second, independently
// maintained copy of the clinical input to fall out of sync.
//
//   1. `dangerousMissInput()`'s function body (extracted verbatim, brace-balanced, then evaluated
//      with `new Function` to get back a real JS object -- the exact same value the E0 test itself
//      calls `assessCbcSuite()` with). Zero content mutation: no key is added, removed, renamed, or
//      reordered relative to what the E0 file's own literal says.
//   2. The two engine-output ids the E0 test's own assertions already key off of --
//      `CBC-MARROW-REDFLAG-001` (`result.alerts.find((entry) => entry.id === '...')`) and
//      `benign-ethnic-neutropenia-differential-pattern`
//      (`result.rankedDifferential.find((entry) => entry.id === '...')`) -- read via regex against
//      those exact call-site shapes, not re-typed by hand.
//
// Both extraction steps fail closed (`AdapterExtractionError`, distinct message per marker) if the
// expected shape is not found -- an upstream refactor of the E0 file that this adapter cannot
// follow is a loud build/test failure here, never a silently stale or guessed corpus.
//
// This module performs no network I/O and invokes no generative model -- it is a pure text-extract
// + JSON-object-literal evaluation over one already-committed, offline file.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalStringify } from '../replay.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

/** The single E0 source file this adapter promotes -- the PRD OQ-6 "one source of truth". */
export const E0_SOURCE_PATH = path.join(REPO_ROOT, 'tests', 'ef-cbc_suite_v1-dangerous-miss.test.mjs');
/** Relative form recorded in the generated corpus's `sourceAttestation`/`sourceRef` fields. */
export const E0_SOURCE_RELATIVE_PATH = 'tests/ef-cbc_suite_v1-dangerous-miss.test.mjs';

/** Where this adapter's materialized, committed corpus fixture lives (regression lane input). */
export const ADAPTER_CORPUS_DIR = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'ef-retro', 'e0-dangerous-miss-cbc-suite-v1',
);
export const ADAPTER_CORPUS_ID = 'e0-dangerous-miss-cbc-suite-v1';
export const ADAPTER_CASE_ID = 'e0-dangerous-miss-marrow-redflag-vs-benign-neutropenia';

const FUNCTION_MARKER = 'function dangerousMissInput() {';
// Matches the exact E0 assertion call-site shape `result.alerts.find((entry) => entry.id === 'ID')`.
const ALERT_ID_PATTERN = /result\.alerts\.find\(\s*\(entry\)\s*=>\s*entry\.id\s*===\s*'([^']+)'\s*,?\s*\)/;
// Matches the exact E0 assertion call-site shape `result.rankedDifferential.find((entry) => entry.id === 'ID')`.
const CANDIDATE_ID_PATTERN = /result\.rankedDifferential\.find\(\s*\(entry\)\s*=>\s*entry\.id\s*===\s*'([^']+)'\s*,?\s*\)/;

/** Thrown when this adapter's known-marker extraction cannot follow the E0 source's current shape. */
export class AdapterExtractionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdapterExtractionError';
  }
}

/**
 * Extracts the brace-balanced block of `source` starting at its first occurrence of `marker`
 * (which itself must end in an opening `{`-bearing line, but the search itself starts from
 * `marker`'s own start so the returned block includes it). Pure string scanning, no regex
 * backtracking risk, no eval.
 * @param {string} source
 * @param {string} marker
 * @returns {string} the matched block, from `marker`'s first char through its matching `}`
 * @throws {AdapterExtractionError}
 */
function extractBalancedBlock(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new AdapterExtractionError(
      `could not locate "${marker}" in ${E0_SOURCE_RELATIVE_PATH} -- the upstream E0 fixture's `
        + 'shape has changed in a way this adapter cannot follow; refusing to guess at its content.',
    );
  }
  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) {
    throw new AdapterExtractionError(
      `found "${marker}" in ${E0_SOURCE_RELATIVE_PATH} but no opening brace followed it.`,
    );
  }
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  throw new AdapterExtractionError(
    `unbalanced braces while extracting "${marker}" from ${E0_SOURCE_RELATIVE_PATH}.`,
  );
}

/**
 * Reads `sourcePath` (defaults to the real E0 file), and mechanically extracts the
 * `dangerousMissInput()` literal plus the two engine-output ids the E0 test's own assertions key
 * off of. `sourcePath` is overridable ONLY for this adapter's own drift-simulation test -- callers
 * building the real corpus must never pass it.
 * @param {{ sourcePath?: string }} [options]
 * @returns {Promise<{ input: object, alertId: string, candidateId: string, sourceText: string }>}
 * @throws {AdapterExtractionError}
 */
export async function loadE0DangerousMissFixture({ sourcePath = E0_SOURCE_PATH } = {}) {
  const source = await readFile(sourcePath, 'utf8');

  const fnSource = extractBalancedBlock(source, FUNCTION_MARKER);
  let input;
  try {
    // eslint-disable-next-line no-new-func -- evaluating an extracted, brace-balanced JS object
    // literal from a single committed, offline test file; no external input reaches this call.
    const factory = new Function(`'use strict';\n${fnSource}\nreturn dangerousMissInput();`);
    input = factory();
  } catch (err) {
    throw new AdapterExtractionError(
      `failed to evaluate the extracted dangerousMissInput() body from `
        + `${E0_SOURCE_RELATIVE_PATH}: ${err.message}`,
    );
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AdapterExtractionError(
      `dangerousMissInput() extracted from ${E0_SOURCE_RELATIVE_PATH} did not evaluate to a plain `
        + 'clinical-input object.',
    );
  }

  const alertMatch = source.match(ALERT_ID_PATTERN);
  if (!alertMatch) {
    throw new AdapterExtractionError(
      `could not locate the expected "result.alerts.find(...)" alert-id assertion pattern in `
        + `${E0_SOURCE_RELATIVE_PATH}.`,
    );
  }
  const candidateMatch = source.match(CANDIDATE_ID_PATTERN);
  if (!candidateMatch) {
    throw new AdapterExtractionError(
      `could not locate the expected "result.rankedDifferential.find(...)" candidate-id assertion `
        + `pattern in ${E0_SOURCE_RELATIVE_PATH}.`,
    );
  }

  return {
    input,
    alertId: alertMatch[1],
    candidateId: candidateMatch[1],
    sourceText: source,
  };
}

/**
 * Builds the full fixture-corpus document (P4-T1 schema shape) wrapping the E0 dangerous-miss
 * fixture. `input`/`alertId`/`candidateId` are the ONLY fields sourced from the E0 file; every
 * other field here is this adapter's own envelope (corpus id, provenance marker, source
 * attestation, tags) -- the "envelope-only diff" a byte-level content-equality test can isolate.
 * @param {{ sourcePath?: string }} [options] see `loadE0DangerousMissFixture`
 * @returns {Promise<object>} a document shaped per `schemas/fixture-corpus.schema.json`
 * @throws {AdapterExtractionError}
 */
export async function buildE0DangerousMissCorpus(options = {}) {
  const { input, alertId, candidateId } = await loadE0DangerousMissFixture(options);

  return {
    schemaVersion: 1,
    corpusId: ADAPTER_CORPUS_ID,
    description: 'P4-T8 (FR-26, PRD OQ-6) deterministic promotion of E0\'s '
      + `${E0_SOURCE_RELATIVE_PATH} dangerous-miss fixture into the retro-validate harness's `
      + 'fixture-corpus envelope. Zero content mutation: `input` below is extracted verbatim from '
      + 'the E0 source\'s own dangerousMissInput() literal, not re-derived or hand-copied -- the '
      + 'E0 test file remains the single source of truth. Proves the marrow-red-flag safety alert '
      + '(CBC-MARROW-REDFLAG-001) activates and is not suppressed by a co-occurring benign '
      + 'neutropenia-differential candidate match (benign-ethnic-neutropenia-differential-pattern) '
      + '-- the "benign high-scoring candidate distracting from a higher-severity alert" hazard '
      + '(`02 §5.4`).',
    sourceAttestation: {
      ref: E0_SOURCE_RELATIVE_PATH,
      provenanceClass: 'synthetic',
    },
    cases: [
      {
        caseId: ADAPTER_CASE_ID,
        provenance: 'synthetic',
        sourceRef: `${E0_SOURCE_RELATIVE_PATH}#dangerousMissInput`,
        input,
        referenceLabels: {
          candidatePatternIds: [candidateId],
          safetyFlagIds: [alertId],
          missingDataPromptIds: [],
          dangerousMissExpected: true,
        },
        tags: ['dangerous-miss-regression', 'e0-adapter', 'cbc_suite_v1'],
      },
    ],
  };
}

/**
 * Canonical (sorted-key, deterministic) bytes for a built corpus document -- reuses
 * `lib/replay.mjs#canonicalStringify` rather than re-implementing serialization, and is the exact
 * byte form written to `<ADAPTER_CORPUS_DIR>/corpus.json` and pinned by this adapter's stability
 * test.
 * @param {object} corpusDoc
 * @returns {string}
 */
export function canonicalCorpusBytes(corpusDoc) {
  return canonicalStringify(corpusDoc);
}

// Only run when invoked directly (`node tools/retro-validate/lib/adapters/e0-dangerous-miss-cbc-suite.mjs`),
// never as a side effect of import -- regenerates the committed fixture at ADAPTER_CORPUS_DIR/corpus.json
// from the live E0 source. A human re-runs this deliberately (and reviews the resulting diff) when
// the E0 fixture intentionally changes; nothing in `npm test` or the CLI calls this automatically.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const doc = await buildE0DangerousMissCorpus();
  await mkdir(ADAPTER_CORPUS_DIR, { recursive: true });
  const outPath = path.join(ADAPTER_CORPUS_DIR, 'corpus.json');
  await writeFile(outPath, canonicalCorpusBytes(doc), 'utf8');
  process.stdout.write(`wrote ${outPath}\n`);
}
