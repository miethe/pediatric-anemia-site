---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-R3: Evidence Taxonomy & Archive Capture"
status: draft
created: 2026-07-21
phase: EP-R3
phase_title: "Evidence Taxonomy & Archive Capture"
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
feature_slug: rights-aware-evidence-capture
entry_criteria: "EP-R2 MERGED (not merely complete) — this phase branches from EP-R2's merge commit on schemas/evidence.schema.json. EP-R0 substrate present. RF-HANDOFF §9 conflict list read, in particular §9.1 and §9.5."
exit_criteria: "The negative-invariant test landed before any capture work; all 41 passage records carry evidence_item_type, judgment_basis: unassessed, and rights_component_class as separate fields; structured locators and not_captured[] in place; the omits-source-numerics passages plus the audit's HIGH numeric-omission findings each resolve to per-value atoms or an explicit not-captured record; derived_synthesis exists candidate-only; REG_002_CLEARED still false; golden-fixture zero-diff; npm run check green."
planning_maturity: ready
---

# Phase EP-R3: Evidence Taxonomy & Archive Capture (WP3)

**Maps to PRD WP3.** **8 pts.** Wave 3, alone. The heart of the feature and its largest payoff.

**Dependencies**: EP-R2 **merged** (serialization barrier on `schemas/evidence.schema.json`).
**Assigned Subagent(s)**: `general-purpose` (primary), model **`opus`**, effort `high` — taxonomy
design judgment plus evidence-sensitive re-capture. `Explore` (sonnet, read-only) is used in EPR3-T1
and EPR3-T6 to enumerate flagged passages and candidate verbatim spans **before** any edit.
**Entry / exit criteria**: as frontmatter.

**Split rule (decisions block §5):** if this phase exceeds 10 pts during execution, split it at the
**taxonomy / re-capture seam** — EPR3-T1..T5 (schema + backfill) vs. EPR3-T6..T9 (capture + invariants)
— rather than compressing the re-capture.

## Integration Ownership (R-P3)

EP-R3 is the **second and final** owner of `schemas/evidence.schema.json` in this feature. It layers
*item*-level axis fields onto EP-R2's *source*-level fields and must not re-litigate them. Branch from
EP-R2's merge commit; if EP-R2's source fields need a change, that is an escalation, not a local edit.

`package.json` is untouched (EP-R0 barrier). `scripts/validate-kb.mjs` is not restructured here — new
item-level checks go into `scripts/validate-rights.mjs`.

