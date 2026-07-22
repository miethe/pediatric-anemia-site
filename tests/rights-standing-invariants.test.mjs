// tests/rights-standing-invariants.test.mjs — EPR3-T9 / FR-WP3-10, FR-WP3-11, FR-WP3-12.
//
// THE STANDING INVARIANTS OF EP-R3. This is the final task of the phase: it does not add or capture
// any content. It asserts, over the real repository as EP-R3 leaves it, that the properties the whole
// feature promised NOT to change are still unchanged, and that the fails-closed constraints EP-R3
// installed are still closed. If a later edit quietly clears REG-002, grounds a rule, files an
// attestation, couples the clinical schema to an RF-owned schema, or shifts a golden clinical output,
// one of these assertions fails.
//
// It deliberately restates invariants that narrower EP-R3 tests already touch (the negative invariant,
// the axis-separation test, the module-equivalence golden harness). That redundancy is the point: this
// file is the single place a reviewer can read to confirm "the feature shipped zero clearances, zero
// attestations, zero grounded rules, no clinical drift, and no RF coupling" without reconstructing it
// from eight other files. A standing invariant with exactly one guard is one refactor away from being
// silently lost.
//
// WHAT THIS FILE DOES NOT PROVE. It does not prove any source is licensed, any rule is clinically
// valid, or any near-verbatim span is absent (that is R-1, open — see rights-negative-invariant). It
// proves the *absence of change* and the *closure of the fails-closed surfaces*, nothing more.
//
// Determinism: no `Date.now()`, no `new Date()` without an argument. The golden harness scrubs the one
// wall-clock field (`meta.generatedAt`) exactly as scripts/capture-golden.mjs and the engine
// determinism test do; every other assertion is over static repository content.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessPediatricAnemia } from '../src/engine.js';
import { computeCoverage } from '../scripts/rule-coverage.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readText(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}
function readJson(rel) {
  return JSON.parse(readText(rel));
}

const evidence = readJson('modules/anemia/evidence.json');
const allPassages = evidence.sources.flatMap((source) => source.passages ?? []);
const rules = readJson('modules/anemia/rules.json');
const candidates = readJson('modules/anemia/candidates.json');
const moduleManifest = readJson('modules/anemia/module.json');

// ---------------------------------------------------------------------------------------------
// FR-WP3-10 — REG-002 is NOT cleared, and passageFidelity stays constrained.
// ---------------------------------------------------------------------------------------------

test('FR-WP3-10: scripts/validate-kb.mjs still hard-codes REG_002_CLEARED === false', () => {
  const src = readText('scripts/validate-kb.mjs');
  // The single source of the gate constant. It must literally read `false`, and no line may set it
  // true — clearing REG-002 is a deliberate, reviewable human act, never a build-passing edit.
  assert.match(
    src,
    /const\s+REG_002_CLEARED\s*=\s*false\s*;/,
    'validate-kb.mjs must declare `const REG_002_CLEARED = false;` — REG-002 is not cleared by this feature',
  );
  assert.ok(
    !/REG_002_CLEARED\s*=\s*true/.test(src),
    'no line may assign REG_002_CLEARED = true',
  );
});

test('FR-WP3-10: the passageFidelity gate in validate-kb.mjs still constrains to paraphrase/withheld while uncleared', () => {
  const src = readText('scripts/validate-kb.mjs');
  // The gate that refuses any passageFidelity other than paraphrase/withheld while REG-002 is uncleared
  // must still be present and still keyed on !REG_002_CLEARED.
  assert.ok(
    /!REG_002_CLEARED[\s\S]{0,120}passageFidelity[\s\S]{0,60}'paraphrase'[\s\S]{0,60}'withheld'/.test(src),
    'the uncleared-passageFidelity gate must still constrain to paraphrase/withheld',
  );
});

