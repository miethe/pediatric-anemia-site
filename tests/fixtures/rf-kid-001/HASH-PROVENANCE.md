# Hash-Provenance Note — `rf-kid-001` fixture bundle

**Task**: P1-T5 (`multi-bundle-conversion-e1`, Phase 1 — Vendoring & Batch Orchestration)
**Source `rf` run**: `RF-KID-001` — `rf_run_20260717_rf_kid_001_pediatric_cds_evidence`
(intent `intent_research_20260717_rf_kid_001_pediatric_cds_evidence`; catalog item
`ci_cbd4efa518ca`; IntentTree node `node_01KXRTYJ63NSH1B6RRCYSAVKVR`; local mirror read from
`research-foundry/runs/rf_run_20260717_rf_kid_001_pediatric_cds_evidence/`; confirmed live via
`GET $RF_API_URL/api/runs/rf_run_20260717_rf_kid_001_pediatric_cds_evidence` on 2026-07-22 —
`status_derived: published`, `verification.passed: true`, `verification.exit_code: 0`,
`claim_counts: {claims_total: 87, claims_supported: 73, claims_inference: 10,
claims_speculation: 4, claims_mixed: 0, claims_contradicted: 0, claims_unsupported: 0}`).
**Selection rationale**: `RF-KID-001` is this program's designated Phase 1 fixture source for the
kidney/urinalysis evidence line (parent plan row P1-T5; PRD §"CDS-module conversion targets";
`docs/project_plans/expansion/rf-handoff/RESULTS.md` §1/§5 records it as `verified` and among the
runs "clean on first audit" — it is not legal-review-flagged, unlike `REG-001`/`REG-004`). It
carries 12 source cards / 87 claims (73 supported, 10 inference, 4 speculation, 0
mixed/contradicted/unsupported), matching `rf-handoff/RESULTS.md`'s published table row exactly.
**Derived**: 2026-07-22.

## 1. Content-rights disposition (applies to every passage in this bundle)

Every one of the 12 source cards in `RF-KID-001` carries the same `usage` block:

```
usage: {allowed_for_public_output: false, allowed_for_work_output: true,
        allowed_for_personal_meatywiki: true, citation_required: true,
        quote_limit_notes: "Short excerpts only."}
```

