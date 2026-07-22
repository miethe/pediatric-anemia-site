# Changelog

## [Unreleased]

Wave-0 Safety Foundation program (EP-1 through EP-6). This is still an unvalidated research
prototype: the items below describe software behavior only and prove nothing about clinical
validity, safety, diagnostic performance, or regulatory status.

### Evidence Foundry E1: Clinical Governance Triad (Review Workflow · Signed Release · Retrospective Validation)

Three new offline Node ESM CLIs implement the Evidence Foundry E1 clinical-governance machinery,
all following this repository's zero-dependencies, fail-closed design (node:crypto only, no
network calls, no generative models). Every capability ships schema-forced inert: approval slots
carry only empty arrays or null signatures; reviewer rosters are synthetic-only; all test signatures
carry the `TESTKEY-` prefix; and real release-path transitions remain blocked at gate G0.

- **`tools/review-record/`** — Five-role append-only review-record workflow (ADR-0004). Implements
  `scaffold` (draft-building from a roster-resolved reviewer identity), `validate` (schema shape,
  roster resolution, reviewer-2 independence heuristic, two-layer append-only enforcement via
  `previousRecordHash` chain + optional git-history check, Ed25519 signature verification on
  synthetic records, and adjudication/release-authorization eligibility checks), `list`
  (informational chain-linkage reporting), `render` (deterministic read-only static HTML over a
  module's committed review chain, with rights-posture display), and `dry-run` (end-to-end five-role
  synthetic pass composing scaffold → sign → chain-validate). The E1 integration dry-run (P5-T1)
  exercises this tool's full synthetic workflow over `modules/cbc_suite_v1`; its five committed
  review records (`rr-0001-clinical-1.yaml` through `rr-0005-release-auth.yaml`) are the sole
  real invocation, still carrying `synthetic: true` markers and binding to the rule-proposal state.

- **`tools/release-sign/`** — Signed-release manifest / registry / sign / verify machinery (ADR-0005).
  Implements `manifest` (reads or builds a release-candidate pack and reports its canonical signing
  preimage via `node:crypto` SHA-256, never re-serializing E0's bytes), `sign` (Ed25519 detached
  signature, ephemeral in-memory keypair in `--dry-run` mode with `TESTKEY-` self-certifying
  keyId; offline human mode structurally guarded against by in-repo `--key` path rejection),
  `register` (appends exactly one inert registry entry to `releases/registry.json`, enforcing
  append-only via in-process comparison + git-history walk), and `verify` (fail-closed cryptographic
  verification with a 7-class documented exit-code taxonomy, never invoked by CI, plaintext
  output on success only). The dry-run registry seed (`releases/registry.json`: schemaVersion 1,
  empty entries list) is a minimal P1-T5 schema fixture; `npm run validate` gates registry shape
  and append-only history, but does not invoke cryptographic `verify` (that remains a deliberate
  later-stage CLI verb, not a side effect of every validation run).

- **`tools/retro-validate/`** — Retrospective validation harness over synthetic/de-identified
  fixtures only (ADR-0006, ruling R6). Implements `check-fixtures` (two-layer de-identification
  gate: schema structural validation + procedural identifier-denylist scan), `run` (version-pinned
  deterministic replay of every corpus case through the engine, resolving the candidate build
  exclusively via registry `packDigest` match, never "current tree"; strips non-deterministic
  timestamps; writes canonical sorted-key `replay-output.json`), `report` (reads already-written
  replay-output, computes exactly 5 OQ-5 software-agreement measures each labeled "software
  agreement", applies a structurally-incapable-of-qualifying protocol shape gate with all
  threshold fields `const: null`, writes deterministic `agreement-report.json` + timestamped
  `run-provenance.json` sidecar), and `check-fixtures` (boundary validation). An access-log
  (`access-log.jsonl`) records invocation metadata (actor, purpose, corpus id, verb) with a
  per-entry hash chain (layer (b) append-only enforcement) across all three verbs. Every output
  artifact is deterministic byte-for-byte across re-runs over identical `(corpus, candidate-digest,
  registry)` tuples. The harness accepts only `provenance: {synthetic, deidentified}` cases and
  rejects identifier-bearing content fail-closed; running this harness against real, identified
  patient data remains structurally blocked and is gate **G3** (data-source SPIKE verdict + partner
  DUA), per `docs/governance/gates-registry.md`.

