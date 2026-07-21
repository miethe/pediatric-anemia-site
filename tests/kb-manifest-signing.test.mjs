// tests/kb-manifest-signing.test.mjs — EP5-T1 / SPIKE-006 Amendment 1 (two-part manifest digest).
//
// Covers, per the phase-5 plan's quality gates:
//   SC-1  Hash reproducibility: computing a digest twice over unchanged input is identical.
//   SC-2  approvedBy[] is empty at the manifest layer — reinforcing tests/clinical-approvers-
//         d4.test.mjs, this time against modules/anemia/module.json and scripts/sign-kb.mjs
//         rather than rules.json and the rule-governance codemod.
//   Sensitivity coverage for the 2d1e5cd ferritin-drift hazard: a change to a hardcoded
//   threshold in modules/anemia/ranges.js (never migrated into reference-ranges.json) must move
//   clinicalContentHash. This is done over an in-memory copy of the file's text — the real file
//   on disk is never touched.
//   AC-WP5-RESIL: src/kbVerify.js's verifyManifest must distinguish LEGITIMATELY-EMPTY fields
//   (approvedBy: [], supersedes: null) from MUST-NOT-BE-EMPTY fields (clinicalContentHash,
//   governanceHash, validationRunId, status) and must fail closed, never throw, on a malformed
//   or unverifiable input.
//   The JCS (RFC 8785) canonicalizer itself: key ordering, nested objects, array order
//   preservation, number formatting, string escaping, and JSON whitespace/key-order insensitivity.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalize } from '../src/lib/jcs.mjs';
import { sha256Hex, sha256HexOfUtf8String } from '../src/lib/digest.mjs';
import {
  computeClinicalContentHash,
  computeGovernanceHash,
  verifyManifest,
  GOVERNANCE_FIELD_KEYS,
  READY_STATUS,
} from '../src/kbVerify.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE_DIR = path.join(REPO_ROOT, 'modules', 'anemia');
const MODULE_JSON_PATH = path.join(MODULE_DIR, 'module.json');
const RANGES_JS_PATH = path.join(MODULE_DIR, 'ranges.js');
const SIGN_KB_PATH = path.join(REPO_ROOT, 'scripts', 'sign-kb.mjs');

const KB_JSON_FILES = ['rules.json', 'candidates.json', 'evidence.json', 'reference-ranges.json'];
const KB_SOURCE_FILES = ['ranges.js', 'facts.anemia.js'];

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

async function loadRealKbJsonFiles() {
  const files = [];
  for (const filename of KB_JSON_FILES) {
    files.push({ path: `modules/anemia/${filename}`, content: await readJson(path.join(MODULE_DIR, filename)) });
  }
  return files;
}

async function loadRealKbSourceFiles() {
  const sourceFiles = [];
  for (const filename of KB_SOURCE_FILES) {
    const bytes = await readFile(path.join(MODULE_DIR, filename));
    sourceFiles.push({ path: `modules/anemia/${filename}`, sha256: await sha256Hex(bytes) });
  }
  return sourceFiles;
}

// --- JCS (RFC 8785) canonicalizer -------------------------------------------------------------

