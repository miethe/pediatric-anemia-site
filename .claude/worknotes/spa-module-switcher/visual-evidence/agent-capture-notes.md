# P6-011 evidence packet — AGENT-CAPTURED, AWAITING HUMAN REVIEW AND SIGNATURE

> **Honesty boundary (binding).** These images and observations were captured by the orchestrating
> agent (Claude Fable 5) driving Chrome against the built `dist/` (post-P5 build, branch
> `worktree-spa-module-switcher-exec`, served locally). Per the plan, **P6-011 is a human task**:
> these are *agent observations*, not test results and not P6-011 itself. P6-011 is complete only
> when a **named person** reviews each item (re-driving the page themselves or reviewing these
> captures), records pass/fail per AC in `phase-6-progress.md`, and signs by name. Nothing below
> may be cited as "verified".

## Capture inventory (all ≥1440px logical width, 2026-07-22)

| File | P6-011 item | What the agent observed |
|---|---|---|
| `p6011-item6-default-load-anemia-1440.jpg` | (6) default load [AC-9]; (2) anemia banner [AC-3] | Loads on Pediatric Anemia; collapsed header control shows title + `integrity-recorded` chip; banner carries canonical sentence ("recorded only"), FR-9 clause, FR-34 staleness disclosure adjacent to the date, FR-13 honesty boundary — all in the panel. No green/success state anywhere. |
| `p6011-item1-panel-groups-top-1440.jpg` | (1) module panel, both groups [AC-1] | Verbatim header `These modules are not peers. Read each row.`; SELECTABLE group (anemia) and NOT SELECTABLE — READ THE REASON group; CBC + Kidney rows visible with lock glyphs, status chips, verbatim status sentences; FR-10 subtitle on stubs only. |
| `p6011-item1-panel-groups-bottom-1440.jpg` | (1) continued | Kidney + Growth rows (panel scrolled); Growth's self-authored scaffold limitation text; no layout collision (post-fix). |
| `p6011-item2-3-cbc-banner-refusal-1440.jpg` | (2) scaffold banner [AC-3]; (3) refusal [AC-4] | Deep link `?module=cbc_suite_v1`: banner swaps to `unsigned-stub` truth with FR-10 subtitle; refusal card "No assessment produced — Pediatric CBC Suite"; no results panel; Run assessment + Load example disabled; **no "Check the entered units"**; no `undefined` on screen; page chrome (title/h1/brand) module-derived. |
| `p6011-item4-algorithm-growth-1440.jpg` | (4) `#algorithm` under non-anemia [AC-6] | Tab visually disabled in nav; panel shows "Algorithm explorer — not available for Pediatric Growth Suite"; explorer content absent. |
| `p6011-item4-5-evidence-footer-growth-1440.jpg` | (4) `#evidence` [AC-6]; (5) footer [AC-7] | "No evidence view is available for Pediatric Growth Suite." — no empty-but-present source list; sidebar KB block shows growth's own `0 rules · 0 patterns`; footer reads "Pediatric Growth Suite Decision Support" with growth's own reviewed-through date (2026-07-21, not anemia's 07-15). |
| `p6011-item4-rules-growth-1440.jpg` | (4) `#rules` [AC-6] | Exact OQ-3 string: "This module contains no rules. No assessment can be produced from it." |
| `p6011-item7-forced-activation-refusal-1440.jpg` | (7) forced activation [AC-11] | After removing `disabled`/`aria-disabled` from the CBC row via script and activating it: header + banner swap to CBC `unsigned-stub`, refusal state renders, submit disabled, URL updates to `?module=cbc_suite_v1`. **No assessment was produced.** |

## Non-screenshot check outcomes (agent-performed, to be re-performed or countersigned by the human)

- **(7) Forced activation [AC-11]**: performed twice (pre-fix: silent no-op; post-fix: full refusal
  state as pictured). Outcome: **refusal, never an assessment**. The eligibility decision is made
  inside the handlers from the manifest predicate — DOM state removal did not bypass it.
- **(8) DOM hash search [AC-8]**: programmatic search of the live DOM under `?module=cbc_suite_v1`:
  `sha256:` absent from `documentElement.outerHTML`; zero `data-*` attributes containing
  hash-shaped values; zero `title=` attributes carrying the honesty-boundary or staleness
  disclosures (i.e., no tooltip smuggling). Also re-checked on the anemia default load during the
  P4 pass: clean.
- **Tab-switch query preservation [AC-5]**: after `#evidence` → `#rules` switches under growth, the
  URL remained `?module=growth_suite_v1#rules` (R-7 fix observed working).
- **End-to-end anemia regression**: worked example loaded, assessment ran (Anemia Present, Hb 8.4
  g/dL), audit JSON downloadable, no `undefined` — the switcher did not break the existing module.

## Known gaps the human pass must close (not established here)

1. **375px capture [AC-1]**: the agent's window-resize attempts clamped at the OS minimum
   (~1512px logical viewport persisted); genuine 375px verification needs devtools device
   emulation — **not captured; still owed**.
2. **Hover pass [AC-3]**: the agent verified programmatically that no `title=` attribute carries
   the disclosures, but did not perform an exhaustive visual hover sweep.
3. **Assistive-technology announcement**: `aria-disabled`/accessible-name content was read from the
   DOM, not through a screen reader.
4. **Residual form state**: after switching away from anemia with an example loaded, input fields
   keep their values (results/audit/picker are cleared) — flagged by the P5 gate as consistent
   with existing FR-19 behavior; the human should judge whether it reads as misleading under a
   scaffold module.

## Sign-off block (to be completed by a named person — not an agent)

```
Reviewer name: ______________________
Date: ______________________
Per-item verdicts (1-8 + 375px): recorded in .claude/progress/spa-module-switcher/phase-6-progress.md
Findings (if any): logged to .claude/findings/spa-module-switcher-findings.md
```
