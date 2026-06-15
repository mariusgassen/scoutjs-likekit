const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const baseConfig = require('@eclipse-scout/cli/scripts/webpack-defaults');

module.exports = (env, args) => {
  args.resDirArray = ['res'];
  const config = baseConfig(env, args);
  config.entry = {
    'web': './src/index.ts',
    'web-theme': './src/index.less'
  };

  // Scout core ships its UI translations (texts.json) and locale metadata (locales.json) in its
  // dist folder, but `scout-scripts build` does not emit them (a Scout RT host server normally
  // serves them). Copy them into the `res` output (alongside index.html/config.js) so the app can
  // load them on bootstrap (see src/index.ts) — otherwise every Scout core text renders as
  // "[undefined text: <key>]". @eclipse-scout/core only exports its `import` entry and `./src/*`,
  // so resolve the source dir to reach the sibling dist folder.
  const scoutCoreDist = path.join(path.dirname(require.resolve('@eclipse-scout/core/src/index.ts')), '..', 'dist');
  const resOutDir = path.resolve(config.output.path, '..', 'res');
  config.plugins.push(new CopyPlugin({
    patterns: [
      {from: path.join(scoutCoreDist, 'texts.json'), to: path.join(resOutDir, 'texts.json')},
      {from: path.join(scoutCoreDist, 'locales.json'), to: path.join(resOutDir, 'locales.json')}
    ]
  }));

  return config;
};