test('FR-WP3-10: every one of the 41 passages is passageFidelity paraphrase or withheld — no verbatim reuse exists', () => {
  assert.equal(allPassages.length, 41, 'expected the 41 known passages — update this test deliberately if the corpus changes');
  const permitted = new Set(['paraphrase', 'withheld']);
  const offenders = allPassages.filter((p) => !permitted.has(p.passageFidelity)).map((p) => `${p.id}:${p.passageFidelity}`);
  assert.deepEqual(offenders, [], `passages not in {paraphrase, withheld}: ${offenders.join(', ')}`);
});

// ---------------------------------------------------------------------------------------------
// FR-WP3-11 — no runtime $ref/import resolves outside schemas/ into an RF-owned schema (OQ-4 open).
//
// The RF-owned entity model (schemas/rights/*.schema.json, $id https://research-foundry.example/...)
// is vendored, not $ref'd: FR-WP3-11 forbids the clinical/runtime path from reaching into it while
// OQ-4 (does RF accept this entity model?) is open. The taxonomy fields on evidence.schema.json copy
// the rights component enum ONE-FOR-ONE rather than $ref it, and the clinical engine never loads a
// rights schema at all. Both facts are asserted here.
// ---------------------------------------------------------------------------------------------

function listFiles(absoluteDir, relativeDir = '') {
  const out = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (['.git', 'node_modules', 'dist', 'coverage', '.venv'].includes(entry.name)) continue;
    const rel = relativeDir === '' ? entry.name : `${relativeDir}/${entry.name}`;
    const abs = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(abs, rel));
    else if (entry.isFile()) out.push({ rel, abs });
  }
  return out;
}

