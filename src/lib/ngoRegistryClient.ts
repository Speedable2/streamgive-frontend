'use client';

import { Client } from '@stellar/stellar-sdk/contract';
import { useEffect, useState } from 'react';

import { useToast } from '@/components/toast/ToastProvider';
import { useWallet, type WalletSignTransaction } from '@/components/wallet/WalletProvider';
import type { NgoRegistryMethods } from './contractTypes';

import { NETWORK_PASSPHRASE, NGO_REGISTRY_CONTRACT_ID, SOROBAN_RPC_URL } from './stellar';

type NgoRegistryClient = Client & NgoRegistryMethods;

export async function getNgoRegistryClient(
  publicKey: string,
  signTransaction: WalletSignTransaction,
) {
  if (!NGO_REGISTRY_CONTRACT_ID) {
    throw new Error('NEXT_PUBLIC_NGO_REGISTRY_CONTRACT_ID is not set');
  }

  const client = await Client.from({
    contractId: NGO_REGISTRY_CONTRACT_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey,
    signTransaction,
  });

  return client as NgoRegistryClient;
}

/** See useDonationVaultClient's comment — same reasoning, for the NGO
 * registry contract. */
export function useNgoRegistryClient(): { client: NgoRegistryClient | null; ready: boolean } {
  const { address, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [client, setClient] = useState<NgoRegistryClient | null>(null);

  useEffect(() => {
    if (!address) {
      setClient(null);
      return;
    }

    let cancelled = false;
    setClient(null);

    getNgoRegistryClient(address, signTransaction)
      .then((c) => {
        if (!cancelled) {
          setClient(c);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          showToast(
            'error',
            err instanceof Error ? `Couldn't reach the NGO registry contract: ${err.message}` : `Couldn't reach the NGO registry contract.`,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, signTransaction, showToast]);

  return { client, ready: client !== null };
}
