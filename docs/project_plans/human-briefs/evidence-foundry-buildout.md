---
schema_name: ccdash_document
schema_version: 2

doc_type: human_brief
doc_subtype: ""
root_kind: project_plans

id: ""
title: "Evidence Foundry Buildout — Human Brief"
status: draft
category: human-briefs

feature_slug: evidence-foundry-buildout
feature_family: evidence-foundry-buildout
feature_version: v1

prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
intent_ref: null
epic_ref: null

related_documents:
  - docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md
  - docs/project_plans/expansion/rf-handoff/RESULTS.md
  - docs/project_plans/human-briefs/platform-foundation-p0.md
  - .claude/worknotes/evidence-foundry-buildout/decisions-block.md
  - .claude/worknotes/evidence-foundry-buildout/estimation-sanity.md

owner: "Nick Miethe"
contributors: [Opus orchestrator]

audience: [humans]

priority: high
confidence: 0.7

created: 2026-07-19
updated: 2026-07-19
target_release: ""

tags: [human-brief, evidence-foundry, research-foundry, kb-pipeline, converter]
---

# Evidence Foundry Buildout — Human Brief

> Living document for human orchestrators. Agents: do not load unless explicitly instructed.
> Status: draft | Updated: 2026-07-19

**The one-paragraph version**: this feature builds the first real bridge between a verified Research
Foundry evidence bundle and a rule this codebase's engine can evaluate — a deterministic, offline
converter (`tools/rf-bundle-to-kb-pack/`) plus a proof-of-seam migration of 4 real clinical rules into a
new `modules/cbc_suite_v1/` package. Everything it produces is an unsigned *proposal*; nothing here
touches the deployed clinician SPA, and nothing here is described as clinically validated. In parallel it
drafts the 8 ADRs that currently block the much larger E1 increment (clinical review, signed release)
from being planned at all. 42 pts, 7 phases, 3 `karen` milestone gates, zero SPIKE (waived-by-equivalence
against a design spec that's already SPIKE-depth).

---

## 1. Context Pointers

One-line pointers. Do not restate content.

- **PRD**: `docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md` — E0 scope, 25 FRs, 7 open questions, phase-to-scope map.
- **Plan**: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md` (+ 3 phase-detail files under `evidence-foundry-buildout-v1/`) — 7-phase, 42-pt task breakdown, wave plan, OQ resolutions.
- **Design Specs**: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` — the normative source; every PRD requirement and plan task cites a section anchor in it.
- **SPIKEs**: None. Waived-by-equivalence — the design spec itself functions at SPIKE depth, backed by the completed `rf-handoff` (7/7 verified evidence runs, 576 claims, independent cross-model fidelity audit).
- **Related Briefs**: `docs/project_plans/human-briefs/platform-foundation-p0.md` — this feature's H5 estimation anchor (17 pts) and the module-package contract it builds directly on top of.
- **Decisions Block** (binding, Opus-authored — not to be contradicted): `.claude/worknotes/evidence-foundry-buildout/decisions-block.md`.
- **Estimation source**: `.claude/worknotes/evidence-foundry-buildout/estimation-sanity.md` (migrated into §2 below).
- **Upstream completion record**: `docs/project_plans/expansion/rf-handoff/RESULTS.md` — the 7 verified bundles this feature converts.

---

## 2. Estimation Sanity Check

_Migrated and condensed from `.claude/worknotes/evidence-foundry-buildout/estimation-sanity.md`._

Why this section exists: a 42-pt Tier 3 plan with no SPIKE behind it is exactly the shape that invites a
"did anyone actually check this number, or did it just get typed in" question later. The answer here is
yes, twice, from two different directions — a bottom-up per-phase sum and an independent per-capability
sum land on the identical total, and the H5 anchor comparison explains the 2.5× delta against the only
prior comparable plan in this repo rather than hand-waving past it.

**Bottom-up total**: 42 pts across 7 phases (P1 5 · P2 8 · P3 8 · P4 8 · P5 5 · P6 5 · P7 3) — no top-down compression applied anywhere.
**Top-down anchor**: `platform-foundation-p0` (this repo's only prior completed Tier 3 plan) took 17 pts over 7 phases.
**Reconciliation**: The bottom-up sum and the decisions block's independently-derived H4 floor agree exactly (42 = 42) — nothing to explain away. The anchor delta lands at 2.5×, which H5 below argues is proportionate given what this plan actually builds, not an inflated guess.

**H1–H6 heuristic application:**

- **H1 (scope clarity)**: Six new artifact classes each carry a ≥2-pt floor — module envelope, fixture bundle, the converter itself, the evidence/claim/rule projection set, the generated test corpus, the manifest/traceability bundle. That's a 12-pt floor before counting internal density. The real total sits well above it because two of those six "classes" (the converter, the projection set) are themselves multi-artifact bundles, not flat 2-pt units.
- **H2 (tech risk / dual-implementation multiplier)**: N/A — no dual local/enterprise split anywhere in this repo; every artifact this feature produces has exactly one implementation target.
- **H3 (integration surface / algorithmic-service flag)**: Fires, hard. The converter is simultaneously a transform (bundle YAML → normalized facts), a join (authoring decisions ↔ claims ↔ rules ↔ tests), a diff (`semantic-diff.json`), and a graph (the full source→passage→claim→decision→rule→test→output trace). That's 21 of the 42 points — half the feature — concentrated in Phases 2, 3, and 5. It's also why no separate SPIKE was needed: the test-scenario list is directly enumerable from the design spec's 11 converter phases and 15 seam invariants, the same enumerability a SPIKE would otherwise have had to produce.
- **H4 (team familiarity / bundle-vs-sum check)**: This PRD bundles 8 capability areas under one slug; the decisions block's own per-phase bottom-up (5+8+8+8+5+5+3) sums to exactly 42, matching the estimation worknote's independently-derived per-area sum. Two numbers landing on the same total from two different derivations is the strongest signal available that this wasn't hand-waved.
- **H5 (external dependencies / anchor comparison)**: Anchor = `platform-foundation-p0`, 17 pts, ~20 files, zero new artifact content (a pure structural refactor under a zero-clinical-behavior-change mandate). This plan: ~30+ files, one new module package, one entirely new CLI tool, four new schema-validated artifact types, four migrated clinical rules each with a 5-category test corpus, a manifest/traceability subsystem, 8 ADRs. 2.5× the anchor's cost for strictly more new nouns (6 new classes vs. 0) is the expected direction of travel, not a red flag — H5's own re-derive trigger ("more nouns but less estimate") doesn't fire here.
- **H6 (test/QA overhead / hidden plumbing)**: ~15% is folded into the phase numbers already rather than bolted on top. The concrete plumbing tasks (schema wiring across three phases, `.gitignore`, CHANGELOG, two registry-file edits) sum to 2.8 pts — 6.7% of the total, below the usual 15–20% band, because the dominant cost driver here is the H3-flagged algorithmic converter, not CRUD-style scaffolding.

(H7, checked though not requested: N/A — no file this plan touches exceeds ~120 lines; no huge-file-touch multiplier applies in a repo this size.)

---

## 3. Wave & Orchestration Notes

**Critical path**: P1 → P2 → P3 → P4 → P5 → P7 (34 of the 42 pts). Each phase in that chain consumes the prior phase's output directly — P3's evidence projection can't start before P2's converter core exists, and P4's rule migration can't start before P3's `propose` verb exists. There's no shortcut here worth looking for: this is a pipeline feature, and the phases mirror the data flow, not an arbitrary work breakdown that could be reordered for convenience.

**Parallel opportunity**: P6 (the 8 ADRs, 5 pts) branches off as soon as P2 lands and only needs to rejoin before P7 opens. It shares zero files with P3–P5's work (`tools/rf-bundle-to-kb-pack/**`, `modules/cbc_suite_v1/**`), so it gets the full 21-pt duration of P3+P4+P5 as slack — there's real room to run it opportunistically rather than treat it as a scheduling constraint. Practically: if P6 is running behind, that's not a critical-path problem unless it's still open when P5 closes.

**Wave structure** (from the plan's `wave_plan`): `[P1] → [P2] → [P3, P6] → [P4] → [P5] → [P7]`. Six waves, one true fan-out (wave 3). Everything else is strictly serial — this plan does not have the kind of broad parallel fan-out `platform-foundation-p0` had at its P4∥P5 slice; the converter's own internal coupling (Phase 3's evidence, claim, and rule-drafting tasks all touch the same `tools/rf-bundle-to-kb-pack/**` source tree) is what keeps P3 a single wave rather than splitting further.

**Merge order**: Standard sequential merge along the critical path. P6's 8 ADR files can merge in whenever they're ready within the P3–P5 window — no ordering constraint against the code phases. Nothing about ADR content depends on what the code phases decide; P6 documents decisions those phases *deliberately deferred*, not decisions they made.

**Milestone reviews**: `karen` sits at the end of P2 (converter core — the highest-risk phase), the end of P5 (E0 functionally complete), and the end of P7 (feature end). Every hard guardrail and every PRD §7 non-goal gets explicitly re-checked at each of these three gates, not assumed compliant by default. If any of these three gates has to be skipped or shortened under schedule pressure, treat that as an escalation, not a routine call — P2 in particular is where a seam-invariant gap would be cheapest to catch and most expensive to catch later.

**Cross-feature coupling**: Depends on `platform-foundation-p0` (module package contract, already landed at commit `ff4b519`) — a hard prerequisite, not a soft one; `modules/cbc_suite_v1/` cannot exist without that contract already in place. No other in-flight feature in this repo touches the same files, so there's no merge-collision risk to plan around beyond the internal wave sequencing above.

---

## 4. Open Questions Ledger

_Pointer inventory across PRD and plan. All seven are resolved as of the implementation plan; none are open at execution start — reopening any requires a new decisions-block entry, not an ad hoc call during a phase._

Four of these (OQ-1 through OQ-4) were left for the implementation-planner to resolve by explicit
instruction in the decisions block ("decide in plan; do not leave to execution"); the other three
(OQ-5 through OQ-7) surfaced during PRD authoring and were ruled directly by an addendum to the same
decisions block rather than by the plan. Both resolution paths are equally binding — the distinction
matters only for tracing *where* a given call was made, not its authority.

| ID | Source | Question | Status | Resolved By |
|----|--------|----------|--------|-------------|
| OQ-1 | PRD §12 | Does the 4-rule slice land inside `modules/cbc_suite_v1/`, or stay under `modules/anemia/` with `cbc_suite_v1` created empty-but-valid? | resolved | Plan "OQ Resolutions": lands in `cbc_suite_v1`; `index.js` delegates `deriveFacts`/`summarize`/`limitations` to `modules/anemia/facts.anemia.js` rather than duplicating it; `anemia` stays untouched as both migration source and semantic-diff baseline. |
| OQ-2 | PRD §12 | Which verified `rf` run seeds the fixture — public-domain-heavy `REG-001` or clinically richer `RF-CBC-001`? | resolved | Plan "OQ Resolutions": `RF-CBC-001` — `REG-001`/`REG-004` are foreclosed by the PRD's own legal-review flag. Fixture defaults to hash+selector (not full text) unless the specific slice passages are positively confirmed rights-clear. |
| OQ-3 | PRD §12 | Where do `evidence-assertions.json` and `rule-provenance.json` land under the module package contract? | resolved | Plan "OQ Resolutions": `modules/cbc_suite_v1/` — confirmed against `docs/architecture.md` §2a's module-package shape, not a `data/` or pack-only location. |
| OQ-4 | PRD §12 | What's the minimal scope of the semantic diff for E0? | resolved | Plan "OQ Resolutions": rule-`id`-level added/removed/changed only, against `modules/anemia/rules.json`. A trivial "4 added, 0 removed, 0 changed" result is expected and acceptable — E0 delivers the schema and plumbing, not a materially interesting diff. |
| OQ-5 | PRD §12 (new) | Do generated tests land as flat files matching the existing `npm test` glob, or as a new runner pattern? | resolved | Decisions block §11 addendum: flat under `tests/`, prefixed `ef-<module>-<category>.test.mjs` / `ef-converter-<aspect>.test.mjs`. The `npm test` glob is never touched. |
| OQ-6 | PRD §12 (new) | Is `build/kb-pack/`'s proposal output committed, or generated and left untracked? | resolved | Decisions block §11 addendum: `build/` added to `.gitignore` (P1); `build/kb-pack/` is generated, never committed. Committed golden fixtures for converter tests live under `tests/fixtures/` instead. |
| OQ-7 | PRD §12 (new) | Do the new artifact types get their own `schemas/*.schema.json` files, or hand-written structural checks? | resolved | Decisions block §11 addendum: yes — four new schema files (`evidence-assertions`, `rule-provenance`, `authoring-decisions`, `release-manifest`), each wired into `scripts/validate-kb.mjs`. JSON Schema is the repo's existing idiom; this doesn't expand that set beyond the four named types. |

---

## 5. Deferred Items Rationale

_Why items were deferred and what would trigger promotion. The plan's full triage table (11 rows: 7 E1 + 3 E2 + 1 external) lives in the implementation plan's "Deferred Items & In-Flight Findings Policy" section; every row gets exactly one design-spec stub authored in Phase 7._

The Evidence Foundry track has three increments — E0 (this feature), E1, E2 — and this PRD is
explicit that E0 is the only one whose inputs exist today. Everything below is deferred not because
it's unimportant, but because building it now would mean building it on top of an unproven seam, or
against a release that doesn't exist yet. That ordering is itself a risk-management decision worth
naming out loud: it would be easy to read "L-sized item deferred" as "less important item deferred,"
and that's not what's happening here — several of the E1 items (clinical review portal, FHIR emitters,
retrospective validation) are large enough that each will eventually warrant its own plan, not a
sub-phase of this one.

- **Clinical review portal/workflow** (E1, L): Deferred because it needs named credentialed reviewers and a review-state model that don't exist until E1 planning happens — nothing in E0 needs a human reviewer to look at anything. Promote when the E1 plan is approved and reviewer roles are named.
- **Full CBC 12-angle live research operation** (E1): Deferred because it needs a resourced discovery lane (Path-B hardening or a native `rf` adapter) this plan deliberately does not build — E0 is proof-of-seam against one fixture, not a live-research operation. Promote when ADR-8 (Path-B vs. native adapter) resolves and the E1 plan is approved.
- **Signed release + key custody** (E1): Deferred because it needs ADR-5's signing/key-custody decision resolved first — E0 only ever emits `release-manifest.unsigned.json`. Promote when ADR-5 moves from `proposed` to `accepted`.
- **FHIR/terminology emitters** (E1, L): Same shape — blocked on ADR-3 (terminology ownership) reaching `accepted`.
- **Retrospective validation harness** (E1, L): Needs a signed release and real adjudicated case data this feature doesn't produce. Promote once a signed E1 release candidate exists.
- **Property/mutation/semantic-diff CI expansion** (E1): This is hardening of what E0 ships (a minimal id-level diff, a 15-invariant test set), not new capability — promote when the E1 rule-schema v2 migration begins.
- **Surveillance/update/registry engine, production monitoring, withdraw/rollback** (all E2): Deferred because each needs a signed, registered E1 release to operate against — there's nothing to surveil, monitor, or roll back until E1 ships.
- **7 RFUP upstream-`rf` enhancements** (external): Not so much deferred as routed elsewhere — these are changes to the Research Foundry project itself (parameterized Path-B, exact-passage hard-gating, stable schema versioning, etc.), tracked via `op story` into the `agentic_meta_dev` repo, never as work items here. One consolidated routing note (not a design-spec stub) captures all seven.

The common thread: nothing above is deferred because it's low-value. Every item is blocked on either an ADR this plan drafts-but-does-not-accept, or a signed E1 release this plan does not produce. That's a sequencing decision, not scope trimming.

---

## 6. Risk Narrative

_Orchestrator-facing rationale — why each risk matters at the orchestration level, not just its mitigation._

Two of the risks below (seam-invariant regression, invented-threshold leak) are rated High/Medium and
are the ones actually worth losing sleep over — they map directly onto the two hard guardrails this
whole track exists to protect ("no AI-published rule changes," "no invented thresholds"). The rest are
Medium-or-lower and are here mainly so nobody discovers them mid-phase as if they were novel.

- **Seam-invariant regression** (High impact / Medium likelihood): The real danger isn't the converter crashing — it's the converter *succeeding* on bad input. A silent accept of a non-`verified` bundle or an unresolved passage reference would defeat the entire point of building a deterministic gate, and might not surface until a clinical reviewer downstream (E1) trusts output that was never actually checked. Watch for any temptation during P2 to get the happy path working first and add invariant tests later — the plan deliberately makes all 15 invariant tests part of P2's exit gate, not a follow-up task.
- **Invented-threshold leak via drafting phases** (High impact / Medium likelihood): This is the guardrail violation with the highest blast radius — "no invented thresholds" is a CLAUDE.md hard guardrail, not a style preference. The risk surfaces specifically in P3 (drafting), where a numeric constant could get typed in without a resolvable passage locator. Every value in the 4 migrated rules must trace to `evidence-assertions.json` or an explicit `authoring-decisions.yaml` record — there is no third path.
- **Stale design-spec paths executed literally** (Medium impact / Medium likelihood): The design spec predates the P0 module-package refactor and still says `data/rules.json` in places. If a task executor works from the spec directly instead of the PRD's path-mapping table, they'll write to paths that no longer exist or, worse, silently recreate the old duplicated-registry problem the PRD is trying to eliminate. Mitigated by making the path-mapping worknote (FR-5) the literal first task in P1 — nothing else in the plan is allowed to start before it lands.
- **Fixture provenance / content-rights exposure** (Medium impact / Low likelihood): Committing verbatim clinical-source passages to a public repo is effectively a one-way door. OQ-2's resolution (`RF-CBC-001`, hash+selector fallback unless rights are positively confirmed) is a conservative default specifically because reversing an accidental commit of restricted content is much harder than being cautious upfront.
- **Rule-schema v2 scope creep into E0** (Medium impact / Low likelihood): E0 must emit strictly the current 5-field schema (`additionalProperties: false`); any v2 field belongs only in ADR-1 and its deferred spec. Worth naming because "while we're in here, let's just add the field" is exactly the kind of incremental scope creep that's easy to rationalize mid-phase.
- **Determinism drift** (Medium impact / Low likelihood): Hashes differing across runs or machines would invalidate the reproducibility proof this feature exists partly to demonstrate. Guarded by P5's double-run gate, sorted serialization, pinned Node ≥20, and no timestamps embedded in hashed content.
- **Guardrail breach** (High impact / Low likelihood): The three-way check — CLAUDE.md hard guardrails, the PRD's §7 non-goals, and the design spec's §6.4 won't-build list — is why the `karen` milestones exist at the end of P2, P5, and P7 specifically, rather than being left to end-of-feature review alone.
- **`DEFAULT_MODULE_ID` tripwire trips silently** (Low impact / Medium likelihood): `src/modules/registry.js` has a standing comment anticipating this exact moment — the day a second module is registered, the constant's correctness stops being self-evident and needs re-justifying. The risk isn't code breakage (E0 adds zero client-selectable module surface, so `'anemia'` genuinely is still correct) — it's that the comment goes stale and a future reader trusts a rationale that no longer applies. P1-T3 must rewrite it, not just leave it passing.

---

## 7. What to Watch For

_Seeded from the risk table above — gotchas worth a second look during real-time review._

- P2's 15 seam-invariant tests are the exit gate, not a follow-on — if P2 "passes" without all 15 individually demonstrated, don't let it close.
- Every numeric constant landing in `modules/cbc_suite_v1/rules.json` (P3/P4) needs a resolvable passage locator or an explicit `authoring-decisions.yaml` entry — treat any exception as a stop-the-line finding, not a note for later.
- P1-T1 (the path-mapping worknote) is a hard blocker for everything after it — if any Phase 2+ task references a `data/*.json` path straight from the design spec, that's a signal the worknote wasn't actually consulted.
- Watch the fixture-selection step (P1-T6, `RF-CBC-001`) for content-rights creep — if a task starts committing full passage text instead of the hash+selector fallback, confirm rights clearance actually happened rather than assuming it did.
- `src/modules/registry.js`'s `DEFAULT_MODULE_ID` tripwire comment must be rewritten (P1-T3), not just left in place — a stale rationale sitting next to newly added code is worse than no comment at all.

---

## 8. Expected Success Behaviors

_Observable, human-verifiable post-ship outcomes — from PRD §11's acceptance criteria, phrased for someone checking the work by hand._

None of these require reading code — every check below is either a command to run, a file to open, or
a diff to eyeball. If verifying this feature at ship time takes anything more than the commands listed
here plus a text editor, that's itself a signal something about the deliverable drifted from what the
PRD scoped.

- [ ] Run `node tools/rf-bundle-to-kb-pack/cli.mjs inspect`, then `verify`, then `propose` against the fixture bundle — all three complete without a stack trace and produce output under `build/kb-pack/cbc_suite_v1/0.1.0-proposal/`.
- [ ] Feed the converter a deliberately non-`verified` fixture (flip `status` in a copy) — it refuses with a non-zero exit and produces no output files, not a partial pack.
- [ ] Open `modules/cbc_suite_v1/rules.json` and confirm exactly 4 rules exist, each traceable by eye through `rule-provenance.json` and `evidence-assertions.json` back to a specific passage — no rule should require taking a number on faith.
- [ ] Run `propose` twice against the same fixture and diff the two output directories — every file is byte-identical (SHA-256 match), not just "looks the same."
- [ ] Check the marrow-red-flag rule's test file for a dangerous-miss case where a benign high-scoring candidate co-occurs — confirm the safety alert still wins the ranking in that scenario.
- [ ] Open `release-manifest.unsigned.json` — confirm it's structured JSON with `rfInputs[]`/`converter` fields populated, not a stub, and that nothing in it or in `conversion-report.json` claims signed or clinically-validated status.
- [ ] List `docs/adr/` and confirm the 8 new ADR files all read `status: proposed` (none `accepted`), each naming the specific E1/E2 backlog item it unblocks.
- [ ] Run `npm run check` at the end of each phase, not just the very end — it's green every time, including immediately after P1's evidence-registry unification.
- [ ] Confirm `src/evidence.js` no longer hand-maintains its own copy of `KNOWLEDGE_BASE_VERSION`/`EVIDENCE` — it reads from (or is generated from) `modules/anemia/evidence.json`, with no way for the two to silently diverge.
- [ ] Feed `scripts/validate-kb.mjs` a deliberately malformed rule (an extra property) — confirm `npm run validate` now fails on it, where before this feature it would have passed silently.

---

## 9. Running Log

_Append-only. Short notes during execution — surprises, pivots, validated assumptions._

- [2026-07-19] Brief created. PRD and Implementation Plan were both drafted the same day; §2 above migrates the estimation worknote (`estimation-sanity.md`) in condensed form. Execution has not started.
