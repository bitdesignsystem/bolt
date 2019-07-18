import { polyfillLoader } from '@bolt/core/polyfills';

polyfillLoader.then(res => {
  import(
    /* webpackMode: 'eager', webpackChunkName: 'bolt-interactive-step' */ './src/interactive-step'
  );
  import(
    /* webpackMode: 'eager', webpackChunkName: 'bolt-two-character-chat' */ './src/two-character-chat'
  );
});
