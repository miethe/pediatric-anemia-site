---
type: progress
schema_version: 2
doc_type: progress
prd: evidence-foundry-buildout
feature_slug: evidence-foundry-buildout
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
execution_model: batch-parallel
phase: 3
title: 'Evidence Foundry Buildout — Phase 3: Projection & Drafting'
status: pending
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 8
completed_tasks: 1
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- task-completion-validator
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P3-T1
  description: 'Author authoring-decisions.yaml for the 4 slice rules (FR-14, 02 §4.12):
    hand-author modules/cbc_suite_v1/authoring-decisions.yaml with one dec_*-ID record
    per slice rule (young-infant abstention, local-range precedence, iron-deficiency
    pattern, marrow-red-flag) matching the 02 §4.12 schema. Cite specific RF-CBC-001
    claim IDs from the P1-T6 fixture; all review.* fields stay ''pending''.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P2-GATE1
  estimated_effort: 1.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
- id: P3-T2
  description: 'evidence.json enrichment (FR-12 first half, 02 §4.9): project the
    fixture''s source cards into modules/cbc_suite_v1/evidence.json per the 02 §4.9
    field-mapping table (rfSourceCardId, id, title, priority, publicationDate/year,
    authors, organization, url/doi, journal — never synthesized — limitations, conflictsWith,
    contentRights, supports[], reviewBy/surveillanceQuery/supersessionStatus, recencyNote).
    Preserves modules/anemia/evidence.json''s existing shape.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P3-T1
  estimated_effort: 1.0 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P3-T3
  description: 'evidence-assertions.json exact-passage projection + schema (FR-12
    second half, 02 §4.10, OQ-3/OQ-7): create modules/cbc_suite_v1/evidence-assertions.json
    (assertionId, rfRunId, rfSourceCardId, sourceId, rfEvidenceId, rfClaimId, passageId,
    locator, exactPassage/exactPassageSha256, displayPolicy, claimStatus, applicability,
    laboratory, reviewBy) and schemas/evidence-assertions.schema.json, wired into
    scripts/validate-kb.mjs. Applies OQ-2''s rights-restricted fallback.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P3-T1
  estimated_effort: 1.25 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
- id: P3-T4
  description: 'Claim-ledger eligibility routing + authoring-decisions.schema.json
    (FR-13, 02 §4.11): implement the claim-status routing table exactly — supported
    -> source_supported_fact (only with resolved exact passage); mixed -> conflict-visible
    object only, never a one-sided rule; contradicted -> never sole positive basis;
    inference -> requires populated inference_basis.from_claims; speculation/unsupported
    -> never emitted as rule evidence. Author schemas/authoring-decisions.schema.json,
    wire into scripts/validate-kb.mjs.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P3-T3
  estimated_effort: 1.25 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
- id: P3-T5
  description: 'Candidate + rule-proposal drafting (02 §4.13, 02 §4.14): draft rule-proposals.json
    (one entry per slice rule, joined to its authoring-decisions.yaml record) and
    candidates.json entries for the iron-deficiency-anemia pattern per the 02 §4.14
    field table (''pattern'' wording, never diagnostic certainty). Output stays in
    build/kb-pack/cbc_suite_v1/0.1.0-proposal/ (gitignored staging) — not yet committed
    into modules/cbc_suite_v1/.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P3-T4
  estimated_effort: 1.0 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P3-T6
  description: 'Strict runtime projection + rule-provenance.json + schema (FR-15,
    02 §4.13): emit the strict 5-field runtime projection (id, category, when, evidence,
    output, additionalProperties: false) for each of the 4 slice rules into the staged
    pack''s rules.json, plus the companion rule-provenance.json (ruleId, moduleId,
    basis.*, missingness, localProfileRequirement, testIds, reviewStatus: ''draft''),
    joined by rule id. Author schemas/rule-provenance.schema.json, wired into scripts/validate-kb.mjs.'
  status: pending
  assigned_to:
  - general-purpose
  dependencies:
  - P3-T5
  estimated_effort: 1.0 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
