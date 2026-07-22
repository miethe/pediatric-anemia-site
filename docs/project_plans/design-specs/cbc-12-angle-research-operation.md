---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry Buildout: Full CBC 12-Angle Live Research Operation (DF-E1-02)"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-22
feature_slug: "evidence-foundry-buildout"
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
adr_refs:
  - docs/adr/0008-pathb-hardening-vs-native-adapter.md
problem_statement: "The CBC Suite's remaining modules need a resourced, repeatable discovery lane to run the full 12-angle CBC research operation (02 §3.8), but E0 shipped only a single hand-seeded, pre-verified module and zero live discovery."
open_questions:
  - "Does hardening Path-B (parameterizing RF/repo/TMP/stamp paths, adding run-date tests) fully close the 02 §6.2 gap register rows it targets, or does scheduled/unattended E1 surveillance surface further gaps not visible in a single manually-triggered E0 run?"
  - "What is the actual per-angle cost/duration when Path-B runs all 12 angles for one module, and does it fit the E1 planning window's assumed budget?"
  - "At what measured gap (per ADR-8's decision) does native-adapter installation become justified, and who owns that measurement?"
explored_alternatives:
  - "Harden Path-B (.claude/workflows/rf-run-execute.js), defer native adapters — ADR-8 recommended default"
  - "Install one native rf adapter (e.g. gpt_researcher or paperqa2) first, defer Path-B hardening"
  - "Harden Path-B and install a native adapter in the same E1 pass (dual-track)"
  - "Defer the discovery-lane decision entirely to E1 planning (rejected by ADR-8)"
---

# Full CBC 12-Angle Live Research Operation (DF-E1-02)

## Problem / Context

`evidence-foundry-buildout-v1` (E0) proved the deterministic tail end-to-end — `RF-CBC-001`'s
pre-verified, hand-seeded `rf` bundle converts through `tools/rf-bundle-to-kb-pack/` into a 4-rule
`cbc_suite_v1` vertical slice with zero live discovery and zero network/LLM calls at runtime. It did
not, and was never scoped to, run the full research operation that
`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` (`02`) §3.8 defines for the
CBC Suite's remaining angles:

1. Scope, age partitions, local pediatric reference intervals, analyzer/method effects, unit
   normalization.
2. Anemia definition, morphology, RDW, reticulocyte response.
3. Iron deficiency, ferritin in inflammation, Ret-He, iron studies, nonresponse.
4. Alpha/beta thalassemia and hemoglobinopathy triage without ancestry stereotyping.
5. Hemolysis, DAT, smear findings, membrane/enzyme disorders, transfusion confounding.
6. Neutropenia, leukocytosis/lymphocytosis, eosinophilia, infection-related CBC patterns.
7. Thrombocytopenia/thrombocytosis and combined cytopenia patterns.
8. Pancytopenia, blasts, marrow failure/infiltration, dangerous-miss safety exits.
9. Lead, nutritional, renal, inflammatory, endocrine, medication, and mixed etiologies.
10. Adaptive questions, referral readiness, longitudinal follow-up, minimum safe dataset.
11. Clinical validation, subgroup/analyzer/site analysis, human factors.
12. Regulatory classification, content rights, FHIR/terminology, privacy/security, quality-system
    implications.

