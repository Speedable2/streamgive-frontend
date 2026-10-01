import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { middleware } from './middleware';

function requestFor(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, 'https://example.com'));
}

describe('security headers middleware', () => {
  it('blocks framing on a non-embed route', () => {
    const response = middleware(requestFor('/dashboard'));

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('leaves /embed routes frameable for NGO sites', () => {
    const response = middleware(requestFor('/embed/ngo-1'));

    expect(response.headers.get('X-Frame-Options')).toBeNull();
  });

  it('sets X-Content-Type-Options and Referrer-Policy on every route, embed included', () => {
    for (const path of ['/dashboard', '/embed/ngo-1']) {
      const response = middleware(requestFor(path));

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    }
  });
});
