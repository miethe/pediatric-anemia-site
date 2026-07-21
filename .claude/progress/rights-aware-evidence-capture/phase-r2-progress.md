---
type: progress
schema_version: 2
doc_type: progress
prd: rights-aware-evidence-capture
feature_slug: rights-aware-evidence-capture
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
execution_model: sequential
phase: EP-R2
created: '2026-07-21'
title: 'EP-R2: Source Rights Metadata (WP2)'
status: completed
started: '2026-07-21T16:40:00-04:00'
completed: '2026-07-21T19:30:00-04:00'
commit_refs:
- '9239762'
- 61a2ea7
- 3225e63
- f11530f
- 511269d
- ef01930
- f26ee9a
- 13a617b
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
- id: EPR2-T1
  description: '$defs/source gains structured licence / access / terms (FR-WP2-01,
    FR-WP2-05): extend schemas/evidence.schema.json $defs/source with structured license,
    access_basis, and terms fields drawn from spec vocabulary, under the existing
    additionalProperties:false posture. Fields are required, not optional, with explicit
    typed unknown/null where genuinely unassessed. Use pattern for any URL-shaped
    field — never format:"uri" (FR-WP0-08).'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EP-R0
  estimated_effort: 1.25 pts
  priority: critical
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T16:40:00-04:00'
  completed: '2026-07-21T16:48:33-04:00'
  evidence:
  - commit: '9239762'
- id: EPR2-T2
  description: 'terms_snapshot — locator only, never text (FR-WP2-02, D1): add a terms_snapshot
    reference field recording what terms were observed and when, by locator and retrieval
    date. It records no terms prose; the schema must have no free-text body property
    capable of holding terms language.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR2-T1
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T16:48:33-04:00'
  completed: '2026-07-21T16:53:13-04:00'
  evidence:
  - commit: 61a2ea7
- id: EPR2-T3
  description: 'Atomic backfill of 6 sources; AAP block machine-readable (FR-WP2-03):
    backfill all 6 sources in the same commit as the schema change. Encode AAP2026_IDA''s
    access basis as subscription, its terms as barring altering/abridging/adapting
    and incorporating the Materials into other materials, and commercial_use: not_granted_by_subscription
    (findings §1, Appendix A). Restriction facts are transcribed from the recorded
    terms locator, not authored.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR2-T2
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - commit: 3225e63
- id: EPR2-T4
  description: 'CDC2025_LEAD — government *work* vs government-*funded* (FR-WP2-04):
    encode CDC2025_LEAD as a U.S. federal government work under 17 U.S.C. §105, and
    record the distinction the reviewed spec §3.7 conflates — government works are
    uncopyrightable; government-funded works by university authors are not (abundant
    in the PMC corpus). Records a statutory basis already in the findings; makes no
    new legal determination.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR2-T3
  estimated_effort: 0.5 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T00:00:00Z'
  completed: '2026-07-21T00:00:00Z'
  evidence:
  - commit: f11530f
- id: EPR2-T5
  description: 'Source -> rights-record gate, seam consumer (FR-WP2-06): extend scripts/validate-kb.mjs
    so every evidence source resolves to a rights record in rights/rights-ledger.json,
    reusing EP-R1''s exported ledger-resolution helper unchanged — call site only,
    no restructure, rename, or re-signature.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR1-T2
  - EPR2-T4
  estimated_effort: 0.75 pts
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T17:20:00-04:00'
  completed: '2026-07-21T17:36:59-04:00'
  evidence:
  - commit: 511269d
- id: EPR2-T6
  description: 'R-P2 / R-P4 — consumer resilience + browser smoke (FR-WP2-07): target_surfaces
    src/evidence.js, src/engine.js, src/app.js, scripts/evidence/build-evidence-pack.mjs
    must not throw on a legacy-shaped source record encountered mid-migration, and
    absent rights fields must render as "rights position unassessed", never "unrestricted".
    Carries the phase''s R-P4 runtime obligation (npm run smoke:browser + check:imports);
    src/app.js is the only browser surface any phase of this feature touches.'
  status: completed
  assigned_to:
  - general-purpose
  dependencies:
  - EPR2-T5
  estimated_effort: 1.0 pt
  priority: high
  assigned_model: sonnet
  model_effort: high
  started: '2026-07-21T18:00:00-04:00'
  completed: '2026-07-21T19:30:00-04:00'
  evidence:
  - commit: 13a617b
  - test: tests/evidence-rights-resilience.test.mjs
parallelization:
  batch_1:
  - EPR2-T1
  batch_2:
  - EPR2-T2
  batch_3:
  - EPR2-T3
  batch_4:
  - EPR2-T4
  batch_5:
  - EPR2-T5
  batch_6:
  - EPR2-T6
  critical_path:
  - EPR2-T1
  - EPR2-T2
  - EPR2-T3
  - EPR2-T4
  - EPR2-T5
  - EPR2-T6
  estimated_total_time: 5.0 pts (critical path)
