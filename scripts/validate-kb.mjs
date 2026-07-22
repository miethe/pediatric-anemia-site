import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCondition } from '../src/ruleEngine.js';
import { MODULE_IDS } from '../src/modules/registry.js';
import { isBindableAsSourceSupported } from '../src/evidence.js';
import { loadAttestationLedger, validateBindingsAgainstLedger } from './evidence/lib/attested-passage-map.mjs';
import { validate } from './lib/json-schema-lite.mjs';
// P3-T4: modules/<id>/authoring-decisions.yaml is YAML, not JSON — reuse the converter's own
// dependency-free YAML-subset parser (tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs, P2-T2) rather
// than adding a `yaml` dependency just for this validator. tests/authoring-decisions-schema.test.mjs
// already establishes this same cross-import for the equivalent test-side check.
import { parseYamlDocument } from '../tools/rf-bundle-to-kb-pack/lib/yaml-lite.mjs';
// P3-T6 (FR-18, PRD OQ-2 — verifier-surface wiring): joins ONLY the structural half of
// tools/release-sign's append-only guarantee (the git-history walk, layer 2 of that tool's own
// two-layer design — see tools/release-sign/lib/registry.mjs's own header) into `npm run validate`.
// This is a read-only, offline `git log`/`git show` walk, never a cryptographic operation — the
// `sign`/`verify` verbs (Ed25519) are deliberately NOT imported here; see this file's
// "P3-T6 verifier-surface decision" comment on `loadAndValidateReleaseRegistry` below, and
// tools/release-sign/README.md's own "Verifier surface wired into npm run validate" section.
import { checkRegistryHistoryAppendOnly } from '../tools/release-sign/lib/registry.mjs';
import { RegistryAppendOnlyViolationError } from '../tools/release-sign/lib/errors.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// P3-T3: modules/<id>/evidence-assertions.json is a NEW, optional-per-module artifact (OQ-3/OQ-7)
// — existence-gated, since it postdates modules/anemia/ and no task requires backfilling it there.
async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

// REG-002 (content-rights review, launched EP-0-T8) has NOT cleared verbatim reuse of AAP/AAFP
// guideline text (D-EP3-4). Every passage record minted by scripts/evidence/build-evidence-pack.mjs
// must therefore be paraphrase-only (`passageFidelity: "paraphrase"`) until REG-002 clears.
// Flip this single constant to `true` in the same commit that records REG-002 as cleared —
// nothing else in this file should need to change.
const REG_002_CLEARED = false;

// EP-4 (EP4-T1/T2) has landed: scripts/evidence/backfill-rule-governance.mjs populates
// `sourcePassageId` (source-supported or an explicit `<sourceId>#implementation-proposal`
// fallback, D-EP3-6) on all 91 rules. A rule missing it is therefore now a hard error, not a
// tolerated warning.
const REQUIRE_RULE_SOURCE_PASSAGE_ID = true;

// "<sourceId>#<ev_NNN|implementation-proposal>" — mirrors schemas/evidence.schema.json's
// $defs/passage.id pattern. Duplicated here (rather than read out of the schema at runtime)
// because this check also needs the captured sourceId group to cross-check against the
// enclosing source record, which the schema's own pattern cannot do (see the schema's own
// sourceId description: "this schema validates the passage in isolation and cannot cross-check
// the parent").
const PASSAGE_ID_PATTERN = /^([A-Z0-9_]+)#(ev_[0-9]{3}|implementation-proposal)$/;

// SPIKE-003 RQ4 keeps patient-input.schema.json's booleanMap open for wire compatibility, so
// rule authors need this separate, fail-closed field-name guard. These are the known boolean
// input and derived fact paths exposed by modules/anemia/facts.anemia.js, grouped by input map.
// The four marked history.* paths are intentional open-passthrough fields: they are read by rules
// through the facts module's `...history` spread but are not named in facts.anemia.js itself.
const BOOLEAN_FACT_PATH_ALLOW_LIST = new Set([
  // history.* explicit input fields
  'history.abnormalSkinPigmentation',
  'history.chronicInfection',
  'history.chronicKidneyDisease',
  'history.congenitalAnomalies',
  'history.cowMilkBefore12Months',
  'history.excessCowMilk',
  'history.familyHemoglobinopathy',
  'history.familySickleCell',
  'history.familyThalassemia',
  'history.foodInsecurity',
  'history.frequentBloodDonation',
  'history.giBloodLoss',
  'history.heavyMenstrualBleeding',
  'history.inflammatoryBowelDisease',
  'history.knownHereditarySpherocytosis',
  'history.knownSickleCellDisease',
  'history.knownThalassemiaMajor',
  'history.liverDisease',
  'history.lowIronDiet',
  'history.macrocytosisAssociatedMedication',
  'history.malabsorption',
  'history.malariaTravelOrResidence',
  'history.microcephaly',
  'history.otherBloodLoss',
  'history.otherChronicHemolyticDisease',
  'history.otherInflammatoryDisease',
  'history.oxidantMedicationOrFavaExposure',
  'history.pica',
  'history.prematurity',
  'history.recentViralIllness',
  'history.recurrentEpistaxis',
  'history.rheumatologicDisease',
  'history.shortStature',
  'history.thumbOrRadiusAnomaly',
  'history.thyroidDisease',
  'history.vegetarianOrVegan',
  // Intentional ...history passthrough fields found by the SPIKE-003 census.
  'history.adherenceVerified',
  'history.leadExposureRisk',
  'history.ongoingBloodLossKnown',
  'history.priorAdequateIronTrialNoResponse',
  // history.* derived facts
  'history.bleedingHistory',
  'history.chronicInflammation',
  'history.ironRiskHistory',
  'history.knownChronicHemolyticDisease',
  'history.liverSignal',
  'history.malariaRisk',
  'history.medicationMacrocytosisRisk',
  'history.oxidantTrigger',
  'history.recentViral',
  'history.renalSignal',
  'history.thyroidSignal',

  // symptoms.* explicit input fields
  'symptoms.activeMajorBleeding',
  'symptoms.alteredMentalStatus',
  'symptoms.chestPain',
  'symptoms.darkUrine',
  'symptoms.fatigue',
  'symptoms.fever',
  'symptoms.heartFailureSigns',
  'symptoms.hemodynamicInstability',
  'symptoms.jaundice',
  'symptoms.neurologicSymptoms',
  'symptoms.oliguria',
  'symptoms.pallor',
  'symptoms.renalSymptoms',
  'symptoms.respiratoryDistress',
  'symptoms.syncope',
  // symptoms.* derived facts
  'symptoms.fatigueOrPallor',
  'symptoms.instability',
  'symptoms.jaundiceOrDarkUrine',

  // exam.* explicit input fields
  'exam.hepatomegaly',
  'exam.lymphadenopathy',
  'exam.petechiae',
  'exam.splenomegaly',
  'exam.unexplainedBruising',
  // exam.* derived facts
  'exam.petechiaeOrBruising',
]);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

// P1-T2 (evidence-foundry-buildout Phase 1): the 8 module-variable-envelope fields every
// module manifest must declare — the scoping contract (who the module is for, which patients,
// what it outputs, what it explicitly refuses to do, where it applies, what surfaces it
// targets, and its evidence-recency policy). Per the OQ-7 ruling (binding), this is a
// field-presence + non-empty check ONLY — deliberately NOT a new JSON Schema file; shape/type
// governance of these fields is deferred until the envelope design stabilizes.
const MODULE_VARIABLE_ENVELOPE_FIELDS = [
  'module_topic',
  'intended_hcp_users',
  'patient_population',
  'intended_output',
  'explicit_exclusions',
  'jurisdictions',
  'integration_targets',
  'evidence_policy',
];

/**
 * P1-T2: checks that `manifest` carries every module-variable-envelope field, present and
 * non-empty (non-empty string / non-empty array / object with at least one key). Pure function
 * over the in-memory manifest (mirrors validateEvidenceDocument/validateCandidates above) so it
 * is independently unit-testable against a mutated manifest without touching disk. Returns one
 * specific error per missing/empty field, naming the field.
 */
export function validateModuleVariableEnvelope(manifest, moduleId) {
  const errors = [];
  for (const field of MODULE_VARIABLE_ENVELOPE_FIELDS) {
    const value = manifest?.[field];
    const missingOrEmpty =
      value === undefined
      || value === null
      || (typeof value === 'string' && value.trim() === '')
      || (Array.isArray(value) && value.length === 0)
      || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
    if (missingOrEmpty) {
      errors.push(
        `${moduleId}/module.json: module-variable-envelope field "${field}" is missing or empty (all 8 envelope fields are required, P1-T2)`,
      );
    }
  }
  return errors;
}

