# Pediatric Anemia Diagnosis Aide

A deterministic, evidence-linked clinical decision-support **research prototype** for pediatric anemia. It is designed for licensed clinicians to review CBC findings, history, examination, smear, and targeted laboratory results through transparent rules. It does not use generative AI for clinical inference.

## Status and intended use

- **Status:** research prototype; not clinically validated, not cleared or approved as a medical device.
- **Intended user:** licensed health care professionals.
- **Built-in age scope:** 6 months to <18 years. Local laboratory ranges override built-in AAP fallbacks. Patients <6 months are routed to a neonatal/young-infant pathway; patients ≥18 years require local/adult ranges.
- **Output:** ranked diagnostic **patterns**, urgent flags, adaptive questions, confirmatory steps, matched rule IDs, and evidence citations.
- **Not provided:** autonomous diagnosis, treatment selection, medication dosing, transfusion orders, or guarantees.

The core iron-deficiency rules and fallback CBC intervals are derived from the 2026 AAP clinical report; the broader morphology/reticulocyte framework comes from a 2022 peer-reviewed pediatric anemia review. WHO 2024 supports contemporary hemoglobin-cutoff governance, CDC 2025 supplies lead action thresholds, and FDA 2026 informs CDS design boundaries. See [`docs/research-and-evidence.md`](docs/research-and-evidence.md).


## Clinician site experience

The v0.2.0 site adds a responsive clinician workspace around the unchanged deterministic knowledge base:

- six-stage guided intake with direct navigation to CBC, safety, iron/inflammation, specialized labs, history, and smear/examination;
- live de-identified case snapshot and non-clinical input-depth indicator;
- sticky assessment action, worked examples, independent results pane, print view, and audit JSON export;
- source-linked classification, escalation rules, differential patterns, adaptive questions, and confirmatory workup;
- desktop sidebar and compact mobile navigation;
- no third-party scripts, fonts, analytics, or patient-data transmission from the browser assessment.

The site presentation is implemented in `index.html`, `styles.css`, and `site-overrides.css`; the clinical inference remains in the existing `src/` modules and JSON knowledge base.

## Run locally

Prerequisites: Node.js 20 or later.

```bash
npm test
npm run validate
npm run build
npm run smoke
npm start
```

Open `http://127.0.0.1:8080`.

Opening `index.html` directly from disk will not work because browsers block local `fetch()` calls for the JSON knowledge base. Use the included server or any static web server.

For a static-hosting bundle, publish the generated `dist/` directory. See [`docs/deployment.md`](docs/deployment.md).

## Run with Docker

```bash
docker build -t pediatric-anemia-cdss .
docker run --rm -p 8080:8080 pediatric-anemia-cdss
```

Open `http://localhost:8080`.

## API

The included Node server exposes a stateless prototype API:

```bash
curl -sS http://127.0.0.1:8080/health

curl -sS \
  -H 'Content-Type: application/json' \
  --data @examples/ida-toddler.json \
  http://127.0.0.1:8080/api/v1/assess
```

Endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Health and KB version |
| `GET` | `/api/v1/knowledge-base` | Evidence registry and rule counts |
| `POST` | `/api/v1/assess` | Deterministic assessment |

The browser interface evaluates locally and does **not** send patient data to the API. The server also does not log or persist request bodies, but this alone does not make deployment HIPAA-compliant.

## Knowledge-base design

```text
patient JSON
  → deriveFacts()                         src/facts.js
  → evaluate machine-readable rules       data/rules.json
  → merge diagnostic pattern candidates   data/candidates.json
  → deterministic ordinal ranking         src/ruleEngine.js
  → evidence-linked output + audit         src/engine.js
```

The knowledge base currently contains:

- 91 deterministic rules
- 26 diagnostic patterns
- 6 evidence registry records
- 6 worked clinical examples
- 10 automated engine tests

The ranking score is an internal deterministic sort priority. It is **not** a probability, likelihood ratio, confidence interval, sensitivity, or specificity.

## Project structure

```text
.
├── index.html                         clinician web interface
├── styles.css                         base component styles
├── site-overrides.css                clinician workspace and responsive site shell
├── assets/favicon.svg
├── dist/                             generated static-hosting bundle
├── server.mjs                         static server + prototype REST API
├── src/
│   ├── app.js                         UI and data capture
│   ├── engine.js                      assessment contract
│   ├── facts.js                       normalized derived facts
│   ├── ruleEngine.js                  generic JSON condition evaluator
│   ├── referenceRanges.js             AAP fallback intervals
│   └── evidence.js                    citation/provenance registry
├── data/
│   ├── rules.json                     deterministic rules
│   └── candidates.json                merged diagnostic patterns
├── schemas/
│   ├── patient-input.schema.json
│   └── assessment-output.schema.json
├── examples/                          six test cases
├── tests/engine.test.mjs
├── scripts/
│   ├── validate-kb.mjs
│   ├── build-static.mjs
│   └── smoke-test.mjs
├── openapi.yaml
└── docs/
    ├── clinical-algorithm.md
    ├── research-and-evidence.md
    ├── architecture.md
    ├── data-dictionary.md
    ├── deployment.md
    ├── release-verification.md
    └── validation-regulatory.md
```

## Important limitations

1. **No clinical validation:** tests verify software behavior, not medical accuracy.
2. **Incomplete neonatal logic:** neonatal anemia depends on postnatal age, gestation, birth history, maternal-fetal factors, and rapidly changing reference intervals. The prototype deliberately refuses static classification below 6 months.
3. **Local laboratory interpretation:** reticulocytes, hemolysis markers, iron studies, HbA2, G6PD assays, and several nutrient/endocrine tests are entered as local interpretations where methods differ.
4. **Rare disease resolution:** the tool identifies specialist pathways; it does not replace marrow, molecular, membrane, enzyme, or hemoglobinopathy confirmation.
5. **Regulatory status depends on intended use:** transparent references and clinician review support a CDS posture but do not guarantee exclusion from medical-device regulation.
6. **No treatment engine:** diagnostic suggestions are intentionally separated from treatment, transfusion, and medication dosing.

## Production gate

Do not expose this prototype to live clinical care until all of the following are complete:

- pediatric hematology and general pediatrics clinical-content review;
- formal traceability from each rule to exact source passages;
- retrospective multi-site validation with analyzer-specific ranges;
- prospective silent-mode validation;
- human-factors/usability testing;
- quality-system, hazard, cybersecurity, privacy, and regulatory review;
- deployment under an approved change-control and evidence-surveillance process.

See [`docs/validation-regulatory.md`](docs/validation-regulatory.md) for the proposed roadmap.
