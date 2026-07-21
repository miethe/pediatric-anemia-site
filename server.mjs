import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessPediatricAnemia } from './src/engine.js';
import { EVIDENCE, KNOWLEDGE_BASE_VERSION, REVIEWED_THROUGH } from './src/evidence.js';
import { MODULE_IDS, DEFAULT_MODULE_ID } from './src/modules/registry.js';
import { shapeServerError } from './src/serverErrors.js';
import { verifyManifest, SUPPORTED_SCHEMA_VERSIONS } from './src/kbVerify.js';
import { EVIDENCE_STALENESS_POLICY } from './src/evidenceStalenessPolicy.js';
import { validate as validateManifestSchema } from './scripts/lib/json-schema-lite.mjs';
import { loadKbJsonFiles, loadKbSourceFiles } from './scripts/sign-kb.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '127.0.0.1';
const maxBodyBytes = 1_000_000;

const manifestSchema = JSON.parse(
  await readFile(path.join(root, 'schemas', 'module-manifest.schema.json'), 'utf8'),
);

// EP5-T5 (SPIKE-006 RQ4/Amendment 4) — the single startup-decision function for "is this module's
// manifest servable": schema-valid, hash-verified against the ACTUAL KB content supplied, on a
// schemaVersion this runtime supports, and (if a governance staleness window is ever set) not
// expired. Exported so tests can drive it directly against in-memory manifests/content, per this
// task's own test-design note, rather than mutating modules/anemia/module.json on disk.
//
// All the real decision logic lives in src/kbVerify.js#verifyManifest (do not re-derive it here);
// this function only assembles this runtime's specific inputs: the schema errors (computed via
// scripts/lib/json-schema-lite.mjs, which stays out of src/kbVerify.js so that file remains
// importable by a future browser build — see src/lib/jcs.mjs's header), the schemaVersions this
// server/build understands, and the evidence-staleness policy declared in
// src/evidenceStalenessPolicy.js (never invented here).
export async function verifyModuleManifest({ moduleId, manifest, files, sourceFiles, now }) {
  const schemaErrors = manifest && typeof manifest === 'object'
    ? validateManifestSchema(manifestSchema, manifest)
    : [];
  return verifyManifest({
    manifest,
    moduleId,
    files,
    sourceFiles,
    schemaErrors,
    supportedSchemaVersions: SUPPORTED_SCHEMA_VERSIONS,
    evidenceStalenessPolicy: EVIDENCE_STALENESS_POLICY,
    now,
  });
}

// Logs the manifest verdict's evidence-staleness disclosure LOUDLY at startup — regardless of
// whether the manifest is servable — so "no policy is set" can never be read as "expiry was
// checked and passed" (Amendment 4's central requirement).
function discloseEvidenceStaleness(moduleId, verdict) {
  if (!verdict.expiry) return;
  if (verdict.expiry.enforced) {
    console.log(`Module "${moduleId}": evidence-staleness expiry ENFORCED — ${verdict.expiry.reason}`);
  } else {
    console.warn(`Module "${moduleId}": evidence-staleness expiry NOT ENFORCED — ${verdict.expiry.reason}`);
  }
}

// Startup: load every registered module's knowledge base AND its manifest verdict. Loading and
// disclosure ALWAYS succeed for every registered module (KB files + manifest.json are read, and
// verifyModuleManifest's verdict — servable or not — is computed and returned); this function
// never throws on a non-servable manifest. Whether a non-servable verdict is fatal is the
// CALLER's decision (see the loop below): missing/schema-invalid/tampered/incompatible/expired on
// the module this server actually serves refuses to start (SPIKE-006 RQ4, docs/architecture.md
// §10); the same verdict on any other registered module is disclosed, not fatal — no
// client-facing moduleId surface exists (platform-foundation-p0-v1.md Sequencing Note 6), so no
// route depends on any module but DEFAULT_MODULE_ID being servable.
async function loadModuleData(moduleId) {
  const moduleDir = path.join(root, 'modules', moduleId);
  const moduleRules = JSON.parse(await readFile(path.join(moduleDir, 'rules.json'), 'utf8'));
  const moduleCandidates = JSON.parse(await readFile(path.join(moduleDir, 'candidates.json'), 'utf8'));
  const moduleEvidence = JSON.parse(await readFile(path.join(moduleDir, 'evidence.json'), 'utf8'));
  // No more ENOENT tolerance: a missing module.json is fatal, exactly like a missing rules.json.
  const manifest = JSON.parse(await readFile(path.join(moduleDir, 'module.json'), 'utf8'));

  const files = await loadKbJsonFiles();
  const sourceFiles = await loadKbSourceFiles();
  const manifestVerdict = await verifyModuleManifest({ moduleId, manifest, files, sourceFiles });
  discloseEvidenceStaleness(moduleId, manifestVerdict);

  return {
    rules: moduleRules,
    candidates: moduleCandidates,
    evidenceSources: moduleEvidence.sources ?? [],
    manifest,
    manifestVerdict,
  };
}

