// Synthetic-profile containment.
//
// A synthetic profile must never read as an approved site profile. That is not a documentation
// convention — it is enforced here at three independent levels: the FILENAME, the DOCUMENT
// CONTENT, and the SCHEMA itself. Any one of them alone could be defeated by a copy-paste or a
// one-field edit; together they mean a synthetic fixture cannot be promoted into an approved
// profile by accident, and cannot be mistaken for one by a reader skimming a directory listing.
//
// This file also enforces the OQ-3 boundary: OQ-3 (which institution and exact laboratory /
// terminology profile is first) is OWNER-HELD and unresolved. No fixture in this repository may
// name a real institution, laboratory director, or analyzer as approved.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BLOCKER,
  evaluateActivationGate,
  validateReferenceIntervalProfile,
  validateTerminologyProfile,
} from '../scripts/lib/local-applicability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(root, 'tests', 'fixtures', 'local-profile');
const SANCTIONED_PROFILE_DIR = path.join('tests', 'fixtures', 'local-profile');

// Directories that hold no source of truth: build output, dependencies, VCS metadata, and agent
// worktrees (which contain their own checkouts and would be scanned twice).
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', 'dist', '.claude', 'coverage', '.cache']);

/**
 * Walk the WHOLE repository, not one directory.
 *
 * The previous version globbed `tests/fixtures/local-profile/` alone, so a profile placed under
 * `docs/`, `examples/`, or `schemas/` was never scanned at all. Combined with the activation-gate
 * defect, "put it in the wrong directory" was a working bypass of every containment level below.
 * Containment that only inspects the place you expect to find something is not containment.
 */
async function findProfileDocuments(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      found.push(...(await findProfileDocuments(absolute)));
      continue;
    }
    if (!entry.name.endsWith('.json')) continue;

    let document;
    try {
      document = JSON.parse(await readFile(absolute, 'utf8'));
    } catch {
      continue; // not JSON we can read; other tooling owns malformed JSON
    }
    if (document === null || typeof document !== 'object') continue;

    // A profile is anything that declares a profile kind OR carries a profileClass. Both are
    // checked: a document that omitted `kind` to slip past a kind-only filter is still caught.
    const isProfile =
      document.kind === 'LocalReferenceIntervalProfile' ||
      document.kind === 'LocalTerminologyProfile' ||
      document.profileClass !== undefined;
    if (isProfile) found.push({ filename: entry.name, relativePath: path.relative(root, absolute), document });
  }
  return found;
}

const profileFixtures = await findProfileDocuments(root);
assert.ok(profileFixtures.length >= 2, 'expected at least the reference and terminology profile fixtures');

test('containment level 0 (location): the scan covers the whole repository, and every profile lives where it is expected', () => {
  // REGRESSION (P3-V1 F12). The scan used to glob one directory. Prove it now reaches beyond it
  // by confirming the walk is rooted at the repo and that it would have to report a profile
  // planted anywhere else.
  assert.equal(path.basename(root), path.basename(path.resolve(fixtureDir, '..', '..', '..')), 'scan must be rooted at the repository, not the fixture directory');

  for (const { relativePath } of profileFixtures) {
    assert.ok(
      relativePath.startsWith(SANCTIONED_PROFILE_DIR + path.sep),
      `${relativePath} is a local profile document outside ${SANCTIONED_PROFILE_DIR}/. Profiles are only permitted there; "place it in the wrong directory" must not be a way past containment.`,
    );
  }
});

test('containment level 0 (location): a profile planted outside the fixture directory IS detected', async () => {
  // The scanner itself is the thing under test. Asserting that every profile we happen to find
  // lives in the sanctioned directory is vacuous if the scan only ever looks there — which is
  // precisely the shape of the original defect. So plant a profile-shaped document somewhere
  // else in the repository and require the scan to surface it.
  //
  // The probe deliberately declares only `kind`, with no `profileClass` and no SYNTHETIC filename
  // prefix, because that is the document a bypass would actually produce.
  const probeDirectory = path.join(root, 'docs', 'containment-scan-probe');
  const probeFile = path.join(probeDirectory, 'planted-profile.json');

  try {
    await mkdir(probeDirectory, { recursive: true });
    await writeFile(probeFile, JSON.stringify({ kind: 'LocalReferenceIntervalProfile' }), 'utf8');

    const scanned = await findProfileDocuments(root);
    const detected = scanned.find((entry) => entry.relativePath === path.relative(root, probeFile));

    assert.ok(
      detected,
      'a profile document planted outside tests/fixtures/local-profile/ was NOT found. The containment scan is not covering the repository, so "place it in the wrong directory" is a working bypass.',
    );
    assert.ok(
      !detected.relativePath.startsWith(SANCTIONED_PROFILE_DIR + path.sep),
      'the planted probe must be reported as living outside the sanctioned directory',
    );
  } finally {
    await rm(probeDirectory, { recursive: true, force: true });
  }
});

