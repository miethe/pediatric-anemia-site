# `retro-validate`

Deterministic, offline retrospective validation harness for the pediatric CDS engine. This is
**Phase 4** of the Evidence Foundry E1 build (`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md`,
phase detail: `evidence-foundry-e1-v1/phase-2-4-workstreams.md` §"Phase 4"). It implements ADR-0006:
replaying a version-pinned candidate build against a **fixtures-only** corpus (synthetic +
de-identified content ONLY, structurally enforced) and emitting **software-agreement** metrics --
never sensitivity, specificity, clinical performance, or any other clinical-validity claim.

**Status (as of P4-T3)**: `check-fixtures` is real -- it validates a corpus against
`schemas/fixture-corpus.schema.json`. `run` and `report` both call that same boundary check FIRST,
unconditionally, and refuse to proceed on an unchecked (no `--corpus`) or failing corpus. `run`
itself is now real (FR-19, version-pinned deterministic replay, landed this task): it resolves a
candidate build exclusively via a registry-entry digest match (never "current tree"), replays every
corpus case through `src/engine.js#assess()` using that pinned candidate's `rules`/`candidates`,
and writes a canonical, sorted, timestamp-free `replay-output.json` -- two runs over an identical
`(corpus, candidate-digest, registry)` triple are byte-identical. `report` remains scaffold-only
(`NotImplementedError`) until P4-T4 (FR-21, software-agreement metrics) lands. All three verbs also
access-log every invocation, success or not (FR-22, `lib/access-log.mjs`, see below) -- this is a
side audit channel, not a change to any verb's own primary output/error contract. Nothing in this
tool is, or may be read as, a clinical-validity, safety, diagnostic-performance, or IRB/DUA-
compliance claim.

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

# `run` is real (P4-T3, FR-19): once the boundary passes, it requires BOTH flags below, resolves
# the candidate exclusively via a registry-entry packDigest match (never "current tree" -- see
# "Version-pinned replay" below), replays every case, and writes a deterministic
# build/retro-runs/<corpusId>/<digestSlug>/replay-output.json:
node tools/retro-validate/cli.mjs run \
  --corpus tests/fixtures/ef-retro/replay-corpus \
  --candidate-digest sha256:ef1adfb4d4e2640812f9d1de363c68c979c9c159b60ede121376e1befbe7212c \
  --registry tests/fixtures/ef-retro/registries/valid/registry.json
# -> exit 0; prints a JSON summary (corpusId, moduleId, candidateVersion, candidateDigest,
#    caseCount, outputPath); a digest matching no registry entry, an unregistered moduleId, a
#    missing pinned-content directory, or drifted pinned content each fail closed (RegistryError,
#    exit 1, zero output written) instead.

# `report` remains scaffold-only until P4-T4 lands (exit 1, NotImplementedError):
node tools/retro-validate/cli.mjs report --corpus <valid-dir> --run <dir> --protocol <doc>

# Every invocation above -- success, boundary rejection, or usage rejection -- also appends one
# entry to the access log (FR-22, P4-T7). --actor/--purpose are optional (never required); an
# unresolved value logs explicitly as "unknown"/"unspecified", never silently:
node tools/retro-validate/cli.mjs check-fixtures --corpus <dir> --actor nick --purpose "spot-check"
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
| **Replay** | `lib/replay.mjs` | Version-pinned deterministic engine replay (FR-19) -- `resolveCandidate()` resolves the candidate build exclusively via a registry-entry `packDigest` match (never "current tree"); `replayCorpus()`/`writeReplayOutput()` sort cases, strip `assess()`'s one non-deterministic field (`meta.generatedAt`), and write canonical (sorted-key) bytes; byte-identical double-run output, test-proven. Landed, **P4-T3**. | **P4-T3** (landed) | boundary, corpus, errors |
| **Metrics** | `lib/metrics.mjs` (P4-T4), plus the discordance/adjudication model (P4-T5, FR-23) and the human-only protocol schema (P4-T6, FR-24) | Software-agreement `agreement-report.json` (5 OQ-5 measures) + `run-provenance.json` sidecar; discordance records; protocol-threshold gating. | **P4-T4** / **P4-T5** / **P4-T6** | replay, errors |
| **Access log** | `lib/access-log.mjs`, `access-log.jsonl` (generated, not committed) | Append-only, structured audit trail of every `check-fixtures`/`run`/`report` invocation (FR-22) -- distinct from the review-record chain (no shared files, no shared schema, no cross-import; test-asserted). Landed, P4-T7. | **P4-T7** (landed) | errors |

