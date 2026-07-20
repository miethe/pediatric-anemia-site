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

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACK_PATH = path.join(REPO_ROOT, 'evidence-packs', 'rf-ev-001', 'pack.json');
const EVIDENCE_PATH = path.join(REPO_ROOT, 'modules', 'anemia', 'evidence.json');

// The order every passage record's keys must be emitted in. `id` first because it is a natural
// pivot for a reviewer scanning a diff; `provenance` last because it is metadata about *how* the
// record got here, not what it says. This ordering has to be explicit, not an artefact of the
// order of `Object.assign` calls elsewhere in the file, so a subtle refactor cannot change the
// output.
const PASSAGE_KEY_ORDER = [
  'id',
  'sourceId',
  'status',
  'sourceLocator',
  'exactPassage',
  'passageFidelity',
  'evidenceGrade',
  'applicability',
  'reviewDate',
  'supersedes',
  'surveillanceQuery',
  'provenance',
];

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

function buildPassageRecords(packSource, pack) {
  const records = [];
  // Source-supported records — one per extracted point marked source_supported_fact in the pack.
  // Order: by RF evidence_id ascending, which for this bundle is ev_001..ev_00N in file order.
  const sorted = packSource.passages.slice().sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  for (const passage of sorted) {
    if (passage.status !== 'source-supported' && passage.status !== 'implementation-proposal') {
      throw new Error(`unexpected pack passage status "${passage.status}" on ${packSource.kbSourceId}#${passage.evidenceId}`);
    }
    records.push(orderKeys({
      id: `${packSource.kbSourceId}#${passage.evidenceId}`,
      sourceId: packSource.kbSourceId,
      status: passage.status,
      sourceLocator: orderKeys(passage.sourceLocator, SOURCE_LOCATOR_KEY_ORDER),
      // D-EP3-4: exactPassage is the paraphrase from RF's `summary`, never `quote`. This build
      // script depends on the vendor step having already stripped `quote`; the passageFidelity
      // field records the current reality (REG-002 has not cleared verbatim reuse).
      exactPassage: passage.summary,
      passageFidelity: 'paraphrase',
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
    }, PASSAGE_KEY_ORDER));
  }

  // Exactly one implementation-proposal sentinel per source (D-EP3-3). Appended after the
  // source-supported records so a reviewer sees "here's what we located, here's the fallback."
  records.push(orderKeys({
    id: `${packSource.kbSourceId}#implementation-proposal`,
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
  }, PASSAGE_KEY_ORDER));

  return records;
}

function buildEvidenceDocument(existingDoc, pack) {
  // Index the pack by kbSourceId so we can attach passages to each existing source without
  // reordering the sources[] array (that ordering is set by the evidence file itself, not by us).
  const packByKb = new Map(pack.sources.map((s) => [s.kbSourceId, s]));

  const nextSources = existingDoc.sources.map((source) => {
    const packSource = packByKb.get(source.id);
    if (!packSource) {
      throw new Error(`no pack entry for existing evidence source "${source.id}"`);
    }
    const passages = buildPassageRecords(packSource, pack);
    // Preserve every existing property; only add or replace `passages`. This is intentionally
    // additive so we do not clobber the `supports[]` prose or per-source metadata.
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
  const nextDoc = buildEvidenceDocument(existing, pack);
  const nextSerialised = serialize(nextDoc);

  if (check) {
    const current = await readFile(EVIDENCE_PATH, 'utf8');
    if (current === nextSerialised) {
      const totalPassages = nextDoc.sources.reduce((n, s) => n + s.passages.length, 0);
      console.log(`build-evidence-pack --check: ${path.relative(REPO_ROOT, EVIDENCE_PATH)} matches regenerated output (${nextDoc.sources.length} sources, ${totalPassages} passages).`);
      return;
    }
    const diff = firstDiffLines(current, nextSerialised);
    console.error(`build-evidence-pack --check: ${path.relative(REPO_ROOT, EVIDENCE_PATH)} differs from regenerated output.`);
    console.error(diff ? `First differing hunks:\n${diff}` : '(no line-level diff produced; check byte lengths)');
    process.exit(1);
  }

  await writeFile(EVIDENCE_PATH, nextSerialised, 'utf8');
  const totalPassages = nextDoc.sources.reduce((n, s) => n + s.passages.length, 0);
  console.log(`Wrote ${path.relative(REPO_ROOT, EVIDENCE_PATH)}: ${nextDoc.sources.length} sources, ${totalPassages} passages.`);
}

main().catch((error) => {
  console.error(`build-evidence-pack: ${error.stack ?? error.message}`);
  process.exit(1);
});
