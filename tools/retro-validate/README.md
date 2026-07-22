# `retro-validate`

Deterministic, offline retrospective validation harness for the pediatric CDS engine. This is
**Phase 4** of the Evidence Foundry E1 build (`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md`,
phase detail: `evidence-foundry-e1-v1/phase-2-4-workstreams.md` §"Phase 4"). It implements ADR-0006:
replaying a version-pinned candidate build against a **fixtures-only** corpus (synthetic +
de-identified content ONLY, structurally enforced) and emitting **software-agreement** metrics --
never sensitivity, specificity, clinical performance, or any other clinical-validity claim.

**Status (as of the P4 fix cycle)**: `check-fixtures` is real -- it validates a corpus against
`schemas/fixture-corpus.schema.json` AND scans it with the identifier-denylist procedural layer
(`lib/identifier-denylist.mjs`, added after a Codex second-opinion review found two BLOCKERs the
schema alone could not close -- see "The fixture-corpus schema" below). `run` and `report` both call that same boundary check FIRST,
unconditionally, and refuse to proceed on an unchecked (no `--corpus`) or failing corpus. `run` is
real (FR-19, version-pinned deterministic replay, landed P4-T3): it resolves a candidate build
exclusively via a registry-entry digest match (never "current tree"), replays every corpus case
through `src/engine.js#assess()` using that pinned candidate's `rules`/`candidates`, and writes a
canonical, sorted, timestamp-free `replay-output.json` -- two runs over an identical `(corpus,
candidate-digest, registry)` triple are byte-identical. `report` is now real too (FR-21/OQ-5,
software-agreement metrics, landed this task): it reads an already-written `replay-output.json`
(never re-runs the engine), computes exactly the 5 OQ-5 software-agreement measures, and writes
`agreement-report.json` (canonical, timestamp-free, determinism-compared bytes) plus its
`run-provenance.json` sidecar (the sole sanctioned timestamp location) into the same `--run`
directory. All three verbs also access-log every invocation, success or not (FR-22,
`lib/access-log.mjs`, see below) -- this is a side audit channel, not a change to any verb's own
primary output/error contract. `lib/discordance.mjs` (FR-23, landed P4-T5) is an offline consumer of
an already-written `replay-output.json`: it computes adjudication-ready discordance records and
bridges them into `tools/review-record`'s own `scaffold --role adjudication` verb -- see
"Discordance / adjudication-ready records" below; it is not wired into `report`'s own CLI surface.
Nothing in this tool is, or may be read as, a clinical-validity, safety, diagnostic-performance, or
IRB/DUA-compliance claim.

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

# `report` is real (P4-T4, FR-21/OQ-5): once the boundary passes, it requires --run <replay
# output dir> (the directory `run` wrote replay-output.json into), reads that document (never
# re-runs the engine), and writes agreement-report.json + run-provenance.json into that same
# directory. --protocol is optional and never flips a report to "qualifying" (FR-24 -- see below):
node tools/retro-validate/cli.mjs report \
  --corpus tests/fixtures/ef-retro/replay-corpus \
  --run build/retro-runs/ef-retro-replay-fixture/sha256-ef1adfb4d4e2640812f9d1de363c68c979c9c159b60ede121376e1befbe7212c
