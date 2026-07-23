# SPIKE Leg A — Should "not-assessed" be a 4th persisted state, or UI-only?

## 1. Does any rule rely on the is-unknown/is-not-assessed distinction?

Across all four modules, `is-unknown` appears **1 time** and `is-not-assessed` appears **0 times**
(`grep -rn` over `modules/*/rules.json`). `is-present` appears 83 times; `is-absent` 0 times.

The single `is-unknown` use:

```
modules/cbc_suite_v1/rules.json:38-41
"when": { "all": [
  { "fact": "cbc.anc", "op": "exists" },
  { "fact": "cbc.neutropenia", "op": "is-unknown" }
]}
```
(`CBC-NEUT-LOCALRANGE-001` — prompts for a local ANC range when neutropenia status can't be resolved.)

No rule anywhere uses `is-not-assessed`. The two ops are wired as literal synonyms in the engine
itself — `src/ruleEngine.js:47-48`:
```js
case 'is-unknown':
case 'is-not-assessed': return toTri(actual) === 'unknown';
```
So today the distinction isn't just unused by rule authors — it's **structurally unavailable**: both
spellings resolve to the identical branch. Nothing currently reads them as different things.

## 2. Does the engine's question/prompt logic differ between "unknown" and "not-assessed" today? Should it?

No, and it can't, because question-emission doesn't go through the tri-state ops at all. All 3
`"op": "missing"` rules (the only op that drives `"type": "question"` output) target raw scalar
facts, not tri-state booleans: `patient.ageMonths` (`modules/anemia/rules.json:3241-3243`, rule
`Q-001`), `cbc.hb` (`:3286-3288`, `Q-002`), and `thresholds.hbLower` (`:3332`-ish). `missing` checks
`actual === null || undefined || ''` (`src/ruleEngine.js:38`) — a tri-state string `'unknown'` is
none of those, so a booleanMap field explicitly submitted as `'unknown'` would **not** satisfy
`missing` even if a `missing`-gated question existed for it. In practice no such question rule
exists for a booleanMap-backed fact, so this gap is latent, not live.

Should it differ? SPIKE-003 already asked this exact question and answered it in the negative for
today's ruleset — see §5. The `question` rule-output row (`spike-003-...md:310`) says a
`not-assessed` value **should** satisfy a question-type gate (keep prompting) rather than get a
distinct behavior, i.e. the intended prompting semantics for "asked, don't know" and "never asked"
are identical: prompt again. This is the strongest evidence that a behavioral 4th state has no
rule-engine consumer today.

## 3. Blast radius — 4th persisted literal `'not-assessed'`

| # | File | Reason |
|---|---|---|
| 1 | `schemas/patient-input.schema.json` (`$defs.booleanMap`, `:135-138`) | add 4th value to the `anyOf` string enum |
| 2 | `schemas/rule.schema.json` (`:104`) | op enum already lists `is-present/is-absent/is-unknown/is-not-assessed` as distinct strings but they currently alias one state — would need a real 4-way split or a doc correction |
| 3 | `src/facts/tristate.js` (`toTri()`, `:6-11`) | must recognize the 4th literal instead of collapsing it to `'unknown'`; `countPresent`/`anyUnknown`/`allAssessed` all need a 4th-state policy decision |
| 4 | `src/ruleEngine.js` (`:45-48`) | `is-unknown` and `is-not-assessed` must stop being synonyms — split into two real branches, each with defined semantics for every consuming rule type (candidate/question/note/alert) |
| 5 | `modules/anemia/facts.anemia.js` | every `=== true`/tri-state derivation (SPIKE-003 census: 25 occurrences across 20 lines) must be re-audited for how the 4th state propagates through derived facts, not just raw inputs |
| 6 | `modules/cbc_suite_v1/rules.json` | the one `is-unknown` rule (`CBC-NEUT-LOCALRANGE-001`) needs a decision: does it also fire on `is-not-assessed`, or is that now a materially different clinical situation requiring a new/parallel rule? |
| 7 | `openapi.yaml` | `booleanMap`/tri-state schema definitions mirrored for the API surface |
| 8 | `tests/tristate-schema.test.mjs` | enum-acceptance tests need a 4th case; the "rejects out-of-enum strings" test's assumption of exactly 3 valid strings changes |
| 9 | `tests/golden/*.json` (6 files) + `tests/module-equivalence.test.mjs` | byte-identity baseline; any facts-layer semantic split risks new baselines even where no rule author intended a change (this is exactly what DEF-2/SPIKE-003 was created to avoid) |
| 10 | `tests/fixtures/**` (73 files) + `tests/witness/**` (48 files) | any fixture that currently omits a field or sets it `'unknown'` needs re-classification into "never asked" vs "asked, unknown" to be meaningful — otherwise the new state is unpopulated data-model dead weight |
| 11 | `docs/project_plans/design-specs/tri-state-fact-model.md` + SPIKE-003 doc | both currently document 3 states and an explicit rejection of a 4th (§5) — would need a superseding decision record, not a silent edit |
| 12 | `src/engine.js` (`nextQuestions`/`CORE_LIMITATIONS`) | question logic and the "missingness is never treated as normal" limitations language would need to state how the new state is handled |
| 13 | `modules/growth_suite_v1`, `modules/kidney_suite_v1` | zero current is-present/is-absent/is-unknown/is-not-assessed usage — but any shared fact/schema layer change touches their validation path too |

**≈13 files/areas**, several with fan-out inside them (25+ call sites in one file alone). This is a
fact-semantics change, which is exactly the category DEF-2 (`tri-state-fact-model.md:49-56`) says
falls outside a zero-clinical-behavior-change mandate and requires a fresh audit + council-review,
not an additive schema tweak.

## 4. Blast radius — UI-only (4th radio serializes to `'unknown'`)

| File | Change |
|---|---|
| `src/app.js` | add a 4th radio/segmented-control option per booleanMap field; on submit, map it to the wire string `'unknown'` (no new wire value) |
| (optional) `src/app.js` render path (`:1466`) | today `setSimpleField` only distinguishes checked (`true`) vs unchecked (`false` **or** `unknown` — both collapse to unchecked); a real tri/quad UI needs a genuine radio group here, which P3-WP7 (roadmap `:288`) already scopes as **UI-only** work: "surface present/absent/unknown/not-assessed **in the SPA**" |
| `src/algorithmExplorer.js` | no change needed if it only ever reads resolved tri-state facts (already tri-state-safe per SPIKE-003 UI-compat finding, `tri-state-fact-model.md:137-139`) |

No schema, engine, rule, module-facts, or golden-fixture file changes. This is the smallest possible
blast radius: 1-2 files.

**What's lost:** the distinction between "clinician actively asked and the answer came back
unknown/indeterminate" and "clinician never touched this field" is lost at the point of
serialization — both become the wire value `'unknown'`. Given the repo's guardrail that "missingness
is never treated as normal" (CLAUDE.md), this loss is honest as long as **both collapse to the same
engine treatment they already get** — i.e., as long as no rule anywhere depends on telling them apart
(true today, per §1/§2). The loss becomes dishonest only if a future rule needs "we affirmatively
ruled this out as indeterminate" to behave differently from "we forgot to ask" — and per §5, SPIKE-003
already checked the full 91-rule/49-affected corpus for exactly that need and found zero consumers.

## 5. `tri-state-fact-model.md` — explicit rationale on 3 vs 4 states

The design spec itself is silent on why 3 and not 4 in its own text — it just states the 3-value
type (`tri-state-fact-model.md:99`, `Tri = 'true' | 'false' | 'unknown'`) and treats
`is-unknown`/`is-not-assessed` as "the last two synonyms for the same 3-valued check" (`:106`),
pointing to SPIKE-003 for the reasoning. SPIKE-003 has the actual rejection, explicit and reasoned
(`spike-003-tri-state-fact-model-migration.md:579-584`):

> "**A four-state Tri type** (adding a distinct `'not-assessed'` state alongside `'unknown'` to
> literally match all 4 named RQ7 operators). Rejected: no concrete rule or fact in the audited 91
> needs to distinguish "raw field never sent" from "computed-indeterminate from present-but-
> borderline data" as two different *rule-matchable* states today — DEF-2 flags this distinction as
> a real conceptual one, but operationalizing it as a 4th enum value with no consumer would be
> speculative scope, not something this SPIKE's evidence supports."

