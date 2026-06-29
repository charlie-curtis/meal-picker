# Architecture Notes

This page is a deeper code walkthrough for maintainers. The top-level README stays focused on what the app does, how it works at a high level, and how to run it.

## File Structure

```text
pick-for-us/
├── index.html          # Entry point, SEO/social tags, and the root React mount
├── vite.config.js      # Vite config with the React JSX compiler
├── package.json        # Frontend dependencies: React, Firebase, Vite
├── public/
│   ├── og-image.png    # Social preview image for shared links
│   └── og-image.svg    # Source SVG for the social preview image
├── src/
│   ├── main.jsx        # Mounts the React app into index.html's #root div
│   ├── App.jsx         # Main application logic and UI
│   └── App.css         # Styles built on a CSS design token system
├── worker/
│   ├── package.json    # Worker-only dependencies and deploy scripts
│   ├── package-lock.json
│   ├── src/
│   │   └── index.js    # Cloudflare Worker proxy for Google APIs
│   └── wrangler.toml   # Worker config and KV namespace bindings
└── docs/
    ├── architecture.md # This file
    └── ui-research/    # Design research reports used to inform the UI
```

## Frontend Entry Points

### `index.html`

A near-empty HTML file: mostly SEO/social meta tags, a `<div id="root">` that React mounts into, and a `<script>` tag pointing at `src/main.jsx`. Vite injects the compiled JS/CSS bundles here at build time.

### `vite.config.js`

Small Vite config that registers the `@vitejs/plugin-react` plugin, which tells Vite how to transform JSX into browser-ready JavaScript.

### `src/main.jsx`

The bootstrap file. Calls `createRoot().render(<App />)` to hand control to React. This rarely needs to change.

## `src/App.jsx`

Most of the app lives here. It has three broad responsibilities.

### 1. Firebase setup

- Initializes the Firebase app with the project config.
- Gets the Realtime Database instance.
- Computes the room ID from the URL, or generates a 9-character ID and writes it to the URL.
- Defines `SUGGESTIONS`, the pre-loaded restaurant options grouped by category.

### 2. State and data

- `useState` hooks hold local UI state: restaurant list, winner, spin state, input value, nearby search state, duplicate messages, viewer count, and panel open/closed states.
- `useEffect` sets up Firebase `onValue` listeners for restaurants, winner, connection state, and room presence.
- Presence uses Firebase `onDisconnect`, so the UI can show when multiple people are in the room and remove presence entries when a browser leaves.
- `addRestaurant`, `removeRestaurant`, and `pickRandom` write to Firebase. Firebase then propagates those changes to every connected client.
- The winner is chosen immediately when `pickRandom` runs. The spin animation is visual only.
- The winner is also written directly to local state, not only Firebase, so the UI still updates if the same winner is picked twice in a row and Firebase does not emit a changed value.
- Nearby search uses `VITE_WORKER_URL` to call the Cloudflare Worker for geocoding and nearby restaurant search.

### 3. Rendered UI

The JSX renders:

- Title, subtitle, presence count, and invite button.
- Restaurant input row.
- Restaurant list and empty state.
- Pick button and winner result.
- Collapsible suggestion chips.
- Collapsible nearby restaurant search.
- Privacy footer.

`Chevron` is the only small helper component; the rest stays in the main `App` function for simplicity.

## Firebase Data Model

Firebase stores rooms as a JSON tree:

```json
{
  "rooms": {
    "abc123xyz": {
      "restaurants": {
        "-NxKj2...": "Chipotle",
        "-NxKj3...": "Shake Shack"
      },
      "winner": "Chipotle",
      "presence": {
        "-NxPresence...": true
      }
    }
  }
}
```

Restaurant and presence keys are Firebase push IDs: random, collision-safe, and time-ordered. The winner is a plain string containing the restaurant name. Presence entries are created per connected browser and removed automatically with Firebase `onDisconnect`.

## `src/App.css`

Styles are built on CSS custom properties defined in `:root`.

| Token group | Purpose |
|---|---|
| `--space-*` | 4/8px spacing scale applied everywhere |
| `--neutral-*` | 11-step warm gray ramp |
| `--color-*` | Semantic tokens for text, surfaces, borders, primary, danger, and winner states |
| `--text-*` | Type scale from display to label |
| `--weight-*` | Font weights |
| `--radius-*` | Border radius scale |
| `--elev-*` | Two-layer box shadows |
| `--motion-*` | Duration and easing curves |

Most component styles reference these tokens, so changing a token propagates through the UI.

## Worker Proxy

Nearby restaurant search routes through `worker/src/index.js`, a Cloudflare Worker, rather than calling Google APIs directly from the browser.

```text
Browser ──▶ Cloudflare Worker ──▶ Google Places API
                  │         └────▶ Google Geocoding API
                  └──────────────▶ KV (global daily counter)
```

The Worker:

- Receives browser requests from the app.
- Adds CORS headers for the production site origins.
- Keeps the Google API key server-side via `env.GOOGLE_PLACES_API_KEY`.
- Proxies `/nearby` to Google Places Nearby Search.
- Proxies `/geocode` to Google Geocoding.
- Uses Cloudflare KV as a simple global daily request counter to bound API usage.

The Worker is intentionally small. It is a spend-control and secret-hiding proxy, not a full backend application.

### Why a proxy?

The Google API key must never appear in browser code. Anything shipped to the client is publicly visible, so the Worker keeps the key server-side as an encrypted secret and the browser never sees it.

### CORS

The Worker returns CORS headers for the production site origins. This lets the production frontend read Worker responses in the browser.

### Rate limiting

The Worker checks a global counter stored in Cloudflare KV before proxying requests to Google. The counter is keyed by day and capped at a small daily limit across all users. When the cap is hit, the Worker returns a `429` error and the app surfaces a message.

The counter is intentionally simple and global. Because Cloudflare KV is eventually consistent, a burst of simultaneous requests can overshoot the exact cap slightly, but it still bounds usage for this small app. For an exact global counter, the Worker would need a stronger coordination primitive such as Durable Objects.

### Routes

| Method | Path | Proxies to |
|---|---|---|
| `POST` | `/nearby` | Google Places Nearby Search API |
| `GET` | `/geocode?address=...` | Google Geocoding API |
