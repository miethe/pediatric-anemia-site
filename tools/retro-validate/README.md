# `retro-validate`

Deterministic, offline retrospective validation harness for the pediatric CDS engine. This is
**Phase 4** of the Evidence Foundry E1 build (`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md`,
phase detail: `evidence-foundry-e1-v1/phase-2-4-workstreams.md` §"Phase 4"). It implements ADR-0006:
replaying a version-pinned candidate build against a **fixtures-only** corpus (synthetic +
de-identified content ONLY, structurally enforced) and emitting **software-agreement** metrics --
never sensitivity, specificity, clinical performance, or any other clinical-validity claim.

**Status (as of P4-T2)**: `check-fixtures` is real -- it validates a corpus against
`schemas/fixture-corpus.schema.json`. `run` and `report` now call that same boundary check FIRST,
unconditionally, and refuse to proceed on an unchecked (no `--corpus`) or failing corpus -- but
beyond that gate they remain scaffold-only (`NotImplementedError` stubs) until P4-T3 (FR-19,
deterministic replay) and P4-T4 (FR-21, software-agreement metrics) land. Nothing in this tool is,
or may be read as, a clinical-validity, safety, diagnostic-performance, or IRB/DUA-compliance
claim.

## Ruling R6 -- what this tool is not

Per this plan's binding ruling R6: the retrospective validation harness in this repository operates
**only** on synthetic and de-identified fixtures. Running a real-data retrospective validation, and
any work that touches real patient data, is **gate G3** (data-source SPIKE verdict + data-partner
DUA) -- an external human-blocked state, out of scope for this tool and this plan entirely.
`docs/project_plans/SPIKEs/spike-007-retrospective-data-source.md` (P4-T9) is the charter for that
future, human-gated work; it is authored here but explicitly **not run**.

## CLI usage

```bash
node tools/retro-validate/cli.mjs --help

node tools/retro-validate/cli.mjs check-fixtures \
  --corpus tests/fixtures/ef-retro/valid-synthetic
# -> exit 0; prints a JSON summary (corpusId, schemaVersion, caseCount, provenanceClass)

node tools/retro-validate/cli.mjs check-fixtures \
  --corpus tests/fixtures/ef-retro/identifier-name
# -> exit 2 (EXIT_BOUNDARY); fail-closed, no output artifact, error names the rejected field

# `run`/`report` call check-fixtures FIRST (ADR-0006 binding clause, hardened P4-T2). A
# failing/unchecked corpus never reaches either verb's own logic:
node tools/retro-validate/cli.mjs run --corpus tests/fixtures/ef-retro/identifier-name ...
# -> exit 2 (EXIT_BOUNDARY), same as check-fixtures -- refuses to start
node tools/retro-validate/cli.mjs run --corpus <dir>
# -> exit 1 (EXIT_USAGE); --corpus is required, "unchecked" corpus refused before any other work

# Once a corpus PASSES the boundary check, both verbs remain scaffold-only until P4-T3/P4-T4 land
# (exit 1, NotImplementedError):
node tools/retro-validate/cli.mjs run --corpus <valid-dir> --candidate-digest <digest> --registry <path>
node tools/retro-validate/cli.mjs report --corpus <valid-dir> --run <dir> --protocol <doc>
```

## Module boundary

Five internal modules, matching this task's own scope description
(`(seam task owner, FR-19/FR-20/FR-21/FR-22, ADR-0006)`). One file (or small directory) per module,
same pattern `tools/rf-bundle-to-kb-pack/` already established for this repo's E0 tooling:

