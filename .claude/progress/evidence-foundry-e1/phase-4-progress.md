---
type: progress
schema_version: 2
doc_type: progress
prd: evidence-foundry-e1
feature_slug: evidence-foundry-e1
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-e1-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-e1-v1.md
execution_model: batch-parallel
phase: 4
title: "Evidence Foundry E1 \u2014 Phase 4: Retrospective Validation Harness"
status: completed
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 100
completion_estimate: on-track
total_tasks: 10
completed_tasks: 10
in_progress_tasks: 0
blocked_tasks: 0
at_risk_tasks: 0
owners:
- general-purpose
contributors:
- spike-writer
- task-completion-validator
model_usage:
  primary: sonnet
  external: []
tasks:
- id: P4-T1
  description: "tools/retro-validate/ scaffold + fixture-corpus schema (FR-20), FR-19/FR-20\
    \ (ruling R6): scaffold tools/retro-validate/ (Node ESM cli.mjs, verbs check-fixtures\
    \ | run | report; README module boundary: corpus / boundary / replay / metrics\
    \ / access-log). Author the tool-local fixture-corpus schema (tools/retro-validate/schemas/fixture-corpus.schema.json\
    \ \u2014 tool-local by design so no wave-2 phase touches scripts/validate-kb.mjs):\
    \ every case requires a provenance marker in {synthetic, deidentified} with corpus-level\
    \ source attestation ref; schema forbids identifier fields (name, MRN, DOB, address,\
    \ contact, SSN-like patterns \u2014 enumerated denylist). E1 corpus content: synthetic\
    \ + de-identified only."
  status: completed
  assigned_to:
  - general-purpose
  dependencies: []
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  started: '2026-07-22T05:33:00Z'
  completed: '2026-07-22T07:49:00Z'
  evidence:
  - commit: 3b5c739
  verified_by:
  - P4-GATE
- id: P4-T2
  description: "Boundary enforcement validator (FR-20), ADR-0006 binding clause: check-fixtures\
    \ is the structural gate every other verb calls first \u2014 rejects fail-closed\
    \ (non-zero exit, no partial output) any corpus containing an identifier-bearing\
    \ case, a case lacking a provenance marker, or a corpus without source attestation.\
    \ run/report refuse to start on an unchecked or failing corpus. Seeded fixtures\
    \ for all three rejection classes. Schema-enforced (not procedural) de-identification\
    \ boundary."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P4-T1
  estimated_effort: 1.0 pts
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  started: '2026-07-22T05:33:00Z'
  completed: '2026-07-22T07:49:00Z'
  evidence:
  - commit: 705870d
  verified_by:
  - P4-GATE
- id: P4-T3
  description: "Version-pinned deterministic replay runner (FR-19): run --corpus <dir>\
    \ --candidate-digest <registry digest> --registry <path> replays every corpus\
    \ case through the engine build identified by the pinned registry digest \u2014\
    \ never \"current tree\": the runner resolves the candidate via the registry entry\
    \ (dry-run registry fixture in E1) and fails closed on digest mismatch. Deterministic:\
    \ canonical serialization, sorted case order, no timestamps in hashed bytes; two\
    \ runs over identical corpus + digest produce byte-identical metric artifacts."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P4-T2
  estimated_effort: 1.5 pts
  priority: critical
  assigned_model: sonnet
  model_effort: extended
  started: '2026-07-22T05:33:00Z'
  completed: '2026-07-22T07:49:00Z'
  evidence:
  - commit: c60c39f
  verified_by:
  - P4-GATE
