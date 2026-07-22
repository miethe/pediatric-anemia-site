# `modules/anemia/` — dual evidence-pipeline provenance note (OQ-1)

> **Status:** documents an existing seam at the point of creation. **Not** a reconciliation
> procedure. Written by P4-T3 of the `multi-bundle-conversion-e1` plan.

## The seam

`modules/anemia/` carries **two** evidence-layer files that both trace back to the same upstream
Research Foundry bundle, **`RF-EV-001`** (`rf_run_20260717_rf_ev_001_pediatric_cds_backfill`):

| File | Pipeline | When landed | Shape |
|---|---|---|---|
| `evidence.json` | EP-3/EP-4 (prior, hand-curated source-record pipeline) | Earlier E1 iteration, pre-dates this pass | `{ knowledgeBaseVersion, reviewedThrough, sources: [ { id, priority, passages: [ { id, sourceLocator, exactPassage, evidenceGrade, applicability, provenance: { runId, sourceCardId, evidenceId }, ... } ] } ] }` |
| `evidence-assertions.json` | Evidence Foundry (EF) converter (this pass, P4-T2) | This pass, additive-only | `{ schemaVersion, moduleId, rfProvenance: { rfRunId, rfBundleId, fixturePath }, assertions: [ { assertionId, rfRunId, rfSourceCardId, rfEvidenceId, rfClaimId, passageId, locator, claimStatus, applicability, ... } ] }` |

Both files independently derive from `RF-EV-001`'s 6 source cards / 48 claims (see
[`docs/project_plans/expansion/rf-handoff/RESULTS.md`](../../docs/project_plans/expansion/rf-handoff/RESULTS.md),
§1 status table — `RF-EV-001 | P1 | backfill | 6 | 48 (35 / 8 / 5) | ✅ verified`). Each pipeline
ran its own selection/shaping logic against that same verified bundle at a different point in
time, producing two differently-shaped artifacts rather than one shared representation.

## What this note asserts (binding, per OQ-1's resolution)

This is the **explicit, binding** resolution of PRD §12 OQ-1 / decisions block §7 OQ-1, carried
forward from
[`docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md`](../../docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md#decisions--oq-resolutions)
("Decisions & OQ Resolutions" → **OQ-1**):

- **Parallel provenance views, not a merge.** `evidence.json` and `evidence-assertions.json` are
  two independent, valid provenance views of the same upstream `RF-EV-001` bundle. **Neither
  supersedes the other.** `evidence-assertions.json` being newer does not make `evidence.json`
  stale or deprecated; `evidence.json` being first does not make `evidence-assertions.json` a
  redundant afterthought.
- **Neither field is overwritten by the other.** P4-T2's `propose` run for `RF-EV-001` was scoped
  to emit only `evidence-assertions.json`; it did not write to, regenerate, or modify
  `evidence.json` or `rules.json` in any way. `evidence.json` remains byte-identical to its
  pre-P4-T2 (P4-T1 snapshot) content.
- **Read-only-independent — no field cross-references.** Neither file's records cite, `$ref`, or
  otherwise point into the other file's records. `evidence.json`'s `passages[].provenance` block
  (`runId`/`sourceCardId`/`evidenceId`) and `evidence-assertions.json`'s `assertions[].rfRunId`/
  `rfSourceCardId`/`rfEvidenceId`/`rfClaimId` fields both independently trace back to the same
  upstream RF run and source cards — they are **parallel derivations from a shared upstream
  origin**, not a cross-reference between the two files themselves. A reader who wants "what does
  rule X cite" still reads `rules.json` → `evidence.json` exactly as before this pass; a reader
  who wants "what did the EF converter project from `RF-EV-001`" reads
  `evidence-assertions.json`. Neither lookup path passes through the other file.
- **91 rules unaffected.** `modules/anemia/rules.json`'s 91 rules continue to cite
  `evidence.json`'s existing `sources[].id`/`passages[].id` exactly as before this pass. This pass
  adds zero rules and rewires zero existing rule↔evidence citations (see P4-T4's reference-
  integrity seam task).

## What this note is *not*

This note documents that the seam exists and names its shape — it does **not** decide how (or
whether) the two views are ever unified. In particular it takes no position on:

- Whether a future pass should generate `evidence.json`'s `provenance.runId`-style citations
  *from* `evidence-assertions.json` rather than maintaining them independently.
- Whether the EP-3/EP-4 pipeline's role for this bundle should eventually be deprecated in favor
  of the EF pipeline.
- Any other reconciliation strategy between the two files.

That decision is explicitly out of scope for this pass and is tracked as **Deferred Item
`DF-E1-M3`** ("Anemia backfill reconciliation *procedure*") in the parent plan's Deferred Items
Triage Table.

## Forward link (populated by P7-T4)

> **Placeholder — not yet populated.** Deferred Item `DF-E1-M3` promotes to a full design-spec
> stub in Phase 7 task **P7-T4**, which will author
> `docs/project_plans/design-specs/anemia-backfill-reconciliation-procedure.md` (`maturity: idea`)
> enumerating the three candidate reconciliation options named in PRD §12 OQ-1 (leave-parallel /
> generate-citations-from-assertions / deprecate-EP-3-pipeline-role) without deciding among them.
> When P7-T4 lands, this line is replaced with a live link to that spec. Until then, this
> paragraph is the forward-link placeholder P7-T4 is expected to fill in.

## References

- PRD OQ-1: [`docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md`](../../docs/project_plans/PRDs/infrastructure/multi-bundle-conversion-e1.md) §12 "Assumptions & Open Questions"
- Plan OQ-1 resolution: [`docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md`](../../docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1.md) "Decisions & OQ Resolutions"
- Upstream bundle verification record: [`docs/project_plans/expansion/rf-handoff/RESULTS.md`](../../docs/project_plans/expansion/rf-handoff/RESULTS.md) §1 (`RF-EV-001` row)
- This pass's backfill task: `P4-T2` in [`docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-3-4-scaffolds-and-backfill.md`](../../docs/project_plans/implementation_plans/infrastructure/multi-bundle-conversion-e1/phase-3-4-scaffolds-and-backfill.md)