Neither document **forbids** future extension — SPIKE-003 explicitly frames the rejection as
evidence-based ("no consumer today"), not a permanent architectural ban, and even calls the
underlying conceptual distinction "real." But it is a considered, on-the-record no, not silence, and
overturning it requires new evidence (a concrete rule/consumer), not just a UI requirement.

**Note on the roadmap's own framing:** `01-platform-expansion-roadmap.md:288` (P3-WP7) already
scopes this as **"surface present/absent/unknown/not-assessed in the SPA"** — its own words put the
four states "in the SPA," i.e. UI, not in the persisted fact model. The roadmap line is not actually
asking for a 4th data-model state; it's asking for a 4-option questionnaire UI, which is a strict
subset of the UI-only alternative in §4.

## 6. Fixture / byte-identity test breakage from a 4th enum value

`schemas/patient-input.schema.json`'s `booleanMap` gaining a 4th enum string is **additive** to a
JSON Schema `enum`/`anyOf` — it does not reject any input that currently validates. No existing
fixture uses a 4th literal, so no fixture fails validation.

But behavior-level breakage is a different question: `tests/module-equivalence.test.mjs` asserts
`assert.deepEqual(result, golden)` against the 6 files in `tests/golden/` (`anemia-inflammation`,
`beta-thalassemia-trait`, `hemolysis-hs`, `ida-toddler`, `lead-capillary`, `marrow-red-flags`) — these
are exactly the "extremely brittle" byte-identity tests. None of the golden fixtures currently
contains the literal string `'unknown'` (checked via `grep`), so a purely additive schema change
would not perturb them *by itself*. The real risk is downstream: any `toTri()`/`ruleEngine.js` change
needed to give the 4th state distinct *behavior* (not just distinct *storage*) is precisely the class
of change SPIKE-003 built the golden-fixture harness to catch, and 2 of 91 rules
(`TEC-001`/`IRIDA-001`) are already flagged as needing a new baseline under `council-review` for a
much smaller tri-state behavior change. `tests/tristate-schema.test.mjs:20-24` (the enum-acceptance
loop) and `:26-30` (out-of-enum rejection) would need a new 4th-state test case added, though neither
currently fails — they'd just be incomplete, not red.

