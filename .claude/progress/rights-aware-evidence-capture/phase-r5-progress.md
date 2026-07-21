---
type: progress
schema_version: 2
doc_type: progress
prd: rights-aware-evidence-capture
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
execution_model: sequential
phase: EP-R5
created: '2026-07-21'
title: 'EP-R5: Spec Amendments & Doc Truth (WP5)'
status: pending
started: null
completed: null
commit_refs: []
pr_refs: []
overall_progress: 0
completion_estimate: on-track
total_tasks: 7
completed_tasks: 1
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
- id: EPR5-T1
  description: '§15 — split measured from judged (FR-WP5-01): amend the reviewed spec''s
    §15 decision matrix, splitting the single "numeric threshold" row into measured/observed
    value vs consensus/judgment-derived recommendation, routing the latter to LEGAL_REVIEW_REQUIRED
    rather than facts-only candidate. Recorded as a dated amendment entry, not a silent
    in-place edit; states the routing rule and makes no determination about any specific
    threshold (OQ-1 stays open).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies: []
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: medium
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:30:00Z'
  evidence:
  - commit: df5eb0e
- id: EPR5-T2
  description: 'Appendix B — add and cite three authorities (FR-WP5-02): add Feist
    Publications v. Rural Telephone Service, 499 U.S. 340 (1991); CCC Information
    Services v. Maclean Hunter Market Reports, 44 F.3d 61 (2d Cir. 1994); and ADA
    v. Delta Dental Plans Ass''n, 126 F.3d 977 (7th Cir. 1997) to Appendix B. Each
    must be cited from the BODY, not merely listed. Citations are transcribed from
    the findings document, not reconstructed from memory.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR5-T1
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: medium
- id: EPR5-T3
  description: '§3.7, §16.2, §3.2 corrections (FR-WP5-03/04/05): fix §3.7''s conflation
    of government works (uncopyrightable, 17 U.S.C. §105) with government-funded works,
    flagging the PMC trap; re-attach §16.1''s contract caveat INLINE to §16.2 — re-wording
    does not defeat a contractual prohibition on incorporating the Materials into
    other materials, and copyright and contract are separate questions; scope §3.2''s
    EU sui generis database-right discussion with territorial scoping and the CJEU
    British Horseracing Board / Fixtures Marketing creation-vs-obtaining carve-out.
    Each edit is a recorded amendment.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR5-T2
  estimated_effort: 0.75 pts
  priority: high
  assigned_model: sonnet
  model_effort: medium
- id: EPR5-T4
  description: 'Citation hygiene (FR-WP5-06, findings §2.E): cite or remove [S7];
    de-overload [S1]/[S14]; correct [S11]''s pin-cite; use the ELI permalink for [S13];
    annotate that [S5]/[S6]/[S7] AAP URLs return 403 to automated clients so the "Verified"
    stamps are not machine-reproducible; pin [S15] FDA CDS guidance to January 29,
    2026 if an exact date is given. No citation is removed silently. The review found
    NO fabricated citations — the amendment record must say so.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR5-T3
  estimated_effort: 0.5 pts
  priority: medium
  assigned_model: sonnet
  model_effort: medium
- id: EPR5-T5
  description: 'Fix CLAUDE.md''s stale npm run check composition (FR-WP5-07): CLAUDE.md
    currently states `npm test + npm run validate + npm run build + npm run check:imports
    + npm run smoke`. The authoritative composition in package.json is `test && validate
    && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`.
    Correct CLAUDE.md and add a doc-truth check comparing the two strings. package.json
    is NOT edited by this task — the doc moves to the code, never the reverse (EP-R0
    barrier).'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies: []
  estimated_effort: 0.25 pts
  priority: high
  assigned_model: sonnet
  model_effort: medium
- id: EPR5-T6
  description: 'Record the corrected blocking picture (FR-WP5-08): record in CLAUDE.md
    / project memory that the 0/91 gap is ~2/3 attestation-shaped (60 rules) and ~1/3
    licensing-shaped (31 rules) — not wholly licensing-shaped — and that 13 bindable
    passages exist today, a fact currently recorded nowhere. Both statements cite
    .claude/findings/rights-governance-spec-v1.0-review-findings.md. Every figure
    is transcribed, none invented; the text must not imply any of the 13 has been
    bound — 0 of 91 rules remain grounded.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR5-T5
  estimated_effort: 0.25 pts
  priority: high
  assigned_model: sonnet
  model_effort: medium
