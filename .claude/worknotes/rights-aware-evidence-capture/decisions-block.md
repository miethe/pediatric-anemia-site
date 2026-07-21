# Decisions Block — Rights-Aware Evidence Capture & Taxonomy

**Author:** Opus (orchestrator), 2026-07-21
**Feature slug:** `rights-aware-evidence-capture`
**Tier:** 3 (~29 pts)
**Feasibility base:** `.claude/findings/rights-governance-spec-v1.0-review-findings.md` (merged `cd15b4a`)

This block is binding on the PRD and Implementation Plan. Downstream authoring agents must not
re-litigate these decisions; they may only refine estimates and task decomposition beneath them.

---

## 0. SPIKE waiver (Tier 3 requirement)

**Waived, with rationale recorded here rather than in a stub artifact.**

Tier 3 normally requires a SPIKE. The feasibility work is already done and merged: the four-leg
exploration plus three adversarial verifiers behind `cd15b4a` established the current blocking
state, the source-by-source delta, the citation verification, and the integration cost. Authoring a
SPIKE now would restate merged findings.

The one genuinely unresolved question — **whether a given clinical threshold is a
measured/observed value (facts-strong) or committee judgment (facts-weak, *CCC v. Maclean Hunter*
exposure)** — is a legal determination. No SPIKE can close it; it routes to counsel. It is recorded
as `OQ-1` and is an explicit non-blocker for every phase except the ones that would ship a
`CLEARED_*` status (which are deferred out of this feature entirely).

---

## 1. Binding framing decisions

### D1 — The archive is provenance, not text. This is the load-bearing decision.

The request is to "capture all the facts data we can, and even the guidelines, clearly denoted
separately… so that in the future we still have all those details if we come up with a good way to
utilize them legally."

**Adopted, with one hard boundary: maximal capture means maximal *addressable provenance*, never
retained third-party expression.**

The intuition to hoard now and decide later is right. The naive implementation of it — storing
source full text or verbatim tables in-repo against a future licence — is precisely the contract
exposure the reviewed spec warns about (§3.3), is what the findings said Zone 1 must never do inside
this repo, and would convert a copyright question (defensible) into a contract-breach question
(not). It would also poison the repo permanently: a restricted excerpt in git history cannot be
un-shipped.

What actually makes future legal use possible is **not** having the text. It is having, for every
claim, a locator precise enough that when a licence arrives you can re-fetch and bind
*mechanically*: source + edition + section + table + row + column + assay + population. That is the
durable asset, it is lawful to hold today, and it survives losing access to the source.

**So the archive stores:** independently-worded atoms, exhaustive structured locators, rights
metadata, taxonomy, and appraisal — and records what it deliberately did *not* store, so the gap is
visible rather than mistaken for absence of evidence.

**Consequence for the existing corpus:** this reframes the `omits-source-numerics` quarantine
(§3 of the findings) as the wrong remedy applied to the right worry. Stripping numbers to avoid
rights risk destroyed evidence value without reducing exposure — a reported cutoff is the fact, and
the exposure was never in the digits. Phase EP-R3 re-captures numerics into typed atoms with full
locators. **This is the single highest-value correction in the feature** and it is why EP-R3 carries
the most points.

### D2 — New item types, organised on an axis the reviewed spec does not have

The request asks for different item types. The reviewed spec's §5.1 component classes are a
*rights* taxonomy. They are necessary but insufficient, because they do not encode the distinction
the findings identified as decisive: **measured vs. judged**.

Adopted item types for the evidence archive (`evidence_item_type`):

| Type | Nature | Facts-only strength |
|---|---|---|
| `observed_finding` | measured/derived from data in the source | strong |
| `reference_interval_value` | single interval value, population-scoped | strong individually; compilation risk in aggregate |
| `equation_or_method` | formula, conversion, derivation | strong; screen for patent |
| `guideline_recommendation` | consensus/committee judgment | **weak — CCC exposure** |
| `instrument_or_questionnaire` | scored instrument, test items | permission by default |
| `bibliographic_metadata` | identifiers, citation | cleared |
| `derived_synthesis` | **our own** authored claim over ≥2 sources | ours to licence |

Two orthogonal axes are carried per item and must never be collapsed: `evidence_item_type` (what
kind of knowledge) × `rights_component_class` (spec §5.1, what kind of protected thing). A third,
already in the repo, stays separate: passage `status` is *epistemic*, `clearance_status` is *legal*.
Three axes, three fields, no conflation. The findings flagged conflation as a fail-open.

