// Measures ACTIVATION-WITNESS coverage of modules/anemia/rules.json: for every
// rule, does at least one fixture (examples/*.json or tests/witness/**/*.json)
// actually make it fire, i.e. appear in assessPediatricAnemia()'s
// provenance.matchedRuleIds?
//
// Why this instrument exists (Phase EP-0.5 amendment — inserted after EP-0
// proved the plan's original sequencing unsafe; see
// docs/project_plans/implementation_plans/infrastructure/wave0-safety-foundation-v1/phase-0.5-activation-witness-corpus.md):
//
// EP-0's AAR measured what the 6-fixture golden corpus (examples/*.json) at
// the time actually exercised, and found only **30 of 91 rules ever fire —
// 61 never fire, including 6 ALERT rules** (ALERT-001/-002/-003/-006/-007/-008).
// "npm run check is green" was therefore, silently, a claim about those 30
// rules — not about the knowledge base as a whole. SPIKE-003's headline
// migration-safety result ("6/6 fixtures byte-identical") inherited the same
// blind spot, and a staged-rollout prototype in EP-0 broke a fixture with
// zero test failures precisely because the suite could not see the rules it
// wasn't exercising. A corpus-gated safety net cannot be built before the
// corpus exists — this script is that measurement, made permanent and
// machine-checkable instead of a one-off scratch calculation, so the number
// can never again be silently lost or silently regress (see EP05-T6, which
// wires `--min` into `npm run check` as a ratchet once the corpus is built
// out in EP05-T2..T4).
//
// Measured baseline (examples/*.json only, before EP05-T2..T4 add
// tests/witness/ fixtures): 30/91 (33.0%).
//
// Usage:
//   node scripts/rule-coverage.mjs                    human-readable report
//   node scripts/rule-coverage.mjs --json              machine-readable JSON, stdout only
//   node scripts/rule-coverage.mjs --require-all        exit 1 if ANY rule has no witness
//   node scripts/rule-coverage.mjs --min=60             exit 1 if witnessed count < 60
//   node scripts/rule-coverage.mjs --min 60             (space-separated form also accepted)
//   node scripts/rule-coverage.mjs --list-unwitnessed   print unwitnessed rule ids, one per line
//
// `npm run coverage:rules` runs `--require-all --min=91` and is wired into `npm run check`
// and both CI jobs. Prefer --require-all: --min alone pins an absolute COUNT, so a newly
// added rule with no witness keeps the count unchanged and slips through (see
// checkRequireAll's comment). --min is kept as the weaker fallback and as a floor that
// makes an accidental fixture deletion obvious.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assessPediatricAnemia } from '../src/engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const OUTPUT_TYPES = ['alert', 'candidate', 'note', 'question'];

// Per decision D1 (.claude/progress/wave0-safety-foundation/phase-0.5-progress.md):
// the coverage target is every reachable rule in modules/anemia/rules.json
// (91), not a reconstructed "49-rule migration subset" from SPIKE-003 — that
// table survived only at a machine-local scratch path that no longer exists,
// and re-deriving "49" from prose proved ambiguous (a naive derivation over
// boolean fact paths yields 88, not 49). Targeting the full rule set is a
// strict superset of any reading of the 49, so the migration set is a
// non-issue by construction.
const MIGRATION_SET_NOTE =
  'MIGRATION-SET NOTE: per decision D1, the coverage target is every reachable rule in ' +
  'modules/anemia/rules.json, not a reconstructed 49-rule migration subset (that table ' +
  'could not be safely re-derived from a lost scratch reference) — so no separate 49-rule ' +
  'subset is tracked by this instrument.';

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

// Resolves a fixture path entry to a flat list of .json files. A directory is
// walked recursively (tests/witness/**/*.json); a file is included directly
// if it ends in .json. A missing path yields no files rather than throwing,
// so an empty tests/witness/ (as shipped by this task) is not an error.
async function collectJsonFiles(entryPath) {
  let stats;
  try {
    stats = await stat(entryPath);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  if (stats.isFile()) {
    return entryPath.endsWith('.json') ? [entryPath] : [];
  }
  if (stats.isDirectory()) {
    const entries = await readdir(entryPath, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const childPath = path.join(entryPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectJsonFiles(childPath)));
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(childPath);
      }
    }
    return files;
  }
  return [];
}

