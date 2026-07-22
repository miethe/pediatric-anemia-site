---
schema_version: 2
doc_type: design_spec
title: "Rule-Authoring Workflow per Module (DF-E1-M1)"
status: draft
maturity: idea
created: 2026-07-22
feature_slug: multi-bundle-conversion-e1
prd_ref: docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md
---

# Rule-Authoring Workflow per Module (DF-E1-M1)

## Problem / Context

`tools/rf-bundle-to-kb-pack/`'s `propose` verb refuses, by design (FR-14, `02 §4.12`), to infer
clinical Boolean logic from `rf` claim prose. It will only draft a rule or candidate for a claim
that a matching, approved `modules/<module_id>/authoring-decisions.yaml` record already names
(`basis.rf_claim_ids` / `basis.exact_assertion_ids`). Today exactly **one** such file exists in the
repository — `modules/cbc_suite_v1/authoring-decisions.yaml`, 4 decision records, all scoped to
`RF-CBC-001` claims (the E0 vertical slice, authored as a single P3-T1 task deliverable in the
`evidence-foundry-buildout` program). It is a hand-written artifact, not the output of any
repeatable procedure, named reviewer role, or tooling — there is no answer anywhere in this
repository today to "given a set of verified `rf` claims, how does a human actually produce the
next approved decision record."

This is precisely the gap that leaves this pass's own conversion incomplete for 3 of the 4 bundles
it processes, and even for part of the 4th:

- `rf-ev-001` → `modules/anemia/`, `rf-kid-001` → `modules/kidney_suite_v1/`, and
  `rf-gro-002` → `modules/growth_suite_v1/` each halt at `inspect` with `DecisionsNotFoundError` —
  no `authoring-decisions.yaml` exists for any of the three modules at all
  (`tools/rf-bundle-to-kb-pack/lib/batch.mjs:26-40`). Per the binding provenance framing this plan's
  Phase 6/7 documentation carries: these three modules' evidence-layer artifacts
  (`evidence.json`, `evidence-assertions.json`, `unresolved.json`) were instead produced by
  bespoke, module-specific evidence-projection steps — **never** the converter's `propose` verb —
  precisely because no decision record exists to let `propose` run past its evidence-emit path for
  them. Only `rf-cbc-002` → `cbc_suite_v1` completes the converter's `inspect → verify → propose`
  pipeline end to end.
- Even for `cbc_suite_v1`, the one module with an approved decisions file, **`RF-CBC-002`'s own
  claims have zero matching decision records** — the existing 4 decisions cover only `RF-CBC-001`.
  `propose` reaching `cbc_suite_v1` for `RF-CBC-002` still emits only evidence-layer output for
  those claims (FR-9), not new rules, for the identical underlying reason: no one has authored a
  decision record for them yet.

`ADR-0001` (`docs/adr/0001-canonical-authoring-model-rule-schema-v2.md`, `status: proposed`, not yet
accepted) settles **where** a decision record's cross-cutting boundary sits — governance metadata
stays on the runtime `rule.schema.json`; converter-specific authoring/traceability metadata
(`rf_claim_ids`, `exact_assertion_ids`, `reasoning`, `review.*`) stays sidecar-only in
`authoring-decisions.yaml`, joined to `rules.json` by `id`. It does **not** say **how** a human
produces one of those sidecar records: no named authoring role, no review sequencing, no tooling
bridging a verified `rf` claim ledger to a reviewed, approved decision. This spec exists to sketch
that workflow at an idea level — it cannot be committed to until `ADR-0001` is accepted, since any
change to that ADR's tier boundary could reshape what a decision record's target shape even is.

## Current State (what exists today)

- **Schema**: `schemas/authoring-decisions.schema.json` requires `schemaVersion`, `moduleId`,
  `rfProvenance` (`rfRunId`/`rfBundleId`/`fixturePath`), and a `decisions[]` array (`minItems: 0` —
  a module package legitimately has zero decisions until a human authors one). Each decision
  requires `decision_id`, `module_id`, `status` (closed enum: `approved_for_rule_draft` \|
  `rejected` \| `withdrawn` — no in-progress/pending-review state distinct from approved, see Open
  Questions), `basis`, `conflicts`, `clinical_effect`, and `review`.
