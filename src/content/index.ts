import { mountHost } from './mount';
import { fetchSnbVersion, isVersionGte, VERSION_26_7_0 } from './version';
import { initSampleEnhancement } from './sampleEnhancement';

/**
 * Entry point for the dynamically-registered content script (see
 * src/background/index.ts). Keep this file a thin bootstrapper — actual
 * enhancements live in their own modules under src/content/.
 */
async function init() {
  mountHost();
  
  // Fetch and cache SNB version for version-specific feature handling
  const version = await fetchSnbVersion();
  if (version) {
    console.log(`[SNB Extension] Detected version: ${version}`);
    
    // Example: version-specific logic
    if (isVersionGte(version, VERSION_26_7_0)) {
      // Features available in 26.7.0+
    }
  }

  // Initialize Sample Enhancement module
  initSampleEnhancement();
}

init();
