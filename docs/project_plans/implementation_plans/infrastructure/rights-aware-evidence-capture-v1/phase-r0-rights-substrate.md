---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-R0: Rights Substrate"
status: draft
created: 2026-07-21
phase: EP-R0
phase_title: "Rights Substrate"
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
feature_slug: rights-aware-evidence-capture
entry_criteria: "main at npm run check green; the reviewed spec bundle and its checksums.sha256 present under docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/; RF-HANDOFF §9 conflict list read."
exit_criteria: "rights/ tree exists with a commercial:false release context, 5 vendored schemas plus a declared amendment layer, 6 seeded triage-only rights records, validate-rights.mjs shipping >=4 coverage/consistency gates each with a fails-closed test, all feature gate wiring landed in package.json, npm run check green."
planning_maturity: ready
---

# Phase EP-R0: Rights Substrate (WP0)

**Maps to PRD WP0.** **5 pts.** Wave 1, parallel with EP-R5.

**Dependencies**: none (wave 1 entry phase).
**Assigned Subagent(s)**: `general-purpose` (primary), model `sonnet`, effort `medium`.
**Entry criteria**: `main` green; spec bundle + `checksums.sha256` present; handoff §9 read.
**Exit criteria**: as frontmatter. No `CLEARED_*` status, attestation, or approval value exists in any
artifact this phase creates.

## Integration Ownership (R-P3)

`package.json` is a **serialization barrier owned exclusively by EP-R0**. All gate wiring for the
entire feature — every npm script this feature will ever need — lands here in EPR0-T6. EP-R1 through
EP-R5 add checks *inside* `scripts/validate-rights.mjs`; none of them may add an npm script or touch
`package.json`. If a later phase believes it needs a new script, that is an escalation to the plan
owner, not a local edit.

`scripts/validate-rights.mjs` is a second serialization barrier and **EP-R0 is its
`integration_owner`.** EP-R1, EP-R2 and EP-R3 all add gates to this file, and EP-R1 ∥ EP-R2 share a
wave. EPR0-T5 therefore fixes the module's contract, not just its first four gates: one pure exported
function per gate, registered in a single exported gate list, so a later phase adds a gate by
appending an entry rather than by editing existing code. No later phase may restructure the module,
rename a gate, or change an existing gate's signature — that is an escalation to the plan owner.

