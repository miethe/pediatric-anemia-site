// tests/evidence-registry.test.mjs — FIX-E (reviewer re-review, finding E) test coverage.
//
// Before this fix, src/engine.js accepted a `moduleId` parameter but resolved every rule's
// `sourcePassageId` through src/evidence.js#passageById, which searches only the
// statically-imported anemia evidence singleton regardless of what `moduleId` was actually
// passed. A second registered module would either silently get `null` for every passage (if its
// evidence.json used disjoint ids) or, on an id collision, the WRONG passage's status — a
// wrong-answer bug, not just a gap.
//
// src/evidence/registry.js closes this the way src/facts/registry.js and src/ranges/registry.js
// already do for their own concerns: a moduleId-keyed map over each module's OWN evidence
// accessors. An unregistered moduleId throws rather than silently falling back to anemia's data.

import test from 'node:test';
import assert from 'node:assert/strict';
import { passageByIdForModule, passagesForModule } from '../src/evidence/registry.js';
import { passageById as anemiaPassageById, passagesFor as anemiaPassagesFor } from '../src/evidence.js';
import { assess, assessPediatricAnemia } from '../src/engine.js';
import { readFile } from 'node:fs/promises';

const rules = JSON.parse(await readFile(new URL('../modules/anemia/rules.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(await readFile(new URL('../modules/anemia/candidates.json', import.meta.url), 'utf8'));
const example = JSON.parse(await readFile(new URL('../examples/ida-toddler.json', import.meta.url), 'utf8'));

test('passageByIdForModule("anemia", ...) resolves identically to src/evidence.js#passageById for a real anemia passage', () => {
  const knownPassageId = 'WHO2024_HB#implementation-proposal';
  assert.deepEqual(passageByIdForModule('anemia', knownPassageId), anemiaPassageById(knownPassageId));
  assert.ok(passageByIdForModule('anemia', knownPassageId), 'sanity: the passage must actually exist');
});

test('passagesForModule("anemia", ...) resolves identically to src/evidence.js#passagesFor', () => {
  assert.deepEqual(passagesForModule('anemia', 'WHO2024_HB'), anemiaPassagesFor('WHO2024_HB'));
});

test('passageByIdForModule FAILS LOUDLY (throws) for any unregistered moduleId — never silently returns anemia data', () => {
  for (const badModuleId of ['lipid-panel', 'not-a-real-module', '', undefined, null]) {
    assert.throws(
      () => passageByIdForModule(badModuleId, 'WHO2024_HB#implementation-proposal'),
      (error) => error.message.includes('unknown module') || error.message.includes(String(badModuleId)),
      `expected passageByIdForModule to throw for moduleId ${JSON.stringify(badModuleId)}, not silently resolve`,
    );
  }
});

test('passagesForModule FAILS LOUDLY (throws) for any unregistered moduleId', () => {
  assert.throws(() => passagesForModule('lipid-panel', 'WHO2024_HB'));
});

test('assess() resolves provenance.ruleAudit[].sourcePassageStatus through the moduleId-scoped registry for the anemia path', () => {
  const result = assessPediatricAnemia(example, rules, candidates);
  const entry = result.provenance.ruleAudit.find((e) => e.sourcePassageId != null);
  assert.ok(entry, 'expected at least one rule with a non-null sourcePassageId');
  assert.equal(entry.sourcePassageStatus, passageByIdForModule('anemia', entry.sourcePassageId)?.status ?? null);
});

test('assess() throws rather than silently resolving passages against anemia data when given an unregistered moduleId', () => {
  // getModule() (src/modules/registry.js) already throws for a moduleId with no registered
  // module hooks at all — but the point of this fix is that passage resolution itself must never
  // silently fall back to anemia's evidence even if some future change registered a module's
  // fact/rule hooks without also registering its evidence accessors here. This test pins that
  // assess() end-to-end fails loudly for a moduleId unknown to either registry, not just that
  // getModule() happens to fail first.
  assert.throws(() => assess(example, 'not-a-real-module', rules, candidates));
});
