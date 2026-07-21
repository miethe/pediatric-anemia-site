# Clinical attestations

An entry in `evidence-packs/passage-attestations.json` may only authorise a `source-supported`
`sourcePassageId` binding if its `attestationRef` points at a real file **in this directory**.

**This directory is empty of attestations, and that is the honest state.** No credentialed human
clinician has attested any rule-to-passage or candidate-to-passage mapping in this knowledge base.
While it stays empty, every `source-supported` binding in the committed KB is a validation error.

## What the automated gate can and cannot do

It **cannot** establish that an attester is a human. An earlier version of this gate leaned on a
deny-list of model-name substrings; a reviewer defeated it with `attestedBy: "OpenAI o3"`. A
deny-list of model names is unbounded and permanently incomplete, and describing it as "requires a
human identifier" was itself the kind of over-claim this project exists to avoid.

What it **can** do is make an attestation structurally expensive and reviewable:

1. a recognised clinical credential from a closed list (a positive check, not a deny-list);
2. an `attestationRef` resolving to a file that actually exists here — so an attestation cannot be
   a bare string typed into a JSON file; there must be a committed, diffable artifact;
3. an ISO attestation date;
4. a bindable, non-quarantined target passage;
5. the model-name deny-list, retained only as a cheap tripwire for obvious cases.

Humanity is established by the out-of-band review and by the people reviewing that commit — not by
this code. Do not describe the gate as if it verifies identity.

## Adding an attestation

Add the review artifact here (what was reviewed, against which source passage, by whom, with their
credential and the date, and what they concluded), then add the matching ledger entry. Both land in
the same commit so a reviewer sees the claim and its evidence together.
