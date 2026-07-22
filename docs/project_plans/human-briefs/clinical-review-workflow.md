---
schema_name: ccdash_document
schema_version: 2

doc_type: human_brief
doc_subtype: feature_brief
root_kind: project_plans

id: BRIEF-clinical-review-workflow
title: "Clinical Review Workflow v1 (DF-E1-01) — Human Brief"
status: draft
category: human-briefs

feature_slug: clinical-review-workflow
feature_family: clinical-review-workflow
feature_version: v1

prd_ref: docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md
intent_ref: null
epic_ref: null

related_documents:
  - .claude/worknotes/clinical-review-workflow/decisions-block.md
  - .claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md
  - docs/adr/0004-clinical-approval-identity-adjudication.md
  - docs/project_plans/design-specs/clinical-review-portal-workflow.md

owner: nick
contributors: []

audience: [humans]

priority: high
confidence: 0.8

created: "2026-07-22"
updated: "2026-07-22"
target_release: ""

tags: [human-brief]
---

# Clinical Review Workflow v1 (DF-E1-01) — Human Brief

> Living document for human orchestrators. Agents: do not load unless explicitly instructed.
> Status: draft | Updated: 2026-07-22

---

## 1. Context Pointers

One-line pointers. Do not restate content.

- **PRD**: `docs/project_plans/PRDs/infrastructure/clinical-review-workflow-v1.md`
- **Plan**: `docs/project_plans/implementation_plans/infrastructure/clinical-review-workflow-v1.md`
- **Design Specs**: `docs/project_plans/design-specs/clinical-review-portal-workflow.md` (portal stays `maturity: shaping`)
- **SPIKEs**: None (waived — ADR-0004 + design spec + shipped `evidence-foundry-e1-v1` Phase 2 substrate + `.claude/worknotes/evidence-foundry-e1-v1/dryrun-friction.md` served as the SPIKE-equivalent)
- **Decisions block**: `.claude/worknotes/clinical-review-workflow/decisions-block.md`
- **Related Briefs**: None

---

## 2. Estimation Sanity Check

_Migrated verbatim from the implementation plan's end-of-file HTML comment (drafted by
implementation-planner, 2026-07-22). Human-authored analysis; not agent-relevant._

**Noun count (H1)**: 2 new CLI verbs (`status`, `sign`) + 1 shared derived-state library + 1
incremental-validate cache + 1 render section + 1 runbook + 1 portal-promotion framework ≈ 7 new
"nouns," but none are CRUD-with-RBAC domain tables (H1's literal ≥2pt/table rule does not apply to
a CLI-verb-and-docs feature) — treated instead as decisions block §4's H1 base: ≈12 pts across the
12 identified units (2 verbs + 2 verb mods + 1 runbook + 1 framework + render section, expanded
across the 5 phases below). No under-count risk from H1 specifically; the real risk in this feature
is H3 (algorithmic derived-state + caching), addressed next.

**Dual-impl multiplier (H2)**: N/A — this repo has no local/enterprise dual-implementation split;
single Node CLI target throughout. Not applied.

**Algorithmic flag (H3)**: Two services flagged: (1) the derived-state computation `status`/
`validate` share (state-machine inference over an append-only chain — P1-T1/T2, budgeted 3.0 pts
combined across P1); (2) the incremental-validate content-hash-keyed cache with fail-closed
recompute semantics (P2-T3/T4, budgeted 2.0 pts combined). Both enumerate ≥5 adversarial scenarios
in their ACs (chain-broken, disputed, transposed hash, out-of-order sequence, stale-cache
bit-flip, superseded chain, `--history` union) — the ≥5-scenario bar for "flagged and understood"
is met; no SPIKE precursor required.

**Bundle decomposition (H4)**: This PRD bundles ≥3 capability areas under one slug.

| Capability Area | Independent Estimate | Notes |
|-----------------|----------------------:|-------|
| Derived status + scaffold ergonomics | 5 pts | includes R2/R3/R7/R8 mitigation tests |
| Sign verb + validate performance | 4 pts | crypto-adjacent; algorithmic (H3) |
| Render queue view + runbook | 4 pts | docs-heavy; parallel sub-tracks |
| Portal-promotion framework + assets | 3 pts | policy + image-gen, not code |
| Hardening, docs & deferred items | 3 pts | H6 plumbing budget lands here |
| **Σ** | **19 pts** | matches decisions block §4 exactly — no compression below Σ |