- id: EPR5-T7
  description: 'NOTICE.md, docs/architecture.md §7, residual gap, deferred-item specs
    (FR-WP5-09, FR-WP5-10): update NOTICE.md and docs/architecture.md §7 to describe
    the rights/ tree, the release context, and the COVERAGE-ONLY gate posture; record
    residual gap R-1 (prohibited-excerpt detection is not deterministic) explicitly
    as open. Create the four deferred-item design-spec stubs (DEF-R1..DEF-R4) and
    populate deferred_items_spec_refs in the plan frontmatter. Neither document may
    imply any clearance exists. Sequenced LAST so it describes the substrate as shipped.'
  status: not_started
  assigned_to:
  - general-purpose
  dependencies:
  - EPR5-T6
  - EP-R0
  estimated_effort: 0.25 pts
  priority: high
  assigned_model: sonnet
  model_effort: medium
parallelization:
  batch_1:
  - EPR5-T1
  - EPR5-T5
  batch_2:
  - EPR5-T2
  - EPR5-T6
  batch_3:
  - EPR5-T3
  batch_4:
  - EPR5-T4
  batch_5:
  - EPR5-T7
  critical_path:
  - EPR5-T1
  - EPR5-T2
  - EPR5-T3
  - EPR5-T4
  - EPR5-T7
  estimated_total_time: 3.0 pts (critical path)
blockers: []
success_criteria:
- id: SC-1
  description: §15 splits measured from judged with distinct routing, as a recorded
    amendment (EPR5-T1)
  status: not_started
- id: SC-2
  description: Feist, CCC, ADA added to Appendix B and cited from the body (EPR5-T2)
  status: not_started
- id: SC-3
  description: §3.7 works-vs-funded, §16.2 inline contract caveat, §3.2 EU scoping
    all corrected (EPR5-T3)
  status: not_started
- id: SC-4
  description: All six citation-hygiene items resolved or annotated; "no fabricated
    citations" stated (EPR5-T4)
  status: not_started
- id: SC-5
  description: CLAUDE.md's npm run check string byte-identical to package.json's;
    doc-truth check in place (EPR5-T5)
  status: not_started
- id: SC-6
  description: 60 attestation-shaped / 31 licensing-shaped / 13 bindable recorded
    with citations (EPR5-T6)
  status: not_started
- id: SC-7
  description: NOTICE.md + docs/architecture.md §7 describe the substrate; neither
    implies a clearance (EPR5-T7)
  status: not_started
- id: SC-8
  description: Residual gap R-1 recorded as open (EPR5-T7)
  status: not_started
- id: SC-9
  description: All four deferred items (DEF-R1..DEF-R4) have spec paths in deferred_items_spec_refs
    (EPR5-T7)
  status: not_started
- id: SC-10
  description: No legal conclusion drawn; no threshold classified as measured or judged
    (OQ-1 stays open)
  status: not_started
- id: SC-11
  description: package.json untouched (EP-R0 barrier); CLAUDE.md edited by this phase
    only
  status: not_started
- id: SC-12
  description: npm run check green
  status: not_started
- id: SC-13
  description: task-completion-validator sign-off
  status: not_started
files_modified:
- docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.md
- CLAUDE.md
- NOTICE.md
- docs/architecture.md
- docs/project_plans/design-specs/rights-clearance-workflow.md
- docs/project_plans/design-specs/rights-release-gate.md
- docs/project_plans/design-specs/single-source-rule-reanchoring.md
- docs/project_plans/design-specs/first-party-rights-record.md
progress: 14
updated: '2026-07-21'
---

# rights-aware-evidence-capture - Phase EP-R5: Spec Amendments & Doc Truth

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/rights-aware-evidence-capture/phase-r5-progress.md -t EPR5-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

