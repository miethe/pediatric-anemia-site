// tools/release-sign/lib/manifest.mjs — `manifest` verb (P3-T1, FR-12, decisions block Risk 6).
//
// Builds (or locates) a staged kb-pack's release-candidate hash manifest: the small, sole-purpose
// summary object `register`/`sign`/`verify` (P3-T2..T4, not yet implemented) key off of. This
// module never re-implements manifest construction or its canonical serialization — when a fresh
// pack is requested, it imports and calls E0's own `rf-bundle-to-kb-pack` `propose` verb
// unmodified; when an existing pack is given, it only ever reads `release-manifest.unsigned.json`
// back verbatim via `./canonical-bytes.mjs`. Either path, the reported `preimageSha256` is
// computed over bytes `propose.mjs` itself wrote — never bytes this tool re-serialized.
//
// `tools/release-sign` is a downstream, later-stage tool: it never authors clinical content or
// kb-pack artifacts itself, only signs/verifies/registers what `rf-bundle-to-kb-pack propose`
// already produced.

import { run as runPropose } from '../../rf-bundle-to-kb-pack/lib/verbs/propose.mjs';
import { readCanonicalManifestBytes, RELEASE_MANIFEST_FILENAME } from './canonical-bytes.mjs';
import { UsageError } from './errors.mjs';

/**
 * @param {object} options
 * @param {string} [options.pack] an existing `build/kb-pack/<moduleId>/<packVersion>/` directory
 *   that already contains `release-manifest.unsigned.json` (a prior `propose` run). When given,
 *   this verb performs zero writes — read-only.
 * @param {string} [options.runDir] an `rf` run directory (mirrors `propose`'s own `--run-dir`).
 *   Required together with `module`/`decisions`/`out` when `pack` is omitted — this verb then
 *   delegates the entire build, unmodified, to E0's `propose` verb before reading its output.
 * @param {string} [options.module] path to the target module's `module.json`.
 * @param {string} [options.decisions] path to the target module's `authoring-decisions.yaml`.
 * @param {string} [options.out] output directory `propose` should write the pack into (becomes
 *   `pack` for the read-back step).
 * @returns {Promise<{schemaVersion: string, packDir: string, manifestFile: string,
 *   manifestPath: string, preimageSha256: string, preimageByteLength: number}>} the
 *   release-candidate hash manifest — printed to stdout as its own return value's JSON form.
 */
export async function run(options = {}) {
  const { pack, runDir, module, decisions, out } = options;

  let packDir = pack;
  if (!packDir) {
    if (!runDir || !module || !decisions || !out) {
      throw new UsageError(
        'manifest requires either --pack <existing build/kb-pack dir already produced by ' +
          "rf-bundle-to-kb-pack's propose verb> or the full --run-dir/--module/--decisions/--out " +
          "set to build one fresh (this verb delegates that build to E0's propose verb verbatim, " +
          'never re-implementing it)',
      );
    }
    // Delegate ALL manifest construction and canonical serialization to E0's own converter — the
    // "never re-implement" boundary this task's acceptance criteria requires. Any other converter
    // output this run also produces (rules.json, candidates.json, etc.) is a side effect this
    // verb does not inspect or depend on; it only reads release-manifest.unsigned.json back.
    await runPropose({ runDir, module, decisions, out });
    packDir = out;
  }

  const { manifestPath, bytes, sha256 } = await readCanonicalManifestBytes(packDir);

  const candidate = {
    schemaVersion: '1.0',
    packDir,
    manifestFile: RELEASE_MANIFEST_FILENAME,
    manifestPath,
    preimageSha256: `sha256:${sha256}`,
    preimageByteLength: bytes.length,
  };

  process.stdout.write(`${JSON.stringify(candidate, null, 2)}\n`);
  return candidate;
}