- **Canonical review-record schema unification (P1-T4–P1-T7)**: `schemas/review-record.schema.json`
  (P1-T4), `schemas/reviewer-roster.schema.json` (P1-T5), and `schemas/release-manifest.schema.json`
  (P1-T5) codify the review-record model, roster binding (reviewer identity, synthetic flag,
  module scope, role eligibility), and release-manifest shape (canonical content hash, dryRun
  boolean, detached Ed25519 signature, zero real-approval-path population). Every approval and
  signature slot ships with `maxItems: 0` (arrays) or `type: "null"` (signature objects), enforced
  by `scripts/validate-kb.mjs` at `npm run validate` time. No schema path, no task automation,
  and no test ever populates these slots with non-empty values — they exist for future gates G1/G2's
  human-credentialed sign-off, not E1.

- **Documented gates G0–G4 as external blocked states** (P5-T5): `docs/governance/gates-registry.md`
  records the five human-gated decision points this plan names but does not clear — G0 (ADR
  acceptance), G1 (named credentialed reviewer roster, cleared only by a named human's out-of-band
  credential verification, never a software check), G2 (release signing ceremony + custodian key
  generation), G3 (data-source SPIKE verdict + partner DUA), G4 (release authorizer — the human
  role whose signed review record is the only thing that may flip a module's status toward
  release-ready). Every gate is externally-blocked and human-owned, never software-clearable;
  each is modeled as an external, owner-blocked state in `.claude/progress/evidence-foundry-e1/`,
  never as a task, never with an automated completion path.

- **SPIKE-007 charter** (`docs/project_plans/SPIKEs/spike-007-retrospective-data-source.md`, FR-25,
  ruling R6): Authored (not run) as the charter for future gate G3's retrospective data-source
  selection (partner identity, DUA terms, retention period, deletion trigger, de-identification
  standard evidence). Running this SPIKE, negotiating with external partners, or moving patient
  data into the harness is out of scope for Evidence Foundry E1; the charter poses the research
  questions and exit criteria a future run must satisfy before G3 can be considered for clearance.

### Changed

- Replaced the boolean/unknown intake shape with an explicit four-state model
  (`present` / `absent` / `unknown` / `not-assessed`) across all 56 history, symptom, and exam
  fields. A field left `not-assessed` can no longer satisfy a rule-out or differential-clearing
  branch — missingness is never silently treated as a normal or negative finding.
- Numeric lab values (hemoglobin, MCV, RDW, RBC, WBC, ANC, platelets, ferritin, sTfR/ferritin
  index, blood lead level) are now checked against a closed unit table. A unit mismatch is
  rejected — fail-closed — at both the assess API and the browser assessment, instead of being
  silently accepted or converted.
- The server previously tolerated a missing knowledge-base manifest at startup. It now requires a
  signed manifest (content hash + supersedes chain) that matches the shipped knowledge base, and
  refuses to start or serve at all if the manifest is missing, invalid, hash-mismatched, or
  version-incompatible, or if a request's unit/age falls outside what the knowledge base supports.
  An evidence-staleness check exists in the same fail-closed path but is not yet active — no
  expiration window has been set — and that non-enforcement is disclosed at startup and via the
  knowledge-base API rather than passing silently.

### Added

- Evidence records now carry exact-passage provenance (source locator, exact passage, evidence
  grade, applicability) instead of a bare evidence-ID reference. Every rule and diagnostic pattern
  resolves to a passage record or an explicit `implementation-proposal` flag; as shipped, **all 91
  rules currently resolve to `implementation-proposal`**, not `source-supported` — none of the
  rule base is yet backed by an independently reviewed, verbatim-cited clinical source.
- Rules now carry governance metadata in the audit trail: version, effective/retire dates, owner,
  safety class, required test-case links, change rationale, and source passage. Every rule also
  carries a `clinicalApprovers[]` field that ships structurally empty across all 91 rules — no rule
  has received named, credentialed clinical sign-off, and the system is built to refuse treating
  any non-clinician source (including automated or AI-generated review output) as one.
- Added a semantic diff classifier for knowledge-base changes (flags rule additions/removals,
  threshold changes, and evidence changes as non-cosmetic) and a reproducible content-hash signing
  script, both used to produce the manifest above.
- Added property-based, boundary-value, mutation, and dangerous-miss test suites proving the rule
  engine's behavior against the shipped knowledge base (added to the existing suite; `npm test` now
  runs 967 passing subtests across 45 files). These are software-behavior tests, not clinical
  validation.

### Known issues (disclosed, not fixed in this release)

An independent adversarial "what would this engine miss that harms a child?" review of the
dangerous-miss suite recorded 19 findings (5 critical); none were fixed here because they are
clinical-content changes and this program's guardrails forbid AI-authored rule edits. Notable
open findings — see `.claude/findings/wave0-ep6-validation-corpus-findings.md`:

- Raw WBC/ANC/platelet counts are not wired into any rule, so a pancytopenia-with-fever
  presentation can currently return no alert at all.
