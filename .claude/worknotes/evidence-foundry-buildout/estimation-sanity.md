# Estimation Sanity Check — evidence-foundry-buildout (Tier 3)

**Not part of the implementation plan body.** Migrate this content verbatim into
`docs/project_plans/human-briefs/evidence-foundry-buildout.md` §2 ("Estimation Sanity Check") when that
brief is authored — per the plan's Human Brief pointer line and `human-brief-template.md`.

Expands `.claude/worknotes/evidence-foundry-buildout/decisions-block.md` §6 into the full
`estimation-heuristics.md` H1–H6 template, reconciled against the final 42-pt, 7-phase task breakdown in
`docs/project_plans/implementation_plans/infrastructure/evidence-foundry-buildout-v1.md`.

---

## H1 — Noun-Counting Rule

**~2 pts per new CRUD-with-RBAC domain noun, before cross-cutting features.** This feature has no
database/RBAC layer, but the analogous unit here is a **new artifact class** the converter/module
package must produce, validate, and round-trip: a first-class content type with its own schema, its own
generation logic, and its own validation path.

New artifact classes introduced (≥2 pts each, per decisions block §6):

1. `modules/cbc_suite_v1/` module envelope (module.json + package scaffold + registry wiring) — Phase 1
2. Sanitized fixture bundle + hash-provenance note — Phase 1
3. `tools/rf-bundle-to-kb-pack/` converter itself (CLI + loader + hashing + eligibility + error taxonomy
   + 3 verbs) — Phase 2/3, the densest single artifact class
4. Evidence/claim/decision/rule projections (`evidence-assertions.json`, `rule-provenance.json`,
   `authoring-decisions.yaml`, strict rule projection) — Phase 3
5. Generated test corpus (5 category files × 4 rules) — Phase 4
6. Manifest/traceability artifacts (`release-manifest.unsigned.json`, `conversion-report.json`,
   `semantic-diff.json`, traceability index) — Phase 5

**Floor**: 6 classes × 2 pts = **12 pt floor**, before the 8 ADRs (Phase 6, docs-only, not a noun) or
docs closure (Phase 7). The converter (item 3) and the projection set (item 4) are each themselves
multi-artifact bundles under H4 below, not flat 2-pt units — this is why the actual bottom-up total
(42 pts) sits well above the 12-pt noun floor rather than at it.

## H2 — Dual-Implementation Multiplier

**N/A.** This repository has no dual local/enterprise (or SQLite/PostgreSQL, or v1/v2 API) split. Every
artifact this feature produces has exactly one implementation target. Confirmed against decisions block
§6 ("H2: n/a — no dual local/enterprise implementation").

## H3 — Algorithmic Service Flag

**Fires.** `tools/rf-bundle-to-kb-pack/` is explicitly a transform/join/diff/graph service:
- **transform**: bundle YAML → normalized IDs/dates/units/locators (converter Phase "Normalize," `02
  §4.6` phase 3)
- **join**: authoring-decisions ↔ claims ↔ rules ↔ tests (Phase 3's whole scope; the traceability index,
  Phase 5)
- **diff**: `semantic-diff.json` (Phase 5, OQ-4)
- **graph**: the `02 §4.16` traceability graph with required bidirectional queries (Phase 5)

Per H3, this is budgeted at **≥3 pts standalone with an explicit test-scenario list**, not folded into a
generic "build a CLI" line item. The test-scenario list is enumerable directly from `02 §4.6`'s 11
converter phases and `02 §2.3`'s 15 seam invariants (the same enumerability that justified the SPIKE
waiver — see the PRD's SPIKE Waiver Rationale). Realized budget: Phase 2 (converter core, 8 pts) + Phase
3 (projection/drafting, 8 pts) + Phase 5 (manifest/traceability, 5 pts) = **21 pts** of the 42-pt total
is directly attributable to this algorithmic surface — half the feature.

## H4 — Bundle-vs-Sum Check

This PRD packages more than 3 capability areas under one slug (module envelope, evidence unification,
converter, vertical-slice migration, test corpus, manifest/traceability, 8 ADRs, deferred-item docs).
Per-area independent estimates, summed as the plan-total floor:

| Capability Area | Independent Estimate | Notes |
|---|---:|---|
| P1 — Foundation & fixtures (envelope, evidence unification, schema wiring, fixture) | 5 pts | 7 tasks, none individually algorithmic |
| P2 — Converter core (EF-WP0: CLI, hashing, eligibility, 15 seam invariants) | 8 pts | H3-flagged; seam-invariant test suite alone is 1.75 pts |
| P3 — Projection & drafting (evidence/claim/decision/rule pipeline, `propose` verb) | 8 pts | H3-flagged; 7 tasks each producing a distinct artifact/schema |
| P4 — Vertical slice + test corpus (4 rules × migration + 4-5 test categories each) | 8 pts | Not H3-flagged (content migration + test authoring, not new algorithm), but H1-dense: 4 rules × 2 concerns (migrate + test) |
| P5 — Manifest & traceability (manifest, report, diff, traceability index, determinism proof) | 5 pts | H3-flagged (diff + graph); determinism proof alone carries `extended` effort |
| P6 — Pre-E1 ADRs (8 documents) | 5 pts | Not algorithmic; ~0.6-0.8 pts/ADR reflects real architectural-judgment content, not boilerplate |
| P7 — Docs & deferral closure (CHANGELOG, architecture.md, 11 deferred-item docs) | 3 pts | 11 of 16 tasks are ≤0.2 pts each (H6-style small plumbing), offset by 2 substantive doc tasks |
| **Σ** | **42 pts** | **Plan total = Σ exactly — no top-down compression applied** |

