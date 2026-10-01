'use client';

import { Client } from '@stellar/stellar-sdk/contract';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/toast/ToastProvider';
import { useWallet, type WalletSignTransaction } from '@/components/wallet/WalletProvider';
import type { DonationVaultMethods } from './contractTypes';

import { DONATION_VAULT_CONTRACT_ID, NETWORK_PASSPHRASE, SOROBAN_RPC_URL } from './stellar';

type DonationVaultClient = Client & DonationVaultMethods;

/**
 * Fetches a fresh client rather than reusing a cached singleton: Client.from
 * is async (it fetches the contract's spec from the network) and this is
 * cheap enough not to bother caching at this layer — useDonationVaultClient
 * below is what actually caches one, for the UI's benefit.
 */
export async function getDonationVaultClient(
  publicKey: string,
  signTransaction: WalletSignTransaction,
) {
  if (!DONATION_VAULT_CONTRACT_ID) {
    throw new Error('NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID is not set');
  }

  const client = await Client.from({
    contractId: DONATION_VAULT_CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
    signTransaction,
  });

  return client as DonationVaultClient;
}

/**
 * Builds the donation vault client as soon as a wallet is connected, rather
 * than waiting for the first click on a contract-calling button — without
 * this, the WASM spec fetch inside Client.from (a few seconds on a slow
 * connection) would happen *after* the click, and any button that isn't
 * separately guarded would appear clickable, then throw.
 *
 * `ready` is what callers should disable their contract-calling buttons on;
 * `client` is null until then and while the wallet is disconnected.
 */
export function useDonationVaultClient(): { client: DonationVaultClient | null; ready: boolean } {
  const { address, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [client, setClient] = useState<DonationVaultClient | null>(null);

  useEffect(() => {
    if (!address) {
      setClient(null);
      return;
    }

    let cancelled = false;
    setClient(null);

    getDonationVaultClient(address, signTransaction)
      .then((c) => {
        if (!cancelled) {
          setClient(c);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          showToast(
            'error',
            err instanceof Error ? `Couldn't reach the donation contract: ${err.message}` : `Couldn't reach the donation contract.`,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, signTransaction, showToast]);

  return { client, ready: client !== null };
}
