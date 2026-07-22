#!/usr/bin/env node
// tools/release-sign/cli.mjs — entry point for `tools/release-sign` (evidence-foundry-e1, P3-T1,
// FR-12, decisions block Risk 6).
//
// This CLI is the release-candidate signing/verification/registry tooling that sits downstream of
// E0's `rf-bundle-to-kb-pack` converter. See ./README.md for the full module boundary each verb
// dispatches to and the "never re-implement E0's canonicalization" contract this file's `manifest`
// verb upholds.
//
// Verbs:
//   manifest  — build/locate a staged kb-pack's release-manifest.unsigned.json (delegating to
//               E0's rf-bundle-to-kb-pack propose verb, never re-implementing it) and report its
//               canonical signing preimage: SHA-256 over the exact bytes E0 wrote. (P3-T1)
//   register  — append a release candidate to the append-only releases/registry.json. (P3-T4, not
//               yet implemented — this verb currently fails closed with a NotImplementedError)
//   sign      — detached Ed25519 signature over the manifest digest, human-offline by design; a
//               --dry-run mode is the only path any automated check may exercise (OQ-6). (P3-T2,
//               not yet implemented — this verb currently fails closed with a NotImplementedError)
//   verify    — fail-closed structural + cryptographic verification of a signed/dry-run candidate
//               against the registry (FR-13). (P3-T3, not yet implemented — this verb currently
//               fails closed with a NotImplementedError)
//
// node:crypto only — zero new crypto dependencies (decisions block Risk 6). Zero network calls,
// zero LLM/generative-model invocations, ever. `tools/release-sign` never authors clinical
// content or kb-pack artifacts itself — it only operates on what `rf-bundle-to-kb-pack propose`
// already produced.

import { run as runManifest } from './lib/manifest.mjs';
import { run as runRegister } from './lib/registry.mjs';
import { run as runSign } from './lib/sign.mjs';
import { run as runVerify } from './lib/verify.mjs';
import { ReleaseSignError, EXIT_OK, EXIT_USAGE } from './lib/errors.mjs';

const VERB_HANDLERS = Object.freeze({
  manifest: runManifest,
  register: runRegister,
  sign: runSign,
  verify: runVerify,
});

const HELP_TEXT = `release-sign — signed-release manifest / registry / sign / verify tooling for a
staged Evidence Foundry kb-pack (evidence-foundry-e1, FR-12, decisions block Risk 6).

Usage:
  node tools/release-sign/cli.mjs <verb> [options]

Verbs:
  manifest --pack <build/kb-pack/<moduleId>/<packVersion>/ dir>
      Read an already-built pack's release-manifest.unsigned.json and report its canonical
      signing preimage (SHA-256). Alternatively, build one fresh by delegating to E0's
      rf-bundle-to-kb-pack propose verb (never re-implementing its canonicalization):
  manifest --run-dir <rf run dir> --module <module.json> --decisions <authoring-decisions.yaml> --out <dir>

  register --candidate <manifest digest output> --registry releases/registry.json
      Append a release candidate to the append-only registry. (P3-T4, not yet implemented)

  sign --candidate <manifest digest output> [--dry-run] [--key <path>]
      Detached Ed25519 signature over the manifest digest. Designed for human offline execution;
      --dry-run is the only mode any automated check may invoke (OQ-6). (P3-T2, not yet
      implemented)

  verify --candidate <manifest> --registry releases/registry.json
      Fail-closed verification against a documented exit-code taxonomy (FR-13). (P3-T3, not yet
      implemented)

Global:
  -h, --help    Show this help and exit 0.

This tool makes zero network calls and invokes no LLM/generative model at any point.
`;

/**
 * Minimal, dependency-free `--flag value` / `--bool-flag` parser. Kebab-case flag names are
 * converted to camelCase keys (`--run-dir` -> `runDir`). A flag followed by another flag (or by
 * nothing) is treated as a boolean `true` rather than consuming the next token as its value.
 * Mirrors `tools/rf-bundle-to-kb-pack/cli.mjs#parseFlags` byte-for-byte (same convention, kept as
 * an independent copy rather than a cross-tool import — CLI argument parsing is not part of the
 * "never re-implement E0's canonicalization" boundary this task's own acceptance criteria names;
 * only the manifest-building/serialization step is).
 *
 * @param {string[]} argv arguments after the verb
 * @returns {Record<string, string | boolean>}
 */
export function parseFlags(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new ReleaseSignError(`unexpected positional argument "${token}"`, EXIT_USAGE);
    }
    const key = token
      .slice(2)
      .replace(/-([a-z0-9])/g, (_match, char) => char.toUpperCase());
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      options[key] = next;
      i += 1;
    } else {
      options[key] = true;
    }
  }
  return options;
}

/**
 * Runs a single verb handler and maps its outcome to a process exit code. This is this CLI's ONLY
 * generic-error handler — no other catch site in this tool may re-map a thrown
 * `ReleaseSignError`'s `exitCode`. A `ReleaseSignError` (or subclass) always forwards its own
 * fixed code verbatim; any other thrown value (a genuine bug, not a taxonomy-mapped failure
 * state) falls back to `EXIT_USAGE`.
 *
 * @param {(options: object) => Promise<number | void>} handler a verb's `run` function
 * @param {object} options parsed CLI flags for the verb
 * @returns {Promise<number>} the process exit code
 */
export async function dispatchVerb(handler, options) {
  try {
    const result = await handler(options);
    return typeof result === 'number' ? result : EXIT_OK;
  } catch (err) {
    if (err instanceof ReleaseSignError) {
      process.stderr.write(`${err.name}: ${err.message}\n`);
      return err.exitCode;
    }
    process.stderr.write(`internal error: ${err.stack || err.message}\n`);
    return EXIT_USAGE;
  }
}

/**
 * @param {string[]} argv `process.argv.slice(2)`
 * @returns {Promise<number>} the process exit code
 */
export async function main(argv) {
  const [verb, ...rest] = argv;

  if (!verb || verb === '-h' || verb === '--help') {
    process.stdout.write(HELP_TEXT);
    return EXIT_OK;
  }

  const handler = VERB_HANDLERS[verb];
  if (!handler) {
    process.stderr.write(`error: unknown verb "${verb}"\n\n`);
    process.stderr.write(HELP_TEXT);
    return EXIT_USAGE;
  }

  let options;
  try {
    options = parseFlags(rest);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return err instanceof ReleaseSignError ? err.exitCode : EXIT_USAGE;
  }

  return dispatchVerb(handler, options);
}

// Only run when invoked directly (`node cli.mjs ...`), not when imported (e.g. by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
