import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_IDS } from '../src/modules/registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 43119;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become ready. Output:\n${output}`);
}

try {
  const health = await waitForServer();
  assert.equal(health.status, 'ok');

  for (const resource of ['/', '/styles.css', '/site-overrides.css', '/src/app.js', '/modules/anemia/rules.json', '/assets/favicon.svg']) {
    const response = await fetch(`${base}${resource}`);
    assert.equal(response.status, 200, `${resource} should return 200`);
  }

  const homepage = await (await fetch(`${base}/`)).text();
  assert.match(homepage, /site-overrides\.css/);
  assert.match(homepage, /class="workflow-strip"/);
  assert.match(homepage, /id="results-placeholder"/);

  const example = JSON.parse(await readFile(path.join(root, 'examples/ida-toddler.json'), 'utf8'));
  const assessmentResponse = await fetch(`${base}/api/v1/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(example),
  });
  assert.equal(assessmentResponse.status, 200);
  const assessment = await assessmentResponse.json();
  assert.ok(Array.isArray(assessment.rankedDifferential));
  assert.ok(assessment.rankedDifferential.length > 0);
  assert.ok(Array.isArray(assessment.provenance?.matchedRuleIds));

  // Internal registry/module-data consistency check — not an HTTP `?moduleId=` surface (none
  // exists per platform-foundation-p0-v1.md Sequencing Note 6). Confirms the discovery
  // breakdown the running server computed at startup for each registered module matches that
  // module's own KB files on disk. For P0 this loop body executes once (anemia only), proving
  // the plumbing generalizes correctly if a second module were registered.
  const kbResponse = await fetch(`${base}/api/v1/knowledge-base`);
  assert.equal(kbResponse.status, 200);
  const knowledgeBase = await kbResponse.json();
  for (const moduleId of MODULE_IDS) {
    const moduleDir = path.join(root, 'modules', moduleId);
    const moduleRules = JSON.parse(await readFile(path.join(moduleDir, 'rules.json'), 'utf8'));
    const moduleCandidates = JSON.parse(await readFile(path.join(moduleDir, 'candidates.json'), 'utf8'));
    const moduleEvidence = JSON.parse(await readFile(path.join(moduleDir, 'evidence.json'), 'utf8'));
    const moduleSummary = knowledgeBase.modules?.[moduleId];
    assert.ok(moduleSummary, `modules key missing entry for "${moduleId}"`);
    assert.equal(moduleSummary.ruleCount, moduleRules.length, `${moduleId}: served ruleCount does not match rules.json`);
    assert.equal(
      moduleSummary.diagnosticPatternCount,
      Object.keys(moduleCandidates).length,
      `${moduleId}: served diagnosticPatternCount does not match candidates.json`,
    );
    assert.equal(
      moduleSummary.evidenceRecordCount,
      (moduleEvidence.sources ?? []).length,
      `${moduleId}: served evidenceRecordCount does not match evidence.json`,
    );
  }

  console.log(`Smoke test passed: KB ${health.knowledgeBaseVersion}; ${assessment.rankedDifferential.length} differential pattern(s) returned.`);
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      server.kill('SIGKILL');
      resolve();
    }, 2_000);
    server.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
