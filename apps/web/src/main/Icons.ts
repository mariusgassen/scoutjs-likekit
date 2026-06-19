import {icons} from '@eclipse-scout/core';

/**
 * App icon ids — Scout's built-in font set (`icons`) plus the few action glyphs it lacks, backed by
 * the custom `scoutkit-icons` font (see `apps/web/res/fonts/scoutkit-icons.woff`, the `@font-face`
 * in `theme/scoutkit.less`, and `scripts/build-icon-font.py`).
 *
 * Per the action-icon rule in `CLAUDE.md`: new/create -> {@link Icons.PLUS_CIRCLE} (plus-in-circle),
 * delete/remove -> {@link Icons.TRASH} (trash can), edit -> `icons.PENCIL` (already built-in). The
 * Scout core font has no plus-in-circle or trash-can glyph, hence the custom font.
 */
export const Icons = {
  ...icons,
  /** New / create action - a plus-in-circle (custom `scoutkit-icons` glyph U+E900). */
  PLUS_CIRCLE: 'font:scoutkit-icons \uE900',
  /** Delete / remove action - a trash can (custom `scoutkit-icons` glyph U+E901). */
  TRASH: 'font:scoutkit-icons \uE901'
} as const;
