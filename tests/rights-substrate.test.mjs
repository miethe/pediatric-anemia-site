// tests/rights-substrate.test.mjs — EPR0-T1 (FR-WP0-01, FR-WP0-02, D4).
//
// Proves the top-level rights/ tree this task creates:
//   - rights/release-context.json, rights-records.json, rights-failures.json, rights-ledger.json
//     all exist and parse as JSON.
//   - release-context.json declares commercial:false and use_type:internal_research, plus a
//     territory and channel scope built from the spec's §5.2 intended-use vocabulary.
//   - D4: no inline rights key (in particular no `extensions.rights`) appears anywhere in the four
//     clinical KB JSON files. Rights data lives ONLY in rights/, joined via rights-ledger.json.
//   - a fixture that asserts a commercial-shaped use against release-context.json fails containment.
//
// The containment check below (isRequestContainedByReleaseContext) is a small, LOCAL, task-scoped
// helper that exists only to prove this task's own acceptance criterion. It previews the shape of
// EPR0-T5 gate (d) ("use/territory/channel set-containment against release-context.json") but it is
// NOT that gate, does not live in scripts/validate-rights.mjs, and must not be treated as the
// authoritative implementation — scripts/validate-rights.mjs is EPR0-T5's module to create and own.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readJson = async (relPath) => JSON.parse(await readFile(new URL(`../${relPath}`, import.meta.url), 'utf8'));

const RIGHTS_TREE_FILES = [
  'rights/release-context.json',
  'rights/rights-records.json',
  'rights/rights-failures.json',
  'rights/rights-ledger.json',
];

const CLINICAL_JSON_FILES = [
  'modules/anemia/rules.json',
  'modules/anemia/candidates.json',
  'modules/anemia/evidence.json',
  'modules/anemia/reference-ranges.json',
];

// --- the four files exist and parse --------------------------------------------------------------

for (const relPath of RIGHTS_TREE_FILES) {
  test(`rights/ tree: ${relPath} exists and parses as JSON`, async () => {
    const parsed = await readJson(relPath);
    assert.equal(typeof parsed, 'object');
    assert.notEqual(parsed, null);
  });
}

// --- release-context.json declares the required fields -------------------------------------------

test('release-context.json declares commercial:false and use_type:internal_research', async () => {
  const releaseContext = await readJson('rights/release-context.json');
  assert.equal(releaseContext.commercial, false, 'commercial must be exactly boolean false');
  assert.equal(releaseContext.use_type, 'internal_research');
});

test('release-context.json declares a territory and channel scope', async () => {
  const releaseContext = await readJson('rights/release-context.json');
  assert.ok(releaseContext.territory && typeof releaseContext.territory === 'object', 'territory scope must be declared');
  assert.ok(
    Array.isArray(releaseContext.territory.permitted_jurisdictions) && releaseContext.territory.permitted_jurisdictions.length > 0,
    'territory scope must name at least one permitted jurisdiction',
  );
  assert.ok(releaseContext.channel && typeof releaseContext.channel === 'object', 'channel scope must be declared');
  assert.ok(
    Array.isArray(releaseContext.channel.permitted_channels) && releaseContext.channel.permitted_channels.length > 0,
    'channel scope must name at least one permitted channel',
  );
});

test('release-context.json intended_uses vocabulary is drawn from spec §5.2, verbatim', async () => {
  const releaseContext = await readJson('rights/release-context.json');
  const spec = await readFile(
    new URL(
      '../docs/project_plans/research/research_foundry_rights_governance_spec_v1.0/Research_Foundry_Source_Reuse_and_Rights_Governance_Spec_v1.0.md',
      import.meta.url,
    ),
    'utf8',
  );
  const { permitted, not_permitted: notPermitted } = releaseContext.intended_uses;
  assert.ok(Array.isArray(permitted) && permitted.length > 0);
  assert.ok(Array.isArray(notPermitted) && notPermitted.length > 0);
  for (const use of [...permitted, ...notPermitted]) {
    assert.ok(
      spec.includes(`- ${use};`) || spec.includes(`- ${use}.`),
      `expected §5.2 intended-use string "${use}" to appear verbatim in the spec bundle, not be invented`,
    );
  }
  // permitted and not_permitted must be disjoint — no use is simultaneously allowed and disallowed.
  const overlap = permitted.filter((use) => notPermitted.includes(use));
  assert.deepEqual(overlap, [], 'permitted and not_permitted intended uses must not overlap');
});

