const state = {
  packets: [],
  totalPackets: 0,
  currentIndex: -1,
  playing: false,
  fileLoaded: false,

  windowSize: 100,
  speed: 10,
  maxPacketSize: 1500,
  xAxisMode: 'linear',
  yInverted: false,

  backgroundColor: '#000000',
  coldColor: '#0000ff',
  hotColor: '#ffff00',
  brightnessMin: 0.1,
  brightnessMax: 1.0,
};

const listeners = new Map();

export function getState() {
  return state;
}

export function setState(updates) {
  const changed = [];
  for (const [key, value] of Object.entries(updates)) {
    if (state[key] !== value) {
      state[key] = value;
      changed.push(key);
    }
  }
  for (const key of changed) {
    if (listeners.has(key)) {
      for (const cb of listeners.get(key)) cb(state[key], state);
    }
  }
  if (changed.length > 0 && listeners.has('*')) {
    for (const cb of listeners.get('*')) cb(state);
  }
}

export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
}
