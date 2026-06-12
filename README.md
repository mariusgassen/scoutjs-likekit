# scoutjs-likekit

Reusable **BSI / Eclipse Scout JS** component for **starting and joining LiveKit
video meetings**, plus a runnable PoC stack deployable with **docker-compose** and
**Coolify**.

Because Scout JS is *not* React, this uses the vanilla [`livekit-client`](https://github.com/livekit/client-sdk-js)
SDK bridged into a custom Scout `Widget` — see [`packages/scout-livekit`](packages/scout-livekit).

## Architecture

```
Browser — Scout JS demo app (apps/demo)
  └─ LiveKitMeeting widget (@bsi/scout-livekit)
       ├─ GET /api/token ─────────────►  token-server (services/token-server, livekit-server-sdk)
       └─ wss signaling + UDP media ──►  livekit-server (self-hosted)
```

## Monorepo layout (npm workspaces)

| Path | What |
|------|------|
| `packages/scout-livekit` | Reusable `@bsi/scout-livekit` Scout widget (`LiveKitMeeting`). Built with `tsc` to ESM. |
| `apps/demo` | Scout JS app that hosts the widget behind a start/join form. Built with `scout-scripts`. |
| `services/token-server` | Express + `livekit-server-sdk` service that mints LiveKit JWTs. |
| `infra/livekit/livekit.yaml` | Production LiveKit server config (ports + external IP). |
| `docker-compose.yml` | Full PoC stack: `livekit` + `token-server` + `web`. |

## Features

Start a meeting, join an existing meeting, multi-participant video/audio grid,
mic & camera toggle, screen sharing, and a data-channel text chat.

## Requirements

- **Node.js ≥ 24.12** (required by Eclipse Scout 26.x) and npm.
- Docker + Docker Compose for the containerised PoC.

## Quick start (local, docker-compose)

```bash
cp .env.example .env          # defaults match LiveKit's --dev key pair
docker compose up --build     # livekit :7880/:7881/:7882udp, token-server, web :8080
```

Open <http://localhost:8080> in **two browser tabs**:

1. Tab 1 — room `demo`, name `Alice` → **Start / Join**
2. Tab 2 — room `demo`, name `Bob` → **Start / Join**

You should see both video tiles in each tab; try the mic/camera toggles, screen
share, chat, and Leave.

> **Local WebRTC note:** browser media over UDP through Docker can be finicky on
> Mac/Windows because of NAT. The compose file runs LiveKit with `--dev` (tuned for
> localhost). On Linux, if remote video stays black, the most reliable local fix is
> host networking for the `livekit` service. The intended production target is a real
> host / Coolify with a public IP (below).

## Local development (without Docker)

```bash
npm install
npm run build:lib                 # compile @bsi/scout-livekit

# terminal 1 — LiveKit (requires the livekit-server binary or its Docker image)
livekit-server --dev

# terminal 2 — token-server
LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret npm run dev:token

# terminal 3 — Scout demo app (watch build); serve target/dist with any static server
npm run dev:demo
```

`npm run dev:lib` rebuilds the library on change.

## Using the component in your own Scout app

```ts
import {LiveKitMeeting} from '@bsi/scout-livekit';

const meeting = scout.create(LiveKitMeeting, {
  parent: this,
  serverUrl: 'wss://livekit.example.com',
  tokenUrl: '/api/token',          // returns { token }
  room: 'demo',
  identity: 'alice-1234',          // unique per participant
  displayName: 'Alice',
  autoConnect: true
});
```

`@eclipse-scout/core` is a **peer dependency** — only the host app provides Scout core
(a second copy would break the object registry). See
[`packages/scout-livekit/README.md`](packages/scout-livekit/README.md).

## Production / Coolify deployment

Web app and token-server sit behind Coolify's **Traefik** proxy (HTTPS via Let's Encrypt).
WebRTC media (UDP) **cannot** go through Traefik.

1. **LiveKit server** — deploy as its own Coolify resource. Use the production config:
   start with `--config /etc/livekit/livekit.yaml` (mount [`infra/livekit/livekit.yaml`](infra/livekit/livekit.yaml))
   and set `LIVEKIT_KEYS="<your-key>: <your-secret>"`. In Coolify **Ports Mappings** add
   `7882:7882/udp` (and `7881:7881`), and open those ports in the host firewall.
   Expose signaling (`7880`) via Traefik on a subdomain → `wss://livekit.example.com`.
2. **token-server** — set `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (matching the LiveKit
   keys). Keep it internal; the web app reaches it via `/api`.
3. **web** — set `LIVEKIT_URL=wss://livekit.example.com` (must be `wss://` from an HTTPS
   page). `config.js` is regenerated from this env var on container start.

Generate strong, unique `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` for production and drop
`--dev`. For clients behind strict firewalls, enabling LiveKit's embedded TURN (TURN/TLS
over 443) is the production hardening step.

## Build & test commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspaces. |
| `npm run build` | Build library, token-server, and demo (+ static site). |
| `npm run build:lib` / `:token` / `:demo` | Build a single workspace. |
| `npm run dev:demo` | Scout watch build of the demo app. |
| `npm run dev:token` | Run the token-server with hot reload. |