**Anchor (H5)**: `evidence-foundry-e1-v1` Phase 2 (P2-T1..P2-T8) — built the entire
`tools/review-record/` substrate from scratch: 5 verbs, 11 lib modules, 2 schemas, roster,
Ed25519 signing lib, dry-run fixtures — actual cost 8 pts (per that plan's Phase Summary). This
plan's surface (2 new verbs + 2 verb mods + 1 new lib + 1 cache + 1 render section + 1 runbook + 1
framework, all consuming already-shipped libs) is additive-only and strictly smaller in kind (no
new schema, no new module-package concept, no new signing primitive) — yet totals 19 pts, ~2.4×
the anchor. Justification: the anchor built machinery once; this plan pays a per-verb ergonomics +
derived-state + incremental-cache + docs tax (runbook, framework, render, honesty pass) that the
anchor's own P2-T8 dry-run explicitly deferred as "friction observations," i.e. this is exactly the
follow-on cost the anchor's scope intentionally excluded. Delta is justified, not a re-derivation
trigger.

**Plumbing budget (H6)**: ~3 pts (~18% of the 16.7-pt pre-plumbing subtotal: P1 4.0 build-only +
P2 3.5 + P3 3.0 + P4 2.5 + P5-minus-plumbing 0.7 ≈ 13.7, plumbing = tests/README/architecture-§11/
check-gate wiring spread across P1's R2/R7/R8 test task, P2's grep+microbenchmark task, P3's honesty
pass, and all of P5 minus the adversarial-sweep task) — landed explicitly in P1-T4, P2-T2/T4's grep
+ microbenchmark components, P3-T4, and P5-T2/T3, rather than as one lump sum, per H6's "prefer
estimating once, but this feature's plumbing is verb-local enough to attach to the owning task"
exception.

**Bottom-up total**: 19 pts (Σ of the bundle table = the floor; no compression applied).
**Top-down intuition**: "two new CLI verbs and some docs" reads as ~10-12 pts on first glance.
**Locked estimate**: 19 pts — bottom-up wins per H4; the top-down intuition undercounts the
derived-state/cache algorithmic surface (H3) and the docs/framework/honesty-pass plumbing (H6) that
a "just add a verb" framing glosses over, exactly the failure mode H1-H6 exists to catch.

---

## 3. Wave & Orchestration Notes

_Critical path narrative and parallelization hints. Plan owns the phase summary table._

**Critical path**: P1 (shared derived-state library) → P2 (`sign` + incremental `validate` consume
it) → P5 (hardening). P1 is the single gate on everything: nothing else opens until its shared lib
lands, because R2 (status/validate drift) is only mitigated by both verbs consuming one library.

**Parallel opportunities**: P3 and P4 each depend only on P1's library, not on P2 — the decisions
block's intent was **P3 ∥ P4 alongside P2 after P1**. The plan's mechanical wave computation
refines this: P2 and P3 both write `lib/verbs/validate.mjs` (caching vs. FR-12 terminal-state
message), so the executed waves are `[P1] → [P2, P4] → [P3] → [P5]` — P4 rides with P2; P3 slips
one wave to avoid the shared-file collision. This is a scheduling refinement only, not a
dependency change; if P2 finishes early, P3 can open immediately.

**Merge order**: Commit-per-phase in one worktree, single PR after P5's karen gate; no cross-branch
merges to sequence. Within P3, render and runbook tracks are fully parallel.

**Offload rules (ICA)**: Bounded, ≤2–3-file, non-taste waves MAY go to ICA `claude-sonnet-5[1m]`
(`--bare` + CLAUDE.md injection) — P1's bounded CLI subtasks and P3's haiku runbook draft are the
eligible surfaces. **Gates always re-run in-session afterward** (memory: ICA delegates get
acceptEdits but not execution, so their "green gates" are unverified). **P2 never offloads** —
fail-closed crypto-adjacent logic is taste/risk work and stays in-session with a single owner.

**Review gating**: task-completion-validator per phase; **karen** at the P4 milestone and again at
feature end; **codex `gpt-5.6-terra` read-only second-opinion diff review per wave** (memory: this
gate has caught real fail-closed gaps that validators approved — do not skip it to save a cycle).

**Cross-feature coupling**: None in-flight. This layers on the shipped `evidence-foundry-e1-v1`
Phase 2 substrate (frozen; not rebuilt) and feeds the future DF-E1-04 linkage (deferred, §5).

---

## 4. Open Questions Ledger

_Pointer inventory across PRD, plan, and decisions block. Update status as resolved._

