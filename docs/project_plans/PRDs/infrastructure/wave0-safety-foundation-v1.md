---
title: "PRD: Phase 1 — Wave-0 Safety & Defensibility Foundation"
schema_version: 2
doc_type: prd
status: draft
created: 2026-07-19
updated: 2026-07-19
feature_slug: "wave0-safety-foundation"
feature_version: "v1"
prd_ref: null
plan_ref: null
related_documents:
  - docs/project_plans/expansion/01-platform-expansion-roadmap.md
  - docs/project_plans/expansion/03-arc-clinical-council-handoff.md
  - docs/project_plans/expansion/rf-handoff/RESULTS.md
  - docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md
  - docs/project_plans/design-specs/tri-state-fact-model.md
  - docs/project_plans/design-specs/exact-passage-evidence-schema.md
  - docs/project_plans/design-specs/signed-kb-manifest.md
  - docs/project_plans/design-specs/module-manifest-json-schema.md
  - docs/project_plans/design-specs/evidence-dual-source-unification.md
  - docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md
references:
  user_docs: []
  context:
    - .claude/worknotes/wave0-safety-foundation/decisions-block.md
    - .claude/worknotes/wave0-safety-foundation/repo-current-state.md
    - .claude/worknotes/wave0-safety-foundation/aos-asset-inventory.md
  specs:
    - schemas/rule.schema.json
    - schemas/candidate.schema.json
    - schemas/patient-input.schema.json
    - schemas/assessment-output.schema.json
  related_prds:
    - docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md
spike_ref: []
adr_refs: []
charter_ref: null
changelog_ref: null
changelog_required: true
test_plan_ref: null
owner: nick
contributors: []
priority: critical
risk_level: high
category: "infrastructure"
tags: [prd, safety, provenance, tri-state, evidence, manifest, governance, wave-0, phase-1]
milestone: null
commit_refs: []
pr_refs: []
files_affected:
  - schemas/patient-input.schema.json
  - schemas/rule.schema.json
  - schemas/evidence.schema.json
  - schemas/reference-range.schema.json
  - schemas/kb-manifest.schema.json
  - schemas/review-record.schema.json
  - src/ruleEngine.js
  - src/facts/core.js
  - src/units.js
  - src/ranges/registry.js
  - src/evidence.js
  - modules/anemia/facts.anemia.js
  - modules/anemia/rules.json
  - modules/anemia/evidence.json
  - modules/anemia/reference-ranges.json
  - modules/anemia/ranges.js
  - modules/anemia/module.json
  - server.mjs
  - scripts/validate-kb.mjs
  - scripts/sign-kb.mjs
  - scripts/kb-diff.mjs
  - scripts/mutation-run.mjs
  - tests/property.test.mjs
  - tests/boundary.test.mjs
  - tests/mutation.test.mjs
  - tests/dangerous-miss.test.mjs
  - .github/workflows/deploy-pages.yml
tier: 3
estimated_points: 68
---

# Feature Brief & Metadata

**Feature Name:**

> Phase 1 — Wave-0 Safety & Defensibility Foundation

**Filepath Name:**

> `wave0-safety-foundation-v1`

**Date:**

> 2026-07-19

**Author:**

> Nick Miethe (Opus decisions-block arbitration; PRD authored by implementation-planner agent, sonnet)

**Related Epic(s)/PRD ID(s):**

> Roadmap Phase 1 — `docs/project_plans/expansion/01-platform-expansion-roadmap.md:150-231`. IntentTree
> work_area `wave0-safety-foundation`, work packages P1-WP1…WP7 (tree `tree_01KXQ7WC1HQE2GKZSCNDVXA9G7`).

**Related Documents:**

> - `.claude/worknotes/wave0-safety-foundation/decisions-block.md` — binding phase boundaries, D-1..D-5,
>   8 risk hotspots, estimation anchors, OQ-1..OQ-6.
> - `.claude/worknotes/wave0-safety-foundation/repo-current-state.md` — exact code/schema/test surface.
> - `.claude/worknotes/wave0-safety-foundation/aos-asset-inventory.md` — what `rf`/ARC/IntentTree deliver
>   today, verified against this program.
> - `docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md` — Phase 0, the module-package
>   contract this phase builds on.
> - `CLAUDE.md` — hard guardrails (no generative model in the decision path, no invented thresholds, no
>   AI-published rule changes, no PHI).

---

## 1. Executive Summary

Phase 0 (commit `ff4b519`) proved a module-package contract with zero clinical-content change. Phase 1
installs the **safety and provenance contract every future clinical rule must satisfy** — tri-state
facts that make missingness explicit, a fail-closed unit/range service, exact-passage evidence
provenance, governed rule metadata, a verifiable KB manifest with semantic diff, and an adversarial
validation corpus — using the existing 91-rule anemia module as the proving ground. **No new clinical
module, no new or retuned threshold, and no new clinical claim is introduced.** The only clinical
content that changes is provenance metadata about existing claims and the honest representation of
missingness (D-1).

This PRD proves **software behavior and provenance**, never clinical validity, safety, or diagnostic
performance — that distinction is load-bearing throughout. The roadmap's V1-Content gate has two
halves: "every anemia rule has an exact source passage or is flagged `implementation-proposal`" is
in this phase's scope and is measurable (WP3/WP4). "Dangerous-miss review by a clinical advisor signs
off" is **not** closable by this phase — ARC's pediatric council can author dangerous-miss hazards and
review non-patient artifacts, but its readiness audit is explicitly synthetic and non-qualifying
(`docs/project_plans/expansion/03-arc-clinical-council-handoff.md`). That half of the gate stays
`not_executed_owner_held` at the end of this phase. That is an honest, allowed state under this repo's
guardrails — not a blocker to building the substrate, and not something this PRD will imply is closed.

**Priority:** Critical — every later roadmap phase (CBC suite, kidney, growth) inherits this substrate;
building new clinical content on an ungoverned rule/evidence shape multiplies the review-debt this
phase exists to retire.

**Key Outcomes:**
- Outcome 1: Missingness becomes representable and enforced — a `not-assessed` fact can never satisfy
  a differential-clearing rule branch, closing a real safety gap that today's implicit boolean collapse
  cannot express.
- Outcome 2: Every one of the 91 anemia rules resolves to an exact evidence passage or an explicit
  `implementation-proposal` flag — no rule stands on an unlabeled claim.
- Outcome 3: The KB is verifiable (hash + manifest) and the server fails closed on an unverifiable,
  incompatible, or expired KB — replacing today's tolerant-of-absence startup path.
- Outcome 4: An adversarial validation corpus (property, boundary, mutation, dangerous-miss) exists
  where today only 20 example-driven subtests do, with the 10 ARC-named dangerous-miss families
  (`DM-CBC-001..DM-WORKFLOW-010`) converted into this repo's own executable fixtures.

---

## 2. Context & Background

