# Clinical Review Workflow v1 — Feature Guide

**Status**: Unvalidated research prototype. No gate cleared (G0–G4 all uncleared). No real reviewers. Nothing clinically validated.

## What Was Built

**CLI verbs** (five-role ADR-0004 review workflow layer):
- `status` — displays review-chain state, derived role progression, and blockers; `--json` frozen shape, redaction-by-default for independence, fail-closed `invalid` state
- `sign` — TESTKEY-only synthetic path; reads staged drafts from `.review-drafts/`, never rewrites committed files; soft-fails on real-identity records (pre-G1/G2)
- `scaffold` — auto-derives subject content hash, writes draft staging files, optionally exercises real-identity write path against fixture rosters only

**Shared derived-state library** (`lib/derived-state.mjs`) — single source of truth consumed by `status` and `validate` for review-chain state (completeness, next-expected role, blockers).

**Incremental validate cache** (`lib/validate-cache.mjs`) — cross-process persistent composite-keyed store (record hash, predecessor hashes, roster hash, schema hash, validator-policy version, history-mode flag); invalidates fail-closed on any component mismatch; module-wide checks never cached.

**Governance-sensitive adjudication policy** (FR-26, P1-T5) — encodes ADR-0004 decision item 5: `adjudication` role required only when `clinical-1` and `clinical-2` decisions disagree; on agreement, four roles suffice. Tested on both paths without touching ADR-0004 status field.

**Runbook & portal framework**: `docs/governance/reviewer-runbook.md` (two labeled tracks: synthetic-persona exercise vs. post-G1 real reviewer); `.claude/worknotes/clinical-review-workflow/friction-observations.md` (OQ-8 portal-promotion framework: metric format, threshold-as-proposal, owner-role, decision-record template).

**Render queue section** — static HTML display of five-role sequence with NEXT/TERMINAL markers sourced from shared derived-state library.

## Architecture Overview

```
scaffold --draft         sign --draft         validate
  (staged file)    →      (ephemeral TESTKEY)  →  (chain + cache)
                              ↓
                      review-record.yaml
                    (append-only committed)
                              ↓
                      status / render
                   (derived state + display)
```

Shared `computeDerivedReviewState()` function computes state once; `status`'s `--json`, `validate`'s violations, and `render`'s queue section all consume identical result (R2 drift guard).

## How to Test

**Real CLI flow end-to-end:**
```bash
npm run check  # includes all tests below
node --test tests/ef-review-workflow.test.mjs
node tools/review-record/cli.mjs status --module cbc_suite_v1
node tools/review-record/cli.mjs status --module cbc_suite_v1 --json
node tools/review-record/cli.mjs validate --module cbc_suite_v1
```

**Scaffold → sign → validate flow (synthetic persona):**
```bash
node --test tests/ef-review-workflow.test.mjs \
  --grep "scaffold.*draft.*sign.*draft.*validate"
```

**Runbook + governance-sensitive fixtures:**
```bash
node --test tests/ef-review-adjudication.test.mjs
```

## Test Coverage Summary

Fixture classes: committed 5-record `cbc_suite_v1`, chain-broken fixture, disputed fixture, chain-isolated fixture, agree/disagree adjudication paths.

Full adversarial sweep (P5-T1, F8): transposed-character hash, out-of-order acts, supersedes-based corrections, malformed YAML, roster failures, signature tampering, git-history mutations — all fail closed.

Test file globs: `tests/*.test.mjs` and `tests/witness/*.test.mjs` (two flat, non-recursive globs per F10).

## Known Limitations

1. **Governance-sensitive FR-26 change** (P1-T5) — `adjudication` role completeness is now conditional on clinical-1/clinical-2 disagreement. Tested on both agree and disagree paths; ADR-0004 status field stays `proposed` (G0-gated, not ratified by this feature).

2. **No real roster entries** — `governance/reviewer-roster.yaml` carries zero `synthetic: false` entries and never written by any test. Fixture rosters only (`tests/fixtures/clinical-review-workflow/roster-with-real-entry.yaml`) exercise real-identity write path.

3. **Post-G1 `--allow-historical-subject` residual** — `scaffold --allow-historical-subject` suppresses subject-hash comparison but not pattern validation; traces to FR-5 (Revision 1); requires G1 human-owner action to rationalize usage.

4. **No portal code** — OQ-8 framework informs but does not commit to portal construction; mockups watermarked CONCEPT-ONLY; design spec maturity stays `shaping`.

5. **Uncleared gates** — G0 (ADR-0004 ratification), G1 (named credentialed roster), G2 (signing custodian + key ceremony, ADR-0005), G3 (data-source spike for retrospective validation), G4 (release authorization) all remain uncleared.
