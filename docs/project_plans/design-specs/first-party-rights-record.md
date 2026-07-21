---
doc_type: design_spec
title: "First-Party Rights Record"
status: draft
maturity: idea
created: 2026-07-21
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
---

# First-Party Rights Record (DEF-R4)

## Problem / Context

`schemas/rights/rights_record.schema.json` (the vendored Research Foundry Rights Governance Spec
v1.0 `rights_record` schema, plus its EP-R0 declared amendment layer,
`schemas/rights/VENDORING.md`, handoff §9.5) has no way to describe **first-party** content:
`source_id` is required with `minLength: 3`, `record_scope` has no first-party member, and
`overall_status` has no `OWNED`/`FIRST_PARTY`/`NOT_APPLICABLE` value. This is a real structural gap
the vendored spec itself has not resolved (handoff §9.5) — not something this feature invents or
papers over. **No schema field was added or relaxed to work around this** in EP-R0; the amendment
layer records the gap explicitly rather than forcing `derived_synthesis` items through a rights
record shape that doesn't fit them.

The handoff document (§4) defines `derived_synthesis` — a first-party claim authored over two or
more input sources — as a capability this platform's evidence taxonomy should eventually support.
A `derived_synthesis` in a clinical context is a clinical claim: it requires the same human
attestation discipline as any other clinical assertion (D6), but it is not "third-party source
content" in the sense `rights_record` models, so binding it into that model would misrepresent what
it is. This feature's EP-R3 (taxonomy) instead models first-party authorship on the evidence item
itself (`EPR3-T7`) rather than forcing a `rights_record` to fit — that is a **workaround at the item
level**, not a resolution of the underlying schema gap, which is what this design spec tracks.

## Current State (what this feature actually shipped)

- `schemas/rights/VENDORING.md`'s declared-amendments section records handoff §9.5 by name: "recorded,
  via the root `description`, that `rights_record` cannot describe first-party content... No schema
  field was added or relaxed to work around this. Consequence for this plan: `derived_synthesis`
  evidence items get no `rights_record` in this feature."
- `schemas/rights/rights_record.schema.json`'s root `description` carries this same statement
  in-schema, so a reader of the file itself (not only `VENDORING.md`) sees the gap.
- EP-R3 (`EPR3-T7`, per the amendment note) models first-party authorship directly on the evidence
  item rather than attempting a `rights_record` shape it does not fit — that is a scoped, item-level
  answer to "how does this feature avoid the gap," not an answer to "how should the spec eventually
  represent first-party rights."
- The vendored `rights_extension.schema.json` remains byte-identical to its vendored checksum —
  untouched by this task; handoff §9.1 (which also touches this file) is separately owned by
  `EPR3-T2`, not this design spec.

## Design Sketch

At an idea-stage level, resolving this properly would need one of two shapes:

1. **Extend `rights_record`** with a first-party `record_scope` member and a corresponding
   `overall_status` value (e.g. `OWNED` / `FIRST_PARTY` / `NOT_APPLICABLE`) — the handoff's own
   suggested fix (§9.5). This keeps a single rights-record model for everything but requires
   Research Foundry (the upstream owner of this schema, per the D4 two-repo boundary rule) to accept
   the extension, since this repo vendors rather than forks the spec's authority.
2. **An explicit sibling model** for first-party rights — a `first_party_authorship_record` (or
   similar) that captures who authored a `derived_synthesis`, what inputs it draws on (each with its
   own third-party `rights_record` via the normal path), and what attestation covers it — kept
   structurally distinct from `rights_record` rather than overloading one schema to describe two
   different kinds of provenance.

Either path needs Research Foundry's answer to OQ-4 (does RF accept the handoff spec as-authored, or
counter-propose a different entity model) before this repo commits to extending or forking the
vendored schema — extending unilaterally would drift this repo's copy from RF's authoritative shape,
which the D4 two-repo boundary rule exists to prevent.

None of this is committed. Which of the two shapes above RF prefers is the open question that gates
everything else here.

## Promotion Trigger

Research Foundry answers OQ-4 with a first-party record scope (or an explicit sibling-model
decision).

## Open Questions

- Does RF extend `rights_record` itself, or does it publish a separate first-party schema this repo
  would vendor the same way it vendors the other five?
- Until RF answers, does EP-R3's item-level workaround (`EPR3-T7`) need any further hardening, or is
  it a stable enough interim shape to build a `derived_synthesis` review/attestation workflow
  against?
- Does a first-party record need its own join into `rights/rights-ledger.json`, or does the D4
  join-ledger boundary need a distinct identifier type for "first-party evidence item" the way it
  already accommodates `evidence_source_id`?
- How does this interact with FR-WP4-06 (the clean-room brief generator may prepare
  `derived_synthesis` candidates but never mark one authoritative) — does a first-party rights
  record become part of what makes a candidate "ready for human attestation," or is that orthogonal?
