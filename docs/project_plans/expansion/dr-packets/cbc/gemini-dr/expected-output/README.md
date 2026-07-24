# Expected output — Gemini Deep Research / cbc_suite_v1

Save the Gemini Deep Research result into the `external_research_handoff/v1` packet layout below, then
hand the directory back for `rf intake external-report`. Everything imports as `platform_synthesis` →
**candidates / idea captures only**; the rf verifier is the only path to `verified`.

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
├── report.md                    # required — content_role: platform_synthesis (recency findings + asides)
├── sources.yaml                 # required — the newer/superseding source list
├── assertion_candidates.yaml    # required — may be an empty list; supersession notes go as candidates
├── activity.yaml                # optional — trace only, non-authoritative
└── attachments/                 # optional — manifest-listed regular files only
```

### `handoff.yaml`
Declares: schema name/version (`external_research_handoff` / `v1`), **producer profile: `gemini`**,
research question/task context (recency + breadth sweep for `cbc_suite_v1`, extending RF-CBC-002, plus
future-module scouting), declared sensitivity, creation time, content roles, sorted member inventory.
No credentials/tokens/filesystem paths as remote identity.

### `report.md` — carries both deliverable sections for this role
`content_role: platform_synthesis`. Two clearly separated sections:
1. **Recency / supersession findings** — newest guidelines/standards vs. what we hold; which are newer
   or superseding; any threshold changes (cited).
2. **Future-module asides** — one-line `future-module: <domain> — <rationale> — <anchor + DOI/URL>`
   captures. These become **T0 idea captures on the program tree**
   (`tree_01KXQ7WC1HQE2GKZSCNDVXA9G7`) — **not rules, not bundles; nothing touches `modules/`.**

Report prose is context only — **never parsed as a supported claim.**

### `sources.yaml`
The newer/superseding sources. Each: packet-local id, locator (DOI/URL), title, date/year, declared
metadata, **license/access status**, and a namespaced extension recording **what it supersedes/adds**
and whether it is newer-than-what-we-hold.

> **Gemini profile overlay (PRD §6.6):** *normalize Gemini's grounding/source references and answer
> spans* into packet-local source ids and citation tuples. **No Google API coupling** — manual export
> only. Grounding metadata is preserved as extension fields, not treated as verification.

### `assertion_candidates.yaml`
May be an **empty candidates list** for the recency role. If a supersession changes a specific
threshold, record it as a candidate: `classification: assertion`, the new value (+UCUM unit), its
source/citation reference, and a note that it supersedes the prior value. Future-module asides are
**not** assertion candidates — keep them in `report.md`.

### `activity.yaml` / `attachments/`
Optional; trace-only / manifest-listed bounded regular files. No path traversal, absolute paths,
symlinks, or unlisted content.

## Import command (PRD §6.6 / ERI-FR-9)

```bash
# <PACKET_DIR>       = path to the external_research_handoff/v1 directory you saved
# <rf_workspace_id>  = the target rf workspace (owner-supplied at import time)
# <cbc_run_id>       = PLACEHOLDER — the cbc deepen run id assigned when Leg A launches in P2.
#                      Base bundle run is rf_run_20260717_rf_cbc_001_pediatric_cds_establish;
#                      the deepen run gets its own id. Leave as a placeholder until launch.

rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <cbc_run_id> --dry-run
rf intake external-report <PACKET_DIR> --workspace <rf_workspace_id> --run <cbc_run_id>
```

Omitting `--run` stages the import (staging-only). The receipt reports per-item completeness tier and
quarantine reasons. Newer/superseding sources still re-verify through exact-passage binding; only the
RF verifier assigns `verified`. **Future-module asides route separately** to `op capture` / IntentTree
T0 — they never enter this bundle or any `modules/` file.