| ID | Source | Question | Status | Resolved By |
|----|--------|----------|--------|-------------|
| OQ-1 | PRD §12 / decisions block §7 | `sign` key source on the synthetic path — TESTKEY-only or keyfile seam? | resolved | Plan P2-T1: TESTKEY-only, ephemeral in-memory; no `--keyfile` ships |
| OQ-2 | PRD §12 / decisions block §7 | `status --json` minimal stable output shape | resolved | Plan P1-T2 freezes `{ moduleId, subjectContentHash, records[], derivedState, nextExpectedRole }` |
| OQ-3 | PRD §12 / decisions block §7 | Runbook location | resolved | PRD FR-13 / Plan P3-T3: `docs/governance/reviewer-runbook.md`, linked from README + architecture §11 |
| OQ-4 | PRD §12 / decisions block §7 | Friction-metric capture mechanism (zero network/telemetry) | resolved | Plan P4-T1: committed markdown log at `.claude/worknotes/clinical-review-workflow/friction-observations.md` |
| OQ-5 | PRD §12 / decisions block §7 | `changelog_required` for internal tooling? | resolved | Plan frontmatter note: left unset (absent, not `false`); no CHANGELOG entry |
| OQ-6 | PRD §12 / decisions block §7 | `validate --history` × incremental cache interaction | resolved | PRD FR-10 / Plan P2-T4: fail-closed union — `--history` results never cached |
| OQ-7 | PRD §12 | How does the runbook avoid instructing post-G1 real reviewers to run `sign`? | resolved | Plan P3-T3: two labeled tracks; `sign` visible only on the exercise (synthetic) track |
| OQ-8 | PRD §12 / design spec | Portal-promotion threshold + authorized decision owner | open (framework ships; ratification pending) | P4-T1 ships metric format, threshold-as-proposal, owner-role, decision-record template — the threshold value itself awaits human ratification and never auto-triggers promotion |

---

## 5. Deferred Items Rationale

_Why items were deferred and what would trigger promotion. Plan owns the triage table (DF-CRW-01..03)._

- **Portal implementation** (auth, hosting, second trust boundary + its security review): Deferred
  because ADR-0004 explicitly declined the portal for v1 and a portal opens a second trust boundary
  the program has no reason to pay for yet — the file+CLI substrate is unexercised by any real
  reviewer. Promote when the P4 framework's friction threshold clears **and** the named human
  decision-owner ratifies in a decision record. Design spec exists and stays `maturity: shaping`.
- **Real-reviewer onboarding (G1 roster entries, out-of-band credential verification)**: Deferred
  because it is an owner-blocked *human* act — no agent or plan task may add a `synthetic: false`
  roster entry. The runbook prepares for it (post-G1 track) but never performs it. Promote when the
  owner names a credentialed reviewer and records `verificationRef` per the roster schema.
- **DF-E1-04 retrospective-validation linkage**: Deferred because the harness needs a real reviewer
  identity (G1) *plus* a signed release candidate (G2/G4) *plus* a data-source SPIKE (G3) — none
  exist. Promote when those gates clear and DF-E1-04's harness lands; cross-ref ADR-0004 `unblocks`.

---

## 6. Risk Narrative

_Orchestrator-facing risk rationale (decisions block §3, R1–R7). Plan owns the per-phase mitigation table._

- **R1 — `sign` verb creates a path to real signatures pre-G1/G2 (High)**: The single most
  consequential risk in the feature. The whole governance posture rests on real signing being
  *structurally impossible*, not just discouraged. The schema keeps forcing `signature: null` on
  `synthetic: false`; the verb must refuse real-identity records with an explicit G1/G2 gate
  message; negative tests are acceptance criteria; `verify-d4-built.mjs` stays untouched. Any
  executor "helpfully" adding a keyfile seam is a guardrail breach, not a feature.
- **R2 — `status` reimplements derived-state logic and drifts from `validate` (High)**: Two
  parallel state machines would silently disagree over time. Mitigated only by the single shared
  lib both verbs consume, plus a drift test comparing verb outputs — watch that P1-T1's extraction
  actually removes the duplicated logic rather than copying it.
- **R3 — Ergonomic changes weaken reviewer-2 structural independence (High)**: `nextChainLink`
  read-scope semantics must stay untouched; independence tests stay green; every scaffold change
  carries an explicit AC. Ergonomics must never trade away the independence property.
- **R4 — Runbook/docs language implies clinical validity or real sign-off exists (Med)**: Honesty
  language is mandatory ("unvalidated research prototype", roster synthetic-only); the reviewer
  gate checks wording. Docs are the surface most likely to drift optimistic under a haiku drafter.
- **R5 — Validate caching introduces stale-pass / fail-open (Med)**: Cache keyed on canonical
  content hash; any miss or uncertainty recomputes; a dedicated stale-cache adversarial test is an
  acceptance criterion. A cache that ever passes stale input is worse than no cache.
- **R6 — Portal mockups read as a commitment / second-trust-boundary creep (Low)**: CONCEPT-ONLY
  watermarks on every asset; design spec stays `maturity: shaping`; zero portal code.
