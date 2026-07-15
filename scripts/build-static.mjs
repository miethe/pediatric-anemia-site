import { createHash } from 'node:crypto';
import { cp, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const files = ['index.html', 'styles.css', 'site-overrides.css', 'robots.txt', '_headers'];
const directories = ['assets', 'src', 'data', 'examples'];

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

// Stamping the entry point alone is not enough: the browser resolves each
// static ES import and each fetch() as its own cacheable request.
let stampedModules = 0;
for (const file of await collectFiles(path.join(dist, 'src'))) {
  if (!file.endsWith('.js')) continue;
  const original = await readFile(file, 'utf8');
  const stamped = original
    .replace(/from '(\.\/[^'?]+\.js)'/g, (_m, url) => `from '${withStamp(url)}'`)
    .replace(/fetch\('(\.\/[^'?]+\.json)'\)/g, (_m, url) => `fetch('${withStamp(url)}')`)
    .replace(/fetch\(`(\.\/[^`?]+\.json)`\)/g, (_m, url) => `fetch(\`${withStamp(url)}\`)`);
  if (stamped !== original) stampedModules += 1;
  await writeFile(file, stamped);
}

const rules = JSON.parse(await readFile(path.join(root, 'data/rules.json'), 'utf8'));
const candidates = JSON.parse(await readFile(path.join(root, 'data/candidates.json'), 'utf8'));
const evidence = JSON.parse(await readFile(path.join(root, 'data/evidence.json'), 'utf8'));
const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
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
};
await writeFile(path.join(dist, 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);
await writeFile(path.join(dist, '.nojekyll'), '');
console.log(`Static site built at ${dist}`);
console.log(`${rules.length} rules · ${Object.keys(candidates).length} patterns · ${evidence.sources.length} evidence records`);
console.log(`Asset stamp ?v=${assetStamp} applied to index.html and ${stampedModules} module(s)`);
