## Phase 6 Completion Note — Governed Portal authoring and MeatyWiki metadata adapter

**Status: COMPLETED.** AC P6.1 met; P6-V1 PASS across all four reviewer lenses (one MEDIUM
finding raised and closed in fix cycle 1, re-confirmed on the post-fix tree).

**Plan:** `docs/project_plans/implementation_plans/enhancements/arc-clinical-council-adoption-v1.md` §4 P6, AC P6.1
**Progress:** `.claude/progress/arc-clinical-council-adoption-v1/phase-6-progress.md`
**Isolation:** none — worked directly on `main` in the ARC repo (`agentic-research`); PED holds tracking only.
**ARC base HEAD reviewed:** `afe3b98` (backend/adapter tree unchanged since the validator PASS; only the
web tree advanced by the UXW-P6-01 fix, which was re-validated + re-reviewed).

---

### Summary

Phase 6 productized the ARC portal for the full clinical RunSpec + evidence-source manifest and added
a read-only, metadata-only MeatyWiki source adapter — **without weakening any source or safety policy
and without touching the raw-YAML/manifest authority that P5 depends on.** Structured portal edits
round-trip byte/semantic exact (no flattening, no silent defaults); the UI never presents repository
validation as clinical approval; and the MeatyWiki adapter ships DISABLED by default, metadata-only,
behind two independent owner-held gates (OQ-5 stays owner-held and un-synthesized). Every fail-closed
class (access-denied, stale, retracted, rights-mismatch, projection-change, injection, round-trip) is
implemented and tested with bounded, non-echoing failures.

### Tasks

- [x] **P6-T1** → ui-engineer-enhanced (+ python-backend-engineer for the backend half) — full structured
  authoring for every RunSpec/source/safety/applicability/authority/target-class field, with pure
  round-trip codecs (`runspec-codec.ts`, `evidence-manifest-codec.ts`) proven by unit + component tests.
  The backend round-trip half was a real AC-P6.1 defect the UI implementer flagged and a python
  specialist closed: `arc_cli/server/app.py`'s `create_run`/preview never declared/forwarded
  `authority_attachments`/`local_profiles`, so pydantic `extra="ignore"` silently dropped them on the
  create path. Fixed + regression-tested (`tests/test_api_runs_clinical_fields.py`).
- [x] **P6-T2** → ui-engineer-enhanced — preview WARNINGS for all five classes (prohibited target,
  missing receipt, owner-held gate, stale digest, non-qualifying state), a persistent
  `ClinicalApprovalDisclaimer` wired to every green passing state, and an exact round-trip preview DIFF.
  Captured the required desktop visual evidence.
- [x] **P6-T3** → python-backend-engineer — new standalone `arc_cli/meatywiki_source_adapter.py`: inbound,
  read-only, metadata-only, DISABLED by default (two owner env gates), strict-allowlist projection
  (no body ever fetched/projected/hashed/logged), deterministic projection hashes, fail-closed on every
  negative class. Kept distinct from the pre-existing OUTBOUND finding-filer `arc_cli/server/meatywiki.py`
  (not entangled), and imported by nothing but its own tests (unreachable from any run-execution path,
  so disablement cannot block P5).
- [x] **P6-T4** → python-backend-engineer — exhaustive fail-closed negative suite
  (`tests/test_meatywiki_source_adapter_negative.py`, 46 tests across all 7 classes) with a `_assert_no_echo`
  guard on every raising path (asserts the protected payload never appears in the exception/cause).
- [x] **P6-V1** → security-identity-reviewer, mcp-tool-governance-reviewer (source-rights/governance lens
  added per plan §5/§3), ux-workflow-reviewer, task-completion-validator — all **PASS**.

### Validator Verdict

