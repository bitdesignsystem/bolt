import { polyfillLoader } from '@bolt/core-v3.x/polyfills';

polyfillLoader.then(res => {
  import(
    /* webpackMode: 'eager', webpackChunkName: 'bolt-stack' */ './src/stack'
  );
});
