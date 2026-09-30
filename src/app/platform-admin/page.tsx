'use client';

import { useCallback, useEffect, useState } from 'react';

import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { CopyAddressButton } from '@/components/common/CopyAddressButton';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/components/toast/ToastProvider';
import { useWallet } from '@/components/wallet/WalletProvider';
import type { Ngo, NgoApplication } from '@/lib/api';
import { getNgos } from '@/lib/api';
import { listNgoApplications, reviewNgoApplication } from '@/lib/adminApi';
import { formatEstimatedFee, truncateAddress } from '@/lib/format';
import { useNgoRegistryClient } from '@/lib/ngoRegistryClient';

export default function PlatformAdminPage() {
  const { address, signMessage, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [applications, setApplications] = useState<NgoApplication[]>([]);
  const [verifiedNgos, setVerifiedNgos] = useState<Ngo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const [apps, ngos] = await Promise.all([
        listNgoApplications(address, signMessage, statusFilter),
        getNgos(),
      ]);
      setApplications(apps);
      setVerifiedNgos(ngos.filter(n => n.verified));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load applications — are you connected as the configured admin address?',
      );
    } finally {
      setLoading(false);
    }
  }, [address, signMessage, statusFilter]);

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

  async function handleRevoke(ngo: Ngo): Promise<void> {
    if (!address) return;
    setBusyId(ngo.id);
    try {
      const client = await getNgoRegistryClient(address, signTransaction);
      const tx = await client.revoke_ngo({ ngo_owner: ngo.ownerAddress });
      await tx.signAndSend();
      showToast('success', `${ngo.name} revoked.`);
      await refresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
      setRevokeConfirmId(null);
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

        {address && (
          <div className="mt-8 border-b border-gray-200 dark:border-gray-800">
            <nav className="-mb-px flex space-x-8">
              {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                    statusFilter === status
                      ? 'border-black text-black dark:border-white dark:text-white'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              ))}
            </nav>
          </div>
        )}

        {address && loading && (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            Loading…
          </p>
        )}

        {address && error && <p className="mt-8 text-red-600 dark:text-red-400">{error}</p>}

        {address && !loading && !error && applications.length === 0 && (
          <p className="mt-8 text-gray-600 dark:text-gray-400">No {statusFilter.toLowerCase()} applications.</p>
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
                    {app.status === 'PENDING' ? (
                      <>
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
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleApprove(app)}
                            disabled={busyId === app.id}
                            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                          >
                            {busyId === app.id ? 'Working…' : 'Approve'}
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
                      </>
                    ) : (
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Review note
                        </span>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                          {app.reviewNote || 'No note provided.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {address && !loading && !error && (
          <div className="mt-16">
            <h2 className="text-xl font-bold">Verified NGOs</h2>
            {verifiedNgos.length === 0 ? (
              <p className="mt-4 text-gray-600 dark:text-gray-400">No verified NGOs.</p>
            ) : (
              <ul className="mt-6 space-y-4">
                {verifiedNgos.map((ngo) => (
                  <li
                    key={ngo.id}
                    className="flex flex-col gap-4 rounded-lg border border-gray-200 p-6 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800"
                  >
                    <div>
                      <h3 className="font-semibold">{ngo.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {truncateAddress(ngo.ownerAddress)}
                        </p>
                        <CopyAddressButton address={ngo.ownerAddress} />
                      </div>
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        Registered{' '}
                        {new Date(ngo.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {revokeConfirmId === ngo.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setRevokeConfirmId(null)}
                            disabled={busyId === ngo.id}
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRevoke(ngo)}
                            disabled={busyId === ngo.id}
                            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {busyId === ngo.id ? 'Working…' : 'Confirm Revoke'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRevokeConfirmId(ngo.id)}
                          disabled={busyId === ngo.id}
                          className="rounded-md border border-red-200 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-500 dark:hover:bg-red-900/20"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
