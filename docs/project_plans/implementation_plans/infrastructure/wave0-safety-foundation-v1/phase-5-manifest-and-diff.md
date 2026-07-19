---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-5: Manifest & Semantic Diff"
status: draft
created: 2026-07-19
phase: EP-5
phase_title: "Manifest & Semantic Diff"
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
feature_slug: wave0-safety-foundation
entry_criteria: "EP-3+EP-4 closed: evidence and rule governance fields complete on all 91 rules."
exit_criteria: "Manifest verifies; unverifiable/expired KB refused at startup; seeded diff correctly classifies a seeded change set; npm run check green."
---

# Phase EP-5: Manifest & Semantic Diff (WP5)

**Maps to roadmap/PRD WP5.** **10 pts** (see SPIKE-006 Contingency Branch below — this is a
conservative ceiling, not a guaranteed cost).

**Dependencies**: EP-3+EP-4 complete (this phase hashes/attests to their output; signing an unfinished
KB is meaningless).
**Assigned Subagent(s)**: `backend-architect` (diff design); `code-reviewer` (fail-closed paths).
**Entry criteria**: EP-0's SPIKE-005 design (change-class taxonomy, seeded-mutation corpus) and
SPIKE-006's signing recommendation (EP0-T5) both available.
**Exit criteria**: `server.mjs` refuses to start/serve on a missing/invalid/expired/incompatible
manifest; every seeded safety-relevant mutation is flagged non-cosmetic by `kb-diff.mjs`; `npm run
check` green.

## SPIKE-006 Contingency Branch (signing scope — encode explicitly, do not assume)

SPIKE-006 (executed in EP-0-T5) leans toward recommending **deferral of real cryptographic signing** in
favor of `clinicalContentHash` (SHA-256) + a `supersedes` manifest chain — expected per the charter, not
guaranteed.

