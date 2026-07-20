import { createHash } from 'node:crypto';
import { cp, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_IDS } from '../src/modules/registry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const files = ['index.html', 'styles.css', 'site-overrides.css', 'robots.txt', '_headers'];
const directories = ['assets', 'src', 'data', 'examples', 'modules'];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const filename of files) await copyFile(path.join(root, filename), path.join(dist, filename));
for (const dirname of directories) {
  await cp(path.join(root, dirname), path.join(dist, dirname), { recursive: true });
}

async function collectFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await collectFiles(full)));
    else found.push(full);
  }
  return found.sort();
}

// GitHub Pages serves every asset with max-age=14400 but index.html with
// max-age=600, and the asset URLs carry no version. A returning visitor could
// therefore run new markup against four-hour-old JS, CSS, or — worst — an old
// data/rules.json, which would silently evaluate a stale rule set behind a
// UI reporting the current knowledge-base version. Stamping every asset URL
// with a content hash makes any change produce a new URL, so code and
// knowledge base can never be served out of step. The hash (not the package
// version) is the key because a knowledge-base edit must invalidate caches
// even when the release version is unchanged.
const stampTargets = [
  ...(await collectFiles(path.join(dist, 'src'))),
  ...(await collectFiles(path.join(dist, 'data'))),
  ...(await collectFiles(path.join(dist, 'examples'))),
  ...(await collectFiles(path.join(dist, 'modules'))),
  path.join(dist, 'styles.css'),
  path.join(dist, 'site-overrides.css'),
  path.join(dist, 'index.html'),
];
const digest = createHash('sha256');
for (const file of stampTargets) digest.update(await readFile(file));
const assetStamp = digest.digest('hex').slice(0, 12);

const withStamp = (url) => `${url}?v=${assetStamp}`;

// index.html: stylesheet, module entry point, and icon references.
const indexPath = path.join(dist, 'index.html');
const stampedIndex = (await readFile(indexPath, 'utf8')).replace(
  /(href|src)="(\.\/[^"?]+\.(?:css|js|svg))"/g,
  (_match, attribute, url) => `${attribute}="${withStamp(url)}"`,
);
await writeFile(indexPath, stampedIndex);

// Stamping the entry point alone is not enough: the browser resolves each static,
// side-effect, and dynamic ES import and each fetch() as its own cacheable request. Stamp the
// complete copied JS graph, not only dist/src: registry-bearing modules must resolve every
// shared dependency (units, ranges, and future registries) to one URL/module instance.
let stampedModules = 0;
const copiedJavaScript = [
  ...(await collectFiles(path.join(dist, 'src'))),
  ...(await collectFiles(path.join(dist, 'modules'))),
];
for (const file of copiedJavaScript) {
  if (!file.endsWith('.js')) continue;
  const original = await readFile(file, 'utf8');
  const stamped = original
    .replace(
      /(\b(?:from|import)\s*\(?\s*['"])(\.\.?\/[^'"?]+\.(?:js|json))(['"])/g,
      (_match, prefix, url, suffix) => `${prefix}${withStamp(url)}${suffix}`,
    )
    .replace(
      /(fetch\(\s*(['"`]))(\.\.?\/[^'"`?]+\.json)(\2)/g,
      (_match, prefix, _quote, url, suffix) => `${prefix}${withStamp(url)}${suffix}`,
    );
  if (stamped !== original) stampedModules += 1;
  await writeFile(file, stamped);
}

const rules = JSON.parse(await readFile(path.join(root, 'modules/anemia/rules.json'), 'utf8'));
const candidates = JSON.parse(await readFile(path.join(root, 'modules/anemia/candidates.json'), 'utf8'));
const evidence = JSON.parse(await readFile(path.join(root, 'modules/anemia/evidence.json'), 'utf8'));
const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

// Per-module breakdown, additive to the flat top-level fields above (which keep echoing the
// default module's numbers unchanged — today MODULE_IDS has exactly one entry, 'anemia').
async function readModuleBuildInfo(moduleId) {
  const moduleDir = path.join(root, 'modules', moduleId);
  const moduleRules = JSON.parse(await readFile(path.join(moduleDir, 'rules.json'), 'utf8'));
  const moduleCandidates = JSON.parse(await readFile(path.join(moduleDir, 'candidates.json'), 'utf8'));
  const moduleEvidence = JSON.parse(await readFile(path.join(moduleDir, 'evidence.json'), 'utf8'));
  // module.json (manifest) does not exist until Phase 6 (platform-foundation-p0-v1.md,
  // Phase 6: Module Manifest Stub) — tolerate its absence here.
  let manifest = null;
  try {
    manifest = JSON.parse(await readFile(path.join(moduleDir, 'module.json'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return {
    knowledgeBaseVersion: moduleEvidence.knowledgeBaseVersion,
    evidenceReviewedThrough: moduleEvidence.reviewedThrough,
    ruleCount: moduleRules.length,
    diagnosticPatternCount: Object.keys(moduleCandidates).length,
    evidenceRecordCount: moduleEvidence.sources.length,
    manifest,
  };
}

const modulesInfo = Object.fromEntries(
  await Promise.all(MODULE_IDS.map(async (moduleId) => [moduleId, await readModuleBuildInfo(moduleId)])),
);

const buildInfo = {
  application: 'Pediatric Anemia Diagnosis Aide',
  releaseVersion: packageMetadata.version,
  buildType: 'static-clinician-research-prototype',
  generatedAt: new Date().toISOString(),
  assetStamp,
  knowledgeBaseVersion: evidence.knowledgeBaseVersion,
  evidenceReviewedThrough: evidence.reviewedThrough,
  ruleCount: rules.length,
  diagnosticPatternCount: Object.keys(candidates).length,
  evidenceRecordCount: evidence.sources.length,
  modules: modulesInfo,
};
await writeFile(path.join(dist, 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);
await writeFile(path.join(dist, '.nojekyll'), '');
console.log(`Static site built at ${dist}`);
console.log(`${rules.length} rules · ${Object.keys(candidates).length} patterns · ${evidence.sources.length} evidence records`);
console.log(`Asset stamp ?v=${assetStamp} applied to index.html and ${stampedModules} module(s)`);
