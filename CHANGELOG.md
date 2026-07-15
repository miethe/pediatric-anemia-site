# Changelog

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
