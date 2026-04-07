# ParkCastSG

Real-time Singapore carpark finder. Search by destination or postal code, view live carpark availability from multiple sources (HDB, LTA DataMall, and supplemental), filter by shelter/availability, and see results on an interactive map. It also features a machine-learning backend that predicts carpark availability for up to an hour in advance!

---

## Architecture Overview

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│   Frontend (React/Vite) │  HTTP  │    Backend (FastAPI/Python)  │
│   localhost:5173        │◄──────►│    localhost:8000            │
│                         │        │                              │
│  - OneMap geocoding     │        │  - Loads HDB + LTA CSVs     │
│  - Leaflet map          │        │  - Calls data.gov.sg API    │
│  - Sort / filter        │        │  - Calls LTA DataMall API   │
│  - Live pricing engine  │        │  - ML Availability Prediction│
└─────────────────────────┘        └──────────────────────────────┘
          │                                       │
          │ geocoding                      HDB live availability
          ▼                                       │
   OneMap Public API               ┌──────────────┴──────────────┐
   (no key required)               ▼                             ▼
                          data.gov.sg HDB API        LTA DataMall API
                          (no key required)          (LTA_API_KEY required)
```

The backend merges three carpark data sources:

| Source | Coverage | Live availability | Pricing |
|---|---|---|---|
| **HDB** | Public HDB carparks in residential estates | Yes — data.gov.sg | HDB standard rates (engine-calculated) |
| **LTA DataMall** | Non-HDB carparks (URA/LTA-managed, private commercial) | Yes — LTA DataMall API | From `CarparkRates.csv` where matched |
| **Supplemental** | Carparks in `CarparkRates.csv` not covered by HDB or LTA | No (rates only) | From `CarparkRates.csv` |

---

## Tech Stack

### Frontend
| Tool | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| Vite | 6 | Build tool & dev server |
| TypeScript | — | Type safety |
| Tailwind CSS | v4 | Styling |
| React Router | v7 | Client-side routing |
| Leaflet | — | Interactive maps |

### Backend
| Tool | Version | Purpose |
|---|---|---|
| Python | 3.12+ | Runtime |
| FastAPI | 0.115 | REST API framework |
| Uvicorn | 0.34 | ASGI server |
| httpx | 0.28 | Async HTTP client (calls data.gov.sg + LTA DataMall) |
| python-dotenv | — | Environment variable loading |
| LightGBM & Scikit-learn| — | Machine Learning Engine |
| psycopg2-binary | — | PostgreSQL Database driver |

---

## Project Structure

```
parkcastsg/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS config
│   │   ├── api/
│   │   │   ├── carparks.py      # /carparks/nearby + /carparks/{id} endpoints (HDB + LTA + supplemental)
│   │   │   └── prediction.py    # /carparks/{id}/prediction ML endpoint
│   │   ├── core/
│   │   │   └── config.py        # Settings (DB env vars)
│   │   └── data/
│   │       ├── carpark_lookup.py            # HDB: merges CSVs into in-memory dict
│   │       ├── hdb_clean_coords.csv         # HDB carparks → WGS84 lat/lng
│   │       ├── HDBCarparkInformation.csv    # HDB carparks → address, type, flags
│   │       ├── lta_carpark_lookup.py        # LTA: static lookup from lta_carparks.csv
│   │       ├── lta_carparks.csv             # LTA carpark geometry (from data pipeline)
│   │       ├── lta_rates_lookup.py          # Matches LTA carpark names to CarparkRates.csv
│   │       ├── supplemental_carpark_lookup.py  # Supplemental: carparks in rates CSV only
│   │       ├── supplemental_carparks.csv    # Supplemental carpark geometry
│   │       ├── CarparkRates.csv             # Parking rates for LTA/supplemental carparks
│   │       └── static_carpark_mapping.csv   # Static ML dataset metadata
│   │   └── models/
│   │       └── *.pkl            # Pretrained LightGBM model files
│   ├── requirements.txt
│   └── .env.example             # Copy to .env and fill in LTA_API_KEY / DB credentials
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── geocode.ts           # OneMap geocoding utility
│   │   │   └── carparkService.ts    # Backend API client + data transformer
│   │   └── app/
│   │       ├── pages/
│   │       │   ├── home-page.tsx        # Search landing page
│   │       │   ├── results-page.tsx     # Carpark list + map (live API)
│   │       │   └── carpark-detail-page.tsx
│   │       ├── components/             # Carpark card, map, filter chips, etc.
│   │       ├── utils/
│   │       │   ├── pricingEngine.ts     # HDB live rate calculation (car/motorcycle/heavy)
│   │       │   └── holidays.ts          # Singapore public holidays for free-parking logic
│   │       └── data/
│   │           └── carparks.ts         # Carpark types + sort/filter helpers
│   ├── .env.local               # VITE_API_BASE_URL (not committed)
│   └── package.json
│
└── src/
    └── data_pipeline/           # Data ingestion scripts & source CSVs
        ├── fetch_lta_carparks.py        # Pull LTA DataMall carpark list → lta_carparks.csv
        └── geocode_rates_carparks.py    # Geocode CarparkRates carparks → supplemental_carparks.csv
