'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useDonationVaultClient } from '@/lib/donationVaultClient';
import { formatAmount, formatEstimatedFee, parseAmount, TOKEN_DECIMALS } from '@/lib/format';
import {
  DONATION_VAULT_CONTRACT_ID,
  getNativeAssetAddress,
  getTokenBalance,
  getUsdcAssetAddress,
} from '@/lib/stellar';

const DURATIONS = [
  { label: '1 week', seconds: 7 * 24 * 60 * 60 },
  { label: '1 month', seconds: 30 * 24 * 60 * 60 },
  { label: '3 months', seconds: 90 * 24 * 60 * 60 },
  { label: '1 year', seconds: 365 * 24 * 60 * 60 },
];

type TokenChoice = 'native' | 'usdc' | 'custom';
type SubmitState = 'idle' | 'signing' | 'success' | 'error';

export function CreateStreamForm({ ngoAddress, ngoId }: { ngoAddress: string; ngoId?: string }) {
  const router = useRouter();
  const { address, signTransaction } = useWallet();
  const { client, ready } = useDonationVaultClient();

  const [tokenChoice, setTokenChoice] = useState<TokenChoice>('native');
  const [customToken, setCustomToken] = useState('');
  const [amount, setAmount] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(DURATIONS[1].seconds);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const depositRaw = parseAmount(amount);
  const isAmountValid = depositRaw !== null;

  // Integer division truncates: a deposit that doesn't divide evenly by the
  // duration leaves a remainder the per-second rate can't carry (issue
  // #156). The deposit itself is still submitted in full -- the contract
  // has no partial-deposit call -- so that remainder sits in the stream's
  // balance until cancel/top-up rather than ever actually streaming out.
  // Surfaced below so the donor sees the real effective total up front
  // instead of only discovering the dust on cancel.
  const rateRaw = depositRaw !== null ? depositRaw / BigInt(durationSeconds) : null;
  const isRateValid = rateRaw !== null && rateRaw > 0n;
  const effectiveStreamedRaw = rateRaw !== null ? rateRaw * BigInt(durationSeconds) : null;
  const leftoverRaw =
    depositRaw !== null && effectiveStreamedRaw !== null ? depositRaw - effectiveStreamedRaw : null;

  const STELLAR_CONTRACT_RE = /^C[A-Z2-7]{55}$/;
  const customTokenTrimmed = customToken.trim();
  const isCustomTokenFormatValid =
    tokenChoice !== 'custom' ||
    customTokenTrimmed.length === 0 ||
    STELLAR_CONTRACT_RE.test(customTokenTrimmed);
  const isTokenValid =
    tokenChoice !== 'custom' ||
    (customTokenTrimmed.length > 0 && STELLAR_CONTRACT_RE.test(customTokenTrimmed));

  // The token address actually being donated in, resolved the same way for
  // both the balance check below and the real create_stream call — null
  // while "Custom asset" is selected but its address isn't valid/complete
  // yet, since there is nothing to look a balance up for in that case.
  const selectedTokenAddress =
    tokenChoice === 'native'
      ? getNativeAssetAddress()
      : tokenChoice === 'usdc'
        ? getUsdcAssetAddress()
        : isCustomTokenFormatValid && customTokenTrimmed.length > 0
          ? customTokenTrimmed
          : null;

  const insufficientBalance =
    walletBalance !== null && depositRaw !== null && depositRaw > BigInt(walletBalance);

  const canSubmit =
    isAmountValid &&
    isRateValid &&
    isTokenValid &&
    !insufficientBalance &&
    submitState !== 'signing' &&
    ready;

  useEffect(() => {
    if (!address || !selectedTokenAddress) {
      setWalletBalance(null);
      return;
    }

    let cancelled = false;
    setBalanceLoading(true);
    setWalletBalance(null);

    getTokenBalance(selectedTokenAddress, address)
      .then((balance) => {
        if (!cancelled) {
          setWalletBalance(balance);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBalanceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, selectedTokenAddress]);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (
      !canSubmit ||
      !address ||
      !client ||
      !selectedTokenAddress ||
      depositRaw === null ||
      rateRaw === null
    ) {
      return;
    }

    setSubmitState('signing');
    setErrorMessage(null);
    setEstimatedFee(null);

    try {
      const tx = await client.create_stream({
        donor: address,
        ngo: ngoAddress,
        token: selectedTokenAddress,
        deposit: depositRaw,
        rate: rateRaw,
      });

      // Client.create_stream already simulated the call to assemble this
      // transaction, so the fee estimate is ready here — shown before
      // signAndSend() goes on to trigger the wallet's signing prompt.
      setEstimatedFee(formatEstimatedFee(tx.built?.fee));

      const { result } = await tx.signAndSend();
      const newStreamId = String(result);

      setStreamId(newStreamId);
      setSubmitState('success');
      setAmount('');
      setDurationSeconds(DURATIONS[1].seconds);
      setTokenChoice('native');
      setCustomToken('');
      if (ngoId) {
        router.push(`/ngos/${ngoId}/donate/success?streamId=${newStreamId}`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitState('error');
    } finally {
      setEstimatedFee(null);
    }
  }

  if (!DONATION_VAULT_CONTRACT_ID) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950">
        <p className="font-medium text-amber-800 dark:text-amber-300">Widget not configured</p>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
          The donation contract address is missing. Set{' '}
          <code className="font-mono">NEXT_PUBLIC_DONATION_VAULT_CONTRACT_ID</code> in the
          deployment environment to enable donations.
        </p>
      </div>
    );
  }

  // We no longer return early here, as the user might want to create another stream.

  if (!address) {
    return <ConnectWalletPrompt message="Connect your wallet to start a stream." />;
  }

  return (
    <div className="space-y-8">
      {submitState === 'success' && streamId !== null && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950">
          <p className="font-medium text-green-800 dark:text-green-300">Stream started!</p>
          <p className="mt-1 text-sm text-green-700 dark:text-green-400">
            Stream #{streamId} is now active.
          </p>
        </div>
      )}

      <form onSubmit={(event) => void handleSubmit(event)} className="max-w-md space-y-6">
      <fieldset>
        <legend className="text-sm font-medium">Token</legend>
        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="token"
              checked={tokenChoice === 'native'}
              onChange={() => setTokenChoice('native')}
            />
            XLM (native)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="token"
              checked={tokenChoice === 'usdc'}
              onChange={() => setTokenChoice('usdc')}
            />
            USDC
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="token"
              checked={tokenChoice === 'custom'}
              onChange={() => setTokenChoice('custom')}
            />
            Custom asset
          </label>
        </div>
        {tokenChoice === 'custom' && (
          <>
            <input
              type="text"
              value={customToken}
              onChange={(event) => setCustomToken(event.target.value)}
              placeholder="Token contract address (C...)"
              aria-invalid={!isCustomTokenFormatValid || undefined}
              aria-describedby={!isCustomTokenFormatValid ? 'custom-token-error' : undefined}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            {!isCustomTokenFormatValid && (
              <p id="custom-token-error" className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                Must be a Stellar contract address starting with C followed by 55 uppercase letters
                or digits 2–7.
              </p>
            )}
          </>
        )}
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium">Total amount</span>
        <input
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="100"
          aria-invalid={isAmountValid && !isRateValid || undefined}
          aria-describedby={isAmountValid && !isRateValid ? 'amount-error' : undefined}
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {balanceLoading
            ? 'Checking wallet balance…'
            : walletBalance !== null
              ? `Wallet balance: ${formatAmount(walletBalance)}`
              : null}
        </p>
        {insufficientBalance && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            This exceeds your wallet balance — the transaction will fail.
          </p>
        )}
      </label>

      <label className="block">
        <span className="text-sm font-medium">Stream over</span>
        <select
          value={durationSeconds}
          onChange={(event) => setDurationSeconds(Number(event.target.value))}
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          {DURATIONS.map((d) => (
            <option key={d.seconds} value={d.seconds}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      {isAmountValid && rateRaw !== null && (
        <p id={!isRateValid ? 'amount-error' : undefined} className="text-sm text-gray-500 dark:text-gray-400">
          {isRateValid
            ? `That's roughly ${(Number(rateRaw) / 10 ** TOKEN_DECIMALS).toFixed(7)} per second.`
            : 'That amount is too small to stream over this duration — try a shorter one.'}
        </p>
      )}

      {isRateValid && leftoverRaw !== null && leftoverRaw > 0n && effectiveStreamedRaw !== null && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Only {formatAmount(effectiveStreamedRaw.toString())} of your deposit will stream out at
          this rate; the remaining {formatAmount(leftoverRaw.toString())} stays in the stream&apos;s
          balance until you cancel or top up.
        </p>
      )}

      {submitState === 'signing' && estimatedFee && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Estimated network fee: {estimatedFee}
        </p>
      )}

      {submitState === 'error' && errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
      >
        {submitState === 'signing'
          ? 'Confirm in your wallet…'
          : !ready
            ? 'Preparing contract…'
            : 'Review & Sign'}
      </button>
    </form>
    </div>
  );
}