### Current State

The codebase is v0.3.1, a single-module pediatric anemia CDS prototype. Per
`.claude/worknotes/wave0-safety-foundation/repo-current-state.md` (cited throughout this PRD rather
than re-derived):

- **Facts**: `modules/anemia/facts.anemia.js` (357 lines) derives 56 distinct `history.*`/`symptoms.*`/
  `exam.*` fields, each collapsing `undefined`/`false`/never-touched into one falsy branch. 23 `=== true`
  checks exist (19 in `facts.anemia.js`, 1 definitional in `src/facts/core.js:3`, 1 at the WP1/WP2 seam
  `modules/anemia/ranges.js:42`, 1 UI-only in `src/algorithmExplorer.js:308`), plus 9 `countTrue()`
  aggregate call sites that each currently return a single boolean count with no not-assessed axis.
- **Rules**: `modules/anemia/rules.json` holds exactly 91 rules with exactly 5 top-level keys each
  (`id`, `category`, `evidence`, `when`, `output`) — no governance metadata exists at all. 33 of the 91
  rules reference a tri-state-shaped fact path directly in `when` (101 distinct fact paths total).
  `schemas/rule.schema.json` is `additionalProperties: false` (`:7`), so any new field must land on all
  91 rules simultaneously or validation breaks wholesale.
- **Engine**: `src/ruleEngine.js`'s `evaluateLeaf()` (`:18-37`) implements 13 operators today; an
  unrecognized operator already throws (`:35`) — a fail-closed behavior to preserve, not a gap.
- **Evidence**: `src/evidence.js` and `modules/anemia/evidence.json` are two hand-synced copies of the
  same 6 records (DEF-1, unresolved). `supports[]` is a flat array of claim-summary prose strings — no
  locator, no exact passage, no per-claim grade. Direct verification against `modules/anemia/rules.json`
  (this session) shows all 91 rules cite at least one of the 6 evidence IDs; per-source citation counts:
  `AAP2026_IDA` 32, `BLOOD2022_PED_ANEMIA` 55, `WHO2024_HB` 8, `CDC2025_LEAD` 7, `BSH2020_G6PD` 6,
  `FDA2026_CDS` 0 (product/regulatory framing only) — counts sum above 91 because some rules cite more
  than one source. (This corrects `repo-current-state.md`'s claim that `BSH2020_G6PD` is unreferenced;
  it is cited by 6 rules. Only `FDA2026_CDS` is unreferenced by any rule.)
- **Manifest**: `modules/anemia/module.json` is an unsigned stub — every signing-relevant field
  (`clinicalContentHash`, `approvedBy`, `validationRunId`, `supersedes`, `releasedAt`) is already present
  and already `null`/`[]`, anticipating this phase's field names (no shape migration needed).
  `server.mjs` reads it tolerantly (`:26-31`, catches `ENOENT`, continues with `manifest: null`) — zero
  signature/hash/expiry/compatibility checks exist today.
- **Schemas/tests/scripts**: exactly 4 schema files, 3 test files (20 `node --test` subtests total), 5
  scripts, 6 `examples/*.json` (also the golden-fixture equivalence baseline), 1 CI workflow
  (`push: [main]` + `workflow_dispatch` only, no PR trigger, `check:imports` not wired into CI).
  `package.json` has no `dependencies`/`devDependencies` and no lockfile.
- **Gate**: `npm run check` (test → validate → build → check:imports → smoke) is green today (Node
  `v20.19.3`; repo-current-state §F).

### Problem Space

Every subsequent roadmap phase (CBC suite, longitudinal/referral, kidney, growth) adds clinical content
on top of whatever safety contract exists when it starts. Today that contract has four structural gaps:
(1) missingness is not distinguishable from a clinician-asserted negative, so a rule-out branch can fire
on data nobody ever collected; (2) numeric values have no enforced unit, so a mismatched unit converts
silently instead of failing; (3) every evidence citation is a bare source ID with no exact passage, so a
reviewer must manually re-locate the supporting text; (4) nothing verifies that the KB being served is
the KB that was reviewed. Building CBC/kidney/growth content against this contract would multiply the
debt this phase exists to retire once, on anemia, before a second module exists to inherit it.

### Current Alternatives / Workarounds

None. Only one module has ever been built, and Phase 0 explicitly deferred every one of these concerns
(DEF-1 through DEF-5 below) as "changes fact/evidence/manifest semantics, out of scope for a
zero-behavior-change structural refactor."

### Prior Art — Phase 0 Deferred Items feeding this phase

Each design spec below is `idea`/`shaping` maturity, written at Phase 0's close specifically to avoid
a shape migration when this phase lands. This PRD does not contradict them; it promotes them:

| Spec | Maturity | Feeds |
|---|---|---|
| `docs/project_plans/design-specs/evidence-dual-source-unification.md` (DEF-1) | idea | WP3 (prerequisite, D-2) |
| `docs/project_plans/design-specs/tri-state-fact-model.md` (DEF-2) | shaping | WP1 |
| `docs/project_plans/design-specs/exact-passage-evidence-schema.md` (DEF-3) | idea | WP3 |
| `docs/project_plans/design-specs/signed-kb-manifest.md` (DEF-4) | idea | WP5 |
| `docs/project_plans/design-specs/module-manifest-json-schema.md` (DEF-5) | idea | WP4/WP5 |

### AOS Asset Landscape (verified this session, not assumed)

Per `aos-asset-inventory.md`: **RF-EV-001** (exact-passage backfill, 6 anemia sources, 48 claims:
35 supported/8 inferred/5 speculation) and **REG-001** (FDA intended-use memo, 89 claims) are `rf`
runs that are **done and verified** (`rf verify` exit 0, 0 unsupported, both). **RF-EV-002** (CALIPER/
Bohn 2023 pediatric CBC reference intervals) and **REG-002** (content-rights/licensing review) are
**not run**. The ARC pediatric clinical council (`pediatric-anemia-clinical-review-council@0.1.0`) is
repository-ready and produced a completed readiness audit — but that audit is **explicitly synthetic
and non-qualifying**; it supplies a reviewer-role vocabulary and 10 named dangerous-miss families, not
a credentialed sign-off, and it must never populate `clinicalApprovers[]`/`approvedBy[]` (D-4). The
IntentTree tracker is independently confirmed stale relative to real repo/`rf` state and must be
resynced before being trusted for kickoff.

### Architectural Context

```
patient JSON → deriveFacts() (tri-state, WP1) → JSON rule engine (WP1 operators, over WP4-governed rules.json)
            → unit-checked candidate merge/rank (WP2) → exact-passage evidence-linked output (WP3)
            → signed/verified manifest gate (WP5) → audit
```

