import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isVersionGte,
  fetchSnbVersion,
  clearVersionCache,
} from './version';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('version', () => {
  beforeEach(() => {
    clearVersionCache();
    mockFetch.mockReset();
  });

  it('compares versions with isVersionGte', () => {
    expect(isVersionGte('27.0.0', '26.7.0')).toBe(true);
    expect(isVersionGte('26.7.0', '26.7.0')).toBe(true);
    expect(isVersionGte('26.6.0', '26.7.0')).toBe(false);
  });

  it('fetches and caches version from API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '26.7.0' }),
    });

    const v1 = await fetchSnbVersion();
    const v2 = await fetchSnbVersion();

    expect(v1).toBe('26.7.0');
    expect(v2).toBe('26.7.0');
    expect(mockFetch).toHaveBeenCalledTimes(1); // cached
  });

  it('returns null on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const version = await fetchSnbVersion();
    expect(version).toBeNull();
  });
});
