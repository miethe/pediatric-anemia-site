// tests/release-manifest-schema.test.mjs — P5-T1 (evidence-foundry-buildout Phase 5, FR-18,
// `02 §4.18` minus the `signature` block).
//
// build/kb-pack/<moduleId>/<packVersion>/release-manifest.unsigned.json is a NEW,
// existence-gated-across-the-whole-tree artifact type (schemas/release-manifest.schema.json,
// wired into scripts/validate-kb.mjs). This test file follows the same three-layer proof pattern
// tests/evidence-assertions-schema.test.mjs (P3-T3) and tests/rule-schema-seeded-invalid.test.mjs
// (P1-T5) already established:
//
//   1. A committed, intentionally-invalid fixture
//      (tests/fixtures/invalid-release-manifest/SYNTHETIC-INVALID-MISSING-BUNDLESHA256-001.json.txt,
//      an otherwise schema-legal manifest missing `rfInputs[0].bundleSha256`) violates the schema
//      in exactly one way — R-P2 analog: the validator rejects the missing-field case, it does not
//      silently pass.
//   2. validateKbPackReleaseManifests(), run against a throwaway temp build/kb-pack/ tree seeded
//      with that fixture, reports that specific schema error — the actual function `npm run
//      validate`'s CLI entrypoint calls.
//   3. A real propose run against the committed tests/fixtures/rf-cbc-001 fixture emits a manifest
//      that validates cleanly, and a build/kb-pack/ directory that does not exist at all (a clean
//      checkout) validates just as cleanly — the existence-gate has no false positives in either
//      direction.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from '../scripts/lib/json-schema-lite.mjs';
import { validateReleaseManifest, validateKbPackReleaseManifests } from '../scripts/validate-kb.mjs';
import { run as runPropose } from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-manifest.schema.json');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');
// `.json.txt`, not `.json` — mirrors tests/fixtures/invalid-evidence-assertions/'s own naming
// rationale (tests/rule-schema-seeded-invalid.test.mjs's header comment).
const INVALID_MANIFEST_FIXTURE = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'invalid-release-manifest',
  'SYNTHETIC-INVALID-MISSING-BUNDLESHA256-001.json.txt',
);

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf8'));
}

async function withCapturedStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;
  try {
    return await fn();
  } finally {
    process.stdout.write = original;
  }
}

test('seeded-bad release-manifest fixture violates release-manifest.schema.json in exactly one way (missing rfInputs[0].bundleSha256)', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const badDoc = await loadJson(INVALID_MANIFEST_FIXTURE);

  assert.ok(!Object.hasOwn(badDoc.rfInputs[0], 'bundleSha256'), 'fixture must be missing bundleSha256 entirely');

  const errors = validate(schema, badDoc);
  assert.deepEqual(
    errors,
    [{ path: '$.rfInputs[0].bundleSha256', message: 'required property is missing' }],
    `expected exactly one missing-required-property violation, got: ${JSON.stringify(errors)}`,
  );
});

