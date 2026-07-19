---
title: "AOS asset inventory for Phase 1 (Wave-0 safety foundation)"
description: "What the personal Agentic OS already provides that Phase 1 of the Pediatric CDS Platform can consume — capability inventory, WP mapping, ARC specifics, operational uses, gaps."
status: research-note
created: 2026-07-19
scope: read-only survey; no product code changed
---

# AOS asset inventory for Phase 1 (Wave-0 safety foundation)

This is an inventory and mapping, not a plan. It answers: of the things already running in the
personal Agentic OS (`rf`, ARC/`agentic-research`, IntentTree, AOS `op`), what can Phase 1
(`docs/project_plans/expansion/01-platform-expansion-roadmap.md` P1-WP1..WP7) actually reach for
today, and where is there nothing to reach for.

## Verification method and honesty notes

- Read in full: `03-arc-clinical-council-handoff.md`, `rf-handoff/RESULTS.md`,
  `implementation_plans/enhancements/arc-clinical-council-adoption-v1.md`,
  `.claude/worknotes/arc-clinical-council-adoption-v1/decisions-block.md`.
- Skimmed by section heading then targeted read of §6 (capability ledger/gap register) and §7
  (phased rollout) in `02-evidence-foundry-on-research-foundry.md` (1440 lines total).
- Live-probed: `agentic-research` repo (HEAD `72ab6f6...`, matches the handoff pin exactly — the
  ARC state described in the handoff is current, not stale), `research-foundry` repo (git log,
  CLI `--help`, CHANGELOG, grep for `pediatric_cds`), the `rf` HTTP API at
  `http://10.42.10.76:7432` (reachable, both `/health` and `/api/runs` returned real data), and
  IntentTree (`itt tree graph tree_01KXQ7WC1HQE2GKZSCNDVXA9G7`, 76 nodes / 93 edges, full node
  list pulled).
- One material finding surfaced by this probe itself: **IntentTree node status is stale relative
  to real repo/rf state** — see Section 2 note on drift. This corroborates, with fresh evidence,
  the "program/evidence-state drift" finding already recorded in the ARC readiness audit.
- Could not verify: whether `rf council` was actually exercised on any of the 7 pediatric bundles
  (RESULTS.md says "no rules... authored" and describes a cross-model gpt-5.6 audit, not an `rf
  council` run); the current git status of the `research-foundry-data` push (RESULTS.md §7 says
  reconciliation is still pending); and whether the runs-viewer at `:3030` is currently live (not
  polled — RESULTS.md asserts it is, HTTP API probe corroborates the same run data exists).

---

## Section 1 — Capability inventory

