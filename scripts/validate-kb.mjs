import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCondition } from '../src/ruleEngine.js';
import { MODULE_IDS } from '../src/modules/registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function validateModule(moduleId, rootDir) {
  const moduleDir = path.join(rootDir, 'modules', moduleId);
  const errors = [];

  const rules = await readJson(path.join(moduleDir, 'rules.json'));
  const candidates = await readJson(path.join(moduleDir, 'candidates.json'));
  // Read the module's evidence.json directly. This is the only evidence source now (DEF-1,
  // docs/project_plans/design-specs/evidence-dual-source-unification.md): src/evidence.js is a
  // thin loader over this same file, not a second hand-maintained copy, so there is nothing
  // left for it to drift against.
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
