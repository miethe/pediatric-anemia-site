## Phase 5 Completion Note — Qualifying pilot and certification

**Status: BLOCKED. Not completed.** Phase 5 cannot reach AC P5.1 in this environment.

**Work IS committed and pushed** — ARC `b5df293`, PED `cfa800f`, both on `main`. A disk-full
(`ENOSPC`) condition halted the phase before fix cycle 4 could be written; disk space recovered
afterwards and everything delivered was committed and pushed. Fix cycle 4 (RR-1 HIGH, C1, C2, C3)
remains **unapplied** — see the resume checklist.

**Plan:** `docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md` §4 P5, AC P5.1
**Progress:** `.claude/progress/arc-clinical-council-adoption-v1/phase-5-progress.md`
**Isolation:** none — worked directly on `main`. ARC trees reviewed at `80bb663`, PED at `fa50ac8`.

---

### Summary

P5-T1 was delivered and independently verified. **P5-T2, P5-T3, and P5-T4 did not execute**, and
P5-V1 is **not satisfied**. The qualifying pilot never ran: `arc_cli.agent.review.execute_review` is
blocked by two independent owner-held gates, both reproduced read-only by an Opus validator on three
separate occasions. The phase produced an honest, digest-frozen pilot *input* set and a structured
blocker record — not a qualified runtime.

The pilot qualifies the RUNTIME and nothing else. Runtime qualification itself was **not** achieved.
No clinical validity, credentialed review, certification, release, or activation is established or
claimed anywhere in the delivered artifacts.

---

### Tasks

- [x] **P5-T1** → python-backend-engineer — immutable pilot input manifest (55 frozen locators,
  66 digest declarations), mechanically-clean data-boundary scan, and the P5-T2 feasibility blocker
  record. Verified PASS by `task-completion-validator` (opus) after fix cycles 1 and 2.
- [ ] **P5-T2** → **BLOCKED**, not executed. Two owner-held gates (below).
- [ ] **P5-T3** → **BLOCKED** by P5-T2. The scorecard is a truthfully-labelled skeleton
  ("Run skeleton created; council review not yet executed"). Plan's "scorecard is not a skeleton
  placeholder" is **unmet and not claimed**.
- [ ] **P5-T4** → **BLOCKED**. Requires credentialed owner records that plan §6 says only
  authenticated owner evidence may satisfy. None exist.
- [ ] **P5-V1** → **NOT SATISFIED.** See "P5-V1 was not run" below.

---

### The blocker — P5-T2 is not executable (owner action required)

Both gates were independently reproduced by the validator; neither was worked around, and the
implementer did **not** stop short. Recorded at
`agentic-research/runs/2026-07-21-arc-clinical-qualifying-pilot/p5_t2_feasibility_blocker_record.yaml`.

| Gate | Observed | Owner role |
|---|---|---|
| 1 — SDK credential | `authoring_status()` → `{available: false, reason: no_credential, auth_mode: null}`. No `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY`. `authoring_status()` inspects `os.environ` only — there is no ambient/CLI-session fallback, so the machine's authenticated `claude` binary is unreachable by this path. | `arc-runtime-owner` |
| 2 — evidence-rights receipt | `_compile_execution_policy()` raises `ExecutionPolicyError`. All **15/15** sources in the council's `required: true` evidence manifest declare `external_provider_upload: metadata_only_with_owner_rights_approval`; dispatching a model reviewer pass counts as external-provider metadata upload. No `EvidenceRightsReceipt` exists — and `~/.config/arc/authority-trust.yaml` is absent, so none could be *verified* if presented. | `evidence-rights-owner` (+ `arc-runtime-owner` for the trust anchor) |

Gate 1 returns first; Gate 2 is reached only once Gate 1 clears. **Resolving Gate 1 alone is
necessary but not sufficient.** Gate 2 is a general property of this council + evidence-manifest
pairing, not an artifact of the chosen candidate.

**No legitimate in-policy path exists.** Every Gate-1 route requires minting/exporting a credential
or the `gateway` auth mode (= the ICA shape, forbidden — the plan's routing record classifies
clinical council lenses MUST-stay-primary). Every Gate-2 route requires relaxing the source manifest
to `public_metadata_only`, dropping `required: true`, or authoring a receipt + trust anchor. The
blocker record notably discloses that the code *would* accept ICA and refuses on plan policy rather
than pretending technical impossibility.