| Capability | System | How invoked (exact command/endpoint) | Status | Evidence |
|---|---|---|---|---|
| Evidence-first research pipeline (capture→triage→plan→ingest→extract→claim-map→synthesize→verify→bundle) | `rf` (research-foundry) | `rf capture` / `rf triage` / `rf plan` / `rf ingest` / `rf extract` / `rf claim-map` / `rf synthesize` / `rf verify` / `rf bundle` | **Shipped**, battle-tested core | `rf --help` (30 top-level commands); README.md: "still intact, still fully offline and deterministic by default" |
| `rf` HTTP API on the agentic node | `rf serve` | `GET http://10.42.10.76:7432/health` → `{"status":"ok"}`; `GET /api/runs` (Bearer `$RF_TOKEN_AGENT`) | **Shipped**, live | Curl probe this session: health 200, `/api/runs` returned real pediatric-cds run records |
| Shared evidence catalog (cross-run claim/source/inference search) | `rf` | `GET $RF_API_URL/api/catalog/search?q=...`; CLI `rf catalog` | **Shipped** | Probe returned real pediatric-cds claims (e.g. FDA §360j(o) pediatric-patient definition, WHO/CDC Hb cutoff claim) |
| 7 completed pediatric evidence bundles (RF-EV-001, REG-001, RF-CBC-001/002, RF-KID-001, RF-GRO-002, REG-004) | `rf` (run data) | Bundles live at `runs/<run_id>/evidence_bundle.yaml` on the node (`~/dev/research-foundry`); local mirror committed at `research-foundry` commit `4144634` | **Shipped, verified** (`rf verify` exit 0, 0 unsupported, all 7) | `rf-handoff/RESULTS.md` §1 table; catalog probe confirms claims are queryable today |
| `pediatric_cds` evidence-card extension (population/assay/threshold+UCUM/lifecycle/classification) | `rf` (convention, not a core schema) | Produced by `research-foundry/.claude/workflows/rf-pediatric-cds-run-execute.js` (modes `clinical`\|`regulatory`\|`backfill`) | **Partial** — it is a driver-script convention honored by all 7 existing bundles, **not** a schema/validator inside `rf` core | `grep -rl pediatric_cds` in research-foundry found it only in `.claude/workflows/...js`, run/registry data, and PRD docs — no `schemas/*pediatric*` file exists in `rf` core |
| Exact-passage locator on every material claim | `rf` (via the driver workflow + manual review) | Same 7 bundles; cross-model gpt-5.6 fidelity audit already caught and fixed 3 passage-fidelity gaps (superscript stripping, CFR enumeration gaps) | **Shipped for the 7 existing runs**; not yet a hard gate inside `rf verify` itself | RESULTS.md §4; `02-evidence-foundry...` §6.2 gap row "Exact passage not universally hard-gated" |
| `rf` governed URL/PDF extraction adapter | `rf` | (RFUP-2 upstream enhancement) | **Shipped** | IntentTree node `RFUP-2` status `completed`; `rf` CHANGELOG |
| Exact-passage hard-gating upstream in `rf verify` | `rf` | (RFUP-3) | **Shipped** | IntentTree node `RFUP-3` status `completed` |
| Stable rf schema versioning / machine-contract guarantee | `rf` | (RFUP-4) | **Shipped** | IntentTree node `RFUP-4` status `completed` |
| `rf council` result normalization (approve/concern/block) | `rf` | (RFUP-5); `rf council` CLI | **Shipped** | IntentTree node `RFUP-5` status `completed`; CLI help lists `council` |
| Run immutability / lineage guarantee | `rf` | (RFUP-7) | **Shipped** | IntentTree node `RFUP-7` status `completed` |
| Native live-discovery model adapters (Claude Agent SDK, GPT Researcher, PaperQA2, opencode, LiteLLM router, `arc_council`) | `rf` | `rf swarm run` | **Deferred / not installed** (0/6 live) | RFUP-6 node status `deferred`; README.md "0/6 live adapters"; `02-evidence-foundry` §6.2 |
| Writeback approve & dispatch (governed HTTP write path to MeatyWiki/SkillMeat/CCDash) | `rf` | `POST $RF_API_URL/api/runs/{run_id}/writeback/approve` | **Shipped**, newest feature | `git log` HEAD commit `5109915`; CHANGELOG "Writeback Approve & Dispatch" |
| Reusable assertion ledger (claim→assertion materialization, workspace-scoped writes) | `rf` | `rf assertion backfill` etc. | **Shipped**, default-off controls | CHANGELOG "Reusable Assertion Ledger" |
| Pediatric clinical evidence review council (8 voting seats + evidence scribe + adjudicator) | ARC (`agentic-research`) | `councils/pediatric-anemia-clinical-review-council.yaml@0.1.0` | **Shipped** (repository-ready) | Handoff doc; pinned commit `72ab6f6...` = current ARC HEAD |
| Evidence-source manifest for the council (15 sources, digest-bound) | ARC | `knowledge-packs/pediatric-anemia/source-manifest.yaml`; digest `f4c33c82...` | **Shipped** | Handoff doc §"Evidence-manifest and digest contract" |
| ARC run scaffold/validate CLI | ARC | `uv run arc run --spec <path> --dry-run`; `uv run arc validate runs/<dir> --json` | **Shipped, local only** | `arc --help` confirms `run`, `validate` subcommands exist |
| Completed synthetic readiness audit of the whole pediatric-CDS program | ARC | `runs/2026-07-19-pediatric-expansion-arc-readiness/` (scorecard, findings, decision record, validation plan) | **Shipped but explicitly non-qualifying** | Handoff doc: "readiness-audit complete... explicitly non-qualifying" |
| Qualifying (SDK-dispatched) ARC runtime pilot for this repo | ARC + AOS | (none yet — no working command) | **Not built** — blocked on portable-target resolver, rights receipts | Handoff doc: "qualifying runtime pilot: false"; ARC Adoption plan P1/P2 |
| AOS `op council` identifier-only correlation bridge | AOS (`agentic_meta_dev`) | `op council` (pin `OP_HOME`) | **Shipped, local-only commit**, not on `origin/main` | Handoff doc component table |
| IntentTree task graph for this program | IntentTree | `itt tree get/graph tree_01KXQ7WC1HQE2GKZSCNDVXA9G7` (workspace `ws_01KV8VMWXK05CTAZVHKT57HY0H`) | **Shipped, live**, but **stale relative to real state** | This session's probe: 76 nodes, several `not_started` nodes correspond to work already merged (see Section 2 note) |
| `council-review` skill (populate an ARC run skeleton) | Claude Code skill | `Skill(council-review)` | **Shipped, invocable now** | Skill listing in this session; used by the ARC handoff's "populate" step |
| MeatyWiki metadata-only adapter for ARC evidence manifests | ARC | (planned) | **Not built** | ARC CHANGELOG: "Recorded deferred contracts for a metadata-only MeatyWiki projection... none is represented as implemented" |
| Portal structured authoring for clinical RunSpecs | ARC | `web/` portal | **Not built for clinical fields** — general Portal/SAM/project-council machinery exists, clinical round-trip does not | ARC Adoption plan P6 (deferred); CHANGELOG lists general Portal/SAM features, none clinical-specific |