# -> exit 0; writes agreement-report.json (5 OQ-5 software-agreement measures, each labeled
#    "software agreement", plus the unvalidated-prototype / software-agreement-negation / FR-24
#    non-qualifying-protocol banners) and run-provenance.json (corpus id, harness version,
#    candidate registry digest, run timestamp -- the sole timestamp location) alongside
#    replay-output.json; a missing --run, a --run dir with no replay-output.json, or a
#    replay-output.json naming a different corpus than --corpus all fail closed (UsageError).

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
| **Boundary** | `lib/boundary.mjs` | `checkFixtures(corpusDir)` -- the TWO-LAYER de-identification gate (FR-20): the schema layer (structural) plus the identifier-denylist layer (procedural, `lib/identifier-denylist.mjs`, added in the P4 fix cycle after a Codex second-opinion review). Real schema-validation as of P4-T1; **P4-T2** hardened `run`/`report` (`lib/verbs/run.mjs`, `lib/verbs/report.mjs`) to call it FIRST, unconditionally, and refuse to proceed past an unchecked/failing corpus; the P4 fix cycle added the denylist layer alongside it, same call site, same fail-closed contract. | P4-T1 (initial), **P4-T2** (enforcement + hardening, landed), **P4 fix cycle** (denylist layer) | corpus, identifier-denylist, errors |
| **Identifier denylist** | `lib/identifier-denylist.mjs` | `scanForIdentifiers(document)` -- the procedural backstop layer (FR-20, P4 fix cycle): recursively scans the ENTIRE parsed corpus document for identifier-shaped keys and PHI-marker value patterns, independent of the schema's own shape. The ONE sanctioned file permitted to hand-implement this kind of detection logic (test-pinned). | **P4 fix cycle** (landed) | -- |
| **Replay** | `lib/replay.mjs` | Version-pinned deterministic engine replay (FR-19) -- `resolveCandidate()` resolves the candidate build exclusively via a registry-entry `packDigest` match (never "current tree"); `replayCorpus()`/`writeReplayOutput()` sort cases, strip `assess()`'s one non-deterministic field (`meta.generatedAt`), and write canonical (sorted-key) bytes; byte-identical double-run output, test-proven. Landed, **P4-T3**. | **P4-T3** (landed) | boundary, corpus, errors |
| **Metrics** | `lib/metrics.mjs`, the discordance/adjudication-record model (`lib/discordance.mjs`, `schemas/discordance-record.schema.json`, **P4-T5**, FR-23), and the human-only protocol schema (`lib/protocol.mjs`, `schemas/protocol.schema.json`, **P4-T6**, FR-24) | Software-agreement `agreement-report.json` (5 OQ-5 measures) + `run-provenance.json` sidecar; FR-24 protocol-qualification banner (structurally always non-qualifying) AND, as of P4-T6, a structural `const:null`-threshold schema gate on any `--protocol` document, enforced fail-closed by `lib/verbs/report.mjs`; AND, as of P4-T5, `computeDiscordanceRecords()` (one adjudication-ready record per labeled-case-vs-reference-label disagreeing dimension) plus `toAdjudicationScaffoldInput()`, which maps a discordance record onto `tools/review-record`'s own `scaffold --role adjudication` options shape -- proven by a real integration test that invokes that verb's `run()` directly. Landed, **P4-T4**/**P4-T5**/**P4-T6**. | **P4-T4** (landed) / **P4-T5** (landed) / **P4-T6** (landed) | replay, errors, (P4-T5 only) `tools/review-record/lib/adjudication.mjs` |
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
lib/verbs/report.mjs            -- boundary-gated (P4-T2: calls checkFixtures first) -> real (P4-T4, landed): reads replay-output.json -> computeAgreementMeasures() -> writeAgreementReport() + writeRunProvenance()
```

**Data flow**:

```
corpus.loadCorpusDocument()  ->  boundary.checkFixtures()  ->  replay.resolveCandidate() + replayCorpus()  ->  protocol.assertProtocolShape() (P4-T6)  ->  metrics.computeAgreementMeasures() + evaluateProtocolQualification()  ->  discordance.computeDiscordanceRecords() (P4-T5, offline consumer of replay-output.json, not wired into `report`'s own CLI surface)
        (P4-T1)                        (P4-T1/P4-T2)                          (P4-T3, landed)                                       (P4-T6, landed; --protocol only)                          (P4-T4, landed)                                                                      (P4-T5, landed)
```

## Discordance / adjudication-ready records (`lib/discordance.mjs`, P4-T5, FR-23, PRD OQ-5)

`computeDiscordanceRecords(replayDocument)` (pure, no I/O) walks an already-written
`replay-output.json` and emits one **adjudication-ready discordance record** per (labeled case,
disagreeing dimension) -- never a clinical-validity claim, purely a structural record of where the
pinned engine build's output disagreed with a case's own fixture `referenceLabels`. Four dimensions:
`candidate-pattern-mismatch`, `safety-flag-mismatch`, `missing-data-prompt-mismatch` (each a
strict-set-inequality check against the corresponding OQ-5 measure's own comparison), and
`dangerous-miss-discordance` (reuses `../metrics.mjs#isDangerousMissDiscordant` verbatim -- this
file does not re-implement that named-flag-vs-fallback rule). A single case can emit multiple
records (one per disagreeing dimension); an unlabeled case never emits one. Every record validates
against the tool-local `schemas/discordance-record.schema.json` (closed shape:
`caseRef`/`candidateDigest`/`engineOutputSet`/`referenceLabelSet`/`disagreementClass`, per FR-23,
plus identity/versioning fields) -- a record missing any required field is schema-rejected
fail-closed (seeded fixtures under `tests/fixtures/ef-retro/discordance-records/`).