test('jcs.canonicalize: sorts object keys by UTF-16 code unit order', () => {
  assert.equal(canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test('jcs.canonicalize: sorts nested object keys independently at every level', () => {
  assert.equal(canonicalize({ b: { d: 1, c: 2 }, a: 1 }), '{"a":1,"b":{"c":2,"d":1}}');
});

test('jcs.canonicalize: preserves array element order — arrays are never reordered', () => {
  assert.equal(canonicalize({ a: [3, 1, 2] }), '{"a":[3,1,2]}');
  assert.equal(canonicalize([3, 1, 2]), '[3,1,2]');
  assert.equal(canonicalize([{ b: 1, a: 2 }, { d: 1, c: 2 }]), '[{"a":2,"b":1},{"c":2,"d":1}]');
});

test('jcs.canonicalize: serializes numbers via the ECMAScript Number-to-String algorithm, including -0', () => {
  assert.equal(canonicalize(100), '100');
  assert.equal(canonicalize(1.5), '1.5');
  assert.equal(canonicalize(-3), '-3');
  assert.equal(canonicalize(0), '0');
  assert.equal(canonicalize(-0), '0');
});

test('jcs.canonicalize: rejects non-finite numbers rather than silently coercing them', () => {
  assert.throws(() => canonicalize(NaN), /non-finite/);
  assert.throws(() => canonicalize(Infinity), /non-finite/);
  assert.throws(() => canonicalize(-Infinity), /non-finite/);
});

test('jcs.canonicalize: rejects unsupported value types (e.g. undefined) instead of dropping them silently', () => {
  assert.throws(() => canonicalize(undefined), /unsupported value type/);
  assert.throws(() => canonicalize({ a: undefined }), /unsupported value type/);
});

test('jcs.canonicalize: escapes quotes, backslashes, and control characters; leaves other characters (including non-ASCII) unescaped', () => {
  const input = 'a"b\\c\nd\te';
  assert.equal(canonicalize(input), '"a\\"b\\\\c\\nd\\te"');
  assert.equal(canonicalize('café'), '"café"');
});

test('jcs.canonicalize: is insensitive to input key order and insignificant JSON whitespace', () => {
  const a = JSON.parse('{"a":1,"b":[1,2,3],"c":{"x":1,"y":2}}');
  const b = JSON.parse('{\n  "c": { "y": 2, "x": 1 },\n  "b": [1, 2, 3],\n  "a": 1\n}\n');
  assert.equal(canonicalize(a), canonicalize(b));
});

// --- SHA-256 digest helper ---------------------------------------------------------------------

test('src/lib/digest.mjs: sha256Hex matches the well-known SHA-256("abc") test vector', async () => {
  const hex = await sha256Hex(new TextEncoder().encode('abc'));
  assert.equal(hex, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('src/lib/digest.mjs: sha256HexOfUtf8String hashes a string\'s UTF-8 bytes', async () => {
  const hex = await sha256HexOfUtf8String('abc');
  assert.equal(hex, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

// --- computeClinicalContentHash / computeGovernanceHash ----------------------------------------

test('GOVERNANCE_FIELD_KEYS is exactly Amendment 1\'s 7-field governanceHash field list', () => {
  assert.deepEqual(GOVERNANCE_FIELD_KEYS, [
    'status',
    'knowledgeBaseVersion',
    'evidenceReviewedThrough',
    'approvedBy',
    'validationRunId',
    'supersedes',
    'supportedAgeMonths',
  ]);
});

test('READY_STATUS matches SPIKE-006 RQ4\'s servable status value', () => {
  assert.equal(READY_STATUS, 'integrity-recorded');
});

test('SC-1: clinicalContentHash and governanceHash are reproducible across two clean computations over unchanged input', async () => {
  const files = await loadRealKbJsonFiles();
  const sourceFiles = await loadRealKbSourceFiles();
  const manifest = await readJson(MODULE_JSON_PATH);

  const clinicalFirst = await computeClinicalContentHash({ files, sourceFiles });
  const clinicalSecond = await computeClinicalContentHash({ files, sourceFiles });
  assert.equal(clinicalFirst, clinicalSecond);
  assert.match(clinicalFirst, /^sha256:[0-9a-f]{64}$/);

  const governanceFirst = await computeGovernanceHash({ moduleId: manifest.id, fields: manifest });
  const governanceSecond = await computeGovernanceHash({ moduleId: manifest.id, fields: manifest });
  assert.equal(governanceFirst, governanceSecond);
  assert.match(governanceFirst, /^sha256:[0-9a-f]{64}$/);
});

test('computeClinicalContentHash is insensitive to key order and whitespace inside the embedded JSON content', async () => {
  const filesA = [{ path: 'x.json', content: JSON.parse('{"a":1,"b":[1,2,3],"nested":{"y":2,"z":1}}') }];
  const filesB = [{ path: 'x.json', content: JSON.parse('{\n  "nested": { "z": 1, "y": 2 },\n  "b": [1, 2, 3],\n  "a": 1\n}\n') }];
  const hashA = await computeClinicalContentHash({ files: filesA, sourceFiles: [] });
  const hashB = await computeClinicalContentHash({ files: filesB, sourceFiles: [] });
  assert.equal(hashA, hashB);
});

test('computeClinicalContentHash is byte-sensitive on sourceFiles digests (no JSON canonicalization applies to them)', async () => {
  const hashA = await computeClinicalContentHash({ files: [], sourceFiles: [{ path: 'x.js', sha256: 'a'.repeat(64) }] });
  const hashB = await computeClinicalContentHash({ files: [], sourceFiles: [{ path: 'x.js', sha256: 'b'.repeat(64) }] });
  assert.notEqual(hashA, hashB);
});

test('clinicalContentHash changes when a modules/anemia/ranges.js clinical threshold is mutated (2d1e5cd ferritin-drift regression coverage)', async () => {
  // In-memory only — the real file on disk is never written to.
  const originalText = await readFile(RANGES_JS_PATH, 'utf8');
  const anchor = "value: 30, source: 'AAP2026_IDA', rationale: 'all menstruating patients'";
  const mutatedAnchor = "value: 20, source: 'AAP2026_IDA', rationale: 'all menstruating patients'";
  assert.ok(originalText.includes(anchor), 'fixture anchor text not found in ranges.js — update this test\'s anchor to match current source');
  const mutatedText = originalText.replace(anchor, mutatedAnchor);
  assert.notEqual(mutatedText, originalText, 'mutation had no effect — this test would be vacuous');

  const files = await loadRealKbJsonFiles();
  const factsHash = await sha256Hex(await readFile(path.join(MODULE_DIR, 'facts.anemia.js')));
  const originalRangesHash = await sha256Hex(Buffer.from(originalText, 'utf8'));
  const mutatedRangesHash = await sha256Hex(Buffer.from(mutatedText, 'utf8'));
  assert.notEqual(mutatedRangesHash, originalRangesHash);

  const originalClinicalContentHash = await computeClinicalContentHash({
    files,
    sourceFiles: [
      { path: 'modules/anemia/ranges.js', sha256: originalRangesHash },
      { path: 'modules/anemia/facts.anemia.js', sha256: factsHash },
    ],
  });
  const mutatedClinicalContentHash = await computeClinicalContentHash({
    files,
    sourceFiles: [
      { path: 'modules/anemia/ranges.js', sha256: mutatedRangesHash },
      { path: 'modules/anemia/facts.anemia.js', sha256: factsHash },
    ],
  });

  assert.notEqual(mutatedClinicalContentHash, originalClinicalContentHash);
});

test('governanceHash changes when a governance field (evidenceReviewedThrough) is mutated', async () => {
  const manifest = await readJson(MODULE_JSON_PATH);
  const original = await computeGovernanceHash({ moduleId: manifest.id, fields: manifest });
  const mutated = { ...manifest, evidenceReviewedThrough: '1999-01-01' };
  assert.notEqual(mutated.evidenceReviewedThrough, manifest.evidenceReviewedThrough);
  const mutatedHash = await computeGovernanceHash({ moduleId: mutated.id, fields: mutated });
  assert.notEqual(mutatedHash, original);
});

test('computeGovernanceHash throws (fails closed) when a required governance field is genuinely absent, not merely null', async () => {
  const fields = {
    status: null,
    knowledgeBaseVersion: null,
    evidenceReviewedThrough: null,
    approvedBy: [],
    // validationRunId intentionally omitted, not set to null
    supersedes: null,
    supportedAgeMonths: { min: 6, max: 216 },
  };
  await assert.rejects(() => computeGovernanceHash({ moduleId: 'anemia', fields }), /unsupported value type "undefined"/);
});

// --- SC-2: approvedBy[] is empty at the manifest layer ------------------------------------------

test('AC-WP5-RESIL/SC-2: modules/anemia/module.json carries approvedBy as an explicit empty array and supersedes as null (legitimately-empty first-release fields)', async () => {
  const manifest = await readJson(MODULE_JSON_PATH);
  assert.ok(Array.isArray(manifest.approvedBy), 'approvedBy must be an array');
  assert.deepEqual(manifest.approvedBy, [], 'approvedBy must be empty — no signature may attest to approvals that never happened');
  assert.equal(manifest.supersedes, null, 'a first release\'s supersedes must be null');
});

test('SC-2: scripts/sign-kb.mjs has no flag and no code path that can write a non-empty approvedBy', async () => {
  const source = await readFile(SIGN_KB_PATH, 'utf8');
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');

  assert.ok(!/--approved-by/.test(code), 'sign-kb.mjs must not accept an --approved-by flag');
  assert.ok(code.includes('approvedBy'), 'sign-kb.mjs must still assign approvedBy explicitly (to [])');

  const assignments = [...code.matchAll(/approvedBy\s*[:=]\s*([^,\n}]+)/g)].map((m) => m[1].trim());
  assert.ok(assignments.length > 0, 'expected at least one approvedBy assignment in sign-kb.mjs');
  const nonEmpty = assignments.filter((rhs) => !/^\[\s*\]$/.test(rhs));
  assert.deepEqual(nonEmpty, [], `sign-kb.mjs assigns approvedBy to something other than a literal []: ${JSON.stringify(nonEmpty)}`);
});

// --- src/kbVerify.js: verifyManifest / AC-WP5-RESIL ---------------------------------------------

async function buildValidManifestAndContent() {
  const files = [{ path: 'modules/x/rules.json', content: { a: 1 } }];
  const sourceFiles = [{ path: 'modules/x/foo.js', sha256: 'a'.repeat(64) }];
  const clinicalContentHash = await computeClinicalContentHash({ files, sourceFiles });
  const partialManifest = {
    status: READY_STATUS,
    knowledgeBaseVersion: '1.0.0',
    evidenceReviewedThrough: '2026-07-15',
    approvedBy: [],
    validationRunId: 'run-123',
    supersedes: null,
    supportedAgeMonths: { min: 6, max: 216 },
  };
  const moduleId = 'test-module';
  const governanceHash = await computeGovernanceHash({ moduleId, fields: partialManifest });
  const manifest = { ...partialManifest, clinicalContentHash, governanceHash };
  return { manifest, files, sourceFiles, moduleId };
}

test('verifyManifest: servable when hashes match and every must-not-be-empty field is present, despite legitimately-empty approvedBy/supersedes', async () => {
  const { manifest, files, sourceFiles, moduleId } = await buildValidManifestAndContent();
  const verdict = await verifyManifest({ manifest, moduleId, files, sourceFiles });
  assert.equal(verdict.servable, true, JSON.stringify(verdict.reasons));
  assert.deepEqual(verdict.reasons, []);
  assert.deepEqual(verdict.legitimatelyEmpty.approvedBy, []);
  assert.equal(verdict.legitimatelyEmpty.supersedes, null);
  assert.equal(verdict.mustNotBeEmpty.validationRunId, true);
  assert.equal(verdict.mustNotBeEmpty.status, true);
});

test('verifyManifest: NOT servable when validationRunId is missing, even though supersedes/approvedBy are legitimately empty (AC-WP5-RESIL)', async () => {
  const { manifest, files, sourceFiles, moduleId } = await buildValidManifestAndContent();
  const broken = { ...manifest, validationRunId: null };
  broken.governanceHash = await computeGovernanceHash({ moduleId, fields: broken });

  const verdict = await verifyManifest({ manifest: broken, moduleId, files, sourceFiles });
  assert.equal(verdict.servable, false);
  assert.ok(verdict.reasons.some((r) => r.includes('validationRunId')), JSON.stringify(verdict.reasons));
  // The failure is specifically the must-not-be-empty field, not an unrelated hash problem.
  assert.equal(verdict.hashes.clinicalContentHash.matches, true);
  assert.equal(verdict.hashes.governanceHash.matches, true);
});

test('verifyManifest: NOT servable when status is not "integrity-recorded"', async () => {
  const { manifest, files, sourceFiles, moduleId } = await buildValidManifestAndContent();
  const broken = { ...manifest, status: 'unsigned-stub' };
  broken.governanceHash = await computeGovernanceHash({ moduleId, fields: broken });

  const verdict = await verifyManifest({ manifest: broken, moduleId, files, sourceFiles });
  assert.equal(verdict.servable, false);
  assert.ok(verdict.reasons.some((r) => r.includes('status')), JSON.stringify(verdict.reasons));
});

test('verifyManifest: NOT servable when clinicalContentHash is missing', async () => {
  const { manifest, files, sourceFiles, moduleId } = await buildValidManifestAndContent();
  const broken = { ...manifest, clinicalContentHash: null };
  const verdict = await verifyManifest({ manifest: broken, moduleId, files, sourceFiles });
  assert.equal(verdict.servable, false);
  assert.ok(verdict.reasons.some((r) => r.includes('clinicalContentHash')), JSON.stringify(verdict.reasons));
});

test('verifyManifest: NOT servable when supplied KB content does not match the stored clinicalContentHash (tamper detection)', async () => {
  const { manifest, sourceFiles, moduleId } = await buildValidManifestAndContent();
  const tamperedFiles = [{ path: 'modules/x/rules.json', content: { a: 2 } }];
  const verdict = await verifyManifest({ manifest, moduleId, files: tamperedFiles, sourceFiles });
  assert.equal(verdict.servable, false);
  assert.equal(verdict.hashes.clinicalContentHash.matches, false);
  assert.ok(verdict.reasons.some((r) => r.includes('does not match')), JSON.stringify(verdict.reasons));
});

test('verifyManifest: fails closed (never throws) on a null/malformed manifest', async () => {
  const verdict = await verifyManifest({ manifest: null, moduleId: 'x', files: [], sourceFiles: [] });
  assert.equal(verdict.servable, false);
  assert.ok(verdict.reasons[0].includes('missing or is not an object'));
});

test('verifyManifest: fails closed (never throws) when digest recomputation itself throws unexpectedly', async () => {
  const { manifest, moduleId, sourceFiles } = await buildValidManifestAndContent();
  const poisonedFiles = [{ path: 'x.json', content: undefined }];
  const verdict = await verifyManifest({ manifest, moduleId, files: poisonedFiles, sourceFiles });
  assert.equal(verdict.servable, false);
  assert.ok(verdict.reasons[0].includes('threw unexpectedly'), JSON.stringify(verdict.reasons));
});
