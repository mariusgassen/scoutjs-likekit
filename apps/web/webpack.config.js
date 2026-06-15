const baseConfig = require('@eclipse-scout/cli/scripts/webpack-defaults');

module.exports = (env, args) => {
  args.resDirArray = ['res'];
  const config = baseConfig(env, args);
  config.entry = {
    'web': './src/index.ts',
    'web-theme': './src/index.less'
  };
  return config;
};
