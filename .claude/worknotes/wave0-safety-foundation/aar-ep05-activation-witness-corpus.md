---
schema_version: 2
doc_type: report
report_category: aar
title: "AAR — Phase EP-0.5: Activation-Witness Corpus (wave0-safety-foundation)"
status: completed
created: 2026-07-19
updated: 2026-07-19
feature_slug: wave0-safety-foundation
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
phase_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-0.5-activation-witness-corpus.md
commit_refs:
  - 7aa89cc
  - 526281a
  - 7bf2bc6
  - b84a598
pr_refs: []
tags:
  - clinical-cds
  - test-coverage-illusion
  - safety-substrate
  - ratchet-design
  - adversarial-review
  - missingness-guardrail
---

# AAR — Phase EP-0.5: Activation-Witness Corpus

**What ran**: 6 tasks, 8.5 points, one orchestrator + 5 delegated agents across 3 model families
(sonnet, fable, gpt-5.6-sol via `codex exec`). Outcome: activation-witness coverage went from
**30/91 to 91/91**, `npm run check` green, no clinical content changed.

**Headline**: the phase delivered what it was scoped for, but the three most valuable findings were
things the plan did not ask for — and two of them were defects in *this phase's own work*.

---

## 1. The safety net this phase built did not run

The plan's task table assumed the tests would execute once written. They did not.

`package.json`'s test script was `node --test tests/*.test.mjs` — a **non-recursive glob**. Every
witness test authored by this phase lived in `tests/witness/` and was therefore invisible to
`npm test` and to both CI jobs. The suite reported 145 passing tests and 0 failures while 55 tests
sat on disk unexecuted.

Two independent agents (EP05-T3 and EP05-T4) discovered this separately, each while trying to
negative-test their own guard. Neither could fix it: `package.json` was outside their file
ownership. Both escalated it, and both were right to.

> **Agentic directive**: after adding a test file, confirm the runner actually *ran it* — compare the
> reported test count before and after, don't infer execution from a green result. A test the runner
> never discovers is indistinguishable from a passing test in every signal a CI system emits. This
> generalizes past globs: skipped suites, filtered tags, and unregistered test modules all fail the
> same way, silently and in the safe-looking direction.

The deeper version of this: a safety net that never executes is **worse than no safety net**, because
it manufactures the appearance of protection. That is the same failure shape as EP-0's headline
finding, one level up — EP-0 found the corpus didn't cover the rules; EP-0.5 found the runner didn't
cover the corpus.

---

## 2. The ratchet this phase built could be defeated by the exact regression it guards

The plan specified: *"Add `rule-coverage --min` to `npm run check` … pinned at the level achieved by
T2–T4, so coverage cannot silently regress."* That was implemented literally — `--min=91` at 91/91.

Testing it against the scenario it exists to prevent showed it does not work. `--min` pins an
**absolute count of witnessed rules**. Add a 92nd rule with no witness and the count is still 91,
which clears `--min=91`. Coverage drops from 100% to 98.9%, the new rule ships with zero regression
protection, and CI stays green.

This was found by executing the scenario, not by reading the code. The fix (`--require-all`, which
fails on any unwitnessed rule regardless of count) is three lines. The point is not the fix.

> **Agentic directive**: a ratchet must be pinned to the **invariant**, not to a **measurement of the
> invariant at one moment**. "Count ≥ N" and "no item lacks X" are not the same claim, and they
> diverge exactly when the population grows — which is precisely when new unprotected work enters.
> Before wiring any threshold gate, ask: *what happens when the denominator changes?* If the gate
> silently weakens as the codebase grows, it is a decaying guard, not a ratchet.
>
> Corollary: a plan's literal wording can specify an insufficient guard. Implementing it exactly as
> written and moving on is how the defect ships. Test the guard against its own threat model.

---

## 3. The adversarial reviewer found a masked activation path — the highest-value catch

The cross-family review (`gpt-5.6-sol`, two bounded legs) returned CHANGES-REQUIRED on both legs,
with 11 must-fix findings. The single most valuable one:

The `ALERT-006` witness fixture (thrombotic microangiopathy — an **emergency** alert) set *both*
`localFlags.thrombocytopenia: true` **and** `symptoms.oliguria: true`. The rule's condition is
`schistocytes AND any(thrombocytopenia, renalSymptoms, neurologicSymptoms)`. With two arms satisfied,
the platelet-derivation logic could break **completely** and the emergency-alert assertion would stay
green — the alert would keep firing off the other arm.

