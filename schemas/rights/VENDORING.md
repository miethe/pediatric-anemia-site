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

**EPR0-T3 (FR-WP0-06/D6, handoff §9).** The vendored schemas are not usable as published — handoff
§9 records six conflicts (§9.1–§9.6); this task addresses the five owned by EP-R0 (§9.2–§9.6; §9.1 is
owned solely by EPR3-T2, which re-homes the taxonomy fields onto `schemas/evidence.schema.json`
instead of `rights_extension`) plus D6's reviewer/clearance constraints. Every amendment below is an
annotated, declared divergence from the checksums recorded in "Vendored files" above — never a silent
edit. Each amendment is also annotated in place, as a `description` field on the touched schema node,
so a reader of the schema file itself (not only this document) sees the divergence.

Three of the five vendored files diverge from their "Vendored checksum" as of this task:
`schemas/rights/rights_record.schema.json`, `schemas/rights/content_reuse_assessment.schema.json`,
`schemas/rights/rights_failure.schema.json`. `schemas/rights/permission_record.schema.json` and
`schemas/rights/rights_extension.schema.json` are untouched by this task and remain byte-identical to
their "Vendored checksum" (`rights_extension.schema.json`'s §9.1 conflict is EPR3-T2's to resolve).

- 2026-07-21 — `schemas/rights/rights_record.schema.json` (handoff §9.3): added `unknown` to
  `access.basis`'s enum, treated as blocking by `scripts/validate-rights.mjs` (EPR0-T5). The published
  enum closes with `other` and has no `unknown` member, so an agent that does not know the access
  basis had to guess or write `other` — both record a false certainty.
- 2026-07-21 — `schemas/rights/rights_record.schema.json` (handoff §9.4): the same restriction family
  was modelled twice with incompatible enums — `access.text_and_data_mining_allowed` /
  `access.model_training_allowed` (`yes`/`yes_with_conditions`/`no`/`unknown`[/`not_assessed`]) vs.
  `contract.bulk_retrieval` / `contract.model_training`
  (`allowed`/`allowed_with_conditions`/`prohibited`/`not_addressed`/`unknown`). No structural rename
  was possible without breaking `additionalProperties: false` compatibility with the spec's own
  examples, so this amendment designates one home per restriction via `description` annotations only:
  `access.text_and_data_mining_allowed` and `access.model_training_allowed` are canonical;
  `contract.bulk_retrieval` and `contract.model_training` are annotated deprecated-in-copy, retained
  for schema shape only. A consumer must read only the canonical field per restriction.