---

## Section 2 — Mapping to Phase 1 work packages

**Cross-cutting note on IntentTree drift.** The IntentTree node list pulled this session shows
`P0-WP1 — Module package contract... not_started`, yet `modules/anemia/` already exists in the
working tree and the repo's own commit log records `"Platform foundation P0: modules/<id>/
package contract (squash of 7-phase execution)"` (`ff4b519`). Likewise `RF-EV-001`,
`RF-CBC-001/002`, `RF-KID-001`, `RF-GRO-002`, `REG-001`, `REG-004` all show `not_started` in
IntentTree even though `rf-handoff/RESULTS.md` (dated one day before this survey) reports all 7
**verified**. This is not a new discovery — the ARC readiness audit already names
"program/evidence-state drift" as a finding — but it is now independently reproduced with a live
`itt tree graph` pull. **Any Phase 1 kickoff should first run IntentTree node updates (the P0-T1
task in the ARC Adoption plan already scopes this) before trusting node status as a signal.**

| Phase 1 item | AOS asset | Ready today? | Exact invocation | Gap |
|---|---|---|---|---|
| **P1-WP1** tri-state fact model | None directly — this is pure CDS-repo engineering (`ruleEngine.js`, `facts.anemia.js`) | N/A | — | No AOS asset does schema/engine design. `council-review` (safety council) is recommended by the roadmap doc *after* a design exists, to review the tri-state/unit-rejection invariants before merge — that's a real, invocable capability (`Skill(council-review)` or a full `arc run` against `pediatric-anemia-clinical-review-council`), but it reviews, it doesn't design. IntentTree node `P1-WP1` = `node_01KXQ7XBBNN52TNVKF678VMQGC`, `not_started`. |
| **P1-WP2** local reference-range registry + UCUM unit service | None directly | N/A | — | Same as WP1: pure engineering + `council-review` gate before merge. **RF-EV-002** (below) is the evidence half of this WP, not the code half. Node `node_01KXQ7XBHTKVMTYYB633ND5SJ9`, `not_started`. `schemas/reference-range.schema.json` does not exist yet in the repo (only `ranges.js` and `reference-ranges.json` data files from P0). |
| **P1-WP3** exact-passage evidence records (backfill 6 anemia sources) | **`rf` — already done.** RF-EV-001 bundle exists and is `verified` (48 claims, 35 supported/8 inferred/5 speculation, 0 unsupported, exit 0). | **Yes — the evidence itself is ready.** The CDS-side ingestion (turning the bundle into `evidence.js`/`data/evidence.json` records) is **not yet built** — that's `EF-WP0` (the `rf-bundle → kb-pack` converter), which is `not_started`. | Bundle path: `runs/rf_run_20260717_rf_ev_001_pediatric_cds_backfill/evidence_bundle.yaml` (via node or local mirror); catalog: `curl "$RF_API_URL/api/catalog/search?q=<claim>"` | Nothing converts the verified bundle into the schema shape P1-WP3 specifies (`sourceLocator`, `exactPassage`, `evidenceGrade`, `applicability`, `surveillanceQuery`). That converter is EF-WP0/EF-WP1, both `not_started`, and both explicitly out of `rf`'s scope per the seam doc ("rf stops at the verified bundle... no rules, thresholds-as-logic, FHIR, or signed packs were authored"). |
| **P1-WP4** rule governance metadata (`clinicalApprovers[]`, `owner`, `safetyClass`, etc.) | ARC clinical council (indirectly) supplies the reviewer roles that would populate `clinicalApprovers[]`; nothing supplies the schema/engine work itself | Partial | `arc councils recommend` / `arc roles` could enumerate valid reviewer role IDs to seed the `owner`/`clinicalApprovers` vocabulary | The council seats (Pediatric Hematology, Pediatric Laboratory Medicine, etc.) are a *review* mechanism, not an *approval identity/signature* system — the ARC handoff is explicit that "named human approvers remain responsible," and the ARC Adoption plan's P2 (Authenticated authority and rights attachments) is the **prerequisite**, still unstarted (OQ-2 unresolved: "which identity/credential/signing/revocation systems back P2?"). Do not wire `clinicalApprovers[]` to ARC output directly — ARC review ≠ credentialed sign-off. |
| **P1-WP5** signed KB manifest + semantic diff | ARC's schema/signing patterns (SkillBOM, run manifests) are a conceptual precedent but not reusable code | No | — | Entirely a CDS-repo build (`scripts/sign-kb.mjs`, `scripts/kb-diff.mjs`). No AOS asset signs KB packs. The ARC Adoption plan's own P5 gate references `arc_certification.yaml`/`run_manifest.yaml` as the *ARC-side* analog, but that signs an ARC *run*, not a CDS *KB release* — different artifact, no code reuse. |
| **P1-WP6** expanded validation corpus (property/boundary/mutation/dangerous-miss) | ARC's `dangerous_miss_scenarios` requirement (part of the council's `requiredInputs`) is a **directly reusable concept and partial content source** — the completed readiness audit already produced `DM-CBC-001` through `DM-WORKFLOW-010` as **10 named dangerous-miss families** | Partial — the *names/shape* exist, the *executable fixtures* do not | `runs/2026-07-19-pediatric-expansion-arc-readiness/validation_plan.md` lists the 10 families; converting them to `tests/dangerous-miss.test.mjs` fixtures is CDS-repo work | The ARC Adoption plan's own P4-T1 ("Convert DM-CBC-001 through DM-WORKFLOW-010 into non-patient synthetic scenario specifications") is the **same conversion work** P1-WP6 needs — these two plans should not duplicate it. Whichever plan executes first should hand the fixtures to the other. |
| **P1-WP7** clinical-review portal concept + data contract | ARC Portal exists generically; ARC Adoption plan P6 (Governed Portal authoring) targets the *same* problem for ARC RunSpecs | Partial — precedent only | — | P1-WP7 explicitly says "concept + data contract only (not the full app)" — this is `planning` skill work (PRD), not something `rf`/ARC hands over pre-built. The `review-record.schema.json` P1-WP7 wants to emit `approvedBy[]` is conceptually adjacent to ARC's `pediatric_clinical_review.json` output shape but is a distinct artifact for a distinct (CDS release, not ARC review) purpose. |
| **RF-EV-001** exact-passage backfill (6 anemia sources) | `rf` | **Done and verified** | See P1-WP3 row | None on the `rf` side. The gap is entirely downstream (EF-WP0/EF-WP1 converter). |
| **RF-EV-002** CALIPER/Bohn 2023 pediatric CBC reference intervals | `rf` (same pipeline, not yet run for this topic) | **Not run.** RESULTS.md covers 7 *other* named runs (RF-EV-001, REG-001, RF-CBC-001/002, RF-KID-001, RF-GRO-002, REG-004); **RF-EV-002 is not among them.** | Would use the same driver: `research-foundry/.claude/workflows/rf-pediatric-cds-run-execute.js` mode `backfill` or `clinical` | This is an **outstanding research run**, not yet executed. It is listed in the roadmap doc (§Research required) but does not appear in `rf-handoff/README.md`'s registered run list or RESULTS.md's completed table — confirm before assuming it's covered. |
| **REG-001** FDA non-device CDS intended-use memo | `rf` | **Done and verified** (89 claims, legal-review flagged) | Bundle `runs/rf_run_20260717_reg_001_pediatric_cds_map_the/`; catalog confirms FDA §360j(o) claim is live | RESULTS.md §5: "flagged for legal review; not legal advice... Do not act on them as legal positioning until a qualified reviewer signs off." The *research* is done; the **legal sign-off is not**, and no AOS asset can supply that — it's an owner-held gate, same category as ARC's credentialed-clinician gate. |
| **REG-002** content-rights / licensing review for reused guideline tables | None | **Not run** | — | Not in the 7-run RESULTS.md table at all. No `rf` run appears scoped to REG-002 specifically; it may be foldable into REG-001/REG-004 scope but was not confirmed as covered. Treat as an open research gap. |
| **MKT-001** 20-30 buyer/customer interviews | None (human-only) | N/A | — | No AOS asset conducts customer interviews. IntentTree node `XC-2 — Buyer/design-partner interviews (MKT-001) + data partner`, `not_started`. This is fully owner-held, outside `rf`/ARC scope by design. |
| **SPIKE-003** tri-state fact-model migration | None directly; `spike` skill exists generically (in the skill listing) for structured SPIKE research, but no dedicated IntentTree node was found for SPIKE-003 by that exact ID | Partial (tooling ready, not executed) | `Skill(spike)` / `/plan:spike` | No IntentTree node titled `SPIKE-003` exists in the 76-node graph pulled this session — it is currently only prose in the roadmap doc, not a tracked task. Same for SPIKE-004/005/006. If these are meant to be tracked work, they need to be decomposed into IntentTree nodes (or explicitly left as design-doc-only micro-spikes). |
| **SPIKE-004** FHIR/UCUM unit-mismatch rejection semantics | Same as SPIKE-003 | Partial | `Skill(spike)` | No dedicated node found. |
| **SPIKE-005** semantic-diff classification | Same | Partial | `Skill(spike)` | No dedicated node found. |
| **SPIKE-006** KB signing key custody in browser deploy | Same | Partial | `Skill(spike)` | No dedicated node found. |