Worse, `localFlags.thrombocytopenia: true` short-circuits the numeric `platelets < plateletsLower`
derivation that the fixture's own notes claimed it exercised. The fixture tested less than it said it
did, in a rule where being wrong is a patient-safety event.

Fixed by splitting into two fixtures, each witnessing exactly one `any` arm in isolation, with the
derived `cbc.thrombocytopenia` fact asserted directly. Verified: arm 1 fixture has
`thrombocytopenia=true, renalSymptoms=false`; arm 2 the exact inverse.

> **Agentic directive**: when a rule's condition contains a disjunction, a fixture that satisfies more
> than one arm **witnesses the rule but tests nothing about any individual arm**. Any single arm can
> break invisibly. For `any(A, B, C)`, coverage means one fixture per arm with the others provably
> false — not one fixture that happens to fire the rule. Assert the *derived fact* the arm depends on,
> not just that the rule matched.

### 3.1 The fix was itself incomplete — and the same reviewer caught that too

The first fix produced **two** fixtures and described them as "one per arm." `ALERT-006` has
**three** arms. The `symptoms.neurologicSymptoms` arm was still unwitnessed, and the notes now
asserted a false claim about it. The confirmation review caught this; the orchestrator had not.

Demonstrated by execution: with the neurologic arm deleted from the rule, **`npm run coverage:rules`
still reports 91/91 and passes**, because the rule keeps firing off the other two arms. Only the new
per-arm test fails.

> **Agentic directive**: rule-level activation coverage and per-branch protection are **different
> guarantees, and the first does not imply the second**. A 100% coverage number says every rule fires
> somewhere; it says nothing about whether any individual `any` arm, severity, or emitted output type
> is protected. Do not let a coverage percentage be read as completeness — state in the tool's own
> output what it does not cover. (This phase's ratchet message now does exactly that.)
>
> Second directive: **re-review after applying review fixes.** A fix round is new work and deserves
> the same scrutiny as the original. Two of this phase's fix-round defects — the missing third arm and
> a set of stale numbers introduced *by the fixes themselves* — existed only because the first fix was
> applied, and would have shipped had the confirmation pass been skipped as a formality.

---

## 4. Exclusion-by-omission: the guardrail case that could not be fixed, only documented

Three fixtures (`IRIDA-001`, `TEC-001`, `IMF-DBA-001`) satisfied a clinical **exclusion** because a
field was *absent*, while their notes described it as *assessed and found negative*. This is the
"missingness treated as normal" pattern `CLAUDE.md` names as a hard guardrail, and SPIKE-003 had
already flagged `TEC-001` and `IRIDA-001` by name for exactly this reason.

The honest resolution is the interesting part. Fields were set to explicit `false` where
representable — but **in today's two-state fact model, explicit `false` and absent are behaviourally
identical**, because every one of these leaves is an `=== true` check. For `smear: []` there is not
even a partial workaround: "smear reviewed, no blasts" and "no smear done" are the same value, with
no field able to express the difference.

So the fix improves the fixture as *documentation of intent* and closes nothing. That is recorded in
a `KNOWN LIMITATION` section that says so plainly and explicitly forbids future passes from reading
these fixtures as proof the exclusion was clinically assessed. It is filed as a direct input to
EP-1's tri-state migration.

> **Agentic directive**: when a finding cannot be fixed with the current model, write down precisely
> *why* and *what would fix it* — and make the artifact state its own insufficiency, in the place a
> future reader will look. A limitation documented at the site of the workaround survives; one
> mentioned only in a report does not. Do not let "we set the field explicitly" read as "we closed
> the gap."

---

## 5. Process observations

### 5.1 A lost exit artifact forced a scope decision — and the superset was cheaper than the reconstruction

The phase's stated exit criterion referenced "the 49 rules in SPIKE-003's migration table." That table
existed only at a machine-local scratch path that no longer exists — the exact durability defect
EP-0's reviewer flagged (AAR §4.2), recurring one phase later.

Re-deriving "49" from the SPIKE's prose was ambiguous (a naive derivation over boolean fact paths
yields 88). Rather than reconstruct a contested number, the phase targeted **all 91 rules** — a strict
superset of any reading of the 49, which makes the disputed subset irrelevant by construction. This
turned out to be *less* work than adjudicating the boundary, and the artifact is now a committed
script rather than a scratch file.

