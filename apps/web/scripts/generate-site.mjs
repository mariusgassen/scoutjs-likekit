#!/usr/bin/env node
/*
 * Scout's `scout-scripts build:prod` emits hashed bundles into target/dist/prod plus a
 * `file-list`, but does not wire them into index.html (a Scout host server normally does
 * that at runtime). For static nginx serving we assemble a flat, ready-to-serve site:
 *
 *   target/site/
 *     index.html      <- res/index.html with <link>/<script> tags injected
 *     config.js       <- copied from res (rewritten from $LIVEKIT_URL at container start)
 *     prod/...        <- hashed js/css assets
 *     prod/fonts/...  <- Scout icon fonts referenced by the theme CSS
 */
import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const demoDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const prodDir = join(demoDir, 'target', 'dist', 'prod');
const resDir = join(demoDir, 'target', 'dist', 'res');
const siteDir = join(demoDir, 'target', 'site');

// The theme CSS references icon fonts via relative url(fonts/...), but Scout's
// build:prod does not emit them (a Scout host server normally serves them from
// @eclipse-scout/core). Copy them out of the package so nginx can serve them.
// @eclipse-scout/core only exposes an `import` exports condition, so resolve its
// entry (dist/eclipse-scout-core.esm.js) and pick up the sibling dist/fonts dir.
const scoutCoreEntry = fileURLToPath(import.meta.resolve('@eclipse-scout/core'));
const scoutFontsDir = join(dirname(scoutCoreEntry), 'fonts');

const fileList = readFileSync(join(prodDir, 'file-list'), 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean);

// The entry JS chunks (vendors first), and the theme CSS. Skip the theme JS stub.
const scripts = fileList
  .filter(f => f.endsWith('.min.js') && !f.startsWith('web-theme'))
  .sort((a, b) => (a.startsWith('vendors') === b.startsWith('vendors') ? 0 : a.startsWith('vendors') ? -1 : 1));
const styles = fileList.filter(f => f.endsWith('.min.css'));

const linkTags = styles.map(f => `  <link rel="stylesheet" href="prod/${f}">`).join('\n');
const scriptTags = scripts.map(f => `  <script src="prod/${f}"></script>`).join('\n');

let html = readFileSync(join(resDir, 'index.html'), 'utf8');
html = html.replace('</head>', `${linkTags}\n</head>`);
html = html.replace('</body>', `${scriptTags}\n</body>`);

rmSync(siteDir, {recursive: true, force: true});
mkdirSync(siteDir, {recursive: true});
cpSync(prodDir, join(siteDir, 'prod'), {recursive: true});
cpSync(scoutFontsDir, join(siteDir, 'prod', 'fonts'), {recursive: true});
// Our custom icon font (scoutkit-icons.woff2, committed under res/fonts) lives next to Scout's fonts
// so the theme CSS's relative url(fonts/...) resolves the same way.
cpSync(join(resDir, 'fonts'), join(siteDir, 'prod', 'fonts'), {recursive: true});
cpSync(resDir, siteDir, {recursive: true}); // brings config.js (and the raw index.html, overwritten next)
writeFileSync(join(siteDir, 'index.html'), html);

console.log(`Generated static site at ${siteDir}`);
console.log(`  fonts  : ${scoutFontsDir}`);
console.log(`  styles : ${styles.join(', ') || '(none)'}`);
console.log(`  scripts: ${scripts.join(', ') || '(none)'}`);
