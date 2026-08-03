/**
 * Sample Enhancement module.
 * 
 * Monitors URL changes and injects enhancement controls into the Sample table toolbar
 * when the URL focus parameter indicates a samplesContainer context. This module
 * provides various enhancements for Sample data, starting with EID retrieval.
 */

import throttle from 'lodash.throttle';

const BUTTON_ID = 'snb-ext-sample-tools-btn';
const SAMPLES_CONTAINER_FOCUS_PREFIX = 'samplesContainer:';
const TOOLBAR_OBSERVER_THROTTLE_MS = 200;

/**
 * Parses the samplesContainer EID from the URL's focus parameter.
 * Returns null if focus parameter doesn't match samplesContainer pattern.
 */
function parseSamplesContainerEid(): string | null {
  const params = new URLSearchParams(window.location.search);
  const focus = params.get('focus');
  if (!focus || !focus.startsWith(SAMPLES_CONTAINER_FOCUS_PREFIX)) {
    return null;
  }
  return focus;
}

/**
 * Creates the toolbar button element with lightning icon.
 * Wrapped in a container div to match SNB's DOM structure.
 */
function createSampleToolsButton(eid: string): HTMLElement {
  // Container with display: contents (SNB pattern)
  const container = document.createElement('div');
  container.style.display = 'contents';
  container.id = BUTTON_ID;
  
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = 'Sample Tools';
  btn.className = 'd-flex align-items-center justify-content-center text-gray-500 text-gray-700-hover text-gray-700-focus btn btn-icon';
  
  // Inner span (SNB pattern)
  const span = document.createElement('span');
  span.className = 'd-inline-flex align-items-center';
  
  // Lightning icon SVG (simple bolt design)
  span.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: inherit;">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  `;
  
  btn.appendChild(span);
  container.appendChild(btn);

  // Click handler - currently outputs EID, will be extended with more features
  btn.addEventListener('click', () => {
    console.log(`[SNB Extension] Sample Tools - Container EID: ${eid}`);
  });

  return container;
}

/**
 * Finds the Sample table header controls container within the focused binder element.
 * Returns the header controls where action buttons live, or null if not found.
 */
function findSampleHeaderControls(): HTMLElement | null {
  // Find the focused binder element (the one with samplesContainer content)
  const focusedElement = document.querySelector<HTMLElement>('.binder__element--focused');
  if (!focusedElement) {
    return null;
  }
  
  // Within the focused element, find the header controls that contain action buttons
  const controls = focusedElement.querySelectorAll<HTMLElement>('.binder__element-header-controls');
  
  // Find the one that contains action buttons (btnElementTrash, action.exportToClipboard, etc.)
  for (const control of Array.from(controls).reverse()) {
    const hasActionButtons = control.querySelector('button[id^="action."], button[id^="btnElement"]') !== null;
    if (hasActionButtons) {
      return control;
    }
  }
  
  return null;
}

/**
 * Injects the enhancement button into the toolbar if conditions are met.
 * Returns true if button was injected, false otherwise.
 */
function tryInjectButton(): boolean {
  // Check if button already exists
  if (document.getElementById(BUTTON_ID)) {
    return true;
  }

  // Check URL for samplesContainer focus
  const eid = parseSamplesContainerEid();
  if (!eid) {
    return false;
  }

  // Find sample header controls
  const headerControls = findSampleHeaderControls();
  if (!headerControls) {
    console.debug('[SNB Extension] Sample Tools: header controls not found');
    return false;
  }

  // Create and inject button
  const btn = createSampleToolsButton(eid);
  headerControls.appendChild(btn);
  console.log(`[SNB Extension] Sample Tools button injected for ${eid}`);
  
  return true;
}

/**
 * Removes the enhancement button if present.
 */
function removeButton(): void {
  const btn = document.getElementById(BUTTON_ID);
  if (btn) {
    btn.remove();
  }
}

/**
 * Handles URL changes - inject or remove button as needed.
 */
function handleUrlChange(): void {
  const eid = parseSamplesContainerEid();
  if (eid) {
    // Try to inject immediately
    if (!tryInjectButton()) {
      // Toolbar not ready, will retry via MutationObserver
    }
  } else {
    // Not a samplesContainer context, remove button
    removeButton();
  }
}

/**
 * Sets up MutationObserver to detect toolbar appearance and inject button.
 */
function setupToolbarObserver(): void {
  const throttledCheck = throttle(() => {
    const eid = parseSamplesContainerEid();
    if (eid) {
      tryInjectButton();
    }
  }, TOOLBAR_OBSERVER_THROTTLE_MS);

  const observer = new MutationObserver(throttledCheck);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Sets up URL change detection for SPA navigation.
 */
function setupUrlChangeListener(): void {
  // Handle browser back/forward
  window.addEventListener('popstate', handleUrlChange);

  // Intercept pushState
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    const result = originalPushState.apply(history, args);
    handleUrlChange();
    return result;
  };

  // Intercept replaceState
  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(history, args);
    handleUrlChange();
    return result;
  };
}

/**
 * Initializes the Sample Enhancement module.
 */
export function initSampleEnhancement(): void {
  // Initial check
  handleUrlChange();
  
  // Set up listeners
  setupUrlChangeListener();
  setupToolbarObserver();
  
  console.log('[SNB Extension] Sample Enhancement module initialized');
}
