/**
 * Sample Enhancement module.
 * 
 * Monitors URL changes and injects enhancement controls into the Sample table toolbar
 * when the URL focus parameter indicates a samplesContainer context. This module
 * provides various enhancements for Sample data, starting with EID retrieval.
 */

import throttle from 'lodash.throttle';

const BUTTON_ID = 'snb-ext-sample-tools-btn';
const MODAL_ID = 'snb-ext-sample-tools-modal';
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
  return focus.slice(SAMPLES_CONTAINER_FOCUS_PREFIX.length);
}

/**
 * Fetches samplesContainer data from SNB API.
 */
async function fetchSamplesContainerData(eid: string): Promise<{eid: string; name: string; samples: {id: string; name: string}[]} | null> {
  try {
    // Get current page's origin for API calls
    const baseUrl = window.location.origin;
    
    // Fetch samplesContainer details
    const response = await fetch(`${baseUrl}/api/rest/v1/samplesContainers/${eid}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[SNB Extension] API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (e) {
    console.error('[SNB Extension] Error fetching samplesContainer:', e);
    return null;
  }
}

/**
 * Creates the Modal element with simple CSS styling.
 */
function createModal(): HTMLElement {
  // Modal overlay (backdrop)
  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  `;
  
  // Modal container
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow: auto;
  `;
  
  // Modal header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #e8e8e8;
  `;
  header.innerHTML = `
    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Sample Tools</h3>
    <button id="snb-ext-modal-close" style="
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      padding: 0 4px;
      line-height: 1;
    ">×</button>
  `;
  
  // Modal content
  const content = document.createElement('div');
  content.id = 'snb-ext-modal-content';
  content.style.cssText = `
    padding: 20px;
  `;
  content.innerHTML = `<p style="color: #666; text-align: center;">Loading...</p>`;
  
  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });
  
  // Close button
  const closeBtn = header.querySelector('#snb-ext-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  return overlay;
}

/**
 * Closes and removes the modal.
 */
function closeModal(): void {
  const modal = document.getElementById(MODAL_ID);
  if (modal) {
    modal.remove();
  }
}

/**
 * Updates the modal content with samplesContainer data.
 */
function updateModalContent(data: {eid: string; name: string; samples: {id: string; name: string}[]} | null, eid: string): void {
  const content = document.getElementById('snb-ext-modal-content');
  if (!content) return;
  
  if (!data) {
    content.innerHTML = `
      <div style="text-align: center; color: #999;">
        <p>Failed to load data</p>
        <p style="font-size: 12px; color: #666;">EID: ${eid}</p>
      </div>
    `;
    return;
  }
  
  const sampleCount = data.samples?.length || 0;
  const sampleList = data.samples?.map((s) => `<li>${s.name || s.id}</li>`).join('') || '';
  
  content.innerHTML = `
    <div>
      <div style="margin-bottom: 16px;">
        <label style="font-size: 12px; color: #999; display: block; margin-bottom: 4px;">Container EID</label>
        <code style="font-size: 13px; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; word-break: break-all;">${data.eid || eid}</code>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="font-size: 12px; color: #999; display: block; margin-bottom: 4px;">Container Name</label>
        <span style="font-size: 14px;">${data.name || 'N/A'}</span>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="font-size: 12px; color: #999; display: block; margin-bottom: 4px;">Sample Count</label>
        <span style="font-size: 24px; font-weight: 600;">${sampleCount}</span>
      </div>
      ${sampleCount > 0 ? `
      <div>
        <label style="font-size: 12px; color: #999; display: block; margin-bottom: 8px;">Samples</label>
        <ul style="margin: 0; padding-left: 20px; max-height: 200px; overflow-y: auto;">
          ${sampleList}
        </ul>
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Opens the modal and fetches data.
 */
async function openModal(eid: string): Promise<void> {
  // Remove existing modal if any
  closeModal();
  
  // Create and append modal
  const modal = createModal();
  document.body.appendChild(modal);
  
  // Fetch data
  const data = await fetchSamplesContainerData(eid);
  updateModalContent(data, eid);
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

  // Click handler - opens modal
  btn.addEventListener('click', () => {
    openModal(eid);
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