**Access-log call sites**: every file under `lib/verbs/` calls `access-log.mjs#logAccessAttempt` as
the FIRST statement of its own `run()` -- unconditionally, before the `--corpus` usage check and
before the boundary gate, so a rejected/malformed invocation is audited exactly like a successful
one. This does not move the boundary gate's own call-site (`checkFixtures` remains the first REAL
logic after the usage check, ADR-0006's binding clause, P4-T2) -- it is a second, independent, side
audit channel with its own write path and its own failure mode.

**Verb-handler contract**: every file under `lib/verbs/` exports `async function run(options)` that
either resolves to a numeric process exit code (see `EXIT_*` in `lib/errors.mjs`) or throws a
`RetroValidateError` (or subclass). `cli.mjs` forwards a thrown `RetroValidateError`'s `exitCode`
verbatim -- it never remaps it. A non-`RetroValidateError` throw (a genuine bug) falls back to
`EXIT_USAGE` (1).

```
lib/verbs/check-fixtures.mjs  -- real (P4-T1): runs boundary.checkFixtures, prints a JSON summary
lib/verbs/run.mjs              -- boundary-gated (P4-T2) -> real (P4-T3, landed): resolveCandidate() -> replayCorpus() -> writeReplayOutput()
lib/verbs/report.mjs            -- boundary-gated (P4-T2: calls checkFixtures first) -> scaffold (P4-T1) -> real (P4-T4)
```

**Data flow** (once every module lands):

```
corpus.loadCorpusDocument()  ->  boundary.checkFixtures()  ->  replay.resolveCandidate() + replayCorpus()  ->  metrics (P4-T4/T5/T6)
        (P4-T1)                        (P4-T1/P4-T2)                          (P4-T3, landed)                       (P4-T4..T6)
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

## Version-pinned replay (`lib/replay.mjs`, P4-T3, FR-19)

`run --corpus <dir> --candidate-digest <sha256:...> --registry <path>` replays every corpus case
through the engine build identified by the pinned registry digest -- **never "current tree"**.

**Candidate resolution.** `schemas/release-registry.schema.json` (P1-T5, shared, read-only) is the
ONLY P1-T5 artifact this task consumes -- `releases/registry.json` itself does not exist yet
(P3-T4), so `--registry <path>` always points at a **dry-run registry fixture**
(`tests/fixtures/ef-retro/registries/<name>/registry.json`). `resolveCandidate()`:

1. Validates the registry document against that schema.
2. Finds the exactly-one entry whose `packDigest` equals `--candidate-digest` -- zero matches (an
   unpinned/unregistered digest) or more than one (ambiguous) both fail closed (`RegistryError`).
3. Confirms the entry's `moduleId` is registered (`src/modules/registry.js#isRegisteredModule`).
4. Resolves the entry's pinned candidate-content directory by a **tool-local convention** (the
   registry schema's `$defs/registryEntry` is `additionalProperties: false` over exactly the OQ-4
   field list, so no field can point at one):
   `<dirname(registryPath)>/candidates/<moduleId>/<version>/{rules,candidates}.json` -- the exact
   two parameters `src/engine.js#assess(input, moduleId, rules, candidates)` takes. A missing
   directory fails closed; there is no fallback to `modules/<moduleId>/rules.json` on the live
   tree (structurally proven -- `tests/ef-retro-determinism.test.mjs` greps `lib/replay.mjs` for
   any such reference, and behaviorally proven -- the fixture candidate directories carry a tiny,
   hand-authored KB structurally unrelated to the real `modules/anemia/` content).
5. Independently RE-COMPUTES that directory's own digest (SHA-256 over each pinned file's raw
   bytes, read back verbatim -- same posture `tools/release-sign/lib/canonical-bytes.mjs`
   documents for its own preimage) and requires it to equal the registry entry's `packDigest` --
   a `--candidate-digest` that matches an entry whose OWN pinned content has drifted still fails
   closed (`RegistryError`, distinct message naming "drift").