/**
 * Loads every fixture under `fixtureDirs` (directories are walked
 * recursively; individual files are accepted directly — this lets tests pass
 * a deliberately reduced fixture set in-process without deleting anything),
 * runs each through assessPediatricAnemia(), and unions the resulting
 * provenance.matchedRuleIds against modules/anemia/rules.json.
 *
 * Fails loudly (throws) if any fixture fails to parse, if assess() throws, or
 * if a matched rule id isn't found in rules.json — a silently-skipped
 * fixture would silently *lower* the measured coverage, which is exactly the
 * failure mode this instrument exists to prevent.
 *
 * Returns { total, witnessed, unwitnessed, byRule, fixtureCount }.
 */
export async function computeCoverage({
  rootDir = root,
  fixtureDirs = ['examples', 'tests/witness'],
  // Injectable purely so tests/rule-coverage.test.mjs can deterministically
  // exercise the "assess() throws" fail-loud path without depending on
  // finding a real fixture that defeats the engine's (deliberately
  // defensive) input handling. The CLI always uses the real engine.
  assessFn = assessPediatricAnemia,
} = {}) {
  const rules = await readJson(path.join(rootDir, 'modules/anemia/rules.json'));
  const candidates = await readJson(path.join(rootDir, 'modules/anemia/candidates.json'));

  const fixtureFiles = [];
  for (const relDir of fixtureDirs) {
    const absPath = path.isAbsolute(relDir) ? relDir : path.join(rootDir, relDir);
    fixtureFiles.push(...(await collectJsonFiles(absPath)));
  }
  fixtureFiles.sort();

  const byRule = new Map(
    rules.map((rule) => [rule.id, { type: rule.output?.type ?? 'unknown', witnessedBy: [] }]),
  );

  for (const filePath of fixtureFiles) {
    const relPath = path.relative(rootDir, filePath);
    let input;
    try {
      input = JSON.parse(await readFile(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`rule-coverage: failed to parse fixture ${relPath}: ${error.message}`);
    }
    let result;
    try {
      result = assessFn(input, rules, candidates);
    } catch (error) {
      throw new Error(`rule-coverage: assess() threw for fixture ${relPath}: ${error.message}`);
    }
    const matched = result.provenance?.matchedRuleIds ?? [];
    for (const ruleId of matched) {
      const entry = byRule.get(ruleId);
      if (!entry) {
        // The audit trail named a rule id absent from rules.json. That is a
        // correctness bug elsewhere in the engine/KB, not something this
        // instrument should mask by ignoring it.
        throw new Error(`rule-coverage: fixture ${relPath} matched unknown rule id "${ruleId}"`);
      }
      entry.witnessedBy.push(relPath);
    }
  }

  const total = rules.length;
  const witnessedIds = [...byRule.entries()].filter(([, v]) => v.witnessedBy.length > 0).map(([id]) => id);
  const unwitnessed = [...byRule.entries()]
    .filter(([, v]) => v.witnessedBy.length === 0)
    .map(([id]) => id)
    .sort();

  return {
    total,
    witnessed: witnessedIds.length,
    unwitnessed,
    byRule: Object.fromEntries(byRule),
    fixtureCount: fixtureFiles.length,
  };
}

/** --min semantics, exported so it is unit-testable without shelling out. */
export function checkMinimum(coverage, min) {
  if (coverage.witnessed < min) {
    return {
      ok: false,
      message: `Rule activation coverage ${coverage.witnessed}/${coverage.total} is below the required minimum of ${min}.`,
    };
  }
  return {
    ok: true,
    message: `Rule activation coverage ${coverage.witnessed}/${coverage.total} meets the required minimum of ${min}.`,
  };
}

/**
 * --require-all semantics: EVERY rule must have a witness.
 *
 * This exists because `--min` alone is not a sufficient ratchet, and the hole is
 * exactly the regression the ratchet is meant to prevent. `--min` pins an absolute
 * COUNT of witnessed rules, so adding a new rule with no witness leaves the count
 * unchanged and passes: at 91/91, adding a 92nd unwitnessed rule still reports 91
 * witnessed, which clears `--min=91`. The new rule ships with zero regression
 * protection and CI stays green.
 *
 * `--require-all` fails on any unwitnessed rule regardless of the count, so the
 * pin cannot be outgrown. `--min` is retained as the weaker fallback for a corpus
 * that has not yet reached full coverage.
 */
export function checkRequireAll(coverage) {
  if (coverage.unwitnessed.length > 0) {
    return {
      ok: false,
      message:
        `${coverage.unwitnessed.length} of ${coverage.total} rules have no activation witness: `
        + `${coverage.unwitnessed.join(', ')}.\n`
        + 'A rule no fixture exercises has zero regression protection — it can be deleted, '
        + 'inverted, or downgraded without failing a single test. Author a witness fixture '
        + 'under tests/witness/ (see tests/witness/README.md).\n'
        + 'Note: activation coverage is a floor, not a ceiling. Reaching 100% means every rule '
        + 'fires somewhere; it does NOT mean every branch of a rule\'s `any`, or the severity and '
        + 'output type it emits, is asserted. Those need explicit per-arm and per-output tests '
        + '(see tests/witness/alerts.test.mjs for the ALERT-006 per-arm pattern).',
    };
  }
  return {
    ok: true,
    message: `All ${coverage.total} rules have an activation witness.`,
  };
}

function parseArgs(argv) {
  const args = {
    json: false, listUnwitnessed: false, min: null, requireAll: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
    } else if (arg === '--list-unwitnessed') {
      args.listUnwitnessed = true;
    } else if (arg === '--require-all') {
      args.requireAll = true;
    } else if (arg === '--min') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--min requires a value, e.g. --min 60');
      args.min = Number(next);
      i += 1;
    } else if (arg.startsWith('--min=')) {
      args.min = Number(arg.slice('--min='.length));
    } else {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
  }
  if (args.min !== null && !Number.isFinite(args.min)) {
    throw new Error('--min value must be a number');
  }
  return args;
}