/** Collect every `$ref` string value in a parsed JSON schema, with its json-path. */
function collectRefs(value, jsonPath, out) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectRefs(item, `${jsonPath}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref' && typeof child === 'string') out.push({ jsonPath: `${jsonPath}.$ref`, ref: child });
      else collectRefs(child, `${jsonPath}.${key}`, out);
    }
  }
  return out;
}

test('FR-WP3-11: every $ref in every schema under schemas/ is a same-document local pointer (# ...)', () => {
  const schemaFiles = listFiles(path.join(REPO_ROOT, 'schemas'), 'schemas').filter((f) => f.rel.endsWith('.json'));
  assert.ok(schemaFiles.length > 0, 'expected schemas/ to contain schema files');
  const external = [];
  for (const file of schemaFiles) {
    const refs = collectRefs(JSON.parse(readFileSync(file.abs, 'utf8')), file.rel, []);
    for (const { jsonPath, ref } of refs) {
      // A local pointer stays inside its own document and therefore inside schemas/. Anything else —
      // a relative file path, an absolute path, or an http(s) URI — could resolve outside schemas/.
      if (!ref.startsWith('#')) external.push(`${jsonPath} -> ${ref}`);
    }
  }
  assert.deepEqual(external, [], `non-local $ref(s) found — a cross-file or external $ref could resolve outside schemas/:\n${external.join('\n')}`);
});

test('FR-WP3-11: no $ref anywhere in schemas/ points at an RF-owned schema ($id host research-foundry.example)', () => {
  const schemaFiles = listFiles(path.join(REPO_ROOT, 'schemas'), 'schemas').filter((f) => f.rel.endsWith('.json'));
  const offenders = [];
  for (const file of schemaFiles) {
    const refs = collectRefs(JSON.parse(readFileSync(file.abs, 'utf8')), file.rel, []);
    for (const { jsonPath, ref } of refs) {
      if (/research-foundry\.example/.test(ref)) offenders.push(`${jsonPath} -> ${ref}`);
    }
  }
  assert.deepEqual(offenders, [], `a schema $ref reaches an RF-owned schema — FR-WP3-11 forbids this while OQ-4 is open:\n${offenders.join('\n')}`);
});

test('FR-WP3-11: the clinical runtime (src/ + server.mjs) never imports or reads a rights/RF-owned schema', () => {
  // The clinical decision path is deterministic rules over derived facts; it must not couple to the
  // rights entity model at all. Scan every runtime module for a reference to a rights schema or the
  // RF host. (Validation SCRIPTS legitimately load the vendored schemas/rights/* schemas — that is
  // inside schemas/, at `npm run validate`, not on the clinical runtime path — so they are not scanned.)
  const runtimeFiles = [
    ...listFiles(path.join(REPO_ROOT, 'src'), 'src').filter((f) => f.rel.endsWith('.js') || f.rel.endsWith('.mjs')),
    { rel: 'server.mjs', abs: path.join(REPO_ROOT, 'server.mjs') },
  ];
  const offenders = [];
  for (const file of runtimeFiles) {
    const text = readFileSync(file.abs, 'utf8');
    if (/schemas\/rights\//.test(text) || /research-foundry\.example/.test(text)) {
      offenders.push(file.rel);
    }
  }
  assert.deepEqual(offenders, [], `runtime module(s) reference an RF-owned/rights schema:\n${offenders.join('\n')}`);
});

// ---------------------------------------------------------------------------------------------
// FR-WP3-12 — zero clinical change. Golden-fixture equivalence + rule coverage still 91/91.
// ---------------------------------------------------------------------------------------------

function scrub(result) {
  return { ...result, meta: { ...result.meta, generatedAt: 'x' } };
}

const exampleFiles = readdirSync(path.join(REPO_ROOT, 'examples')).filter((n) => n.endsWith('.json')).sort();

test('FR-WP3-12: all six worked examples exist and each has a golden fixture', () => {
  assert.equal(exampleFiles.length, 6, `expected 6 worked examples, found ${exampleFiles.length}`);
});

for (const filename of exampleFiles) {
  const name = filename.replace(/\.json$/, '');
  test(`FR-WP3-12: golden zero-diff — ${name} assessment is byte-identical to its golden fixture`, () => {
    const input = readJson(`examples/${filename}`);
    const golden = readJson(`tests/golden/${name}.json`);
    const result = scrub(assessPediatricAnemia(input, rules, candidates));
    assert.deepEqual(result, golden, `${name}: clinical output drifted from the golden fixture — EP-R3 must change zero clinical meaning`);
  });
}

test('FR-WP3-12: rule activation coverage still reports 91/91 (npm run coverage:rules invariant)', async () => {
  const coverage = await computeCoverage({ rootDir: REPO_ROOT });
  assert.equal(coverage.total, 91, `expected 91 rules, found ${coverage.total}`);
  assert.equal(coverage.witnessed, 91, `expected all 91 rules witnessed, found ${coverage.witnessed}`);
  assert.deepEqual(coverage.unwitnessed, [], `unwitnessed rules: ${coverage.unwitnessed.join(', ')}`);
});

// ---------------------------------------------------------------------------------------------
// Standing invariants asserted across everything EP-R3 landed:
// zero clearances, zero attestations, zero grounded rules, three axis fields on all 41 passages.
// ---------------------------------------------------------------------------------------------

test('EP-R3 landed the three axis fields on all 41 passages, all with judgment_basis: unassessed', () => {
  const enum_item_type = new Set([
    'observed_finding', 'reference_interval_value', 'equation_or_method',
    'guideline_recommendation', 'instrument_or_questionnaire', 'bibliographic_metadata', 'derived_synthesis',
  ]);
  for (const p of allPassages) {
    assert.ok(enum_item_type.has(p.evidence_item_type), `${p.id}: evidence_item_type "${p.evidence_item_type}" is not in the closed enum`);
    assert.equal(typeof p.rights_component_class, 'string', `${p.id}: rights_component_class must be a string`);
    assert.ok(p.rights_component_class.length > 0, `${p.id}: rights_component_class must be non-empty`);
    // judgment_basis is always unassessed: OQ-1 (measured vs. judged) routes to counsel; no agent moves it.
    assert.equal(p.judgment_basis, 'unassessed', `${p.id}: judgment_basis must be 'unassessed' (found '${p.judgment_basis}')`);
    // The three are separate fields, none derived from the others (AC-WP3-AXES): they must all be present keys.
    assert.ok('evidence_item_type' in p && 'rights_component_class' in p && 'judgment_basis' in p,
      `${p.id}: the three axis fields must each be present as separate keys`);
  }
});

test('ZERO ATTESTATIONS: every judgment_basis_attestation is exactly null', () => {
  // The attestation that would justify a non-unassessed judgment_basis does not exist in this project
  // and must not be agent-authored. The schema forces it null; this asserts the data honours that.
  for (const p of allPassages) {
    assert.strictEqual(p.judgment_basis_attestation, null, `${p.id}: judgment_basis_attestation must be null, found ${JSON.stringify(p.judgment_basis_attestation)}`);
  }
});

test('ZERO ATTESTATIONS: derived_syntheses is candidate-only and carries no synthesis attestation', () => {
  const syntheses = evidence.derived_syntheses ?? [];
  assert.ok(Array.isArray(syntheses), 'derived_syntheses must be an array');
  for (const s of syntheses) {
    // The authoritative state is structurally unrepresentable; whatever exists here is candidate-only,
    // and no attestation record may accompany it (D6, DEF-R4).
    assert.notEqual(s.state, 'authoritative', `derived_synthesis ${s.id ?? '<no id>'} must not be authoritative`);
    const att = s.attestation ?? s.synthesis?.attestation ?? null;
    assert.ok(att === null || att === undefined,
      `derived_synthesis ${s.id ?? '<no id>'} must carry no synthesis attestation (found ${JSON.stringify(att)})`);
  }
});

test('ZERO GROUNDED RULES: clinicalApprovers[] is empty on all 91 rules; module approvedBy[] is empty', () => {
  // No clinical sign-off exists in this project (D4/D6). A "grounded" rule would be one with a real
  // named clinical approver; there are none, and this feature added none.
  assert.equal(rules.length, 91, `expected 91 rules, found ${rules.length}`);
  const grounded = rules.filter((r) => Array.isArray(r.clinicalApprovers) && r.clinicalApprovers.length > 0).map((r) => r.id);
  assert.deepEqual(grounded, [], `rules with a non-empty clinicalApprovers[] (a clinical sign-off this project does not have): ${grounded.join(', ')}`);
  assert.deepEqual(moduleManifest.approvedBy, [], 'module.json approvedBy[] must be empty — no clinical sign-off exists');
});

test('ZERO CLEARANCES: no rights record carries a positive clearance; every overall_status is non-cleared', () => {
  const rightsRecords = readJson('rights/rights-records.json');
  const records = Array.isArray(rightsRecords) ? rightsRecords : (rightsRecords.records ?? []);
  assert.ok(records.length > 0, 'expected rights records to exist');
  for (const r of records) {
    // overall_status is the legal axis. A cleared record would read CLEARED/GRANTED; none does. A record
    // at UNKNOWN must still be valid (D7: coverage gates only, never clearance gates) — that is enforced
    // by npm run validate, asserted green by npm run check.
    assert.ok(!/CLEARED|GRANTED/i.test(String(r.overall_status ?? '')),
      `${r.source_id ?? '<no source>'}: overall_status "${r.overall_status}" reads as a positive clearance — this feature clears nothing`);
  }
  // Belt-and-braces textual sweep: the literal REG_002_CLEARED-as-true and counsel_approved-as-true
  // shapes must appear nowhere in the rights tree or the KB.
  for (const rel of ['rights/rights-records.json', 'rights/rights-ledger.json', 'modules/anemia/evidence.json']) {
    const text = readText(rel);
    assert.ok(!/"counsel_approved"\s*:\s*true/.test(text), `${rel}: counsel_approved must never be true`);
    assert.ok(!/REG_002_CLEARED/.test(text), `${rel}: must not carry a REG_002_CLEARED flag`);
  }
});