---

## Section 3 — ARC clinical council specifics

**What the ARC handoff actually established** (not "what it plans to establish"):

1. A **reusable, versioned council definition** — `pediatric-anemia-clinical-review-council@0.1.0`
   at `agentic-research/councils/pediatric-anemia-clinical-review-council.yaml` — with 8 **voting**
   seats (Pediatric Hematology, Pediatric Laboratory Medicine, General Pediatrics, Clinical
   Informatics/Interoperability, Diagnostic-Accuracy Methods, Prediction/Implementation Evaluation,
   Patient Safety/Human Factors, Equity/Patient-Family Impact) plus 2 **non-voting** roles
   (Evidence Quality Input/scribe, Clinical Adjudicator/Validation Planner). Confirmed live at
   `councils/pediatric-anemia-clinical-review-council.yaml`, `spec.reviewers` lists all 9 named
   reviewer roles, `requiredInputs` names 7 required/optional input classes including
   `dangerous_miss_scenarios` and `local_laboratory_profile`.
2. A **digest-bound, metadata-only evidence-source manifest** (15 sources,
   `knowledge-packs/pediatric-anemia/source-manifest.yaml`, SHA-256
   `f4c33c82fe4977a7d4db2633ab04d82b39bb7bf421d048aba5a5b37a51b711f6`) that every council run must
   bind by path *and* hash.
