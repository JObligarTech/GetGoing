module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Must be last: Reanimated/worklets plugin.
    plugins: ["react-native-worklets/plugin"],
  };
};
