---
schema_name: ccdash_document
schema_version: 2

doc_type: human_brief
doc_subtype: "feature_brief"
root_kind: project_plans

id: "BRIEF-spa-module-switcher"
title: "SPA Module Switcher — Human Brief"
status: draft
category: human-briefs

feature_slug: "spa-module-switcher"
feature_family: "spa-module-switcher"
feature_version: "v1"

prd_ref: "docs/project_plans/PRDs/features/spa-module-switcher-v1.md"
plan_ref: "docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md"
intent_ref: null
epic_ref: null

related_documents:
- .claude/worknotes/spa-module-switcher/decisions-block.md
- docs/project_plans/SPIKEs/spike-008-spa-module-switcher.md
- .claude/worknotes/spa-module-switcher/spike-leg-sq1-module-eligibility.md
- .claude/worknotes/spa-module-switcher/spike-leg-sq2-banner-truth-source.md
- .claude/worknotes/spa-module-switcher/spike-leg-sq3-failure-surface.md
- .claude/worknotes/spa-module-switcher/spike-leg-sq4-prior-art-reconciliation.md
- docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md

owner: nick
contributors: [Opus orchestrator, implementation-planner]

audience: [humans]

priority: high
confidence: 0.75

created: "2026-07-22"
updated: "2026-07-22"
target_release: ""

tags: [human-brief, spa, module-switcher, governance, fail-closed, honesty-boundary]
---

# SPA Module Switcher — Human Brief

> Living document for human orchestrators. Agents: do not load unless explicitly instructed.
> Status: draft | Updated: 2026-07-22

---

## 1. Context Pointers

- **PRD**: `docs/project_plans/PRDs/features/spa-module-switcher-v1.md` (FR-1..FR-36, AC-1..AC-10, OQ-1..OQ-4)
- **Plan**: `docs/project_plans/implementation_plans/features/spa-module-switcher-v1.md` (parent, 34 pts, 8 phases)
- **Phase files**: `spa-module-switcher-v1/phase-0-2-foundation.md` (governance + truth sources + seams), `phase-3-5-ui.md` (selector UI + fail-closed refusal + degradation), `phase-6-7-gates-docs.md` (gates + docs)
- **SPIKE-008**: `docs/project_plans/SPIKEs/spike-008-spa-module-switcher.md` (SQ-1..SQ-4, 5 Verified Corrections, RU-1..RU-7)
- **SPIKE legs**: `.claude/worknotes/spa-module-switcher/spike-leg-sq{1,2,3,4}-*.md` (module eligibility; banner truth source; failure surface; prior-art reconciliation)
- **Decisions Block** (binding, authoritative — D-1..D-5, not reopened by any phase): `.claude/worknotes/spa-module-switcher/decisions-block.md`
- **Mockups** (exploratory only, **non-binding** — PRD §14): `docs/dev/designs/mockups/spa-module-switcher/` — variants A (sidebar rail, chosen), B (header dropdown), C (interstitial card). Two known divergences from the shipped design: both A and C render CBC Suite as selectable (superseded by D-1/FR-4 — it must ship inert), and they apply "unsigned proposal · not clinically reviewed" more broadly than FR-10 allows.
- **ADR-0009** (authored in P0, `status: proposed`): `docs/adr/0009-module-eligibility-policy-for-clinician-facing-surfaces.md`
- **Upstream constraint this feature lifts**: `docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md` FR-14/R-8 (client-selectable `moduleId` prohibition, scope-bounded to E1)
- **Progress tracking** (created at execution time): `.claude/progress/spa-module-switcher/`

---

## 2. Estimation Sanity Check

_Migrated verbatim from `.claude/worknotes/spa-module-switcher/decisions-block.md` §4._

