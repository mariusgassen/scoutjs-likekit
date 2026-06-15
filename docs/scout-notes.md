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

---

## 6. Styling & theming

- LESS entry is `apps/web/src/index.less`; it imports `@eclipse-scout/core` styles, the LiveKit widget
  styles, and `main/ChatBox`. Scout core variables live in
  `node_modules/@eclipse-scout/core/src/style/colors.less` (+ `colors-dark.less` for the dark theme).
- Useful core variables when a widget should follow the Scout theme: `@background-color`,
  `@border-color`, `@text-color`, `@label-color`, `@active-color`, `@focus-border-color`,
  `@item-selection-background-color`, `@control-border-color`, `@control-border-radius`.
- The two custom surfaces here (`ChatBox`, `LiveKitMeeting`) are deliberately self-contained, using
  scoped CSS custom properties (`--cb-*`, `--lk-*`) rather than Scout theme tokens — intentional, since
  they are app-styled chat/video surfaces, not form fields. If full Scout light/dark theme parity is
  ever wanted, switch those custom properties to the core LESS variables above.

---

## 7. This repo: layout review

The UI already follows Scout layout conventions; verified component-by-component:

| Component | Layout approach | Verdict |
|-----------|-----------------|---------|
| `Desktop` | `DisplayStyle.DEFAULT`, single outline, header `Menu` | idiomatic |
| `WorkspaceOutline` | three top-level `PageWithTable`s built in `_init` | idiomatic |
| `*TablePage` | `PageWithTable`, `parent: this.outline`, hidden id column, `summary` column, `drillDownOnRowClick` | idiomatic |
| `ConversationPage` | `PageWithNodes` leaf, `detailTableVisible=false`, `_createDetailForm` | idiomatic |
| `ChatForm` | `rootGroupBox` (borderless, 1 col) + `WidgetField` with `weightY:1, fillVertical` to fill the bench; group-box-body forced to `height:100%` in CSS | idiomatic |
| `ChatBox` / `LiveKitMeeting` | `Widget` + `HtmlComponent` (NullLayout) + CSS flex/grid, sized by parent | idiomatic |
| dialogs | `DIALOG`, modal, `gridColumnCount:1`, process buttons (`OK`/`CANCEL`) | idiomatic |

**Change applied in this branch:** the detail tables (`ConversationTablePage`, `ContactTablePage`,
`SearchTablePage`) and the contact-picker table in `NewConversationForm` now set
**`autoResizeColumns: true`** so their columns fill the bench/dialog width responsively instead of
leaving empty space, with the existing column widths acting as weights + min-widths (§4).

### Forward recommendations (not yet done)
- **i18n** — UI strings are hard-coded. Scout's pattern is `session.text('key')` backed by NLS texts
  files. A larger change; left as a recommendation.
- **Theme parity** — optionally map the `--cb-*` / `--lk-*` custom properties to core LESS variables
  (§6) so the chat/video surfaces follow the Scout light/dark theme.

---

## 8. Verifying a UI change

```bash
npm run build:lib                 # compile @scoutkit/livekit (apps/web depends on its types)
npx tsc -p apps/web/tsconfig.json # typecheck the app
npm run build:web                 # full webpack prod build + static site
```

> The Node engine warning (`engines.node`) is expected and harmless — see CLAUDE.md.
</content>
</invoke>
