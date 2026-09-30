'use client';

import { useCallback, useEffect, useState } from 'react';

import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { CopyAddressButton } from '@/components/common/CopyAddressButton';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/components/toast/ToastProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import type { NgoApplication } from '@/lib/api';
import { listNgoApplications, reviewNgoApplication } from '@/lib/adminApi';
import { formatEstimatedFee, truncateAddress } from '@/lib/format';
import { useNgoRegistryClient } from '@/lib/ngoRegistryClient';

export default function PlatformAdminPage() {
  const { address, signMessage, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [applications, setApplications] = useState<NgoApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      setApplications(await listNgoApplications(address, signMessage, 'PENDING'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load applications — are you connected as the configured admin address?',
      );
    } finally {
      setLoading(false);
    }
  }, [address, signMessage]);

  useEffect(() => {
    // refresh() flips loading/error state synchronously before it awaits,
    // which set-state-in-effect flags. That is the intended behaviour for
    // a fetch-on-mount that also re-runs whenever `address` changes: the
    // spinner has to come back while the new address is loading. Deriving
    // loading from the data instead would be the way to drop this.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function handleApprove(app: NgoApplication): Promise<void> {
    if (!address || !client) return;
    setBusyId(app.id);
    try {
      // On-chain first: this is what actually flips Ngo.verified once the
      // indexer picks up the resulting event. If the wallet rejects or the
      // tx fails, we deliberately haven't touched the off-chain review
      // status yet — better an application stuck "pending" than one
      // marked "approved" while the NGO is still unverified on-chain.
      const tx = await client.approve_ngo({ ngo_owner: app.ownerAddress });
      setEstimatedFee(formatEstimatedFee(tx.built?.fee));
      await tx.signAndSend();

      await reviewNgoApplication(address, signMessage, app.id, 'approve', reviewNotes[app.id]);
      showToast('success', `${app.name} approved.`);
      await refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
      setEstimatedFee(null);
    }
  }

  async function handleReject(app: NgoApplication): Promise<void> {
    if (!address) return;
    setBusyId(app.id);
    try {
      await reviewNgoApplication(address, signMessage, app.id, 'reject', reviewNotes[app.id]);
      showToast('info', `${app.name} rejected.`);
      await refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Platform admin</h1>
        <p className="mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-400">
          Review pending NGO applications. Only the wallet configured as the platform&apos;s
          <code className="mx-1 rounded bg-gray-100 px-1 dark:bg-gray-800">ADMIN_ADDRESS</code>
          can act here — approving both calls the on-chain registry and records the review.
        </p>

        {!address && (
          <ConnectWalletPrompt className="mt-8" message="Connect the platform admin wallet." />
        )}

        {address && loading && (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            Loading…
          </p>
        )}

        {address && error && <p className="mt-8 text-red-600 dark:text-red-400">{error}</p>}

        {address && !loading && !error && applications.length === 0 && (
          <p className="mt-8 text-gray-600 dark:text-gray-400">No pending applications.</p>
        )}

        {address && !loading && applications.length > 0 && (
          <ul className="mt-8 space-y-4">
            {applications.map((app) => (
              <li
                key={app.id}
                className="rounded-lg border border-gray-200 p-6 dark:border-gray-800"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-semibold">{app.name}</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {app.description}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {app.contactEmail}
                      {app.website ? ` · ${app.website}` : ''}
                      {app.country ? ` · ${app.country}` : ''}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {truncateAddress(app.ownerAddress)}
                      </p>
                      <CopyAddressButton address={app.ownerAddress} />
                    </div>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Submitted{' '}
                      {new Date(app.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-64">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Review note (optional)
                      </span>
                      <textarea
                        value={reviewNotes[app.id] ?? ''}
                        onChange={(event) =>
                          setReviewNotes((notes) => ({ ...notes, [app.id]: event.target.value }))
                        }
                        rows={2}
                        placeholder="Why is this approved or rejected?"
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                      />
                    </label>
                    {busyId === app.id && estimatedFee && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Fee {estimatedFee}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleApprove(app)}
                        disabled={busyId === app.id || !ready}
                        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                      >
                        {busyId === app.id ? 'Working…' : ready ? 'Approve' : 'Preparing…'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleReject(app)}
                        disabled={busyId === app.id}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
