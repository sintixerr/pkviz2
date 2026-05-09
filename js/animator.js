import { getState, setState } from './state.js';
import { render } from './renderer.js';

let lastAdvanceTime = 0;
let rafId = null;

export function startAnimation() {
  if (rafId !== null) return;
  lastAdvanceTime = performance.now();
  setState({ playing: true });
  rafId = requestAnimationFrame(tick);
}

export function stopAnimation() {
  setState({ playing: false });
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function stepForward() {
  const state = getState();
  if (state.currentIndex < state.totalPackets - 1) {
    setState({ currentIndex: state.currentIndex + 1 });
    render();
  }
}

export function stepBack() {
  const state = getState();
  if (state.currentIndex > 0) {
    setState({ currentIndex: state.currentIndex - 1 });
    render();
  }
}

function tick(timestamp) {
  const state = getState();
  if (!state.playing) {
    rafId = null;
    return;
  }

  const msPerPacket = 1000 / state.speed;
  const elapsed = timestamp - lastAdvanceTime;
  const packetsToAdvance = Math.floor(elapsed / msPerPacket);

  if (packetsToAdvance > 0) {
    const newIndex = Math.min(state.currentIndex + packetsToAdvance, state.totalPackets - 1);
    lastAdvanceTime += packetsToAdvance * msPerPacket;
    setState({ currentIndex: newIndex });
    render();

    if (newIndex >= state.totalPackets - 1) {
      stopAnimation();
      return;
    }
  }

  rafId = requestAnimationFrame(tick);
}
