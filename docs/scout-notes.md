# Scout JS notes & best practices (Eclipse Scout 26.1)

Findings collected for future coding sessions so the Scout references don't have to be
re-derived each time. The official docs site
(<https://eclipsescout.github.io/scout-docs/26.1/>) **blocks automated fetching (HTTP 403)**, and
the AsciiDoc sources in `eclipse-scout/scout.docs` need GitHub auth to browse. The most reliable,
version-exact source is therefore the **installed package**:

```
node_modules/@eclipse-scout/core/src/**        # TypeScript + JSDoc, this is the ground truth for 26.1
```

Everything below was verified against that source (core `^26.1.16`). See also the two pinned doc
pages and the concept summaries in [`../CLAUDE.md`](../CLAUDE.md).

---

## 1. Widget lifecycle & rendering

Scout JS is **not React**. A UI is a tree of `Widget`s created with `scout.create(Type, {parent, …})`;
classes are referenced directly as `objectType` in models.

- **`_init(model)`** — set up state/children from the model. Model-injected props use the
  definite-assignment modifier (`conversation!: Conversation;`).
- **`_render()`** — build DOM into `this.$parent`, assign `this.$container`, and (for any widget that
  participates in layout) install an `HtmlComponent`:
  ```ts
  this.$container = this.$parent.appendDiv('my-widget');
  this.htmlComp = HtmlComponent.install(this.$container, this.session);
  ```
  `HtmlComponent.install(...)` is the **only** supported way to attach one (never `new HtmlComponent`).
- **`_remove()`** — release non-Scout resources (timers, media, listeners) **before** `super._remove()`.
- **Property pattern** — `setXyz(v)` → `setProperty('xyz', v)` → `_renderXyz()` re-renders just that
  property when the widget is rendered. Don't rebuild the whole DOM on every change.

### HtmlComponent & sizing (verified in `layout/HtmlComponent.ts`)

- A freshly installed `HtmlComponent` has **`layout = new NullLayout()`** (it does *not* size its
  children) and **`pixelBasedSizing = true`**.
- `pixelBasedSizing = true`: the **parent** layout sets this component's size in pixels
  (e.g. a `WidgetField`'s `SingleLayout` stretches its field widget to the available size). The widget
  then lays its own children out with CSS. This is the right setup for a CSS-flex/grid custom widget
  that is embedded in a Scout container that gives it a size.
- `pixelBasedSizing = false`: set this **only** when the component sizes itself and Scout must read its
  preferred size instead of imposing one.
- `prefSize()` throws *"Called prefSize() but component has no layout"* — so if you need a preferred
  size you must `setLayout(...)`; a pure CSS widget that is sized by its parent never needs one.
- Layout invalidation: `invalidateLayoutTree()` → mark dirty, `validateLayoutTree()` → relayout,
  `revalidateLayoutTree()` does both. Only needed when you change layout-affecting DOM **and** rely on a
  Scout layout (not needed for NullLayout + CSS).

---

## 2. Layout — LogicalGridLayout & GridData

Form fields inside a group box are arranged by the **`LogicalGridLayout`** into an invisible grid of
rows/columns; you never build the grid manually. You only steer it per field via **`gridDataHints`**
(a partial `GridData`); the effective `GridData` (`field.gridData`) is then computed from the hints +
field order + the box's `gridColumnCount`.

`GridData` fields (verified in `layout/logicalgrid/GridDataModel.ts`):

| Hint | Default | Meaning |
|------|---------|---------|
| `x`, `y` | `-1` | Cell position. `-1` = let the grid compute it (**preferred**). |
| `w` | `1` | Logical column span (also min width). `FormField.FULL_WIDTH` spans all columns. |
| `h` | `1` | Logical row span (also min height). |
| `weightX` | `-1` | Horizontal grow/shrink. `0` = fixed; `>0` = grabs excess space; `-1` = auto. |
| `weightY` | `-1` | Vertical grow/shrink. `-1` auto-resolves to `0` when `h===1` (so a 1-row field doesn't grow unless you give it `weightY>0`). |
| `fillHorizontal` | `true` | Field fills the cell width. If `false`, width comes from `useUiWidth`/`widthInPixel`. |
| `fillVertical` | `true` | Field fills the cell height. If `false`, height comes from `useUiHeight`/`heightInPixel`. |
| `useUiWidth`/`useUiHeight` | `false` | Size to the field's own preferred size. |
| `widthInPixel`/`heightInPixel` | `0` | Explicit pixel size (overrides `useUi*`). `0` = unset. |
| `maxWidthInPixel`/`maxHeightInPixel` | `0` | Caps. `0` = none. |
| `horizontalAlignment`/`verticalAlignment` | `-1` | Used only when the matching `fill*` is `false`. |

**To make a field grab the remaining vertical space** (e.g. a list/chat that should fill the body):
give it `weightY: 1` (and usually a min `h`, e.g. `h: 6`), keep `fillVertical: true`. `fillHorizontal`
and `fillVertical` are already `true` by default, so don't repeat them unless it aids readability.

### Group box

- **`gridColumnCount`** default is **2**. Vertical, single-column forms set `gridColumnCount: 1`.
- **`bodyLayoutConfig`** is a `LogicalGridLayoutConfig` with `hgap`, `vgap`, `columnWidth`, `rowHeight`,
  `minWidth` — override to tune gaps (e.g. `{vgap: 0}`); leave unset to use the theme defaults.
- `borderVisible: false` removes the box border/title chrome (used by the chat detail form).

### Custom (non-grid) layouts

Custom widgets that are *not* group-box fields (here: `ChatBox`, `LiveKitMeeting`) lay themselves out
with **CSS flexbox/grid** and a NullLayout `HtmlComponent`. That is idiomatic when the parent gives a
definite size (a `WidgetField`, or a sized dock div). The other built-in layouts are `RowLayout`,
`ColumnLayout`, `SingleLayout`, `FlexboxLayout` under `layout/`.

---

## 3. Forms

- A form has one **`rootGroupBox`**; declare the model in `_jsonModel()` (or via constructor model).
- **`displayHint`** (`Form.DisplayHint`): `dialog`, `view`, `popupWindow`. Dialogs set
  `displayHint: Form.DisplayHint.DIALOG, modal: true`.
- **Process buttons** — `Button` fields with `systemType: Button.SystemType.OK | .CANCEL` and
  `processButton: true` are automatically moved to the form's button bar (they are *not* laid out as
  grid cells). This is why the dialogs list OK/Cancel as the last "fields" of the root group box.
- **Lifecycle**: do creation/saving in **`_save()`**; load data in **`_load()`**; expose results on the
  form instance (e.g. `createdConversation`, `query`) for the opener.
- **Promise bridging** — Scout hooks expect a `JQuery.Promise`. The REST client uses native
  `fetch`/`Promise`, so bridge with `$.Deferred()` (resolve/reject from the native promise) or
  `$.resolvedPromise(...)` / `$.rejectedPromise(...)`.
- **Embedding a custom widget** — put a `WidgetField` in the box (`labelVisible:false`,
  `statusVisible:false`), then `widget('Id', WidgetField).setFieldWidget(scout.create(MyWidget, …))`.
- **Labels & a11y** — keep `label` set even when `labelVisible: false`; the text is still used for the
  accessible name / tooltip. Don't delete the label just because it's hidden.

---

## 4. Tables

- Columns are typed: `Column` (string), `NumberColumn`, `DateColumn` (with `format`), etc. A hidden key
  column (`visible: false`) is the standard way to carry the row's id for `_createChildPage`.
- **`summary: true`** marks the column whose value represents the row (used for the page/tile text).
- **`autoResizeColumns: true`** — best practice for a table that should **fill its container** (outline
  detail tables, table fields in dialogs). With it on, each `Column.width` acts as a **weight and a
  min-width**: columns share the available width proportionally and only scroll horizontally if they
  can't fit. Columns with `fixedWidth`/`autoOptimizeWidth` are excluded. Without it, columns keep their
  literal pixel widths and leave empty space on a wide bench. *(Applied to the detail/field tables in
  this repo — see §7.)*
- **Menus** — `menuTypes: [Table.MenuType.EmptySpace]` for "create"-style actions (no row needed);
  `SingleSelection` for row actions. Wire them in `_initDetailTable` via
  `table.widget('Id', Menu).on('action', …)`.

---

## 5. Outlines & pages

- An **outline** is a tree shown in the desktop **navigation**; it requires
  `Desktop.DisplayStyle.DEFAULT` (navigation + bench). Its nodes are **pages**.
- **`PageWithTable`** — override `_createDetailTable()`, `_loadTableData(searchFilter)` (return a
  `JQuery.Promise` of raw data), `_transformTableDataToTableRows(data)` (cells aligned to column order),
  `_createChildPage(row)`. Set `drillDownOnRowClick = true` to navigate on single click.
- **`PageWithNodes`** — static children, or a **leaf** (`leaf = true`, `detailTableVisible = false`)
  whose `_createDetailForm()` fills the bench.
- **Parent convention** — Scout's own `Page.createDetailTable/Form` builds models via
  `this.outline._createChild(model)`, so creating the detail table/form with **`parent: this.outline`**
  (as this repo does) matches the framework. Child pages are likewise created with
  `parent: this.outline`.
- **Detail form wiring** — `Page._initDetailForm()` forces `modal:false`, `closable:false`,
  `displayHint:'view'`, `displayViewId:'C'`, `showOnOpen:false`. So a detail form must *not* fight this
  (don't set it modal / dialog).
- **Multiple outlines** — switch with `OutlineViewButton`s (`displayStyle:'TAB'`), rendered in the
  navigation by the `ViewButtonBox`. A button matches the active outline by **instance identity**
  (`OutlineViewButton.onOutlineChange` does `this.outline === desktop.outline`), so the button's
  `outline` and the desktop's active `outline` must be the **same instance**. A static `_jsonModel`
  can't share instances, so create the outlines + buttons in `Desktop._init` (`scout.create(...)`),
  then `this.setProperty('viewButtons', [...])` (triggers `_setViewButtons`) and `setOutline(...)`.
  The button's `_doAction` calls `desktop.setOutline`; listen to the desktop `outlineChange` event for
  side effects (e.g. focusing a field). An outline shows a title menu bar for menus with
  `menuTypes:[Tree.MenuType.Header]`.
- **`SearchOutline`** — Scout ships a built-in `SearchOutline` (core, exported) that renders a search
  field, clear icon, debounce, validation (`min/maxSearchFieldLength`, token length) and a status
  line at the top of the navigation. Subclass it and react to its `'search'` / `'resetSearch'` events
  rather than building a field by hand. Its result-count status aggregates a `SearchState` per page;
  pages are `TreeNode`s (not widgets), so when not driving `SearchState`s, override
  `_updateSearchStatus()` and call `setSearchStatus(...)` yourself after the pages have loaded.

---

## 6. Styling & theming

- **ScoutKit ships ONE theme: a modern, dark "video platform" look** (deep neutral-slate chrome +
  indigo accent). LESS entry is `apps/web/src/index.less`, the single `web-theme` webpack entry. It is
  built the Scout-recommended way for a single-theme app (**Option 1** — override LESS variables
  rather than registering a second named theme, which the static-site generator would also link):
  - `@import "~@eclipse-scout/core/src/index"` then `style/colors-dark` + `style/sizes-dark` — start
    from Scout's complete, tested **dark** theme (don't reinvent a dark scheme).
  - `theme/colors.less` — **our variable overrides**, imported **after** the dark base. LESS variables
    are lazy-evaluated (last declaration wins), so every core component rule — even the ones imported
    earlier — resolves these tokens to our values. Reskinning goes almost entirely through the **gray
    ramp** (`@palette-gray-6..10` = the layered surfaces) + **accent palette** (`@accent-color-3` =
    primary indigo `#5b6ef5`; `0/1/2` derive via `lighten()`), so derived component colors follow.
  - `theme/scoutkit.less` — small, additive component polish (header shadow, pill menu items, legible
    header tool-box menus, livekit accent alignment); kept at modest specificity per the theming guide.
- **Why dark fixed the old "can't see menus / buttons" report:** the default *light* theme renders
  menus in the accent color and the navigation/header on a saturated accent fill, which read as
  near-invisible/low-contrast. The cohesive dark theme gives menus indigo-on-dark (popups/menubars)
  or light-on-dark (header tool box), and buttons an indigo fill/border — all clearly visible &
  clickable. Don't go back to the unstyled light theme.
- Scout core variables live in `node_modules/@eclipse-scout/core/src/style/colors.less` (+
  `colors-dark.less` / `sizes-dark.less` for the dark base we extend).
- Useful core variables when a widget should follow the Scout theme: `@background-color`,
  `@border-color`, `@text-color`, `@label-color`, `@active-color`, `@focus-border-color`,
  `@item-selection-background-color`, `@control-border-color`, `@control-border-radius`.
- **`ChatBox` now follows the Scout theme.** Its scoped `--cb-*` custom properties are **derived from
  the core LESS tokens** above (`@panel-background-color`, `@background-color`, `@border-color`,
  `@accent-color-3`, `@text-color`, `@label-color`, `@error-color`, `@border-radius-*`) at compile time
  — change the Scout theme/accent and the chat surface follows. It still uses scoped custom properties
  (not the raw LESS vars inline) so the values stay local to `.chat-box`.
- `LiveKitMeeting` keeps its own self-contained dark video-surface palette (`--lk-*`) — it is a
  **reusable package** that must not hard-depend on the host theme, so its defaults are left as-is. The
  host *does* retint its accent for cohesion via a higher-specificity rule (`.chat-box
  .livekit-meeting { --lk-accent: @accent-color-3 }` in `theme/scoutkit.less`) — the cascading custom
  property keeps the widget standalone-usable while following the app accent when embedded here.

---

## 7. This repo: layout review

The UI already follows Scout layout conventions; verified component-by-component:

| Component | Layout approach | Verdict |
|-----------|-----------------|---------|
| `Desktop` | `DisplayStyle.COMPACT` on phones else `DEFAULT` (§9), two outlines via `OutlineViewButton`s built in `_init`, header `Menu` | idiomatic |
| `WorkspaceOutline` / `SearchOutline` | top-level `PageWithTable`s built in `_init`; `SearchOutline` extends Scout's built-in `SearchOutline` (live field) and runs one shared `query` against the backend search services | idiomatic |
| `*TablePage` / `*SearchPage` | `PageWithTable`, `parent: this.outline`, hidden id column, `summary` column, `drillDownOnRowClick`; search result pages share the `SearchResultPage` base | idiomatic |
| `ConversationPage` | `PageWithNodes` leaf, `detailTableVisible=false`, `_createDetailForm` | idiomatic |
| `ChatForm` | `rootGroupBox` (borderless, 1 col) + `WidgetField` with `weightY:1, fillVertical` to fill the bench; group-box-body forced to `height:100%` in CSS | idiomatic |
| `ChatBox` / `LiveKitMeeting` | `Widget` + `HtmlComponent` (NullLayout) + CSS flex/grid, sized by parent | idiomatic |
| dialogs | `DIALOG`, modal, `gridColumnCount:1`, process buttons (`OK`/`CANCEL`) | idiomatic |

**Change applied in an earlier branch:** the detail tables (`ConversationTablePage`, `ContactTablePage`,
the search result pages) and the contact-picker table in `NewConversationForm` set
**`autoResizeColumns: true`** so their columns fill the bench/dialog width responsively instead of
leaving empty space, with the existing column widths acting as weights + min-widths (§4).

### Icons
Widgets carry framework font icons (`icons.*` from `@eclipse-scout/core`) via their `iconId` model
property — nothing custom was needed for the navigation/menus:
- outline view buttons (`Desktop`): Workspace `icons.FOLDER`, Search `icons.SEARCH`; header name menu
  `icons.PERSON_SOLID`.
- workspace/search outline pages: Conversations `icons.LIST`, Contacts `icons.GROUP`, Messages
  `icons.FILE`; the `ConversationPage` leaf picks `icons.PERSON_SOLID` (DM) vs `icons.GROUP` (room).
- `New meeting` menu + `Create` button: `icons.GROUP_PLUS`.

The Scout font set has **no phone/paper-plane glyph**, and `ChatBox` is a plain-HTML surface (not a
Scout widget), so its call/send buttons use small **inline stroke SVGs** (`CB_ICONS` in `ChatBox.ts`,
styled via `.cb-btn-icon`) and the header avatar uses the Scout icon font directly
(`font-family: scoutIcons`, `content: '\E034'`/`'\E006'`) — no custom icon font was added.

### Forward recommendations (not yet done)
- **i18n** — UI strings are hard-coded. Scout's pattern is `session.text('key')` backed by NLS texts
  files. A larger change; left as a recommendation.
- **Dark theme** — *done.* The single `web-theme` (← `index.less`) is now a dark "video platform"
  theme built on Scout's dark base via variable overrides (§6). No runtime switch (single theme by
  design); add a second named theme + `Desktop#setTheme` only if user-switchable themes are wanted.

---

## 9. Mobile / compact desktop

Scout's **device transformation** (the server-side `MobileDeviceTransformer` that sets the desktop
to compact, moves field labels to top, etc.) is a **Scout Classic** feature and is **not available
in a pure Scout JS app** like this one. So nothing switches the desktop into a mobile layout for us;
left alone it always renders the full `DEFAULT` desktop (navigation **and** bench), which is why a
phone showed the desktop layout.

