# ParkCastSG

Real-time Singapore carpark finder. Search by destination or postal code, view live HDB carpark availability, filter by shelter/availability, and see results on an interactive map.

---

## Architecture Overview

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│   Frontend (React/Vite) │  HTTP  │    Backend (FastAPI/Python)  │
│   localhost:5173        │◄──────►│    localhost:8000            │
│                         │        │                              │
│  - OneMap geocoding     │        │  - Loads HDB carpark CSVs   │
│  - Leaflet map          │        │  - Calls data.gov.sg API    │
│  - Sort / filter        │        │  - Haversine distance filter │
└─────────────────────────┘        └──────────────────────────────┘
          │                                       │
          │ geocoding                             │ live availability
          ▼                                       ▼
   OneMap Public API                  data.gov.sg HDB Carpark API
   (no key required)                  (no key required)
```

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
| httpx | 0.28 | Async HTTP client (calls data.gov.sg) |
| python-dotenv | — | Environment variable loading |

---

## Project Structure

```
parkcastsg/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS config
│   │   ├── api/
│   │   │   └── carparks.py      # /carparks/nearby + /carparks/{id} endpoints
│   │   ├── core/
│   │   │   └── config.py        # Settings (DB env vars)
│   │   └── data/
│   │       ├── carpark_lookup.py        # Merges both CSVs into in-memory dict
│   │       ├── hdb_clean_coords.csv     # HDB carparks → WGS84 lat/lng
│   │       └── HDBCarparkInformation.csv # HDB carparks → address, type, flags
│   ├── requirements.txt
│   └── .env.example             # Copy to .env and fill in DB credentials
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
│   │       └── data/
│   │           └── carparks.ts         # Carpark types + sort/filter helpers
│   ├── .env.local               # VITE_API_BASE_URL (not committed)
│   └── package.json
│
└── src/
    └── data_pipeline/           # Data ingestion scripts & source CSVs
```

---

## Getting Started

You need **two terminals** — one for the backend, one for the frontend.

---

### Backend Setup

#### Prerequisites
- Python 3.12 or later
- pip

#### 1. Create a virtual environment

> **Important:** Always use a virtual environment. Running `uvicorn` without activating the venv will fail with "command not found".

```powershell
cd backend
python -m venv venv
```

#### 2. Activate the virtual environment

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

#### 3. Install dependencies

```bash
pip install -r requirements.txt
```

#### 4. Configure environment variables (optional for now)

```bash
cp .env.example .env
# Edit .env with your DB credentials if connecting to PostgreSQL
```

The backend works without a `.env` file — it falls back to the HDB CSV data and the live `data.gov.sg` API.

#### 5. Start the backend server

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

## Deployed Backend API

The live backend API is available at:
- **[http://parkcast-api-env.eba-9ixmryjr.ap-southeast-1.elasticbeanstalk.com/docs](http://parkcast-api-env.eba-9ixmryjr.ap-southeast-1.elasticbeanstalk.com/docs#/default/health_check_health_get)** → Interactive Swagger UI documentation

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/carparks/nearby` | Carparks within radius of a lat/lng |
| `GET` | `/api/v1/carparks/{id}` | Single carpark live availability |

### `/api/v1/carparks/nearby` parameters

| Param | Type | Default | Description |
|---|---|---|---|
| `lat` | float | required | Latitude (WGS84) |
| `lng` | float | required | Longitude (WGS84) |
| `radius` | int | 500 | Search radius in metres |

---

## How the Search Works

1. User types a destination (e.g. `"Bishan"` or postal code `"570283"`)
2. Frontend calls **OneMap API** to geocode the query → `(lat, lng)`
3. Frontend calls `GET /api/v1/carparks/nearby?lat=...&lng=...&radius=...`
4. Backend fetches live availability snapshot from `data.gov.sg`
5. Backend cross-references each carpark against the HDB CSV lookup table
6. Results filtered by Haversine distance, sorted nearest-first
7. Frontend renders the carpark list and map

> **Note:** The HDB dataset only covers **public HDB carparks** in residential estates. Commercial zones like Marina Bay and Orchard Road have few/no HDB carparks — use a **2km radius** for those areas or search a nearby residential neighbourhood.

---

## Data Sources

| Source | What it provides | Key |
|---|---|---|
| [data.gov.sg HDB Carpark Availability](https://api.data.gov.sg/v1/transport/carpark-availability) | Live lots available per carpark | None required |
| `backend/app/data/hdb_clean_coords.csv` | WGS84 lat/lng per HDB carpark | N/A (static file) |
| `backend/app/data/HDBCarparkInformation.csv` | Address, type, sheltered/night parking flags | N/A (static file) |
| [OneMap API](https://www.onemap.gov.sg/apidocs/) | Geocoding (address/postal code → lat/lng) | None required |

---

## Common Issues

| Problem | Solution |
|---|---|
| `uvicorn: command not found` | Activate the venv first: `.\venv\Scripts\Activate.ps1` |
| `No module named uvicorn` | Install deps: `pip install -r requirements.txt` inside the venv |
| `No carparks found` in CBD/Orchard | Switch to 2km radius — HDB carparks are sparse in commercial zones |
| Frontend shows API error | Ensure backend is running on port 8000 and `VITE_API_BASE_URL` is set in `.env.local` |
| CORS error in browser | Backend CORS is configured for `localhost:5173` — check `app/main.py` if using a different port |
