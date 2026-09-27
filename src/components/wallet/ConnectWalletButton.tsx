'use client';

import { useWallet } from './WalletProvider';

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, connecting, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        type="button"
        onClick={disconnect}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        title={address}
        aria-label={`Connected as ${address}. Click to disconnect.`}
      >
        {truncateAddress(address)}
      </button>
    );
  }

  if (connecting) {
    return (
      <span className="flex items-center text-sm text-gray-500 dark:text-gray-400 px-4 py-2">
        <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
        </svg>
        Connecting…
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void connect()}
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
    >
      Connect Wallet
    </button>
  );
}
