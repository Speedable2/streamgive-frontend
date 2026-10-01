import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Footer } from './Footer';

describe('Footer', () => {
  it('links to the GitHub organization and docs in a new tab', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/streamgive',
    );
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('target', '_blank');

    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      'https://github.com/streamgive/streamgive-docs',
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('target', '_blank');
  });
});