- The browser assessment submits every untouched checkbox as confirmed-`absent` rather than
  `not-assessed`, which can defeat the new tri-state missingness protection at the input boundary.
- A malformed local reference range can coerce to 0, which can cause a severely low hemoglobin to
  be reported as "no anemia."
- The severe-anemia alert can be suppressed when sex-at-birth is not provided.
- A classic acute-leukemia presentation can currently return an empty assessment.

### Multi-Bundle Conversion (E1): Two New Module Scaffolds & Evidence-Layer Projections — zero new rules

This is a bookkeeping/scaffolding pass over already-vendored, verified `rf` (Research Foundry)
evidence bundles. **It produced zero new clinical rules and is not a content release or a step
toward one.** No executable rule, candidate, or reference-range logic was added, changed, or
approved in any module. Descriptive, source-attributed numeric thresholds do appear in the
evidence layer (e.g. `modules/kidney_suite_v1/evidence.json` and
`modules/growth_suite_v1/evidence.json` `supports[]` entries) as cited claims about what sources
say, not as active clinical logic — none of them is wired into any rule, candidate, or decision
path.

- Added two new greenfield module scaffolds, `modules/kidney_suite_v1/` and
  `modules/growth_suite_v1/`, registered in `src/modules/registry.js` and `src/facts/registry.js`.
  Both ship `module.json.status: "unsigned-stub"`, `approvedBy: []`, an `engineLabel` explicitly
  marked "not yet implemented", and empty `rules.json`/`candidates.json` (`[]`/`{}`) — neither
  module is usable for any patient population yet; both are registered only so the platform's
  multi-module plumbing (module/facts registries) can be proven end-to-end ahead of any real
  clinical content.
- Added evidence-layer projections for four modules: `modules/anemia/evidence-assertions.json`
  (35 assertions from `rf-ev-001`), `modules/kidney_suite_v1/evidence.json` +
  `evidence-assertions.json` + `unresolved.json` (73 assertions / 83 unresolved entries from
  `rf-kid-001`, including one named, un-averaged proteinuria-cutoff source conflict), and
  `modules/growth_suite_v1/evidence-assertions.json` + `evidence.json` + `unresolved.json`
  (79 assertions / 90 unresolved entries from `rf-gro-002` — 89 deferred-claim entries plus one
  named, un-averaged WHO-vs-CDC growth-standard source conflict). Every assertion resolves to a
  rights-restricted, hash-verified passage reference (`exactPassageSha256`), never a fabricated
  quote.
- **Provenance is split, not uniform, across these four projections — this distinction is
  load-bearing and must not be collapsed in any future summary:** only `rf-cbc-002` →
  `modules/cbc_suite_v1/` was produced by running the committed `tools/rf-bundle-to-kb-pack/`
  converter's `propose` verb end to end (deterministic, offline, test-proven byte-identical
  across clean re-runs). The other three projections above (`modules/anemia/`,
  `modules/kidney_suite_v1/`, `modules/growth_suite_v1/`) were **not** produced by that converter —
  it is hardwired by design to `cbc_suite_v1`'s own drafting content and structurally refuses to
  run without a per-module `authoring-decisions.yaml`, which does not yet exist for any of the
  other three modules (Deferred Item DF-E1-M1). Those three were instead hand-produced by bespoke,
  scoped, evidence-only generator scripts outside the converter, and are correctly labeled
  **bespoke evidence projections pending DF-E1-M1**, never converter output. `cbc_suite_v1`'s
  evidence layer is regenerable from a committed script
  (`scripts/evidence/backfill-cbc-002-evidence.mjs`), whose `run()` is imported and exercised by
  the test suite that `npm run check` runs. `anemia`'s evidence-layer generator script is also
  committed, at `scripts/evidence/oneoff/gen-anemia-evidence-assertions.py`; a path-resolution bug
  in the committed script (it resolved the repo root incorrectly and failed on any invocation) was
  fixed, and running it now reproduces the committed `modules/anemia/evidence-assertions.json`
  byte-for-byte (verified manually, 2026-07-22). It is **not**, however, wired into any test or
  `npm run check` — it is a standalone manual script with zero automated coverage, so
  reproducibility is not continuously enforced the way `cbc_suite_v1`'s is. Only
  `kidney_suite_v1`'s and `growth_suite_v1`'s generators remain uncommitted and unrecoverable
  from this repository or its history (see
  `.claude/findings/multi-bundle-conversion-e1-findings.md`, "Unreproducible-provenance gap").
