import { afterEach, describe, expect, it, vi } from 'vitest';

import { getNgos, getStreams } from './api';

// A hung/unreachable backend must surface as a rejected promise rather than
// resolve to something falsy. AbortSignal.timeout() rejects fetch with a
// TimeoutError, and an offline network / DNS failure rejects it with
// TypeError ("fetch failed") — api.ts has no try/catch, so both must
// propagate to the caller untouched.
const networkFailure = new TypeError('fetch failed');

describe('api network errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getNgos rejects when fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw networkFailure;
      }),
    );

    await expect(getNgos()).rejects.toThrow(TypeError);
    await expect(getNgos()).rejects.toThrow('fetch failed');
  });

  it('getStreams rejects when fetch itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw networkFailure;
      }),
    );

    await expect(getStreams({ donor: 'GABC' })).rejects.toThrow(TypeError);
    await expect(getStreams({ donor: 'GABC' })).rejects.toThrow('fetch failed');
  });
});
