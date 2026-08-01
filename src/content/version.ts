/**
 * SNB version detection module.
 * 
 * Fetches version from /release/release-version.json and caches it.
 * Use this to handle version-specific UI differences or feature availability.
 */

const VERSION_URL = '/release/release-version.json';
const VERSION_CACHE_KEY = 'snb-version';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface VersionCache {
  version: string;
  fetchedAt: number;
}

let cachedVersion: string | null = null;

/**
 * Parses a semver version string into its components.
 * Supports formats like "26.7.0", "26.7.0-beta.1", etc.
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compares two version strings.
 * Returns:
 *   - positive number if a > b
 *   - negative number if a < b
 *   - 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);
  
  if (!parsedA || !parsedB) {
    throw new Error(`Invalid version format: ${a} or ${b}`);
  }
  
  if (parsedA.major !== parsedB.major) return parsedA.major - parsedB.major;
  if (parsedA.minor !== parsedB.minor) return parsedA.minor - parsedB.minor;
  return parsedA.patch - parsedB.patch;
}

/**
 * Checks if version a is greater than or equal to version b.
 */
export function isVersionGte(a: string, b: string): boolean {
  return compareVersions(a, b) >= 0;
}

/**
 * Checks if version a is less than version b.
 */
export function isVersionLt(a: string, b: string): boolean {
  return compareVersions(a, b) < 0;
}

/**
 * Fetches the SNB version from /release/release-version.json.
 * Results are cached in memory and in sessionStorage.
 */
export async function fetchSnbVersion(): Promise<string | null> {
  // Return in-memory cache if available
  if (cachedVersion) {
    return cachedVersion;
  }
  
  // Check sessionStorage cache
  try {
    const cached = sessionStorage.getItem(VERSION_CACHE_KEY);
    if (cached) {
      const { version, fetchedAt } = JSON.parse(cached) as VersionCache;
      if (Date.now() - fetchedAt < CACHE_TTL_MS) {
        cachedVersion = version;
        return version;
      }
    }
  } catch {
    // Ignore parse errors
  }
  
  // Fetch from API
  try {
    const response = await fetch(VERSION_URL, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      console.error(`[SNB Extension] Failed to fetch version: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const version = data.version;
    
    if (typeof version !== 'string') {
      console.error('[SNB Extension] Invalid version response:', data);
      return null;
    }
    
    // Cache the result
    cachedVersion = version;
    try {
      sessionStorage.setItem(VERSION_CACHE_KEY, JSON.stringify({
        version,
        fetchedAt: Date.now(),
      } as VersionCache));
    } catch {
      // sessionStorage might be unavailable
    }
    
    return version;
  } catch (e) {
    console.error('[SNB Extension] Error fetching version:', e);
    return null;
  }
}

/**
 * Gets the cached version without fetching.
 * Returns null if version hasn't been fetched yet.
 */
export function getCachedVersion(): string | null {
  return cachedVersion;
}

/**
 * Clears the version cache, forcing a fresh fetch on next call.
 */
export function clearVersionCache(): void {
  cachedVersion = null;
  try {
    sessionStorage.removeItem(VERSION_CACHE_KEY);
  } catch {
    // Ignore
  }
}

// Convenience constants for common version checks
// Update these as needed for your feature requirements
export const VERSION_26_7_0 = '26.7.0';
export const VERSION_27_0_0 = '27.0.0';
