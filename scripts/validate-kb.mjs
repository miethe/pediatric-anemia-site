import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCondition } from '../src/ruleEngine.js';
import { MODULE_IDS } from '../src/modules/registry.js';
import { validate } from './lib/json-schema-lite.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

export async function validateModule(moduleId, rootDir) {
  const moduleDir = path.join(rootDir, 'modules', moduleId);
  const errors = [];

  const ruleSchema = await readJson(path.join(rootDir, 'schemas', 'rule.schema.json'));
  const rules = await readJson(path.join(moduleDir, 'rules.json'));
  const candidates = await readJson(path.join(moduleDir, 'candidates.json'));
  // Read the module's evidence.json directly. This is the only evidence source now (DEF-1,
  // docs/project_plans/design-specs/evidence-dual-source-unification.md): src/evidence.js is a
  // thin loader over this same file, not a second hand-maintained copy, so there is nothing
  // left for it to drift against.
  const evidenceData = await readJson(path.join(moduleDir, 'evidence.json'));
  const evidenceIds = new Set((evidenceData.sources ?? []).map((source) => source.id));

  errors.push(...validateBooleanFactPathAllowList(rules, moduleId));

  const ruleIds = new Set();
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
      if (!evidenceIds.has(evidenceId)) errors.push(`${moduleId}/${rule.id}: unknown evidence ${evidenceId}`);
    }
    if (rule.output?.type === 'candidate' && !candidates[rule.output.candidateId]) {
      errors.push(`${moduleId}/${rule.id}: unknown candidate ${rule.output.candidateId}`);
    }
  }

  for (const [id, candidate] of Object.entries(candidates)) {
    if (candidate.id !== id) errors.push(`${moduleId}/: Candidate key/id mismatch: ${id}`);
    for (const evidenceId of candidate.evidence ?? []) {
      if (!evidenceIds.has(evidenceId)) errors.push(`${moduleId}/${id}: unknown evidence ${evidenceId}`);
    }
  }

  // module.json (manifest) is a required per-module file as of Phase 6 (P6-T1). It is read
  // directly here so this check catches an unparsable/missing manifest as a validation error
  // rather than a silent gap.
  const manifest = await readJson(path.join(moduleDir, 'module.json'));
  if (manifest.id !== moduleId) {
    errors.push(`${moduleId}/module.json: id "${manifest.id}" does not match directory name "${moduleId}"`);
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

  return {
    moduleId,
    errors,
    ruleCount: rules.length,
    candidateCount: Object.keys(candidates).length,
    evidenceCount: evidenceIds.size,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const results = await Promise.all(MODULE_IDS.map((moduleId) => validateModule(moduleId, root)));
  const allErrors = results.flatMap((result) => result.errors);

  if (allErrors.length) {
    console.error(allErrors.join('\n'));
    process.exitCode = 1;
  } else {
    const summary = results
      .map(
        (result) =>
          `${result.moduleId} (${result.ruleCount} rules, ${result.candidateCount} candidates, ${result.evidenceCount} evidence records)`,
      )
      .join(', ');
    console.log(`Validated modules: ${summary}.`);
  }
}
