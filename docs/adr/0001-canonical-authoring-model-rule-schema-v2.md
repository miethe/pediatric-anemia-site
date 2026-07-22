---
status: proposed
date: 2026-07-21
deciders: ["evidence-foundry-buildout plan owner", "pending: named clinical/technical reviewers"]
unblocks: ["DF-E1-07"]
supersedes: []
superseded_by: []
---

# ADR-0001: Canonical CDS Authoring Model and Rule Schema v2 Migration

## Status

**Proposed** — 2026-07-21. Not accepted. No implementation decision follows from this document until
a human reviewer moves status to `accepted` in a separate, reviewable edit.

## Context

`docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` (`02 §8.5` item 1, `02 §8.1`
row "Is current strict rule schema extended now?") flags an open design question: as the
`rf`-bundle-to-KB-pack converter (EF-WP0) starts emitting rule proposals, how much of a proposed rule's
metadata is allowed to live directly on the runtime rule object versus a separate authoring/provenance
record, and when (if ever) does the runtime rule schema itself need a versioned (`v2`) redesign?

Two facts on the ground make this more than a hypothetical:

1. **The schema has already been extended in place once.** `schemas/rule.schema.json` originally
   permitted exactly five fields — `id`, `category`, `when`, `evidence`, `output` — matching what `02
   §4.13` still describes as "the current schema." A prior initiative (EP-4/FR-WP4-01, landed before
   this plan) added 9 more REQUIRED governance fields directly into the same schema under
   `additionalProperties: false`: `version`, `effectiveDate`, `retireDate`, `owner`, `safetyClass`,
   `requiredTestCaseIds`, `changeRationale`, `sourcePassageId`, `clinicalApprovers`. The schema now
   requires 14 fields, not 5. This is a stale-path hazard already called out at the plan level (this
   plan's decisions block §2): `02 §4.13`'s worked example and its "not allowed in `rules.json`" column
   (listing `version`/`effectiveDate`/`owner`/`clinicalApprovers`/`testIds` as sidecar-only) no longer
   match the shipped schema — those exact fields are now required, non-null (or explicitly
   null/empty-typed), first-class keys on every rule.
2. **The richer per-rule provenance `02 §4.13` describes — `rfClaimIds`, `evidenceAssertionIds`,
   `missingness`, `localProfileRequirement`, `testIds` (as fixture-path lists), `reviewStatus` — is not
   yet in the runtime schema and is not proposed to be.** This plan's own OQ-3 resolution (parent plan
   `Decisions & OQ Resolutions`) already commits `rule-provenance.json` to land at
   `modules/cbc_suite_v1/rule-provenance.json`, joined to `rules.json` by rule `id`, as a **separate
   file**, not as additional schema keys.

So the "is the schema extended now" question the 02 doc poses is really three separable questions this
ADR must answer without conflating them:

- Governance metadata cross-cutting every rule regardless of module or authoring source (already
  answered by precedent: extend-in-place, `additionalProperties: false`).
- Converter-specific per-rule authoring/traceability metadata (in flight this plan: sidecar file,
  joined by `id`).
- A structured DSL/schema **v2** — richer condition expressions, typed facts, explicit precedence
  tiers replacing the current ordinal `points` field, multi-module schema variance — which neither
  extend-in-place nor a sidecar addresses, because it changes the shape of `when`/`output` themselves,
  not just which side-metadata exists.

This ADR formalizes the boundary between those three, states the E0 default, and names the trigger for
when v2 stops being optional.

## Decision

Adopt a **three-tier model**, not a single either/or choice:

1. **Cross-cutting governance metadata** (who owns a rule, when it took effect, whether it is retired,
   which safety class it carries, whether a credentialed clinician has approved it) stays **extended
   in place** on the runtime `schemas/rule.schema.json`, exactly as EP-4 already did. This tier changes
   rarely, applies uniformly across every module, and benefits from `additionalProperties: false`
   closing off silent omission — the same reasoning that motivated EP-4 continues to apply.
