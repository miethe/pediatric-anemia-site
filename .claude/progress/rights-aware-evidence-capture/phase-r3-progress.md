---
type: progress
schema_version: 2
doc_type: progress
prd: rights-aware-evidence-capture
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
execution_model: sequential
phase: EP-R3
created: '2026-07-21'
title: 'EP-R3: Evidence Taxonomy & Archive Capture (WP3)'
status: in_progress
started: '2026-07-21'
completed: null
commit_refs: []
pr_refs: []
overall_progress: 25
completion_estimate: on-track
total_tasks: 9
completed_tasks: 2
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- Explore
model_usage:
  primary: opus
  external: []
tasks:
- id: EPR3-T1
  description: 'Negative invariant — no third-party full text, LANDS FIRST (FR-WP3-09, AC-WP3-NEGATIVE,
    D1, critical risk): tests/rights-negative-invariant.test.mjs performs a positive structural
    check over the working tree — no source document, reproduced table, figure, image, or brand
    asset in any directory; no captured field carries a verbatim span beyond the passageFidelity
    policy already enforced. Use Explore read-only first to enumerate existing candidate spans.
    Ships BEFORE EPR3-T5/T6 write anything. Residual gap R-1 recorded in the test header as open.'
  status: completed
  assigned_to:
  - general-purpose
  - Explore
  dependencies:
  - EP-R2 (merged)
  estimated_effort: 1.0 pt
  priority: critical
  assigned_model: opus
  model_effort: high
- id: EPR3-T2
  description: 'Three axis fields on the item record (FR-WP3-01/02/03, D2): add three required
    fields to every evidence item — evidence_item_type (closed enum: observed_finding, reference_interval_value,
    equation_or_method, guideline_recommendation, instrument_or_questionnaire, bibliographic_metadata,
    derived_synthesis), judgment_basis (default unassessed), and rights_component_class (valued
    from the spec''s component_decisions.component_type enum, authoritative over the §5.1 prose
    table per handoff §9.2). Per handoff §9.1 these are first-class fields in schemas/evidence.schema.json,
    NOT extensions.rights properties. No $ref or import of an RF-owned schema (FR-WP3-11).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR3-T1
  estimated_effort: 1.25 pts
  priority: critical
  assigned_model: opus
  model_effort: high
- id: EPR3-T3
  description: 'Axis-separation test, AC-WP3-AXES (FR-WP3-03): tests/rights-axis-separation.test.mjs
    constructs each pairwise combination of evidence_item_type x rights_component_class x passage
    status x clearance_status, asserts all are representable, and asserts no code path infers
    one axis from another. Includes the AAP case explicitly — a passage may be source-supported
    AND contract-restricted simultaneously. src/evidence.js''s isBindableAsSourceSupported is
    asserted to read only the epistemic axis.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR3-T2
  estimated_effort: 0.75 pts
  priority: high
  assigned_model: opus
  model_effort: high
- id: EPR3-T4
  description: 'Structured locator model + not_captured[] (FR-WP3-04, FR-WP3-06, D1): every item
    carries a structured locator with each applicable component individually addressable — source,
    edition/version, section, table, row, column, assay/method, population/scope — plus retrieval
    date. Free-text locators are unacceptable where a structured component applies. Every item
    also carries not_captured[] naming what was deliberately not stored (prose, table structure,
    figures, layout) and why. An incomplete locator records its missing components explicitly.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR3-T3
  estimated_effort: 1.25 pts
  priority: high
  assigned_model: opus
  model_effort: high
- id: EPR3-T5
  description: 'Atomic backfill of 41 passages: backfill all 41 existing passage records across
    the 6 sources with the three axis fields, a structured locator, and a not_captured[] entry,
    in the same commit as the schema change. Mechanical where the value is unambiguous; flagged
    for review where the evidence_item_type assignment is a judgment call. Every record ships
    judgment_basis: unassessed. R-P2 resilience: partial locator capture is representable and
    visible; silent partial capture fails.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR3-T4
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: opus
  model_effort: high
