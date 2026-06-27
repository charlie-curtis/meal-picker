# Pick For Us

A real-time collaborative food picker. Add places together, share one live room, and let the app choose where to eat.

**Live:** [justpickfood.com](https://justpickfood.com)

![Pick For Us app screenshot](docs/assets/pick-for-us-screenshot.png)

---

## How it works

```
Browser A ──┐
            ├──▶ Firebase Realtime Database ──▶ Browser B
Browser C ──┘
```

There is no backend server. The app is a static React frontend that reads and writes directly to Firebase Realtime Database. Firebase pushes changes to all connected clients over WebSockets — so when one user adds a restaurant, everyone in the same room sees it immediately.

Each session gets a **room ID** generated on first load and stored in the URL (`?room=abc123`). Sharing that URL gives anyone access to the same room.

---

## File structure

```
pick-for-us/
├── index.html          # Entry point — just a shell div that Vite populates
├── vite.config.js      # Tells Vite to use the React JSX compiler
├── package.json        # Dependencies: React, Firebase, Vite
├── src/
│   ├── main.jsx        # Mounts the React app into index.html's #root div
│   ├── App.jsx         # The entire application — all logic and UI
│   └── App.css         # All styles, built on a CSS design token system
├── worker/
│   ├── src/
│   │   └── index.js    # Cloudflare Worker — proxies Google APIs, enforces rate limit
│   └── wrangler.toml   # Worker config (KV namespace bindings)
└── docs/
    └── ui-research/    # Design research reports used to inform the UI
```

### `index.html`
A near-empty HTML file — just a `<div id="root">` that React mounts into, plus a `<script>` tag pointing at `src/main.jsx`. Vite injects the compiled JS/CSS bundles here at build time.

### `vite.config.js`
Two lines. Registers the `@vitejs/plugin-react` plugin, which tells Vite's compiler how to transform JSX syntax (the HTML-in-JS that React uses) into plain JavaScript the browser can run.

### `src/main.jsx`
The bootstrap file. Calls `createRoot().render(<App />)` to hand control to React. You rarely need to touch this.

### `src/App.jsx`
The entire application lives here. It has three responsibilities:

**1. Firebase setup (module level, runs once)**
- Initialises the Firebase app with the project config
- Gets the database instance
- Computes the room ID from the URL (or generates one and writes it to the URL)
- Defines the `SUGGESTIONS` data (pre-loaded restaurant options by category)

**2. State + data (inside the `App` component)**
- `useState` hooks hold local UI state: the restaurant list, the current winner, spin state, input value, and panel open/closed states
- `useEffect` sets up two Firebase `onValue` listeners on mount — one for the restaurant list, one for the winner. These fire immediately with current data, then again whenever any client writes a change. They are cleaned up when the component unmounts.
- `addRestaurant`, `removeRestaurant`, `pickRandom` — the three mutations. Each writes to Firebase, which propagates to all connected clients via the listeners.
- The winner is **chosen instantly** when `pickRandom` is called; the spin animation is purely visual. The winning restaurant is also written directly to local state (not just Firebase) to handle the case where the same winner is picked twice in a row — Firebase won't emit an `onValue` event if the value didn't change.

**3. JSX (the return block)**
Renders the UI: title, collapsible suggestions panel, input row, restaurant list, pick button + result, and collapsible share section. No sub-components — everything is in one function for simplicity.

### `src/App.css`
Styles built on a **CSS custom property (token) system** defined in `:root`:

| Token group | Purpose |
|---|---|
| `--space-*` | 4/8px spacing scale applied everywhere |
| `--neutral-*` | 11-step warm gray ramp |
| `--color-*` | Semantic tokens (text, surface, border, primary, danger, winner) mapped from the ramp |
| `--text-*` | Type scale (display → label) on an Inter/system font stack |
| `--weight-*` | Font weights (regular/medium/semibold) |
| `--radius-*` | Border radius scale (sm/md/lg/pill) |
| `--elev-*` | Two-layer box shadows for elevation |
| `--motion-*` | Duration + easing curves for transitions |

Everything else in the file references these tokens. Changing a token propagates the change everywhere it's used.

---

## Cloudflare Worker proxy

The nearby restaurant search feature routes through a Cloudflare Worker rather than calling Google APIs directly from the browser.

```
Browser ──▶ Cloudflare Worker ──▶ Google Places API
                  │                Google Geocoding API
                  └── KV (rate limit counter)
```

**Why a proxy?** The Google API key must never appear in browser code — anything shipped to the client is publicly visible. The Worker keeps the key server-side as an encrypted secret, and the browser never sees it.

**Rate limiting:** Each request checks a global counter stored in Cloudflare KV. The counter is keyed by day (`global:<day-number>`) and capped at 100 requests/day across all users. When the cap is hit, the Worker returns a `429` error and the app surfaces a message. The counter resets automatically at midnight UTC — no cron job needed, the day-bucketed key just changes with time.

**Routes:**

| Method | Path | Proxies to |
|---|---|---|
| `POST` | `/nearby` | Google Places Nearby Search API |
| `GET` | `/geocode?address=...` | Google Geocoding API |

### Worker setup

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

Then add the deployed worker URL to `.env.local` in the project root:

```
VITE_WORKER_URL=https://meal-picker-proxy.<your-subdomain>.workers.dev
```

---

## Data model

Firebase stores rooms as a JSON tree:

```json
{
  "rooms": {
    "abc123": {
      "restaurants": {
        "-NxKj2...": "Chipotle",
        "-NxKj3...": "Shake Shack"
      },
      "winner": "Chipotle"
    }
  }
}
```

Restaurant keys are Firebase push IDs (random, collision-safe, time-ordered). The winner is a plain string — the restaurant name.

---

## Getting started

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/charlie-curtis/pick-for-us.git
cd pick-for-us
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). To share a session, copy the URL (which now includes `?room=<id>`) and open it in another browser tab or send it to someone.

### Other commands

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server with hot reload |
| `npm run build` | Compile a production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| UI framework | React 18 | Component model, state management |
| Build tool | Vite | Fast dev server, JSX compilation |
| Realtime database | Firebase Realtime Database | Push-based sync across clients with no backend |
| Styling | Plain CSS + custom properties | No build-time dependency, token system gives design consistency |
| API proxy | Cloudflare Workers | Keeps Google API key server-side, enforces global rate limit |
| Rate limit store | Cloudflare KV | Persistent daily request counter, auto-expires |
