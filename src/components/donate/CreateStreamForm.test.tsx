import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDonationVaultClient } from '@/lib/donationVaultClient';

import { CreateStreamForm } from './CreateStreamForm';

const DONOR_ADDRESS = 'G' + 'D'.repeat(55);
const NGO_ADDRESS = 'G' + 'N'.repeat(55);
const NGO_ID = 'ngo-1';
const NATIVE_TOKEN_ADDRESS = 'CNATIVEFAKE';
const USDC_TOKEN_ADDRESS = 'CUSDCFAKE';
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
  DONATION_VAULT_CONTRACT_ID: 'CDONATIONVAULT',
  getNativeAssetAddress: () => NATIVE_TOKEN_ADDRESS,
  getUsdcAssetAddress: () => USDC_TOKEN_ADDRESS,
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

    // 0.000001 * 10^7 = 10 raw units; 10 / (30 days in seconds) rounds to 0.
    // Not 0.0000001 (1 raw unit): jsdom's number input normalizes a value
    // below 1e-6 to scientific notation ("1e-7") once committed, which
    // parseAmount's plain-decimal regex doesn't parse -- the same behavior a
    // real browser shows for a number input below 1e-6, not a testing
    // artifact.
    await user.type(screen.getByPlaceholderText('100'), '0.000001');

    expect(screen.getByText(/too small to stream over this duration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review & sign/i })).toBeDisabled();
  });

  it('surfaces the effective streamed total and leftover when the deposit does not divide evenly (#156)', async () => {
    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    // 100 XLM over the default 1-month (30-day) duration: 1_000_000_000n
    // stroops / 2_592_000 seconds = 385 stroops/sec (truncated), so only
    // 385 * 2_592_000 = 997_920_000 stroops (99.792 XLM) actually streams
    // out of the 1_000_000_000 stroop (100 XLM) deposit -- a leftover of
    // 2_080_000 stroops (0.208 XLM) that the contract has no way to return
    // except on cancel.
    await user.type(screen.getByPlaceholderText('100'), '100');

    expect(
      screen.getByText(/only 99\.792 of your deposit will stream out at this rate/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/the remaining 0\.208 stays in the stream/i)).toBeInTheDocument();
  });

  it('does not show a leftover warning when the deposit divides evenly by the duration', async () => {
    const user = userEvent.setup();
    render(<CreateStreamForm ngoAddress={NGO_ADDRESS} />);

    // 1 week = 604_800 seconds. A deposit of exactly 604_800 stroops gives a
    // rate of 1 stroop/sec with zero remainder.
    await user.selectOptions(screen.getByLabelText(/stream over/i), '604800');
    await user.type(screen.getByPlaceholderText('100'), '0.0604800');

    expect(screen.queryByText(/stays in the stream/i)).not.toBeInTheDocument();
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
});
