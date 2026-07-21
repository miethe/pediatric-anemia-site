# ADR-0003: Terminology and Local Laboratory Profile Ownership

**Status**: proposed — 2026-07-21
**Deciders**: Evidence Foundry buildout plan (Phase 6, task P6-T3), for confirmation before E1 planning
**Unblocks**: DF-E1-05 (FHIR/terminology emitters — deferred to the E1 plan; design-spec stub at
`docs/project_plans/design-specs/fhir-terminology-emitters.md`, authored in Phase 7 seeded from this ADR)

## Context

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §8.1 leaves two related
questions open, both load-bearing for any future FHIR/terminology emitter (`02 §1.3`: "Owns FHIR, CDS
Hooks, SMART, LOINC, SNOMED CT, and UCUM mappings" is explicitly named a *downstream integration
service* responsibility, not `rf`'s and not the converter's):

| Question (02 §8.1) | Options named in 02 | Recommended default in 02 |
|---|---|---|
| Who owns LOINC/UCUM/SNOMED mapping? | `rf`; converter; integration service. | Clinical terminology service/team downstream; converter only accepts reviewed mappings/status. |
| Are local-range profiles `rf` claims or config? | Evidence claims; runtime config; both. | General need/constraints are claims; actual site ranges/methods are signed tenant configuration with lab approval. |

This E0 buildout (the plan this ADR belongs to) deliberately ships **zero** terminology-mapping
surface: `schemas/evidence-assertions.schema.json` and `schemas/rule-provenance.schema.json` carry no
LOINC/UCUM/SNOMED fields, and neither `modules/anemia/` nor the new `modules/cbc_suite_v1/` module
package declares a code-system mapping. That is confirmed correct scope for E0 — this ADR exists
*because* E1's FHIR/terminology emitters (DF-E1-05) cannot be designed until the ownership question is
resolved, not because E0 needs an answer to ship.

**Critical context this ADR must not ignore or duplicate**: a separate, already-shipped feature in
this same repository (`arc-clinical-council-adoption-v1`) has already built a fail-closed mechanism
for exactly the *local laboratory profile* half of this question:

- `docs/clinical/local-profile-charter-contract.md` — the full charter: a `site_asserted` local
  profile requires a named laboratory director, a named informatics owner
  (`authority.informaticsOwnerName`), signed attestation, and passes an activation gate that is
  unreachable without real owner-supplied identity. `synthetic_example` profiles (the only kind that
  exist in this repo today) are structurally forbidden from being mistaken for an approved site
  profile.
- `schemas/reference-range.schema.json` — per-analyte, per-age-band, per-sex reference intervals and
  critical values, unit-coded per analyte (not per profile), bound to an exact candidate digest.
- `schemas/terminology-profile.schema.json` — `localMappings[]` (local code ↔ standard code, each
  with its own version and named authority), `codeSystems[]` pinned to exact versions, and a
  `resultStatusPolicy` bound to a specific FHIR resource type.

That mechanism already answers "are local-range profiles config?" for the *local lab profile* side:
yes, config — signed, named, owner-attested, fail-closed, and never inferred. This ADR's job is
narrower than re-deciding that: it is to (a) confirm the Evidence Foundry / `rf`-sourced pipeline
never becomes a second, competing source of local-mapping or local-range truth, and (b) state where
the *general clinical claims* half of the question (what mapping or range consideration a body of
evidence supports, in the abstract) is allowed to live.

## Decision

**Recommended default: Option C (split ownership, matching 02 §8.1's own recommended defaults for
both rows).**

1. **Terminology mapping (LOINC/UCUM/SNOMED) ownership**: a downstream clinical terminology /
   informatics function owns the mapping — never `rf`, never the `rf-bundle-to-kb-pack` converter.
   The converter and any future FHIR/terminology emitter may only **consume** an already-reviewed
   mapping (a `localMappings[]` entry per `schemas/terminology-profile.schema.json`, asserted by a
   named `authority.informaticsOwnerName`); neither component may derive, guess, or auto-assign a
   code from a claim's prose. This directly extends `02 §6.4`'s existing won't-build line ("a
   converter that guesses LOINC/UCUM codes from labels") to the terminology-profile layer explicitly.
