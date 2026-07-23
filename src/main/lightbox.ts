import { qs, qsa } from '../shared/dom';
import {
  closeState,
  counterText,
  createLightboxState,
  nextIndex,
  openState,
  prevIndex,
} from './lightbox-core';

/**
 * Kaynak main.js lightbox davranışının birebir portu + erişilebilirlik:
 * - Görünür galeri kartına tıklayınca açılır (kaynak gibi görünür set üzerinden).
 * - Sağ/sol butonlar ve ArrowLeft/ArrowRight modulo wrap ile gezinir.
 * - Escape, kapat butonu ve overlay tıklaması kapatır (hepsi kaynakta var).
 * - Açıkken body scroll kilitlenir; kapanınca önceki değer geri yüklenir.
 * - Erişilebilirlik: role=dialog/aria-modal (markup'ta), focus açılışta kapat
 *   butonuna taşınır, kapanışta açan karta döner; kartlar klavyeyle açılabilir.
 *
 * initLightbox idempotenttir: ikinci çağrı listener eklemez.
 */
export function initLightbox(): boolean {
  const lightbox = qs('.lightbox');
  if (!lightbox || lightbox.dataset.lightboxInit === 'true') return false;
  lightbox.dataset.lightboxInit = 'true';

  const lightboxImg = qs<HTMLImageElement>('.lightbox-img', lightbox);
  const lightboxClose = qs('.lightbox-close', lightbox);
  const lightboxPrev = qs('.lightbox-prev', lightbox);
  const lightboxNext = qs('.lightbox-next', lightbox);
  const lightboxCounter = qs('.lightbox-counter', lightbox);
  if (!lightboxImg || !lightboxClose || !lightboxPrev || !lightboxNext || !lightboxCounter) {
    return false;
  }

  let state = createLightboxState();
  // Kaynak gibi: açılış anında yalnızca görünür item'ların görselleri alınır.
  let galleryImages: HTMLImageElement[] = [];
  let prevBodyOverflow = '';

  const updateImage = () => {
    const img = galleryImages[state.currentIndex];
    if (img) {
      lightboxImg.src = img.src;
      lightboxCounter.textContent = counterText(state.currentIndex, galleryImages.length);
    }
  };

  // visibility hidden→visible geçişi tamamlanmadan focus() tutmaz. Butonun
  // KENDİ transition'ı (kaynak: all 0.3s) miras visibility'yi ~150ms hidden
  // tuttuğundan, odaklanacak elemanın kendi computed değeri beklenir.
  const focusWhenVisible = (el: HTMLElement, tries = 0) => {
    if (!state.isOpen) return;
    if (getComputedStyle(el).visibility === 'visible') {
      el.focus();
    } else if (tries < 60) {
      requestAnimationFrame(() => focusWhenVisible(el, tries + 1));
    }
  };

  const open = (index: number, opener: Element | null) => {
    galleryImages = qsa<HTMLImageElement>('.gallery-item:not(.hidden) img');
    state = openState(index, galleryImages.length, opener);
    updateImage();
    prevBodyOverflow = document.body.style.overflow;
    lightbox.classList.add('active');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    focusWhenVisible(lightboxClose);
  };

  const close = () => {
    if (!state.isOpen) return;
    const opener = state.opener;
    state = closeState(state);
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = prevBodyOverflow;
    if (opener instanceof HTMLElement) opener.focus();
  };

  const showPrev = () => {
    state = { ...state, currentIndex: prevIndex(state.currentIndex, galleryImages.length) };
    updateImage();
  };

  const showNext = () => {
    state = { ...state, currentIndex: nextIndex(state.currentIndex, galleryImages.length) };
    updateImage();
  };

  // Galeri kartları: tıklama + klavye (Enter/Space) ile açılış
  qsa('.gallery-item').forEach((item) => {
    const openFromItem = () => {
      const visibleItems = qsa('.gallery-item:not(.hidden)');
      const visibleIndex = visibleItems.indexOf(item);
      open(visibleIndex >= 0 ? visibleIndex : 0, item);
    };
    item.addEventListener('click', openFromItem);
    item.addEventListener('keydown', (e) => {
      const key = (e as KeyboardEvent).key;
      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        openFromItem();
      }
    });
  });

  lightboxClose.addEventListener('click', close);
  lightboxPrev.addEventListener('click', showPrev);
  lightboxNext.addEventListener('click', showNext);

  // Tek document listener; kapalıyken erken çıkar (gereksiz işlem yok).
  document.addEventListener('keydown', (e) => {
    if (!state.isOpen) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  });

  // Kaynaktaki overlay tıklamasıyla kapatma (e.target === lightbox)
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });

  return true;
}