**Guidelines are captured, not avoided.** That a named body recommends X, with a locator, is itself
a fact and is archivable. Its *prose* is not. This is what "clearly denoted separately" buys.

### D3 — `derived_synthesis` is the strategic exit, and it starts now

The request anticipates "eventually creating our own explicit guidance from them and attributed
accordingly." That is spec §21.1/§21.4 — the moat. It is also the only path that ends with content
this project *owns*.

It must not be a Phase-5 aspiration. `derived_synthesis` ships as a first-class item type in EP-R3
with attribution-to-inputs modelled from day one, even though few instances will exist initially.
Retrofitting provenance onto synthesis after the fact is not possible — you cannot reconstruct which
inputs a claim came from once it is written.

**Constraint:** a `derived_synthesis` item is a clinical claim. It requires the same human
attestation as any binding, and no agent may author one as authoritative. Agents may prepare
*candidates*; a clinician adjudicates. Same D-4 discipline, new object type.

### D4 — Rights records live in a top-level `rights/` tree with a join ledger

Carried forward from the findings §5, which justified this against five repo conventions
(RG-9 precedent, digest churn under `sign-kb.mjs KB_JSON_FILES`, `kb-diff.mjs` fail-closed
classifier cost, fail-open risk of optional inline `extensions`, and source-vs-module scoping).
Not re-opened here. **Explicitly rejected:** inline `extensions.rights`.

### D5 — Two-repo split: generic → Research Foundry spec, specific → this repo

Anything that is not pediatric-specific belongs upstream in Research Foundry, as a **spec + handoff,
not code we write**:

- licence / access-basis / terms fields on source and evidence entities
- the `evidence_item_type` taxonomy and the measured-vs-judged axis
- capture-time rights triage and terms snapshotting
- alternative-source discovery when a source is restricted

Stays here: the `reference-ranges.json` derived-fact gate, `KB_JSON_FILES` coverage, module wiring,
`validate-rights.mjs`, and everything touching the anemia KB.

**Boundary rule when in doubt:** if the CBC module would need it too, it is Research Foundry's.

### D6 — Clinician time is the binding constraint; design around it

The findings named two human bottlenecks (a credentialed clinician, a named rights owner) and
established that ~60 of 91 rules are attestation-shaped. Clinician minutes are the scarcest resource
in the program.

Therefore the clean-room workflow (spec §9) is optimised to **minimise clinician time, not agent
time**. Agents prepare a decision-ready brief; the clinician adjudicates and attests. The brief
summarises source guidance — it must never quote it into the implementation record, or the
clean-room is contaminated and the separation-of-duties defence is lost.

**Non-negotiable:** no agent may write `clinicalApprovers[]`, `approvedBy[]`, a
`derived_synthesis` authority claim, or any `CLEARED_*` status. EP-R4 ships the *brief generator*
and the *ledger plumbing*; it ships zero attestations.

### D7 — Do not turn on the hard release gate in this feature

Findings §5: adopting spec §20.2's gate before there is anywhere to record answers bricks the build
for no safety gain. Every gate in this feature is **coverage- and consistency-shaped**
(does every shipped artifact have a rights record? do the axes agree?), never
clearance-shaped (is this cleared?). Clearance gating is deferred until a rights owner exists.

---

## 2. Phase boundaries

| Phase | Name | Pts | Rationale for the boundary |
|---|---|---|---|
| **EP-R0** | Rights substrate | 5 | `rights/` tree, `release-context.json`, vendored schemas, `validate-rights.mjs` skeleton wired into `npm run validate`. Everything else depends on the substrate existing. Ships the `commercial:false` declaration — cheapest guardrail in the program. |
| **EP-R1** | Derived-fact coverage gap | 3 | `reference-ranges.json` rights record + a gate asserting every `KB_JSON_FILES` entry has one. Small, deterministic, closes the blind spot. Separated from EP-R0 so it can ship independently if the substrate stalls. |
| **EP-R2** | Source rights metadata | 5 | `evidence.schema.json` `$defs/source` gains licence/access/terms. Makes the AAP block machine-checkable instead of prose. **Serialization barrier** — touches the schema EP-R3 also touches. |
| **EP-R3** | Evidence item taxonomy & archive capture | 8 | The `evidence_item_type` axis, `derived_synthesis`, locator enrichment, and numerics re-capture. Largest phase, largest payoff. Depends on EP-R2's schema landing first. |
| **EP-R4** | Clean-room authoring workflow | 5 | Brief generator + ledger plumbing. Depends on EP-R3's taxonomy. Ships no attestations. |
| **EP-R5** | Spec amendments & doc truth | 3 | §15 measured/judged split, add Feist/CCC/ADA, fix §3.7 works-vs-funded, §16.2 caveat, EU scoping — plus fix `CLAUDE.md`'s stale `npm run check` composition (survey found real drift vs `package.json`). Parallelizable throughout. |
| **RF-HANDOFF** | Research Foundry spec | — | Separate deliverable, no repo code. Parallel with everything. |