- id: P4-T4
  description: "Software-agreement metrics report (FR-21, OQ-5): report emits agreement-report.json\
    \ with exactly the 5 OQ-5 measures \u2014 case-level exact-agreement rate; per-candidate-pattern\
    \ agreement/disagreement counts; dangerous-miss discordance count; safety-flag\
    \ agreement coverage; missing-data-prompt agreement rate \u2014 every metric labeled\
    \ software agreement, report header carrying the unvalidated-prototype banner\
    \ + explicit non-clinical-performance negation + FR-24 non-qualifying protocol\
    \ banner. Provenance sidecar run-provenance.json (corpus id, harness version,\
    \ candidate registry digest, run timestamp) \u2014 sole timestamp location, outside\
    \ determinism-compared bytes."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P4-T3
  estimated_effort: 1.0 pts
  priority: high
  assigned_model: sonnet
  model_effort: adaptive
  note: 'Software-agreement metrics report (FR-21, OQ-5): lib/metrics.mjs computes
    the exactly-5 OQ-5 measures (case-level exact-agreement rate; per-candidate-pattern
    agreement/disagreement; dangerous-miss discordance count; safety-flag agreement
    coverage; missing-data-prompt agreement rate), every measure labeled "software
    agreement". report verb reads an already-written replay-output.json (never re-runs
    the engine), writes agreement-report.json (canonical, timestamp-free, determinism-compared)
    + run-provenance.json sidecar (corpus id, harness version, candidate registry
    digest, run timestamp -- sole timestamp location). Report header carries the unvalidated-prototype
    banner, the explicit software-agreement negation (grep-proven: sensitivity/specificity/clinical
    performance appear nowhere else), and the FR-24 non-qualifying-protocol banner
    -- evaluateProtocolQualification is structurally incapable of returning qualifying:true,
    even against a populated protocol document. New metrics-corpus fixture (8 cases)
    exercises every measure branch with hand-derived expected values. Updated tests/ef-retro-boundary.test.mjs
    + tests/ef-retro-corpus.test.mjs stale report-scaffold expectations (NotImplementedError
    -> UsageError requiring --run) to match landed behavior.'
  started: '2026-07-22T05:33:00Z'
  completed: '2026-07-22T07:49:00Z'
  evidence:
  - test: tests/ef-retro-metrics.test.mjs
  - test: tests/ef-retro-boundary.test.mjs (updated)
  - test: tests/ef-retro-corpus.test.mjs (updated)
  - commit: ef-e1(P4-T4)
  - commit: ed32cec
  verified_by:
  - P4-GATE
