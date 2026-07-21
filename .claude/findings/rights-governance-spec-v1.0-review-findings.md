# Findings — Rights Governance Spec v1.0: review and adoption determination

**Date:** 2026-07-21
**Reviewed artifact:** `docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/`
(added in `eafd5bc`) — 1374-line spec + 5 JSON Schemas + 3 agent templates + 6 validated examples.
**Method:** 4 parallel read-only investigation legs (current blocking state / source-by-source delta /
adversarial legal-citation verification / integration cost), then 3 adversarial verifiers each
prompted to *refute* the most load-bearing leg claims. Two legs were partially refuted; one
verifier reversed the reviewer's own starting premise.
**Question put:** *"Does this clarify the points we've been exploring, and does it unblock our usage
of most sources?"*

> This is an engineering and governance review. It is not legal advice and not clinical sign-off.

---

## Determination

**Adopt the spec. It does not unblock most sources — and in the short term it makes this repo
strictly *more* blocked, by design. That is the correct outcome and the spec is worth adopting
anyway.**

Three sentences, precisely:

1. The spec is a **classification vocabulary and an evidentiary burden**, not a clearance. Nothing
   in it grants a right this project did not already have.
2. Its net immediate effect under §20.2 is to convert an undocumented rights position into **91
   explicit `UNKNOWN`s with a hard build gate**, plus a per-component assessment backlog that no
   agent may close.
3. Its real value is that it **legitimises a path** (`CLEARED_FACTS_ONLY`) the project had
   effectively written off, makes an existing exposure machine-checkable, and gives the AAP
   licensing conversation a documented shape.

**Genuine unblock, counted honestly: 7 rules** (the `CDC2025_LEAD` family, U.S. federal public
domain, §3.7) — and only after a rights record is written for them.

---

## 1. What the spec gets right (verified, not assumed)

All 15 Appendix B sources were independently checked. **They hold up.** No fabricated citations.

Two checks are worth recording because the reviewer expected them to fail:

- **[S15] FDA CDS guidance, January 2026 — CONFIRMED.** The review opened by treating this as a
  probable citation defect, on the assumption that the controlling document was the September 2022
  final guidance. That assumption was wrong. FDA issued a revised **final** CDS guidance on
  2026-01-06, re-issued 2026-01-29 (docket FDA-2017-D-6569, CDRH GUI01400062), which supersedes the
  2022 guidance. Verified against the guidance PDF cover page itself, the FDA guidance-database
  entry (content current as of 01/29/2026), an FDA CDRH town hall transcript, and three independent
  law-firm analyses (Covington, Hyman Phelps, Arnold & Porter). `fda.gov` returns a spurious 404 to
  automated fetchers — bot-blocking, not a dead link. If the spec ever pins an exact date, use
  **January 29, 2026** (the Jan 6 version is itself superseded).
- **[S5] AAP Pediatric Care Online terms — CONFIRMED.** The terms do say subscribers may not
  "alter, abridge, adapt or modify the Materials or prepare derivative works based upon the
  Licensed Materials or **incorporate the Materials into other materials**," with use limited to
  "providing healthcare services to Users' patients." The spec characterises this accurately.
- **[S10] PMC — CONFIRMED, if anything understated.** PMC states verbatim that "Many articles in
  PMC are protected by U.S. and/or foreign copyright laws, even though PMC provides free access,"
  and that "Systematic downloading of batches of articles from the main PMC web site, in any way, is
  prohibited."

The spec's core framing — *evidence quality, reuse rights, and clinical suitability are three
independent dimensions* — is correct and is the thing this project most needed stated plainly.

---

## 2. Where the spec needs amendment before it governs anything

Ranked by consequence. None of these are fabrications; the weakness is **omitted case law**.

### A. `CLEARED_FACTS_ONLY` is over-broad for *guideline consensus thresholds* (material)

This is the single most important correction, because `CLEARED_FACTS_ONLY` is the entire basis for
the hoped-for unblock.

§15 says "Encode a reported numeric threshold → Facts-only candidate." The spec never cites
**CCC Information Services v. Maclean Hunter Market Reports**, 44 F.3d 61 (2d Cir. 1994), which held
that used-car valuations were **protected expression, not facts**, because they represented the
editors' *predictions and professional judgment* — and where the infringing use was precisely a
commercial database. Nor does it cite **ADA v. Delta Dental Plans Ass'n**, 126 F.3d 977 (7th Cir.
1997), holding a taxonomy (numbering plus short descriptions) copyrightable. Nor **Feist**, the
controlling authority for the fact/expression line, which is absent from the document entirely.

Operational consequence for this repo — and it is a sharp one:

