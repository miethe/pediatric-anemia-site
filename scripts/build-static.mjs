import { cp, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

const rules = JSON.parse(await readFile(path.join(root, 'data/rules.json'), 'utf8'));
const candidates = JSON.parse(await readFile(path.join(root, 'data/candidates.json'), 'utf8'));
const evidence = JSON.parse(await readFile(path.join(root, 'data/evidence.json'), 'utf8'));
const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const buildInfo = {
  application: 'Pediatric Anemia Diagnosis Aide',
  releaseVersion: packageMetadata.version,
  buildType: 'static-clinician-research-prototype',
  generatedAt: new Date().toISOString(),
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
