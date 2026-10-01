import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ImpactPage from './page';
import { loadPlatformImpact, type PlatformImpact } from '@/lib/impact';

// The impact page renders <Header />, which reads the wallet context; give it
// a signed-out static value the same way Header.test.tsx does.
vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({
    address: null,
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
    networkMismatch: false,
  }),
}));

vi.mock('@/lib/impact', () => ({
  loadPlatformImpact: vi.fn(),
}));

const IMPACT: PlatformImpact = {
  totalCommitted: 1_234_500_000n,
  totalWithdrawn: 567_800_000n,
  activeStreams: 12,
  ngoCount: 4,
};

// Must match page.tsx's POLL_INTERVAL_MS so advancing one interval is
// exactly one poll.
const POLL_INTERVAL_MS = 20_000;

describe('ImpactPage error recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('recovers from an API failure on the next poll', async () => {
    // Fail on the first call (initial load), succeed on the second (poll) —
    // exactly the recovery flow fixed in #39.
    const load = vi.mocked(loadPlatformImpact);
    load.mockRejectedValueOnce(new TypeError('fetch failed'));
    load.mockResolvedValueOnce(IMPACT);

    render(<ImpactPage />);

    // Flush the initial load's rejected promise (findBy* can't be used here:
    // RTL's wait-for polling relies on timers, which are frozen while fake
    // timers are active).
    await act(async () => {});

    // First call failed and nothing was ever loaded: the page shows the
    // hard error state, not the numbers.
    expect(screen.getByText(/Couldn't reach the StreamGive API/i)).toBeInTheDocument();
    expect(screen.queryByText('Total committed')).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);

    // One poll interval passes; the refetch succeeds this time.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    await act(async () => {});

    // The page transitions from the error state to the data.
    expect(screen.getByText('Total committed')).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't reach the StreamGive API/i)).not.toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // Verified NGOs
    expect(load).toHaveBeenCalledTimes(2);
  });
});
