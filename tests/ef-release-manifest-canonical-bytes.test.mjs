// tests/ef-release-manifest-canonical-bytes.test.mjs — P3-T1 (evidence-foundry-e1, Phase 3 —
// Signed Release Machinery), FR-12, decisions block Risk 6.
//
// Task acceptance criteria (docs/project_plans/implementation_plans/infrastructure/
// evidence-foundry-e1-v1/phase-2-4-workstreams.md, row P3-T1):
//   1. `--help` lists all 4 verbs (manifest | register | sign | verify).
//   2. Byte-identity test green: the `manifest` verb's signing preimage === E0's canonical bytes
//      for the same pack, SHA-256 equal.
//   3. Golden-drift test fails closed on a seeded one-byte change — never silently re-baselined.
//   4. Zero non-`node:crypto` crypto imports anywhere under tools/release-sign/ (grep-test).
//   5. Zero network/generative-model calls, ever (structural grep-test + a live interception test).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as runManifest } from '../tools/release-sign/lib/manifest.mjs';
import { run as runRegister } from '../tools/release-sign/lib/registry.mjs';
import { run as runSign } from '../tools/release-sign/lib/sign.mjs';
import { run as runVerify } from '../tools/release-sign/lib/verify.mjs';
import {
  readCanonicalManifestBytes,
  sha256Hex,
  assertGoldenBytesMatch,
  RELEASE_MANIFEST_FILENAME,
} from '../tools/release-sign/lib/canonical-bytes.mjs';
import { GoldenDriftError, NotImplementedError, UsageError } from '../tools/release-sign/lib/errors.mjs';
import { main as cliMain, dispatchVerb } from '../tools/release-sign/cli.mjs';
import { run as runPropose } from '../tools/rf-bundle-to-kb-pack/lib/verbs/propose.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'rf-cbc-001');
const REAL_MODULE_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'module.json');
const REAL_DECISIONS_PATH = path.join(REPO_ROOT, 'modules', 'cbc_suite_v1', 'authoring-decisions.yaml');
const RELEASE_SIGN_ROOT = path.join(REPO_ROOT, 'tools', 'release-sign');
const GOLDEN_FIXTURE_PATH = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'ef-release', 'golden-canonical-bytes', RELEASE_MANIFEST_FILENAME,
);

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

async function collectReleaseSignSourceFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectReleaseSignSourceFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      files.push(full);
    }
  }
  return files;
}

// =================================================================================================
// AC 1 — `--help` lists all 4 verbs
// =================================================================================================

test('P3-T1 AC1: `--help` exits 0 and lists all 4 verbs (manifest, register, sign, verify)', async () => {
  const { result: exitCode, output } = await withCapturedStdout(() => cliMain(['--help']));
  assert.equal(exitCode, 0);
  for (const verb of ['manifest', 'register', 'sign', 'verify']) {
    assert.match(output, new RegExp(`\\b${verb}\\b`), `--help output must mention verb "${verb}"`);
  }
});

test('P3-T1 AC1: `-h` behaves identically to `--help`', async () => {
  const { result: exitCode, output } = await withCapturedStdout(() => cliMain(['-h']));
  assert.equal(exitCode, 0);
  assert.match(output, /manifest/);
});

test('P3-T1: an unknown verb fails closed with EXIT_USAGE (1)', async () => {
  const { result: exitCode } = await withCapturedStdout(() => cliMain(['bogus-verb']));
  assert.equal(exitCode, 1);
});

// =================================================================================================
// AC 2 — byte-identity: the `manifest` verb's signing preimage === E0's canonical bytes for the
// same pack (SHA-256 equal), proven two independent ways.
// =================================================================================================

