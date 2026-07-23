# Decisions Block — P3-WP7 Four-State Adaptive Questionnaire UI

**Author:** Opus (orchestrator), 2026-07-23
**Feature slug:** `four-state-questionnaire-ui`
**Tier:** 3 (SPIKE + PRD + Implementation Plan)
**IntentTree:** `node_01KXQ7XFBSFNEEAJA8XJM621PZ`
**Evidence base:** SPIKE legs A–D in `.claude/worknotes/four-state-questionnaire-ui/`

---

## 0. Premise correction (read this first)

The task framing states "the four-state fact model ships in the engine." **It does not.** Four
independent investigations plus direct code reading agree:

| Claim in task framing | Actual state | Evidence |
|---|---|---|
| Engine has four states | Engine is **tri-state**; `is-not-assessed` is a declared **synonym** of `is-unknown` | `src/ruleEngine.js:44-48` |
| — | `toTri()` recognizes only `true`/`false`/`unknown` | `src/facts/tristate.js:6-11` |
| Blocked by P3-WP6 (FHIR) | `src/fhir/mapping.js` does not exist; **nothing** in schema/SPA depends on it | leg C §4, roadmap:287 |
| Four-state is the goal | Roadmap names the WP "**Tri**-state adaptive questionnaire UI" **twice**; IntentTree node is titled "Tri-state" | roadmap:288, :545 |
| — | A four-state type was **explicitly rejected on the record** 4 days before this plan | `spike-003-...md:579-584` |

**The real constraint is not P3-WP6.** It is SPIKE-003's recorded, reasoned rejection of a 4th enum
value ("no consumer… speculative scope"), status `completed`, dated 2026-07-19. This plan **must not
silently overturn a prior decision record.** Reopening it requires new evidence of a concrete
consumer — which does not exist.

---

## 1. The core architectural decision

**Decision: four *clinician-visible* states, three *wire* values, and "not assessed" represented by
key absence.**

| Clinician selects | Payload | Engine sees | Provenance preserved? |
|---|---|---|---|
| (never answered — default) | key **omitted** | `'unknown'` | ✅ yes — key absence is durable in saved/exported JSON |
| Unknown / can't determine | `'unknown'` | `'unknown'` | ✅ yes |
| Present | `'true'` | `'true'` | ✅ |
| Absent | `'false'` | `'false'` | ✅ |

**Why this and not the two obvious alternatives:**

- **vs. adding a 4th enum value** (`'not-assessed'`): reopens SPIKE-003's rejection, touches ~13
  files/areas including the brittle golden harness, splits an engine operator pair that is currently
  synonymous, and delivers **zero** behavior change because no rule consumes it. Rejected.
- **vs. leg A's recommendation — a 4th UI option that serializes to `'unknown'`**: this is the
  *dishonest* option and I reject it on guardrail grounds. A clinician who selects "Not assessed"
  would reasonably believe the system recorded that they did not assess it. It would not. Silently
  collapsing two clinician-meaningful inputs into one stored value, in a tool whose stated ethic is
  "missingness is never treated as normal" and whose value proposition is an auditable trace, is
  precisely the quiet dishonesty the guardrails exist to prevent. Leg A itself names this as its own
  strongest counter-argument (permanent loss of clinical provenance forcing a second migration).

Key-absence resolves the tension: the distinction is **captured and durable** in the payload, while
remaining **invisible to the rule engine** — so SPIKE-003's decision stands unreversed, no operator
splits, no golden fixture moves.

### The honesty caveat this decision carries

Key-absence is honest about *capture* but the UI must not overclaim *consequence*. Selecting
"Not assessed" vs "Unknown" changes **nothing** in the engine's output today (leg D). The UI must not
imply otherwise, and the PRD must state this plainly rather than implying improved inference.

---

## 2. Empirically verified, not assumed

Leg D ran the engine on all 6 golden fixtures with every explicit `false` deleted:

- **All 6 outputs IDENTICAL.** Aggregates unchanged.
- A synthetic all-negative bleeding history **did** flip `history.bleedingHistory: 'false' → 'unknown'`
  — the mechanism is real — yet final output was still identical.
- Reason: **all 28** rule conditions touching those 14 aggregates use `is-present`, which cannot
  distinguish `'false'` from `'unknown'` (`ruleEngine.js:45-48`). `congenitalSignalsFullyAssessed` is
  referenced by zero rules.

