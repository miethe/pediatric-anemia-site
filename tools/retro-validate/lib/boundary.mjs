// tools/retro-validate/lib/boundary.mjs -- BOUNDARY module (P4-T1 initial implementation; P4-T2
// hardens it into the enforced gate every other verb calls first, FR-20, ADR-0006 binding
// boundary clause).
//
// `checkFixtures(corpusDir)` is the schema-enforced (not procedural) de-identification boundary:
// it loads a corpus document and validates it against `schemas/fixture-corpus.schema.json` (the
// CORPUS module, `./corpus.mjs`) using the repo's existing dependency-free validator
// (`scripts/lib/json-schema-lite.mjs` -- same reuse decision `tools/rf-bundle-to-kb-pack`'s README
// already documents: this is a zero-runtime-dependency repo, adding `ajv` would change its
// supply-chain posture for no gain the pinned schema does not already give us). Any violation --
// an identifier-bearing case (rejected via the schema's closed `case` property set), a case
// missing its `provenance` marker, or a corpus missing `sourceAttestation` -- throws a
// `BoundaryError` (fail-closed, non-zero exit, no partial output). Nothing under this file writes
// any output artifact, so there is no "partial output" for a rejection to leave behind.
//
// P4-T1 scope: real schema-validation enforcement, reachable via the `check-fixtures` verb.
// P4-T2 scope (per phase-4-progress.md): wire this as the gate `run`/`report` call FIRST and
// refuse to proceed past an unchecked/failing corpus (call-order test), plus seeded fixtures
// proving each of the 3 rejection classes fails closed with a distinct, class-identifiable error.

import { validate } from '../../../scripts/lib/json-schema-lite.mjs';
import { loadFixtureCorpusSchema, loadCorpusDocument } from './corpus.mjs';
import { BoundaryError } from './errors.mjs';

/**
 * @typedef {object} CorpusCheckSummary
 * @property {string} corpusId
 * @property {number} schemaVersion
 * @property {number} caseCount
 * @property {'synthetic'|'deidentified'} provenanceClass corpus-level sourceAttestation.provenanceClass
 */

/**
 * Loads `<corpusDir>/corpus.json` and validates it against the fixture-corpus schema. Throws
 * `BoundaryError` fail-closed on ANY schema violation -- never a partial/best-effort pass.
 * @param {string} corpusDir
 * @returns {Promise<CorpusCheckSummary>}
 * @throws {import('./errors.mjs').UsageError} unreadable/unparsable corpus document
 * @throws {BoundaryError} the corpus fails the FR-20 structural de-identification boundary
 */
export async function checkFixtures(corpusDir) {
  const schema = await loadFixtureCorpusSchema();
  const { docPath, parsed } = await loadCorpusDocument(corpusDir);
  const errors = validate(schema, parsed);
  if (errors.length > 0) {
    const detail = errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
    throw new BoundaryError(
      `corpus "${docPath}" fails the fixture-corpus structural de-identification boundary (FR-20) `
        + `-- ${errors.length} violation(s), fail-closed, no partial output:\n${detail}`,
    );
  }
  return {
    corpusId: parsed.corpusId,
    schemaVersion: parsed.schemaVersion,
    caseCount: parsed.cases.length,
    provenanceClass: parsed.sourceAttestation.provenanceClass,
  };
}