2. **Converter-specific per-rule authoring and traceability metadata** (source claim IDs, exact-passage
   assertion IDs, missingness/local-profile requirements, generated test-case linkage beyond the
   governance layer's `requiredTestCaseIds` list, draft/reviewed status of the authoring decision
   itself) is **sidecar-only** for E0: `modules/<module_id>/rule-provenance.json`, joined to
   `rules.json` by `id`, plus the `authoring-decisions.yaml`/`.json` join record (`02 §4.12`). The
   runtime schema is **not** extended for this tier. This matches `02 §8.1`'s own recommended default
   ("use canonical authoring record + provenance sidecar for E0") and is what Phase 3 of this plan
   (`P3-T3`, OQ-3) is already building.
3. **A deliberate rule-schema v2 migration** — restructuring `when`/`output` themselves (e.g.,
   explicit precedence tiers to replace the non-probabilistic ordinal `points` field per `02 §8.1`'s
   scoring-governance row, typed-fact references instead of ad hoc `fact` strings, module-scoped
   condition vocabularies) is **deferred, not started, and not designed by this ADR**. It is named
   here only as the tier this ADR recommends triggering **before multi-module E1 scale**, i.e., before
   a second real module (beyond the `cbc_suite_v1` vertical slice) begins authoring rules against the
   same schema. E0 ships zero v2 schema changes.

**Recommended default** (restated from `02 §8.1`, adopted verbatim): *use the canonical authoring
record and provenance sidecar for E0; design v2 before multi-module E1 scale.* This is Option 2 below,
combined with the precedent already set for governance metadata (a variant of Option 1, already
shipped, not reopened).

## Considered Alternatives

1. **Extend v1 schema in place for everything** (add converter-provenance fields — `rfClaimIds`,
   `evidenceAssertionIds`, `missingness`, etc. — directly to `schemas/rule.schema.json`, following the
   EP-4 precedent all the way through).
   - Pros: single source of truth per rule; no join-by-`id` fragility; `additionalProperties: false`
     continues to guarantee nothing is silently dropped.
   - Cons: couples the *runtime* rule object (loaded by `src/ruleEngine.js` on every assessment) to
     *authoring-time* provenance that the engine never reads; grows the schema every time a new
     converter feature needs a new traceability field, with no natural stopping point short of a full
     redesign; the fields `02 §4.13` names for this tier are converter/authoring concepts (claim IDs,
     assertion IDs, review status) that do not belong in the hot-path object the engine evaluates.
   - Decision: **rejected** for the converter-provenance tier; **already accepted** (by prior
     precedent, not reopened here) for the governance tier.

2. **Sidecar-only for the converter-provenance tier, governance fields stay in schema** (the hybrid
   this ADR selects).
   - Pros: matches what is already true today (EP-4 governance fields live in-schema; nothing
     reverses that) while keeping the fast-moving, converter-specific traceability surface in a file
     the engine never loads; matches the OQ-3 ruling already made and Phase 3 work already scoped;
     lets `rule-provenance.json`'s shape evolve per-converter-iteration without a schema-breaking change.
   - Cons: two files must agree by `id`; a rule present in `rules.json` with no matching
     `rule-provenance.json` entry is a valid-but-incomplete state that needs its own validation rule
     (not part of this ADR — an implementation detail for Phase 3/`scripts/validate-kb.mjs`).
   - Decision: **selected** — recommended default.

3. **Deliberate rule-schema v2 migration now** (design and cut over to a new schema version before E0
   ships, folding in structured facts, precedence tiers, and full authoring/provenance fields as
   first-class schema concepts from the start).
   - Pros: avoids a second migration later; a single schema version to reason about across all future
     modules.
   - Cons: E0's scope is explicitly a deterministic vertical-slice wire-up over the *existing* engine
     (`src/ruleEngine.js` reads the current 14-field schema) — a v2 migration would require engine
     changes, re-validation of all 91 existing `modules/anemia/rules.json` rules against a new schema,
     and is exactly the scope-creep risk this plan's own risk register already flags ("Rule-schema v2
     scope creep into E0" — Med/Low, mitigated by "E0 emits strict current schema... v2 lives in ADR-1
     and its deferred spec only"). No multi-module pressure exists yet to justify the cost — only one
     module (`cbc_suite_v1`, itself a slice of `anemia`'s fact shape by OQ-1's cross-module delegation)
     is in play.
   - Decision: **rejected for E0**, recommended as the trigger for a **future** ADR/plan once a second
     genuinely independent module begins rule authoring (see Consequences).

## Consequences

### Positive

- No engine change, no re-validation of the existing 91 `modules/anemia/rules.json` rules, and no
  schema-version fork are required to ship E0 — the converter's `propose` verb (`02 §4.6`) emits rules
  that validate against the schema exactly as it exists today.