2. **Local-range-profile ownership**: general need/constraints (e.g., "iron indices are
   analyzer-method-sensitive and require local calibration awareness") may be captured as an
   Evidence Foundry claim (`modules/<id>/evidence.json` / `evidence-assertions.json`) with its own
   passage locator, same as any other clinical claim. The **actual applicable numeric range or
   method binding for a given site** is never an Evidence Foundry claim and is never asserted by the
   converter — it is exclusively the signed, owner-attested `site_asserted` local profile mechanism
   already defined in `docs/clinical/local-profile-charter-contract.md`. No future task in this
   program may add a code path that lets a converted/derived rule threshold substitute for, or
   bypass, that activation gate.
3. Consequently, **DF-E1-05's FHIR/terminology emitter design must target the existing
   `schemas/terminology-profile.schema.json` contract as its ownership boundary**, not invent a
   parallel one: the emitter's job is to *render* module content (rules, candidates, evidence)
   against terminology and reference-range data that has already cleared the local-profile-charter
   activation gate — it does not itself resolve or assert mappings.

## Options considered

1. **Option A — `rf`/converter owns terminology mapping.** The converter auto-derives or infers
   LOINC/UCUM/SNOMED codes and/or local reference ranges from claim text or bundle metadata.
   - Rejected. Directly contradicts `02 §6.4`'s won't-build list and the CLAUDE.md "no invented
     thresholds" guardrail extended to codes: a code mapping asserted without a named, accountable
     owner is exactly the kind of manufactured clinical content this program's guardrails exist to
     prevent. It would also duplicate, and could silently diverge from, the already-shipped
     `local-profile-charter-contract.md` mechanism.

2. **Option B — downstream terminology/integration service owns mapping outright; local ranges are
   pure runtime config with no claims layer at all.** Terminology and local-range ownership are both
   fully external; the Evidence Foundry pipeline never touches either, even at the claims layer.
   - Rejected as the sole answer, though closest to 02's recommended default for the mapping
     question alone. It under-uses the Evidence Foundry for the *general* clinical rationale a local
     range or mapping decision might rest on (e.g., why a method-dependent cutoff needs local
     calibration at all) — that general rationale is exactly what an evidence claim is for, and
     losing it means a future site-profile author has no evidence-linked justification to cite when
     completing their local-profile charter's `provenance.source` / `provenance.locator` fields.

3. **Option C — split ownership: general claims stay in the Evidence Foundry; site-specific mapping
   and range values are signed, owner-attested configuration under the existing local-profile
   mechanism (recommended default).**
   - Matches `02 §8.1`'s own recommended defaults verbatim for both rows.
   - Reuses, rather than duplicates or contradicts, the already-shipped
     `local-profile-charter-contract.md` / `schemas/reference-range.schema.json` /
     `schemas/terminology-profile.schema.json` mechanism.
   - Preserves a clean non-overlapping boundary: Evidence Foundry claims never carry a
     `localMappings[]`-shaped or site-specific reference-interval-shaped payload; the local-profile
     mechanism never accepts an `rf` bundle or converter output as an activation input.

## Consequences

- **Positive**: DF-E1-05 (FHIR/terminology emitters) has a concrete, already-partially-built target
  contract to design against instead of a green field; no new terminology-ownership mechanism needs
  to be invented in E1.
- **Positive**: the split keeps the "no invented thresholds" and "no AI-published rule changes"
  guardrails intact across both the evidence-claim layer and the local-profile layer — neither layer
  can silently produce a numeric or coded value the other treats as authoritative.
- **Negative**: E1's FHIR/terminology emitter work is now coupled to a second feature's schemas
  (`schemas/terminology-profile.schema.json`, `schemas/reference-range.schema.json`) that this plan
  does not own or modify; a breaking change to those schemas by that feature's future work becomes an
  upstream dependency risk for DF-E1-05 and must be tracked as such when that spec is planned.
- **Neutral**: this ADR makes no change to any file this plan is permitted to touch beyond itself —
  `modules/anemia/`, `modules/cbc_suite_v1/`, and the local-profile-charter schemas are all
  unaffected by adopting this decision.

## Status discipline

This ADR stays at `status: proposed`. It is not accepted here — acceptance requires the E1 planning
process to confirm the recommendation still holds against whatever state
`local-profile-charter-contract.md` (and its owner-held OQ-3 resolution) is in when E1 is scoped, and
requires human sign-off, not an autonomous agent decision.