function collectBooleanFactPaths(condition, paths = new Set()) {
  if (Array.isArray(condition)) {
    for (const child of condition) collectBooleanFactPaths(child, paths);
    return paths;
  }
  if (!condition || typeof condition !== 'object') return paths;

  if (typeof condition.fact === 'string' && /^(history|symptoms|exam)\./.test(condition.fact)) {
    paths.add(condition.fact);
  }
  for (const child of Object.values(condition)) collectBooleanFactPaths(child, paths);
  return paths;
}

export function validateBooleanFactPathAllowList(rules, moduleId) {
  const errors = [];
  for (const rule of rules) {
    for (const factPath of collectBooleanFactPaths(rule.when)) {
      if (!BOOLEAN_FACT_PATH_ALLOW_LIST.has(factPath)) {
        errors.push(`${moduleId}/${rule.id}: unrecognized boolean fact field "${factPath}"`);
      }
    }
  }
  return errors;
}

/**
 * EP3-T4: validate modules/anemia/evidence.json (source + passage records) against
 * schemas/evidence.schema.json, plus the cross-record invariants the schema cannot express on
 * its own (D-EP3-3: passage id uniqueness/well-formedness, exactly-one-sentinel-per-source, the
 * paraphrase-only gate). Returns `{ errors, warnings, passageIndex, sourcesWithPassages }` — the
 * index/set feed the rule- and candidate-level evidence checks in `validateModule` below.
 *
 * Errors are hard failures (D-EP3-3: "every rule resolves; absence is never silent"). Warnings
 * are AC-WP3-RESIL's degrade-not-crash signal for a legacy-shape record encountered mid-migration
 * (a source with no `passages[]`, or a passage missing `sourceLocator`/`exactPassage`/`id`) — the
 * render path (src/evidence.js accessors) degrades those to "locator pending" rather than
 * throwing; this function must do the same rather than crashing while walking them.
 */
export function validateEvidenceDocument(evidenceData, moduleId, evidenceSchema) {
  const errors = [];
  const warnings = [];
  const passageIndex = new Map();
  const sourcesWithPassages = new Set();

  for (const schemaError of validate(evidenceSchema, evidenceData)) {
    errors.push(`${moduleId}/evidence.json: evidence.schema.json ${schemaError.path}: ${schemaError.message}`);
  }

  for (const source of evidenceData.sources ?? []) {
    const sourceLabel = source.id ?? '<missing-id>';
    const passages = Array.isArray(source.passages) ? source.passages : [];
    if (passages.length === 0) {
      warnings.push(`${moduleId}/evidence.json#${sourceLabel}: no passages[] present (legacy-shape source; degrades to "locator pending" downstream)`);
      continue;
    }
    sourcesWithPassages.add(source.id);

    let proposalCount = 0;
    for (const passage of passages) {
      const passageId = typeof passage?.id === 'string' ? passage.id : undefined;
      const passageLabel = passageId ?? `${sourceLabel}#<missing-id>`;

      if (passageId === undefined) {
        warnings.push(`${moduleId}/evidence.json#${passageLabel}: passage missing "id" (legacy-shape record)`);
      } else if (passageIndex.has(passageId)) {
        errors.push(`${moduleId}/evidence.json#${passageId}: duplicate passage id`);
      } else {
        passageIndex.set(passageId, passage);
        const match = PASSAGE_ID_PATTERN.exec(passageId);
        if (!match) {
          errors.push(`${moduleId}/evidence.json#${passageId}: malformed passage id (expected "<sourceId>#<ev_NNN|implementation-proposal>")`);
        } else if (match[1] !== source.id) {
          errors.push(`${moduleId}/evidence.json#${passageId}: passage id's sourceId prefix "${match[1]}" does not match enclosing source "${sourceLabel}"`);
        }
      }

      if (passage?.sourceId !== undefined && passage.sourceId !== source.id) {
        errors.push(`${moduleId}/evidence.json#${passageLabel}: passage.sourceId "${passage.sourceId}" does not match enclosing source "${sourceLabel}"`);
      }

      if (passage?.status === 'implementation-proposal') proposalCount += 1;

      if (!passage?.sourceLocator?.raw) {
        warnings.push(`${moduleId}/evidence.json#${passageLabel}: missing/empty sourceLocator (degrades to "locator pending" downstream)`);
      }
      if (!Object.hasOwn(passage ?? {}, 'exactPassage')) {
        warnings.push(`${moduleId}/evidence.json#${passageLabel}: missing exactPassage (degrades to "locator pending" downstream)`);
      }

      // EP3-T5 (EP3T5-F01): "withheld" is the third legal value alongside "paraphrase" while
      // REG-002 is uncleared — a withheld record has its restricted span replaced by the fixed
      // placeholder at vendor time, so it is not a verbatim-reuse regression.
      if (!REG_002_CLEARED && passage?.passageFidelity !== 'paraphrase' && passage?.passageFidelity !== 'withheld') {
        errors.push(`${moduleId}/evidence.json#${passageLabel}: passageFidelity must be "paraphrase" or "withheld" while REG-002 is uncleared (D-EP3-4/EP3-T5), got "${passage?.passageFidelity}"`);
      }
    }
    if (proposalCount !== 1) {
      errors.push(`${moduleId}/evidence.json#${sourceLabel}: expected exactly one implementation-proposal sentinel, found ${proposalCount}`);
    }
  }

  return { errors, warnings, passageIndex, sourcesWithPassages };
}

/**
 * P3-T3 (FR-12 second half, `02 §4.10`, OQ-3/OQ-7): validate modules/<moduleId>/evidence-assertions.json
 * against schemas/evidence-assertions.schema.json, plus the cross-record invariants the schema
 * cannot express on its own: assertionId uniqueness across the array, per-assertion `rfRunId`
 * agreement with the document's own `rfProvenance.rfRunId` (the schema validates each assertion in
 * isolation and cannot see its siblings or the parent), and `passageId`/`exactPassageSha256`
 * mutual agreement (`psg_<hash>` must be minted from the same digest, never a stray value).
 * Pure function over in-memory data (mirrors validateEvidenceDocument/validateCandidates above),
 * so it is independently unit-testable against a tampered/seeded-bad fixture without touching disk.
 */
export function validateEvidenceAssertions(assertionsData, moduleId, assertionsSchema) {
  const errors = [];

  for (const schemaError of validate(assertionsSchema, assertionsData)) {
    errors.push(`${moduleId}/evidence-assertions.json: evidence-assertions.schema.json ${schemaError.path}: ${schemaError.message}`);
  }

  const assertions = Array.isArray(assertionsData?.assertions) ? assertionsData.assertions : [];
  const documentRfRunId = assertionsData?.rfProvenance?.rfRunId;
  const seenAssertionIds = new Set();

  for (const assertion of assertions) {
    const label = assertion?.assertionId ?? '<missing-assertionId>';

    if (assertion?.assertionId !== undefined) {
      if (seenAssertionIds.has(assertion.assertionId)) {
        errors.push(`${moduleId}/evidence-assertions.json#${label}: duplicate assertionId`);
      }
      seenAssertionIds.add(assertion.assertionId);
    }

    if (documentRfRunId !== undefined && assertion?.rfRunId !== undefined && assertion.rfRunId !== documentRfRunId) {
      errors.push(`${moduleId}/evidence-assertions.json#${label}: rfRunId "${assertion.rfRunId}" does not match the document's rfProvenance.rfRunId "${documentRfRunId}"`);
    }

    if (typeof assertion?.passageId === 'string' && typeof assertion?.exactPassageSha256 === 'string') {
      const expectedPassageId = `psg_${assertion.exactPassageSha256.replace(/^sha256:/, '')}`;
      if (assertion.passageId !== expectedPassageId) {
        errors.push(`${moduleId}/evidence-assertions.json#${label}: passageId "${assertion.passageId}" is not minted from exactPassageSha256 (expected "${expectedPassageId}")`);
      }
    }
  }

  return { errors, assertionCount: assertions.length };
}

/**
 * P3-T4 (FR-13/FR-14, `02 §4.11`/`02 §4.12`): validate modules/<moduleId>/authoring-decisions.yaml
 * (already parsed to a plain JS object, per parseYamlDocument) against
 * schemas/authoring-decisions.schema.json, plus the one cross-record invariant the schema cannot
 * express on its own: decision_id uniqueness across the array, and each decision's own `module_id`
 * agreeing with the document's own top-level `moduleId` (the schema validates each decision in
 * isolation and cannot see its siblings or the parent — same shape of gap
 * validateEvidenceAssertions closes for evidence-assertions.json above). Pure function over
 * in-memory data, so it is independently unit-testable against a tampered/seeded-bad fixture
 * without touching disk.
 */
