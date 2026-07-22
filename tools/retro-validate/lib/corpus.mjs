// tools/retro-validate/lib/corpus.mjs -- CORPUS module (P4-T1, FR-19/FR-20, ADR-0006). Owns
// reading and parsing a fixture corpus off disk, and lazily loading this tool's own schema. Pure
// I/O + parse -- it validates nothing itself (that is `lib/boundary.mjs`'s job, the BOUNDARY
// module) and it never writes to disk.
//
// Layout convention: `--corpus <dir>` names a directory whose single fixture-corpus document lives
// at `<dir>/corpus.json`, matching `schemas/fixture-corpus.schema.json`'s shape exactly
// (`{ schemaVersion, corpusId, description?, sourceAttestation, cases[] }`).

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { UsageError } from './errors.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to this tool's own fixture-corpus schema (tool-local by design, ADR-0006). */
export const FIXTURE_CORPUS_SCHEMA_PATH = path.join(MODULE_DIR, '..', 'schemas', 'fixture-corpus.schema.json');

/** Filename a corpus directory must contain. */
export const CORPUS_DOCUMENT_FILENAME = 'corpus.json';

let cachedSchema;

/**
 * Loads and parses `schemas/fixture-corpus.schema.json` once per process (cached thereafter --
 * the schema is committed, static content; re-reading it per call would be pure overhead).
 * @returns {Promise<object>} the parsed JSON Schema document
 */
export async function loadFixtureCorpusSchema() {
  if (!cachedSchema) {
    const raw = await readFile(FIXTURE_CORPUS_SCHEMA_PATH, 'utf8');
    cachedSchema = JSON.parse(raw);
  }
  return cachedSchema;
}

/**
 * Reads and JSON-parses `<corpusDir>/corpus.json`. Performs no schema validation -- callers that
 * need the FR-20 boundary check must use `lib/boundary.mjs#checkFixtures` instead.
 * @param {string} corpusDir directory expected to contain `corpus.json`
 * @returns {Promise<{ docPath: string, parsed: unknown }>}
 * @throws {UsageError} if the directory has no `corpus.json`, or its content is not valid JSON
 */
export async function loadCorpusDocument(corpusDir) {
  if (!corpusDir || typeof corpusDir !== 'string') {
    throw new UsageError('a corpus directory path is required (--corpus <dir>)');
  }
  const docPath = path.join(corpusDir, CORPUS_DOCUMENT_FILENAME);
  let raw;
  try {
    raw = await readFile(docPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new UsageError(`no ${CORPUS_DOCUMENT_FILENAME} found under corpus directory "${corpusDir}"`);
    }
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new UsageError(`"${docPath}" is not valid JSON: ${err.message}`);
  }
  return { docPath, parsed };
}