3. A **completed synthetic readiness audit** (`runs/2026-07-19-pediatric-expansion-arc-readiness/`)
   that reviewed the *program itself* (not a single artifact) at pediatric commit `ff4b519`, and
   produced: 12 accepted high-severity findings, 1 watchlist finding, 0 rejected, 2 duplicate
   merges, recommendation `proceed_with_conditions` (for research/protocol/evidence/planning only),
   certification `pending`.
4. An **explicit vocabulary separating six delivery states** — repository-ready, readiness-audit
   complete, qualifying runtime pilot, credentialed review, clinical validation, release — with the
   handoff stating plainly that only the first two are true today; qualifying runtime pilot is
   `false`; credentialed clinical/lab approvals are `not_executed_owner_held`.
5. An **AOS correlation bridge** (`op council`, AOS commit `99d7ee03...`, local-only, not on
   `origin/main`) that forwards run/session/turn/feature/trace UUIDs only — explicitly no clinical
   content.

**How a review is actually run today** (the only safe path, per the handoff): there is **no
single CLI verb**. It's a 4-step manual sequence: `arc run --spec <RunSpec> --dry-run` then for
real (scaffold, produces an *empty* run skeleton with a placeholder scorecard) → hand the run
directory to an agent using the `council-review` skill (populate) → `arc validate runs/<dir>
--json` (structural check only, exit 0/1/2) → `jq '{recommendation, scores, summary}'
scorecard.json` (read the real verdict, and check `scores` isn't empty — an empty-scores
skeleton is easy to mistake for a "pass").

