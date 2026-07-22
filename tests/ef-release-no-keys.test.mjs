// tests/ef-release-no-keys.test.mjs — evidence-foundry-e1 P3-T5 (FR-15/FR-16, R3/SPIKE-006
// reconciliation).
//
// Task acceptance criteria (.claude/progress/evidence-foundry-e1/phase-3-progress.md, row P3-T5):
//   (a) scans the repo tree for private-key material patterns (PEM/OpenSSH/PKCS8 headers, raw
//       Ed25519 seed files) and fails on any hit outside an explicit empty allowlist.
//   (b) asserts no automated check/script/CLI default reads a signing key from repo or env.
//   (c) proves a populated signature on a real (non-dry-run) candidate fails npm run validate.
//   (d) proves a TESTKEY- keyId in a real registry entry is rejected (release-path test-key leak).
//
// R3/SPIKE-006 reconciliation: this repo has TWO structurally distinct "signing" concepts, and
// this suite proves neither one (nor anything else committed here) can ever produce or consume a
// real private key:
//   - `tools/release-sign` (P3-T1..T4, ADR-0005) — real Ed25519 detached signatures. `sign` is
//     designed for human OFFLINE execution at gate G2 (ruling R3); `verify` is the sole
//     CI/agent-reachable surface; no automated check in this repo ever exercises `sign` outside
//     `--dry-run` (an ephemeral, in-memory, never-persisted keypair, OQ-6).
//   - `scripts/sign-kb.mjs` (SPIKE-006 Amendment 1, EP5-T1, the pre-existing anemia-module
//     two-part content-integrity digest: `clinicalContentHash`/`governanceHash`) — no key material
//     of ANY kind, ever; it is a SHA-256 content hash, not a cryptographic signature, and never
//     reads a private key from anywhere. Confirmed by inspection and re-asserted here (group b)
//     so a future reader never conflates the two "signing" words.
//
// This file's own 4 assertion groups are each individually named and load-bearing (Known Gotchas,
// phase-3-progress.md) — none is boilerplate.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runManifest } from '../tools/release-sign/lib/manifest.mjs';
import { run as runSign } from '../tools/release-sign/lib/sign.mjs';
import { run as runRegister } from '../tools/release-sign/lib/registry.mjs';
import { UsageError } from '../tools/release-sign/lib/errors.mjs';
import {
  validateReleaseRegistryDocument,
  loadAndValidateReleaseRegistry,
} from '../scripts/validate-kb.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');
const RELEASE_SIGN_ROOT = path.join(REPO_ROOT, 'tools', 'release-sign');
const REGISTRY_SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'release-registry.schema.json');

// Deliberately built via concatenation, not a single string literal: group (a) below scans the
// raw text of every git-tracked file (including this one) for a contiguous PEM private-key
// header sequence, and a literal fixture string matching that pattern would trip this file's
// own scan. Splitting the leading "-----BEGIN" token from the rest preserves the exact runtime
// value at test time — still deliberately PEM-shaped-looking garbage, never a real key — while
// ensuring the source text itself never contains the header as one contiguous substring.
const BOGUS_PEM_BLOCK = '-----BEGIN' + ' PRIVATE KEY-----\nbogus\n-----END PRIVATE KEY-----\n';

// Bogus env-var candidates a signing tool might, in a badly-designed world, silently fall back to.
// None of these are ever read by anything in this repo (group b proves it) — the values are
// deliberately PEM-shaped-looking garbage, never a real key, so even a test failure here could
// never leak real key material.
const BOGUS_KEY_ENV = {
  SIGNING_KEY: BOGUS_PEM_BLOCK,
  PRIVATE_KEY: BOGUS_PEM_BLOCK,
  ED25519_PRIVATE_KEY: 'bogus-ed25519-seed',
  RELEASE_SIGN_KEY: '/tmp/does-not-exist-release-sign-key.pem',
  RELEASE_SIGNING_KEY_PATH: '/tmp/does-not-exist-release-sign-key.pem',
};

