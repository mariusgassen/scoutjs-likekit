# CLAUDE.md — ScoutKit

Guidance for working in this repo. ScoutKit is a Teams/Slack-like meeting tool built on
**Eclipse Scout** (see [`README.md`](README.md) for the product/architecture overview).

This file **pins** the two Scout references the UI is built on and summarizes their basic concepts,
so they don't have to be re-fetched each session (the docs site blocks automated fetching).

## 📌 Pinned references

| Topic | Doc (Eclipse Scout 26.1) |
|-------|--------------------------|
| **Hello Scout JS Full Stack** (project layout / architecture) | https://eclipsescout.github.io/scout-docs/26.1/getstarted/helloscout-js-fullstack.html |
| **Outline** (navigation, pages) | https://eclipsescout.github.io/scout-docs/26.1/technical-guide/user-interface/outline.html |

Related concept pages (same technical guide): `.../user-interface/desktop.html`,
`.../user-interface/page.html`, `.../user-interface/form.html`, `.../user-interface/table.html`.

> 📒 **Layout & widget best practices live in [`docs/scout-notes.md`](docs/scout-notes.md)** — a
> repo-specific Scout 26.1 reference (widget lifecycle/`HtmlComponent`, `LogicalGridLayout` &
> `GridData`, forms, tables, outlines, theming) grounded in the installed `@eclipse-scout/core` source
> (the docs site blocks automated fetching). Read it before touching layout. Update it when you learn
> something new.

---

## Basic concept 1 — Scout JS Full Stack

A Scout **full-stack** application has two halves that are developed and deployed together:

- **Scout JS front end** — the UI runs in the browser, written in **TypeScript** against
  `@eclipse-scout/core`. It is *not* React: you build a tree of Scout **widgets** (desktop,
  outline, forms, fields, tables, …). Bundled with `scout-scripts` (webpack) + LESS theme.
- **Scout RT back end** — an **Eclipse Scout RT (Java)** server (embedded Jetty). It serves the
  built JS app as static files **and** exposes the data services. The browser is not on the
  internal network, so this one server is the public entry point.

