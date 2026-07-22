// tools/review-record/lib/history.mjs — FR-9/OQ-2 append-only layer (b): git-history check
// (P2-T3, `extended` effort — "the risk-hotspot task in this phase").
//
// This is the SECOND of the two append-only layers this task builds. Layer (a) is
// `lib/chain.mjs`'s `previousRecordHash` hash-chain primitive, enforced fail-closed by
// `lib/verbs/validate.mjs` (recompute + reject on any break — see that file's own header). Layer
// (a) alone cannot catch every append-only violation: two records can still "chain" correctly by
// coincidence even if an EARLIER record's committed file was silently edited in place after the
// fact (the edit only breaks the chain if some LATER record's `previousRecordHash` still points at
// the old bytes — a lone, un-superseded record's own in-place edit breaks nothing chain-wise). This
// module closes that gap by asking git itself: has ANY `modules/<moduleId>/reviews/*.yaml` path
// EVER been touched by more than one commit?
//
// Mechanism: `git log --name-status` scoped to `modules/<moduleId>/reviews` inside `rootDir`'s
// working tree, parsed into a per-path status history. An append-only-compliant path has EXACTLY
// ONE history entry, with status `A` (added). Any second entry for the same path — `M` (modified),
// `D` (deleted), a rename (disabled below via `-c diff.renames=false` so an in-place rewrite always
// shows as plain `D`+`A` on two DIFFERENT paths, never masked as a single `R` entry on one path),
// or even a second `A` — is a commit-visible mutation or deletion the append-only contract (ADR-0004
// decision item 1, OQ-2) forbids: a correction MUST be a brand-new file (`supersedes: <review_id>`),
// never a second commit touching an existing record's path.
//
// This is a LOCAL, OFFLINE `git` invocation (`node:child_process`, no shell) against the working
// tree already present on disk — never a network fetch/clone/pull/push. This tool's own
// zero-network static grep (tests/ef-review-record-cli.test.mjs) forbids `node:http`/`node:https`/
// `node:dgram`/`node:net`/`fetch`/`XMLHttpRequest`/`WebSocket`/generative-model SDKs; `node:child_process`
// invoking the locally-installed `git` binary is none of those and stays git's own long-established
// commit history — nothing here contacts a remote.
//
// `validate --history` (`lib/verbs/validate.mjs`) is the fail-closed CALLER of this module. This
// module itself only ever REPORTS a structured, deterministic finding per path — it throws only for
// a genuine tool-usage failure (`--root` is not inside a git working tree, or the `git` invocation
// itself errors), never for a detected mutation; the decision to reject a detected mutation belongs
// to the caller (`ValidationFailedError`), matching this tool's existing roster/chain module split
// (see `lib/roster.mjs`/`lib/chain.mjs`'s own "report vs. enforce" boundaries).
//
// NFR observability: `checkAppendOnlyHistory`'s return value is this layer's structured audit
// artifact — a plain, JSON-serializable object, deterministic across repeated calls against the
// same git history (pure function of `git log`'s own output, sorted by path) — see
// tests/ef-review-appendonly.test.mjs's determinism assertion.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { UsageError } from './errors.mjs';

/** `validate --history` (or a direct caller) was invoked against a `--root` that is not inside a
 * git working tree. Fails closed rather than silently skipping the check — matches this tool's
 * existing fail-closed posture for a missing roster file, a malformed review_id, etc. */
export class NotAGitRepositoryError extends UsageError {
  constructor(rootDir) {
    super(
      `"${rootDir}" is not inside a git working tree -- validate --history requires committed git `
        + 'history to inspect (FR-9 append-only layer b); this check fails closed rather than '
        + 'silently skipping the git-history validator.',
    );
    this.rootDir = rootDir;
  }
}

/** The underlying `git` invocation itself failed for a reason other than "not a repository" (e.g. a
 * corrupt repository, or the `git` binary is unavailable). Also fails closed rather than treating a
 * tooling failure as a clean pass. */
export class GitHistoryCheckError extends UsageError {
  constructor(message) {
    super(`validate --history: git invocation failed -- ${message}`);
  }
}

// A control-character-delimited marker (ASCII Record Separator, 0x1E -- NOT a NUL byte: Node's
// child_process argv marshalling rejects embedded NUL bytes in any arg, since argv entries are
// C strings under the hood). 0x1E is virtually guaranteed to never collide with a real commit SHA
// or file path, so the parser below can split on it unambiguously.
const COMMIT_MARKER = 'COMMIT';

