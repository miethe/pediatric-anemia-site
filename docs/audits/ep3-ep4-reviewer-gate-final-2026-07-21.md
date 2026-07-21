## Per-invariant results

1. **HOLDS — Clinical approval.** All 91 source and built rules carry explicit `clinicalApprovers: []`. Populated arrays failed schema/source/built/runtime checks; malformed `"approved"` failed both `runRules()` and `assess()`. A poisoned API request returned the D-4 refusal rather than an assessment. `npm run check` builds before `verify:d4`. All complete assessment paths use guarded `runRules()`; exported `evaluateCondition()` evaluates only condition syntax and produces no rule output.

2. **HOLDS — Attestation.** In temporary committed-tree copies, unattested source-supported bindings failed for both `rules.json` and `candidates.json`; matching structurally valid attestations passed. Missing fields, automated identifiers including `OpenAI o3`, unrecognized credentials, missing/outside/directory references, leaf and intermediate symlinks, non-files, traversal, and impossible dates all authorized nothing. Real dates and an existing in-directory artifact passed. The limitation that code cannot establish humanity is explicit in [docs/attestations/README.md](/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/wave0-ep34-evidence-governance/docs/attestations/README.md).

3. **HOLDS — Cross-source.** A validly attested WHO passage bound to an AAP-only rule failed validation. The direct empty-`evidence` regression test also passed, failing closed.

4. **HOLDS — Biconditional.** For located records, `source-supported` requires empty `reviewFlags`, and non-empty flags require `quarantined`; `quarantined` with empty flags is rejected. Tests explicitly scope the equivalence away from implementation-proposal sentinels.

5. **HOLDS — Candidate resolution.** All 26 candidates carry non-null pointers resolving to the actual passage record. Unknown and quarantined pointer mutations are rejected. Current split: 26 implementation-proposal, zero source-supported, zero quarantined.

6. **HOLDS — Output contract.** Rule-audit entries require both passage fields. `sourcePassageStatus` accepts only `source-supported`, `quarantined`, `implementation-proposal`, or `null`; arbitrary status and missing-field mutations fail.

7. **HOLDS — Module scoping.** Both evidence accessors and end-to-end `assess()` throw for unregistered module IDs rather than using anemia evidence.

8. **HOLDS — Honest self-representation, with one bookkeeping follow-up.** Both trackers parse, use phase status `partial`, have `completed: null`, calculate 4/6 and 3/4 completion, and pass strict `validate_artifact.py` plus `validate-phase-completion.py`. Reviewer sign-off remains explicitly pending. The findings register records seven passes and RG-16 through RG-19.

## Independent data verification

- 91/91 rules: zero differences from `main` after removing only the nine governance fields.
- 26/26 candidates: identical to `main` after removing only `sourcePassageId`.
- Six golden fixtures: zero differences across all 36 requested field comparisons.
- Digests: zero mismatches across 33 dangerous-miss bindings and 28 hazard-matrix bindings.
- `npm run check`: passed, including 681/681 tests, 91/91 rule coverage, build, post-build D-4, imports, and both smoke gates.
- Worktree remained clean; no tracked files were modified.

## Defect

LOW — Phase 4 records a stale current test total — [.claude/progress/wave0-safety-foundation/phase-4-progress.md:163](/Users/miethe/dev/homelab/development/pediatric-anemia-site/.claude/worktrees/wave0-ep34-evidence-governance/.claude/progress/wave0-safety-foundation/phase-4-progress.md:163) — tracker says 678 tests while the current suite passes 681/681 — update the count or remove the volatile exact number.

Not checked: clinical validity, source-text fidelity against publisher originals, attester identity or credential authenticity, paywalled-source retrieval, and visual/accessibility UI behavior. Those remain documented out-of-scope or human-authority-dependent limitations.

VERDICT: APPROVE WITH FOLLOW-UPS


[2mtokens used[0m
199,861
