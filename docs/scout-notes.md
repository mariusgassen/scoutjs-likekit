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
property:
- outline view buttons (`Desktop`): Workspace `icons.FOLDER`, Search `icons.SEARCH`; header name menu
  `icons.PERSON_SOLID`.
- workspace/search outline pages: Conversations `icons.LIST`, Contacts `icons.GROUP`, Messages
  `icons.FILE`; the `ConversationPage` leaf picks `icons.PERSON_SOLID` (DM) vs `icons.GROUP` (room).
  Reviewed against the full `scoutIcons` set (95 glyphs) — these are the best-fitting built-ins (the
  core font has no chat-bubble / envelope glyph), so they were kept.

**Standard action-icon glyphs (project rule — see CLAUDE.md):** new/create → **plus-in-circle**,
edit → **pencil** (`icons.PENCIL`), delete → **trash can**. The Scout core font has **no
plus-in-circle and no trash-can** (verified by dumping the `scoutIcons` cmap), so those two are served
from a small **custom icon font**:
- `apps/web/res/fonts/scoutkit-icons.woff` — committed binary, built by
  `apps/web/scripts/build-icon-font.py` (fontTools) from FontAwesome-Free *solid* outlines, glyphs at
  `U+E900` (plus-circle) / `U+E901` (trash).
- `@font-face` (family `scoutkit-icons`) + the `.font-scoutkit-icons { font-family }` mapping live in
  `theme/scoutkit.less`. Scout tags a non-default-font icon element with the `font-<fontName>` class
  (`IconDesc#cssClass`) but ships no family rule for it, so the theme supplies one (it wins because it
  is imported last).
- ids are exposed as `Icons.PLUS_CIRCLE` / `Icons.TRASH` in `apps/web/src/main/Icons.ts` (which
  re-exports the core `icons` plus these). The `New` menu (`ConversationTablePage`) and the `Create`
  button (`NewConversationForm`) use `Icons.PLUS_CIRCLE`.
- the static-site generator (`scripts/generate-site.mjs`) copies `res/fonts/*` into `prod/fonts/`
  next to Scout's own fonts so the theme CSS's relative `url(fonts/…)` resolves at runtime.

The Scout font set has **no phone/paper-plane glyph**, and `ChatBox` is a plain-HTML surface (not a
Scout widget), so its call/send buttons use small **inline stroke SVGs** (`CB_ICONS` in `ChatBox.ts`,
styled via `.cb-btn-icon`) and the header avatar uses the Scout icon font directly
(`font-family: scoutIcons`, `content: '\E034'`/`'\E006'`).

**Compact-mode (mobile) navigation tweaks** (`theme/scoutkit.less`, scoped to
`.compact.outline.breadcrumb`): Scout lays each breadcrumb node out as a flex row with
`align-items: start` and bumps the node icon to 16px while keeping the 15px font-icon line-height, so
the glyph read a touch high next to the label — the theme centers the row items (`align-items: center`)
and lets the icon box hug its glyph (`line-height: 1`, no vertical padding). The per-page **action
menus** (e.g. the `New` menu) are set **icon-only on phones** via `textVisible: Device.get().type !==
Device.Type.MOBILE` (the `text` stays set as the accessible name / tap tooltip); the header identity
menu (`NameMenu`) keeps its label.

### Forward recommendations (not yet done)
- **i18n** — UI strings are hard-coded. Scout's pattern is `session.text('key')` backed by NLS texts
  files. A larger change; left as a recommendation.
- **Dark theme** — *done.* The single `web-theme` (← `index.less`) is now a dark "video platform"
  theme built on Scout's dark base via variable overrides (§6). No runtime switch (single theme by
  design); add a second named theme + `Desktop#setTheme` only if user-switchable themes are wanted.

---

## 8. How-Tos (distilled from the `scout.docs` `howtos` module)

