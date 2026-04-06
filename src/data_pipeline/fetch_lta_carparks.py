"""
Fetches LTA DataMall CarParkAvailabilityv2, deduplicates to one row per
non-HDB carpark, and saves the static metadata to
backend/app/data/lta_carparks.csv.

Run this script manually whenever LTA carpark locations change:

    cd src/data_pipeline
    pip install -r requirements.txt
    python fetch_lta_carparks.py

The generated CSV is then committed to the repo so the backend can load
it at startup (the same pattern used for the HDB CSVs).
"""
import csv
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LTA_URL = "https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2"
OUTPUT_CSV = Path(__file__).resolve().parents[2] / "backend" / "app" / "data" / "lta_carparks.csv"
HDB_AGENCIES = {"HDB"}


# ---------------------------------------------------------------------------
# Fetch with pagination
# ---------------------------------------------------------------------------


def fetch_lta_carparks(api_key: str) -> list[dict]:
    """Fetch all carpark availability entries from LTA DataMall (paginated)."""
    headers = {"AccountKey": api_key, "accept": "application/json"}
    all_entries: list[dict] = []
    skip = 0

    print("Connecting to LTA DataMall…")
    while True:
        try:
            resp = requests.get(LTA_URL, headers=headers, params={"$skip": skip}, timeout=15)
            resp.raise_for_status()
            batch = resp.json().get("value", [])
        except requests.exceptions.RequestException as exc:
            print(f"Error fetching data from LTA: {exc}")
            break

        if not batch:
            break

        all_entries.extend(batch)
        print(f"  fetched {len(all_entries)} records so far…")
        skip += 500

    print(f"Finished — {len(all_entries)} total entries.")
    return all_entries


# ---------------------------------------------------------------------------
# Deduplicate → one row per non-HDB car-park
# ---------------------------------------------------------------------------


def _parse_location(location: str) -> tuple[float, float] | None:
    parts = location.strip().split()
    if len(parts) != 2:
        return None
    try:
        return float(parts[0]), float(parts[1])
    except ValueError:
        return None


def build_static_lookup(entries: list[dict]) -> list[dict]:
    """Return deduplicated rows — one per CarParkID, non-HDB, car lots only."""
    seen: dict[str, dict] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if entry.get("Agency", "") in HDB_AGENCIES:
            continue
        if entry.get("LotType", "") != "C":
            continue

        cp_id = str(entry.get("CarParkID", "")).strip()
        if not cp_id or cp_id in seen:
            continue

        coords = _parse_location(entry.get("Location", ""))
        if coords is None:
            continue

        lat, lng = coords
        seen[cp_id] = {
            "carpark_id": cp_id,
            "development": entry.get("Development", "").strip(),
            "lat": lat,
            "lng": lng,
        }

    rows = sorted(seen.values(), key=lambda r: r["carpark_id"])
    print(f"Deduplicated to {len(rows)} unique non-HDB car-park locations.")
    return rows


# ---------------------------------------------------------------------------
# Save CSV
# ---------------------------------------------------------------------------


def save_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["carpark_id", "development", "lat", "lng"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved {len(rows)} rows → {path}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    load_dotenv()
    api_key = os.getenv("LTA_API_KEY", "")
    if not api_key:
        print("❌ ERROR: LTA_API_KEY not found in environment / .env file.")
        raise SystemExit(1)

    print("Key loaded from environment.")
    entries = fetch_lta_carparks(api_key)
    rows = build_static_lookup(entries)
    save_csv(rows, OUTPUT_CSV)

