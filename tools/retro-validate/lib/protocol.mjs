// tools/retro-validate/lib/protocol.mjs -- PROTOCOL module (P4-T6, Evidence Foundry E1 Phase 4,
// FR-24, ADR-0006). Owns loading/validating a prespecified validation protocol document against
// this tool's own `schemas/protocol.schema.json`: the STRUCTURAL (not procedural) guarantee that
// every threshold field a protocol document may declare is `const: null` (TBD-by-named-humans) --
// software can never author, invent, or default a clinical threshold into this document. A
// populated-threshold (or otherwise non-conforming) document fails schema validation fail-closed,
// via `assertProtocolShape` below, BEFORE `lib/verbs/report.mjs` computes or writes anything.
//
// Same reuse decision `lib/boundary.mjs`/`lib/corpus.mjs` already document for the fixture-corpus
// schema: validated with the repo's existing dependency-free validator
// (`scripts/lib/json-schema-lite.mjs`), not a new `ajv` dependency.
//
// This gate is layered ON TOP OF, not instead of, `lib/metrics.mjs#evaluateProtocolQualification`'s
// own defensive posture (P4-T4, landed BEFORE this schema existed): that function is structurally
// incapable of ever returning `qualifying: true`, EVEN if this schema's own gate were somehow
// bypassed (e.g. a caller of `buildAgreementReportDocument` that never routes through
// `lib/verbs/report.mjs` and this module's `assertProtocolShape`, such as a unit test exercising
// the pure metrics functions directly). Two independent guarantees; neither depends on the other
// holding.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../../../scripts/lib/json-schema-lite.mjs';
import { ProtocolError } from './errors.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to this tool's own protocol schema (tool-local by design, ADR-0006 -- same
 * rationale as `corpus.mjs#FIXTURE_CORPUS_SCHEMA_PATH`). */
export const PROTOCOL_SCHEMA_PATH = path.join(MODULE_DIR, '..', 'schemas', 'protocol.schema.json');

let cachedSchema;

/**
 * Loads and parses `schemas/protocol.schema.json` once per process (cached thereafter -- same
 * posture `corpus.mjs#loadFixtureCorpusSchema` already establishes for the fixture-corpus schema).
 * @returns {Promise<object>} the parsed JSON Schema document
 */
export async function loadProtocolSchema() {
  if (!cachedSchema) {
    const raw = await readFile(PROTOCOL_SCHEMA_PATH, 'utf8');
    cachedSchema = JSON.parse(raw);
  }
  return cachedSchema;
}

/**
 * Validates `protocolDoc` against `schemas/protocol.schema.json`. Pure with respect to its input
 * (the schema load is the only I/O, and is cached) -- throws nothing itself; callers that need the
 * fail-closed FR-24 gate use `assertProtocolShape` below.
 * @param {unknown} protocolDoc
 * @returns {Promise<{path: string, message: string}[]>} empty array means the document validates
 */
export async function validateProtocolDocument(protocolDoc) {
  const schema = await loadProtocolSchema();
  return validate(schema, protocolDoc);
}

/**
 * Fail-closed structural gate (FR-24): throws `ProtocolError` if `protocolDoc` does not validate
 * against `schemas/protocol.schema.json` -- in particular, ANY document declaring a non-null value
 * where the schema requires `const: null`, a populated-threshold document being the paradigm case.
 * A `report` invocation given a rejected `--protocol` document writes NO output whatsoever (this
 * call happens in `lib/verbs/report.mjs` before either `agreement-report.json` or
 * `run-provenance.json` is ever written).
 * @param {unknown} protocolDoc
 * @param {{ describe?: string }} [options] `describe` names the document in the thrown message
 *   (e.g. the `--protocol` path it was read from); defaults to a generic description.
 * @returns {Promise<void>}
 * @throws {ProtocolError} one or more schema violations
 */
export async function assertProtocolShape(protocolDoc, options = {}) {
  const describe = options.describe ?? 'the supplied --protocol document';
  const errors = await validateProtocolDocument(protocolDoc);
  if (errors.length > 0) {
    const detail = errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
    throw new ProtocolError(
      `${describe} fails the FR-24 prespecified-protocol structural shape `
        + `(schemas/protocol.schema.json) -- ${errors.length} violation(s), fail-closed, no `
        + `report/provenance written:\n${detail}\n`
        + 'Every threshold field in this schema is `const: null` (TBD-by-named-humans) -- Evidence '
        + 'Foundry E1 admits no protocol document, however authored, that declares a real threshold '
        + 'value; software never invents or defaults one.',
    );
  }
}