This is a deterministic, evidence-linked pipeline, not a routed web app — no routers/services/
repositories/DTOs apply. `docs/architecture.md` §6 (KB release manifest), §7 (rule-authoring model
production additions), §8 (FHIR/UCUM — "reject unit mismatches rather than silently convert"), and §10
(availability/failure modes — 5 fail-closed conditions) are the normative specs this phase implements.
No generative model exists anywhere in this call path; this phase does not introduce one.

---

## 3. Problem Statement

**User Story:** As the engineer building Phase 2's CBC suite, when I add clinical content on top of
today's substrate, I inherit an engine that cannot distinguish "not asked" from "asked and negative," a
range service with no enforced units, evidence citations with no passage trace, and rule metadata with
no governance fields — instead of a substrate that makes missingness, units, provenance, and approval
state explicit and fail-closed, this phase installs that substrate once, on the one module that already
exists.

**Technical Root Cause:**
- `facts.anemia.js`'s boolean collapse (56 fields, 23 `=== true` checks, 9 `countTrue()` aggregates) has
  no not-assessed axis — `src/ruleEngine.js`'s 13 operators.
- `patient-input.schema.json`'s numeric lab fields carry unit hints only as JSON-Schema doc-strings,
  never enforced or compared — `src/ranges/registry.js`, `modules/anemia/ranges.js`.
- `src/evidence.js`/`modules/anemia/evidence.json` — dual-maintained, document-level-only citations.
- `rule.schema.json`'s `additionalProperties: false` blocks any incremental governance-field rollout.
- `server.mjs`'s manifest handling is tolerant-of-absence, not required-and-verified.

---

## 4. Goals & Success Metrics

### Primary Goals

**Goal 1: Missingness is safety-enforced, not merely representable.**
- A `not-assessed` fact can never satisfy a rule-out/differential-clearing branch (FR-WP1-05).
- Measurable: dedicated invariant test (WP6) passes; D-3's golden-diff enumeration shows zero
  unexplained diffs (AC-D3).

**Goal 2: Every rule traces to evidence or is honestly flagged a proposal.**
- All 91 rules resolve `sourcePassageId` to a passage-level record or an explicit
  `implementation-proposal` sentinel (FR-WP3-04/FR-WP4-02).
- Measurable: `scripts/validate-kb.mjs` extension reports 91/91 resolved.

**Goal 3: The KB is verifiable and the server fails closed.**
- `server.mjs` rejects a missing/invalid/expired/incompatible manifest instead of serving tolerantly.
- Measurable: all 5 of ARCH §10's fail-closed conditions have a corresponding automated test
  (AC-FAILCLOSED).

**Goal 4: No overclaimed clinical approval.**
- `clinicalApprovers[]` and manifest `approvedBy[]` ship empty in every build this phase produces; the
  ARC synthetic review is never a source for either field.
- Measurable: dedicated governance test (AC-D4) — the single most important AC in this phase (D-4).

### Success Metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Rule provenance coverage (91 rules with resolvable `sourcePassageId` or explicit proposal flag) | 0/91 | 91/91 | `scripts/validate-kb.mjs` |
| Evidence source passage coverage (of 6 sources) | 0/6 | 6/6, with `FDA2026_CDS` explicitly non-blocking (0 citing rules) | `schemas/evidence.schema.json` validation |
| Unexplained golden diffs (6 examples, D-3) | n/a | 0 | `tests/module-equivalence.test.mjs` + migration record |
| Mutation-score baseline (WP6-defined, OQ-4) | undefined | defined from measurement and met | `scripts/mutation-run.mjs` |
| ARCH §10 fail-closed conditions with a test | 0/5 | 5/5 | WP6 boundary + dangerous-miss suites |
| ARC dangerous-miss families converted to executable fixtures | 0/10 | 10/10 | `tests/dangerous-miss.test.mjs` |
| Builds asserting `clinicalApprovers[]`/`approvedBy[]` empty | n/a | 100% | dedicated governance test (AC-D4) |
| New runtime/build dependencies added | 0 | 0, or 1 explicitly rationalized devDependency (never silent) | `package.json` diff |
| Rules passing extended `rule.schema.json` | 0/91 | 91/91 | `npm run validate` |
| CI gate parity (`check:imports` + PR trigger present) | 0/2 | 2/2 | `.github/workflows/deploy-pages.yml` diff |

