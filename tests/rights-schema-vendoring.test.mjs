// tests/rights-schema-vendoring.test.mjs — EPR0-T2 (FR-WP0-03).
//
// Proves the five spec schemas vendored into schemas/rights/ carry byte-traceable provenance:
//   - each vendored file's checksum, as recorded in schemas/rights/VENDORING.md, matches the
//     corresponding entry in the spec bundle's own checksums.sha256 (the file was copied faithfully
//     from the reviewed bundle, not retyped or re-derived).
//   - each vendored file's checksum, as recomputed from the file ON DISK right now, either matches
//     the recorded "Vendored checksum" (no divergence from the bundle) OR the file is named under
//     VENDORING.md's "Declared amendments" section (a later task, EPR0-T3, amends these files in
//     place and must declare every such edit there).
//   - a divergence between the live file and its recorded checksum that is NOT declared in
//     VENDORING.md is a failure — this is the "fails on any divergence not declared" acceptance
//     criterion. A synthetic fixture proves this directly, without depending on EPR0-T3 ever landing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sha256Hex } from '../src/lib/digest.mjs';

const REPO_ROOT = new URL('../', import.meta.url);
const BUNDLE_ROOT = 'docs/project_plans/research/research_foundry_rights_governance_spec_v1.0';

const VENDORED_FILES = [
  'schemas/rights/rights_record.schema.json',
  'schemas/rights/content_reuse_assessment.schema.json',
  'schemas/rights/permission_record.schema.json',
  'schemas/rights/rights_failure.schema.json',
  'schemas/rights/rights_extension.schema.json',
];

const readRepoFile = (relPath) => readFile(new URL(relPath, REPO_ROOT), 'utf8');
const readRepoBytes = (relPath) => readFile(new URL(relPath, REPO_ROOT));

/**
 * Parses `docs/.../checksums.sha256` (standard `<hex>  <bundle-relative-path>` lines, path prefixed
 * with `./`) into a Map keyed by the bundle-relative path with the `./` prefix stripped.
 */
function parseChecksumsFile(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([0-9a-f]{64})\s+\.\/(.+)$/);
    if (!match) continue;
    map.set(match[2], match[1]);
  }
  return map;
}

/**
 * Parses schemas/rights/VENDORING.md's "Vendored files" table into an array of
 * { vendoredFile, sourcePath, recordedChecksum }, matched by markdown-table row shape.
 */
function parseVendoringTable(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const match = line.match(
      /^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([0-9a-f]{64})`\s*\|$/,
    );
    if (match) {
      rows.push({ vendoredFile: match[1], sourcePath: match[2], recordedChecksum: match[3] });
    }
  }
  return rows;
}

/** True if `vendoredFile` is named anywhere in VENDORING.md's "Declared amendments" section. */
function isDeclaredInAmendmentsSection(vendoringText, vendoredFile) {
  const marker = '## Declared amendments';
  const startIdx = vendoringText.indexOf(marker);
  if (startIdx === -1) return false;
  const nextHeadingIdx = vendoringText.indexOf('\n## ', startIdx + marker.length);
  const section = nextHeadingIdx === -1 ? vendoringText.slice(startIdx) : vendoringText.slice(startIdx, nextHeadingIdx);
  return section.includes(vendoredFile);
}

// --- setup: read once, shared by every test below -------------------------------------------------

let checksumsMap;
let vendoringText;
let vendoringRows;

test.before(async () => {
  checksumsMap = parseChecksumsFile(await readRepoFile(`${BUNDLE_ROOT}/checksums.sha256`));
  vendoringText = await readRepoFile('schemas/rights/VENDORING.md');
  vendoringRows = parseVendoringTable(vendoringText);
});

// --- all five files are vendored and the table names all five ---------------------------------------

test('schemas/rights/VENDORING.md table lists exactly the 5 vendored schema files', () => {
  const tableFiles = vendoringRows.map((row) => row.vendoredFile).sort();
  assert.deepEqual(tableFiles, [...VENDORED_FILES].sort());
});

for (const vendoredFile of VENDORED_FILES) {
  test(`${vendoredFile} exists in the repo`, async () => {
    const bytes = await readRepoBytes(vendoredFile);
    assert.ok(bytes.length > 0);
  });

  test(`${vendoredFile} parses as JSON`, async () => {
    const text = await readRepoFile(vendoredFile);
    assert.doesNotThrow(() => JSON.parse(text));
  });
}

// --- provenance: the recorded checksum in VENDORING.md matches the bundle's checksums.sha256 -------

for (const vendoredFile of VENDORED_FILES) {
  test(`VENDORING.md recorded checksum for ${vendoredFile} matches the spec bundle's checksums.sha256`, () => {
    const row = vendoringRows.find((r) => r.vendoredFile === vendoredFile);
    assert.ok(row, `expected a VENDORING.md table row for ${vendoredFile}`);
    const bundleChecksum = checksumsMap.get(row.sourcePath);
    assert.ok(
      bundleChecksum,
      `expected checksums.sha256 to have an entry for bundle-relative path "${row.sourcePath}"`,
    );
    assert.equal(
      row.recordedChecksum,
      bundleChecksum,
      `VENDORING.md's recorded checksum for ${vendoredFile} must match checksums.sha256's entry for ${row.sourcePath} at the moment of vendoring`,
    );
  });
}