**No passage in this run is positively confirmed rights-clear for committing verbatim text to
this repository.** Per this plan's decisions block and ADR-0002's rights-restricted fallback,
this fixture therefore defaults **every single passage** to the restricted disposition: the
record retains an immutable **SHA-256 hash** of the original verbatim excerpt plus its **precise
selector** (the sibling `locator` field and the source card's own `evidence_id`), but never the
exact article text itself. This is a uniform disposition, not a per-passage judgment call: 12/12
source cards → 73/73 extracted passages → **rights disposition: restricted (hash + selector
only)**, 0/73 positively confirmed rights-clear.

| # | Source card | Title | Publisher | Evidence points (passages) | Disposition |
|---|---|---|---|---:|---|
| 00 | `src_20260718_rfkid001_00` | Age- and sex-dependent clinical equations to estimate glomerular filtration rates in children and young adults with chronic kidney disease | Kidney International (Elsevier / Int'l Society of Nephrology) | 7 | restricted |
| 01 | `src_20260718_rfkid001_01` | Self-reported Race, Serum Creatinine, Cystatin C, and GFR in Children and Young Adults With Pediatric Kidney Diseases (CKiD Study) | American Journal of Kidney Diseases (NKF) / Elsevier | 6 | restricted |
| 02 | `src_20260718_rfkid001_02` | Clinical Practice Guideline for Screening and Management of High Blood Pressure in Children and Adolescents | American Academy of Pediatrics (Pediatrics) | 7 | restricted |
| 03 | `src_20260718_rfkid001_03` | KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease | Kidney International (Elsevier) — official journal of ISN | 6 | restricted |
| 04 | `src_20260718_rfkid001_04` | Utility of Cystatin C-based Equation for the Estimation of Glomerular Filtration Rate in a Pediatric Population | J. Applied Laboratory Medicine (Oxford Univ. Press / AACC) | 5 | restricted |
| 05 | `src_20260718_rfkid001_05` | Comparison of different equations for estimating the glomerular filtration rate in pediatric kidney transplant recipients | Pediatric Nephrology (Springer) | 6 | restricted |
| 06 | `src_20260718_rfkid001_06` | Hematuria and Proteinuria in Children | American Academy of Pediatrics (Pediatrics in Review) | 6 | restricted |
| 07 | `src_20260718_rfkid001_07` | Proteinuria in Children: Evaluation and Differential Diagnosis | American Academy of Family Physicians (Am. Family Physician) | 7 | restricted |
| 08 | `src_20260718_rfkid001_08` | Evaluation of Proteinuria and Hematuria in Ambulatory Setting | Pediatric Clinics of North America (Elsevier) | 6 | restricted |
| 09 | `src_20260718_rfkid001_09` | Application of GFR estimating equations to children with normal, near-normal, or discordant GFR | Pediatric Nephrology (Springer) | 5 | restricted |
| 10 | `src_20260718_rfkid001_10` | Diagnostic utility of protein to creatinine ratio (P/C ratio) in spot urine sample within routine clinical practice | Taylor & Francis (Critical Reviews in Clin. Lab. Sciences) | 5 | restricted |
| 11 | `src_20260718_rfkid001_11` | Comparison of estimated GFR using cystatin C versus creatinine in pediatric kidney transplant recipients | Pediatric Nephrology (Springer / IPNA) | 7 | restricted |
| | | | **Total** | **73** | **73/73 restricted** |

## 2. What was sanitized, and how

Only the **verbatim exact-passage excerpts** were redacted — everything else in the bundle
(claim ledger, extraction cards, report, verification record, RF's own paraphrased summaries,
population/assay/lifecycle metadata, source metadata, locators) is copied byte-for-byte
unmodified by `scripts/evidence/generate-rf-fixture.mjs` (P1-T1), which mechanically re-verifies
(via `assertNeverCarriesExcerptField`) that none of those artifact kinds carries a verbatim
excerpt in this run, rather than trusting that by convention:

- `sources/src_*.md` — each source card's `extracted_points[].quote` field (the YAML frontmatter
  verbatim excerpt) and the matching `— quote: "..."` line in the markdown "Key evidence" section
  were replaced with
  `[redacted — content-rights: restricted (usage.allowed_for_public_output=false); sha256:<hash>]`,
  where `<hash>` is the SHA-256 of the original excerpt's exact decoded bytes (both occurrences of
  the same excerpt hash identically). Every non-null `pediatric_cds.threshold.passage_locator`
  value (a second, self-contained copy of a verbatim excerpt/selector) was likewise replaced by
  its own SHA-256 hash; `passage_locator: null` entries (evidence points with no locatable
  passage) were left untouched.
- `extractions/ext_*.yaml` — copied unmodified; the generator confirmed (mechanically, via
  `assertNeverCarriesExcerptField`) that all 12 extraction cards carry only `text` (RF's own
  paraphrase) and `locator` (selector), never a `quote`/verbatim-excerpt field.
- `claims/claim_ledger.yaml`, `reports/report_draft.md`, `reviews/verification.yaml`,
  `research_brief.md`, `swarm_plan.yaml`, `evidence_bundle.yaml`, `writebacks/ccdash_event.yaml`
  — copied unmodified; the generator confirmed (mechanically) that none contains a verbatim
  source-article excerpt (claim text and report sentences are RF's own paraphrased/synthesized
  prose with `[claim:clm_id]` references, not reproduced article text).

Total redactions: **201** (73 `quote` frontmatter fields + 73 mirrored markdown-bullet quotes +
55 non-null `passage_locator` values). The full per-redaction ledger (file, line, field, excerpt
byte-length, SHA-256) is machine-readable JSON at
[`passage-hash-ledger.json.txt`](./passage-hash-ledger.json.txt) in this directory (named with a
`.json.txt`, not a bare `.json`, extension deliberately — see §2.1).

### 2.1 Why the ledger isn't named `*.json`

