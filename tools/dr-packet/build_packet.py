#!/usr/bin/env python3
"""Materialize an `external_research_handoff/v1` packet from an extraction JSON.

Deterministic and offline: no model call, no network. The extraction JSON is the
authored input (see EXTRACTION-CONTRACT.md); everything digest-bearing in
`handoff.yaml` is computed here rather than asserted by whatever produced the
extraction, so a wrong byte count fails at build time instead of at intake.

Usage:
    build_packet.py --extraction <file.json> --report <report.md> --out <packet_dir>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

import yaml

SCHEMA_VERSION = "1.0"

# Frozen vocabularies, copied from the rf schemas that gate intake:
#   schemas/external_research_sources.schema.yaml      -> access_status
#   schemas/external_assertion_candidates.schema.yaml  -> classification, relation
#   schemas/external_research_handoff.schema.yaml       -> producer_profile, declared_sensitivity
ACCESS_STATUS = {"open-access", "public-domain", "paywalled", "unknown"}
CLASSIFICATION = {"assertion", "inference", "annotation"}
RELATION = {"supports", "contradicts", "context", "unknown"}
PRODUCER_PROFILE = {"generic", "chatgpt", "perplexity", "gemini", "notebooklm"}
SENSITIVITY = {"public", "personal", "work_sensitive", "client_sensitive"}


class BuildError(Exception):
    pass


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise BuildError(msg)


def build_sources(extraction: dict) -> dict:
    records = []
    seen: set[str] = set()
    for raw in extraction.get("sources", []):
        sid = raw["source_id"]
        _require(sid not in seen, f"duplicate source_id: {sid}")
        seen.add(sid)
        _require(
            raw["access_status"] in ACCESS_STATUS,
            f"{sid}: access_status {raw['access_status']!r} not in {sorted(ACCESS_STATUS)}",
        )
        meta = {}
        if raw.get("authors"):
            meta["authors"] = list(raw["authors"])
        if raw.get("publisher") is not None:
            meta["publisher"] = raw["publisher"]
        if raw.get("accessed_at") is not None:
            meta["accessed_at"] = raw["accessed_at"]
        records.append(
            {
                "source_id": sid,
                "title": raw.get("title"),
                "locator": {"doi": raw.get("doi"), "url": raw.get("url")},
                "publication_year": raw.get("publication_year"),
                "access_status": raw["access_status"],
                "declared_metadata": meta,
                "extensions": raw.get("extensions") or {},
            }
        )
    return {
        "schema_name": "external_research_sources",
        "schema_version": SCHEMA_VERSION,
        "sources": records,
    }


def build_candidates(extraction: dict, source_ids: set[str]) -> dict:
    records = []
    seen: set[str] = set()
    for raw in extraction.get("candidates", []):
        cid = raw["candidate_id"]
        _require(cid not in seen, f"duplicate candidate_id: {cid}")
        seen.add(cid)
        _require(
            raw["classification"] in CLASSIFICATION,
            f"{cid}: classification {raw['classification']!r} not in {sorted(CLASSIFICATION)}",
        )
        relation = raw.get("relation")
        _require(
            relation is None or relation in RELATION,
            f"{cid}: relation {relation!r} not in {sorted(RELATION)} or null",
        )
        refs = list(raw.get("source_refs") or [])
        for ref in refs:
            _require(ref in source_ids, f"{cid}: source_ref {ref!r} not declared in sources")
        conf = raw.get("producer_confidence")
        _require(
            conf is None or (isinstance(conf, (int, float)) and 0.0 <= conf <= 1.0),
            f"{cid}: producer_confidence {conf!r} outside [0,1]",
        )
        selector = None
        if raw.get("selector_value"):
            selector = {"kind": "text_quote", "value": raw["selector_value"]}
        records.append(
            {
                "candidate_id": cid,
                "statement": raw["statement"],
                "value": raw.get("value"),
                "unit": raw.get("unit"),
                "direction": raw.get("direction"),
                "scope": {
                    "population": raw.get("population"),
                    "qualifier_band": raw.get("qualifier_band"),
                },
                "source_refs": refs,
                "relation": relation,
                "classification": raw["classification"],
                "quote": raw.get("quote"),
                "selector": selector,
                "producer_confidence": conf,
                "extensions": raw.get("extensions") or {},
            }
        )
    return {
        "schema_name": "external_assertion_candidates",
        "schema_version": SCHEMA_VERSION,
        "candidates": records,
    }


def dump_yaml(path: Path, payload: dict) -> None:
    with path.open("w", encoding="utf-8") as fh:
        yaml.safe_dump(payload, fh, sort_keys=False, allow_unicode=True, width=4096)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--extraction", required=True, type=Path)
    ap.add_argument("--report", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()

    extraction = json.loads(args.extraction.read_text(encoding="utf-8"))

    profile = extraction["producer_profile"]
    _require(profile in PRODUCER_PROFILE, f"producer_profile {profile!r} not in {sorted(PRODUCER_PROFILE)}")
    sensitivity = extraction.get("declared_sensitivity", "personal")
    _require(sensitivity in SENSITIVITY, f"declared_sensitivity {sensitivity!r} not in {sorted(SENSITIVITY)}")

    out: Path = args.out
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    # report.md is copied byte-for-byte: the packet's report member must be the
    # provider's own prose, which intake pins as non-authoritative platform_synthesis.
    shutil.copyfile(args.report, out / "report.md")

    sources = build_sources(extraction)
    dump_yaml(out / "sources.yaml", sources)
    source_ids = {s["source_id"] for s in sources["sources"]}
    dump_yaml(out / "assertion_candidates.yaml", build_candidates(extraction, source_ids))

    # handoff.yaml declares itself as a member, so its own sha256 is structurally
    # unknowable: writing the digest into the file changes the file's digest. The
    # upstream fixtures resolve this the only way possible — the manifest's own
    # entry is a placeholder that intake never checks against disk (verified
    # empirically: profiles/generic/handoff.yaml declares 1044/28d3ce… while the
    # file is 1021/10fa7e…, and its other three members match byte-for-byte).
    #
    # We do better than an arbitrary placeholder without pretending to solve an
    # impossible problem: byte_length IS knowable and is made exact (a digest is
    # fixed-width, so substituting it never changes the length), and the self
    # sha256 is the deterministic digest of the manifest in its zeroed-self-digest
    # form — reproducible by anyone re-running this builder.
    # Placeholder must serialize to the same width as a real digest. An all-digits
    # string is a valid YAML integer and gets quoted, which shifts the byte count;
    # 'aaa…' is unambiguously a string, exactly as a hex digest normally is.
    PLACEHOLDER_DIGEST = "a" * 64
    member_order = [
        ("handoff.yaml", "handoff_manifest"),
        ("report.md", "report"),
        ("sources.yaml", "sources"),
        ("assertion_candidates.yaml", "assertion_candidates"),
    ]

    def manifest(members: list[dict]) -> dict:
        return {
            "schema_name": "external_research_handoff",
            "schema_version": SCHEMA_VERSION,
            "transport": "directory",
            "producer_profile": profile,
            "research_context": {
                "research_question": extraction.get("research_question"),
                "task_context": extraction.get("task_context"),
            },
            "declared_sensitivity": sensitivity,
            "created_at": extraction["created_at"],
            "content_roles": {"report": "platform_synthesis"},
            "vendor_reference": extraction.get("vendor_reference") or {},
            "members": members,
            "total_declared_bytes": sum(m["byte_length"] for m in members),
        }

    def members_with(self_len: int, self_digest: str) -> list[dict]:
        out_members = []
        for name, role in member_order:
            if name == "handoff.yaml":
                out_members.append(
                    {"path": name, "role": role, "byte_length": self_len, "sha256": self_digest}
                )
                continue
            p = out / name
            out_members.append(
                {
                    "path": name,
                    "role": role,
                    "byte_length": p.stat().st_size,
                    "sha256": sha256_file(p),
                }
            )
        return out_members

    # Converge the manifest's own declared byte_length. Only the digit count of the
    # length integer (and of total_declared_bytes) can move, so this settles in a
    # couple of passes.
    self_len = 0
    for _ in range(12):
        dump_yaml(out / "handoff.yaml", manifest(members_with(self_len, PLACEHOLDER_DIGEST)))
        actual = (out / "handoff.yaml").stat().st_size
        if actual == self_len:
            break
        self_len = actual
    else:
        raise BuildError("handoff.yaml byte_length did not reach a fixed point")

    # Digest the zeroed-self-digest form, then substitute it in. Same length, so the
    # converged byte_length stays exact.
    self_digest = sha256_file(out / "handoff.yaml")
    dump_yaml(out / "handoff.yaml", manifest(members_with(self_len, self_digest)))
    _require(
        (out / "handoff.yaml").stat().st_size == self_len,
        "handoff.yaml length changed when its self-digest was substituted",
    )

    # Final self-consistency assertion: every declared member matches disk exactly,
    # except the manifest's own sha256, which cannot by construction.
    final = yaml.safe_load((out / "handoff.yaml").read_text(encoding="utf-8"))
    for m in final["members"]:
        p = out / m["path"]
        _require(p.stat().st_size == m["byte_length"], f"{m['path']}: byte_length drift")
        if m["path"] != "handoff.yaml":
            _require(sha256_file(p) == m["sha256"], f"{m['path']}: sha256 drift")
    _require(
        final["total_declared_bytes"] == sum(m["byte_length"] for m in final["members"]),
        "total_declared_bytes drift",
    )
    # No undeclared files: intake rejects the packet outright if one exists.
    declared = {m["path"] for m in final["members"]}
    on_disk = {p.name for p in out.iterdir()}
    _require(on_disk == declared, f"undeclared files on disk: {sorted(on_disk - declared)}")

    print(
        f"built {out}  profile={profile}  sources={len(sources['sources'])}  "
        f"candidates={len(final['members'])and len(yaml.safe_load((out/'assertion_candidates.yaml').read_text())['candidates'])}  "
        f"bytes={final['total_declared_bytes']}"
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BuildError as exc:
        print(f"BUILD ERROR: {exc}", file=sys.stderr)
        sys.exit(2)