- **R7 — Plan tasks accidentally "accept" ADR-0004 or add roster entries (High)**: Explicit
  non-goals in every phase prompt; no task may edit any ADR `status` field or
  `governance/reviewer-roster.yaml` real entries; grep checks enforce it. An eager agent "tidying"
  ADR status from `proposed` to `accepted` would silently clear a human-only gate (G0).

---

## 7. What to Watch For

_Gotchas, trap-doors, and retrospective hooks for real-time review during execution._

- **R1 / sign-verb gate bypass is the headline watch item.** During P2 review, read the actual
  refusal path in `lib/verbs/sign.mjs` — not just the test names. The failure mode is a
  well-intentioned "future-proofing" seam (a `--keyfile` flag, an env-var key path, a `--force`
  escape hatch) that turns the structural impossibility of real signing into a mere default. The
  static no-keyfile grep test (FR-23) and both negative tests must exist *and* be meaningful; the
  codex per-wave review specifically hunts this class of fail-closed gap.
- **The D-4 invariant must survive untouched.** ARC/council/`rf`/any agent output remains
  structurally ineligible to populate any reviewer or approver field; `scripts/verify-d4-built.mjs`
  is not modified by any task; `clinicalApprovers[]`/`approvedBy[]` stay schema-forced empty
  (`maxItems: 0`). If any diff in any wave touches `verify-d4-built.mjs`, the forced-empty schema
  constraints, or writes real entries to `governance/reviewer-roster.yaml`, stop the wave — that
  is never in scope, whatever the justification offered.
- **Honesty-language drift (R4) concentrates in P3/P5 docs.** The runbook is drafted by haiku and
  polished by sonnet — exactly the pipeline where "the reviewer approves the module" phrasing
  slips in. Spot-check the runbook, README, architecture §11, and the render's new section for
  language implying clinical validity, real sign-off, or a non-synthetic roster; the docs-truth
  honesty test (AC-honesty-language) is the backstop, but its substring markers can be gamed by
  placement, so read the surrounding prose too.
- Secondary hooks: verify P1-T1 *moves* rather than copies the derived-state logic (R2); confirm
  the P3-wave delay is respected so P2 and P3 never concurrently edit `validate.mjs`; re-run all
  gates in-session after any ICA-offloaded subtask (offloaded gate results are unverified by
  construction).

---

## 8. Expected Success Behaviors

_Observable, human-verifiable post-ship outcomes. Not agent acceptance criteria._

- [ ] `node tools/review-record/cli.mjs --help` lists 7 verbs (was 5): `status` and `sign` added.
- [ ] `status --module cbc_suite_v1` names the derived state and next-expected role (or terminal
  state) in one call; `--json` output is byte-stable across repeated invocations.
- [ ] `scaffold` without `--subject` just works — auto-derived `subjectContentHash` matches
  `dry-run`'s value; no more hand-computing and pasting one hash into five invocations.
- [ ] `sign` on a synthetic record round-trips against `validate`; `sign` on a `synthetic: false`
  record refuses non-zero with a message naming both G1 and G2 — try it by hand against the
  fixture roster.
- [ ] `validate` on the committed synthetic set says, in plain words, that
  structurally-non-qualifying is the correct by-design terminus, not a bug; a cache-warm
  `validate --record` run is visibly faster than cache-cold (microbenchmark in `tests/`).
- [ ] The static HTML render shows a queue/turn-state section (five roles, `NEXT`/`TERMINAL`
  markers) and still contains no `<script>` and no server dependency — view the file directly in
  a browser.
- [ ] `docs/governance/reviewer-runbook.md` exists, walks all five roles end-to-end, has the two
  labeled tracks, and `sign` appears only on the exercise track.
- [ ] The portal-promotion framework names all four elements (metric log format, threshold-as-
  proposal, owner-role, decision-record template); every mockup under
  `docs/project_plans/design-specs/assets/` visibly carries the CONCEPT-ONLY watermark; the design
  spec's portal section is still `maturity: shaping`.
- [ ] Invariants hold: `governance/reviewer-roster.yaml` still has 5 synthetic / 0 real entries;
  ADR-0004 still `proposed`; `verify-d4-built.mjs` unmodified; `modules/cbc_suite_v1/reviews/*.yaml`
  unchanged.
- [ ] `npm run check` green end-to-end; both karen passes (P4 milestone + feature end) and the
  per-wave codex second-opinion reviews are recorded in worknotes/PR description.

---

## 9. Running Log

_Optional. Append-only. Short notes during execution — surprises, pivots, validated assumptions._
_Agents may append here only if explicitly instructed in a task prompt._

- [2026-07-22] Brief created; Estimation Sanity Check migrated out of the implementation plan's
  HTML comment block into §2.
