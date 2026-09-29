'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ConnectWalletPrompt } from '@/components/common/ConnectWalletPrompt';
import { StreamControls } from '@/components/dashboard/StreamControls';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { StreamDetailsModal } from '@/components/streams/StreamDetailsModal';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getStreams, type Stream } from '@/lib/api';
import { buildDonationHistoryCsv } from '@/lib/csv';
import { formatAmount, formatRemainingDuration } from '@/lib/format';

function downloadDonationHistoryCsv(streams: Stream[]): void {
  const blob = new Blob([buildDonationHistoryCsv(streams)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'streamgive-donations.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const { address } = useWallet();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [detailsStream, setDetailsStream] = useState<Stream | null>(null);

  // Drop any streams fetched under a previous address as soon as `address`
  // changes, during render rather than in an effect, so a stale list from
  // the old wallet is never painted (even briefly) under the new one.
  const [prevAddress, setPrevAddress] = useState(address);
  if (address !== prevAddress) {
    setPrevAddress(address);
    setStreams([]);
    setLoadError(false);
  }

  const refresh = useCallback(() => {
    if (!address) {
      setStreams([]);
      return;
    }

    setLoading(true);
    setLoadError(false);
    getStreams({ donor: address })
      .then(setStreams)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [address]);

  useEffect(() => {
    // refresh() flips loading/error state synchronously before it awaits,
    // which set-state-in-effect flags. That is the intended behaviour for
    // a fetch-on-mount that also re-runs whenever `address` changes: the
    // spinner has to come back while the new address is loading. Deriving
    // loading from the data instead would be the way to drop this.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const applyOptimisticUpdate = useCallback((streamId: string, patch: Partial<Stream>) => {
    setStreams((prev) => prev.map((s) => (s.id === streamId ? { ...s, ...patch } : s)));
  }, []);

  const totalCommitted = streams.reduce(
    (sum, s) => sum + BigInt(s.balance) + BigInt(s.withdrawn),
    0n,
  );
  const activeCount = streams.filter((s) => s.status === 'ACTIVE').length;

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Your donations</h1>

        {!address && (
          <ConnectWalletPrompt className="mt-8" message="Connect your wallet to see your streams." />
        )}

        {address && loading && (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            Loading your streams…
          </p>
        )}

        {address && !loading && loadError && (
          <p className="mt-8 text-red-600 dark:text-red-400">
            Couldn&apos;t reach the StreamGive API. Is the backend running?
          </p>
        )}

        {address && !loading && !loadError && streams.length === 0 && (
          <p className="mt-8 text-gray-600 dark:text-gray-400">
            You haven&apos;t started any streams yet.{' '}
            <Link href="/ngos" className="underline">
              Explore NGOs
            </Link>
            .
          </p>
        )}

        {address && !loading && !loadError && streams.length > 0 && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <dl className="grid grid-cols-2 gap-6 sm:w-fit sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Total committed</dt>
                  <dd className="text-lg font-semibold">
                    {formatAmount(totalCommitted.toString())}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Active streams</dt>
                  <dd className="text-lg font-semibold">{activeCount}</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => downloadDonationHistoryCsv(streams)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Export CSV
              </button>
            </div>

            <div className="mt-8 overflow-x-auto">
              <table
                aria-label="Your donation streams"
                className="w-full min-w-[900px] border-separate border-spacing-y-3 text-left"
              >
                <thead>
                  <tr className="text-sm text-gray-500 dark:text-gray-400">
                    <th scope="col" className="px-4 py-2 font-medium">NGO</th>
                    <th scope="col" className="px-4 py-2 font-medium">Rate</th>
                    <th scope="col" className="px-4 py-2 font-medium">Balance</th>
                    <th scope="col" className="px-4 py-2 font-medium">Withdrawn</th>
                    <th scope="col" className="px-4 py-2 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2 font-medium">Remaining</th>
                    <th scope="col" className="px-4 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {streams.map((stream) => {
                    const remaining = formatRemainingDuration(stream.balance, stream.rate);
                    return (
                      <tr key={stream.id}>
                        <td className="rounded-l-lg border-y border-l border-gray-200 px-4 py-4 dark:border-gray-800">
                          <Link
                            href={`/ngos/${stream.ngo.id}`}
                            className="font-semibold hover:underline"
                          >
                            {stream.ngo.name}
                          </Link>
                        </td>
                        <td className="border-y border-gray-200 px-4 py-4 dark:border-gray-800">
                          {formatAmount(stream.rate)} / second
                        </td>
                        <td className="border-y border-gray-200 px-4 py-4 dark:border-gray-800">
                          {formatAmount(stream.balance)}
                        </td>
                        <td className="border-y border-gray-200 px-4 py-4 dark:border-gray-800">
                          {formatAmount(stream.withdrawn)}
                        </td>
                        <td className="border-y border-gray-200 px-4 py-4 dark:border-gray-800">
                          {stream.status === 'ACTIVE' ? 'Active' : 'Cancelled'}
                        </td>
                        <td className="border-y border-gray-200 px-4 py-4 dark:border-gray-800">
                          {remaining || '—'}
                        </td>
                        <td className="rounded-r-lg border-y border-r border-gray-200 px-4 py-4 dark:border-gray-800">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailsStream(stream)}
                              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                            >
                              View details
                            </button>
                            {stream.status === 'ACTIVE' && (
                              <StreamControls
                                stream={stream}
                                onChanged={refresh}
                                onOptimisticUpdate={(patch) => applyOptimisticUpdate(stream.id, patch)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      <Footer />

      {detailsStream && (
        <StreamDetailsModal stream={detailsStream} onClose={() => setDetailsStream(null)} />
      )}
    </>
  );
}