/**
 * @param {string} rootDir
 * @returns {boolean} true iff `rootDir` is inside a git working tree
 */
export function isGitWorkTree(rootDir) {
  try {
    const out = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Runs `git log --reverse --name-status` scoped to `modules/<moduleId>/reviews` inside `rootDir`
 * and returns the raw stdout. Renames are explicitly disabled (`-c diff.renames=false`) so a
 * path-level rewrite always surfaces as separate `D`/`A` entries rather than being folded into a
 * single misleading `R` entry that could otherwise be mistaken for "only ever added once" on
 * either the old or new path.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {string}
 */
function runGitLog(rootDir, moduleId) {
  const pathspec = path.posix.join('modules', moduleId, 'reviews');
  try {
    return execFileSync(
      'git',
      [
        '-c', 'diff.renames=false',
        'log', '--reverse', '--name-status',
        `--pretty=format:${COMMIT_MARKER}%H`,
        '--', pathspec,
      ],
      { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (err) {
    const detail = typeof err.stderr === 'string' && err.stderr.length > 0 ? err.stderr : err.message;
    throw new GitHistoryCheckError(detail);
  }
}

/**
 * Parses `git log --name-status --pretty=format:<marker><sha>` output (oldest-first, since the
 * caller always passes `--reverse`) into one entry per commit.
 *
 * @param {string} raw
 * @returns {{ sha: string, changes: { status: string, path: string }[] }[]}
 */
export function parseNameStatusLog(raw) {
  if (raw.trim().length === 0) return [];
  const blocks = raw.split(COMMIT_MARKER).filter((block) => block.length > 0);
  return blocks.map((block) => {
    const lines = block.split('\n').filter((line) => line.length > 0);
    const [sha, ...statusLines] = lines;
    const changes = statusLines.map((line) => {
      const [status, ...rest] = line.split('\t');
      return { status, path: rest.join('\t') };
    });
    return { sha, changes };
  });
}

/**
 * Layer (b)'s core audit: for every path git history ever recorded under
 * `modules/<moduleId>/reviews/` (inside `rootDir`), is that path's FULL history exactly one `A`
 * (added) entry? Returns a structured, deterministic report — one entry per distinct path
 * encountered, sorted by path (the NFR-observability "structured audit artifact" this task's own
 * description names) — plus a top-level `ok`. Never throws for a DETECTED violation (that
 * decision belongs to the caller, `validate`); only throws `NotAGitRepositoryError`/
 * `GitHistoryCheckError` for a genuine tool-usage failure.
 *
 * A module with no git history at all under its `reviews/` path (the common case — most modules
 * have committed nothing there yet) is NOT an error: it simply yields `{ ok: true, paths: [] }`,
 * mirroring `lib/store.mjs#listModuleReviewRecords`'s own existence-gate posture for a module with
 * no `reviews/` directory on disk yet.
 *
 * @param {string} rootDir
 * @param {string} moduleId
 * @returns {{ moduleId: string, ok: boolean, paths: { path: string, statuses: string[], ok: boolean, reason: string|null }[] }}
 */
export function checkAppendOnlyHistory(rootDir, moduleId) {
  if (!isGitWorkTree(rootDir)) throw new NotAGitRepositoryError(rootDir);

  const commits = parseNameStatusLog(runGitLog(rootDir, moduleId));

  const statusesByPath = new Map();
  for (const commit of commits) {
    for (const change of commit.changes) {
      const list = statusesByPath.get(change.path) ?? [];
      list.push(change.status);
      statusesByPath.set(change.path, list);
    }
  }

  const paths = [...statusesByPath.keys()].sort().map((changedPath) => {
    const statuses = statusesByPath.get(changedPath);
    const ok = statuses.length === 1 && statuses[0] === 'A';
    return {
      path: changedPath,
      statuses,
      ok,
      reason: ok
        ? null
        : `git history shows ${statuses.length} commit-visible change(s) with status sequence `
          + `[${statuses.join(', ')}] for this path -- an append-only record path must be added `
          + 'exactly once (status "A") and never modified, deleted, or renamed again afterward; a '
          + 'correction must be a NEW file with `supersedes` set, never a second commit touching an '
          + 'existing record path',
    };
  });

  return { moduleId, ok: paths.every((entry) => entry.ok), paths };
}
