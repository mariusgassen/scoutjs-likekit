# `web` — ScoutKit Scout JS app

The browser front end, built with **Scout JS** (`@eclipse-scout/core`, TypeScript) and bundled by
`scout-scripts` (webpack). It is the JS half of a **Scout JS full-stack** setup: this app renders the
UI, the `services/scoutkit-server` (Eclipse Scout RT, Java) serves it and provides the REST backend
(`/api`). See the root [`CLAUDE.md`](../../CLAUDE.md) for the pinned Scout concepts this app follows.

## Outline-based UI

The desktop uses `DisplayStyle.DEFAULT` (navigation + bench). **Two outlines** are offered via
**outline view buttons** in the navigation: the **workspace** outline (conversations + contacts) and
a dedicated **global-search** outline. Selecting a row in any table page drills down to a leaf page
whose **detail form** is the chat (server-persisted messages + a docked LiveKit call) in the bench.

```
Desktop (DisplayStyle.DEFAULT)         outline view buttons: [Workspace] [Search]
├─ WorkspaceOutline                         navigation tree
│  ├─ ConversationTablePage  (PageWithTable)   table of DMs + meeting rooms
│  │    └─ ConversationPage   (leaf)            detailForm → ChatForm → ChatBox
│  │    └─ "New meeting" menu  → NewConversationForm (dialog)
│  └─ ContactTablePage       (PageWithTable)   table of contacts
│       └─ ConversationPage   (leaf)            opens/creates the DM, then ChatForm → ChatBox
└─ SearchOutline                            global search over one shared query
   ├─ title menu "Search…"   → SearchQueryForm (dialog; auto-opens when first activated)
   ├─ ConversationSearchPage (PageWithTable)   matching conversations → ConversationPage
   ├─ ContactSearchPage      (PageWithTable)   matching contacts      → ConversationPage
   └─ MessageSearchPage      (PageWithTable)   full-text message hits → ConversationPage
Desktop header menu "You: <name>" → NameForm (dialog)
```

| File | Role |
|------|------|
| `main/Desktop.ts` | Desktop in `DEFAULT` display style; creates both outlines + their `OutlineViewButton`s; auto-opens the search prompt on first switch; header menu to edit the display name. |
| `main/WorkspaceOutline.ts` | Workspace outline; creates the conversations + contacts table pages. |
| `main/SearchOutline.ts` | Global-search outline; holds one shared `query`, a title-bar "Search…" menu (`SearchQueryForm`), and reloads its result pages when the query changes. |
| `main/ConversationTablePage.ts` | `PageWithTable` listing conversations; `_loadTableData` → REST; `_createChildPage` → `ConversationPage`; "New meeting" menu. |
| `main/ContactTablePage.ts` | `PageWithTable` listing contacts; drilling down opens/creates the contact's DM. |
| `main/SearchResultPage.ts` | Abstract base for the search outline's result pages: table shell, reads the outline query (empty ⇒ no rows), `drillDownOnRowClick`, an AND-substring matcher. |
| `main/ConversationSearchPage.ts` / `main/ContactSearchPage.ts` | Result pages filtering conversations / contacts client-side against the query. |
| `main/MessageSearchPage.ts` | Result page running PostgreSQL full-text message search (FTS) server-side; drilling down opens the hit's conversation. |
| `main/ConversationPage.ts` | Leaf page (no children, no detail table); `_createDetailForm` → `ChatForm`. |
| `main/ChatForm.ts` | Detail form; resolves the conversation in `_load` and hosts the chat in a `WidgetField`. |
| `main/ChatBox.ts` | The chat surface widget: message stream, composer, docked `LiveKitMeeting`. |
| `main/NewConversationForm.ts` / `main/SearchQueryForm.ts` / `main/NameForm.ts` | Dialogs for creating a meeting room / entering a search query / editing the display name. |
| `data/MeetingApi.ts` | Typed REST client (`@scoutkit` backend); `meetingApi` singleton. |
| `data/UserIdentity.ts` | Shared anonymous identity + display name (localStorage); `userIdentity` singleton. |

## Commands

```bash
npm run dev        # scout-scripts watch build (apps/web/target/site)
npm run build      # production build + static site (scripts/generate-site.mjs)
```
