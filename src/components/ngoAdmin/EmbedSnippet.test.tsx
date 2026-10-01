import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { APP_URL } from '@/lib/config';

import { EmbedSnippet } from './EmbedSnippet';

const NGO_ID = 'ngo-123';

describe('EmbedSnippet', () => {
  it('renders an iframe snippet using the browser origin and the given NGO id', () => {
    render(<EmbedSnippet ngoId={NGO_ID} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const expectedSrc = `${window.location.origin}/embed/${NGO_ID}`;

    expect(textarea.value).toContain(`src="${expectedSrc}"`);
    expect(textarea.value).toMatch(/^<iframe .*<\/iframe>$/);
  });

  it('falls back to APP_URL for the origin when server-rendered', () => {
    // renderToString has no `window`, so useSyncExternalStore reads its
    // getServerSnapshot argument (APP_URL) instead of window.location.origin.
    const html = renderToString(<EmbedSnippet ngoId={NGO_ID} />);

    expect(html).toContain(`src=&quot;${APP_URL}/embed/${NGO_ID}&quot;`);
  });
});