- id: EPR3-T6
  description: 'Numerics re-capture as per-value atoms (FR-WP3-05, AC-WP3-NUMERICS): resolve each
    numeric-omission passage to exactly one of two states — (a) per-value typed atoms, each independently
    worded, with a complete structured locator, an evidence_item_type, a rights_component_class,
    and judgment_basis: unassessed; or (b) an explicit not-captured record stating why. Scope
    is the union of the passages flagged omits-source-numerics in modules/anemia/evidence.json
    (WHO2024_HB#ev_001, WHO2024_HB#ev_004, BSH2020_G6PD#ev_006) and the HIGH numeric-omission
    findings in docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md (additionally AAP2026_IDA#ev_002).
    Use Explore read-only to confirm the enumeration before editing. No reproduced table in any form.'
  status: not_started
  assigned_to:
  - general-purpose
  - Explore
  dependencies:
  - EPR3-T5
  estimated_effort: 1.5 pts
  priority: critical
  assigned_model: opus
  model_effort: high
- id: EPR3-T7
  description: 'derived_synthesis — candidate-only, attribution from day one (FR-WP3-07, D3, D6):
    ship derived_synthesis as a first-class item type with an ordered list of contributing item
    IDs, a synthesis rationale, and an authorship record. It exists ONLY in a candidate state;
    the authoritative state is structurally unrepresentable. Per handoff §9.5, rights_record cannot
    describe first-party content, so a derived_synthesis item gets NO rights record in this feature
    — record the gap as DEF-R4 in the schema description and schemas/rights/VENDORING.md.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR3-T5
  estimated_effort: 0.75 pts
  priority: critical
  assigned_model: opus
  model_effort: high
- id: EPR3-T8
  description: 'guideline_recommendation — the fact, not the prose (FR-WP3-08, D2 "captured, not
    avoided"): guideline_recommendation items capture the fact of the recommendation — named body
    as a structured field, the recommendation restated independently, scope/population, locator
    — and never the recommendation''s prose. A verbatim span fails EPR3-T1''s invariant.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR3-T6
  estimated_effort: 0.25 pts
  priority: high
  assigned_model: opus
  model_effort: high
- id: EPR3-T9
  description: 'Standing invariants: REG_002_CLEARED, RF decoupling, zero clinical change (FR-WP3-10/11/12):
    assert scripts/validate-kb.mjs''s REG_002_CLEARED === false after this phase and that passageFidelity
    stays constrained to paraphrase/withheld; assert no artifact imports or $refs an RF-owned
    schema at runtime (OQ-4 open); prove zero clinical change by golden-fixture equivalence across
    6 examples with npm run coverage:rules still reporting 91.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR3-T7
  - EPR3-T8
  estimated_effort: 0.25 pts
  priority: high
  assigned_model: opus
  model_effort: high
parallelization:
  batch_1:
  - EPR3-T1
  batch_2:
  - EPR3-T2
  batch_3:
  - EPR3-T3
  batch_4:
  - EPR3-T4
  batch_5:
  - EPR3-T5
  batch_6:
  - EPR3-T6
  - EPR3-T7
  batch_7:
  - EPR3-T8
  batch_8:
  - EPR3-T9
  critical_path:
  - EPR3-T1
  - EPR3-T2
  - EPR3-T3
  - EPR3-T4
  - EPR3-T5
  - EPR3-T6
  - EPR3-T8
  - EPR3-T9
  estimated_total_time: 8.0 pts (critical path)
blockers: []
success_criteria:
- id: SC-1
  description: Negative-invariant test landed and green BEFORE any capture commit (EPR3-T1, AC-WP3-NEGATIVE);
    residual gap R-1 recorded as open, not implied closed
  status: not_started
- id: SC-2
  description: 'All 41 passages carry evidence_item_type, judgment_basis: unassessed, rights_component_class
    (EPR3-T2/T5)'
  status: not_started
- id: SC-3
  description: Taxonomy fields are first-class, NOT on extensions.rights (handoff §9.1); rights_component_class
    values come from the schema enum, not the §5.1 prose table (handoff §9.2)
  status: not_started
- id: SC-4
  description: Every pairwise axis combination is representable; no axis inferred from another
    (EPR3-T3, AC-WP3-AXES)
  status: not_started
- id: SC-5
  description: Structured locators are component-addressable; not_captured[] is populated and rationalized
    (EPR3-T4)
  status: not_started
- id: SC-6
  description: Every in-scope numeric-omission passage resolves to atoms OR an explicit not-captured
    record (EPR3-T6)
  status: not_started
- id: SC-7
  description: No reproduced table in any form; REG_002_CLEARED stays false (EPR3-T6, EPR3-T9)
  status: not_started
- id: SC-8
  description: derived_synthesis is candidate-only with modelled attribution; authoritative state
    unrepresentable; no forced rights record; handoff §9.5 gap recorded as DEF-R4 (EPR3-T7)
  status: not_started
- id: SC-9
  description: No runtime $ref/import to an RF-owned schema (EPR3-T9, OQ-4 open)
  status: not_started
- id: SC-10
  description: Zero clearances, zero attestations, zero grounded rules written by this phase
  status: not_started
- id: SC-11
  description: Golden-fixture zero-diff across 6 examples; npm run check green
  status: not_started
- id: SC-12
  description: task-completion-validator sign-off
  status: not_started
files_modified:
- schemas/evidence.schema.json
- modules/anemia/evidence.json
- scripts/validate-rights.mjs
- schemas/rights/VENDORING.md
- tests/rights-negative-invariant.test.mjs
- tests/rights-axis-separation.test.mjs
progress: 0
updated: '2026-07-21'
---

# rights-aware-evidence-capture - Phase EP-R3: Evidence Taxonomy & Archive Capture

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/rights-aware-evidence-capture/phase-r3-progress.md -t EPR3-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

The heart of the feature and its largest payoff (WP3): install the three orthogonal evidence-item axes
(`evidence_item_type` × `judgment_basis` × `rights_component_class`), exhaustive **structured**
locators with `not_captured[]`, `derived_synthesis` as a candidate-only first-class type with
attribution modelled from day one, and re-capture of the numerics that rights-avoidance paraphrasing
stripped — as **per-value atoms, never a reproduced table**.

**Phase-level entry criteria**: EP-R2 **MERGED** (not merely complete) — this phase branches from
EP-R2's merge commit on `schemas/evidence.schema.json`. EP-R0 substrate present. RF-HANDOFF §9
conflict list read, in particular §9.1 and §9.5.

**Wave 3, alone.** **Split rule (decisions block §5):** if this phase exceeds 10 pts during execution,
split it at the **taxonomy / re-capture seam** — EPR3-T1..T5 vs. EPR3-T6..T9 — rather than compressing
the re-capture.

---

## Implementation Notes

### Architectural Decisions

- **Ordering constraint inside the phase**: EPR3-T1 (negative invariant) lands **first**, before any
  task that writes captured content. Git history is unrecoverable; prevention is the only control.
- EP-R3 is the **second and final** owner of `schemas/evidence.schema.json` in this feature. It layers
  *item*-level axis fields onto EP-R2's *source*-level fields and must not re-litigate them. A needed
  change to EP-R2's source fields is an escalation, not a local edit.
- **Handoff §9.1**: the taxonomy does **not** ride `extensions.rights` — `rights_extension` is
  `additionalProperties: false` and requires a `clearance_status`/`release_gate` pair it cannot carry
  at capture time. The axes are first-class fields in this repo's own schema.
- **Handoff §9.5**: `rights_record` cannot describe first-party content, so `derived_synthesis` items
  get **no** rights record here. The gap is recorded as DEF-R4 rather than forced into a misfitting
  record.
- **D1**: the archive is provenance, not text. What was deliberately not stored is recorded explicitly
  in `not_captured[]`, with a rationale.

### Patterns and Best Practices

- Use `Explore` (read-only) in EPR3-T1 and EPR3-T6 to enumerate flagged passages and candidate
  verbatim spans **before** any edit — enumeration precedes mutation.
- Every captured numeric is the source's *reported* value, transcribed at a recorded locator; none is
  authored, adjusted, or interpolated (`CLAUDE.md`: **no invented thresholds**).
- Axis separation is enforced by construction: separate schema fields, plus a test that fails on a
  fixture where `rights_component_class` is *computed from* `evidence_item_type`.
- Do **not** introduce a `verbatim_excerpt_allowed`-style field duplicating `passageFidelity` — two
  fields that can disagree is a fail-open.

### Known Gotchas

- The authoritative `npm run check` composition lives in `package.json`, **not** `CLAUDE.md` (stale
  until EPR5-T5 lands): `test && validate && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`.
- No task may write a `CLEARED_*` status, an attestation, `clinicalApprovers[]`, `approvedBy[]`, or an
  authoritative `derived_synthesis`. Ship the plumbing and the fails-closed test, never the value.
- `json-schema-lite` silently ignores `format: "uri"` — use `pattern`.
- Date-dependent gates take `--as-of`/env, never `Date.now()` (byte-identical determinism).
- The legal axis (`overall_status`) lives on the rights record, joined via the ledger — not on the
  evidence item. Item-level axes are `evidence_item_type`, `judgment_basis`, `rights_component_class`.
- **Every record ships `judgment_basis: unassessed`.** OQ-1 (measured vs. judged per threshold family)
  routes to counsel; a fixture setting any other value without a human-attested reference must fail.
- The re-capture is the single highest-risk surface in the feature: restricted source text entering
  the repo "for the archive" is unrecoverable. Per-value atoms with locators, never a reproduced
  table; the omitted table structure goes in `not_captured[]`.
- `REG_002_CLEARED` stays `false` and `passageFidelity` stays constrained to `paraphrase`/`withheld` —
  this phase does not clear REG-002.
- `package.json` is untouched (EP-R0 barrier). `scripts/validate-kb.mjs` is not restructured here —
  new item-level checks go into `scripts/validate-rights.mjs`.
- Residual gap **R-1** (prohibited-excerpt detection is not deterministic) is **open, not closed**, and
  must be stated as such in the invariant test's own header comment.

### Development Setup

No new dependencies. Model is **opus** at effort `high` for the whole phase — taxonomy design judgment
plus evidence-sensitive numerics re-capture. `Explore` runs `sonnet`, read-only.

---

## Completion Notes

_(Fill in when phase is complete: invariant-test landing SHA relative to the capture commits, the 41
backfilled records, the disposition of each in-scope numeric-omission passage (atoms vs. explicit
not-captured), the `derived_synthesis` shape as shipped, and golden-fixture zero-diff proof.)_
