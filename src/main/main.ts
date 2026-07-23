import { initNavigation } from './navigation';
import { initReveal } from './reveal';
import { initCounters } from './counters';
import { initGalleryInitialState } from './gallery';
import { renderCameraPreviews } from '../camera/camera-preview';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initCounters();
  initGalleryInitialState();
  renderCameraPreviews();
  // Reveal en son: kamera kartları grid'e eklendikten sonra gözlemlenmeli.
  initReveal();
});
