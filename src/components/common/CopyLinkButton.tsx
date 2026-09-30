'use client';

import { useState } from 'react';

const CONFIRMATION_RESET_MS = 2000;

/** Copies a link to the clipboard with a brief confirmation. Defaults to
 * the current page's URL; pass `path` to copy a link to a different page
 * instead (e.g. sharing the NGO's profile from its donate-success page). */
export function CopyLinkButton({ path }: { path?: string } = {}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      const url = path ? `${window.location.origin}${path}` : window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), CONFIRMATION_RESET_MS);
    } catch {
      // Clipboard access can be denied; leave the label unchanged.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
    >
      {copied ? 'Link copied!' : 'Copy link'}
    </button>
  );
}