- **The one shipped example**: `modules/cbc_suite_v1/authoring-decisions.yaml`'s 4 records were
  authored by the executing agent as the P3-T1 task's own deliverable, citing real `RF-CBC-001`
  claim IDs and exact-passage assertion IDs, each with `status: approved_for_rule_draft` — while
  every `review.*` field (`evidence_methodologist`, `clinician_1`, `clinician_2`,
  `laboratory_medicine`) still literally reads `pending`. The file's own header comment is explicit
  that `approved_for_rule_draft` means "ready to inform a drafted rule proposal," never clinical
  sign-off. No named human has reviewed any of the 4 records to date.
- **Existence-gated validation**: `scripts/validate-kb.mjs`'s `validateAuthoringDecisions()` only
  runs against modules that carry the file at all — its absence (true today for `anemia`,
  `kidney_suite_v1`, `growth_suite_v1`) is not itself flagged as an error, which is why those three
  modules validate cleanly with zero decisions and zero rules.
- **Converter behavior given this state**: `batch.mjs`'s literal, hand-enumerated `BATCH_PAIRS`
  halts at `inspect`'s `loader.loadBundle()` step with `DecisionsNotFoundError` for any module
  lacking the file — `rf-ev-001`, `rf-kid-001`, `rf-gro-002` all hit this today. `rf-cbc-002` →
  `cbc_suite_v1` clears `inspect`/`verify` (the file exists) and reaches `propose`, but `propose`'s
  FR-9 evidence-only-emit path still applies to every `RF-CBC-002` claim, since none is named by any
  decision record.