export function validateAuthoringDecisions(decisionsData, moduleId, decisionsSchema) {
  const errors = [];

  for (const schemaError of validate(decisionsSchema, decisionsData)) {
    errors.push(`${moduleId}/authoring-decisions.yaml: authoring-decisions.schema.json ${schemaError.path}: ${schemaError.message}`);
  }

  const decisions = Array.isArray(decisionsData?.decisions) ? decisionsData.decisions : [];
  const documentModuleId = decisionsData?.moduleId;
  const seenDecisionIds = new Set();

  for (const decision of decisions) {
    const label = decision?.decision_id ?? '<missing-decision_id>';

    if (decision?.decision_id !== undefined) {
      if (seenDecisionIds.has(decision.decision_id)) {
        errors.push(`${moduleId}/authoring-decisions.yaml#${label}: duplicate decision_id`);
      }
      seenDecisionIds.add(decision.decision_id);
    }

    if (documentModuleId !== undefined && decision?.module_id !== undefined && decision.module_id !== documentModuleId) {
      errors.push(`${moduleId}/authoring-decisions.yaml#${label}: module_id "${decision.module_id}" does not match the document's top-level moduleId "${documentModuleId}"`);
    }
  }

  return { errors, decisionCount: decisions.length };
}

/**
 * P3-T6 (FR-15, `02 §4.13`): validate modules/<moduleId>/rule-provenance.json against
 * schemas/rule-provenance.schema.json, plus the cross-record invariants the schema cannot express
 * on its own: `ruleId` uniqueness across the array, and each entry's own `moduleId` agreeing with
 * the document's own top-level `moduleId` (same shape of gap validateEvidenceAssertions/
 * validateAuthoringDecisions close for their own artifacts above). Pure function over in-memory
 * data, so it is independently unit-testable against a tampered/seeded-bad fixture without
 * touching disk.
 */
export function validateRuleProvenance(provenanceData, moduleId, provenanceSchema) {
  const errors = [];

  for (const schemaError of validate(provenanceSchema, provenanceData)) {
    errors.push(`${moduleId}/rule-provenance.json: rule-provenance.schema.json ${schemaError.path}: ${schemaError.message}`);
  }

  const entries = Array.isArray(provenanceData?.entries) ? provenanceData.entries : [];
  const documentModuleId = provenanceData?.moduleId;
  const seenRuleIds = new Set();

  for (const entry of entries) {
    const label = entry?.ruleId ?? '<missing-ruleId>';

    if (entry?.ruleId !== undefined) {
      if (seenRuleIds.has(entry.ruleId)) {
        errors.push(`${moduleId}/rule-provenance.json#${label}: duplicate ruleId`);
      }
      seenRuleIds.add(entry.ruleId);
    }

    if (documentModuleId !== undefined && entry?.moduleId !== undefined && entry.moduleId !== documentModuleId) {
      errors.push(`${moduleId}/rule-provenance.json#${label}: moduleId "${entry.moduleId}" does not match the document's top-level moduleId "${documentModuleId}"`);
    }
  }

  return { errors, entryCount: entries.length };
}

/**
 * P5-T1 (FR-18, `02 §4.18` minus the `signature` block): validate one already-parsed
 * `release-manifest.unsigned.json` document against `schemas/release-manifest.schema.json`, plus
 * the two cross-record invariants the schema cannot express on its own: the document's own
 * `moduleId`/`packVersion` must agree with the `build/kb-pack/<moduleId>/<packVersion>/` directory
 * it was actually found under (the schema validates the document in isolation and has no
 * filesystem access — same shape of gap `validateEvidenceAssertions`/`validateAuthoringDecisions`/
 * `validateRuleProvenance` close for their own artifacts above). Pure function over in-memory
 * data, so it is independently unit-testable against a tampered/seeded-bad fixture without
 * touching disk.
 */
export function validateReleaseManifest(manifestData, manifestSchema, { expectedModuleId, expectedPackVersion } = {}) {
  const errors = [];

  for (const schemaError of validate(manifestSchema, manifestData)) {
    errors.push(`release-manifest.unsigned.json: release-manifest.schema.json ${schemaError.path}: ${schemaError.message}`);
  }

  if (
    expectedModuleId !== undefined
    && manifestData?.moduleId !== undefined
    && manifestData.moduleId !== expectedModuleId
  ) {
    errors.push(
      `release-manifest.unsigned.json: moduleId "${manifestData.moduleId}" does not match its own ` +
        `build/kb-pack/ directory "${expectedModuleId}"`,
    );
  }
  if (
    expectedPackVersion !== undefined
    && manifestData?.packVersion !== undefined
    && manifestData.packVersion !== expectedPackVersion
  ) {
    errors.push(
      `release-manifest.unsigned.json: packVersion "${manifestData.packVersion}" does not match its own ` +
        `build/kb-pack/ pack-version directory "${expectedPackVersion}"`,
    );
  }

  return { errors };
}

/**
 * P5-T1: existence-gated across the ENTIRE `build/kb-pack/` tree, not per registered module (unlike
 * `evidence-assertions.json`/`authoring-decisions.yaml`/`rule-provenance.json` above) — this
 * artifact lives at `build/kb-pack/<moduleId>/<packVersion>/`, not `modules/<moduleId>/`, because
 * `build/kb-pack/` is gitignored/ephemeral staging output (P1-T7). In a clean checkout the whole
 * directory usually does not exist at all, and that absence is not itself an error; when a
 * `propose` run HAS populated it, every `release-manifest.unsigned.json` found under it is fully
 * schema- and cross-record-validated (never silently skipped just because it postdates a clean
 * checkout).
 *
 * P3 laundering-fix reachability note (Codex second-opinion review): this function only ever globs
 * for a file literally named `release-manifest.unsigned.json` and schema-validates it against
 * `schemas/release-manifest.schema.json` — the NESTED manifest shape (`tools/release-sign lib/
 * verify.mjs`'s own `checkWrapperManifestBinding` now also enforces this same schema on
 * `candidate.manifest`, wherever `verify` runs). `tools/release-sign sign --out-candidate`'s full
 * WRAPPER document (`packDir`/`manifestPath`/`preimageSha256`/`signature`/`signerPublicKey`/
 * `manifest`) is a structurally distinct shape (`additionalProperties: false` on this schema would
 * reject those extra top-level fields outright) and is never written under `build/kb-pack/` by any
 * code path in this tool — `sign`'s own guard refuses `--out`/`--out-candidate` pointed at the
 * unsigned source path, and every other output path is caller-chosen, off-tree by convention (see
 * `tools/release-sign/README.md`'s own "Verifier surface wired into `npm run validate`" section:
 * full cryptographic `verify` — and therefore this wrapper-binding check — is deliberately never
 * wired into `npm run validate`). Signed-candidate wrapper artifacts are therefore NOT reachable
 * from `npm run validate` today; their absence is not itself an error (same existence-gated posture
 * this whole function already holds), and this note exists so a future task that DOES make them
 * reachable (e.g. a committed `release-candidate.*.json` convention) knows to wire
 * `checkWrapperManifestBinding`-equivalent checks in here rather than re-deriving them.
 *
 * @param {string} rootDir
 * @returns {Promise<Array<{ manifestPath: string, errors: string[] }>>}
 */
