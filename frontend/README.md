# ParkCastSG — Frontend

A React web application for finding and comparing carparks in Singapore. Users can search by destination or postal code, filter results, view real-time availability and pricing, and see predicted occupancy for the next 2 hours.

## Tech Stack

| Tool | Purpose |
|---|---|
| [React 18](https://react.dev/) | UI framework |
| [Vite 6](https://vitejs.dev/) | Build tool & dev server |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Tailwind CSS v4](https://tailwindcss.com/) | Utility-first styling |
| [React Router v7](https://reactrouter.com/) | Client-side routing |
| [Leaflet](https://leafletjs.com/) + [React Leaflet](https://react-leaflet.js.org/) | Interactive maps |
| [Recharts](https://recharts.org/) | Availability prediction charts |
| [Radix UI](https://www.radix-ui.com/) | Accessible UI primitives (via shadcn/ui) |
| [Lucide React](https://lucide.dev/) | Icons |

## Project Structure

```
frontend/
├── index.html              # Vite HTML entry point
├── src/
│   ├── main.tsx            # React bootstrap / root render
│   ├── app/
│   │   ├── app.tsx         # Root App component (router provider)
│   │   ├── routes.ts       # Route definitions
│   │   ├── pages/
│   │   │   ├── home-page.tsx          # Search / landing page
│   │   │   ├── results-page.tsx       # Carpark list + map view
│   │   │   └── carpark-detail-page.tsx # Detail page for a single carpark
│   │   ├── components/
│   │   │   ├── carpark-card.tsx       # Card shown in results list
│   │   │   ├── carpark-map.tsx        # Leaflet map with pins
│   │   │   ├── filter-chips.tsx       # Sort & filter controls
│   │   │   ├── loading-skeleton.tsx   # Loading placeholder
│   │   │   ├── premium-modal.tsx      # Alert notification upsell modal
│   │   │   ├── weather-banner.tsx     # Rain-mode weather alert banner
│   │   │   └── ui/                    # Shared shadcn/ui primitives
│   │   └── data/
│   │       └── carparks.ts            # Mock carpark data & utility functions
│   └── styles/
│       ├── index.css       # Base reset styles
│       ├── tailwind.css    # Tailwind directives
│       ├── theme.css       # CSS custom properties (colour tokens)
│       └── fonts.css       # Font imports
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Pages & Routes

| Route | Page | Description |
|---|---|---|
| `/` | `HomePage` | Search bar with destination input, radius selector, and location button |
| `/results?q=...&radius=...` | `ResultsPage` | Split-panel carpark list + interactive map; supports sort (recommended / cheapest / closest / most available) and rain-mode filter |
| `/carpark/:id` | `CarparkDetailPage` | Availability, pricing, 2-hour occupancy prediction chart, weather & shelter info, Google Maps navigation |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

The app will be available at **http://localhost:5173**.

### Build for production

```bash
npm run build
```

The compiled output will be in the `dist/` directory.

## Notes

- Carpark data is currently **mocked** in `src/app/data/carparks.ts`. Future work involves replacing this with live API calls to the backend service.
- The `@` path alias maps to `src/` (e.g. `@/app/components/...`).
