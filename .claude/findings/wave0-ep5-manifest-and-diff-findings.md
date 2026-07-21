---
title: "Findings: Wave 0 EP-5 Manifest & Semantic Diff"
schema_version: 2
doc_type: report
report_category: finding
status: completed
created: 2026-07-21
updated: 2026-07-21
feature_slug: wave0-safety-foundation
plan_ref: docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-5-manifest-and-diff.md
owner: pediatric-cds-program-owner
tags: [semantic-diff, kb-manifest, fail-closed, adversarial-review, findings]
---

# Findings — Phase EP-5 (Manifest & Semantic Diff)

Findings from EP5-T4, the cross-family adversarial pass against `scripts/kb-diff.mjs`, plus two
findings surfaced incidentally while validating EP5-T3 and EP5-T1.

**EP5-T4 reviewer**: `gpt-5.6-sol` via `codex exec` at `xhigh` reasoning effort — a deliberately
cross-family lens, since the classifier was authored by a Claude-family model. Every finding below
marked CONFIRMED was reproduced by executing the mutation through the real classifier, not reasoned
about abstractly.

**Honesty boundary**: this was an automated adversarial review. It is *not* clinical validation, not
credentialed clinical sign-off, and confers no release authority. Nothing here may populate
`approvedBy[]` or `clinicalApprovers[]`.

## Disposition summary

| ID | Severity | Confirmed | Disposition |
|---|---|---|---|
| EP5T4-001 | critical | executed | FIXED in EP5-T3 |
| EP5T4-002 | high | executed | FIXED in EP5-T3 |
| EP5T4-003 | high | executed | FIXED conservatively; clinical calibration remains OPEN (OQ-12) |
| EP5T4-004 | medium | executed | FIXED in EP5-T3 |
| EP5T4-005 | — | executed | Coverage claim corrected; test gaps closed |
| EP5-F006 | high | executed | FILED — needs human action, deliberately NOT auto-fixed |
| EP5-F007 | medium | n/a | FILED — provenance decision needs owner confirmation |

---

## EP5T4-001 — Protective array **reorder** erased by multiset comparison (critical)

Reordering `actions[]` on `ALERT-001` (emergency severity) emitted **no change at all**:
`changes: []`, `cosmeticOnly: true`, `clean: true`.

RA-1 requires protective-output changes to block "regardless of edit shape." The implementation
compared array fields by multiset, which is correct for detecting in-place element edits but erases
ordering entirely. `actions[]` is the ordered list of what a clinician should do first in an
emergency; resequencing it changes clinical meaning while the release reports clean.

The amended spec is itself internally inconsistent here — its own multiset prescription erases
reorders — so this is a spec defect as well as an implementation one.

## EP5T4-002 — Combined combinator+arity edit hides a `B10 combinator-swap` (high)

Changing `ALERT-009.when` from `{all:[neutropenia, fever]}` to `{any:[neutropenia]}` emitted only
`B9 leaf-remove · review`. No `B10 combinator-swap` was emitted and `summary.block` was `0`.

The skeleton comparison only compared combinator types when arity and nesting shape were otherwise
identical, so a simultaneous combinator + arity change slipped past the very check
(skeleton-before-leaf, ARC-028 property 2) that exists to catch it. This is a hole in the normative
Step 0 pseudocode, not only a transcription error.

**Clinical consequence, executed**: with `neutropenia=true, fever=false`, behavior changed from *no
alert* to firing emergency alert `ALERT-009` ("Fever with neutropenia flagged"), directing the
febrile-neutropenia pathway for a child with no fever.

## EP5T4-003 — `note` outputs can be inverted into false reassurance and only tier `review` (high)

Rewriting `NOTE-004.output.detail` from

> "A normal assay during acute reticulocytosis/hemolysis or soon after transfusion may not exclude
> G6PD deficiency. Repeat quantitative testing at baseline if suspicion remains."

to

> "A normal assay excludes G6PD deficiency; no repeat testing is needed."

classified `C10 display-text-change · review`, `outputProtective: false`.

The implementation **matched the amended spec exactly** — RA-9 deliberately scoped `outputIsProtective`
to alerts, questions and sole-contributor candidates, excluding all 6 note rules. So this is a
confirmed **spec-level** safety gap, not an implementation bug.