- A **measured value from a primary study** (a cohort's reported sensitivity at a cutoff) is close
  to the strong end of the facts argument.
- A **guideline consensus cutoff** ("refer if ferritin ≤ 20 ng/mL") is a committee's professional
  judgment, which is exactly what CCC found protectable. Most of what this KB wants to encode is
  the second kind.

**Amendment:** split §15's single "numeric threshold" row into *measured/observed value* vs
*consensus/judgment-derived recommendation*, and route the latter to `LEGAL_REVIEW_REQUIRED` rather
than facts-only candidate. Add Feist, CCC, and ADA to Appendix B.

### B. §3.7 conflates government *works* with government-*funded* works (material)

U.S. federal-government works are uncopyrightable under 17 U.S.C. §105. NIH-**funded** articles by
university authors are copyrighted, and they are abundant in exactly the PMC corpus this project
searches. The spec's operational guidance does not draw that line. This is a live trap here.

### C. EU sui generis database right is overstated as applied (moderate, blocks needlessly)

§3.2's statement of Directive 96/9/EC Art. 7(1) is verbatim-accurate, but the spec omits (a)
territorial scoping — irrelevant to a US-only product — and (b) the CJEU *British Horseracing
Board* / *Fixtures Marketing* carve-out excluding investment in **creating** data, which likely
covers a laboratory generating its own reference intervals. As written it needlessly discourages a
viable path.

### D. §16.2 drops its own contract caveat (moderate, under-conservative)

§16.1 correctly states the AAP subscription bars incorporation into other materials. §16.2 then
lists "state independently worded clinical facts or recommendations" as often usable — without
re-attaching that caveat. Re-wording does not defeat a contractual prohibition on *incorporating
the Materials into other materials*; copyright and contract are separate questions, as the spec
itself says in §3.3. §16.2 should carry the caveat explicitly.

### E. Minor citation hygiene

`[S7]` is defined but never cited in the body. `[S1]` is over-loaded (one chapter URL carries §102,
§103, §105, §107) and `[S14]` duplicates it. `[S11]`'s pin-cite is one page off. `[S13]`'s EUR-Lex
URL returns a bot challenge — use the ELI permalink. `[S5]`/`[S6]`/`[S7]` AAP URLs 403 to any
automated client, so the "Verified 2026-07-21" stamps are not machine-reproducible — mildly ironic
given §8.2's ban on unapproved automated retrieval.

---

## 3. Corrected picture of what is actually blocking this repo

The standing project belief has been: *the 0/91 grounding gap is a licensing problem, not an access
or research problem.* **That belief is about one-third right and needs amending.** Measured from
code and data, not narrative:

| | count | shape of the blocker |
|---|---|---|
| Rules bound to a sentinel whose primary source has ≥1 **bindable** passage | **60** | human attestation |
| Rules bound to `AAP2026_IDA` (all 7 of its passages quarantined `source-not-independently-retrievable`) | **31** | licensing / retrievability |
| **Total** | **91** | |

There are **13 passages that are already bindable today** — `status: source-supported`, empty
`reviewFlags`, all `passageFidelity: paraphrase`, all carrying real substantive prose (BLOOD 5, WHO
3, CDC 2, BSH 2, FDA 1). None are rights-withheld. `REG_002_CLEARED = false`
(`scripts/validate-kb.mjs:17`) does not gate any of them — it only constrains `passageFidelity` to
`paraphrase`/`withheld`, which they satisfy. This fact is recorded nowhere in the findings register,
`CLAUDE.md`, or project memory, and it materially changes where effort should go.

**But three qualifications keep this from being good news, and they were established by trying to
refute it:**

1. **The ledger is one entry per rule.** Attesting one passage grounds *one* rule. Grounding the 60
   requires **60 separate attestation records** from a named credentialed clinician, drawn from a
   pool of only 13 passages — 5 BLOOD framework statements would have to carry 47 distinct rules.
2. **A deliberate honesty tripwire stands in the way.** `tests/attestation-ledger-gate.test.mjs:45-48`
   asserts the ledger is empty, with the message *"a non-empty ledger is a clinical claim."* No
   attestation can land without a human consciously deleting that assertion. That is the gate
   working as designed.
3. **The 13 survivors are the numerics-light ones.** Per
   `docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md`, the passages carrying the actual
   thresholds (WHO Hb cutoffs, the elevation-adjustment quadratic, BSH G6PD values, AAP Table 1
   intervals) were quarantined for `omits-source-numerics` — the numbers were stripped during
   rights-avoidance paraphrasing. So attesting the survivors would ground rules to **thin framework
   claims rather than to the thresholds those rules actually encode.**

Honest one-liner: **~2/3 of the gap is attestation-shaped, ~1/3 is licensing-shaped, and the
attestation-shaped part currently leads to weak groundings.** The rights spec touches only the
licensing third.

---

## 4. `reference-ranges.json` — a real coverage gap, but not a new discovery

The delta leg claimed this file was a "new, previously invisible, high-severity block." Adversarial
verification **partially refuted** that. What is true:

- It is explicitly AAP Table 1 derived: `modules/anemia/reference-ranges.json:2` (`"source":
  "AAP2026_IDA"`), `modules/anemia/ranges.js:10` (cites *Pediatrics* 2026;158(1):e2026077414, Table
  1), and `modules/anemia/evidence.json:63` names the exact table and columns.
- **32** numeric values (4 age bands × 2 sexes × `hbLower`/`mcvLower`/`mcvUpper`/`rdwUpper`).
- It is load-bearing in `deriveFacts()` and **ships byte-identical to the browser SPA**
  (`dist/modules/anemia/reference-ranges.json`).

What is false: it is **not** invisible or new. The AAP reuse block is hardcoded at
`scripts/validate-kb.mjs:17`, documented in `.claude/findings/rf-ev-003-oa-substitute-findings.md`,
flagged for this exact passage in the EP3-T5 fidelity audit, and named in `CLAUDE.md`, `NOTICE.md`,
and the signed KB manifest (`scripts/sign-kb.mjs:41`).

Also, the compilation-risk case is **weaker than §17-B's nomogram example**, not equal to it: the
file takes a *one-sided, decision-driven* subset (Hb lower bound with no upper; RDW upper with no
lower) of 3 analytes from a table titled "Normal Hematologic **Parameters**", with a scope that
diverges from the source (6 months vs the table's 9 months), and AAP itself credits the table to
"(ref 42)" — AAP is a redistributor here, which weakens its originality-in-selection claim while
adding a third-party rightsholder.

**The defensible finding is narrower and more useful than the original claim:** the *derived-fact
channel* (`reference-ranges.json` → `deriveFacts()` → all 91 rules) is **not covered by the
passage-level gating** that catches the 32 AAP-citing rules. A rules-only rights sweep would miss
it entirely. That is a gap in the **shape of the gate**, and it is the single most actionable
technical finding in this review.

---

## 5. Adoption shape and cost

**Rights objects belong in a new top-level `rights/` tree with a join ledger — not inline
`extensions.rights`, not per-module.** Justified against conventions the repo already established:

- **RG-9 precedent:** the rule→passage attestation join was deliberately moved *out* of the clinical
  files into `evidence-packs/passage-attestations.json`. `scripts/validate-kb.mjs` already calls
  `loadAttestationLedger()` / `validateBindingsAgainstLedger()`; a rights ledger drops into that
  seam.
- **Digest churn:** `sign-kb.mjs KB_JSON_FILES` covers rules/candidates/evidence/reference-ranges.
  Inline rights means a *rights re-review* mutates `clinicalContentHash` and forces a new signed
  release. The two-part digest exists precisely to keep governance axes separable.
- **`kb-diff.mjs` fails closed** on unknown change classes; inline fields would require new change
  families in a 1521-line normative classifier. A `rights/` tree costs zero classifier work.
- **Fail-open risk:** an *optional* inline `extensions` block means an unassessed rule is silently
  unassessed. A total-coverage ledger validated bidirectionally fails closed.
- Rights are **source**-scoped; modules are not. Per-module files would duplicate records the moment
  the CBC module cites the same sources.

Schemas needing `additionalProperties: false` amendment *if* inline is ever chosen anyway:
`rule.schema.json:12`, `candidate.schema.json:8`, `evidence.schema.json:7,22,54`,
`module-manifest.schema.json:12`, `reference-range.schema.json:15`, `terminology-profile.schema.json:7`.

**Deterministic §20.2 gates implementable today:** missing-assessment coverage (bidirectional —
cheapest and highest value), blocking-status enum test, open-critical-failure check, and
use/territory/channel set-containment. Permission expiry is deterministic but must take
`--as-of`/env, **never `Date.now()`** (byte-identical determinism, AC EP3-T2).

**Not deterministic:** prohibited-excerpt detection — that is residual gap R-1 and would require
restricted source text in-repo, which REG-002 has not cleared. Substitute with the existing
`passageFidelity !== 'verbatim'` check plus a negative asset check.

**Note:** `json-schema-lite` silently ignores `format: "uri"` (only date/date-time are checked). Add
a `pattern` or document the gap before relying on it.

### Minimum viable Phase 1 (ships)

- Vendor the 5 spec schemas verbatim under `schemas/rights/` as an interop contract (like
  `openapi.yaml`) — no runtime code reads them.
- `rights/release-context.json` with `commercial: false`, `use_type: internal_research`. **This is
  the single highest-leverage artifact in the whole adoption** — it stops a future agent assuming
  commercial clearance.
- 6 `rights_records` seeded from RF-EV-003 at status `agent_triage_only`.
- `rights-failures.json` cross-linked to REG-002 / EP3T5-F01 / F02.
- `scripts/validate-rights.mjs` wired into `npm run validate` (4 deterministic gates, pure exported
  functions) + a fails-closed resilience test.
- **Close the derived-fact coverage gap:** a rights record for `reference-ranges.json` itself, and a
  gate asserting every file in `KB_JSON_FILES` has one.
- Docs: architecture §7, `NOTICE.md`, `CLAUDE.md`.

### Deferred (do not attempt)

Per-component reuse assessments, permission records, counsel review, Zone 0–5 enforcement,
surveillance, `rightsHash` / `KB_JSON_FILES` changes (normative under SPIKE-006 Amendment 1).
**Zone 1 (controlled source vault) must never live in this repo** — the correct control here is the
negative invariant "no third-party full text."

**Effort:** Phase 1 ≈ one EP-6-sized phase. No runtime changes, no rule migration. Expect the
reviewer gate to cost about as much as the implementation. Phase 2 is hard-blocked on a named human
rights owner. Phase 3+ is business and legal, not engineering.

---

## 6. Two adoption hazards that would repeat known failures

1. **The spec opens a second unguarded door to the claim D-4 forbids.** Its
   `approvals.clinical_owner` and `review.clinical_reviewer` fields are free strings. This repo
   enforces `clinicalApprovers` / `approvedBy` as `maxItems: 0` hard schema violations precisely to
   prevent an agent asserting clinical sign-off. **Constrain those fields to null in the vendored
   copies.** The spec's own examples put `rights-governance-agent` in reviewer fields, actively
   inviting the mistake.
2. **`counsel_approved` is a self-declared string.** It must pass the same *positive* checks as
   RG-14/16/17 — closed credential list, realpath-canonical `attestationRef` under
   `docs/attestations/`, calendar-valid date — reusing `attested-passage-map.mjs` rather than a
   second validator. An agent-authored `CLEARED_*` status would be the rights-domain equivalent of
   RG-1 (the mechanical binder that produced provably wrong bindings and was removed, not fixed).

**Do not conflate two orthogonal axes:** the spec's `clearance_status` is *legal*; the repo's
passage `status` is *epistemic*. A passage can be `source-supported` **and** `CONTRACT_RESTRICTED`
simultaneously — that is exactly the AAP case. Also avoid duplicating `passageFidelity` with
`verbatim_excerpt_allowed`; two fields that can disagree is a fail-open.

Where the spec is genuinely ahead of the repo: `evidence.schema.json`'s `$defs/source` records **no
licence, access basis, or terms at all**. That `AAP2026_IDA` is unusable for reuse currently exists
only as prose in `.claude/findings/`. Making that machine-checkable is the largest real safety gain
on offer.

---

## 7. Answer to the question asked

> *"…hopefully unblocks our usage of most sources now"*

**No.** It unblocks 7 rules (CDC, public domain) and gives a documented, defensible path toward
re-anchoring perhaps 59 more on primary sources — conditional on article-level licence verification
for *Blood* and *BJH*, a compilation-similarity assessment for the 44 rules resting on a single
review article, re-authoring 11 near-verbatim spans, and a **named human rights reviewer who does
not yet exist**. The AAP-anchored 31 stay blocked; §16.4's recommendation is a licence conversation,
and buying more AAP *access* makes the rights position worse, not better (§3.3, §16.1, Appendix A:
`commercial_use: not_granted_by_subscription`).

> *"…clarifies many of the points we've been exploring lately"*

**Yes, substantially** — and this is the real value. It supplies the vocabulary the project was
missing, correctly separates the three governance dimensions, and converts a set of scattered prose
findings into a machine-checkable model. Adopt it for legibility and auditability, with the §2
amendments applied, and with expectations reset: **it is the instrument that measures the debt, not
the payment.**

### Recommended next actions

1. Apply §2 amendments A–D to the spec (case-law gap is the priority; A materially narrows the
   facts-only path this project was counting on).
2. Implement the Phase 1 slice in §5, including the `reference-ranges.json` derived-fact gate.
3. Correct the project memory: the gap is ~2/3 attestation-shaped, not wholly licensing-shaped.
4. Record that 13 bindable passages exist — nowhere currently states this.
5. Recognise that the two named bottlenecks are **a credentialed clinician** and **a named rights
   owner**. Neither is an engineering task, and no agent may substitute for either.
