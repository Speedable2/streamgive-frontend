import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CopyLinkButton } from '@/components/common/CopyLinkButton';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { getNgo } from '@/lib/api';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ streamId?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ngo = await getNgo(id).catch(() => null);
  return {
    title: ngo ? `Stream started — ${ngo.name}` : 'NGO not found',
    robots: { index: false, follow: false },
  };
}

export default async function DonateSuccessPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { streamId } = await searchParams;

  let ngoName: string;
  try {
    const ngo = await getNgo(id);
    if (!ngo) {
      notFound();
    }
    ngoName = ngo.name;
  } catch {
    return (
      <>
        <Header />
        <main className="px-6 py-16 sm:px-12">
          <p className="text-red-600 dark:text-red-400">
            Couldn&apos;t reach the StreamGive API. Is the backend running?
          </p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="px-6 py-16 sm:px-12">
        <div className="max-w-md rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950">
          <p className="font-medium text-green-800 dark:text-green-300">Stream started!</p>
          <p className="mt-1 text-sm text-green-700 dark:text-green-400">
            {streamId
              ? `Stream #${streamId} is now active, streaming to ${ngoName}.`
              : `Your stream to ${ngoName} is now active.`}
          </p>
        </div>

        <div className="mt-8 max-w-md">
          <h2 className="font-semibold">Know someone else who&apos;d want to help?</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Share {ngoName}&apos;s profile so others can start their own stream.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/ngos/${id}`}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              View {ngoName}&apos;s profile
            </Link>
            <CopyLinkButton path={`/ngos/${id}`} />
          </div>
        </div>

        <p className="mt-8 text-sm">
          <Link href="/dashboard" className="underline">
            See all your streams
          </Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