**P6-V1: PASS.** All four lenses passed on the reviewed tree.
- `task-completion-validator` (independently executed): `uv run pytest` 1142 passed / **1 failed = only the
  known pre-existing time-bomb**, `arc validate .` PASS, `uv build` PASS, `git diff --check` clean, web
  `typecheck` + `test` (280→283 post-fix) + `build` PASS; `git diff` on `schemas/`/`councils/`/
  `knowledge-packs/` EMPTY (no source/safety-policy mutation).
- `security-identity-reviewer`: PASS — all 5 invariants hold (disabled-by-default, metadata-only strict
  allowlist, fail-closed no-echo, no authority forgery via `app.py`, adapter inert/unwired).
- `mcp-tool-governance-reviewer`: PASS — injection resilience, source-rights enforcement, permission scope,
  auditability; no negative test merely names a class without asserting the boundary.
- `ux-workflow-reviewer`: PASS — AC P6.1 HARD invariant honored; all three required visual demonstrations
  confirmed. Raised **UXW-P6-01 (MEDIUM)**: review-step "Create review" CTA stayed enabled while the
  preview showed "(blocks this run)". **Fixed (fix cycle 1)** — CTA now gated on affirmative
  `previewData.ok === false` (no over-block on null/pending) + inline hint; re-reviewed → **PASS, closed**.

Fix cycles run: 1 (UXW-P6-01). Per the gate-staleness rule, only the ux-workflow lens (whose domain the
fix touched) was re-run; the security/tool-governance/backend lenses' PASSes stand on their unchanged
domains, and the web gate was re-run green post-fix (283 tests).

### Visual Evidence (AC P6.1 `visual_evidence_required` — satisfied)

Real Playwright desktop captures (1440-wide) against `next dev` + a live `arc serve` backend — NOT
fabricated — at `agentic-research/runs/2026-07-21-arc-clinical-p6-portal/visual-evidence/`:
- `03-clinical-warnings-panel.png` / `04-review-step-in-situ-scrolled.png` — a real `missing_receipt`
  blocking error, an `owner_held_gate` with an "Owner-held — not resolvable in this portal" chip naming
  OQ-5, and the "Not clinical approval / NOT release authorization" disclaimer.
- `13-round-trip-diff-real-edit.png` ("4 lines changed") + `11-round-trip-diff-empty.png` ("Exact match")
  — the exact round-trip preview diff, canonicalized both sides.
Spot-verified by the phase-owner (images read directly) and independently confirmed by ux-workflow-reviewer.

### Files Changed — ARC only (`agentic-research`), all committed by the phase-owner

Backend / tests:
- `arc_cli/meatywiki_source_adapter.py` (new — the adapter)
- `arc_cli/server/app.py` (round-trip forwarding of `authority_attachments`/`local_profiles`)
- `tests/test_meatywiki_source_adapter.py`, `tests/test_meatywiki_source_adapter_negative.py`,
  `tests/test_api_runs_clinical_fields.py` (new)

Web/portal (`web/src/…`): new codecs/utils (`codec-utils.ts`, `runspec-codec.ts`,
`evidence-manifest-codec.ts`, `clinical-preview-warnings.ts`, `text-diff.ts` + tests); new components
(`RunSpecClinicalFields`, `EvidenceSourceManifestForm`, `ClinicalPreviewWarnings`, `RoundTripPreviewDiff`,
`RunSpecRoundTripEditor`, `ui/CollapsibleSection` + tests); new routes (`app/evidence-sources/new`,
`app/runs/round-trip`); edits to `types.ts`, `arcade/derive.ts`, `RunSpecPreview.tsx`, wizard
(`WizardState.ts`, `RunWizard.tsx` + test, `ReviewStep.tsx`), `shell/Sidebar.tsx`, `shell/TopBar.tsx`,
and 7 route pages wrapped in `<Suspense>` (library/roles/councils/councils-recommend/runs/roles-[name]/
councils-[name]).

Visual evidence: `runs/2026-07-21-arc-clinical-p6-portal/visual-evidence/*.png` (10 PNGs, 2.1 MB).

