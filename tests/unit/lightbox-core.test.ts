import { describe, expect, it } from 'vitest';
import {
  closeState,
  counterText,
  nextIndex,
  openState,
  prevIndex,
  safeIndex,
} from '../../src/main/lightbox-core';

const N = 53;

describe('lightbox index hesapları (kaynak modulo wrap)', () => {
  it('next normal geçiş', () => {
    expect(nextIndex(0, N)).toBe(1);
    expect(nextIndex(25, N)).toBe(26);
  });

  it('next son görselden ilke wrap (53 → 1)', () => {
    expect(nextIndex(52, N)).toBe(0);
  });

  it('previous normal geçiş', () => {
    expect(prevIndex(5, N)).toBe(4);
  });

  it('previous ilk görselden sona wrap (1 → 53)', () => {
    expect(prevIndex(0, N)).toBe(52);
  });

  it('boş listede güvenli davranış', () => {
    expect(nextIndex(0, 0)).toBe(0);
    expect(prevIndex(0, 0)).toBe(0);
  });
});

describe('sayaç formatı', () => {
  it('kaynak biçimi "1 / 53"', () => {
    expect(counterText(0, N)).toBe('1 / 53');
    expect(counterText(1, N)).toBe('2 / 53');
    expect(counterText(52, N)).toBe('53 / 53');
  });
});

describe('invalid index koruması', () => {
  it('aralık dışı, negatif ve tam sayı olmayan değerler 0 olur', () => {
    expect(safeIndex(-1, N)).toBe(0);
    expect(safeIndex(53, N)).toBe(0);
    expect(safeIndex(999, N)).toBe(0);
    expect(safeIndex(2.5, N)).toBe(0);
    expect(safeIndex(NaN, N)).toBe(0);
    expect(safeIndex(10, N)).toBe(10);
  });
});

describe('lightbox state aç/kapat', () => {
  it('open: index ve opener set edilir', () => {
    const opener = { tag: 'fake' } as unknown as Element;
    const s = openState(7, N, opener);
    expect(s.isOpen).toBe(true);
    expect(s.currentIndex).toBe(7);
    expect(s.opener).toBe(opener);
  });

  it('open geçersiz index ile 0 kullanır', () => {
    const s = openState(999, N, null);
    expect(s.currentIndex).toBe(0);
  });

  it('close: isOpen false, opener temizlenir, index korunur', () => {
    const s = closeState(openState(7, N, null));
    expect(s.isOpen).toBe(false);
    expect(s.opener).toBeNull();
    expect(s.currentIndex).toBe(7);
  });
});
