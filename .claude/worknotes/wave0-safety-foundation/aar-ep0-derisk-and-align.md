---
schema_version: 2
doc_type: report
report_category: aar
title: "AAR — Phase EP-0: De-Risk & Align (wave0-safety-foundation)"
status: completed
created: 2026-07-19
updated: 2026-07-19
feature_slug: wave0-safety-foundation
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
phase_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-0-derisk-and-align.md
commit_refs:
  - 5eaa048
  - 98429df
  - 6cc4bca
  - 5cbd2e6
  - d5806a3
pr_refs:
  - "#4"
tags:
  - clinical-cds
  - test-coverage-illusion
  - safety-substrate
  - multi-model-review
  - plan-sequencing
---

# AAR — Phase EP-0: De-Risk & Align

**What ran**: 9 tasks, 9 points, one orchestrator + 8 delegated agents across 4 model families
(sonnet, fable, gpt-5.6-sol/terra via `codex exec`, haiku). Outcome: all 9 delivered, `npm run check`
green throughout, no clinical content changed, PR #4.

**Why it matters more than a normal phase close**: EP-0 was a de-risking phase whose *purpose* was to
find rework before it happened. It did — and the most valuable things it found were not on its task
list.

---

## 1. The headline lesson: a green test suite was hiding a two-thirds blind spot

### Plain English

This project's safety net is a set of 6 "golden fixture" test cases. Every change is checked by
running those 6 patients through the engine and confirming the output is byte-for-byte identical. If
it is, we call the change safe.

We measured what those 6 patients actually touch. **Of the 91 clinical rules in the knowledge base,
only 30 ever activate. 61 never fire at all** — including six emergency/urgent alert rules
(`ALERT-001`, `-002`, `-003`, `-006`, `-007`, `-008`).

So "all tests pass" was never a statement about two-thirds of the rule base. You could delete, invert,
or break most of the emergency alerts and the suite would stay green. The suite wasn't lying — it was
being read as a claim it never made.

It got worse when we checked it against the *next* phase's work. EP-1 migrates 49 rules to a new
tri-state fact model. **Only 17 of those 49 have any test witness. 32 migrate blind**, including 3
alerts and both `TEC-001` and `IRIDA-001` — which are the exact two rules the migration SPIKE had
already flagged as needing extra clinical review. The riskiest rules were also the untested ones.

### Agentic language (the directive)

> **Coverage is a claim about the corpus, not about the code.** Before accepting "tests pass" as
> evidence that a change is behavior-preserving, compute the intersection of *what changed* with
> *what the test corpus actually exercises*. Report that intersection as a number. If a migration
> touches N units and the corpus witnesses M of them, the safety claim covers M, not N — say so
> explicitly and never let "suite green" stand in for "change verified."
>
> Operationally here: `provenance.matchedRuleIds` is the activation witness. A rule absent from every
> fixture's `matchedRuleIds` has zero regression protection, regardless of suite status.

### How it was caught

Not by the plan, and not on the first try. My own first coverage measurement returned a reassuring
**91/91** — because I substring-matched rule IDs against the whole result JSON, and `provenance.ruleAudit`
lists every rule with `matched: false`. The flattering number was my bug. Re-measuring against
`matchedRuleIds` gave the real 30/91.

**Meta-lesson**: when a verification returns a suspiciously clean result, verify the verification. A
measurement that says "everything is covered" is more likely to be a broken measurement than a
well-covered system.

---

## 2. The M57 case: "both checks green, patient harmed"

### Plain English

We asked an adversarial reviewer (a different model family, explicitly told to attack the design and
that silence was not an acceptable answer) to find a dangerous change that our planned safety tooling
would miss. It found one. We then reproduced it by actually running it.

The change: delete three lines in `modules/anemia/ranges.js` — the branch that says *any menstruating
patient uses a ferritin threshold of 30 ng/mL*. Without it, a menstruating patient under 12 years
falls through to the 20 ng/mL threshold used for younger children.

Why both planned safety checks miss it:

- The **structural checker** compares the knowledge-base JSON files. This change is in a `.js` file,
  outside its scope. It reports clean.
- The **behavioral checker** runs the fixture corpus and compares outputs. The only menstruating
  patient in the corpus is 168 months old — old enough that a *different* branch still returns 30. The
  other five fixtures set `menstruating: false`. It reports clean.

We applied the mutation and measured: **0 of 6 golden fixtures changed.** Both checks green.

For a real, accepted input — a menstruating 120-month-old with ferritin 25 — the matched rules went
from `[NOTE-003, ID-001, ID-006, LEAD-002, Q-MICRO-004, Q-MICRO-005]` to
`[ID-006, LEAD-002, Q-MICRO-003, Q-MICRO-004, Q-MICRO-005]`. In clinical terms: a **confirmed**
iron-deficiency finding silently became a **provisional** one, and the system started asking for more
data instead of stating the pattern was met.