- **Branch A (expected)** — SPIKE-006 confirms deferral: EP5-T1 ships `clinicalContentHash` +
  `validationRunId` + the `supersedes` chain; real asymmetric signing is explicitly deferred with a
  written rationale in this plan (D-5-adjacent: a signature attesting to approvals that never happened
  is worse than no signature, per D-4's logic). **This is the branch EP5-T1's estimate below assumes.**
- **Branch B (contingent)** — SPIKE-006 instead recommends real signing: EP5-T1 additionally implements
  asymmetric key generation, signing, and browser-side verification. **Adds ~3 pts to EP5-T1** (bringing
  the phase total to ~13 pts). **Re-baseline this plan's total (68 → 71) before EP-5 proceeds if this
  branch is taken** — do not silently absorb the delta into other tasks' estimates.

Whichever branch: this phase requires verifiability and fail-closed behavior, not a specific signature
algorithm (PRD FR-WP5-01, OQ-3).

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EP5-T1 | `scripts/sign-kb.mjs` — KB signing (Branch A default) | Per FR-WP5-01 and D-4: compute `clinicalContentHash` (SHA-256) over the canonicalized concatenation of `modules/anemia/{rules,candidates,evidence,reference-ranges}.json`; `validationRunId` from the equivalence-harness/CI run that produced the build; `supersedes` chain per SPIKE-006's recommendation. `approvedBy[]` ships empty per D-4 — **see Contingency Branch above** if SPIKE-006 instead recommends Branch B. | Hash is reproducible on two clean runs against unchanged input; `approvedBy[]` is asserted empty by a dedicated test (reinforcing EP4-T3, this time at the manifest layer) in any unsigned/pre-validation build. | 2.0 pts | backend-architect | sonnet | high | Entry (EP-3+4 output available to hash) |
| EP5-T2 | `schemas/kb-manifest.schema.json` | Per FR-WP5-02: formalize ARCH §6's shape, superseding `module.json`'s current field-presence-only checks (DEF-5). | Schema validates today's `module.json` stub plus the new signing fields once populated by EP5-T1. | 1.0 pt | backend-architect | sonnet | high | EP5-T1 |
| EP5-T3 | `scripts/kb-diff.mjs` — semantic diff classifier | Per FR-WP5-03: implement SPIKE-005's design (EP0-T3/T4) — classify rule-add/remove/threshold-change/evidence-change. This is the hardest implementation task in the phase (H3, genuinely algorithmic). | The classifier correctly categorizes every change class in SPIKE-005's taxonomy; every seeded safety-relevant mutation from the SPIKE-005 corpus is flagged non-cosmetic. | 3.0 pts | backend-architect | sonnet | xhigh | EP-0 (SPIKE-005 design) |
| EP5-T4 | Seeded adversarial diff pass (Risk 2 mitigation) | Cross-family adversarial review tasked explicitly with "find a safety-relevant change this classifier misses" against EP5-T3's implementation — adversarial by construction, mirroring EP0-T4's posture against SPIKE-005's design. | Every seeded mutation from SPIKE-005's corpus is confirmed correctly flagged; any newly-discovered under-reporting case is either fixed in EP5-T3 or explicitly filed as a follow-up before this phase seals. | 1.0 pt | backend-architect | gpt-5.6-sol (`codex exec`) | xhigh | EP5-T3 |
| EP5-T5 | Flip `server.mjs` to required-and-verified manifest handling | Per FR-WP5-04: flip today's tolerant-of-absence handling (`:26-31`, catches `ENOENT`, continues with `manifest: null`) to required-and-verified. | Server refuses to start/serve on a missing, invalid, expired, or incompatible manifest — this is a behavior change to the startup fail-fast path, not an addition. | 1.5 pts | backend-architect | sonnet | high | EP5-T1, EP5-T2 |
| EP5-T6 | AC-FAILCLOSED — implement + test all 5 ARCH §10 conditions | target_surfaces: `server.mjs`, `src/units.js`, `src/ranges/registry.js`, `src/app.js` (browser-mode verification path). propagation_contract: (1) unit absent/incompatible → reject at EP-2's boundary; (2) age outside supported range with no local limits → refuse to assess (not merely narrow limitations text); (3) KB signature/hash invalid → server refuses to start/serve; (4) UI/engine version incompatible → reject; (5) evidence expired vs. `evidenceReviewedThrough` governance policy → reject. | resilience: failure state is a displayed "no assessment produced," never stale or partial output. verified_by: EP2-T4, EP5-T5, EP-6's boundary/dangerous-miss suites. All 5 conditions have a corresponding automated test — today zero of 5 do. | 1.0 pt | code-reviewer | sonnet | high | EP2-T4, EP5-T5 |
| EP5-T7 | FR-WP5-05 / AC-WP5-RESIL — consumers handle legitimately-empty manifest fields | target_surfaces: `server.mjs` (KB load path), `scripts/sign-kb.mjs`, `scripts/validate-kb.mjs`, `modules/anemia/module.json`/kb-manifest. propagation_contract: server startup verification reads `clinicalContentHash`/`approvedBy`/`validationRunId`/`supersedes`. A first release's `supersedes: null` is valid (no prior version) and `approvedBy: []` is valid per D-4 — both legitimately empty. | resilience: by contrast, `clinicalContentHash`/`validationRunId` missing or `status !== verified` must fail closed (reject, do not serve) — the server must never conflate "legitimately empty" with "must-not-be-empty-to-serve." verified_by: EP5-T1, EP5-T5. | 0.5 pts | code-reviewer | sonnet | adaptive | EP5-T5 |

**Phase total: 10 pts (Branch A default; ~13 pts if Branch B — see Contingency above).**

## Phase EP-5 Quality Gates

- [ ] `clinicalContentHash` reproducible on two clean runs against unchanged input (EP5-T1)
- [ ] `approvedBy[]` test-enforced empty at the manifest layer (EP5-T1, reinforcing EP4-T3)
- [ ] Semantic diff classifier flags 100% of the SPIKE-005 seeded safety-relevant mutations as
      non-cosmetic (EP5-T3/T4)
- [ ] Server refuses to start/serve on missing/invalid/expired/incompatible manifest (EP5-T5)
- [ ] All 5 ARCH §10 fail-closed conditions have a passing automated test (EP5-T6)
- [ ] AC-WP5-RESIL: legitimately-empty fields never conflated with must-not-be-empty fields (EP5-T7)
- [ ] SPIKE-006 signing branch (A or B) explicitly recorded, not assumed
- [ ] `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../wave0-safety-foundation-v1.md)
