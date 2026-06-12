const baseConfig = require('@eclipse-scout/cli/scripts/webpack-defaults');

module.exports = (env, args) => {
  args.resDirArray = ['res'];
  const config = baseConfig(env, args);
  config.entry = {
    'demo': './src/index.ts',
    'demo-theme': './src/index.less'
  };
  return config;
};