No metric in this table is, or implies, a clinical-performance claim (no sensitivity, specificity, PPV,
NPV, or accuracy figure appears anywhere in this phase's success criteria).

---

## 5. Personas (internal — no clinician/patient-visible surface changes)

**Primary: Phase 2+ module author** — needs a governed rule/evidence/manifest shape to register the
CBC suite against, without re-deriving safety invariants per module.

**Secondary: Safety `council-review` reviewer** — reviews the tri-state and unit-rejection invariant
designs before merge (decisions-block P1/P2 exit gates); needs an auditable enumeration of every golden
diff with rationale, not an assertion that "nothing clinical changed."

**Tertiary: Owner-held credentialed reviewer (future)** — the eventual, real, named, credentialed human
this phase's `clinicalApprovers[]`/`approvedBy[]` fields are built for. This phase does not produce that
person's approval; it produces the structurally-ready, honestly-empty field they will one day fill.

---

## 6. Binding Constraints (D-1..D-5)

These five decisions from `.claude/worknotes/wave0-safety-foundation/decisions-block.md` are not open
for re-litigation; each carries its own testable acceptance criterion.

**D-1 — No new clinical claims.** Only provenance metadata about existing claims and honest missingness
representation change. A tri-state-exposed latent missingness bug that changes rule behavior is the one
permitted exception, and only if enumerated, reviewed, and individually approved (see AC-D3).
- AC: any behavior change not classified under AC-D3's enumeration is a no-go, full stop.

**D-2 — Evidence must be single-source before it can be signed.** DEF-1 resolution (FR-WP3-01) is a
prerequisite to the rest of WP3, not a WP5 cleanup.
- AC: `src/evidence.js` no longer hand-maintains a second copy of the 6 evidence records before any
  passage-level field is added; golden-fixture equivalence proves the de-dup changed no output.

**D-3 — Golden-output equivalence is a review gate, not a pass/fail gate.**

#### AC-D3: Every golden diff is enumerated, classified, and rationalized
- target_surfaces:
    - tests/golden/anemia-inflammation.json
    - tests/golden/beta-thalassemia-trait.json
    - tests/golden/hemolysis-hs.json
    - tests/golden/ida-toddler.json
    - tests/golden/lead-capillary.json
    - tests/golden/marrow-red-flags.json
    - tests/module-equivalence.test.mjs
- propagation_contract: every difference between the pre-WP1 golden fixture and the post-WP1 output,
  across all 6 examples, is recorded in a migration record, classified `expected-from-tri-state` or
  `unexpected`, and every expected diff carries a written clinical rationale.
- resilience: n/a (review-gate artifact).
- visual_evidence_required: false.
- verified_by: safety `council-review` gate before merge (decisions-block P1 exit criterion). Any diff
  that clears (removes) a differential branch on a `not-assessed` input is an automatic no-go regardless
  of rationale offered.

**D-4 — ARC output may never populate `clinicalApprovers[]`/`approvedBy[]`.**

#### AC-D4: Approval fields are structurally ready and honestly empty
- target_surfaces:
    - schemas/rule.schema.json (`clinicalApprovers[]`)
    - schemas/kb-manifest.schema.json (`approvedBy[]`)
    - modules/anemia/rules.json
    - modules/anemia/module.json
- propagation_contract: both fields are typed (`{role, approvalId}`/`{reviewer, role, approvedAt}`-shaped
  entries per ARCH §6/§7) but every rule and every manifest this phase produces ships them empty; release
  state is recorded as `not_executed_owner_held`, never any approved/signed state.
- resilience: a dedicated test asserts `clinicalApprovers` is `[]` on all 91 rules and `approvedBy` is
  `[]` on the manifest in any build this phase produces, and fails if either is populated from any
  non-owner-attested source — including ARC council output. This is a structural guarantee, not
  documentation.
- visual_evidence_required: false.
- verified_by: FR-WP4-03, FR-WP5-01, dedicated WP6 governance test.

**D-5 — Zero-runtime-dependency default; build-time deps require an explicit decision.**
- AC: `package.json`'s `dependencies`/`devDependencies` remain absent, or exactly one is added with a
  written rationale recorded in the implementation plan — never silently. WP2 (units) and WP6
  (property/mutation) are the two places this must be actively decided, not defaulted into.

---

## 7. Requirements by Work Package

Point estimates below are the decisions-block's per-phase anchors (P1..P7 map 1:1 onto WP1..WP7);
an additional 8 points of Phase-1-internal de-risking (SPIKE-003..006 authorship + D-2's DEF-1
resolution + IntentTree resync + launching RF-EV-002/REG-002) is a gating prerequisite, not itself one
of the 7 WPs — see §10 Dependencies.

### WP1 — Tri-state fact model (13 pts)

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP1-01 | Replace `patient-input.schema.json`'s `booleanMap` $def (`:114-117`) with a `triState` $def. Per OQ-1's lean, the 56 known `history.*`/`symptoms.*`/`exam.*` fields become an explicit per-module enumerated allow-list (not a global open `additionalProperties`), each valued `present`/`absent`/`unknown`/`not-assessed`. | Must | Schema rejects an unrecognized field name; today's silent typo-reads-as-absent becomes a validation failure. |
| FR-WP1-02 | Add 4 new `ruleEngine.js` operators (`is-present`/`is-absent`/`is-unknown`/`is-not-assessed`) as new cases in `evaluateLeaf()`'s switch (`:21-36`); the existing `Unknown rule operator` throw (`:35`) is preserved unweakened. | Must | Unit tests exercise all 4 operators against all 4 states; an unrecognized operator string still throws. |
| FR-WP1-03 | Migrate the 19 `=== true` checks in `facts.anemia.js`, the definitional collapse in `src/facts/core.js:3`, and all 9 `countTrue()` aggregate sites to tri-state-aware logic distinguishing "N present / M not-assessed" from today's single boolean count. | Must | Each of the 9 aggregates has a reviewed old-count → (present-count, not-assessed-count) mapping, applied before the codemod. |
| FR-WP1-04 | Migrate the 33 of 91 rules whose `when` referenced a tri-state fact path (101 distinct paths) from implicit falsy checks to explicit tri-state operators, per a rule-by-rule mapping table authored before the codemod. | Must | All 33 rules re-verified against AC-D3; the remaining 58 rules require no edit. |
| FR-WP1-05 | Safety invariant: no rule-out/differential-clearing branch is satisfiable by a `not-assessed` fact; not-assessed narrows (adds a next question / keeps differential open), never clears. | Must | Dedicated invariant test (WP6) asserts swapping any referenced field to not-assessed cannot fire a clearing branch, for every rule tagged as clearing. |
| FR-WP1-06 | This WP triggers the D-3 golden-diff gate. | Must | See AC-D3 (§6). |
| FR-WP1-07 | Seam (R-P3): `modules/anemia/ranges.js:42` (`menstruating === true`) is shared with WP2. `integration_owner = WP1`'s executor; WP2 must not edit this line. | Must | See AC-SEAM below. |

#### AC-SEAM: WP1/WP2 shared line stays correct across both migrations
- target_surfaces:
    - modules/anemia/ranges.js:42
- propagation_contract: WP1 (tri-state) and WP2 (units/ranges) touch disjoint files but share this one
  ferritin-threshold gate line; ownership is WP1's.
- resilience: a seam test independently verifies ferritin-threshold lookups resolve correctly for
  `menstruating` present/absent/unknown/not-assessed after WP1 lands, before WP2 is considered complete.
- visual_evidence_required: false.
- verified_by: dedicated seam test, owner WP1 per decisions-block §2 (R-P3).

Note: `src/algorithmExplorer.js:308` is a UI-only consumer of tri-state-shaped booleans, out of engine scope — WP1 verifies (not edits) that no display-logic change is required.

### WP2 — Local reference-range registry + unit service (8 pts)

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP2-01 | New `src/units.js` — closed, hand-rolled UCUM unit table (D-5) covering the ~10 numeric lab fields (hemoglobin, mcv, rdw, rbc, wbc, anc, platelets, ferritin, stfrFerritinIndex, bloodLeadLevel) whose units are today unenforced JSON-Schema doc-strings. | Must | Every numeric lab field carries an enforced unit; an unrecognized unit string is rejected. |
| FR-WP2-02 | New `schemas/reference-range.schema.json` formalizing band/threshold shape with an explicit unit tag per band/threshold. | Must | Schema validates today's `reference-ranges.json` shape plus the new unit tag; missing unit tag fails validation. |
| FR-WP2-03 | Formalize `src/ranges/registry.js` + `modules/anemia/ranges.js` to validate the request unit against the registered band/threshold unit before lookup, preserving today's AAP-fallback + local-override precedence and the existing tolerant-null behavior for an *unregistered* `(module, analyte)` pair. | Must | Registered-band unit mismatch is rejected (FR-WP2-04); unregistered pair still returns null, never throws. |
| FR-WP2-04 | Fail-closed unit-mismatch rejection (ARCH §8/§10) at the decided boundary (API + browser). SPIKE-004 decides the missing-unit policy (reject vs. accept-with-`unitAssumed` flag, OQ-5); either way the policy applies consistently and is never silent. | Must | See AC-FAILCLOSED (§7, WP5). |
| FR-WP2-05 | Seam (R-P3): verify `ranges.js:42` behaves correctly post-WP1, before WP2 completion. | Must | See AC-SEAM (WP1). |

### WP3 — Exact-passage evidence records (10 pts)

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP3-01 | Resolve DEF-1 (D-2 prerequisite): `src/evidence.js` stops hand-duplicating `modules/anemia/evidence.json`; it loads from (or is generated from) the single JSON source. Must land before the rest of WP3 extends the evidence shape. | Must | Golden-fixture equivalence proves de-dup alone changes no output. |
| FR-WP3-02 | New `schemas/evidence.schema.json` formalizing passage-level records: `sourceLocator` {page/section/table/figure}, `exactPassage`, `evidenceGrade`, `applicability` {age/sex/assay}, `reviewDate`, `supersedes`, `surveillanceQuery`, `status` (`source-supported`/`implementation-proposal`). | Must | Schema validates a passage record for each of the 6 sources; a record with neither `exactPassage` nor `status: implementation-proposal` fails validation. |
| FR-WP3-03 | New, deterministic, re-runnable `rf`-bundle → KB-pack converter consuming the verified RF-EV-001 bundle (48 claims: 35 supported/8 inferred/5 speculation, `rf verify` exit 0). | Must | Re-running the converter against unchanged input reproduces byte-identical output. |
| FR-WP3-04 | Backfill passage-level records for all 6 evidence sources — see AC-WP3-ENUM below (R-P1). | Must | See AC-WP3-ENUM. |
| FR-WP3-05 | Extend `scripts/validate-kb.mjs` so every `rule.evidence[]`/`candidate.evidence[]` reference resolves to a passage-level record or an explicit `implementation-proposal` flag. | Must | `npm run validate` fails on any evidence reference resolving to neither. |

Dependency note: **REG-002** (content-rights/licensing review, not yet run) decides whether `exactPassage` may quote verbatim guideline text or must paraphrase-with-locator-only (see the exact-passage design spec's open question) — this gates FR-WP3-02/04's final wording, not their shape.

#### AC-WP3-ENUM: Every one of the 91 rules resolves to a passage or an explicit proposal flag
- target_surfaces:
    - modules/anemia/rules.json (91 rules, grouped by cited evidence source, verified by direct grep
      this session — not the roadmap's unverified "5 of 6" framing): `AAP2026_IDA` 32 citing rules,
      `BLOOD2022_PED_ANEMIA` 55, `WHO2024_HB` 8, `CDC2025_LEAD` 7, `BSH2020_G6PD` 6, `FDA2026_CDS` 0
      (no citing rules; product/regulatory framing only, evaluated for completeness, non-blocking)
    - modules/anemia/evidence.json (6 source records)
- propagation_contract: WP3's converter (FR-WP3-03) mints passage-level records from RF-EV-001 for each
  of the 6 sources; WP4's codemod (FR-WP4-02) sets each rule's `sourcePassageId` to a minted passage ID
  drawn from a source already in that rule's `evidence[]`, or an explicit `implementation-proposal`
  sentinel if no RF-EV-001 claim maps to that rule's asserted threshold/behavior.
- resilience: a rule whose `sourcePassageId` cannot be resolved fails schema validation — `rule.schema.
  json` requires exactly one of a resolvable `sourcePassageId` or the explicit proposal flag, never
  silent absence.
- visual_evidence_required: false.
- verified_by: FR-WP3-05, FR-WP4-01/02.

#### AC-WP3-RESIL: Consumers handle absent evidence fields (R-P2)
- target_surfaces:
    - src/engine.js (provenance/ruleAudit assembly)
    - src/app.js (citation rendering)
    - src/algorithmExplorer.js (evidence display)
    - scripts/validate-kb.mjs
- propagation_contract: engine/UI code reads evidence records through the WP3 accessor; a legacy-shape
  record encountered mid-migration (new fields absent) must not throw.
- resilience: absent `sourceLocator`/`exactPassage` renders as "locator pending" in UI and surfaces as a
  `validate-kb` warning, not a crash; absent `applicability` is treated as "unrestricted" only when
  `status: implementation-proposal` — otherwise validation fails (missingness ≠ normal, per CLAUDE.md).
- visual_evidence_required: false.
- verified_by: FR-WP3-02, FR-WP3-05.

### WP4 — Rule metadata for governance (5 pts)

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP4-01 | Extend `rule.schema.json` (`additionalProperties: false`, `:7`) with `version`, `effectiveDate`, `retireDate`, `owner`, `safetyClass`, `requiredTestCaseIds[]`, `changeRationale`, `sourcePassageId`, `clinicalApprovers[]` — explicit typed nulls/empty-arrays for legitimately-absent fields so absence is schema-representable (Risk 6). | Must | Schema accepts explicit `null`/`[]`; omission of a required field still fails. |
| FR-WP4-02 | Single-commit codemod over all 91 rules (no incremental path under `additionalProperties: false`) populating `version`/`effectiveDate`/`owner`/`safetyClass`/`sourcePassageId`/`changeRationale`; `requiredTestCaseIds[]` populated where a WP6 fixture exists, else an explicit empty array. | Must | All 91 rules validate against the extended schema in one commit; `npm run validate` exits 0. |
| FR-WP4-03 | D-4: `clinicalApprovers[]` ships `[]` on all 91 rules. | Must | See AC-D4 (§6). |
| FR-WP4-04 | R-P2 — see AC-WP4-RESIL below. | Must | See AC-WP4-RESIL. |

#### AC-WP4-RESIL: Consumers handle absent rule-governance fields (R-P2)
- target_surfaces:
    - modules/anemia/rules.json
    - src/ruleEngine.js
    - src/engine.js (provenance assembly)
    - scripts/validate-kb.mjs
- propagation_contract: code reading `version`/`effectiveDate`/`retireDate`/`owner`/`safetyClass`/
  `requiredTestCaseIds`/`changeRationale`/`sourcePassageId`/`clinicalApprovers` must treat
  `retireDate: null` as "active," `clinicalApprovers: []` as "no credentialed approval yet" (never as
  "approved"), and `requiredTestCaseIds: []` as "no test-case linkage yet" (never as "exempt from
  testing").
- resilience: `version`/`effectiveDate`/`owner`/`safetyClass`/`sourcePassageId` missing is a schema
  validation failure (they are not optional); `retireDate`/`clinicalApprovers`/`supersedes`-style fields
  are legitimately null/empty and must never be treated as errors.
- visual_evidence_required: false.
- verified_by: FR-WP4-01, FR-WP4-02.

### WP5 — Signed KB manifest + semantic diff (10 pts)

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP5-01 | New `scripts/sign-kb.mjs` computing `clinicalContentHash` (SHA-256) over the canonicalized concatenation of `modules/anemia/{rules,candidates,evidence,reference-ranges}.json`; `validationRunId` from the equivalence-harness/CI run that produced the build. `approvedBy[]` ships empty per D-4. | Must | See AC-D4 (§6); hash is reproducible on two clean runs against unchanged input. |
| FR-WP5-02 | New `schemas/kb-manifest.schema.json` formalizing ARCH §6's shape, superseding `module.json`'s current field-presence-only checks (DEF-5). | Must | Schema validates today's `module.json` stub plus the new signing fields once populated. |
| FR-WP5-03 | New `scripts/kb-diff.mjs` classifying rule-add/remove/threshold-change/evidence-change. A seeded adversarial change corpus (known safety-relevant mutations) must never classify as cosmetic. | Must | Every seeded safety-relevant mutation is flagged non-cosmetic; cross-family adversarial review passes before ship (Risk 2). |
| FR-WP5-04 | Flip `server.mjs`'s manifest handling (`:26-31`, tolerant-of-absence) to required-and-verified. | Must | See AC-FAILCLOSED below. |
| FR-WP5-05 | R-P2 — see AC-WP5-RESIL below. | Must | See AC-WP5-RESIL. |

Whether signing is real asymmetric cryptography or a hash+chain with signing deferred is SPIKE-006's
decision (OQ-3); this PRD requires verifiability and fail-closed behavior either way, not a specific
signature algorithm.

#### AC-FAILCLOSED: ARCH §10's 5 fail-closed conditions each have a check + test
- target_surfaces:
    - server.mjs
    - src/units.js
    - src/ranges/registry.js
    - src/app.js (browser-mode verification path)
- propagation_contract: (1) unit absent/incompatible → reject at the WP2 boundary; (2) age outside
  supported range with no local limits → refuse to assess (not merely narrow limitations text, today's
  `facts.anemia.js:26,214` behavior); (3) KB signature/hash invalid → server refuses to start/serve;
  (4) UI/engine version incompatible → reject; (5) evidence expired vs. `evidenceReviewedThrough`
  governance policy → reject.
- resilience: failure state is a displayed "no assessment produced," never stale or partial output —
  ARCH §10's literal text.
- visual_evidence_required: false.
- verified_by: FR-WP2-04, FR-WP5-04, WP6 boundary/dangerous-miss suites.

#### AC-WP5-RESIL: Consumers handle absent manifest fields (R-P2)
- target_surfaces:
    - server.mjs (KB load path)
    - scripts/sign-kb.mjs
    - scripts/validate-kb.mjs
    - modules/anemia/module.json / kb-manifest
- propagation_contract: server startup verification (FR-WP5-04) reads `clinicalContentHash`/
  `approvedBy`/`validationRunId`/`supersedes`. A first release's `supersedes: null` is valid (no prior
  version) and `approvedBy: []` is valid per D-4 — both are legitimately empty, never an error.
- resilience: by contrast, `clinicalContentHash`/`validationRunId` missing or `status !== verified` must
  fail closed (reject, do not serve) — the server must never conflate "legitimately empty" with
  "must-not-be-empty-to-serve."
- visual_evidence_required: false.
- verified_by: FR-WP5-01, FR-WP5-04.

### WP6 — Expanded validation corpus (10 pts)

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP6-01 | New `tests/property.test.mjs` — hand-rolled seeded deterministic generators against `node:test` (D-5: no property-testing dependency by default) exercising fact-derivation and rule invariants, including FR-WP1-05's narrowing invariant. | Must | Generators are seeded (reproducible failures); no `fast-check`-class dependency added without D-5's recorded rationale. |
| FR-WP6-02 | New `tests/boundary.test.mjs` — boundary-value cases at every numeric threshold in `modules/anemia/rules.json` (e.g., ferritin exactly at 20/30 ng/mL). | Must | Every threshold-bearing rule has an at-boundary and one-unit-past-boundary case. |
| FR-WP6-03 | New `tests/mutation.test.mjs` + `scripts/mutation-run.mjs` — hand-rolled mutation runner (D-5). Mutation-score baseline is defined empirically in this WP (OQ-4), not guessed in advance. | Must | Baseline is recorded from a real measurement run; subsequent runs gate on ≥ baseline. |
| FR-WP6-04 | New `tests/dangerous-miss.test.mjs` encoding ARC's 10 named families (`DM-CBC-001..DM-WORKFLOW-010`) as executable fixtures. Phase 1 owns this conversion (Risk 5); the ARC Adoption plan's P4-T1 consumes these fixtures rather than re-deriving them — recorded as a cross-plan dependency in both plans' `related_documents`. | Must | All 10 families have an executable fixture with expected alert/abstention and a passing test. |
| FR-WP6-05 | CI hardening: add `check:imports` to `.github/workflows/deploy-pages.yml` (present locally in `npm run check`, absent from CI) and a PR-trigger job (today only `push: [main]` + `workflow_dispatch`). | Must | CI runs `check:imports` and gates on a pull-request event, not only `main` push. |

### WP7 — Clinical-review portal, concept + data contract only (4 pts)

| ID | Requirement | Priority | Acceptance Criterion |
|:-:|---|:-:|---|
| FR-WP7-01 | New `schemas/review-record.schema.json` — data contract only (not the app) for change-proposal → dual-review → conflict-resolution → approval, emitting the `approvedBy[]` shape WP5's manifest consumes. | Must | Schema round-trips a hand-authored example record through all 4 workflow states. |
| FR-WP7-02 | Design doc (`docs/`) describing workflow states (proposed/under-review/disputed/approved/rejected) and role vocabulary. | Must | Doc exists, cross-references ARC's council seat taxonomy as a role-vocabulary input (not an approval source). |
| FR-WP7-03 | D-4 applies here too: the contract's `approvedBy[]` output is structurally ready for a real credentialed identity; the contract documents explicitly that ARC review output is not an eligible source for populating it. | Must | Design doc contains an explicit non-goal statement to this effect, not merely an omission. |

---

## 8. Non-Functional Requirements

**Zero-runtime-dependency (D-5):** `package.json`'s `dependencies`/`devDependencies` stay absent by
default. WP2 (units) and WP6 (property/mutation) are the two places tempted to add one; any dependency
requires a written rationale recorded in the implementation plan, never a silent default.

**No PHI:** no WP in this phase adds patient-identifying data collection; the browser assessment
continues to send no patient data anywhere.

**No generative model in the decision path:** none of the 7 WPs introduce one. WP3's `rf`-bundle → KB-
pack converter transforms already-verified `rf` claims deterministically — it does not generate new
clinical claims.

**Deterministic + offline-capable:** WP1–WP6 execute without network access at runtime, in both server
and browser-only mode. WP3's converter runs offline against a locally-available `rf` bundle.

**Fail-closed:** WP2 (unit mismatch) and WP5 (unverifiable/expired KB) reject rather than silently
degrade; ARCH §10's 5 conditions are the exhaustive checklist (AC-FAILCLOSED).

**No AI-published rule changes:** all rule metadata/content changes in this phase route through the
existing human-reviewed PR process. D-1's exception path (latent missingness bugs) requires individual
review and approval — never bulk auto-application.

**Reproducibility:** WP5's `clinicalContentHash` and WP3's converter are both deterministic — re-running
against unchanged input reproduces identical output/hash.

---

## 9. Scope

### In Scope

- WP1–WP7 as specified in §7, against the anemia module only.
- The de-risking prerequisites gating WP1/WP2/WP5 (SPIKE-003..006 authorship, D-2's DEF-1 resolution).
- The cross-plan dangerous-miss fixture ownership edge with `arc-clinical-council-adoption-v1` (Risk 5).

### Out of Scope

- **Any new clinical module** (CBC suite is Phase 2).
- **Any new or retuned clinical threshold** — every rule/candidate/evidence value is migrated for
  provenance/governance metadata, never edited in clinical meaning, except D-1's individually-reviewed
  exception path.
- **CBC-suite content of any kind.**
- **The full clinical-review portal application** — WP7 is contract-only (`schemas/review-record.
  schema.json` + design doc), not an implemented UI or workflow engine.
- **Credentialed clinical/legal sign-off** — owner-held; ARC cannot supply it (D-4).
- **A qualifying ARC SDK runtime pilot** — blocked on the ARC Adoption plan's own P1/P2/P5, tracked
  there, not here.
- **Real cryptographic KB signing**, if SPIKE-006 recommends a hash+chain deferral (OQ-3) — this PRD
  requires verifiability, not a specific algorithm.
- **MKT-001** customer/buyer interviews — human-only, no AOS asset applies.
- **DEF-6, DEF-7, DEF-8** — see Deferred Items below; explicitly not silently dropped.

### Deferred Items (carried forward, not dropped)

| Item | Spec | Why still deferred | Next action |
|---|---|---|---|
| DEF-6 — public `moduleId` API surface | `design-specs/public-moduleid-api-surface.md` (shaping) | No second module registers in this phase; nothing consumes it yet. | Revisit at Phase 2 CBC-suite kickoff (DOC-006 spec refresh). |
| DEF-7 — algorithm-explainer/examples relocation | `design-specs/algorithm-explainers-examples-relocation.md` (shaping) | UI/static-asset concern, not KB/safety content; no WP in this phase touches it. | Revisit when a second module's examples would collide (DOC-006). |
| DEF-8 — headless-browser runtime smoke check | `design-specs/headless-browser-runtime-smoke-check.md` (shaping) | WP1–WP5 reuse the shim/registry strategy that made this acceptable in Phase 0. | Revisit if WP1's new operators or WP2's browser-side unit rejection substantively edit `src/app.js`/`algorithmExplorer.js` beyond today's shim boundary (DOC-006). |

---

## 10. Dependencies & Assumptions

### Internal Dependencies

- **Phase 0 green** — confirmed: commit `ff4b519`, V2 gate PASS with zero anomalies, `npm run check`
  green on Node `v20.19.3` (repo-current-state §A/§F). This phase builds directly on that module-package
  contract.
- **RF-EV-001** (verified, 48 claims) is the WP3 converter's input bundle — available today.
- **REG-001** (verified, 89 claims, legal-review flagged) informs WP3/WP7 framing; legal sign-off is
  owner-held, not an AOS deliverable.
- **RF-EV-002** (CALIPER/Bohn 2023) and **REG-002** (content-rights/licensing) are **not yet run** —
  must be launched during this phase's execution (decisions-block P0). Non-blocking for WP1/WP4/WP6/WP7;
  RF-EV-002 enriches WP2's partition shape (not required for a first release, since AAP-fallback ranges
  already exist); REG-002 gates WP3's exact-passage verbatim-quoting posture (paraphrase-only until
  cleared).
- **SPIKE-003 (tri-state), SPIKE-004 (units), SPIKE-005 (semantic diff), SPIKE-006 (key custody)** do not
  exist yet (repo-current-state §E) — each must be authored and decided before its dependent WP's design
  is finalized (SPIKE-003→WP1, SPIKE-004→WP2, SPIKE-005→WP5, SPIKE-006→WP5).
- **DEF-1 resolution** (D-2, FR-WP3-01) is a prerequisite to the rest of WP3.
- **ARC pediatric council** is available for non-credentialed review only — usable informally via
  `council-review` for the WP1/WP2 pre-merge gate and as content input to WP6's dangerous-miss
  conversion; never as a source for `clinicalApprovers[]`/`approvedBy[]` (D-4).
- **IntentTree tracker** is confirmed stale relative to real repo/`rf` state — resync before trusting
  node status for phase kickoff.

### Assumptions

- Node ≥ 20 remains the floor.
- `npm run check`'s composition (`test && validate && build && check:imports && smoke`) remains the gate
  definition; new test files are auto-discovered by the existing glob.
- The zero-runtime-dependency posture (`package.json` has neither field today) is the default WP2/WP6
  preserve unless a rationale is recorded (D-5).
- This phase does not require a second contributor/reviewer to exist; the safety `council-review` gate
  is usable by a single builder today.

---

## 11. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|:-:|---|
| Tri-state migration silently changes clinical behavior (56 fields, 9 aggregates, 33 rules change meaning at once). | High | SPIKE-003 decides aggregate semantics before code moves; a written 33-rule migration table precedes the codemod; AC-D3's enumerate-and-rationalize gate; a dedicated invariant test (FR-WP1-05); safety `council-review` before merge. |
| Semantic diff under-reports a safety-relevant change (false negative with clinical consequence). | High | SPIKE-005 hunts the under-reporting mode explicitly; a seeded known-safety-relevant-mutation corpus the diff MUST flag (FR-WP5-03); cross-family adversarial lens tasked with "find a safety-relevant change this classifier misses." |
| Evidence dual-source drift defeats manifest integrity (`src/evidence.js` vs. `evidence.json`). | High | D-2 resolves this in prerequisite work (FR-WP3-01) before anything downstream; golden-equivalence proof; a `validate-kb` assertion that no second evidence source can reappear. |
| Overclaiming clinical approval (ARC's synthetic review is tempting to treat as sign-off). | High (reputational + safety) | D-4 is binding (AC-D4); fields built, shipped empty; release state records `not_executed_owner_held`; dedicated test asserts empty state in any unsigned/pre-validation build. |
| Duplicated dangerous-miss work with the ARC Adoption plan (its P4-T1 vs. this phase's WP6). | Medium | This phase owns the executable fixture conversion (FR-WP6-04) because WP6 is where fixtures must actually run; ARC Adoption's P4-T1 consumes these fixtures; recorded as a cross-plan dependency in both plans' `related_documents`. |
| Atomic 91-rule schema migration (`additionalProperties: false`, no incremental path). | Medium | Schema-first, then codemod, then validate, single commit, mechanically generated and reviewed as a diff of generated content; explicit nulls rather than omission (FR-WP4-01/02). |
| First external dependency in a zero-dependency repo (WP2 units, WP6 property/mutation). | Medium | D-5 — hand-roll by default with seeded generators and a closed unit table; any dependency requires written rationale. |
| Stale IntentTree misleads execution (tracker shows merged work / verified `rf` runs as `not_started`). | Low-Medium | Resync tracker to real state before any build task; verify node status against git log / `rf-handoff/RESULTS.md` before trusting `itt`. |

---

## 12. Target State (Post-Implementation)

**Engine behavior:** `deriveFacts()` returns tri-state values for all 56 fact fields; `ruleEngine.js`
carries 17 operators (13 today + 4 new); no rule-out branch can fire on `not-assessed`. Numeric lab
values carry an enforced unit; a mismatch rejects at the API/browser boundary instead of converting.

**Provenance:** every one of the 91 rules resolves `sourcePassageId` to a passage-level evidence record
or an explicit `implementation-proposal` flag; `src/evidence.js` is no longer a second hand-maintained
copy of `modules/anemia/evidence.json`.

**Governance:** all 91 rules carry `version`/`effectiveDate`/`retireDate`/`owner`/`safetyClass`/
`requiredTestCaseIds`/`changeRationale`/`sourcePassageId`; `clinicalApprovers[]` is present and empty,
honestly.

**Manifest:** `modules/anemia/module.json`'s signing fields are populated (`clinicalContentHash`,
`validationRunId`) except `approvedBy[]`, which stays empty per D-4; `server.mjs` refuses to start or
serve on a missing/invalid/expired/incompatible manifest.

**Validation:** `tests/` gains `property.test.mjs`, `boundary.test.mjs`, `mutation.test.mjs`,
`dangerous-miss.test.mjs` (10 ARC-named families executable); CI runs `check:imports` and gates on PRs.

**Observable outcomes:** `npm run check` stays green throughout; the V1-Content gate's provenance half
is measurably closed; its clinical-sign-off half is honestly recorded `not_executed_owner_held` — never
implied closed.

---

## 13. Overall Acceptance Criteria (Definition of Done)

### Functional
- [ ] FR-WP1-01 through FR-WP7-03 implemented and their stated acceptance criteria pass.
- [ ] AC-D1 through AC-D5 (§6) all pass, including AC-D4 as a structural (test-enforced) guarantee.
- [ ] AC-SEAM, AC-WP3-ENUM, AC-WP3-RESIL, AC-WP4-RESIL, AC-FAILCLOSED, AC-WP5-RESIL all pass.

### Technical
- [ ] `npm run check` green at every phase boundary.
- [ ] Zero new runtime dependencies, or exactly one build-time devDependency with a recorded rationale.
- [ ] 91/91 rules validate against the extended `rule.schema.json` in one commit.
- [ ] Server rejects an unverifiable/expired/incompatible KB (ARCH §10, all 5 conditions tested).

### Honesty (this phase's own hard guardrail)
- [ ] The V1-Content gate's provenance half ("every rule has an exact source passage or is flagged
      `implementation-proposal`") is measurably satisfied.
- [ ] The V1-Content gate's clinical-sign-off half ("dangerous-miss review by a clinical advisor signs
      off") is explicitly recorded as `not_executed_owner_held` in the closeout record — not implied
      closed, not silently omitted.
- [ ] No build produced by this phase populates `clinicalApprovers[]` or `approvedBy[]` from ARC output
      or any non-owner-attested source.

### Quality
- [ ] Mutation-score baseline defined from a real measurement run and met (OQ-4).
- [ ] All 10 ARC-named dangerous-miss families pass as executable fixtures.
- [ ] Zero unexplained golden diffs across the 6 examples (AC-D3).

---

## 14. Open Questions

Carried verbatim from the decisions block; each is binding scope for whichever WP it gates until
resolved.

- **OQ-1**: Does `booleanMap`'s open-ended shape survive as `triState`, or do the 56 known fields become
  an enumerated allow-list? *Lean: enumerate per-module via the module package, not globally* (adopted
  in FR-WP1-01).
- **OQ-2**: Does the `rf`-bundle → KB-pack converter live in this repo or `research-foundry`? *Lean:
  build it here, register it as satisfying `EF-WP0`* (adopted in FR-WP3-03).
- **OQ-3**: Does WP5 ship real cryptographic signing, or a hash + manifest chain with signing deferred
  until a credentialed approver's signature would mean something? SPIKE-006 decides. A signature
  attesting to approvals that never happened is worse than no signature (D-4's logic applies).
- **OQ-4**: What is the mutation-score baseline, and is it measured over rules, facts, or both? Must be
  defined in WP6 from measurement, not guessed in advance.
- **OQ-5**: What is the missing-unit policy — reject, or accept with an explicit `unitAssumed`
  provenance flag? SPIKE-004 decides; the answer must not silently convert.
- **OQ-6**: Should CI hardening (WP6) move earlier, to the phase's own de-risking prerequisite work,
  rather than waiting for WP6? *Lean: move earlier* — flagged as an execution-sequencing decision for
  the implementation plan, not a scope change to this PRD.

---

## 15. Appendices & References

### Related Documentation
- Decisions block: `.claude/worknotes/wave0-safety-foundation/decisions-block.md`.
- Repo current-state: `.claude/worknotes/wave0-safety-foundation/repo-current-state.md`.
- AOS asset inventory: `.claude/worknotes/wave0-safety-foundation/aos-asset-inventory.md`.
- Roadmap Phase 1: `docs/project_plans/expansion/01-platform-expansion-roadmap.md:150-231`.
- ARC handoff: `docs/project_plans/expansion/03-arc-clinical-council-handoff.md`.
- `rf` results: `docs/project_plans/expansion/rf-handoff/RESULTS.md`.
- Evidence Foundry design: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md`.
- ARC Adoption plan (cross-plan dependency, Risk 5): `docs/project_plans/implementation_plans/
  enhancements/arc-clinical-council-adoption-v1.md`.
- Architecture: `docs/architecture.md` §6, §7, §8, §10.
- Prior PRD: `docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md`.

### Symbol References
- `deriveFacts` (`modules/anemia/facts.anemia.js`, via `src/facts/registry.js`) → gains tri-state output.
- `evaluateLeaf`/`evaluateCondition` (`src/ruleEngine.js`) → gains 4 tri-state operators.
- `getEffectiveRanges`/`getThreshold` (`src/ranges/registry.js`, `modules/anemia/ranges.js`) → gains
  unit-checked lookup.
- `assess` (`src/engine.js`) → threads manifest-verification status into `meta` or throws before
  reaching output assembly.

### Prior Art
- Commit `ff4b519` — Phase 0 module-package contract, the substrate this phase extends.
- `docs/project_plans/design-specs/{tri-state-fact-model,exact-passage-evidence-schema,signed-kb-
  manifest,module-manifest-json-schema,evidence-dual-source-unification}.md` — the 5 shaping/idea specs
  this phase promotes into committed requirements.

---

**Progress Tracking:**

See progress tracking once the implementation plan is authored:
`.claude/progress/wave0-safety-foundation/all-phases-progress.md`
