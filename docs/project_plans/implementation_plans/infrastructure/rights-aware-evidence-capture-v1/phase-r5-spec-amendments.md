---
schema_version: 2
doc_type: phase_plan
title: "Phase EP-R5: Spec Amendments & Doc Truth"
status: draft
created: 2026-07-21
phase: EP-R5
phase_title: "Spec Amendments & Doc Truth"
prd_ref: docs/project_plans/PRDs/infrastructure/rights-aware-evidence-capture-v1.md
plan_ref: docs/project_plans/implementation_plans/infrastructure/rights-aware-evidence-capture-v1.md
feature_slug: rights-aware-evidence-capture
entry_criteria: "main at npm run check green; the reviewed spec bundle present; the review findings (cd15b4a) available as the source of every number quoted. This phase has no phase-level dependency — it may start in parallel with EP-R0; only EPR5-T7 is blocked, and only until EP-R0 merges."
exit_criteria: "Spec §15 splits measured from judged; Feist/CCC/ADA added to Appendix B and cited from the body; §3.7, §16.2 and §3.2 corrected; citation hygiene resolved or annotated; CLAUDE.md's npm run check string is byte-identical to package.json's; the 60/31/13 picture and residual gap R-1 are recorded; NOTICE.md and docs/architecture.md §7 describe the shipped artifacts without implying any clearance; npm run check green."
planning_maturity: ready
---

# Phase EP-R5: Spec Amendments & Doc Truth (WP5)

**Maps to PRD WP5.** **3 pts.** Wave 1, parallel with EP-R0 — no code dependency, and the
measured-vs-judged framing needs correcting in the reference spec *before* EP-R3 builds an axis on it.

**Dependencies**: **none at phase level** (`EP-R5: depends_on: []`). The phase may start in parallel
with EP-R0 — EPR5-T1..T6 have no dependency and start immediately. **Only EPR5-T7 blocks on EP-R0
merging**, because it documents the `rights/` substrate *as shipped*. That single constraint is
declared as a wave-1 `intra_wave_ordering` entry (`EPR5-T7 ← EP-R0`), not as a phase-level
`depends_on`, so the scheduler keeps the EP-R0 ∥ EP-R5 parallelism the wave plan exists to express.
**Assigned Subagent(s)**: `general-purpose` (primary), model `sonnet`, effort `medium` — doc edits,
with legal-citation care.
**Entry / exit criteria**: as frontmatter.

**Standing constraint for this phase:** amendments are recorded **as amendments**, never as silent
edits to the reviewed spec. Case law is cited as the reason a data model needs a particular axis —
never as a determination of how any specific item should be classified. This phase draws no legal
conclusion and states none.

## Integration Ownership (R-P3)

**`CLAUDE.md` is a serialization barrier owned exclusively by EP-R5.** No other phase may edit it. In
exchange, EP-R5 touches no schema, no gate, and no `package.json` entry — its file set
(`docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/*.md`, `CLAUDE.md`,
`NOTICE.md`, `docs/architecture.md`) is disjoint from every other phase's, which is what makes W1
parallelism safe.

EP-R5 documents the `rights/` tree that EP-R0 builds in the same wave. Sequence EPR5-T7 last so it
describes the substrate as shipped rather than as planned.

## Task Table

