# PkViz2

Network packet byte visualizer. Renders raw packet bytes as an animated scatterplot: X = byte position in packet, Y = byte value (0–255). Background is always black.

## Architecture

Pure vanilla HTML/CSS/JS — no frameworks, no build step, no JS dependencies. Uses ES modules (`<script type="module">`). Requires a local HTTP server to run (module imports don't work from `file://`). Loads Google Fonts (JetBrains Mono, Outfit) from CDN at runtime.

### File structure

- `index.html` — UI layout (top settings bar, canvas, scrubber, bottom transport bar), help modal content, coordinate tooltip element
- `style.css` — Dark theme with CSS custom properties, responsive `rem` units with `clamp()` root font, responsive breakpoints at 1000px/600px
- `js/app.js` — Entry point, initializes renderer and controls on DOMContentLoaded
- `js/state.js` — Central state object with pub/sub notification (`subscribe(key, cb)`, wildcard `'*'` supported)
- `js/pcap-parser.js` — Parses pcap and pcapng binary formats via DataView API
- `js/renderer.js` — Canvas rendering (density buffers, per-packet brightness, grid, glow), auto-resize via ResizeObserver, `displayToCoords()` for tooltip inverse mapping
- `js/animator.js` — requestAnimationFrame loop with time-based packet advancement
- `js/controls.js` — All UI event bindings: file loading, playback, settings, hex dump panel, help modal, keyboard shortcuts, coordinate tooltip, scrubber
- `js/color-utils.js` — `hexToRgb()`, `lerpColor()` utilities

### State properties

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `packets` | Uint8Array[] | `[]` | Parsed packet byte arrays (views into original ArrayBuffer) |
| `totalPackets` | number | `0` | Length of packets array |
| `currentIndex` | number | `-1` | Index of the newest packet in the visible window |
| `playing` | boolean | `false` | Whether animation is running |
| `fileLoaded` | boolean | `false` | Whether a pcap file has been loaded |
| `windowSize` | number | `100` | Number of packets visible simultaneously |
| `speed` | number | `10` | Packets per second during playback |
| `maxPacketSize` | number | `1500` | X axis maximum, capped at 1500 (Ethernet MTU) |
| `xAxisMode` | string | `'linear'` | `'linear'` or `'logarithmic'` |
| `fillWidth` | boolean | `false` | Whether dots fill their full X span |
| `coldColor` | string | `'#0000ff'` | Color for low-density pixels |
| `hotColor` | string | `'#ffff00'` | Color for high-density pixels |
| `brightnessMin` | number | `0.1` | Brightness of oldest packet in window (0–10) |
| `brightnessMax` | number | `1.0` | Brightness of newest packet in window (0–10) |

### UI layout (top to bottom)

1. **Top toolbar** — Settings grouped by section: Capture (Window, Speed, Max Bytes), Axes (X Scale, Fill Width), Palette (Cold, Hot), Fade (Min, Max). All inputs have hover tooltips.
2. **Canvas container** — Two stacked canvases (main + glow overlay) and an absolutely-positioned coordinate tooltip div.
3. **Hex dump panel** — Togglable, sits between canvas and scrubber.
4. **Scrubber bar** — Full-width range input for manual packet navigation.
5. **Bottom toolbar** — Help | Load, Load Sample | Play (green), Stop (red), Reset | Step controls | Go to | Hex Dump | Status readout (PKT, WINDOW, TOTAL).

### Rendering pipeline

1. Density buffer (Uint16Array) counts how many packets in the window share each pixel. When `fillWidth` is on, each byte fills its x-span (`mapX(b)` to `mapX(b+1)`); when off, each byte is 1px.
2. Packets rendered oldest-to-newest; each packet's dots get uniform brightness (quadratic fade curve from `brightnessMin` to `brightnessMax`).
3. Color = `lerpColor(cold, hot, sqrt((density-1)/(maxDensity-1)))` — auto-scaled to frame's actual max density.
4. Brightness = `lerp(bgColor, dotColor, brightness)` — blends toward black background for fade. Values >1 create overbright/bloom.
5. Glow effect via `#glow-canvas` with CSS `filter: blur(3px)` at 30% opacity, `pointer-events: none`.
6. Grid lines drawn into ImageData: Y lines every 32 byte-values, X lines at adaptive steps (50/100/200/500 based on maxPacketSize), respects logarithmic X mapping.

### Key design decisions

- ImageData direct pixel manipulation (not fillRect) for performance at 150K+ points/frame
- Density color auto-scales to each frame's actual max density (prevents first-packet-yellow bug — single dots always render as cold color)
- Brightness is per-packet (uniform), not per-pixel — newer packets overwrite shared pixels; fade denominator is activeWindowSize
- Canvas logical resolution = maxPacketSize x 256; CSS-scaled to fill container via ResizeObserver with `image-rendering: pixelated` (minimum 1:1, scrollable if larger)
- Zero-copy pcap parsing: Uint8Array views into original ArrayBuffer
- Background hardcoded to black (`[0, 0, 0]`), not configurable
- Max bytes capped at 1500 in both HTML `max` attribute and JS `bindSetting()` enforcement
- Fade brightness capped at 10 (allows overbright effects)
- Coordinate tooltip listens on `#packet-canvas` (not `#glow-canvas`, which has `pointer-events: none`); uses `displayToCoords()` to inverse-map display pixels back to byte position/value, with inverse-log for logarithmic mode
- `bindSetting()` reads the HTML input's `min` attribute for floor validation and accepts an optional `max` parameter for ceiling enforcement with input reset

### Pcap parser details

- Supports classic pcap (both endianness, both microsecond and nanosecond magic numbers)
- Supports pcapng: Enhanced Packet Blocks (type 0x06) and Simple Packet Blocks (type 0x03)
- Byte-order detected from Section Header Block's byte-order magic (0x1a2b3c4d)
- 24-byte global header skipped for classic pcap; 16-byte per-packet header parsed for capturedLen

### Keyboard shortcuts

- Space — toggle Play/Stop (disabled when input/select focused)
- Left Arrow — step back one packet, stops playback
- Right Arrow — step forward one packet, stops playback

## Running locally

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

## Generating test data

```bash
# tcpdump is pre-installed on macOS
sudo tcpdump -i en0 -s 0 -c 1000 -w capture.pcap
```

## Deployment

Static site — deploy to Render, Netlify, GitHub Pages, etc. with no build command. Publish directory is the repo root. Ensure `sample.pcap` is included if the "Load Sample" feature should work.

## Revert notes

### Coordinate tooltip (added after commit dce6a93)
Hover tooltip showing byte position and value on the scatterplot. To revert:
- `index.html`: remove `<div id="coord-tooltip" ...>` from `.canvas-container`
- `style.css`: remove `.coord-tooltip` and `.coord-tooltip.hidden` rules
- `js/renderer.js`: remove `displayToCoords()` export function
- `js/controls.js`: remove `displayToCoords` from import, remove `coordTooltip`/`packetCanvas` mousemove/mouseleave block (lines ~95–116)
