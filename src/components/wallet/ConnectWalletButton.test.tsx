import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConnectWalletButton } from './ConnectWalletButton';

const ADDRESS = 'GA4Z4GPSO3FKPMQJ3WCMU5D5WE25SDXZS47YDF3J3NWF65ILGCVJVWIJ';
const TRUNCATED = `${ADDRESS.slice(0, 4)}…${ADDRESS.slice(-4)}`;

// useWallet is a real hook here (backed by useState), not a plain vi.fn()
// stub — ConnectWalletButton has no state of its own, so disconnect only
// has something to re-render against if this mock actually holds state
// the way the real WalletProvider context would.
vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => {
    const [address, setAddress] = useState<string | null>(ADDRESS);
    return {
      address,
      connecting: false,
      connect: vi.fn(),
      disconnect: () => setAddress(null),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
      networkMismatch: false,
    };
  },
}));

describe('ConnectWalletButton disconnect flow', () => {
  it('shows the truncated address while connected, then returns to Connect Wallet after clicking disconnect', async () => {
    const user = userEvent.setup();
    render(<ConnectWalletButton />);

    const disconnectButton = screen.getByRole('button', {
      name: `Connected as ${ADDRESS}. Click to disconnect.`,
    });
    expect(disconnectButton).toHaveTextContent(TRUNCATED);

    await user.click(disconnectButton);

    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: `Connected as ${ADDRESS}. Click to disconnect.` }),
    ).not.toBeInTheDocument();
  });
});
