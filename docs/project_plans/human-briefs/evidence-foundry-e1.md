---
schema_name: ccdash_document
schema_version: 2

doc_type: human_brief
doc_subtype: ""
root_kind: project_plans

id: ""
title: "Evidence Foundry E1 — Human Brief"
status: draft
category: human-briefs

feature_slug: evidence-foundry-e1
feature_family: evidence-foundry-e1
feature_version: v1

prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md
intent_ref: null
epic_ref: null

related_documents:
  - .claude/worknotes/evidence-foundry-e1-v1/decisions-block.md
  - .claude/worknotes/evidence-foundry-e1-v1/planning-brief.md
  - docs/project_plans/human-briefs/evidence-foundry-buildout.md
  - docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md
  - docs/adr/0004-clinical-approval-identity-adjudication.md
  - docs/adr/0005-kb-serialization-signing-key-custody.md
  - docs/adr/0006-validation-data-boundary-deidentification.md

owner: nick
contributors: [Opus orchestrator]

audience: [humans]

priority: high
confidence: 0.7

created: 2026-07-21
updated: 2026-07-21
target_release: ""

tags: [human-brief, evidence-foundry, clinical-review, signed-release, retrospective-validation]
---

# Evidence Foundry E1 — Human Brief

> Living document for human orchestrators. Agents: do not load unless explicitly instructed.
> Status: draft | Updated: 2026-07-21

**The one-paragraph version**: E1 builds the *machinery* of clinical governance — a five-role
append-only review-record workflow (ADR-0004), Ed25519 sign/verify tooling plus a flat release
registry (ADR-0005), and a fixtures-only retrospective validation harness behind the ADR-0006
de-identification boundary — while every act that would confer real standing (ADR acceptance,
reviewer roster, signing custodian, DUA, release authorization) is modeled as an external human
gate (G0–G4), never a task. Nothing this feature ships is, or may be described as, clinically
validated, safe, or release-ready; every approver/signature slot ships schema-forced empty. 34 pts,
5 phases, one contract phase fanning out to three parallel workstreams, `karen` at P1 exit and
feature end.

---

## 1. Context Pointers

One-line pointers. Do not restate content.

