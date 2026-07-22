---
name: shared-worktree-verify-technique
description: How to isolate a phase's own gate-failure contribution when its worktree is shared with concurrent in-flight, uncommitted work from another agent/session
metadata:
  type: feedback
---

When reviewing a phase in this repo's dev-execution worktrees (e.g.
`.claude/worktrees/<slug>`), the same worktree checkout is often shared concurrently by
sibling phase-owner agents (e.g. Phase 4 and Phase 5 of `multi-bundle-conversion-e1` ran in
the same worktree at once). A `git status` showing unrelated modified/untracked files from
another in-flight task is expected, not a red flag by itself — and a red `npm run check` at
review time does not automatically mean the reviewed phase's own commits are broken.

**Technique**: `git stash` the concurrent/unrelated uncommitted changes, re-run the specific
failing test file(s), then `git stash pop`. If the tests pass clean with the concurrent work
stashed out, the reviewed phase's *committed* work is not at fault — the failure belongs to
the other in-flight task. Always re-stash (`stash pop`) immediately after, and never leave the
tree in the stashed state at the end of review (do not commit/stash on the executor's behalf).

**Why**: Executors in this program (see `dev-execution` skill git-worktree-pr-protocol) are
told to commit immediately per phase specifically because worktrees are shared and uncommitted
work can be transiently reverted/clobbered by a sibling session. A conscientious executor will
flag this exact situation in their completion report (a "GATE CAVEAT") rather than hiding it —
when they do, verify the caveat is true (as above) rather than either blindly trusting or
blindly rejecting on a red aggregate `npm run check`.

**How to apply**: Before failing a phase for a red `npm run check`, check whether the failing
test files touch files/modules outside the reviewed phase's stated scope (e.g. failures in
`modules/cbc_suite_v1/**` tests when reviewing a `modules/kidney_suite_v1/**` phase). If so,
run the stash-and-isolate check before concluding the phase itself is broken. See
[[multi-bundle-conversion-e1-program-state]] for the concrete instance this came from.
