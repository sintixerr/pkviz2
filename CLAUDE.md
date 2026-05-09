# PkViz2

Network packet byte visualizer. Renders raw packet bytes as an animated scatterplot: X = byte position in packet, Y = byte value (0-255).

## Architecture

Pure vanilla HTML/CSS/JS — no frameworks, no build step, no dependencies. Uses ES modules (`<script type="module">`). Requires a local HTTP server to run (module imports don't work from `file://`).

### File structure

- `index.html` — UI layout, toolbar strips (settings top, transport bottom)
- `style.css` — Dark theme, responsive `rem` units with `clamp()` root font
- `js/app.js` — Entry point, initializes renderer and controls
- `js/state.js` — Central state object with pub/sub notification (`subscribe(key, cb)`)
- `js/pcap-parser.js` — Parses pcap and pcapng binary formats via DataView API
- `js/renderer.js` — Canvas rendering: density buffers, per-packet brightness, grid, glow
- `js/animator.js` — requestAnimationFrame loop with time-based packet advancement
- `js/controls.js` — UI event bindings, hex dump panel, status display
- `js/color-utils.js` — hexToRgb, lerpColor utilities

### Rendering pipeline

1. Density buffer (Uint16Array) counts how many packets in the window share each pixel
2. Packets rendered oldest-to-newest; each packet's dots get uniform brightness (quadratic fade curve)
3. Color = lerp(cold, hot, sqrt((density-1)/(maxDensity-1))) — auto-scaled to frame's max density
4. Brightness = lerp(bgColor, dotColor, brightness) — blends toward background for fade
5. Glow effect via a second canvas with CSS `filter: blur(3px)` at 30% opacity
6. Grid lines drawn into ImageData, respect logarithmic X mapping

### Key design decisions

- ImageData direct pixel manipulation (not fillRect) for performance at 150K+ points/frame
- Density denominator is configured windowSize, not activeWindowSize (prevents first-packet-yellow bug)
- Brightness is per-packet (uniform), not per-pixel — newer packets overwrite shared pixels
- Canvas CSS-scaled with `image-rendering: pixelated` to fill available space (minimum 1:1)
- Zero-copy pcap parsing: Uint8Array views into original ArrayBuffer

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

Static site — deploy to Render, Netlify, GitHub Pages, etc. with no build command. Publish directory is the repo root.
