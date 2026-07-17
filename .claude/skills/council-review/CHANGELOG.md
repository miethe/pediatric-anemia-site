# Changelog — council-review skill

All notable changes to the `council-review` skill (SKILL.md, SPEC.md, references).

## 2026-06-22

- SKILL.md: removed unsupported `allowed-tools` frontmatter; added `version: 1.0`,
  `app_version`, `updated`, and `spec: ./SPEC.md`.
- SKILL.md: restructured to the skill-authoring section order — added When To Use,
  When NOT To Use, Confidence Anchor, the mandatory "Do Not Say" section, and Key
  References (absolute paths); preserved the intent-first note, Workflow, and Ground Rules.
- SPEC.md: authored to the spec-backed-skills convention — `schema_version: 2`,
  `doc_type: skill_spec`, `skill_version: 1.0.0`, `status: stable`, and all 7 required
  sections. Documents the scaffold (`council-run`) vs populate (`council-review`) boundary
  and the ARC execution model.
- Added this CHANGELOG.md (required by the skill-authoring guide).
