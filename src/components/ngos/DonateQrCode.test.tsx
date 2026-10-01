import { render, screen, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { APP_URL } from '@/lib/config';

import { DonateQrCode } from './DonateQrCode';

const NGO_ID = 'ngo-123';
const NGO_NAME = 'Clean Water Org';

describe('DonateQrCode', () => {
  it('renders a QR code and the donate URL for the given NGO', () => {
    render(<DonateQrCode ngoId={NGO_ID} ngoName={NGO_NAME} />);

    const expectedUrl = `${window.location.origin}/ngos/${NGO_ID}/donate`;

    expect(
      screen.getByRole('img', { name: `QR code linking to ${NGO_NAME}'s donate page` }),
    ).toBeInTheDocument();
    expect(screen.getByText(expectedUrl)).toBeInTheDocument();
  });

  it('falls back to APP_URL for the origin when server-rendered', () => {
    const html = renderToString(<DonateQrCode ngoId={NGO_ID} ngoName={NGO_NAME} />);

    expect(html).toContain(`${APP_URL}/ngos/${NGO_ID}/donate`);
  });

  it('triggers a PNG download of the rendered QR code', () => {
    render(<DonateQrCode ngoId={NGO_ID} ngoName={NGO_NAME} />);

    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,fake');
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    toDataURL.mockRestore();
    clickSpy.mockRestore();
  });

  it('slugifies the NGO name for the downloaded filename', () => {
    render(<DonateQrCode ngoId={NGO_ID} ngoName="Clean Water Org" />);

    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,fake',
    );
    let downloadedFilename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedFilename = this.download;
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(downloadedFilename).toBe('clean-water-org-donate-qr.png');

    vi.restoreAllMocks();
  });
});
