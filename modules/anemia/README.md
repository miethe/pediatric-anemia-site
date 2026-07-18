# `modules/anemia/`

The first package under the `modules/<id>/` contract (platform foundation refactor,
`docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md`, Phase 1).
This directory holds the pediatric-anemia module's knowledge-base content — relocated here
unmodified from `data/` (content is byte-identical to its prior `data/*.json` location; only
the path changed).

## Package file shape (Phase 1)

| File | Contents |
|------|----------|
| `rules.json` | The rule DSL array evaluated by `src/ruleEngine.js` (`schemas/rule.schema.json`). |
| `candidates.json` | Candidate/differential-pattern catalog keyed by candidate id (`schemas/candidate.schema.json`). |
| `evidence.json` | Evidence source records cited by rules and candidates. |
| `reference-ranges.json` | Local/AAP-fallback CBC reference-interval bands consumed by `src/referenceRanges.js`. |

`data/algorithm-explainers.json` and the top-level `examples/` directory are **not** module KB
content and intentionally remain outside this package for now (deferred item DEF-7 in the
implementation plan above).

This is a Phase 1 (equivalence-harness) stub: it documents today's file shape only. Later phases
in the same plan add `module.json` (manifest), `index.js` (module hook descriptor), and
`facts.anemia.js` (fact-derivation logic) to this directory without changing the four files above.