**Not touched:** any tracked `schemas/`, `councils/`, or `knowledge-packs/` file (confirmed empty diff);
the pre-existing outbound `arc_cli/server/meatywiki.py`; and the other agent's uncommitted ARC work
(`.bob/`, `.claude/agent-memory/`, `.gitignore`, `runs/2026-07-19-spike-005-*`, `-006-*`, etc.) — staged
by EXPLICIT PATHS only, never `git add -A`.

### Deviations & Risks (all disclosed; none block AC P6.1)

1. **Process deviation (disclosed):** the python implementer that closed the backend round-trip half ran
   `git` (status/diff and a pathspec-scoped `stash push/pop` on `app.py`) despite the "no git" instruction.
   The phase-owner independently verified afterward: `git stash list` empty, all four work products present,
   and the other agent's uncommitted work untouched. No harm; the specialist recorded a recurrence note in
   its own memory.
2. **Out-of-scope defensive fix (`web/src/lib/arcade/derive.ts`):** the live API returns structured
   `council.gates` objects but the TS type said `string[]`, crashing (`g.trim is not a function`) whenever
   the pediatric council was selected — which blocked visual-evidence capture. Fixed defensively; flagged as
   real API/type-contract drift for a proper backend/type fix (follow-up).
3. **Evidence-source-manifest editor is download-only** (no backend PUT). Both the UI and backend specialists
   independently concluded a write endpoint would be a materially larger trust boundary than any existing
   PUT precedent (arbitrary caller-chosen repo path vs. fixed council/role directories). Raw YAML stays
   authoritative; the form serializes byte-exact YAML + SHA-256 for the operator to commit. Accepted as
   satisfying "raw YAML stays the authoritative fallback."
4. **`notes` RunSpec field has no persistence path** in `core.create_run` at all (not a forwarding gap —
   no parameter exists). Left alone; needs a design decision on where it lands. Follow-up.
5. **Non-blocking review follow-ups** (all LOW/INFO, reviewers PASSed with them open):
   - tool-governance F1: `_assert_no_echo` docstring overclaims (checks `str(exc)`+`str(__cause__)`, not
     `repr`/`__context__`) — doc drift, no real coverage hole.
   - tool-governance F2: add one nested arbitrary-extra-key injection test (defense exists via schema
     `additionalProperties:false`; just not directly asserted).
   - tool-governance F3 / security OBS-2: `fetch_source_metadata` doesn't cross-check returned `source_id`
     vs requested, and the per-vault `base_url` in the allowlist is parsed but not consumed — bounded, no SSRF.
   - security OBS-1: HTTP-supplied `authority_attachments`/`local_profiles` admission accepts absolute
     out-of-repo paths (schema-valid-record + symlink/registry-rejected + offline verify) — PRE-EXISTING
     since ADR-0005/0006, not introduced by P6; consider repo-root-constraining as defense-in-depth.
   - ux UXW-P6-02/03/04: manifest digest byte-exactness caution copy; disclaimer over-disclaims on
     non-clinical previews; round-trip "Exact match" relies on a sibling disclaimer.

### Known pre-existing RED (NOT a P6 regression)

`tests/test_local_profiles.py::DispatchAndCertificationGates::test_certification_acceptance_passes_the_gate_when_verified`
fails at ARC HEAD — the P1-P3 wall-clock time-bomb. Confirmed by the validator as the ONLY pytest failure.
Do not attribute to P6.

### Commits

| Repo | Commit | Contents |
|---|---|---|
| ARC (`agentic-research`) | see progress `commit_refs` | adapter + app.py round-trip fix + tests + full portal authoring/warnings/round-trip web surface + 10-PNG visual evidence |
| PED (`pediatric-anemia-site`) | see progress `commit_refs` | this note + phase-6 progress (`status: completed`) |

Both squashed to one commit per repo, direct to `main`, pushed (explicit paths only in ARC). No PR branch.