- The governance-vs-provenance boundary this ADR draws gives Phase 3 (`P3-T3` and related tasks) an
  unambiguous target: anything that belongs on every rule regardless of authoring path is a schema
  field; anything specific to how a rule was authored/traced back to `rf` evidence is a sidecar field.
- Names an explicit, checkable trigger ("before multi-module E1 scale," i.e., before a second
  independently-authored module) rather than leaving the v2 question open-ended.

### Negative

- Two files (`rules.json`, `rule-provenance.json`) must be kept in join-consistent state by `id`;
  Phase 3/validator work must add an explicit check that every rule has a corresponding provenance
  entry (not committed to by this ADR, but implied as a follow-on validator task).
- The non-probabilistic ordinal `points` scoring field (`02 §8.1`'s "how is rule scoring governed?"
  row) remains unchanged for E0 — its own recommended default ("keep visible ordinal points
  temporarily... consider explicit precedence tiers in schema v2") is deferred into this same v2 tier,
  meaning the scoring-semantics question stays open until v2 is actually designed.

### Neutral

- This ADR does not itself author the v2 schema, a migration plan, or a timeline beyond "before
  multi-module E1 scale" — that design work is explicitly out of scope here and is one of the E1
  deferred-item design specs this plan produces in Phase 7.

## Unblocks

- **DF-E1-07** — Property/mutation/semantic-diff CI expansion (deferred-items triage table, this
  plan's parent doc) needs a stable schema target to design property/mutation tests against; this
  ADR's three-tier boundary is that stable target for E0/E1 (governance fields and `when`/`output`
  shape are stable; provenance sidecar shape is expected to iterate without touching the tested
  runtime schema). DF-E1-07's own trigger for promotion is explicitly "E1 rule-schema v2 migration
  begins" — i.e., DF-E1-07's design-spec work is scoped against whichever tier this ADR leaves stable,
  and is retriggered if/when the v2 tier this ADR defers is actually designed.

## Implementation Notes (non-binding until accepted)

- No code changes ship from this ADR. It is a design-record artifact only (`docs/adr/`), per this
  plan's Phase 6 scope (`P6-T1`, docs-only, no `modules/**`/`tools/**`/`src/**` touches).
- If accepted, the next actions would be: (a) a `scripts/validate-kb.mjs` check that every
  `rules.json` entry has a matching `rule-provenance.json` entry by `id` (Phase 3 territory, not this
  ADR); (b) authoring the DF-E1-07 design spec (Phase 7, `P7-T9`) explicitly scoped against this ADR's
  tier boundary, per that task's own instruction not to re-propose what E0 already ships.

## References

- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` §8.5 item 1 ("ADR: canonical
  CDS authoring model and rule schema v2 migration"), §8.1 row "Is current strict rule schema extended
  now?", §4.12 (authoring decision record), §4.13 (rule proposal to current `rules.json`, including the
  stale five-field description and the provenance-sidecar field table).
- `schemas/rule.schema.json` — current 14-required-field schema (5 original + 9 EP-4 governance fields).
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md` — Decisions &
  OQ Resolutions §, OQ-3 (evidence-assertions/rule-provenance landing path) and OQ-7 (schema files:
  `evidence-assertions`, `rule-provenance`, `authoring-decisions`, `release-manifest`); Risk Mitigation
  table row "Rule-schema v2 scope creep into E0."
- `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-6-7-adrs-docs.md`
  — task row `P6-T1` (this ADR's acceptance criteria).
- Deferred-items triage table (parent plan) — `DF-E1-07` row.

## Metadata

- **Author**: documentation-writer (Phase 6, `P6-T1`), evidence-foundry-buildout plan.
- **Reviewers**: pending — no named credentialed clinical or technical reviewer has approved this
  ADR; `status: proposed` reflects that literally, not just formally.
- **Affected components**: `schemas/rule.schema.json` (referenced, not modified), future
  `modules/cbc_suite_v1/rule-provenance.json` (Phase 3), any future rule-schema v2 design spec.
- **Risk level**: Medium — the decision governs future schema evolution discipline; getting the
  governance/provenance boundary wrong risks either schema bloat (Option 1 applied wholesale) or an
  unenforceable join (Option 2 without a validator check).
