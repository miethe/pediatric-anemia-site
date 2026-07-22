#!/usr/bin/env node
// build-evidence-pack.mjs — EP-3, D-EP3-5. CI-safe.
//
// Reads ONLY the vendored `evidence-packs/rf-ev-001/pack.json` and writes the `passages[]` arrays
// into `modules/anemia/evidence.json`. Never reaches into the operator's live RF run directory;
// that is scripts/evidence/vendor-rf-bundle.mjs's job. Determinism guarantee (AC EP3-T2) is what
// makes this script safe to run in `npm run validate` — see the --check mode below.
//
// Emits exactly one `<SOURCE_ID>#implementation-proposal` sentinel per source (D-EP3-3), in
// addition to the source-supported records converted from the pack.
//
// This step is purely additive against `modules/anemia/evidence.json`: it never touches the
// existing `supports[]` prose arrays or any other pre-existing source field. It exists to add
// (or refresh) the `passages[]` array on each source record.
//
// EPR3-T5 (FR-WP3-01..06): each passage now also carries six evidence-item taxonomy fields
// (`evidence_item_type`, `judgment_basis`, `judgment_basis_attestation`, `rights_component_class`,
// `structured_locator`, `not_captured`). These are AUTHORED content — a per-passage epistemic and
// provenance judgment (which item kind, which rights component, the component-addressable locator,
// and what was deliberately not stored) that is NOT mechanically derivable from the vendored pack.
// So this generator PRESERVES them from the existing `modules/anemia/evidence.json` record of the
// same passage id and re-emits them verbatim — exactly as `buildEvidenceDocument` already preserves
// the authored source-level `license`/`access_basis`/`terms`/`terms_snapshot` fields (EPR2-T1..T4),
// which are likewise not in the pack. The six mechanical-vs-authored halves stay separable: the 14
// pack-derived fields are still regenerated from `pack.json` on every run (so `--check` still proves
// their determinism), and the six taxonomy fields are carried through unchanged (there is nothing to
// re-derive; a byte diff on them would be an out-of-band hand-edit, which is exactly what a reviewer
// wants to see). A source with no prior passage of a given id carries no authored taxonomy, so the
// EP-3-era record shape is emitted unchanged for it — the mid-migration/legacy tolerance
// tests/evidence-rights-resilience.test.mjs pins.
//
// EPR3-T6/T8: two further authored, OPTIONAL passage keys are preserved the same way — `numeric_recapture`
// (on numeric-omission passages) and `guideline_recommendation_capture` (on guideline_recommendation
// passages, the fact of the recommendation). Neither is pack-derivable; both are carried through
// verbatim from the committed record, so a byte diff on either under `--check` is an out-of-band edit.
//
// EP3-T5: this script also reads evidence-packs/rf-ev-001/fidelity-findings.json (an independent
// cross-family audit, mechanically applied — see that file's header comment) and stamps every
// minted passage record with `reviewFlags`/`reviewFindingIds`. Both are `[]` on a clean record.
// A passage named under the `near-verbatim-span-pending-rights` flag (EP3T5-F01) gets
// `passageFidelity: "withheld"` instead of `"paraphrase"` — its `exactPassage` is already the
// fixed placeholder by the time it reaches this script, because vendor-rf-bundle.mjs withheld the
// restricted text before writing pack.json. No other flag changes what text is emitted; every
// other flag only blocks downstream binding (src/evidence.js#isBindableAsSourceSupported).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// EPR2-T6 (R-P2 resilience, FR-WP2-07): reused from src/evidence.js rather than re-implemented —
// no second evidence store (DEF-1). This script never touches `license`/`terms` itself (see
// buildEvidenceDocument below, which passes every non-`passages` source key through unchanged), so
// it already tolerates a legacy-shape source missing those fields entirely; sourceRightsPosition is
// imported here so that fact is asserted directly (countUnassessedRightsPositions) rather than left
// implicit, and so the generation log surfaces it to a reviewer scanning the diff.
import { sourceRightsPosition, RIGHTS_POSITION_UNASSESSED } from '../../src/evidence.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACK_PATH = path.join(REPO_ROOT, 'evidence-packs', 'rf-ev-001', 'pack.json');
const EVIDENCE_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'evidence.json');
const FIDELITY_FINDINGS_PATH = path.join(REPO_ROOT, 'evidence-packs', 'rf-ev-001', 'fidelity-findings.json');
const WITHHOLDING_FLAG = 'near-verbatim-span-pending-rights';