This is a dry-run, E1-only digest algorithm (`lib/replay.mjs#computePackDigest`) -- self-consistent
by construction (same function computes it at fixture-authoring time and at replay time), but it
makes no claim to match whatever production kb-pack hashing Phase 3/5 eventually ships.

**Determinism (FR-19).** `replayCorpus()` sorts corpus cases by `caseId` (ascending) before
replay, regardless of their declared order in `corpus.json`. Each case's `assess()` output has its
one non-deterministic field (`meta.generatedAt`, a `new Date().toISOString()` stamp) stripped
before it is embedded in the replay document. `writeReplayOutput()` serializes with
`canonicalize()` (recursive, sorted object keys; array element order untouched) via
`canonicalStringify()`, and writes to a **deterministic, digest-derived** output path --
`defaultOutputDir()` returns `build/retro-runs/<corpusId>/<digestSlug>/` (not a CLI flag; `run`'s
signature is exactly the 3 flags above), so two invocations over an identical
`(corpus, candidate-digest, registry)` triple write to the SAME path with byte-identical content
(`tests/ef-retro-determinism.test.mjs` proves this both via direct import and a CLI subprocess,
with a real >1s wall-clock gap between the two runs). `writeReplayOutput` is the LAST statement in
`run`'s success path -- any failure (boundary, usage, or candidate resolution) leaves **zero**
output on disk.

## The access-log-entry schema (`schemas/access-log-entry.schema.json`, FR-22)

Also tool-local, same rationale as the fixture-corpus schema above. Validates ONE line of
`access-log.jsonl` at a time (the file itself is not a single JSON document, it is one JSON object
per line). Closed property set (`additionalProperties: false`): `schemaVersion`, `timestamp`,
`actor`, `purpose`, `corpusId`, `verb`, `prevEntryHash` -- nothing else, which is what structurally
forbids case-level data from ever occupying an entry (there is no key it could occupy).

- `actor` / `purpose` are self-reported, unauthenticated strings resolved from `--actor`/`--purpose`
  CLI flags or `RETRO_VALIDATE_ACTOR`/`RETRO_VALIDATE_PURPOSE` env vars (flag wins); an unresolved
  value logs explicitly as `"unknown"`/`"unspecified"` -- never silently omitted, and never blocks
  the invocation from proceeding.
- `corpusId` is the raw `--corpus` argument string as given (or `"unspecified"` if omitted), NOT the
  corpus document's own parsed `corpusId` field -- this lets a rejected/unparseable-corpus
  invocation still be logged with whatever reference the caller supplied, and keeps this module
  decoupled from `boundary.mjs`'s own validation outcome.
- `prevEntryHash` is `sha256:<hex>` of the exact raw bytes of the immediately preceding line in the
  SAME file (or `null` for the first entry) -- a within-file hash chain, append-only enforcement
  mirroring the SHAPE `tools/review-record/lib/chain.mjs` documents for its own per-file OQ-2 chain
  (P2-T1 scaffold), adapted to one file instead of many. `lib/access-log.mjs#verifyAccessLogChain`
  recomputes and compares it, fail-closed (`AccessLogChainError`) on the first line that does not
  agree -- proven against seeded mutation/deletion fixtures in
  `tests/ef-retro-access-log.test.mjs`.
- **Distinct from the review-record chain, by construction, not by convention alone**: different
  schema file, different `$id`, no `$ref` in either direction, no cross-import between
  `tools/retro-validate/` and `tools/review-record/`, different on-disk path
  (`tools/retro-validate/access-log.jsonl` vs. `modules/<id>/reviews/*.yaml`) -- all four dimensions
  are test-asserted in `tests/ef-retro-access-log.test.mjs`.
