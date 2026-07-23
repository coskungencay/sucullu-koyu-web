import { initNavigation } from './navigation';
import { initReveal } from './reveal';
import { initCounters } from './counters';
import { initGalleryExpand, initGalleryInitialState } from './gallery';
import { initLightbox } from './lightbox';
import { renderCameraPreviews } from '../camera/camera-preview';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initCounters();
  initGalleryInitialState();
  initGalleryExpand();
  initLightbox();
  renderCameraPreviews();
  // Reveal en son: kamera kartları grid'e eklendikten sonra gözlemlenmeli.
  initReveal();
});