// The order every passage record's keys must be emitted in. `id` first because it is a natural
// pivot for a reviewer scanning a diff; `provenance` last because it is metadata about *how* the
// record got here, not what it says. This ordering has to be explicit, not an artefact of the
// order of `Object.assign` calls elsewhere in the file, so a subtle refactor cannot change the
// output.
// EPR3-T5: the six authored taxonomy fields sit immediately after `passageFidelity` and before
// `reviewFlags`, matching schemas/evidence.schema.json's own `$defs/passage` property-declaration
// order, so the emitted key order and the schema read the same way top-to-bottom. `provenance`
// stays last (it is metadata about how the record got here, not what it says).
const PASSAGE_KEY_ORDER = [
  'id',
  'sourceId',
  'status',
  'sourceLocator',
  'exactPassage',
  'passageFidelity',
  'evidence_item_type',
  'judgment_basis',
  'judgment_basis_attestation',
  'rights_component_class',
  'structured_locator',
  'not_captured',
  'numeric_recapture',
  'guideline_recommendation_capture',
  'reviewFlags',
  'reviewFindingIds',
  'evidenceGrade',
  'applicability',
  'reviewDate',
  'supersedes',
  'surveillanceQuery',
  'provenance',
];

// EPR3-T5: the six authored taxonomy keys, in their emitted order. Listed as a plain key array (no
// conditional, no cross-field comparison) so tests/rights-axis-separation.test.mjs's line-level D2
// probe reads it as an ordering constant, never as one axis being derived from another. These keys
// are OPTIONAL in `orderPassageKeys` below: a legacy/absent source record that never carried them
// emits the EP-3-era shape, while a backfilled record carries all six.
const TAXONOMY_KEY_ORDER = [
  'evidence_item_type',
  'judgment_basis',
  'judgment_basis_attestation',
  'rights_component_class',
  'structured_locator',
  'not_captured',
];
// EPR3-T6 (FR-WP3-05): `numeric_recapture` is a SEVENTH authored, optional passage key — present
// only on the handful of passages the EP3-T5 fidelity audit found dropped source numerics (plus the
// audit-named AAP2026_IDA#ev_002). Like the six taxonomy fields it is authored content this
// generator cannot re-derive from the pack, so it is carried through verbatim from the committed
// record (numericRecaptureOverlayFor below) and re-emitted between `not_captured` and `reviewFlags`,
// exactly at its schemas/evidence.schema.json property-declaration position. It is OPTIONAL: a
// passage with no numeric omission carries none, and the EP-3-era shape is unaffected.
// EPR3-T8 (FR-WP3-08): `guideline_recommendation_capture` is an EIGHTH authored, optional passage
// key — present only on passages whose evidence_item_type is guideline_recommendation, where it
// carries the fact of the recommendation (named issuing body, independently-worded restatement,
// scope). Like the taxonomy fields and numeric_recapture it is authored content this generator
// cannot re-derive from the pack, so it is carried through verbatim from the committed record
// (guidelineRecommendationCaptureOverlayFor below) and re-emitted between numeric_recapture and
// reviewFlags, exactly at its schemas/evidence.schema.json property-declaration position.
const OPTIONAL_PASSAGE_KEYS = new Set([...TAXONOMY_KEY_ORDER, 'numeric_recapture', 'guideline_recommendation_capture']);

const SOURCE_LOCATOR_KEY_ORDER = ['raw', 'page', 'section', 'table', 'figure'];
const APPLICABILITY_KEY_ORDER = ['age', 'sex', 'assay'];
const PROVENANCE_KEY_ORDER = ['runId', 'sourceCardId', 'evidenceId'];

function orderKeys(obj, order) {
  const ordered = {};
  for (const key of order) {
    if (!Object.hasOwn(obj, key)) throw new Error(`missing required key "${key}" in object: ${JSON.stringify(obj)}`);
    ordered[key] = obj[key];
  }
  // Reject any surplus keys, so a change in the emitted shape must go through this file.
  const extras = Object.keys(obj).filter((k) => !order.includes(k));
  if (extras.length) throw new Error(`unexpected keys in object: ${extras.join(', ')}`);
  return ordered;
}

