# Architecture Notes

This page is a deeper code walkthrough for maintainers. The top-level README stays focused on what the app does, how it works at a high level, and how to run it.

## File Structure

```text
pick-for-us/
├── index.html          # Entry point, SEO/social tags, and the root React mount
├── vite.config.ts      # Vite config with the React JSX compiler and test setup
├── tsconfig.json       # TypeScript compiler options (strict mode)
├── vite-env.d.ts       # Vite client type declarations
├── package.json        # Frontend dependencies: React, Firebase, Vite, TypeScript
├── public/
│   ├── og-image.png    # Social preview image for shared links
│   └── og-image.svg    # Source SVG for the social preview image
├── src/
│   ├── main.tsx        # Mounts the React app into index.html's #root div
│   ├── App.tsx         # Main application state, logic, and layout
│   ├── App.css         # Styles built on a CSS design token system
│   ├── App.test.tsx    # Integration tests (Vitest + Testing Library)
│   ├── components/
│   │   ├── AppHeader.tsx         # Title bar, presence count, invite button
│   │   ├── Icons.tsx             # SVG icon components (Chevron, Link, Lock, etc.)
│   │   ├── NearbySearchPanel.tsx # Collapsible nearby restaurant search UI
│   │   ├── PickControls.tsx      # Pick button and winner announcement
│   │   ├── PrivacyFooter.tsx     # Privacy notice footer
│   │   ├── RestaurantForm.tsx    # Restaurant name input and Add button
│   │   ├── RestaurantList.tsx    # Restaurant list with spin/winner highlighting
│   │   └── SuggestionsPanel.tsx  # Collapsible suggestion chips by category
│   ├── services/
│   │   └── locationService.ts   # Geocoding and nearby search API calls
│   └── test/
│       └── setup.ts             # Test setup (jest-dom matchers)
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

A near-empty HTML file: mostly SEO/social meta tags, a `<div id="root">` that React mounts into, and a `<script>` tag pointing at `src/main.tsx`. Vite injects the compiled JS/CSS bundles here at build time.

### `vite.config.ts`

Vite config that registers `@vitejs/plugin-react` for JSX transformation. Also configures Vitest with jsdom, setup files, and coverage settings.

### `src/main.tsx`

The bootstrap file. Calls `createRoot().render(<App />)` to hand control to React. This rarely needs to change.

## `src/App.tsx`

The top-level component that owns application state and wires child components together. It has three broad responsibilities.

### 1. Firebase setup

- Initializes the Firebase app with the project config.
- Gets the Realtime Database instance.
- Computes the room ID from the URL, or generates a 9-character ID and writes it to the URL.

### 2. State and data

- `useState` hooks hold local UI state: restaurant list, winner, spin state, input value, nearby search state, duplicate messages, viewer count, and panel open/closed states.
- `useEffect` sets up Firebase `onValue` listeners for restaurants, winner, connection state, and room presence.
- Presence uses Firebase `onDisconnect`, so the UI can show when multiple people are in the room and remove presence entries when a browser leaves.
- `addRestaurant`, `removeRestaurant`, and `pickRandom` write to Firebase. Firebase then propagates those changes to every connected client.
- `addRestaurant` guards against adds while the spinner is active.
- The winner is chosen immediately when `pickRandom` runs. The spin animation is visual only.
- The winner is also written directly to local state, not only Firebase, so the UI still updates if the same winner is picked twice in a row and Firebase does not emit a changed value.
- Nearby search delegates to `locationService.ts` for geocoding and nearby restaurant search, then manages loading/error/result state locally.
- Network errors from the location service are passed through `friendlyError()`, which replaces raw `TypeError` messages with a user-friendly fallback.

### 3. Rendered UI

App.tsx composes these child components:

| Component | Responsibility |
|---|---|
| `AppHeader` | Title, subtitle, presence count, invite/copy-link button |
| `RestaurantForm` | Text input and Add button for entering restaurant names |
| `RestaurantList` | Ordered list with spin highlighting, winner state, and remove buttons |
| `PickControls` | Pick/Pick again button and winner announcement |
| `SuggestionsPanel` | Collapsible panel of pre-loaded restaurant suggestion chips |
| `NearbySearchPanel` | Collapsible panel for geocoded nearby restaurant search |
| `PrivacyFooter` | Privacy notice |

All components are presentational — they receive data and callbacks via typed props interfaces and contain no state or side effects.

## `src/services/locationService.ts`

Pure async functions for location-related API calls, extracted from App to keep fetch logic separate from React state:

| Function | Purpose |
|---|---|
| `getCurrentPosition()` | Wraps the browser Geolocation API in a Promise |
| `geocodeAddress(address)` | Calls the Worker's `/geocode` endpoint |
| `searchNearbyPlaces(lat, lng, radius)` | Calls the Worker's `/nearby` endpoint |

Also exports `LatLng` and response type interfaces used by the functions and App.

## `src/components/Icons.tsx`

Simple SVG icon components (`Chevron`, `LinkIcon`, `EmptyStateIcon`, `LocationIcon`, `LockIcon`) used across the UI. They take no props and render inline SVGs with `currentColor` for theming.

## TypeScript

The project uses TypeScript in strict mode. Key typing patterns:

- **Props interfaces** — every component defines an interface for its props (e.g. `RestaurantListProps`), so the compiler catches mismatched or missing props at build time.
- **Typed state** — `useState` calls include type parameters where inference isn't sufficient (e.g. `useState<Record<string, string>>({})`).
- **API response types** — `GeocodeResponse`, `NearbyResponse` in locationService.ts define the expected shape of external API data.

TypeScript is dev-only: Vite strips type annotations at build time, so the deployed output is plain JavaScript.

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
