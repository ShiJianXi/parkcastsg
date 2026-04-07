from __future__ import annotations

import csv
import re
import time
from pathlib import Path

import requests
import certifi

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

ONEMAP_URL = "https://www.onemap.gov.sg/api/common/elastic/search"

DATA_DIR = Path(__file__).resolve().parents[2] / "backend" / "app" / "data"
OUTPUT_CSV = DATA_DIR / "supplemental_carparks.csv"

# ---------------------------------------------------------------------------
# Failed names to retry
# ---------------------------------------------------------------------------

FAILED = [
    "Hougang Plaza",
    "Ramada Hotel",
    "The Verge",
    "United Square Shopping Mall",
    "Bedok Point",
    "Changi Airport - South Car Park (between T2 and JetQuay)",
    "Grand Mecure Roxy Hotel",
    "Paramount Hotel",
    "Berjaya Hotel",
    "Conrad Centennial Hotel",
    "Copthorne Orchid Hotel",
    "Grand Park Orchard",
    "klapsons, The Boutique Hotel",
    "Novotel Clarke Quay",
    "Orchard Grand Court Hotel",
    "Orchard Hotel Shopping Arcade",
    "Regent Hotel",
    "Swissotel Merchant Court Hotel",
    "Traders Hotel",
    "Paragon Shopping Centre",
    "Tanglin Shopping Centre",
    "Changi Chapel and Museum (The Changi Museum)",
    "Labrador Secret Tunnel ( Labrador Park )",
    "Mandai Orchid Garden",
    "Resorts World Sentosa - Universal Studios Singapore (RWS B1 car park)",
    "Singapore Science centre/Singapore Discovery Centre / Snow City",
    "Singapore Zoological gardens/Night Safari",
    "The Battle Box ( Park at Fort Canning",
    "Underwater World Singapore",
    "CapitaCommercial Trust (CCT)",
    "Clifford Centre",
    "CPF Building Robinson Road",
    "Funan DigitaLife Mall",
    "Golden Shoe Complex",
    "Iluma",
    "Income At Raffles ( former Hitachi tower)",
    "Inter-continental Singapore Hotel",
    "Keppel Bay Tower / Harbourfront Tower One",
    "Keypoint",
    "Liang Court",
    "Marina Bay Financial Centre Tower 1, 2 ,3 & Marina Bay Link Mall",
    "OUB Centre",
    "Peninsular Plaza",
    "PoMo (Fomerly Paradiz Centre)",
    "PWC Building",
    "The Corporate Office",
    "Jurong Theatre",
]

# ---------------------------------------------------------------------------
# Manual fixes (expanded)
# ---------------------------------------------------------------------------