## H5 — Anchor Reference Comparison

**Anchor**: `platform-foundation-p0` (`docs/project_plans/PRDs/refactors/platform-foundation-p0-v1.md`,
Tier 3, 7-phase squash, commit `ff4b519`) — the only prior completed Tier 3 plan in this repository, and
the module-package contract this feature builds directly on top of.

**Anchor actual cost**: 17 pts over 7 phases (bottom-up, no compression; see its own human brief).

**Anchor surface**: ~20 files touched; 3 new registry layers, 1 new package convention, 4 shim files, 2
new tests (1 golden-fixture regression harness, 1 structural test). Zero new artifact *content* — it was
a pure structural refactor with an explicit zero-clinical-behavior-change mandate.

**This plan's surface**: ~30+ files touched across 7 phases; 1 new module package (`cbc_suite_v1`), 1
entirely new CLI tool (`tools/rf-bundle-to-kb-pack/`, ~7 internal concerns: loader, hashing, eligibility,
error taxonomy, 3 verbs), 4 new schema-validated artifact types, 4 new/migrated clinical rules with a
5-category generated test corpus each, 1 manifest/traceability subsystem, 8 ADRs, 11 deferred-item docs.

**Estimate delta vs. anchor**: 42 pts vs. 17 pts = **2.5×**.

**Delta justification**: The anchor was a zero-new-content structural refactor (relocate + generalize
existing logic, prove equivalence). This plan is the opposite shape: it is almost entirely **new
content and a new algorithmic service** (the converter, H3-flagged) built *on top of* the anchor's
contract, plus real clinical-rule migration with safety-test obligations (dangerous-miss coverage) the
anchor never had to satisfy. A 2.5× cost for introducing a brand-new build-time pipeline plus 4 new
schema-validated artifact classes plus 8 architecturally-substantive ADRs — versus the anchor's pure
mechanical relocation — is proportionate, not an under- or over-estimate relative to the anchor. Per H5's
own rule ("if your plan introduces more nouns than the anchor but estimates less, stop and re-derive"):
this plan introduces strictly more nouns (6 new artifact classes vs. the anchor's 0) **and** estimates
more (42 vs. 17) — consistent, no re-derivation triggered.

## H6 — Hidden Plumbing Budget

**~15% already folded into phase numbers, not added on top** (decisions block §6 binding instruction).
Concretely, the plumbing this feature requires — `npm run check` integration (schema wiring in
`scripts/validate-kb.mjs` across Phases 1/3/5), `.gitignore` update (Phase 1), CHANGELOG entry (Phase 7),
registry wiring (`src/modules/registry.js`, `src/facts/registry.js`, Phase 1) — is already itemized as
named sub-0.75-pt tasks inside the relevant phases (P1-T3, P1-T4, P1-T5, P1-T7, P7-T1) rather than
folded into a single opaque "plumbing" line. Cross-checking: these 5 tasks sum to 0.5+1.0+0.75+0.25+0.3 =
**2.8 pts**, which is 6.7% of the 42-pt total — below the 15-20% band H6 recommends, but that is
expected here because the *dominant* cost driver in this plan is the H3-flagged algorithmic converter
(21 pts, 50% of total), not CRUD-style plumbing. No additional plumbing line item is added on top, per
the decisions block's explicit instruction.

## H7 — Huge-File Touch Multiplier (checked, not requested by decisions block §6, included for completeness)

**N/A.** `wc -l` across every file this plan's `files_affected` list touches shows no file over ~120
lines (`src/evidence.js` 110, `scripts/validate-kb.mjs` 97, `src/modules/registry.js` ~45,
`modules/anemia/module.json` 13). This is a small research-prototype repository; no 2K+-line file exists
anywhere in scope. No multiplier applied; no High-Friction Surfaces note needed.

---

## Summary

**Bottom-up total**: 42 pts / ~7 engineer-weeks (assuming ~6 pts/week matching the anchor's realized
pace of ~2.4 pts/week over ~7 weeks, adjusted for this plan's higher per-pt density from H3-flagged work)
**Top-down anchor**: `platform-foundation-p0` took 17 pts; this plan's 2.5× multiple is justified above
(H5)
**Reconciliation**: Bottom-up (H4 Σ = 42) and the decisions block's independently-stated H4 floor (42,
from its own per-phase bottom-up: 5+8+8+8+5+5+3) agree exactly — no reconciliation gap. Tier 3 confirmed
at ≥13 pts by more than 3×.

**Locked estimate**: **42 pts** (matches decisions block §6 exactly; no compression applied at any
level).
