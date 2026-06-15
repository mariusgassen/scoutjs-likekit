# ScoutKit — Feature Roadmap

ScoutKit today is a **working proof-of-concept**: an Eclipse Scout JS full-stack app with
persistent chat (PostgreSQL/jOOQ/Flyway), full-text search, and LiveKit video meetings. What it
is *not* yet is a product — it has **anonymous access only**, **no real user accounts**, **no
theming/branding**, and a **capable-but-basic** video widget.

This roadmap charts the path from PoC → product across the five themes that drive it: **basics**
(auth, user options, admin, permissions), **theming & branding**, **LiveKit widget
functionality**, **advanced LiveKit platform features**, and **UX**. It is intentionally
opinionated — each item names the concrete Scout/LiveKit mechanism, the files to touch, and the
Flyway migration to add — so it can be handed straight to an implementer.

> Status: **planning artifact.** No code has changed yet. Phases are sequenced so each builds on
> the last; see [Sequencing & dependencies](#sequencing--dependencies) at the end.

## Legend

- **Effort:** 🟢 S (≤1 day) · 🟡 M (a few days) · 🔴 L (a week+ / multi-service)
- **Theme tags:** `[basics]` `[theme]` `[livekit]` `[research]` `[ux]`

## Guiding principles

- **Schema is owned by Flyway, never code.** Every persistence change is a new `V<n>__*.sql`
  migration in `services/scoutkit-server/src/main/resources/db/migration` — never edit an applied
  migration. jOOQ regenerates from `V1`-style portable DDL at build time; PostgreSQL-specific DDL
  is excluded from codegen and reached via jOOQ plain SQL (as `V2`'s FTS already is).
- **Authorization uses Scout's permission framework**, not ad-hoc checks. `AccessControlService`
  is already wired in (`execLoadPermissions` currently returns `null`) — fill it, don't replace it.
- **Keep custom surfaces theme-aware.** `ChatBox` / `LiveKitMeeting` use scoped CSS custom
  properties on purpose (`docs/scout-notes.md §6`); new theme work should map them to Scout LESS
  tokens rather than hardcoding more colors.
- **Scout JS is not React.** Build widgets with `scout.create(Type, {parent, ...})`; bridge native
  `fetch` promises into Scout's `JQuery.Promise` hooks with `$.Deferred()` / `$.resolvedPromise`.

---

## Phase 0 — Foundations & housekeeping

**Goal:** small cleanups that unblock the theming and identity work without changing behavior.

- 🟢 `[theme]` **Centralize the brand accent.** `#3b82f6` is duplicated as `--cb-accent` in
  `apps/web/src/main/ChatBox.less` and `--lk-accent` in `packages/livekit/src/LiveKitMeeting.less`.
  Hoist a single accent token (a shared LESS variable / `:root` custom property in
  `apps/web/src/index.less`) and have both surfaces reference it. Pure refactor, sets up Phase 5.
- 🟢 `[basics]` **Branding constants.** Replace the hardcoded `'ScoutKit'` strings in
  `apps/web/src/main/Desktop.ts` and `apps/web/res/index.html` with a single source (a constant
  module, or reuse `window.APP_CONFIG`). Makes a future rename one-line.
- 🟢 `[theme]` **Update `docs/scout-notes.md §6`** as theming decisions land (it already carries the
  forward note about mapping `--cb-*`/`--lk-*` to Scout tokens).

---

## Phase 1 — Identity & authentication `[basics]`

**Goal:** real, server-side users replace the anonymous/localStorage identity. This is the
keystone everything else (preferences, permissions, admin, presence) depends on.

- 🔴 **`user` table** — new `V4__users.sql`: `id`, `username` (unique), `display_name`, `email`,
  `password_hash`, `role`, `avatar_color`, `created_at`. Add a portable seed (or extend
  `V3__seed.sql`'s successor) mapping the existing demo `contact`s (Alice/Bob/Carol/Dave/Erin) to
  users so the directory keeps working. jOOQ will generate `User` accessors from the DDL at build.
- 🔴 **Replace anonymous auth.** `services/scoutkit-server/.../app/RestAuthFilter.java` currently
  installs Scout's `AnonymousAccessController`. Swap to credential-based auth — Scout RT's
  `FormBasedAccessController` + a `CredentialVerifier` backed by the `user` table (bcrypt/argon2
  hash check), establishing a real Scout session. Keep the `X-Requested-With` anti-CSRF filter and
  the servlet ordering in `MeetingServletContributors.java`.
- 🟡 **Login UI.** A Scout login form shown before the Desktop initializes (or rely on
  `FormBasedAccessController`'s login page). On success the SPA boots with an authenticated session.
- 🟡 **`GET /api/me`** returns the authenticated user. Rework `apps/web/src/data/UserIdentity.ts` to
  read identity from `/api/me` instead of generating a localStorage id + name. The `userIdentity`
  singleton stays as the app's identity facade so call sites don't change shape.
- 🟡 **Tie LiveKit tokens to the session.** `services/scoutkit-server/.../token/TokenResource.java`
  takes `identity`/`name` as query params today (spoofable). Derive them from the authenticated
  Scout session instead, so a token can only be minted for *yourself*.

---

## Phase 2 — User options & profile `[basics]` `[ux]`

**Goal:** users can manage their own account and preferences.

- 🟡 **`user_preferences` table** — new `V5__user_preferences.sql`: `user_id` (FK), `theme`
  (`light`/`dark`/`system`), `notifications` (jsonb or columns), `locale`, plus device defaults for
  later (`preferred_mic`, `preferred_camera`). One row per user.
- 🟡 **Profile/settings form.** Promote the ad-hoc `apps/web/src/main/NameForm.ts` dialog into a
  proper settings form: display name, avatar color, **theme toggle** (feeds Phase 5), password
  change, notification options. Open it from the Desktop header menu ("You: <name>").
- 🟢 **REST:** `GET/PUT /api/me` (profile) and `GET/PUT /api/me/preferences`. Persist via a jOOQ
  repository following the existing `ContactService`/`ConversationService` pattern.

---

## Phase 3 — Permissions & roles `[basics]`

**Goal:** authorization that actually restricts access, server- and client-side.

- 🟡 **Define permissions.** Concrete Scout `IPermission` classes, e.g.
  `ReadConversationPermission`, `WriteMessagePermission`, `ManageUsersPermission`,
  `ModerateMeetingPermission`. Roles (from `user.role`) map to permission sets.
- 🟡 **Load them.** Implement `execLoadPermissions(userId)` in
  `services/scoutkit-server/.../app/AccessControlService.java` (today it returns `null`) to return
  the user's permission collection.
- 🔴 **Enforce server-side.** Guard the REST resources — most importantly **conversation
  membership**: today anyone can read/post to any conversation. Add a `conversation_member` table
  (new `V6__conversation_members.sql`) and check membership in the conversation/message endpoints.
- 🟡 **Bind the UI.** Drive Scout widget `visible`/`enabled` from permissions (menus like "New
  meeting", admin entry points, moderation controls) instead of always-on.
- 🟡 **Role-aware LiveKit grants.** `LiveKitTokenService.java` grants identical
  `canPublish/canSubscribe` to everyone. Differentiate by role (e.g. presenter can publish, viewer
  is subscribe-only) based on the authenticated user + conversation role.

---

## Phase 4 — Admin outline `[basics]`

**Goal:** an admin surface for managing users, contacts, and rooms.

- 🟡 **Second outline.** Add an `AdminOutline` alongside `apps/web/src/main/WorkspaceOutline.ts`,
  switched via an outline view button, **gated by `ManageUsersPermission`** (Phase 3). Scout
  supports multiple outlines on a `DisplayStyle.DEFAULT` desktop.
- 🟡 **Admin pages.** `AdminUsersPage` (`PageWithTable` → CRUD users + roles via a detail form),
  `AdminContactsPage` (the `contact` table is read-only today — make it manageable), optionally an
  `AdminRoomsPage` for workspace/room administration.
- 🟡 **Admin REST endpoints** (`/api/admin/users`, …), each guarded by the matching permission.

---

## Phase 5 — Theming & branding `[theme]`

**Goal:** a modern, branded look with real light/dark support.

- 🟡 **Brand assets.** Add a logo + favicon to `apps/web/res/` (currently only `index.html` +
  `config.js`), wire the favicon/title in `index.html`, and brand the login screen (Phase 1).
- 🟡 **Modern theme.** Override Scout LESS variables (accent, surface colors, border radius,
  typography, spacing) in `apps/web/src/index.less` instead of inheriting bare defaults. The
  webpack `web-theme` entry already compiles LESS → CSS.
- 🔴 **Dark theme.** Add a Scout `displayTheme` and import core's `colors-dark.less`; crucially, map
  the custom surfaces' `--cb-*` / `--lk-*` properties (in `ChatBox.less` / `LiveKitMeeting.less`) to
  Scout theme tokens so chat and video follow the theme instead of hardcoding light values (this is
  exactly the forward note in `docs/scout-notes.md §6`).
- 🟢 **User-selectable theme.** Wire the Phase 2 preference (`user_preferences.theme`) to set the
  active `displayTheme` on the Desktop at boot; honor `system` via `prefers-color-scheme`.

---

## Phase 6 — LiveKit widget functionality `[livekit]`

**Goal:** bring the in-call experience up to Teams/Meet expectations. Builds on the existing
`packages/livekit` widget (`livekit-client ^2.19.2`), which already has the grid, self-view,
mic/cam toggle, screen share, data channel, and connect lifecycle.

- 🟡 **Active-speaker UI.** Subscribe to `RoomEvent.ActiveSpeakersChanged` in
  `LiveKitClientAdapter.ts` and highlight the speaking tile; add a **speaker view ↔ grid view**
  toggle and **pin/spotlight** a participant. (Client SDK, no backend.)
- 🟡 **Pre-join screen + device pickers.** A lobby step before connect: mic/camera/speaker
  selection with a self-preview, persisted to `user_preferences` device defaults (Phase 2).
- 🟢 **Connection-quality indicator** per tile via `RoomEvent.ConnectionQualityChanged`, plus
  per-tile mute/camera-off badges broadcast over participant metadata.
- 🟢 **Raise-hand & emoji reactions** over the existing reliable data channel (the widget already
  uses `publishData`); render transient overlays.
- 🟡 **In-call moderation** *(needs Phase 3 permissions)*: mute-all, remove participant, lock room.
  These are **server** operations — add backend room-admin endpoints that call LiveKit's
  `RoomServiceClient` (`mutePublishedTrack`, `removeParticipant`, `updateRoomMetadata`), guarded by
  `ModerateMeetingPermission`.

---

## Phase 7 — Advanced LiveKit platform features `[research]` `[livekit]`

**Goal:** adopt LiveKit's higher-order capabilities. Larger and partly optional; each is
independently shippable.

Research summary of what LiveKit offers beyond the raw client SDK:

| Capability | LiveKit mechanism | Where it runs | Notes |
|------------|-------------------|---------------|-------|
| Noise cancellation | `@livekit/krisp-noise-filter` track processor | Client | Krisp models; easiest win |
| Virtual background / blur | Track processors (background transformer) | Client | Per-user, opt-in |
| Recording | **Egress** (room-composite / track) | Server worker | Needs object storage (S3/MinIO) |
| Live captions / transcription / notetaker | **Agents** framework (STT → transcripts/summary) | Separate worker service | Biggest lift; new deployable |
| Ingress (external RTMP/WHIP in) | **Ingress** | Server | Future / niche |
| Telephony (dial-in/out) | **SIP** | Server | Future / niche |

- 🟡 **Noise cancellation** via `@livekit/krisp-noise-filter` applied to the local audio track;
  opt-in toggle persisted to preferences. **Virtual background / blur** via a video track
  processor. Both are client-side additions to the widget.
- 🔴 **Recording** via LiveKit **Egress** (room-composite): a backend orchestrator starts/stops
  egress for a conversation's room, writes the output to object storage (**decision needed: S3 vs
  self-hosted MinIO**), and persists a recording row (new `V<n>__recordings.sql`) surfaced as a
  "Recordings" list per conversation. Guard with permissions.
- 🔴 **Live captions / transcription / AI notetaker** via the LiveKit **Agents** framework: a
  separate worker (Python/Node) joins the room, runs STT, streams captions back over the data
  channel, and persists a transcript (new table) — optionally an LLM summary posted into the
  conversation as a message. This is a new deployable service in `docker-compose`/Coolify.
- ⚪ **SIP / Ingress** noted as future possibilities; out of near-term scope.

---

## Phase 8 — UX improvements `[ux]`

**Goal:** the cross-cutting polish that makes daily use pleasant. Several items can land earlier
once their dependency exists (presence needs Phase 1 sessions, notifications need Phase 2 prefs).

- 🟡 **Real presence.** Wire `contact.status` (online/away/offline) to actual sessions instead of
  the seeded static values; reflect it in the contact directory and conversation list.
- 🟡 **Message UX:** unread badges + read state, typing indicators, edit/delete, message reactions,
  and (stretch) threads. Builds on the existing persistent-message model/polling in `ChatBox.ts`.
- 🟡 **Notifications.** In-app + browser notifications tied to Phase 2 preferences; unread count in
  the desktop title.
- 🟢 **States & a11y:** better empty/loading/error states, keyboard shortcuts, a responsive/mobile
  layout pass, focus management + ARIA, and i18n via Scout texts (replace hardcoded strings).

---

## Sequencing & dependencies

```
Phase 0 (housekeeping)
   │
   ▼
Phase 1 Identity & Auth  ──► Phase 2 User options ──► Phase 5 Theming (user-selectable)
   │                              │
   ▼                              ▼
Phase 3 Permissions ──► Phase 4 Admin outline
   │
   ▼
Phase 6 Moderation (in-call) ── rest of Phase 6 (active-speaker, devices, reactions) is independent
Phase 7 Advanced LiveKit ── mostly independent (recording/agents are standalone services)
Phase 8 UX ── cross-cutting; presence needs Phase 1, notifications need Phase 2
```

- **Critical path:** Identity (1) → Preferences (2) → Permissions (3) → Admin/Moderation (4, 6).
- **Parallelizable:** Theming (5) after Phase 0; most LiveKit widget features (6) and advanced
  platform features (7); much of UX (8) once its small dependency lands.

## Out of scope / open questions

- **Recording storage backend** — managed S3 vs self-hosted MinIO (affects ops + cost).
- **LiveKit Cloud vs self-hosted** — Krisp noise cancellation and Agents are easiest on LiveKit
  Cloud; self-hosting (current setup) means running the Egress/Agents workers ourselves.
- **Auth model** — local password accounts (assumed here) vs SSO/OIDC (Keycloak/Google). SSO would
  reshape Phase 1's `CredentialVerifier`.
- **Migration of demo contacts → users** — keep the `contact` directory as a separate concept, or
  fold it into `user`? This roadmap assumes `user` is authoritative and `contact` becomes a view/
  managed list.
