import { initRenderer } from './renderer.js';
import { initControls } from './controls.js';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('packet-canvas');
  initRenderer(canvas);
  initControls();
});