async function withCapturedStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  let output = '';
  process.stdout.write = (chunk) => {
    output += chunk;
    return true;
  };
  try {
    const result = await fn();
    return { result, output };
  } finally {
    process.stdout.write = original;
  }
}

async function buildFreshPack() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-no-keys-pack-'));
  await withCapturedStdout(() =>
    runManifest({
      runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir,
    }),
  );
  return outDir;
}

async function collectReleaseSignSourceFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectReleaseSignSourceFiles(full)));
    } else if (entry.isFile() && (entry.name.endsWith('.mjs') || entry.name.endsWith('.md'))) {
      files.push(full);
    }
  }
  return files;
}

// =================================================================================================
// Group (a) — repo-tree scan for private-key material (PEM/OpenSSH/PKCS8 headers, raw key-seed
// filenames), fail-closed outside an explicit, EMPTY allowlist.
// =================================================================================================

/**
 * Matches the standard PEM header for every private-key encoding `node:crypto` (and OpenSSL) can
 * produce: unencrypted PKCS8 (`BEGIN PRIVATE KEY`), legacy PKCS1/SEC1 (`BEGIN RSA/EC/DSA PRIVATE
 * KEY`), encrypted PKCS8 (`BEGIN ENCRYPTED PRIVATE KEY`), and OpenSSH's own format (`BEGIN OPENSSH
 * PRIVATE KEY`). Deliberately does NOT match `BEGIN PUBLIC KEY` (non-secret, and this tool's own
 * `signerPublicKey` fixtures legitimately carry one — see `tools/release-sign/README.md`).
 */
const PRIVATE_KEY_HEADER_PATTERN = /-----BEGIN (?:RSA |DSA |EC |ENCRYPTED |OPENSSH )?PRIVATE KEY-----/;

/**
 * Filename-shaped heuristic for a raw (non-PEM) key/seed file — the OpenSSH default identity
 * filenames, and any `*.pem`/`*.key`/`*private*key*`/`*<curve>*seed*` naming convention. A raw
 * Ed25519 seed is 32 opaque bytes with no textual header of its own (unlike a PEM file), so content
 * alone cannot reliably identify one — this repo's own convention (confirmed empty today, see the
 * allowlist test below) is that no tracked file uses any such name at all.
 */
const PRIVATE_KEY_FILENAME_PATTERN = /(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)$|\.pem$|\.key$|(^|[-_./])private[-_.]?key|(^|[-_./])(ed25519|ecdsa|rsa)[-_.]?(seed|priv)/i;

/**
 * The explicit allowlist this scan checks hits against — paths (relative to REPO_ROOT) permitted to
 * carry private-key-shaped material. MUST stay empty in E1: there is no legitimate reason for real
 * (or even fixture) key material to live in this tree before gate G2's offline signing ceremony
 * (docs/governance/signing-ceremony-runbook.md) — `sign --dry-run`'s ephemeral keypair is never
 * persisted (P3-T2), and real-mode `sign` reads its key from a path OUTSIDE the repo by structural
 * guard. Extending this array is a deliberate, reviewed act, never a silent exemption — mirrors
 * `GoldenDriftError`'s fixture-update discipline (tools/release-sign/lib/errors.mjs).
 */
const PRIVATE_KEY_ALLOWLIST = Object.freeze([]);

async function listGitTrackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

test('P3-T5 (a) [1/2]: the private-key-material allowlist is empty — a non-empty allowlist would itself be the leak this suite exists to catch', () => {
  assert.deepEqual(
    PRIVATE_KEY_ALLOWLIST,
    [],
    'E1 has no legitimate reason to carry key material anywhere in this repo tree; extending this ' +
      'array requires its own deliberate, reviewed commit, never a quiet exemption for a real hit.',
  );
});