test('P3-T1 AC2: manifest verb (fresh-build path) reports a preimage byte-identical to a direct rf-bundle-to-kb-pack propose run', async () => {
  const releaseSignOut = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-manifest-'));
  const directOut = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-direct-propose-'));
  try {
    const candidate = await withCapturedStdout(() =>
      runManifest({
        runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: releaseSignOut,
      }),
    ).then(({ result }) => result);

    await withCapturedStdout(() =>
      runPropose({
        runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: directOut,
      }),
    );
    const directBytes = await readFile(path.join(directOut, RELEASE_MANIFEST_FILENAME));

    assert.equal(candidate.preimageSha256, `sha256:${sha256Hex(directBytes)}`);
    assert.equal(candidate.preimageByteLength, directBytes.length);

    // Independently re-read what the manifest verb actually wrote-through, byte-for-byte, against
    // the direct propose run's own bytes — not just the digest.
    const releaseSignBytes = await readFile(path.join(releaseSignOut, RELEASE_MANIFEST_FILENAME));
    assert.ok(releaseSignBytes.equals(directBytes), 'manifest verb delegation path must introduce zero divergence from a direct propose run');
  } finally {
    await rm(releaseSignOut, { recursive: true, force: true });
    await rm(directOut, { recursive: true, force: true });
  }
});

test('P3-T1 AC2: manifest verb (--pack read-only path) reports the same preimage as the fresh-build path for the same inputs', async () => {
  const buildOut = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-build-'));
  try {
    const fromBuild = await withCapturedStdout(() =>
      runManifest({
        runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: buildOut,
      }),
    ).then(({ result }) => result);

    const fromPack = await withCapturedStdout(() => runManifest({ pack: buildOut })).then(({ result }) => result);

    assert.equal(fromPack.preimageSha256, fromBuild.preimageSha256);
    assert.equal(fromPack.preimageByteLength, fromBuild.preimageByteLength);
    assert.equal(fromPack.packDir, buildOut);
  } finally {
    await rm(buildOut, { recursive: true, force: true });
  }
});

