# ScoutKit

A **Teams/Slack-like meeting tool** built on **Eclipse Scout**: a contact directory,
**persistent chat** (DMs + group/meeting rooms) that outlives calls, and **LiveKit**
video meetings — backed by a real **Eclipse Scout RT Java server** with database
persistence. Deployable with **docker-compose** and **Coolify**.

The reusable video widget ([`packages/livekit`](packages/livekit)) bridges the
vanilla [`livekit-client`](https://github.com/livekit/client-sdk-js) SDK into a custom Scout
`Widget` (Scout JS is *not* React).

## Architecture

The Scout `scoutkit-server` is a single HTTP service that serves **both** the web app (`/`) and
the REST API (`/api/*`) — no separate nginx. The browser isn't on the docker network, so this
one container is the public entry point; only LiveKit's media ports sit beside it.

```
Browser ── http ──►  scoutkit-server (Eclipse Scout RT, Java; embedded Jetty)
  Scout JS app          ├─ /            static web app (apps/web, built)
  contacts ·            ├─ /api/*       token · contacts · conversations · messages · search
  conversations ·       │                 ├─ LiveKit JWTs (HS256, java-jwt)
  persistent chat       │                 └─ PostgreSQL via jOOQ (Flyway schema; FTS search)
  search                └─ LiveKitMeeting widget (@scoutkit/livekit)
        └─ wss signaling + UDP media ─►  livekit-server (self-hosted)
```

Chat history lives in the database, independent of any call, so it persists across reloads
and outlives the call — including multi-person meetings. A conversation id doubles as the
LiveKit room name.

### Persistence — PostgreSQL + jOOQ + Flyway

The real database is **PostgreSQL**. The backend talks to it with **jOOQ** (type-safe SQL over a
**HikariCP** pool), and **Flyway** owns the schema (migrations in
[`services/scoutkit-server/src/main/resources/db/migration`](services/scoutkit-server/src/main/resources/db/migration)).
jOOQ's classes are generated **at build time from the Flyway migration DDL** (jOOQ `DDLDatabase`),
so the build needs no running database.

**Full-text message search** is the headline database feature: a PostgreSQL `tsvector` column
(stored + GIN-indexed) is queried with `websearch_to_tsquery` / `ts_rank` / `ts_headline`, exposed
at `GET /api/search?q=` and surfaced as a **Search** page in the UI (with highlighted snippets).

## Monorepo layout

| Path | What |
|------|------|
| `packages/livekit` | Reusable `@scoutkit/livekit` Scout JS widget (`LiveKitMeeting`). Built with `tsc` to ESM. |
| `apps/web` | Scout JS workspace app: an outline-based desktop (navigation + bench) with Conversations and Contacts table pages whose detail form is the chat (persistent messages + docked LiveKit call). Built with `scout-scripts`; the `scoutkit-server` serves the result. See [`apps/web/README.md`](apps/web/README.md) for the outline structure. |
| `services/scoutkit-server` | **Eclipse Scout RT 26.1 Java backend** (embedded Jetty). Serves the built web app at `/` and the REST API at `/api` (Jersey), mints LiveKit tokens, and persists contacts/conversations/messages in **PostgreSQL** via **jOOQ** (schema migrated by **Flyway**). Built with Maven. |
| `infra/livekit/livekit.yaml` | Production LiveKit server config (ports + external IP). |
| `docker-compose.yml` | Full stack: `livekit` + `scoutkit-server` (web app + API). |

### REST API (`scoutkit-server`, served at `/api`)

Anonymous access; unsafe methods require an `X-Requested-With` header (Scout anti-CSRF).

| Endpoint | Purpose |
|----------|---------|
| `GET /api/token?room&identity&name` | Mint a LiveKit join token (JWT). |
| `GET /api/contacts` | Workspace contact directory. |
| `GET` / `POST /api/conversations` | List / create DMs and group/meeting chats. |
| `GET` / `POST /api/conversations/{id}/messages` | Persistent chat history (`?after=<ts>` to poll). |
| `GET /api/search?q=&limit=` | Full-text message search (PostgreSQL FTS; ranked, highlighted). |

## Features

Contact directory, direct messages and group/meeting rooms, server-persisted chat that
survives reloads and outlives calls, **full-text message search** across all conversations
(PostgreSQL FTS with highlighted snippets), multi-participant video/audio grid with a floating
self-view, mic/camera toggle, screen sharing, and shareable invite links (`?c=<conversation>`).

## Requirements

- **Node.js ≥ 24.12** (required by Eclipse Scout 26.x) and npm — for the web app.
- **JDK 21** and **Maven** — for the `scoutkit-server` backend.
- **PostgreSQL** (the runtime database; the build itself needs none — jOOQ generates from the
  Flyway DDL). Easiest via Docker, or use the `postgres` service in docker-compose.
- Docker + Docker Compose for the containerised stack.

## Quick start (local, docker-compose)

```bash
cp .env.example .env          # defaults match LiveKit's --dev key pair
docker compose up --build     # postgres, livekit :7880/:7881/:7882udp, scoutkit-server :8080
```

Open <http://localhost:8080> in **two browser tabs**:

1. Set your name in the left rail (e.g. `Alice` / `Bob`).
2. Both tabs open the **General** conversation — type messages and watch them sync; the
   history persists (it's stored in the backend PostgreSQL database), even after a reload.
   Open the **Search** page in the navigation to full-text search across all conversations.
3. Click **Start call** to bring up the LiveKit video meeting docked above the chat; the
   chat keeps working during and after the call.

Try the contact directory (click a person to open a DM), **+ New** to create a group
meeting, and the mic/camera/screen-share/Leave controls in the call.

> **Local WebRTC note:** browser media over UDP through Docker can be finicky on
> Mac/Windows because of NAT. The compose file runs LiveKit with `--dev` (tuned for
> localhost). On Linux, if remote video stays black, the most reliable local fix is
> host networking for the `livekit` service. The intended production target is a real
> host / Coolify with a public IP (below).

## Local development (without Docker)

```bash
npm install
npm run build:lib                 # compile @scoutkit/livekit

# terminal 1 — PostgreSQL (the real database; Flyway migrates it on first server start)
docker run --rm -p 5432:5432 \
  -e POSTGRES_USER=scoutkit -e POSTGRES_PASSWORD=scoutkit -e POSTGRES_DB=scoutkit \
  postgres:16-alpine

# terminal 2 — LiveKit (requires the livekit-server binary or its Docker image)
livekit-server --dev

# terminal 3 — Scout Java backend (embedded Jetty on :8080, connects to PostgreSQL above)
npm run dev:server                # = mvn -f services/scoutkit-server/pom.xml exec:java

# terminal 4 — Scout web app, watch build (rebuilds apps/web/target/site on change)
npm run dev:web
```

Two ways to view the UI:

- **All-in-one** — build the web app (`npm run build:web`) and have the Scout server also
  serve it by pointing `meeting.web.root` at the built site, then open <http://localhost:8080>:
  ```bash
  mvn -f services/scoutkit-server/pom.xml exec:java -Dmeeting.web.root=apps/web/target/site
  ```
- **Separate dev server** — serve `apps/web/target/site` with any static server. It calls the
  backend at `/api` (same-origin); when the dev server is on a different origin than `:8080`,
  point it at the backend with `window.APP_CONFIG.apiBase` (the `scoutkit-server` enables
  permissive CORS for this).

`npm run dev:lib` rebuilds the library on change.

## Using the component in your own Scout app

```ts
import {LiveKitMeeting} from '@scoutkit/livekit';

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
[`packages/livekit/README.md`](packages/livekit/README.md).

## Production / Coolify deployment

The `scoutkit-server` (web app + API) and LiveKit signaling sit behind Coolify's **Traefik**
proxy (HTTPS via Let's Encrypt). WebRTC media (UDP) **cannot** go through Traefik.

> **Use [`docker-compose.coolify.yml`](docker-compose.coolify.yml), not the root
> `docker-compose.yml`.** The root file is for local dev — it host-binds `scoutkit-server` on
> `:8080`, which collides with Coolify on the VPS (`Bind for 0.0.0.0:8080 failed: port is
> already allocated`) and runs LiveKit in `--dev`. The Coolify compose fronts `scoutkit-server`
> with Traefik (assign it the app domain in the Coolify UI — no host ports) and publishes only
> LiveKit's media/TURN ports. PostgreSQL runs as an internal `postgres` service whose data lives
> on the `scoutkit-db` volume, so chat history survives redeploys (set `POSTGRES_PASSWORD`).

1. **LiveKit server** — built from [`infra/livekit/Dockerfile`](infra/livekit/Dockerfile),
   which **bakes** [`infra/livekit/livekit.yaml`](infra/livekit/livekit.yaml) into the
   image (Coolify mis-resolves relative bind-mount paths, which otherwise causes
   `read /etc/livekit/livekit.yaml: is a directory`). In Coolify **Ports Mappings** add
   `7882:7882/udp`, `7881:7881`, and `5349:5349` (TURN/TLS), and open those ports in the
   host firewall. Assign the `livekit` service a domain so Traefik proxies signaling
   (`7880`) → `wss://livekit.example.com`.
2. **Keys** — set **only** `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` (one shared pair).
   The scoutkit-server reads them directly (to mint tokens); the LiveKit server needs them in
   `LIVEKIT_KEYS` (`"<key>: <secret>"`) form, which the compose derives for you from those two
   vars — so don't set `LIVEKIT_KEYS` yourself.
3. **scoutkit-server** — set `LIVEKIT_URL=wss://livekit.example.com` (must be `wss://` from an
   HTTPS page) and assign it the app domain. The browser `config.js` is regenerated from this
   env var on container start.

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

1. **DNS** — point `turn.example.com` at the VPS public IP.
2. **Cert (automatic)** — in Coolify, add `turn.example.com` as a **domain** on the
   `livekit` service. Coolify issues and renews the Let's Encrypt cert for it; there is
   nothing to mount or rotate by hand.
3. **Traefik route** — uncomment the `traefik.tcp.*` labels on the `livekit` service in
   [`docker-compose.coolify.yml`](docker-compose.coolify.yml), setting your real hostname
   and Coolify's cert-resolver name (usually `letsencrypt`).
4. **LiveKit** — uncomment the `turn:` block in `livekit.yaml` (`external_tls: true`,
   `tls_port: 443`) and set `domain`. No `cert_file`/`key_file`. `5349` stays internal
   (Traefik reaches it over the Docker network), so it is no longer host-published.
5. Redeploy.

If you'd rather keep the dedicated `:5349` you already opened in the firewall, it works the
same — set `tls_port: 5349`, route the labels to a `:5349` Traefik entrypoint instead of
`https`, and re-add the `5349:5349` host port. 443 just needs less proxy config and is more
firewall-friendly.

## Build & test commands

| Command | Description |
|---------|-------------|
| `npm install` | Install the JS workspaces. |
| `npm run build` | Build the library and the demo web app (+ static site). |
| `npm run build:lib` / `:demo` | Build a single JS workspace. |
| `npm run dev:web` | Scout watch build of the web app. |
| `npm run build:server` | Build the Scout Java backend (`mvn … package`). |
| `npm run dev:server` | Run the Scout Java backend (embedded Jetty; connects to PostgreSQL). |