**Correction we made to the reviewer's own claim**: it reported the iron-deficiency pattern
"disappears." It does not — the label survives via `ID-006`. The real harm is an *evidential
downgrade*, not a deletion. We recorded the corrected mechanism, not the more alarming version. An
adversarial finding still has to be verified; a scary claim is not automatically a true one.

### Agentic language (the directive)

> **Two blind checks do not compose into one sighted check.** When designing layered verification,
> map each layer's blind spot explicitly and look for the *intersection* — inputs where every layer is
> blind simultaneously. A layer that is "independent" in implementation may share a blind spot in
> practice (here: the JSON differ can't see code, and the behavioral probe can't see uncovered inputs
> — a code-side change affecting only uncovered inputs defeats both).
>
> **Corollary — corpus-gated tools inherit corpus blindness.** Never schedule "build the behavioral
> probe" before "widen the corpus." The probe can only witness what the corpus exercises; building it
> first ships a safety net with a hole the size of the coverage gap.

---

## 3. What is unique to *this* project (vs. our other repos)

These are the traits that made standard engineering instincts wrong here. They should be loaded before
any future session touches this codebase.

### 3.1 The knowledge base is data, so code-centric tooling is structurally blind

Most of our repos put logic in code, where diffs, coverage, and review naturally apply. Here the
clinical logic is split: rules live in `modules/anemia/*.json`, but **the numbers live in code**.

Measured: `rules.json` has 247 condition leaves, of which **241 are equality checks and only 3 are
numeric thresholds.** Every real clinical cutoff — lead 3.5, hemolysis ≥2, Hb <7, ferritin 20/30, all
Hb/MCV/RDW age bands — lives in `facts.anemia.js`, `ranges.js`, or `reference-ranges.json`.

**Implication**: a "knowledge base diff" tool that reads the JSON is confidently clean exactly where
the dangerous numbers are. This inverts the usual assumption that data changes are risky and code
changes are reviewed. Here the *code* holds the clinical content.

### 3.2 "Unvalidated research prototype" is a live design constraint, not a disclaimer

SPIKE-006 was asked whether the KB should be cryptographically signed. The cross-family reviewer was
explicitly given permission to conclude *no*, and did: the browser fetches the KB, the verification
code, **and** any public key from the same static origin, so whoever can replace one can replace all
three. A signature would prove "these bytes match what the release script signed" — never "a clinician
reviewed this."

The deeper point: on an unvalidated prototype, **security theater is worse than nothing**, because it
manufactures trust optics the clinical content hasn't earned. In a validated product the same feature
would be correct.

> **Agentic directive**: in this repo, when evaluating any assurance mechanism, ask what it actually
> attests to and who the adversary is. Be willing to recommend *not* building it. "We considered it and
> it would be theater here" is a valid, valuable deliverable — and this project's charters explicitly
> demand that willingness.

### 3.3 Zero dependencies, no bundler, CSP `script-src 'self'`

This constrains solutions in ways our other repos don't. SPIKE-004 evaluated two real UCUM libraries
and rejected both — not on quality, but because a ~1.4MB general expression engine for a closed
10-analyte table would be this project's *first ever* dependency, under a CSP with no bundler. The
hand-rolled ~250 LOC table won on those grounds.

> **Agentic directive**: "just add the library" is usually wrong here. Check `package.json` (currently
> `dependencies: {}` and `devDependencies: {}`) before proposing one.

### 3.4 The browser SPA bypasses the server entirely

`src/app.js` calls `assessPediatricAnemia()` directly and only ever `fetch`es static JSON. It never
touches `server.mjs`. SPIKE-004's charter had proposed putting unit validation in the server request
path — which would have shipped a safety check that the actual clinician-facing surface skips
entirely. Validation must live in `assess()` (`src/engine.js`), the one shared entry point.

Relatedly: `schemas/patient-input.schema.json` is referenced by **no runtime code**. There is no
validator dependency. "Reject at schema validation" is currently a no-op, not merely a weak option.

> **Agentic directive**: in this repo there are two entry paths and only one shared chokepoint. Any
> guard not in `assess()` protects the API but not the browser.

### 3.5 AOS outputs are claims, not credentials

Carried forward from `CLAUDE.md` and re-confirmed this phase: `rf` bundles are verified *claims* and
nothing converts them into rules; ARC's clinical council is repository-ready but **non-qualifying** —
its review is never clinical sign-off. Also learned concretely: `POST /api/runs` **scaffolds and
registers** a run; it does not drive the discovery swarm. Two runs launched this phase came back
`status: planned` with zero evidence. "Launched" ≠ "has results."

---

## 4. Process lessons (portable to other repos)

### 4.1 Verify agent claims against the artifact, not the report

Two agents overclaimed in ways only disk-checking caught:

- The DEF-1 agent said its new JSON import was "proven on both paths per `check-app-imports.mjs`."
  False — that script parses only the files in a hardcoded list and **does not walk the import graph**.
  The refactor introduced a new relative specifier on exactly the dev-vs-dist axis that guard exists to
  protect, and left it unguarded. Fixed, then **negative-tested**: deliberately broke the specifier,
  confirmed both passes fail, restored, confirmed green.
- The CI agent left a workflow-level `concurrency: group: pages` that would have made PR checks queue
  behind production deploys.

> **Agentic directive**: a guard you have never seen fail is not a verified guard. After adding or
> relying on a check, break the thing it protects and confirm it fails.

### 4.2 The independent reviewer gate earned its cost — it caught what the orchestrator missed

The Mode-E reviewer returned APPROVE-WITH-CAVEATS and found four gaps I had missed, one serious:
**EP0-T1's 49-row migration table — the phase's stated exit artifact — existed only behind a pointer
to a machine-local scratch path.** The flagship deliverable was effectively undelivered while every
status field said complete. Also caught: SPIKE-006 skipped a charter-mandated `council-review` and,
unlike SPIKE-005, didn't disclose it; and the progress file said `status: completed` with
`overall_progress: 0` and every success criterion still `pending`.

> **Agentic directive**: polished surrounding work masks process gaps. Have the reviewer check
> *durability of artifacts* (is the deliverable in version control?) and *self-consistency of tracking*,
> not just correctness of content.

### 4.3 Cross-family adversarial review works, and needs a no-silence mandate

The `gpt-5.6-*` lens found 5 gaps (M53–M57) that the primary author's own pass did not, including the
double-blind case. The charter's framing — *"silence is not an acceptable output; either name a miss or
enumerate what you tried"* — is what made it productive rather than a rubber stamp.

Operational note: the primary `gpt-5.6-sol` run **failed** (exited ~400s, no output) under a large
prompt at `xhigh` reading a 991-line doc. The documented `gpt-5.6-terra` fallback succeeded with a
tightened reading budget. Both facts are recorded in the charter rather than presented as a clean first
pass.

> **Agentic directive**: budget the reviewer's reading explicitly (point at sections, not whole
> documents). Record model substitutions in-artifact — a fallback silently swapped is a provenance
> defect.

### 4.4 A de-risking phase should be allowed to rewrite the plan

EP-0's tasks were "close 4 SPIKEs, fix DEF-1, harden CI." Its most valuable output was none of those:
it was the discovery that **the plan's validation work (EP-6) is scheduled last but is a dependency of
the first migration (EP-1) and of EP-5.** Three SPIKEs independently converged on the same gap.

> **Agentic directive**: when a de-risk phase produces findings that contradict the plan's sequencing,
> amending the plan *is* the deliverable. Do not close the phase and proceed as scheduled.

---

## 5. What went well

- All 9 tasks landed with `npm run check` green and **zero clinical content changed** — no golden
  fixture, example, or `modules/anemia/*.json` file modified across the phase.
- DEF-1 equivalence was *proven*, not asserted: 6/6 fixtures unchanged **plus** a deep-equal of the old
  vs new `EVIDENCE` export (6 ids, same order, still frozen).
- Every SPIKE re-derived its charter's own numbers against live code instead of trusting them — and
  three of four found the cached figures wrong (60 fields not 56; 49 rules not 33; 25 occurrences not 19).
- Model routing held: the expensive open-ended reasoning (`fable`/max) went to the one task where a
  missed insight becomes a permanent blind spot; mechanical work went to `haiku`.

## 6. What to do differently next time

1. **Measure corpus↔change intersection at plan time**, not at phase close. Had we computed "32 of 49
   migrate blind" during planning, EP-6 would never have been scheduled last.
2. **Require exit artifacts to be in version control** as an explicit AC, not an implied one.
3. **Make `council-review` a tracked task row** when a charter mandates it. Two of four SPIKEs skipped
   it because it was prose in the charter, not a line in the task table — the same decay mode
   `CLAUDE.md` warns about for integrations.
4. **Give long cross-family runs a reading budget up front** — the first failure was avoidable.

## 7. Open items this AAR hands forward

| Item | Where tracked |
|---|---|
| `council-review` on OQ-7 (diff decision function) and OQ-8 (no-signing recommendation) | SPIKE-005 / SPIKE-006 |
| 32 blind migrated rules need activation witnesses before EP-1 lands | new EP-0.5 phase |
| RF-EV-002 / REG-002 registered but not executed | EP-2 / EP-7 inputs |
| GitHub branch-protection unverified — "PRs are gated" is currently false | progress SC-5 (`partial`) |
| `statusIs()`/`hemolysisMarkerCount` latent missingness gap | needs own ticket |
| SPA submit handler has no try/catch (`src/app.js:585`) | must ship with EP-2 unit check |
| `module.json` version-field staleness (drift check deliberately deleted) | EP-5 manifest work |