---

### What P5-T1 actually delivered

Run directory: `agentic-research/runs/2026-07-21-arc-clinical-qualifying-pilot/` (30 files, untracked).

- **Candidate:** `SYNTHETIC-DM-CBC-001` (hazard DM-CBC-001), non-patient, project-authored, resolved
  through the P1 portable-target resolver + approved-roots registry to a digest-pinned, clean-tree,
  non-absolute-path record. Sole candidate — plan §4/§8 mandate one.
- **Immutable input manifest:** 55 unique locators / 66 digest declarations covering candidate,
  portable target, evidence source manifest, council definition, all 10 reviewer roles + agent files
  + output schemas, local profiles, all three receipt kinds (as `instance_present: false` with named
  owner ROLES), V3/V4/V5 refs, and AOS identifiers (explicit nulls with reason).
- **Data-boundary scan:** re-runnable, two-pass (55 frozen inputs + 29 run-dir self-scan),
  `all_clean: true`, **0 absolute-path hits in both passes**, 30/30 hit units digest-bound-allowlist
  adjudicated, 0 stale, 0 phantom. This directly supersedes the 2026-07-19 readiness run's recorded
  `prohibited_input_check: failed_absolute_local_paths_in_surrounding_context`.
- **Truthful execution state** on `run_manifest.yaml` (`qualifying_runtime_pilot: false`), plus the
  structured blocker record.

---

### Reviewer gates run — and P5-V1 was NOT run

**P5-V1 is not satisfied.** Applying P4's lesson (the plan's AC is authoritative), AC P5.1 requires
exact-tree clinical-safety and correctness/release review. What ran:

| Lens | Cycle 1 | Cycle 2 | Cycle 3 |
|---|---|---|---|
| `task-completion-validator` (opus) | FIX-REQUIRED | **PASS** | FIX-REQUIRED (3 items) |
| `pediatric-clinical-adjudicator` (opus) | **FAIL** (1 CRITICAL, 3 HIGH) | **FAIL** (3 HIGH, 3 MED, 5 LOW) | **PASS-WITH-FINDINGS** (1 HIGH residual) |

