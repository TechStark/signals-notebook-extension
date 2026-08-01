const HOST_ID = 'signals-notebook-extension-root';

/**
 * Mounts a Shadow DOM host on document.documentElement (never managed by
 * React, so React re-renders/route changes can't unmount it) and keeps it
 * re-attached if the SPA ever removes it. Enhancement modules should render
 * into the returned shadow root rather than touching the page DOM directly.
 */
export function mountHost(): ShadowRoot {
  const existing = document.getElementById(HOST_ID) as (HTMLElement & { shadowRoot: ShadowRoot }) | null;
  if (existing?.shadowRoot) return existing.shadowRoot;

  const host = document.createElement('div');
  host.id = HOST_ID;
  document.documentElement.appendChild(host);
  const shadowRoot = host.attachShadow({ mode: 'open' });

  new MutationObserver(() => {
    if (!document.getElementById(HOST_ID)) {
      document.documentElement.appendChild(host);
    }
  }).observe(document.documentElement, { childList: true });

  return shadowRoot;
}