| Module | File(s) | Responsibility | Owning task | Depends on |
|---|---|---|---|---|
| CLI dispatch | `cli.mjs` | Arg parsing, `--help`, verb routing, top-level exit-code forwarding | P4-T1 (this task) | -- |
| Error taxonomy | `lib/errors.mjs` | 3-code exit taxonomy (OK/USAGE/BOUNDARY) + one error class per code | P4-T1 (this task) | -- |
| **Corpus** | `lib/corpus.mjs` | Reads/parses `<dir>/corpus.json`; loads (and caches) the fixture-corpus schema. Pure I/O + parse, no validation, no writes. | **P4-T1** (this task) | errors |
| **Boundary** | `lib/boundary.mjs` | `checkFixtures(corpusDir)` -- the schema-enforced (not procedural) de-identification gate (FR-20). Real schema-validation as of P4-T1; **P4-T2** hardened `run`/`report` (`lib/verbs/run.mjs`, `lib/verbs/report.mjs`) to call it FIRST, unconditionally, and refuse to proceed past an unchecked/failing corpus. | P4-T1 (initial), **P4-T2** (enforcement + hardening, landed) | corpus, errors |
| **Replay** | `lib/replay.mjs` (P4-T3) | Version-pinned deterministic engine replay (FR-19) -- resolves the candidate build via a registry digest, never "current tree"; canonical serialization; byte-identical double-run output. | **P4-T3** | boundary, corpus, errors |
| **Metrics** | `lib/metrics.mjs` (P4-T4), plus the discordance/adjudication model (P4-T5, FR-23) and the human-only protocol schema (P4-T6, FR-24) | Software-agreement `agreement-report.json` (5 OQ-5 measures) + `run-provenance.json` sidecar; discordance records; protocol-threshold gating. | **P4-T4** / **P4-T5** / **P4-T6** | replay, errors |
| **Access log** | `lib/access-log.mjs`, `access-log.jsonl` (P4-T7) | Append-only, structured audit trail of every `check-fixtures`/`run`/`report` invocation (FR-22) -- distinct from the review-record chain (no shared files, no shared schema). | **P4-T7** | boundary, errors |

**Verb-handler contract**: every file under `lib/verbs/` exports `async function run(options)` that
either resolves to a numeric process exit code (see `EXIT_*` in `lib/errors.mjs`) or throws a
`RetroValidateError` (or subclass). `cli.mjs` forwards a thrown `RetroValidateError`'s `exitCode`
verbatim -- it never remaps it. A non-`RetroValidateError` throw (a genuine bug) falls back to
`EXIT_USAGE` (1).

```
lib/verbs/check-fixtures.mjs  -- real (P4-T1): runs boundary.checkFixtures, prints a JSON summary
lib/verbs/run.mjs              -- boundary-gated (P4-T2: calls checkFixtures first) -> scaffold (P4-T1) -> real (P4-T3)
lib/verbs/report.mjs            -- boundary-gated (P4-T2: calls checkFixtures first) -> scaffold (P4-T1) -> real (P4-T4)
```

**Data flow** (once every module lands):

```
corpus.loadCorpusDocument()  ->  boundary.checkFixtures()  ->  replay (P4-T3)  ->  metrics (P4-T4/T5/T6)
        (P4-T1)                        (P4-T1/P4-T2)               (P4-T3)              (P4-T4..T6)
```

`run` and `report` each call `boundary.checkFixtures()` first and refuse to proceed on an
unchecked or failing corpus (ADR-0006 binding clause, hardened by P4-T2, landed) -- `check-fixtures` is
never bypassable by a later verb.

## The fixture-corpus schema (`schemas/fixture-corpus.schema.json`)

**Tool-local by design** -- this schema lives under `tools/retro-validate/schemas/`, not
`schemas/`, specifically so no Phase-4 task ever needs to touch the shared barrier file
`scripts/validate-kb.mjs` (this plan's parallel-workstream file-ownership rule: P2/P3/P4 stay
file-disjoint after Phase 1). It is validated with the repo's existing dependency-free validator,
`scripts/lib/json-schema-lite.mjs` -- the same reuse decision `tools/rf-bundle-to-kb-pack/README.md`
already documents for this zero-runtime-dependency repo.

**Structural de-identification boundary (FR-20)**:

- Every case requires a `provenance` marker in `{synthetic, deidentified}` -- there is no "real"/
  "identified" enum value; a case cannot be marked as real patient data and still validate.