## Recommendation

**Keep `'not-assessed'` UI-only; serialize it to `'unknown'` on the wire. Do not add a 4th persisted
literal.**

- **Zero rule-corpus demand exists.** §1/§2 show `is-not-assessed` has never been used by a rule and
  the one `is-unknown` rule has no case where telling the two apart would change its output; SPIKE-003
  already ran the exhaustive 91-rule audit (§5) and found no consumer for a real 4th state.
- **The roadmap itself only asks for UI.** P3-WP7 (`01-platform-expansion-roadmap.md:288`) literally
  scopes this "in the SPA" — the UI-only alternative satisfies the actual roadmap ask without
  reopening a data-model decision the roadmap never asked to reopen.
- **The persisted-4th-state path reopens an on-the-record rejection** (SPIKE-003, §5) and triggers a
  zero-clinical-behavior-change violation across ~13 files/areas (§3), including the brittle golden-
  fixture harness — cost/risk wildly disproportionate to a UI affordance.

**Strongest counter-argument:** SPIKE-003 itself calls the "never asked" vs "computed-indeterminate"
distinction "a real conceptual one" (not a false distinction) and only rejected it for lack of a
*current* consumer — a UI-only shim that silently discards that distinction at serialization time is
a deliberate, small, permanent loss of clinical provenance (did the clinician actually consider this
field?), and if P3-WP1's longitudinal/follow-up logic or a future safety rule ever needs "affirmatively
unknown" to trigger different follow-up than "never asked," the UI-only path will have already thrown
that signal away at the point of capture, requiring a second migration instead of building it once.