test('P3-T5 (a) [2/2]: no git-tracked file in this repo carries a PEM/OpenSSH/PKCS8 private-key header or a raw-key-seed-shaped filename, outside the (empty) allowlist', async () => {
  const files = await listGitTrackedFiles();
  assert.ok(files.length > 100, 'sanity: git ls-files must return the real repo tree, not an empty/broken result');

  const hits = [];
  for (const relPath of files) {
    if (PRIVATE_KEY_ALLOWLIST.includes(relPath)) continue;

    if (PRIVATE_KEY_FILENAME_PATTERN.test(relPath)) {
      hits.push(`${relPath}: filename matches a private-key/seed naming convention`);
      continue;
    }

    let buf;
    try {
      buf = await readFile(path.join(REPO_ROOT, relPath));
    } catch (err) {
      // A tracked path that no longer exists in the working tree (an uncommitted `rm`, never
      // staged) has nothing to scan — not a hit, and not a reason to fail this suite.
      if (err.code === 'ENOENT') continue;
      throw err;
    }
    // latin1 (not utf8): preserves every byte 1:1 as a code point, so this regex matches an ASCII
    // PEM header embedded in an otherwise-binary file exactly as reliably as in a text file, with
    // no decode-replacement-character risk and no dependency on the file actually being valid UTF-8.
    if (PRIVATE_KEY_HEADER_PATTERN.test(buf.toString('latin1'))) {
      hits.push(`${relPath}: content matches a PEM/OpenSSH/PKCS8 private-key header`);
    }
  }

  assert.deepEqual(
    hits,
    [],
    `private-key material found outside the (empty) allowlist:\n${hits.join('\n')}`,
  );
});

// =================================================================================================
// Group (b) — no automated check/script/CLI default ever reads a signing key from repo or env.
// =================================================================================================

test('P3-T5 (b) [1/6]: no file under tools/release-sign/ references process.env at all', async () => {
  const files = await collectReleaseSignSourceFiles(RELEASE_SIGN_ROOT);
  assert.ok(files.length > 0, 'sanity: the release-sign source+doc tree must not be empty');
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.ok(
      !/process\.env/.test(source),
      `${path.relative(REPO_ROOT, file)} references process.env — sign/verify/register/manifest must ` +
        'never source a signing key (or anything else) from the environment; --key/--key-id are the ' +
        'only inputs real-mode sign accepts, both explicit CLI flags with no default.',
    );
  }
});

