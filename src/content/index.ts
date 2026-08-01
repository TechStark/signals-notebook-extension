import { mountHost } from './mount';

/**
 * Entry point for the dynamically-registered content script (see
 * src/background/index.ts). Keep this file a thin bootstrapper — actual
 * enhancements live in their own modules under src/content/.
 */
mountHost();