- id: P4-T5
  description: "Discordance / adjudication record model (FR-23): each harness-vs-reference-label\
    \ disagreement emits an adjudication-ready discordance record (tool-local schema:\
    \ case ref, candidate digest, engine output set, reference label set, disagreement\
    \ class) structurally consumable by Workstream A \u2014 its shape maps onto a\
    \ P1-T2 canonical adjudication-role scaffold input, and the adjudicator-\u2260\
    -author check reuses the PRD OQ-5 authorship-union definition (shared helper,\
    \ not re-implemented). Missing-field fixture rejected."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P4-T4
  estimated_effort: 1.0 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  note: 'Discordance / adjudication record model (FR-23, PRD OQ-5): tools/retro-validate/schemas/discordance-record.schema.json
    (tool-local, closed shape: caseRef/candidateDigest/engineOutputSet/referenceLabelSet/disagreementClass
    + identity/versioning fields) + lib/discordance.mjs#computeDiscordanceRecords
    -- pure function over an already-written replay-output.json, emitting one record
    per (labeled case, disagreeing dimension) across 4 classes (candidate-pattern-mismatch,
    safety-flag-mismatch, missing-data-prompt-mismatch, dangerous-miss-discordance
    -- the last reuses metrics.mjs#isDangerousMissDiscordant verbatim, not re-implemented).
    toAdjudicationScaffoldInput(record, humanInput) maps a record onto the exact tools/review-record
    scaffold(--role adjudication) options shape (candidateDigest -> subject, moduleId
    -> module); reviewerId/decision are NEVER derived from the record (throws if either
    humanInput field is missing). checkAdjudicatorNotAuthor reuses (imports, does
    not re-implement) tools/review-record/lib/adjudication.mjs#computeAuthorshipUnion/rosterEntryInAuthorshipUnion
    (PRD OQ-5) -- this is discordance.mjs''s ONE sanctioned cross-import between the
    two tools; tests/ef-retro-access-log.test.mjs was narrowed (with an explanatory
    comment) from a whole-tool no-cross-import scan to lib/access-log.mjs specifically,
    plus a new test pinning the review-record cross-import to exactly lib/discordance.mjs
    so it can never silently spread. New fixtures: tests/fixtures/ef-retro/discordance-records/
    (1 valid + 5 seeded missing-field, one per FR-23-named field) and tests/fixtures/ef-retro/discordance-adjudication-scaffold/
    (throwaway review-record --root tree, file-disjoint from P2''s own tests/fixtures/ef-review-record-cli/).
    Integration test invokes the REAL tools/review-record/lib/verbs/scaffold.mjs#run
    over every discordance record the P4-T4 metrics-corpus fixture produces (5 records
    across 4 cases) -- all accepted (EXIT_OK) -- plus a negative control (out-of-roster-scope
    module still fails closed via scaffold''s own roster check). npm run validate
    green; retro-validate suite green (185 tests).'
  started: '2026-07-22T05:33:00Z'
  completed: '2026-07-22T07:49:00Z'
  evidence:
  - test: tests/ef-retro-discordance.test.mjs
  - test: tests/ef-retro-access-log.test.mjs (updated -- narrowed cross-import scan
      + new pinning test)
  - commit: ef-e1(P4-T5)
  - commit: 827952f
  verified_by:
  - P4-GATE
- id: P4-T6
  description: "Prespecified-protocol shape \u2014 human-only thresholds (FR-24):\
    \ author the protocol schema (tools/retro-validate/schemas/protocol.schema.json)\
    \ with slots for dangerous-miss rate, utility measures, and subgroup/analyzer/site\
    \ strata \u2014 every threshold field null/TBD-by-named-humans (const null in\
    \ E1; software never invents or defaults a clinical threshold). An unpopulated\
    \ protocol renders every harness report \"non-qualifying \u2014 protocol not prespecified\
    \ by humans\" (wired in P4-T4). Seeded populated-threshold fixture rejected fail-closed."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P4-T4
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  note: 'Prespecified-protocol shape (FR-24): tools/retro-validate/schemas/protocol.schema.json
    (tool-local) shapes the ONE kind of protocol document `report --protocol` may
    accept -- slots for dangerousMissRateThreshold, utilityMeasures (sensitivity/specificity/PPV/NPV
    thresholds), and strata.{subgroup,analyzer,site} (per-stratum threshold), every
    threshold leaf `const: null`, plus a REQUIRED non-empty `authoredBy` (named-human
    ownership -- FR-24 is an authorship requirement, not merely a null-threshold one).
    New lib/protocol.mjs (loadProtocolSchema/validateProtocolDocument/assertProtocolShape,
    same json-schema-lite reuse posture as boundary.mjs) + errors.mjs ProtocolError
    (UsageError subclass, EXIT_USAGE, same non-taxonomy-bloat rationale as RegistryError).
    Wired into lib/verbs/report.mjs: a supplied --protocol document is now schema-validated
    immediately after JSON-parse and BEFORE any report/provenance write -- a populated-threshold
    document throws ProtocolError fail-closed, zero output written. This is layered
    ON TOP OF (not instead of) P4-T4''s already-landed evaluateProtocolQualification,
    which independently never returns qualifying:true regardless of this schema''s
    own gate. Seeded fixtures: tests/fixtures/ef-retro/protocol/{null-threshold,populated-threshold}-protocol.json.
    New tests/ef-retro-protocol.test.mjs (15 tests: schema load/keyword-support, slot
    presence, const:null on every threshold leaf, both fixtures, all 3 threshold-slot
    locations independently rejecting a populated value, authorship requirement, closed-shape
    check). Updated tests/ef-retro-metrics.test.mjs: fixed the pre-existing ad-hoc
    --protocol literal in the report-verb acceptance test to the new schema-conformant
    shape (populatedFields assertion corrected to reflect findPopulatedProtocolFields''
    generic, schemaVersion-only metadata allowlist -- protocolId/authoredBy/description
    now legitimately show up as "populated" even on an all-null-threshold document;
    qualifying stays false regardless) and added a new report-verb integration test
    proving the seeded populated-threshold fixture is rejected fail-closed with NO
    agreement-report.json/run-provenance.json written.'
  started: '2026-07-22T05:33:00Z'
  completed: '2026-07-22T07:49:00Z'
  evidence:
  - test: tests/ef-retro-protocol.test.mjs
  - test: tests/ef-retro-metrics.test.mjs (updated)
  - commit: ef-e1(P4-T6)
  - commit: 0da0e9a
  verified_by:
  - P4-GATE
- id: P4-T7
  description: "Validation-data access log (FR-22), ADR-0006 audit clause: every check-fixtures/run/report\
    \ invocation appends a structured entry (actor identity from env/flag, timestamp,\
    \ purpose, corpus id, verb) to tools/retro-validate/access-log.jsonl \u2014 an\
    \ audit trail distinct from the review-record chain (no shared files, no shared\
    \ schema). Append-only (same enforcement pattern as P2-T3's chain layer); log\
    \ entries carry no case-level data, only corpus-level references."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P4-T2
  estimated_effort: 0.5 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  note: 'Access-log module + tool-local access-log-entry.schema.json (FR-22): every
    check-fixtures/run/report invocation logs unconditionally (success/boundary/usage
    paths), within-file sha256 hash chain proves append-only, seeded mutation/deletion
    fail closed (AccessLogChainError). Distinctness from review-record chain proven
    on 4 dimensions (schema /, file path, cross-import). access-log.jsonl is .gitignore''d
    (generated runtime artifact); existing P4-T1/P4-T2 tests updated to use isolated
    tmp log paths so npm test never mutates a tracked file.'
  started: '2026-07-22T05:33:00Z'
  completed: '2026-07-22T07:49:00Z'
  evidence:
  - test: tests/ef-retro-access-log.test.mjs
  - commit: ef-e1(P4-T7)
  - commit: c681c74
  verified_by:
  - P4-GATE
- id: P4-T8
  description: "E0 dangerous-miss corpus promotion adapter (FR-26, PRD OQ-6): implement\
    \ the deterministic adapter wrapping E0's existing dangerous-miss fixtures (tests/ef-cbc_suite_v1-dangerous-miss.test.mjs\
    \ corpus) in the fixture-corpus envelope (provenance synthetic, zero content mutation\
    \ \u2014 E0 fixtures remain the single source of truth). Adapter output lands\
    \ in the harness regression lane; a stability test pins adapter output bytes so\
    \ E0-corpus drift is caught, not absorbed."
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - P4-T3
  estimated_effort: 0.5 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  completed: '2026-07-22T07:49:00Z'
  evidence:
  - test: tests/ef-retro-e0-adapter.test.mjs
  - commit: ef-e1(P4-T8)
  - commit: '5990016'
  started: '2026-07-22T05:33:00Z'
  verified_by:
  - P4-GATE
- id: P4-T9
  description: "Retrospective data-source SPIKE charter (FR-25), ruling R6: author\
    \ docs/project_plans/SPIKEs/spike-007-retrospective-data-source.md \u2014 charter\
    \ only, SPIKE not run (running it + any real-data work = gate G3, out of scope,\
    \ stated in the charter). Contents: corpus/partner options (ADR-0006 Option-1\
    \ external-partner posture primary), DUA requirements, retention period + deletion\
    \ trigger, replay-pinning obligations, de-identification standard (Safe Harbor\
    \ / Expert Determination), and explicit success/verdict criteria for the future\
    \ SPIKE run."
  status: completed
  assigned_to:
  - spike-writer
  dependencies:
  - P4-T2
  estimated_effort: 0.75 pts
  priority: medium
  assigned_model: sonnet
  model_effort: adaptive
  started: '2026-07-22T05:33:00Z'
  completed: '2026-07-22T07:49:00Z'
  evidence:
  - commit: 536216a
  verified_by:
  - P4-GATE
- id: P4-GATE
  description: "task-completion-validator gate: verify Phase 4 exit gate \u2014 boundary\
    \ rejections 3/3 + identifier classes >=6 fail closed; double-run determinism\
    \ green; 5 metrics present and software-agreement-labeled; protocol thresholds\
    \ null with non-qualifying banner; access log distinct + append-only; adapter\
    \ stable; charter committed; npm run check green; ADR-delta check (ADR-0006 unchanged,\
    \ else escalate)."
  status: completed
  assigned_to:
  - task-completion-validator
  dependencies:
  - P4-T1
  - P4-T2
  - P4-T3
  - P4-T4
  - P4-T5
  - P4-T6
  - P4-T7
  - P4-T8
  - P4-T9
  estimated_effort: "\u2014"
  priority: critical
  assigned_model: sonnet
  model_effort: adaptive
  started: '2026-07-22T07:30:00Z'
  completed: '2026-07-22T07:49:00Z'
  evidence:
  - workflow: wf_871d7542-1a0 validator approved (P3, P2 after 1 fix cycle each; fixes
      e8c51e8..)
  verified_by:
  - opus-orchestrator
parallelization:
  batch_1:
  - P4-T1
  batch_2:
  - P4-T2
  batch_3:
  - P4-T3
  - P4-T7
  - P4-T9
  batch_4:
  - P4-T4
  - P4-T8
  batch_5:
  - P4-T5
  - P4-T6
  batch_6:
  - P4-GATE
  critical_path:
  - P4-T1
  - P4-T2
  - P4-T3
  - P4-T4
  - P4-T5
  - P4-GATE
  estimated_total_time: "5.5 pts critical path; 9.0 pts total phase (task table sums\
    \ to 9.0 pts; parent plan's Phase Summary table lists 8 pts for Phase 4 \u2014\
    \ a 1.0 pt discrepancy in the source plan, flagged rather than silently reconciled)"
blockers:
- id: BLOCKER-PHASE-DEP
  title: Phase 4 cannot open until Phase 1 exit gate (P1-GATE2, karen) passes
  severity: high
  blocking:
  - P4-T1
  resolution: Wait for .claude/progress/evidence-foundry-e1/phase-1-progress.md P1-GATE2
    to complete
  created: '2026-07-21'
success_criteria:
- id: SC-1
  description: npm run check green (quality gate; task-completion-validator)
  status: pending
- id: SC-2
  description: Harness structurally refuses any input not marked synthetic/de-identified;
    identifier-bearing fixtures 100% rejected
  status: pending
- id: SC-3
  description: Two runs over identical corpus + pinned digest produce byte-identical
    metric artifacts
  status: pending
- id: SC-4
  description: Every metric labeled software-agreement; zero clinical-performance
    language (grep-proven)
  status: pending
- id: SC-5
  description: Protocol thresholds null/human-only; reports non-qualifying-bannered
  status: pending
- id: SC-6
  description: SPIKE-007 charter committed; access log distinct from review audit
    trail
  status: pending
files_modified:
- tools/retro-validate/**
- tests/ef-retro-boundary.test.mjs
- tests/ef-retro-determinism.test.mjs
- tests/ef-retro-corpus.test.mjs
- tests/fixtures/ef-retro/**
- docs/project_plans/SPIKEs/spike-007-retrospective-data-source.md
progress: 100
updated: '2026-07-22'
---

# evidence-foundry-e1 - Phase 4: Retrospective Validation Harness

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Update progress via CLI:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py \
  -f .claude/progress/evidence-foundry-e1/phase-4-progress.md -t TASK-X -s completed
```

---

## Objective

Third of three parallel wave-2 workstreams (P2 ∥ P3 ∥ P4, tool-local schemas under
`tools/retro-validate/schemas/` by design so this phase never touches the `scripts/validate-kb.mjs`
barrier file). Builds the fixtures-only retrospective validation harness: fixture-corpus schema +
boundary enforcement, version-pinned deterministic replay, software-agreement metrics, discordance/
adjudication record model, human-only protocol thresholds, a distinct access log, the E0 dangerous-miss
corpus adapter, and the data-source SPIKE-007 charter. Duration ~4-5 engineer-days.

**Dependencies**: Phase 1 complete (P1-GATE2 `karen` passed). P4-T3's registry-digest pinning consumes
only the `releases/registry.json` **schema** (from P1-T5) — execution pins against a dry-run registry
fixture under `tests/fixtures/ef-retro/`, so this phase does not wait on Phase 3 (wave-parallel safe).

**Exit gate** (decisions block §1): harness refuses input not marked synthetic/de-identified; metrics
labeled software-agreement (never clinical performance); SPIKE charter committed; `npm run check` +
task-completion-validator.

---

## Implementation Notes

### Architectural Decisions

- **Ruling R6**: the SPIKE-007 charter is authored (P4-T9) but never run in this plan — running the
  SPIKE and any real-data work is gate G3, an external human-blocked state.
- **ADR-0006 boundary**: `check-fixtures` (P4-T2) is a schema-enforced, not procedural,
  de-identification boundary — every other verb calls it first and refuses to proceed on an unchecked
  or failing corpus.
- **FR-19 determinism**: `run` (P4-T3) resolves the candidate exclusively via a pinned registry digest
  — "current tree" execution is structurally impossible, not merely discouraged.
- **PRD OQ-6**: the E0 dangerous-miss corpus is promoted via a content-preserving adapter (P4-T8), not
  re-derived — one source of truth, drift caught by a stability test rather than silently absorbed.

### Known Gotchas

- Every metric name in `agreement-report.json` must carry the "software agreement" label — the report
  header must explicitly negate sensitivity/specificity/clinical-performance framing (P4-T4); this is
  a grep-tested requirement, not a style preference.
- P4-T3 (deterministic replay) runs at `extended` effort — it is this phase's risk-hotspot task
  (byte-identical double-run proof).
- **Task-table ambiguity resolved during scaffolding**: summing this phase's task-table `Estimate`
  column yields 9.0 pts, but the parent plan's Phase Summary table states Phase 4 is 8 pts. Recorded
  here rather than silently adjusted — flag for the plan owner if reconciliation is needed.

### Development Setup

Node ≥ 20. Gate before Phase 5 integration: `npm run check` green + `task-completion-validator` on
this phase's P4-GATE, independently of Phase 2/3's gates.

---

## Completion Notes

Fill in when Phase 4 is complete: what was built, key learnings, unexpected challenges, recommendations
for Phase 5 (cross-workstream integration dry-run, honesty audit).
