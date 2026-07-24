# Expected output — Perplexity Pro / cbc_suite_v1

Save the Perplexity result into the `external_research_handoff/v1` packet layout below, then hand the
directory back so it can be imported with `rf intake external-report`. Everything imports as
`platform_synthesis` → **candidates only**; the rf verifier is the only path to `verified`.

> **⚠️ Layout-source assumption.** This layout and the `rf intake external-report` command come from
> the **draft, not-yet-implemented** PRD `external_research_handoff/v1`
> (`research-foundry/docs/project_plans/PRDs/enhancements/external-research-report-interchange-v1.md`,
> status: **draft**). As of authoring, no `templates/external_research_handoff/v1/`, no
> `schemas/external_research_*.yaml`, and no `rf intake external-report` command exist in the
> research-foundry checkout — the contract is specified but unbuilt. Treat field names as the PRD's
> intended shape; reconcile against the shipped schema once the feature lands before running intake.

## Directory layout (PRD §6.1)

```text
external_research_handoff/v1/
├── handoff.yaml                 # required — packet metadata + member manifest
├── report.md                    # required — content_role: platform_synthesis (the ranked-source narrative)
├── sources.yaml                 # required — the ranked citation list (this is the deliverable)
├── assertion_candidates.yaml    # required — may be an empty candidates list for this role
├── activity.yaml                # optional — trace only (search queries run), non-authoritative
└── attachments/                 # optional — manifest-listed regular files only (e.g. saved PDFs)
```

### `handoff.yaml`
Declares: schema name/version (`external_research_handoff` / `v1`), **producer profile: `perplexity`**,
the research question/task context (CBC source-gathering for `cbc_suite_v1`, extending RF-CBC-002),
declared sensitivity, creation time, content roles, and a sorted member inventory. No credentials,
tokens, or filesystem paths as remote identity. Opaque vendor/session references are allowed.

### `report.md`
`content_role: platform_synthesis`. Perplexity's narrative + inline citation labels. Context only —
**never parsed as a supported claim.**

### `sources.yaml` — the primary deliverable for this role
One entry per source. Each carries: packet-local source id, locator (DOI/URL), title, date/year,
declared source metadata (organization/journal, authors), **license/access status**, optional
normalized citation-tuple data, and **vendor-specific fields inside a namespaced extension object**.

> **Perplexity profile overlay (PRD §6.6):** *preserve Perplexity's citations and search-result
> metadata as namespaced extensions* (e.g. `x_perplexity.rank`, `x_perplexity.snippet`). **Do not
> trust Perplexity's ranking or citation order** as authority — order is a hint, not evidence. Keep
> the ranking data as an extension field, not as a promotion signal.

For this run put, per source: whether it **carries a numeric threshold** (and which — ANC / platelet /
WBC-differential / CBC reference interval), whether it is **independently retrievable** and at what
license tier (public-domain / open-access / paywalled), and which brief angle it serves. Say `unknown`
or leave nullable fields empty rather than inventing dates, authors, locators, or confidence.

### `assertion_candidates.yaml`
For the source-gathering role this may be an **empty candidates list** (`candidates: []`) — Perplexity
finds sources; ChatGPT DR structures the assertions. If Perplexity does surface a clean
condition→threshold assertion, record it as a candidate with `classification: assertion`, its
source/citation reference, and quoted text/selector when present.

### `activity.yaml` / `attachments/`
Optional. Activity is trace-only (e.g. the search queries). Attachments must be listed, hashed,
bounded, regular files — no path traversal, absolute paths, symlinks, or unlisted content.

## Import command (PRD §6.6 / ERI-FR-9)

Run a dry-run first (validates structure + computes identity, no mutation), then the real import:

```bash
# <PACKET_DIR>       = path to the external_research_handoff/v1 directory you saved
# <rf_workspace_id>  = the target rf workspace (owner-supplied at import time)
# <cbc_run_id>       = PLACEHOLDER — the cbc deepen run id assigned when Leg A launches in P2.
#                      Base bundle run is rf_run_20260717_rf_cbc_001_pediatric_cds_establish;
#                      the deepen run gets its own id. Leave as a placeholder until launch.

rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <cbc_run_id> --dry-run
rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <cbc_run_id>
```

Omitting `--run` stages the import (staging-only, no run attached) per PRD §5 / ERI-FR-9. The receipt
reports per-item completeness tier (`locator_only` → `source_resolved` → `passage_resolved` →
`verified`) and quarantine reasons. **Only exact-passage, RF-verified candidates ever enter the
claim/assertion flow** — Perplexity's prose and citation order never do.
