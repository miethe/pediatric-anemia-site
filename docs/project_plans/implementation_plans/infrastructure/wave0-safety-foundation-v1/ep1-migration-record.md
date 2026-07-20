---
schema_version: 2
doc_type: report
title: "EP1-T9 AC-D3 Migration Record: Tri-State Fact Model"
status: draft
created: 2026-07-20
phase: EP-1
prd_ref: docs/project_plans/PRDs/infrastructure/wave0-safety-foundation-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1.md
phase_plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-1-tristate-fact-model.md
spike_ref: docs/project_plans/SPIKEs/spike-003-tri-state-fact-model-migration.md
design_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/ep1-migration-design.md
---

# EP1-T9 AC-D3 Migration Record: Tri-State Fact Model

## Review purpose and disposition

This is the draft AC-D3 evidence record for human safety `council-review`. It proposes a software-
behavior finding; it is not clinical sign-off and does not authorize publication of a rule change.
The project remains an **unvalidated research prototype**. Automated checks establish only the
software behavior they execute, never clinical validity, safety in use, diagnostic performance, or
regulatory status (`CLAUDE.md:15-18,31-32`).

**Observed AC-D3 disposition:** the no-go trigger was **not triggered in the 54-fixture comparison**.
The observed difference set is empty. The `council-review` gate remains pending, and the current
managed environment did not reproduce a complete green `npm run check` because its smoke server
could not bind a loopback port; details are recorded below.

## Evidence and commit boundary

The baseline records behavior from pre-migration commit `62b7f90`. Commit `9eaa7b6` is the snapshot
capture commit, and its parent resolves to `62b7f90`; it added the capture script and the 54 committed
baseline outputs. The reviewed implementation boundary is current HEAD `579c041`.

| Commit | Evidence-bearing scope |
|---|---|
| `9eaa7b6` | Pre-migration AC-D3 script and 54-output baseline, captured against `62b7f90`. |
| `bf1072e` | EP1-T1/T2: wire-compatible schema and four tri-state rule operators. |
| `5d1d848` | EP1-T3: migration design for the rule, aggregate, and call-site surfaces. |
| `188d717` | EP1-T4/T5: atomic fact and 49-rule migration; aggregate-row-2 adjudication. |
| `579c041` | EP1-T6/T7/T8: invariant, seam/UI checks, and rule-schema drift correction. |

## 1. What changed

### Rule, fact, schema, and seam surfaces

- **Rules:** 49 of 91 rules were migrated across 78 condition leaves: 5 alerts, 3 notes,
  34 candidates, and 7 questions. The design records the reproduction method and population at
  `ep1-migration-design.md:97-105`, its row inventory at `:114-162`, and the behavior-preserving
  stage correction at `:422-451`. The atomic implementation is commit `188d717`.
- **Legacy aggregate sites:** all nine `countTrue()` sites were inventoried, but only eight acquired
  tri-state behavior. `hemolysisMarkerCount` remains the deliberately unchanged ninth site because
  its inputs are `statusIs()` booleans (`modules/anemia/facts.anemia.js:96-104`); that missingness
  question is NCR-3 (`ep1-migration-design.md:51-63,88-95,390-393`).
- **Boolean-collapse call sites:** the pre-migration inventory contains the `isTrue()` definition and
  ten call sites plus 25 direct `=== true` occurrences (`ep1-migration-design.md:211-261`). Current
  production callers use explicit tri-state normalization; the now-unused `isTrue` definition remains
  at `src/facts/core.js:3`.
- **Shared seam:** `modules/anemia/ranges.js:42-44` now evaluates
  `toTri(menstruating) === 'true'` while preserving the existing threshold branch. The seam test
  covers `'true'`, `'false'`, `'unknown'`, and omitted input
  (`tests/tristate-seam-ranges.test.mjs:11-37`; commit `579c041`).