| Task ID | Task Name | Description | Acceptance Criteria | Estimate | Subagent(s) | Model | Effort | Dependencies |
|---------|-----------|--------------|----------------------|----------|-------------|-------|--------|--------------|
| EPR5-T1 | §15 — split measured from judged | Per FR-WP5-01: amend the reviewed spec's §15 decision matrix, splitting the single "numeric threshold" row into *measured/observed value* vs *consensus/judgment-derived recommendation*, routing the latter to `LEGAL_REVIEW_REQUIRED` rather than facts-only candidate. | §15 contains both rows with distinct routing. The change is recorded as a dated amendment entry, not a silent in-place edit. The amendment states the routing rule; it makes no determination about any specific threshold (OQ-1 stays open and routes to counsel). | 0.5 pts | general-purpose | sonnet | medium | — |
| EPR5-T2 | Appendix B — add and cite three authorities | Per FR-WP5-02: add *Feist Publications v. Rural Telephone Service*, 499 U.S. 340 (1991); *CCC Information Services v. Maclean Hunter Market Reports*, 44 F.3d 61 (2d Cir. 1994); and *ADA v. Delta Dental Plans Ass'n*, 126 F.3d 977 (7th Cir. 1997) to Appendix B. | All three appear with the citation exactly as given above, and each is **cited from the body**, not merely listed in the appendix. Citations are transcribed from the findings document, not reconstructed from memory. | 0.5 pts | general-purpose | sonnet | medium | EPR5-T1 |
| EPR5-T3 | §3.7, §16.2, §3.2 corrections | Per FR-WP5-03, FR-WP5-04, FR-WP5-05: fix §3.7's conflation of government *works* (uncopyrightable, 17 U.S.C. §105) with government-*funded* works, flagging the PMC trap; re-attach §16.1's contract caveat inline to §16.2 — re-wording does not defeat a contractual prohibition on incorporating the Materials into other materials, and copyright and contract are separate questions; scope §3.2's EU sui generis database-right discussion with territorial scoping and the CJEU *British Horseracing Board* / *Fixtures Marketing* creation-vs-obtaining carve-out. | §3.7 draws the works/funded line explicitly and names the PMC trap. §16.2 carries the caveat **inline**, not by cross-reference alone. §3.2 records both qualifications and no longer discourages a viable path unconditionally. Each edit is a recorded amendment. | 0.75 pts | general-purpose | sonnet | medium | EPR5-T2 |
| EPR5-T4 | Citation hygiene | Per FR-WP5-06 (findings §2.E): cite or remove `[S7]`; de-overload `[S1]`/`[S14]`; correct `[S11]`'s pin-cite; use the ELI permalink for `[S13]`; annotate that `[S5]`/`[S6]`/`[S7]` AAP URLs return 403 to automated clients so the "Verified" stamps are not machine-reproducible; pin `[S15]` FDA CDS guidance to **January 29, 2026** if an exact date is given. | Each of the six items is resolved or explicitly annotated as an accepted limitation with a stated reason. No citation is removed silently. The review found **no fabricated citations** — this task is refinement, and the amendment record says so, so a future reader does not infer a fabrication problem. | 0.5 pts | general-purpose | sonnet | medium | EPR5-T3 |
| EPR5-T5 | Fix `CLAUDE.md`'s stale `npm run check` composition | Per FR-WP5-07: `CLAUDE.md` currently states `npm test + npm run validate + npm run build + npm run check:imports + npm run smoke`. The authoritative composition in `package.json` is `test && validate && coverage:rules && build && verify:d4 && check:imports && smoke:browser && smoke`. Correct `CLAUDE.md` and add a doc-truth check comparing the two strings. | `CLAUDE.md`'s composition string matches `package.json`'s `check` script exactly. A doc-truth check (test or reviewer step) compares the two and fails on drift. `package.json` is **not** edited by this task — the doc moves to the code, never the reverse (EP-R0 barrier). | 0.25 pts | general-purpose | sonnet | medium | — |
| EPR5-T6 | Record the corrected blocking picture | Per FR-WP5-08: record in `CLAUDE.md` / project memory that the 0/91 gap is ~2/3 attestation-shaped (**60** rules) and ~1/3 licensing-shaped (**31** rules) — not wholly licensing-shaped — and that **13** bindable passages exist today, a fact currently recorded nowhere. | Both statements appear with their counts and cite `.claude/findings/rights-governance-spec-v1.0-review-findings.md`. No number is invented; every figure is transcribed from the findings. The text does not imply any of the 13 has been bound — 0 of 91 rules remain grounded. | 0.25 pts | general-purpose | sonnet | medium | EPR5-T5 |
| EPR5-T7 | `NOTICE.md`, `docs/architecture.md` §7, residual gap, deferred-item specs | Per FR-WP5-09 and FR-WP5-10: update `NOTICE.md` and `docs/architecture.md` §7 to describe the `rights/` tree, the release context, and the **coverage-only** gate posture; record residual gap R-1 (prohibited-excerpt detection is not deterministic) explicitly. Also create the five deferred-item design-spec stubs (DEF-R1..DEF-R5) and populate `deferred_items_spec_refs` in the plan frontmatter. | Both documents describe the shipped artifacts and **neither implies any clearance exists** — a reviewer check confirms the words "cleared", "licensed", or "approved" appear only in explicitly-negated form. R-1 is named in `docs/architecture.md` §7 as open. All five deferred items have a spec path and appear in `deferred_items_spec_refs`. Sequenced after EP-R0 merges so it describes the substrate as shipped. | 0.25 pts | general-purpose | sonnet | medium | EPR5-T6, EP-R0 |

**Phase total: 3 pts.**

## Phase EP-R5 Quality Gates

- [ ] §15 splits measured from judged with distinct routing, as a recorded amendment (EPR5-T1)
- [ ] *Feist*, *CCC*, *ADA* added to Appendix B and cited from the body (EPR5-T2)
- [ ] §3.7 works-vs-funded, §16.2 inline contract caveat, §3.2 EU scoping all corrected (EPR5-T3)
- [ ] All six citation-hygiene items resolved or annotated; "no fabricated citations" stated (EPR5-T4)
- [ ] `CLAUDE.md`'s `npm run check` string byte-identical to `package.json`'s; doc-truth check in place (EPR5-T5)
- [ ] 60 attestation-shaped / 31 licensing-shaped / 13 bindable recorded with citations (EPR5-T6)
- [ ] `NOTICE.md` + `docs/architecture.md` §7 describe the substrate; neither implies a clearance (EPR5-T7)
- [ ] Residual gap R-1 recorded as open (EPR5-T7)
- [ ] All five deferred items (DEF-R1..DEF-R5) have spec paths in `deferred_items_spec_refs` (EPR5-T7)
- [ ] No legal conclusion drawn; no threshold classified as measured or judged (OQ-1 stays open)
- [ ] `package.json` untouched (EP-R0 barrier); `CLAUDE.md` edited by this phase only
- [ ] `npm run check` green
- [ ] task-completion-validator sign-off

---

[← Back to main plan](../rights-aware-evidence-capture-v1.md)
