import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { NgoProfile } from '@/lib/api';

import { NgoExplorer } from './NgoExplorer';

const MOCK_NGOS: NgoProfile[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `ngo-${i}`,
  name: `Test NGO ${String.fromCharCode(65 + i)}`,
  description: 'Test',
  ownerAddress: 'G123',
  createdAt: '2026-01-01T00:00:00.000Z',
  stats: {
    totalCommitted: '100',
    activeStreamCount: 0,
    donorCount: 0,
  },
}));

describe('NgoExplorer', () => {
  it('correctly filters results case-insensitively', async () => {
    const user = userEvent.setup();
    render(<NgoExplorer ngos={MOCK_NGOS} />);
    
    expect(screen.getByText('Test NGO A')).toBeInTheDocument();
    
    const searchInput = screen.getByPlaceholderText('Search NGOs by name…');
    await user.type(searchInput, 'test ngo b');
    
    expect(screen.getByText('Test NGO B')).toBeInTheDocument();
    expect(screen.queryByText('Test NGO A')).not.toBeInTheDocument();
  });

  it('renders "No NGOs match" when a search yields zero results', async () => {
    const user = userEvent.setup();
    render(<NgoExplorer ngos={MOCK_NGOS} />);
    
    const searchInput = screen.getByPlaceholderText('Search NGOs by name…');
    await user.type(searchInput, 'xyz123nonexistent');
    
    expect(screen.getByText('No NGOs match "xyz123nonexistent".')).toBeInTheDocument();
  });

  it('reveals the next nine results when clicking "Load more"', () => {
    render(<NgoExplorer ngos={MOCK_NGOS} />);
    
    expect(screen.getByText('Test NGO A')).toBeInTheDocument();
    expect(screen.getByText('Test NGO I')).toBeInTheDocument();
    expect(screen.queryByText('Test NGO J')).not.toBeInTheDocument();
    
    const loadMoreBtn = screen.getByRole('button', { name: 'Load more' });
    fireEvent.click(loadMoreBtn);
    
    expect(screen.getByText('Test NGO J')).toBeInTheDocument();
    expect(screen.getByText('Test NGO R')).toBeInTheDocument();
    expect(screen.queryByText('Test NGO S')).not.toBeInTheDocument();
  });

  it('resets the view back to the first page of results when typing a new search term after already paging forward', async () => {
    const user = userEvent.setup();
    render(<NgoExplorer ngos={MOCK_NGOS} />);
    
    const loadMoreBtn = screen.getByRole('button', { name: 'Load more' });
    fireEvent.click(loadMoreBtn);
    
    expect(screen.getByText('Test NGO J')).toBeInTheDocument();
    
    const searchInput = screen.getByPlaceholderText('Search NGOs by name…');
    await user.clear(searchInput);
    await user.type(searchInput, 'Test NGO');
    
    expect(screen.getByText('Test NGO A')).toBeInTheDocument();
    expect(screen.queryByText('Test NGO J')).not.toBeInTheDocument();
  });
});