Amend the reviewed rights-governance spec and correct the project's own documentation (WP5): split
measured from judged in §15, add and *cite* three authorities in Appendix B, fix §3.7 / §16.2 / §3.2,
resolve citation hygiene, make `CLAUDE.md`'s `npm run check` string byte-identical to `package.json`'s,
record the corrected 60/31/13 blocking picture, and describe the shipped `rights/` substrate in
`NOTICE.md` and `docs/architecture.md` §7 without implying any clearance exists.

**Phase-level entry criteria**: `main` at `npm run check` green; the reviewed spec bundle present; the
review findings (`cd15b4a`) available as the source of every number quoted.

**Wave 1, parallel with EP-R0** — no code dependency, and the measured-vs-judged framing needs
correcting in the reference spec *before* EP-R3 builds an axis on it. **This phase has no
phase-level dependency on EP-R0** (`EP-R5: depends_on: []`): EPR5-T1..T6 start immediately, and only
EPR5-T7 blocks — until EP-R0 merges — via the task-level dependency recorded on that task and the
wave-1 `intra_wave_ordering` entry (`EPR5-T7 ← EP-R0`) in the plan.

---

## Implementation Notes

### Architectural Decisions

- **`CLAUDE.md` is a serialization barrier owned exclusively by EP-R5.** No other phase may edit it.
  In exchange, EP-R5 touches no schema, no gate, and no `package.json` entry — its file set is
  disjoint from every other phase's, which is what makes W1 parallelism safe.
- **Standing constraint**: amendments are recorded **as amendments**, never as silent edits to the
  reviewed spec. Case law is cited as the reason a data model needs a particular axis — never as a
  determination of how any specific item should be classified. This phase draws no legal conclusion
  and states none.
- EPR5-T7 is sequenced **last** so it describes the substrate EP-R0 builds in the same wave *as
  shipped* rather than as planned.

### Patterns and Best Practices

- Every number is **transcribed** from `.claude/findings/rights-governance-spec-v1.0-review-findings.md`,
  never reconstructed. The same rule applies to the three case citations — copy them exactly.
- A citation added to Appendix B but not referenced from the body does not satisfy EPR5-T2; the
  authority has to do work in the argument.
- The doc-truth check for EPR5-T5 compares the two strings mechanically and fails on drift, so the
  documentation cannot silently rot again.

### Known Gotchas

- The authoritative `npm run check` composition lives in `package.json`, **not** `CLAUDE.md` (this
  phase is what fixes that, in EPR5-T5): `test && validate && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`.
- No task may write a `CLEARED_*` status, an attestation, `clinicalApprovers[]`, `approvedBy[]`, or an
  authoritative `derived_synthesis`. Ship the plumbing and the fails-closed test, never the value.
- `json-schema-lite` silently ignores `format: "uri"` — use `pattern`.
- Date-dependent gates take `--as-of`/env, never `Date.now()` (byte-identical determinism).
- The legal axis (`overall_status`) lives on the rights record, joined via the ledger — not on the
  evidence item. Item-level axes are `evidence_item_type`, `judgment_basis`, `rights_component_class`.
- **The doc moves to the code, never the reverse.** EPR5-T5 must not edit `package.json` to match
  `CLAUDE.md` — `package.json` is an EP-R0-exclusive barrier.
- The review found **no fabricated citations**. The amendment record must say so explicitly, or a
  future reader will infer a fabrication problem from the hygiene task's existence.
- The 60/31/13 text must not imply any of the 13 bindable passages **has been bound** — 0 of 91 rules
  remain grounded.
- A reviewer check on `NOTICE.md` and `docs/architecture.md` §7 must confirm the words "cleared",
  "licensed", or "approved" appear only in explicitly-negated form.
- EP-R5 cannot be sealed until all four deferred items (DEF-R1..DEF-R4) have a design-spec path in
  `deferred_items_spec_refs`, and, if `findings_doc_ref` is populated, the findings doc is finalized.

### Development Setup

No code, no new dependencies. `npm run check` must still be green at exit — the doc-truth check lands
inside the existing test suite, not as a new npm script.

---

## Completion Notes

_(Fill in when phase is complete: the amendment entries as recorded, the citation-hygiene disposition
for all six items, proof the `CLAUDE.md`/`package.json` strings match, and the four deferred-item spec
paths.)_