// --- live divergence check: on-disk file either matches its recorded checksum, or is declared ------

for (const vendoredFile of VENDORED_FILES) {
  test(`${vendoredFile}: live checksum matches VENDORING.md, or the divergence is declared`, async () => {
    const row = vendoringRows.find((r) => r.vendoredFile === vendoredFile);
    assert.ok(row, `expected a VENDORING.md table row for ${vendoredFile}`);
    const liveChecksum = await sha256Hex(await readRepoBytes(vendoredFile));
    if (liveChecksum === row.recordedChecksum) {
      // No divergence from the bundle at all — nothing to declare. This is the EPR0-T2 baseline
      // state (before EPR0-T3 applies any amendment) and must pass.
      return;
    }
    assert.ok(
      isDeclaredInAmendmentsSection(vendoringText, vendoredFile),
      `${vendoredFile}'s live checksum (${liveChecksum}) diverges from its recorded VENDORING.md ` +
        `checksum (${row.recordedChecksum}) but is not named under "## Declared amendments" — every ` +
        'divergence from the vendored bundle must be an annotated, declared amendment, never a silent edit',
    );
  });
}

// --- fixture: an undeclared divergence fails ---------------------------------------------------------
//
// Proves the detection logic itself catches a silent edit, using a synthetic scratch copy of
// VENDORING.md so the assertion does not depend on EPR0-T3 ever landing (or on this task's own
// baseline state, which currently has zero divergence).

test('fixture: an undeclared checksum divergence is detected as undeclared', async () => {
  const scratchDir = await mkdtemp(path.join(tmpdir(), 'rights-vendoring-fixture-'));
  try {
    const undeclaredVendoringText = [
      '# fixture VENDORING.md',
      '',
      '## Vendored files',
      '',
      '| Vendored file | Source path (spec bundle) | Vendored checksum (sha256) |',
      '|---|---|---|',
      `| \`schemas/rights/rights_record.schema.json\` | \`schemas/rights_record.schema.json\` | \`${'0'.repeat(64)}\` |`,
      '',
      '## Declared amendments',
      '',
      '_(nothing declared)_',
      '',
    ].join('\n');
    const scratchPath = path.join(scratchDir, 'VENDORING.md');
    await writeFile(scratchPath, undeclaredVendoringText, 'utf8');

    const fixtureText = await readFile(scratchPath, 'utf8');
    const fixtureRows = parseVendoringTable(fixtureText);
    const row = fixtureRows.find((r) => r.vendoredFile === 'schemas/rights/rights_record.schema.json');
    assert.ok(row);

    // The real on-disk file's live checksum will never equal the all-zero placeholder above, so
    // this reproduces "a divergence exists" without mutating the real vendored file.
    const liveChecksum = await sha256Hex(await readRepoBytes('schemas/rights/rights_record.schema.json'));
    assert.notEqual(liveChecksum, row.recordedChecksum, 'fixture setup: the placeholder checksum must differ from the real live checksum');
    assert.equal(
      isDeclaredInAmendmentsSection(fixtureText, 'schemas/rights/rights_record.schema.json'),
      false,
      'fixture VENDORING.md declares no amendments, so the divergence must be detected as undeclared',
    );
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
});

// --- control: a divergence named in "Declared amendments" is recognized as declared -----------------

test('control: a divergence named under "## Declared amendments" is recognized as declared', () => {
  const declaredVendoringText = [
    '## Vendored files',
    '',
    '## Declared amendments',
    '',
    '- 2026-08-01 — `schemas/rights/rights_record.schema.json`: example declared amendment for this control test.',
    '',
  ].join('\n');
  assert.equal(
    isDeclaredInAmendmentsSection(declaredVendoringText, 'schemas/rights/rights_record.schema.json'),
    true,
    'a filename mentioned under "## Declared amendments" must be recognized as declared, or the ' +
      'negative fixture above proves nothing',
  );
});
