# Hash-Provenance Note — `rf-cbc-001` fixture bundle

**Task**: P1-T6 (Evidence Foundry Buildout, Phase 1 — Foundation & Fixtures)
**Source `rf` run**: `RF-CBC-001` — `rf_run_20260717_rf_cbc_001_pediatric_cds_establish`
(intent `intent_research_20260717_rf_cbc_001_pediatric_cds_establish`; catalog item
`ci_d541147d23f4`; local mirror read from
`research-foundry/runs/rf_run_20260717_rf_cbc_001_pediatric_cds_establish/`;
confirmed live via `GET $RF_API_URL/api/runs/<run_id>` — `status_derived: published`,
`verification.passed: true`, `verification.exit_code: 0`).
**Selection rationale**: per this plan's OQ-2 resolution (decisions block §9, addendum §11),
`RF-CBC-001` was chosen over `REG-001`/`REG-004` (both legal-review-flagged per PRD §8) and is
not itself flagged. It carries 12 source cards / 87 claims (74 supported, 8 inference,
5 speculation, 0 mixed/contradicted/unsupported) — `rf-handoff/RESULTS.md` records it as
`verified`.
**Derived**: 2026-07-21.

## 1. Content-rights disposition (applies to every passage in this bundle)

Every one of the 12 source cards in `RF-CBC-001` carries the same `usage` block:

```
usage: {allowed_for_public_output: false, allowed_for_work_output: true,
        allowed_for_personal_meatywiki: true, citation_required: true,
        quote_limit_notes: "Short excerpts only."}
```

**No passage in this run is positively confirmed rights-clear for committing verbatim text to
this repository.** Per this plan's decisions block §2/§5 and `02 §4.10`'s rights-restricted
fallback, this fixture therefore defaults **every single passage** to the restricted disposition:
the record retains an immutable **SHA-256 hash** of the original verbatim excerpt plus its
**precise selector** (the sibling `locator` field — e.g. "Abstract, Methods paragraph
(PubMed record, PMID 41565092)" — and the source card's own `evidence_id`), but never the
exact article text itself. This is a uniform disposition, not a per-passage judgment call: 12/12
source cards → 74/74 extracted passages → **rights disposition: restricted (hash + selector
only)**, 0/74 positively confirmed rights-clear.

| # | Source card | Title | Publisher | Evidence points (passages) | Disposition |
|---|---|---|---|---:|---|
| 00 | `src_20260718_rfcbc001_00` | Validating CALIPER pediatric reference intervals in a U.S. population using retrospective outpatient data and RefineR | Elsevier — Clin Chim Acta | 6 | restricted |
| 01 | `src_20260718_rfcbc001_01` | CALIPER Hematology Reference Standards (I): Improving Laboratory Test Interpretation in Children (Beckman Coulter DxH 900) | AJCP (Oxford Univ. Press) | 4 | restricted |
| 02 | `src_20260718_rfcbc001_02` | Comprehensive pediatric reference intervals for 79 hematology markers in the CALIPER cohort... (Mindray BC-6800Plus) | Int'l J. Lab. Hematology (Wiley) | 6 | restricted |
| 03 | `src_20260718_rfcbc001_03` | The diversity of mutations and clinical outcomes for ELANE-associated neutropenia | Current Opinion in Hematology (Wolters Kluwer) | 7 | restricted |
| 04 | `src_20260718_rfcbc001_04` | Stable Long-Term Risk of Leukaemia in Patients with Severe Congenital Neutropenia Maintained on G-CSF Therapy | British J. Haematology (Wiley) | 6 | restricted |
| 05 | `src_20260718_rfcbc001_05` | Outcomes of Isolated Neutropenia Referred to Pediatric Hematology-Oncology Clinic | Pediatrics (AAP) | 6 | restricted |
| 06 | `src_20260718_rfcbc001_06` | Clinical spectrum of pediatric neutropenia: mostly benign, but not to be overlooked | Turkish J. Pediatrics | 6 | restricted |
| 07 | `src_20260718_rfcbc001_07` | Diagnosis and management of isolated neutropenia: A survey of pediatric hematologist oncologists | Pediatric Blood & Cancer (Wiley) | 6 | restricted |
| 08 | `src_20260718_rfcbc001_08` | Outcomes for patients with severe chronic neutropenia treated with G-CSF (SCNIR) | Blood Advances (ASH) | 7 | restricted |
| 09 | `src_20260718_rfcbc001_09` | Neutropenia in Childhood — A Narrative Review and Practical Diagnostic Approach | MDPI (Hematology Reports) | 7 | restricted |
| 10 | `src_20260718_rfcbc001_10` | CALIPER Hematology Reference Standards (I) | AJCP (Oxford Univ. Press) | 8 | restricted |
| 11 | `src_20260718_rfcbc001_11` | Duffy-Null Phenotype-Associated Neutropenia is the Most Common Etiology for Leukopenia/Neutropenia Referrals... | J. Pediatrics (Elsevier) | 5 | restricted |
| | | | **Total** | **74** | **74/74 restricted** |

## 2. What was sanitized, and how

Only the **verbatim exact-passage excerpts** were redacted — everything else in the bundle
(claim ledger, extraction cards, report, verification record, RF's own paraphrased summaries,
population/assay/lifecycle metadata, source metadata, locators) is copied byte-for-byte
unmodified, because none of it reproduces the underlying articles' text at length:

- `sources/src_*.md` — each source card's `extracted_points[].quote` field (the YAML
  frontmatter verbatim excerpt) and the matching `— quote: "..."` line in the markdown
  "Key evidence" section were replaced with
  `[redacted — content-rights: restricted (usage.allowed_for_public_output=false); sha256:<hash>]`,
  where `<hash>` is the SHA-256 of the original excerpt's exact bytes (both occurrences of the
  same excerpt hash identically, so a reviewer can confirm the YAML and markdown copies agree
  without ever seeing the text). The embedded excerpt inside each `threshold.passage_locator`
  flow-map value (which mixed a human-readable selector prefix with a second copy of the
  verbatim excerpt) was likewise replaced by its own SHA-256 hash — the human-readable selector
  is preserved undiminished in the sibling `locator` field one level up, so no addressability is
  lost.
