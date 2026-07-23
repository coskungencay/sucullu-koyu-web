import { qs, qsa } from '../shared/dom';

/** Kaynak js/main.js davranışlarının birebir portu: navbar, mobil menü, aktif link, back-to-top. */
export function initNavigation(): void {
  // --- Hero yükleme animasyonu ---
  const hero = qs('.hero');
  if (hero) {
    setTimeout(() => hero.classList.add('loaded'), 100);
  }

  // --- Navbar Scroll ---
  const navbar = qs('.navbar');
  const handleNavScroll = () => {
    if (!navbar) return;
    if (window.scrollY > 80) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', handleNavScroll);
  handleNavScroll();

  // --- Mobil Menü ---
  const hamburger = qs('.hamburger');
  const navLinks = qs('.nav-links');
  const overlay = qs('.mobile-overlay');

  const toggleMenu = () => {
    hamburger?.classList.toggle('active');
    navLinks?.classList.toggle('active');
    overlay?.classList.toggle('active');
    document.body.style.overflow = navLinks?.classList.contains('active') ? 'hidden' : '';
  };

  hamburger?.addEventListener('click', toggleMenu);
  overlay?.addEventListener('click', toggleMenu);

  // Nav link tıklama - mobil menüyü kapat
  qsa('.nav-links a').forEach((link) => {
    link.addEventListener('click', () => {
      if (navLinks?.classList.contains('active')) {
        toggleMenu();
      }
    });
  });

  // --- Aktif Nav Link ---
  const sections = qsa<HTMLElement>('section[id]');
  const navItems = qsa('.nav-links a');

  const updateActiveNav = () => {
    const scrollPos = window.scrollY + 200;
    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      if (scrollPos >= top && scrollPos < top + height) {
        navItems.forEach((a) => a.classList.remove('active'));
        const active = qs(`.nav-links a[href="#${id}"]`);
        if (active) active.classList.add('active');
      }
    });
  };
  window.addEventListener('scroll', updateActiveNav);

  // --- Back to Top ---
  const backToTop = qs('.back-to-top');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
      backToTop?.classList.add('visible');
    } else {
      backToTop?.classList.remove('visible');
    }
  });

  backToTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
