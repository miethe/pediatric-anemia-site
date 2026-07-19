---
type: context
schema_version: 2
doc_type: context
prd: "evidence-foundry-buildout"
feature_slug: "evidence-foundry-buildout"
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
title: "evidence-foundry-buildout - Development Context"
status: "active"
created: "2026-07-19"
updated: "2026-07-19"

critical_notes_count: 0
implementation_decisions_count: 4
active_gotchas_count: 0
agent_contributors: []

agents: []

phase_status: [
  { phase: 1, status: "not_started" },
  { phase: 2, status: "not_started" },
  { phase: 3, status: "not_started" },
  { phase: 4, status: "not_started" },
  { phase: 5, status: "not_started" },
  { phase: 6, status: "not_started" },
  { phase: 7, status: "not_started" }
]

blockers: []

decisions: [
  {
    id: "OQ-1",
    question: "Module identity for the 4-rule vertical slice — modules/anemia/ or a new module?",
    decision: "modules/cbc_suite_v1/, not modules/anemia/. index.js delegates deriveFacts/summarize/limitations to modules/anemia/facts.anemia.js by explicit cross-module import/call. Registered in src/modules/registry.js and src/facts/registry.js, not src/ranges/registry.js. DEFAULT_MODULE_ID stays 'anemia'.",
    rationale: "Matches PRD FR-6/FR-15/FR-21 file paths and the CLAUDE.md 'anemia is the wedge, CBC/cytopenia suite is the product' framing; modules/anemia/ stays untouched as both the migration source and the FR-21 semantic-diff baseline.",
    tradeoffs: "cbc_suite_v1 has zero independent fact-derivation logic in E0 — CBC-Suite-specific fact derivation is deferred to E1 (02 §7.3 item 7).",
    location: "modules/cbc_suite_v1/index.js; src/modules/registry.js; src/facts/registry.js",
    phase: 1
  },
  {
    id: "OQ-2",
    question: "Which rf run seeds the 4-rule fixture — RF-CBC-001 or REG-001/REG-004?",
    decision: "RF-CBC-001 (12 source cards, 87 claims). Default to the rights-restricted fallback (hash + selector, not full text) unless the specific passages are positively confirmed rights-clear.",
    rationale: "REG-001/REG-004 both carry unresolved legal-review flags per PRD §8 and may not seed a clinical-rule fixture until that review clears.",
    tradeoffs: "Fixture may ship with exactPassage: null and only exactPassageSha256 populated for some passages.",
    location: "tests/fixtures/ (P1-T6); modules/cbc_suite_v1/evidence-assertions.json (P3-T3)",
    phase: 1
  },
  {
    id: "OQ-3",
    question: "Landing path for evidence-assertions.json / rule-provenance.json — data/, pack-only, or modules/<id>/?",
    decision: "modules/cbc_suite_v1/ — same package-shape contract as rules.json/candidates.json/evidence.json. rule-provenance.json joins rules.json by rule id.",
    rationale: "docs/architecture.md §2a already defines each module as a self-contained package under modules/<id>/; scripts/validate-kb.mjs already resolves per-module content there, never data/.",
    tradeoffs: "None — this is a package-shape extension of an existing contract, not a new location.",
    location: "modules/cbc_suite_v1/evidence-assertions.json; modules/cbc_suite_v1/rule-provenance.json",
    phase: 3
  },
  {
    id: "OQ-4",
    question: "How much impact-graph traversal does the semantic-diff need for E0?",
    decision: "Rule-id-level added/removed/changed comparison only, against modules/anemia/rules.json. No impact-graph traversal.",
    rationale: "cbc_suite_v1 is brand-new, so this yields a trivially correct '4 added, 0 removed, 0 changed' result — expected and acceptable for E0. The E0 deliverable is the semantic-diff.json schema and plumbing, not a materially interesting diff.",
    tradeoffs: "A non-trivial diff result only appears in E1, when a second proposal round runs against an existing cbc_suite_v1/rules.json.",
    location: "P5-T3 semantic-diff.json",
    phase: 5
  }
]

integrations: []

gotchas: []

modified_files: []

notes: "Progress tracking scaffolded pre-execution on 2026-07-19 — all 7 phase files created at status: planning with 0% complete. See References below for the full pointer set."
---

# evidence-foundry-buildout - Development Context