test('containment level 1 (filename): every profile fixture is marked synthetic in its filename', () => {
  for (const { filename } of profileFixtures) {
    assert.ok(
      filename.startsWith('SYNTHETIC-'),
      `${filename} must be marked synthetic in its filename — a reader scanning a directory listing sees the name before the content`,
    );
  }
});

test('containment level 2 (content): no fixture in this repository claims to be a site-asserted profile', () => {
  for (const { filename, document } of profileFixtures) {
    assert.equal(
      document.profileClass,
      'synthetic_example',
      `${filename} declares profileClass "${document.profileClass}"; OQ-3 is owner-held and unresolved, so no site_asserted profile may exist here`,
    );
    assert.deepEqual(
      {
        synthetic: document.syntheticDeclaration?.synthetic,
        notForClinicalUse: document.syntheticDeclaration?.notForClinicalUse,
        notAnApprovedSiteProfile: document.syntheticDeclaration?.notAnApprovedSiteProfile,
      },
      { synthetic: true, notForClinicalUse: true, notAnApprovedSiteProfile: true },
      `${filename} must carry a complete syntheticDeclaration`,
    );
    assert.ok(
      document.syntheticDeclaration.purpose?.length > 0,
      `${filename} must state why the synthetic fixture exists`,
    );
  }
});

test('containment level 2 (content): no fixture names an institution, director, or informatics owner', () => {
  // OQ-3 is owner-held. A repository agent inventing a plausible institution or director name is
  // precisely how a synthetic artifact acquires the appearance of authority.
  for (const { filename, document } of profileFixtures) {
    assert.equal(document.authority.institutionName, null, `${filename} must not name an institution`);
    assert.equal(document.authority.assertion, 'not_executed_owner_held', `${filename} must not claim asserted authority`);
    if ('laboratoryDirectorName' in document.authority) {
      assert.equal(document.authority.laboratoryDirectorName, null, `${filename} must not name a laboratory director`);
      assert.equal(document.authority.laboratoryDirectorCredential, null, `${filename} must not name a director credential`);
      assert.equal(document.authority.designeeName, null, `${filename} must not name a designee`);
    }
    if ('informaticsOwnerName' in document.authority) {
      assert.equal(document.authority.informaticsOwnerName, null, `${filename} must not name an informatics owner`);
    }
    assert.equal(document.authority.assertedOn, null, `${filename} must not carry an assertion date`);
  }
});

test('containment level 3 (schema): a synthetic profile cannot be edited into an authoritative one', async () => {
  // The schema's top-level conditional pins authority and attestation for synthetic_example
  // documents. Flipping either field is a structural violation, not a permitted edit — so the
  // containment survives a well-intentioned copy-paste that changes one line.
  for (const { filename, document } of profileFixtures) {
    const validateProfile =
      document.kind === 'LocalReferenceIntervalProfile' ? validateReferenceIntervalProfile : validateTerminologyProfile;

    const claimingAuthority = structuredClone(document);
    claimingAuthority.authority.assertion = 'asserted';
    assert.equal(
      (await validateProfile(claimingAuthority)).ok,
      false,
      `${filename}: a synthetic profile claiming asserted authority must be structurally invalid`,
    );

    const claimingSignature = structuredClone(document);
    claimingSignature.attestation.signatureState = 'bound';
    assert.equal(
      (await validateProfile(claimingSignature)).ok,
      false,
      `${filename}: a synthetic profile claiming a bound signature must be structurally invalid`,
    );

    const reclassified = structuredClone(document);
    reclassified.profileClass = 'site_asserted';
    assert.equal(
      (await validateProfile(reclassified)).ok,
      false,
      `${filename}: reclassifying a document that still carries a syntheticDeclaration must be structurally invalid`,
    );
  }
});

test('a synthetic profile can never satisfy an activation gate, even granted perfect applicability', async () => {
  // The strongest form of the assertion: hand the gate a fabricated "everything matched"
  // applicability decision, and it must still refuse on the synthetic class alone.
  for (const { filename, document } of profileFixtures) {
    const gate = evaluateActivationGate(document, { applicable: true, decision: 'applicable', blockers: [] });
    assert.equal(gate.decision, 'fail_closed', `${filename} must never activate`);
    assert.ok(
      gate.blockers.map((blocker) => blocker.code).includes(BLOCKER.SYNTHETIC_PROFILE_CANNOT_ACTIVATE),
      `${filename} must be refused specifically because it is synthetic`,
    );
  }
});