**"Structurally consumable by Workstream A"**: `toAdjudicationScaffoldInput(record, humanInput)`
maps a discordance record onto the EXACT options shape `tools/review-record/lib/verbs/scaffold.mjs#run`
accepts for `--role adjudication` (P1-T2's canonical adjudication-role scaffold input) --
`record.candidateDigest` (already `sha256:<64 hex>`-shaped) becomes `subject`, `record.moduleId`
becomes `module`. A discordance record is adjudication-READY, not an adjudication decision:
`humanInput.reviewerId`/`humanInput.decision` -- the actual human adjudicator's identity and
verdict -- are NEVER derived from the record and this function throws if either is missing.
`tests/ef-retro-discordance.test.mjs` proves every discordance record the `metrics-corpus` fixture
produces is accepted by the REAL `tools/review-record` `scaffold` verb (`run()` imported directly,
not re-implemented or mocked).

**Adjudicator-≠-author reuse (PRD OQ-5)**: `checkAdjudicatorNotAuthor` computes eligibility using
`computeAuthorshipUnion`/`rosterEntryInAuthorshipUnion` **imported** from
`tools/review-record/lib/adjudication.mjs` (P2-T4's own PRD OQ-5 implementation) -- `lib/discordance.mjs`
contains no git-log parsing, no authorship-source-kind constants, and no name-heuristic logic of its
own (grep-tested). This is the ONE sanctioned cross-import between the two tools --
`tests/ef-retro-access-log.test.mjs` pins it to exactly this one file, so it cannot silently spread
into `lib/access-log.mjs` or any other module (which would violate FR-22's own audit-trail
distinctness guarantee).

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

**Structural de-identification boundary (FR-20), schema layer**:

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
  `exam`, `labs`, `smear`), AND -- as of the P4 fix cycle below -- every nested clinical sub-object
  (`patient`, `cbc` including its own `localRanges`/`localFlags`, `reticulocytes`, `labs`) is
  ITSELF closed (`additionalProperties: false`) with an explicit field whitelist copied field-for-
  field from `schemas/patient-input.schema.json`'s own corresponding sub-shape. `symptoms`/
  `history`/`exam` remain intentionally open on key name (the SPIKE-003 RQ4 wire-compatibility
  boolean-map decision, also mirrored verbatim) because their VALUES are constrained to booleans/
  tristate-enum strings and can never carry free-text identifier content. An identifier field
  smuggled ANYWHERE into the clinical-input object -- including one nesting level deeper than the
  prior schema could see -- is now structurally rejected at this boundary, one layer before the
  harness ever reaches the engine's own patient-input validation (P4-T3). A dedicated drift-
  detection test (`tests/ef-retro-corpus.test.mjs`) re-reads both schemas at test time and fails if
  the mirror ever silently diverges from `schemas/patient-input.schema.json`.

**Structural de-identification boundary (FR-20), identifier-denylist layer (P4 fix cycle)**: a
Codex second-opinion review found two BLOCKERs the schema layer above, by itself, could not close:
(a) `description` (and other free-text fields) is necessarily unrestricted prose -- a corpus
containing synthetic name/MRN/DOB markers inside `description` validated cleanly; (b) nested
clinical `input` sub-objects previously had NO closed shape at all (`clinicalInput.properties.patient`
etc. were `true`, unrestricted), so `input.patient` accepted arbitrary name/mrn/dob fields that
`run` passed raw to `assess()`. The schema layer above closes (b) directly; a second, independent,
procedural layer -- `lib/identifier-denylist.mjs`, called by `lib/boundary.mjs#checkFixtures`
alongside (never instead of) the schema layer -- closes (a), and backstops (b) and the
intentionally-open `symptoms`/`history`/`exam` boolean-map key names too:

- Recursively scans the ENTIRE parsed corpus document, every object key at every depth, for
  identifier-shaped keys (`name`, `mrn`, `dateOfBirth`, `ssn`, `address`, `phone`, `email`,
  `contact`, and further variants -- normalized for casing/separator convention, exact match only,
  never a substring match) -- catches a denylisted key even where the schema legitimately leaves a
  field open (e.g. `history.patientName`, schema-valid because `history`'s VALUES are boolean/
  tristate-constrained, but the KEY itself is still rejected here).
- Recursively scans every STRING value, anywhere in the document, against a PHI-marker pattern set
  (SSN-shaped values, MRN/DOB/SSN/"patient name" prose markers, phone-shaped values, email-shaped
  values, street-address-shaped markers) -- this is what closes BLOCKER (a): a `description`
  containing `"MRN: 123456"` or `"DOB: 2015-01-01"` is now rejected fail-closed even though no
  schema `pattern`/`not` keyword targets that specific free-text field.
- Every violation is combined with the schema layer's own violations into ONE `BoundaryError`
  (fail-closed, non-zero exit, no partial output) -- both layers always run; neither is
  short-circuited by the other already failing.
- `lib/identifier-denylist.mjs` is the ONE sanctioned file permitted to hand-implement this kind of
  procedural detection logic (test-pinned in `tests/ef-retro-boundary.test.mjs`, the same "single
  sanctioned exception" pattern this repo already uses for `lib/discordance.mjs`'s cross-import of
  `tools/review-record/lib/adjudication.mjs`) -- no other file under `tools/retro-validate/`
  duplicates or bypasses it.

Seeded proof fixtures (P4 fix cycle): `identifier-description-phi-marker` (BLOCKER a: PHI markers
inside free-text `description`), `identifier-input-patient-nested` / `identifier-input-cbc-nested`
(BLOCKER b: an identifier field smuggled into `input.patient`/`input.cbc`), and
`identifier-denylist-nested-history` (a denylist-layer-ONLY proof: an identifier-shaped key inside
the intentionally-open `history` boolean map passes schema validation cleanly but still fails
`checkFixtures`, proving the procedural layer is load-bearing, not redundant).

**E1 corpus content is synthetic + de-identified only.** There is no schema path, denylist-scan
path, CLI flag, or code path in this tool that admits real, identified patient data.

## Version-pinned replay (`lib/replay.mjs`, P4-T3, FR-19)

`run --corpus <dir> --candidate-digest <sha256:...> --registry <path>` replays every corpus case
through the engine build identified by the pinned registry digest -- **never "current tree"**.

**Candidate resolution.** `schemas/release-registry.schema.json` (P1-T5, shared, read-only) is the
ONLY P1-T5 artifact this task consumes. `releases/registry.json` (seeded empty by P3-T4,
`{ "schemaVersion": 1, "entries": [] }`) now exists at the repo root, but this tool's own tests
still point `--registry <path>` at a **dry-run registry fixture**
(`tests/fixtures/ef-retro/registries/<name>/registry.json`) rather than the real (still-empty)
repo-root file, since no real candidate has been registered against it. `resolveCandidate()`:

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

## Software-agreement metrics (`lib/metrics.mjs`, P4-T4, FR-21/OQ-5)

`report --corpus <dir> --run <replay output dir> [--protocol <path>]` reads the ALREADY-WRITTEN
`replay-output.json` `run` produced (it never re-runs the engine itself), confirms it names the
same corpus `--corpus` resolved (a mismatched pairing fails closed), and computes exactly the 5
OQ-5 measures, every one carrying `label: "software agreement"`:

1. **Case-level exact-agreement rate** -- fraction of *labeled* corpus cases (those with a
   `referenceLabels` block at all -- unlabeled cases are excluded from every measure, never
   coerced into a false agreement) where the engine's `rankedDifferential`/`alerts`/`nextQuestions`
   ids exactly match (as sets) the case's own `candidatePatternIds`/`safetyFlagIds`/
   `missingDataPromptIds`.
2. **Per-candidate-pattern agreement/disagreement counts** -- for every pattern id that ever
   appears (in either the reference or the engine output) across labeled cases, how many cases
   agree vs. disagree on that id's presence/absence.
3. **Dangerous-miss discordance count** -- of the labeled cases marking
   `dangerousMissExpected: true`, how many the engine's own alert output does not corroborate (see
   `isDangerousMissDiscordant`'s doc comment for the named-flag vs. no-named-flag fallback rule).
4. **Safety-flag agreement coverage** -- of every reference `safetyFlagId` named across the
   corpus, the fraction also present among the engine's own alert ids for that same case.
5. **Missing-data-prompt agreement rate** -- the same coverage-style ratio for
   `missingDataPromptId`s against the engine's `nextQuestions` ids.

Every measure is a **software-agreement** measure against this corpus's own fixture reference
labels -- **never** a clinical dangerous-miss rate, sensitivity, specificity, or performance claim
(`report`'s header carries the explicit negation banner; a grep-test proves those three forbidden
terms appear nowhere else in `agreement-report.json`).

**FR-24 protocol qualification.** `evaluateProtocolQualification(protocolDoc)` is structurally
incapable of ever returning `qualifying: true` -- not merely "false by default", there is no
branch in the function that assigns `true`. An optional `--protocol <path>` is read (if given)
only so its content can be recorded in the banner's `populatedFields`/`reason` detail; even a
document with real, non-null threshold values is *detected* (via `findPopulatedProtocolFields`, a
generic recursive walk with no dependency on `protocol.schema.json`'s own field names) but never
honored. Every `agreement-report.json` therefore carries the FR-24
"non-qualifying — protocol not prespecified by humans" banner unconditionally.

## Prespecified-protocol shape (`schemas/protocol.schema.json`, `lib/protocol.mjs`, P4-T6, FR-24)

Also tool-local, same rationale as the fixture-corpus schema. Shapes the ONE kind of prespecified
validation protocol document `report --protocol <path>` may ever accept, with slots for the
dangerous-miss-rate threshold, the utility measures (sensitivity/specificity/PPV/NPV thresholds),
and the three stratification axes (subgroup/analyzer/site) a future human-authored protocol would
pin per-stratum thresholds against. **Every threshold-bearing field is `const: null`** -- there is
no value other than `null` that satisfies this schema for any threshold field, in Evidence Foundry
E1; software never invents or defaults a clinical threshold. The schema also requires a non-empty
`authoredBy` (named human owner(s)) -- FR-24's "TBD-by-named-humans" is an authorship requirement,
not merely a null-threshold one.

`lib/protocol.mjs#assertProtocolShape(protocolDoc)` is the fail-closed structural gate:
`lib/verbs/report.mjs` calls it on any supplied `--protocol` document, immediately after parsing it
and BEFORE computing or writing anything -- a document that fails this schema (a populated
threshold being the paradigm case) throws `ProtocolError` (a `UsageError` subclass, `EXIT_USAGE`,
same non-taxonomy-bloat rationale `RegistryError` documents) and `report` writes **zero** output.
This is layered ON TOP OF, not instead of, `evaluateProtocolQualification`'s own defensive
"never returns `qualifying: true`" posture above -- two independent guarantees, neither depends on
the other holding (a caller of `buildAgreementReportDocument` that bypasses `report.mjs` entirely,
e.g. a unit test, still gets the second guarantee even without the first).

Seeded fixtures: `tests/fixtures/ef-retro/protocol/null-threshold-protocol.json` (all thresholds
`null`, valid) and `.../populated-threshold-protocol.json` (a real `dangerousMissRateThreshold`,
the rejection-class fixture) -- `tests/ef-retro-protocol.test.mjs` covers the schema itself
(supported-keyword load, every one of the three threshold-slot locations independently rejecting a
populated value, the authorship requirement, the closed-shape check) and
`tests/ef-retro-metrics.test.mjs` covers the `report`-verb-level integration (acceptance +
fail-closed rejection with no report/provenance written).

**Determinism + provenance split (FR-19/FR-21).** `agreement-report.json` carries NO timestamp
anywhere in its shape -- `buildAgreementReportDocument` + `canonicalStringify` (reused from
`lib/replay.mjs`) produce byte-identical bytes across two `report` invocations over an identical
`replay-output.json`. `run-provenance.json` (corpus id, harness version -- read off the replay
document itself, never re-derived -- candidate registry digest, run timestamp) is the ONE
sanctioned timestamp location in this tool's entire output surface, written as a sibling file that
is never part of any determinism byte-comparison.

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
  `lib/access-log.mjs` specifically and `tools/review-record/`, different on-disk path
  (`tools/retro-validate/access-log.jsonl` vs. `modules/<id>/reviews/*.yaml`) -- all four dimensions
  are test-asserted in `tests/ef-retro-access-log.test.mjs`. (`lib/discordance.mjs` -- a wholly
  separate module, P4-T5, FR-23 -- IS a deliberate, test-pinned exception to the broader
  no-cross-import posture; see "Discordance / adjudication-ready records" above. That test pins the
  exception to exactly that one file, so it can never silently widen to include `lib/access-log.mjs`
  or any other module in this tool.)
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
    discordance-record.schema.json    tool-local discordance/adjudication-ready-record schema (P4-T5, FR-23)
    protocol.schema.json             human-only prespecified-protocol schema (P4-T6, FR-24, landed)
  lib/
    errors.mjs                        exit taxonomy: OK/USAGE/BOUNDARY + RegistryError/ProtocolError classes (P4-T1, extended P4-T3/P4-T6)
    corpus.mjs                         CORPUS module: load/parse (P4-T1)
    identifier-denylist.mjs             IDENTIFIER-DENYLIST module: recursive key/PHI-marker scan, the one sanctioned procedural layer (P4 fix cycle)
    boundary.mjs                        BOUNDARY module: two-layer gate -- schema (P4-T1/P4-T2) + identifier-denylist (P4 fix cycle)
    replay.mjs                           REPLAY module: resolveCandidate/replayCorpus/writeReplayOutput (P4-T3, landed)
    metrics.mjs                           METRICS module: computeAgreementMeasures/evaluateProtocolQualification/report+provenance builders+writers (P4-T4, landed)
    discordance.mjs                        DISCORDANCE module: computeDiscordanceRecords/toAdjudicationScaffoldInput/checkAdjudicatorNotAuthor (P4-T5, landed, FR-23 -- the ONE file in this tool that imports tools/review-record/)
    protocol.mjs                           PROTOCOL module: loadProtocolSchema/validateProtocolDocument/assertProtocolShape (P4-T6, landed, FR-24)
    access-log.mjs                         ACCESS-LOG module: append/verify hash chain (P4-T7, landed)
    verbs/
      check-fixtures.mjs                    `check-fixtures` verb (P4-T1, real; access-logged P4-T7)
      run.mjs                                 `run` verb: boundary-gated (P4-T2) -> real replay (P4-T3, landed); access-logged P4-T7
      report.mjs                               `report` verb: boundary-gated (P4-T2) -> real metrics (P4-T4, landed) + protocol-shape-gated (P4-T6, landed); access-logged P4-T7
```

Corpus fixtures for tests live under `tests/fixtures/ef-retro/<corpus-name>/corpus.json` (never
committed real patient data -- synthetic content only, per this repo's own hard guardrails).
Discordance-record fixtures (P4-T5) live under `tests/fixtures/ef-retro/discordance-records/`
(one schema-valid `valid-record.json` sanity fixture plus 5 seeded missing-field fixtures, one per
FR-23-named field); `tests/fixtures/ef-retro/discordance-adjudication-scaffold/` is a throwaway
`tools/review-record` `--root` tree (a `governance/reviewer-roster.yaml` with one synthetic reviewer
scoped to `anemia`) used ONLY by the P4-T5 scaffold-bridge integration test -- file-disjoint from
`tests/fixtures/ef-review-record-cli/` (P2's own fixture root).
Seeded rejection-class fixtures (P4-T1/P4-T2): `identifier-name` / `identifier-mrn` /
`identifier-dob` / `identifier-address` / `identifier-contact` / `identifier-ssn-pattern`
(identifier-bearing case, >=6 classes), `missing-provenance` (case lacking its provenance marker),
`missing-source-attestation` (corpus lacking corpus-level `sourceAttestation`, P4-T2) -- each fails
closed with a distinct, class-identifiable error (`tests/ef-retro-boundary.test.mjs`).
Seeded BLOCKER-shaped fixtures (P4 fix cycle): `identifier-description-phi-marker` (BLOCKER a: PHI
markers inside free-text `description`), `identifier-input-patient-nested` /
`identifier-input-cbc-nested` (BLOCKER b: an identifier field smuggled into a nested clinical
`input` sub-object), `identifier-denylist-nested-history` (denylist-layer-only proof: an
identifier-shaped key inside the intentionally-open `history` boolean map) -- see
`tests/ef-retro-corpus.test.mjs`'s newest tests.

**Replay fixtures (P4-T3)**: `tests/fixtures/ef-retro/replay-corpus/` (3 synthetic cases,
deliberately declared out of `caseId` order) pairs with
`tests/fixtures/ef-retro/registries/valid/` (a dry-run `registry.json` + its pinned
`candidates/anemia/0.1.0-fixture/{rules,candidates}.json` -- a tiny, hand-authored 3-rule KB,
structurally unrelated to the real `modules/anemia/rules.json`). Seeded failure-class fixtures:
`registries/drifted-content/` (a registry entry whose recorded `packDigest` disagrees with its own
pinned content), `registries/unregistered-module/` (a `moduleId` not in
`src/modules/registry.js`), `registries/missing-candidate-content/` (a registry entry with no
matching pinned-content directory on disk at all).

**Metrics fixture (P4-T4)**: `tests/fixtures/ef-retro/metrics-corpus/` (8 synthetic cases, same
pinned `registries/valid/` candidate as the replay fixture above) is deliberately engineered by
`referenceLabels` choice -- not input variety -- to exercise every agree/disagree/discordance
branch of all 5 OQ-5 measures at once; each case's own `tags` name the branch it covers, and
`tests/ef-retro-metrics.test.mjs` asserts the hand-derived expected value for every measure.

## Test coverage index

- `tests/ef-retro-corpus.test.mjs` (P4-T1, extended P4 fix cycle) -- CORPUS + BOUNDARY module
  correctness in isolation, both BLOCKER-shaped seeded fixtures failing closed, the
  denylist-layer-only proof (schema passes, `checkFixtures` still rejects), and a drift-detection
  test cross-checking the fixture-corpus schema's clinical sub-object shapes against
  `schemas/patient-input.schema.json` field-for-field.
- `tests/ef-retro-identifier-denylist.test.mjs` (P4 fix cycle) -- unit coverage for
  `lib/identifier-denylist.mjs` in isolation: key-normalization/exact-match behavior (not a
  substring match), one positive + one negative example per PHI-marker pattern, recursive
  walk/path-reporting correctness, and the standard zero-network/zero-LLM structural proof.
- `tests/ef-retro-boundary.test.mjs` (P4-T2, updated P4-T3, updated P4-T4, updated P4 fix cycle) --
  `run`/`report` call-order/refusal contract; each verb's own post-boundary usage requirement is
  real and neither ever falls through to the scaffold `NotImplementedError` placeholder once its
  boundary check clears (`run`: `--candidate-digest`/`--registry`, P4-T3; `report`: `--run`, P4-T4).
- `tests/ef-retro-determinism.test.mjs` (P4-T3) -- candidate resolution (success + every
  fail-closed class: digest-mismatch, drift, unregistered moduleId, missing pinned content, schema
  violation), sorted case order, `meta.generatedAt` stripping, double-run byte-identity (direct
  import + CLI subprocess), "never current tree" (structural + behavioral), zero-network.
- `tests/ef-retro-access-log.test.mjs` (P4-T7) -- one-entry-per-invocation proof (success/boundary/
  usage paths), hash-chain append-only enforcement (clean chain + seeded mutation/deletion
  rejection), actor/purpose/path resolution order, and the 4-dimension distinctness proof against
  `tools/review-record/`.
- `tests/ef-retro-metrics.test.mjs` (P4-T4, extended P4-T6) -- `isDangerousMissDiscordant`/
  `computeAgreementMeasures` edge-case unit coverage (zero-denominator `null` rates,
  all-unlabeled/empty corpora); the metrics-corpus fixture's full hand-derived expected values for
  all 5 measures; `evaluateProtocolQualification`/`findPopulatedProtocolFields` (always
  `qualifying: false`, even against a populated protocol); banner presence + exact FR-24 phrase;
  the grep-proof that `sensitivity`/`specificity`/`clinical performance` appear nowhere outside the
  one negation banner; `run-provenance.json` completeness and its sole-timestamp-location proof
  against `agreement-report.json`; double-build and double-invocation (direct + CLI subprocess)
  byte-identity; usage-error paths (missing `--run`, missing/mismatched `replay-output.json`,
  unreadable/unparsable `--protocol`); a schema-conformant `--protocol` document accepted; a seeded
  populated-threshold `--protocol` fixture rejected FAIL-CLOSED (`ProtocolError`, no
  report/provenance written, P4-T6); and the de-identified-aggregates-only proof (no per-case
  `input`/`output`/`caseId` content in the report).
- `tests/ef-retro-protocol.test.mjs` (P4-T6) -- `schemas/protocol.schema.json` loads cleanly under
  `json-schema-lite` (fail-closed on any unsupported keyword) and names the three required slots
  (dangerous-miss rate, utility measures, subgroup/analyzer/site strata); every threshold-bearing
  leaf is `const: null`; the seeded all-null-threshold fixture validates; the seeded
  populated-threshold fixture is rejected (`ProtocolError`, a `UsageError` subclass); each of the
  three threshold-slot locations (top-level, per-utility-measure, per-stratum on all three axes)
  independently rejects a populated value; the required non-empty `authoredBy` (named-human
  ownership) is enforced; and the closed (`additionalProperties: false`) shape is enforced.
- `tests/ef-retro-discordance.test.mjs` (P4-T5) -- `computeDiscordanceRecords` over the P4-T4
  `metrics-corpus` fixture, cross-checked against `computeAgreementMeasures`'s own already-proven
  hand-derived values (never independently re-derived); every emitted record schema-valid; an
  unlabeled case never emits a record; determinism (`discordanceId` stable, no randomness); the 5
  seeded missing-field fixtures under `tests/fixtures/ef-retro/discordance-records/` each rejected
  fail-closed at the exact missing field; `toAdjudicationScaffoldInput`'s human-supplied-only
  `reviewerId`/`decision` contract; a REAL integration test invoking
  `tools/review-record/lib/verbs/scaffold.mjs#run` directly over every discordance record the
  metrics-corpus fixture produces (all accepted, `EXIT_OK`) plus a negative control (an
  out-of-roster-scope module still fails closed via scaffold's OWN roster check); the
  adjudicator-≠-author reuse (`checkAdjudicatorNotAuthor`), both functionally (against the real
  `anemia` module's own git-derived authorship union) and via a source-level grep-test proving
  `lib/discordance.mjs` imports, never re-implements, `tools/review-record/lib/adjudication.mjs`'s
  helpers; and the standard zero-network two-layer proof.