**This neutrality is conditional and must be pinned.** It ends the instant a rule author writes an
`is-absent`/`is-unknown`/`is-not-assessed` condition against one of these aggregates. A guard test
asserting that precondition is the single highest-value deliverable in this plan — it converts a
silent future behavior change into a loud authoring-time failure.

---

## 3. Scope decisions

### IN scope
- Four-state control for the **59** booleanMap fields (symptoms 14 + history 40 + exam 5 — counts
  derived programmatically from `src/app.js:111-131`, not the 57 quoted in an earlier pass).
- Payload change: omit unanswered fields; `checked()` → value-returning read.
- Round-trip fix: `setSimpleField()` (`app.js:1466`) currently collapses `'false'` and `'unknown'`
  to the same unchecked state — **existing round-trip data loss**, fixed as a consequence.
- Extraction of pure state-mapping logic to a DOM-free module (the only way anything here is testable).
- The neutrality guard test.

### OUT of scope (each with a reason, not a shrug)
| Excluded | Why |
|---|---|
| A 4th persisted enum value | SPIKE-003 rejection stands; no consumer |
| Splitting `is-unknown`/`is-not-assessed` operators | Same; would be a clinical semantics change |
| **"Ordered by information value"** (the *adaptive* half of the WP title, roadmap:288) | No information-value research protocol exists — `02-evidence-foundry...md:113` assigns it to us and it is unbuilt. Ranking questions by "information value" without evidence is an **invented ranking**, which the guardrails forbid. Must be a separate, evidence-backed work package. |
| Authoring rules that consume the new distinction | AI may not author clinical rules; requires named clinician review |
| P3-WP6 / FHIR Questionnaire mapping | Genuinely independent; nothing couples them |
| The 11 `smear` multi-select checkboxes, 4 `localFlags`, 6 lab booleans, 3 patient booleans, 1 non-serialized safety checkbox | Not booleanMap tri-state fields; different semantics |

**Scope honesty note for the PRD:** with the adaptive/ordering half removed, this work package is no
longer "adaptive." The PRD should say so and recommend the tracker/roadmap be corrected, rather than
shipping under a name that overstates it.

---

## 4. Surface strategy

**Decision: `<select>` with 4 options, hand-edited in `index.html`. No build-time markup generator.**

- **`<select>` over radio groups** (leg C §5): 59 fields × 4 radios = 236 inputs and ~236 tab stops
  vs 59; a 4-radio fieldset wrecks the existing 3-column `.check-grid`; and the form **already uses
  20+ status `<select>`s**, so this is an existing idiom, not a new component.
- **Hand-edit over generator**: leg C recommends a build-time generator, and I reject it. Its own
  counter-argument is decisive — this repo's SPA is deliberately zero-dependency/no-build-step, and
  `scripts/build-static.mjs` only copies and stamps. Introducing markup generation is a larger
  architectural change than the feature itself, and it moves the clinical review surface out of
  human-readable `index.html` into JS. In a repo whose guardrail model depends on a human reading
  `index.html` and seeing every clinical field verbatim, that is a real loss. 59 uniform edits are
  mechanical and diff-reviewable; the copy-paste risk is mitigated by a test asserting registry↔markup
  parity (which also fixes a **latent hand-sync drift risk that exists today**).

---

## 5. Risk hotspots

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **`RadioNodeList` guards.** `value()`(:90), `checked()`(:102-105), `setSimpleField()`(:1465) all *bail out* on `RadioNodeList`. A radio-group approach silently breaks read+write. | High | `<select>` avoids this entirely (a select is a single element). Explicitly verify. |
| R2 | **Safety-reviewed mutual exclusion** (`app.js:1634-1650`) force-writes `.checked = false` across every `immediateSafetyNames` field. | High | Must be rewritten to set an explicit value. This is safety-adjacent UI — treat as its own task with its own review. |
| R3 | **Neutrality precondition erodes silently** when a future rule uses `is-absent`. | High | Guard test (§2). Non-negotiable. |
| R4 | **Existing safety test breaks by design.** `tests/tristate-safety-invariant.test.mjs:270` asserts "all absence spellings normalize to unknown"; `TRI_VALUES` is hardcoded to 3. | Medium | We are *not* adding a 4th value, so this should stay green. If it goes red, that is a signal the design drifted — do not "fix" the test to match the code. |
| R5 | **Verification ceiling overclaim.** Nothing here can assert rendering, click/keyboard transitions, a11y, or visual integrity (leg B). | Medium | Enumerate "manually verified only" explicitly. **Forbid** a hand-rolled DOM shim presented as DOM verification (leg B §4). |
| R6 | **Survey fatigue.** 59 dropdowns defaulting to "not assessed" may increase abandonment vs 59 checkboxes. | Medium | Out of our power to measure here; record as a human-factors validation item, do not claim UX improvement. |
| R7 | **Gate is RED on main** — 8 pre-existing failures (byte-identity baselines + D1 rights checks), unrelated to this work. | High (process) | Do **not** absorb these into this plan. Plan must state its gate criterion as "no *new* failures vs the recorded main baseline," and record the 8. |

