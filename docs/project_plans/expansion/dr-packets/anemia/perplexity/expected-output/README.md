# Expected output — Perplexity Deep Research / anemia RF-ANE-001

Save the Perplexity Deep Research result into the `external_research_handoff/v1` packet layout below,
then hand the directory back for `rf intake external-report`. Everything imports as
`platform_synthesis` → **candidates only**; the rf verifier is the only path to `verified`.

> **⚠️ Layout-source assumption.** This layout and the `rf intake external-report` command come from
> the **draft, not-yet-implemented** PRD `external_research_handoff/v1`
> (`research-foundry/docs/project_plans/PRDs/enhancements/external-research-report-interchange-v1.md`,
> status: **draft**). As of authoring, no `templates/external_research_handoff/v1/`, no
> `schemas/external_research_*.yaml`, and no `rf intake external-report` command exist in the
> research-foundry checkout. Treat field names as the PRD's intended shape; reconcile against the
> shipped schema once the feature lands before running intake.

## Directory layout (PRD §6.1)

```text
external_research_handoff/v1/
├── handoff.yaml                 # required — packet metadata + member manifest
├── report.md                    # required — content_role: platform_synthesis (the narrative)
├── sources.yaml                 # required — THE DELIVERABLE for this role
├── assertion_candidates.yaml    # required — may be thin for a source-gathering pass
├── activity.yaml                # optional — trace only, non-authoritative
└── attachments/                 # optional — manifest-listed regular files only
```

### `handoff.yaml`
Declares: schema name/version (`external_research_handoff` / `v1`), **producer profile: `perplexity`**,
research question/task context (source hunt for the pediatric red-cell index substrate, module
`anemia`, item **RF-ANE-001**, extending RF-EV-001), declared sensitivity, creation time, content
roles, sorted member inventory. No credentials/tokens/filesystem paths as remote identity.

### `report.md`
`content_role: platform_synthesis`. Perplexity's narrative and search account. Context only — **never
parsed as a supported claim.** Include the search strategy: what you searched, what you excluded, and
why — reproducible selection is a run acceptance criterion.

### `sources.yaml` — the primary deliverable for this role

One entry per ranked source, carrying the `prompt.md` columns:

- packet-local `source_id`, `title`, `publisher_or_body`, `year`
- **`doi_or_url`** — required; DOI preferred
- **`access_status`** — `public-domain` | `open-access` | `free-to-read` | `paywalled` | `unknown`,
  kept **distinct** (see below), plus `license` (named license or `unstated`)
- `carries_numbers`, `analytes_covered`, `age_range_covered`, `population`
- `priority` (1–4) and `why_ranked_here`
- vendor-specific fields in a namespaced extension object

> **Perplexity profile overlay (PRD §6.6):** map Perplexity's citation exports into packet-local IDs.
> Every citation referenced anywhere in the packet must resolve to a `sources.yaml` entry.
> **No API call or session scraping** — manual export only.

**Keep `free-to-read` separate from `open-access`.** This is the field we most need you to get right:
readable is not reusable, and conflating them is the specific error that would waste the follow-on
rights work. When a document is readable without a reuse grant, say `free-to-read` and explain the
basis in `why_ranked_here`.

**Paywalled sources belong in the list.** Label them, cite the locator, and never paraphrase around
them — they route to the licensing track (**REG-002**) intact rather than being reconstructed.

### `assertion_candidates.yaml`
For a source-gathering pass this may be thin. Use it only for **claims about sources** — e.g. "body X
defines pediatric anaemia by hemoglobin only", "the CALIPER numeric tables are reachable at locator Y
under license Z". Classification discipline applies: `assertion` when the source states it directly,
`inference` when derived, `annotation` otherwise. **Do not** put extracted reference-interval numbers
here — that is the ChatGPT packet's job.

### `activity.yaml` / `attachments/`
Optional; trace-only / manifest-listed bounded regular files. No path traversal, absolute paths,
symlinks, or unlisted content.

## Import command (PRD §6.6 / ERI-FR-9)

```bash
# <PACKET_DIR>       = path to the external_research_handoff/v1 directory you saved
# <rf_workspace_id>  = the target rf workspace (owner-supplied at import time)
# <ane_run_id>       = PLACEHOLDER — the RF-ANE-001 deepen run id assigned when Leg A launches.
#                      Base bundle run is rf_run_20260717_rf_ev_001_pediatric_cds_backfill.

rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <ane_run_id> --dry-run
rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <ane_run_id>
```

Omitting `--run` stages the import (staging-only). Import this packet **first** in the sequence
(perplexity → chatgpt-dr → gemini-dr) so the source pool exists before the extraction rows land.

**Nothing in this packet is evidence.** A source list is a map of where evidence might be bound, not a
binding. Only exact-passage matching plus a named credentialed human attestation makes any of it
clinically usable.