- **Wire compatibility:** `booleanMap` remains field-name-open and accepts either a bare JSON boolean
  or one of `'true' | 'false' | 'unknown'` (`schemas/patient-input.schema.json:113-123`). The separate
  rule-fact allow-list mitigates silent rule-author typos, including the four discovered passthrough
  paths (`scripts/validate-kb.mjs:10-100,106-129`; commit `bf1072e`).
- **Operators:** `is-present`, `is-absent`, `is-unknown`, and `is-not-assessed` route through `toTri()`;
  the last two are synonyms and the unknown-operator throw remains fail-closed
  (`src/ruleEngine.js:37-45`). The rule schema now enumerates the same four operators
  (`schemas/rule.schema.json:45-55`; schema drift fixed in `579c041`).

### Nine-site aggregate disposition

| # | Site | EP-1 disposition and current evidence |
|---|---|---|
| 1 | `hemolysisMarkerCount` | Unchanged `countTrue(statusIs(...))`; deferred as NCR-3 (`facts.anemia.js:96-104`). |
| 2 | Additional cytopenias / isolated anemia | Hybrid flag/numeric precedence plus `countPresent`, `triAny`, `triAll`, and `triNone` (`facts.anemia.js:20-28,113-127`). |
| 3 | Instability | `triAny` over six symptom values (`facts.anemia.js:129-136`). |
| 4 | Bleeding history | `triAny`, including the derived active-major-bleeding value (`facts.anemia.js:138-146`). |
| 5 | Iron-risk history | Nested `triAny` consuming bleeding history without JS truthiness (`facts.anemia.js:148-158`). |
| 6 | Chronic inflammation | `triAny` over four history values (`facts.anemia.js:160-165`). |
| 7 | Family hemoglobinopathy | `triAny` over three history values (`facts.anemia.js:180-184`). |
| 8 | Known chronic hemolytic disease | `triAny` over four history values (`facts.anemia.js:186-191`). |
| 9 | Congenital marrow-failure signals | Confirmed-present count plus a separate completeness fact (`facts.anemia.js:230-238,403-405`). |

The helpers encode separate three-valued identities: `triAny` is true if any input is present;
`triAll` is false if any input is absent; and `triNone` is false if any input is present. Each returns
its opposite resolved value only when all inputs are assessed, and otherwise returns unknown
(`modules/anemia/facts.anemia.js:5-18`; `src/facts/tristate.js:13-38`). No new threshold is claimed
or introduced by this record.

## 2. AC-D3 diff enumeration

### Population and command

The compared population was **54 inputs**:

- 6 published `examples/*.json` fixtures; and
- all 48 `tests/witness/**/*.json` activation-witness fixtures: 9 alert, 15 branch/seam, and
  24 corpus fixtures.

This is the full EP-0.5 witness corpus used by the capture script, not only the original six goldens.
The script recursively sorts and collects both source trees, assesses every JSON input, and records
even thrown errors as diffable output (`scripts/capture-ep1-snapshot.mjs:1-14,31-75`). EP1-T6 also
requires an activation witness for every live tri-state rule (`tests/tristate-safety-invariant.test.mjs:113-129,188-191`).

Executed from the repository root at `579c041`:

```sh
EP1_POST_DIR=$(mktemp -d /private/tmp/ep1-post.XXXXXX)
node scripts/capture-ep1-snapshot.mjs "$EP1_POST_DIR"
diff -ru .claude/worknotes/wave0-safety-foundation/ep1-baseline "$EP1_POST_DIR"
```

Observed result: the script reported `Wrote 54 snapshot(s)`; `diff -ru` exited 0 and emitted no diff.
No baseline or post-migration fixture produced a recorded `__error`.

### Compared output and scrub

The comparison covers the full serialized `assess()` result: metadata other than the scrubbed time,
classification, alerts, ranked differential entries (including ordinal scores and matched rules),
next questions, interpretive notes, limitations, matched rule IDs, evaluated-rule count, and the full
rule audit (`src/engine.js:17-37`). It therefore compares both public output and provenance/audit, not
merely the final ranked labels.

