// src/evidenceStalenessPolicy.js — EP5-T5 / SPIKE-006 Amendment 4's declared governance-policy
// config surface for evidence-staleness expiry (docs/architecture.md §10's fifth fail-closed
// condition: "evidence version is expired under governance policy").
//
// Amendment 4 is explicit that SPIKE-006 does NOT close this requirement: no human has picked a
// staleness window, and none may be invented here — an expiry window is itself a safety-relevant
// governance number, exactly like a clinical threshold, and this codebase's "no invented
// thresholds" guardrail applies to it with the same force.
//
// `maxAgeDays: null` is the honest current state: NO GOVERNANCE DECISION HAS BEEN MADE. Every
// caller of src/kbVerify.js#checkEvidenceExpiry (server.mjs startup, scripts/build-static.mjs)
// MUST treat `null` as "expiry is not enforced" rather than "never expires", and must disclose
// that non-enforcement loudly (startup log, GET /api/v1/knowledge-base, dist/build-info.json) —
// never silently, and never in a way that could be read as "expiry was checked and passed."
//
// Changing `maxAgeDays` from null to a number is the deliberate, reviewable act by which a human
// makes this governance decision — the same posture module-manifest.schema.json's `approvedBy`
// documents for raising `maxItems` above 0. It must never be done to make a build or a test pass.
export const EVIDENCE_STALENESS_POLICY = Object.freeze({
  maxAgeDays: null,
  rationale:
    'No human has set an evidence-staleness window (SPIKE-006 Amendment 4, '
    + 'docs/project_plans/SPIKEs/spike-006-kb-signing-key-custody-verification.md). This value '
    + 'must remain null until a human explicitly records a governance decision here — it must '
    + 'never be invented by implementation. While null, the expiry check in '
    + 'src/kbVerify.js#checkEvidenceExpiry is NOT enforced; every consumer must disclose that '
    + 'fact rather than let a missing policy read as "checked and passed."',
});
