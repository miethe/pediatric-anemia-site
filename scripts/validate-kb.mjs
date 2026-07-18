import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCondition } from '../src/ruleEngine.js';
import { MODULE_IDS } from '../src/modules/registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function validateModule(moduleId, rootDir) {
  const moduleDir = path.join(rootDir, 'modules', moduleId);
  const errors = [];

  const rules = await readJson(path.join(moduleDir, 'rules.json'));
  const candidates = await readJson(path.join(moduleDir, 'candidates.json'));
  // Read the module's own evidence.json directly rather than importing src/evidence.js —
  // this collapses one instance of the evidence dual-source problem (DEF-1); the full
  // drift check against src/evidence.js's exported consts is added in Phase 6 (P6-T2).
  const evidenceData = await readJson(path.join(moduleDir, 'evidence.json'));
  const evidenceIds = new Set((evidenceData.sources ?? []).map((source) => source.id));

  const ruleIds = new Set();
  for (const rule of rules) {
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

  // module.json (manifest) does not exist until Phase 6
  // (platform-foundation-p0-v1.md, Phase 6: Module Manifest Stub, P6-T1) — tolerate its
  // absence here and only shape-check `id` against the directory name when it is present.
  // P6-T3 extends tests/module-registry.test.mjs with the corresponding assertion.
  const manifest = await readJsonIfExists(path.join(moduleDir, 'module.json'));
  if (manifest && manifest.id !== moduleId) {
    errors.push(`${moduleId}/module.json: id "${manifest.id}" does not match directory name "${moduleId}"`);
  }

  return {
    moduleId,
    errors,
    ruleCount: rules.length,
    candidateCount: Object.keys(candidates).length,
    evidenceCount: evidenceIds.size,
  };
}

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
