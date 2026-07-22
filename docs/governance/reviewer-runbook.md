# Reviewer Runbook: The Five-Role Clinical Review Workflow

## What this is

This is a guide for clinicians — not software engineers — who will eventually take part in
reviewing this codebase's clinical content. It walks through the `review-record` tool, a
command-line program that records review decisions as plain text files tracked by `git` (the
version-control system this codebase's history lives in).

**This codebase is an unvalidated research prototype.** Nothing described in this document —
running a command, seeing a record marked "valid," reading a "complete" review chain — is a
clinical-validity, safety, diagnostic-performance, or regulatory claim. It is a record of who did
what, in what order, with a proof that the record itself has not been altered. Whether the
*clinical reasoning* behind a review is sound is a judgment for you, the reviewer, and for the
separate, slower validation gates this program has not yet passed (see the closing section).

A few terms used throughout, defined once here:

- **Terminal** — the text-only window where you type commands and read their output. On a Mac
  this is the "Terminal" application; on other systems it may be called a shell or console.
- **git commit** — a permanent, timestamped snapshot of file changes, saved to the project's
  history along with who made it. Once made, a commit is not silently edited — later work adds
  new commits on top; it does not rewrite old ones.
- **YAML file** — a plain-text way of writing structured information as indented `key: value`
  lines. Every review record is one YAML file.
- **Hash** — a long string of letters and numbers (for example
  `sha256:0a91991b6fd8b2480fed14625c461ba09d8eb4c9e4ba022c19e8fb72257103b2`) computed from a
  file's exact contents. Change even one character of the content and the hash changes completely
  — so a hash lets the tool prove a file has (or has not) been tampered with, without you having
  to compare the whole file by eye.
- **Append-only** — new records get added; existing ones are never edited or deleted. This is
  explained in full below.

Everything below runs through one program: `node tools/review-record/cli.mjs <verb> [options]`,
run from the repository's root directory (the folder containing this repo's `package.json`). It
makes no network calls and asks no AI/generative model anything — every check it performs is
deterministic and offline.

## The five roles

A clinical proposal (for example, a set of rules for one module, such as the CBC — complete blood
count — suite) passes through five review roles, always in this order, defined by
`docs/adr/0004-clinical-approval-identity-adjudication.md` (an architecture decision record,
status **"proposed" — not yet formally ratified by clinical governance**):

1. **`clinical-1`** — the first independent clinical content review. For a CBC module this would
   be a pediatric hematologist or the subspecialist appropriate to that module. Reviews the
   proposal on its own merits and records approve / reject / request-changes plus a rationale.
2. **`clinical-2`** — a *second, independent* clinical content review by a *different* qualified
   pediatric clinician. Critically, reviewer 2 does not read reviewer 1's record before forming
   their own opinion — this is a structural guarantee of the tool, not just a policy (see below).
   Reviewer 2 must not simply countersign reviewer 1.
3. **`lab`** — laboratory medicine / pathology review, for any module whose rules depend on lab
   reference ranges or assay behavior.
4. **`adjudication`** — resolves a *disagreement* between `clinical-1` and `clinical-2`. If the two
   clinical reviewers agree, this role is not required at all and the sequence moves straight to
   release authorization. If they disagree, a named adjudicator — someone who did not author the
   proposal — reviews both records and records the resolving decision.
5. **`release-auth`** — release authorization. The only role whose record can ever move a module
   toward release-ready status, and only once every role above it is complete.