test('a real propose run against tests/fixtures/rf-cbc-001 emits a release-manifest.unsigned.json that validates cleanly', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-manifest-test-out-'));
  try {
    const schema = await loadJson(SCHEMA_PATH);
    await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR,
        module: REAL_MODULE_PATH,
        decisions: REAL_DECISIONS_PATH,
        out: outDir,
      }),
    );

    const manifestPath = path.join(outDir, 'release-manifest.unsigned.json');
    const manifest = await loadJson(manifestPath);

    assert.deepEqual(validate(schema, manifest), []);
    assert.equal(manifest.moduleId, 'cbc_suite_v1');
    assert.equal(manifest.packVersion, '0.1.0-proposal');
    assert.equal(manifest.rfInputs.length, 1);
    assert.equal(manifest.rfInputs[0].runId, 'rf_run_20260717_rf_cbc_001_pediatric_cds_establish');
    assert.match(manifest.rfInputs[0].bundleSha256, /^sha256:[0-9a-f]{64}$/);
    assert.match(manifest.rfInputs[0].claimLedgerSha256, /^sha256:[0-9a-f]{64}$/);
    assert.equal(manifest.rfInputs[0].verificationExitCode, 0);
    assert.deepEqual(manifest.converter, {
      name: 'rf-bundle-to-kb-pack',
      version: '0.1.0',
      configSha256: manifest.converter.configSha256,
    });
    assert.match(manifest.converter.configSha256, /^sha256:[0-9a-f]{64}$/);
    assert.match(manifest.testCorpusHash, /^sha256:[0-9a-f]{64}$/);
    assert.match(manifest.traceabilityHash, /^sha256:[0-9a-f]{64}$/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// --- validateKbPackReleaseManifests() existence-gate + cross-record checks ----------------------

test('validateKbPackReleaseManifests() reports zero results when build/kb-pack/ does not exist at all (clean checkout)', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-kbpack-missing-'));
  try {
    const results = await validateKbPackReleaseManifests(tempRoot);
    assert.deepEqual(results, []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validateKbPackReleaseManifests() reports zero errors when build/kb-pack/<module>/<version>/ exists but has no release-manifest.unsigned.json yet', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-kbpack-no-manifest-'));
  try {
    await mkdir(path.join(tempRoot, 'build', 'kb-pack', 'cbc_suite_v1', '0.1.0-proposal'), { recursive: true });
    const results = await validateKbPackReleaseManifests(tempRoot);
    assert.deepEqual(results, []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validateKbPackReleaseManifests() fails closed on a seeded-bad release-manifest.unsigned.json with a specific schema message', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-kbpack-seeded-bad-'));
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    await writeFile(
      path.join(tempRoot, 'schemas', 'release-manifest.schema.json'),
      await readFile(SCHEMA_PATH, 'utf8'),
    );
    const packDir = path.join(tempRoot, 'build', 'kb-pack', 'cbc_suite_v1', '0.1.0-proposal');
    await mkdir(packDir, { recursive: true });
    const badDoc = await loadJson(INVALID_MANIFEST_FIXTURE);
    await writeFile(path.join(packDir, 'release-manifest.unsigned.json'), JSON.stringify(badDoc, null, 2));

    const results = await validateKbPackReleaseManifests(tempRoot);
    assert.equal(results.length, 1);
    assert.ok(
      results[0].errors.some(
        (e) => e.includes('release-manifest.schema.json')
          && e.includes('$.rfInputs[0].bundleSha256')
          && e.includes('required property is missing'),
      ),
      `expected a specific release-manifest.schema.json missing-property error, got: ${JSON.stringify(results[0].errors, null, 2)}`,
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validateKbPackReleaseManifests() flags a moduleId/packVersion that disagrees with its own build/kb-pack/ directory', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-kbpack-mismatch-'));
  try {
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    await writeFile(
      path.join(tempRoot, 'schemas', 'release-manifest.schema.json'),
      await readFile(SCHEMA_PATH, 'utf8'),
    );
    const packDir = path.join(tempRoot, 'build', 'kb-pack', 'cbc_suite_v1', '0.1.0-proposal');
    await mkdir(packDir, { recursive: true });
    const doc = {
      schemaVersion: '1.0',
      moduleId: 'some_other_module',
      packVersion: '9.9.9-mismatch',
      rfInputs: [{
        runId: 'rf_run_test', bundleSha256: `sha256:${'a'.repeat(64)}`,
        claimLedgerSha256: `sha256:${'b'.repeat(64)}`, verificationExitCode: 0,
      }],
      converter: { name: 'rf-bundle-to-kb-pack', version: '0.1.0', configSha256: `sha256:${'c'.repeat(64)}` },
      testCorpusHash: `sha256:${'d'.repeat(64)}`,
      traceabilityHash: `sha256:${'e'.repeat(64)}`,
    };
    await writeFile(path.join(packDir, 'release-manifest.unsigned.json'), JSON.stringify(doc, null, 2));

    const results = await validateKbPackReleaseManifests(tempRoot);
    assert.equal(results.length, 1);
    assert.ok(results[0].errors.some((e) => e.includes('moduleId') && e.includes('some_other_module') && e.includes('cbc_suite_v1')));
    assert.ok(results[0].errors.some((e) => e.includes('packVersion') && e.includes('9.9.9-mismatch') && e.includes('0.1.0-proposal')));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

// --- validateReleaseManifest() cross-record invariants (pure-function unit tests, no disk) -------

const VALID_DOC = {
  schemaVersion: '1.0',
  moduleId: 'cbc_suite_v1',
  packVersion: '0.1.0-proposal',
  rfInputs: [
    {
      runId: 'rf_run_20260717_rf_cbc_001_pediatric_cds_establish',
      bundleSha256: `sha256:${'a'.repeat(64)}`,
      claimLedgerSha256: `sha256:${'b'.repeat(64)}`,
      verificationExitCode: 0,
    },
  ],
  converter: { name: 'rf-bundle-to-kb-pack', version: '0.1.0', configSha256: `sha256:${'c'.repeat(64)}` },
  testCorpusHash: `sha256:${'d'.repeat(64)}`,
  traceabilityHash: `sha256:${'e'.repeat(64)}`,
};

function cloneValidDoc() {
  return JSON.parse(JSON.stringify(VALID_DOC));
}

test('validateReleaseManifest() reports zero errors on a well-formed in-memory document', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const { errors } = validateReleaseManifest(cloneValidDoc(), schema, {
    expectedModuleId: 'cbc_suite_v1', expectedPackVersion: '0.1.0-proposal',
  });
  assert.deepEqual(errors, []);
});

test('validateReleaseManifest() flags a moduleId disagreeing with the expected (directory-derived) moduleId', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const { errors } = validateReleaseManifest(cloneValidDoc(), schema, {
    expectedModuleId: 'anemia', expectedPackVersion: '0.1.0-proposal',
  });
  assert.ok(errors.some((e) => e.includes('moduleId') && e.includes('cbc_suite_v1') && e.includes('anemia')));
});

test('validateReleaseManifest() flags a packVersion disagreeing with the expected (directory-derived) packVersion', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const { errors } = validateReleaseManifest(cloneValidDoc(), schema, {
    expectedModuleId: 'cbc_suite_v1', expectedPackVersion: '0.2.0-proposal',
  });
  assert.ok(errors.some((e) => e.includes('packVersion') && e.includes('0.1.0-proposal') && e.includes('0.2.0-proposal')));
});

test('validateReleaseManifest() rejects additionalProperties (e.g. a `signature` block — this manifest is unsigned)', async () => {
  const schema = await loadJson(SCHEMA_PATH);
  const doc = cloneValidDoc();
  doc.signature = { algorithm: 'ed25519', keyId: 'k1', value: 'x' };
  const { errors } = validateReleaseManifest(doc, schema);
  assert.ok(errors.some((e) => e.includes('$.signature') && e.includes('additional property is not permitted')));
});