blockers: []
success_criteria:
- id: SC-1
  description: $defs/source carries required license, access_basis, terms; omission
    fails, explicit unknown passes (EPR2-T1)
  status: completed
  evidence: 'commit 9239762; tests/evidence-source-rights-metadata.test.mjs'
- id: SC-2
  description: No format "uri" introduced anywhere; pattern used or the gap documented
    in-schema (EPR2-T1)
  status: completed
  evidence: 'commit 9239762; tests/evidence-source-rights-metadata.test.mjs ("no format:
    uri" scan)'
- id: SC-3
  description: terms_snapshot is locator + date only; terms prose is structurally
    unstorable (EPR2-T2)
  status: completed
  evidence: 'commit 61a2ea7; tests/evidence-source-terms-snapshot.test.mjs'
- id: SC-4
  description: All 6 sources validate in the same commit as the schema change (EPR2-T3)
  status: completed
  evidence: 'commit 3225e63; tests/evidence-source-rights-backfill.test.mjs'
- id: SC-5
  description: 'AAP block is machine-readable: subscription basis, non-incorporable,
    commercial_use not_granted_by_subscription (EPR2-T3)'
  status: completed
  evidence: 'commit 3225e63, follow-up ef01930 (terms_snapshot locator captured —
    see Completion Notes); tests/evidence-source-rights-backfill.test.mjs'
- id: SC-6
  description: government_work and government_funded are distinct; funding alone cannot
    mark public domain (EPR2-T4)
  status: completed
  evidence: 'commit f11530f; tests/evidence-source-government-basis.test.mjs'
- id: SC-7
  description: Every source resolves to a rights record; EP-R1's helper unmodified
    (EPR2-T5, R-P3)
  status: completed
  evidence: 'commit 511269d; tests/rights-validate-gates.test.mjs'
- id: SC-8
  description: All 4 consumers survive a legacy record; unassessed never renders as
    unrestricted (EPR2-T6, R-P2)
  status: completed
  evidence: 'commit 13a617b; tests/evidence-rights-resilience.test.mjs (19 cases
    across src/evidence.js, src/evidence/registry.js, src/engine.js,
    scripts/evidence/build-evidence-pack.mjs)'
- id: SC-9
  description: npm run smoke:browser + check:imports pass (EPR2-T6, R-P4)
  status: completed
  evidence: 'commit 13a617b; npm run check full run, 2026-07-21 — both steps green'
- id: SC-10
  description: No CLEARED_* status, attestation, or approval value written; package.json
    untouched; schemas/evidence.schema.json merged before EP-R3 starts
  status: completed
  evidence: 'package.json untouched across every EP-R2 commit (verified via git diff
    per-commit); no CLEARED_*/attestation vocabulary introduced (D6 scans in
    tests/evidence-source-rights-metadata.test.mjs, tests/evidence-source-rights-backfill.test.mjs,
    tests/evidence-source-government-basis.test.mjs all pass); schema merge to main
    is a repo-level action outside this branch, tracked separately'
- id: SC-11
  description: npm run check green
  status: completed
  evidence: 'full `npm run check` run 2026-07-21 (post-EPR2-T6, commit 13a617b):
    test (1179/1179) && validate && coverage:rules (91/91) && build && verify:d4 &&
    check:imports && smoke:browser && smoke — all green, exit 0. This is the first
    verified green full-gate run for this phase; the prior verified state
    (EPR2-T5) had only validate+test individually confirmed.'
- id: SC-12
  description: task-completion-validator sign-off
  status: not_started
  evidence: 'Not claimed here — a dedicated task-completion-validator review has not
    run against this phase. SC-11''s green `npm run check` is necessary but not
    sufficient for this criterion; do not treat this progress doc as that sign-off.'
files_modified:
- schemas/evidence.schema.json
- modules/anemia/evidence.json
- scripts/validate-kb.mjs
- src/evidence.js
- src/engine.js
- src/app.js
- scripts/evidence/build-evidence-pack.mjs
progress: 100
updated: '2026-07-21'
---

# rights-aware-evidence-capture - Phase EP-R2: Source Rights Metadata

**YAML frontmatter is the source of truth for tasks, status, and assignments.** Do not duplicate in markdown.

Use CLI to update progress:

```bash
python .claude/skills/artifact-tracking/scripts/update-status.py -f .claude/progress/rights-aware-evidence-capture/phase-r2-progress.md -t EPR2-T1 -s completed --started <ISO8601> --completed <ISO8601> --evidence "commit:<sha>"
```

---

