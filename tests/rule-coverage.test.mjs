// Negative/unit tests for scripts/rule-coverage.mjs — proves the instrument
// actually measures activation-witness coverage rather than always reporting
// a fixed number. See EP05-T1 (phase-0.5-activation-witness-corpus.md): the
// script exists precisely because a corpus-gated safety net cannot be
// trusted without evidence it responds to changes in the corpus, so this
// suite checks that response in-process (no fixtures deleted on disk).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeCoverage, checkMinimum, checkRequireAll } from '../scripts/rule-coverage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('examples/*.json alone witnesses exactly 30 of 91 rules (EP-0 measured baseline)', async () => {
  const coverage = await computeCoverage({ rootDir: root, fixtureDirs: ['examples'] });
  assert.equal(coverage.total, 91);
  assert.equal(coverage.witnessed, 30);
  assert.equal(coverage.unwitnessed.length, 61);
  // ALERT-001/-002/-003/-006/-007/-008 are the six uncovered alerts named in
  // the EP-0 AAR and the phase plan's "Why this phase exists" section.
  for (const id of ['ALERT-001', 'ALERT-002', 'ALERT-003', 'ALERT-006', 'ALERT-007', 'ALERT-008']) {
    assert.ok(coverage.unwitnessed.includes(id), `expected ${id} to be unwitnessed at baseline`);
  }
});

test('a deliberately reduced fixture set yields a strictly lower witnessed count', async () => {
  const full = await computeCoverage({ rootDir: root, fixtureDirs: ['examples'] });
  // Point at a single example file instead of deleting anything on disk —
  // this is the "deleting a fixture drops the count" check, done in-process.
  const reduced = await computeCoverage({ rootDir: root, fixtureDirs: ['examples/ida-toddler.json'] });
  assert.equal(reduced.total, 91);
  assert.ok(
    reduced.witnessed < full.witnessed,
    `expected reduced witnessed count (${reduced.witnessed}) to be strictly lower than full (${full.witnessed})`,
  );
});

test('an empty fixture set witnesses zero rules', async () => {
  const coverage = await computeCoverage({ rootDir: root, fixtureDirs: [] });
  assert.equal(coverage.total, 91);
  assert.equal(coverage.witnessed, 0);
  assert.equal(coverage.unwitnessed.length, 91);
});

test('checkMinimum fails strictly below the threshold and succeeds at/above it', async () => {
  const coverage = await computeCoverage({ rootDir: root, fixtureDirs: ['examples'] });
  assert.equal(coverage.witnessed, 30);

  const belowThreshold = checkMinimum(coverage, 31);
  assert.equal(belowThreshold.ok, false);

  const atThreshold = checkMinimum(coverage, 30);
  assert.equal(atThreshold.ok, true);

  const aboveIsHigherThanActual = checkMinimum(coverage, 29);
  assert.equal(aboveIsHigherThanActual.ok, true);
});

test('checkRequireAll fails on any unwitnessed rule, and closes the --min count hole', async () => {
  // The full corpus witnesses every rule.
  const full = await computeCoverage({ rootDir: root });
  assert.equal(checkRequireAll(full).ok, true, 'the committed corpus must witness every rule');

  // The examples-only corpus leaves 61 rules unwitnessed.
  const partial = await computeCoverage({ rootDir: root, fixtureDirs: ['examples'] });
  const partialResult = checkRequireAll(partial);
  assert.equal(partialResult.ok, false);
  assert.match(partialResult.message, /have no activation witness/);
  for (const id of ['ALERT-001', 'ALERT-007']) {
    assert.match(partialResult.message, new RegExp(id), `${id} must be named in the failure`);
  }

  // The hole --require-all exists to close: --min pins an absolute COUNT, so a rule base
  // that grew by one unwitnessed rule still clears a --min set at the old witnessed count.
  // Simulated here rather than by mutating rules.json on disk.
  const grown = {
    ...partial,
    total: partial.total + 1,
    unwitnessed: [...partial.unwitnessed, 'HYPOTHETICAL-NEW-RULE-001'],
  };
  assert.equal(
    checkMinimum(grown, partial.witnessed).ok,
    true,
    '--min still passes when the rule base grows by an unwitnessed rule — this is the hole',
  );
  assert.equal(
    checkRequireAll(grown).ok,
    false,
    '--require-all must catch the new unwitnessed rule that --min lets through',
  );
});

test('a fixture that fails to parse throws rather than being silently skipped', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rule-coverage-bad-json-'));
  try {
    await writeFile(path.join(tmpDir, 'not-json.json'), '{ this is not valid json', 'utf8');
    await assert.rejects(
      () => computeCoverage({ rootDir: root, fixtureDirs: [tmpDir] }),
      /failed to parse fixture/,
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('a fixture that makes assess() throw is not silently skipped', async () => {
  // The real engine (src/engine.js) is deliberately defensive — deriveFacts()
  // treats almost any input shape gracefully rather than throwing — so there
  // is no realistic fixture content that reliably exercises this path
  // end-to-end. computeCoverage() accepts an injectable assessFn precisely
  // so this fail-loud branch can still be proven deterministically.
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'rule-coverage-throwing-assess-'));
  try {
    await writeFile(path.join(tmpDir, 'fixture.json'), '{}', 'utf8');
    const throwingAssess = () => {
      throw new Error('boom');
    };
    await assert.rejects(
      () => computeCoverage({ rootDir: root, fixtureDirs: [tmpDir], assessFn: throwingAssess }),
      /assess\(\) threw for fixture/,
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
