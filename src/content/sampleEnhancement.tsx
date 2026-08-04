/**
 * Sample Enhancement module.
 * 
 * Monitors URL changes and injects enhancement controls into the Sample table toolbar
 * when the URL focus parameter indicates a samplesContainer context. This module
 * provides various enhancements for Sample data using React + antd.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import throttle from 'lodash.throttle';
import { ConfigProvider, App } from 'antd';
import { SampleToolsModal } from './SampleToolsModal';

const BUTTON_ID = 'snb-ext-sample-tools-btn';
const REACT_ROOT_ID = 'snb-ext-sample-tools-root';
const SAMPLES_CONTAINER_FOCUS_PREFIX = 'samplesContainer:';
const TOOLBAR_OBSERVER_THROTTLE_MS = 200;

let reactRoot: ReturnType<typeof createRoot> | null = null;

/**
 * Parses the samplesContainer EID from the URL's focus parameter.
 * Returns the full EID (entityType:uuid) or null if not matching.
 */
function parseSamplesContainerEid(): string | null {
  const params = new URLSearchParams(window.location.search);
  const focus = params.get('focus');
  if (!focus || !focus.startsWith(SAMPLES_CONTAINER_FOCUS_PREFIX)) {
    return null;
  }
  // Return full EID format: samplesContainer:uuid
  return focus;
}

/**
 * React App component that manages the Modal state.
 */
const SampleToolsApp: React.FC<{ eid: string }> = ({ eid }) => {
  const [open, setOpen] = React.useState(false);

  const handleOpen = React.useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = React.useCallback(() => {
    setOpen(false);
  }, []);

  // Expose open/close globally so the toolbar button (plain DOM, outside
  // this tree) can drive it, and so dev-only hot reload cleanup (see
  // registerHotReloadCleanup below) can close the Modal before tearing the
  // whole root down.
  React.useEffect(() => {
    const win = window as unknown as { __snbExtOpenModal?: () => void; __snbExtCloseModal?: () => void };
    win.__snbExtOpenModal = handleOpen;
    win.__snbExtCloseModal = handleClose;
    return () => {
      delete win.__snbExtOpenModal;
      delete win.__snbExtCloseModal;
    };
  }, [handleOpen, handleClose]);

  return (
    <SampleToolsModal
      open={open}
      eid={eid}
      onClose={handleClose}
    />
  );
};

/**
 * Gets or creates the React root container.
 */
function getReactRoot(): HTMLElement {
  let root = document.getElementById(REACT_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = REACT_ROOT_ID;
    document.body.appendChild(root);
    
    // Initialize React root
    reactRoot = createRoot(root);
  }
  return root;
}

/**
 * Renders the React app with the Modal.
 */
function renderReactApp(eid: string): void {
  const root = getReactRoot();
  if (!reactRoot) {
    reactRoot = createRoot(root);
  }
  
  registerHotReloadCleanup();

  reactRoot.render(
    <React.StrictMode>
      <ConfigProvider>
        <App>
          <SampleToolsApp eid={eid} />
        </App>
      </ConfigProvider>
    </React.StrictMode>
  );
}

/**
 * Exposes a cleanup hook on `window` so a later re-injection of this
 * content script (see src/background/index.ts's dev-only hot reload) can
 * properly tear this React root down *before* the new script's top-level
 * re-declarations run.
 *
 * This matters because the bundle's module bindings (React, ReactDOM, the
 * scheduler, ...) are plain top-level `var`s, not real per-execution ES
 * module scopes — re-running the bundle in the same isolated world
 * immediately reassigns those globals to a brand new, never-rendered copy.
 * If this root is still mounted when that happens, its next re-render
 * calls hooks against that fresh copy's (unset) dispatcher and crashes
 * with "Invalid hook call" / "Cannot read properties of null (reading
 * 'useCallback')". Synchronously unmounting first, using the *old* (still
 * intact) React copy, avoids that entirely.
 */
function registerHotReloadCleanup(): void {
  const win = window as unknown as {
    __snbExtCleanup?: () => Promise<void>;
    __snbExtOpenModal?: () => void;
    __snbExtCloseModal?: () => void;
  };
  win.__snbExtCleanup = async () => {
    try {
      // Close the Modal through its normal state-driven path first and let
      // its exit transition finish — force-unmounting straight through
      // root.unmount() while an antd Modal/Portal is open reliably crashes
      // with "Invalid hook call" while React processes deletion effects for
      // the open Portal (an antd/rc-dialog issue with synchronously tearing
      // down an open Portal's fiber subtree, not the classic "two copies of
      // React" cause that error usually points to).
      win.__snbExtCloseModal?.();
      await new Promise((resolve) => setTimeout(resolve, 400));
      reactRoot?.unmount();
    } catch (e) {
      console.warn('[SNB Extension] Error unmounting previous React root during hot reload cleanup:', e);
    } finally {
      document.getElementById(REACT_ROOT_ID)?.remove();
      document.getElementById(BUTTON_ID)?.remove();
      delete win.__snbExtOpenModal;
      delete win.__snbExtCloseModal;
      delete win.__snbExtCleanup;
    }
  };
}

/**
 * Creates the toolbar button element with lightning icon.
 * Wrapped in a container div to match SNB's DOM structure.
 */
function createSampleToolsButton(): HTMLElement {
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

  // Click handler - opens modal via global function
  btn.addEventListener('click', () => {
    const openModal = (window as unknown as { __snbExtOpenModal?: () => void }).__snbExtOpenModal;
    if (openModal) {
      openModal();
    }
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
    return false;
  }

  // Create and inject button
  const btn = createSampleToolsButton();
  headerControls.appendChild(btn);
  console.log(`[SNB Extension] Sample Tools button injected for ${eid}`);
  
  // Initialize React app if not already
  if (!document.getElementById(REACT_ROOT_ID)) {
    renderReactApp(eid);
  }
  
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
