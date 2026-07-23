import { qsa } from '../shared/dom';

/** Kaynakla aynı scroll reveal: threshold 0.15, rootMargin -50px, tek seferlik. */
export function initReveal(): void {
  const revealElements = qsa('.reveal, .reveal-left, .reveal-right');
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px',
    },
  );

  revealElements.forEach((el) => revealObserver.observe(el));
}
