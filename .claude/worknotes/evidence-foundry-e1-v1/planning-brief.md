# Planning Brief — Evidence Foundry E1 (clinical review workflow + signed release + retrospective validation)

> Input for the Tier 3 decisions block. Sources read 2026-07-21 under the `plan-evidence-foundry-e1`
> worktree. All paths repo-relative. E0 (`evidence-foundry-buildout-v1`, PR #17) is **completed**.

## E1 scope per §7.3 (`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md`)

§7.1 one-liner: E1 = "operate" — add live discovery workflow, evidence council, dual clinical review,
stronger tests, review UX; handoff = reviewed CBC pack + **signed preclinical release candidate**;
clinical state = retrospective validation candidate.

§7.3 scope items (condensed, numbering preserved):
1. Parameterize `rf-run-execute.js` (paths, date, freshness, run ID, source limits).
2. Record exact queries, search surfaces, screening, exclusions, source-status checks.
3. Run the 12 CBC research angles with concurrency/rate-limit controls.
4. Exact-passage + pediatric-card validators upstream (in `rf`).
5. Methodologist/skeptic council with consensus policy.
6. Clinical review records + minimal review UI for passage→decision→rule→test.
7. Complete CBC Suite ontology, typed facts, local profile contract, candidate rules, tri-state questionnaire.
8. Property, mutation, conflict, unreachable-branch, semantic-diff tests.
9. FHIR/terminology mappings with explicit mapping status + site validation.
10. Retrospective validation with independent adjudication; subgroup/analyzer/site analysis.
11. Signed **preclinical** release candidate; NOT clinically activated until later gates pass.

**E1 go gate** (verbatim-condensed): reproducible search protocol + approved source coverage; no open
high-severity evidence conflict without safe representation; two independent clinical reviews + lab
review complete; 100% rule positive/negative activation coverage + numeric/missingness/dangerous-miss
coverage; zero surviving critical mutations + mutation target met; retrospective dangerous-miss/utility
thresholds meet prespecified protocol; no material subgroup/site/analyzer gap unmitigated; signed
release candidate verifies but stays inactive pending silent/human-factors authorization.

**Boundary — E2 owns (§7.4, do NOT scope-creep into E1):** surveillance queries/cadence/triggers,
impact-graph traversal, materiality classification, registry writeback to catalog/wiki/CCDash,
re-sign/never-rewrite update flow, production monitoring/telemetry (DF-E2-02), **withdraw/rollback
machinery (DF-E2-03)**, rollback drills. E1 only needs the registry seed (ADR-5 flat file) that E2
later extends. Also out of all increments (§6.4 non-goals): second evidence crawler, generative rule
writer, patient LLM path, guessed LOINC/UCUM, `rf verify`/council treated as clinical validation,
single blended confidence score.

**Requested-feature vs full E1:** the tasked feature (review portal/workflow + signed release +
retrospective validation) is §7.3 items 5–6, 10–11 plus their gates — a subset of the 11-item E1.
Items 1–4 (discovery/Path-B, DF-E1-02/03), 7 (CBC ontology/facts), 8 (test CI, DF-E1-07), 9 (FHIR,
DF-E1-05) are sibling E1 workstreams. The E0 decisions block states "E1's L-sized items each warrant
their own plan" — the orchestrator must draw this boundary explicitly (see Risks).

## Capability ledger (§6.1) rows relevant to E1

| Capability | Reuse/build | Owner | Effort | Module-1 deliverable |
|---|---|---|---|---|
| Clinical review portal/workflow | Build | CDS | **L** | E0 may use signed files; portal before scale |
| Retrospective validation harness | Build | CDS | **L** | Version-pinned replay and adjudication model |
| Signed KB registry | Build | CDS/platform | M | Unsigned E0 manifest; production signing before release |
| Property/mutation/semantic-diff CI | Build | CDS | M | Release-blocking checks |
| Rule schema v2 | Defer/design | CDS | M | Sidecar in E0/E1; migration decision before multi-module scale |
| Pediatric extraction extension / exact-passage check / search-screening ledger | Extend | `rf` | M each | Upstream — DF-E1-03 / RFUP routing |
| Silent-mode pipeline | Build | CDS | L | NOT required for E1 candidate; required before live use |
| FHIR/terminology emitters | Build | CDS | L | Mapping skeleton exists; verified profiles later |

Effort scale: S focused component; M multi-artifact feature w/ tests+review; L cross-system capability
requiring clinical/operational validation.

## ADR constraints binding on E1 (all 8 pre-E1 ADRs are `status: proposed`, NONE accepted — the E0 Phase-6 gate explicitly forbade acceptance; E1 planning must ratify or revise)

**ADR-0001 (canonical authoring model / rule schema v2)** — Three-tier model: (1) cross-cutting
governance metadata stays extended in-place on `schemas/rule.schema.json` (now 14 required fields — 5
original + 9 EP-4 governance fields incl. `clinicalApprovers`); (2) converter provenance is
sidecar-only (`modules/<id>/rule-provenance.json` joined by rule `id`); (3) schema v2 (restructured
`when`/`output`, precedence tiers replacing ordinal `points`, typed facts) is deferred — **trigger:
before a second independently-authored module begins rule authoring ("before multi-module E1
scale")**. E1 must decide whether full CBC Suite authoring (§7.3 item 7) trips that trigger.

**ADR-0004 (clinical approval identity/adjudication)** — E1 v1 review = **append-only, git-signed
review files** (`modules/<id>/reviews/<review_id>.yaml`), not a portal. Reviewer identity = named
human with out-of-band-verified credential in a roster; never ARC/council output. "Signature" =
cryptographic signature (ADR-0005 mechanism) binding reviewer identity to content hash. Reviewer 2
has no read dependency on reviewer 1. Adjudication = distinct signed file, adjudicator ≠ sole author.
Release authorization is the terminal signed file — the ONLY thing that flips `unsigned-stub` →
`release-ready`. Portal (DF-E1-01) builds only when file-workflow friction is demonstrated.

**ADR-0005 (KB serialization/signing/key custody/registry)** — Recommends Ed25519 detached signature
over P5-T5's canonical bytes (`node:crypto`, no new dependency, no network), offline/HSM single-signer
custody (manual process until E2), flat append-only git-tracked `releases/registry.json` (version,
digest, signer, supersedes, withdrawal state). Manifest shape unchanged: `signature.algorithm` =
`"ed25519"`, `keyId` → registry. Registry is the seed DF-E2-01/DF-E2-03 later extend. **Must never
diverge from P5-T5 canonical serialization** (non-determinism risk §8.3).

**ADR-0006 (validation data boundary)** — Binding: **no patient-identifiable data ever enters this
repo, its build outputs, or any `rf` run/writeback**. Retrospective validation runs against an
external partner-governed, pre-de-identified dataset (Option 1); synthetic/case-report corpus is a
continuous complement, never a substitute for the retrospective rung. First-party HIPAA environment
explicitly NOT adopted now. Only de-identified aggregate metrics cross into the repo, each with a
provenance record. Validation-data access log is a distinct audit trail from the review audit trail.
Retention period + deletion trigger deferred to the DF-E1-04 spec, fixable only after the data-source
SPIKE.

## Design-spec inventory

| Doc (`docs/project_plans/design-specs/`) | Status/maturity | In E1 per §7.3? | Open questions in doc |
|---|---|---|---|
| `clinical-review-portal-workflow.md` (DF-E1-01) | draft / shaping | **Yes** — §7.3 item 6; but E1 v1 = ADR-4 append-only files; portal only on friction trigger | Roster location + out-of-band credential verification; portal reads files vs own DB (tamper-evidence); friction threshold + who calls it; portal auth vs roster verification |
| `review-portal-design.md` (EP7-T2, wave0 feature) | draft / shaping | **Input, not deliverable** — paper data-contract for `schemas/review-record.schema.json` (5-state workflow: proposed/under-review/disputed/approved/rejected; human-only D-4 pin `reviewerType:"human"`, `attestedHuman:true`; terminality is process-rule not schema-enforced) | None listed formally; flags 4-vs-5-state doc/schema tension (schema wins) |
| `signed-kb-manifest.md` (DEF-4, platform-foundation-p0) | draft / **idea** | **Background/superseded** — anemia-module-scoped; `signed-release-key-custody.md` supersedes it in scope for the EF release path | Cryptographic vs procedural "signed"; key location/holder; what `validationRunId` references; extra `status` states; DEF-1 interaction |
| `signed-release-key-custody.md` (DF-E1-06) | draft / shaping | **Yes** — §7.3 item 11; trigger: ADR-5 accepted | Ratify Ed25519 as-is?; initial signer/custodian + concrete HSM ceremony; rotation/compromise runbook ownership; `validate-kb.mjs` vs new `verify-release.mjs` as verifier + runtime call path; registry in-repo vs separate repo; registry ownership split with DF-E2-01/03; does ADR-4 identity need resolving before `approvedBy[]` is load-bearing |
| `retrospective-validation-harness.md` (DF-E1-04) | draft / shaping | **Yes** — §7.3 item 10; trigger: signed E1 release candidate exists; impl planning blocked on data-source SPIKE | **Data-source SPIKE not yet run** (which corpus/partner/DUA); retention + deletion trigger; replay/version-pinning vs signed releases; adjudicator-≠-author mapping when "author" is a rule set; promote E0 dangerous-miss corpus into regression lane as-is? |
| `withdraw-rollback-machinery.md` (DF-E2-03) | draft / shaping | **No — E2** (§7.4 item 11); E1 only produces the registry it later attaches to | Withdrawal-confirmation authority + medium; rollback SLA pre-deployment; skip-multiple-withdrawn-versions; offline client withdrawal discovery (fail closed); drill as deterministic test vs live infra |

## E0 deferred items (impl plan triage table — the E1 backlog)

| ID | Cat | Item | Trigger for promotion |
|---|---|---|---|
| DF-E1-01 | prereq | Clinical review portal/workflow (L) | E1 plan approved + reviewer roles named |
| DF-E1-02 | prereq | CBC 12-angle live research op (Path-B hardening/adapters) | ADR-8 resolved + E1 plan approved |
| DF-E1-03 | prereq | Upstream `rf` validators (pediatric, exact-passage) — `rf` repo, not here | RFUP accepted upstream |
| DF-E1-04 | prereq | Retrospective validation harness (L) | Signed E1 release candidate exists |
| DF-E1-05 | design | FHIR/terminology emitters (L) | ADR-3 accepted |
| DF-E1-06 | design | Signed release + key custody | ADR-5 accepted |
| DF-E1-07 | tech-debt | Property/mutation/semantic-diff CI expansion | E1 rule-schema v2 migration begins |
| DF-E2-01/02/03 | prereq | Surveillance engine / prod monitoring / withdraw-rollback | E2 — out of this plan |
| DF-EXT-01 | policy | 7 RFUP upstream `rf` enhancements | External (`op story` → `agentic_meta_dev`), never tasks here |

**What E0 delivered (substrate E1 builds on):** deterministic `tools/rf-bundle-to-kb-pack/` converter
proven against RF-CBC-001; `modules/cbc_suite_v1/` package (4 rules, `index.js` delegating facts to
anemia; module.json `status:"unsigned-stub"`, `approvedBy:[]`); sidecars `evidence-assertions.json` /
`rule-provenance.json` / `authoring-decisions.yaml` + 4 new schemas wired into `validate-kb.mjs`;
evidence-registry unification; slice test corpus (positive/negative/boundary/missingness/
dangerous-miss); `release-manifest.unsigned.json` with P5-T5 canonical-serialization determinism proof
(the exact bytes ADR-5 signing composes over); id-level semantic diff (trivially "4 added" — E1's
second proposal round produces the first non-trivial diff); 8 proposed ADRs + 10 design-spec stubs.
Zero review UI, zero roster, zero signing, zero registry, zero retrospective artifacts.

## SPIKE-006 verdict (`docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md`)

NO-GO on cryptographic signing **stands** for the current single-maintainer, static-Pages anemia
deployment: browser-verifiable signing fails same-origin circularity; server-only signing rejected on
merits (signer = author = same GitHub account; Amendment 2). Instead: two-part digest
(`clinicalContentHash` + `governanceHash`, preimage extended to `ranges.js`/`facts.anemia.js` +
governance fields), fail-closed everywhere, status enum `unsigned-stub → integrity-recorded →
superseded/revoked`. Reopen trigger: a second independent release authority OR a deployed server-mode
consumer with a distinct trust boundary — not a calendar date. Council pass closed-with-caveats;
formal ARC re-review of the amended digest NOT performed.

## Conventions (from E0 PRD/impl plan — replicate for E1)

- **Category**: `infrastructure` → `docs/project_plans/PRDs/infrastructure/<slug>-v1.md` and
  `docs/project_plans/implementation_plans/infrastructure/<slug>-v1.md`. E0 slug:
  `evidence-foundry-buildout` (feature_slug) with `-v1` file suffix; natural E1 slug family:
  `evidence-foundry-e1` (worknotes dir already `evidence-foundry-e1-v1`).
- **Plan shape**: schema_version 2 frontmatter (prd_ref/plan_ref/spike_ref/adr_refs/
  deferred_items_spec_refs/wave_plan…); parent plan <800 lines + phase detail files under
  `<slug>-v1/phase-N-M-<name>.md`; binding "Decisions & OQ Resolutions" section; Deferred Items
  Triage Table (`Item ID | Category | Reason Deferred | Trigger for Promotion | Target Spec Path`,
  categories research|prereq|design|tech-debt|policy); lazy findings doc.
- **Phase Summary table**: `| Phase | Title | Estimate | Target Subagent(s) | Model(s) | Provider |
  Profile | Notes |`; task IDs `P<n>-T<m>`; gates `P<n>-GATE1` (task-completion-validator) +
  `P<n>-GATE2` (karen milestone) at milestones; E0 total 42 pts / 7 phases.
- **Tests**: flat `tests/ef-<module>-<category>.test.mjs` / `ef-converter-<aspect>.test.mjs` (npm
  glob `tests/*.test.mjs` never touched). `build/` gitignored; committed goldens in `tests/fixtures/`.
- **Worknotes**: `.claude/worknotes/<feature>/` (context.md, decisions-block.md, path-mapping.md);
  design specs: `doc_type: design_spec`, maturity `idea|shaping|committed`, frontmatter
  `open_questions` + `explored_alternatives`.

## Risks & unknowns the orchestrator must decide on

1. **Scope boundary**: one Tier 3 plan for the named triad (review workflow + signed release +
   retrospective validation ≈ §7.3 items 5–6, 10–11) vs full 11-item E1. E0's decisions block says
   each L item warrants its own plan; items 1–4/7/8/9 have independent blockers (ADR-8, upstream `rf`,
   ontology work). Recommend: scope the triad, declare siblings out-of-scope with explicit triggers.
2. **ADR ratification**: all 8 ADRs are `proposed`; DF-E1-06 trigger is literally "ADR-5 accepted",
   DF-E1-01 seeds from ADR-4, DF-E1-04 from ADR-4+ADR-6. Who accepts them, and is acceptance a phase-0
   task of this plan or a human pre-gate? (Repo posture: acceptance is a human edit, not AI.)
3. **SPIKE-006 vs ADR-5 tension**: SPIKE-006 NO-GOes cryptographic signing for the anemia browser KB
   (signer=author custody problem) while ADR-5 recommends Ed25519 for the EF release manifest. Scopes
   differ (browser microsite vs preclinical release candidate) but the single-custodian objection
   applies to both. E1 planning must reconcile explicitly — e.g., adopt Ed25519 for the EF release
   path while honoring the browser-deployment NO-GO, and say who the signer is such that signature ≠
   author self-attestation.
4. **Human dependencies are the critical path**: two named credentialed clinical reviewers + lab
   reviewer + adjudicator + release authorizer (ADR-4 roster), a signing custodian + ceremony (ADR-5),
   and a data partner DUA (ADR-6) are all human/organizational, non-delegable, and currently
   nonexistent. Project memory: evidence grounding is already owner-blocked on attestation/licensing;
   `clinicalApprovers[]`/`approvedBy[]` are schema-forced human-only (D-4). Plan must model these as
   external gates, not tasks.
5. **Data-source SPIKE (unrun)** blocks DF-E1-04 implementation planning; can run parallel to signing
   work. Also decide retention/deletion, replay pinning, adjudication-of-rule-output semantics.
6. **Two review-record models exist**: wave0's `schemas/review-record.schema.json` (5-state,
   2-reviewer, conflict-arbiter) vs ADR-4's five-role file model (reviewer1/reviewer2/lab/adjudication/
   release-auth). Unify or map — do not ship parallel clinical-governance schemas.
7. **Rule-schema v2 trigger**: does full CBC Suite authoring (§7.3 item 7, even if out of this plan)
   count as "multi-module scale"? If v2 starts, DF-E1-07 retriggers. Decide the trigger reading now.
8. **Sequencing**: signed release candidate (DF-E1-06) precedes retrospective validation (DF-E1-04
   trigger); review workflow (DF-E1-01 v1 files) precedes signing (`approvedBy[]` must be load-bearing
   per ADR-4 before release authorization means anything). Natural order: review workflow → signing/
   registry → retrospective harness, with the data-source SPIKE in parallel.
9. **Honesty guardrails carry forward**: signed preclinical candidate stays inactive (silent-mode +
   human-factors gates are post-E1); nothing E1 ships may be described as clinically validated;
   rights-restricted passages stay hash+selector unless positively cleared (OQ-2 precedent).

Point-estimate signal: the triad ≈ 3 workstreams (+2 prerequisite lanes: ADR ratification/human
roster, data-source SPIKE); E0 anchor was 42 pts across 7 phases for one M-heavy increment — two of
the triad's items are ledger-sized **L** (each "warranting its own plan"), so expect ≥E0 total if
scoped as one plan, or a 3-plan program.
