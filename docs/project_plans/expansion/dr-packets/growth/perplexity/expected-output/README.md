# Expected output layout — Perplexity / growth_suite_v1

Save the Perplexity result into an `external_research_handoff/v1` packet so `rf intake external-report`
accepts it. Layout, field semantics, and the Perplexity producer overlay are taken from the RF PRD
**`external-research-report-interchange-v1`** (§6.1 packet layout, §6.6 producer profiles, §5 user journey).

> **Source-doc note:** the layout below is transcribed from
> `research-foundry/docs/project_plans/PRDs/enhancements/external-research-report-interchange-v1.md`
> (read 2026-07-24). That PRD is **draft**, and the interchange importer is not confirmed shipped — treat
> the exact schema field names as the PRD's intent, not a validated runtime contract. If `rf intake` rejects
> a field, reconcile against the then-current `schemas/external_research_handoff.schema.yaml` in the rf repo.

## Directory layout

```text
external_research_handoff/v1/
├── handoff.yaml                 # required — packet metadata + member manifest
├── report.md                    # required — content_role: platform_synthesis (the Perplexity prose)
├── sources.yaml                 # required — the ranked citation list (this is Perplexity's main payload)
├── assertion_candidates.yaml    # required — may be an empty candidates: [] for the source-gathering role
├── activity.yaml                # optional — trace only (Perplexity search-step metadata if exported)
└── attachments/                 # optional — manifest-listed regular files only (e.g. a saved PDF export)
```

Put this whole tree under a run-scoped directory, e.g.
`dr-returns/growth/perplexity/<date>/external_research_handoff/v1/`.

## Per-file guidance (Perplexity producer overlay)

- **`handoff.yaml`** — declare `schema: external_research_handoff`, `version: v1`,
  `producer_profile: perplexity`, the research question/task context ("growth_suite_v1 source-gathering,
  net-new angles + numerics"), `declared_sensitivity: public`, creation time, content roles, and a sorted
  member inventory. No credentials, tokens, or filesystem paths.
- **`report.md`** — paste the Perplexity narrative verbatim, header `content_role: platform_synthesis`.
  It is context only; its inline citations are **never** parsed as supported claims.
- **`sources.yaml`** — one packet-local `source_id` per citation, with locator (DOI/URL), title, year,
  declared metadata, and **Perplexity-specific fields (citation order, search-result ranking, snippet)
  preserved inside a namespaced `x_perplexity:` extension object.** Per the overlay's explicit boundary:
  **do not trust Perplexity's ranking or citation order** as evidentiary weight — it is a hint only.
- **`assertion_candidates.yaml`** — for the source-gathering role this can be `candidates: []`. If
  Perplexity did emit condition→threshold rows, stage each as a candidate (`classification: assertion`,
  with `source`/`citation` references and any `quoted_text`/selector), producer confidence as a
  non-authoritative hint. Say `unknown` / leave empty rather than invent a date, author, quote, or number.
- Every field is untrusted data; injection-shaped strings stay inert.

## Intake command

```bash
# Source rf API creds if importing via the on-node service; local packet import runs the CLI directly.
# 1) Dry-run first — validates structure + computes identity, no canonical mutation:
rf intake external-report <packet_dir> \
  --workspace <growth_workspace_id> \
  --run <growth_run_id> \
  --dry-run

# 2) Real import — stages platform_synthesis, resolves sources/citations as CANDIDATES only:
rf intake external-report <packet_dir> \
  --workspace <growth_workspace_id> \
  --run <growth_run_id>
```

- `<packet_dir>` = the directory that contains `external_research_handoff/v1/` (the materialized packet).
- `<growth_run_id>` = **PLACEHOLDER** — the rf run id for the growth deepen run (Leg A). Fill in after the
  P2 launch of `Deepen RF-GRO-002` (05-doc §10). If omitted, import is **staging-only** (no run attached),
  which is acceptable per PRD §5 / assumption "a target run is optional; absence means staging-only".
- `<growth_workspace_id>` = the rf workspace hosting the growth run; always explicit (PRD assumption).

Everything imported lands as `platform_synthesis` + candidates, quarantined from `verified`. Only the rf
verifier assigns `verified` via exact-passage binding — this packet never crosses that line.