What *is* available in Scout JS:

- **Compact desktop** — set `displayStyle: Desktop.DisplayStyle.COMPACT` ourselves. `Desktop._setDisplayStyle`
  (verified in `desktop/Desktop.ts`) then: moves the header tool box into the **navigation**
  (`navigation.setToolBoxVisible(true)`, `header.setToolBoxVisible(false)`), hides the bench's outline
  content, and on the **outline** calls `setCompact(true)` + `setEmbedDetailContent(true)`. Result:
  navigation **or** bench (never both), outline in breadcrumb mode embedding the detail content, so the
  chat detail form is reachable from the navigation. The desktop auto-switches nav↔bench as views open/close
  (`switchToBench`/`switchToNavigation`, `hideForm`).
- **Device detection** — `Device.get().type === Device.Type.MOBILE` (also `.TABLET` / `.DESKTOP`). The
  singleton is created on the App `prepare` event from `navigator.userAgent`. There is no
  `isMobileDevice()` helper in 26.1 — compare `type` directly.
- **Responsive group boxes** — pure Scout JS profits from the `ResponsiveManager` / `GroupBoxResponsiveHandler`
  compact state (grid → 1 column, labels to top) automatically when a box gets narrow; no wiring needed.

**Applied:** `Desktop._jsonModel()` picks `COMPACT` when `Device.get().type === Device.Type.MOBILE`,
else `DEFAULT`. Tablets keep `DEFAULT` (the compact desktop is the phone form factor, matching Scout's
`MAKE_DESKTOP_COMPACT` being a *mobile* transformation).

---

## 10. Verifying a UI change

```bash
npm run build:lib                 # compile @scoutkit/livekit (apps/web depends on its types)
npx tsc -p apps/web/tsconfig.json # typecheck the app
npm run build:web                 # full webpack prod build + static site
```

> The Node engine warning (`engines.node`) is expected and harmless — see CLAUDE.md.
</content>
</invoke>