- **Provenance of the evidence these decisions would draw on, for the 3 gapped modules**: as
  recorded in `.claude/findings/multi-bundle-conversion-e1-findings.md` ("Unreproducible-provenance
  gap"), the `evidence-assertions.json`/`evidence.json`/`unresolved.json` files that exist today for
  `anemia`, `kidney_suite_v1`, and `growth_suite_v1` were produced by bespoke, largely uncommitted,
  one-off generator scripts — not the converter, and (for 2 of the 3) not reproducible from any
  script currently in the repository. A future decision-authoring workflow for these modules would
  be citing `exact_assertion_ids` out of files with a materially weaker reproducibility story than
  `cbc_suite_v1`'s own `backfill-cbc-002-evidence.mjs`-backed evidence layer — a fact any decision-
  authoring tooling for these 3 modules should surface, not silently assume away.

## Design Sketch (idea-level, non-binding)

None of the below is committed. It sketches the shape a repeatable, per-module authoring workflow
could take, following `cbc_suite_v1`'s one existing record as the only real precedent, so that a
future `committed`-maturity spec (or an implementation plan) has a concrete starting point rather
than a blank page.

1. **Candidate surfacing.** A human reviewer works from a module's `evidence-assertions.json` and
   `unresolved.json` (the artifacts every one of this pass's 4 bundles already produces, whichever
   pathway produced them) to identify a claim, or small cluster of related claims, worth promoting
   toward a candidate rule or pattern — the same selection judgment already implicit in how
   `cbc_suite_v1`'s 4 `RF-CBC-001`-era decisions were originally scoped (one per FR-16 slice role).
2. **Draft authoring.** A named human author drafts a candidate decision record — `decision_id`,
   `basis.rf_claim_ids`/`exact_assertion_ids`/`reasoning`, `conflicts`, `clinical_effect` — following
   the shape `cbc_suite_v1`'s existing file already establishes. This step is explicitly **not**
   automatable by the converter or any generative model (FR-14/CLAUDE.md's "no AI-published rule
   changes" guardrail): the reasoning field is a human clinical-evidence synthesis, not a Boolean
   inference the converter is permitted to perform.
3. **Named review sequencing.** The schema's 4 `review.*` roles
   (`evidence_methodologist`/`clinician_1`/`clinician_2`/`laboratory_medicine`) need an actual
   sequencing and identity model — who holds each role, in what order they sign, and what a
   rejection at any step does to the draft. This overlaps directly with Deferred Item DF-E1-M2
   (`docs/project_plans/design-specs/clinical-review-portal-intake-e1-artifacts.md`) and with
   `docs/adr/0004-clinical-approval-identity-adjudication.md`'s adjudication-identity model; this
   spec does not re-design either, only flags that a real authoring workflow needs both resolved,
   not just the file schema.
4. **Approval-state honesty gap.** The schema's `status` enum offers only
   `approved_for_rule_draft` \| `rejected` \| `withdrawn` — no genuine "drafted, review in progress"
   state distinct from "approved." `cbc_suite_v1`'s shipped example already exposes this gap: all 4
   records read `approved_for_rule_draft` while every `review.*` field simultaneously reads
   `pending`, which is honest only because the file's own header comment explains the distinction in
   prose. A real multi-author, multi-reviewer workflow likely needs the schema itself to distinguish
   "drafted, awaiting review" from "review complete, ready to inform a rule draft" rather than
   relying on a comment to carry that distinction — an implementation detail for whichever future
   pass designs the schema change, not decided here.
5. **Landing.** Once reviewed, the record is committed to `modules/<module_id>/authoring-
   decisions.yaml` (creating the file for `anemia`/`kidney_suite_v1`/`growth_suite_v1`, or appending
   to `cbc_suite_v1`'s for `RF-CBC-002` claims). The next `batch`/`propose` run against that module
   then clears `inspect`'s `DecisionsNotFoundError` (for the 3 currently-gapped modules) or picks up
   the newly-named claims (for `cbc_suite_v1`), and can draft the corresponding rule/candidate
   proposal — which then still needs its own independent clinical review and signed release before
   any rule ships live, per CLAUDE.md's hard guardrails. Authoring a decision record is a necessary
   precondition for a drafted rule proposal; it is never itself clinical sign-off, and this workflow
   does not shortcut or substitute for the separate release-gate review this repository already
   requires.
6. **Per-module repeatability.** The above must apply independently to each of `anemia`,
   `kidney_suite_v1`, `growth_suite_v1` (currently zero decisions, zero rules, converter halts at
   `inspect`), and to `RF-CBC-002`'s claims specifically within `cbc_suite_v1` (converter reaches
   `propose`, but still emits evidence-only output for those claims) — this is not a single one-time
   fix but a workflow that needs to run once per module, and again per new bundle merged into an
   already-populated module.

## Promotion Trigger

`ADR-0001` accepted + an E1 rule-authoring iteration approved (per the parent plan's Deferred Items
Triage Table, row `DF-E1-M1`). Until then this stays at `maturity: idea` — no implementation plan
should be scoped against this sketch.

## Open Questions

- **Named roles.** Who actually holds the `evidence_methodologist`/`clinician_1`/`clinician_2`/
  `laboratory_medicine` reviewer identities in practice — the same open question `ADR-0004`
  (clinical-approval identity adjudication) and DF-E1-M2's future clinical-review-portal design must
  also resolve? Is this spec's workflow the review-portal's actual intake path, or a separate,
  earlier authoring step that only feeds the portal?
- **Schema honesty gap.** Does the `status` enum need a real pending/in-review value distinct from
  `approved_for_rule_draft`, given the existing shipped example already relies on prose (the file's
  header comment) rather than a schema-enforced state to convey "not actually reviewed yet"?
- **Batching granularity.** Is a decision record authored one claim-cluster at a time (as
  `cbc_suite_v1`'s 4 FR-16-slice-scoped records were), or can/should a single authoring pass batch
  an entire bundle's eligible claims at once?
- **Evidence-provenance dependency for the 3 gapped modules.** Given the unreproducible-provenance
  finding (`.claude/findings/multi-bundle-conversion-e1-findings.md`) that `anemia`/
  `kidney_suite_v1`/`growth_suite_v1`'s evidence-layer files have no committed producing script
  today, should this workflow require closing that gap (or DF-E1-M1 itself, per that finding's
  remediation option 2) before decision-authoring begins for those modules, so a decision's cited
  `exact_assertion_ids` trace back to a regenerable file rather than a one-off, uncommitted
  artifact?
- **Anemia's dual-pipeline interaction.** For `modules/anemia/` specifically, does a decision
  record's `basis` need to be able to cite the pre-existing EP-3/EP-4-derived `evidence.json`
  content, not only this pass's `evidence-assertions.json` — and how does that interact with
  Deferred Item DF-E1-M3's still-open backfill-reconciliation question
  (`docs/project_plans/design-specs/anemia-backfill-reconciliation-procedure.md`)?
- **Relationship to rule-schema v2.** If a future rule-schema v2 migration (the tier `ADR-0001`
  explicitly defers, triggered "before multi-module E1 scale") changes `when`/`output` shape, does
  an already-authored, already-approved decision record under today's schema need re-authoring, or
  does only the *rule draft* it informs need to be redone against the new schema?
