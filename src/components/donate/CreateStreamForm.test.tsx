import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDonationVaultClient } from '@/lib/donationVaultClient';

import { CreateStreamForm } from './CreateStreamForm';

const DONOR_ADDRESS = 'G' + 'D'.repeat(55);
const NGO_ADDRESS = 'G' + 'N'.repeat(55);
const NGO_ID = 'ngo-1';
const NGO_NAME = 'Test NGO';
const NATIVE_TOKEN_ADDRESS = 'CNATIVEFAKE';
// Matches CreateStreamForm's STELLAR_CONTRACT_RE (C + 55 base32 chars) so
// tests exercising "a valid custom token address" don't trip the same
// format validation a too-short placeholder like "CTOKENADDRESS" would.
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

vi.mock('@/lib/stellar', () => ({
  DONATION_VAULT_CONTRACT_ID: 'CVAULTFAKE',
  getNativeAssetAddress: () => NATIVE_TOKEN_ADDRESS,
  getUsdcAssetAddress: () => 'CUSDCFAKE',
}));

const mockCreateStream = vi.fn();

vi.mock('@/lib/donationVaultClient', () => ({
  useDonationVaultClient: vi.fn(),
}));

describe('CreateStreamForm', () => {
  beforeEach(() => {
    mockCreateStream.mockReset();
    mockPush.mockReset();
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
    await user.click(await screen.findByRole('button', { name: /confirm & sign/i }));

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
    await user.click(await screen.findByRole('button', { name: /confirm & sign/i }));

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
    await user.click(await screen.findByRole('button', { name: /confirm & sign/i }));

    // 1 000 000 stroops = 0.1 XLM.
    expect(await screen.findByText(/estimated network fee: ≈ 0.1 xlm/i)).toBeInTheDocument();
  });

  describe('quick-amount presets', () => {
    it('fills the amount field when a preset is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

      await user.click(screen.getByRole('button', { name: 'Set amount to 25' }));

      expect(screen.getByPlaceholderText('100')).toHaveValue(25);
    });

    it('still allows manual typing after a preset is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

      await user.click(screen.getByRole('button', { name: 'Set amount to 25' }));
      expect(screen.getByPlaceholderText('100')).toHaveValue(25);

      const input = screen.getByPlaceholderText('100');
      await user.clear(input);
      await user.type(input, '42');

      expect(input).toHaveValue(42);
    });

    it('lets manual entry override a preset, and a later preset override manual entry', async () => {
      const user = userEvent.setup();
      render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);
      const input = screen.getByPlaceholderText('100');

      await user.type(input, '7');
      expect(input).toHaveValue(7);

      await user.click(screen.getByRole('button', { name: 'Set amount to 100' }));
      expect(input).toHaveValue(100);
    });
  });

  describe('confirmation summary', () => {
    it('shows NGO, token, amount, rate, duration, and end date before signing', async () => {
      const user = userEvent.setup();
      render(
        <CreateStreamForm ngoAddress={NGO_ADDRESS} ngoId={NGO_ID} ngoName={NGO_NAME} />,
      );

      await user.type(screen.getByPlaceholderText('100'), '100');
      await user.click(screen.getByRole('button', { name: /review & sign/i }));

      const dialog = await screen.findByRole('dialog', { name: /confirm your stream/i });
      expect(dialog).toHaveTextContent(NGO_NAME);
      expect(dialog).toHaveTextContent('XLM (native)');
      expect(dialog).toHaveTextContent('100');
      expect(dialog).toHaveTextContent('/ second');
      expect(dialog).toHaveTextContent('1 month');

      // Not yet signed — the contract call is gated behind Confirm.
      expect(mockCreateStream).not.toHaveBeenCalled();
    });

    it('does not call the contract until Confirm & Sign is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

      await user.type(screen.getByPlaceholderText('100'), '100');
      await user.click(screen.getByRole('button', { name: /review & sign/i }));

      await screen.findByRole('dialog');
      expect(mockCreateStream).not.toHaveBeenCalled();
    });

    it('returns to the form without calling the contract when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

      await user.type(screen.getByPlaceholderText('100'), '100');
      await user.click(screen.getByRole('button', { name: /review & sign/i }));
      await screen.findByRole('dialog');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockCreateStream).not.toHaveBeenCalled();
      // The form is interactive again with the amount preserved.
      expect(screen.getByPlaceholderText('100')).toHaveValue(100);
      expect(screen.getByRole('button', { name: /review & sign/i })).not.toBeDisabled();
    });

    it('calls the contract exactly once after confirming', async () => {
      mockCreateStream.mockResolvedValue({
        signAndSend: vi.fn().mockResolvedValue({ result: 42n }),
      });
      const user = userEvent.setup();
      render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

      await user.type(screen.getByPlaceholderText('100'), '100');
      await user.click(screen.getByRole('button', { name: /review & sign/i }));
      await user.click(await screen.findByRole('button', { name: /confirm & sign/i }));

      await screen.findByText(/stream started/i);
      expect(mockCreateStream).toHaveBeenCalledTimes(1);
    });
  });
});
