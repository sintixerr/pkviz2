import { getState, setState, subscribe } from './state.js';
import { parseFile } from './pcap-parser.js';
import { render, resizeCanvas } from './renderer.js';
import { startAnimation, stopAnimation, stepForward, stepBack } from './animator.js';

export function initControls() {
  const fileInput = document.getElementById('file-input');
  const loadBtn = document.getElementById('btn-load');
  const playBtn = document.getElementById('btn-play');
  const pauseBtn = document.getElementById('btn-pause');
  const stepFwdBtn = document.getElementById('btn-step-fwd');
  const stepBackBtn = document.getElementById('btn-step-back');

  loadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadPcapBuffer(ev.target.result);
    reader.readAsArrayBuffer(file);
    fileInput.value = '';
  });

  document.getElementById('btn-load-sample').addEventListener('click', () => {
    fetch('sample.pcap?t=' + Date.now())
      .then(r => {
        if (!r.ok) throw new Error('sample.pcap not found');
        return r.arrayBuffer();
      })
      .then(buf => loadPcapBuffer(buf))
      .catch(err => alert(err.message));
  });

  playBtn.addEventListener('click', () => {
    const state = getState();
    if (!state.fileLoaded) return;
    if (state.currentIndex >= state.totalPackets - 1) {
      setState({ currentIndex: 0 });
    }
    startAnimation();
  });

  pauseBtn.addEventListener('click', stopAnimation);
  stepFwdBtn.addEventListener('click', () => { stopAnimation(); stepForward(); });
  stepBackBtn.addEventListener('click', () => { stopAnimation(); stepBack(); });

  document.getElementById('btn-reset').addEventListener('click', () => {
    stopAnimation();
    setState({ currentIndex: 0 });
    render();
  });

  const gotoInput = document.getElementById('input-goto-packet');
  const gotoAction = () => {
    const val = parseInt(gotoInput.value);
    const state = getState();
    if (!state.fileLoaded || !state.totalPackets) return;
    const clamped = Math.max(1, Math.min(val, state.totalPackets));
    if (!isNaN(clamped)) {
      stopAnimation();
      setState({ currentIndex: clamped - 1 });
      render();
    }
  };
  document.getElementById('btn-goto').addEventListener('click', gotoAction);
  gotoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') gotoAction();
  });
  gotoInput.addEventListener('change', gotoAction);

  const hexPanel = document.getElementById('hexdump-panel');
  const hexContent = document.getElementById('hexdump-content');
  document.getElementById('btn-hexdump').addEventListener('click', () => {
    hexPanel.classList.toggle('hidden');
    if (!hexPanel.classList.contains('hidden')) {
      updateHexDump();
    }
  });
  subscribe('currentIndex', () => {
    if (!hexPanel.classList.contains('hidden')) updateHexDump();
  });

  const helpModal = document.getElementById('help-modal');
  document.getElementById('help-link').addEventListener('click', (e) => {
    e.preventDefault();
    helpModal.classList.toggle('hidden');
  });
  document.getElementById('btn-help').addEventListener('click', () => {
    helpModal.classList.toggle('hidden');
  });
  document.getElementById('help-close').addEventListener('click', () => {
    helpModal.classList.add('hidden');
  });
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.classList.add('hidden');
  });

  const scrubber = document.getElementById('input-scrubber');
  scrubber.addEventListener('input', (e) => {
    stopAnimation();
    setState({ currentIndex: parseInt(e.target.value) });
    render();
  });
  subscribe('currentIndex', (val) => { scrubber.value = val; });
  subscribe('totalPackets', (val) => {
    scrubber.max = Math.max(0, val - 1);
    scrubber.disabled = val === 0;
  });

  bindSetting('input-window-size', 'windowSize', parseInt);
  bindSetting('input-speed', 'speed', parseFloat);
  bindSetting('input-max-packet-size', 'maxPacketSize', parseInt);
  bindSetting('input-brightness-min', 'brightnessMin', parseFloat);
  bindSetting('input-brightness-max', 'brightnessMax', parseFloat);

  bindColorSetting('input-bg-color', 'backgroundColor');
  bindColorSetting('input-cold-color', 'coldColor');
  bindColorSetting('input-hot-color', 'hotColor');

  document.getElementById('input-y-invert').addEventListener('change', (e) => {
    setState({ yInverted: e.target.checked });
    render();
  });

  document.getElementById('input-x-mode').addEventListener('change', (e) => {
    setState({ xAxisMode: e.target.value });
    resizeCanvas();
    render();
  });

  subscribe('*', updateStatusDisplay);
  updateStatusDisplay(getState());

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const state = getState();
    if (e.code === 'Space') {
      e.preventDefault();
      state.playing ? stopAnimation() : startAnimation();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      stopAnimation();
      stepForward();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      stopAnimation();
      stepBack();
    }
  });
}

function loadPcapBuffer(arrayBuffer) {
  const packets = parseFile(arrayBuffer);
  setState({
    packets,
    totalPackets: packets.length,
    currentIndex: 0,
    playing: false,
    fileLoaded: true,
  });
  resizeCanvas();
  render();
}

function bindSetting(inputId, stateKey, parser) {
  const input = document.getElementById(inputId);
  input.addEventListener('change', (e) => {
    const val = parser(e.target.value);
    if (!isNaN(val) && val > 0) {
      setState({ [stateKey]: val });
      if (stateKey === 'maxPacketSize') resizeCanvas();
      render();
    }
  });
}

function bindColorSetting(inputId, stateKey) {
  const input = document.getElementById(inputId);
  input.addEventListener('input', (e) => {
    setState({ [stateKey]: e.target.value });
    render();
  });
}

function updateStatusDisplay() {
  const state = getState();
  const packetNum = document.getElementById('status-packet-num');
  const packetRange = document.getElementById('status-packet-range');
  const totalPackets = document.getElementById('status-total');

  if (state.totalPackets === 0) {
    packetNum.textContent = '--';
    packetRange.textContent = '--';
    totalPackets.textContent = '--';
    return;
  }

  const windowEnd = state.currentIndex + 1;
  const windowStart = Math.max(1, windowEnd - state.windowSize + 1);
  packetNum.textContent = windowEnd;
  packetRange.textContent = `${windowStart}-${windowEnd}`;
  totalPackets.textContent = state.totalPackets;
}

function updateHexDump() {
  const state = getState();
  const content = document.getElementById('hexdump-content');
  if (state.totalPackets === 0 || state.currentIndex < 0) {
    content.textContent = 'No packet loaded';
    return;
  }

  const packet = state.packets[state.currentIndex];
  const lines = [];
  lines.push(`Packet #${state.currentIndex + 1}  (${packet.length} bytes)\n`);

  for (let offset = 0; offset < packet.length; offset += 16) {
    const hex = [];
    const ascii = [];
    for (let i = 0; i < 16; i++) {
      if (offset + i < packet.length) {
        const byte = packet[offset + i];
        hex.push(byte.toString(16).padStart(2, '0'));
        ascii.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
      } else {
        hex.push('  ');
        ascii.push(' ');
      }
    }
    const hexLeft = hex.slice(0, 8).join(' ');
    const hexRight = hex.slice(8).join(' ');
    lines.push(
      offset.toString(16).padStart(6, '0') + '  ' +
      hexLeft + '  ' + hexRight + '  |' + ascii.join('') + '|'
    );
  }

  content.textContent = lines.join('\n');
}

