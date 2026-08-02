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
 */
function createSampleToolsButton(eid: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = BUTTON_ID;
  btn.title = 'Sample Tools';
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    transition: background 0.2s;
  `;
  
  // Lightning icon SVG
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #666;">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  `;

  // Hover styles
  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#f0f0f0';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent';
  });

  // Click handler - currently outputs EID, will be extended with more features
  btn.addEventListener('click', () => {
    console.log(`[SNB Extension] Sample Tools - Container EID: ${eid}`);
  });

  return btn;
}

/**
 * Finds the Sample table toolbar element.
 * Returns null if not found.
 */
function findSampleTableToolbar(): HTMLElement | null {
  // SNB uses various class patterns for toolbar
  // Try multiple selectors to find the toolbar
  const selectors = [
    '[class*="toolbar"]',
    '[class*="Toolbar"]',
    '[class*="sample-table"] [class*="toolbar"]',
    '[class*="SampleTable"] [class*="toolbar"]',
  ];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    for (const el of elements) {
      // Check if this toolbar is in the visible viewport area
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        // Additional check: toolbar should have button-like children
        const hasButtons = el.querySelector('button') !== null;
        if (hasButtons) {
          return el;
        }
      }
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

  // Find toolbar
  const toolbar = findSampleTableToolbar();
  if (!toolbar) {
    return false;
  }

  // Create and inject button at the end of toolbar
  const btn = createSampleToolsButton(eid);
  toolbar.appendChild(btn);
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
