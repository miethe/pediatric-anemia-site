---
schema_version: 2
doc_type: phase_plan
title: 'Phase EP-0.5: Activation-Witness Corpus'
status: completed
created: 2026-07-19
phase: EP-0.5
phase_title: Activation-Witness Corpus
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
feature_slug: wave0-safety-foundation
entry_criteria: 'EP-0 complete (PR #4 merged); npm run check green on main.'
exit_criteria: Every one of the 49 rules in SPIKE-003's migration table has at least
  one activation witness; all 6 never-firing ALERT rules have a witness; scripts/rule-coverage.mjs
  exists and is wired into npm run check as a ratchet. npm run check green.
updated: '2026-07-19'
---

# Phase EP-0.5: Activation-Witness Corpus

**Inserted after EP-0 by amendment (2026-07-19).** No WP counterpart — this phase exists because EP-0
proved the plan's original sequencing unsafe.

## Why this phase exists

EP-0 measured what the 6-fixture golden corpus actually exercises. The result:

- **30 of 91 rules** have an activation witness. **61 never fire** — including `ALERT-001`, `-002`,
  `-003`, `-006`, `-007`, `-008`.
- **EP-1 migrates 49 rules. Only 17 have a witness. 32 migrate blind** — including 3 alerts and both
  `TEC-001` and `IRIDA-001`, the two rules SPIKE-003 carved out of its GO verdict as needing extra
  clinical review.

SPIKE-003's headline safety result — "all 6 golden fixtures byte-identical under atomic migration" —
is therefore much weaker than it reads. It is a statement about 17 of the 49 rules being changed.

Three independent EP-0 findings converged on the same gap:

1. SPIKE-003's prototype showed a *staged* rollout silently breaks a fixture with **zero test
   failures** — the suite cannot be relied on to catch mis-sequencing.
2. SPIKE-005 found the behavioral backstop (`kb-behavior-probe.mjs`) is corpus-gated, so it inherits
   corpus blindness wholesale.
3. EP0-T4's adversarial lens verified **M57**, a change where the structural classifier *and* the
   behavioral probe both report clean while patient-facing output changes (0/6 fixtures moved).

**A corpus-gated safety net cannot be built before the corpus.** This phase supplies the witnesses
that EP-1's migration, EP-5's probe, and EP-6's adversarial suite all depend on.

**Dependencies**: EP-0 complete.
**Assigned Subagent(s)**: `general-purpose` (fixture authoring), `code-reviewer` / adversarial reviewer
(clinical plausibility gate).
**Blocks**: EP-1 (migration verification), EP-5 (probe), EP-6 (adversarial corpus builds on this base).

## Scope discipline — what this phase is NOT

This is **not** EP-6. It does not build the adversarial/dangerous-miss corpus, does not consume ARC's
10 DM-* families, and does not attempt property/boundary testing. It does exactly one thing: give every
rule EP-1 will touch, plus every uncovered alert, a minimal input that makes it fire, so that a
migration diff is observable.

**No new clinical claims, no new or retuned thresholds.** Fixtures must be constructed from thresholds
already in the KB. A fixture that requires inventing a cutoff is out of scope and must be escalated,
not authored.

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|-------------|---------------------|----------|-------------|-------|--------|--------------|
| EP05-T1 | Build the coverage instrument | Add `scripts/rule-coverage.mjs`: run every fixture through `assess()`, union `provenance.matchedRuleIds`, report per-rule witness status and a total. Must support `--json` and a `--min` ratchet flag that exits non-zero below a threshold. | Script exists; reports the current baseline (30/91) correctly; `--json` output is machine-readable; `--min` fails below its argument. Negative-tested: deleting a fixture drops the count. | 1.0 pt | general-purpose | sonnet | medium | None |
| EP05-T2 | Witness the 32 blind migrated rules | Author minimal fixtures giving an activation witness to each of the 32 rules in SPIKE-003's 49-row migration table that currently never fire (24 candidate, 3 alert, 3 note, 2 question — enumerated in the AAR). Reuse/extend existing fixtures where one input can witness several rules; do not author 32 separate files if 8 will do. | All 32 rules appear in some fixture's `matchedRuleIds`. `scripts/rule-coverage.mjs` confirms. No new thresholds introduced; every fixture's values trace to existing KB ranges. | 3.0 pts | general-purpose | sonnet | high | EP05-T1 |
| EP05-T3 | Witness the 6 uncovered ALERT rules | `ALERT-001`, `-002`, `-003`, `-006`, `-007`, `-008` currently have no activation witness. Three (`-001`, `-002`, `-006`) overlap EP05-T2; this task covers the remainder and asserts alert **severity and output type**, not merely that the rule fired. | All 6 fire in at least one fixture; each assertion checks `severity` and `output.type`, so an alert→note downgrade (mutation M55) fails the suite. | 1.5 pts | general-purpose | sonnet | high | EP05-T1 |
| EP05-T4 | Close the M57 class — cover the branch seam | Add fixtures for the `modules/anemia/ranges.js` decision branches that no rule uniquely pins, starting with the verified M57 case: a menstruating patient **under 144 months** with ferritin between 20 and 30. Assert the resolved ferritin threshold and its rationale, not just the final differential. | Applying the M57 mutation (deleting the `menstruating === true` branch) now **fails** the suite. Verified by executing the mutation, observing failure, and restoring. Same check for the adolescent-band and young-child branches. | 1.5 pts | general-purpose | fable | extended | EP05-T1 |
| EP05-T5 | Clinical plausibility review of new fixtures | Every fixture authored in T2–T4 is an assertion about a synthetic patient. Adversarially review the set for clinically incoherent inputs (impossible lab combinations, contradictory history) that would make a test green for the wrong reason. | Each new fixture is reviewed; incoherent ones are corrected or removed with rationale recorded. Reviewer states explicitly what it checked. **Not clinical validation** — this is coherence review only, and must be labelled as such. | 1.0 pt | code-reviewer | gpt-5.6-sol (`codex exec`) | high | EP05-T2, EP05-T3, EP05-T4 |
| EP05-T6 | Wire the ratchet into CI | Add `rule-coverage --min` to `npm run check` and to the CI `verify` job, pinned at the level achieved by T2–T4, so coverage cannot silently regress. Document the current number in the script header. | `npm run check` fails if coverage drops below the pinned floor; CI `verify` job runs it; the pinned value matches the measured post-T4 figure. | 0.5 pts | general-purpose | haiku | low | EP05-T5 |

**Phase total: 8.5 pts.**

## Relationship to EP-6

EP-6 (Adversarial validation corpus, 9 pts) was written assuming it starts from the 6-fixture baseline.
It now starts from this phase's output. **EP-6 should be re-scoped from "build a corpus" to "make the
corpus adversarial"** — dangerous-miss families, property/boundary tests, and the seeded-mutation
corpus (M01–M57) from SPIKE-005 + EP0-T4. Its estimate should be revisited at EP-5 close; the
foundational witness work moves here.

## Phase EP-0.5 Quality Gates

- [ ] `scripts/rule-coverage.mjs` exists, is negative-tested, and reports the baseline correctly
- [ ] All 49 migration-table rules have an activation witness
- [ ] All 6 previously-uncovered ALERT rules fire, with severity/type asserted
- [ ] The M57 mutation now fails the suite (verified by execution, not assertion)
- [ ] No new or retuned clinical thresholds introduced by any fixture
- [ ] Coverage ratchet wired into `npm run check` and CI
- [ ] `npm run check` green
- [ ] Reviewer sign-off

---

[← Back to main plan](../wave0-safety-foundation-v1.md)