**Waves:** W1 = [EP-R0, EP-R5, RF-HANDOFF] · W2 = [EP-R1, EP-R2] · W3 = [EP-R3] · W4 = [EP-R4]

**Serialization barriers** (files two phases would both edit):
- `schemas/evidence.schema.json` — EP-R2 then EP-R3, strictly ordered
- `scripts/validate-kb.mjs` — EP-R1, EP-R2
- `package.json` — EP-R0 only (all gate wiring lands once)
- `CLAUDE.md` — EP-R5 only

---

## 3. Agent routing

| Phase | Primary | Model | Effort | Note |
|---|---|---|---|---|
| EP-R0 | general-purpose | sonnet | medium | Mechanical scaffolding + gate wiring |
| EP-R1 | general-purpose | sonnet | high | Small but must fail closed; needs care |
| EP-R2 | general-purpose | sonnet | high | Schema migration under `additionalProperties:false` |
| EP-R3 | general-purpose | **opus** | high | Taxonomy design judgment; numerics re-capture is evidence-sensitive |
| EP-R4 | general-purpose | sonnet | high | Workflow + generator; D-4 discipline critical |
| EP-R5 | general-purpose | sonnet | medium | Doc edits, legal-citation care |
| RF-HANDOFF | general-purpose | sonnet | high | Spec authoring, no code |

**Registered agent types only.** This environment does not have `codebase-explorer`,
`senior-code-reviewer`, `implementation-planner`, or `prd-writer` registered — the `/explore`
workflow failed on exactly that. Plans must route to `general-purpose` / `Explore` / `Plan` and
must not name unregistered types.

---

## 4. Risk hotspots

| Risk | Severity | Mitigation |
|---|---|---|
| An agent writes a `CLEARED_*`, `clinicalApprovers[]`, or authoritative `derived_synthesis` | **critical** | Schema-level `maxItems:0` / null-constraint in vendored copies; a fails-closed test per D-4 precedent |
| Restricted source text enters the repo "for the archive" | **critical** | D1 boundary; negative invariant test asserting no third-party full text; git history is unrecoverable |
| Numerics re-capture (EP-R3) reintroduces verbatim table structure | high | Per-value atoms with locators, never a reproduced table; `REG_002_CLEARED` stays false |
| Adopting §20.2 gating bricks the build | high | D7 — coverage gates only, never clearance gates |
| Three axes get collapsed into one status field | high | Separate fields, enforced by schema; findings flagged conflation as fail-open |
| Two-repo drift: we implement what RF should own | medium | D5 boundary rule; RF-HANDOFF authored in W1 so the line is drawn before EP-R3 |
| `json-schema-lite` silently ignores `format: "uri"` | medium | Use `pattern`, or document; found in the review |

---

## 5. Estimation anchors

Calibrated against merged phases in `wave0-safety-foundation`: EP-3+EP-4 (evidence provenance +
rule governance) shipped as one PR at roughly 8 pts; EP-5 (manifest + semantic diff) at roughly 5;
EP-6 (adversarial validation corpus) just landed. EP-R3 is anchored **above** EP-3+EP-4 because it
carries taxonomy design plus data re-capture across 41 passages. EP-R1 is anchored below EP-5
because it is one record plus one loop.

Total ~29 pts. If EP-R3 exceeds 10 during execution, split it at the taxonomy/re-capture seam rather
than compressing the re-capture.

---

## 6. Open questions

- **OQ-1 (counsel, blocking nothing here):** For each threshold family, is the value measured or
  committee-judged? Drives `evidence_item_type` and, later, clearance. Recorded per-item as
  `judgment_basis: unassessed` until answered.
- **OQ-2 (rights owner):** Who holds the role? Blocks all clearance work; blocks nothing in EP-R0–R5.
- **OQ-3 (product strategy):** Re-anchor the 44 rules resting on one *Blood* review article onto
  primary studies? Strengthens facts-only and removes single-source dependency (§21.3), at real
  re-synthesis cost. Not decided in this feature.
- **OQ-4:** Does Research Foundry accept the handoff spec as-authored, or does it counter-propose a
  different entity model? EP-R3 should avoid hard-coupling to RF's shape until answered.
