import { qsa } from '../shared/dom';

export const INITIAL_GALLERY_COUNT = 12;

/**
 * Kaynak davranışı: ilk yükte yalnızca ilk 12 görsel görünür, 13–53 `.hidden`.
 * Erişilebilirlik eklentisi (görsel parity'yi değiştirmez): kartlar klavyeyle
 * odaklanabilir buton semantiği kazanır.
 */
export function initGalleryInitialState(): void {
  const items = qsa('.gallery-item');
  items.forEach((item, index) => {
    if (index >= INITIAL_GALLERY_COUNT) {
      item.classList.add('hidden');
    }
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute(
      'aria-label',
      `Sücüllü Köyü fotoğrafı ${index + 1} / ${items.length} — büyüt`,
    );
  });
}

/** Kaynak davranışı: tüm .hidden kaldırılır, buton gizlenir; geri daraltma yok. */
export function expandGallery(): void {
  qsa('.gallery-item.hidden').forEach((item) => {
    item.classList.remove('hidden');
  });
  const loadMoreBtn = document.getElementById('loadMore');
  if (loadMoreBtn) loadMoreBtn.style.display = 'none';
}

/** "Tüm Fotoğrafları Göster" butonunu bağlar; idempotent. */
export function initGalleryExpand(): boolean {
  const loadMoreBtn = document.getElementById('loadMore');
  if (!loadMoreBtn || loadMoreBtn.dataset.expandInit === 'true') return false;
  loadMoreBtn.dataset.expandInit = 'true';
  loadMoreBtn.addEventListener('click', () => expandGallery());
  return true;
}
