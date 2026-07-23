// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  expandGallery,
  INITIAL_GALLERY_COUNT,
  initGalleryExpand,
  initGalleryInitialState,
} from '../../src/main/gallery';
import { initLightbox } from '../../src/main/lightbox';

const TOTAL = 53;

function buildGalleryDom(): void {
  document.body.innerHTML = `
    <div class="gallery-grid">
      ${Array.from(
        { length: TOTAL },
        (_, i) =>
          `<div class="gallery-item"><img src="gorseller/gorsel-${String(i + 1).padStart(2, '0')}.jpg" alt="Sücüllü Köyü" loading="lazy"></div>`,
      ).join('')}
    </div>
    <button id="loadMore">Tüm Fotoğrafları Göster</button>
    <div class="lightbox" aria-hidden="true">
      <button class="lightbox-close"></button>
      <button class="lightbox-nav lightbox-prev"></button>
      <button class="lightbox-nav lightbox-next"></button>
      <img class="lightbox-img" src="" alt="Sücüllü Köyü">
      <span class="lightbox-counter"></span>
    </div>`;
}

const visibleCount = () => document.querySelectorAll('.gallery-item:not(.hidden)').length;
const hiddenCount = () => document.querySelectorAll('.gallery-item.hidden').length;

beforeEach(() => {
  buildGalleryDom();
  document.body.style.overflow = '';
});

describe('galeri başlangıç durumu', () => {
  it('toplam 53 görsel bulunur', () => {
    expect(document.querySelectorAll('.gallery-item')).toHaveLength(TOTAL);
  });

  it('ilk yükte 12 görünür, 41 hidden', () => {
    initGalleryInitialState();
    expect(INITIAL_GALLERY_COUNT).toBe(12);
    expect(visibleCount()).toBe(12);
    expect(hiddenCount()).toBe(41);
  });

  it('görsel sırası korunur (gorsel-01 → gorsel-53)', () => {
    initGalleryInitialState();
    const srcs = Array.from(document.querySelectorAll('.gallery-item img')).map((i) =>
      i.getAttribute('src'),
    );
    expect(srcs[0]).toBe('gorseller/gorsel-01.jpg');
    expect(srcs[11]).toBe('gorseller/gorsel-12.jpg');
    expect(srcs[52]).toBe('gorseller/gorsel-53.jpg');
  });
});

describe('galeri expand', () => {
  it('expand sonrası 53 görünür, 0 hidden', () => {
    initGalleryInitialState();
    expandGallery();
    expect(visibleCount()).toBe(TOTAL);
    expect(hiddenCount()).toBe(0);
  });

  it('expand sonrası buton gizlenir', () => {
    initGalleryInitialState();
    initGalleryExpand();
    const btn = document.getElementById('loadMore') as HTMLButtonElement;
    btn.click();
    expect(btn.style.display).toBe('none');
    expect(visibleCount()).toBe(TOTAL);
  });

  it('initGalleryExpand idempotenttir (ikinci çağrı bağlamaz)', () => {
    expect(initGalleryExpand()).toBe(true);
    expect(initGalleryExpand()).toBe(false);
  });
});

describe('lightbox init yaşam döngüsü', () => {
  it('ikinci init duplicate listener üretmez (guard false döner)', () => {
    initGalleryInitialState();
    expect(initLightbox()).toBe(true);
    expect(initLightbox()).toBe(false);
  });

  it('karta tıklayınca açılır, sayaç görünür set üzerinden hesaplanır (kaynak davranışı)', () => {
    initGalleryInitialState();
    initLightbox();
    const first = document.querySelector('.gallery-item') as HTMLElement;
    first.click();
    const lightbox = document.querySelector('.lightbox') as HTMLElement;
    expect(lightbox.classList.contains('active')).toBe(true);
    // expand öncesi kaynak site gibi "1 / 12"
    expect(document.querySelector('.lightbox-counter')?.textContent).toBe('1 / 12');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('expand sonrası sayaç "1 / 53"; kapatınca scroll kilidi kalkar', () => {
    initGalleryInitialState();
    initGalleryExpand();
    initLightbox();
    (document.getElementById('loadMore') as HTMLButtonElement).click();
    (document.querySelector('.gallery-item') as HTMLElement).click();
    expect(document.querySelector('.lightbox-counter')?.textContent).toBe('1 / 53');
    (document.querySelector('.lightbox-close') as HTMLElement).click();
    const lightbox = document.querySelector('.lightbox') as HTMLElement;
    expect(lightbox.classList.contains('active')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });
});