- **PRD**: `docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md` — FR-1..FR-31, gates G0–G4, binding rulings R1–R6, 8 open questions.
- **Plan**: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md` (+ 3 phase files under `evidence-foundry-e1-v1/`) — 5-phase / 34-pt breakdown, OQ resolutions, deferred-items triage.
- **Decisions Block** (binding, Opus-authored — not to be contradicted): `.claude/worknotes/evidence-foundry-e1-v1/decisions-block.md`.
- **Design Specs**: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §7.3 items 6/10/11 — the normative scope source.
- **SPIKEs**: SPIKE-006 (signing NO-GO, reconciled per PRD §2a, stands for the browser path); SPIKE-007 (retrospective data source) is *authored by* this feature (P4-T9), not consumed by it.
- **Related Briefs**: `docs/project_plans/human-briefs/evidence-foundry-buildout.md` — E0, this feature's estimation anchor and substrate (canonical bytes, cbc_suite_v1 pack, wave0 review-record schema).

---

## 2. Estimation Sanity Check

_Migrated from the decisions block §4 (estimation anchors). Human-authored; not agent-relevant._

**Bottom-up total**: 34 pts across 5 phases (P1 5 · P2 8 · P3 8 · P4 8 · P5 5).
**Top-down anchor**: E0 (`evidence-foundry-buildout-v1`) — 42 pts over 7 phases, same track, same repo, completed via PR #17.
**Reconciliation**: 34 is a −20% delta against the E0 anchor, and that direction is defensible rather
than optimistic: E0's two biggest cost drivers (the H3-flagged algorithmic converter and the 4-rule
vertical slice with its 5-category test corpora) have no counterpart here. This triad is three
medium-sized capability areas over an already-proven substrate — E0's canonical serialization is
consumed, not rebuilt. Per H4, though, treat **34 as the floor, not the midpoint**.

**H1–H6 heuristic application:**

- **H1 (scope clarity)**: P1's noun count is directly enumerable — 3 new/unified schema surfaces
  (canonical review-record, roster, release-manifest/registry), one wave0 mapping + migration test,
  one gates registry doc — anchoring P1 at 5 pts against E0's own Phase-1 schema work. The three
  8-pt workstreams each carry a similarly countable artifact list (CLI + store + validators + dry-run;
  sign/verify + registry + runbook; harness + boundary + protocol shape + charter).
- **H2 (tech risk)**: The scariest-looking item — crypto — is deliberately small: Node-native
  `node:crypto` Ed25519 only, no new dependency, and SPIKE-006 + ADR-0005 already did the design
  de-risking. No dual-implementation split exists anywhere in this repo. P3 still gets `extended`
  effort on the crypto/determinism tasks because correctness beats speed there.
- **H3 (integration surface)**: The five-role review state machine is H3-flagged but its transitions
  are fully enumerable from ADR-0004, which is exactly why no SPIKE was needed. The genuinely shared
  surface (`schemas/*` + `scripts/validate-kb.mjs`) is confined to P1 plus one declared seam task
  (P3-T6), so integration cost is concentrated, not smeared.
- **H4 (team familiarity / bundle-vs-sum check)**: Three capability areas (review, release,
  validation) were estimated independently and summed — no cross-area discount was applied. That is
  the conservative direction, and it is also why 34 is a floor: bundle synergies were not assumed,
  but bundle *frictions* (the P5 integration dry-run finding a contract mismatch) are the residual
  risk the sum doesn't price.
- **H5 (external dependencies / anchor comparison)**: Anchor = E0 at 42 pts. This plan builds
  strictly fewer new nouns (no converter, no vertical slice, no 8-ADR drafting run) on top of E0's
  outputs, so a smaller number in the same order of magnitude is the expected direction of travel.
  H5's re-derive trigger ("more nouns but less estimate") does not fire. The external *human*
  dependencies (G0–G4) are deliberately excluded from the estimate — they gate standing, not work.
- **H6 (test/QA overhead)**: +1 pt of explicit plumbing was added to P3 for CI verify wiring; the
  rest of the QA load (seeded-violation suites, determinism double-runs, fail-closed fixtures) is
  folded into the phase numbers because it *is* the feature — a governance tool whose tests are an
  afterthought would be worthless.

**Known inflation risk**: `releases/registry.json` E2-seed fields. The plan's OQ-4 resolution caps
this hard (exactly the FR-14 field list, withdrawal fields as inert consts, surveillance hooks
omitted entirely) — if that cap slips during P3, the estimate slips with it.

---

## 3. Wave & Orchestration Notes

**Critical path**: P1 → max(P2, P3, P4) → P5 = 5 + 8 + 5 = **18 pts of serialized depth** against
34 total. P1 is strictly first because all three workstreams consume its contracts, and the
wave0-vs-ADR-0004 review-record unification (ruling R5) must land before any machinery is built on
either model — building P2 against an unmapped schema is the specific rework trap P1 exists to close.

**Parallel opportunity**: P2 ∥ P3 ∥ P4 after P1 exit — wave plan `[P1] → [P2, P3, P4] → [P5]`. The
fan-out is real, not aspirational: file ownership is disjoint by construction (`tools/review-record/`
+ `modules/cbc_suite_v1/reviews/` vs `tools/release-sign/` + `releases/` vs `tools/retro-validate/`),
and P4's harness-local schemas were deliberately placed under `tools/retro-validate/schemas/` so no
wave-2 phase touches the shared barrier file. All three lanes are 8 pts, so all three are
co-critical — there is no "slow lane" whose slippage is free.

**Merge order**: P1 merges alone. The three wave-2 branches can merge in any order — the only
serialization barriers are `scripts/validate-kb.mjs` (owned by P1, touched post-P1 only by P3-T6),
`CHANGELOG.md`, and `docs/architecture.md` (both P5-only). P5 merges last and owns the
cross-workstream join (P5-T1 dry-run: review cycle → test-key release candidate → pinned harness
replay).

**Milestone reviews**: `karen` sits at **P1 exit** (contract sanity — the cheapest point to catch a
schema-unification mistake that would otherwise propagate into all three lanes) and at **feature
end** (the honesty gate). If either gets skipped or shortened under schedule pressure, treat it as
an escalation, not a routine call — the feature-end karen is what stands between "governance
machinery" and "artifacts that read like clinical sign-off."

**Cross-feature coupling**: Hard dependency on E0's delivered substrate (P5-T5 canonical bytes,
`modules/cbc_suite_v1/` pack, wave0 `schemas/review-record.schema.json` as migration source) — all
landed via PR #17, so no in-flight coupling. The human gates G0–G4 may overlap any phase but block
no phase exit: every gated behavior ships schema-forced inert, so gate stalls cost standing, not
schedule.

---

## 4. Open Questions Ledger

_Pointer inventory across PRD §12 and the plan's "Decisions & OQ Resolutions" section. Four of the
eight PRD OQs were resolved by the implementation-planner (binding; reopening requires a new
decisions-block entry); the other four are structurally unresolvable by software — they belong to
gates or to humans. The decisions block's own six expansion OQs were all resolved by the plan and
are listed below for traceability._

**PRD §12 open questions:**

| ID | Source | Question | Status | Resolved By |
|----|--------|----------|--------|-------------|
| OQ-1 | PRD §12 | Reviewer roster — location, format ownership, credential-verification procedure | resolved (mechanics) / gated (verification) | Plan "PRD OQ-1": `governance/reviewer-roster.yaml` + `schemas/reviewer-roster.schema.json`; ships empty; synthetic entries `synthetic: true` const, never release-qualifying. The out-of-band credential-verification procedure itself remains a G1 human act. |
| OQ-2 | PRD §12 | Verifier surface (extend `validate-kb.mjs` vs new tool) + interim review-signature semantics | resolved | Plan "OQ-2"/"OQ-1" + P3-T6: structural validation joins the existing `npm run validate` chain via `scripts/validate-kb.mjs` (no new npm scripts); review signatures are detached-Ed25519-semantics objects over canonicalized record bytes — git commit signatures explicitly rejected (signer=author collapse); dry-runs use `TESTKEY-`-prefixed throwaway keys, real records schema-forced empty until G1/G2. |
| OQ-3 | PRD §12 | `releases/registry.json` in-repo vs separate repo; E2 ownership boundary | resolved for E1 / revisit at G0 | ADR-0005 default adopted (in-repo flat file); plan OQ-4 caps the E2-seed fields to exactly the FR-14 list with withdrawal fields as inert consts. Location is explicitly revisitable at the G0 ADR-0005 acceptance review. |
| OQ-4 | PRD §12 | Retrospective data source — corpus/partner, DUA shape, retention, replay pinning | **open (gated G3)** | Resolvable only by the data-source SPIKE (SPIKE-007, charter authored in P4-T9; running it is out of scope). No software decision can close this. |
| OQ-5 | PRD §12 | Adjudicator-≠-author semantics for converter-produced rule sets | resolved | Plan "PRD OQ-5": "author" = union of every human identity in `authoring-decisions.yaml` plus the git author of the proposal-pack commit; the converter is never an identity; materialized as a machine-readable `authorship` block (P2-T4), consumed by both FR-5 and FR-23. |
| OQ-6 | PRD §12 | Promote E0's dangerous-miss corpus as-is, or re-derive under the harness schema? | resolved | Plan "PRD OQ-6": promote via a deterministic adapter (P4-T8) wrapping the E0 fixtures in the harness envelope — one source of truth, no content mutation, stability pinned by test. Re-derivation was rejected as a silent-divergence risk. |
| OQ-7 | PRD §12 | Does full CBC Suite authoring (DF-E1-08) trip ADR-0001's rule-schema-v2 trigger, re-triggering DF-E1-07? | **open (G0 / orchestrator ruling)** | Not resolved by the plan — deliberately, since it binds sibling plans, not this one. Needs an orchestrator/owner ruling; the plan's DF-E1-07 row marks it "pending." |
| OQ-8 | PRD §12 | Portal friction trigger — what measurable threshold promotes DF-E1-01, and who calls it? | **open (human, post-dry-run)** | The synthetic dry-run (P2-T8) emits the first friction observations; the threshold and the call are the owner's, after evidence exists. Pre-emptive portal building stays banned per R1. |

**Decisions-block expansion OQs (all resolved by the plan; listed for traceability):** OQ-1 CLI
shape (per-workstream `tools/<name>/cli.mjs` verb dispatch, E0 convention); OQ-2 store layout
(`modules/<id>/reviews/rr-<seq4>-<role>.yaml`, hash-chain + git-history append-only); OQ-3 render
target (`build/review-render/`, gitignored, goldens under `tests/fixtures/ef-review-render/`);
OQ-4 registry seed fields (FR-14 list only); OQ-5 metrics set (5 software-agreement measures,
canonical `agreement-report.json` + provenance sidecar); OQ-6 throwaway keys (ephemeral in-memory,
no `--test-keys` flag, nothing persistable).

---

## 5. Deferred Items Rationale

_Why items were deferred and what would trigger promotion. The plan's triage table (12 rows) owns
the full mapping; every row gets exactly one Phase 5 design-spec task._

The deferral pattern here is different from E0's, and worth naming: E0 deferred things because its
*inputs* didn't exist yet; E1 defers things because its *humans* don't exist yet. Almost every
deferred row below is blocked on a named human gate, not on missing software — which means no amount
of additional engineering inside this plan can promote them. That's the design working, not a gap.

- **Interactive review portal** (DF-E1-01): Deferred because ruling R1 fixed v1 as files + CLI —
  a portal is only justified by *demonstrated* file-workflow friction, and no evidence of friction
  can exist before the synthetic dry-run runs. Promote when the OQ-8 threshold is met **and**
  reviewer roles are named. Building it pre-emptively would be speculative UI over a workflow no
  real reviewer has ever touched.
- **Real-data retrospective run** (DF-E1-09): Deferred because touching real data before a DUA and
  a SPIKE verdict would breach ADR-0006's boundary and the repo's PHI guardrail outright. Promote
  only when G3 clears **and** named humans set the protocol thresholds. The harness ships
  fixtures-only precisely so the pressure to "just try it on real data" has a structural wall to hit.
- **Production signing posture** (DF-E1-06): Deferred because its promotion trigger is literally
  "ADR-0005 accepted" (G0) plus a custodian and ceremony (G2). E1 ships machinery plus a runbook;
  the ceremony is a human act.
- **Sibling E1 workstreams** (DF-E1-02 12-angle research op, DF-E1-03 upstream rf validators,
  DF-E1-05 FHIR emitters, DF-E1-07 CI expansion, DF-E1-08 full CBC authoring): Each is a separately
  planned lane with its own blockers (ADR-0008, RFUP acceptance, ADR-0003, the OQ-7 trigger
  reading). Pulling any of them in would break the R1 triad boundary that keeps this plan reviewable.
- **E2 machinery** (DF-E2-01/02/03 surveillance, monitoring, withdraw/rollback): Nothing to
  surveil, monitor, or withdraw until a signed, registered release exists. E1 ships only the
  registry seed with inert withdrawal-state consts.
- **RFUP upstream enhancements** (DF-EXT-01): Routed externally via `op story`; the E0 routing note
  already exists — P5 only confirms currency, no spec authored.

---

## 6. Risk Narrative

_Orchestrator-facing rationale — why each risk matters at this altitude, not just its mitigation._

Two risks here are the ones worth losing sleep over, and both are honesty-shaped rather than
code-shaped.

- **Implied clinical validity leakage** (High/Medium): This feature's vocabulary — "signed release,"
  "review record," "validation harness" — *sounds like* clinical sign-off to any future reader, and
  the repo's known most-likely-future-mistake is exactly that misreading. The countermeasures are
  everywhere (software-agreement naming, `synthetic: true` consts, non-qualifying labels, the P5-T2
  audit, karen at feature end), but the risk is cultural, not technical: one carelessly worded README
  line survives every schema check. This is why FR-28 is a review-blocker, not a lint warning.
- **Signing custody misdesign** (High/Low): SPIKE-006 NO-GO'd signing precisely because
  signer=author custody collapse makes a signature worse than none — it manufactures false
  assurance. Any design drift where an agent, CI job, or repo file ends up holding key material
  recreates the rejected posture. The plan's answer is structural (verify-only CI, ephemeral
  in-memory test keys, schema-forced-empty slots, a test asserting zero key material) — watch that
  no convenience shortcut during P3 softens it.
- **Dual review-record models diverge** (Medium/Medium): Two paper contracts already exist (wave0
  5-state vs ADR-0004 five-role). If P2 machinery starts before P1's canonical mapping lands, the
  repo ends up with parallel clinical-governance schemas — the exact condition FR-2 bans. The wave
  structure enforces the ordering; the P1-exit karen is the human check on the unification itself.
- **ADR churn** (Medium/Medium): All 8 pre-E1 ADRs are `proposed`; building on their recommended
  defaults is a calculated bet (R2). If G0 acceptance revises a decision, affected machinery gets
  reworked as a follow-up — the mitigation is that everything is thin, file-based, and append-only,
  so migration is cheap. Each phase gate carries an ADR-delta check so a mid-flight human edit
  doesn't land silently.
- **Harness scope creep toward real data** (Medium/Medium): The gravitational pull toward "let's
  validate against something real" is constant and well-intentioned. The harness structurally
  rejects inputs without a synthetic/de-identified provenance marker, and the SPIKE charter exists
  specifically to channel that pressure into the gated path rather than around it.
- **E0 canonical-bytes drift** (Medium/Low): P3's whole determinism story rests on E0's P5-T5
  serialization staying byte-stable. The golden-bytes regression fixture makes drift a loud phase
  failure instead of a silent re-baseline — do not let anyone "fix" that test by regenerating the
  golden.
- **Gate stall** (Medium/High — and accepted): G0–G4 will very likely all still be open when this
  feature ships; that is the expected end state, not a failure. All software and dry-run work is
  gate-independent by construction. The thing to resist is reframing gate stalls as feature
  incompleteness — the feature is complete when the machinery is; standing arrives with the humans.

---

## 7. What to Watch For

_Gotchas and trap-doors for real-time review during execution._

- **All 8 pre-E1 ADRs are still `proposed` (G0 open).** Nothing in this feature may treat an ADR
  recommendation as accepted policy; anything whose trigger reads "ADR accepted" stays gated. If a
  task description or commit message says "per accepted ADR-000X," stop the line.
- **The SPIKE-006 reconciliation condition must actually get recorded** in the gates registry's G0
  ADR-0005 entry (P1-T6, adjudication A2): the signing custodian must be a *distinct authority* from
  the release author, and CI/agents never hold keys. The G0 acceptance review must restate this
  explicitly — if the gates registry ships without that record, ADR-0005's acceptance could later
  quietly override the SPIKE verdict.
- **No human roster, custodian, or DUA exists yet — and none will be created by this plan.** Any
  artifact that names a reviewer, signer, or data partner as if real is a fabrication. Synthetic
  personas must carry `synthetic: true` and non-qualifying language everywhere they appear; the
  release-auth validator must reject synthetic chains.
- **Honesty posture is a review-blocker (FR-28), not a style note.** Every new schema description,
  README, CLI string, render banner, report header, and doc section must carry the
  unvalidated-research-prototype posture. The P5-T2 audit has a bounded target-surface list — check
  it was actually walked, not sampled.
- **Test-key leakage is the quiet failure mode of P3**: `TESTKEY-`-prefixed keyIds must be rejected
  on any real candidate, and no key material may persist anywhere (no fixture keys, no `--test-keys`
  flag — ephemeral in-memory only, per OQ-6). If a keypair file ever shows up in a diff, that's
  stop-the-line.
- **P3's signing preimage must be E0's P5-T5 bytes, byte-for-byte** — any re-implementation of
  canonicalization, however innocent-looking, breaks the trust chain (FR-12's byte-identity test is
  the tripwire).
- **`scripts/validate-kb.mjs` is a serialization barrier**: after P1, only P3-T6 may touch it. A
  second wave-2 phase editing it is a plan violation, not a merge conflict to wave through.
- **Registry seed-field creep** (the named estimate inflater): if P3 starts adding surveillance
  hooks or ADR-0007 taxonomy fields to `releases/registry.json`, that's E2 scope arriving early —
  the OQ-4 cap is exactly the FR-14 list.
- **The anemia browser path's SPIKE-006 posture is untouchable** — two-part digest, status enum,
  fail-closed behavior all stay byte-identical. Verification work for the EF release path must not
  soften the deployed path.

---

## 8. Expected Success Behaviors

_Observable, human-verifiable post-ship outcomes — from PRD §11, phrased for checking by hand._

- [ ] Run the five-role synthetic dry-run artifacts through `tools/review-record/cli.mjs validate`
      — all five record types exist, every one carries explicit non-qualifying language, and
      **zero** approver/signature fields are populated anywhere (schema `maxItems: 0` / const-empty
      checks prove it, but eyeball a record too).
- [ ] Try to mutate an existing review record and re-validate — the append-only validator rejects
      it; corrections only work as new superseding records.
- [ ] Seed each violation class — record mutation, reviewer-2 referencing reviewer-1 content,
      adjudicator = author, tampered candidate bytes, unknown/`TESTKEY-` keyId on a real candidate,
      identifier-bearing fixture, populated signature pre-G2, software-populated protocol
      thresholds — and confirm every one is rejected fail-closed (non-zero exit, no partial output).
- [ ] Run sign→verify twice over the same candidate with test keys — byte-identical canonical
      input, stable verdict; then run the harness twice over identical fixtures + pinned digest —
      byte-identical `agreement-report.json` (hash-compare, not "looks the same").
- [ ] Open `releases/registry.json` — schema-valid, append-only-enforced, `signature: null`,
      withdrawal state `"none"` and never set, no surveillance fields present.
- [ ] Open the rendered review view — self-contained static HTML, unvalidated-prototype banner
      present, rights-restricted passages shown as hash + selector references (never inline text),
      no scripts, no network.
- [ ] Confirm `docs/governance/gates-registry.md` documents G0–G4 with owner-roles and entry
      criteria, and that G0's ADR-0005 entry records the SPIKE-006 reconciliation condition.
- [ ] Confirm the two document deliverables exist and read as reviewable documents: the
      signing-ceremony runbook and the SPIKE-007 data-source charter.
- [ ] Grep the diff for validity-implying language ("validated," "clinically approved," "safe,"
      "release-ready" as a status) — the honesty audit should have left nothing to find.
- [ ] `npm run check` green at every phase boundary; the anemia browser path's digest/status
      posture byte-untouched; no test-glob changes.
- [ ] Progress tracking shows G0–G4 as externally-blocked states — never as completed (or
      completable) tasks.

---

## 9. Running Log

_Append-only. Short notes during execution — surprises, pivots, validated assumptions._

- [2026-07-21] Brief created. PRD, decisions block, and implementation plan all drafted the same
  day; §2 migrates the decisions block's estimation anchors, §4 harvests PRD §12 against the plan's
  OQ-resolution section. Execution has not started; all five gates G0–G4 open.
