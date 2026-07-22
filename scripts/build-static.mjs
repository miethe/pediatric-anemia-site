import { createHash } from 'node:crypto';
import { cp, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_IDS, DEFAULT_MODULE_ID } from '../src/modules/registry.js';
import { verifyManifest, SUPPORTED_SCHEMA_VERSIONS } from '../src/kbVerify.js';
import { EVIDENCE_STALENESS_POLICY } from '../src/evidenceStalenessPolicy.js';
import { validate as validateManifestSchema } from './lib/json-schema-lite.mjs';
import { loadKbJsonFiles, loadKbSourceFiles } from './sign-kb.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const files = ['index.html', 'styles.css', 'site-overrides.css', 'robots.txt', '_headers'];
const directories = ['assets', 'src', 'data', 'examples', 'modules'];

const manifestSchema = JSON.parse(
  await readFile(path.join(root, 'schemas', 'module-manifest.schema.json'), 'utf8'),
);

function discloseEvidenceStaleness(moduleId, verdict) {
  if (!verdict.expiry) return;
  if (verdict.expiry.enforced) {
    console.log(`Module "${moduleId}": evidence-staleness expiry ENFORCED — ${verdict.expiry.reason}`);
  } else {
    console.warn(`Module "${moduleId}": evidence-staleness expiry NOT ENFORCED — ${verdict.expiry.reason}`);
  }
}

// SPIKE-006 RQ4 — gate BEFORE any dist/ write: an unverifiable KB (missing/schema-invalid/
// tampered/incompatible-schemaVersion/expired manifest) must never reach a Pages upload. Mirrors
// server.mjs's startup verification exactly (both call the same src/kbVerify.js#verifyManifest),
// but exits the build rather than refusing to start a server.
//
// evidence-foundry-buildout P1-T3 (in-flight finding, same root cause and same fix shape as
// server.mjs's startup loop): only DEFAULT_MODULE_ID — the module the static build actually
// serves and reports flat top-level fields for below — is fatal-on-failure. A second registered
// module (e.g. `cbc_suite_v1`, a deliberate `unsigned-stub` scaffold with no client-facing
// moduleId surface, R-P4/PRD §6.1) legitimately fails this gate until it is reviewed and signed;
// that failure is loudly disclosed but the module's KB data and manifest verdict are still
// recorded (`dist/build-info.json`'s per-module breakdown discloses it exactly as read, matching
// server.mjs's GET /api/v1/knowledge-base — see readModuleBuildInfo below), never silently
// dropped and never fatal to the build.
const manifestsById = {};
for (const moduleId of MODULE_IDS) {
  const moduleDir = path.join(root, 'modules', moduleId);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(moduleDir, 'module.json'), 'utf8'));
  } catch (error) {
    console.error(`Fatal: module "${moduleId}" has no readable manifest (module.json): ${error.message}`);
    process.exit(1);
  }
  const schemaErrors = validateManifestSchema(manifestSchema, manifest);
  const kbFiles = await loadKbJsonFiles();
  const kbSourceFiles = await loadKbSourceFiles();
  const verdict = await verifyManifest({
    manifest,
    moduleId,
    files: kbFiles,
    sourceFiles: kbSourceFiles,
    schemaErrors,
    supportedSchemaVersions: SUPPORTED_SCHEMA_VERSIONS,
    evidenceStalenessPolicy: EVIDENCE_STALENESS_POLICY,
  });
  discloseEvidenceStaleness(moduleId, verdict);
  if (!verdict.servable) {
    if (moduleId === DEFAULT_MODULE_ID) {
      console.error(
        `Fatal: module "${moduleId}" manifest failed verification — refusing to build dist/ `
          + `(SPIKE-006 RQ4): ${verdict.reasons.join('; ')}`,
      );
      process.exit(1);
    }
    console.warn(
      `Module "${moduleId}": manifest not servable (disclosed in build-info.json, not fatal) — ${verdict.reasons.join('; ')}`,
    );
  }
  manifestsById[moduleId] = { manifest, verdict };
}

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
// `manifest`/`evidenceStalenessPolicy` reuse the SAME verified manifest and verdict computed by
// the fail-closed gate above — never a second, independent read (which could silently drift from
// what was actually verified) — and disclose the AC-WP5-RESIL legitimately-empty fields
// (`approvedBy: []`, `supersedes: null`) and the expiry non-enforcement state exactly as
// server.mjs's GET /api/v1/knowledge-base does, so the static build and the live server never
// disagree about what "integrity-recorded" discloses.
async function readModuleBuildInfo(moduleId) {
  const moduleDir = path.join(root, 'modules', moduleId);
  const moduleRules = JSON.parse(await readFile(path.join(moduleDir, 'rules.json'), 'utf8'));
  const moduleCandidates = JSON.parse(await readFile(path.join(moduleDir, 'candidates.json'), 'utf8'));
  const moduleEvidence = JSON.parse(await readFile(path.join(moduleDir, 'evidence.json'), 'utf8'));
  const { manifest, verdict } = manifestsById[moduleId];
  return {
    knowledgeBaseVersion: moduleEvidence.knowledgeBaseVersion,
    evidenceReviewedThrough: moduleEvidence.reviewedThrough,
    ruleCount: moduleRules.length,
    diagnosticPatternCount: Object.keys(moduleCandidates).length,
    evidenceRecordCount: moduleEvidence.sources.length,
    manifest: {
      status: manifest.status,
      knowledgeBaseVersion: manifest.knowledgeBaseVersion,
      evidenceReviewedThrough: manifest.evidenceReviewedThrough,
      validationRunId: manifest.validationRunId,
      approvedBy: manifest.approvedBy,
      supersedes: manifest.supersedes,
    },
    evidenceStalenessPolicy: verdict.expiry && {
      maxAgeDays: verdict.expiry.maxAgeDays,
      enforced: verdict.expiry.enforced,
      disclosure: verdict.expiry.reason,
    },
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
