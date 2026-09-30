'use client';

import { NETWORK_NAME } from '@/lib/stellar';

import { useWallet } from './WalletProvider';

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, connecting, connect, disconnect, networkMismatch } = useWallet();

  if (address) {
    return (
      <span className="flex items-center gap-2">
        {networkMismatch && (
          <span
            role="alert"
            title={`Your wallet is on a different network. Switch it to ${NETWORK_NAME} before making transactions.`}
            className="text-xs font-medium text-red-600 dark:text-red-400"
          >
            Wrong network
          </span>
        )}
        <button
          type="button"
          onClick={disconnect}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-gray-700 dark:hover:bg-gray-800 dark:focus-visible:ring-teal-400"
          title={address}
          aria-label={`Connected as ${address}. Click to disconnect.`}
        >
          {truncateAddress(address)}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void connect()}
      disabled={connecting}
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200 dark:focus-visible:ring-teal-400"
    >
      {connecting ? 'Connecting…' : 'Connect Wallet'}
    </button>
  );
}