**Lenses that did NOT run — named per the reviewer's own process objection:**
`pediatric-hematology-reviewer`, `pediatric-laboratory-medicine-reviewer`,
`general-pediatrics-reviewer`, `clinical-informatics-interoperability-reviewer`,
`diagnostic-accuracy-methods-reviewer`, `prediction-implementation-evaluation-reviewer`,
`pediatric-safety-human-factors-reviewer`, `pediatric-equity-patient-family-reviewer`,
`evidence-quality-scribe`, and `correctness-reviewer`. **No seat has assessed any of the ten hazard
families for this candidate.** Running fewer lenses than the AC requires does not make the phase
pass — it makes failures invisible (P4's recorded lesson).

**P4's lesson repeated and paid off again.** The clinical lens caught a **CRITICAL that the
correctness validator, twice, did not**: `pediatric_clinical_review.json` — a named AC P5.1 target
surface — read in isolation as "an eight-lens council reviewed DM-CBC-001 and unanimously abstained
with zero unresolved criticals." Nothing had run. `unresolved_critical_count: 0` was a scaffolder
artifact (`_placeholder()` returns `int(minimum)`) and was precisely what permitted
`clinical_release_status: human_review_pending` instead of `blocked`. Now `blocked`, count `4`.

---

### Open, owned findings — carried, not closed

| ID | Sev | Owner role | Summary |
|---|---|---|---|
| **RR-1** | **HIGH — UNFIXED** | `equity-and-family-governance-owner` | `dangerous_miss_review.families[subgroup_or_access_failure]` still asserts `not_applicable` with empty `finding_refs` while PED DM-EQUITY-009 is `no_control_exists` with open HIGH `PAC-P4T2-001`. The identical defect fixed for five other families, left unapplied on one of the **two wholly unmitigated** hazards. Fix cycle 4 was drafted and verified but **never written to disk** (ENOSPC). |
| C1 | MEDIUM — UNFIXED | `arc-runtime-owner` | `adjudication_record.yaml` `decided_at_disclosure` states a falsehood about its own schema (claims `decided_at` "requires a non-empty string"; it is bare `{"type":"string"}` — empty validates). A disclosure that exists to prevent a misleading implication must not contain one. |
| C2 | LOW — UNFIXED | `arc-runtime-owner` | `data_boundary_scan_adjudication.md` §3 heading says "18 files" / headline says "all but one"; truth is 19 files carry `possible_full_text`, one of which additionally carries `patient_name_context`. 19 allowlist anchors point at the miscounted heading. |
| C3 | LOW — UNFIXED | `arc-runtime-owner` | `data_boundary_scan_allowlist.yaml` `metadata.fix_cycle: 1` stale after cycles 2–3. |
| RR-2 | MEDIUM | `arc-schema-owner` | `not_covered` now carries materially different states in one array (unassessed / not-reachable-in-product ×3 / open-critical-coverage-finding / no-control-exists). |
| RR-4 | LOW | `arc-runtime-owner` | `local_approvals_required`'s causal claim that alert-dominance depends on derived `localFlags` is unhedged; PED's cited test exercises a different path. |
| RF-1 | — | `arc-schema-owner` | `council_recommendation` enum has no "never executed" value; `abstained` is a proxy. |
| RF-2 | — | `arc-schema-owner` | `dangerousMissFamily.status` enum has no `not_assessed`, so a skeleton must assert something untrue. |
| RF-3 | — | `pediatric-safety-owner` | DM-CBC-001 is an **n=1 sample from the best-case stratum** (the cleanest matrix row, and within it the most overt clinical picture). Latent now; **live the moment P5-T2 executes**. |
| RF-4 | — | `arc-schema-owner` | `unresolved_critical_count` cannot express "unknown"; artifact-vs-knowledge-base scope undefined. Value `4` kept as a fail-closed floor. |
| RF-5 | — | `arc-schema-owner` | `dissentRecord.reviewer_roles` `minItems: 2` forces a second name with no way to mark it unheld. |
| RF-6 | — | `clinical-governance-owner` | Synthetic seat identity and human approval authority share one unnamespaced string space. CRITICAL-vs-HIGH severity disagreement preserved. |
| RF-7 | — | `arc-schema-owner` | SkillBOM `reviewer.skills` overloaded to encode voting/non-voting seat class. |
| DIS-1 | open | `clinical-governance-owner` / `pediatric-safety-owner` | `blocked` vs `human_review_pending` unresolved; only the adjudicator lens holds a position. |

**Cross-repo defect to escalate (recurs at P5-T4/P6/P7 — fix once):** PED plan §5 mandates the
literal `not_executed_owner_held`; ARC `arc_cli/__main__.py` `_RESERVED_AUTHORITY_STATE_TOKENS`
hard-errors (exit 2) on that exact token anywhere under `metadata.*` outside
`authority_attachments`/`local_profiles`. The literal is therefore *unwritable* in a run manifest's
free-form metadata. Handled by disclosed synonym substitution; the plan literal is still used
verbatim in the two artifacts `arc validate` does not govern.

**Pre-existing, out of P5 scope:** `tests/test_local_profiles.py::DispatchAndCertificationGates::test_certification_acceptance_passes_the_gate_when_verified`
fails at ARC HEAD `80bb663` (P1-P3). Root-caused as a wall-clock time-bomb (fixture `NOW = 2026-07-19`,
24h snapshot max-age, `custom_outputs.py:1334` omits `now=`). Plan §5's ARC full-suite gate cannot be
signed off while it is red. **Track separately** — do not hold P5 hostage to it, and do not inherit
it silently.

**Out-of-repo mutation, disclosed:** `~/.config/arc/approved-roots.yaml` was rewritten via
`arc roots add --force` during P5-T1. Disclosed in `pilot_input_manifest.yaml`; not reverted.

---

### Validation evidence (independently executed by the validator, not self-reported)

| Command | Result |
|---|---|
| ARC `uv run arc validate .` | exit 0, 601 `ok:` lines, "ARC validation passed" |
| ARC `uv run pytest` | 1 failed, 1075 passed, 6 skipped, 427 subtests — the single failure is the pre-existing one above |
| ARC `uv build` | exit 0, sdist + wheel |
| `git diff --check` both repos | exit 0 |
| Data-boundary scan | `all_clean: true`, exit 0, 0 absolute-path hits both passes, 0 stale, 0 phantom; discrimination re-proven on validator-owned `cp` copies (byte-mutation, phantom entry, frozen-digest tamper all fail closed) |
| Digest integrity | all 55 locators recomputed; 0 mismatches; every frozen input byte-identical to its tracked git HEAD; 0 Pass-A locators inside the run dir |
| No tracked ARC source modified | confirmed — `arc_cli/`, `schemas/`, `tests/`, `councils/` all clean |
| Other agent's uncommitted work | untouched, confirmed by mtime (all predate 2026-07-21) |

---

### Files changed — ARC only, all untracked, **UNCOMMITTED**

`agentic-research/runs/2026-07-21-arc-clinical-qualifying-pilot/` — 30 files:
18 run artifacts (`run_manifest.yaml`, `pilot_input_manifest.yaml`, `p5_t2_feasibility_blocker_record.yaml`,
`pediatric_clinical_review.json`, `arc_certification.yaml`, `provenance.skillbom.yaml`,
`adjudication_record.yaml`, `data_boundary_scan_{report.json,allowlist.yaml,adjudication.md}`,
`scorecard.json`, `findings.yaml`, `risk_register.yaml`, `friction_log.yaml`, `decision_record.md`,
`evidence_pack.md`, `validation_plan.md`, `trace_bundle.jsonl`), 2 scripts
(`scripts/data_boundary_scan.py`, `scripts/verify_allowlist_discrimination.py`), and 10 empty
`reviewers/*.findings.yaml`.

**PED: no changes.** Only the phase-5 progress file (frontmatter `status: in_progress`, P5-T1
`in_progress`) and the untracked routing record.

**Excluded from any P5 commit** (another agent's work — stage explicit paths only):
`.claude/agent-memory/`, `.gitignore`, `.bob/`, `.claude/agents/dev/`, `.claude/commands/dev/`,
`.claude/.skillmeat-project.toml`, `.claude/worktrees/`, `runs/2026-07-19-spike-005-*`,
`runs/2026-07-19-spike-006-*`.

---

### Commits

| Repo | Commit | Contents |
|---|---|---|
| ARC (`agentic-research`) | **`b5df293`** (parent `80bb663`) | the 30-file run directory, additive only |
| PED (`pediatric-anemia-site`) | **`cfa800f`** (parent `fa50ac8`) | this note, phase-5 progress (`status: blocked`), routing record |

Both squashed to one commit per repo, direct to `main`, pushed. Explicit paths staged only — the
other agent's uncommitted ARC work was never staged and is untouched.

### Disk-full interruption — what it cost

The session hit **`ENOSPC`** mid-phase; `Bash` became entirely unavailable (it could not write its
own stdout capture file). Space recovered afterwards and everything delivered was committed. Two
things were **not** done and remain open:

1. **Fix cycle 4 was never applied** — RR-1 (HIGH), C1 (MEDIUM), C2, C3. All four were drafted and
   source-verified by the implementer before the failure, but nothing was written to disk. The
   committed tree therefore still carries them.
2. **`validate-phase-completion.py` never ran** — the phase exit gate was not executed. Moot for a
   `blocked` phase, but it means P5-T1's task row was deliberately left `in_progress` rather than
   flipped to `completed` without the timestamps/evidence the gate requires.

### Resume checklist

1. Apply fix cycle 4: RR-1 (HIGH), C1, C2, C3 — then re-run the data-boundary scan and re-review
   with **both** lenses (any material edit invalidates approval, plan §5).
2. Run `validate-phase-completion.py`; set P5-T1 `completed` with timestamps + evidence
   (`commit:b5df293`), and P5-T2/T3/T4/V1 explicitly `blocked`.
3. **Owner actions to unblock the phase** — none can be done by a repository agent:
   `arc-runtime-owner` provisions an SDK credential; `evidence-rights-owner` signs an
   `EvidenceRightsReceipt` binding `knowledge-packs/pediatric-anemia/source-manifest.yaml`
   (sha256 `f4c33c82fe4977a7d4db2633ab04d82b39bb7bf421d048aba5a5b37a51b711f6`, all 15 source IDs,
   `permitted_operation: external_provider_metadata_upload`); `arc-runtime-owner` registers that
   issuer in `~/.config/arc/authority-trust.yaml`.

**The honest bottom line:** P5-T1 is done and independently verified. The qualifying pilot did not
run, P5-V1 did not run, and Phase 5 is **blocked on owner action** — not on repository work.
