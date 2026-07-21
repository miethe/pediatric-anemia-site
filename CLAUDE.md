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
patient JSON → deriveFacts() (src/facts.js, shim over modules/anemia/facts.anemia.js) → JSON rule engine (src/ruleEngine.js over modules/anemia/rules.json)
            → merge/rank candidate patterns (modules/anemia/candidates.json) → evidence-linked output + audit (src/engine.js)
```

- Knowledge base: `modules/anemia/rules.json` (91 rules), `modules/anemia/candidates.json` (26 patterns),
  `modules/anemia/evidence.json` (6 records), `modules/anemia/reference-ranges.json` (AAP fallbacks; local ranges override).
- Rule DSL: `all`/`any`/`not`, tri-state + equality/numeric/existence checks → candidate/alert/
  question/note outputs with evidence IDs. Wave-0 safety substrate: `docs/architecture.md` §6/§7/§10
  (`clinicalApprovers[]`/`approvedBy[]` stay schema-forced empty; no clinical sign-off exists).
- Module package architecture: see `docs/architecture.md` §2a.
- API: `GET /health`, `GET /api/v1/knowledge-base`, `POST /api/v1/assess` (`server.mjs`, `openapi.yaml`).
- **Gate before commit:** `npm run check` (= `npm test && npm run validate && npm run coverage:rules && npm run build && npm run verify:d4 && npm run check:imports && npm run smoke:browser && npm run smoke`).
  All must pass. Node ≥ 20. `package.json`'s `scripts.check` is authoritative — this string is
  copied verbatim from it and a doc-truth test (`tests/claudemd-check-gate.test.mjs`) fails on drift.

## Where the plan lives

- `docs/project_plans/expansion/00-expansion-plan.md` — **start here.** Executive synthesis, the
  phase ladder at a glance, the AOS scaffolding record, and the sequenced next actions.
- `docs/project_plans/expansion/01-platform-expansion-roadmap.md` — phased expansion (Phase 0→6+),
  per-phase research needs, validation gates, dependencies, AOS wiring, machine-readable seed.
- `docs/project_plans/expansion/02-evidence-foundry-on-research-foundry.md` — the secondary track:
  the Evidence Foundry runtime built on our Research Foundry (`rf`) control plane.
- Source strategy: `docs/project_plans/pediatric-cds-expansion-dr.md` and the
  `pediatric-cds-commercialization-package-2026-07-16/` bundle.

## AOS assets already available to this program

Index: `docs/project_plans/expansion/aos-asset-index.md` (capability table, delivered/not-delivered,
when-to-reach-for-what, honesty boundaries). Linked handoff docs there are canonical for depth.

- **`rf` (Research Foundry) has delivered 7 verified pediatric evidence bundles** — they are
  *claims, not rules*; nothing converts them into `modules/<id>/*.json` yet (`EF-WP0`/`EF-WP1`,
  not started). Treating an unconverted `rf` bundle as production clinical evidence is the
  mistake a future session is most likely to make.
- **ARC has a repository-ready pediatric clinical council** with a completed synthetic readiness
  audit — non-qualifying. Treating that ARC review as credentialed clinical sign-off is the other
  most likely mistake; `clinicalApprovers[]`/`approvedBy[]` need real named humans, never ARC
  output.
- **Check the `rf` catalog before launching a new evidence run**:
  `GET $RF_API_URL/api/catalog/search?q=...` — a verified claim may already exist.
- **IntentTree node status is known stale** (merged P0 work and all 7 verified `rf` runs still
  show `not_started`) — verify against git log / `rf-handoff/RESULTS.md` before trusting `itt`.
- `rf` API reach: `http://10.42.10.76:7432`; creds at `~/.config/research-foundry/serve.env`
  (`RF_API_URL` + `RF_TOKEN_AGENT`).

## Evidence grounding — corrected blocking picture

**0 of 91 rules remain grounded** (bound to a `status: source-supported` passage in
`evidence-packs/passage-attestations.json`, which ships empty by design). The prior project belief —
that this gap is wholly a licensing problem — is **corrected** by
`.claude/findings/rights-governance-spec-v1.0-review-findings.md` §3: measured from code, the gap is
**~2/3 attestation-shaped (60 rules)** — their sentinel's primary source already has ≥1 bindable
passage, so the only mechanical blocker is the empty ledger — and **~1/3 licensing-shaped (31 rules)**
— all bound to `AAP2026_IDA`, whose 7 passages are quarantined `source-not-independently-retrievable`.
The same review records that **13 passages are already bindable today** (BLOOD 5, WHO 3, CDC 2, BSH 2,
FDA 1) — a fact recorded nowhere before this note. None of the 13 has been bound; binding requires a
named credentialed clinician attesting each rule individually (60 separate records from a 13-passage
pool), and the 13 survivors are the numerics-light paraphrases — the threshold-bearing passages were
quarantined for `omits-source-numerics`, so attesting them grounds rules to thin framework claims
rather than to the cutoffs those rules encode. See the findings doc for the full picture, including
why the Rights Governance Spec v1.0 does not unblock most of the 31.

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