MANUAL_FIXES = {
    "Hougang Plaza": "Hougang Mall Singapore",
    "Ramada Hotel": "Ramada by Wyndham Singapore at Zhongshan Park",
    "The Verge": "Tekka Place Singapore",
    "United Square Shopping Mall": "United Square Singapore",
    "Bedok Point": "Sky Eden @ Bedok Singapore",
    "Changi Airport - South Car Park (between T2 and JetQuay)": "Changi Airport Terminal 2 Singapore",
    "Grand Mecure Roxy Hotel": "Grand Mercure Singapore Roxy",
    "Paramount Hotel": "Village Hotel Katong Singapore",
    "Berjaya Hotel": "Berjaya Singapore Hotel",
    "Conrad Centennial Hotel": "Conrad Centennial Singapore",
    "Copthorne Orchid Hotel": "Copthorne Orchid Hotel Singapore",
    "Grand Park Orchard": "Grand Park Orchard Singapore",
    "klapsons, The Boutique Hotel": "Klapsons The Boutique Hotel Singapore",
    "Novotel Clarke Quay": "Novotel Singapore on Stevens",
    "Orchard Grand Court Hotel": "Orchard Grand Court Singapore",
    "Orchard Hotel Shopping Arcade": "Orchard Hotel Singapore",
    "Regent Hotel": "Conrad Singapore Orchard",
    "Swissotel Merchant Court Hotel": "Paradox Singapore Merchant Court",
    "Traders Hotel": "JEN Singapore Tanglin",
    "Paragon Shopping Centre": "Paragon Singapore",
    "Tanglin Shopping Centre": "Tanglin Shopping Centre Singapore",
    "Changi Chapel and Museum (The Changi Museum)": "Changi Chapel and Museum Singapore",
    "Labrador Secret Tunnel ( Labrador Park )": "Labrador Battery Singapore",
    "Mandai Orchid Garden": "Mandai Orchid Garden Singapore",
    "Resorts World Sentosa - Universal Studios Singapore (RWS B1 car park)": "Universal Studios Singapore",
    "Singapore Science centre/Singapore Discovery Centre / Snow City": "Science Centre Singapore",
    "Singapore Zoological gardens/Night Safari": "Singapore Zoo",
    "The Battle Box ( Park at Fort Canning": "Battlebox Fort Canning Singapore",
    "Underwater World Singapore": "Underwater World Sentosa",
    "CapitaCommercial Trust (CCT)": "CapitaSpring Singapore",
    "Clifford Centre": "Clifford Centre Singapore",
    "CPF Building Robinson Road": "CPF Building Robinson Road Singapore",
    "Funan DigitaLife Mall": "Funan Singapore",
    "Golden Shoe Complex": "CapitaSpring Singapore",
    "Iluma": "Bugis+ Singapore",
    "Income At Raffles ( former Hitachi tower)": "Income@Raffles Singapore",
    "Inter-continental Singapore Hotel": "InterContinental Singapore",
    "Keppel Bay Tower / Harbourfront Tower One": "Keppel Bay Tower Singapore",
    "Keypoint": "Arc 380 Singapore",
    "Liang Court": "CanningHill Square Singapore",
    "Marina Bay Financial Centre Tower 1, 2 ,3 & Marina Bay Link Mall": "Marina Bay Financial Centre Singapore",
    "OUB Centre": "One Raffles Place Singapore",
    "Peninsular Plaza": "Peninsula Plaza Singapore",
    "PoMo (Fomerly Paradiz Centre)": "GR.ID Singapore",
    "PWC Building": "PwC Singapore Building",
    "The Corporate Office": "The Corporate Office Singapore",
    "Jurong Theatre": "Jurong Theatre Singapore",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_query(name: str) -> str:
    name = re.sub(r"\(.*?\)", "", name).strip()
    if "singapore" not in name.lower():
        name += " Singapore"
    return name

def _geocode_onemap(name: str):
    try:
        r = requests.get(
            ONEMAP_URL,
            params={
                "searchVal": name,
                "returnGeom": "Y",
                "getAddrDetails": "Y",
                "pageNum": 1,
            },
            timeout=10,
            verify=certifi.where(),
        )
        r.raise_for_status()
        results = r.json().get("results", [])
        if not results:
            return None
        return float(results[0]["LATITUDE"]), float(results[0]["LONGITUDE"])
    except Exception:
        return None

def _geocode_osm(name: str):
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": f"{name}, Singapore", "format": "json", "limit": 1},
            headers={"User-Agent": "carpark-geocoder"},
            timeout=10,
        )
        data = r.json()
        if not data:
            return None
        return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        return None

def _geocode(name: str):
    query = MANUAL_FIXES.get(name, _clean_query(name))
    coords = _geocode_onemap(query)
    if coords:
        return coords, "OneMap"
    coords = _geocode_osm(query)
    if coords:
        return coords, "OSM"
    return None, None

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    existing = set()
    if OUTPUT_CSV.exists():
        with open(OUTPUT_CSV, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                existing.add(row["name"])

    new_rows = []

    for name in FAILED:
        if name in existing:
            continue

        print(f"Retrying: {name}")
        coords, source = _geocode(name)

        if coords:
            lat, lng = coords
            print(f"  ✓ {lat:.6f}, {lng:.6f} ({source})")
            new_rows.append({
                "name": name,
                "lat": lat,
                "lng": lng,
                "source": source,
            })
        else:
            print("  ✗ Still failed")

        time.sleep(0.5)

    if new_rows:
        with open(OUTPUT_CSV, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["name", "lat", "lng", "source"])
            writer.writerows(new_rows)

        print(f"\nAppended {len(new_rows)} new rows.")
    else:
        print("\nNo new rows to append.")

if __name__ == "__main__":
    main()