Only `meta.generatedAt` is replaced with the literal `"x"`
(`scripts/capture-ep1-snapshot.mjs:26-29`). That field is assigned from `new Date()` after rule
evaluation (`src/engine.js:14-22`); it is wall-clock metadata, not a rule input or deterministic CDS
result. Removing that single nondeterministic value does not weaken comparison of the remaining
software behavior.

### Complete classification of observed differences

| Required AC-D3 classification | Count | Enumeration / rationale disposition |
|---|---:|---|
| `expected-from-tri-state` | 0 | Empty set; there is no expected output difference requiring a clinical rationale. |
| `unexpected` | 0 | Empty set; there is no unexplained output difference. |
| **Total observed differences** | **0** | All 54 complete serialized outputs matched after the timestamp-only scrub. |

This is not a statement that “we did not look.” It is an exhaustive enumeration of the observed
difference set for the named 54-input population, and that set is empty.

### Honest scope caveat

The zero-diff result proves output preservation **only on inputs exercised by this corpus**. It does
not prove output preservation over all possible inputs. It also does not, by itself, demonstrate the
intended missing-data safety improvement: that improvement is behavior on inputs containing missing
or unknown data, which the natural fixture population may not exercise in every relevant combination.

The EP1-T6 invariant covers a different, bounded surface instead: it derives the current tri-state
rule paths, synthetically substitutes `'unknown'` into every non-empty subset of each activated
rule's referenced tri-state paths, and checks the executable adverse-contribution representation
(`tests/tristate-safety-invariant.test.mjs:132-227`). Its limits are stated in section 4.

## 3. Why zero differences are expected and correct

The behavior-preservation argument is scoped to the pre-migration valid bare-boolean wire domain.
`toTri()` preserves boolean meaning while changing representation: `true -> 'true'`,
`false -> 'false'`, and an omitted/null/empty value becomes `'unknown'`
(`src/facts/tristate.js:6-10`). Tri strings are newly valid wire inputs, so there is no valid
pre-migration output against which to compare that newly accepted input domain.

For the migrated rules:

- a pre-migration `{ op: 'eq', value: true }` matched exactly the bare-boolean population that the
  post-migration `is-present` leaf matches after normalization; and
- a pre-migration `not:{ eq true }` matched `false` or absent values. Post-migration
  `not:{ is-present }` matches normalized `'false'` or `'unknown'`, the same input population.

The stage-1 equivalence and the deferred stage-2 tightening are recorded at
`ep1-migration-design.md:441-451`. This is why all 49 rows could migrate without changing output.

### Aggregate row 2 near-violation

One implementation nearly broke that construction. A plain
`triAny([toTri(localFlag), numericComparisonTri])` makes an absent optional `cbc.localFlags` override
`'unknown'`; paired with a resolvable normal numeric comparison (`'false'`), `triAny` returns
`'unknown'`. That would suppress `TEC-001` and `IMF-DBA-001` by preventing confirmed isolated anemia.

Commit `188d717` adjudicated the precedence now implemented in `cytopeniaTri()`: an explicit-present
flag wins; otherwise a resolvable count/lower-bound comparison decides; otherwise an explicit-absent
flag decides; otherwise the lineage remains unknown (`modules/anemia/facts.anemia.js:20-28,113-127`).

The cited design table's row 2 remains superseded because it still prescribes the flawed plain-`triAny`
formula (`ep1-migration-design.md:56`). Its “Orchestrator adjudication” now records this aggregate
correction alongside the TEC/IRIDA stage split (`ep1-migration-design.md:453-466`). The current code
and `188d717` commit record, not the superseded table sentence, are the evidence for the landed
behavior.

## 4. Safety property and evidence

### AC-D3 no-go condition