The tool tracks, for any module, which of these five records already exist and which role is
expected next (`status`'s `nextExpectedRole`) — see below.

## How corrections work: supersedes, never edits

Once a review record file is written, it is never opened and changed again. If a reviewer needs to
correct or revise a decision — a typo, new information, a change of mind — they do not edit the
old file. They author a brand-new record whose `supersedes` field names the review it replaces
(for example, a new `clinical-2` record with `supersedes: rr-0002-clinical-2`). The old file stays
exactly where it was, unmodified, forever.

This matters for the same reason a lab keeps every superseded result rather than writing over it:
the full history — what was decided, by whom, and when it changed — has to stay inspectable. The
tool enforces this two separate ways, both fail-closed (meaning: if either check cannot be
completed successfully, the tool reports a failure rather than guessing): every record links to the
one before it by hash, so an in-place edit breaks the chain; and (optionally, via `validate
--history`) the tool can walk the actual `git` commit history of the `reviews/` folder and confirm
that no file was ever touched by more than one commit. A correction is always a brand-new file with
its own single "added" commit — that is what makes it a legitimate correction rather than a
disallowed edit.

## What "structurally non-qualifying" means

Run `status` or `validate` over a review chain built entirely from synthetic (practice, fake, or
test) identities, and you will see wording like this — it is the tool's real, verbatim output on
this repository's own committed practice set:

```
derivedState: structurally-non-qualifying
Terminal state reached (structurally-non-qualifying) -- no further role is expected.
This is the correct, by-design terminus for a fully synthetic:true record set (FR-6) -- not a defect.
```

Read this plainly: the tool has confirmed the five records exist, are in the right order, are
linked correctly, and are cryptographically signed — but it also knows every one of those
identities is a labeled test persona, not a credentialed clinician. So it reports the chain as
**structurally sound but never eligible for release authorization.** That is not a bug to be fixed
or a state to escape by re-running anything — it is the tool correctly refusing to treat practice
records as if they were real clinical sign-off. The only way a review chain stops being
structurally non-qualifying is for real, out-of-band-verified reviewer identities to replace the
synthetic ones — a human governance step (gate **G1**) described in the second track below, not a
software feature this tool can grant itself.

## Reading the committed `cbc_suite_v1` example

Before doing anything yourself, look at a complete example that is already sitting in this
repository: `modules/cbc_suite_v1/reviews/` holds five files, `rr-0001-clinical-1.yaml` through
`rr-0005-release-auth.yaml` — one full pass through all five roles, using clearly-labeled synthetic
personas (`dryrun-cbc-suite-clinical-1`, and so on; every rationale field says outright that it is
"SYNTHETIC" / "NOT A CREDENTIALED REVIEWER"). From the repository root:

```
git log --oneline -- modules/cbc_suite_v1/reviews/
```

shows a single commit that added all five files — and nothing since. That single "added, never
touched again" commit per file is the append-only guarantee in `git`'s own history, exactly as
described above.

```
node tools/review-record/cli.mjs list --module cbc_suite_v1
```

prints a plain, read-only summary: each record's role, reviewer, decision, and whether its link to
the previous record checks out. Read-only means this command cannot fail closed or change
anything — it only reports what it sees.

```
node tools/review-record/cli.mjs status --module cbc_suite_v1
```

reports the derived state described above (`structurally-non-qualifying`) plus every record, in
role order.

```
node tools/review-record/cli.mjs render --module cbc_suite_v1 --out /tmp/cbc-suite-review
```

writes one self-contained HTML page you can open in a browser (no server, no login, no
internet connection involved) showing the same chain laid out for reading. Every page it produces
carries an unvalidated-research-prototype banner and labels every synthetic record as such.

All four commands above are entirely read-only and safe to run against the real repository exactly
as shown.

## Exercise track (synthetic personas)

**Start here.** This track lets you practice the full five-role mechanics, hands-on, using the
same kind of synthetic personas as the committed example above, causing zero effect on the real
repository. This is the *only* track in this document where the `sign` verb is ever demonstrated.

### Set up a practice copy

Everything below happens in a throwaway copy outside the repository, so nothing you do here can
change the real, committed `modules/cbc_suite_v1/reviews/` files. From the repository root:

```
mkdir -p /tmp/review-practice/modules /tmp/review-practice/governance
cp -r modules/cbc_suite_v1 /tmp/review-practice/modules/
rm -rf /tmp/review-practice/modules/cbc_suite_v1/reviews
mkdir /tmp/review-practice/modules/cbc_suite_v1/reviews
cp governance/reviewer-roster.yaml /tmp/review-practice/governance/
cd /tmp/review-practice
git init -q
git config user.email "you@example.com"
git config user.name "Practice Reviewer"
git add -A
git commit -q -m "practice copy of cbc_suite_v1"
cd -
```

This copies the CBC module's real content plus the real reviewer roster (which already lists the
five synthetic `dryrun-cbc-suite-*` personas you saw in the example above), but starts you with an
*empty* `reviews/` folder so you can walk the whole five-role sequence from the beginning. The
practice copy also needs its own tiny `git` repository — one of the tool's checks (confirming who
is and is not an author of the content under review) only runs inside a real `git` working tree, so
without this step a later step in this walkthrough would fail closed for the wrong reason. Every
command below adds `--root /tmp/review-practice` so it points at this practice copy, never the
real repository.