- `npm run check` remains green across all four modules' updated artifact counts; `npm run
  validate` reports the expected per-module rule/candidate/evidence/assertion counts with zero
  schema errors. Nothing here changes the platform's clinical status: it is still an unvalidated
  research prototype, `clinicalApprovers[]`/`approvedBy[]` remain empty across every module, and
  no rule anywhere has received named, credentialed clinical sign-off.

### Evidence Foundry Buildout (E0): Converter & Module Scaffold

- Added `tools/rf-bundle-to-kb-pack/`, a deterministic Node ESM CLI converter that transforms verified Research Foundry evidence bundles into candidate knowledge-base package proposals. The converter accepts an `rf` run with `status: verified` and produces a gitignored staging directory (`build/kb-pack/`) containing module artifacts (rules, candidates, evidence records, governance metadata, and test traces) that require clinical review before being committed to a versioned module package. It is offline and deterministic: zero network calls and zero generative-model calls in any verb (test-enforced), byte-identical output across clean re-runs.
- Added `modules/cbc_suite_v1/`, a new module package holding a 4-rule vertical slice migrated through the converter. The package follows the same structure as `modules/anemia/` (module.json, index.js delegating fact derivation to the anemia module, rules.json, candidates.json, evidence.json, reference-ranges.json, plus new rule-provenance.json and evidence-assertions.json sidecars) and is registered in `src/modules/registry.js` and `src/facts/registry.js` (deliberately not `src/ranges/registry.js` — range resolution flows through the delegated anemia call; `DEFAULT_MODULE_ID` stays `anemia`). The module is unsigned and shipped as a proposal only — `module.json.status: "unsigned-stub"`, `approvedBy: []`; no rule is clinically approved and every rule's provenance is explicitly marked `implementation-proposal`.
- Added module-variable-envelope validation to `scripts/validate-kb.mjs` (the 8 §3.2 envelope fields are presence-checked for every module except the legacy pre-envelope `anemia` manifest) alongside real draft-2020-12 JSON-Schema validation of every module's rules.json, proven by a seeded-invalid fixture that fails `npm run validate` with a specific schema-violation message.
- Added 8 pre-E1 Architecture Decision Records (`docs/adr/0001`–`0008`), all at `status: proposed` — none accepted; they document deferred decisions (authoring model, passage licensing, terminology ownership, approval identity, signing/key custody, validation data boundary, surveillance cadence, discovery-lane hardening), not made ones.
- Added 10 deferred-item design specs plus a consolidated RFUP upstream-routing note, closing the plan's deferral-triage table.

## 0.3.1 — 2026-07-15

- Selecting a stage now folds the six-stage grid down to that stage so the decision specification becomes the focus; the grid re-expands from the collapsed card or the "Show all six steps" control.
- Added Previous/Next step controls to the collapsed pipeline, which move the decision specification between stages.
- Made the decision specification collapsible, matching the morphology deep dives.
- Added a sticky table of contents to the algorithm tab on desktop, with a scroll indicator, every section, and all six stages as clickable sub-entries.
- Stamped built asset URLs with a content hash so a deploy cannot serve new markup against cached code or an outdated knowledge base.

## 0.3.0 — 2026-07-15

- Replaced the static Algorithm tab with an interactive algorithm explorer: per-step evidence, data fields, executed expressions, worked examples, and outputs.
- Added `data/algorithm-explainers.json` (6 steps, 3 branches, 4 principles, 6 example cases) and `src/algorithmExplorer.js`.
- Added a live case walkthrough that runs the real rules engine over the shipped examples and can hand a case to the Assessment tab.
- Separated executed expressions from educational formulas, guideline thresholds, and implementation heuristics in the explainer copy.
- Preserved all 91 rules, 26 diagnostic patterns, six evidence records, and deterministic inference unchanged.

## 0.2.0 — 2026-07-15

- Rebuilt the browser interface as a responsive clinician workspace.
- Added six-stage intake navigation, live case snapshot, input-depth feedback, print controls, and direct audit access.
- Added desktop, tablet, mobile, and print layouts without changing deterministic clinical inference.
- Added static build output, deployment guidance, restrictive hosting headers, no-index controls, and smoke testing.
- Preserved all 91 rules, 26 diagnostic patterns, six evidence records, schemas, API behavior, and engine tests.

## 0.1.0 — 2026-07-15

- Initial deterministic pediatric anemia CDSS research prototype.
- Added AAP 2026 age/sex fallback CBC intervals and ferritin thresholds.
- Added 91 evidence-linked rules and 26 merged diagnostic patterns.
- Added browser-only clinician questionnaire and local audit export.
- Added stateless prototype REST API, JSON schemas, OpenAPI contract, Dockerfile, examples, and automated tests.
- Added research, clinical algorithm, architecture, data dictionary, validation, regulatory, privacy, and risk documentation.
