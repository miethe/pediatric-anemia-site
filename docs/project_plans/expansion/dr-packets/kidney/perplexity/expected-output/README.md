# Expected output — Perplexity Pro / kidney_suite_v1

Save Perplexity's returned output into the `external_research_handoff/v1` directory packet below, then
hand it back so Metis can run `rf intake external-report`. Everything imports as
`platform_synthesis` → **candidates only**; Perplexity's ranking and citation order are treated as
untrusted hints, never as evidence authority.

> **Layout source:** `research-foundry/docs/project_plans/PRDs/enhancements/external-research-report-interchange-v1.md` §6.1 (packet layout), §6.6 (producer profiles — Perplexity overlay: "preserve citations / search-result metadata as extensions; no trust in ranking or citation order"), §5 / FR-9 (`rf intake external-report`). This packet follows that draft PRD as read on 2026-07-24.

## Directory layout to create

```text
external_research_handoff/v1/
├── handoff.yaml                 # required — packet metadata + sorted member manifest
├── report.md                    # required — content_role: platform_synthesis (Perplexity's prose/ranked narrative)
├── sources.yaml                 # required — one packet-local ID per ranked source (DOI/URL/year/license); Perplexity citation + search-result metadata under a namespaced extension
├── assertion_candidates.yaml    # required — may be an empty candidates list (Perplexity's role is source-gathering, not extraction)
├── activity.yaml                # optional — trace only (search steps); non-authoritative
└── attachments/                 # optional — manifest-listed regular files only (e.g. a saved PDF of an open-access paper)
```

### Per-file notes for the Perplexity profile

- **`handoff.yaml`** — declare `schema: external_research_handoff`, `version: v1`,
  `producer_profile: perplexity`, the research question ("net-new + numerics sources for
  kidney_suite_v1 / RF-KID-001"), declared sensitivity, creation time, content roles, and a sorted
  member inventory. Never put credentials, tokens, or filesystem paths in it.
- **`report.md`** — must self-identify as `content_role: platform_synthesis`. Paste Perplexity's ranked
  narrative + gap notes here. Its inline citation labels are context, never parsed as supported claims.
- **`sources.yaml`** — the core deliverable. One packet-local source ID per ranked source, each with
  locator (DOI/stable URL), title, date, declared license/access, and Perplexity's citation/search-result
  metadata inside a **namespaced vendor-extension** object (e.g. `x_perplexity: {...}`). Set fields to
  `unknown` or leave nullable rather than inventing a date, author, or license.
- **`assertion_candidates.yaml`** — required file; for the source-gathering role it may be an **empty
  candidates list**. If Perplexity did emit condition→threshold rows anyway, stage them here as
  `classification: assertion`, each referencing a `sources.yaml` ID.
- **`activity.yaml` / `attachments/`** — optional. Attachments must be listed + hashed; no absolute
  paths, symlinks, or path traversal (they fail closed).

## Intake command (run by Metis, not the owner)

```bash
# Source the rf API creds first (read; never inline the token)
set -a; . ~/.config/research-foundry/serve.env; set +a

# Dry-run first — validates structure + computes identity, no canonical mutation
rf intake external-report docs/project_plans/expansion/dr-packets/kidney/perplexity/expected-output/external_research_handoff/v1 \
  --workspace <kidney_workspace_id> \
  --run <kidney_run_id> \
  --dry-run

# Then the real import
rf intake external-report docs/project_plans/expansion/dr-packets/kidney/perplexity/expected-output/external_research_handoff/v1 \
  --workspace <kidney_workspace_id> \
  --run <kidney_run_id>
```

- `--run <kidney_run_id>` is a **documented placeholder** — fill with the RF-KID-001 deepen run id once
  Leg A is launched (P2). Omitting `--run` imports staging-only (no run created; PRD §10 default).
- `--workspace <kidney_workspace_id>` — the target rf workspace for this run.
- Only rf's own verifier can move any candidate to `verified` via exact-passage binding. This import
  never does.
