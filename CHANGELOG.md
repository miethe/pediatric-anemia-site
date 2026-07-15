# Changelog

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
