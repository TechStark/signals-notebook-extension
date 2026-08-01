/**
 * Message protocol shared across contexts:
 *  - content  <-> injected: window.postMessage (main world <-> isolated world)
 *  - content  <-> background: chrome.runtime.sendMessage
 *
 * Add new message types here as enhancements are built, rather than
 * defining ad-hoc shapes in each context.
 */

export const BRIDGE_SOURCE = 'signals-notebook-extension' as const;

/** Messages sent between the content script and the main-world injected bridge. */
export type BridgeMessage = { source: typeof BRIDGE_SOURCE; type: 'PING' } | { source: typeof BRIDGE_SOURCE; type: 'PONG' };

export function isBridgeMessage(data: unknown): data is BridgeMessage {
  return typeof data === 'object' && data !== null && (data as Record<string, unknown>).source === BRIDGE_SOURCE;
}

/** Messages sent between the content script and the background service worker. */
export type RuntimeMessage = { type: 'GET_CONFIG' } | { type: 'REQUEST_HOST_PERMISSION'; host: string };
