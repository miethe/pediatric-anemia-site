#!/usr/bin/env python3
"""Emit a bounded repair task for the candidates that failed the fidelity gate.

Keeps the repair pass narrow on purpose: the delegate is shown only the failing
records and is told to fix the offending field or null it out, never to re-extract
the report. A broad "try again" invites new drift in records that already passed.

Usage:
    repair_prompt.py --extraction <file.json> --report <report.md>
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--extraction", required=True, type=Path)
    ap.add_argument("--report", required=True, type=Path)
    args = ap.parse_args()

    proc = subprocess.run(
        [
            sys.executable,
            str(HERE / "verify_fidelity.py"),
            "--extraction", str(args.extraction),
            "--report", str(args.report),
            "--json",
        ],
        capture_output=True,
        text=True,
    )
    result = json.loads(proc.stdout)
    findings = [f for f in result["findings"] if f["severity"] == "HIGH"]
    if not findings:
        print("CLEAN")
        return 0

    extraction = json.loads(args.extraction.read_text(encoding="utf-8"))
    by_id = {c["candidate_id"]: c for c in extraction.get("candidates", [])}
    by_sid = {s["source_id"]: s for s in extraction.get("sources", [])}

    lines: list[str] = []
    lines.append(
        f"The file {args.extraction} failed a deterministic transcription-fidelity check "
        f"against its source report {args.report}. Fix ONLY the records listed below, in place, "
        f"and write the corrected full JSON back to the same path.\n"
    )
    lines.append(
        "The rule that was violated: a `quote` and a `selector_value` must be a VERBATIM "
        "substring of the report — copy-pasted from its bytes, not a paraphrase, not a summary, "
        "not a reflow of a table row into a sentence. The checker normalizes whitespace and "
        "dash/quote variants, so those may differ; every word and digit may not.\n"
    )
    lines.append(
        "For each record below, do exactly one of:\n"
        "  (a) Replace the field with a TRUE verbatim span copied from the report that carries "
        "the same fact. A short span is better than a long one. For a markdown table row, quote "
        "the contiguous cell text as it appears, not a sentence you build from several cells.\n"
        "  (b) If no single contiguous verbatim span in the report carries that fact, set the "
        "field to null. A null quote is correct and acceptable; an invented quote is not.\n"
    )
    lines.append(
        "Change NOTHING else: do not touch `value`, `unit`, `source_refs`, `classification`, "
        "`statement`, or any record not listed here. Do not add or remove records.\n"
    )
    lines.append("Records to fix:\n")

    for f in findings:
        ref = f["ref"]
        lines.append(f"- {f['code']} on `{ref}`: {f['detail']}")
        rec = by_id.get(ref)
        if rec is not None:
            lines.append(f"    statement: {rec.get('statement')!r}")
            if rec.get("value") is not None:
                lines.append(f"    value/unit: {rec.get('value')!r} {rec.get('unit')!r}")
            lines.append(f"    current quote: {rec.get('quote')!r}")
            lines.append(f"    current selector_value: {rec.get('selector_value')!r}")
            lines.append(f"    source_refs: {rec.get('source_refs')!r}")
        elif ref in by_sid:
            lines.append(f"    source record: {json.dumps(by_sid[ref])}")
        lines.append("")

    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
