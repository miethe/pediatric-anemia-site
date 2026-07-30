#!/usr/bin/env python3
"""Detect the same source cited under different identities across packets.

Design 06 §2 rule 3 makes duplicate claims across the RF-ANE-001 and cbc_suite_v1
bundles a merge *defect*, and notes the failure is silent: two packets mint their
own packet-local ids, so nothing collides at import and the duplication only
surfaces later as double-counted evidentiary weight or an unreconciled pair of
renderings of one paper.

This finds those pairs before merge, three ways, because a single key misses the
case that actually occurs here — one packet citing a DOI and another citing the
publisher URL for the same article:
  1. normalized DOI
  2. normalized URL
  3. title similarity (token Jaccard), which catches DOI-vs-URL aliasing

Usage:
    check_cross_packet_duplicates.py build/extractions/*.json [--threshold 0.6] [--json]
Exit 0 = no cross-module duplicates, 1 = duplicates found.
"""

from __future__ import annotations

import argparse
import itertools
import json
import re
import sys
from pathlib import Path

STOP = {
    "the", "a", "an", "of", "and", "in", "for", "on", "to", "with", "by", "from",
    "study", "analysis", "using", "based", "part", "i", "ii",
}


def norm_doi(doi: str | None) -> str | None:
    if not doi:
        return None
    d = doi.strip().lower()
    d = re.sub(r"^https?://(dx\.)?doi\.org/", "", d)
    d = re.sub(r"^doi:\s*", "", d)
    return d.rstrip("/.") or None


def norm_url(url: str | None) -> str | None:
    if not url:
        return None
    u = url.strip().lower()
    u = re.sub(r"^https?://", "", u)
    u = re.sub(r"^www\.", "", u)
    u = u.split("#")[0].split("?")[0]
    return u.rstrip("/") or None


def title_tokens(title: str | None) -> frozenset[str]:
    if not title:
        return frozenset()
    toks = re.findall(r"[a-z0-9]+", title.lower())
    return frozenset(t for t in toks if t not in STOP and len(t) > 2)


def jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("extractions", nargs="+", type=Path)
    ap.add_argument("--threshold", type=float, default=0.6)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    records = []
    for path in args.extractions:
        data = json.loads(path.read_text(encoding="utf-8"))
        module = data["module"]
        provider = data["provider"]
        for s in data.get("sources", []):
            records.append(
                {
                    "packet": f"{module}/{provider}",
                    "module": module,
                    "provider": provider,
                    "source_id": s["source_id"],
                    "title": s.get("title"),
                    "doi": norm_doi(s.get("doi")),
                    "url": norm_url(s.get("url")),
                    "year": s.get("publication_year"),
                    "access_status": s.get("access_status"),
                    "_tokens": title_tokens(s.get("title")),
                }
            )

    groups: list[dict] = []

    def add_group(kind: str, key: str, members: list[dict], score: float | None = None) -> None:
        modules = sorted({m["module"] for m in members})
        groups.append(
            {
                "match_kind": kind,
                "key": key,
                "cross_module": len(modules) > 1,
                "modules": modules,
                "similarity": score,
                "members": [
                    {
                        "packet": m["packet"],
                        "source_id": m["source_id"],
                        "title": m["title"],
                        "doi": m["doi"],
                        "url": m["url"],
                        "year": m["year"],
                        "access_status": m["access_status"],
                    }
                    for m in members
                ],
            }
        )

    seen_pairs: set[tuple[str, str]] = set()

    def pair_key(a: dict, b: dict) -> tuple[str, str]:
        x, y = sorted([f"{a['packet']}:{a['source_id']}", f"{b['packet']}:{b['source_id']}"])
        return (x, y)

    for field in ("doi", "url"):
        buckets: dict[str, list[dict]] = {}
        for r in records:
            if r[field]:
                buckets.setdefault(r[field], []).append(r)
        for key, members in buckets.items():
            if len(members) < 2:
                continue
            for a, b in itertools.combinations(members, 2):
                seen_pairs.add(pair_key(a, b))
            add_group(f"same_{field}", key, members)

    # Title similarity catches the DOI-vs-URL aliasing that the exact keys miss.
    for a, b in itertools.combinations(records, 2):
        if pair_key(a, b) in seen_pairs:
            continue
        score = jaccard(a["_tokens"], b["_tokens"])
        if score >= args.threshold:
            seen_pairs.add(pair_key(a, b))
            add_group("similar_title", f"{score:.2f}", [a, b], score)

    cross = [g for g in groups if g["cross_module"]]
    within = [g for g in groups if not g["cross_module"]]

    if args.json:
        print(json.dumps({
            "source_records": len(records),
            "cross_module_groups": len(cross),
            "within_module_groups": len(within),
            "groups": groups,
        }, indent=2))
    else:
        print(f"{len(records)} source records across {len({r['packet'] for r in records})} packets")
        print(f"\n== CROSS-MODULE duplicate identities: {len(cross)} (design 06 §2 rule 3 = merge defect)")
        for g in cross:
            print(f"  [{g['match_kind']}] {g['key']}  modules={g['modules']}")
            for m in g["members"]:
                print(f"      {m['packet']:22s} {m['source_id']:16s} doi={m['doi']} url={m['url']}")
                print(f"      {'':22s} title={m['title']!r}")
        print(f"\n== WITHIN-MODULE duplicate identities: {len(within)} (dedupe at merge, not a cross-bundle defect)")
        for g in within:
            ids = ", ".join(f"{m['packet']}:{m['source_id']}" for m in g["members"])
            print(f"  [{g['match_kind']}] {g['key']}: {ids}")

    return 1 if cross else 0


if __name__ == "__main__":
    sys.exit(main())