**Bottom-up total**: 34 pts / ~2–2.6 engineer-weeks (summing phase-file duration ranges: P0 0.5–1d, P1 0.5–1d, P2 1.5–2d, P3 2–2.5d, P4 2d, P5 1.5d, P6 2d, P7 0.5–1d ≈ 10.5–13 days).
**Top-down anchor**: E1 multi-bundle conversion (`multi-bundle-conversion-e1`, 30 pts, completed, PR #22).
**Reconciliation**: 34 pts sits ~13% above E1's 30, and that delta is expected, not a red flag — P3 (6 pts) carries a +30% load for an a11y/URL-state surface with no in-repo UI anchor (this is the SPA's first new panel since v0.1), and P6's gate-surgery on a source-grepping smoke test is comparably delicate to E1's own test-harness phase (#22). No unjustified compression is present.

**H1 — Noun count**: 2 new modules (`moduleManifests`, `moduleStatusVocabulary`) + 1 UI panel (selector rail + status banner) + 1 refusal state.

**H2 — Dual-implementation multiplier**: **N/A**. Browser-only; no server change (D-5) — `src/app.js` makes zero `/api/` calls and `server.mjs` is untouched.

**H3 — Algorithmic flag**: No. No merge, no diff/reconcile logic; this is a rendering/gating layer over an already-generic engine (`assess(input, moduleId, rules, candidates)`).

**H4 — Bundle-vs-sum**: Per-area sum = 34, matches the locked total with no compression.

| Phase | Pts | Anchor |
|---|---:|---|
| P0 | 3 | ADR-0004/0005 authoring precedent |
| P1 | 3 | `src/evidence/registry.js` P0 registry addition |
| P2 | 5 | P0 platform-foundation registry seam work |
| P3 | 6 | No in-repo UI anchor — SPA has had no new panel since v0.1; +30% for the a11y/URL-state surface |
| P4 | 5 | `showInputRejection` + `AGE_OUT_OF_SUPPORTED_RANGE` handling as the shape anchor |
| P5 | 4 | Tab-scoping across 4 panels |
| P6 | 5 | E1 conversion's test-harness work (#22) |
| P7 | 3 | E1 doc finalization |
| **Total** | **34** | Tier 3 confirmed |

**H5 — Anchor reference**: No single whole-feature UI anchor exists in this repo (first new SPA panel since v0.1), so anchors are drawn per-phase from the nearest analogous work (H4 table) rather than one whole-feature comparison. Where a genuine whole-feature anchor applies — P6's verification/gate-surgery phase — it is E1's own test-harness work (#22, 30 pts total).

**H6 — Hidden plumbing budget**: ~18%, folded inside the phase numbers rather than broken out (CHANGELOG, `check:imports` registration across 4 new app-surface files, nav-count neutralization, `index.html` copy across 8 sites).

**Locked estimate**: 34 pts (bottom-up; matches decisions block §4 exactly, ±0%).

---

## 3. Wave & Orchestration Notes

**Critical path**: P0∥P1 → P2 → P3 → P4 → P6 → P7 = 3 + 5 + 6 + 5 + 5 + 3 = **27 of 34 pts**. P0's 3 pts are absorbed by P1's concurrent 3 pts (zero added duration, while remaining a hard predecessor of P2). P5 (4 pts) carries float against the P4→P6 critical path.

**Parallel opportunities**: **P0 ∥ P1** (wave 1) is genuinely concurrent — disjoint file sets (`docs/adr/**` + one design-spec vs. `src/module*.js` + `check-app-imports.mjs` + one test). **P3 ∥ P5** is dependency-legal (decisions block §5) but **not schedulable as one wave** — both write `src/app.js` and `index.html`, declared serialization barriers in the plan's `wave_plan`, so P5 runs in its own wave after P4 and inherits a settled state machine instead of running concurrently.

**Merge order**: strict wave sequence `[P0,P1] → [P2] → [P3] → [P4] → [P5] → [P6] → [P7]`, `isolation: shared` throughout (no worktree isolation — no phase touches auth/payments/migrations/deletion). Serialization barriers declared at the plan level: `src/app.js`, `index.html`, `CLAUDE.md`.

**Cross-feature coupling**: Upstream dependency on E1 multi-bundle conversion (commit `263120b`, already merged), which registered the three non-anemia modules this feature switches between. No other in-flight feature currently touches `src/app.js`/`index.html` (repo is clean at `main`). The ARC clinical-council track is orthogonal — this feature authors no clinical rules for ARC to review, and `karen`'s milestone reviews here are this program's own reviewer gate, not a substitute for clinical sign-off.

---

## 4. Open Questions Ledger

_PRD OQ-1..OQ-4 and SPIKE-008 RU-1..RU-7. RU-1..RU-4 restate OQ-1..OQ-4 (same questions, SPIKE and PRD frame them identically); only the ledger's OQ rows are shown for those. RU-5..RU-7 are genuinely distinct._

| ID | Source | Question | Status | Resolved By |
|----|--------|----------|--------|-------------|
| OQ-1 (= RU-1) | PRD §13 / SPIKE | Selector form factor: persistent sidebar rail (mockup A) or interstitial card picker (mockup C)? | resolved | Plan "Decisions & OQ Resolutions" — rail (A); a one-time gate leaves no in-session reminder of the active module. Both mockups render CBC as selectable — **superseded by D-1/FR-4**. |
| OQ-2 (= RU-2) | PRD §13 / SPIKE | Does `#evidence` degrade to "unavailable" or render the module's own `evidence.json`? | resolved | Degrade (FR-26, P5-02). Every module has an `evidence.json` but growth/kidney lack loaders in `src/evidence/registry.js:39-50`; per-module view deferred as **DF-SMS-02**. |
| OQ-3 (= RU-3) | PRD §13 / SPIKE | Exact empty-state copy for `#rules` when `rules.length === 0`? | resolved | `"This module contains no rules. No assessment can be produced from it."` — lands in `src/moduleStatusVocabulary.js` (P1-02), pinned by P6-004. |
| OQ-4 (= RU-4) | PRD §13 / SPIKE | Does ADR-0009 need G0 ratification before merge? | resolved | `status: proposed` suffices (SQ-4 §4, matches ADR-0004/0005/0006). No G0–G4 gate blocks shipping the switcher. |
| RU-5 | SPIKE §Residual Unknowns / VC-3 | `cbc_suite_v1`'s 7 rule evidence IDs resolve to nothing (SQ-3 F9) — fix now or record? | deferred | Recorded as a finding + deferred item **DF-SMS-05** at P7-DOC-007. Unreachable while CBC stays `unsigned-stub`/inert under D-1; a live bug the moment CBC becomes selectable. |
| RU-6 | SPIKE §Residual Unknowns | `kidney_suite_v1` version drift: `module.json` declares `0.0.0-2026-07-22`, `evidence.json` declares `0.1.0-2026-07-22`. | open | **Not addressed by this plan.** Owner and fix path undetermined — flag if noticed again during P0-04's baseline check or any P2/P5 work touching `kidney_suite_v1`. |
| RU-7 | SPIKE §Residual Unknowns | Does the `tests/module-registry.test.mjs:24` `DEFAULT_MODULE_ID` tripwire flip or get rewritten? | resolved | Plan P6-010: `DEFAULT_MODULE_ID` **stays `'anemia'`** — it becomes the *initial* selection, not the *only* one. Decided deliberately, citing E1 FR-14/R-8 and ADR-0009 in the test comment, the registry comment, and the commit message. |

---

## 5. Deferred Items Rationale

_From the plan's Deferred Items Triage Table._

- **DF-SMS-01 — `sign-kb.mjs` per-module content hashing** (prereq): Deferred because `scripts/sign-kb.mjs:58-73` hardcodes anemia's file list, so every module's `clinicalContentHash` is currently computed over **anemia's** files. Fixing it is a prerequisite for any future integrity-hash UI, not for this switcher — FR-31's hash-surfacing prohibition keeps the defect off-screen in the meantime. Promote when anyone proposes surfacing a hash, `hashes.recomputed`, or per-module integrity status in a clinician-facing surface.
- **DF-SMS-02 — Per-module evidence view**: Deferred because it needs new growth/kidney loaders registered in `src/evidence/registry.js:39-50`, which is a registry-addition scope beyond this feature. Promote when a second module becomes `integrity-recorded`, or the evidence registry gains growth/kidney loaders.
- **DF-SMS-03 — `algorithmExplorer` module generalization**: Deferred because `src/algorithmExplorer.js` is anemia-shaped end to end (`anemiaWalkthrough`, `facts.cbc.*` accessors) and generalizing it is large — an explicit non-goal (R-8). This plan degrades the tab only. Promote when a second module becomes selectable and needs its own walkthrough.
- **DF-SMS-04 — Server `moduleId` API param**: Stays deferred for a **corrected** reason — the promotion trigger's "second module registered" clause fired (commit `263120b`), but its "a client needs to choose via the HTTP API" clause has not, since this switcher makes zero `/api/` calls. Promote when an HTTP client, not the browser SPA, needs to select a module.
- **DF-SMS-05 — `cbc_suite_v1` evidence-ID resolution gap** (tech-debt): Recorded as a **finding**, not a spec, because it is unreachable while CBC stays inert under D-1. Promote (i.e., fix before it ships) the moment `cbc_suite_v1` is proposed for `integrity-recorded` / selectability.

---

## 6. Risk Narrative

**This feature's failure mode is not a crash — it is a false impression.** Every risk below should be
read through that lens: the question during review is never only "does it work" but "could a
clinician reasonably misread this as more trustworthy, more complete, or more reviewed than it is."

- **R-1 — Four modules read as four peers** (High): The switcher's existence creates the exact risk it
  exists to prevent (`multi-bundle-conversion-e1.md:523`). Watch for a review pass that confirms "4 rows
  render" and stops there — the requirement is **two labelled structural groups** under the verbatim
  header "These modules are not peers. Read each row.", not four rows of equal visual weight with a
  disabled attribute as the only difference.
- **R-2 — Banner implies verification the browser never performed** (High): This is the single most
  probable *silent* failure. A reviewer can confirm the honesty-boundary sentence is present in the DOM
  and still miss that it renders in a tooltip (prohibited — it must be in-panel), or miss a stray
  "verified"/"approved" token that slipped in from the non-binding mockups' visual language (the
  mockups render CBC as selectable and over-apply the `unsigned-stub` subtitle — do not copy either).
  There is **no green state anywhere**, including for `anemia`.
- **R-3 — The smoke gate text-greps `app.js` source** (High likelihood): Not a correctness bug in the
  traditional sense — an unrelated refactor of `src/app.js`'s import lines or call sites can silently
  disable the SPA's only runtime regression guard (`scripts/smoke-browser-unit-rejection.mjs`). Because
  the assertions are exact-string matches (`:132,134,179,188,216-223`), a "cleanup" that also loosens the
  assertion to make it pass again is worse than the original break. **Extend, never rewrite** is the
  standing constraint on every phase that touches `src/app.js` or `src/engine.js`.
- **R-4 — Template-literal fetch specifiers defeat `?v=` stamping** (High): Would serve stale KB JSON to
  a clinician silently — the literal-keyed `MODULE_KB_LOADERS` map (P2-01) is the entire mitigation;
  watch for any later "simplification" that reintroduces a template-built specifier.
- **R-5 — `sign-kb.mjs` anemia hardcode** (Med impact, Low likelihood, but load-bearing if triggered): Out
  of scope for this feature, but if anyone proposes surfacing a hash in this UI as a "quick win" during
  execution, that is a signal to stop and re-read D-2/FR-31 — non-anemia hashes are currently `null` and
  masked, not genuinely computed; surfacing one would be an outright false attestation.
- **R-6 — `DEFAULT_MODULE_ID` tripwire flipped mechanically instead of deliberately** (Med): The danger
  is that a test assertion gets "fixed" without anyone reading why it exists. If the tripwire test passes
  but its comment (or the commit message) doesn't cite E1 FR-14/R-8 and ADR-0009 by name, that is itself
  a finding — independent of whether the assertion is green.

---

## 7. What to Watch For

- **The smoke-gate constraint is absolute**: if any phase-owner proposes rewriting
  `scripts/smoke-browser-unit-rejection.mjs` because grep-based assertions "feel fragile," that proposal
  *is* R-3 materializing. Require `git diff` on that file to show additions only — `:132, :134, :179,
  :188, :216-223` must survive byte-for-byte.
- **Do not treat the mockups as spec.** They are explicitly non-binding (PRD §14) and contain two known
  divergences (CBC rendered selectable; the `unsigned-stub` subtitle over-applied). Useful for layout and
  token exploration only — correct any executor who cites a screenshot as the source of truth for
  behavior.
- **`karen`'s four milestone reviews (P2, P4, P6, end-of-feature) are scoped around honesty, not just
  function** — re-read the "why this phase gets karen" prose in the P2/P4/P6 phase-file sections; the
  review questions are phrased "does anything imply X" not "does X work."
- **Watch language in progress notes and commit messages** during P3–P5: phrases like "CBC now
  selectable," "growth module working," or "content verified" would all be false statements even as
  imprecise shorthand — the same failure mode multi-bundle-conversion-e1's own brief flagged for rule
  fabrication under pressure.
- **P6 is the highest silent-failure-risk phase precisely because success is defined as `npm run check`
  green.** A green gate proves the things the gate checks for — it does not prove nothing was missed by
  omission in the test's own design. Spot-read the actual assertions in P6-004 (doc-truth pin) and P6-008
  (negative-assertion test) rather than trusting the pass/fail status alone.
- **The two disclosures (FR-13 honesty boundary, FR-34 staleness non-enforcement) must render in the
  panel, not a tooltip.** A tooltip implementation would pass a naive "the string exists somewhere in the
  DOM" test while defeating the actual requirement — visually confirm placement during any review, don't
  only grep for the string.
- **`kidney_suite_v1`'s version drift (RU-6)** is not fixed by this plan — if it resurfaces during P2/P5
  work, it should be logged, not silently corrected as an unrelated drive-by edit.

---

## 8. Expected Success Behaviors

Human-verifiable, drawn from the PRD's Overall Acceptance Criteria (§11):

- [ ] Open the SPA. See **four modules** listed in a persistent sidebar rail, grouped under **two
      labelled headings** — not one flat list of four equally-weighted rows.
- [ ] Read the panel header verbatim: *"These modules are not peers. Read each row."*
- [ ] Confirm **three** rows (CBC Suite, Growth Suite, Kidney Suite) are visibly inert — not merely
      dimmed, not clickable — and each states its own real reason (status + `limitations()` text), never
      "coming soon," "preview," or "beta."
- [ ] Select Anemia. It runs and produces a real assessment (candidates, alerts, notes render as today).
- [ ] Try selecting Growth or Kidney (or hand-edit `?module=growth_suite_v1` in the URL). Confirm a
      **distinct refusal screen** appears — never "Check the entered units," never the word "undefined"
      anywhere on screen, and never a silent fallback to the Anemia assessment.
- [ ] Confirm **no module anywhere — including Anemia — shows a green checkmark, "verified," "approved,"
      or "released" badge**, or any visual treatment reading as more trustworthy than the others. Anemia's
      status line reads "content hashes recorded only" and carries the **same** visual severity as the
      scaffolds.
- [ ] Read the active module's banner and confirm, **in the panel itself (not a hover tooltip)**: the
      browser has not verified the manifest — no content digest was recomputed, no schema was validated,
      no check confirms the loaded rules are the signed ones.
- [ ] Confirm **every** module's banner — including Anemia's — states "no credentialed clinician has
      reviewed or approved this module."
- [ ] Switch to `#evidence`, `#rules`, and `#algorithm` while a non-anemia module is selected; confirm
      each shows an explicit "not available for this module" state — never a blank panel, never anemia's
      data under the wrong label.
- [ ] Switch tabs while `?module=` is in the URL; confirm the query string survives the switch instead of
      silently disappearing.
- [ ] Confirm the examples dropdown is empty and disabled under any non-anemia module.
- [ ] Confirm the page title, header, and footer read the **selected module's own name** — never anemia's
      `KNOWLEDGE_BASE_VERSION` displayed under another module's banner.
- [ ] Run `npm run check`; confirm green.

---

## 9. Running Log

- [2026-07-22] Brief created alongside the PRD and Implementation Plan, migrating decisions-block §4
  estimation material verbatim per the plan's load-bearing pointer.
