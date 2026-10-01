import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectWalletButton } from './ConnectWalletButton';
import { useWallet, WalletProvider } from './WalletProvider';

const TEST_ADDRESS = 'G' + 'A'.repeat(55);
// Matches src/lib/stellar.ts's NETWORK_PASSPHRASE default, so tests don't
// have to set NEXT_PUBLIC_NETWORK_PASSPHRASE just to assert against it.
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

const mockGetAddress = vi.fn();
const mockAuthModal = vi.fn();
const mockSignMessage = vi.fn();
// Defaults to the app's own configured network, i.e. "no mismatch" — tests
// that care about a mismatch override this per-test.
const mockGetNetwork = vi.fn().mockResolvedValue({
  network: 'TESTNET',
  networkPassphrase: NETWORK_PASSPHRASE,
});

vi.mock('@creit.tech/stellar-wallets-kit/sdk', () => ({
  StellarWalletsKit: {
    init: vi.fn(),
    getAddress: (...args: unknown[]) => mockGetAddress(...args),
    authModal: (...args: unknown[]) => mockAuthModal(...args),
    getNetwork: (...args: unknown[]) => mockGetNetwork(...args),
    signTransaction: vi.fn(),
    signMessage: (...args: unknown[]) => mockSignMessage(...args),
  },
}));

vi.mock('@creit.tech/stellar-wallets-kit/modules/utils', () => ({
  defaultModules: () => [],
}));

function renderButton() {
  return render(
    <WalletProvider>
      <ConnectWalletButton />
    </WalletProvider>,
  );
}

/** Exposes signMessage's outcome as text, since no UI button triggers it
 * directly — WalletProvider's consumers (adminApi.ts) call it programmatically. */
function SignMessageProbe({ message }: { message: string }) {
  const { signMessage } = useWallet();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      onClick={() => {
        signMessage(message)
          .then(setResult)
          .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
      }}
    >
      {error ? `Error: ${error}` : (result ?? 'Sign')}
    </button>
  );
}

function renderSignMessageProbe(message = 'hello') {
  return render(
    <WalletProvider>
      <SignMessageProbe message={message} />
    </WalletProvider>,
  );
}

describe('wallet connect flow', () => {
  beforeEach(() => {
    mockGetAddress.mockReset();
    mockAuthModal.mockReset();
  });

  it('shows "Connect Wallet" when no session is restored', async () => {
    // getAddress() rejecting is the documented "nothing connected yet"
    // case — not an error, the common cold-start state.
    mockGetAddress.mockRejectedValue(new Error('not connected'));

    renderButton();

    expect(await screen.findByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('restores an already-authorized session on mount', async () => {
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });

    renderButton();

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('GAAA…AAAA');
    });
  });

  it('shows the truncated address after connecting via the modal', async () => {
    mockGetAddress.mockRejectedValue(new Error('not connected'));
    mockAuthModal.mockResolvedValue({ address: TEST_ADDRESS });

    const user = userEvent.setup();
    renderButton();

    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('GAAA…AAAA');
    });
  });

  it('forgets the address on disconnect without an SDK call', async () => {
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });

    const user = userEvent.setup();
    renderButton();

    // Looked up by role alone, not accessible name: the connected button's
    // aria-label carries the full address for screen readers, while its
    // visible text content is the truncated form — matched by text in the
    // other tests above.
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('GAAA…AAAA');
    });
    await user.click(screen.getByRole('button'));

    expect(await screen.findByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });
});

describe('signMessage (SEP-53)', () => {
  beforeEach(() => {
    mockGetAddress.mockReset();
    mockSignMessage.mockReset();
    // Every test here needs an already-connected wallet — signMessage
    // throws locally, with no SDK call at all, when address is null.
    mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS });
  });

  it('returns the signature and passes the connected address and network', async () => {
    mockSignMessage.mockResolvedValue({ signedMessage: 'c2lnbmVkLXBheWxvYWQ=' });

    const user = userEvent.setup();
    renderSignMessageProbe('sign-me');

    await user.click(await screen.findByRole('button', { name: 'Sign' }));

    expect(await screen.findByRole('button', { name: 'c2lnbmVkLXBheWxvYWQ=' })).toBeInTheDocument();
    expect(mockSignMessage).toHaveBeenCalledWith('sign-me', {
      address: TEST_ADDRESS,
      networkPassphrase: NETWORK_PASSPHRASE,
    });
  });

  it('rejects when no wallet is connected, without calling the SDK', async () => {
    mockGetAddress.mockRejectedValue(new Error('not connected'));

    const user = userEvent.setup();
    renderSignMessageProbe();

    // Wait for the "not connected" restore attempt to settle before
    // clicking, so the assertion below isn't racing that in-flight effect.
    await waitFor(() => expect(mockGetAddress).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Sign' }));

    expect(await screen.findByRole('button', { name: /error: no wallet connected/i })).toBeInTheDocument();
    expect(mockSignMessage).not.toHaveBeenCalled();
  });
});
