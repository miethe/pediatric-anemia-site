// tools/retro-validate/lib/boundary.mjs -- BOUNDARY module (P4-T1 initial implementation; P4-T2
// hardens it into the enforced gate every other verb calls first, FR-20, ADR-0006 binding
// boundary clause; hardened again in the P4 fix cycle below).
//
// `checkFixtures(corpusDir)` is the TWO-LAYER de-identification boundary:
//
//   1. Schema layer: loads a corpus document and validates it against
//      `schemas/fixture-corpus.schema.json` (the CORPUS module, `./corpus.mjs`) using the repo's
//      existing dependency-free validator (`scripts/lib/json-schema-lite.mjs` -- same reuse
//      decision `tools/rf-bundle-to-kb-pack`'s README already documents: this is a
//      zero-runtime-dependency repo, adding `ajv` would change its supply-chain posture for no
//      gain the pinned schema does not already give us). Structural closure: an identifier-bearing
//      case (rejected via the schema's closed `case` property set, and -- as of the P4 fix cycle
//      below -- the closed, recursively-mirrored `clinicalInput` sub-object shapes too), a case
//      missing its `provenance` marker, or a corpus missing `sourceAttestation` all fail here.
//   2. Identifier-denylist layer (`./identifier-denylist.mjs`, added in the P4 fix cycle after a
//      Codex second-opinion review found two BLOCKERs the schema layer alone could not close: an
//      unrestricted-prose `description` field validating cleanly with synthetic name/MRN/DOB
//      markers inside it, and nested clinical `input` sub-objects that admitted arbitrary
//      identifier-shaped keys because their schema shape was `true` -- unrestricted -- rather than
//      a closed whitelist). `scanForIdentifiers()` recursively walks the ENTIRE parsed document
//      for identifier-shaped keys and PHI-marker value patterns, independent of the schema's own
//      shape -- see that module's own header for the full rationale and the "one sanctioned
//      procedural exception" framing `tests/ef-retro-boundary.test.mjs` now pins it to.
//
// Both layers run unconditionally, every call, and their violations are combined into ONE
// `BoundaryError` (fail-closed, non-zero exit, no partial output) -- neither layer is skipped if
// the other already failed, and neither is a substitute for the other: the schema layer is the
// primary, declarative, machine-checkable shape contract; the denylist layer is the backstop for
// exactly the two classes of content (free prose, and intentionally-open wire-compatible boolean-
// map key names) the schema layer structurally cannot reach. Nothing under this file writes any
// output artifact, so there is no "partial output" for a rejection to leave behind.
//
// P4-T1 scope: real schema-validation enforcement, reachable via the `check-fixtures` verb.
// P4-T2 scope (landed): `lib/verbs/run.mjs` and `lib/verbs/report.mjs` now call this function
// FIRST, unconditionally, and refuse to proceed past an unchecked/failing corpus -- see those
// files' headers. Seeded fixtures proving each of the 3 rejection classes (identifier-bearing
// case, case missing `provenance`, corpus missing `sourceAttestation`) fail closed with a
// distinct, class-identifiable error live under `tests/fixtures/ef-retro/` and are exercised by
// `tests/ef-retro-boundary.test.mjs` (call-order + rejection-class proofs) and
// `tests/ef-retro-corpus.test.mjs` (schema/CORPUS-module-level proofs). The P4 fix cycle added
// seeded fixtures proving both BLOCKER-shaped corpora (a free-prose PHI marker, an identifier
// smuggled into a nested clinical sub-object) now fail closed too -- see both test files' newest
// tests.

import { validate } from '../../../scripts/lib/json-schema-lite.mjs';
import { loadFixtureCorpusSchema, loadCorpusDocument } from './corpus.mjs';
import { scanForIdentifiers } from './identifier-denylist.mjs';
import { BoundaryError } from './errors.mjs';

/**
 * @typedef {object} CorpusCheckSummary
 * @property {string} corpusId
 * @property {number} schemaVersion
 * @property {number} caseCount
 * @property {'synthetic'|'deidentified'} provenanceClass corpus-level sourceAttestation.provenanceClass
 */

/**
 * Loads `<corpusDir>/corpus.json` and validates it against BOTH boundary layers: the
 * fixture-corpus schema (structural) and the identifier-denylist scan (procedural). Throws
 * `BoundaryError` fail-closed on ANY violation from EITHER layer -- never a partial/best-effort
 * pass, and never short-circuited (a schema failure does not skip the denylist scan, or vice
 * versa; both always run and their violations are reported together).
 * @param {string} corpusDir
 * @returns {Promise<CorpusCheckSummary>}
 * @throws {import('./errors.mjs').UsageError} unreadable/unparsable corpus document
 * @throws {BoundaryError} the corpus fails the FR-20 structural and/or procedural de-identification boundary
 */
export async function checkFixtures(corpusDir) {
  const schema = await loadFixtureCorpusSchema();
  const { docPath, parsed } = await loadCorpusDocument(corpusDir);
  const schemaErrors = validate(schema, parsed);
  const denylistViolations = scanForIdentifiers(parsed);
  const errors = [...schemaErrors, ...denylistViolations];
  if (errors.length > 0) {
    const detail = errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
    throw new BoundaryError(
      `corpus "${docPath}" fails the fixture-corpus structural de-identification boundary (FR-20) `
        + `-- ${errors.length} violation(s) across the schema layer (${schemaErrors.length}) and `
        + `the identifier-denylist layer (${denylistViolations.length}), fail-closed, no partial `
        + `output:\n${detail}`,
    );
  }
  return {
    corpusId: parsed.corpusId,
    schemaVersion: parsed.schemaVersion,
    caseCount: parsed.cases.length,
    provenanceClass: parsed.sourceAttestation.provenanceClass,
  };
}