**Ordering constraint inside the phase:** EPR3-T1 (negative invariant) lands **first**, before any task
that writes captured content. Git history is unrecoverable; prevention is the only control.

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EPR3-T1 | **Negative invariant — no third-party full text (lands first)** | Per FR-WP3-09 and AC-WP3-NEGATIVE (D1, critical risk): `tests/rights-negative-invariant.test.mjs` performs a *positive structural check over the working tree* — no source document, reproduced table, figure, image, or brand asset in any directory; no captured field carries a verbatim span beyond the `passageFidelity` policy already enforced. Use `Explore` first to enumerate existing candidate spans read-only. This task ships **before** EPR3-T5/T6 write anything. | target_surfaces: the entire repository working tree including any new directory; `modules/anemia/evidence.json`; `rights/`; `evidence-packs/`. The test fails on a seeded fixture containing (a) a binary/PDF-like source asset, (b) a passage with `passageFidelity: verbatim`, (c) a new asset directory holding a table dump. The test is committed and green before any EPR3-T5/T6 commit. Residual gap R-1 (prohibited-excerpt detection is not deterministic) is recorded in the test's own header comment as **open, not closed**. | 1.0 pt | general-purpose, Explore | opus | high | EP-R2 (merged) |
| EPR3-T2 | Three axis fields on the item record | Per FR-WP3-01, FR-WP3-02, FR-WP3-03 (D2): add three required fields to every evidence item — `evidence_item_type` (closed enum: `observed_finding`, `reference_interval_value`, `equation_or_method`, `guideline_recommendation`, `instrument_or_questionnaire`, `bibliographic_metadata`, `derived_synthesis`), `judgment_basis` (default `unassessed`), and `rights_component_class` (valued from the spec's `component_decisions.component_type` **enum**, which handoff §9.2 establishes is authoritative over the §5.1 prose table). Per handoff §9.1, these are **first-class fields in `schemas/evidence.schema.json`**, not `extensions.rights` properties — `rights_extension` is `additionalProperties: false` and requires a `clearance_status`/`release_gate` pair it cannot carry at capture time. | The three fields are required and separately declared; an unrecognised `evidence_item_type` fails validation and the enum is closed. **Negative criterion:** a fixture setting `judgment_basis` to anything other than `unassessed` without a human-attested reference fails validation — this task ships the constraint and sets no non-`unassessed` value anywhere (OQ-1 routes to counsel). No field `$ref`s or imports an RF-owned schema (FR-WP3-11). | 1.25 pts | general-purpose | opus | high | EPR3-T1 |
| EPR3-T3 | Axis-separation test (AC-WP3-AXES) | Per FR-WP3-03 and AC-WP3-AXES: `tests/rights-axis-separation.test.mjs` constructs each pairwise combination of `evidence_item_type` × `rights_component_class` × passage `status` × `clearance_status`, asserts all are representable, and asserts no code path infers one axis from another. Includes the AAP case explicitly: a passage may be `source-supported` **and** contract-restricted simultaneously. | Every pairwise combination validates. A seeded fixture in which `rights_component_class` is *computed from* `evidence_item_type` fails the test. No `verbatim_excerpt_allowed`-style field duplicating `passageFidelity` exists — two fields that can disagree is a fail-open. `src/evidence.js`'s `isBindableAsSourceSupported` is asserted to read only the epistemic axis. | 0.75 pts | general-purpose | opus | high | EPR3-T2 |
| EPR3-T4 | Structured locator model + `not_captured[]` | Per FR-WP3-04 and FR-WP3-06 (D1): every item carries a structured locator with each applicable component **individually addressable** — source, edition/version, section, table, row, column, assay/method, population/scope — plus retrieval date. Free-text locators are unacceptable where a structured component applies. Every item also carries `not_captured[]` naming what was deliberately not stored (prose, table structure, figures, layout) and why. | A locator that collapses table/row/column into one prose string fails validation for a `reference_interval_value` or any table-derived item. An item derived from a table with an empty `not_captured[]` and no rationale fails validation. An incomplete locator records its missing components explicitly rather than validating as complete — missingness is never treated as normal. | 1.25 pts | general-purpose | opus | high | EPR3-T3 |
| EPR3-T5 | Atomic backfill of 41 passages | Backfill all 41 existing passage records across the 6 sources with the three axis fields, a structured locator, and a `not_captured[]` entry, in the same commit as the schema change. Mechanical where the value is unambiguous; flagged for review where the `evidence_item_type` assignment is a judgment call. | All 41 records carry all three axis fields and validate; `npm run validate` exits 0 in the same commit as the schema change. Every record ships `judgment_basis: unassessed`. **R-P2 resilience:** a passage whose locator is partially known records the known components and lists the unknown ones — partial capture is representable and visible; silent partial capture fails. | 1.0 pt | general-purpose | opus | high | EPR3-T4 |
| EPR3-T6 | Numerics re-capture as per-value atoms | Per FR-WP3-05 and AC-WP3-NUMERICS: resolve each numeric-omission passage to exactly one of two states — (a) a set of **per-value typed atoms**, each independently worded, with a complete structured locator, an `evidence_item_type`, a `rights_component_class`, and `judgment_basis: unassessed`; or (b) an explicit not-captured record stating why. Scope is the union of the passages flagged `omits-source-numerics` in `modules/anemia/evidence.json` (today: `WHO2024_HB#ev_001`, `WHO2024_HB#ev_004`, `BSH2020_G6PD#ev_006`) **and** the HIGH numeric-omission findings in `docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md` (which additionally names `AAP2026_IDA#ev_002`). Use `Explore` read-only to confirm the enumeration before editing. | Each in-scope passage resolves to state (a) or (b), never to neither. **No reproduced table exists in any form** — atoms are per-value records, and the omitted table structure is named in `not_captured[]`. Every captured value is the source's *reported* value, transcribed at a recorded locator; none is authored, adjusted, or interpolated (`CLAUDE.md`: no invented thresholds). Partial capture records the uncaptured values explicitly. EPR3-T1's invariant is green after this task. | 1.5 pts | general-purpose, Explore | opus | high | EPR3-T5 |
| EPR3-T7 | `derived_synthesis` — candidate-only, attribution from day one | Per FR-WP3-07 (D3, D6): ship `derived_synthesis` as a first-class item type with an ordered list of contributing item IDs, a synthesis rationale, and an authorship record. It exists **only** in a `candidate` state. Per handoff §9.5, `rights_record` cannot describe first-party content, so a `derived_synthesis` item gets **no** rights record in this feature; record the gap as DEF-R4 rather than forcing a misfitting record. | A `derived_synthesis` item with no input attribution fails validation. **Negative criterion:** the authoritative state is structurally unrepresentable — no enum value, flag, or field combination reaches it without a human attestation record this feature does not create; a fixture attempting to mark one authoritative fails. This task ships zero `derived_synthesis` instances marked anything other than `candidate`, and zero attestations. The §9.5 gap is recorded in the schema description and in `schemas/rights/VENDORING.md`. | 0.75 pts | general-purpose | opus | high | EPR3-T5 |
| EPR3-T8 | `guideline_recommendation` — the fact, not the prose | Per FR-WP3-08 (D2, "captured, not avoided"): `guideline_recommendation` items capture the **fact of the recommendation** — named body, the recommendation restated independently, scope/population, locator — and never the recommendation's prose. | A `guideline_recommendation` item containing a verbatim span from the source fails EPR3-T1's invariant. Each such item names its issuing body as a structured field and carries an independently-worded restatement, not a quotation. | 0.25 pts | general-purpose | opus | high | EPR3-T6 |
| EPR3-T9 | Standing invariants: `REG_002_CLEARED`, RF decoupling, zero clinical change | Per FR-WP3-10, FR-WP3-11, FR-WP3-12: assert `scripts/validate-kb.mjs`'s `REG_002_CLEARED === false` after this phase and that `passageFidelity` stays constrained to `paraphrase`/`withheld`; assert no artifact imports or `$ref`s an RF-owned schema at runtime (OQ-4 open); prove zero clinical change by golden-fixture equivalence. | A test asserts `REG_002_CLEARED === false`. A test asserts no runtime `$ref`/import resolves outside `schemas/`. Golden-fixture output shows zero diff across all 6 examples; no rule, candidate, or threshold changed in clinical meaning; `npm run coverage:rules` still reports 91. | 0.25 pts | general-purpose | opus | high | EPR3-T7, EPR3-T8 |

**Phase total: 8 pts.**

## Phase EP-R3 Quality Gates

- [ ] Negative-invariant test landed and green **before** any capture commit (EPR3-T1, AC-WP3-NEGATIVE)
- [ ] Residual gap R-1 recorded as open, not implied closed (EPR3-T1)
- [ ] All 41 passages carry `evidence_item_type`, `judgment_basis: unassessed`, `rights_component_class` (EPR3-T2/T5)
- [ ] Taxonomy fields are first-class, **not** on `extensions.rights` (handoff §9.1) (EPR3-T2)
- [ ] `rights_component_class` values come from the schema enum, not the §5.1 prose table (handoff §9.2)
- [ ] Every pairwise axis combination is representable; no axis inferred from another (EPR3-T3, AC-WP3-AXES)
- [ ] Structured locators are component-addressable; `not_captured[]` is populated and rationalized (EPR3-T4)
- [ ] Every in-scope numeric-omission passage resolves to atoms **or** an explicit not-captured record (EPR3-T6)
- [ ] **No reproduced table in any form**; `REG_002_CLEARED` stays `false` (EPR3-T6, EPR3-T9)
- [ ] `derived_synthesis` is candidate-only with modelled attribution; authoritative state unrepresentable (EPR3-T7)
- [ ] `derived_synthesis` has no forced rights record; handoff §9.5 gap recorded as DEF-R4 (EPR3-T7)
- [ ] No runtime `$ref`/import to an RF-owned schema (EPR3-T9, OQ-4 open)
- [ ] Zero clearances, zero attestations, zero grounded rules written by this phase
- [ ] Golden-fixture zero-diff across 6 examples; `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../rights-aware-evidence-capture-v1.md)