// --- D4: no inline rights key in any clinical JSON file -------------------------------------------

/** Recursively collects every object key found anywhere in `value`, case-insensitively. */
function collectKeysDeep(value, found = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeysDeep(item, found);
  } else if (value && typeof value === 'object') {
    for (const [key, val] of Object.entries(value)) {
      found.add(key.toLowerCase());
      collectKeysDeep(val, found);
    }
  }
  return found;
}

// EPR2-T3 (FR-WP2-03): `license.rights_holder` is a required key on schemas/evidence.schema.json's
// `$defs/license` (EPR2-T1), chosen deliberately to mirror schemas/rights/rights_record.schema.json's
// `copyright.rights_holder` vocabulary one-for-one (EPR2-T1's own commit message: "mirroring
// rights_record.copyright"). It is a plain copyright-attribution field ("the named copyright holder"),
// carries no clearance authority, and is not a rights *record* — the schema's own field description
// says so explicitly. It is NOT the D4 violation this check exists to catch (an inlined governance
// record, e.g. a `rights` or `extensions.rights` key); it is a narrow, intentional false positive of
// the substring scan below. Exempted by exact key name only — every other "rights"-containing key
// (including the literal "rights" key and any "extensions.rights"-shaped path) still fails.
const ALLOWLISTED_RIGHTS_SUBSTRING_KEYS = new Set(['rights_holder']);

for (const relPath of CLINICAL_JSON_FILES) {
  test(`D4: ${relPath} carries no inline rights key (no "rights", no "extensions.rights")`, async () => {
    const parsed = await readJson(relPath);
    const keys = collectKeysDeep(parsed);
    assert.ok(!keys.has('rights'), `${relPath} must not have any key literally named "rights"`);
    for (const key of keys) {
      if (ALLOWLISTED_RIGHTS_SUBSTRING_KEYS.has(key)) continue;
      assert.ok(
        !key.includes('rights'),
        `${relPath} must not have any key containing "rights" (found "${key}") — rights data belongs only under rights/, joined via rights/rights-ledger.json`,
      );
    }
  });
}

// --- fixture: a commercial-shaped use request fails containment against release-context.json -----

/**
 * Local, task-scoped containment check (NOT the EPR0-T5 gate). A requested use is permitted only if
 * it does not ask for commercial use beyond what release-context.json grants, and every requested
 * intended use is in the release context's permitted set.
 */
function isRequestContainedByReleaseContext(releaseContext, requestedUse) {
  if (requestedUse.commercial === true && releaseContext.commercial === false) {
    return false;
  }
  const permitted = new Set(releaseContext.intended_uses.permitted);
  return (requestedUse.intended_uses ?? []).every((use) => permitted.has(use));
}

test('fixture: a commercial-shaped use request fails containment against release-context.json', async () => {
  const releaseContext = await readJson('rights/release-context.json');

  const commercialFixture = {
    requested_use_id: 'fixture-commercial-runtime-request',
    commercial: true,
    intended_uses: ['commercial runtime logic'],
  };
  assert.equal(
    isRequestContainedByReleaseContext(releaseContext, commercialFixture),
    false,
    'a commercial:true request must fail containment against a commercial:false release context',
  );

  // control: a request that stays within the declared internal-research scope must pass, or the
  // failing assertion above would prove nothing (a helper that always returns false is not a test).
  const internalFixture = {
    requested_use_id: 'fixture-internal-validation-request',
    commercial: false,
    intended_uses: ['internal validation'],
  };
  assert.equal(
    isRequestContainedByReleaseContext(releaseContext, internalFixture),
    true,
    'CONTROL: an internal-research-shaped request must pass containment, or the negative case above proves nothing',
  );
});
