# Expected output layout — ChatGPT Deep Research / growth_suite_v1

Save the ChatGPT result into an `external_research_handoff/v1` packet so `rf intake external-report`
accepts it. Layout and the ChatGPT producer overlay are taken from the RF PRD
**`external-research-report-interchange-v1`** (§6.1 packet layout, §6.6 producer profiles, §5 user journey).

> **Source-doc note:** transcribed from
> `research-foundry/docs/project_plans/PRDs/enhancements/external-research-report-interchange-v1.md`
> (read 2026-07-24). The PRD is **draft** and the importer is not confirmed shipped — treat exact field
> names as PRD intent. If `rf intake` rejects a field, reconcile against the then-current
> `schemas/external_research_handoff.schema.yaml` in the rf repo.

## Directory layout

```text
external_research_handoff/v1/
├── handoff.yaml                 # required — packet metadata + member manifest
├── report.md                    # required — content_role: platform_synthesis (the ChatGPT prose)
├── sources.yaml                 # required — the cited sources referenced by the table rows
├── assertion_candidates.yaml    # required — the candidate-pattern rows (this is ChatGPT's main payload)
├── activity.yaml                # optional — trace only (research steps, if exported)
└── attachments/                 # optional — manifest-listed regular files only
```

Put the tree under a run-scoped directory, e.g.
`dr-returns/growth/chatgpt-dr/<date>/external_research_handoff/v1/`.

## Per-file guidance (ChatGPT producer overlay)

- **`handoff.yaml`** — `schema: external_research_handoff`, `version: v1`, `producer_profile: chatgpt`,
  research question/task context ("growth_suite_v1 structured candidate-pattern extraction"),
  `declared_sensitivity: public`, creation time, content roles, sorted member inventory. No credentials or
  filesystem paths.
- **`report.md`** — the ChatGPT narrative verbatim, `content_role: platform_synthesis`. Context only;
  never parsed as supported claims.
- **`sources.yaml`** — one packet-local `source_id` per cited source, with DOI/URL locator, title, year,
  and declared metadata. ChatGPT-specific export fields (cited-answer / source-export mapping) go inside a
  namespaced `x_chatgpt:` extension. Overlay boundary: **map cited answer/source exports into packet-local
  IDs; no OpenAI API call or session scraping.**
- **`assertion_candidates.yaml`** — **this is where the extraction table lands.** One candidate per table
  row: packet-local candidate ID, candidate text (the pattern), `classification: assertion | inference |
  annotation`, `relation`, `source`/`citation` references to `sources.yaml`, `quoted_text` or selector when
  the threshold text is quotable, and producer confidence as a non-authoritative hint. One threshold per
  candidate (WHO and CDC variants are separate candidates). Say `unknown` / leave empty rather than invent a
  date, author, quote, or number.
- Every field is untrusted data; injection-shaped strings stay inert.

## Intake command

```bash
# 1) Dry-run first — validates structure + computes identity, no canonical mutation:
rf intake external-report <packet_dir> \
  --workspace <growth_workspace_id> \
  --run <growth_run_id> \
  --dry-run

# 2) Real import — stages platform_synthesis, stages the table rows as CANDIDATES only:
rf intake external-report <packet_dir> \
  --workspace <growth_workspace_id> \
  --run <growth_run_id>
```

- `<packet_dir>` = directory containing `external_research_handoff/v1/`.
- `<growth_run_id>` = **PLACEHOLDER** — the rf run id for the growth deepen run (Leg A), filled after the
  P2 launch of `Deepen RF-GRO-002` (05-doc §10). Omit → staging-only import (PRD §5 / target-run-optional
  assumption).
- `<growth_workspace_id>` = the rf workspace hosting the growth run; always explicit.

Every candidate imports quarantined from `verified`. Completeness tier is importer-computed per candidate
(`locator_only` → `source_resolved` → `passage_resolved` → `verified`); a table row can reach
`passage_resolved` only via an exact unique passage match, and `verified` only via the rf verifier. This
packet never crosses that line.