**Status**: Active Development
**Created**: 2026-07-19
**Last Updated**: 2026-07-19

> **Purpose**: Shared worknotes for all agents working the Evidence Foundry Buildout (E0 + Pre-E1
> ADRs) feature. Add brief observations, decisions, gotchas, and implementation notes that future
> agents should know.

---

## Quick Reference

**Agent Notes**: 0 notes from 0 agents (scaffolded, no execution has started)
**Critical Items**: 0
**Last Contribution**: none yet

### Pointers

| Document | Path |
|---|---|
| Implementation Plan | `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md` |
| Phase 1-2 detail | `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-1-2-foundation-converter.md` |
| Phase 3-5 detail | `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md` |
| Phase 6-7 detail | `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-6-7-adrs-docs.md` |
| PRD | `docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md` |
| Decisions Block (binding) | `.claude/worknotes/evidence-foundry-buildout/decisions-block.md` |
| Estimation Sanity Check | `.claude/worknotes/evidence-foundry-buildout/estimation-sanity.md` |
| Design spec (source of `02 §N.N` citations) | `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` |
| Human Brief (not yet authored — load-bearing pointer) | `docs/project_plans/human-briefs/evidence-foundry-buildout.md` |
| Path-mapping worknote (created by P1-T1) | `.claude/worknotes/evidence-foundry-buildout/path-mapping.md` |
| RFUP routing note (created by P7-T13) | `.claude/worknotes/evidence-foundry-buildout/rfup-external-routing-note.md` |
| Feature guide (created post-Phase-7) | `.claude/worknotes/evidence-foundry-buildout/feature-guide.md` |

### Wave Order (from plan `wave_plan.waves`)

Provider is `claude`/`sonnet` for every task except Phase 7's CHANGELOG/pointer tasks (`haiku`).
42 pts total across 7 phases. Critical path: **P1 → P2 → P3 → P4 → P5 → P7** (34 of 42 pts); Phase 6
(5 pts, ADRs) is off the critical path with 21 pts of slack.

| Wave | Phase(s) | Notes |
|------|----------|-------|
| W1 | [1] | Foundation & fixtures — no dependencies, first phase |
| W2 | [2] | Converter core (EF-WP0) — 1st `karen` milestone at close |
| W3 | [3, 6] | Projection & drafting (critical path) runs parallel to Pre-E1 ADRs (off critical path); zero file overlap |
| W4 | [4] | Vertical slice + test corpus |
| W5 | [5] | Manifest & traceability — 2nd `karen` milestone ("E0 functionally complete") at close |
| W6 | [7] | Docs & deferral closure — requires W5 AND W3's Phase 6 both complete; 3rd/final `karen` milestone ("feature end") at close |

---

## Quick Reference: Task() Delegation One-Liners

Progress files live at `.claude/progress/evidence-foundry-buildout/phase-N-progress.md`. Each phase is
orchestrated by `phase-owner`, which dispatches every task to its `assigned_to` specialist and runs the
`task-completion-validator` gate (and `karen` milestone review, where noted) before closing.

**Phase 1 — Foundation & Fixtures (W1, 5 pts, no deps)**
```
Task("phase-owner", "Orchestrate Phase 1 (Foundation & Fixtures) of the evidence-foundry-buildout plan.
Plan: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-1-2-foundation-converter.md §Phase 1.
Progress file: .claude/progress/evidence-foundry-buildout/phase-1-progress.md.
Tasks P1-T1..P1-T7 → general-purpose; gate P1-GATE → task-completion-validator.
P1-T1 (path-mapping worknote) is a hard blocker — land it first.")
```

**Phase 2 — Converter Core / EF-WP0 (W2, 8 pts, depends on P1)**
```
Task("phase-owner", "Orchestrate Phase 2 (Converter Core) of the evidence-foundry-buildout plan.
Plan: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-1-2-foundation-converter.md §Phase 2.
Progress file: .claude/progress/evidence-foundry-buildout/phase-2-progress.md.
P2-T1 (design) → backend-architect (integration owner); P2-T2..T8 → general-purpose (+ testing-specialist on P2-T8, the seam task);
gate P2-GATE1 → task-completion-validator; then P2-GATE2 → karen milestone review (converter core) before Phase 3/6 open.")
```