> **Agentic directive**: when a referenced artifact is missing and the referenced *number* is
> ambiguous, check whether a superset target dissolves the ambiguity. Reconstructing a contested
> boundary is often more expensive than covering everything on both sides of it — and leaves you
> defending the reconstruction.

### 5.2 Agents reported honestly on what they could not do

Three separate honest negatives, all volunteered rather than extracted:
- EP05-T4 reported **2 of 19 branches it could not uniquely pin** (redundant non-finite-age guards —
  deleting either leaves the suite green because downstream comparisons already fail).
- EP05-T2 explained why it produced 24 fixtures against a "roughly 10–18" target, rather than padding
  patients with unrelated etiologies to hit the number.
- The reviewer explicitly declined to escalate `TMA-001`, stating why the picture was coherent.

Each of these is worth more than the work it declined to fake. The prompts asked for it explicitly
("an unreachable rule is a real finding — reporting it is a success, not a failure"), and that framing
appears to be what produced it.

### 5.3 Splitting the reviewer's reading budget worked

EP-0's AAR recorded that `gpt-5.6-sol` **failed outright** (~400s, no output) on a large prompt at
high effort. This phase split the review into two bounded legs (corpus; alerts+branches), each with an
explicit numbered reading budget and an instruction not to read `rules.json` in full. Both completed
and both produced substantive findings.

### 5.4 File-ownership partitioning made a 3-way parallel batch safe

T2/T3/T4 ran concurrently with strictly disjoint directories (`corpus/`, `alerts/`, `branches/`) and
one test file each. Zero conflicts, no serialization. The cost was that none could fix the shared
`package.json` defect they all hit — which surfaced as an escalation instead, and is the correct
trade: an escalation is visible, a concurrent write to a shared file is not.

---

## 6. What went well

- 30/91 → **91/91**, no rule proved unreachable, no new or retuned clinical thresholds, zero changes
  to `modules/`, `examples/`, or `tests/golden/`.
- **M57 now fails `npm run check`** — verified by executing the mutation, not asserted. That is the
  case EP-0 proved moved 0 of 6 fixtures with both planned safety layers reporting clean.
- Every guard in this phase was negative-tested by executing its threat: M57 and 7 other `ranges.js`
  mutations, the M55 alert-downgrade (twice — before and after the ALERT-006 restructure), the
  fixture-deletion ratchet, and the new-unwitnessed-rule ratchet.
- The reviewer gate earned its cost for the second consecutive phase, and this time found a defect in
  an emergency-alert test.

## 7. What to do differently next time

1. **Verify the runner discovers new tests** as a standing step, not a discovery. Cheapest possible
   check: assert the test count went up.
2. **Test every gate against its own threat model before wiring it** — `--min` was implemented exactly
   as the plan specified and was insufficient as specified.
3. **Treat "exit artifact must be in version control" as an executable AC.** EP-0's AAR recommended
   this; EP-0.5 was bitten by the same class one phase later. A recommendation that isn't a task row
   decays — the same decay mode `CLAUDE.md` warns about for integrations.
4. **Ask for per-arm coverage on disjunctive conditions explicitly** in fixture-authoring prompts. The
   ALERT-006 defect was a natural consequence of "make this rule fire," which is what the prompt asked for.

## 8. Open items handed forward

| Item | Where tracked |
|---|---|
| Tri-state fact model must distinguish assessed-negative from not-assessed; `smear` has no representation for it at all | EP-1 (KNOWN LIMITATION section in `tests/witness/corpus/NOTES.md`) |
| 2 redundant non-finite-age guards in `ranges.js`/`registry.js` are behaviourally unpinnable; safe today, not safe if a band bound becomes non-numeric | `tests/witness/branches/NOTES.md`, stated exception |
| EP-6 should be re-scoped from "build a corpus" to "make the corpus adversarial" — the foundational witness work has moved here | phase-0.5 plan, "Relationship to EP-6" |
| `tests/rule-coverage.test.mjs` pins the literal 30/91 baseline and 91 total; it will need updating when the rule base legitimately grows | this AAR |
| Coverage instrument measures activation only — a witnessed rule is not a *validated* rule | standing honesty boundary |
