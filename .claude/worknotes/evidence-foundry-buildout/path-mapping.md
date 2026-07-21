---
type: worknote
doc_type: path_mapping
prd: "evidence-foundry-buildout"
feature_slug: "evidence-foundry-buildout"
prd_ref: docs/project_plans/PRDs/infrastructure/evidence-foundry-buildout-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md
task: "P1-T1"
status: "complete"
created: "2026-07-21"
---

# Path-Mapping Worknote (P1-T1)

**Purpose**: `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` (the "02 doc")
was written before the Platform Foundation P0 module-package refactor (squash commit `ff4b519`) and
cites a pre-refactor tree. Per the parent plan's decisions block §2 ("Stale-Path Hazard"), this
worknote reconciles every stale path the 02 doc cites to its current-tree equivalent, so every
Phase 2+ task in this plan cites current paths, never `data/*`. **This is a hard blocker — no Phase
2+ task may start before this note lands** (parent plan §"Known Gotchas").

This note does not reopen any OQ-1..OQ-7 resolution in the parent plan
(`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md` §"Decisions
& OQ Resolutions") — it only maps paths those resolutions already assume.

## 1. Stale-path → current-tree mapping table

Every distinct stale-path reference found in the 02 doc (verified by `grep -n` against the full file)
is listed below with its current-tree equivalent and the reasoning.

| 02-doc stale path | Current-tree equivalent | Notes |
|---|---|---|
| `data/rules.json` | `modules/anemia/rules.json` | Existing 91-rule KB. **New** (E0 slice) rules land at `modules/cbc_suite_v1/rules.json` — OQ-1 resolution — never `data/`. |
| `data/evidence.json` | `modules/anemia/evidence.json` | Existing 6-source evidence registry. New module scaffold gets its own `modules/cbc_suite_v1/evidence.json` (empty-but-valid at P1-T3, populated at Phase 3). |
| `data/candidates.json` | `modules/anemia/candidates.json` | Existing 26-pattern candidate registry. New module gets `modules/cbc_suite_v1/candidates.json` (empty-but-valid at P1-T3). |
| `data/rule-provenance.json` (02 §4.4, §4.13 — new artifact) | `modules/cbc_suite_v1/rule-provenance.json` | OQ-3 resolution: package-shape extension under `modules/<id>/`, not a parallel `data/` system. Joined to `rules.json` by rule `id`. |
| `data/evidence-assertions.json` (02 §4.10 — new artifact) | `modules/cbc_suite_v1/evidence-assertions.json` | OQ-3 resolution, same rationale. |
| `data/questions.json` (02 §4.4 — new, "when questionnaire decouples from rules") | Not applicable to E0. If ever built, would land at `modules/<id>/questions.json` per the same OQ-3 rationale — no questionnaire-decoupling work is in scope for this plan (E0). |
| `data/reference-ranges.json` (implied by 02's general `data/` framing; not literally cited but part of the same pre-refactor tree) | `modules/anemia/reference-ranges.json` | New module gets a byte-identical copy at `modules/cbc_suite_v1/reference-ranges.json` (P1-T3), not separately registered in `src/ranges/registry.js` (OQ-1). |
| `data/module.json` / module manifest (02's general framing) | `modules/anemia/module.json` | New module gets `modules/cbc_suite_v1/module.json` (P1-T2), an unsigned stub matching the same shape plus the 02 §3.2 envelope fields. |
| `src/evidence.js` as sole/independent registry, hard-coding KB version/review date and duplicating `data/evidence.json` (02 §4.19, §6.3, §8.3, §9 "Open Questions") | `src/evidence.js` is **already a thin loader over `modules/anemia/evidence.json`**, not an independent hand-maintained copy | See §2 below — this is a materially different current state than the 02 doc describes, discovered while building this note. P1-T4 must still verify/extend this, not "eliminate a hand-duplicated object" from scratch. |
| `schemas/rule.schema.json` | Unchanged — already current-tree. Cited correctly by the 02 doc. | No mapping needed. |
| `docs/architecture.md` | Unchanged — already current-tree. | No mapping needed. |
| `validation/cases/<module_id>/*.json`, `releases/<knowledgeBaseVersion>/manifest.json` (02 §4.4 post-approval release layout) | No current-tree equivalent exists yet; out of scope for E0 (deferred — signed release is DF-E1-06 / ADR-5). Not remapped here; flagged only so a later phase doesn't invent a path without checking back. | |

## 2. Material finding: `src/evidence.js` is already unified, not duplicated

The 02 doc (§4.19, §6.3, §8.3, and the §9 open-questions table) describes `src/evidence.js` as a
hand-authored JS module that duplicates `modules/anemia/evidence.json` (then `data/evidence.json`)
and can drift from it. That description is **stale relative to the current tree**, not just
path-stale:

- `src/evidence.js` today (read in full while building this note) is a thin loader/reshaper:
  it imports `modules/anemia/evidence.json` via `with { type: 'json' }` and derives
  `KNOWLEDGE_BASE_VERSION`, `REVIEWED_THROUGH`, and `EVIDENCE` from it — there is no second
  hand-authored object literal left to eliminate.
- This landed via a **different, already-merged track** — commit `28c1487` ("Phase EP-3+EP-4:
  Evidence Provenance & Rule Governance (wave0-safety-foundation)", 2026-07-20), *not* any task in
  this evidence-foundry-buildout plan. The file's own header comment cites
  `docs/project_plans/design-specs/evidence-dual-source-unification.md` (DEF-1) as its origin.
- `docs/project_plans/design-specs/evidence-dual-source-unification.md` itself (dated 2026-07-18,
  `status: draft`) describes the **pre**-unification state (P0 shipped only a drift check, not a
  fix) — it predates commit `28c1487` and is now itself stale on this specific point. This worknote
  does not edit that design-spec doc (out of scope for P1-T1); it only flags the discrepancy so
  **P1-T4 does not redo already-completed work** or assume the design-spec doc's "not yet unified"
  framing is still accurate.

**Implication for P1-T4** (not decided here, just surfaced): P1-T4's task row still stands as written
— it should *verify* that `src/evidence.js`'s existing loader satisfies FR-2/02 §4.19 for both browser
and server import paths (and extend it if `cbc_suite_v1`'s evidence needs a lookup path once
populated), rather than starting evidence-registry unification from an assumed hand-duplicated
baseline. This is a scope-tightening observation, not a reopening of OQ-1..OQ-4 or the parent
decisions block.

## 3. `npm test` glob confirmation (OQ-5)

Per OQ-5 (decisions block §11, encoded in this plan, not re-decided): generated tests must land flat
under `tests/` as `ef-<module>-<category>.test.mjs` / `ef-converter-<aspect>.test.mjs` without ever
touching the `npm test` glob.

Checked directly against `package.json`:

```
"test": "node --test tests/*.test.mjs tests/witness/*.test.mjs"
```

**Confirmed**: the actual glob is `tests/*.test.mjs tests/witness/*.test.mjs` — two flat globs, no
subdirectory recursion beyond the single `tests/witness/` exception that already exists today
(37 files currently match `tests/*.test.mjs`; 3 files currently match `tests/witness/*.test.mjs`).
A new file named `tests/ef-<module>-<category>.test.mjs` or `tests/ef-converter-<aspect>.test.mjs`
(flat, directly under `tests/`) is automatically picked up by the first glob with **zero edits to
`package.json`**. Nothing in this plan places a generated test under `tests/witness/` or any other
subdirectory, so the second glob is unaffected. This confirms OQ-5's premise holds against the real
`package.json`, not just the plan's restatement of it.

## 4. Confirmation for the parent plan

This worknote satisfies P1-T1's acceptance criteria:
- Every stale-path row from the 02 doc's implicit table is present above with its current-tree
  equivalent (§1).
- An explicit confirmation line that `npm test`'s glob is untouched by this feature is recorded
  above (§3), including the exact current glob string (not the plan's paraphrase of it).
- The parent plan's decisions block §2 already references "Phase 1 must produce a path-mapping
  note" — this file is that note, at the path the parent plan and the phase-1-2 task file both cite:
  `.claude/worknotes/evidence-foundry-buildout/path-mapping.md`.
