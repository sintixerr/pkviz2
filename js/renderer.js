import { getState } from './state.js';
import { hexToRgb, lerpColor } from './color-utils.js';

let canvas, ctx, glowCanvas, glowCtx;
let imageData;
let densityBuffer;
let canvasWidth = 1500;
const canvasHeight = 256;

export function initRenderer(canvasElement) {
  canvas = canvasElement;
  glowCanvas = document.getElementById('glow-canvas');
  resizeCanvas();

  const observer = new ResizeObserver(() => scaleToFit());
  observer.observe(canvas.parentElement);
}

export function resizeCanvas() {
  const state = getState();
  canvasWidth = state.maxPacketSize;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  glowCanvas.width = canvasWidth;
  glowCanvas.height = canvasHeight;
  ctx = canvas.getContext('2d');
  glowCtx = glowCanvas.getContext('2d');
  imageData = ctx.createImageData(canvasWidth, canvasHeight);
  densityBuffer = new Uint16Array(canvasWidth * canvasHeight);
  scaleToFit();
}

function scaleToFit() {
  const container = canvas.parentElement;
  const availW = container.clientWidth;
  const availH = container.clientHeight;

  const displayW = Math.max(canvas.width, availW);
  const displayH = Math.max(canvas.height, availH);

  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';
  glowCanvas.style.width = displayW + 'px';
  glowCanvas.style.height = displayH + 'px';
}

function mapX(bytePos, state) {
  if (state.xAxisMode === 'logarithmic') {
    if (bytePos === 0) return 0;
    const logMax = Math.log(state.maxPacketSize + 1);
    return Math.round((Math.log(bytePos + 1) / logMax) * (canvasWidth - 1));
  }
  return Math.min(bytePos, canvasWidth - 1);
}

function mapY(byteValue) {
  return 255 - byteValue;
}

function drawGrid(data, bgRgb, state) {
  const gridR = Math.min(bgRgb[0] + 18, 255);
  const gridG = Math.min(bgRgb[1] + 18, 255);
  const gridB = Math.min(bgRgb[2] + 18, 255);

  for (let val = 0; val <= 255; val += 32) {
    const y = 255 - val;
    for (let x = 0; x < canvasWidth; x++) {
      const pi = (y * canvasWidth + x) * 4;
      data[pi] = gridR;
      data[pi + 1] = gridG;
      data[pi + 2] = gridB;
    }
  }

  const max = state.maxPacketSize;
  const step = max <= 300 ? 50 : max <= 600 ? 100 : max <= 1500 ? 200 : 500;
  for (let bytePos = 0; bytePos <= max; bytePos += step) {
    const x = mapX(bytePos, state);
    if (x >= canvasWidth) continue;
    for (let y = 0; y < canvasHeight; y++) {
      const pi = (y * canvasWidth + x) * 4;
      data[pi] = gridR;
      data[pi + 1] = gridG;
      data[pi + 2] = gridB;
    }
  }
}

export function render() {
  const state = getState();
  if (!canvas || state.totalPackets === 0) return;

  const windowEnd = state.currentIndex;
  const windowStart = Math.max(0, windowEnd - state.windowSize + 1);
  const activeWindowSize = windowEnd - windowStart + 1;

  const fillWidth = state.fillWidth;

  // Pass 1: compute density at each pixel
  densityBuffer.fill(0);
  for (let wi = 0; wi < activeWindowSize; wi++) {
    const packet = state.packets[windowStart + wi];
    const len = Math.min(packet.length, state.maxPacketSize);
    for (let b = 0; b < len; b++) {
      const x = mapX(b, state);
      const y = mapY(packet[b]);
      if (fillWidth) {
        const xEnd = (b + 1 < state.maxPacketSize) ? mapX(b + 1, state) : canvasWidth;
        const dotW = Math.max(1, xEnd - x);
        for (let dx = 0; dx < dotW; dx++) {
          if (x + dx < canvasWidth) {
            densityBuffer[y * canvasWidth + x + dx]++;
          }
        }
      } else {
        densityBuffer[y * canvasWidth + x]++;
      }
    }
  }

  // Find max density for auto-scaling
  let maxDensity = 1;
  for (let i = 0; i < densityBuffer.length; i++) {
    if (densityBuffer[i] > maxDensity) maxDensity = densityBuffer[i];
  }

  const bgRgb = [0, 0, 0];
  const coldRgb = hexToRgb(state.coldColor);
  const hotRgb = hexToRgb(state.hotColor);
  const data = imageData.data;

  // Fill canvas with background
  for (let i = 0; i < canvasWidth * canvasHeight; i++) {
    const pi = i * 4;
    data[pi] = bgRgb[0];
    data[pi + 1] = bgRgb[1];
    data[pi + 2] = bgRgb[2];
    data[pi + 3] = 255;
  }

  // Draw subtle grid
  drawGrid(data, bgRgb, state);

  // Pass 2: render packets oldest-to-newest
  for (let wi = 0; wi < activeWindowSize; wi++) {
    const ageT = activeWindowSize > 1 ? wi / (activeWindowSize - 1) : 1.0;
    const fadeCurve = ageT * ageT;
    const brightness = state.brightnessMin + (state.brightnessMax - state.brightnessMin) * fadeCurve;

    const packet = state.packets[windowStart + wi];
    const len = Math.min(packet.length, state.maxPacketSize);

    for (let b = 0; b < len; b++) {
      const x = mapX(b, state);
      const y = mapY(packet[b]);

      const density = densityBuffer[y * canvasWidth + x];
      const densityT = maxDensity > 1 ? Math.sqrt((density - 1) / (maxDensity - 1)) : 0;
      const base = lerpColor(coldRgb, hotRgb, densityT);

      const r = Math.round(bgRgb[0] + (base[0] - bgRgb[0]) * brightness);
      const g = Math.round(bgRgb[1] + (base[1] - bgRgb[1]) * brightness);
      const bv = Math.round(bgRgb[2] + (base[2] - bgRgb[2]) * brightness);

      if (fillWidth) {
        const xEnd = (b + 1 < state.maxPacketSize) ? mapX(b + 1, state) : canvasWidth;
        const dotW = Math.max(1, xEnd - x);
        for (let dx = 0; dx < dotW; dx++) {
          const px = x + dx;
          if (px >= canvasWidth) break;
          const pi = (y * canvasWidth + px) * 4;
          data[pi]     = r;
          data[pi + 1] = g;
          data[pi + 2] = bv;
        }
      } else {
        const pi = (y * canvasWidth + x) * 4;
        data[pi]     = r;
        data[pi + 1] = g;
        data[pi + 2] = bv;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Glow pass: copy main canvas to glow canvas (CSS blur + opacity handles the bloom)
  glowCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  glowCtx.drawImage(canvas, 0, 0);
}