## Objective

The largest single safety gain on offer: `schemas/evidence.schema.json`'s `$defs/source` today records
**no licence, access basis, or terms at all**. That `AAP2026_IDA` is unusable for reuse exists only as
prose in `.claude/findings/` and as one hardcoded boolean. This phase gives every source structured
licence / access-basis / terms fields, a locator-only `terms_snapshot`, and a source→rights-record
gate — and makes the AAP and CDC positions machine-checkable rather than narrative.

**Phase-level entry criteria**: EP-R0 merged (`rights/` tree, amended vendored schemas, gates wired).
EP-R1's `scripts/validate-kb.mjs` ledger-resolution helper available or landing in the same wave.

**Wave 2, parallel with EP-R1.**

---

## Implementation Notes

### Architectural Decisions

- **Two barriers meet here.** (1) `schemas/evidence.schema.json` — EP-R2 owns it **first**, EP-R3
  second, strictly ordered; EP-R3 branches from EP-R2's **merge commit**, not its branch tip. EP-R2
  adds *source*-level fields only; item-level axis fields belong to EP-R3 and must not be anticipated.
  (2) `scripts/validate-kb.mjs` — consumer side; `integration_owner = EP-R1`.
- New fields are **required with explicit typed `unknown`**, not optional. Omission and "unassessed"
  must be distinguishable; missingness is never treated as normal.
- The migration is atomic: schema change and the 6-source backfill land in **one commit**, reviewed as
  a generated-content diff.

### Patterns and Best Practices

- Restriction facts are **transcribed from the recorded terms locator**, never authored or summarised
  from memory.
- EPR2-T4 records a statutory basis already recorded in the findings — it makes **no new legal
  determination**. The schema's own field descriptions carry the works-vs-funded distinction so the
  next author cannot re-conflate them.
- R-P2 resilience is a first-class task, not a cleanup: absent rights fields render "rights position
  unassessed", **never** "unrestricted".

### Known Gotchas

- The authoritative `npm run check` composition lives in `package.json`, **not** `CLAUDE.md` (stale
  until EPR5-T5 lands): `test && validate && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`.
- No task may write a `CLEARED_*` status, an attestation, `clinicalApprovers[]`, `approvedBy[]`, or an
  authoritative `derived_synthesis`. Ship the plumbing and the fails-closed test, never the value.
- `json-schema-lite` silently ignores `format: "uri"` — use `pattern`.
- Date-dependent gates take `--as-of`/env, never `Date.now()` (byte-identical determinism).
- The legal axis (`overall_status`) lives on the rights record, joined via the ledger — not on the
  evidence item. Item-level axes are `evidence_item_type`, `judgment_basis`, `rights_component_class`.
- `additionalProperties: false` makes this a genuinely atomic migration — a schema change without the
  backfill in the same commit leaves the repo red between commits.
- EPR2-T5 must leave EP-R1's helper **byte-unchanged** (`git diff` proves it): call site only. A
  perceived shape problem is an escalation, not a refactor.
- `terms_snapshot` must be structurally incapable of holding prose — a fixture storing a paragraph of
  terms text has to fail validation, not merely be discouraged by convention.
- `package.json` is untouched (EP-R0 barrier). New checks go inside `validate-rights.mjs` or
  `validate-kb.mjs`, never as a new npm script.

### Development Setup

No new dependencies. `npm run smoke:browser` and `npm run check:imports` are part of this phase's exit
gate, not just the standing `check` — `src/app.js` is the only browser surface this feature touches.

---

## Completion Notes

Phase EP-R2 is complete: all 6 tasks landed, all 11 verifiable success criteria (SC-1..SC-11) are met,
`npm run check` is green (2026-07-21, commit 13a617b). SC-12 (task-completion-validator sign-off) is
deliberately left `not_started` — that is a distinct, independent review this progress doc does not
substitute for.

**Landed `$defs/source` shape**: `license` (`status`/`rights_holder`/`license_url`/`noncommercial_only`/
`no_derivatives`/`government_basis`), `access_basis`, `terms` (`incorporation_into_other_products`/
`adaptation`/`commercial_use`/`redistribution`/`sublicensing`), `terms_snapshot` (`status`/`locator`/
`sha256`/`retrieved_at`) — all required, all with an explicit typed `unknown` for genuinely unassessed
(commit 9239762/61a2ea7).

**One-commit migration**: commit 3225e63 backfills all 6 sources atomically with the schema change
already merged ahead of it (EPR2-T1/T2).