- id: P3-T7
  description: 'propose verb + conflict-visibility test (02 §4.5, 02 §4.6 phases 4-9):
    wire P3-T1..T6 into the propose verb stubbed in P2-T1, assembling the full staged
    pack at build/kb-pack/cbc_suite_v1/0.1.0-proposal/. Add tests/ef-converter-propose.test.mjs
    proving propose against the fixture yields a schema-valid pack and that a mixed/contradicted
    stub claim never produces a one-sided rule (seam invariant 8).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P3-T6
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  evidence:
  - note: node --test tests/ef-converter-propose.test.mjs (13/13 pass); node --test
      tests/ef-converter-*.test.mjs (142/142 pass); npm run validate green; npm test
      (1012/1012 pass)
- id: P3-GATE
  description: 'task-completion-validator gate: verify Phase 3 exit gate — propose
    yields a schema-valid pack; mixed/contradicted claims stay conflict-visible.'
  status: pending
  assigned_to:
  - task-completion-validator
  dependencies:
  - P3-T1
  - P3-T2
  - P3-T3
  - P3-T4
  - P3-T5
  - P3-T6
  - P3-T7
  estimated_effort: —
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
parallelization:
  batch_1:
  - P3-T1
  batch_2:
  - P3-T2
  - P3-T3
  batch_3:
  - P3-T4
  batch_4:
  - P3-T5
  batch_5:
  - P3-T6
  batch_6:
  - P3-T7
  batch_7:
  - P3-GATE
  critical_path:
  - P3-T1
  - P3-T3
  - P3-T4
  - P3-T5
  - P3-T6
  - P3-T7
  - P3-GATE
  estimated_total_time: 7.0 pts critical path; 8.0 pts total phase
blockers: []
success_criteria:
- id: SC-1
  description: propose run against the fixture produces a schema-valid pack under
    build/kb-pack/ (never committed)
  status: pending
- id: SC-2
  description: Zero rule proposal has a mixed/contradicted claim as its sole positive
    basis
  status: pending
- id: SC-3
  description: All 4 new/extended schemas (evidence-assertions, authoring-decisions,
    rule-provenance) reject a fixture missing a required field
  status: pending
files_modified:
- tools/rf-bundle-to-kb-pack/**
- modules/cbc_suite_v1/authoring-decisions.yaml
- schemas/evidence-assertions.schema.json
- schemas/rule-provenance.schema.json
- schemas/authoring-decisions.schema.json
- tests/ef-converter-propose.test.mjs
progress: 12
updated: '2026-07-21'
---

# evidence-foundry-buildout - Phase 3: Projection & Drafting

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Update progress via CLI:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/evidence-foundry-buildout/phase-3-progress.md -t TASK-X -s completed
```

---

## Objective

Builds evidence projections, claim-ledger eligibility routing, the `propose` verb, and the
authoring-decisions records that make rule drafting reviewable rather than generative. Depends on
Phase 2 complete. Phase 6 (Pre-E1 ADRs) runs in parallel alongside this phase — no file overlap.
Duration ~4-5 engineer-days.

**Exit gate** (decisions block §3): `propose` on the fixture yields a schema-valid pack; `mixed`/
`contradicted` claims emit conflict-visible objects, never one-sided rules.

---

## Implementation Notes

### Architectural Decisions

- P3-T2 (evidence-projection) and P3-T3 (exact-passage projection) touch disjoint output files and may
  be worked in either order by the same executor — the plan explicitly does not split them into
  separate waves because they share the `tools/rf-bundle-to-kb-pack/**` source tree (a real coupling).
  Likewise P3-T4/P3-T5 (claim-ledger routing / candidate drafting).
- The converter must never infer clinical Boolean logic from prose (FR-14) — P3-T1's hand-authored
  `authoring-decisions.yaml` is what makes rule drafting reviewable instead of generative.

### Known Gotchas

- Invented-threshold leak via drafting phases is a High-risk hotspot (plan Risk Mitigation table):
  every numeric in a generated rule must carry a passage locator resolvable in
  `evidence-assertions.json`; P3-T3's schema rejects a fixture assertion missing
  `exactPassageSha256` when `exactPassage` is `null`.
- P3-T4's routing table has zero exceptions: `speculation`/`unsupported` claims must never reach rule
  evidence at all, and `mixed`/`contradicted` must never be the sole positive basis for a rule.

---

## Completion Notes

Fill in when Phase 3 is complete: what was built, key learnings, unexpected challenges, recommendations
for Phase 4.