**Disposition**: fixed in the fail-safe direction — note outputs are now treated as protective, so
such an edit blocks. Blocking too much costs review effort; blocking too little ships a false
reassurance. This follows ARC-028 preserved property 1 (unresolved ⇒ `block`) and does **not**
resolve OQ-12: whether note-type edits genuinely warrant equal weight with emergency alerts remains
referred to a named credentialed pediatric hematology reviewer. All 6 note rules were inspected and
each carries similar interpretation guardrails.

## EP5T4-004 — Candidate `evidence[]` reorder silently erased (medium)

Reordering `iron-deficiency-anemia.evidence` from `[AAP2026_IDA, BLOOD2022_PED_ANEMIA]` to the
reverse emitted `changes: []` with `cosmeticOnly: true`. Family D defines `D8` as *any* `evidence[]`
change; the implementation compared it as an unordered set.

This also creates a first-source/passage mismatch: `sourcePassageId` remains
`AAP2026_IDA#implementation-proposal` while the first-cited source becomes BLOOD, and
`schemas/candidate.schema.json` describes that pointer as resolved against the first-cited source.

## EP5T4-005 — The 73/83 seeded-mutation coverage claim was overstated

EP5-T3 reported 73 of 83 mutations individually simulated and asserted. The adversarial pass verified
this and found the accounting inaccurate, despite all 94 tests passing:

- **M02** — not simulated at its specified rule/site; a different rule was substituted.
- **M21** — asserts only `B2`; the table requires `B2 + B6`.
- **M24** — claimed as a dedicated named test; **no such test existed**.
- **M24 / M61** — the table requires `B5 · note`, but the full pipeline emits no change because JSON
  parsing collapses `2` and `2.0`. The M61 test asserted zero changes. Helper-level tests do not
  prove CLI/classifier behavior.
- **M52** — asserts `B9` but never asserts its required `review` tier.
- **M38 / M39 / M45** — assert only `invariant.passed === false`, not the operational
  `block` / `clean: false` consequence.
- **M22 / M34 / M47 / M76** — actual tier is `block` where the table says `review`. Conservative, not
  unsafe, but not exact table conformance.

The ten Family-H exclusions (M48–M51, M54, M57, M79–M82) were confirmed **honest** — all are
JavaScript-source mutations genuinely invisible to a JSON differ, with no JSON-visible mutation
hidden among them. Their test only asserts the filenames appear in `filesNotDiffed`, which is the
most that can be asserted without a behavioral probe.

---

## EP5-F006 — 13 protective rules carry an empty `requiredTestCaseIds` (high) — FILED, NOT FIXED

Surfaced by RA-8's new rule that an empty `requiredTestCaseIds` array must **fail** the resolve check
rather than pass vacuously. Verified live against `modules/anemia/rules.json`:

| Rule | Output |
|---|---|
| `ALERT-009` | alert — **emergency** |
| `ALERT-005` | alert — urgent |
| `ALERT-LEAD-CAPILLARY` | alert — important |
| `AINF-001`, `AINF-003`, `THAL-BETA-001`, `HS-001` | candidate — strongly-supported |
| `MARROW-002` | candidate — meets-defined-pattern |
| `AINF-002`, `HS-002`, `MARROW-003` | candidate — supported |
| `AINF-004`, `THAL-002` | candidate — possible |

These are protective rules with **no test-case binding at all** — a governance gap left by EP-4 that
nothing previously detected.

**Deliberately not auto-fixed.** Inventing test-case bindings for protective clinical rules is
precisely the class of change that requires human authorship; an agent "tidying" this away would
manufacture the appearance of governance coverage that does not exist. Consequence: `isClean()`
returns `false` on the current KB even for a zero-diff round trip. **That is the correct behavior** —
the KB genuinely contains ungoverned protective rules. Route to EP-6/EP-7.

## EP5-F007 — `validationRunId` signed as `local-dev:unattested` (medium) — FILED

`smoke-test.mjs` boots the real server, so once EP5-T5 flipped startup to fail-closed the committed
manifest had to be servable, which forced a value for `validationRunId`. It is signed
`local-dev:unattested` — truthful about being a developer-machine build with no CI attestation —
overridable at release via `KB_VALIDATION_RUN_ID`.

Needs owner confirmation that this is the intended provenance convention, and CI wiring to supply a
real run id. Flagged so it does not silently become permanent.