Condensed from Eclipse Scout's official how-to guides (the `docs/modules/howtos` module of
`eclipse-scout/scout.docs`, 26.1 branch, commit `c42c059`). Only the **Scout JS** patterns relevant
to this repo are kept; the Scout *Classic* guides (`JsForm`/`JsPage` embedding, the Java chart/smart-field
variants) are noted as **not applicable** at the bottom.

### 8.1 REST service in a `PageWithTable` (the canonical data-loading pattern)

This is exactly what every list page here does (`ConversationTablePage`, `*SearchPage`, …). Upstream's
idiomatic shape:

- **`_loadTableData(searchFilter)`** returns a `JQuery.Promise` of the response DO. Upstream uses
  `ajax.postDataObject(url, restriction)` (Scout's `ajax` helper already returns a `JQuery.Promise` and
  (de)serializes `@typeName`'d DataObjects). **This repo instead** uses native `fetch` in
  `MeetingApi.ts` and bridges to a `JQuery.Promise` with `$.Deferred()` / `$.resolvedPromise` (see §5 /
  CLAUDE.md) — both are valid; `ajax.postDataObject` is the option if we ever want DO (de)serialization
  for free.
- **Endpoint URLs** — upstream resolves them via `systems.getOrCreate().getEndpointUrl('<system>',
  '<defaultPath>')` instead of hard-coding. The 2nd arg is the fallback path matching the Java
  `@Path`. (This repo centralizes URLs in `MeetingApi.ts` instead.)
- **Row mapping** — `_transformTableDataToTableRows(data)` maps each response item to
  `{data: <raw>, cells: [<col0>, <col1>, …]}`; cells are **positional**, aligned to the column order in
  the model. Keep the raw object on `row.data` so `_createChildPage(row)` can read it.
- **Server-side row limiting** — wrap the filter with **`this._withMaxRowCountContribution(searchFilter)`**
  before sending; it attaches `MaxRowCountContributionDo` (the table's `maxRowCount`) so the server limits
  the query and reports "more available" back via `LimitedResultInfoContributionDo`. Set `maxRowCount` on
  the `detailTable` model.
- **REST convention** — list endpoints use **`POST`** (not `GET`) so the restriction object travels in the
  body (richer than a query string); `@Consumes`/`@Produces` JSON; the resource is mounted under `/api/*`.
  Matches this repo's `/api/*` services.
- **Client-side DataObjects** — declare with `@typeName('<ns.Name>') class Foo extends BaseDoEntity { … }`;
  the `typeName` **and attribute names must match the Java `DoEntity`** for (de)serialization. (This repo's
  REST types are plain TS interfaces in `MeetingApi.ts`, which is fine since it doesn't use `postDataObject`.)

### 8.2 Search form for a table page

Upstream attaches search to a table page via a **`SearchFormTableControl`** whose `form` is a `Form`
subclass (not a dialog):

- The form's group box carries a **`SearchMenu`** + **`ResetMenu`** — clicking them auto-reloads the
  table, no manual wiring.
- Override **`exportData()`** to build the restriction DO from field values, and **`importData()`** to
  push restriction values back onto the fields. On each reload the page exports the form's data and uses
  it as the `searchFilter` passed to `_loadTableData`.
- > This repo took a **different, also-idiomatic** route: it extends Scout's built-in **`SearchOutline`**
  > with a single live query field shared across result pages (see §5 / CLAUDE.md) rather than a
  > per-page `SearchFormTableControl`. Use the table-control pattern only if a page needs its own
  > structured multi-field filter.

### 8.3 Custom `FormField` (the "FlipCard" how-to) — relevant to our custom widgets

The pattern behind custom surfaces like `ChatBox` / `LiveKitMeeting` (though those extend `Widget`, not
`FormField`). To build a **field**:

- `extends FormField`; in **`_render()`**: `this.addContainer(this.$parent, '<css-class>')` →
  `this.addLabel()` → build your DOM and `this.addField($field)` (exposes it as `this.$field`) →
  `this.addMandatoryIndicator()` → `this.addStatus()`.
- **`_renderProperties()`** (call `super` first) does the *initial* DOM application — one
  `_render<Prop>()` method per model property.
- Reactive updates: public `setX(v)` → `this.setProperty('x', v)` → framework calls your `_renderX()`.
- **`_remove()`** (call `super`) must null out retained jQuery refs (`this.$card = null` …) to avoid leaks.
- Register the class in `index.ts` (`export *`) and its LESS in `index.less` (`@import`), then reference it
  in a model via `objectType: MyField`.
- `_render()`/CSS use jQuery — `@eclipse-scout/core` re-exports it; add `jquery` + `@types/jquery` if a
  package consumes it directly.

### 8.4 Charts (only if we ever add data-viz)

Charts are a **separate module** — `@eclipse-scout/chart` (npm) — not in core. Setup: add the dep, an
`import * as chart from '@eclipse-scout/chart'` in the entry file, and `@import "~@eclipse-scout/chart/src/index"`
in the theme LESS. Then `scout.create('Chart', {parent})`, feed it `chart.setData({axes, chartValueGroups})`
and `chart.setConfig({type: Chart.Type.BAR, options:{colorScheme, scales, clickable, checkable}})`; handle
`chart.on('valueClick', …)`; `chart.checkedItems` holds checked segments. Custom color schemes are LESS
(`#scout.chart-auto-colors(...)`), usable even for `<canvas>` charts. Not currently used here.

### 8.5 SmartField colors/styles from a lookup row

If we add a `SmartField`/`Lookup*` with per-row coloring: since Scout 8 the lookup row's **`cssClass`**
is auto-applied to the `.form-field` DIV, so prefer **styling via LESS** (`.form-field.<class> > .field`,
`.table-row.<class>`) over copying `backgroundColor`/`foregroundColor` onto the field. The old auto-copy of
color/font/tooltip from lookup row → field was removed; do it explicitly only when CSS can't.

### 8.6 Not applicable to this repo (Scout Classic only)

- **`JsForm` / `JsPage`** (`AbstractJsForm`, `AbstractJsPage`, `JsPageHelper`, `getConfiguredJsFormObjectType`)
  exist to embed Scout JS forms/pages inside a **Java Scout Classic** outline whose state lives on the UI
  server. This repo is **pure Scout JS** (no Java client/outline), so build pages directly as
  `PageWithTable`/`PageWithNodes` (§5) — there is nothing to wrap. The `importData`/`exportData` and
  `_loadTableData`/`_transformTableDataToTableRows` contracts shown there are the *same* ones we already
  use; only the Java wrapper is irrelevant.
- The **Java** chart and smart-field how-tos (Classic) are superseded by the JS equivalents above.

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

---

## 11. Contacts sample app (`scout.docs/code/contacts`) — patterns & best practices

Distilled from Eclipse Scout's official **Contacts** sample application (the `code/contacts` module of
`eclipse-scout/scout.docs`, branch `releases/26.1`, commit `c42c059`). ⚠️ **It is a Scout *Classic*
app** (the UI is **Java** — `org.eclipse.scout.contacts.client` — rendered by `ui.html` via
`RemoteApp`; state lives on the UI server). This repo is **pure Scout JS**, so the *Java field/page
classes don't transfer 1:1* — but the **design patterns** do, and almost every one has a Scout JS
counterpart in the installed core (verified below). Treat this as the upstream worked example of the
**"reuse before you rebuild"** rule in CLAUDE.md. Each lesson is mapped Classic → **Scout JS** and to
this repo.

### 11.1 Factor common menus/fields into reusable `Abstract*` templates (the headline lesson)

The sample's `client/common/` package is a library of reusable bases that pages/forms subclass:
`AbstractEditMenu` (Pencil icon + `alt-e` keystroke + `Edit` text), `AbstractNewMenu` (plus glyph +
`alt-n` + `menuTypes {EmptySpace, SingleSelection}`), `AbstractAddressBox` (street/city/country group
+ "show on map"), `AbstractEmailField` (regex-validated), `AbstractNotesBox`, `AbstractUrlImageField`,
`AbstractDirtyFormHandler`. `OrganizationTablePage` then declares `class EditMenu extends
AbstractEditMenu {…}` — only the `execAction` body. **The cost of *not* doing this is visible in the
same codebase:** `PersonTablePage` copy-pasted its own `EditMenu`/`NewMenu` inline instead of reusing
the bases, and `PersonForm` carries a comment *"in a real world scenario avoid copy&paste: delete the
pictureUrlField and let PictureField extend AbstractUrlImageField"*. **Lesson for this repo:** when the
same menu/field/box shows up on two pages (e.g. our `New`/`Edit`/`Delete` row menus across
`ConversationTablePage` / `ContactTablePage`), hoist a shared base in `apps/web/src` and subclass it,
rather than duplicating the model. Scout JS supports this exactly the same way — subclass a `Menu` /
`*Field` / `GroupBox` and reference the subclass as `objectType`.

### 11.2 Table-page conventions (mapped to our `PageWithTable`s)

- **Hidden primary-key column** — `PersonIdColumn` is `displayable:false` + `primaryKey:true`; carries
  the row id for `execCreateChildPage`. JS equivalent = our hidden id column read in `_createChildPage`
  (§4, already applied).
- **Summary column** — `SummaryColumn` (`summary:true`, `displayable:false`) composes the node label
  via `execDecorateCell` (`"First Last (City)"`). Drives the **breadcrumb/compact** node text — exactly
  why §4 says mark a `summary` column; relevant to our mobile/compact mode (§9).
- **Default (row-activation) menu** — Classic `getConfiguredDefaultMenu() → EditMenu`: double-click /
  Enter on a row runs Edit. **Scout JS** has no "default menu class"; it uses **`Table.defaultMenuTypes`**
  (default `[Table.MenuType.EmptySpace]`) — the menu invoked on row activation is the single-selection
  menu matching those types. If we want double-click-to-edit, give the Edit menu `SingleSelection` and
  rely on `defaultMenuTypes`, or handle `rowAction`.
- **`New` menu on *both* `EmptySpace` and `SingleSelection`** — so "create" is reachable whether or not
  a row is selected (`AbstractNewMenu`). Our `Table.MenuType` enum is the same; worth copying for the
  conversations/contacts `New` action.
- **Lookup/code-backed columns** — `CountryColumn`/`OrganizationColumn` are `AbstractSmartColumn<String>`
  with `getConfiguredLookupCall()`. **Scout JS** = **`SmartColumn`** (`table/columns/SmartColumn.ts`),
  which accepts `lookupCall` **or** `codeType` and resolves the display text from the key.
- **Columns hidden-but-available** — Phone/Mobile/Email are `visible:false` (user can show them); keeps
  the default view lean (progressive disclosure). Set per `Column.visible`.
- **Refresh after edit** — a `FormListener` reloads the page when the detail form closes *and was
  stored*: `if (TYPE_CLOSED && form.isFormStored()) reloadPage();`. The canonical "re-query the list
  after a create/save" wiring. JS: listen to the form's `'close'`/`store` and call the page's reload.

### 11.3 Search — two upstream variants, both already understood here

- **`AbstractSearchOutline`** — the sample's `common/SearchOutline` overrides `execSearch(query)` (a
  global search box in the navigation). **This is exactly what our repo extends** in Scout JS
  (`SearchOutline`, §5) — confirms our choice matches upstream's "search outline" pattern.
- **Per-page `AbstractSearchForm`** — `PersonTablePage.getConfiguredSearchForm() → PersonSearchForm`
  (fields + `AbstractSearchButton`/`AbstractResetButton`); the table page auto-runs `execLoadData(filter)`
  on search. This is the structured per-page filter (the §8.2 `SearchFormTableControl` family). Use it
  only if a list needs its own multi-field filter; our shared live-query outline covers the rest.

### 11.4 Detail-form patterns (`PersonForm`, `OrganizationForm`)

- **View display hint** — `getConfiguredDisplayHint() = DISPLAY_HINT_VIEW` so the form fills the bench
  (not a dialog). Matches `Page._initDetailForm()` forcing `displayHint:'view'` (§5).
- **Exclusive open (no duplicate forms)** — Classic `computeExclusiveKey()` + `startInternalExclusive()`
  + `getConfiguredOpenExclusive()`: opening the same person twice focuses the existing form. **Scout JS
  has this too** — `Form.exclusiveKey` (a `() => key` property; `form/Form.ts:33`). Set
  `form.setExclusiveKey(() => entityId)` to dedupe detail forms. (Not currently used here; useful if we
  let users open the same conversation/contact form from multiple places.)
- **Tabbed forms** — `DetailsBox extends AbstractTabBox` groups Contact-info / Work / Notes tabs.
  **Scout JS** = **`TabBox`** (`form/fields/tabbox/TabBox.ts`).
- **Sequence box for horizontal field rows** — `LocationBox extends AbstractSequenceBox` lays City +
  Country side-by-side; `autoCheckFromTo:false` disables the built-in from≤to range check when it isn't
  a range. **Scout JS** = **`SequenceBox`**. Inside it, `labelPosition: LABEL_POSITION_ON_FIELD` puts
  the label inside the field (placeholder-style) to save width.
- **Radio group bound to a code type** — `GenderGroup extends AbstractRadioButtonGroup<String>` with
  `getConfiguredCodeType() → GenderCodeType`. **Scout JS** = **`RadioButtonGroup`** + **`CodeType`/`Code`**
  (`code/`); a `CodeType` is the Scout idiom for a small static enumeration (vs a `LookupCall` for larger
  sets). Bind via the field's `codeType`.
- **Layered validation** (three distinct hooks — all throw `VetoException` to block save):
  - **Form-level** `execValidate()` — cross-field rule ("first **or** last name required", focuses the
    empty field). JS: override `Form._validate()` / validate in `_save()`.
  - **Field-level** `execValidateValue(raw)` — single-value rule (email regex; date-of-birth not in the
    future). JS: `ValueField.setValidator(...)` or override `_validateValue`.
  - **Dynamic mandatory** in `execChangedValue()` — `validateAddressFields()` makes City mandatory once
    Street has text, Country mandatory once Street/City do. JS: react to the field's `valueChanged` and
    call `setMandatory(...)`.
- **Master/slave fields** — `PictureField`/`ShowOnMapButton` declare `getConfiguredMasterField()` +
  `execChangedMasterValue()` so a field reacts to another's value. ⚠️ **Classic-only** — Scout JS
  `FormField` has **no `masterField`**; wire dependent fields manually by listening to the master's
  `propertyChange:value` and updating the slave.
- **`gridWeightY: 0`** on the top "General" box so it doesn't grow vertically — the same `GridData`
  steering documented in §2 (`weightY`).
- **Form handlers** — `ModifyHandler.execLoad` does `export→service.load→import`; `execStore` does
  `export→service.store`; `NewHandler.execStore` calls `service.create`. The repo's REST equivalent is
  the form's `_load`/`_save` calling `MeetingApi` (§3) — same shape, native promises instead of beans.
- **`AbstractDirtyFormHandler`** — a reusable handler that adds per-field dirty tracking (listens on
  `PROP_DISPLAY_TEXT`), flips the form icon to a pencil when dirty, and recomputes the subtitle. A
  template worth mirroring if we want a "modified" indicator on detail forms.

### 11.5 Lookup calls

`CountryLookupCall extends LocalLookupCall<String>` overrides `execCreateLookupRows()` returning
`LookupRow(key, text)` (countries from `Locale.getISOCountries()`); `AvailableLocaleLookupCall` sorts by
display name. **Scout JS** = **`StaticLookupCall<TKey>`** (`lookup/StaticLookupCall.ts`): extend it and
implement **`_data()`** (rows as `[key, text, parentKey?]` tuples) and optionally `_dataToLookupRow()`.
For code-type-backed pickers use **`CodeLookupCall`** (`code/CodeLookupCall.ts`, `extends
StaticLookupCall`, takes a `codeType`). These feed `SmartField`/`SmartColumn`. We have no lookups yet;
this is the path if we add e.g. a status/role picker.

### 11.6 Desktop, outlines & header menus

- `getConfiguredOutlines()` lists the outlines; `execDefaultView()` sets the start outline;
  **`AbstractOutlineViewButton`** with `DisplayStyle.MENU` vs `.TAB` switches them. Mirrors our two
  outlines + `OutlineViewButton`s built in `Desktop._init` (§5).
- **Header menus that open a form in a popup** — `OptionsMenu`/`UserMenu extends AbstractFormMenu<T>`
  (`getConfiguredForm()`). **Scout JS** = **`FormMenu`** (`form/FormMenu.ts`) — a menu whose `form`
  renders in a popup. Use it for a settings/profile popup off the header instead of a separate dialog.
- **Global keystrokes** on menus/buttons (`F3` search, `F9`/`F10`/`F11`, `alt-e`/`alt-n`) — Scout JS
  widgets take a `keyStroke` model property; cheap accessibility/usability win for our row + header
  actions.
- `getConfiguredLogoId()` (header logo) and `getConfiguredOverviewIconId()` (page overview-tile icon)
  are extra icon slots beyond `iconId`.

### 11.7 Icons — confirms our `Icons.ts` convention

The app's `Icons extends AbstractIcons` adds app glyphs and **mixes core constants with custom-font
glyphs**: `Contacts = AbstractIcons.Folder`, `User = "user"`, but `Organization =
"font:awesomeIcons \uf015"`, `MaleLine = "font:lineAwesomeIcons \uf27b"` (FontAwesome / Line-Awesome
fonts registered by the app). The `New` menu likewise uses `"font:awesomeIcons \uf0d0"`. **This is precisely this repo's
pattern** (`apps/web/src/main/Icons.ts` re-exports core `icons` + custom `scoutkit-icons` glyphs via
`font:scoutkit-icons …`, §7) — upstream confirms: extend the core icon class, reuse core constants
first, and reach for a custom font only for glyphs the core set lacks.

### 11.8 Theming — upstream uses the multi-theme route (our §6 "Option 2")

The sample ships **two** themes: `contacts-theme.less` (default/light) and `contacts-theme-dark.less`,
each `@import "~@eclipse-scout/core/src/index"` then app overrides (`index.less` → `index-dark.less`
adds `style/colors-dark`). The app's own LESS is **deliberately tiny**: a couple of color-variable
overrides (`style/colors.less` = two `@read-only-menu-*` vars) + one component rule (`.read-only-info`).
That's the **Option 2** (register named themes) alternative to this repo's **Option 1** (single theme
via variable overrides, §6) — both are legitimate; we chose Option 1 because we ship one theme and the
static-site generator would otherwise link every named theme. **Reinforced lesson:** keep app LESS
small and additive (variable overrides + minimal component polish), exactly as §6 prescribes.

### 11.9 App-scoped helper injecting a shared menu (read-only mode)

`ContactsHelper` (`@ApplicationScoped`) exposes `injectReadOnlyMenu(menus)`, and `PersonForm.MainBox`
calls it from `injectMenusInternal(...)`; gated by a config property it appends a right-aligned
"read-only" menu to every form. Pattern: a single app-scoped helper centralizes a cross-cutting UI
contribution rather than repeating it per form. In Scout JS the analog is a small shared helper/util
module that builds the `Menu` model, invoked where each form assembles its menus.
</content>
</invoke>
