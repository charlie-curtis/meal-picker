# Getting Started

## Prerequisites

- Node.js 20.19+ or 22.12+ for the frontend Vite app.
- A Firebase Realtime Database project.
- A Cloudflare account for the Worker proxy.
- A Google API key with access to the Places and Geocoding APIs.

## Run Locally

```bash
git clone https://github.com/charlie-curtis/pick-for-us.git
cd pick-for-us
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). To share a session locally, copy the URL with `?room=<id>` and open it in another browser tab.

Nearby restaurant search needs a deployed Worker URL in `.env.local`:

```bash
VITE_WORKER_URL=https://meal-picker-proxy.<your-subdomain>.workers.dev
```

## Frontend Commands

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server with hot reload |
| `npm run build` | Compile a production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |

## Worker Setup

```bash
cd worker
npm install
npx wrangler login
npx wrangler kv:namespace create RATE_LIMIT_KV
npx wrangler kv:namespace create RATE_LIMIT_KV --preview
# paste the returned IDs into worker/wrangler.toml
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler deploy
```

After deployment, copy the Worker URL into `.env.local` as `VITE_WORKER_URL`.
