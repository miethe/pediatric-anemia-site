---
schema_version: 2
doc_type: design_spec
title: "Evidence Foundry Buildout: FHIR/terminology emitters (DF-E1-05)"
status: draft
maturity: shaping
created: 2026-07-21
updated: 2026-07-22
feature_slug: evidence-foundry-buildout
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
problem_statement: "There is no mechanism to render module content (rules, candidates, evidence) as FHIR/terminology artifacts, because the terminology-mapping ownership question this rendering depends on is not yet resolved to status: accepted."
open_questions:
  - "Does ADR-3 (docs/adr/0003-terminology-local-lab-profile-ownership.md) get accepted as-is, or does E1 planning revise its split-ownership recommendation before this spec can move past shaping?"
  - "What is the emitted FHIR artifact shape for CBC Suite content specifically — Observation-bound CDS Hooks card, a Questionnaire (per 02 §4's adaptive-questionnaire row), or a rule-pack-to-PlanDefinition/Library projection — and does one emitter need to cover all three, or are these separate E1 build items?"
  - "How does an emitter refuse to render when the bound schemas/terminology-profile.schema.json profile is not profileClass: site_asserted / activation-gate-eligible, versus when it is a synthetic_example — is 'refuse silently' or 'render with an explicit non-clinical banner' the correct fail-closed behavior?"
  - "Does the emitter consume evidence-assertions.json/rule-provenance.json directly, or only the committed modules/<id>/{rules,candidates,evidence}.json — i.e., does provenance metadata travel into the FHIR artifact (e.g., as an extension) or stop at the CDS repo boundary?"
explored_alternatives:
  - "Option A — rf/converter owns terminology mapping (auto-derive LOINC/UCUM/SNOMED codes from claim text or bundle metadata). Rejected in ADR-3: contradicts 02 §6.4's won't-build list (\"a converter that guesses LOINC/UCUM codes from labels\") and the CLAUDE.md no-invented-thresholds guardrail extended to codes."
  - "Option B — downstream terminology/integration service owns mapping outright; local ranges are pure runtime config with no Evidence Foundry claims layer at all. Rejected as the sole answer in ADR-3: under-uses the Evidence Foundry for the general clinical rationale a local mapping/range decision rests on, leaving a future site-profile author with no evidence-linked justification to cite."
  - "Option C (ADR-3's recommended default, adopted here as this spec's starting point) — split ownership: general claims stay in the Evidence Foundry (evidence.json / evidence-assertions.json); site-specific mapping and range values are signed, owner-attested configuration under the already-shipped schemas/terminology-profile.schema.json / schemas/reference-range.schema.json / docs/clinical/local-profile-charter-contract.md mechanism. The emitter renders against that existing contract rather than inventing a parallel one."
---

# Evidence Foundry Buildout: FHIR/terminology emitters (DF-E1-05)

**Deferred-items triage row**: `DF-E1-05` (category `design`) in
`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`'s Deferred
Items Triage Table. **Promotion trigger**: `docs/adr/0003-terminology-local-lab-profile-ownership.md`
(ADR-3) reaching `status: accepted`. **Effort class**: L (per `02 §6.1`'s Interoperability/build-table
rows: "Mapping skeleton in E0, verified profiles later").

## Problem statement

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §1.3 names FHIR, CDS Hooks,
SMART-on-FHIR, LOINC, SNOMED CT, and UCUM mapping ownership as an explicit *downstream integration
service* responsibility — not `rf`'s, and (per this plan's own scope) not the E0
`rf-bundle-to-kb-pack` converter's either. E0 ships zero terminology-mapping surface by design:
neither `schemas/evidence-assertions.schema.json` nor `schemas/rule-provenance.schema.json` carries a
LOINC/UCUM/SNOMED field, and neither `modules/anemia/` nor `modules/cbc_suite_v1/` declares a
code-system mapping. `docs/architecture.md` §8 already sketches a FHIR integration proposal at the
platform level, but nothing today converts a module's committed `rules.json`/`candidates.json`/
`evidence.json` content into a FHIR-shaped artifact (Observation-bound CDS Hooks card, Questionnaire,
or equivalent), and nothing enforces that such a conversion only happens against site-asserted,
signed terminology configuration rather than invented or inferred codes.