```

---

## Getting Started

You need **two terminals** — one for the backend, one for the frontend.

---

### Backend Setup

#### Prerequisites
- Python 3.12 or later
- pip

#### 1. Configure the RDS Certificates
Download the RDS certificate bundle and place it inside your `backend/` folder under the name `global-bundle.pem`:
`https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`

#### 2. Create a virtual environment

> **Important:** Always use a virtual environment. Running `uvicorn` without activating the venv will fail with "command not found".

```powershell
cd backend
python -m venv venv
```

#### 3. Activate the virtual environment

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```cmd
venv\Scripts\activate.bat
```

**macOS / Linux:**
```bash
source venv/bin/activate
```

Once activated, your prompt will show `(venv)`.

#### 4. Install dependencies

```bash
pip install -r requirements.txt
```

#### 5. Configure environment variables

```bash
cp .env.example .env
```
Edit `.env` with your DB credentials for the PostgreSQL ML predictions to work correctly. Ensure there are no invisible trailing spaces following your `DB_HOST` and credentials!
Set `LTA_API_KEY` for LTA DataMall carparks (optional but recommended).
`LTA_API_KEY=<your key from https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html>`

The backend works without `LTA_API_KEY`. When the key is absent, LTA DataMall carparks are skipped gracefully and only HDB + supplemental results are returned.

#### 6. Start the backend server

```bash
uvicorn app.main:app --reload
```

> If you did **not** activate the venv (or activation is not working), you can also run it directly:
> ```powershell
> .\venv\Scripts\uvicorn app.main:app --reload
> ```

The API will be available at **http://localhost:8000**. 

You can verify it's working by opening:
- **http://localhost:8000/docs** → Interactive Swagger UI documentation
- **http://localhost:8000/health** → `{"status": "healthy"}`
- **http://localhost:8000/api/v1/carparks/nearby?lat=1.352&lng=103.849&radius=500** → live carpark list

---

### Frontend Setup

#### Prerequisites
- Node.js v18 or later
- npm v9 or later

#### 1. Install dependencies

```bash
cd frontend
npm install
```

#### 2. Configure the backend URL

Create a `.env.local` file in the `frontend/` directory:

```bash
# frontend/.env.local
VITE_API_BASE_URL=http://localhost:8000
```

> This file is git-ignored. When deploying to production, set this to your deployed backend URL.

#### 3. Start the dev server

```bash
npm run dev
```

The app will be available at **http://localhost:5173**.

---

## Production Deployment

The app is served via CloudFront at **https://dmxr5wa316ehu.cloudfront.net**, which routes traffic to two origins:

| CloudFront path pattern | Origin | What it serves |
|---|---|---|
| `/api/*` | AWS Elastic Beanstalk | FastAPI backend (carparks, weather, predictions) |
| `/health` | AWS Elastic Beanstalk | Health check |
| `/docs*` | AWS Elastic Beanstalk | Swagger UI |
| `/openapi.json` | AWS Elastic Beanstalk | OpenAPI schema |
| `default (*)` | AWS S3 | React frontend (SPA) |

HTTPS is required at the CloudFront layer to enable the browser Geolocation API.

- **Frontend**: https://dmxr5wa316ehu.cloudfront.net
- **API docs (Swagger UI)**: https://dmxr5wa316ehu.cloudfront.net/docs

> **Legacy direct-access URLs (for reference)**
> - Backend (Elastic Beanstalk): http://parkcast-api-env.eba-9ixmryjr.ap-southeast-1.elasticbeanstalk.com/docs
> - These bypass CloudFront and should not be used in production; they are listed here for debugging purposes only.

> **Note on Elastic Beanstalk:** The Elastic Beanstalk image now includes `libgomp1` within its `Dockerfile` which is strictly required to run LightGBM machine learning models in Alpine/Linux environments.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/carparks/nearby` | Carparks within radius of a lat/lng (HDB + LTA + supplemental) |
| `GET` | `/api/v1/carparks/{id}` | Single carpark live availability (prefix `LTA_` for LTA carparks) |
| `GET` | `/api/v1/carparks/{id}/prediction` | Predicted future availability utilizing ML |

### `/api/v1/carparks/nearby` parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `lat` | float | required | Latitude (WGS84) |
| `lng` | float | required | Longitude (WGS84) |
| `radius` | int | 500 | Search radius in metres |

### `/api/v1/carparks/{id}/prediction` response format
```json
{
  "carpark_number": "HE12",
  "generated_at": "2026-04-05T12:34:56+08:00",
  "predictions": [
    {
      "horizon_minutes": 15,
      "by_lot_type": [
        { "lot_type": "C", "predicted_available_lots": 123.0, "predicted_occupancy_rate": 0.41 }
      ]
    }
  ]
}
```
---

## ML Prediction

### What Was Added

| Area | Update |
|---|---|
| New API | Added `GET /api/v1/carparks/{carpark_number}/prediction` |
| Prediction models | Added bundled LightGBM models for `15`, `30`, and `60` minute horizons |
| Model metadata | Added `feature_cols.pkl` and `categorical_cols.pkl` |
| Static lookup data | Added `backend/app/data/static_carpark_mapping.csv` |
| Backend config | Added DB port, SSL, CORS, environment-aware `.env` loading, and model path settings |
| Deployment support | Updated `backend/Dockerfile` to install `libgomp1` for LightGBM runtime support |
| Python deps | Added `pandas`, `joblib`, `lightgbm`, `scikit-learn`, and `psycopg2-binary` |

### What The New Endpoint Does

The frontend can send a request to:

```text
GET /api/v1/carparks/{carpark_number}/prediction
```

The backend will then:

1. read the latest live lot records for the requested carpark from PostgreSQL
2. look up static metadata from `static_carpark_mapping.csv`
3. fetch the latest available weather record for the mapped area
4. build model features from the current lot data, area, weather, timestamp, and coordinates
5. run three prediction models for `15`, `30`, and `60` minute horizons
6. return predictions grouped by horizon and by lot type

### Response Format

Example response:

```json
{
  "carpark_number": "HE12",
  "generated_at": "2026-04-05T12:34:56+08:00",
  "predictions": [
    {
      "horizon_minutes": 15,
      "by_lot_type": [
        {
          "lot_type": "C",
          "predicted_available_lots": 123.0,
          "predicted_occupancy_rate": 0.41
        }
      ]
    },
    {
      "horizon_minutes": 30,
      "by_lot_type": [
        {
          "lot_type": "C",
          "predicted_available_lots": 118.0,
          "predicted_occupancy_rate": 0.43
        }
      ]
    },
    {
      "horizon_minutes": 60,
      "by_lot_type": [
        {
          "lot_type": "C",
          "predicted_available_lots": 110.0,
          "predicted_occupancy_rate": 0.47
        }
      ]
    }
  ]
}
```

### Error Handling

The endpoint currently returns structured API errors through FastAPI `HTTPException`.

Common cases include:

| Status | Error code | Meaning |
|---|---|---|
| `404` | `MAPPING_NOT_FOUND` | No static mapping exists for the requested `carpark_number` |
| `404` | `AVAILABILITY_NOT_FOUND` | No latest live availability row was found in PostgreSQL |
| `404` | `WEATHER_NOT_FOUND` | No matching weather record was found for the mapped area |
| `422` | `INSUFFICIENT_LOTS_INFO` | The returned lot rows are not valid enough for prediction |
| `500` | `INTERNAL_PREDICTION_ERROR` | An unexpected internal prediction error occurred |

Example error response:

```json
{
  "detail": {
    "error_code": "AVAILABILITY_NOT_FOUND",
    "message": "No availability data found for this carpark.",
    "carpark_number": "HE12"
  }
}
```
---

## How the Search Works

1. User types a destination (e.g. `"Bishan"` or postal code `"570283"`)
2. Frontend calls **OneMap API** to geocode the query → `(lat, lng)`
3. Frontend calls `GET /api/v1/carparks/nearby?lat=...&lng=...&radius=...`
4. Backend fetches live availability from **data.gov.sg** (HDB) and **LTA DataMall** (non-HDB) concurrently
5. Backend cross-references each carpark against the static lookup tables (HDB CSV, LTA CSV, supplemental CSV)
6. Results filtered by Haversine distance and merged from all three sources, sorted nearest-first
7. Frontend renders the carpark list and map; HDB carparks show live calculated pricing, LTA/supplemental show rates from `CarparkRates.csv` where available

---

## Data Sources

| Source | What it provides | Key |
|---|---|---|
| [data.gov.sg HDB Carpark Availability](https://api.data.gov.sg/v1/transport/carpark-availability) | Live lots available per HDB carpark | None required |
| [LTA DataMall CarParkAvailabilityv2](https://datamall.lta.gov.sg/content/datamall/en/dynamic-data.html) | Live lots for non-HDB (URA/LTA-managed) carparks | `LTA_API_KEY` env var |
| `backend/app/data/hdb_clean_coords.csv` | WGS84 lat/lng per HDB carpark | N/A (static file) |
| `backend/app/data/HDBCarparkInformation.csv` | Address, type, sheltered/night parking, pricing flags | N/A (static file) |
| `backend/app/data/lta_carparks.csv` | LTA carpark geometry (generated by data pipeline) | N/A (static file) |
| `backend/app/data/CarparkRates.csv` | Parking rates for LTA/supplemental carparks | N/A (static file) |
| [OneMap API](https://www.onemap.gov.sg/apidocs/) | Geocoding (address/postal code → lat/lng) | None required |

---

## Common Issues

| Problem | Solution |
|---|---|
| `uvicorn: command not found` | Activate the venv first: `.\venv\Scripts\Activate.ps1` |
| `No module named uvicorn` | Install deps: `pip install -r requirements.txt` inside the venv |
| `No carparks found` in CBD/Orchard | Switch to 2km radius — HDB carparks are sparse in commercial zones; LTA carparks require `LTA_API_KEY` |
| No LTA carparks showing | Set `LTA_API_KEY` in the backend `.env` file (get key from LTA DataMall) |
| Frontend shows API error | Ensure backend is running on port 8000 and `VITE_API_BASE_URL` is set in `.env.local` |
| CORS error in browser | Set `CORS_ALLOW_ORIGINS=https://dmxr5wa316ehu.cloudfront.net` in the Elastic Beanstalk environment variables |
| `asyncio.exceptions.CancelledError` or `WatchFiles detected changes in venv` | Uvicorn is reloading due to virtual environment cache files changing. Make sure to run with `--reload-dir app --reload-exclude venv`. |
| `password authentication failed for user "postgres"` in Prediction API | Make sure your `.env` is fully populated with no trailing spaces, and `DB_HOST` is pointing to the RDS endpoint, not `localhost`. |
