---
type: progress
schema_version: 2
doc_type: progress
prd: rights-aware-evidence-capture
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
execution_model: sequential
phase: EP-R4
created: '2026-07-21'
title: 'EP-R4: Clean-Room Authoring Workflow (WP4)'
status: completed
started: '2026-07-21T00:00:00Z'
completed: '2026-07-21T00:00:00Z'
commit_refs: []
pr_refs: []
overall_progress: 100
completion_estimate: on-track
total_tasks: 6
completed_tasks: 6
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors: []
model_usage:
  primary: sonnet
  external: []
tasks:
- id: EPR4-T1
  description: 'Clean-room workflow doc (FR-WP4-01): author docs/workflows/clean-room-authoring.md
    mapping spec §9''s five roles — research reviewer, independent rule author, clinical
    adjudicator, rights reviewer, technical verifier — onto this repo''s actual artifacts
    and gates, naming which roles are currently UNFILLED. The rights owner (OQ-2)
    and the credentialed clinician are named unfilled, with a note that neither is
    an engineering task. The doc claims no role is filled by an agent, ARC, or council
    output.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP-R3
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - note: docs/workflows/clean-room-authoring.md
- id: EPR4-T2
  description: 'Deterministic decision-brief generator (FR-WP4-02): scripts/rights/build-decision-brief.mjs
    — given an item or binding, emits a decision-ready brief containing independently-worded
    atoms, structured locators, scope/population, the recorded rights position, and
    the specific question the human must answer. Fully offline and deterministic;
    any date input arrives via --as-of or env, never Date.now(). The brief states
    the recorded rights position as recorded — it never asserts, infers, or upgrades
    a clearance.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR4-T1
  estimated_effort: 1.5 pts
  priority: critical
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - note: 'scripts/rights/build-decision-brief.mjs, tests/rights-decision-brief-generator.test.mjs
      (commit e37dbdb — status corrected here; this field previously drifted stale relative
      to the committed work)'
- id: EPR4-T3
  description: 'Clean-room contamination guard (FR-WP4-03, D5): tests/rights-brief-contamination.test.mjs
    asserts no generated brief contains a verbatim span from a restricted source.
    Contaminating a brief fails the GATE, not merely a review. The check runs over
    generator output, not over reviewer assurance. Residual gap R-1 applies here too
    and is referenced, not claimed closed.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR4-T2
  estimated_effort: 0.75 pts
  priority: critical
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - note: 'tests/rights-brief-contamination.test.mjs (commit d0bb664 — status corrected here;
      this field previously drifted stale relative to the committed work)'
- id: EPR4-T4
  description: 'Rights-decision ledger plumbing on the RG-9 seam (FR-WP4-04, D4):
    define a rights-decision ledger entry shape that a future rights owner fills,
    joined bidirectionally to rights records and evidence items, reusing loadAttestationLedger
    / validateBindingsAgainstLedger in scripts/evidence/lib/attested-passage-map.mjs
    rather than adding a second validator. The live rights-decision ledger ships EMPTY.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR4-T3
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - note: rights/rights-ledger.json#rights_decisions, scripts/rights/lib/rights-decision-ledger-gate.mjs,
      tests/rights-decision-ledger.test.mjs
- id: EPR4-T5
  description: 'Positive checks for future clearance entries; ledger stays empty (FR-WP4-05,
    FR-WP4-06, D6): any future counsel_approved / clearance entry must pass the same
    positive checks as RG-14/16/17 — closed credential list, realpath-canonical attestationRef
    under docs/attestations/, calendar-valid date — reusing attested-passage-map.mjs.
    Exercised by a FIXTURE entry only. Negative criterion: the live ledger is empty
    and a test asserts it; tests/attestation-ledger-gate.test.mjs is unmodified and
    still passes.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR4-T4
  estimated_effort: 0.5 pts
  priority: critical
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - note: tests/rights-clearance-positive-checks.test.mjs
- id: EPR4-T6
  description: 'Brief shape for clinician minutes (FR-WP4-07, Should, D5): the brief
    is one screen per decision, with the decision question stated FIRST, followed
    by the atoms and locators needed to answer it. The generator may prepare derived_synthesis
    candidates and may never mark one authoritative — its only reachable synthesis
    output is a candidate.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR4-T5
  estimated_effort: 0.25 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - note: 'scripts/rights/build-decision-brief.mjs#assertSynthesisAttestationIsCandidateOnly
      (fail-closed defense, called from buildSynthesisItemBrief), tests/rights-decision-brief-generator.test.mjs
      (negative-criterion + nested-input + decision-question-ordering + one-decision-per-brief
      tests). npm run check green (1372/1372 tests).'
