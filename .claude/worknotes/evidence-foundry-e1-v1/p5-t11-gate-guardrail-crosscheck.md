# P5-T11 — Full gate re-run + guardrail/non-goal cross-check (karen prep)

**Task**: Phase 5, P5-T11. **Method**: (1) re-ran `npm run check` end to end against the committed
diff (`main...HEAD`, 62 commits, 225 files changed); (2) independently re-verified every CLAUDE.md
hard guardrail and every PRD §7 non-goal (incl. the §6.4 verbatim list) by reading the actual
committed schemas/tools/fixtures/docs, not by trusting prior task notes; (3) re-verified the PRD
§11 seeded-violation checklist (8 classes) has real, fail-closed-asserting test coverage; (4)
spot-checked the FR/NFR → Task coverage table in the implementation plan against what actually
landed. This document re-verifies P5-T2's honesty-audit findings independently rather than
re-deriving them from scratch, and additionally sweeps the full non-test diff (94 files) for
risky-term hits P5-T2's 9-surface scope would not have covered.

---

## 1. `npm run check` — full re-run result

**GREEN, end to end**, against the committed diff on this branch:

| Step | Result |
|---|---|
| `npm test` | **1837/1837 pass**, 0 fail, 0 cancelled |
| `npm run validate` (`scripts/validate-kb.mjs` + evidence-pack check) | **PASS** — anemia (91 rules/26 candidates/6 evidence/41 passages) + cbc_suite_v1 (4 rules/1 candidate/8 evidence/5 review records) all validated; `governance/reviewer-roster.yaml`: 5 reviewers validated (all synthetic); `releases/registry.json`: 0 entries validated |
| `coverage:rules` (`--require-all --min=91`) | **PASS** — 91/91 rule activation coverage, 0 unwitnessed |
| `npm run build` | **PASS** — static site built; `cbc_suite_v1` correctly reported "not servable" (`status: unsigned-stub`) |
| `verify:d4` (post-build) | **PASS** — `clinicalApprovers[]` empty on all 95 built rules across 2 modules |
| `check:imports` | **PASS** |
| `smoke:browser` | **PASS** |
| `smoke` | **PASS** |

No test-glob change, no new npm script, Node v20.19.3 (≥ 20 required). SC-1 (npm run check green
at feature end) — **met**.

---

## 2. CLAUDE.md hard guardrails — one line each, pass/fail (independently re-verified against committed state)