The binding no-go condition is: **any observed diff that clears a differential on `not-assessed` is
an automatic no-go, regardless of rationale** (`phase-1-tristate-fact-model.md:49-52,72`).

**Result:** the no-go trigger is **not triggered for the observed 54-fixture population**, because
there are no observed diffs of any classification. This finding is population-bounded and does not
turn the diff into positive evidence of universal missing-data behavior.

### EP1-T6 invariant: positive, bounded software evidence

The invariant is independent of the snapshot diff and provides the positive modeled evidence:

- It recursively walks every `all`/`any`/`not` tree (`tests/tristate-safety-invariant.test.mjs:57-92`).
- It derives the live surface from `deriveFacts({})` and referenced rule leaves, pinning 45 tri-state
  paths across 49 rules rather than trusting a hand-maintained list (`:132-149`).
- Structurally, all 78 tri-state leaves must use an explicit tri-state operator; `is-absent` is
  forbidden beneath `not`; each leaf is probed with unknown; and every affected rule must have an
  activation witness (`:151-191,239-267`).
- Behaviorally, every non-empty subset of each affected rule's referenced tri-state paths is set
  jointly to unknown. The current surface executes 155 subset probes; exceeding the configured bound
  fails rather than silently skipping. A matched negative-point candidate is treated as an adverse
  executable contribution (`:193-227`).

The two permanent negative controls show detector sensitivity:

1. a synthetic negative-point candidate with `not:{is-absent}` is caught structurally, as an
   effective literal, and as adverse output (`:279-308`); and
2. a two-fact compound that is safe for either singleton unknown but unsafe when both are unknown is
   caught by joint-subset probing (`:310-372`).

The live knowledge base currently contains **zero negative-point candidate rules**. Therefore the
live adverse-score failure arm is vacuous even though subset probes run; the synthetic controls prove
the detector can fail, not that every prose-level exclusion has an executable clearing representation.

The test header states, in part:

> “This does not prove clinical validity, threshold correctness, upstream aggregate correctness,
> missing-question coverage, or the out-of-scope statusIs()/hemolysis missingness semantics.”

It further says the additive-only engine has no rule-out output type or clearing tag, so the test
cannot infer exclusion semantics from clinical prose, and it specifically does not prove the deferred
NCR-1/NCR-2 tightening (`tests/tristate-safety-invariant.test.mjs:14-20`).

Cross-check: the invariant found no violation in its modeled surface, and the natural 54-fixture diff
found no output drift. These results are consistent and complementary. Neither establishes universal
input-space preservation, clinical safety, or the deferred missing-data behavior.

## 5. What this phase does NOT achieve

EP-1's proven missingness property is narrow: on the booleanMap-derived surface modeled by the
invariant (49 rules / 45 fact paths), `'unknown'` cannot satisfy either a presence check
(`is-present`) or an assessed-absence check (`is-absent`). That property is invariant-tested; it is
not a module-wide or end-to-end guarantee that missing data can no longer be treated as normal.

In particular:

- **Unknown can still satisfy exclusion / rule-out gates.** `TEC-001` retains
  `not:{is-present}` over its exam findings, so confirmed-absent and unknown are equivalent to that
  gate. Removing those findings from the TEC witness leaves them `'unknown'` and `TEC-001` still
  matches with score 70 (`modules/anemia/rules.json:1708-1745`). `IRIDA-001` has the same shape for
  `history.ongoingBloodLossKnown`: unknown still satisfies `not:{is-present}` and the candidate
  still matches with score 65 (`modules/anemia/rules.json:2367-2388`). Tightening those gates is
  deliberately deferred to NCR-1/NCR-2, and is this phase's largest missingness-safety caveat.
- **Categorical labs remain outside the model.** `statusIs()` / `hemolysisMarkerCount` (NCR-3) still
  collapse unknown categorical status with a known non-matching status; EP-1 did not establish an
  unknown-aware contract for that surface.