function groupByType(coverage) {
  const byType = new Map(OUTPUT_TYPES.map((type) => [type, []]));
  for (const [id, entry] of Object.entries(coverage.byRule)) {
    if (!byType.has(entry.type)) byType.set(entry.type, []);
    byType.get(entry.type).push({ id, ...entry });
  }
  return byType;
}

function formatHuman(coverage) {
  const lines = [];
  const pct = ((coverage.witnessed / coverage.total) * 100).toFixed(1);
  const byType = groupByType(coverage);

  for (const [type, rulesOfType] of byType) {
    if (rulesOfType.length === 0) continue;
    rulesOfType.sort((a, b) => a.id.localeCompare(b.id));
    const witnessedCount = rulesOfType.filter((rule) => rule.witnessedBy.length > 0).length;
    lines.push(`\n${type.toUpperCase()} rules: ${witnessedCount}/${rulesOfType.length} witnessed`);
    for (const rule of rulesOfType) {
      if (rule.witnessedBy.length > 0) {
        lines.push(`  [x] ${rule.id}  (witnessed by ${rule.witnessedBy.join(', ')})`);
      } else {
        lines.push(`  [ ] ${rule.id}  UNWITNESSED`);
      }
    }
  }

  lines.push('\nUnwitnessed rules by output type:');
  let anyUnwitnessed = false;
  for (const [type, rulesOfType] of byType) {
    const unwitnessedIds = rulesOfType.filter((rule) => rule.witnessedBy.length === 0).map((rule) => rule.id).sort();
    if (unwitnessedIds.length === 0) continue;
    anyUnwitnessed = true;
    lines.push(`  ${type}: ${unwitnessedIds.join(', ')}`);
  }
  if (!anyUnwitnessed) lines.push('  (none — every rule has an activation witness)');

  lines.push(`\n${MIGRATION_SET_NOTE}`);
  lines.push(`\nRule activation coverage: ${coverage.witnessed}/${coverage.total} (${pct}%)`);
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const coverage = await computeCoverage({ rootDir: root });

  if (args.listUnwitnessed) {
    for (const id of coverage.unwitnessed) console.log(id);
  } else if (args.json) {
    console.log(JSON.stringify(coverage));
  } else {
    console.log(formatHuman(coverage));
  }

  if (args.requireAll) {
    const result = checkRequireAll(coverage);
    if (!result.ok) {
      console.error(result.message);
      process.exitCode = 1;
      return;
    }
  }

  if (args.min !== null) {
    const result = checkMinimum(coverage, args.min);
    if (!result.ok) {
      console.error(result.message);
      process.exitCode = 1;
      return;
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
