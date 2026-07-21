# `karen` milestone sign-off — Phase 2: Converter Core (EF-WP0)

- **Gate**: P2-GATE2 (`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-1-2-foundation-converter.md`, line 61)
- **Milestone**: 1st of 3 named `karen` milestones (decisions block §4) — "converter core"
- **Runs after**: P2-GATE1 (`task-completion-validator`), recorded at
  `.claude/worknotes/ac-validation/20260721-evidence-foundry-buildout-p2-ac-check.md` — 20/21 AC
  lines MET, the sole NOT MET being this sign-off itself.
- **Reviewer**: `karen` (independent milestone review, adaptive effort, sonnet)
- **Date**: 2026-07-21
- **Scope reviewed**: the actual committed diff at `tools/rf-bundle-to-kb-pack/**` and
  `tests/ef-converter-*.test.mjs` (commits `ee9566f`..`ff7f9b1`, P2-T1..T8), re-derived independently
  from source and a fresh unsandboxed test run — not taken from the plan's or P2-GATE1's description
  of it.

## 1. 15/15 seam-invariant claim — independently re-checked

Re-ran the full converter suite directly in this worktree (unsandboxed):

```
node --test tests/ef-converter-*.test.mjs
# 90 pass / 0 fail / 0 cancelled / 0 skipped  (loader 9, hashing 5, eligibility 29,
# error-taxonomy 11, inspect 6, verify 13, invariants 17)
```

Opened `tests/ef-converter-invariants.test.mjs` directly (not the plan's summary of it) and confirmed:

- The file's header comment carries a literal `#1..#15 -> topic` cross-check table.
- `grep -n '^test(' tests/ef-converter-invariants.test.mjs` returns exactly 17 top-level `test()`
  calls: 15 titled `"Invariant <n>: ..."` for `n = 1..15` (verified each number 1-15 appears exactly
  once, none skipped or renumbered) plus 2 additional cross-cutting `"Zero-network/zero-LLM: ..."`
  tests. All 17 pass in the run above.
- Invariants 1-6 and 13-15 are re-proved independently in this file (not merely referenced), on top
  of their dedicated coverage in `ef-converter-loader`/`hashing`/`eligibility`/`verify`/`inspect`/
  `error-taxonomy` — satisfying the task's own "15/15, not most" acceptance bar without relying on a
  single point of coverage per invariant.

**Finding: MET.** The 15/15 claim holds against the actual test file content and a fresh unsandboxed
run, not merely the plan's assertion of it.

## 2. Fail-closed exit-code taxonomy — independently re-checked

Read `tools/rf-bundle-to-kb-pack/lib/errors.mjs` and `tools/rf-bundle-to-kb-pack/cli.mjs` directly:

- All 8 `02 §5.2` exit codes (0 OK, 1 USAGE, 2 SCHEMA, 3 GOVERNANCE, 4 UNSUPPORTED, 5 BUDGET,
  6 ADAPTER, 7 HUMAN_REVIEW) have a distinct named `ConverterError` subclass, registered in a frozen
  `ERROR_CLASSES_BY_EXIT_CODE` lookup.
- `ConverterError.exitCode` is defined via `Object.defineProperty(..., { writable: false, ... })` —
  a catch site that tries to reassign it throws a `TypeError` rather than silently diluting a
  GOVERNANCE/HUMAN_REVIEW code, turning "must not be mutated" from a comment into an enforced
  invariant.
- `cli.mjs`'s single generic handler, `dispatchVerb()`, forwards `err.exitCode` verbatim for any
  `ConverterError` and only falls back to `EXIT_USAGE` for an unclassified/programmer error — it
  never remaps a `ConverterError`'s own code.
- `tests/ef-converter-error-taxonomy.test.mjs` (11/11 pass) asserts `isHaltingExitCode()` is `true`
  for exactly {3, 7} and includes direct tests that GOVERNANCE and HUMAN_REVIEW specifically reach
  `dispatchVerb`'s `ConverterError` branch, not the generic `EXIT_USAGE` fallback.

**Finding: MET.** Exit 3 (governance) and exit 7 (human-review) halt and surface distinctly by
construction (non-writable exit code + a single non-remapping dispatcher), and this is
test-enforced, not merely asserted in comments.

## 3. CLAUDE.md hard guardrails — independently re-checked against the actual diff

**"No generative model in the decision path":**
- `grep -rniE 'anthropic|openai|gemini|claude|generat.*model|llm|@anthropic-ai|fetch\(|http\.request|https\.request' tools/rf-bundle-to-kb-pack/` returns zero hits outside of comments/docstrings
  that *state* the zero-network/zero-LLM posture (`cli.mjs`, `eligibility.mjs`, `inspect.mjs`,
  `verify.mjs`) — no import of a network or AI/model-SDK module anywhere under the tool.
  `tests/ef-converter-invariants.test.mjs`'s "no file ... imports a network or AI/model-SDK module
  (structural)" test and its runtime-spy counterpart both pass, providing test-enforced coverage
  beyond this manual grep.
- Confirmed by direct code reading, not the plan's description: `inspect`/`verify`/`propose` are
  pure read-transform-print operations over local files.

**"No invented thresholds":**
- Read `tools/rf-bundle-to-kb-pack/lib/eligibility.mjs` directly. The only numeric literal
  resembling a clinical constant is `bundleYear - publishedYear >= 5` in
  `sourceIsStaleWithoutRationale()` — this implements `02 §3.7`'s "recency" row (sources >5y old
  need a stated non-superseded rationale), a plan-specified staleness check over metadata dates, not
  a clinical lab threshold, and it explicitly does not assert staleness when a date fails to parse
  ("no invented judgment from absent data").
- `checkSourceAgainstFieldTable()` reads `pediatricCds?.threshold?.value` only to check *presence*
  (does a threshold value carry lab context: assay method, etc.) — it never sets, computes, or
  substitutes a threshold value itself. The code's own comment block explicitly disclaims
  "threshold portability" as an authoring decision this converter has no authority to make in
  Phase 2, deferring it to `authoring-decisions.yaml` (P3-T1).
- No other file under `tools/rf-bundle-to-kb-pack/` contains a bare numeric clinical constant.

**Finding: MET** for both guardrails, verified against the actual source, not the plan's or
P2-GATE1's restatement of it.

## Gap check

No gap surfaced by this independent re-check. No new task is required before Phase 3 opens.

## Disposition

**`karen` sign-off: PASS.** Phase 2 (Converter Core, EF-WP0) satisfies P2-GATE2's three checks —
15/15 seam-invariant tests, the fail-closed exit-code taxonomy, and the two named CLAUDE.md hard
guardrails — against the real diff. PHASE2-GATE-AC5 is now MET; Phase 3 may open.