test('P3-T5 (b) [2/6]: no npm script in package.json (npm test / validate / check / smoke / ...) ever invokes tools/release-sign at all', async () => {
  const pkg = JSON.parse(await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const scripts = pkg.scripts ?? {};
  assert.ok(Object.keys(scripts).length > 0, 'sanity: package.json must declare scripts');
  for (const [name, command] of Object.entries(scripts)) {
    assert.ok(
      !command.includes('release-sign'),
      `npm script "${name}" (${JSON.stringify(command)}) references tools/release-sign — no ` +
        'automated npm script may ever shell out to this tool (sign is human-offline-only, ruling R3).',
    );
  }
});

test('P3-T5 (b) [3/6]: no committed GitHub Actions workflow ever invokes tools/release-sign / a real (non-dry-run) sign', async () => {
  const workflowsDir = path.join(REPO_ROOT, '.github', 'workflows');
  let entries;
  try {
    entries = await readdir(workflowsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return; // no workflows directory at all — trivially nothing to check
    throw err;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const content = await readFile(path.join(workflowsDir, entry.name), 'utf8');
    assert.ok(
      !/release-sign/.test(content),
      `.github/workflows/${entry.name} references release-sign — CI can never sign (ruling R3); ` +
        'verify is this tool\'s sole CI-reachable surface.',
    );
  }
});

test('P3-T5 (b) [4/6]: real (non-dry-run) sign — invoked in-process with common signing-key env vars populated — still requires an explicit --key, never silently reads one from the environment', async (t) => {
  const originalEnv = {};
  for (const key of Object.keys(BOGUS_KEY_ENV)) {
    originalEnv[key] = process.env[key];
    process.env[key] = BOGUS_KEY_ENV[key];
  }
  t.after(() => {
    for (const key of Object.keys(BOGUS_KEY_ENV)) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  const packDir = await buildFreshPack();
  try {
    // No --key supplied at all (real mode: dryRun absent). If sign ever fell back to ANY of the
    // bogus env vars above, this would either throw a DIFFERENT error (a PEM-parse failure on the
    // garbage value) or, worse, silently "succeed" — neither may happen; the one and only legal
    // outcome is the same missing-`--key` UsageError sign already raises with a clean environment.
    await assert.rejects(
      () => runSign({ candidate: packDir, keyId: 'p3t5-env-leak-probe' }),
      (err) => {
        assert.ok(err instanceof UsageError, `expected UsageError, got ${err?.constructor?.name}: ${err?.message}`);
        assert.match(err.message, /--key\b/, 'the error must name the missing --key flag, not a PEM-parse failure on an env fallback');
        return true;
      },
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('P3-T5 (b) [5/6]: --dry-run sign — invoked with the same bogus signing-key env vars populated — is byte-for-byte unaffected (ephemeral keypair only, never env-sourced)', async (t) => {
  const originalEnv = {};
  for (const key of Object.keys(BOGUS_KEY_ENV)) {
    originalEnv[key] = process.env[key];
    process.env[key] = BOGUS_KEY_ENV[key];
  }
  t.after(() => {
    for (const key of Object.keys(BOGUS_KEY_ENV)) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  const packDir = await buildFreshPack();
  try {
    const { result } = await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true, keyId: 'p3t5-env-leak-probe' }),
    );
    assert.equal(result.dryRun, true);
    assert.match(result.signature.keyId, /^TESTKEY-/, 'keyId must still be TESTKEY--forced regardless of env contents');
    // None of the bogus env values (nor any substring of them) leak into the reporting object.
    const serialized = JSON.stringify(result);
    for (const bogusValue of Object.values(BOGUS_KEY_ENV)) {
      assert.ok(!serialized.includes(bogusValue), 'a bogus env value leaked into sign\'s own reporting object');
    }
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('P3-T5 (b) [6/6]: the real CLI process — `sign` invoked with no --key/--dry-run, bogus signing-key env vars in its environment — exits EXIT_USAGE (1), never silently signs', async () => {
  const packDir = await buildFreshPack();
  try {
    const result = spawnSync(
      process.execPath,
      [path.join(RELEASE_SIGN_ROOT, 'cli.mjs'), 'sign', '--candidate', packDir, '--key-id', 'p3t5-cli-env-leak-probe'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, ...BOGUS_KEY_ENV },
      },
    );
    assert.equal(result.status, 1, `expected EXIT_USAGE (1); got ${result.status}. stderr: ${result.stderr}`);
    assert.match(result.stderr, /--key\b/);
    assert.equal(result.stdout, '', 'a rejected sign invocation must produce zero stdout — no partial/leaked output');
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// Group (c) — a populated signature on a real (non-dry-run) candidate fails `npm run validate`.
// =================================================================================================

// A unique moduleId/packVersion, distinct from every module `npm test`'s other suites stage under
// build/kb-pack/ (cbc_suite_v1/0.1.0-proposal in particular) — this test writes into the REAL
// repo's gitignored build/kb-pack/ tree (P1-T7: existence-gated, ephemeral, never committed) and
// must never race a sibling test file's own concurrent writes there.
const PROBE_MODULE_ID = 'ef_p3t5_no_keys_probe';
const PROBE_PACK_VERSION = '0.0.0-p3t5-probe';

test('P3-T5 (c): a populated signature on a real (non-dry-run) release-manifest.unsigned.json — written into the real repo\'s build/kb-pack/ tree — fails `node scripts/validate-kb.mjs`, the exact script `npm run validate` invokes first', async () => {
  const probeDir = path.join(REPO_ROOT, 'build', 'kb-pack', PROBE_MODULE_ID, PROBE_PACK_VERSION);
  await (await import('node:fs/promises')).mkdir(probeDir, { recursive: true });

  // Schema-legal in every field except: no `dryRun` marker, and a populated `signature` — exactly
  // the "real candidate carrying a signature" shape `schemas/release-manifest.schema.json`'s own
  // allOf/if/then/else forces to `signature: null` on every branch except dryRun:true (P1-T5).
  const realCandidateWithSignature = {
    schemaVersion: '1.0',
    moduleId: PROBE_MODULE_ID,
    packVersion: PROBE_PACK_VERSION,
    rfInputs: [{
      runId: 'rf_run_p3t5_probe',
      bundleSha256: `sha256:${'a'.repeat(64)}`,
      claimLedgerSha256: `sha256:${'b'.repeat(64)}`,
      verificationExitCode: 0,
    }],
    converter: { name: 'rf-bundle-to-kb-pack', version: '0.1.0', configSha256: `sha256:${'c'.repeat(64)}` },
    testCorpusHash: `sha256:${'d'.repeat(64)}`,
    traceabilityHash: `sha256:${'e'.repeat(64)}`,
    // No `dryRun` key at all — the honest "real candidate" shape (P3-T2's sign.mjs never sets
    // dryRun:true onto a real signature; this fixture simulates the release-path leak directly).
    signature: { algorithm: 'ed25519', keyId: 'REALKEY-p3t5-probe-not-a-test-key', value: 'not-a-real-signature' },
  };

  try {
    await writeFile(
      path.join(probeDir, 'release-manifest.unsigned.json'),
      `${JSON.stringify(realCandidateWithSignature, null, 2)}\n`,
      'utf8',
    );

    const result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'validate-kb.mjs')], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0, `expected a non-zero exit from validate-kb.mjs; got 0. stdout: ${result.stdout}`);
    assert.match(
      result.stderr,
      new RegExp(`${PROBE_MODULE_ID}.*release-manifest\\.unsigned\\.json|release-manifest\\.unsigned\\.json.*signature`, 's'),
    );
    assert.match(result.stderr, /signature/);
    assert.match(result.stderr, /null/i);
  } finally {
    // Remove only this probe's own moduleId subtree — never the shared build/kb-pack/ root other
    // test files (and other parallel P3/P4 tasks in this worktree) may be concurrently using.
    await rm(path.join(REPO_ROOT, 'build', 'kb-pack', PROBE_MODULE_ID), { recursive: true, force: true });
  }
});

test('P3-T5 (c) regression guard: the same probe directory, absent, leaves `node scripts/validate-kb.mjs` exiting 0 against the real repo tree (proves the failure above was CAUSED by the seeded signature, not environmental)', async () => {
  // Sanity companion to the test above: run the SAME real CLI entrypoint against the real repo
  // tree with no probe fixture present at all (the ordinary, already-clean state every other test
  // file in this repo also relies on — tests/ef-contract-forced-empty.test.mjs's own equivalent
  // assertion) — must exit 0.
  const result = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'validate-kb.mjs')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `expected a clean exit against the real repo tree with no probe fixture present; got ${result.status}. stderr: ${result.stderr}`);
});

// =================================================================================================
// Group (d) — a TESTKEY- keyId in a real registry entry is rejected (release-path test-key leak).
// =================================================================================================

test('P3-T5 (d) [1/3]: a hand-spliced registry entry carrying a REAL dry-run-signed (TESTKEY-) signature is rejected by validateReleaseRegistryDocument — the registry can never bear ANY signature, test-key or otherwise', async () => {
  const packDir = await buildFreshPack();
  try {
    const { result: signed } = await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true, keyId: 'p3t5-registry-leak-probe' }),
    );
    assert.match(signed.signature.keyId, /^TESTKEY-/, 'sanity: this is a genuine dry-run TESTKEY- signature, not a fixture stand-in');

    // Simulates the exact release-path leak FR-15/FR-16 guard against: some future/buggy code path
    // that spliced a genuinely-produced TESTKEY- signature straight into a registry entry, bypassing
    // `register`'s own forced-null (tools/release-sign/lib/registry.mjs — OQ-4, "the appended
    // entry's own signature is always null"). This never happens via `register` itself (proven
    // below, [3/3]) — this test proves the SCHEMA layer would reject it even if it did.
    const leakedRegistry = {
      schemaVersion: 1,
      entries: [{
        version: signed.manifest.packVersion,
        moduleId: signed.manifest.moduleId,
        packDigest: `sha256:${'1'.repeat(64)}`,
        manifestDigest: signed.preimageSha256,
        signature: signed.signature, // { algorithm: 'ed25519', keyId: 'TESTKEY-...', value: <real sig> }
        signedAt: null,
        supersedes: null,
        withdrawalState: 'none',
        withdrawnAt: null,
        withdrawalReason: null,
      }],
    };

    const registrySchema = JSON.parse(await readFile(REGISTRY_SCHEMA_PATH, 'utf8'));
    const { errors } = validateReleaseRegistryDocument(leakedRegistry, registrySchema);
    assert.ok(errors.length > 0, 'a populated (even genuinely-signed, TESTKEY-marked) signature in a registry entry must be rejected');
    assert.ok(
      errors.some((e) => e.includes('entries[0].signature') && /null/i.test(e)),
      `expected a signature-forced-null violation at entries[0].signature, got: ${JSON.stringify(errors, null, 2)}`,
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test('P3-T5 (d) [2/3]: the same TESTKEY--signature-leaked registry, written into a synthetic root — loadAndValidateReleaseRegistry() (the exact function npm run validate calls) fails closed too', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'ef-no-keys-registry-leak-'));
  try {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(path.join(tempRoot, 'schemas'), { recursive: true });
    const registrySchemaRaw = await readFile(REGISTRY_SCHEMA_PATH, 'utf8');
    await writeFile(path.join(tempRoot, 'schemas', 'release-registry.schema.json'), registrySchemaRaw, 'utf8');
    await mkdir(path.join(tempRoot, 'releases'), { recursive: true });

    const leakedRegistry = {
      schemaVersion: 1,
      entries: [{
        version: '1.0.0',
        moduleId: 'cbc_suite_v1',
        packDigest: `sha256:${'1'.repeat(64)}`,
        manifestDigest: `sha256:${'2'.repeat(64)}`,
        signature: { algorithm: 'ed25519', keyId: 'TESTKEY-p3t5-synthetic-leak-probe', value: 'ZmFrZQ==' },
        signedAt: null,
        supersedes: null,
        withdrawalState: 'none',
        withdrawnAt: null,
        withdrawalReason: null,
      }],
    };
    await writeFile(path.join(tempRoot, 'releases', 'registry.json'), `${JSON.stringify(leakedRegistry, null, 2)}\n`, 'utf8');

    const result = await loadAndValidateReleaseRegistry(tempRoot);
    assert.equal(result.present, true);
    assert.ok(result.errors.length > 0, 'loadAndValidateReleaseRegistry must fail closed on a TESTKEY--signed entry');
    assert.ok(result.errors.some((e) => /signature/.test(e) && /null/i.test(e)));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('P3-T5 (d) [3/3]: `register` itself, given a genuine dry-run TESTKEY- signed candidate, NEVER persists the signature — the real (non-schema-bypassing) release path already closes this leak at the source', async () => {
  const packDir = await buildFreshPack();
  const workDir = await mkdtemp(path.join(os.tmpdir(), 'ef-no-keys-register-'));
  try {
    const candidatePath = path.join(workDir, 'candidate.json');
    await withCapturedStdout(() =>
      runSign({ candidate: packDir, dryRun: true, keyId: 'p3t5-register-no-leak-probe', outCandidate: candidatePath }),
    );

    const registryPath = path.join(workDir, 'registry.json');
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: 1, entries: [] }, null, 2)}\n`, 'utf8');

    const { result } = await withCapturedStdout(() =>
      runRegister({ candidate: candidatePath, registry: registryPath }),
    );

    assert.equal(result.entry.signature, null, 'register\'s own persisted entry must carry signature: null even for a genuinely TESTKEY--signed dry-run candidate');
    const onDisk = JSON.parse(await readFile(registryPath, 'utf8'));
    assert.equal(onDisk.entries[0].signature, null);
    assert.ok(
      !JSON.stringify(onDisk).includes('TESTKEY-'),
      'the persisted registry document must carry no trace of the TESTKEY- marker anywhere',
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(workDir, { recursive: true, force: true });
  }
});
