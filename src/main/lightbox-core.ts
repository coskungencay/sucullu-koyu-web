/**
 * Lightbox saf state fonksiyonları — DOM'suz, unit-testlenebilir.
 * Kaynak main.js'in modulo wrap ve sayaç davranışının birebir karşılığı.
 */

export type LightboxState = {
  isOpen: boolean;
  currentIndex: number;
  opener: Element | null;
};

export function createLightboxState(): LightboxState {
  return { isOpen: false, currentIndex: 0, opener: null };
}

/** Geçersiz index'e karşı koruma: tam sayı değilse veya aralık dışıysa 0. */
export function safeIndex(index: number, length: number): number {
  if (!Number.isInteger(index) || length <= 0) return 0;
  return index >= 0 && index < length ? index : 0;
}

/** Kaynak: (i + 1) % len — son görselden ilke wrap. */
export function nextIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return (safeIndex(index, length) + 1) % length;
}

/** Kaynak: (i - 1 + len) % len — ilk görselden sona wrap. */
export function prevIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return (safeIndex(index, length) - 1 + length) % length;
}

/** Kaynak sayaç biçimi: "1 / 53". */
export function counterText(index: number, length: number): string {
  return `${safeIndex(index, length) + 1} / ${length}`;
}

export function openState(index: number, length: number, opener: Element | null): LightboxState {
  return { isOpen: true, currentIndex: safeIndex(index, length), opener };
}

export function closeState(state: LightboxState): LightboxState {
  return { ...state, isOpen: false, opener: null };
}