The front end talks to the back end over **REST** (JSON). Unsafe methods send an
`X-Requested-With` header (Scout's anti-CSRF filter requires it).

> Note: the official *getstarted* guide scaffolds a fresh full-stack project via the Scout Maven
> archetype/IDE plugin (jOOQ + a local Derby dev database). **This repo is already a working
> full-stack app** and does not use that scaffolding — do not re-scaffold. It does, however, use
> **jOOQ** for data access against a real **PostgreSQL** database (schema owned by **Flyway**; see
> the persistence note below). The mapping here:

| Full-stack layer | In this repo |
|------------------|--------------|
| Scout JS UI | [`apps/web`](apps/web) (TypeScript, `scout-scripts`) — see [`apps/web/README.md`](apps/web/README.md) |
| Reusable Scout JS widget | [`packages/livekit`](packages/livekit) (`@scoutkit/livekit`, `LiveKitMeeting`) |
| Scout RT Java server (serves UI + REST + persistence) | [`services/scoutkit-server`](services/scoutkit-server) (Maven, embedded Jetty; PostgreSQL via jOOQ + Flyway) |
| REST data services | `services/scoutkit-server` → `/api/*`; typed client in `apps/web/src/data/MeetingApi.ts` |

Build/run (see root `README.md` for the full table): `npm run dev:server` (Java backend),
`npm run dev:web` (UI watch build), `npm run build` (lib + web), `npm run build:server` (Maven).

## Basic concept 2 — Outlines

> An **outline** is a special variant of a **tree**, shown in the **navigation** area of the
> desktop. Its tree nodes are **pages**.

- **Desktop display style** — outlines require `Desktop.DisplayStyle.DEFAULT` (navigation + bench).
  `BENCH` hides the navigation (no outline). Set the active outline with `desktop.setOutline(...)`
  or the `outline` model property; multiple outlines are switched via outline view buttons.
- **Page** — a tree node that can carry a **detail form** (shown in the bench) and/or a
  **detail table**. Two concrete kinds in Scout JS:
  - **`PageWithTable`** — its detail table lists rows loaded from a data source. Override
    `_createDetailTable()` (build the `Table` + columns), `_loadTableData(searchFilter)`
    (return a **`JQuery.Promise`** of raw data), `_transformTableDataToTableRows(data)` (map raw
    data → row models, cells aligned to column order), and `_createChildPage(row)` (return the
    child `Page` to drill into). Set `drillDownOnRowClick = true` to navigate on single click.
  - **`PageWithNodes`** — static child pages (or a **leaf**, with `leaf = true` and
    `detailTableVisible = false`). Override `_createDetailForm()` to show a form when selected.
- **Detail form** — override `_createDetailForm()` on the page; the form is opened (its `_load`
  runs) when the page is activated and fills the bench.
- **Bridging promises** — Scout page/form hooks expect a `JQuery.Promise`. The REST client here
  uses native `fetch`/`Promise`, so bridge with `$.Deferred()` (resolve from the native promise) or
  `$.resolvedPromise(...)` / `$.rejectedPromise(...)`.

How this repo applies outlines (full map in [`apps/web/README.md`](apps/web/README.md)):

```
Desktop (DEFAULT) — two outlines, switched via OutlineViewButtons
  ├─ WorkspaceOutline
  │    ├─ ConversationTablePage (PageWithTable) → ConversationPage (leaf) → ChatForm → ChatBox
  │    └─ ContactTablePage      (PageWithTable) → ConversationPage (leaf, lazily creates the DM)
  └─ SearchOutline — global search over one shared query (SearchResultPage subclasses)
       ├─ ConversationSearchPage (PageWithTable) → ConversationPage
       ├─ ContactSearchPage      (PageWithTable) → ConversationPage
       └─ MessageSearchPage      (PageWithTable, PostgreSQL FTS) → ConversationPage
```

---

## Conventions & gotchas

- **Scout JS is not React.** Build widgets with `scout.create(Type, {parent, ...})`; reference
  classes directly as `objectType` in models. Lifecycle: `_init` → `_render`/`_remove`.
- **Model-injected properties** (set from the model in `_init`) use the definite-assignment
  modifier, e.g. `conversation!: Conversation;` (TS strict mode). Match the surrounding style.
- **Form fields** are looked up by id: `this.widget('name', StringField)`. Dialogs use
  `Button.SystemType.OK` / `.CANCEL`; do creation/saving work in the form's `_save()`.
- **Node engine warning is expected.** Scout 26.1 declares `engines.node >= 24.12`; the build runs
  fine on Node 22 (install/typecheck/build all pass). Don't "fix" this by downgrading deps.
- `@eclipse-scout/core` is a **peer dependency** of `packages/livekit` — the host app provides the
  single Scout core copy (a second copy breaks the object registry).

## Translations (i18n)

This is a **JS-only app served as static files** (no Scout RT host server that would normally
generate the text resources), so translations are wired up by hand:

- **Bootstrap loads them.** `apps/web/src/index.ts` calls `App.init({bootstrap: {textsUrl:
  ['texts.json', 'texts-app.json'], localesUrl: 'locales.json'}})`. **Without `textsUrl`/`localesUrl`
  every Scout core text renders as `[undefined text: <key>]`** — that was the original "missing
  translations" bug.
- **`texts.json` + `locales.json` are Scout core's** (UI texts + locale metadata, both incl. German).
  They are *not* in the repo: `apps/web/webpack.config.js` copies them out of `@eclipse-scout/core`'s
  `dist/` into the `res` output (which `scripts/generate-site.mjs` then places at the site root). Core
  only exports its `import` entry + `./src/*`, so the path is resolved via
  `require.resolve('@eclipse-scout/core/src/index.ts')` → sibling `dist/`.
- **`apps/web/res/texts-app.json` holds the app's own strings** under `scoutkit.*` keys, with a
  `default` (English) and a `de` (German) map (keep the two in sync). Scout merges it on top of the
  core texts (later URL wins). The session locale is auto-detected from the browser
  (`locales.getNavigatorLocale()`), so a German browser shows German with fallback to `default`.
- **In models**, localize via the placeholder `'${textKey:Key}'` — Scout auto-resolves the standard
  text properties (`Form.title`, `FormField`/`Button` `label`, `Column.text`, `Menu`/`Action.text`,
  `TreeNode`/`Page.text`, `Outline.title`). Reuse core keys where they fit (e.g. `${textKey:Cancel}`,
  `${textKey:Search}`, `${textKey:Name}`, `${textKey:Status}`).
- **Imperative/dynamic strings** (jQuery `.text(...)`, `placeholder` attrs, args) use
  `this.session.text('scoutkit.Key', ...args)` (`{0}`-style placeholders). Note `_jsonModel()` runs
  **before** `session` is set, so resolve dynamic texts in `_init`/runtime, not in the model.
- **`packages/livekit` is reusable**, so it must not hard-depend on host text keys: it uses
  `this.session.optText('scoutkit.livekit.<key>', '<English default>', ...)` via the `_text()` helper —
  the host's `texts-app.json` supplies the German, and the baked-in English default keeps the widget
  usable standalone.

## Persistence (PostgreSQL + jOOQ + Flyway)

- **Schema is owned by Flyway**, not code. Migrations live in
  `services/scoutkit-server/src/main/resources/db/migration` (`V1__schema.sql`,
  `V2__message_fulltext_search.sql`, `V3__seed.sql`) and run on platform startup
  (`SchemaInitializer` → `Database#migrate`). To change the schema, add a new `V<n>__*.sql` — never
  edit an applied migration.
- **jOOQ classes are generated at build time from `V1__schema.sql`** via jOOQ's `DDLDatabase` (no
  live DB needed to build). The `jooq-codegen-maven` plugin (`generate-sources` phase) emits
  `org.scoutkit.meeting.jooq.*` under `target/generated-sources/jooq`. Keep `V1` portable, standard
  DDL so the parser is happy; PostgreSQL-specific DDL (the FTS `tsvector`/GIN in `V2`) is **excluded
  from codegen** and referenced via jOOQ plain SQL in `ConversationService#search`.
- **Services use `BEANS.get(Database.class).db()`** (a shared `DSLContext`, dialect POSTGRES,
  `renderSchema(false)`) over a HikariCP pool. Repositories are jOOQ, not raw JDBC.
- **Verify the backend** with `mvn -f services/scoutkit-server/pom.xml -DskipTests package` (runs
  codegen + compile). For a runtime check, point it at a local PostgreSQL (see root `README.md`).

## Verify a UI change

```bash
npm run build:lib                 # compile @scoutkit/livekit (apps/web depends on its types)
npx tsc -p apps/web/tsconfig.json # typecheck the app
npm run build:web                 # full webpack prod build + static site
```

> ⏱️ **Don't run the full prod build (`npm run build` / `build:web`) on every change.** The GitHub
> Actions workflows already build lib + web (and the server) on push/PR, so any failure surfaces
> there anyway. For local iteration prefer the fast checks — `npm run build:lib` (when `livekit`
> types changed) and `npx tsc -p apps/web/tsconfig.json` (typecheck) — and reserve the full
> `build:web` for when you specifically need to verify the bundled/static-site output.