export async function validateKbPackReleaseManifests(rootDir) {
  const kbPackRoot = path.join(rootDir, 'build', 'kb-pack');
  const results = [];
  if (!(await fileExists(kbPackRoot))) return results;

  // Lazily loaded on first ACTUAL manifest found — a build/kb-pack/ tree with directories but zero
  // release-manifest.unsigned.json files anywhere (e.g. mid-propose, or a caller's synthetic test
  // fixture that never populates schemas/) must not require schemas/release-manifest.schema.json
  // to exist just to conclude "there was nothing to validate."
  let manifestSchema;

  let moduleDirEntries;
  try {
    moduleDirEntries = await readdir(kbPackRoot, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const moduleDirEntry of moduleDirEntries) {
    if (!moduleDirEntry.isDirectory()) continue;
    const moduleId = moduleDirEntry.name;
    const moduleDir = path.join(kbPackRoot, moduleId);
    const packVersionEntries = await readdir(moduleDir, { withFileTypes: true });

    for (const packVersionEntry of packVersionEntries) {
      if (!packVersionEntry.isDirectory()) continue;
      const packVersion = packVersionEntry.name;
      const manifestPath = path.join(moduleDir, packVersion, 'release-manifest.unsigned.json');
      if (!(await fileExists(manifestPath))) continue; // per-pack existence gate too — a
      // legitimately-not-yet-`propose`d pack-version directory has no manifest yet.

      manifestSchema ??= await readJson(path.join(rootDir, 'schemas', 'release-manifest.schema.json'));
      const manifestData = await readJson(manifestPath);
      const { errors } = validateReleaseManifest(manifestData, manifestSchema, {
        expectedModuleId: moduleId,
        expectedPackVersion: packVersion,
      });
      results.push({ manifestPath: path.relative(rootDir, manifestPath), errors });
    }
  }

  return results;
}

/**
 * P1-T7 (Evidence Foundry E1 Phase 1, FR-6/FR-16, R-P3 seam task): validate one already-parsed
 * `modules/<moduleId>/reviews/<review_id>.yaml` review-record document against
 * `schemas/review-record.schema.json` (P1-T2, canonical five-role model), plus the two
 * cross-record invariants the schema cannot express on its own: the record's own `review_id` must
 * agree with the filename it was found under, and its own `moduleId` must agree with the
 * `modules/<moduleId>/` directory it was found under (the schema validates the document in
 * isolation and has no filesystem access — same shape of gap `validateReleaseManifest` closes for
 * `moduleId`/`packVersion` above). Pure function over in-memory data, independently unit-testable
 * against a tampered/seeded-bad fixture without touching disk.
 *
 * Structural validity proven here never implies clinical validity, safety, or that a named human
 * clinician reviewed anything — see `schemas/review-record.schema.json`'s own top-level
 * description for that standing caveat.
 */
export function validateReviewRecord(recordData, moduleId, reviewId, reviewRecordSchema) {
  const errors = [];
  for (const schemaError of validate(reviewRecordSchema, recordData)) {
    errors.push(`${moduleId}/reviews/${reviewId}.yaml: review-record.schema.json ${schemaError.path}: ${schemaError.message}`);
  }
  if (typeof recordData?.review_id === 'string' && recordData.review_id !== reviewId) {
    errors.push(`${moduleId}/reviews/${reviewId}.yaml: review_id "${recordData.review_id}" does not match its own filename "${reviewId}.yaml"`);
  }
  if (typeof recordData?.moduleId === 'string' && recordData.moduleId !== moduleId) {
    errors.push(`${moduleId}/reviews/${reviewId}.yaml: moduleId "${recordData.moduleId}" does not match the modules/${moduleId}/ directory it was found under`);
  }
  return errors;
}

/**
 * Codex second-opinion review fix (D-4 layer 3, `.claude/worknotes/evidence-foundry-e1-v1/
 * contracts-design.md` §(a)'s "three-layer guarantee"): builds a `reviewerId -> roster entry`
 * lookup from an already-parsed `governance/reviewer-roster.yaml` document. Pure function over
 * in-memory data (mirrors every other `validate*`/`build*` helper in this file), independently
 * unit-testable without touching disk. An entry whose `reviewerId` is not a string is skipped
 * rather than thrown on — `validateReviewerRoster`'s own schema pass is what reports that shape
 * defect; this index only needs to be usable, not itself authoritative on roster shape.
 */
export function buildReviewerRosterIndex(rosterData) {
  const index = new Map();
  const reviewers = Array.isArray(rosterData?.reviewers) ? rosterData.reviewers : [];
  for (const reviewer of reviewers) {
    if (typeof reviewer?.reviewerId === 'string') index.set(reviewer.reviewerId, reviewer);
  }
  return index;
}

/**
 * D-4 layer 3: loads and parses `governance/reviewer-roster.yaml` (if present) into a
 * `reviewerId -> roster entry` index for cross-checking review records. NOT existence-required
 * the way `loadAndValidateReviewerRoster` is for the whole-tree, once-per-run schema check below —
 * a caller here (`validateModuleReviews`) only reaches this when it has at least one review record
 * to cross-check, and an absent roster file must still fail closed on that record (every
 * `reviewerId` is unresolvable) rather than crash. An absent file therefore degrades to an empty
 * index — the same outcome as a present-but-empty `reviewers: []` roster (the current shipped
 * state, FR-3) — never a thrown error.
 */
export async function loadReviewerRosterIndex(rootDir) {
  const rosterPath = path.join(rootDir, 'governance', 'reviewer-roster.yaml');
  if (!(await fileExists(rosterPath))) return new Map();
  const raw = await readFile(rosterPath, 'utf8');
  const rosterData = parseYamlDocument(raw);
  return buildReviewerRosterIndex(rosterData);
}

/**
 * D-4 layer 3 (the gap a codex second-opinion review found: `validateModuleReviews` and
 * `validateReviewerRoster`/`loadAndValidateReviewerRoster` validated review records and the roster
 * independently, with no cross-check between them — a review record naming an unknown `reviewerId`,
 * or a `synthetic: false` record pointing at a `synthetic: true` roster persona, passed
 * `npm run validate` with exit 0). Cross-checks one already-parsed review record against the
 * `rosterIndex` built by `buildReviewerRosterIndex`/`loadReviewerRosterIndex`:
 *
 *   1. `reviewerId` must resolve to a roster entry at all — fail closed on an unknown reviewer,
 *      including the vacuous "roster ships empty" case (FR-3's current shipped state): zero
 *      roster entries + zero review records passes trivially (this function is never called);
 *      zero roster entries + any review record is a hard error every time.
 *   2. the record's own `synthetic` flag must agree with the resolved roster entry's `synthetic`
 *      flag — a `synthetic: true` dry-run persona can never be laundered into a `synthetic: false`
 *      ("real") review act (or vice versa) merely by a record/roster synthetic-flag mismatch.
 *
 * Pure function over in-memory data, independently unit-testable against a tampered/seeded-bad
 * fixture without touching disk (mirrors every other `validate*` helper in this file). Both checks
 * are skipped, not silently passed, when the relevant field is absent/wrong-typed on the record
 * itself — that shape defect is `validateReviewRecord`'s (the schema's) job to report, not this
 * cross-record check's.
 */
export function validateReviewRecordAgainstRoster(recordData, moduleId, reviewId, rosterIndex) {
  const errors = [];
  const reviewerId = recordData?.reviewerId;
  if (typeof reviewerId !== 'string') return errors;

  const rosterEntry = rosterIndex.get(reviewerId);
  if (!rosterEntry) {
    errors.push(
      `${moduleId}/reviews/${reviewId}.yaml: reviewerId "${reviewerId}" does not resolve to any entry in ` +
        'governance/reviewer-roster.yaml (D-4 layer 3 cross-check)',
    );
    return errors;
  }

  const recordSynthetic = recordData?.synthetic;
  const rosterSynthetic = rosterEntry?.synthetic;
  if (
    typeof recordSynthetic === 'boolean'
    && typeof rosterSynthetic === 'boolean'
    && recordSynthetic !== rosterSynthetic
  ) {
    errors.push(
      `${moduleId}/reviews/${reviewId}.yaml: synthetic:${recordSynthetic} record references reviewerId ` +
        `"${reviewerId}", whose governance/reviewer-roster.yaml entry is synthetic:${rosterSynthetic} ` +
        '(D-4 layer 3 cross-check requires the two to agree)',
    );
  }

  return errors;
}

/**
 * P1-T7: existence-gated across `modules/<moduleId>/reviews/` — this directory is NET-NEW (OQ-2
 * store layout, `.claude/worknotes/evidence-foundry-e1-v1/contracts-design.md` §(b)) and no
 * module ships any review-act files yet (P2-T2's CLI is what will eventually write them); its
 * absence, or its presence-but-empty, is not itself an error — same existence-gate posture
 * `evidence-assertions.json`/`authoring-decisions.yaml` already use above. Every `.yaml` file
 * found there IS fully schema- and cross-record-validated, never silently skipped — including,
 * per the codex second-opinion review fix above, the D-4 layer 3 `reviewerId`/roster cross-check
 * (`validateReviewRecordAgainstRoster`), which this function now also runs for every record.
 */
export async function validateModuleReviews(moduleDir, moduleId, rootDir) {
  const reviewsDir = path.join(moduleDir, 'reviews');
  const errors = [];
  let reviewCount = 0;
  if (!(await fileExists(reviewsDir))) return { errors, reviewCount };

  let entries;
  try {
    entries = await readdir(reviewsDir, { withFileTypes: true });
  } catch {
    return { errors, reviewCount };
  }
  const yamlFilenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
    .map((entry) => entry.name)
    .sort();
  if (yamlFilenames.length === 0) return { errors, reviewCount };

  const reviewRecordSchema = await readJson(path.join(rootDir, 'schemas', 'review-record.schema.json'));
  // Loaded once per call, only reached when there's at least one record to cross-check (the
  // existence-gate above already returns early on zero records) — mirrors the ledger load below
  // in `validateModule`, which likewise loads once per module rather than once per rule/candidate.
  const rosterIndex = await loadReviewerRosterIndex(rootDir);
  for (const filename of yamlFilenames) {
    const reviewId = filename.slice(0, -'.yaml'.length);
    const raw = await readFile(path.join(reviewsDir, filename), 'utf8');
    const recordData = parseYamlDocument(raw);
    errors.push(...validateReviewRecord(recordData, moduleId, reviewId, reviewRecordSchema));
    errors.push(...validateReviewRecordAgainstRoster(recordData, moduleId, reviewId, rosterIndex));
    reviewCount += 1;
  }
  return { errors, reviewCount };
}

/**
 * P1-T7: validate one already-parsed `governance/reviewer-roster.yaml` document against
 * `schemas/reviewer-roster.schema.json` (P1-T4), plus the one cross-record invariant the schema
 * cannot express on its own: cross-entry `reviewerId` uniqueness. The schema's own `uniqueItems`
 * on `reviewers[]` only rejects two BYTE-IDENTICAL whole entries — two entries sharing a
 * `reviewerId` but differing in any other field (e.g. a stale duplicate with a different `name`)
 * would pass `uniqueItems` cleanly, which is exactly the gap `schemas/reviewer-roster.schema.json`'s
 * own `reviewerId` field description names as "a P1-T7/P2-T2 validator-wiring concern." Pure
 * function over in-memory data, independently unit-testable without touching disk.
 */
export function validateReviewerRoster(rosterData, rosterSchema) {
  const errors = [];
  for (const schemaError of validate(rosterSchema, rosterData)) {
    errors.push(`governance/reviewer-roster.yaml: reviewer-roster.schema.json ${schemaError.path}: ${schemaError.message}`);
  }

  const reviewers = Array.isArray(rosterData?.reviewers) ? rosterData.reviewers : [];
  const seenReviewerIds = new Set();
  for (const [index, reviewer] of reviewers.entries()) {
    const reviewerId = reviewer?.reviewerId;
    if (typeof reviewerId !== 'string') continue;
    if (seenReviewerIds.has(reviewerId)) {
      errors.push(`governance/reviewer-roster.yaml#reviewers[${index}]: duplicate reviewerId "${reviewerId}"`);
    }
    seenReviewerIds.add(reviewerId);
  }

  return { errors, reviewerCount: reviewers.length };
}

/**
 * P1-T7: reads and validates the ONE committed `governance/reviewer-roster.yaml` file (P1-T4) —
 * NOT existence-gated like the artifacts above, because this file ships committed by P1-T4 and is
 * required infrastructure, not an optional per-module sidecar; a missing roster file is a real
 * configuration error, not a legitimate "not yet authored" state.
 */
export async function loadAndValidateReviewerRoster(rootDir) {
  const rosterSchema = await readJson(path.join(rootDir, 'schemas', 'reviewer-roster.schema.json'));
  const raw = await readFile(path.join(rootDir, 'governance', 'reviewer-roster.yaml'), 'utf8');
  const rosterData = parseYamlDocument(raw);
  return validateReviewerRoster(rosterData, rosterSchema);
}

/**
 * P1-T7: validate one already-parsed `releases/registry.json` document against
 * `schemas/release-registry.schema.json` (P1-T5/OQ-4). No cross-record invariant beyond the
 * schema itself is checked at this task's scope — append-only-ness is a git-history-level
 * invariant `tools/release-sign`'s `register` writer enforces procedurally (P3-T4), not something
 * this single-document check can see. Pure function over in-memory data, independently
 * unit-testable against a tampered/seeded-bad fixture without touching disk.
 */
export function validateReleaseRegistryDocument(registryData, registrySchema) {
  const errors = [];
  for (const schemaError of validate(registrySchema, registryData)) {
    errors.push(`releases/registry.json: release-registry.schema.json ${schemaError.path}: ${schemaError.message}`);
  }
  const entries = Array.isArray(registryData?.entries) ? registryData.entries : [];
  return { errors, entryCount: entries.length };
}

/**
 * P1-T7: existence-gated across the WHOLE `releases/registry.json` file — this task's own
 * acceptance criteria requires the absent-file case to "pass with an explicit note, never a
 * crash": the registry seed file itself does not ship until P3-T4 (schemas/release-registry.schema.json's
 * own top-level description), so in this phase's checkout (and any checkout before P3-T4 lands)
 * the file, and its parent `releases/` directory, do not exist at all. That absence is not itself
 * an error.
 *
 * P3-T6 (FR-18, PRD OQ-2, verifier-surface wiring): once the file IS present, this also runs
 * `tools/release-sign/lib/registry.mjs#checkRegistryHistoryAppendOnly` — the append-only-shape
 * layer 2 git-history walk (see that function's own header) — against the SAME tree `rootDir`
 * points at, so a hand-committed mutation/removal of an existing `releases/registry.json` entry
 * that bypassed the `register` verb entirely now fails `npm run validate`, not just a future
 * `register` invocation. This is a STRUCTURAL check only (read-only `git log`/`git show`, no
 * `node:crypto`, no signature verification) — see tools/release-sign/README.md's "Verifier surface
 * wired into npm run validate" section for the full FR-18/OQ-2 surface-decision rationale: full
 * cryptographic `verify` (Ed25519) is deliberately never invoked from here.
 *
 * The git-history walk itself only runs when `rootDir` is git-tracked (a `.git` entry — file or
 * directory, a git worktree's own `.git` is a file — exists directly under it). This is not a
 * fail-open loophole for the real, committed `releases/registry.json`: `npm run validate` always
 * runs against this repository's own git-tracked root, where `.git` always exists. The gate exists
 * so a synthetic, non-git-initialized tempdir tree built by an unrelated schema-shape test (this
 * function predates P3-T6 and several such tests already call it directly, P1-T7) does not spuriously
 * fail merely because there is no git history at all to walk — "no git repository here" and "a git
 * repository here with zero commits touching this path" both mean the same thing this function's own
 * `{ revisions: 0 }` return already documents: nothing to compare yet, not a violation. Any OTHER git
 * failure (a corrupt repository, git itself missing) is never swallowed here — only `.git`'s own
 * absence short-circuits the walk before it is ever attempted.
 */
export async function loadAndValidateReleaseRegistry(rootDir) {
  const registryPath = path.join(rootDir, 'releases', 'registry.json');
  if (!(await fileExists(registryPath))) {
    return { errors: [], entryCount: 0, present: false };
  }
  const registrySchema = await readJson(path.join(rootDir, 'schemas', 'release-registry.schema.json'));
  const registryData = await readJson(registryPath);
  const documentResult = validateReleaseRegistryDocument(registryData, registrySchema);

  if (await fileExists(path.join(rootDir, '.git'))) {
    try {
      checkRegistryHistoryAppendOnly(rootDir, path.relative(rootDir, registryPath));
    } catch (err) {
      if (!(err instanceof RegistryAppendOnlyViolationError)) throw err;
      documentResult.errors.push(`releases/registry.json (git-history append-only check): ${err.message}`);
    }
  }

  return { ...documentResult, present: true };
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

/**
 * EP3-T5: cross-checks `moduleId`'s evidence.json against fidelity-findings.json's `findings[]`.
 * This is the "no hand-editing drift" guard the audit remediation asked for — it is bidirectional
 * (a stray reference on either side fails) and it checks the flag SET, not just the finding-id
 * set, so a passage cannot carry a `reviewFindingIds` entry whose implied flag was hand-edited
 * away from (or into) `reviewFlags`:
 *
 *   1. every `finding.passageIds` entry resolves to a real passage id in evidenceData
 *   2. every passage's `reviewFindingIds` entry resolves to a real finding id
 *   3. every passage's `reviewFlags` set exactly equals the flags implied by its
 *      `reviewFindingIds` (not just "non-empty" — the specific flags must match)
 *   4. the set of passages carrying non-empty `reviewFlags` exactly equals the set of passage ids
 *      named across all findings (neither a phantom flag nor a silently-dropped finding survives)
 */
export function validateFidelityFindings(evidenceData, findingsData, moduleId) {
  const errors = [];
  const passageIndex = new Map();
  for (const source of evidenceData.sources ?? []) {
    for (const passage of Array.isArray(source.passages) ? source.passages : []) {
      if (typeof passage?.id === 'string') passageIndex.set(passage.id, passage);
    }
  }

  const findingsById = new Map();
  const impliedFlaggedPassageIds = new Set();
  for (const finding of findingsData.findings ?? []) {
    findingsById.set(finding.id, finding);
    for (const passageId of finding.passageIds ?? []) {
      impliedFlaggedPassageIds.add(passageId);
      if (!passageIndex.has(passageId)) {
        errors.push(`${moduleId}/fidelity-findings.json#${finding.id}: passageIds references unknown passage "${passageId}"`);
      }
    }
  }

  const actualFlaggedPassageIds = new Set();
  for (const [passageId, passage] of passageIndex) {
    const reviewFindingIds = Array.isArray(passage.reviewFindingIds) ? passage.reviewFindingIds : [];
    const expectedFlags = new Set();
    for (const findingId of reviewFindingIds) {
      const finding = findingsById.get(findingId);
      if (!finding) {
        errors.push(`${moduleId}/evidence.json#${passageId}: reviewFindingIds references unknown finding "${findingId}"`);
        continue;
      }
      expectedFlags.add(finding.flag);
    }
    const actualFlags = new Set(Array.isArray(passage.reviewFlags) ? passage.reviewFlags : []);
    if (!setsEqual(expectedFlags, actualFlags)) {
      errors.push(`${moduleId}/evidence.json#${passageId}: reviewFlags ${JSON.stringify([...actualFlags].sort())} does not match the flags implied by reviewFindingIds ${JSON.stringify([...expectedFlags].sort())}`);
    }
    if (actualFlags.size > 0) actualFlaggedPassageIds.add(passageId);
  }

  for (const passageId of impliedFlaggedPassageIds) {
    if (!actualFlaggedPassageIds.has(passageId)) {
      errors.push(`${moduleId}/evidence.json#${passageId}: fidelity-findings.json implies this passage should carry reviewFlags, but it has none (hand-editing drift)`);
    }
  }
  for (const passageId of actualFlaggedPassageIds) {
    if (!impliedFlaggedPassageIds.has(passageId)) {
      errors.push(`${moduleId}/evidence.json#${passageId}: passage carries reviewFlags but is not named by any finding in fidelity-findings.json (hand-editing drift)`);
    }
  }

  return errors;
}

/**
 * FIX-C (EP3-T4): validates modules/<moduleId>/candidates.json against candidate.schema.json
 * (including the required `sourcePassageId` key it now carries) and resolves each candidate's
 * ACTUAL sourcePassageId pointer against `passageIndex` — not merely "the cited source has some
 * passage record," which is all the pre-existing evidence[]-reference check below proves. Pure
 * function over in-memory data (mirrors validateEvidenceDocument/validateFidelityFindings above),
 * so it is independently unit-testable against a tampered candidate without touching disk.
 *
 * Returns `{ errors, candidatePassageStatusCounts }` — candidatePassageStatusCounts mirrors
 * validateModule's rulePassageStatusCounts shape exactly.
 */
export function validateCandidates(candidates, moduleId, { candidateSchema, evidenceIds, sourcesWithPassages, passageIndex }) {
  const errors = [];
  const candidatePassageStatusCounts = { 'source-supported': 0, quarantined: 0, 'implementation-proposal': 0, unresolved: 0 };

  for (const [id, candidate] of Object.entries(candidates)) {
    if (candidate.id !== id) errors.push(`${moduleId}/: Candidate key/id mismatch: ${id}`);
    for (const schemaError of validate(candidateSchema, candidate)) {
      errors.push(`${moduleId}/${id}: candidate.schema.json ${schemaError.path}: ${schemaError.message}`);
    }
    for (const evidenceId of candidate.evidence ?? []) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`${moduleId}/${id}: unknown evidence ${evidenceId}`);
      } else if (!sourcesWithPassages.has(evidenceId)) {
        errors.push(`${moduleId}/${id}: evidence ${evidenceId} carries no passage records`);
      }
    }

    // Validate the ACTUAL candidate pointer — not "the cited source has some passage" (the gap
    // this fix closes). Mirrors the rule-level sourcePassageId resolution check in validateModule
    // exactly, including the same D-EP3-6 fallback-is-not-an-error treatment for
    // implementation-proposal.
    if (Object.hasOwn(candidate, 'sourcePassageId') && candidate.sourcePassageId != null) {
      const boundPassage = passageIndex.get(candidate.sourcePassageId);
      if (!boundPassage) {
        errors.push(`${moduleId}/${id}: sourcePassageId "${candidate.sourcePassageId}" does not resolve to a known passage`);
        candidatePassageStatusCounts.unresolved += 1;
      } else if (boundPassage.status !== 'implementation-proposal' && !isBindableAsSourceSupported(boundPassage)) {
        errors.push(`${moduleId}/${id}: sourcePassageId "${candidate.sourcePassageId}" resolves to a passage with status "${boundPassage.status}" (reviewFlags: ${JSON.stringify(boundPassage.reviewFlags ?? [])}) and cannot be bound as source-supported grounding (EP3-T5 binding rule)`);
        candidatePassageStatusCounts[boundPassage.status] = (candidatePassageStatusCounts[boundPassage.status] ?? 0) + 1;
      } else {
        candidatePassageStatusCounts[boundPassage.status] = (candidatePassageStatusCounts[boundPassage.status] ?? 0) + 1;
      }
    } else {
      errors.push(`${moduleId}/${id}: missing sourcePassageId (required per EP3-T4)`);
      candidatePassageStatusCounts.unresolved += 1;
    }
  }

  return { errors, candidatePassageStatusCounts };
}

