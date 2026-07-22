validator: codex/gpt-5.6-terra
- [x] P6-T1 ADR existence/status — MET: `docs/adr/0001-canonical-authoring-model-rule-schema-v2.md:1-8` has frontmatter `status: proposed`.
- [x] P6-T1 options/default/DF-E1-07 — MET: ADR-1 presents three alternatives with a selected recommended default (`:85-114`) and names `DF-E1-07` (`:5`).
- [x] P6-T2 ADR and fixture worked example — MET: ADR-2 is proposed (`docs/adr/0002-exact-passage-storage-licensing.md:1-8`) and documents P1-T6's actual restricted 12-card/74-passage disposition from `HASH-PROVENANCE.md` (`:28-40`; fixture `:17-35`).
- [x] P6-T2 DF-E1-05 — MET: ADR-2 frontmatter explicitly lists `unblocks: ["DF-E1-05"]` (`docs/adr/0002-exact-passage-storage-licensing.md:5`).
- [x] P6-T3 ADR/questions — MET: ADR-3 is proposed (`**Status**: proposed`, `docs/adr/0003-terminology-local-lab-profile-ownership.md:3`) and its table addresses terminology-mapping ownership and local-range profile claims versus config (`:15-18`).
- [x] P6-T3 DF-E1-05 — MET: ADR-3 explicitly declares `DF-E1-05` as unblocked (`docs/adr/0003-terminology-local-lab-profile-ownership.md:5`).
- [x] P6-T4 ADR/IDs/default — MET: ADR-4 is proposed and names `DF-E1-01` and `DF-E1-04` in frontmatter (`docs/adr/0004-clinical-approval-identity-adjudication.md:3-8`), with an explicit recommended default (`:65-68`).
- [x] P6-T5 ADR/P5-T5 substrate — MET: ADR-5 is proposed (`**Status**: proposed`, `docs/adr/0005-kb-serialization-signing-key-custody.md:3`) and states P5-T5 implements canonical serialization as the signing substrate (`:16-22`).
- [x] P6-T5 DF-E1-06 and DF-E2-01 — MET: ADR-5 identifies both deferred items as blocked/unblocked dependencies (`docs/adr/0005-kb-serialization-signing-key-custody.md:133-152`).
- [x] P6-T6 ADR/PHI constraint/DF-E1-04 — MET: ADR-6 is proposed and lists `DF-E1-04` (`docs/adr/0006-validation-data-boundary-deidentification.md:5-10`), while binding every option to the verbatim "No PHI in the public microsite" guardrail (`:52`; matches `CLAUDE.md:29` verbatim).
- [x] P6-T7 ADR/three deferred IDs — MET: ADR-7 is proposed (`**Status**: proposed`, `docs/adr/0007-surveillance-cadence-materiality-classes.md:3`) and names `DF-E2-01`, `DF-E2-02`, and `DF-E2-03` (`:151-179`).
- [x] P6-T8 ADR/gap-register evidence/DF-E1-02 — MET: ADR-8 is proposed (`## Status` / `proposed`, `docs/adr/0008-pathb-hardening-vs-native-adapter.md:3-5`), explicitly cites §6.2's 0/6 adapters and hard-coded RF/repo/TMP/stamp rows (`:23-51`), and names `DF-E1-02` (`:14`).
- [x] Phase 6 Quality Gate: eight proposed ADRs — MET: exactly eight `0001`-`0008` ADR files exist under `docs/adr/`; each carries a proposed status (frontmatter `status: proposed` for ADR-1/2/4/6, `**Status**: proposed` for ADR-3/5/7, `## Status` / `proposed` for ADR-8).
- [x] Phase 6 Quality Gate: decisions/options/defaults/unblocks — MET: each ADR contains a decision, at least two alternatives (ADR-1: 3, ADR-2/3/4/5/6/7: >=3, ADR-8: 4), a recommended default, and its unblocking deferred ID(s), independently spot-checked via grep across all 8 files.
- [x] Phase 6 Quality Gate: zero accepted ADRs — MET: `grep -in "status:.*accepted" docs/adr/000{1..8}-*.md` returns no matches (independently re-verified); the only "accepted" occurrence found is ADR-3's explicit disclaimer text "It is not accepted here" (`:126`).
- [x] Phase 6 progress success_criteria consistency — MET: `.claude/progress/evidence-foundry-buildout/phase-6-progress.md:133-136` defines SC-1, SC-2, and SC-3 matching the same three quality-gate criteria.
SUMMARY: 16/16 met