parallelization:
  batch_1:
  - EPR4-T1
  batch_2:
  - EPR4-T2
  batch_3:
  - EPR4-T3
  batch_4:
  - EPR4-T4
  batch_5:
  - EPR4-T5
  batch_6:
  - EPR4-T6
  critical_path:
  - EPR4-T1
  - EPR4-T2
  - EPR4-T3
  - EPR4-T4
  - EPR4-T5
  - EPR4-T6
  estimated_total_time: 5.0 pts (critical path)
blockers: []
success_criteria:
- id: SC-1
  description: All five spec §9 roles mapped to a real artifact and gate; unfilled
    roles named as unfilled (EPR4-T1)
  status: completed
- id: SC-2
  description: Brief generator is deterministic and offline; byte-identical across
    runs; no Date.now() (EPR4-T2)
  status: completed
- id: SC-3
  description: Contamination guard fails a quoting brief as a gate, not a review note
    (EPR4-T3, D5)
  status: completed
- id: SC-4
  description: Rights-decision ledger validates bidirectionally on the reused RG-9
    seam; no second validator (EPR4-T4)
  status: completed
- id: SC-5
  description: Positive credential/path/date checks exist and are fixture-exercised
    (EPR4-T5)
  status: completed
- id: SC-6
  description: Live ledgers are empty; a test asserts it. Zero attestations, zero
    approvals, zero clearances shipped (EPR4-T5, D6)
  status: completed
- id: SC-7
  description: tests/attestation-ledger-gate.test.mjs unmodified and still passing
    (EPR4-T5)
  status: completed
- id: SC-8
  description: Generator can prepare derived_synthesis candidates only; authoritative
    output unreachable (EPR4-T6, D3/D6)
  status: completed
- id: SC-9
  description: One decision per brief, question first (EPR4-T6, D5)
  status: completed
- id: SC-10
  description: package.json untouched (EP-R0 barrier)
  status: completed
- id: SC-11
  description: npm run check green
  status: completed
- id: SC-12
  description: task-completion-validator sign-off
  status: not_started
files_modified:
- docs/workflows/clean-room-authoring.md
- scripts/rights/build-decision-brief.mjs
- rights/rights-ledger.json
- tests/rights-brief-contamination.test.mjs
- tests/rights-decision-brief-generator.test.mjs
progress: 100
updated: '2026-07-21'
---

# rights-aware-evidence-capture - Phase EP-R4: Clean-Room Authoring Workflow

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/rights-aware-evidence-capture/phase-r4-progress.md -t EPR4-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Ship the clean-room human workflow (WP4): a role map onto real artifacts and gates, a **deterministic
decision-brief generator**, a contamination guard that fails as a gate, and rights-decision **ledger
plumbing** for a rights owner and clinician who do not yet exist. It ships **zero attestations**.

Clinician time is the binding constraint (D5). This phase optimises for *clinician* minutes, not agent
minutes: agents prepare a decision-ready brief, a human adjudicates. The brief summarises source
guidance and must never quote it into the implementation record — otherwise the clean room is
contaminated and the separation-of-duties defence is lost.

**Phase-level entry criteria**: EP-R3 merged — the three axis fields, structured locators,
`not_captured[]`, and the `derived_synthesis` candidate type exist, so a brief has atoms with a stable
shape to summarise.

**Wave 4, alone.**

---

## Implementation Notes

### Architectural Decisions

- This phase has **no file overlap with any other phase** — it adds
  `docs/workflows/clean-room-authoring.md`, `scripts/rights/build-decision-brief.mjs`, and new tests,
  and extends `rights/rights-ledger.json`'s shape.
