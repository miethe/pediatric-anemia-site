# `schemas/rights/` — vendored spec schemas, provenance record

**EPR0-T2 (FR-WP0-03).** This directory vendors five schemas from the reviewed
`Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0` bundle
(`docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/`), the same way
`openapi.yaml` at the repo root vendors an external-facing contract: a plain file copy with a
recorded source path and checksum, never a live `$ref` into the source bundle.

Each file below is copied **byte-for-byte, unmodified**, from the spec bundle's `schemas/` directory.
The checksum recorded here is recomputed from the vendored copy in this directory and must equal the
matching entry in the bundle's own `checksums.sha256`. A recomputation test
(`tests/rights-schema-vendoring.test.mjs`) enforces this at CI time.

**A later task (EPR0-T3) will edit these files in place to apply the handoff §9 declared local
amendments.** From that point forward, the checksum recorded in this file's "Vendored checksum"
column stops matching the live file on disk — that is expected and is exactly what "declared
divergence" means. Every such edit MUST be added as a dated entry under "Declared amendments" below,
naming the file, the field path touched, and the rationale. A divergence between a vendored file and
its "Vendored checksum" that has **no** corresponding entry under "Declared amendments" is a defect —
the provenance test in `tests/rights-schema-vendoring.test.mjs` distinguishes *declared* amendments
(the file is listed in this section) from an undeclared silent edit.

## Vendored files

| Vendored file | Source path (spec bundle) | Vendored checksum (sha256) |
|---|---|---|
| `schemas/rights/rights_record.schema.json` | `schemas/rights_record.schema.json` | `e78a77b44ef9f9ccbb62413b19dade1e31aa2e15c68178303525b6ed9788eedd` |
| `schemas/rights/content_reuse_assessment.schema.json` | `schemas/content_reuse_assessment.schema.json` | `04f788fea17ec14e04f343ecbf0576ce37b98091bbac072f09c2413b4342206a` |
| `schemas/rights/permission_record.schema.json` | `schemas/permission_record.schema.json` | `121e8a855a67fb58c2dee51563d2a647f54293316fd5f95fdc6d6947e79ee357` |
| `schemas/rights/rights_failure.schema.json` | `schemas/rights_failure.schema.json` | `bc88838168348726cd7078b6deeeb7ceb0497d2237d8981d4da6b05b16db4d52` |
| `schemas/rights/rights_extension.schema.json` | `schemas/rights_extension.schema.json` | `9d20f53387a039e2a293dec90dca2e9a082d699f5312b5face6218b8345ebd25` |

Source-of-truth checksum file: `docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/checksums.sha256`
(paths there are bundle-relative, e.g. `./schemas/rights_record.schema.json`; the vendored checksum
above is recomputed independently from the copy in this directory and cross-checked against that
bundle file — both must agree at the moment of vendoring, and the recomputation test re-verifies this
on every run).

Vendored at: 2026-07-21 (EPR0-T2), from the spec bundle reviewed and closed in
`docs/audits/` / `.claude/findings/rights-governance-spec-v1.0-review-findings.md` and the review
determination recorded at commit `cd15b4a` (`docs(rights): review determination on Rights Governance
Spec v1.0`).

## Declared amendments

_(EPR0-T3 fills this section in when it edits the vendored files in place to apply the handoff §9
local amendment layer. Until EPR0-T3 lands, this section is intentionally empty and every vendored
file's on-disk checksum equals its "Vendored checksum" above — the provenance test asserts exactly
that for this task.)_

## Non-vendored bundle assets

The spec bundle also ships examples, templates, a validation report, and prose docs
(`README.md`, `Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.{md,docx}`,
`examples/*.example.json`, `templates/*`, `validation_report.json`). None of these are vendored by
this task — EPR0-T2's scope is the five JSON Schema files listed above. In particular, the bundle's
`templates/rights_clearance_manifest_template.json` carries an `approvals.clinical_owner` field that
has no equivalent in any vendored schema; see the phase plan's EPR0-T3 acceptance criteria for why a
constraint naming that path would be a silent no-op.
