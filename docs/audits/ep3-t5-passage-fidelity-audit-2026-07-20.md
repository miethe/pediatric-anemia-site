# EP3-T5 independent passage-fidelity audit

- HIGH — Rights-sensitive quote reuse remains despite `passageFidelity: "paraphrase"` — `FDA2026_CDS#ev_002`–`#ev_005`, `BSH2020_G6PD#ev_003`, `#ev_005`, `#ev_007` (also 7-word spans in `AAP2026_IDA#ev_005`, `CDC2025_LEAD#ev_001`, `#ev_003`, `BSH2020_G6PD#ev_002`) — normalized longest shared contiguous spans with RF `quote` are 8–13 words; e.g. FDA `#ev_004` shares 13 words. The same strings are present in `evidence-packs/rf-ev-001/pack.json`; it has no `quote` key, but the restricted text still leaked through `summary`. — Rewrite these passages with independent syntax and word order; retain necessary facts/numbers without reproducing source phrasing.

- HIGH — `AAP2026_IDA` is overclaimed as source-supported — `AAP2026_IDA#ev_001`–`#ev_007` — the card provides only a publisher URL with `file_path: null` and a self-attestation of full-text access (`src_20260718_rfev001_00.md:11,17`), not a retrievable source artifact; this conflicts with the supplied RF-EV-002/REG-002 403/subscription finding. The seven section-only locators cannot independently establish source access. — Do not ship these as `status: "source-supported"`; demote/quarantine them until an independently retrievable, rights-cleared AAP artifact and reproducible locators are available.

- HIGH — AAP Table 1 passage drops all table values while asserting it supports KB fallback intervals — `AAP2026_IDA#ev_002` — RF quote contains Hb, MCV, and RDW numeric intervals; `exactPassage` retains only units, age bands, and an unsupported “used as the KB fallback” implementation claim. — Preserve the relevant numerical intervals and their age/sex mapping in a rights-safe paraphrase, or classify the KB-fallback assertion as an implementation proposal.

- HIGH — WHO pediatric haemoglobin cutoffs are omitted — `WHO2024_HB#ev_001` — the RF quote specifies `<105`, `<110`, `<115`, and `<120 g/L` across named age/sex bands; `exactPassage` says only that four bands exist. — Include every cutoff, unit, and age/sex band in a paraphrase.

- HIGH — WHO elevation-adjustment formula is omitted — `WHO2024_HB#ev_004` — RF quote gives the quadratic equation and coefficients; `exactPassage` merely says “a stated increment table and quadratic equation.” — Include the equation, coefficients, units, and adjustment direction, or do not present this as a passage supporting executable interpretation.

- HIGH — BSH adult G6PD reference values are omitted — `BSH2020_G6PD#ev_006` — RF quote gives the 30°C/37°C values and 6-PGD-correction distinction; `exactPassage` drops all values. — Preserve the numeric values, units, temperatures, and correction condition in a paraphrase, with its adult-only applicability.

- HIGH — Severe-IDA passage adds a transfusion rule not present in its located quote — `AAP2026_IDA#ev_007` — the quote/“opening sentences” locator supports Hb `<7 g/dL` and possible minimal symptoms; the generated passage adds that transfusion is reserved for instability. — Remove the added transfusion statement from this passage or bind it to a separately located and independently verified source point.

- HIGH — WHO language is strengthened from conditional to mandatory — `WHO2024_HB#ev_003` — RF quote says the factors “might need to be considered”; generated passage says they “must be considered.” — Restore the conditional modality.

- MEDIUM — Ferritin/CRP passage adds an unsupported clinically-well conclusion — `AAP2026_IDA#ev_004` — RF quote supports unreliability of ferritin with elevated CRP in illness/inflammation, but not “CRP is unnecessary in a clinically well child.” — Remove that clause or add a separate, exactly located source point.

- MEDIUM — CDC confirmation recommendation is strengthened — `CDC2025_LEAD#ev_002` — RF quote says providers “should collect a venous sample”; generated passage says it “must be confirmed … before further action.” — Preserve the source modality and avoid adding the sequencing claim unless directly located.

- LOW — Cross-environment byte determinism is not fully established — `scripts/evidence/build-evidence-pack.mjs:64` — local `--check` passed byte-identically (6 sources, 41 passages), and no time/random source was found; however `localeCompare()` is locale-dependent. — Use an explicit ASCII/numeric comparator for `evidenceId` ordering.

Checked with no discrepancy:

- Traceability: all 35 source-supported output records resolve one-to-one to actual RF extracted points; provenance, `sourceLocator.raw`, and summary match exactly. Output has 35 source-supported records, six explicit sentinels, and 41 unique IDs—no dropped or duplicated source point.
- Pack leakage structure: `pack.json` contains no `quote` field/key. Its text-level near-verbatim leakage is reported above.
- Field map: all 35 entries preserve `population → applicability.age`, `assay_method → applicability.assay`, `lifecycle.supersedes → supersedes`, and `source_supported_fact → source-supported-fact`.
- Audit made no file changes.

VERDICT: DISCREPANCIES FOUND — 8 high, 2 medium, 1 low
[2mtokens used[0m
146,680
