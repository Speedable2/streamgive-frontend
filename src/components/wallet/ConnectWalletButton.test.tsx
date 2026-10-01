import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConnectWalletButton } from './ConnectWalletButton';
import * as WalletProviderMod from './WalletProvider';

describe('ConnectWalletButton', () => {
  it('renders a loading indicator when connecting is true', () => {
    vi.spyOn(WalletProviderMod, 'useWallet').mockReturnValue({
      address: null,
      connecting: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
    });

    render(<ConnectWalletButton />);

    expect(screen.getByText(/connecting…/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
  });
});
