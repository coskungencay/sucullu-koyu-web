import { qsa } from '../shared/dom';

export const INITIAL_GALLERY_COUNT = 12;

/**
 * Sprint 1 kapsamı: galerinin statik iskeleti — ilk 12 görsel görünür,
 * 13-53 kaynaktaki gibi .hidden. "Tüm Fotoğrafları Göster" genişletmesi,
 * lightbox ve klavye etkileşimleri Sprint 2'de bağlanacaktır.
 */
export function initGalleryInitialState(): void {
  qsa('.gallery-item').forEach((item, index) => {
    if (index >= INITIAL_GALLERY_COUNT) {
      item.classList.add('hidden');
    }
  });
}
