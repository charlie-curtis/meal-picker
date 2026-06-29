# Contributing

Just Pick Food is built for [justpickfood.com](https://justpickfood.com). This repo is public so people can inspect the code, suggest improvements, and open pull requests against the live site.

## Ways to Contribute

- Open an issue for bugs, confusing UX, accessibility problems, or small improvement ideas.
- Open a pull request for focused fixes or improvements.
- Keep PRs scoped and explain the user-facing reason for the change.
- Include screenshots for visual changes.

## Local Development

Use local setup when you want to test a change before opening a PR.

```bash
git clone https://github.com/charlie-curtis/pick-for-us.git
cd pick-for-us
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). To test collaboration locally, copy the URL with `?room=<id>` and open it in another browser tab.

## Frontend Commands

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server with hot reload |
| `npm run build` | Compile a production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |

## Nearby Search

Most UI changes do not need a local Worker. Nearby restaurant search depends on the production Cloudflare Worker and Google API configuration, so it may not work in a fresh clone unless you provide `VITE_WORKER_URL` in `.env.local`.

If you are specifically contributing to nearby search or Worker behavior, see the Worker proxy notes in [architecture.md](architecture.md#worker-proxy).

## Pull Request Checklist

- Run `npm run build`.
- Keep unrelated formatting or dependency changes out of the PR.
- Mention any manual testing you performed.
- For UI changes, include before/after screenshots when possible.