This is a `design`-category deferral, not a `prereq`-category one: the blocking dependency is a
decision (ADR-3), not a missing artifact or a missing team. It cannot become a `shaping`→`build`-ready
spec until ADR-3 is accepted, because the emitter's entire mapping-consumption contract is downstream
of that decision.

## Current state (what exists to build against)

Nothing in this plan's scope emits FHIR content. What already exists, shipped by a separate feature in
this repository (`arc-clinical-council-adoption-v1`), and which ADR-3 designates as the ownership
boundary this future emitter must target rather than duplicate:

- `docs/clinical/local-profile-charter-contract.md` — the full local-profile activation-gate charter:
  a `site_asserted` profile requires a named laboratory director, a named informatics owner
  (`authority.informaticsOwnerName`), a signed attestation, and an activation gate that is
  unreachable without real owner-supplied identity. `synthetic_example` profiles are structurally
  forbidden (by `schemas/terminology-profile.schema.json`'s top-level `if`/`then`/`else`) from being
  mistaken for an approved site profile.
- `schemas/terminology-profile.schema.json` — `codeSystems[]` (code system + version, per-purpose
  `analyte`/`specimen`/`unit`), `localMappings[]` (local code ↔ standard code, each with its own
  `mappingVersion`/`mappingAuthority`, `equivalence` state, and a fail-closed unmapped-code default),
  a `resultStatusPolicy` bound to a named FHIR `resourceType` (`Observation` only in this phase, with
  `preliminary`/`corrected`/`amended`/`entered-in-error`/`cancelled`/`unknown` treated as first-class,
  non-decision-grade-by-default lifecycle states), and `observationRequirements` (effective/issued
  time, specimen, unit, staleness policy).
- `schemas/reference-range.schema.json` — per-analyte, per-age-band, per-sex reference intervals and
  critical values, unit-coded per analyte, bound to an exact candidate digest.
- `docs/architecture.md` §8's FHIR integration proposal — names the FHIR adapter as pulling reviewed
  labs/demographics and writing a non-authoritative CDS result; notes FHIR mapping "requires local
  code-system governance (LOINC/SNOMED CT/UCUM) and should reject unit mismatches rather than silently
  convert ambiguous values" — consistent with, and not superseded by, this spec.
- `docs/adr/0003-terminology-local-lab-profile-ownership.md` — the ownership decision (currently
  `proposed`) this spec is seeded from. Its Option C (split ownership) is this spec's working
  assumption; if E1 planning revises that recommendation before acceptance, this spec's design sketch
  below must be re-checked against the revision.

Nothing in E0's scope (this plan) reads, writes, or validates against
`schemas/terminology-profile.schema.json` or `schemas/reference-range.schema.json` — they are wholly
owned by the other feature. This spec's job is to describe how a future emitter *consumes* those
existing contracts, not to modify them.

## Design sketch (idea/shaping level — not yet build-ready)

1. **Emitter is a pure projection, never a mapping authority.** Per ADR-3's Decision item 1, the
   emitter may only consume an already-`asserted` `localMappings[]` entry from a
   `schemas/terminology-profile.schema.json`-conformant, activation-gate-eligible profile. It must
   never derive, guess, or auto-assign a LOINC/UCUM/SNOMED code from a `rules.json`/`candidates.json`/
   `evidence.json` label or claim string — extending `02 §6.4`'s won't-build line to this layer
   explicitly, matching ADR-3's own extension of that guardrail.
2. **Input contract**: a committed module package (`modules/<id>/{module.json,rules.json,
   candidates.json,evidence.json}`, e.g. `modules/cbc_suite_v1/`) plus a resolved, activation-gate-
   passing `schemas/terminology-profile.schema.json` instance and its bound
   `schemas/reference-range.schema.json` instance for the target site. The emitter fails closed (no
   output, not a best-effort partial artifact) if the terminology profile's `boundCandidate.assertion`
   does not match the module content it is asked to render against, or if any code the module content
   needs is `UNMAPPED` in `localMappings[]`.
3. **Candidate output shapes** (open question above — not yet decided which, or whether more than one
   is needed):
   - A CDS Hooks card / FHIR `PlanDefinition`+`Library` projection of a module's `candidates.json`
     ranked-pattern output, each recommendation carrying an evidence-linked rationale reference back
     to `evidence.json`/`evidence-assertions.json` (not embedding the passage text itself — the
     rights-restricted-fallback locator discipline from `02 §4.10` / ADR-2 continues to apply).
   - A FHIR `Questionnaire` projection for the module's missing-data prompts, matching `02 §4`'s
     adaptive-questionnaire row ("Own tri-state semantics, stable question IDs, enableWhen, data
     source/timestamp... FHIR Questionnaire, and clinician wording" as a downstream-owned
     responsibility, not `rf`'s).
   - Neither shape emits a numeric threshold, reference range, or unit that did not come directly from
     a signed `schemas/reference-range.schema.json` instance — the emitter never re-derives a
     threshold from evidence prose.
4. **Fail-closed lifecycle behavior**: any input `Observation` the emitter's runtime counterpart would
   eventually consume (out of scope for this spec — that is the platform-level FHIR adapter in
   `docs/architecture.md` §8, not this emitter) must respect
   `resultStatusPolicy.blockingStates`/`acceptedForDecision` — `preliminary` is never decision-grade,
   and `corrected`/`amended` values require intact status lineage. This spec's emitter is upstream of
   that runtime concern (it produces the artifact, not the patient-facing evaluation), but its output
   shape must carry enough status/lifecycle metadata that a downstream consumer can enforce it.
5. **No signing coupling assumed, but noted as a dependency risk**: `DF-E1-06` (signed release + key
   custody) and this item are both `L`-effort, ADR-seeded deferrals; whether a FHIR artifact must be
   emitted only from a *signed* module release (vs. an unsigned proposal, for internal preview) is an
   open question this spec inherits from DF-E1-06's own resolution, not one it resolves here.

None of the above is committed. The central blocker remains ADR-3's acceptance — this design sketch
is the direction, not the contract.

## Promotion trigger

`docs/adr/0003-terminology-local-lab-profile-ownership.md` reaching `status: accepted` (per this
plan's Deferred Items Triage Table, `DF-E1-05` row). Promotion also requires the E1 plan to have
scoped which of the candidate output shapes in the Design Sketch (§3) are in E1's actual build list —
this spec does not itself commit to building all of them.

## E1 state (evidence-foundry-e1-v1)

`evidence-foundry-e1-v1` shipped none of the `schemas/terminology-profile.schema.json` or
`schemas/reference-range.schema.json` consumption a future emitter would need — its three new CLIs
(`tools/review-record/`, `tools/release-sign/`, `tools/retro-validate/`) are entirely orthogonal to
terminology mapping. `ADR-0003` remains `status: proposed`
(`docs/adr/0003-terminology-local-lab-profile-ownership.md`), so the Promotion Trigger below is
still unmet and this spec stays at `maturity: shaping`. E1's own PRD explicitly names FHIR/
terminology mappings as out of scope (§7.3 item 9 / `DF-E1-05`), confirming the boundary this spec
already assumed rather than narrowing it further.

## Open questions

See frontmatter `open_questions`. Restated for readability:

1. Does ADR-3 get accepted as-is, or does E1 planning revise the split-ownership recommendation first?
2. Which emitted FHIR artifact shape(s) are actually in scope for E1 — CDS Hooks card, Questionnaire,
   PlanDefinition/Library, or some combination — and is that one build item or several?
3. Does the emitter refuse silently or render with an explicit non-clinical banner when the bound
   terminology profile is `synthetic_example` rather than `site_asserted`?
4. Does provenance metadata (`evidence-assertions.json`/`rule-provenance.json`) travel into the
   emitted FHIR artifact (e.g., as a FHIR extension), or stop at the CDS repository boundary?