// EPR3-T5. A passage-specific variant of `orderKeys`: the 14 mechanical (pack-derived) keys are
// still each REQUIRED, but the six taxonomy keys in `OPTIONAL_PASSAGE_KEYS` are included only when
// the record actually carries them. That is what lets one function emit both a backfilled record
// (all 20 keys) and an EP-3-era/legacy record with no authored taxonomy (14 keys) — the
// mid-migration shape tests/evidence-rights-resilience.test.mjs pins. Surplus keys are still
// rejected, so a shape change still has to go through this file.
function orderPassageKeys(obj) {
  const ordered = {};
  for (const key of PASSAGE_KEY_ORDER) {
    if (Object.hasOwn(obj, key)) {
      ordered[key] = obj[key];
    } else if (!OPTIONAL_PASSAGE_KEYS.has(key)) {
      throw new Error(`missing required key "${key}" in passage: ${JSON.stringify(obj)}`);
    }
  }
  const extras = Object.keys(obj).filter((k) => !PASSAGE_KEY_ORDER.includes(k));
  if (extras.length) throw new Error(`unexpected keys in passage: ${extras.join(', ')}`);
  return ordered;
}

// EPR3-T5. Reads the six authored taxonomy fields off the existing passage record (keyed by id) so
// they can be carried through the regeneration unchanged. Returns `{}` when there is no existing
// record, or when the existing record predates the taxonomy entirely (the EP-3/legacy shape) — in
// both cases the emitted record keeps the 14-field EP-3 shape. A record that carries SOME but not
// all six is a fail-closed error: the six are backfilled atomically by EPR3-T5, so a partial set
// signals a corrupted or half-applied edit, not a legitimate state. Reads the six values by
// variable key (never by axis-field literal) so it names no evidence-item axis in executable code.
function taxonomyOverlayFor(existingPassage) {
  if (!existingPassage) return {};
  const present = TAXONOMY_KEY_ORDER.filter((key) => Object.hasOwn(existingPassage, key));
  if (present.length === 0) return {};
  if (present.length !== TAXONOMY_KEY_ORDER.length) {
    throw new Error(
      `passage "${existingPassage.id}" carries a partial evidence-item taxonomy (${present.join(', ')}) — `
      + 'the six taxonomy fields are authored and backfilled atomically (EPR3-T5); a partial set is a defect',
    );
  }
  const overlay = {};
  for (const key of TAXONOMY_KEY_ORDER) overlay[key] = existingPassage[key];
  return overlay;
}

// EPR3-T6 (FR-WP3-05). Reads the authored `numeric_recapture` field off the existing passage record
// (keyed by id) so it can be carried through the regeneration unchanged — the same preserve-authored-
// content pattern as `taxonomyOverlayFor`. Returns `{}` when the record does not carry it (the common
// case: only numeric-omission passages do), so spreading the result is a no-op for every other record.
// The generator authors nothing here; a byte diff on `numeric_recapture` under `--check` is therefore
// always an out-of-band hand-edit, which is exactly what a reviewer wants to see.
function numericRecaptureOverlayFor(existingPassage) {
  if (!existingPassage || !Object.hasOwn(existingPassage, 'numeric_recapture')) return {};
  return { numeric_recapture: existingPassage.numeric_recapture };
}

// EPR3-T8 (FR-WP3-08). Reads the authored `guideline_recommendation_capture` field off the existing
// passage record (keyed by id) so it can be carried through the regeneration unchanged — the same
// preserve-authored-content pattern as `numericRecaptureOverlayFor`. Returns `{}` when the record
// does not carry it (every non-guideline_recommendation passage), so spreading the result is a no-op
// there. The generator authors nothing here; a byte diff on `guideline_recommendation_capture` under
// `--check` is therefore always an out-of-band hand-edit, exactly what a reviewer wants to see.
function guidelineRecommendationCaptureOverlayFor(existingPassage) {
  if (!existingPassage || !Object.hasOwn(existingPassage, 'guideline_recommendation_capture')) return {};
  return { guideline_recommendation_capture: existingPassage.guideline_recommendation_capture };
}