// evidence-foundry-buildout P1-T3 (in-flight finding): this loop used to exit fatally whenever
// ANY registered module's manifest failed verification — written when 'anemia' was the only
// registered module, so "any module" and "the served module" were the same thing. That stopped
// being true the moment a second module was registered (OQ-1): `cbc_suite_v1` is a deliberate
// `unsigned-stub` scaffold with zero client-facing moduleId surface (R-P4/PRD §6.1 — no route
// lets a caller reach it), so it legitimately never passes manifest verification until it is
// reviewed and signed. Only `DEFAULT_MODULE_ID` — the module actually served by every existing
// route — still fails closed exactly as before; every other registered module's KB data and
// manifest verdict are still loaded and disclosed (see modulesSummary below), just never fatal.
const modulesById = {};
for (const moduleId of MODULE_IDS) {
  let moduleData;
  try {
    moduleData = await loadModuleData(moduleId);
  } catch (error) {
    console.error(`Fatal: failed to load knowledge base for module "${moduleId}": ${error.message}`);
    process.exit(1);
  }
  if (moduleId === DEFAULT_MODULE_ID && !moduleData.manifestVerdict.servable) {
    console.error(
      `Fatal: module "${moduleId}" manifest failed verification — refusing to serve: `
        + `${moduleData.manifestVerdict.reasons.join('; ')}`,
    );
    process.exit(1);
  }
  modulesById[moduleId] = moduleData;
}

const rules = modulesById.anemia.rules;
const candidates = modulesById.anemia.candidates;

// Additive per-module discovery breakdown surfaced on GET /api/v1/knowledge-base — always
// present, not conditional on any request param (no moduleId request surface exists, AC-5), and
// present for EVERY registered module regardless of servability (proves the discovery plumbing
// generalizes to a second module, per scripts/smoke-test.mjs's own stated design intent).
// `manifest`/`evidenceStalenessPolicy` disclose the same provenance this server verified at
// startup (AC-WP5-RESIL): `approvedBy: []` and `supersedes: null` are served as-is, never as an
// error, a null `evidenceStalenessPolicy.maxAgeDays` is disclosed as "not enforced" rather than
// omitted, and a non-servable manifest (e.g. `cbc_suite_v1`'s `unsigned-stub` status today) is
// disclosed exactly as read — this endpoint never hides a module's real, unservable state.
const modulesSummary = Object.fromEntries(
  MODULE_IDS.map((moduleId) => {
    const moduleData = modulesById[moduleId];
    const { manifest, manifestVerdict } = moduleData;
    return [
      moduleId,
      {
        ruleCount: moduleData.rules.length,
        diagnosticPatternCount: Object.keys(moduleData.candidates).length,
        evidenceRecordCount: moduleData.evidenceSources.length,
        manifest: {
          status: manifest.status,
          knowledgeBaseVersion: manifest.knowledgeBaseVersion,
          evidenceReviewedThrough: manifest.evidenceReviewedThrough,
          validationRunId: manifest.validationRunId,
          approvedBy: manifest.approvedBy,
          supersedes: manifest.supersedes,
        },
        evidenceStalenessPolicy: manifestVerdict.expiry && {
          maxAgeDays: manifestVerdict.expiry.maxAgeDays,
          enforced: manifestVerdict.expiry.enforced,
          disclosure: manifestVerdict.expiry.reason,
        },
      },
    ];
  }),
);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.yml': 'application/yaml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const commonHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'",
};

function sendJson(response, status, payload, requestId) {
  response.writeHead(status, {
    ...commonHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'X-Request-Id': requestId,
  });
  response.end(JSON.stringify(payload));
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requested = decoded === '/' ? '/index.html' : decoded;
  const resolved = path.resolve(root, `.${requested}`);
  if (!resolved.startsWith(root)) throw new Error('Invalid path');
  return resolved;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
  }
}

export async function handleRequest(request, response) {
  const requestId = randomUUID();
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, {
        status: 'ok',
        knowledgeBaseVersion: KNOWLEDGE_BASE_VERSION,
        evidenceReviewedThrough: REVIEWED_THROUGH,
      }, requestId);
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/knowledge-base') {
      return sendJson(response, 200, {
        knowledgeBaseVersion: KNOWLEDGE_BASE_VERSION,
        evidenceReviewedThrough: REVIEWED_THROUGH,
        ruleCount: rules.length,
        diagnosticPatternCount: Object.keys(candidates).length,
        evidence: Object.values(EVIDENCE),
        modules: modulesSummary,
      }, requestId);
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/assess') {
      const input = await readJsonBody(request);
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return sendJson(response, 400, { error: 'Body must be a patient-input JSON object.' }, requestId);
      }
      const result = assessPediatricAnemia(input, rules, candidates);
      return sendJson(response, 200, result, requestId);
    }

    if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
      return sendJson(response, 405, { error: 'Method not allowed' }, requestId);
    }

    let filename = safePath(url.pathname);
    const info = await stat(filename);
    if (info.isDirectory()) filename = path.join(filename, 'index.html');
    const content = await readFile(filename);
    response.writeHead(200, {
      ...commonHeaders,
      'Content-Type': mime[path.extname(filename)] || 'application/octet-stream',
      'X-Request-Id': requestId,
    });
    if (request.method === 'HEAD') response.end();
    else response.end(content);
  } catch (error) {
    const { status, body } = shapeServerError(error);
    sendJson(response, status, body, requestId);
  }
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const server = http.createServer(handleRequest);
  server.listen(port, host, () => {
    console.log(`Pediatric Anemia CDSS running at http://${host}:${port}`);
    console.log('No request bodies are logged or persisted by this prototype server.');
  });
}
