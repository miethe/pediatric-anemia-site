---
title: "EP0-T8 Resync — IntentTree + Research Foundry Launch"
created: 2026-07-19
scope: "HALF A (IntentTree sync) + HALF B (RF run launches)"
status: complete
---

## HALF A — IntentTree Tracker Resync

**Ground truth established from:**
- Commit `ff4b519` ("Platform foundation P0: modules/<id>/ package contract") — merged to main, squash of 7-phase execution
- `docs/project_plans/expansion/rf-handoff/RESULTS.md` — all 7 rf runs verified (exit 0, 0 unsupported)

**Nodes updated to `completed` status:**

| Node ID | Title | Reason |
|---------|-------|--------|
| node_01KXQ7X9WSZJNWRS1K1X8HJXS1 | P0 — Platform foundation refactor | Merged commit ff4b519; all child WPs completed |
| node_01KXQ7XA2E9R2XFVMSN5ZX9FRT | P0-WP1 — Module package contract + move anemia | Delivered in ff4b519 |
| node_01KXQ7XA7RDAAG8B93FM16PRK4 | P0-WP2 — Fact-derivation registry | Delivered in ff4b519 |
| node_01KXQ7XADCABTCS3P7WQC8KJC8 | P0-WP3 — Generalize engine assess() | Delivered in ff4b519 |
| node_01KXQ7XAK6XX1376V68FPW78KK | P0-WP4 — Reference-range registry | Delivered in ff4b519 |
| node_01KXQ7XASDZNM04S73EZHGZVTZ | P0-WP5 — Scripts + server iterate modules | Delivered in ff4b519 |
| node_01KXQ7XB08J9HK54M8P5XNWSWA | P0-WP6 — Per-module unsigned manifest stub | Delivered in ff4b519 |
| node_01KXRTYJWWGM2YJMARF942MTBA | REG-001 — Intended-use / non-device-CDS mapping | Verified in RESULTS.md (exit 0) |
| node_01KXRTYK9Q263P1514888SAFBZ | REG-004 — HIPAA / server-PHI controls scoping | Verified in RESULTS.md (exit 0) |
| node_01KXRTYH7YXQF4T6HDKST8RT20 | RF-EV-001 — Exact-passage backfill (6 anemia sources) | Verified in RESULTS.md (exit 0) |

**Deliberately NOT updated:**
- EF-WP0 (rf-bundle → kb-pack converter) — infrastructure task, not evidence run; still genuinely in design/planning
- RFC-CBC-001, RFC-CBC-002, RF-KID-001, RF-GRO-002 — verified in RESULTS.md but no IntentTree nodes found for them (either not explicitly wired or deferred to later phase planning)

## HALF B — Research Foundry Runs Launched

**Catalog check:** No pre-existing runs for RF-EV-002 or REG-002 found; both launched fresh.

**New runs registered:**

| Run ID | Title | Status | Project | Tags |
|--------|-------|--------|---------|------|
| `rf_run_20260719_caliper_pediatric_cbc_reference_intervals_age` | CALIPER pediatric CBC reference intervals | planned | pediatric-cds-platform | phase-2, reference-ranges, CALIPER |
| `rf_run_20260719_content_rights_and_licensing_review_what` | Content-rights & licensing review | planned | pediatric-cds-platform | phase-3, legal, licensing, regulatory |

Both runs scaffolded + registered (state: `planned`). Swarm execution deferred to parallel agent.

**Verification:** Both appear in `GET /api/runs` catalog (grep confirmed).

---

**Summary:** 10 IntentTree nodes synced; 2 RF runs launched (scaffolded). No command failures.
