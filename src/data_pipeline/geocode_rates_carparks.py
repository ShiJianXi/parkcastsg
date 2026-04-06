"""
Geocodes every carpark in CarparkRates.csv that is NOT already tracked by
the LTA DataMall dataset, then saves the results to
backend/app/data/supplemental_carparks.csv.

The output CSV feeds the ``supplemental_carpark_lookup`` backend module so
that carparks with rate data but no live-availability API (e.g. private
mall carparks not in LTA DataMall) still appear in nearby searches.

Usage
-----
Run AFTER generating lta_carparks.csv (fetch_lta_carparks.py), so that
carparks already tracked by LTA are correctly suppressed:

    cd src/data_pipeline
    pip install -r requirements.txt
    python geocode_rates_carparks.py

OneMap is a free Singapore government geocoding service — no API key is
required for the search endpoint used here.

Note: CarparkRates.csv entries use mall/building names (e.g. "Causeway
Point"), not HDB addresses (e.g. "BLK 1 ANG MO KIO AVE 1"), so there is
no meaningful overlap with the HDB dataset — only LTA names are excluded.
"""
from __future__ import annotations

import csv
import re
import time
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).resolve().parents[2]
_RATES_CSV = _REPO_ROOT / "backend" / "app" / "data" / "CarparkRates.csv"
_LTA_CSV = _REPO_ROOT / "backend" / "app" / "data" / "lta_carparks.csv"
_OUTPUT_CSV = _REPO_ROOT / "backend" / "app" / "data" / "supplemental_carparks.csv"

ONEMAP_URL = "https://www.onemap.gov.sg/api/common/elastic/search"


# ---------------------------------------------------------------------------
# Name normalisation (mirrors backend lta_rates_lookup.py)
# ---------------------------------------------------------------------------


def _normalise(name: str) -> str:
    return re.sub(r"\s+", " ", name.lower().strip())


# ---------------------------------------------------------------------------
# Build LTA exclusion set
# ---------------------------------------------------------------------------


def _lta_names() -> set[str]:
    """Normalised development names from lta_carparks.csv."""
    names: set[str] = set()
    if not _LTA_CSV.exists():
        return names
    with open(_LTA_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            dev = row.get("development", "").strip()
            if dev:
                names.add(_normalise(dev))
    return names


# ---------------------------------------------------------------------------
# OneMap geocoder
# ---------------------------------------------------------------------------


def _geocode(name: str) -> tuple[float, float] | None:
    """Return (lat, lng) for a Singapore place name via OneMap, or None."""
    try:
        resp = requests.get(
            ONEMAP_URL,
            params={
                "searchVal": name,
                "returnGeom": "Y",
                "getAddrDetails": "Y",
                "pageNum": 1,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        print(f"    ⚠  OneMap error for {name!r}: {exc}")
        return None

    results = data.get("results", [])
    if not results:
        return None

    first = results[0]
    try:
        return float(first["LATITUDE"]), float(first["LONGITUDE"])
    except (KeyError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    print("Loading LTA exclusion set…")
    lta = _lta_names()
    print(f"  LTA names: {len(lta)}")

    print("Reading CarparkRates.csv…")
    with open(_RATES_CSV, encoding="utf-8") as f:
        rates_rows = list(csv.DictReader(f))
    print(f"  {len(rates_rows)} rows")

    to_geocode: list[str] = []
    for row in rates_rows:
        name = row.get("carpark", "").strip()
        if not name:
            continue
        if _normalise(name) in lta:
            continue  # already tracked by LTA DataMall
        to_geocode.append(name)

    print(f"  {len(to_geocode)} carparks to geocode (not in LTA dataset)")

    results: list[dict] = []
    failed: list[str] = []

    for i, name in enumerate(to_geocode, 1):
        print(f"  [{i}/{len(to_geocode)}] Geocoding: {name!r}")
        coords = _geocode(name)
        if coords is None:
            print(f"    ✗ No result")
            failed.append(name)
        else:
            lat, lng = coords
            print(f"    ✓ {lat:.6f}, {lng:.6f}")
            results.append({"name": name, "lat": lat, "lng": lng})
        # Be polite to OneMap — stay safely under 5 req/s
        time.sleep(0.25)

    _OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(_OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "lat", "lng"])
        writer.writeheader()
        writer.writerows(results)

    print(f"\nSaved {len(results)} rows → {_OUTPUT_CSV}")
    if failed:
        print(f"Could not geocode {len(failed)} entries:")
        for n in failed:
            print(f"  - {n}")


if __name__ == "__main__":
    main()
