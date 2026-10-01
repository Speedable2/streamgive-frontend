'use client';

import { useEffect, useState } from 'react';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { formatAmount } from '@/lib/format';
import { loadPlatformImpact, type PlatformImpact } from '@/lib/impact';

// Polling architecture (acknowledged tech debt — see README's Troubleshooting
// section for the user-facing symptom):
// There's no push channel (websocket/SSE) from the backend, so "live" impact
// numbers are simulated by re-fetching on a timer. Each tick calls
// `loadPlatformImpact()`, which itself does one N+1 fetch (list every NGO,
// then fetch each NGO's profile individually and sum client-side — see
// src/lib/impact.ts) because there's no platform-wide aggregate endpoint.
// That means every 20s this page issues 1 + N requests, where N is the
// verified NGO count. Fine while N is small; the interval and/or the N+1
// fetch are the first things to revisit if the NGO list grows or the
// backend gains a real aggregate/streaming endpoint.
const POLL_INTERVAL_MS = 20_000;

export default function ImpactPage() {
  const [impact, setImpact] = useState<PlatformImpact | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // Guards every setState below against a tick that is still in flight
    // (or fires) after the component has unmounted (issue #157): the
    // interval itself is cleared on cleanup, but a request already in
    // flight at that moment would otherwise resolve or reject later and
    // call setImpact/setLoadError on an unmounted component, which React
    // warns about and which abandons the fetch's own underlying resources.
    let cancelled = false;

    function refresh() {
      const controller = new AbortController();
      loadPlatformImpact(controller.signal)
        .then((next) => {
          if (!cancelled) {
            setImpact(next);
            setLoadError(false);
          }
        })
        .catch((err: unknown) => {
          // An aborted fetch (component unmounted mid-request) is not a
          // real load failure -- the AbortError is expected and must not
          // flip the error UI on, which a plain catch-all would do.
          if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) {
            setLoadError(true);
          }
        });
      return controller;
    }

    let activeController = refresh();
    const interval = setInterval(() => {
      activeController = refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      activeController.abort();
    };
  }, []);

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <h1 className="text-2xl font-bold">Platform impact</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Updates automatically every {POLL_INTERVAL_MS / 1000} seconds.
        </p>

        {loadError && !impact && (
          <p className="mt-8 text-red-600">
            Couldn&apos;t reach the StreamGive API. Is the backend running?
          </p>
        )}

        {/* Keep the last good numbers on screen when a later poll fails;
            the next successful poll clears the notice. */}
        {loadError && impact && (
          <p role="status" className="mt-8 text-sm text-amber-600">
            Couldn&apos;t refresh — showing the last numbers we loaded.
          </p>
        )}

        {!loadError && !impact && (
          <p role="status" className="mt-8 text-gray-500 dark:text-gray-400">
            Loading…
          </p>
        )}

        {impact && (
          <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Total committed</dt>
              <dd className="text-2xl font-bold">
                {formatAmount(impact.totalCommitted.toString())}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Withdrawn by NGOs</dt>
              <dd className="text-2xl font-bold">
                {formatAmount(impact.totalWithdrawn.toString())}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Active streams</dt>
              <dd className="text-2xl font-bold">{impact.activeStreams}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">Verified NGOs</dt>
              <dd className="text-2xl font-bold">{impact.ngoCount}</dd>
            </div>
          </dl>
        )}
      </main>
      <Footer />
    </>
  );
}
