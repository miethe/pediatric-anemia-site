// modules/cbc_suite_v1/evidence.js — this module's OWN passage accessors, over its OWN
// evidence.json (never anemia's). Required plumbing gap found and fixed while implementing
// P4-T5 (test corpus), NOT a rule/evidence content change, and NOT the broader "src/evidence.js
// unification" CLAUDE.md names as its own separate, deliberate future task (that would generalize
// src/evidence.js itself to be moduleId-parameterized). This file instead uses the extension seam
// src/evidence/registry.js's own header comment already documents: "The day a second module
// registers, it adds its own entry here (its own evidence.js-shaped loader over its own
// evidence.json)." Before this file (and its REGISTRY entry) existed,
// `src/evidence/registry.js#accessorsFor('cbc_suite_v1')` threw unconditionally — every single
// `assess(input, 'cbc_suite_v1', ...)` call fails during ruleAudit's passage-status resolution
// (src/engine.js), for every rule, matched or not, regardless of rule content. No prior test had
// exercised that path (P4-T5 is the first).
//
// Only the two accessors src/evidence/registry.js actually calls are implemented here
// (passageById, passagesFor) — deliberately the minimal seam, not a duplicate of every helper in
// src/evidence.js (passageLocatorText/passageExactText/passageApplicability/
// isBindableAsSourceSupported have no cbc_suite_v1 caller yet).
import evidenceData from './evidence.json' with { type: 'json' };

const EVIDENCE = Object.freeze(
  Object.fromEntries(evidenceData.sources.map((source) => [source.id, source])),
);

/** All passage records for a source id. Unknown id or a source with no `passages` array → []. */
export function passagesFor(sourceId) {
  const source = EVIDENCE[sourceId];
  return Array.isArray(source?.passages) ? source.passages : [];
}

/** A single passage record by id, searched across every source in this module's own evidence. */
export function passageById(passageId) {
  if (!passageId) return null;
  for (const source of Object.values(EVIDENCE)) {
    const match = (Array.isArray(source.passages) ? source.passages : []).find((passage) => passage?.id === passageId);
    if (match) return match;
  }
  return null;
}
