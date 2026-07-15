import { readFile } from 'node:fs/promises';
import { EVIDENCE } from '../src/evidence.js';
import { evaluateCondition } from '../src/ruleEngine.js';

const rules = JSON.parse(await readFile(new URL('../data/rules.json', import.meta.url), 'utf8'));
const candidates = JSON.parse(await readFile(new URL('../data/candidates.json', import.meta.url), 'utf8'));
const errors = [];
const ruleIds = new Set();

for (const rule of rules) {
  if (!rule.id) errors.push('Rule missing id');
  if (ruleIds.has(rule.id)) errors.push(`Duplicate rule id: ${rule.id}`);
  ruleIds.add(rule.id);
  try { evaluateCondition(rule.when, {}); } catch (error) { errors.push(`${rule.id}: ${error.message}`); }
  for (const evidenceId of rule.evidence ?? []) {
    if (!EVIDENCE[evidenceId]) errors.push(`${rule.id}: unknown evidence ${evidenceId}`);
  }
  if (rule.output?.type === 'candidate' && !candidates[rule.output.candidateId]) {
    errors.push(`${rule.id}: unknown candidate ${rule.output.candidateId}`);
  }
}

for (const [id, candidate] of Object.entries(candidates)) {
  if (candidate.id !== id) errors.push(`Candidate key/id mismatch: ${id}`);
  for (const evidenceId of candidate.evidence ?? []) {
    if (!EVIDENCE[evidenceId]) errors.push(`${id}: unknown evidence ${evidenceId}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${rules.length} rules, ${Object.keys(candidates).length} candidates, and ${Object.keys(EVIDENCE).length} evidence records.`);
}