- **The browser surface is inert for missingness safety.** `src/app.js:41-44` turns every unchecked
  checkbox into `false`; `booleans()` and the `cbc.localFlags` call sites submit those values for the
  symptom, history, exam, and local cytopenia-flag fields (`src/app.js:83-127`). The form can submit
  with only age/Hb/MCV, manufacturing assessed-absent cytopenias and `isolatedAnemia = 'true'`, which
  can match `TEC-001`. This pre-existing behavior is unchanged from `main` and blocks any claim that
  EP-1 delivers end-to-end missingness safety; see blocking finding EP1-F6.

## 6. Deferred work and tracking

| Item | EP-1 boundary | Tracking evidence |
|---|---|---|
| NCR-1: `TEC-001` tightening + companion question | EP-1 changed positive leaves to `is-present` and retained behavior-preserving `not:{is-present}` gates. Strict confirmed-absence exam gates and question semantics require a separate `council-review` sub-change. | `ep1-migration-design.md:380-384,441-451` |
| NCR-2: `IRIDA-001` tightening + companion question | EP-1 retained behavior-preserving `not:{is-present}` for ongoing blood loss. Strict `is-absent` and the companion question are deferred. | `ep1-migration-design.md:385-389,441-451` |
| NCR-3: `statusIs()` / `hemolysisMarkerCount` | Unknown categorical lab statuses still collapse with known non-matching statuses. EP-1 did not invent a reviewed propagation contract. | `src/facts/core.js:4`; `facts.anemia.js:96-104`; `ep1-migration-design.md:390-393` |
| NCR-4: incomplete congenital-signal prompting | EP-1 added confirmed-present count and completeness facts, but no question rule for an incomplete zero assessment. | `facts.anemia.js:230-238,403-405`; `ep1-migration-design.md:394-397` |
| Open `history` passthrough asymmetry | The `...history` spread remains open; explicit normalization and the validator allow-list mitigate current rule paths but do not close the asymmetric design. | `facts.anemia.js:371-395`; `scripts/validate-kb.mjs:10-15,53-57`; `spike-003-tri-state-fact-model-migration.md:616-621` |

`TEC-001` and `IRIDA-001` could not safely be left wholly unmigrated. `eq` is strict identity
(`src/ruleEngine.js:23-25`); after fact derivation became tri-state, an old `eq true` leaf would compare
`'true' === true` and stop matching. That silent rule loss is why EP-1 performed stage 1 now and
deferred only stage 2 (`ep1-migration-design.md:430-451`).

NCR-1 through NCR-4 are tracked in the design record, and the history asymmetry is tracked in
SPIKE-003. No standalone ticket/spec for these five follow-ups was found. This matters because the
design says NCR-1 through NCR-4 must be filed before EP-1 is called done
(`ep1-migration-design.md:470-474`).

## 7. Open questions for the human council

Please record explicit answers:

1. **AC-D3 sufficiency — yes or no?** Is the empty 54-fixture diff plus the bounded invariant
   sufficient evidence for this gate, given the invariant's explicit non-claims and vacuous live
   negative-score arm? If no, name the additional executable evidence required.
2. **Gate rerun — required before approval?** Must `npm run check` exit 0 in a network-capable trusted
   environment before this record can pass `council-review`?
3. **NCR-1 — approve, reject, or redesign?** Decide the TEC strict-absence gates and specify the
   companion question's gate, wording, evidence, and priority, including how “smear reviewed/no
   blasts” is represented.
4. **NCR-2 — approve, reject, or redesign?** Decide the IRIDA ongoing-blood-loss strict-absence gate
   and specify the companion question's gate, wording, evidence, and priority.
5. **NCR-3/NCR-4 — accept deferral or block?** For each, name an owner/ticket and decide whether its
   unresolved missingness behavior blocks EP-1. For NCR-4, also decide whether incomplete assessment
   should prompt at all.
