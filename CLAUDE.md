# PkViz2

Network packet byte visualizer. Renders raw packet bytes as an animated scatterplot: X = byte position in packet, Y = byte value (0-255).

## Architecture

Pure vanilla HTML/CSS/JS — no frameworks, no build step, no JS dependencies. Uses ES modules (`<script type="module">`). Requires a local HTTP server to run (module imports don't work from `file://`). Loads Google Fonts (JetBrains Mono, Outfit) from CDN at runtime.

### File structure

- `index.html` — UI layout, toolbar strips (settings top, transport bottom), help modal content
- `style.css` — Dark theme, responsive `rem` units with `clamp()` root font, responsive breakpoints at 1000px/600px
- `js/app.js` — Entry point, initializes renderer and controls
- `js/state.js` — Central state object with pub/sub notification (`subscribe(key, cb)`, wildcard `'*'` supported)
- `js/pcap-parser.js` — Parses pcap and pcapng binary formats via DataView API
- `js/renderer.js` — Canvas rendering: density buffers, per-packet brightness, grid, glow, auto-resize
- `js/animator.js` — requestAnimationFrame loop with time-based packet advancement
- `js/controls.js` — UI event bindings, hex dump panel, status readout, help modal, keyboard shortcuts
- `js/color-utils.js` — hexToRgb, lerpColor utilities

### UI features

- **Help modal** — Accessible via `?` link (top-left, next to brand) or `Help` button (bottom-left of transport bar). Closes via X button, backdrop click, or Escape key.
- **Keyboard shortcuts** — Space (play/pause), Left Arrow (step back), Right Arrow (step forward). Disabled when an input/select element is focused.
- **"Load Sample" button** — Fetches `sample.pcap` from server root (cache-busted with `?t=`). A `sample.pcap` file should exist for deployed sites.
- **"Go to" navigation** — Number input + Go button to jump to a specific packet. Fires on click, Enter, or input change.
- **Status readout** — PKT (current packet index), WINDOW (start-end range), TOTAL (loaded packet count). Updates on every state change via wildcard subscriber.
- **Hex dump panel** — Toggle panel showing raw hex + ASCII of the current packet, auto-updates as currentIndex changes.

### Rendering pipeline

1. Density buffer (Uint16Array) counts how many packets in the window share each pixel
2. Packets rendered oldest-to-newest; each packet's dots get uniform brightness (quadratic fade curve)
3. Color = lerp(cold, hot, sqrt((density-1)/(maxDensity-1))) — auto-scaled to frame's actual max density
4. Brightness = lerp(bgColor, dotColor, brightness) — blends toward background for fade
5. Glow effect via a second canvas with CSS `filter: blur(3px)` at 30% opacity
6. Grid lines drawn into ImageData: Y lines every 32 byte-values, X lines at adaptive steps (50/100/200/500 based on maxPacketSize), respects logarithmic X mapping

### Key design decisions

- ImageData direct pixel manipulation (not fillRect) for performance at 150K+ points/frame
- Density color auto-scales to each frame's actual max density (prevents first-packet-yellow bug — single dots always render as cold color)
- Brightness is per-packet (uniform), not per-pixel — newer packets overwrite shared pixels; fade denominator is activeWindowSize
- Canvas auto-scales via ResizeObserver; CSS `image-rendering: pixelated` preserves sharp pixels (minimum 1:1 with scrollable overflow)
- Zero-copy pcap parsing: Uint8Array views into original ArrayBuffer

### Pcap parser details

- Supports classic pcap (both endianness, both microsecond and nanosecond magic)
- Supports pcapng: Enhanced Packet Blocks (type 0x06) and Simple Packet Blocks (type 0x03)
- Byte-order detected from Section Header Block's byte-order magic (0x1a2b3c4d)

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

### Coordinate tooltip (added commit after dce6a93)
Hover tooltip showing byte position and value on the scatterplot. To revert:
- `index.html`: remove `<div id="coord-tooltip" ...>` from `.canvas-container`
- `style.css`: remove `.coord-tooltip` and `.coord-tooltip.hidden` rules
- `js/renderer.js`: remove `displayToCoords()` export
- `js/controls.js`: remove `displayToCoords` import, remove `coordTooltip`/`glowCanvas` mousemove/mouseleave block
