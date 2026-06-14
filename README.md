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

> **Use [`docker-compose.coolify.yml`](docker-compose.coolify.yml), not the root
> `docker-compose.yml`.** The root file is for local dev — it host-binds the web app on
> `:8080`, which collides with Coolify on the VPS (`Bind for 0.0.0.0:8080 failed: port is
> already allocated`) and runs LiveKit in `--dev`. The Coolify compose fronts `web` and
> `token-server` with Traefik (assign each a domain in the Coolify UI — no host ports) and
> publishes only LiveKit's media/TURN ports.

1. **LiveKit server** — built from [`infra/livekit/Dockerfile`](infra/livekit/Dockerfile),
   which **bakes** [`infra/livekit/livekit.yaml`](infra/livekit/livekit.yaml) into the
   image (Coolify mis-resolves relative bind-mount paths, which otherwise causes
   `read /etc/livekit/livekit.yaml: is a directory`). In Coolify **Ports Mappings** add
   `7882:7882/udp`, `7881:7881`, and `5349:5349` (TURN/TLS), and open those ports in the
   host firewall. Assign the `livekit` service a domain so Traefik proxies signaling
   (`7880`) → `wss://livekit.example.com`.
2. **Keys** — set **only** `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` (one shared pair).
   The token-server reads them directly; the LiveKit server needs them in `LIVEKIT_KEYS`
   (`"<key>: <secret>"`) form, which the compose derives for you from those two vars — so
   don't set `LIVEKIT_KEYS` yourself. Keep the token-server internal; the web app reaches
   it via `/api`.
3. **web** — set `LIVEKIT_URL=wss://livekit.example.com` (must be `wss://` from an HTTPS
   page) and assign it the app domain. `config.js` is regenerated from this env var on
   container start.

Generate strong, unique `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` for production.

### TURN/TLS for clients behind strict firewalls

Clients on networks that block UDP (`7882`) and the TCP fallback (`7881`) need LiveKit's
embedded **TURN over TLS**. It is **disabled by default** in
[`infra/livekit/livekit.yaml`](infra/livekit/livekit.yaml) because LiveKit crash-loops at
startup if TURN is enabled without a valid cert.

> **You may not need this.** With UDP `7882` and TCP `7881` open at the firewall, the large
> majority of clients connect fine. TURN/TLS only matters for locked-down corporate/mobile
> networks. Add it only if someone actually can't connect.

#### TURN/TLS with an automatic Traefik cert (recommended — no manual cert)

The trick: **don't give LiveKit a cert.** Coolify/Traefik stores certs in `acme.json`
(not PEM files LiveKit can read), so instead let Traefik **terminate** TLS with its
auto-issued, auto-renewed Let's Encrypt cert and forward *plaintext* to LiveKit
(`external_tls: true`). Put it on **443** — the whole point of TURN/TLS is reaching clients
whose firewall allows nothing but 443, so a dedicated `:5349` would often be blocked too.

```
client ──TLS(turns:443)──► Traefik :443 ──plaintext──► livekit TURN :5349
                           (Coolify auto LE cert,        (external_tls: true)
                            SNI = turn.example.com)
```

TURN is **part of the `livekit` service** — it's LiveKit's *embedded* TURN server (same
container, no separate service). You enable it by uncommenting config in two files; you do
**not** add its hostname as a Coolify UI domain (that would create a conflicting HTTP router).

1. **DNS** — point `turn.example.com` at the VPS public IP, and keep port `80` reachable so
   Let's Encrypt can validate via the HTTP-01 challenge.
2. **Traefik route** — uncomment the `traefik.tcp.*` labels on the `livekit` service in
   [`docker-compose.coolify.yml`](docker-compose.coolify.yml), setting your real hostname
   and Coolify's cert-resolver name (usually `letsencrypt`). The `tls.certresolver` on that
   TCP router is what makes Traefik **request and auto-renew** the cert — no UI domain and
   no PEM files.
3. **LiveKit** — uncomment the `turn:` block in `livekit.yaml` (`external_tls: true`,
   `tls_port: 443`) and set `domain`. No `cert_file`/`key_file`. `5349` stays internal
   (Traefik reaches it over the Docker network), so it is no longer host-published.
4. Redeploy.

If you'd rather keep the dedicated `:5349` you already opened in the firewall, it works the
same — set `tls_port: 5349`, route the labels to a `:5349` Traefik entrypoint instead of
`https`, and re-add the `5349:5349` host port. 443 just needs less proxy config and is more
firewall-friendly.

## Build & test commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspaces. |
| `npm run build` | Build library, token-server, and demo (+ static site). |
| `npm run build:lib` / `:token` / `:demo` | Build a single workspace. |
| `npm run dev:demo` | Scout watch build of the demo app. |
| `npm run dev:token` | Run the token-server with hot reload. |
