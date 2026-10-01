import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyAddressButton } from './CopyAddressButton';

describe('CopyAddressButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls navigator.clipboard.writeText with the full, untruncated address and shows Copied! then resets', async () => {
    const writeTextMock = vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
    const fullAddress = 'G' + 'A'.repeat(55);
    
    render(<CopyAddressButton address={fullAddress} />);
    
    const button = screen.getByRole('button', { name: `Copy address ${fullAddress}` });
    expect(button).toHaveTextContent('Copy');
    
    await act(async () => {
      fireEvent.click(button);
    });
    
    expect(writeTextMock).toHaveBeenCalledWith(fullAddress);
    expect(button).toHaveTextContent('Copied!');
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    
    expect(button).toHaveTextContent('Copy');
  });

  it('fails silently and leaves the label unchanged if clipboard write rejects', async () => {
    const writeTextMock = vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Denied'));
    const fullAddress = 'G' + 'B'.repeat(55);
    
    render(<CopyAddressButton address={fullAddress} />);
    
    const button = screen.getByRole('button', { name: `Copy address ${fullAddress}` });
    
    await act(async () => {
      fireEvent.click(button);
    });
    
    expect(writeTextMock).toHaveBeenCalledWith(fullAddress);
    expect(button).toHaveTextContent('Copy');
  });
});