// Explicit codepoint comparator (EP3T5-F11): `String.prototype.localeCompare` is locale-dependent
// — its result can vary across environments/ICU data even for plain ASCII strings — so it cannot
// back a determinism guarantee (AC EP3-T2). `<`/`>` on strings compares UTF-16 code units, which
// is fixed and environment-independent for the ASCII ids this file sorts.
function compareCodepoints(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// EP3-T5: index evidence-packs/rf-ev-001/fidelity-findings.json by passage id so
// buildPassageRecords can look up, per passage, the exact flags/finding-ids the audit named.
// Sorted with compareCodepoints (not Set iteration order) so the emitted arrays are deterministic
// regardless of the findings file's own ordering.
function buildFidelityIndex(fidelityFindings) {
  const flagsByPassageId = new Map();
  const findingIdsByPassageId = new Map();
  for (const finding of fidelityFindings.findings ?? []) {
    for (const passageId of finding.passageIds ?? []) {
      if (!flagsByPassageId.has(passageId)) flagsByPassageId.set(passageId, new Set());
      flagsByPassageId.get(passageId).add(finding.flag);
      if (!findingIdsByPassageId.has(passageId)) findingIdsByPassageId.set(passageId, new Set());
      findingIdsByPassageId.get(passageId).add(finding.id);
    }
  }
  const toSortedArray = (set) => [...(set ?? [])].sort(compareCodepoints);
  return {
    flagsFor: (passageId) => toSortedArray(flagsByPassageId.get(passageId)),
    findingIdsFor: (passageId) => toSortedArray(findingIdsByPassageId.get(passageId)),
  };
}

// `existingPassagesById` (EPR3-T5) maps passage id -> the currently-committed passage record, so the
// authored taxonomy on each can be carried through the regeneration (see `taxonomyOverlayFor`).
// Defaults to an empty Map so pre-EPR3-T5 callers (and the legacy-shape resilience tests) that pass
// only three arguments keep the exact EP-3 behaviour — every emitted record simply carries no
// taxonomy overlay.
export function buildPassageRecords(packSource, pack, fidelityIndex, existingPassagesById = new Map()) {
  const records = [];
  // Source-supported records — one per extracted point marked source_supported_fact in the pack.
  // Order: by RF evidence_id ascending, which for this bundle is ev_001..ev_00N in file order.
  const sorted = packSource.passages.slice().sort((a, b) => compareCodepoints(a.evidenceId, b.evidenceId));
  for (const passage of sorted) {
    if (passage.status !== 'source-supported' && passage.status !== 'implementation-proposal') {
      throw new Error(`unexpected pack passage status "${passage.status}" on ${packSource.kbSourceId}#${passage.evidenceId}`);
    }
    const passageId = `${packSource.kbSourceId}#${passage.evidenceId}`;
    const reviewFlags = fidelityIndex.flagsFor(passageId);
    const reviewFindingIds = fidelityIndex.findingIdsFor(passageId);
    // EP3-T5 (EP3T5-F01): vendor-rf-bundle.mjs already replaced `summary` with the withhold
    // placeholder for these passages before writing pack.json — this script only has to record
    // that fact in passageFidelity, never author or move any text itself.
    const passageFidelity = reviewFlags.includes(WITHHOLDING_FLAG) ? 'withheld' : 'paraphrase';
    // Reviewer-gate fix-2: a passage the pack marks `source-supported` but the independent
    // EP3-T5 audit flagged is a defective source claim, not a clean one — `status` is downgraded
    // to `quarantined` here, at generation time, so the committed evidence.json and this script's
    // own --check regeneration can never drift apart. A minted `implementation-proposal` sentinel
    // never carries flags (see the loop appending it below), so it is untouched by this rule.
    const status = passage.status === 'source-supported' && reviewFlags.length > 0 ? 'quarantined' : passage.status;
    records.push(orderPassageKeys({
      id: passageId,
      sourceId: packSource.kbSourceId,
      status,
      sourceLocator: orderKeys(passage.sourceLocator, SOURCE_LOCATOR_KEY_ORDER),
      // D-EP3-4: exactPassage is the paraphrase from RF's `summary`, never `quote`. This build
      // script depends on the vendor step having already stripped `quote`; the passageFidelity
      // field records the current reality (REG-002 has not cleared verbatim reuse).
      exactPassage: passage.summary,
      passageFidelity,
      // EPR3-T5: authored taxonomy carried through verbatim from the committed record (or nothing,
      // for a legacy source that never had it). `orderPassageKeys` slots these six between
      // passageFidelity and reviewFlags.
      ...taxonomyOverlayFor(existingPassagesById.get(passageId)),
      // EPR3-T6: the authored numeric_recapture resolution, carried through verbatim when present
      // (only numeric-omission passages carry it); `orderPassageKeys` slots it after not_captured.
      ...numericRecaptureOverlayFor(existingPassagesById.get(passageId)),
      // EPR3-T8: the authored guideline_recommendation_capture, carried through verbatim when present
      // (only guideline_recommendation passages carry it); slotted after numeric_recapture.
      ...guidelineRecommendationCaptureOverlayFor(existingPassagesById.get(passageId)),
      reviewFlags,
      reviewFindingIds,
      evidenceGrade: passage.evidenceGrade,
      applicability: orderKeys(passage.applicability, APPLICABILITY_KEY_ORDER),
      reviewDate: pack.reviewDate,
      supersedes: passage.supersedes,
      surveillanceQuery: packSource.surveillanceQuery,
      provenance: orderKeys({
        runId: pack.runId,
        sourceCardId: packSource.sourceCardId,
        evidenceId: passage.evidenceId,
      }, PROVENANCE_KEY_ORDER),
    }));
  }

  // Exactly one implementation-proposal sentinel per source (D-EP3-3). Appended after the
  // source-supported records so a reviewer sees "here's what we located, here's the fallback."
  // The sentinel is not a located passage, so it never carries a fidelity-audit flag.
  const sentinelId = `${packSource.kbSourceId}#implementation-proposal`;
  records.push(orderPassageKeys({
    id: sentinelId,
    sourceId: packSource.kbSourceId,
    status: 'implementation-proposal',
    sourceLocator: orderKeys({
      raw: 'Implementation-proposal sentinel: no located passage. This record exists so that a rule whose threshold is not mechanically traceable to a located passage in this source still resolves to something explicit rather than to nothing.',
      page: null,
      section: null,
      table: null,
      figure: null,
    }, SOURCE_LOCATOR_KEY_ORDER),
    exactPassage: '',
    passageFidelity: 'paraphrase',
    // EPR3-T5: the sentinel captured nothing from a source, so its authored taxonomy (when present)
    // is the structurally-legal placeholder shape — bibliographic_metadata axes, a source-only
    // structured_locator, and an empty not_captured (the sentinel exemption in the schema).
    ...taxonomyOverlayFor(existingPassagesById.get(sentinelId)),
    reviewFlags: [],
    reviewFindingIds: [],
    evidenceGrade: null,
    applicability: orderKeys({ age: null, sex: null, assay: null }, APPLICABILITY_KEY_ORDER),
    reviewDate: pack.reviewDate,
    supersedes: null,
    surveillanceQuery: packSource.surveillanceQuery,
    provenance: orderKeys({
      runId: pack.runId,
      sourceCardId: packSource.sourceCardId,
      evidenceId: 'implementation-proposal',
    }, PROVENANCE_KEY_ORDER),
  }));

  return records;
}

export function buildEvidenceDocument(existingDoc, pack, fidelityIndex) {
  // Index the pack by kbSourceId so we can attach passages to each existing source without
  // reordering the sources[] array (that ordering is set by the evidence file itself, not by us).
  const packByKb = new Map(pack.sources.map((s) => [s.kbSourceId, s]));

  const nextSources = existingDoc.sources.map((source) => {
    const packSource = packByKb.get(source.id);
    if (!packSource) {
      throw new Error(`no pack entry for existing evidence source "${source.id}"`);
    }
    // EPR3-T5: index this source's currently-committed passages by id so buildPassageRecords can
    // carry each record's authored taxonomy through. A legacy source with no `passages` yields an
    // empty map, and every regenerated record then keeps its EP-3 (no-taxonomy) shape.
    const existingPassagesById = new Map((source.passages ?? []).map((existing) => [existing.id, existing]));
    const passages = buildPassageRecords(packSource, pack, fidelityIndex, existingPassagesById);
    // Preserve every existing property; only add or replace `passages`. This is intentionally
    // additive so we do not clobber the `supports[]` prose or per-source metadata. EPR2-T6
    // (R-P2 resilience): this loop never reads or requires `license`/`access_basis`/`terms`/
    // `terms_snapshot` — a legacy-shape `source` missing any (or all) of them passes through
    // exactly as it arrived, so this function cannot throw on their absence.
    const next = {};
    for (const key of Object.keys(source)) {
      if (key === 'passages') continue;
      next[key] = source[key];
    }
    next.passages = passages;
    return next;
  });

  // Reject sources that appear in the pack but not in the existing evidence doc — every KB id
  // in the pack must correspond to a shipped source record.
  const existingIds = new Set(existingDoc.sources.map((s) => s.id));
  for (const kbId of packByKb.keys()) {
    if (!existingIds.has(kbId)) {
      throw new Error(`pack references KB source "${kbId}" not present in ${path.relative(REPO_ROOT, EVIDENCE_PATH)}`);
    }
  }

  return {
    ...existingDoc,
    sources: nextSources,
  };
}

/**
 * EPR2-T6 (R-P2 resilience, FR-WP2-07): counts sources whose rights position is unassessed —
 * either genuinely absent (legacy-shape source) or explicitly `license.status: "unknown"` — via
 * the shared src/evidence.js#sourceRightsPosition accessor (DEF-1, single source of truth). Pure
 * and side-effect-free; never throws on a `doc.sources` entry missing `license` entirely, which is
 * exactly the mid-migration shape this task exists to tolerate. Used by main() below to surface the
 * count in the generation log, not to block generation — this script is D7 coverage-shaped only,
 * never a clearance gate.
 */
export function countUnassessedRightsPositions(doc) {
  return (doc.sources ?? []).filter((source) => sourceRightsPosition(source) === RIGHTS_POSITION_UNASSESSED).length;
}

function serialize(doc) {
  // JSON.stringify preserves the key insertion order set by buildEvidenceDocument, LF newlines
  // are the default for template literals, and a trailing newline matches the file's current
  // convention. This is the only serialisation path in the file; --check reuses it so that a
  // format-only diff always shows up as no diff.
  return JSON.stringify(doc, null, 2) + '\n';
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function firstDiffLines(a, b, contextLines = 3, maxHunks = 5) {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const diffs = [];
  const max = Math.max(aLines.length, bLines.length);
  let i = 0;
  while (i < max && diffs.length < maxHunks) {
    if (aLines[i] === bLines[i]) { i++; continue; }
    // Walk to the end of the run of differing lines.
    let j = i;
    while (j < max && aLines[j] !== bLines[j]) j++;
    const start = Math.max(0, i - contextLines);
    const end = Math.min(max, j + contextLines);
    const chunk = [];
    for (let k = start; k < end; k++) {
      const a1 = aLines[k];
      const b1 = bLines[k];
      if (a1 === b1) chunk.push(`  ${k + 1}: ${a1 ?? ''}`);
      else {
        if (a1 !== undefined) chunk.push(`- ${k + 1}: ${a1}`);
        if (b1 !== undefined) chunk.push(`+ ${k + 1}: ${b1}`);
      }
    }
    diffs.push(chunk.join('\n'));
    i = j;
  }
  return diffs.join('\n---\n');
}

function parseArgs(argv) {
  const out = { check: false };
  for (const arg of argv) {
    if (arg === '--check') out.check = true;
    else if (arg === '--write') out.check = false;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

async function main() {
  const { check } = parseArgs(process.argv.slice(2));
  const pack = await loadJson(PACK_PATH);
  const existing = await loadJson(EVIDENCE_PATH);
  const fidelityFindings = await loadJson(FIDELITY_FINDINGS_PATH);
  const fidelityIndex = buildFidelityIndex(fidelityFindings);
  const nextDoc = buildEvidenceDocument(existing, pack, fidelityIndex);
  const nextSerialised = serialize(nextDoc);

  const unassessedCount = countUnassessedRightsPositions(nextDoc);

  if (check) {
    const current = await readFile(EVIDENCE_PATH, 'utf8');
    if (current === nextSerialised) {
      const totalPassages = nextDoc.sources.reduce((n, s) => n + s.passages.length, 0);
      console.log(`build-evidence-pack --check: ${path.relative(REPO_ROOT, EVIDENCE_PATH)} matches regenerated output (${nextDoc.sources.length} sources, ${totalPassages} passages, ${unassessedCount} with rights position unassessed).`);
      return;
    }
    const diff = firstDiffLines(current, nextSerialised);
    console.error(`build-evidence-pack --check: ${path.relative(REPO_ROOT, EVIDENCE_PATH)} differs from regenerated output.`);
    console.error(diff ? `First differing hunks:\n${diff}` : '(no line-level diff produced; check byte lengths)');
    process.exit(1);
  }

  await writeFile(EVIDENCE_PATH, nextSerialised, 'utf8');
  const totalPassages = nextDoc.sources.reduce((n, s) => n + s.passages.length, 0);
  console.log(`Wrote ${path.relative(REPO_ROOT, EVIDENCE_PATH)}: ${nextDoc.sources.length} sources, ${totalPassages} passages, ${unassessedCount} with rights position unassessed.`);
}

// EPR2-T6 (R-P2 resilience): guarded the same way scripts/validate-kb.mjs is — importing this
// module for its exported pure functions (buildEvidenceDocument, buildPassageRecords,
// countUnassessedRightsPositions; tests/evidence-rights-resilience.test.mjs does exactly this)
// must not also run the CLI and overwrite modules/anemia/evidence.json as a side effect of import.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(`build-evidence-pack: ${error.stack ?? error.message}`);
    process.exit(1);
  });
}
