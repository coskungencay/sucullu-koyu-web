/* =============================================
   SÜCÜLLÜ KÖYÜ - Ana JavaScript Dosyası
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

  // --- Hero yükleme animasyonu ---
  const hero = document.querySelector('.hero');
  if (hero) {
    setTimeout(() => hero.classList.add('loaded'), 100);
  }

  // --- Navbar Scroll ---
  const navbar = document.querySelector('.navbar');
  const handleNavScroll = () => {
    if (window.scrollY > 80) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', handleNavScroll);
  handleNavScroll();

  // --- Mobil Menü ---
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  const overlay = document.querySelector('.mobile-overlay');

  const toggleMenu = () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
  };

  if (hamburger) {
    hamburger.addEventListener('click', toggleMenu);
  }
  if (overlay) {
    overlay.addEventListener('click', toggleMenu);
  }

  // Nav link tıklama - mobil menüyü kapat
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      if (navLinks.classList.contains('active')) {
        toggleMenu();
      }
    });
  });

  // --- Aktif Nav Link ---
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.nav-links a');

  const updateActiveNav = () => {
    const scrollPos = window.scrollY + 200;
    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      if (scrollPos >= top && scrollPos < top + height) {
        navItems.forEach(a => a.classList.remove('active'));
        const active = document.querySelector(`.nav-links a[href="#${id}"]`);
        if (active) active.classList.add('active');
      }
    });
  };
  window.addEventListener('scroll', updateActiveNav);

  // --- Sayaç Animasyonu ---
  const counters = document.querySelectorAll('.stat-number');
  let countersDone = false;

  const animateCounters = () => {
    if (countersDone) return;
    const statsSection = document.querySelector('.stats');
    if (!statsSection) return;
    const rect = statsSection.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      countersDone = true;
      counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'));
        const suffix = counter.getAttribute('data-suffix') || '';
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const update = () => {
          current += step;
          if (current < target) {
            counter.textContent = Math.floor(current).toLocaleString('tr-TR') + suffix;
            requestAnimationFrame(update);
          } else {
            counter.textContent = target.toLocaleString('tr-TR') + suffix;
          }
        };
        update();
      });
    }
  };
  window.addEventListener('scroll', animateCounters);

  // --- Scroll Reveal Animasyonları ---
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // --- Galeri - Daha Fazla Göster ---
  const galleryItems = document.querySelectorAll('.gallery-item');
  const loadMoreBtn = document.getElementById('loadMore');
  const initialShow = 12;

  // Başlangıçta sadece ilk 12'yi göster
  galleryItems.forEach((item, index) => {
    if (index >= initialShow) {
      item.classList.add('hidden');
    }
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      const hiddenItems = document.querySelectorAll('.gallery-item.hidden');
      hiddenItems.forEach(item => {
        item.classList.remove('hidden');
      });
      loadMoreBtn.style.display = 'none';
    });
  }

  // --- Lightbox ---
  const lightbox = document.querySelector('.lightbox');
  const lightboxImg = document.querySelector('.lightbox-img');
  const lightboxClose = document.querySelector('.lightbox-close');
  const lightboxPrev = document.querySelector('.lightbox-prev');
  const lightboxNext = document.querySelector('.lightbox-next');
  const lightboxCounter = document.querySelector('.lightbox-counter');
  let currentImgIndex = 0;
  let galleryImages = [];

  const openLightbox = (index) => {
    // Sadece görünür olanları al
    galleryImages = Array.from(document.querySelectorAll('.gallery-item:not(.hidden) img'));
    currentImgIndex = index;
    updateLightboxImage();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  };

  const updateLightboxImage = () => {
    if (galleryImages[currentImgIndex]) {
      lightboxImg.src = galleryImages[currentImgIndex].src;
      lightboxCounter.textContent = `${currentImgIndex + 1} / ${galleryImages.length}`;
    }
  };

  const prevImage = () => {
    currentImgIndex = (currentImgIndex - 1 + galleryImages.length) % galleryImages.length;
    updateLightboxImage();
  };

  const nextImage = () => {
    currentImgIndex = (currentImgIndex + 1) % galleryImages.length;
    updateLightboxImage();
  };

  // Galeri item tıklama
  document.querySelectorAll('.gallery-item').forEach((item, idx) => {
    item.addEventListener('click', () => {
      // Görünür item'lar arasındaki index'i bul
      const visibleItems = Array.from(document.querySelectorAll('.gallery-item:not(.hidden)'));
      const visibleIndex = visibleItems.indexOf(item);
      openLightbox(visibleIndex >= 0 ? visibleIndex : 0);
    });
  });

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxPrev) lightboxPrev.addEventListener('click', prevImage);
  if (lightboxNext) lightboxNext.addEventListener('click', nextImage);

  // Lightbox tuş kontrolü
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') prevImage();
    if (e.key === 'ArrowRight') nextImage();
  });

  // Lightbox arkaplan tıklama
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // --- Back to Top ---
  const backToTop = document.querySelector('.back-to-top');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  });

  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

});