Running all 12 angles for even one additional module requires a discovery lane that can be triggered
repeatedly, at scale, without a human hand-seeding every source — something E0 explicitly did not
build (`Item Triage Table` row `DF-E1-02`; decisions block §1, "scope decision — E0 only, E1
deferred"). `ADR-0008` (`docs/adr/0008-pathb-hardening-vs-native-adapter.md`, `status: proposed`) was
authored in Phase 6 precisely to resolve *which* discovery lane E1 should build the 12-angle operation
on top of, so that E1 planning does not open with an unresolved architectural question. This spec
records what that lane's operation looks like once ADR-8 is accepted, without itself authorizing any
implementation — it remains `maturity: shaping` because ADR-8's decision is not yet `accepted` and the
per-angle operational envelope (cost, duration, source-count acceptance) has not been measured.

## Current State (what E0 actually shipped)

- One module, `cbc_suite_v1`, seeded from one pre-verified `rf` run (`RF-CBC-001`, part of the 7/7
  verified `rf-handoff` bundles) — a fully manual, single-shot discovery event, not a repeatable
  operation.
- `tools/rf-bundle-to-kb-pack/` consumes an already-verified bundle; it has no role in *producing*
  bundles and performs zero network or LLM calls (`02` §4.1 "Determinism" row).
- Zero of the four `02` §3.4 discovery lanes exist in a state ready for repeated, scheduled use:
  native `rf swarm run` has 0/6 adapters installed (`02` §6.2); the Claude Path-B workflow
  (`.claude/workflows/rf-run-execute.js`) is the one *live, human-verified* lane but has hard-coded
  RF/repo/TMP/stamp paths (`02` §6.2; ADR-8 Context); the LAN API scaffold only reaches
  capture→triage→plan, not discovery.
- No angle beyond the module-1 seed has been run against any lane — angles 2-12 above are entirely
  unaddressed by any artifact in this repository today.

## Design Sketch (seeded from ADR-8's recommendation)

ADR-8's recommended default — **harden Path-B first; defer native adapter installation** — is the
substrate this spec assumes. At a shaping level (not yet a committed design):

1. **Parameterize `.claude/workflows/rf-run-execute.js`** per ADR-8 option 1: RF binary path, repo
   root, TMP directory, and date/stamp become explicit config/args rather than machine-specific
   constants; add run-date and path-injection tests. This directly remediates the three gap-register
   rows ADR-8 names ("Path-B hard-coded paths/stamp," "Full web discovery outside core CLI,"
   "0/6 live adapters" as the *not-yet-needed* alternative).
2. **Run the 12-angle operation per module, not per rule.** Each of `02` §3.8's 12 angles becomes one
   scoped Path-B invocation (or a batched sub-run) against the target module's `module.yaml`,
   producing per-angle source cards, extractions, and claims that roll up into one
   `evidence_bundle.yaml` per `02` §3.9's acceptance criteria — the same bundle shape E0's converter
   already consumes, so no change to `tools/rf-bundle-to-kb-pack/`'s input contract is implied.
3. **Preserve the deterministic tail unchanged.** Path-B remains an orchestrator around the existing
   `rf` verbs (`extract` / `claim-map` / `synthesize` / `verify`); it does not become a new discovery
   mechanism that bypasses `rf verify`'s exit-code routing (`02` §5.2). This keeps the "no generative
   model in the clinical decision path" guardrail intact — Path-B's LLM-assisted scouting stays
   upstream of the verified, deterministic bundle the converter reads.
4. **Acceptance before handoff.** Each angle's contribution to the bundle must still clear `02` §3.9's
   full checklist (exact passage + portability classification per threshold claim; dangerous
   exceptions represented or explicitly declined; unresolved conflicts left mixed/contradicted, not
   silently resolved) before any angle's claims become converter-eligible.

None of the above is committed. It depends on ADR-8 moving from `proposed` to `accepted`, and on an
E1 plan sizing the actual per-angle engineering cost (ADR-8 estimates parameterization + tests at
roughly 2-4 engineer-days, but running all 12 angles end-to-end for a full module has not been
measured against that estimate).

## Promotion Trigger

Per the Deferred Items Triage Table (`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`,
row `DF-E1-02`): **ADR-8 resolved (moved to `accepted`) + E1 plan approved.**

## E1 State (evidence-foundry-e1-v1)

`evidence-foundry-e1-v1` — the plan that immediately followed this one — did not touch this
workstream. `ADR-0008` remains `status: proposed`, not `accepted`
(`docs/adr/0008-pathb-hardening-vs-native-adapter.md`), so the Promotion Trigger above is still
unmet. E1 shipped a disjoint triad instead — the review-record workflow, signed-release machinery,
and retrospective-validation harness (`tools/review-record/`, `tools/release-sign/`,
`tools/retro-validate/`) — and made zero changes to `.claude/workflows/rf-run-execute.js`, ran zero
additional Path-B angles, and added zero new modules; the module count stayed at two
(`modules/anemia/`, `modules/cbc_suite_v1/`) throughout E1. Nothing in the Current State or Design
Sketch sections above is stale as a result of E1 landing.

## Open Questions

See frontmatter `open_questions`. In addition, the SPIKE-adjacent question of whether angle 11
("clinical validation, subgroup/analyzer/site analysis, human factors") can be run through the same
Path-B lane at all, or requires the separate retrospective-validation-harness track
(`docs/project_plans/design-specs/retrospective-validation-harness.md`, `DF-E1-04`), is not resolved by
this spec and should be confirmed during E1 planning rather than assumed either way.
