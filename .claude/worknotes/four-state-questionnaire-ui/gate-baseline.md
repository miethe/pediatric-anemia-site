# Gate baseline — `npm run check` on `main` (recorded 2026-07-23)

The gate is **RED on `main` before this feature starts**. These failures are **pre-existing and
unrelated** to P3-WP7. This plan does **not** take ownership of fixing them.

**Acceptance criterion for this feature:** *no NEW failures versus this baseline.* A run showing
exactly these 8 failures and no others is a PASS for this work package.

## Baseline: 8 failures / 2786 tests (2778 pass)

Measured at commit `8c59db1` (worktree `worktree-plan-four-state-questionnaire-ui`), after
`npm run build`:

| # | Test |
|---|---|
| 336 | `modules/anemia/rules.json` and `evidence.json` are byte-identical to the P4-T1 pre-merge baseline |
| 789 | P4-T8: `modules/anemia/module.json` is whole-file byte-identical to its pre-phase content |
| 814 | P3-T1 AC2: manifest verb's signing preimage for the `cbc_suite_v1` real fixture equals the pinned golden-canonical-bytes fixture |
| 2132 | whole-file invariant targets are byte-identical to the P4-T1 baseline (R-1/R-2) |
| 2133 | every RF-CBC-001-era record hash is still present and byte-for-byte unchanged |
| 2138 | P4-T7: every RF-CBC-001-tagged source in `evidence.json` is unchanged, field-for-field |
| 2363 | D1: no third-party source document, reproduced table dump, figure, image, or brand asset exists anywhere in the working tree |
| 2364 | D1: no capture surface carries a verbatim span, a prohibited excerpt field, or a reproduced table |

Six are byte-identity/baseline pins; two are D1 rights-governance checks. Per project memory these
trace to the `mbce1f` work that shipped as draft PR #31 blocked on owner decisions D-1..D-4.

## ⚠ Operational trap for executors — build before test

Running bare `npm test` in a **fresh worktree** reports **10** failures, not 8. The two extra are
`dist/`-dependent and are artifacts of `dist/` not existing yet:

| # | Test (spurious in a fresh worktree) |
|---|---|
| 2029 | P6-010(a): all 8 `MODULE_KB_LOADERS` fetch specifiers resolve under both the dev and `dist/` layouts |
| 2125 | P6-008(c) `dist/` half — `dist/src/app.js` gets the same allow-list and token-scan assertions |

**Always run `npm run build` before `npm test`** (which is what `npm run check` does anyway). An
executor who runs bare `npm test` first will otherwise believe they broke two tests they did not
touch.
