import {icons} from '@eclipse-scout/core';
import {faIcons} from './fa-icons';

/**
 * App icon catalog. Composes, in increasing precedence:
 *
 *  1. {@link faIcons} — the **complete FontAwesome Free solid set** (1300+ glyphs), self-hosted via
 *     the `scoutkit-icons` font (`apps/web/res/fonts/scoutkit-icons.woff2`, `@font-face` in
 *     `theme/scoutkit.less`). Regenerate with `apps/web/scripts/generate-icons.py`.
 *  2. Scout core `icons` — wins on name collisions, so the framework glyph is preferred where both
 *     define a name (the "use a framework icon first" rule in `CLAUDE.md`).
 *  3. The action-icon aliases below — the project's fixed glyphs for the standard row/menu actions
 *     (`CLAUDE.md`): new/create -> {@link Icons.PLUS_CIRCLE} (plus-in-circle), delete/remove ->
 *     {@link Icons.TRASH} (trash can); edit uses the built-in `icons.PENCIL`.
 *
 * Every value is a Scout `iconId` (`font:scoutkit-icons <char>` for the custom font), settable on any
 * widget's `iconId` property. Reach for `Icons.<NAME>` (FontAwesome names are SCREAMING_SNAKE, e.g.
 * `Icons.CIRCLE_USER`, `Icons.GEAR`, `Icons.VIDEO`) instead of adding glyphs by hand.
 */
export const Icons = {
  ...faIcons,
  ...icons,
  /** New / create action - a plus-in-circle (FontAwesome `circle-plus`). */
  PLUS_CIRCLE: faIcons.CIRCLE_PLUS,
  /** Delete / remove action - a trash can (FontAwesome `trash`). */
  TRASH: faIcons.TRASH,
  /** Start call - a phone handset (FontAwesome `phone`). */
  PHONE: faIcons.PHONE,
  /** End call - a phone handset with a slash (FontAwesome `phone-slash`). */
  PHONE_SLASH: faIcons.PHONE_SLASH,
  /** Send message - a paper plane (FontAwesome `paper-plane`). */
  PAPER_PLANE: faIcons.PAPER_PLANE
} as const;

/**
 * Raw glyph characters of the custom `scoutkit-icons` font, for rendering on plain-HTML surfaces
 * (e.g. {@link ChatBox}'s `<button>`s) where Scout's `iconId` machinery isn't available. Drop the
 * char into an element carrying the `font-scoutkit-icons` CSS class (theme/scoutkit.less) so the
 * right `font-family` resolves; the glyph then inherits `currentColor` and scales with `font-size`.
 * Codepoints match FontAwesome `phone` (U+F095), `phone-slash` (U+F3DD), `paper-plane` (U+F1D8).
 */
export const IconChars = {
  PHONE: '\uF095',
  PHONE_SLASH: '\uF3DD',
  PAPER_PLANE: '\uF1D8'
} as const;
