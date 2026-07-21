// scripts/lib/evidence-numeric-recapture-gate.mjs — EPR3-T6 (FR-WP3-05, AC-WP3-NUMERICS; D1, D7).
//
// Gate (g) of the rights-substrate validator, homed in its own module and registered in
// scripts/validate-rights.mjs's exported GATES list (run by `npm run validate`). It proves the
// AC-WP3-NUMERICS coverage property: every in-scope numeric-omission passage RESOLVES to exactly one
// of two states — a set of per-value atoms, or an explicit not-captured record — and NEVER to
// neither. The two states, and the shape of an atom, are owned by schemas/evidence.schema.json
// ($defs/numericRecapture, $defs/numericAtom); this gate owns the cross-record COVERAGE and the
// resolution/atoms consistency JSON Schema cannot express on its own (that every flagged passage
// carries the field at all).
//
// IN-SCOPE SET (deterministic): the passages the independent EP3-T5 fidelity audit flagged
// `omits-source-numerics`, UNION the passages that audit additionally named by id
// (docs/audits/ep3-t5-passage-fidelity-audit-2026-07-20.md — AAP2026_IDA#ev_002, whose numeric
// omission the audit records under a different primary flag). Both are drawn from committed data /
// the plan's own enumeration, never inferred.
//
// D7 — COVERAGE/CONSISTENCY ONLY, never a clearance gate. This gate reads a passage's reviewFlags,
// id, and numeric_recapture resolution; it reads NO rights-authority field (overall_status /
// review_status / release_gate / clearance_status) and NO evidence-item taxonomy axis
// (evidence_item_type / rights_component_class / judgment_basis). A passage resolving to
// `no_reported_value_available` is a fully valid resolution, not a failure — capturing nothing when
// the source's reported value is not in the retrievable provenance is exactly the honest state D1
// requires (missingness is never treated as normal; nothing is authored). This gate homes here,
// separate from scripts/validate-rights.mjs's gate (b) which reads authority fields, only so the
// axis/authority co-mention it neither needs nor performs can never trip the D2 barrier probe in
// tests/rights-axis-separation.test.mjs — the same reason EPR3-T4's locator gate lives in its own
// module. Determinism (FR-WP0-07): reads only the passages handed to it; constructs no `Date`.

/** The EP3-T5 audit flag naming a passage that dropped source thresholds/units/formulae. */
export const OMITS_NUMERICS_FLAG = 'omits-source-numerics';

/**
 * Passages the EP3-T5 audit additionally named by id as dropping numerics, whose PRIMARY reviewFlag
 * is something else (so the flag-driven set alone would miss them). Frozen and drawn from the plan's
 * own enumeration (phase-r3-evidence-taxonomy.md, EPR3-T6 scope). MAY ONLY SHRINK as those passages
 * are re-captured or retired; adding one is a reviewable diff citing the audit.
 */
export const AUDIT_NAMED_NUMERIC_OMISSION_PASSAGES = Object.freeze(['AAP2026_IDA#ev_002']);

/** The two legal resolutions. A passage's numeric omission resolves to exactly one of these. */
const RESOLUTIONS = Object.freeze(['per_value_atoms', 'no_reported_value_available']);

/**
 * @param {{ evidencePassages?: Array<{ passage?: object, sourceId?: string|null }> }} context
 * @returns {{ errors: string[] }}
 */
export function checkNumericRecaptureResolution(context) {
  const errors = [];
  const auditNamed = new Set(AUDIT_NAMED_NUMERIC_OMISSION_PASSAGES);

  for (const entry of context?.evidencePassages ?? []) {
    const passage = entry?.passage;
    if (!passage || typeof passage !== 'object') continue;
    const id = passage.id ?? `${entry?.sourceId ?? '<unknown source>'}#<unknown>`;

    const flags = Array.isArray(passage.reviewFlags) ? passage.reviewFlags : [];
    const inScope = flags.includes(OMITS_NUMERICS_FLAG) || auditNamed.has(id);
    const recapture = passage.numeric_recapture;
    const hasRecapture = recapture !== null && recapture !== undefined && typeof recapture === 'object';

    // COVERAGE: every in-scope passage must carry a resolution — never resolve to neither state.
    if (inScope && !hasRecapture) {
      errors.push(
        `evidence-numeric-recapture-resolution: in-scope numeric-omission passage "${id}" carries no `
        + 'numeric_recapture resolution (EPR3-T6, AC-WP3-NUMERICS) — it must resolve to per_value_atoms '
        + 'or no_reported_value_available, never to neither',
      );
      continue;
    }

    if (!hasRecapture) continue;

    // CONSISTENCY on any record that carries the field (catches the audit-named passages too, and
    // any future opt-in). Schema owns the shape; this re-asserts the resolution/atoms coupling with a
    // gate-level message, and that a per_value_atoms resolution actually carries atoms with values.
    const resolution = recapture.resolution;
    const atoms = Array.isArray(recapture.atoms) ? recapture.atoms : [];

    if (!RESOLUTIONS.includes(resolution)) {
      errors.push(
        `evidence-numeric-recapture-resolution: passage "${id}" numeric_recapture.resolution `
        + `"${resolution}" is not one of ${RESOLUTIONS.join(' / ')} (EPR3-T6)`,
      );
      continue;
    }

    if (resolution === 'per_value_atoms') {
      if (atoms.length === 0) {
        errors.push(
          `evidence-numeric-recapture-resolution: passage "${id}" resolves to per_value_atoms but `
          + 'captured zero atoms — a state (a) resolution with no atom captured nothing (EPR3-T6)',
        );
      }
      for (let i = 0; i < atoms.length; i += 1) {
        const value = atoms[i]?.value;
        if (typeof value !== 'string' || value.trim() === '') {
          errors.push(
            `evidence-numeric-recapture-resolution: passage "${id}" atom #${i} carries no reported `
            + 'value — a per-value atom exists to hold the source\'s reported value (EPR3-T6)',
          );
        }
      }
    } else if (atoms.length > 0) {
      errors.push(
        `evidence-numeric-recapture-resolution: passage "${id}" resolves to `
        + `no_reported_value_available yet carries ${atoms.length} atom(s) — that is a per_value_atoms `
        + 'resolution mislabelled (EPR3-T6)',
      );
    }
  }

  return { errors };
}
