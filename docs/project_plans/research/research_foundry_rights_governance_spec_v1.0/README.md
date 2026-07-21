# Research Foundry Rights Governance Pack v1.0

This package implements source-reuse governance for Research Foundry and the pediatric Evidence Foundry.

## Primary artifact

- `Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.md`
- `Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.docx`

## Machine-readable schemas

- `schemas/rights_record.schema.json`
- `schemas/content_reuse_assessment.schema.json`
- `schemas/permission_record.schema.json`
- `schemas/rights_extension.schema.json`
- `schemas/rights_failure.schema.json`

## Agent artifacts

- `templates/AGENT_SOURCE_REUSE_INSTRUCTIONS.md`
- `templates/source_reuse_review_template.md`
- `templates/rights_clearance_manifest_template.json`

## Examples

- `examples/aap_subscription_rights_record.example.json`
- `examples/cc_by_rights_record.example.json`
- `examples/us_federal_public_domain_rights_record.example.json`
- `examples/facts_only_reuse_assessment.example.json`
- `examples/permission_record.example.json`

## Integration

Use `extensions.rights` in existing Research Foundry/Evidence Foundry objects. Formal rights decisions live in linked records rather than inside scientific evidence objects.

All examples validate against the included JSON Schemas.
