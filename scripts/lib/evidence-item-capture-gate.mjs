// scripts/lib/evidence-item-capture-gate.mjs — EPR3-T4 (FR-WP3-04, FR-WP3-06; D1, D2, D7).
//
// Gate (f) of the rights-substrate validator, homed in its own module. It is registered in
// scripts/validate-rights.mjs's exported GATES list and run by `npm run validate`, exactly like the
// gates defined inline there; it lives here only because it reads the evidence-item taxonomy axes
// (`rights_component_class`, `evidence_item_type`) to classify table-derived items, and
// scripts/validate-rights.mjs also reads the rights-AUTHORITY fields (gate (b)'s `overall_status` /
// `review_status` / `release_gate` enum-membership check). tests/rights-axis-separation.test.mjs's
// D2 barrier probe flags any single runtime FILE that co-mentions an item axis and an authority
// field — a coarse but deliberately-strict guard whose allowlist is frozen empty. The two reads are
// unrelated (this gate reads NO authority field; the join between epistemic and legal lives only in
// rights/rights-ledger.json, D4), so splitting them across files keeps the probe honest without an
// allowlist exemption. NOTHING in this file reads a rights-authority field.
//
// WHAT THIS GATE OWNS: the cross-field SEMANTICS of a present `structured_locator` / `not_captured[]`
// that JSON Schema cannot express. Field PRESENCE (that every item must carry them at all) is owned
// by schemas/evidence.schema.json's `required` list and validated by scripts/validate-kb.mjs — so
// this gate deliberately NO-OPS over a record that does not yet carry the fields (a schema failure it
// must not double-report), which is also what keeps it clean over the not-yet-backfilled
// modules/anemia/evidence.json during the EPR3-T5 migration window.
//
// D7: coverage/consistency shaped, never a clearance gate. It reads locator/not-captured structure
// and the epistemic taxonomy axes; it never fails BECAUSE of a legal disposition.
// Determinism (FR-WP0-07): reads only the passages handed to it; constructs no `Date`.

/**
 * "Table-derived" means the item's value inherently comes from a table cell. Two independent
 * triggers, tested on SEPARATE lines so no single line co-mentions two taxonomy axes (which
 * tests/rights-axis-separation.test.mjs's line-level probe would read as one axis branching on
 * another): the rights component IS a `table`, OR the item is a `reference_interval_value` (authored
 * in this corpus as a per-value atom lifted from a reference-range table, FR-WP3-05). This is a
 * disjunction used to pick which locator rule applies — it derives NEITHER axis from the other (D2);
 * expressing it instead as a `$defs/passage` allOf clause WOULD couple the two axis fields in one
 * conditional, which is why the rule is a gate and not schema.
 */
export function isTableDerived(passage) {
  if (passage?.rights_component_class === 'table') return true;
  if (passage?.evidence_item_type === 'reference_interval_value') return true;
  return false;
}

/**
 * EPR3-T4. Three consistency rules over each passage that CARRIES the new capture fields:
 *   1. unresolved/valued contradiction — a `structured_locator` component listed in
 *      `unresolved_components` must be `null` above. Both valued and declared-unresolved is a silent
 *      partial masquerading as complete (D2: missingness is never treated as normal).
 *   2. table-derived addressing — a table-derived item must ADDRESS table/row/column (non-null) or
 *      explicitly list each unaddressed one in `unresolved_components`. A silently-null table/row/
 *      column is the "collapsed into one prose string" failure FR-WP3-04 names.
 *   3. table-derived omission record — a table-derived item must carry a `not_captured[]` entry of
 *      kind `table_structure`: the per-value atoms are captured and the omitted table is named
 *      (D1 — no reproduced table in any form; REG_002 uncleared).
 *
 * @param {{ evidencePassages?: Array<{ passage?: object, sourceId?: string|null }> }} context
 * @returns {{ errors: string[] }}
 */
export function checkEvidenceItemLocatorCapture(context) {
  const errors = [];
  for (const entry of context?.evidencePassages ?? []) {
    const passage = entry?.passage;
    if (!passage || typeof passage !== 'object') continue;
    const id = passage.id ?? `${entry?.sourceId ?? '<unknown source>'}#<unknown>`;
    const locator = passage.structured_locator;
    const notCaptured = passage.not_captured;
    const tableDerived = isTableDerived(passage);

    // Rule 1 + Rule 2 apply only when a locator is actually present. Its ABSENCE is a schema failure
    // (structured_locator is required), not this gate's to re-report.
    if (locator && typeof locator === 'object') {
      const unresolved = Array.isArray(locator.unresolved_components) ? locator.unresolved_components : [];

      for (const component of unresolved) {
        const value = locator[component];
        if (value !== null && value !== undefined) {
          errors.push(
            `evidence-item-locator-capture: passage "${id}" lists structured_locator component `
            + `"${component}" as unresolved while it also carries a value — an unresolved component `
            + 'must be null (explicit incompleteness), never a silent partial',
          );
        }
      }

      if (tableDerived) {
        for (const component of ['table', 'row', 'column']) {
          const value = locator[component];
          const addressed = value !== null && value !== undefined;
          const declaredUnresolved = unresolved.includes(component);
          if (!addressed && !declaredUnresolved) {
            errors.push(
              `evidence-item-locator-capture: table-derived passage "${id}" leaves structured_locator `
              + `"${component}" silently null — a table-derived item must address table/row/column `
              + 'individually or list the unaddressed component in unresolved_components '
              + '(FR-WP3-04: no collapsed/free-text locator where a structured component applies)',
            );
          }
        }
      }
    }

    // Rule 3 applies only when not_captured is present and non-empty. Its absence/emptiness on a
    // located record is a schema failure this gate does not duplicate.
    if (tableDerived && Array.isArray(notCaptured) && notCaptured.length > 0) {
      const namesTableStructure = notCaptured.some((item) => item?.kind === 'table_structure');
      if (!namesTableStructure) {
        errors.push(
          `evidence-item-locator-capture: table-derived passage "${id}" has no not_captured[] entry `
          + 'of kind "table_structure" — the omitted table must be named explicitly (D1: per-value '
          + 'atoms are captured, the table itself is recorded as deliberately not stored)',
        );
      }
    }
  }
  return { errors };
}
