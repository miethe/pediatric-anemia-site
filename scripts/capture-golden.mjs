// Captures golden (expected) assessPediatricAnemia() output for every
// examples/*.json worked example into tests/golden/<example>.json.
//
// This script is a permanent, committed part of the equivalence-harness
// safety net (docs/project_plans/implementation_plans/refactors/platform-foundation-p0-v1.md,
// Phase 1, task P1-T1): tests/module-equivalence.test.mjs diffs today's
// engine output against these fixtures on every run, so any refactor that
// silently changes clinical output fails loudly.
//
// Regeneration is a GOVERNED action, not routine maintenance: only re-run
// this script (and re-commit the resulting tests/golden/*.json) when a
// reviewed, intentional change to rule/engine behavior needs a new baseline
// — never to "make a failing equivalence test pass" without independent
// clinical review. Re-running against an unchanged source tree reproduces
// byte-identical output (module the timestamp, scrubbed below), so the
// script is idempotent.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessPediatricAnemia } from '../src/engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examplesDir = path.join(root, 'examples');
const goldenDir = path.join(root, 'tests', 'golden');

const rules = JSON.parse(await readFile(path.join(root, 'modules/anemia/rules.json'), 'utf8'));
const candidates = JSON.parse(await readFile(path.join(root, 'modules/anemia/candidates.json'), 'utf8'));

// Same scrub pattern as tests/engine.test.mjs's determinism test: strip the
// wall-clock timestamp so captured fixtures compare cleanly on every future
// run regardless of when assess() executes.
function scrub(result) {
  return { ...result, meta: { ...result.meta, generatedAt: 'x' } };
}

await mkdir(goldenDir, { recursive: true });

const exampleFiles = (await readdir(examplesDir)).filter((name) => name.endsWith('.json')).sort();
if (exampleFiles.length === 0) throw new Error(`No example fixtures found under ${examplesDir}`);

for (const filename of exampleFiles) {
  const name = filename.replace(/\.json$/, '');
  const input = JSON.parse(await readFile(path.join(examplesDir, filename), 'utf8'));
  const result = scrub(assessPediatricAnemia(input, rules, candidates));
  await writeFile(path.join(goldenDir, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Captured golden output for ${name}`);
}

console.log(`Wrote ${exampleFiles.length} golden fixture(s) to ${path.relative(root, goldenDir)}`);