- The corpus document requires a corpus-level `sourceAttestation` (`{ref, provenanceClass, ...}`).
- The `case` shape is a **closed property set** (`additionalProperties: false`): `caseId`,
  `provenance`, `sourceRef`, `input`, `referenceLabels`, `tags` -- nothing else. This structurally
  forbids an enumerated identifier-field denylist by omission, not by a hand-maintained blocklist
  keyword: `name`, `patientName`, `mrn`, `medicalRecordNumber`, `dob`, `dateOfBirth`, `address`,
  `contact`, `contactInfo`, `phone`, `email`, `ssn`, `socialSecurityNumber` (and any other
  identifier-shaped key) are all rejected -- none of them is in the allowed set.
- Independently of key name, `caseId`/`sourceRef`/the corpus `sourceAttestation.ref` are each
  rejected if their *value* matches an SSN-like pattern (`###-##-####`) -- a disguised identifier
  smuggled into an otherwise-permitted free-text field cannot ride along on a safe-looking key.
- The `input` (clinical-facts) object mirrors the closed top-level key set of the engine's own
  `schemas/patient-input.schema.json` (`patient`, `cbc`, `reticulocytes`, `symptoms`, `history`,
  `exam`, `labs`, `smear`) -- any other key, including an identifier field smuggled into the
  clinical-input object itself, is structurally rejected at this boundary, one layer before the
  harness ever reaches the engine's own patient-input validation (P4-T3).

**E1 corpus content is synthetic + de-identified only.** There is no schema path, CLI flag, or code
path in this tool that admits real, identified patient data.

## Design decisions

### No `yaml`/JSON-Schema npm dependency

Same zero-runtime-dependency posture `tools/rf-bundle-to-kb-pack/README.md` documents ("Design
decisions" section there) and the repo's actual `package.json` reflects (no `dependencies` block).
This tool's schema is plain JSON (no YAML needed), validated with `scripts/lib/json-schema-lite.mjs`
-- reused, not reimplemented.

### Zero network / zero LLM, structurally

No file in this tool imports `node:http`, `node:https`, `node:dgram`, `fetch`, or any AI/model SDK.
`tests/ef-retro-corpus.test.mjs` asserts this both structurally (source-import scan) and at runtime
(network-hook spies during a live `check-fixtures` call) -- the same two-layer proof
`tests/ef-converter-invariants.test.mjs` uses for `tools/rf-bundle-to-kb-pack/`.

## Directory layout

```
tools/retro-validate/
  cli.mjs                        verb dispatch, --help, top-level exit-code handling
  README.md                      this file
  access-log.jsonl                 append-only audit trail (P4-T7; does not exist until then)
  schemas/
    fixture-corpus.schema.json      tool-local fixture-corpus schema (P4-T1, FR-20)
    protocol.schema.json             human-only prespecified-protocol schema (P4-T6; does not exist until then)
  lib/
    errors.mjs                        3-code exit taxonomy (P4-T1)
    corpus.mjs                         CORPUS module: load/parse (P4-T1)
    boundary.mjs                        BOUNDARY module: schema-enforced gate (P4-T1 / P4-T2)
    replay.mjs                           REPLAY module (P4-T3; does not exist until then)
    metrics.mjs                           METRICS module (P4-T4/T5/T6; does not exist until then)
    access-log.mjs                         ACCESS-LOG module (P4-T7; does not exist until then)
    verbs/
      check-fixtures.mjs                    `check-fixtures` verb (P4-T1, real)
      run.mjs                                 `run` verb (P4-T2: boundary-gated) -> scaffold (P4-T1) -> real (P4-T3)
      report.mjs                               `report` verb (P4-T2: boundary-gated) -> scaffold (P4-T1) -> real (P4-T4)
```

Corpus fixtures for tests live under `tests/fixtures/ef-retro/<corpus-name>/corpus.json` (never
committed real patient data -- synthetic content only, per this repo's own hard guardrails).
Seeded rejection-class fixtures (P4-T1/P4-T2): `identifier-name` / `identifier-mrn` /
`identifier-dob` / `identifier-address` / `identifier-contact` / `identifier-ssn-pattern`
(identifier-bearing case, >=6 classes), `missing-provenance` (case lacking its provenance marker),
`missing-source-attestation` (corpus lacking corpus-level `sourceAttestation`, P4-T2) -- each fails
closed with a distinct, class-identifiable error (`tests/ef-retro-boundary.test.mjs`).
