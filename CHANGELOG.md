# Changelog

## [Unreleased]

Wave-0 Safety Foundation program (EP-1 through EP-6). This is still an unvalidated research
prototype: the items below describe software behavior only and prove nothing about clinical
validity, safety, diagnostic performance, or regulatory status.

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