test('P3-T1 AC2: manifest verb\'s signing preimage for the cbc_suite_v1 real fixture equals the pinned golden-canonical-bytes fixture, byte-for-byte and SHA-256-for-SHA-256', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-golden-check-'));
  try {
    await withCapturedStdout(() =>
      runManifest({
        runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir,
      }),
    );

    const { bytes: actualBytes, sha256: actualSha256 } = await readCanonicalManifestBytes(outDir);
    const goldenBytes = await readFile(GOLDEN_FIXTURE_PATH);
    const goldenSha256 = sha256Hex(goldenBytes);

    assert.ok(actualBytes.equals(goldenBytes), 'signing preimage must be byte-identical to the pinned golden-canonical-bytes fixture');
    assert.equal(actualSha256, goldenSha256);
    // Cross-check against the README's documented pin so the doc cannot silently drift from the
    // fixture it describes.
    assert.equal(goldenSha256, '1597e42bb01e1afe9b422146cc65931f4b2eb0e5e6eee46b0d580bb2fc3cbde7');

    // assertGoldenBytesMatch must not throw on a true match.
    assert.doesNotThrow(() => assertGoldenBytesMatch(actualBytes, goldenBytes, 'cbc_suite_v1 golden pin', GoldenDriftError));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// AC 3 — golden-drift test fails closed on a seeded one-byte change; never silently re-baselined.
// =================================================================================================

test('P3-T1 AC3: assertGoldenBytesMatch fails closed (GoldenDriftError) on a seeded one-byte mutation of the golden fixture', async () => {
  const goldenBytes = await readFile(GOLDEN_FIXTURE_PATH);
  const mutated = Buffer.from(goldenBytes);
  // Flip a single byte deep inside the digest content (not whitespace) so the mutation is a real
  // content drift, not merely a formatting difference.
  const flipIndex = mutated.indexOf(Buffer.from('sha256:')) + 'sha256:'.length + 1;
  assert.ok(flipIndex > 0 && flipIndex < mutated.length, 'sanity: mutation index must land inside the fixture');
  // Increment (mod 256) rather than a fixed byte swap so the mutation is guaranteed to differ from
  // the original byte, whatever hex digit it happened to be.
  mutated[flipIndex] = (mutated[flipIndex] + 1) % 256;
  assert.equal(mutated.length, goldenBytes.length, 'sanity: mutation must be a single-byte content change, not a length change');
  assert.ok(!mutated.equals(goldenBytes), 'sanity: the seeded mutation must actually differ from the golden fixture');

  assert.throws(
    () => assertGoldenBytesMatch(mutated, goldenBytes, 'seeded one-byte drift', GoldenDriftError),
    (err) => {
      assert.ok(err instanceof GoldenDriftError);
      assert.equal(err.exitCode, 1);
      assert.notEqual(err.expectedSha256, err.actualSha256);
      assert.match(err.message, /golden-bytes drift detected/);
      assert.match(err.message, /never silently/i);
      return true;
    },
  );
});

test('P3-T1 AC3: a real manifest-verb run against a deliberately corrupted pack copy is caught by the golden comparison (end-to-end)', async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-drift-e2e-'));
  try {
    await withCapturedStdout(() =>
      runManifest({
        runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir,
      }),
    );
    const manifestPath = path.join(outDir, RELEASE_MANIFEST_FILENAME);
    const original = await readFile(manifestPath, 'utf8');
    // Seed a one-byte content change (packVersion digit) directly on disk, then re-read via the
    // same code path `manifest` uses.
    const corrupted = original.replace('"packVersion": "0.1.0-proposal"', '"packVersion": "0.1.1-proposal"');
    assert.notEqual(corrupted, original, 'sanity: the seeded mutation must actually change the bytes');
    await writeFile(manifestPath, corrupted, 'utf8');

    const { bytes: corruptedBytes } = await readCanonicalManifestBytes(outDir);
    const goldenBytes = await readFile(GOLDEN_FIXTURE_PATH);

    assert.throws(
      () => assertGoldenBytesMatch(corruptedBytes, goldenBytes, 'corrupted pack copy', GoldenDriftError),
      GoldenDriftError,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// Fail-closed behavior of the `manifest` verb itself (usage errors, not golden drift)
// =================================================================================================

test('manifest verb fails closed (UsageError) when neither --pack nor the full run-dir/module/decisions/out set is given', async () => {
  await assert.rejects(() => runManifest({}), UsageError);
  await assert.rejects(() => runManifest({ runDir: FIXTURE_DIR }), UsageError);
});

test('manifest verb fails closed (UsageError) when --pack has no release-manifest.unsigned.json (propose was never run there)', async () => {
  const emptyDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-empty-pack-'));
  try {
    await assert.rejects(() => runManifest({ pack: emptyDir }), UsageError);
  } finally {
    await rm(emptyDir, { recursive: true, force: true });
  }
});

// =================================================================================================
// All four verbs (manifest, register, sign, verify) are implemented as of P3-T4. `NotImplementedError`
// stays exported (see tools/release-sign/lib/errors.mjs's own header) as the documented pattern for
// any future scaffolded-but-unimplemented verb, but no verb in this tool throws it today — a bare
// invocation of any verb now fails closed with that VERB's own UsageError (or a UsageError subclass)
// on missing required flags, never the P3-T1-era stub marker. See tests/ef-release-sign-verify.test.mjs
// for `sign`/`verify`'s own full acceptance-criteria coverage and tests/ef-release-registry.test.mjs
// for `register`'s (P3-T4, FR-14/OQ-4).
// =================================================================================================

test('all 4 verbs fail closed with their own UsageError (never the unimplemented-verb stub) on a bare, argument-less invocation', async () => {
  await assert.rejects(() => runRegister({}), UsageError);
  await assert.rejects(() => runRegister({}), (err) => !(err instanceof NotImplementedError));
  await assert.rejects(() => runSign({}), UsageError);
  // verify (P3-T3, FR-13) is implemented: an empty options object is a malformed invocation
  // (missing --candidate/--registry), not the unimplemented-verb stub — see
  // tests/ef-release-sign-verify.test.mjs for verify's own full 5-class exit-code taxonomy suite.
  await assert.rejects(() => runVerify({}), UsageError);
  await assert.rejects(() => runVerify({}), (err) => !(err instanceof NotImplementedError));
});

test('the CLI dispatches register/sign/verify with no args to exit 1 — each verb\'s own UsageError (missing required flags), never the unimplemented-verb stub', async () => {
  for (const verb of ['register', 'sign', 'verify']) {
    const { result: exitCode } = await withCapturedStdout(() => cliMain([verb]));
    assert.equal(exitCode, 1, `${verb} must fail closed with exit 1 on a bare invocation`);
  }
});

test('dispatchVerb forwards a ReleaseSignError\'s own exitCode verbatim (no remapping)', async () => {
  const exitCode = await dispatchVerb(runSign, {});
  assert.equal(exitCode, 1);
});

// =================================================================================================
// AC 4 — zero non-`node:crypto` crypto imports anywhere under tools/release-sign/
// =================================================================================================

test('P3-T1 AC4: no file under tools/release-sign/ imports a crypto module other than node:crypto', async () => {
  const files = await collectReleaseSignSourceFiles(RELEASE_SIGN_ROOT);
  assert.ok(files.length > 0, 'sanity: the release-sign source tree must not be empty');

  // Any import specifier containing "crypto" that is NOT exactly 'node:crypto' (with either quote
  // style) is forbidden — this catches a bare 'crypto' import, a scoped npm crypto package, or any
  // third-party crypto library, while allowing the one sanctioned import.
  const importLine = /^\s*import\b[^;]*from\s+['"]([^'"]*crypto[^'"]*)['"]/gim;

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    let match;
    importLine.lastIndex = 0;
    while ((match = importLine.exec(source)) !== null) {
      assert.equal(
        match[1],
        'node:crypto',
        `${path.relative(REPO_ROOT, file)} imports "${match[1]}" — only 'node:crypto' is permitted (decisions block Risk 6: zero new crypto deps)`,
      );
    }
  }
});

test('P3-T1 AC4: package.json declares zero dependencies (this tool adds none)', async () => {
  const pkg = JSON.parse(await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined, 'package.json must carry no dependencies block at all');
});

// =================================================================================================
// AC 5 — zero network calls, zero LLM/generative-model invocations, ever.
// =================================================================================================

test('P3-T1 AC5: no file under tools/release-sign/ imports a network or AI/model-SDK module (structural)', async () => {
  const files = await collectReleaseSignSourceFiles(RELEASE_SIGN_ROOT);
  const forbidden = [
    /^\s*import\b[^;]*from\s+['"](?:node:)?http['"]/m,
    /^\s*import\b[^;]*from\s+['"](?:node:)?https['"]/m,
    /^\s*import\b[^;]*from\s+['"](?:node:)?dgram['"]/m,
    /^\s*import\b[^;]*from\s+['"]@anthropic-ai\/[^'"]*['"]/m,
    /^\s*import\b[^;]*from\s+['"]openai['"]/m,
    /(?<!\/\/[^\n]*)\bfetch\s*\(/,
  ];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(source), `${path.relative(REPO_ROOT, file)} matches forbidden pattern ${pattern} (network/AI-SDK import)`);
    }
  }
});

test('P3-T1 AC5: a real manifest-verb run (both --pack and fresh-build paths) makes zero outbound network calls', async () => {
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalFetch = globalThis.fetch;
  let calls = 0;

  http.request = (...args) => {
    calls += 1;
    return originalHttpRequest.apply(http, args);
  };
  https.request = (...args) => {
    calls += 1;
    return originalHttpsRequest.apply(https, args);
  };
  if (typeof originalFetch === 'function') {
    globalThis.fetch = (...args) => {
      calls += 1;
      return originalFetch.apply(globalThis, args);
    };
  }

  const outDir = await mkdtemp(path.join(os.tmpdir(), 'ef-release-sign-zeronetwork-'));
  try {
    await withCapturedStdout(() =>
      runManifest({
        runDir: FIXTURE_DIR, module: REAL_MODULE_PATH, decisions: REAL_DECISIONS_PATH, out: outDir,
      }),
    );
    await withCapturedStdout(() => runManifest({ pack: outDir }));
    await assert.rejects(() => runRegister({}));
    await assert.rejects(() => runSign({}));
    await assert.rejects(() => runVerify({}));
  } finally {
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
    if (typeof originalFetch === 'function') globalThis.fetch = originalFetch;
    await rm(outDir, { recursive: true, force: true });
  }

  assert.equal(calls, 0, 'manifest (both paths) + the register/sign/verify stubs combined must make zero outbound network calls');
});
