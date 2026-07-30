#!/usr/bin/env python3
"""Deterministic transcription-fidelity gate for an extraction JSON.

The extraction step is a model reading a provider's markdown report and emitting
structured records. The failure mode that matters clinically is a number or a
citation that the model produced but the report never said. This script is the
tripwire for exactly that: every quote, every numeric value, and every DOI/URL in
the extraction must be findable in the source report's own bytes.

It proves transcription faithfulness only. It says nothing about whether the
report's own claims are clinically correct — that is what rf's verifier and a
credentialed clinician are for.

Usage:
    verify_fidelity.py --extraction <file.json> --report <report.md> [--json]
Exit 0 = clean, 1 = findings.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

ACCESS_STATUS = {"open-access", "public-domain", "paywalled", "unknown"}
CLASSIFICATION = {"assertion", "inference", "annotation"}
RELATION = {"supports", "contradicts", "context", "unknown"}
ID_RE = re.compile(r"^[A-Za-z0-9_.:-]+$")


def normalize(text: str) -> str:
    """Fold the incidental differences between a markdown table cell and a quote.

    Unicode-normalizes, unifies the dash/quote/space variants providers emit, and
    collapses whitespace runs. Deliberately does NOT touch digits or letters, so a
    changed number can never normalize into a match.
    """
    text = unicodedata.normalize("NFKC", text)
    for a, b in (
        ("‐", "-"), ("‑", "-"), ("‒", "-"), ("–", "-"),
        ("—", "-"), ("―", "-"), ("−", "-"),
        ("‘", "'"), ("’", "'"), ("“", '"'), ("”", '"'),
        (" ", " "), (" ", " "), (" ", " "),
    ):
        text = text.replace(a, b)
    return re.sub(r"\s+", " ", text).strip().lower()


def numeric_variants(value: float | int) -> list[str]:
    """Surface forms a report may legitimately use for the same number."""
    out: list[str] = []
    if isinstance(value, int) or (isinstance(value, float) and value.is_integer()):
        n = int(value)
        out += [str(n), f"{n:,}"]
        # Providers write 10^9/L counts as both 1.5 and 1500 depending on unit choice;
        # only the literal forms are accepted here, never a rescaled equivalent.
        out.append(f"{n}.0")
    else:
        s = repr(float(value))
        out.append(s)
        out.append(("%f" % value).rstrip("0").rstrip("."))
        out.append(str(value))
    # A leading-zero-less decimal ( .5 for 0.5 ) shows up in tables.
    for s in list(out):
        if s.startswith("0."):
            out.append(s[1:])
    return sorted({s for s in out if s})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--extraction", required=True, type=Path)
    ap.add_argument("--report", required=True, type=Path)
    ap.add_argument("--json", action="store_true")
    ap.add_argument(
        "--id-prefix",
        help="Required prefix for every source_id/candidate_id. Guards against "
        "cross-packet contamination when extractions are produced concurrently in "
        "one sandbox: a foreign id is a record copied from another packet.",
    )
    args = ap.parse_args()

    extraction = json.loads(args.extraction.read_text(encoding="utf-8"))
    report_raw = args.report.read_text(encoding="utf-8")
    report = normalize(report_raw)

    findings: list[dict] = []

    def finding(severity: str, code: str, ref: str, detail: str) -> None:
        findings.append({"severity": severity, "code": code, "ref": ref, "detail": detail})

    sources = extraction.get("sources", [])
    candidates = extraction.get("candidates", [])
    source_ids = {s["source_id"] for s in sources}

    for s in sources:
        sid = s["source_id"]
        if not ID_RE.match(sid) or len(sid) > 128:
            finding("HIGH", "source_id_malformed", sid, "fails ^[A-Za-z0-9_.:-]+$ or >128 chars")
        if args.id_prefix and not sid.startswith(args.id_prefix):
            finding("HIGH", "foreign_id_prefix", sid, f"does not start with {args.id_prefix!r} — likely copied from another packet")
        if s["access_status"] not in ACCESS_STATUS:
            finding("HIGH", "access_status_invalid", sid, f"{s['access_status']!r}")
        # A locator the report never printed is a fabricated citation.
        for key in ("doi", "url"):
            val = s.get(key)
            if not val:
                continue
            if normalize(val) not in report:
                bare = normalize(val).replace("https://", "").replace("http://", "").rstrip("/")
                if bare and bare in report:
                    continue
                if key == "doi" and normalize(val.split("doi.org/")[-1]) in report:
                    continue
                finding("HIGH", "locator_not_in_report", sid, f"{key}={val!r} absent from report.md")
        if s.get("doi") is None and s.get("url") is None:
            finding("MEDIUM", "locator_absent", sid, "no DOI and no URL — intake will quarantine as invalid_locator")
        year = s.get("publication_year")
        if year is not None and not (0 <= int(year) <= 3000):
            finding("HIGH", "year_out_of_range", sid, str(year))

    for c in candidates:
        cid = c["candidate_id"]
        if not ID_RE.match(cid) or len(cid) > 128:
            finding("HIGH", "candidate_id_malformed", cid, "fails ^[A-Za-z0-9_.:-]+$ or >128 chars")
        if args.id_prefix and not cid.startswith(args.id_prefix):
            finding("HIGH", "foreign_id_prefix", cid, f"does not start with {args.id_prefix!r} — likely copied from another packet")
        if c["classification"] not in CLASSIFICATION:
            finding("HIGH", "classification_invalid", cid, f"{c['classification']!r}")
        rel = c.get("relation")
        if rel is not None and rel not in RELATION:
            finding("HIGH", "relation_invalid", cid, f"{rel!r}")
        if not (c.get("statement") or "").strip():
            finding("HIGH", "statement_empty", cid, "statement is required and non-empty")
        for ref in c.get("source_refs") or []:
            if ref not in source_ids:
                finding("HIGH", "dangling_source_ref", cid, f"{ref!r} not in sources.yaml")
        # The core tripwire: a quote must be the report's own words.
        quote = c.get("quote")
        if quote:
            if normalize(quote) not in report:
                finding("HIGH", "quote_not_verbatim", cid, f"quote absent from report.md: {quote[:90]!r}")
        sel = c.get("selector_value")
        if sel and normalize(sel) not in report:
            finding("HIGH", "selector_not_verbatim", cid, f"selector absent from report.md: {sel[:90]!r}")
        # The second tripwire: a numeric the report never printed.
        val = c.get("value")
        if val is not None:
            if not any(v in report for v in numeric_variants(val)):
                finding(
                    "HIGH",
                    "value_not_in_report",
                    cid,
                    f"value {val!r} not found in report.md (tried {numeric_variants(val)})",
                )
        # A numeric assertion with no source is unciteable by construction.
        if val is not None and not (c.get("source_refs") or []):
            finding("HIGH", "numeric_without_source", cid, f"value {val!r} carries no source_refs")
        if val is not None and not c.get("unit"):
            finding("MEDIUM", "numeric_without_unit", cid, f"value {val!r} has no unit")
        conf = c.get("producer_confidence")
        if conf is not None and not (0.0 <= float(conf) <= 1.0):
            finding("HIGH", "confidence_out_of_range", cid, str(conf))
        # A split bound with no qualifier_band is unpairable: nothing records which
        # analyte/age-band/sex/condition it bounds, so two unrelated bounds can be
        # read as one interval. The gpt-5.6-terra audit of the first pass found this
        # producing an invalid systolic-120/diastolic-80 "interval" in the kidney
        # packet, so it is gated deterministically rather than left to review.
        direction = (c.get("direction") or "").strip().lower()
        band = (c.get("qualifier_band") or "").strip()
        if direction in {"lower_bound", "upper_bound"} and not band:
            finding(
                "HIGH",
                "unpaired_bound_without_qualifier",
                cid,
                f"direction={direction!r} with empty qualifier_band — bound cannot be "
                "unambiguously paired to its analyte/condition",
            )

    # Cross-record check on bound pairing. A non-empty qualifier_band is necessary but
    # not sufficient: a *wrong* band silently pairs two unrelated numbers, which is the
    # same corruption as a blank one. Found in practice when a repair pass gave a
    # 12-hour urine-output bound the stage-2 creatinine-multiplier band, producing a
    # "12 hours to 2 x baseline" interval.
    bound_groups: dict[str, list[dict]] = {}
    for c in candidates:
        direction = (c.get("direction") or "").strip().lower()
        band = (c.get("qualifier_band") or "").strip()
        if direction in {"lower_bound", "upper_bound"} and band:
            bound_groups.setdefault(band, []).append(c)

    for band, group in sorted(bound_groups.items()):
        ids = ", ".join(c["candidate_id"] for c in group)
        units = {(c.get("unit") or "").strip() for c in group}
        if len(units) > 1:
            finding(
                "HIGH",
                "band_unit_mismatch",
                ids,
                f"qualifier_band {band!r} groups bounds with incompatible units {sorted(units)} — "
                "these do not describe one interval",
            )
        lowers = [c for c in group if (c.get("direction") or "").lower() == "lower_bound"]
        uppers = [c for c in group if (c.get("direction") or "").lower() == "upper_bound"]
        if len(lowers) > 1 or len(uppers) > 1:
            finding(
                "HIGH",
                "band_duplicate_bound",
                ids,
                f"qualifier_band {band!r} has {len(lowers)} lower and {len(uppers)} upper bounds — "
                "a band must identify exactly one interval",
            )
        elif len(lowers) == 1 and len(uppers) == 1:
            lo, hi = lowers[0].get("value"), uppers[0].get("value")
            if isinstance(lo, (int, float)) and isinstance(hi, (int, float)) and lo > hi:
                finding(
                    "HIGH",
                    "band_bounds_inverted",
                    ids,
                    f"qualifier_band {band!r} has lower {lo} > upper {hi}",
                )
        elif len(group) == 1:
            finding(
                "MEDIUM",
                "band_orphan_bound",
                ids,
                f"qualifier_band {band!r} has a single {(group[0].get('direction') or '')} and no "
                "partner — a one-sided limit should be a *_threshold, not a bound",
            )

    high = sum(1 for f in findings if f["severity"] == "HIGH")
    med = sum(1 for f in findings if f["severity"] == "MEDIUM")

    if args.json:
        print(json.dumps({
            "extraction": str(args.extraction),
            "sources": len(sources),
            "candidates": len(candidates),
            "high": high, "medium": med,
            "findings": findings,
        }, indent=2))
    else:
        print(f"== {args.extraction.name}: {len(sources)} sources, {len(candidates)} candidates")
        for f in findings:
            print(f"  [{f['severity']}] {f['code']} {f['ref']}: {f['detail']}")
        print(f"  VERDICT: {high} high, {med} medium")

    return 1 if high else 0


if __name__ == "__main__":
    sys.exit(main())
