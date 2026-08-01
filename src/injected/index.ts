import { BRIDGE_SOURCE, isBridgeMessage } from '@shared/messaging';

/**
 * Runs in the page's main world (see content_scripts world: "MAIN" wiring
 * once this is registered dynamically alongside the content script). Use
 * this bridge when an enhancement needs access to page-context globals
 * (e.g. a Redux store instance) that the isolated-world content script
 * cannot reach directly. Communicate back via window.postMessage.
 */
window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin || !isBridgeMessage(event.data)) return;
  if (event.data.type === 'PING') {
    window.postMessage({ source: BRIDGE_SOURCE, type: 'PONG' }, window.location.origin);
  }
});