**AAP encoding as shipped** (`AAP2026_IDA`): `access_basis: institutional_subscription`;
`license.status: copyrighted`; `terms.commercial_use: not_granted_by_subscription`;
`terms.incorporation_into_other_products`/`terms.adaptation: restricted_without_written_approval`;
`terms.redistribution: restricted`. `terms_snapshot` was landed by EPR2-T3 (commit 3225e63) in the
gap state `status: not_captured` (locator/sha256/retrieved_at all null) — **this is the follow-up
review flagged**: the `terms` restriction facts were already correctly transcribed from a real,
in-repo finding ([S5] in the vendored rights-governance spec's Appendix A / citation list — "AAP
Pediatric Care Online Terms and Conditions", human-verified 2026-07-21), but nothing had wired that
locator into `terms_snapshot`, so the provenance chain read as "prose finding → structured field"
rather than "recorded locator → structured field" (exactly what D1 exists to prevent). Commit
**ef01930** closes that gap by populating `terms_snapshot` with the real locator this task's own
facts already traced to: `status: captured`, `locator: "https://publications.aap.org/pediatriccare/pages/terms"`,
`retrieved_at: "2026-07-21"`. `sha256` stays `null`, honestly: `publications.aap.org` returns HTTP 403
to automated clients (Cloudflare bot-challenge — reconfirmed this session via `curl` and `WebFetch`,
consistent with the spec's own "Automated-retrieval note on [S5]/[S6]/[S7]"), so an agent cannot
independently compute a content hash without bypassing bot detection, which is out of bounds; only a
human browser session can take that step, and it remains open rather than fabricated. No plan-owner
sign-off was sought or needed for "prose transcription as an accepted substitute" — the real recorded
locator was available in-repo and is used directly instead.

**CDC encoding as shipped** (`CDC2025_LEAD`): `license.status: us_federal_government_work`,
`license.government_basis.government_work: true`, `government_funded: null` — the 17 U.S.C. §105
government-*work* basis, kept structurally distinct from government-*funded* per FR-WP2-04 (commit
f11530f).

**EP-R1's ledger-resolution helper (`resolveRightsRecordsForIdentifier`, `scripts/validate-kb.mjs`)
is unmodified by EPR2-T5** — commit 511269d adds a call site (`validateSourceRightsCoverage`) only;
`git diff` on the helper's own body across the phase is empty.

**Cross-phase edit, recorded per barrier-crossing discipline (not absorbed silently)**: EPR2-T3
(commit 3225e63) widened `tests/rights-substrate.test.mjs`'s D4 "no inline rights key" scan —
an **EP-R0-owned file** (EPR0-T1) — with an exact-key-name allowlist entry for `license.rights_holder`
(`ALLOWLISTED_RIGHTS_SUBSTRING_KEYS = new Set(['rights_holder'])`). This is a genuine cross-phase edit:
EP-R2 modified a test file EP-R0 created and owns. The narrowing itself is correct and intentionally
scoped — `rights_holder` is a plain copyright-attribution field required by `$defs/license`
(mirroring `schemas/rights/rights_record.schema.json`'s `copyright.rights_holder` vocabulary), not a
rights *record*, and the exemption is by exact key name only: the literal key `"rights"` and any
`extensions.rights`-shaped path still fail the scan (see the test file's own header comment, EPR2-T3
block, for the full rationale). No plan-owner review was performed or claimed for this crossing at the
time — that is the gap this note exists to close: the edit is correct on inspection and this record
makes it visible to the plan owner rather than leaving it to be discovered incidentally in a future
diff.

**`npm run check` (SC-11)**: the authoritative composition is `package.json`'s (`test && validate &&
coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`), not `CLAUDE.md`'s
stale list. Run in full 2026-07-21 against commit 13a617b: 1179/1179 tests, KB validation clean,
91/91 rule coverage, build/verify:d4/check:imports/smoke:browser/smoke all green, exit 0. This is the
first time every step has been run together for this phase — the previously-recorded "green" state
(EPR2-T5) had only `validate` and `test` individually confirmed, and `npm test` alone had never
actually been run to completion since EPR2-T1 first touched `modules/anemia/evidence.json`: doing so
surfaced (and this phase's own commits then fixed) a pre-existing, unrelated stale-manifest condition
— `modules/anemia/module.json`'s `clinicalContentHash` had gone stale the moment `ef01930` touched
`evidence.json` again after EPR2-T4's own last re-sign, cascading through
`docs/safety/hazard-control-matrix.json`'s and the 10 `tests/fixtures/dangerous-miss/*.json` fixtures'
`moduleFileDigest`/`fixtureDigest` pins (same class of consequence EPR2-T3/T4 had already documented
handling) — plus `tests/golden/*.json`'s expected shape, once EPR2-T6 added the new
`sourceRightsPosition` field to `provenance.ruleAudit[]` (546 insertions, 0 deletions across all 6
fixtures — confirmed zero clinical-output drift before committing). See commit 13a617b's message for
the full accounting.
