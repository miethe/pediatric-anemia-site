// Captures assessPediatricAnemia() output for every published worked example
// (examples/*.json) AND every activation-witness fixture (tests/witness/**.json)
// into a snapshot directory, for the EP-1 tri-state migration diff record.
//
// EP-1's AC-D3 requires enumerating every behavioral difference introduced by the
// tri-state migration across the FULL witness corpus (all 49 migrated rules), not
// just the 6 original golden fixtures — see the EP-0.5 amendment in
// docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-1-tristate-fact-model.md
//
// Usage:
//   node scripts/capture-ep1-snapshot.mjs <outputDir>
//
// Run once BEFORE the migration (baseline) and once AFTER (post), then diff the
// two directories. Output is timestamp-scrubbed so the diff is deterministic.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessPediatricAnemia } from '../src/engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] ?? path.join(root, '.ep1-snapshot'));

const rules = JSON.parse(await readFile(path.join(root, 'modules/anemia/rules.json'), 'utf8'));
const candidates = JSON.parse(await readFile(path.join(root, 'modules/anemia/candidates.json'), 'utf8'));

// Same scrub as scripts/capture-golden.mjs — strip wall-clock time.
function scrub(result) {
  return { ...result, meta: { ...result.meta, generatedAt: 'x' } };
}

// Recursively collect *.json under a directory.
async function collect(dir, base = dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collect(full, base)));
    else if (entry.name.endsWith('.json')) out.push({ full, rel: path.relative(base, full) });
  }
  return out;
}

const sources = [
  { label: 'examples', dir: path.join(root, 'examples') },
  { label: 'witness', dir: path.join(root, 'tests', 'witness') },
];

let count = 0;
const failures = [];

for (const source of sources) {
  const files = await collect(source.dir);
  for (const { full, rel } of files) {
    const slug = `${source.label}__${rel.replace(/[/\\]/g, '__').replace(/\.json$/, '')}`;
    const target = path.join(outDir, `${slug}.json`);
    await mkdir(path.dirname(target), { recursive: true });
    let payload;
    try {
      const input = JSON.parse(await readFile(full, 'utf8'));
      payload = scrub(assessPediatricAnemia(input, rules, candidates));
    } catch (error) {
      // A fixture that throws is itself a diffable behavior — record it rather
      // than aborting, so the before/after comparison stays complete.
      failures.push(`${slug}: ${error.message}`);
      payload = { __error: String(error && error.message ? error.message : error) };
    }
    await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
    count += 1;
  }
}

console.log(`Wrote ${count} snapshot(s) to ${path.relative(root, outDir) || outDir}`);
if (failures.length > 0) {
  console.log(`${failures.length} fixture(s) threw and were recorded as __error:`);
  for (const failure of failures) console.log(`  - ${failure}`);
}
