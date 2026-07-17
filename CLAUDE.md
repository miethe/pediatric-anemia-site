# Pediatric CDS Platform — project context

> Loaded into every Claude Code session in this repo. Keep it thin: orient, state the hard
> guardrails, point to canonical detail. Deep planning lives in `docs/project_plans/expansion/`.

## What this is

A **deterministic, evidence-linked pediatric clinical decision-support (CDS)** codebase. Today it is
a single-module **pediatric anemia** research prototype (v0.3.1): a browser-local clinician SPA plus
a mirror REST API over a JSON knowledge base. The active program (see `docs/project_plans/expansion/`)
expands it into a **multi-module, evidence-governed pediatric lab-interpretation platform** —
anemia is the wedge, the CBC/cytopenia suite is the product, and an evidence-to-executable-CDS
pipeline is the moat.

**Status: unvalidated research prototype.** Automated checks prove *software behavior*, never clinical
validity, safety, diagnostic performance, or regulatory status. Every change must preserve that honesty
until the actual validation gates (content → technical → retrospective → silent-mode → human-factors →
interventional) are passed.

## Hard guardrails (do not cross without explicit human direction)

- **No generative model in the clinical decision path.** Inference is deterministic rules over derived
  facts. Generative AI never makes the final patient-specific decision.
- **No autonomous diagnosis, treatment, dosing, or transfusion directives.** Output is ranked
  *patterns*, safety flags, missing-data prompts, confirmatory steps, referral readiness, and rule/
  evidence traces — support, not replacement, for clinician judgment.
- **No invented thresholds.** Every clinical statement ties to a source; every rule cites evidence or is
  explicitly marked an implementation proposal. Missingness is never treated as normal.
- **No PHI in the public microsite.** The browser assessment sends no patient data anywhere; no
  third-party scripts/fonts/analytics. Server/PHI modes require HIPAA controls and are separate.
- **No AI-published rule changes.** Rule/KB edits require independent clinical review + executable tests
  + signed release. No random calculator expansion; no pay-to-rank; no unsupported confidence %.
- The ranking score is an internal ordinal sort priority — **not** a probability, likelihood ratio, or
  performance metric.

## Architecture orientation

```
patient JSON → deriveFacts() (src/facts.js) → JSON rule engine (src/ruleEngine.js over data/rules.json)
            → merge/rank candidate patterns (data/candidates.json) → evidence-linked output + audit (src/engine.js)
```

- Knowledge base: `data/rules.json` (91 rules), `data/candidates.json` (26 patterns),
  `data/evidence.json` (6 records), `data/reference-ranges.json` (AAP fallbacks; local ranges override).
- Rule DSL: `all`/`any`/`not`, equality/numeric/existence checks → candidate/alert/question/note outputs
  with evidence IDs. Schemas in `schemas/`. See `docs/architecture.md` §7 for the production-hardening
  additions (typed facts, exact-passage locators, effective/retire dates, signed manifest).
- API: `GET /health`, `GET /api/v1/knowledge-base`, `POST /api/v1/assess` (`server.mjs`, `openapi.yaml`).
- **Gate before commit:** `npm run check` (= `npm test` + `npm run validate` + `npm run build` +
  `npm run smoke`). All must pass. Node ≥ 20.

## Where the plan lives

- `docs/project_plans/expansion/00-expansion-plan.md` — **start here.** Executive synthesis, the
  phase ladder at a glance, the AOS scaffolding record, and the sequenced next actions.
- `docs/project_plans/expansion/01-platform-expansion-roadmap.md` — phased expansion (Phase 0→6+),
  per-phase research needs, validation gates, dependencies, AOS wiring, machine-readable seed.
- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` — the secondary track:
  the Evidence Foundry runtime built on our Research Foundry (`rf`) control plane.
- Source strategy: `docs/project_plans/pediatric-cds-expansion-dr.md` and the
  `pediatric-cds-commercialization-package-2026-07-16/` bundle.

## Program tracking

- **Operator run:** `.operator/runs/op_run_20260717_050047_pediatric-cds-platform-e/`.
- **IntentTree task graph:** tree `tree_01KXQ7WC1HQE2GKZSCNDVXA9G7` ("Pediatric CDS Platform
  Expansion") in the **Work** workspace `ws_01KV8VMWXK05CTAZVHKT57HY0H` — phases P0–P6 + 42 work
  packages. Drive it with `itt tree get <id>` / `itt today`.

## How work runs here (AOS)

This repo is scaffolded with the standard workflow operational artifacts under `.claude/`:

- **Plan** a change with `/plan-feature` (tier-aware → the `planning` skill produces PRD + Implementation
  Plan for T2/T3). **Execute** with `/execute-plan` / `/execute-phase` under the `dev-execution` skill's
  git-worktree → commit-per-phase → PR protocol. **Review** with `/code-review` and the `council-review`
  skill (adversarial gate) before **`/pr`** + `/pre-pr-validation`.
- **Route non-trivial ideas through `op`** (the Agentic Operator). **Clinical/evidence research is an
  `rf` (Research Foundry) run** — never freehand medical claims; the Evidence Foundry track formalizes
  this. Track multi-phase work as an **IntentTree** tree. Adversarial critique → `council-review`.
- Git: branch off `main`, `npm run check` green, commit per phase, PR to the parent branch. Push before
  deploying. End commit messages with the Co-Authored-By trailer.
