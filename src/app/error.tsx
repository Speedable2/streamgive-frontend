'use client';

import { useEffect } from 'react';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <Header />
      <main className="flex min-h-[60vh] items-center justify-center px-6 py-20 text-center sm:px-12">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
            Something went wrong
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            We hit an unexpected issue.
          </h1>
          <p className="mt-4 text-base text-gray-600 dark:text-gray-400">
            This page couldn’t be loaded right now. Please try again, or keep exploring StreamGive
            using the links above.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-8 inline-flex rounded-md bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            Try again
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