6. **History asymmetry — accept or schedule closure?** Is the current normalization/allow-list
   mitigation sufficient for EP-1, and what ticket owns removal or formal acceptance of the open
   passthrough?
7. **Source-record repair — required before gate?** Must the stale aggregate-row-2 design sentence,
   superseded 33-rule/19-check task text, and missing standalone NCR tickets be corrected before the
   council records a disposition?

## 8. Explicit non-claims and approval boundary

This record does **not** establish:

- clinical validity or correctness of any rule, threshold, candidate, alert, or question;
- diagnostic performance, including sensitivity, specificity, calibration, likelihood, or outcome
  improvement;
- safety in clinical use, human-factors suitability, or effectiveness;
- regulatory clearance, approval, or compliance; or
- that missing data are handled correctly outside the exercised and explicitly modeled software
  surfaces.

The ranking score remains an internal ordinal sort priority, not a probability or performance metric
(`src/engine.js:4-9`). This draft is a proposal for human review. It is not clinical approval and does
not publish a rule change.

`clinicalApprovers[]` and `approvedBy[]` require real, named human clinicians. Agent, model, or
synthetic-council output cannot satisfy those fields (`CLAUDE.md:75`; `.claude/worknotes/wave0-safety-foundation/decisions-block.md:32-34`).

## Verification ledger and evidence discrepancies

### Commands executed for this record

| Check | Current result | Interpretation |
|---|---|---|
| Snapshot command and `diff -ru` above | 54 written; exit 0; no diff | AC-D3 observed difference set is empty. |
| `node --test tests/tristate-safety-invariant.test.mjs tests/module-equivalence.test.mjs` | 10/10 pass: 4 invariant + 6 golden-equivalence tests | Current focused invariant and all six goldens pass (`tests/module-equivalence.test.mjs:18-35`). |
| `npm run check` | 445/445 tests pass; validation passes; activation coverage 91/91; build and import checks pass; smoke then fails with `listen EPERM 127.0.0.1` | The managed sandbox forbids the loopback bind. This invocation is **not** recorded as green. |
| Commit `579c041` verification record | Reports full `npm run check` green, 445/445, coverage 91/91, and zero 54-fixture diffs | Repository-recorded prior result; a current trusted-environment rerun remains a council decision. |

All six post-migration published-example outputs are byte-for-byte identical to the six committed
golden fixtures after the same timestamp scrub: the post directory equals the committed EP1 baseline,
and each baseline `examples__*.json` equals its corresponding `tests/golden/*.json`. The permanent
harness independently deep-compares the same six outputs (`tests/module-equivalence.test.mjs:18-35`).

### Discrepancies and qualifications found during authorship

| Finding | Consequence for this record |
|---|---|
| The design's aggregate row 2 is superseded; its Orchestrator adjudication now records the correction. | Cite current code plus `188d717`; do not treat `ep1-migration-design.md:56` as the landed formula. |
| `toTri()` converts booleans to Tri strings rather than passing their representation through unchanged. | Claim semantic/matching-population preservation only (`src/facts/tristate.js:6-10`). |
| Nine aggregate sites were inventoried, but only eight changed; hemolysis remains deferred. | Do not claim nine tri-state aggregate migrations. |
| The live invariant adverse-score arm has no negative-point rule to exercise. | Treat synthetic controls as detector evidence and retain the header's non-claims. |
| The current full check is environment-blocked at smoke. | Do not label the current `npm run check` invocation green. |
| No standalone NCR-1..NCR-4/history-asymmetry tickets were found. | Council must require filing or explicitly accept the tracking gap. |
| The phase amendment corrects the scope to 49 rules/25 occurrences, but its task table still says 33 rules/19 occurrences (`phase-1-tristate-fact-model.md:23-34,64-69`). | Use the amended/current census; ask whether plan repair is gate-blocking. |
| The unused `isTrue` helper remains at `src/facts/core.js:3`. | Dead-helper residue; no migrated production caller remains, but removal was not completed as designed. |