- 2026-07-21 — `schemas/rights/rights_record.schema.json` (handoff §9.6, fail-open #1): replaced
  `format: "uri"` with `pattern: "^https?://\\S+$"` on `access.terms_url` and `copyright.license_url`.
  This repo's `scripts/lib/json-schema-lite.mjs` validator silently ignores `format` except
  `date`/`date-time` — an unenforced `format: "uri"` fails open (`license_url: "not a url"` would have
  validated clean). No `format: "uri"` remains anywhere under `schemas/rights/`.
- 2026-07-21 — `schemas/rights/rights_record.schema.json` (handoff §9.6, fail-open #2): added
  `"not": {"const": {}}` to the `contract` object, forbidding the empty object. Published,
  `{"contract": {}}` validated identically to `contract: null` and was indistinguishable from "no
  restrictions exist" — `null` is now the only representation of "not assessed"; a non-empty object is
  required for anything else.
- 2026-07-21 — `schemas/rights/rights_record.schema.json` (handoff §9.2): annotated
  `component_decisions[].component_type` declaring the **enum** authoritative over the spec's §5.1
  prose table, which diverges from it (e.g. the prose table's single "Prose or abstract" / "Figure or
  chart" rows each map to two enum members). `rights_component_class`
  (`schemas/evidence.schema.json`, EPR3-T2) is valued from this enum, never from the prose table.
- 2026-07-21 — `schemas/rights/rights_record.schema.json` (handoff §9.5, **DEF-R4**): recorded, via the
  root `description`, that `rights_record` cannot describe first-party content — `source_id` is
  required with `minLength: 3`, `record_scope` has no first-party member, and `overall_status` has no
  `OWNED`/`FIRST_PARTY`/`NOT_APPLICABLE` value. **No schema field was added or relaxed to work around
  this.** Consequence for this plan: `derived_synthesis` evidence items get no `rights_record` in this
  feature. Re-homing first-party content into the rights-record model (or an explicit sibling model)
  is deferred as **DEF-R4**, pending RF adjudication of handoff §9.5 (open question OQ-4). EP-R3
  (EPR3-T7) models first-party authorship on the evidence item itself instead.
- 2026-07-21 — `schemas/rights/rights_record.schema.json` (D6): `review.human_reviewer` and
  `review.counsel_reviewer` each gained `"const": null` — forced null in this feature. No human
  clinical/rights sign-off exists in this project and none may be agent-authored.
- 2026-07-21 — `schemas/rights/rights_record.schema.json` (D6): `review.review_status` gained
  `"not": {"const": "counsel_approved"}`. `counsel_approved` remains a legitimate enum member for a
  future human-driven workflow, but no agent-writable path in this feature may assign it.
- 2026-07-21 — `schemas/rights/rights_record.schema.json` (D6): `overall_status` gained
  `"not": {"enum": ["CLEARED_OPEN_LICENSE", "CLEARED_PUBLIC_DOMAIN", "CLEARED_FACTS_ONLY", "CLEARED_PERMISSION"]}`
  — no agent-writable path in this feature may assign any `CLEARED_*` member. A record at
  `overall_status: UNKNOWN` is unaffected and still validates (D7: this is a structural authority
  constraint, never a clearance gate).
- 2026-07-21 — `schemas/rights/content_reuse_assessment.schema.json` (D6): `review.clinical_reviewer`
  gained `"const": null`, for the same reason as `rights_record.review.human_reviewer`. No other field
  on this schema is amended by this task — in particular
  `content_reuse_assessment.decision.status` (the same `CLEARED_*` enum as `rights_record.overall_status`,
  handoff §9.10) and `content_reuse_assessment.review.review_status` (a related but distinct enum,
  handoff §9.7) are **not** constrained here; this feature seeds no `content_reuse_assessment` records,
  and the plan's EPR0-T3 acceptance criteria enumerate exactly six D6 field paths, this being one of
  them. A future phase that seeds `content_reuse_assessment` records must extend this amendment layer
  rather than assume the constraint is already there.
- 2026-07-21 — `schemas/rights/rights_failure.schema.json` (D6): `review.reviewed_by` gained
  `"maxItems": 0` — forced empty in this feature. No human reviewer identity may be agent-authored.

**Not amended, and not silently left as-is: `permission_record.schema.json`'s `review.approved_by`**
(`required`, `minItems: 1`) carries the same class of reviewer-authority risk as the six D6 paths
above, but this feature seeds zero `permission_record`s and the plan's EPR0-T3 acceptance criteria do
not name this path — see the negative criterion's enumerated list. A phase that seeds
`permission_record`s must add this constraint before doing so, not assume it is already covered.

## Non-vendored bundle assets

The spec bundle also ships examples, templates, a validation report, and prose docs
(`README.md`, `Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.{md,docx}`,
`examples/*.example.json`, `templates/*`, `validation_report.json`). None of these are vendored by
this task — EPR0-T2's scope is the five JSON Schema files listed above. In particular, the bundle's
`templates/rights_clearance_manifest_template.json` carries an `approvals.clinical_owner` field that
has no equivalent in any vendored schema; see the phase plan's EPR0-T3 acceptance criteria for why a
constraint naming that path would be a silent no-op.
