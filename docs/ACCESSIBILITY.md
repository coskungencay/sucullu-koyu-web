# ACCESSIBILITY — Erişilebilirlik Notları (Sprint 2)

Görsel parity'yi değiştirmeden eklenen erişilebilirlik katmanı. Kaynak sitede
bu davranışlar yoktur; hepsi CTO onaylı görünmez eklentidir ve
`docs/SOURCE_AUDIT.md` §7'de sapma olarak kayıtlıdır.

## Galeri kartları

- Çalışma zamanında (`src/main/gallery.ts`) her karta `role="button"`,
  `tabindex="0"` ve anlamlı `aria-label`
  (`Sücüllü Köyü fotoğrafı N / 53 — büyüt`) eklenir; HTML kaynak markup'ı
  kaynakla birebir kalır.
- Enter ve Space kartı açar (`src/main/lightbox.ts`).

## Lightbox

- Markup: `role="dialog"`, `aria-modal="true"`,
  `aria-label="Fotoğraf galerisi görüntüleyici"`, kapalıyken `aria-hidden="true"`.
- Kontroller: `aria-label` — Kapat / Önceki fotoğraf / Sonraki fotoğraf;
  sayaç `aria-live="polite"`.
- Focus yönetimi: açılmadan önce açan element saklanır; açılınca focus kapat
  butonuna taşınır; kapanınca açan karta geri döner.
  - Teknik not: kaynak CSS'te `.lightbox-close`/`.lightbox-nav` kendi
    `transition: all 0.3s`'ine sahip olduğundan miras `visibility` ~150 ms
    `hidden` kalır ve anında `focus()` tutmaz. `focusWhenVisible()` elemanın
    kendi computed visibility'si `visible` olana kadar frame bazında bekler.
- Kapalı lightbox focus almaz: kaynak CSS'in `visibility: hidden` durumu
  butonları sequential focus dışında bırakır (E2E ile doğrulanır).
- Klavye: Escape kapatır, ArrowLeft/ArrowRight gezinir. Tek `document`
  listener'ı vardır; kapalıyken erken döner. `initLightbox()` idempotenttir —
  ikinci çağrı listener eklemez (unit test ile sabit).
- Body scroll kilidi açılışta uygulanır; kapanışta önceki `overflow` değeri
  geri yüklenir.

## Focus-visible stilleri

`src/main/a11y.css` (ayrı dosya; `main.css` kaynak portu bozulmaz):
galeri kartı, galeri butonu, lightbox kontrolleri ve back-to-top için
`:focus-visible` durumunda 3 px altın (`--accent`) outline. Yalnızca klavye
odaklanmasında görünür; fare etkileşimlerinde ve screenshot parity'de etkisizdir.

## Doğrulama

- E2E: `tests/e2e/gallery.spec.ts` — "erişilebilirlik" describe bloğu
  (dialog öznitelikleri, klavye ile açma, focus iadesi, accessible name'ler,
  kapalıyken focus almama).
- Görsel: `reference/screenshots/interactions/clone/focus-visible-390x844.png`
  (clone-only golden).
- Lighthouse Accessibility ölçümü Sprint 4 (hardening) kapsamındadır.
