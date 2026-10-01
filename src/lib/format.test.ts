import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseAmount, truncateAddress } from './format';
import { formatAmount } from './format';

describe('formatAmount', () => {
  it('formats a typical amount correctly', () => {
    // 10_0000000 base units = 10 XLM
    expect(formatAmount('100000000')).toBe('10');
  });

  it('formats zero as 0', () => {
    expect(formatAmount('0')).toBe('0');
  });

  it('formats a large value near safe integer precision', () => {
    // 9_000_000 XLM = 90_000_000_0000000 base units (well within i128, close
    // to the upper end of typical treasury balances used in production)
    const raw = '90000000000000'; // 9_000_000 XLM
    expect(formatAmount(raw)).toBe('9,000,000');
  });

  it('does not lose precision for a raw amount past Number.MAX_SAFE_INTEGER', () => {
    // 9007199254740993 can't be represented exactly as a JS double (it
    // rounds down to ...992), so a naive Number(BigInt(raw)) conversion
    // would corrupt the last digit before the division even happens.
    const raw = '9007199254740993';
    expect(formatAmount(raw)).toBe('900,719,925.4740993');
  });

  // issue #155: the same raw amount must render identically no matter which
  // locale the viewer's browser is set to -- the previous implementation's
  // BigInt.toLocaleString(undefined, ...) would have rendered the whole part
  // with de-DE's period grouping separator and its own decimal-separator
  // lookup would have returned "," for the same browser, together producing
  // "1.234,5" instead of the fixed "1,234.5" every viewer must see.
  describe('under a non-default browser locale', () => {
    // Monkey-patches BigInt.prototype.toLocaleString to render as de-DE
    // (period grouping, comma decimal) whenever called with no explicit
    // locale, exactly mimicking what a de-DE browser's Intl implementation
    // does -- so this test fails the same way a real de-DE browser would if
    // formatAmount ever went back to passing `undefined` instead of a fixed
    // locale.
    const original = BigInt.prototype.toLocaleString;

    beforeEach(() => {
      vi.spyOn(BigInt.prototype, 'toLocaleString').mockImplementation(function (
        this: bigint,
        ...args: Parameters<typeof original>
      ) {
        const [locale, opts] = args;
        return original.call(this, locale ?? 'de-DE', opts);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('still renders en-US grouping and decimal separators', () => {
      expect(formatAmount('90000000000000')).toBe('9,000,000');
      expect(formatAmount('15000000')).toBe('1.5');
    });
  });
});

describe('parseAmount', () => {
  it('accepts a whole amount written with leading zeros', () => {
    // '007' is 7 XLM either way — 7 * 10^7 base units. The leading zeros
    // must not be read as an octal literal or truncated.
    expect(parseAmount('007')).toBe(70_000_000n);
  });

  it('accepts a trailing decimal separator with no fractional digits', () => {
    // '5.' is a normal intermediate state while typing '5.5'; the empty
    // fraction is worth zero, so the amount is exactly 5 XLM.
    expect(parseAmount('5.')).toBe(50_000_000n);
  });

  it('accepts a fractional-only amount with no integer part', () => {
    // '.5' is half an XLM — 0.5 * 10^7 = 5_000_000 base units. The missing
    // whole part is read as 0 rather than making the input invalid.
    expect(parseAmount('.5')).toBe(5_000_000n);
  });
});

describe('truncateAddress', () => {
  it('truncates a full-length Stellar address', () => {
    const address = 'G' + 'A'.repeat(55);
    expect(truncateAddress(address)).toBe('GAAA…AAAA');
  });

  it('returns the original string when it is shorter than 9 characters', () => {
    expect(truncateAddress('GABC')).toBe('GABC');
    expect(truncateAddress('')).toBe('');
    expect(truncateAddress('GABCDEFG')).toBe('GABCDEFG');
  });

  it('truncates a string of exactly 9 characters without overlap', () => {
    // 4 + ellipsis + 4 = 9, so the boundary case should still truncate
    expect(truncateAddress('ABCDE1234')).toBe('ABCD…1234');
  });
});
