# Release verification — v0.2.0

Verification date: 2026-07-15

## Automated checks

`npm run check` executes the engine tests, knowledge-base validation, static build, and live-server smoke test.

- 10 of 10 deterministic engine tests passed.
- 91 rule records validated.
- 26 diagnostic-pattern records validated.
- 6 evidence-registry records validated.
- Static hosting bundle generated successfully.
- Live-server smoke test returned the expected health, site assets, and deterministic assessment response.

## Browser checks

The clinician interface was exercised at desktop and mobile viewport sizes with representative worked examples. Checks covered module loading, example population, assessment rendering, evidence chips, section navigation, responsive result layout, print controls, and audit access.

## Interpretation

These results verify software behavior and packaging only. They do not establish clinical validity, diagnostic accuracy, safety, regulatory status, or suitability for patient care. The production gate in `docs/validation-regulatory.md` remains mandatory.
