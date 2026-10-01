import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, submitNgoApplication } from '@/lib/api';

const OWNER_ADDRESS = 'G' + 'A'.repeat(55);

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({
    address: OWNER_ADDRESS,
    connect: vi.fn(),
    signTransaction: vi.fn(),
  }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, submitNgoApplication: vi.fn() };
});

vi.mock('@/lib/ngoRegistryClient', () => ({
  getNgoRegistryClient: vi.fn(async () => ({
    register: vi.fn(async () => ({ signAndSend: vi.fn() })),
  })),
}));

import ApplyPage from './page';

describe('ApplyPage', () => {
  beforeEach(() => {
    vi.mocked(submitNgoApplication).mockReset();
  });

  it('shows the duplicate-application message for a 409 response', async () => {
    vi.mocked(submitNgoApplication).mockRejectedValue(
      new ApiError('An application from this address is already pending review.', 409),
    );

    const user = userEvent.setup();
    render(<ApplyPage />);

    await user.type(screen.getByLabelText('Organization name'), 'Community Garden');
    await user.type(screen.getByLabelText('Description'), 'A local community garden.');
    await user.type(screen.getByLabelText('Contact email'), 'garden@example.org');
    await user.click(screen.getByRole('button', { name: 'Submit application' }));

    expect(await screen.findByText(/already pending review/i)).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument();
  });
});