`scripts/evidence/backfill-rule-governance.mjs` computes each rule's `requiredTestCaseIds` by
recursively walking `tests/witness/` **and `tests/fixtures/`** for every `*.json` file and running
it through the engine as if it were a patient-intake fixture (`scripts/rule-coverage.mjs`'s
`computeCoverage()`, `fixtureDirs: ['tests/witness', 'tests/fixtures']`). A non-intake `.json`
blob dropped anywhere under `tests/fixtures/` derives to an almost-entirely-missing fact set,
which the KB's generic missing-data safety rule treats as a witness and appends to its
`requiredTestCaseIds` — silently drifting the **committed** `modules/anemia/rules.json` (this
coupling was confirmed directly against `tests/fixtures/rf-cbc-001/HASH-PROVENANCE.md` §2.1 the
first time that sibling fixture's ledger was named `passage-hash-ledger.json`). Since
`modules/anemia/` is read-only for this task, this ledger is likewise named
`passage-hash-ledger.json.txt` (content is still plain JSON — parse it with `JSON.parse()` as
normal) so the coverage scan's `endsWith('.json')` filter skips it. Every other file in this
fixture keeps its native `rf` extension (`.yaml`/`.md`, matching the run's own
source-card/extraction-card/bundle formats) — none of those are `.json` either, so none of them
touch this coupling.

## 3. Bundle hash (fixture as committed)

**Verified**: `npm run check` passes green with this fixture committed and `modules/anemia/`
untouched (see this task's PR/commit record for the exact run).

SHA-256 computed over the sorted `relative_path:sha256(bytes)` pairs of every artifact file in
this fixture directory (i.e. the mirrored `RF-KID-001` bundle: `evidence_bundle.yaml`,
`research_brief.md`, `swarm_plan.yaml`, `claims/claim_ledger.yaml`, `reports/report_draft.md`,
`reviews/verification.yaml`, `writebacks/ccdash_event.yaml`, all 12 `sources/src_*.md`, all 12
`extractions/ext_*.yaml` — 31 files total; this note and `passage-hash-ledger.json.txt` are
excluded from the bundle hash as fixture-derivation metadata, not `rf` bundle content):

```
bundleSha256: sha256:3436973da8065ed3c2358c070e4b43f67ad22ee3811ed8295509267f73aa0c0d
fileCount: 31
```

Per-file SHA-256 (original run file → fixture file) is recorded in
`passage-hash-ledger.json.txt`'s `files[]` array for every copied artifact, alongside the
per-passage redaction hashes.

## 4. Directory layout (mirrors `evidence_bundle.yaml.artifacts`)

```
tests/fixtures/rf-kid-001/
  evidence_bundle.yaml          (copied unmodified)
  research_brief.md             (copied unmodified)
  swarm_plan.yaml                (copied unmodified)
  claims/claim_ledger.yaml       (copied unmodified)
  reports/report_draft.md        (copied unmodified)
  reviews/verification.yaml      (copied unmodified)
  writebacks/ccdash_event.yaml    (copied unmodified)
  sources/src_20260718_rfkid001_{00..11}.md   (sanitized — see §2)
  extractions/ext_20260718_*.yaml (12 files, copied unmodified)
  passage-hash-ledger.json.txt   (this fixture's own derivation metadata, not `rf` content —
                                   `.json.txt`, not `.json`; see §2.1 for why)
  HASH-PROVENANCE.md             (this note)
```

Paths are resolved exactly as `evidence_bundle.yaml.artifacts` declares them
(`source_cards_dir: sources/`, `extraction_cards_dir: extractions/`, etc.) so that P2's read-only
bundle loader can resolve every artifact without any hard-coded assumption.

## 5. Non-goals of this note

This note does not reopen this plan's decisions block or open questions. It documents only how
this one fixture bundle was derived from `RF-KID-001` and what was redacted and why — a
rights/hash record, not a clinical-content or rule-authoring decision. In particular: this
fixture is test/reference data only — nothing here converts `RF-KID-001`'s claims into
`modules/kidney_suite_v1/*.json` (that projection is Phase 5's `propose` work, tracked
separately); no rule/candidate/evidence entry for any pediatric CDS module is authored, approved,
or implied by this note.
