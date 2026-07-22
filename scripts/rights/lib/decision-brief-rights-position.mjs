// scripts/rights/lib/decision-brief-rights-position.mjs — EPR4-T2 (FR-WP4-02, decisions-block D2).
//
// Homed in its OWN module for the same reason scripts/validate-rights.mjs splits gates (f)/(g)/(h)
// into scripts/lib/evidence-*-gate.mjs: this module reads the RIGHTS-AUTHORITY fields
// (`overall_status`, `review.review_status`) that tests/rights-axis-separation.test.mjs's D2
// barrier probe (AC-WP3-AXES) forbids co-mentioning, anywhere in the same file's executable code,
// with an evidence-item taxonomy axis field (`evidence_item_type`, `rights_component_class`,
// `judgment_basis`, `passageFidelity`). scripts/rights/build-decision-brief.mjs reads every one of
// those item-axis fields to build atoms; keeping this file's authority-field reads there would trip
// the probe. This module is the ONLY place in the brief generator that names `overall_status` /
// `review_status` — including in rendered markdown line construction, where each status is
// interpolated on its OWN line/expression rather than combined with another axis field on one line
// (the probe's second check: a line naming two distinct axis fields alongside a derivation-shaped
// operator). The orchestrator consumes only this module's exported functions and the opaque
// `rights_position` object they return; it never itself writes an `overall_status`/`review_status`
// literal.
//
// D6/D7: every read here is REPORTING, never DETERMINING — `overall_status` is read and rendered
// exactly as recorded; this module asserts, infers, and upgrades nothing.

import { sourceRightsPosition } from '../../../src/evidence.js';

/**
 * Reads, never determines, the recorded rights position for a source: (a) the lightweight
 * source-level EP-R2 fields already on `evidence.json`'s source record, and (b) every
 * rights/rights-records.json record joined to this source id via rights/rights-ledger.json
 * (D4) — a source may legitimately join to more than one record (e.g. a source-level record
 * plus a component-scoped derived-fact record).
 */
export function resolveRightsPositionForSource(source, rightsLedger, rightsRecords) {
  const recordsById = new Map((rightsRecords.records ?? []).map((r) => [r.rights_record_id, r]));
  const entries = (rightsLedger.entries ?? []).filter(
    (e) => e.clinical_identifier_type === 'evidence_source_id' && e.clinical_identifier === source.id,
  );
  const resolvedRecords = entries.map((entry) => {
    const record = recordsById.get(entry.rights_record_id) ?? null;
    const status = record?.overall_status ?? null;
    const reviewStatus = record?.review?.review_status ?? null;
    return {
      rights_record_id: entry.rights_record_id,
      record_scope: record?.record_scope ?? null,
      overall_status: status,
      review_status: reviewStatus,
      found: Boolean(record),
    };
  });

  return {
    source_id: source.id,
    source_title: source.title,
    organization: source.organization,
    source_level_summary: {
      rights_position_label: sourceRightsPosition(source),
      access_basis: source.access_basis ?? null,
      license_status: source.license?.status ?? null,
      rights_holder: source.license?.rights_holder ?? null,
      noncommercial_only: source.license?.noncommercial_only ?? null,
      commercial_use: source.terms?.commercial_use ?? null,
      redistribution: source.terms?.redistribution ?? null,
      adaptation: source.terms?.adaptation ?? null,
      sublicensing: source.terms?.sublicensing ?? null,
    },
    rights_records: resolvedRecords,
  };
}

/**
 * A short, human-readable join of every resolved record's status — for embedding in a decision
 * question without the caller ever having to read the field itself.
 */
export function summarizeRightsRecordStatuses(rightsPosition) {
  const statuses = rightsPosition.rights_records.map((record) => record.overall_status ?? 'NOT_FOUND');
  return statuses.length > 0 ? statuses.join(', ') : 'no joined rights record (coverage gap)';
}

/**
 * Renders the "recorded rights position" markdown body (everything after the section header,
 * which the caller supplies) as an array of lines. `rightsPosition` may be `null` (a
 * `derived_synthesis` item has no rights_record of its own, DEF-R4) — the caller decides what
 * heading to print; this function only ever returns the body.
 */
export function renderRightsPositionSection(rightsPosition) {
  if (!rightsPosition) {
    return ["(this item carries no rights_record of its own; see each attributed input's own brief)"];
  }
  const lines = [];
  lines.push(`- source: ${rightsPosition.source_id} — ${rightsPosition.organization}`);
  const s = rightsPosition.source_level_summary;
  lines.push(
    `- source-recorded summary: rights_position_label=${s.rights_position_label}, `
    + `access_basis=${s.access_basis}, license_status=${s.license_status}, `
    + `commercial_use=${s.commercial_use}, redistribution=${s.redistribution}, `
    + `adaptation=${s.adaptation}, sublicensing=${s.sublicensing}, `
    + `noncommercial_only=${s.noncommercial_only}`,
  );
  if (rightsPosition.rights_records.length === 0) {
    lines.push('- joined rights/rights-records.json: (no ledger entry found — coverage gap)');
    return lines;
  }
  for (const record of rightsPosition.rights_records) {
    // Each status is rendered into its OWN single-field expression before being joined into the
    // final line, so no one line in this file's source ever names two distinct rights-authority
    // fields alongside a comparison/conditional operator (the D2 probe's line-level check).
    const statusPart = `overall_status=${record.overall_status ?? 'NOT_FOUND'}`;
    const reviewPart = `review_status=${record.review_status ?? 'NOT_FOUND'}`;
    lines.push(
      `- joined rights_record ${record.rights_record_id} (scope: ${record.record_scope ?? 'unknown'}): `
      + `${statusPart}, ${reviewPart}`,
    );
  }
  return lines;
}