Confirm you are starting clean:

```
node tools/review-record/cli.mjs status --module cbc_suite_v1 --root /tmp/review-practice
```

You should see `derivedState: not-started` and `Next expected role: clinical-1`.

### Role 1 — `clinical-1`

Building a record is two steps: `scaffold` drafts it, `sign` finalizes and commits it.

```
node tools/review-record/cli.mjs scaffold \
  --module cbc_suite_v1 --role clinical-1 --reviewer-id dryrun-cbc-suite-clinical-1 \
  --decision approve \
  --rationale "EXERCISE WALKTHROUGH -- synthetic persona, not a real clinical review." \
  --draft --root /tmp/review-practice
```

This writes a **staged draft** — a preview, not yet a committed record — to
`/tmp/review-practice/.review-drafts/cbc_suite_v1/rr-0001-clinical-1.draft.yaml` and prints that
exact path. Nothing under `reviews/` has changed yet. You can open the draft file and read it: it
is a plain YAML file with your reviewer ID, decision, rationale, a timestamp, and (for now)
`signature: null`.

```
node tools/review-record/cli.mjs sign \
  --draft /tmp/review-practice/.review-drafts/cbc_suite_v1/rr-0001-clinical-1.draft.yaml \
  --module cbc_suite_v1 --root /tmp/review-practice
```

`sign` reads only that staged draft file — never a file already committed under `reviews/`. Because
this draft is a labeled synthetic (practice) record, `sign` generates a temporary practice
signing key, uses it once, and immediately discards it (it is never saved to disk). It then writes
the finished, signed record to `modules/cbc_suite_v1/reviews/rr-0001-clinical-1.yaml` inside your
practice copy — the record's one and only committed write. Check the new state:

```
node tools/review-record/cli.mjs status --module cbc_suite_v1 --root /tmp/review-practice
```

`derivedState` now reads `in-progress` and the next expected role is `clinical-2`.

### Role 2 — `clinical-2`, and a real example of a correction

Repeat the same two steps for `clinical-2`, using a different synthetic reviewer ID and writing
your own independent rationale — do not copy reviewer 1's wording, for the same reason a real
second reviewer would not read reviewer 1's notes first: the tool actually checks for this
(reviewer-2 independence). If clinical-2's rationale is written using the same wording as
clinical-1's, `status`/`validate` will report `derivedState: invalid` with a blocker naming the
overlap — that is the independence check working, not a malfunction.

If that happens (or for any other reason you need to correct a filed record — a typo, a change of
mind), you never edit the file. You file a new one that supersedes it:

```
node tools/review-record/cli.mjs scaffold \
  --module cbc_suite_v1 --role clinical-2 --reviewer-id dryrun-cbc-suite-clinical-2 \
  --decision approve \
  --rationale "SECOND SYNTHETIC WALKTHROUGH PASS, WRITTEN INDEPENDENTLY -- confirms the same structural conclusion via separate wording." \
  --supersedes rr-0002-clinical-2 \
  --draft --root /tmp/review-practice

node tools/review-record/cli.mjs sign \
  --draft /tmp/review-practice/.review-drafts/cbc_suite_v1/rr-0003-clinical-2.draft.yaml \
  --module cbc_suite_v1 --root /tmp/review-practice
```

(The exact file name the second command needs will match whatever `review_id` the `scaffold`
step printed — it continues the module's own running sequence number, so it may not literally be
`rr-0003` if you had already filed other records first; always use the path `scaffold` gives you.)
`status` afterward will show *both* `rr-0002-clinical-2` and its replacement, with the
replacement's `supersedes` field naming the original — the original stays on disk, unedited, as
the permanent record of what happened.

