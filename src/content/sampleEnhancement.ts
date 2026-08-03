/**
 * Sample Enhancement module.
 * 
 * Monitors URL changes and injects enhancement controls into the Sample table toolbar
 * when the URL focus parameter indicates a samplesContainer context. This module
 * provides various enhancements for Sample data, starting with EID retrieval.
 */

const BUTTON_ID = 'snb-ext-sample-tools-btn';
const SAMPLES_CONTAINER_FOCUS_PREFIX = 'samplesContainer:';

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
  return focus.slice(SAMPLES_CONTAINER_FOCUS_PREFIX.length);
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
  
  // Lightning icon SVG using FontAwesome-style classes
  span.innerHTML = `
    <svg aria-hidden="true" focusable="false" class="svg-inline--fa fa-bolt fa-lg snb-icon" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512">
      <path fill="currentColor" d="M305 239c9.4 9.4 9.4 24.6 0 33.9L113 465c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l175-175L79 81c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0L305 239z"></path>
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
 * Finds the Sample table header controls container (binder__element-header-controls).
 * Returns the last one (where action buttons live) or null if not found.
 */
function findSampleHeaderControls(): HTMLElement | null {
  // Find all binder__element-header-controls divs
  const controls = document.querySelectorAll<HTMLElement>('.binder__element-header-controls');
  
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
    console.log('[SNB Extension] Sample Tools: header controls not found');
    return false;
  }

  // Create and inject button
  const btn = createSampleToolsButton(eid);
  headerControls.appendChild(btn);
  console.log(`[SNB Extension] Sample Tools button injected for container: ${eid}`);
  
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
  const observer = new MutationObserver(() => {
    const eid = parseSamplesContainerEid();
    if (eid) {
      tryInjectButton();
    }
  });

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
