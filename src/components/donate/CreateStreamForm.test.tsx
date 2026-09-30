import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDonationVaultClient } from '@/lib/donationVaultClient';

import { CreateStreamForm } from './CreateStreamForm';

const DONOR_ADDRESS = 'G' + 'D'.repeat(55);
const NGO_ADDRESS = 'G' + 'N'.repeat(55);
const NGO_ID = 'ngo-1';
const NATIVE_TOKEN_ADDRESS = 'CNATIVEFAKE';
const CUSTOM_TOKEN_ADDRESS = 'C' + 'T'.repeat(55);

const mockSignTransaction = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWallet: () => ({
    address: DONOR_ADDRESS,
    connecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signTransaction: mockSignTransaction,
    signMessage: vi.fn(),
  }),
}));

const mockGetTokenBalance = vi.fn();

vi.mock('@/lib/stellar', () => ({
  DONATION_VAULT_CONTRACT_ID: 'CDONATIONVAULTFAKE',
  getNativeAssetAddress: () => NATIVE_TOKEN_ADDRESS,
  getUsdcAssetAddress: () => 'CUSDCFAKE',
  getTokenBalance: (...args: unknown[]) => mockGetTokenBalance(...args),
}));

const mockCreateStream = vi.fn();

vi.mock('@/lib/donationVaultClient', () => ({
  useDonationVaultClient: vi.fn(),
}));

describe('CreateStreamForm', () => {
  beforeEach(() => {
    mockCreateStream.mockReset();
    mockPush.mockReset();
    mockGetTokenBalance.mockReset();
    mockGetTokenBalance.mockResolvedValue('50000000000'); // 5,000 in raw units
    vi.mocked(useDonationVaultClient).mockReturnValue({
      client: { create_stream: mockCreateStream } as never,
      ready: true,
    });
  });

  it('disables submit and shows a loading label while the contract client is not ready', async () => {
    vi.mocked(useDonationVaultClient).mockReturnValue({ client: null, ready: false });

    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);
    await user.type(screen.getByPlaceholderText('100'), '100');

    expect(screen.getByRole('button', { name: /preparing contract/i })).toBeDisabled();
  });

  it('disables submit until a valid amount is entered', async () => {
    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    const submit = screen.getByRole('button', { name: /review & sign/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText('100'), '100');

    expect(submit).not.toBeDisabled();
  });

  it('requires a token address once "Custom asset" is selected', async () => {
    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    await user.type(screen.getByPlaceholderText('100'), '100');
    await user.click(screen.getByLabelText(/custom asset/i));

    const submit = screen.getByRole('button', { name: /review & sign/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/token contract address/i), CUSTOM_TOKEN_ADDRESS);
    expect(submit).not.toBeDisabled();
  });

  it('flags an amount too small to produce a positive per-second rate', async () => {
    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    // 0.0000001 * 10^7 = 1 raw unit; 1 / (30 days in seconds) rounds to 0.
    await user.type(screen.getByPlaceholderText('100'), '0.0000001');

    expect(screen.getByText(/too small to stream over this duration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review & sign/i })).toBeDisabled();
  });

  it('re-enables submit after switching back to XLM (native) from a custom token', async () => {
    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    await user.type(screen.getByPlaceholderText('100'), '100');

    // Switch to custom and type an address so the button is enabled.
    await user.click(screen.getByLabelText(/custom asset/i));
    await user.type(screen.getByPlaceholderText(/token contract address/i), CUSTOM_TOKEN_ADDRESS);
    expect(screen.getByRole('button', { name: /review & sign/i })).not.toBeDisabled();

    // Switch back to native XLM — the custom address no longer matters.
    await user.click(screen.getByLabelText(/xlm \(native\)/i));
    expect(screen.getByRole('button', { name: /review & sign/i })).not.toBeDisabled();
  });

  it('submits contract-shaped deposit/rate values and shows the resulting stream id', async () => {
    mockCreateStream.mockResolvedValue({
      signAndSend: vi.fn().mockResolvedValue({ result: 42n }),
    });

    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    await user.type(screen.getByPlaceholderText('100'), '100');
    await user.click(screen.getByRole('button', { name: /review & sign/i }));

    expect(await screen.findByText(/stream started/i)).toBeInTheDocument();
    expect(screen.getByText(/stream #42/i)).toBeInTheDocument();

    // 100 * 10^7 deposit, over the default 1-month duration (30 days).
    expect(mockCreateStream).toHaveBeenCalledWith({
      donor: DONOR_ADDRESS,
      ngo: NGO_ADDRESS,
      token: NATIVE_TOKEN_ADDRESS,
      deposit: 1_000_000_000n,
      rate: 1_000_000_000n / (30n * 24n * 60n * 60n),
    });
    // No ngoId was passed, so this stays on the inline success card rather
    // than navigating away — that's the embed widget's fallback behavior.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigates to the donate-success page when ngoId is provided', async () => {
    mockCreateStream.mockResolvedValue({
      signAndSend: vi.fn().mockResolvedValue({ result: 42n }),
    });

    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} ngoId={NGO_ID} />);

    await user.type(screen.getByPlaceholderText('100'), '100');
    await user.click(screen.getByRole('button', { name: /review & sign/i }));

    await screen.findByText(/stream started/i);
    expect(mockPush).toHaveBeenCalledWith(`/ngos/${NGO_ID}/donate/success?streamId=42`);
  });

  it('shows the estimated network fee once the transaction is assembled', async () => {
    mockCreateStream.mockResolvedValue({
      built: { fee: '1000000' },
      signAndSend: () => new Promise(() => {}),
    });

    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    await user.type(screen.getByPlaceholderText('100'), '100');
    await user.click(screen.getByRole('button', { name: /review & sign/i }));

    // 1 000 000 stroops = 0.1 XLM.
    expect(await screen.findByText(/estimated network fee: ≈ 0.1 xlm/i)).toBeInTheDocument();
  });

  it('fetches and displays the wallet balance for the selected token', async () => {
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    expect(await screen.findByText(/wallet balance: 5,000/i)).toBeInTheDocument();
    expect(mockGetTokenBalance).toHaveBeenCalledWith(NATIVE_TOKEN_ADDRESS, DONOR_ADDRESS);
  });

  it('re-fetches the balance when the selected token changes', async () => {
    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    await screen.findByText(/wallet balance: 5,000/i);
    mockGetTokenBalance.mockClear();
    mockGetTokenBalance.mockResolvedValue('20000000000'); // 2,000

    await user.click(screen.getByLabelText(/usdc/i));

    expect(await screen.findByText(/wallet balance: 2,000/i)).toBeInTheDocument();
    expect(mockGetTokenBalance).toHaveBeenCalledWith('CUSDCFAKE', DONOR_ADDRESS);
  });

  it('warns and disables submit when the entered amount exceeds the wallet balance', async () => {
    mockGetTokenBalance.mockResolvedValue('500000000'); // 50

    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    await screen.findByText(/wallet balance: 50/i);
    await user.type(screen.getByPlaceholderText('100'), '100');

    expect(
      screen.getByText(/exceeds your wallet balance — the transaction will fail/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review & sign/i })).toBeDisabled();
  });

  it('does not warn when the entered amount is within the wallet balance', async () => {
    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    await screen.findByText(/wallet balance: 5,000/i);
    await user.type(screen.getByPlaceholderText('100'), '100');

    expect(screen.queryByText(/exceeds your wallet balance/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review & sign/i })).not.toBeDisabled();
  });
});
