import { describe, expect, it } from 'vitest';
import { formatCounterValue } from '../../src/main/counters';

describe('sayaç biçimlendirme (kaynak toLocaleString tr-TR davranışı)', () => {
  it('binlik ayraç nokta ile', () => {
    expect(formatCounterValue(1502)).toBe('1.502');
    expect(formatCounterValue(1478)).toBe('1.478');
  });

  it('mahalle sayısı ayraçsız', () => {
    expect(formatCounterValue(6)).toBe('6');
  });

  it('rakım " m" suffix alır', () => {
    expect(formatCounterValue(1096, ' m')).toBe('1.096 m');
  });
});
