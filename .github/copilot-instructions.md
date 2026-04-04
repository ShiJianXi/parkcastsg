# ParkCastSG – Copilot Instructions

## Project Overview

ParkCastSG is a real-time Singapore carpark finder. Users search by destination or postal code to view live carpark availability on an interactive map. It integrates three public Singapore government APIs (no API keys required): data.gov.sg for live HDB carpark lots, OneMap for geocoding, and NEA for 2-hour weather forecasts.

> **Planned expansion**: LTA DataMall will be integrated to include non-HDB (e.g. private/commercial) carparks in addition to the existing HDB dataset.

## Architecture

```
frontend/ (React + Vite + TypeScript)  ←HTTP→  backend/ (FastAPI + Python)
       ↓ geocoding                                    ↓ live availability
  OneMap API                                   data.gov.sg HDB Carpark API
                                                      ↓ weather
                                               NEA 2-hour Forecast API
```

- **Frontend**: React SPA served from AWS S3
- **Backend**: FastAPI on AWS Elastic Beanstalk (`ap-southeast-1`)
- **Production URL**: `https://dmxr5wa316ehu.cloudfront.net` (CloudFront serves both — HTTPS is required to enable the browser Geolocation API)

## CloudFront Routing

CloudFront sits in front of both origins and routes by path pattern:

| Path pattern | Origin | What it serves |
|---|---|---|
| `/api/*` | Elastic Beanstalk | FastAPI backend |
| `/health` | Elastic Beanstalk | Health check |
| `/docs*` | Elastic Beanstalk | Swagger UI |
| `/openapi.json` | Elastic Beanstalk | OpenAPI schema |
| `default (*)` | S3 | React SPA |

Because of this, the frontend sets `VITE_API_BASE_URL=https://dmxr5wa316ehu.cloudfront.net` (no separate subdomain) and all API calls are constructed as `${API_BASE}/api/v1/...`.

## Environment Variables

### Frontend (`frontend/.env.production`)
```
VITE_API_BASE_URL=https://dmxr5wa316ehu.cloudfront.net
```
Local dev uses `frontend/.env.local` (git-ignored):
```
VITE_API_BASE_URL=http://localhost:8000
```

### Backend (Elastic Beanstalk environment / `backend/.env`)
```
CORS_ALLOW_ORIGINS=https://dmxr5wa316ehu.cloudfront.net
```
Local dev defaults to `http://localhost:5173` when `CORS_ALLOW_ORIGINS` is unset.

## Tech Stack

### Frontend
- React 18, TypeScript, Vite 6
- Tailwind CSS v4 (uses `@tailwindcss/vite` plugin — no `tailwind.config.js`)
- React Router v7
- Leaflet + react-leaflet for the interactive map
- MUI v7 + Radix UI for components; `lucide-react` for icons

### Backend
- Python 3.12+, FastAPI 0.115, Uvicorn
- `httpx` for async HTTP calls to external APIs
- `python-dotenv` for environment variables
- No database currently — static carpark data is loaded from CSV files at startup. **Amazon RDS integration is planned**; when it lands, carpark metadata will be served from the database instead of CSVs.

## Key Conventions

### Backend (Python)
- All endpoints are `async def`
- Pydantic models for all request/response schemas; use `from __future__ import annotations` at the top of every module
- Haversine distance is computed inline using the standard `math` library — do not add a geospatial dependency
- `CARPARK_LOOKUP` in `backend/app/data/carpark_lookup.py` is loaded once at import time into a module-level dict; never reload it per request
- Raise `HTTPException(status_code=502, ...)` for upstream API failures (data.gov.sg, NEA)
- Validate the full shape of external API responses before accessing nested fields
- `crowd_level` is derived from the `available/total` ratio: >50% → `"low"`, >20% → `"medium"`, else `"high"`, 0 available → `"full"`
- Weather responses are cached in a module-level dict for 5 minutes (`CACHE_TTL = 300`) to avoid hammering the NEA API
- CORS origins are read from `CORS_ALLOW_ORIGINS` (comma-separated env var); production value is `https://dmxr5wa316ehu.cloudfront.net`

### Frontend (TypeScript)
- Types for carpark data live in `frontend/src/app/data/carparks.ts`
- All backend calls go through `frontend/src/api/carparkService.ts` (carparks) and `frontend/src/api/weatherService.ts` (weather)
- Geocoding (address/postal code → lat/lng) uses OneMap via `frontend/src/api/geocode.ts`
- Pages are in `frontend/src/app/pages/`; shared components in `frontend/src/app/components/`
- The backend returns `snake_case`; `carparkService.ts` transforms it to `camelCase` for the frontend
- `AvailabilityLevel` (`'high' | 'moderate' | 'low' | 'full'`) maps from backend `crowd_level` (`'low' | 'medium' | 'high' | 'full'`) — note the inversion: backend `"low"` crowd = frontend `"high"` availability

### Results Page – Navigation Modes

The Results Page (`frontend/src/app/pages/results-page.tsx`) supports two URL shapes:

| Mode | URL example | When used |
|---|---|---|
| Coordinate-based | `/results?lat=1.3685&lng=103.9527&radius=1000` | "My Location" / map click |
| Text-based | `/results?q=Pasir+Ris&radius=1000` | Address / postal code search |

**Critical rule — always prefer URL coordinates over geocoding:**

```ts
// ✅ Correct
let coords = coordsFromParams;          // use lat/lng from URL if present
if (!coords) {
    coords = await geocodeQuery(destination);  // only geocode when missing
}
if (!coords) {
    setError(`Could not find location "${destination}".`);
    return;
}
```

When `lat` and `lng` are present in the URL, `destination` defaults to `"My Location"` — a UI display label that **cannot be geocoded**. Never pass `destination` to `geocodeQuery` when valid coordinates are already available. Forgetting this causes a silent failure because the geocoder returns `null` for `"My Location"` and the backend is never reached.

When building any feature that navigates to or reads from the Results Page, preserve both URL shapes. Radius-pill and "Expand to 2km" buttons already do this correctly — use them as a reference.

### Data Pipeline
- Scripts in `src/data_pipeline/` are run manually to regenerate static CSVs
- `hdb_clean_coords.csv` supplies WGS84 coordinates; `HDBCarparkInformation.csv` supplies address and feature flags
- Both CSVs are committed to the repo and bundled into the backend Docker image

## Running Locally

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate   # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload        # → http://localhost:8000

# Frontend
cd frontend
npm install
# Create frontend/.env.local: VITE_API_BASE_URL=http://localhost:8000
npm run dev                          # → http://localhost:5173
```

## Important Notes

- The HDB dataset covers **public HDB carparks only** — commercial/CBD zones (Marina Bay, Orchard) have few results; suggest a 2 km radius for those areas
- Do not commit `frontend/.env.local` or `backend/.env` — both are git-ignored
- Frontend is deployed automatically to S3 via GitHub Actions on push to `main` when `frontend/**` files change
- The backend has no automated test suite; validate API changes manually via `http://localhost:8000/docs` or the production Swagger UI at `https://dmxr5wa316ehu.cloudfront.net/docs`
