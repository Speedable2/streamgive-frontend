import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import ApplyPage from './page';
import { ApiError } from '@/lib/api';
import { NGO_REGISTRY_ERRORS } from '@/lib/contractTypes';

const mockRegister = vi.fn();
const mockSignAndSend = vi.fn();
const mockSubmitNgoApplication = vi.fn();

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({
    address: 'GDONOR000000000000000000000000000000000000000000000000000',
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
    networkMismatch: false,
  }),
}));

vi.mock('@/lib/ngoRegistryClient', () => ({
  useNgoRegistryClient: () => ({
    client: { register: mockRegister },
    ready: true,
  }),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    submitNgoApplication: (...args: unknown[]) => mockSubmitNgoApplication(...args),
  };
});

async function fillForm() {
  fireEvent.change(screen.getByLabelText('Organization name'), {
    target: { value: 'Clean Water Org' },
  });
  fireEvent.change(screen.getByLabelText(/^Description/), {
    target: { value: 'We provide clean water access.' },
  });
  fireEvent.change(screen.getByLabelText('Contact email'), {
    target: { value: 'contact@example.org' },
  });
}

describe('ApplyPage', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockSignAndSend.mockReset();
    mockSubmitNgoApplication.mockReset();
    mockRegister.mockResolvedValue({ built: { fee: '100' }, signAndSend: mockSignAndSend });
    mockSignAndSend.mockResolvedValue(undefined);
  });

  it('submits normally when register and the API call both succeed', async () => {
    mockSubmitNgoApplication.mockResolvedValue({ id: 'app-1' });
    render(<ApplyPage />);

    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

    await waitFor(() => expect(screen.getByText('Application submitted!')).toBeInTheDocument());
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockSubmitNgoApplication).toHaveBeenCalledTimes(1);
  });

  it('lets the applicant retry just the backend submission when register was already done', async () => {
    // First attempt: register succeeds, but the backend submission fails.
    mockSubmitNgoApplication.mockRejectedValueOnce(
      new ApiError('Service temporarily unavailable', 503),
    );
    render(<ApplyPage />);

    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

    await waitFor(() =>
      expect(screen.getByText('Service temporarily unavailable')).toBeInTheDocument(),
    );
    expect(mockRegister).toHaveBeenCalledTimes(1);

    // Retry: register() now fails as already-registered (the on-chain state
    // from the first attempt persists), but that must not block the retry
    // -- it should be treated as a no-op and go straight to resubmitting.
    mockRegister.mockRejectedValueOnce(
      new Error(`contract call failed with #${NGO_REGISTRY_ERRORS.ALREADY_REGISTERED}`),
    );
    mockSubmitNgoApplication.mockResolvedValueOnce({ id: 'app-1' });

    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

    await waitFor(() => expect(screen.getByText('Application submitted!')).toBeInTheDocument());
    expect(mockRegister).toHaveBeenCalledTimes(2);
    expect(mockSubmitNgoApplication).toHaveBeenCalledTimes(2);
  });

  it('shows a clear error and does not call the API when register fails for a different reason', async () => {
    mockRegister.mockRejectedValueOnce(new Error('User declined the request.'));
    render(<ApplyPage />);

    await fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));

    await waitFor(() =>
      expect(
        screen.getByText('Could not register on-chain: User declined the request.'),
      ).toBeInTheDocument(),
    );
    expect(mockSubmitNgoApplication).not.toHaveBeenCalled();
  });
});