---

## 6. Phase boundaries

| Phase | Name | Scope | Exit gate |
|---|---|---|---|
| P0 | Baseline & guard | Record the 8 pre-existing failures; write the neutrality guard test (R3) **before** any behavior change | Guard test green; baseline recorded |
| P1 | Pure logic extraction | New DOM-free `src/facts/fieldState.js` mirroring `tristate.js`; direct `node --test` coverage | New module tested; `app.js` not yet rewired |
| P2 | SPA read/write rewire | `checked()`, `booleans()`, `setSimpleField()`, `populateFromInput()`, safety-exclusion listener (R2); omit-unanswered payload | Goldens still identical; source-shape pins added |
| P3 | Markup | 59 `<select>` conversions in `index.html` + CSS; registry↔markup parity test | Parity test green; manual visual check recorded |
| P4 | Docs & honesty | Update design spec + CLAUDE.md pointers; record the scope correction (§3); manual-verification checklist | `npm run check` shows no new failures |

P0 before P1 is deliberate: the guard must exist before the thing it guards.

---

## 7. Agent & model routing

Resolved via `delegation-router` (`resolve()`); records logged.

| Phase | Agent | Provider | Model | Rationale |
|---|---|---|---|---|
| P0 | general-purpose | ica | sonnet-5[1m] | Bounded test authoring |
| P1 | general-purpose | ica | sonnet-5[1m] | Pure module + tests, well-precedented |
| P2 | general-purpose | claude | sonnet | Highest-risk seam (R1/R2); keep on primary |
| P3 | general-purpose | ica | sonnet-5[1m] | 59 mechanical uniform edits |
| P4 | documentation | ica | haiku/sonnet | Doc-only |
| Review | codex | codex | gpt-5.6-terra | Cross-family adversarial diff review per wave (memory: catches real fail-closed gaps) |
| Gates | karen / task-completion-validator | claude | — | MUST-stay-primary |

**Known trap:** `execute-plan` silently skips review when reviewer agents are unregistered — probe
before launching. Anchor all prompt-embedded paths to the **absolute worktree path**; workflow agents
resolve "repo root" to the main checkout.

---

## 8. Estimation

**Anchor: `spa-module-switcher-v1`** — same repo, same SPA surface, same Tier 3, also SPIKE-backed.

| Phase | Points | Basis |
|---|---|---|
| P0 | 2 | One guard test + baseline record |
| P1 | 2 | ~35-line pure module + tests; `tristate.js` is a direct template |
| P2 | 5 | 4 functions + safety listener; the genuine risk concentration |
| P3 | 3 | 59 uniform edits + CSS + parity test — mechanical, front-loaded |
| P4 | 2 | Docs + honesty corrections |
| **Total** | **14** | Tier 3 floor (13+) |

H5 anchor check: module-switcher was comparable and landed as Tier 3. H6 hidden plumbing (~15%) is
absorbed in P2/P3. Bottom-up (14) is trusted over the roadmap's top-down "effort: M", which predates
the discovery that the engine is tri-state.

---

## 9. Open questions for the PRD

- **OQ-1** Ordering of the 4 `<select>` options — clinical-usability call, not an engineering one.
- **OQ-2** Exact clinician-facing wording ("Not assessed" vs "Not asked" vs blank). Must not imply
  the choice changes inference.
- **OQ-3** Should the roadmap/IntentTree title be corrected to drop "adaptive"? (Recommend yes, §3.)
- **OQ-4** Do the 13 non-booleanMap booleans (localFlags/labs/patient) eventually need the same
  treatment? Deferred, but should be named so it is not lost.