**What artifact comes back:** `scorecard.json` (recommendation + scores + summary),
`findings.yaml` (accepted/rejected/disputed/watchlist), `pediatric_clinical_review.json`
(abstentions, release status — the schema-validated custom clinical output), `validation_plan.md`
(required future work), `decision_record.md` (adjudication).

**Does it satisfy the P1 V1-Content gate** ("dangerous-miss review by a clinical advisor signs
off")? **No, not by itself, and the handoff says so explicitly.** ARC's collective authority
"stops at evidence-linked decision support and validation planning." The council can *author*
dangerous-miss hazards and findings (it did — the 10 `DM-*` families in the readiness audit), but
"authored hazards are not executed safety evidence," and the completed audit is a **synthetic**
review, "not credentialed hematology sign-off." A real "clinical advisor signs off" gate needs a
named, credentialed, independent human bound to the exact candidate digest — which is exactly the
P2 gap (`credentialed_review_complete`, marked "No" — ARC alone cannot set this state) in the ARC
Adoption plan's own state taxonomy.

**`clinicalApprovers[]` / `approvedBy[]`:** ARC's seats give you a **vocabulary and role
taxonomy** (e.g. "pediatric hematologist," "general pediatrician," "laboratory medicine" map
cleanly onto the `approvedBy[].role` shape sketched in the roadmap doc's P1-WP5 example) but **no
identity, signature, or credential-verification mechanism** — that's explicitly deferred to the
ARC Adoption plan's P2 ("Authenticated authority and rights attachments"), which is itself
unstarted and has an **open question** (OQ-2: "which identity/credential/signing/revocation
systems back P2?"). Populating `clinicalApprovers[]` from ARC output today would be **overclaiming**
— the field needs a real named human, ARC output is a synthetic review.

**Is `arc-clinical-council-adoption-v1` a prerequisite to P1, parallel, or absorbed?**
**Parallel, with one real dependency edge, not a hard blocker for most of P1.** Concretely:
- P1-WP1/WP2/WP5 (tri-state model, ranges/units, signed manifest) are pure CDS engineering — they
  do not need anything from the ARC Adoption plan to proceed, though the roadmap doc recommends
  routing the tri-state/unit-rejection *design* through `council-review` before merge (which is
  usable today, informally, without waiting for the Adoption plan's P1-P5).
- P1-WP3 depends on `rf` (already delivered, RF-EV-001 verified) plus the **not-yet-built**
  CDS-side converter (EF-WP0/EF-WP1) — the ARC Adoption plan does not block this at all; it's an
  independent Evidence Foundry track.
- P1-WP4's `clinicalApprovers[]` field and P1-WP7's portal-emitted `approvedBy[]` are the two
  places where P1 schema design should **anticipate but not yet consume** the ARC Adoption plan's
  P2 authority-attachment contract — build the field, leave it structurally ready for a real
  identity record, do not wire it to ARC's synthetic output.
- The **real dependency**: the V1-Content go criterion ("dangerous-miss review by a clinical
  advisor signs off") cannot be genuinely closed until ARC Adoption P2 (authority) and P4
  (executable dangerous-miss fixtures, which is the *same* DM-CBC-001..DM-WORKFLOW-010 conversion
  work P1-WP6 needs) land. Until then, P1 can build and self-test the validation corpus but the
  gate's *clinical sign-off* half stays `not_executed_owner_held` — which is an honest, allowed
  state per this repo's own guardrails, not a blocker to keep building.
- The ARC Adoption plan itself says the "next implementation command should target P0 only" — it
  has not been executed beyond planning (see below).

**Is the `arc-clinical-council-adoption-v1` plan executed?** **No.** The uncommitted plan file at
`docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md`
carries `status: approved` in frontmatter (Tier 3, 41 points, 8 phases P0-P7), and its own last
line reads: *"The next implementation command should target P0 only. No later phase is authorized
merely because this plan is approved."* The companion
`.claude/worknotes/arc-clinical-council-adoption-v1/decisions-block.md` is the binding planning
scaffold the plan was expanded from — also planning-only, no execution evidence. Neither file, nor
git log, nor IntentTree shows any P0-T1/T2/T3 task started. **This is a fully-planned, zero-executed
Tier 3 plan sitting uncommitted in the working tree** (`git status` shows it as `??`).

---

## Section 4 — Operational (post-build) uses

Once Phase 1 ships, these same AOS assets recur on a cadence, not just once:

- **Evidence surveillance** (P1-WP3's `surveillanceQuery` field, and the Evidence Foundry E2
  increment in `02-evidence-foundry-on-research-foundry.md` §7.4): each evidence record carries a
  standing `surveillanceQuery` (e.g. `"AAP pediatric iron deficiency ferritin threshold update"`).
  E2 scopes running these **monthly** via scheduled `rf` runs against named authorities, with
  **quarterly human review** and **immediate** triggered runs on retraction/correction/safety
  notice/guideline supersession. This is not built yet (E2 is "not_started" per the EF work_area
  node `EF-WP3`) but the mechanism (`rf triage`/`rf plan`/`rf ingest` re-run against the same
  claim ledger) is the same pipeline already proven on the 7 completed bundles — no new `rf`
  capability needs inventing, only scheduling/parameterization (already partly done: `rf-run-
  execute.js` is parameterized per RFUP-1, `completed`).
- **Periodic re-review**: the handoff is explicit that "an approval or audit attached to an older
  digest is stale" — every material target/evidence-manifest/council/policy/reviewer change
  requires a fresh `arc run` against the new digest. Operationally this means: any time
  `modules/anemia/rules.json` or `evidence.json` changes materially, re-run the scaffold→populate→
  validate→read-verdict sequence from Section 3, not just once at initial release.
- **KB re-signing**: P1-WP5's `scripts/sign-kb.mjs` produces a signed manifest per release; the
  roadmap's own guardrail ("no AI-published rule changes... signed release") means every
  content change is a *new* signed manifest, never an in-place rewrite — mirrored by the E2 gate
  language ("sign new immutable KB; never rewrite the active version in place").
- **Council re-approval cadence**: the ARC Adoption plan's P5 gate ("any material edit invalidates
  prior exact-tree approvals... rerun after every material edit") means the council review is not
  a one-time gate but a **per-release-candidate** gate, run against the exact digest of each new
  KB manifest, not against the original anemia module.
- **IntentTree hygiene**: this survey found the tracker actively drifting from reality (P0-WP1,
  all 7 RF runs shown `not_started` despite being done/merged). Post-build operational discipline
  needs a habit — likely a periodic `op story`/`itt` sync step — of updating node status when
  `rf`/git state changes, or the tracker becomes actively misleading rather than merely stale.

---

## Section 5 — Recommended context-file updates

**Is a new `docs/aos-integration.md` warranted?** Marginal-yes, but not urgent. The three docs
that already exist (`03-arc-clinical-council-handoff.md`, `rf-handoff/README.md` +
`RESULTS.md`, `02-evidence-foundry-on-research-foundry.md`) already cover this ground in more
depth than a new doc could add without duplicating them. The one thing missing is a **short,
skimmable index** pointing at all of them plus the exact CLI/API invocations — which is what this
worknote file already is. Recommendation: **do not create a new permanent doc**; instead add a
CLAUDE.md pointer to this worknote (or promote this worknote's Section 1 table into a short
`docs/project_plans/expansion/aos-asset-index.md` if it needs to survive worknote cleanup) rather
than authoring fresh prose that will drift the same way the IntentTree nodes did.

**Draft CLAUDE.md addition** (insert under "Where the plan lives," before "Program tracking";
kept to the terse register of the rest of the file):

```markdown
## AOS assets already available to this program

- **`rf` (Research Foundry) has already delivered 7 verified pediatric evidence bundles**
  (RF-EV-001, REG-001, RF-CBC-001/002, RF-KID-001, RF-GRO-002, REG-004 — see
  `docs/project_plans/expansion/rf-handoff/RESULTS.md`). They are claims, not rules — nothing
  converts them into `modules/anemia/*.json` yet (that's IntentTree `EF-WP0`/`EF-WP1`, not
  started). Reach `rf` live at `http://10.42.10.76:7432` (`$RF_API_URL`/`$RF_TOKEN_AGENT` in
  `~/.config/research-foundry/serve.env`) before starting a new evidence run — check the catalog
  (`/api/catalog/search`) first to avoid re-researching a claim that already exists.
- **ARC has a repository-ready pediatric clinical council** (`pediatric-anemia-clinical-review-
  council@0.1.0` in `agentic-research`, pinned `72ab6f6...`) with a completed but non-qualifying
  synthetic readiness audit. It can review non-patient artifacts (evidence, rules, dangerous-miss
  specs) via `arc run` (scaffold) → `council-review` skill (populate) → `arc validate` → read
  `scorecard.json`. It cannot supply `clinicalApprovers[]`/`approvedBy[]` — those need real
  credentialed humans; see `docs/project_plans/expansion/03-arc-clinical-council-handoff.md`.
- **IntentTree node status is known to drift from real repo/rf state** — verify status against
  git log / `rf-handoff/RESULTS.md` before trusting `itt tree get`, especially for P0/P1/EF/RF/REG
  nodes in tree `tree_01KXQ7WC1HQE2GKZSCNDVXA9G7`.
- Full inventory + Phase-1 WP mapping: `.claude/worknotes/wave0-safety-foundation/aos-asset-inventory.md`.
```

That is 21 lines including the header — within the 15-25 line target. It intentionally avoids
re-explaining the ARC/rf mechanics already covered in the linked docs, and it foregrounds the two
things a future session is most likely to get wrong: treating unconverted `rf` bundles as
production evidence, and treating an ARC synthetic review as a credentialed sign-off.
