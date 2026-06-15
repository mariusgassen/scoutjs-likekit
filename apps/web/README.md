# `web` — ScoutKit Scout JS app

The browser front end, built with **Scout JS** (`@eclipse-scout/core`, TypeScript) and bundled by
`scout-scripts` (webpack). It is the JS half of a **Scout JS full-stack** setup: this app renders the
UI, the `services/scoutkit-server` (Eclipse Scout RT, Java) serves it and provides the REST backend
(`/api`). See the root [`CLAUDE.md`](../../CLAUDE.md) for the pinned Scout concepts this app follows.

## Outline-based UI

The desktop uses `DisplayStyle.DEFAULT` (navigation + bench). A single **outline** in the navigation
holds three top-level **table pages**; selecting a row drills down to a leaf page whose **detail form**
is the chat (server-persisted messages + a docked LiveKit call) in the bench.

```
Desktop (DisplayStyle.DEFAULT)
└─ WorkspaceOutline                         navigation tree
   ├─ ConversationTablePage  (PageWithTable)   table of DMs + meeting rooms
   │    └─ ConversationPage   (leaf)            detailForm → ChatForm → ChatBox
   ├─ ContactTablePage       (PageWithTable)   table of contacts
   │    └─ ConversationPage   (leaf)            opens/creates the DM, then ChatForm → ChatBox
   ├─ SearchTablePage        (PageWithTable)   full-text message search results
   │    └─ ConversationPage   (leaf)            drills into the hit's conversation
   │    └─ "Search…" menu     → SearchQueryForm (dialog)
   └─ "New meeting" menu      → NewConversationForm (dialog)
Desktop header menu "You: <name>" → NameForm (dialog)
```

| File | Role |
|------|------|
| `main/Desktop.ts` | Desktop in `DEFAULT` display style; sets the outline; header menu to edit the display name. |
| `main/WorkspaceOutline.ts` | The outline; creates the three top-level table pages. |
| `main/ConversationTablePage.ts` | `PageWithTable` listing conversations; `_loadTableData` → REST; `_createChildPage` → `ConversationPage`; "New meeting" menu. |
| `main/ContactTablePage.ts` | `PageWithTable` listing contacts; drilling down opens/creates the contact's DM. |
| `main/SearchTablePage.ts` | `PageWithTable` of full-text search hits (PostgreSQL FTS); "Search…" menu opens `SearchQueryForm`; drilling down opens the hit's conversation. |
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
