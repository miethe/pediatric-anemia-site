#!/usr/bin/env python3
"""One-off, ephemeral generator (P4-T2, multi-bundle-conversion-e1) -- NOT part of the committed
converter tooling. Reads the already-vendored, committed tests/fixtures/rf-ev-001/ bundle mirror
(claims/claim_ledger.yaml + sources/src_*.md frontmatter) and projects the 35 "supported"-status
claims into modules/anemia/evidence-assertions.json, matching modules/cbc_suite_v1/
evidence-assertions.json's schema shape exactly (schemaVersion, moduleId, rfProvenance, assertions[]).

This script NEVER reads or writes modules/anemia/evidence.json or modules/anemia/rules.json --
its only write target is modules/anemia/evidence-assertions.json (a brand-new file). This mirrors
the same manual-projection pattern already used for modules/kidney_suite_v1/evidence-assertions.json
(P5-T1), since the committed tools/rf-bundle-to-kb-pack `propose` verb is hardwired (by design,
P3-T7) to cbc_suite_v1's own hand-authored drafting content only and cannot run generically
against a different module without also writing rules.json/candidates.json/evidence.json for that
module -- exactly what P4-T2's own acceptance criteria forbids for modules/anemia/.
"""
import json
import re
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "rf-ev-001"
OUT_PATH = REPO_ROOT / "modules" / "anemia" / "evidence-assertions.json"

RF_RUN_ID = "rf_run_20260717_rf_ev_001_pediatric_cds_backfill"
RF_BUNDLE_ID = "bundle_20260718_intent_research_20260717_rf_ev_001"
FIXTURE_PATH = "tests/fixtures/rf-ev-001/"

# source_card_id -> sourceId, cross-checked against modules/anemia/evidence.json's own 6 source
# ids (each source card's own reliability_notes names its target KB id explicitly).
SOURCE_ID_BY_CARD = {
    "src_20260718_rfev001_00": "AAP2026_IDA",
    "src_20260718_rfev001_01": "WHO2024_HB",
    "src_20260718_rfev001_02": "BLOOD2022_PED_ANEMIA",
    "src_20260718_rfev001_03": "CDC2025_LEAD",
    "src_20260718_rfev001_04": "FDA2026_CDS",
    "src_20260718_rfev001_05": "BSH2020_G6PD",
}

REDACTED_QUOTE_PATTERN = re.compile(r"sha256:([0-9a-f]{64})")

REVIEW_BY = "2027-07-22"


def load_source_cards():
    cards = {}
    for md_path in sorted(FIXTURE_DIR.glob("sources/src_*.md")):
        raw = md_path.read_text(encoding="utf-8")
        parts = raw.split("---", 2)
        if len(parts) < 3:
            raise SystemExit(f"{md_path}: could not split YAML frontmatter")
        frontmatter = yaml.safe_load(parts[1])
        card_id = frontmatter["source_card_id"]
        points_by_ev = {}
        for point in frontmatter["extracted_points"]:
            ev_id = point["evidence_id"]
            quote = point.get("quote") or ""
            match = REDACTED_QUOTE_PATTERN.search(quote)
            if not match:
                raise SystemExit(f"{md_path}#{ev_id}: no redacted sha256 hash found in quote field")
            points_by_ev[ev_id] = {
                "sha256": match.group(1),
                "population": (point.get("pediatric_cds") or {}).get("population"),
                "assay_method": (point.get("pediatric_cds") or {}).get("assay_method"),
            }
        cards[card_id] = points_by_ev
    return cards


def load_supported_claims():
    ledger = yaml.safe_load((FIXTURE_DIR / "claims" / "claim_ledger.yaml").read_text(encoding="utf-8"))
    claims = []
    for claim in ledger["claims"]:
        if claim.get("status") != "supported":
            continue
        sources = claim.get("sources") or []
        if len(sources) != 1:
            raise SystemExit(f"{claim['claim_id']}: expected exactly 1 source for a supported claim, got {len(sources)}")
        claims.append(claim)
    return claims


def build_assertions(claims, cards):
    assertions = []
    for claim in claims:
        claim_id = claim["claim_id"]
        source = claim["sources"][0]
        card_id = source["source_card_id"]
        ev_id = source["evidence_id"]
        locator_raw = source["locator"]

        card = cards.get(card_id)
        if card is None:
            raise SystemExit(f"{claim_id}: source_card_id {card_id!r} not found in fixture source cards")
        point = card.get(ev_id)
        if point is None:
            raise SystemExit(f"{claim_id}: evidence_id {ev_id!r} not found in source card {card_id}")

        source_id = SOURCE_ID_BY_CARD.get(card_id)
        if source_id is None:
            raise SystemExit(f"{claim_id}: no sourceId mapping for source_card_id {card_id!r}")

        sha256_hex = point["sha256"]
        assertions.append(
            {
                "assertionId": f"evas_anemia_{claim_id}",
                "rfRunId": RF_RUN_ID,
                "rfSourceCardId": card_id,
                "sourceId": source_id,
                "rfEvidenceId": ev_id,
                "rfClaimId": claim_id,
                "passageId": f"psg_{sha256_hex}",
                "locator": {
                    "raw": locator_raw,
                    "page": None,
                    "section": locator_raw,
                    "table": None,
                    "paragraph": None,
                },
                "exactPassage": None,
                "exactPassageSha256": f"sha256:{sha256_hex}",
                "displayPolicy": "hash_and_selector_only",
                "claimStatus": "supported",
                "applicability": {
                    "ageRange": point["population"],
                    "sex": None,
                },
                "laboratory": {
                    "analyzer": None,
                    "assayMethod": point["assay_method"],
                },
                "reviewBy": REVIEW_BY,
            }
        )
    return assertions


def main():
    if OUT_PATH.exists():
        raise SystemExit(f"refusing to overwrite pre-existing {OUT_PATH} -- this task must create a NEW file")

    cards = load_source_cards()
    claims = load_supported_claims()
    assertions = build_assertions(claims, cards)

    def sort_key(a):
        m = re.match(r"^clm_(\d+)$", a["rfClaimId"])
        return (0, int(m.group(1))) if m else (1, a["rfClaimId"])

    assertions.sort(key=sort_key)

    seen_ids = set()
    for a in assertions:
        if a["assertionId"] in seen_ids:
            raise SystemExit(f"duplicate assertionId {a['assertionId']!r}")
        seen_ids.add(a["assertionId"])

    doc = {
        "schemaVersion": "1.0",
        "moduleId": "anemia",
        "rfProvenance": {
            "rfRunId": RF_RUN_ID,
            "rfBundleId": RF_BUNDLE_ID,
            "fixturePath": FIXTURE_PATH,
        },
        "assertions": assertions,
    }

    OUT_PATH.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH} -- {len(assertions)} assertions", file=sys.stderr)


if __name__ == "__main__":
    main()
