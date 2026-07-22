// tools/review-record/lib/verbs/render.mjs — `render` verb, real implementation (P2-T6,
// FR-8/FR-31/OQ-3).
//
// `render --module <id> [--record <review_id>] [--root <dir>] [--out <dir>]`: reads a module's
// already-committed review-record chain plus (existence-gated) its `traceability-index.json` /
// `evidence-assertions.json`, and writes ONE self-contained static HTML file — never a directory of
// linked pages, never anything with a `<script>` tag or an external URL reference (see
// `lib/render.mjs`'s own header for the full FR-8/FR-31 rationale). This verb is the ONLY thing in
// this whole tool that writes under `build/` — `--out` defaults to `<cwd>/build/review-render/`
// (OQ-3, git-ignored), never `docs/`, never the SPA build, and is never derived from `--root` (which
// only ever names where the SOURCE artifacts live — tests point `--root` at a fixture tree while
// still writing output to a scratch `--out` directory, so a render invocation over fixture data can
// never collide with or be mistaken for a real `build/review-render/` output).
//
// Read-only with respect to `modules/`: this verb never writes, renames, or deletes anything under
// `modules/<id>/reviews/` (that is `scaffold`'s sole write path, P2-T2) — it only reads via
// `lib/render.mjs`'s `loadModuleRenderData`.

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

import { loadModuleRenderData, renderModuleHtml, selectRecord } from '../render.mjs';
import { EXIT_OK, UsageError } from '../errors.mjs';

/**
 * @param {{ module?: string, record?: string, root?: string, out?: string }} options
 * @returns {Promise<number>}
 */
export async function run(options = {}) {
  const moduleId = options.module;
  if (typeof moduleId !== 'string' || moduleId.length === 0) {
    throw new UsageError('render requires --module <module_id>');
  }

  const rootDir = typeof options.root === 'string' && options.root.length > 0
    ? options.root
    : process.cwd();
  const outDir = typeof options.out === 'string' && options.out.length > 0
    ? options.out
    : path.join(process.cwd(), 'build', 'review-render');

  const data = await loadModuleRenderData(rootDir, moduleId);

  let recordFilter = null;
  if (typeof options.record === 'string' && options.record.length > 0) {
    selectRecord(data.records, options.record, moduleId); // throws ReviewRecordNotFoundError, fail closed
    recordFilter = options.record;
  }

  const html = renderModuleHtml({ ...data, recordFilter });

  const moduleOutDir = path.join(outDir, moduleId);
  await mkdir(moduleOutDir, { recursive: true });
  const filename = recordFilter ? `${recordFilter}.html` : 'index.html';
  const filePath = path.join(moduleOutDir, filename);
  await writeFile(filePath, html, 'utf8');

  process.stdout.write(
    `Wrote ${filePath}\n`
      + 'Read-only static render -- not a portal, and not a clinical-validity, safety, or approval '
      + 'claim (FR-8/FR-28).\n',
  );
  return EXIT_OK;
}