### Roles 3–5 — `lab`, then `release-auth`

Continue the same scaffold-then-sign pattern for `lab` (`--reviewer-id dryrun-cbc-suite-lab`).
Once `clinical-1` and `clinical-2`'s *effective* (non-superseded) decisions agree, `status` will
report `nextExpectedRole: release-auth` — `adjudication` is skipped entirely, exactly as role 4's
description above says it should be. Finish with `release-auth`
(`--reviewer-id dryrun-cbc-suite-release-auth`).

After all five roles are filed, `status --module cbc_suite_v1 --root /tmp/review-practice` reports
the same terminal state described earlier: `structurally-non-qualifying`. That is the correct,
expected ending for a practice run built entirely from synthetic identities — you have exercised
every mechanical step of the real workflow without making any real clinical claim.

When you are done, delete the practice copy — it was never inside the repository and `git` never
saw it:

```
rm -rf /tmp/review-practice
```

## Post-G1 real-reviewer track

**Nothing in this section can be done yet.** It describes what a *real*, credentialed clinician
will do once gate **G1** has cleared for them — something that has not happened for anyone in this
codebase today. `governance/reviewer-roster.yaml` currently lists five synthetic practice personas
and zero real reviewers.

### What has to happen first (outside this software)

1. **Gate G1 — named credentialed reviewer roster.** The program owner (a named
   clinical-governance/credentialing role — never an agent, never this tool, never an automated
   review of any kind) independently, out-of-band verifies a real clinician's identity and
   credentials, then records that verification in `governance/reviewer-roster.yaml` as a
   `synthetic: false` entry. No task, script, or agent in this repository performs that
   verification or adds that entry — see `docs/governance/gates-registry.md`'s G1 row for the full
   entry criteria.
2. Only after that: the reviewer's real `reviewerId` resolves against the roster, and the tool
   treats their records differently, described next.

### Your workflow once G1 has cleared for you: scaffold, no draft

A real reviewer runs `scaffold` the same way as the exercise track, but *without* `--draft`:

```
node tools/review-record/cli.mjs scaffold \
  --module <module_id> --role <your-role> --reviewer-id <your-real-reviewer-id> \
  --decision <approve|reject|request-changes> --rationale "<your reasoning>"
```

Because the roster resolves your `reviewer-id` to a real (non-synthetic) entry, `scaffold` does not
build a preview draft — it writes the finished record directly to
`modules/<module_id>/reviews/rr-<seq>-<role>.yaml`, still with `signature: null`. **The `git`
commit that adds this file to the repository is your attributable review act** — your name, the
date, and the file's exact content are permanently tied together in that commit, the same way a
signed paper form permanently ties a decision to a name and date.

A real reviewer's record is never run through the practice signing step used in the exercise track
above. That step exists only to exercise the synthetic path safely; it has no role here. The
cryptographic sealing of a real release is a separate act, performed later by a different named
role — a **signing custodian** — who, per `docs/adr/0005-kb-serialization-signing-key-custody.md`
and gate **G2**, signs the overall release manifest offline, using keys that never touch this
repository's automation. That is not something a reviewer does, and it does not happen until G2 has
separately cleared. As a reviewer, your part of the workflow ends the moment your `scaffold`
command's commit lands: build your record, let the commit record it, and you are done.

## The honesty boundary

Everything this tool and this runbook describe proves *software behavior*: that records are
appended in the documented order, that each record is cryptographically bound to its own content,
that reviewer-2 independence is structurally preserved, and that the audit trail cannot be silently
altered. **This is an unvalidated research prototype: no clinical-validity, safety,
diagnostic-performance, or regulatory claim is made anywhere in this workflow, and no clinical
sign-off exists yet for any module in this repository.** A clean `validate` pass, a "complete" five-role
chain, or an HTML render that looks polished are never themselves evidence of clinical correctness
— they only mean the *record-keeping* is sound. Whether this program's underlying clinical content
is safe and accurate is a separate question, answered (eventually) by the program's own further
validation gates — content review, executable testing, retrospective validation, and human-factors
and interventional evaluation — none of which this tool performs or claims to satisfy.