- `extractions/ext_*.yaml` — copied unmodified; these extraction cards were verified (by direct
  inspection of all 12 files) to carry only `text` (RF's own paraphrase) and `locator`
  (selector), never a `quote`/verbatim-excerpt field.
- `claims/claim_ledger.yaml`, `reports/report_draft.md`, `reviews/verification.yaml`,
  `research_brief.md`, `swarm_plan.yaml`, `evidence_bundle.yaml`,
  `writebacks/ccdash_event.yaml` — copied unmodified; verified (by direct inspection) to contain
  no verbatim source-article excerpts (claim text and report sentences are RF's own
  paraphrased/synthesized prose with `[claim:clm_id]` references, not reproduced article text).

Total redactions: **198** (74 `quote` fields + 74 mirrored markdown-bullet quotes + 50
`passage_locator` embedded excerpts). The full per-redaction ledger (file, line, field, excerpt
length, SHA-256) is machine-readable JSON at
[`passage-hash-ledger.json.txt`](./passage-hash-ledger.json.txt) in this directory (named with a
`.json.txt`, not a bare `.json`, extension deliberately — see §2.1).

### 2.1 Why the ledger isn't named `*.json`

`scripts/evidence/backfill-rule-governance.mjs` computes each rule's `requiredTestCaseIds` by
recursively walking `tests/witness/` **and `tests/fixtures/`** for every `*.json` file and
running it through the engine as if it were a patient-intake fixture (`scripts/rule-coverage.mjs`'s
`computeCoverage()`, `fixtureDirs: ['tests/witness', 'tests/fixtures']`). A non-intake `.json`
blob dropped anywhere under `tests/fixtures/` derives to an almost-entirely-missing fact set,
which the KB's generic missing-data safety rule treats as a witness and appends to its
`requiredTestCaseIds` — silently drifting the **committed** `modules/anemia/rules.json` (confirmed
directly: `npm test` failed `rule-governance.test.mjs`'s `--check` invariant the first time this
ledger was named `passage-hash-ledger.json`, inserting this path into one rule's list). Since
`modules/anemia/` is read-only for this task, the ledger is named `passage-hash-ledger.json.txt`
(content is still plain JSON — parse it with `JSON.parse()` as normal) so the coverage scan's
`endsWith('.json')` filter skips it. Every other file in this fixture keeps its native `rf`
extension (`.yaml`/`.md`, matching the run's own source-card/extraction-card/bundle formats) —
none of those are `.json` either, so none of them touch this coupling.

## 3. Bundle hash (fixture as committed)

**Verified**: after this fix, `node --test tests/rule-governance.test.mjs` and the full
`npm test` (848/848) pass with `modules/anemia/rules.json` untouched.

SHA-256 computed over the sorted `relative_path:sha256(bytes)` pairs of every artifact file in
this fixture directory (i.e. the mirrored `RF-CBC-001` bundle: `evidence_bundle.yaml`,
`research_brief.md`, `swarm_plan.yaml`, `claims/claim_ledger.yaml`, `reports/report_draft.md`,
`reviews/verification.yaml`, `writebacks/ccdash_event.yaml`, all 12 `sources/src_*.md`, all 12
`extractions/ext_*.yaml` — 31 files total; this note and `passage-hash-ledger.json.txt` are
excluded from the bundle hash as fixture-derivation metadata, not `rf` bundle content):

```
bundleSha256: sha256:104ea57d354c0694a629a20c055093cd4907df74192779bc5954a322646b88f0
fileCount: 31
```

Per-file SHA-256 (original run file → fixture file) is recorded in
`passage-hash-ledger.json.txt`'s `files[]` array for every copied artifact, alongside the
per-passage redaction hashes.

## 4. Directory layout (mirrors `evidence_bundle.yaml.artifacts`)

```
tests/fixtures/rf-cbc-001/
  evidence_bundle.yaml          (copied unmodified)
  research_brief.md             (copied unmodified)
  swarm_plan.yaml                (copied unmodified)
  claims/claim_ledger.yaml       (copied unmodified)
  reports/report_draft.md        (copied unmodified)
  reviews/verification.yaml      (copied unmodified)
  writebacks/ccdash_event.yaml    (copied unmodified)
  sources/src_20260718_rfcbc001_{00..11}.md   (sanitized — see §2)
  extractions/ext_20260718_*.yaml (12 files, copied unmodified)
  passage-hash-ledger.json.txt   (this fixture's own derivation metadata, not `rf` content —
                                   `.json.txt`, not `.json`; see §3.1 for why)
  HASH-PROVENANCE.md             (this note)
```

Paths are resolved exactly as `evidence_bundle.yaml.artifacts` declares them
(`source_cards_dir: sources/`, `extraction_cards_dir: extractions/`, etc.) so that P2-T2's
read-only bundle loader (not yet built) can resolve every artifact without any hard-coded
assumption once it exists.

## 5. Non-goals of this note

This note does not reopen OQ-1..OQ-7 or the parent decisions block. It documents only how this
one fixture bundle was derived from `RF-CBC-001` and what was redacted and why — a rights/hash
record, not a clinical-content or rule-authoring decision.