export async function validateModule(moduleId, rootDir) {
  const moduleDir = path.join(rootDir, 'modules', moduleId);
  const errors = [];
  const warnings = [];

  const ruleSchema = await readJson(path.join(rootDir, 'schemas', 'rule.schema.json'));
  const candidateSchema = await readJson(path.join(rootDir, 'schemas', 'candidate.schema.json'));
  const evidenceSchema = await readJson(path.join(rootDir, 'schemas', 'evidence.schema.json'));
  const manifestSchema = await readJson(path.join(rootDir, 'schemas', 'module-manifest.schema.json'));
  const rules = await readJson(path.join(moduleDir, 'rules.json'));
  const candidates = await readJson(path.join(moduleDir, 'candidates.json'));
  // Read the module's evidence.json directly. This is the only evidence source now (DEF-1,
  // docs/project_plans/design-specs/evidence-dual-source-unification.md): src/evidence.js is a
  // thin loader over this same file, not a second hand-maintained copy, so there is nothing
  // left for it to drift against.
  const evidenceData = await readJson(path.join(moduleDir, 'evidence.json'));
  const evidenceIds = new Set((evidenceData.sources ?? []).map((source) => source.id));

  // EP3-T4: full passage-level validation (schema + cross-record invariants). `passageIndex`
  // feeds the rule-level sourcePassageId resolution check below; `sourcesWithPassages` feeds the
  // rule/candidate evidence-reference check (a cited source must exist AND carry >=1 passage).
  const evidenceValidation = validateEvidenceDocument(evidenceData, moduleId, evidenceSchema);
  errors.push(...evidenceValidation.errors);
  warnings.push(...evidenceValidation.warnings);
  const { passageIndex, sourcesWithPassages } = evidenceValidation;

  // EP3-T5: fidelity-findings.json is specific to the RF-EV-001 bundle backing the anemia
  // module's evidence.json (mirrors src/modules/registry.js's own "revisit the day a second
  // module is registered" note on DEFAULT_MODULE_ID) — extend this gate the day a second module
  // ships its own evidence-pack + findings file.
  if (moduleId === 'anemia') {
    const fidelityFindingsPath = path.join(rootDir, 'evidence-packs', 'rf-ev-001', 'fidelity-findings.json');
    const fidelityFindings = await readJson(fidelityFindingsPath);
    errors.push(...validateFidelityFindings(evidenceData, fidelityFindings, moduleId));
  }

  // P3-T3: existence-gated — modules/anemia/ predates this artifact type and has no
  // evidence-assertions.json; its absence there is not an error. Any module directory that DOES
  // carry the file (modules/cbc_suite_v1/ onward) gets full schema + cross-record validation.
  let evidenceAssertionsCount = 0;
  const evidenceAssertionsPath = path.join(moduleDir, 'evidence-assertions.json');
  if (await fileExists(evidenceAssertionsPath)) {
    const evidenceAssertionsSchema = await readJson(path.join(rootDir, 'schemas', 'evidence-assertions.schema.json'));
    const evidenceAssertionsData = await readJson(evidenceAssertionsPath);
    const assertionValidation = validateEvidenceAssertions(evidenceAssertionsData, moduleId, evidenceAssertionsSchema);
    errors.push(...assertionValidation.errors);
    evidenceAssertionsCount = assertionValidation.assertionCount;
  }

  // P3-T4: existence-gated, same rationale as evidence-assertions.json above — modules/anemia/
  // predates authoring-decisions.yaml and has no such file; its absence there is not an error.
  // Any module directory that DOES carry the file (modules/cbc_suite_v1/ onward) gets full
  // schema + cross-record validation, parsed via the converter's own yaml-lite parser.
  let authoringDecisionsCount = 0;
  const authoringDecisionsPath = path.join(moduleDir, 'authoring-decisions.yaml');
  if (await fileExists(authoringDecisionsPath)) {
    const authoringDecisionsSchema = await readJson(path.join(rootDir, 'schemas', 'authoring-decisions.schema.json'));
    const authoringDecisionsRaw = await readFile(authoringDecisionsPath, 'utf8');
    const authoringDecisionsData = parseYamlDocument(authoringDecisionsRaw);
    const decisionsValidation = validateAuthoringDecisions(authoringDecisionsData, moduleId, authoringDecisionsSchema);
    errors.push(...decisionsValidation.errors);
    authoringDecisionsCount = decisionsValidation.decisionCount;
  }

  // P3-T6: existence-gated, same rationale as evidence-assertions.json/authoring-decisions.yaml
  // above — modules/anemia/ predates rule-provenance.json and has no such file; its absence there
  // is not an error. Phase 3 stages this file only under build/kb-pack/ (P3-T7's `propose` verb);
  // Phase 4 (P4-T1..T4) migrates it into modules/cbc_suite_v1/ itself, at which point this block
  // starts exercising it for real without any further wiring changes.
  let ruleProvenanceCount = 0;
  const ruleProvenancePath = path.join(moduleDir, 'rule-provenance.json');
  if (await fileExists(ruleProvenancePath)) {
    const ruleProvenanceSchema = await readJson(path.join(rootDir, 'schemas', 'rule-provenance.schema.json'));
    const ruleProvenanceData = await readJson(ruleProvenancePath);
    const ruleProvenanceValidation = validateRuleProvenance(ruleProvenanceData, moduleId, ruleProvenanceSchema);
    errors.push(...ruleProvenanceValidation.errors);
    ruleProvenanceCount = ruleProvenanceValidation.entryCount;
  }

  errors.push(...validateBooleanFactPathAllowList(rules, moduleId));

  const ruleIds = new Set();
  let rulesMissingSourcePassageId = 0;
  // Reviewer-gate fix-5 (finding 3, scope-bounded): "a rule's sourcePassageId must resolve to a
  // real passage record, and its status must be reported" — not just "the cited source has SOME
  // passage." rulePassageStatusCounts tallies the RESOLVED passage's own `status` (not the rule's
  // evidence[] citation) across all 91 rules, surfaced in validateModule's return value and in the
  // console summary below, so a reviewer can see the actual source-supported/quarantined/
  // implementation-proposal split this validator proved, at a glance.
  const rulePassageStatusCounts = { 'source-supported': 0, quarantined: 0, 'implementation-proposal': 0, unresolved: 0 };
  for (const rule of rules) {
    const ruleLabel = rule.id ?? '<missing-id>';
    for (const schemaError of validate(ruleSchema, rule)) {
      errors.push(`${moduleId}/${ruleLabel}: rule.schema.json ${schemaError.path}: ${schemaError.message}`);
    }
    if (!rule.id) errors.push(`${moduleId}/: Rule missing id`);
    if (ruleIds.has(rule.id)) errors.push(`${moduleId}/${rule.id}: Duplicate rule id`);
    ruleIds.add(rule.id);
    try {
      evaluateCondition(rule.when, {});
    } catch (error) {
      errors.push(`${moduleId}/${rule.id}: ${error.message}`);
    }
    for (const evidenceId of rule.evidence ?? []) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`${moduleId}/${rule.id}: unknown evidence ${evidenceId}`);
      } else if (!sourcesWithPassages.has(evidenceId)) {
        errors.push(`${moduleId}/${rule.id}: evidence ${evidenceId} carries no passage records`);
      }
    }
    if (rule.output?.type === 'candidate' && !candidates[rule.output.candidateId]) {
      errors.push(`${moduleId}/${rule.id}: unknown candidate ${rule.output.candidateId}`);
    }

    // EP4-T2 (scripts/evidence/backfill-rule-governance.mjs) has landed: every rule carries a
    // present, non-null `sourcePassageId` (D-EP3-3/D-EP3-6) — hard error if it does not resolve to
    // a real passage id. D-EP3-3's fallback design means a resolved passage is legitimately EITHER
    // a `source-supported` passage (which must ALSO pass the EP3-T5 binding rule, src/evidence.js#
    // isBindableAsSourceSupported — the one shared predicate this check and EP-4's rule->passage
    // binder both call) OR the source's minted `implementation-proposal` sentinel, which is by
    // definition never "bindable as source-supported" and must NOT be rejected for that reason —
    // it is the honest, conservative fallback D-EP3-6 exists to make possible.
    if (Object.hasOwn(rule, 'sourcePassageId') && rule.sourcePassageId != null) {
      const boundPassage = passageIndex.get(rule.sourcePassageId);
      if (!boundPassage) {
        errors.push(`${moduleId}/${rule.id}: sourcePassageId "${rule.sourcePassageId}" does not resolve to a known passage`);
        rulePassageStatusCounts.unresolved += 1;
      } else if (boundPassage.status !== 'implementation-proposal' && !isBindableAsSourceSupported(boundPassage)) {
        errors.push(`${moduleId}/${rule.id}: sourcePassageId "${rule.sourcePassageId}" resolves to a passage with status "${boundPassage.status}" (reviewFlags: ${JSON.stringify(boundPassage.reviewFlags ?? [])}) and cannot be bound as source-supported grounding (EP3-T5 binding rule)`);
        rulePassageStatusCounts[boundPassage.status] = (rulePassageStatusCounts[boundPassage.status] ?? 0) + 1;
      } else {
        rulePassageStatusCounts[boundPassage.status] = (rulePassageStatusCounts[boundPassage.status] ?? 0) + 1;
      }
    } else {
      rulesMissingSourcePassageId += 1;
      if (REQUIRE_RULE_SOURCE_PASSAGE_ID) {
        errors.push(`${moduleId}/${rule.id}: missing sourcePassageId (required once EP-4 lands)`);
      }
    }
  }

  // Reviewer gate, third pass (2026-07-21): the attestation gate used to live only inside the
  // backfill scripts, so a hand-edited rules.json could point a rule at a clean source-supported
  // passage and pass validation with exit 0 — the reviewer demonstrated exactly that, including a
  // CROSS-SOURCE binding (a rule citing WHO grounded to a BLOOD passage). Both holes are closed
  // here, against the committed data rather than against the generator's code path.
  const ledger = loadAttestationLedger();
  errors.push(...validateBindingsAgainstLedger({
    moduleId, entities: rules, idField: 'ruleId', attestations: ledger.rules,
    passageIndex, isBindableAsSourceSupported,
  }));
  errors.push(...validateBindingsAgainstLedger({
    moduleId,
    entities: Object.entries(candidates).map(([id, c]) => ({ ...c, id })),
    idField: 'candidateId', attestations: ledger.candidates,
    passageIndex, isBindableAsSourceSupported,
  }));
  if (!REQUIRE_RULE_SOURCE_PASSAGE_ID && rulesMissingSourcePassageId > 0) {
    warnings.push(`${moduleId}: ${rulesMissingSourcePassageId}/${rules.length} rule(s) lack sourcePassageId (tolerated pending EP-4; expect 0 once EP4-T2 lands)`);
  }

  // FIX-C (EP3-T4): candidates now carry the same passage-level pointer rules got in EP-4 — a
  // rule's evidence[] citing a source with SOME passage record is not the same claim as "this
  // candidate's evidence resolves to a specific passage/proposal." validateCandidates is a pure
  // function (mirrors validateEvidenceDocument/validateFidelityFindings above) precisely so it is
  // unit-testable against a tampered in-memory candidate without touching disk.
  const candidateValidation = validateCandidates(candidates, moduleId, {
    candidateSchema, evidenceIds, sourcesWithPassages, passageIndex,
  });
  errors.push(...candidateValidation.errors);
  const { candidatePassageStatusCounts } = candidateValidation;

  // module.json (manifest) is a required per-module file as of Phase 6 (P6-T1). It is read
  // directly here so this check catches an unparsable/missing manifest as a validation error
  // rather than a silent gap.
  //
  // EP5-T2 (DEF-5): the manifest's shape — field presence/types, the SPIKE-006 RQ4 `status`
  // enum, the two-part digest pattern, and the AC-WP5-RESIL must-not-be-empty-vs-legitimately-
  // empty distinction (via schemas/module-manifest.schema.json's `allOf`/`if`/`then`/`else`) — is
  // now governed by that schema, superseding the ad-hoc field-presence checks that used to live
  // only here. What the schema genuinely cannot express is kept here instead: `id` matching the
  // module's own directory name (the schema has no filesystem access) and cross-file version
  // agreement with src/evidence.js (DEF-1's drift check, already removed above — see the comment
  // a few lines down).
  const manifest = await readJson(path.join(moduleDir, 'module.json'));
  for (const schemaError of validate(manifestSchema, manifest)) {
    errors.push(`${moduleId}/module.json: module-manifest.schema.json ${schemaError.path}: ${schemaError.message}`);
  }
  if (manifest.id !== moduleId) {
    errors.push(`${moduleId}/module.json: id "${manifest.id}" does not match directory name "${moduleId}"`);
  }

  // P1-T2 (evidence-foundry-buildout Phase 1): every module manifest must carry the 8
  // module-variable-envelope fields — EXCEPT modules/anemia, whose module.json predates the
  // envelope (legacy pre-envelope shape, explicitly exempt and must remain valid as-is). Every
  // FUTURE module (cbc_suite_v1 onward) must declare the full envelope; a missing/empty field is
  // a hard validation error naming that field. Field-presence + non-empty only, per the OQ-7
  // ruling (binding) — no new schema file governs these fields yet.
  if (moduleId !== 'anemia') {
    errors.push(...validateModuleVariableEnvelope(manifest, moduleId));
  }

  // DEF-1 resolved (docs/project_plans/design-specs/evidence-dual-source-unification.md): the
  // P6-T2 drift check that used to live here — asserting module.json's version fields matched
  // src/evidence.js's exported consts — is removed, not left passing-but-vacuous. It existed to
  // catch drift between the two hand-maintained evidence copies (src/evidence.js and this
  // module's evidence.json). src/evidence.js is now a loader over evidence.json, not a second
  // hand-authored copy, so that drift is structurally impossible: there is no longer a second
  // source for it to diverge from. (module.json's own knowledgeBaseVersion/evidenceReviewedThrough
  // stub fields can still go stale relative to evidence.json, but that is a manifest-currency
  // concern for the Phase 1 signed-manifest work — this spec's promotion trigger — not the
  // dual-source problem this check was built for, so no replacement check is added here.)

  const passageCount = (evidenceData.sources ?? []).reduce(
    (sum, source) => sum + (Array.isArray(source.passages) ? source.passages.length : 0),
    0,
  );

  // P1-T7 (Evidence Foundry E1 Phase 1, FR-6/R-P3 seam task): modules/<moduleId>/reviews/*.yaml is
  // a NET-NEW, existence-gated artifact directory (OQ-2 store layout) — no module ships any
  // review-act files yet. validateModuleReviews handles the existence gate itself; every file
  // found there IS fully schema- and cross-record-validated against schemas/review-record.schema.json.
  const reviewsValidation = await validateModuleReviews(moduleDir, moduleId, rootDir);
  errors.push(...reviewsValidation.errors);
  const reviewRecordCount = reviewsValidation.reviewCount;

  return {
    moduleId,
    errors,
    warnings,
    ruleCount: rules.length,
    candidateCount: Object.keys(candidates).length,
    evidenceCount: evidenceIds.size,
    passageCount,
    rulePassageStatusCounts,
    candidatePassageStatusCounts,
    evidenceAssertionsCount,
    authoringDecisionsCount,
    ruleProvenanceCount,
    reviewRecordCount,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const results = await Promise.all(MODULE_IDS.map((moduleId) => validateModule(moduleId, root)));
  // P5-T1: existence-gated across build/kb-pack/ as a whole (see validateKbPackReleaseManifests's
  // own doc comment) — this is NOT one of the MODULE_IDS-scoped checks above because the artifact
  // it validates does not live under modules/<id>/ at all.
  const kbPackManifestResults = await validateKbPackReleaseManifests(root);
  // P1-T7: whole-tree, once-per-run checks (not per MODULE_IDS entry) — governance/reviewer-roster.yaml
  // is a single committed file (P1-T4); releases/registry.json is existence-gated across the whole
  // tree, the same posture build/kb-pack/ above uses (it does not ship until P3-T4).
  const reviewerRosterResult = await loadAndValidateReviewerRoster(root);
  const releaseRegistryResult = await loadAndValidateReleaseRegistry(root);
  const allErrors = [
    ...results.flatMap((result) => result.errors),
    ...kbPackManifestResults.flatMap((result) => result.errors),
    ...reviewerRosterResult.errors,
    ...releaseRegistryResult.errors,
  ];
  const allWarnings = results.flatMap((result) => result.warnings);

  // Warnings never gate `npm run validate` (AC-WP3-RESIL: a legacy-shape record degrades, it does
  // not fail the build) — they are always printed so a reviewer sees exactly what degraded.
  if (allWarnings.length) {
    console.warn(`${allWarnings.length} warning(s):\n${allWarnings.join('\n')}`);
  }

  if (allErrors.length) {
    console.error(allErrors.join('\n'));
    process.exitCode = 1;
  } else {
    const summary = results
      .map(
        (result) =>
          `${result.moduleId} (${result.ruleCount} rules, ${result.candidateCount} candidates, ${result.evidenceCount} evidence records, ${result.passageCount} passage records`
          + `${result.evidenceAssertionsCount ? `, ${result.evidenceAssertionsCount} evidence-assertions` : ''}`
          + `${result.authoringDecisionsCount ? `, ${result.authoringDecisionsCount} authoring-decisions` : ''}`
          + `${result.ruleProvenanceCount ? `, ${result.ruleProvenanceCount} rule-provenance entries` : ''}`
          + `${result.reviewRecordCount ? `, ${result.reviewRecordCount} review records` : ''})`,
      )
      .join(', ');
    console.log(`Validated modules: ${summary}.`);
    if (kbPackManifestResults.length > 0) {
      console.log(
        `build/kb-pack/: validated ${kbPackManifestResults.length} release-manifest.unsigned.json file(s).`,
      );
    }
    // P1-T7: always printed (not gated on a >0 count) — an empty roster/absent registry is the
    // expected, honest state pre-G1/pre-P3-T4, not a silent no-op.
    console.log(`governance/reviewer-roster.yaml: validated ${reviewerRosterResult.reviewerCount} reviewer(s).`);
    console.log(
      releaseRegistryResult.present
        ? `releases/registry.json: validated ${releaseRegistryResult.entryCount} entrie(s).`
        : 'releases/registry.json: not yet seeded (absent) — expected pre-P3-T4, not an error.',
    );

    // Reviewer-gate fix-5: report the RESOLVED sourcePassageId status split (not just "resolves to
    // some passage") so a reviewer can see at a glance how many rules actually claim source-supported
    // grounding versus falling back to a proposal sentinel.
    for (const result of results) {
      const c = result.rulePassageStatusCounts;
      console.log(
        `${result.moduleId}: rule sourcePassageId status split — ${c['source-supported']} source-supported, `
        + `${c.quarantined} quarantined, ${c['implementation-proposal']} implementation-proposal`
        + `${c.unresolved ? `, ${c.unresolved} unresolved` : ''}.`,
      );
      // FIX-C: the same resolved-status split, for candidates — proves the actual candidate
      // pointer was validated, not merely "the cited source has some passage."
      const cc = result.candidatePassageStatusCounts;
      console.log(
        `${result.moduleId}: candidate sourcePassageId status split — ${cc['source-supported']} source-supported, `
        + `${cc.quarantined} quarantined, ${cc['implementation-proposal']} implementation-proposal`
        + `${cc.unresolved ? `, ${cc.unresolved} unresolved` : ''}.`,
      );
    }
  }
}
