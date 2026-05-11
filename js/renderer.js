import { getState } from './state.js';
import { hexToRgb, lerpColor } from './color-utils.js';

let canvas, ctx, glowCanvas, glowCtx;
let imageData;
let densityBuffer;
let canvasWidth = 1500;
const canvasHeight = 256;

let jitterSeed = 0;

function seededRandom(seed) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

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

function mapY(byteValue, state) {
  if (state.yInverted) return byteValue;
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

function plotPixel(data, x, y, r, g, b, alpha) {
  if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) return;
  const pi = (y * canvasWidth + x) * 4;
  const a = alpha;
  data[pi]     = Math.round(data[pi] * (1 - a) + r * a);
  data[pi + 1] = Math.round(data[pi + 1] * (1 - a) + g * a);
  data[pi + 2] = Math.round(data[pi + 2] * (1 - a) + b * a);
}

export function render() {
  const state = getState();
  if (!canvas || state.totalPackets === 0) return;

  const windowEnd = state.currentIndex;
  const windowStart = Math.max(0, windowEnd - state.windowSize + 1);
  const activeWindowSize = windowEnd - windowStart + 1;
  const coolFx = state.coolFx;

  jitterSeed = state.currentIndex * 7.13;

  // Pass 1: compute density at each pixel
  densityBuffer.fill(0);
  for (let wi = 0; wi < activeWindowSize; wi++) {
    const packet = state.packets[windowStart + wi];
    const len = Math.min(packet.length, state.maxPacketSize);
    for (let b = 0; b < len; b++) {
      const x = mapX(b, state);
      const y = mapY(packet[b], state);
      densityBuffer[y * canvasWidth + x]++;
    }
  }

  // Find max density for auto-scaling
  let maxDensity = 1;
  for (let i = 0; i < densityBuffer.length; i++) {
    if (densityBuffer[i] > maxDensity) maxDensity = densityBuffer[i];
  }

  const bgRgb = hexToRgb(state.backgroundColor);
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
    const isNewest = wi === activeWindowSize - 1;

    const packet = state.packets[windowStart + wi];
    const len = Math.min(packet.length, state.maxPacketSize);

    for (let b = 0; b < len; b++) {
      const x = mapX(b, state);
      const y = mapY(packet[b], state);

      let fx = x;
      let fy = y;

      if (coolFx) {
        const seed = jitterSeed + wi * 31.37 + b * 17.93;
        const jx = (seededRandom(seed) - 0.5) * 3;
        const jy = (seededRandom(seed + 1.0) - 0.5) * 3;
        fx = Math.round(Math.max(0, Math.min(canvasWidth - 1, x + jx)));
        fy = Math.round(Math.max(0, Math.min(canvasHeight - 1, y + jy)));
      }

      const idx = fy * canvasWidth + fx;
      const density = densityBuffer[y * canvasWidth + x];
      const densityT = maxDensity > 1 ? Math.sqrt((density - 1) / (maxDensity - 1)) : 0;
      const base = lerpColor(coldRgb, hotRgb, densityT);

      const pi = idx * 4;
      data[pi]     = Math.round(bgRgb[0] + (base[0] - bgRgb[0]) * brightness);
      data[pi + 1] = Math.round(bgRgb[1] + (base[1] - bgRgb[1]) * brightness);
      data[pi + 2] = Math.round(bgRgb[2] + (base[2] - bgRgb[2]) * brightness);

      if (coolFx && isNewest) {
        const pulseR = Math.min(255, base[0] + 80);
        const pulseG = Math.min(255, base[1] + 80);
        const pulseB = Math.min(255, base[2] + 80);
        plotPixel(data, fx - 1, fy, pulseR, pulseG, pulseB, 0.4);
        plotPixel(data, fx + 1, fy, pulseR, pulseG, pulseB, 0.4);
        plotPixel(data, fx, fy - 1, pulseR, pulseG, pulseB, 0.4);
        plotPixel(data, fx, fy + 1, pulseR, pulseG, pulseB, 0.4);
        plotPixel(data, fx - 1, fy - 1, pulseR, pulseG, pulseB, 0.2);
        plotPixel(data, fx + 1, fy - 1, pulseR, pulseG, pulseB, 0.2);
        plotPixel(data, fx - 1, fy + 1, pulseR, pulseG, pulseB, 0.2);
        plotPixel(data, fx + 1, fy + 1, pulseR, pulseG, pulseB, 0.2);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Chromatic aberration: offset R and B channels
  if (coolFx) {
    const aberration = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const src = new Uint8ClampedArray(aberration.data);
    const dst = aberration.data;
    const shift = 2;

    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const pi = (y * canvasWidth + x) * 4;

        const rxSrc = Math.min(canvasWidth - 1, x + shift);
        const rpi = (y * canvasWidth + rxSrc) * 4;
        dst[pi] = src[rpi];

        const bxSrc = Math.max(0, x - shift);
        const bpi = (y * canvasWidth + bxSrc) * 4;
        dst[pi + 2] = src[bpi + 2];
      }
    }

    ctx.putImageData(aberration, 0, 0);
  }

  // Glow pass: copy main canvas to glow canvas (CSS blur + opacity handles the bloom)
  glowCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  glowCtx.drawImage(canvas, 0, 0);
}