| # | Guardrail | Verdict | Evidence |
|---|---|---|---|
| 1 | No generative model in the clinical decision path | **PASS** | `grep` for LLM/generative-model SDK imports across `tools/{review-record,release-sign,retro-validate}` finds zero code hits — every match is a comment/doc asserting the negative (`cli.mjs:27`, `cli.mjs:25`, `cli.mjs:17`, 3 READMEs). No `src/` file touched by this diff. |
| 2 | No autonomous diagnosis, treatment, dosing, or transfusion directives | **PASS** | E1 adds zero code to the decision path (`src/`, `modules/anemia/`, `modules/cbc_suite_v1/{rules,candidates}.json` untouched by this diff); `retro-validate`'s fixture schema fields (`recentTransfusion`, etc.) are replay-input facts mirroring the existing patient-input schema, never directives. |
| 3 | No invented thresholds | **PASS** | `tools/retro-validate/schemas/protocol.schema.json` — every threshold leaf is `const: null`; `lib/protocol.mjs`/`lib/metrics.mjs` fail-closed reject any populated threshold and `evaluateProtocolQualification` never returns `qualifying: true`. Seeded populated-threshold fixture is rejected (`tests/ef-retro-protocol.test.mjs`). |
| 4 | No PHI in the public microsite | **PASS** | No `src/`, `server.mjs`, or SPA file touched; all new artifacts are build-time/offline governance files. `tools/retro-validate` structurally rejects identifier-bearing fixtures (`lib/boundary.mjs`, denylist scan) — confirmed fail-closed by 5 seeded identifier fixtures + `tests/ef-retro-identifier-denylist.test.mjs`. |
| 5 | No AI-published rule changes (independent clinical review + tests + signed release required) | **PASS** | `modules/cbc_suite_v1/module.json.status` stays `"unsigned-stub"`, `approvedBy: []`; the only path that could flip status to `release-ready` is the release-authorization record type, and all 5 committed review records (incl. `rr-0005-release-auth.yaml`) are `synthetic: true` — structurally incapable of satisfying release-authorization validity (P2-T4 validator, exercised in `tests/ef-review-adjudication.test.mjs`). |
| 6 | Ranking score is an ordinal sort priority, not a probability/performance metric | **PASS** (N/A scope, verified untouched) | Ranking/scoring logic lives in `src/engine.js`/`modules/*/candidates.json`, neither touched by this diff. `tools/retro-validate`'s 5 OQ-5 measures are explicitly labeled `"software agreement"` everywhere (`agreement-report.json`, `lib/metrics.mjs`), never "sensitivity"/"specificity"/"performance" outside a negation banner. |
| 7 (task-specific) | Every gated capability ships schema-forced inert: `approvedBy[]`/`clinicalApprovers[]` `maxItems:0`, signature slots const-null on real candidates, roster synthetic-only pre-G1 | **PASS** | `schemas/module-manifest.schema.json`/`schemas/rule.schema.json`: `approvedBy`/`clinicalApprovers` `maxItems: 0` (pre-existing, unchanged). `schemas/review-record.schema.json`: `allOf`/`if`/`then` forces `signature: null` when `synthetic: false`. `schemas/release-manifest.schema.json`: `signature` forced `null` unless `dryRun: true` + `TESTKEY-` keyId. `schemas/release-registry.schema.json`: `signature` `type: "null"` unconditionally in E1. `governance/reviewer-roster.yaml`: 5/5 entries `synthetic: true`, zero real entries. `releases/registry.json`: `entries: []`. All confirmed by reading the committed files directly, not the schema descriptions alone. |
| 8 (task-specific) | No clinical-validity claims in schema descriptions/docs/output; G0–G4 never clearable by any task/agent | **PASS** | Independent full-diff sweep (94 non-test changed files) for risky assertion patterns (`is clinically valid`, `safe to use/administer`, `diagnostic accuracy/performance`, `FDA cleared/approved`, `regulatory approval/clearance`, `recommended dose/treatment/transfusion`) found **zero non-negated hits** — every match is a negation ("never clinical validation", "no rule is clinically approved", "is or may be read as ... clinical validation" preceded by "never"/"not"). `grep`-swept every `id: G0`..`id: G4` task row across all phase progress/completion files under `.claude/progress/evidence-foundry-e1/` — none exist as tasks; only `.claude/progress/evidence-foundry-e1/gates-status.md` carries the 5 gate rows, each `status: blocked-external`, `owner: human`. |
| 9 (task-specific) | Deterministic, offline, fail-closed; no network calls in tools | **PASS** | No `fetch`/`http.request`/`https.request`/`axios`/`XMLHttpRequest`/`WebSocket` in `tools/{review-record,release-sign,retro-validate}` (grep, zero code hits — only doc/comment negations). Determinism test-enforced: `tests/ef-release-manifest-canonical-bytes.test.mjs`, `tests/ef-retro-determinism.test.mjs`, hash-comparison-across-2-runs pattern throughout. |
| 10 (task-specific) | No private-key material in repo/CI/agent context (FR-15) | **PASS** | `tests/ef-release-no-keys.test.mjs` (P3-T5, part of the green 1837): empty private-key allowlist; no PEM/OpenSSH/PKCS8 header or key-seed-shaped filename anywhere in the git tree; no `process.env` reference in `tools/release-sign/`; no CI workflow invokes `release-sign`; real `sign` (no `--key`/`--dry-run`) exits `EXIT_USAGE` even with bogus signing-key env vars populated; `--dry-run` output byte-unaffected by env vars (ephemeral in-memory keypair only, OQ-6). |
| 11 (task-specific) | E0 conventions followed: `tools/<name>/cli.mjs` verb-dispatch, Node ≥20 ESM, `node:test`, no new deps without strong need | **PASS** | `tools/review-record/cli.mjs` (scaffold/validate/list/render/dry-run), `tools/release-sign/cli.mjs` (manifest/register/sign/verify), `tools/retro-validate/cli.mjs` (check-fixtures/run/report) — all verb-dispatch ESM, no `package.json` dependency additions in this diff (checked: only `node:crypto`, `node:fs`, `node:path`, etc.). |

