'use client';

import { useWallet } from '@/components/wallet/WalletProvider';

/**
 * The "please connect your wallet" card shown in place of a protected
 * page/form's content — dashboard, NGO admin, platform admin, and the
 * donate form all show one differing only in their message.
 */
export function ConnectWalletPrompt({
  message,
  className = '',
}: {
  message: string;
  className?: string;
}) {
  const { connect } = useWallet();

  return (
    <div
      className={`rounded-lg border border-gray-200 p-6 text-center dark:border-gray-800 ${className}`}
    >
      <p className="text-gray-600 dark:text-gray-400">{message}</p>
      <button
        type="button"
        onClick={() => void connect()}
        className="mt-4 rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
      >
        Connect Wallet
      </button>
    </div>
  );
}