- **Generated, not committed**: `access-log.jsonl` itself is a runtime artifact of real invocations
  (`.gitignore`d), exactly like `tools/rf-bundle-to-kb-pack/`'s own converter output. Tests exercise
  the module against isolated tmp paths (`--access-log-path` flag / `RETRO_VALIDATE_ACCESS_LOG_PATH`
  env var) so `npm test` never mutates a real, tracked file.

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
  access-log.jsonl                 generated, .gitignore'd -- append-only audit trail from real invocations only
  schemas/
    fixture-corpus.schema.json      tool-local fixture-corpus schema (P4-T1, FR-20)
    access-log-entry.schema.json     tool-local access-log-entry schema (P4-T7, FR-22)
    protocol.schema.json             human-only prespecified-protocol schema (P4-T6; does not exist until then)
  lib/
    errors.mjs                        exit taxonomy: OK/USAGE/BOUNDARY + RegistryError class (P4-T1, extended P4-T3)
    corpus.mjs                         CORPUS module: load/parse (P4-T1)
    boundary.mjs                        BOUNDARY module: schema-enforced gate (P4-T1 / P4-T2)
    replay.mjs                           REPLAY module: resolveCandidate/replayCorpus/writeReplayOutput (P4-T3, landed)
    metrics.mjs                           METRICS module (P4-T4/T5/T6; does not exist until then)
    access-log.mjs                         ACCESS-LOG module: append/verify hash chain (P4-T7, landed)
    verbs/
      check-fixtures.mjs                    `check-fixtures` verb (P4-T1, real; access-logged P4-T7)
      run.mjs                                 `run` verb: boundary-gated (P4-T2) -> real replay (P4-T3, landed); access-logged P4-T7
      report.mjs                               `report` verb (P4-T2: boundary-gated) -> scaffold (P4-T1) -> real (P4-T4); access-logged P4-T7
```

Corpus fixtures for tests live under `tests/fixtures/ef-retro/<corpus-name>/corpus.json` (never
committed real patient data -- synthetic content only, per this repo's own hard guardrails).
Seeded rejection-class fixtures (P4-T1/P4-T2): `identifier-name` / `identifier-mrn` /
`identifier-dob` / `identifier-address` / `identifier-contact` / `identifier-ssn-pattern`
(identifier-bearing case, >=6 classes), `missing-provenance` (case lacking its provenance marker),
`missing-source-attestation` (corpus lacking corpus-level `sourceAttestation`, P4-T2) -- each fails
closed with a distinct, class-identifiable error (`tests/ef-retro-boundary.test.mjs`).

**Replay fixtures (P4-T3)**: `tests/fixtures/ef-retro/replay-corpus/` (3 synthetic cases,
deliberately declared out of `caseId` order) pairs with
`tests/fixtures/ef-retro/registries/valid/` (a dry-run `registry.json` + its pinned
`candidates/anemia/0.1.0-fixture/{rules,candidates}.json` -- a tiny, hand-authored 3-rule KB,
structurally unrelated to the real `modules/anemia/rules.json`). Seeded failure-class fixtures:
`registries/drifted-content/` (a registry entry whose recorded `packDigest` disagrees with its own
pinned content), `registries/unregistered-module/` (a `moduleId` not in
`src/modules/registry.js`), `registries/missing-candidate-content/` (a registry entry with no
matching pinned-content directory on disk at all).

## Test coverage index

- `tests/ef-retro-corpus.test.mjs` (P4-T1) -- CORPUS + BOUNDARY module correctness in isolation.
- `tests/ef-retro-boundary.test.mjs` (P4-T2, updated P4-T3) -- `run`/`report` call-order/refusal
  contract; `run`'s post-boundary expectation is now "requires --candidate-digest/--registry"
  (real, P4-T3) where `report`'s remains "scaffold NotImplementedError" (still P4-T4-pending).
- `tests/ef-retro-determinism.test.mjs` (P4-T3) -- candidate resolution (success + every
  fail-closed class: digest-mismatch, drift, unregistered moduleId, missing pinned content, schema
  violation), sorted case order, `meta.generatedAt` stripping, double-run byte-identity (direct
  import + CLI subprocess), "never current tree" (structural + behavioral), zero-network.
- `tests/ef-retro-access-log.test.mjs` (P4-T7) -- one-entry-per-invocation proof (success/boundary/
  usage paths), hash-chain append-only enforcement (clean chain + seeded mutation/deletion
  rejection), actor/purpose/path resolution order, and the 4-dimension distinctness proof against
  `tools/review-record/`.