---

## 3. PRD §7 non-goals — one line each, pass/fail (committed-state check)

### §6.4 verbatim non-goals (binding, quoted in §7 "Out of Scope")

| # | Non-goal | Verdict | Evidence |
|---|---|---|---|
| 1 | No second evidence crawler | **PASS** | `grep -rniE "crawl|scrape|spider"` across the three new tools: zero hits. Only pre-existing `tools/rf-bundle-to-kb-pack/` (E0, untouched) exists as a converter, not a crawler. |
| 2 | No generative rule writer | **PASS** | `grep` for "generate.*rule"/"rule.*generat"/"auto.*author" across the three new tools: zero hits. `modules/cbc_suite_v1/{rules,candidates}.json` byte-unchanged by this diff (not in the non-test file list at all). |
| 3 | No patient LLM path | **PASS** | `grep` for chatbot/patient-chat/conversational across the three tools + `src/`: zero hits. |
| 4 | No guessed LOINC/UCUM | **PASS** | `grep -rniE "loinc|ucum"` across the three new tools: zero hits — this workstream never touches terminology mapping (that's DF-E1-05, explicitly out of scope, pointer-only update in P5-T9). |
| 5 | No treating `rf verify`/council as clinical validation | **PASS** | `docs/governance/gates-registry.md` §A1 explicitly records the methodologist/skeptic council as an "external upstream `rf`/ARC dependency" with "no task's completion criteria depend on a council pass" and "no artifact ... may describe a council pass ... as clinical [validation]." `docs/architecture.md` (pre-existing language, unchanged) states "ARC/council-review/`rf` output is explicitly not a valid source" for approval. |
| 6 | No single blended confidence score | **PASS** | `grep -rniE "confidence.*score\|blended.*confidence"` across the three new tools: zero hits. `retro-validate` ships 5 distinct, separately labeled software-agreement measures (OQ-5), never a single blended score. |

### Remaining §7 "Out of Scope" items

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 7 | Interactive review portal (DF-E1-01) not built pre-emptively | **PASS** | `grep` for `express`/`http.createServer`/`.listen(` in `tools/review-record`: zero hits. `render` verb emits static, self-contained HTML from committed artifacts only (no server, no DB, no auth, no write path) — confirmed by reading `tools/review-record/lib/render.mjs` and the R-P4 smoke task (`tests/ef-review-render-smoke.test.mjs`, part of the green suite). |
| 8 | Real-data retrospective run (DF-E1-09) not run — gated G3 | **PASS** | `tests/fixtures/ef-retro/` contains only `valid-synthetic`, `valid-deidentified`, and named `identifier-*` **rejection** fixtures (seeded violations, not admitted data) — no real patient data anywhere. Harness `run`/`report` only accept `provenance: {synthetic, deidentified}` (`lib/boundary.mjs`). |
| 9 | Production signing ceremony / custodian onboarding (G2) not performed | **PASS** | `releases/registry.json` remains `{schemaVersion:1, entries:[]}`; `governance/reviewer-roster.yaml` has zero `synthetic: false` entries; no custodian identity exists anywhere in the repo. |
| 10 | ADR acceptance (G0) not performed | **PASS** | ADR-0001/0004/0005/0006 frontmatter status is not touched by this diff (verified: none of `docs/adr/*.md` appear in `git diff main...HEAD --name-only`). |
| 11 | Sibling E1 workstreams untouched (12-angle CBC live op, upstream `rf` validators, full CBC Suite authoring, property/mutation/semantic-diff CI expansion, FHIR/terminology emitters) | **PASS** | Full non-test diff file list contains zero files outside the expected P5 surface (schemas/, tools/{review-record,release-sign,retro-validate}/, modules/cbc_suite_v1/reviews/, governance/, releases/registry.json, CHANGELOG.md, docs/, scripts/{validate-kb,rule-coverage,evidence/backfill-rule-governance}.mjs, .gitignore) — the P5-T9 design-spec pointer updates are prose-only "E1 State" paragraphs, never code. |
| 12 | All E2 machinery deferred — E1 ships only the registry seed | **PASS** | `schemas/release-registry.schema.json`: `withdrawalState` is `const: "none"`, `withdrawnAt`/`withdrawalReason` `type: "null"` unconditionally; `tools/release-sign/lib/registry.mjs` never writes anything but `"none"`/`null` to those fields — grep-confirmed no other value is ever assigned. No surveillance/impact-graph/materiality/re-sign/monitoring code exists anywhere in the diff. |
| 13 | No `maxItems: 0`/schema-forced-empty ceiling raised | **PASS** | Same schemas checked in guardrail #7 above — `maxItems: 0` on `approvedBy`/`clinicalApprovers` and the `signature`/`synthetic` `const`/`type:"null"` gates are unchanged from their E1-introduced (or E0-inherited) values; no schema in this diff loosens any of these constraints. |

**A1/A2 binding adjudications** (orchestrator-level, cross-checked): A1 (methodologist/skeptic
council = external RFUP dependency, zero in-repo council tasks) — confirmed: `find . -iname
"*council*"` outside `node_modules` returns only pre-existing, unrelated
`arc-clinical-council-adoption-v1` program files, none touched by this diff, none new. A2 (SPIKE-006
reconciliation recorded in G0's ADR-0005 entry) — confirmed present in
`docs/governance/gates-registry.md`.

---

## 4. PRD §11 seeded-violation checklist — all 8 classes, status

The PRD §11 "Functional Acceptance" bullet enumerates exactly 8 seeded-violation classes that must
be "100% rejected fail-closed." Each has real test coverage with an explicit assertion of
fail-closed rejection (spot-checked, not just file-existence):

| # | Class | Verdict | Test(s) |
|---|---|---|---|
| 1 | Record mutation | **PASS** | `tests/ef-review-appendonly.test.mjs` — `'SEEDED MUTATION (a): a one-byte mutation of a committed fixture record fails chain validation'` + CLI-subprocess variant both assert rejection with a `chain:`-prefixed violation. |
| 2 | Reviewer-2 dependence (independence) | **PASS** | `tests/ef-review-workflow.test.mjs` exercises the independence heuristic; validator (P2-T2) structurally prevents surfacing reviewer-1 content during reviewer-2 scaffolding. |
| 3 | Adjudicator = author | **PASS** | `tests/ef-review-adjudication.test.mjs` — adjudicator-≠-author validator against the OQ-5 authorship union (authoring-decisions signers + git commit author). |
| 4 | Tampered bytes | **PASS** | `tests/ef-release-sign-verify.test.mjs` — byte-drift/tamper cases fail verification. |
| 5 | Unknown/test keyId on a real (non-dry-run) candidate | **PASS** | `tests/ef-release-sign-verify.test.mjs` + `tests/ef-release-no-keys.test.mjs` (P3-T5(c)) — a populated signature on a real `release-manifest.unsigned.json` fails `scripts/validate-kb.mjs` (the exact script `npm run validate` invokes first), with a regression guard proving the failure is caused by the seeded signature, not environment. |
| 6 | Identifier-bearing fixture | **PASS** | `tests/ef-retro-identifier-denylist.test.mjs` — 5 named seeded identifier fixtures (`identifier-mrn`, `identifier-ssn-pattern`, `identifier-dob`, `identifier-name`, `identifier-address`, `identifier-contact`, `identifier-input-*-nested`, `identifier-description-phi-marker`) all rejected fail-closed. |
| 7 | Populated signature pre-G2 | **PASS** | `tests/ef-contract-forced-empty.test.mjs` (P1-level contract test) plus `tests/ef-release-no-keys.test.mjs` P3-T5(c)/(d) — populated signature on a real candidate or a hand-spliced registry entry both fail closed (`errors.some(e => e.includes('signature') && /null/i.test(e))`). |
| 8 | Populated protocol thresholds by software | **PASS** | `tests/ef-retro-protocol.test.mjs` — seeded populated-threshold fixture (top-level, utility-measure, and per-stratum variants) all rejected by `assertProtocolShape` (`ProtocolError`, `EXIT_USAGE`). |

**8/8 seeded-violation classes have fail-closed test coverage, independently spot-checked.**

---

## 5. FR/NFR → Task coverage table — spot-check

Sampled across all four workstreams (not exhaustive — the full 31-FR table is in the implementation
plan; this spot-checks a representative cross-section plus every FR named directly in this task's
own instructions):

| FR | Claim | Spot-check result |
|---|---|---|
| FR-1/FR-2 | Five-role file model; wave0 model unified into one canonical schema | **Confirmed** — `schemas/review-record.schema.json` header explicitly states "ONE schema, not a parallel contract (ruling R5)"; `tests/ef-review-record-migration.test.mjs` exists (part of green suite). |
| FR-3 | Roster format/validator, ships synthetic-only until G1 | **Confirmed** — `schemas/reviewer-roster.schema.json` + `governance/reviewer-roster.yaml` (5/5 synthetic). |
| FR-6 | Release-auth is the sole `unsigned-stub → release-ready` transition, schema-impossible pre-G1 | **Confirmed** — `modules/cbc_suite_v1/module.json.status` still `unsigned-stub`; all review records synthetic. |
| FR-7/FR-8 | Review CLI (5 verbs); read-only rendering, not a portal | **Confirmed** — `tools/review-record/cli.mjs` implements `scaffold`/`validate`/`list`/`render`/`dry-run`; render is static HTML, no server. |
| FR-11 | Five-role synthetic dry-run committed as fixtures | **Confirmed** — `modules/cbc_suite_v1/reviews/rr-0001..0005-*.yaml`, all `synthetic: true`. |
| FR-12 | Ed25519 over P5-T5(E0) canonical bytes, byte-identity test | **Confirmed** — `tests/ef-release-manifest-canonical-bytes.test.mjs` exists and is green. |
| FR-14 | `releases/registry.json` + schema + validator | **Confirmed** — file exists, schema-valid per `npm run validate` output ("releases/registry.json: validated 0 entrie(s)"). |
| FR-16 | Signature slot schema-forced empty pre-G2 | **Confirmed** — see guardrail #7 above. |
| FR-17 | Signing-ceremony runbook | **Confirmed** — `docs/governance/signing-ceremony-runbook.md` exists (27KB, committed). |
| FR-19 | Version-pinned deterministic replay | **Confirmed** — `tests/ef-retro-determinism.test.mjs` green; replay resolves candidates exclusively via `releases/registry.json` `packDigest` match per `docs/architecture.md` §13. |
| FR-20/FR-21 | Structural de-identification boundary; aggregate metrics + provenance only | **Confirmed** — `lib/boundary.mjs` two-layer gate; `agreement-report.json` + `run-provenance.json` sidecar per OQ-5. |
| FR-24 | Protocol shape, human-only thresholds | **Confirmed** — see §4 row 8 above. |
| FR-25 | Data-source SPIKE charter authored (not run) | **Confirmed** — `docs/project_plans/SPIKEs/spike-007-retrospective-data-source.md` exists, frontmatter `status: chartered-not-run` per P5-T2's audit. |
| FR-27 | Gates encoded as external blocked states | **Confirmed** — `.claude/progress/evidence-foundry-e1/gates-status.md`, 5/5 `blocked-external`. |
| FR-28 | Honesty posture on every artifact | **Confirmed** — see §2 row 8 and the independent full-diff sweep above. |
| FR-29 | `docs/architecture.md` + CHANGELOG updates | **Confirmed** — `docs/architecture.md` §11–§13 added; `CHANGELOG.md` `[Unreleased]` "Evidence Foundry E1" entry present. |
| FR-30 | Deferred-item spec stubs 1:1 | **Confirmed** — 11/11 design-spec paths in `deferred_items_spec_refs` (both plan and phase-5-progress frontmatter), all 11 files present in the diff. |
| FR-31 | Rights posture respected in rendering | **Confirmed** — `tools/review-record/lib/render.mjs` `RIGHTS_RESTRICTED_LABEL` renders hash+selector block, never inline restricted text (FR-31 comment at line 25/67). |

**No FR sampled shows a coverage gap against its claimed task(s).**

---

## 6. Finding: progress-tracking staleness (not a guardrail/non-goal violation — flagged for karen/P5-GATE1)

While cross-checking the implementation plan's FR coverage table against `phase-5-progress.md`, four
task rows show `status: pending` even though their deliverables are demonstrably committed and
functioning:

| Task | Tracked status | Actual state |
|---|---|---|
| P5-T4 (CHANGELOG entry) | `pending` | Commit `67d9b0d` "ef-e1(P5-T4): CHANGELOG [Unreleased] entry ..." landed; `CHANGELOG.md` carries the full "Evidence Foundry E1: Clinical Governance Triad" section. |
| P5-T6 (review-portal design-spec update) | `pending` | Commit `6c613ed` "ef-e1(P5-T6): update clinical-review-portal-workflow design spec with E1 learnings" landed; file diff confirms the update. |
| P5-T8 (retrospective/surveillance/monitoring design-spec updates) | `pending` | All three target files (`retrospective-validation-harness.md`, `surveillance-update-registry-engine.md`, `production-monitoring-telemetry.md`) carry "## E1 State (Phase 5, 2026-07-22)" sections in the diff (landed as part of commit `9424296`, whose message names only P5-T5, i.e. the deliverable was bundled into a differently-labeled commit). |
| P5-T10 (frontmatter/findings/DF-EXT-01 closure) | `pending` | Commit `acd6444` "ef-e1(P5-T10): frontmatter, findings & DF-EXT-01 closure — finalize Phase 5 progress tracking" is the **latest commit touching `phase-5-progress.md`** and is an ancestor of HEAD; it populated `commit_refs`, `deferred_items_spec_refs` (11 paths), `findings_doc_ref` rationale, and `deferred_items_triage_status`, but did not flip its own or T4/T6/T8's per-task `status:` field to `completed`. |

Root cause: the deliverable commits for these four tasks landed correctly, but each task's own
`status: pending` line (all originally written by the initial plan-scaffolding commit `23151bb`) was
never updated to `completed` in the same or a follow-up commit — this is a **tracking-document
bug**, not a missing deliverable. The frontmatter counters (`total_tasks: 13`, `completed_tasks: 6`)
are consequently stale too (actual completed count, by evidence above, is 10: T1/T2/T3/T4/T5/T6/T7/
T8/T9/T10).

**This finding is out of scope for this task's ACs** (P5-T11 is the guardrail/non-goal cross-check,
not progress-tracking maintenance — that is P5-T10's job, and this task's dependency graph lists
P5-T10 as a prerequisite). It is recorded here rather than silently fixed because (a) editing
`phase-5-progress.md`'s per-task status fields is explicitly P5-T10's/P5-GATE1's territory and this
worktree is shared with other in-flight agents per the git-discipline instructions, and (b) an
inaccurate `completed_tasks` counter could mislead `task-completion-validator` (P5-GATE1) or `karen`
(P5-GATE2) into under- or over-crediting Phase 5 completion if not explicitly called out. **No
guardrail, non-goal, or acceptance criterion is affected** — every artifact these four tasks were
supposed to produce exists, is committed, is schema-valid, and passed the honesty audit and
`npm run check` re-run above.

---

## 7. Summary verdict

- `npm run check`: **GREEN** (1837/1837 tests; validate/build/verify:d4/check:imports/smoke all pass).
- CLAUDE.md hard guardrails: **11/11 PASS** (6 CLAUDE.md guardrails + 5 task-specific guardrails from this task's own prompt).
- PRD §7 non-goals (incl. §6.4 verbatim 6-item list): **13/13 PASS**.
- PRD §11 seeded-violation checklist: **8/8 classes PASS**, fail-closed-asserting tests confirmed for each.
- FR coverage table spot-check: **18/18 sampled FRs confirmed landed**, no gap found.
- One non-blocking finding: progress-tracking staleness on 4 task rows (§6 above) — deliverables
  real and correct, tracker status field stale. Flagged for P5-T10/P5-GATE1/karen attention, not
  fixed by this task.

No guardrail or non-goal violation found anywhere in the committed diff. This document is the
karen-prep input P5-GATE1/P5-GATE2 can cite directly.
