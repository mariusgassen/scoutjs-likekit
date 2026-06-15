import {App, scout} from '@eclipse-scout/core';
import {Desktop} from './main/Desktop';

scout.addObjectFactories({
  Desktop: () => new Desktop()
});

// Load translations and locale metadata on bootstrap:
//  - texts.json    Scout core's UI translations (button labels, validation messages, table/form
//                  menus, …); without it Scout widgets render every core text as
//                  "[undefined text: <key>]". Copied out of @eclipse-scout/core (see webpack.config.js).
//  - texts-app.json ScoutKit's own UI translations (res/texts-app.json), merged on top of the core
//                  texts so the app strings (scoutkit.* keys) are localized too.
//  - locales.json  Locale metadata (date/number formats, …) for every language, incl. German.
// Both text files ship a "default" (English) and a "de" (German) map; Scout picks the map matching
// the session locale and falls back to "default".
new App().init({
  bootstrap: {
    textsUrl: ['texts.json', 'texts-app.json'],
    localesUrl: 'locales.json'
  }
});
