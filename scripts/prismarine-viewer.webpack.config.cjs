const path = require('node:path');

const viewerConfig = path.resolve(__dirname, '../node_modules/prismarine-viewer/webpack.config.js');
const configs = require(viewerConfig);
const assertPolyfill = require.resolve('assert/');

module.exports = configs.map((config) => ({
    ...config,
    resolve: {
        ...config.resolve,
        fallback: {
            ...config.resolve?.fallback,
            assert: assertPolyfill,
        },
    },
}));
