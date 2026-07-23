import { qs, qsa } from '../shared/dom';

/** Kaynakla aynı biçim: tr-TR binlik ayraç + opsiyonel suffix (ör. "1.096 m"). */
export function formatCounterValue(value: number, suffix = ''): string {
  return value.toLocaleString('tr-TR') + suffix;
}

/** Sayaçlar stats bölümü viewport'a girince 0'dan hedefe animasyon; yalnızca bir kez. */
export function initCounters(): void {
  const counters = qsa('.stat-number');
  let countersDone = false;

  const animateCounters = () => {
    if (countersDone) return;
    const statsSection = qs('.stats');
    if (!statsSection) return;
    const rect = statsSection.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      countersDone = true;
      counters.forEach((counter) => {
        const target = parseInt(counter.getAttribute('data-target') ?? '0');
        const suffix = counter.getAttribute('data-suffix') || '';
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const update = () => {
          current += step;
          if (current < target) {
            counter.textContent = formatCounterValue(Math.floor(current), suffix);
            requestAnimationFrame(update);
          } else {
            counter.textContent = formatCounterValue(target, suffix);
          }
        };
        update();
      });
    }
  };
  window.addEventListener('scroll', animateCounters);
}