**Phase 3 — Projection & Drafting (W3, 8 pts, depends on P2; runs parallel to Phase 6)**
```
Task("phase-owner", "Orchestrate Phase 3 (Projection & Drafting) of the evidence-foundry-buildout plan.
Plan: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md §Phase 3.
Progress file: .claude/progress/evidence-foundry-buildout/phase-3-progress.md.
Tasks P3-T1..P3-T7 → general-purpose; gate P3-GATE → task-completion-validator.
Runs alongside Phase 6 (no file overlap) — do not block on Phase 6.")
```

**Phase 6 — Pre-E1 ADRs (W3, 5 pts, depends on P2; runs parallel to Phase 3)**
```
Task("phase-owner", "Orchestrate Phase 6 (Pre-E1 ADRs) of the evidence-foundry-buildout plan.
Plan: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-6-7-adrs-docs.md §Phase 6.
Progress file: .claude/progress/evidence-foundry-buildout/phase-6-progress.md.
Tasks P6-T1..P6-T8 (all 8 ADRs, fully parallel) → documentation-writer (sonnet — architectural judgment, not haiku);
gate P6-GATE → task-completion-validator. Must close before Phase 7 opens.")
```

**Phase 4 — Vertical Slice + Test Corpus (W4, 8 pts, depends on P3)**
```
Task("phase-owner", "Orchestrate Phase 4 (Vertical Slice + Test Corpus) of the evidence-foundry-buildout plan.
Plan: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md §Phase 4.
Progress file: .claude/progress/evidence-foundry-buildout/phase-4-progress.md.
P4-T1..T4 (rule migration, integration owner) → general-purpose; P4-T5..T8 (test corpus) → testing-specialist;
P4-T9 (seam task, engine integration) → general-purpose + testing-specialist; gate P4-GATE → task-completion-validator.
P4-T4/P4-T8 (marrow-red-flag rule + dangerous-miss test) are the safety-critical hotspot — do not shortcut.")
```

**Phase 5 — Manifest & Traceability (W5, 5 pts, depends on P4)**
```
Task("phase-owner", "Orchestrate Phase 5 (Manifest & Traceability) of the evidence-foundry-buildout plan.
Plan: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-3-5-projection-slice-manifest.md §Phase 5.
Progress file: .claude/progress/evidence-foundry-buildout/phase-5-progress.md.
Tasks P5-T1..P5-T5 → general-purpose; gate P5-GATE1 → task-completion-validator; then P5-GATE2 → karen milestone
review ('E0 functionally complete', checked against 02 §9.1's checklist item-by-item).")
```

**Phase 7 — Docs & Deferral Closure (W6, 3 pts, depends on P5 AND P6)**
```
Task("phase-owner", "Orchestrate Phase 7 (Docs & Deferral Closure) of the evidence-foundry-buildout plan.
Plan: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1/phase-6-7-adrs-docs.md §Phase 7.
Progress file: .claude/progress/evidence-foundry-buildout/phase-7-progress.md.
P7-T1 (haiku), P7-T2/T3..T13 (sonnet, 10 design specs + RFUP note, mostly parallel) → documentation-writer;
P7-T14/T15 (haiku) → documentation-writer; P7-T16 (guardrail/non-goal checklist) → documentation-writer (sonnet);
gate P7-GATE1 → task-completion-validator; then P7-GATE2 → karen milestone review ('feature end', final gate —
plan status may only advance to completed after this passes).
On close: delegate feature-guide.md (documentation-writer, haiku) and open the PR per the plan's Wrap-Up section.")
```

---

## Implementation Decisions

See YAML frontmatter `decisions` block above (OQ-1..OQ-4, all binding per the parent plan's
"Decisions & OQ Resolutions" section). OQ-5/OQ-6/OQ-7 are ruled directly in the decisions block §11 and
encoded as tasks (not separately logged here as open questions) — see P1-T1/T7 and P3-T3/T4/T6.

---

## Gotchas & Observations

None yet — execution has not started. Add entries here as phases run.

---

## Integration Notes

None yet.

---

## Performance Notes

None yet.

---

## Agent Handoff Notes

None yet — first agent to pick up Phase 1 should start with P1-T1 (path-mapping worknote), the hard
blocker for everything downstream.

---

## References

**Related Files**:
- Progress tracking: `.claude/progress/evidence-foundry-buildout/phase-{1..7}-progress.md`
- Implementation plan: `docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`
- PRD: `docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md`
- Design spec: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md`