EP-R0 does not touch `scripts/validate-kb.mjs` (EP-R1/EP-R2 own it) or `schemas/evidence.schema.json`
(EP-R2 then EP-R3 own it).

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EPR0-T1 | `rights/` tree + release context | Per FR-WP0-01 and FR-WP0-02 (D4): create the top-level `rights/` tree — `release-context.json`, `rights-records.json`, `rights-failures.json`, `rights-ledger.json`. `release-context.json` declares `commercial: false`, `use_type: internal_research`, plus territory and channel scope using spec §5.2 intended-use vocabulary. No rights data is written inline into any clinical JSON file. | The four files exist and parse. A test asserts no `extensions.rights` key (or any inline rights key) appears in `rules.json`, `candidates.json`, `evidence.json`, or `reference-ranges.json`. `release-context.json` records `commercial: false`; a fixture asserting commercial use against this context fails validation. | 0.75 pts | general-purpose | sonnet | medium | — |
| EPR0-T2 | Vendor the 5 spec schemas with provenance | Per FR-WP0-03: copy `rights_record`, `content_reuse_assessment`, `permission_record`, `rights_failure`, `rights_extension` into `schemas/rights/`. Record each file's source path and spec-bundle checksum in a new `schemas/rights/VENDORING.md`. Precedent: `openapi.yaml`. | Each vendored file's recorded checksum matches the corresponding entry in the spec bundle's `checksums.sha256` at the moment of vendoring. A test recomputes provenance and fails on any divergence not declared in `VENDORING.md`. | 1.0 pt | general-purpose | sonnet | medium | EPR0-T1 |
| EPR0-T3 | Declared local amendment layer (handoff §9 + D6) | The vendored schemas are **not usable as published**. Apply and individually annotate: (§9.3) add `unknown` to `access.basis`, treated as blocking; (§9.4) designate one home per TDM/model-training restriction and mark the duplicate deprecated-in-copy; (§9.6) replace `format: "uri"` with `pattern` on `license_url`/`terms_url`, and forbid the empty `contract` object; (§9.2) annotate the §5.1-prose-vs-enum divergence and declare the **enum** authoritative for `rights_component_class`; (§9.5) record that `rights_record` cannot describe first-party content, so `derived_synthesis` gets no rights record in this feature (DEF-R4); (D6) apply the reviewer/clearance constraints **to the field paths that actually exist in the vendored v1.0 schemas** — `rights_record.review.human_reviewer` → `null`; `rights_record.review.counsel_reviewer` → `null`; `rights_record.review.review_status` → must not be `counsel_approved`; `rights_record.overall_status` → must not be any `CLEARED_*` member; `content_reuse_assessment.review.clinical_reviewer` → `null`; `rights_failure.review.reviewed_by` → `maxItems: 0`. **There is no `approvals.clinical_owner` field and no approver array in `rights_record`** — `approvals.clinical_owner` exists only in the bundle's non-vendored markdown template, so a constraint naming it would be a silent no-op. Open each schema file before writing the amendment; do not infer a path. | Every amendment appears as a named, rationale-carrying entry in `schemas/rights/VENDORING.md` and is detectable by EPR0-T2's provenance test as *declared*. **Negative criterion:** a fixture that sets `rights_record.review.human_reviewer` or `.counsel_reviewer` to any non-null value, sets `review.review_status` to `counsel_approved`, sets `content_reuse_assessment.review.clinical_reviewer` to any non-null value, adds an entry to `rights_failure.review.reviewed_by`, or puts any `CLEARED_*` value in `rights_record.overall_status`, fails schema validation — this task ships the constraint and writes no approver, reviewer, or clearance value. A companion test asserts every constrained path **resolves in the vendored schema**, so a future typo cannot silently disable a constraint. No `format: "uri"` remains anywhere under `schemas/rights/`. | 1.0 pt | general-purpose | sonnet | medium | EPR0-T2 |
| EPR0-T4 | Seed 6 triage-only rights records + failure cross-links | Per FR-WP0-04 and FR-WP0-05: seed one `rights_record` per KB-cited source (6 records) from RF-EV-003. **`agent_triage_only` is a member of `review.review_status`, not of `overall_status`** (verify in `rights_record.schema.json` before writing) — so each record sets `review.review_status: agent_triage_only` **and**, independently, `overall_status: UNKNOWN`. Populate `rights/rights-failures.json` cross-linking the known open failures to their existing identifiers (REG-002, EP3T5-F01, EP3T5-F02). | 6 records exist and validate against the amended vendored schema. **Negative criterion:** two separate assertions — (a) every record's `review.review_status === 'agent_triage_only'`, and (b) every record's `overall_status === 'UNKNOWN'` — plus the string `CLEARED_` appearing in no file under `rights/`. A single combined assertion over one field is not sufficient. Every failure identifier resolves to an existing record or audit file; a dangling reference fails validation. | 0.75 pts | general-purpose | sonnet | medium | EPR0-T3 |
| EPR0-T5 | `scripts/validate-rights.mjs` — 4 coverage/consistency gates | Per FR-WP0-06 and FR-WP0-07 (D7): pure exported functions plus a thin CLI. Ships ≥ 4 deterministic gates: (a) bidirectional missing-assessment coverage, (b) blocking-status **enum membership** (membership, not value-judgement), (c) open-critical-failure presence check, (d) use/territory/channel set-containment against `release-context.json`. Any date-sensitive check takes `--as-of` or an env value. | Each gate is an exported pure function with a unit test. **No gate reads a `overall_status` value and fails on its value** — a dedicated test asserts a record at `overall_status: UNKNOWN` passes. `grep` finds no `Date.now()` in the file; two runs at different wall-clock times against unchanged input produce byte-identical output. | 1.0 pt | general-purpose | sonnet | high | EPR0-T4 |
| EPR0-T6 | `package.json` gate wiring + fails-closed resilience suite | Per FR-WP0-09 (serialization barrier): wire `validate-rights.mjs` into `npm run validate` and land **all** gate wiring this feature will need, in this task only. That explicitly includes the **EP-R4 brief-generator entry point — add a `rights:brief` script** (`node scripts/rights/build-decision-brief.mjs`) now, even though `scripts/rights/build-decision-brief.mjs` does not exist until EPR4-T2; EP-R4 fills in the script's target and must not add an npm entry of its own. Any other script a later phase will need must be named and landed here too. Add `tests/rights-gate-failsclosed.test.mjs` proving each EPR0-T5 gate fails when its precondition is unmet, not merely that it passes on good input. Preserve the zero-dependency posture. | `npm run validate` exits non-zero when any gate's precondition is unmet, and exits 0 on the seeded substrate. Each of the 4 gates has a distinct failing fixture. `package.json` gains no `dependencies`/`devDependencies`. `npm run check` green with the authoritative composition (`test && validate && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`). | 0.5 pts | general-purpose | sonnet | medium | EPR0-T5 |

**Phase total: 5 pts.**

## Phase EP-R0 Quality Gates

- [ ] `rights/` tree exists; no inline rights key in any clinical JSON file (EPR0-T1)
- [ ] `release-context.json` declares `commercial: false`, `use_type: internal_research` (EPR0-T1)
- [ ] 5 schemas vendored with byte-traceable provenance; every divergence declared (EPR0-T2/T3)
- [ ] All six handoff §9 conflicts are addressed or explicitly recorded as deferred (EPR0-T3)
- [ ] D6 null/`maxItems: 0` constraints ship on real, resolvable schema paths (`rights_record.review.human_reviewer`/`.counsel_reviewer`/`.review_status`, `rights_record.overall_status`, `content_reuse_assessment.review.clinical_reviewer`, `rights_failure.review.reviewed_by`); **zero** approver, reviewer, or clearance values written (EPR0-T3/T4)
- [ ] 6 rights records seeded at `review.review_status: agent_triage_only` **and** `overall_status: UNKNOWN`, asserted separately; no `CLEARED_` string under `rights/` (EPR0-T4)
- [ ] ≥ 4 coverage/consistency gates, each with a fails-closed test; a record at `UNKNOWN` passes (EPR0-T5/T6)
- [ ] No `Date.now()` in any gate; `--as-of` honoured; byte-identical across runs (EPR0-T5)
- [ ] No `format: "uri"` under `schemas/rights/`; `pattern` used instead (EPR0-T3)
- [ ] `package.json` carries all feature gate wiring and zero new dependencies (EPR0-T6)
- [ ] `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../rights-aware-evidence-capture-v1.md)