- It **reuses, rather than duplicates**, the RG-9 attestation seam: `loadAttestationLedger` /
  `validateBindingsAgainstLedger` in `scripts/evidence/lib/attested-passage-map.mjs`. No second
  validator. `git diff` must show no second ledger-validation implementation.
- **D6**: the positive credential/path/date checks ship; the entries do not. The live ledger is empty
  and a test asserts it.
- The generator's only reachable synthesis output is a `candidate` — the authoritative state is
  unreachable by construction, not by convention.

### Patterns and Best Practices

- Determinism is proven, not asserted: two runs at different wall-clock times against unchanged input
  must produce byte-identical output.
- The contamination guard runs over generator **output**, not over reviewer assurance — a brief that
  quotes a restricted source exits non-zero.
- Brief shape follows the D5 rule: one decision per brief, the decision question in the **first**
  block, atoms and locators after it.

### Known Gotchas

- The authoritative `npm run check` composition lives in `package.json`, **not** `CLAUDE.md` (stale
  until EPR5-T5 lands): `test && validate && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`.
- No task may write a `CLEARED_*` status, an attestation, `clinicalApprovers[]`, `approvedBy[]`, or an
  authoritative `derived_synthesis`. Ship the plumbing and the fails-closed test, never the value.
- `json-schema-lite` silently ignores `format: "uri"` — use `pattern`.
- Date-dependent gates take `--as-of`/env, never `Date.now()` (byte-identical determinism).
- The legal axis (`overall_status`) lives on the rights record, joined via the ledger — not on the
  evidence item. Item-level axes are `evidence_item_type`, `judgment_basis`, `rights_component_class`.
- `tests/attestation-ledger-gate.test.mjs` must remain **unmodified** and still assert an empty
  attestation ledger. Editing it to accommodate this phase is a D6 violation, not a fix.
- The workflow doc must not let an agent, ARC, or council output stand in for a role — the rights
  owner (OQ-2) and the credentialed clinician are named **unfilled**, and neither is an engineering
  task.
- `package.json` is untouched (EP-R0 barrier); the brief generator is invoked through the wiring
  EP-R0 already landed.
- Residual gap **R-1** applies to the contamination guard too: prohibited-excerpt detection is not
  deterministic. Reference it; do not claim it closed.

### Development Setup

No new dependencies. The generator is fully offline. Fixture-only exercise of the clearance checks —
no fixture may be promoted into the live ledger.

---

## Completion Notes

Phase EP-R4 is complete. `docs/workflows/clean-room-authoring.md` maps the spec's five §9 roles onto
real artifacts, naming the rights owner (OQ-2) and the credentialed clinician as unfilled.
`scripts/rights/build-decision-brief.mjs` is a deterministic, offline decision-brief generator
(`tests/rights-decision-brief-generator.test.mjs` proves byte-identical output across two runs
separated by real wall-clock time, both through the pure functions and the CLI). The contamination
guard (`tests/rights-brief-contamination.test.mjs`) runs over generator *output* as a gate. The
rights-decision ledger (`rights/rights-ledger.json#rights_decisions`) validates bidirectionally on
the reused RG-9 seam (`scripts/evidence/lib/attested-passage-map.mjs`) with no second validator, and
ships empty. The positive credential/path/date checks
(`tests/rights-clearance-positive-checks.test.mjs`) are fixture-exercised only; the live
attestation ledger stays empty and `tests/attestation-ledger-gate.test.mjs` is unmodified.

EPR4-T6 closed the phase: the rendered brief already stated its decision question first and covered
exactly one decision per invocation, and this task locked both properties with dedicated tests
(`tests/rights-decision-brief-generator.test.mjs`). It also hardened D3/D6 from convention to a
fail-closed check — `assertSynthesisAttestationIsCandidateOnly` in
`scripts/rights/build-decision-brief.mjs` refuses to brief any `derived_synthesis` whose
`attestation.status` is not `"candidate"`, including one buried in a recursively-resolved attributed
input, exercised by fixtures that bypass schema validation entirely (the negative criterion: "a
fixture asking the generator to emit an authoritative derived_synthesis fails").

`package.json` is untouched (EP-R0 barrier). `npm run check` is green: 1372/1372 tests pass, coverage
is 91/91 rules witnessed, build/verify:d4/check:imports/smoke:browser/smoke all pass.
