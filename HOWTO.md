# PkViz2 — How To Use

## What It Does

PkViz2 visualizes network packet capture files (.pcap / .pcapng) as an animated scatterplot. Every byte in every packet becomes a dot on the canvas:

- **X axis** = the byte's position within its packet (0 on the left, up to 1500 on the right)
- **Y axis** = the byte's value (0 at the bottom, 255 at the top)

Multiple packets are displayed simultaneously in a sliding window. As animation plays, new packets enter the window and old packets drop out, creating a moving view through the capture. Patterns in network traffic — protocol headers, repeated values, encrypted vs. plaintext data — become visible as visual structures.

## How the Visualization Works

### Color = Density

Each pixel tracks how many packets in the current window share the same byte position and value. One packet at a pixel renders the **cold** color (default: blue). More overlap shifts toward the **hot** color (default: yellow). Scaling is automatic — the full color range is always used based on each frame's actual max density.

### Brightness = Recency

Every dot from a single packet shares the same brightness level based on the packet's age in the window. The newest packet renders at **Fade Max** brightness (default: 1.0). The oldest renders at **Fade Min** (default: 0.1), nearly invisible against the black background. Packets in between follow a quadratic fade curve. Since packets are drawn oldest-to-newest, newer dots always overwrite older ones at shared pixels.

### Glow Effect

A second canvas layer duplicates the image with a soft blur at reduced opacity, giving bright areas a subtle bloom. Always active.

## Loading Data

| Control | Description |
|---------|-------------|
| **Load** | Opens a file picker to select a .pcap, .pcapng, or .cap file. Parsed entirely in the browser — nothing uploaded. Supports classic pcap (both endianness) and pcapng. |
| **Load Sample** | Fetches the bundled sample.pcap for quick exploration. |

## Playback Controls

| Control | Description |
|---------|-------------|
| **Play** (green) | Begin advancing through packets at the configured Speed. Restarts from the beginning if already at the end. |
| **Stop** (red) | Halt animation at the current position. |
| **Reset** | Stop playback and jump to the first packet. |
| **« Step** | Step backward one packet. Stops playback. |
| **Step »** | Step forward one packet. Stops playback. |
| **Scrubber** | Full-width slider between canvas and toolbar. Drag to jump anywhere in the capture. Stops playback. |
| **Go to** | Type a packet number and press Enter or click Go to jump directly to it. |

## Inspection

| Feature | Description |
|---------|-------------|
| **Coordinate Tooltip** | Hover the mouse over the canvas to see byte position and value (decimal + hex) at the cursor. Works with both Linear and Log X scales. |
| **Hex Dump** | Toggle a panel showing raw hex and ASCII of the current (newest) packet. Updates automatically when stepping or scrubbing. |

## Status Readout

| Display | Meaning |
|---------|---------|
| **PKT** | Number of the newest packet in the window. |
| **WINDOW** | Range of packet numbers currently displayed (e.g. "51-150"). |
| **TOTAL** | Total packets in the loaded capture file. |

## Settings (Top Bar)

### Capture

| Setting | Description |
|---------|-------------|
| **Window** | Packets visible at once (default: 100). Small (5–10) for individual structure, large (500+) for aggregate patterns. Range: 1–100,000. |
| **Speed** | Packets per second during playback (default: 10). Range: 0.1–10,000. |
| **Max Bytes** | X axis maximum byte position (default: 1500). Capped at 1500 (Ethernet MTU). Lowering zooms into early bytes. |

### Axes

| Setting | Description |
|---------|-------------|
| **X Scale** | **Linear** (default): each byte gets equal horizontal space. **Log**: early positions (headers) spread wide, later positions (payload) compress. Best for examining protocol structure in the first 20–60 bytes. |
| **Fill Width** | Off (default): each byte is a single pixel. On: each byte fills its full horizontal span. Negligible difference in Linear mode; dramatic in Log mode where early bytes span many pixels. |

### Palette

| Setting | Description |
|---------|-------------|
| **Cold** | Color for low-density pixels (default: blue). |
| **Hot** | Color for high-density pixels (default: yellow). Gradient uses square-root scale for more visual range in low-density areas. |

### Fade

| Setting | Description |
|---------|-------------|
| **Min** | Brightness of oldest packet (default: 0.1). 0 = invisible. Range: 0–10. Values above 1 create overbright effects. |
| **Max** | Brightness of newest packet (default: 1.0). Values above 1 push toward white for bloom. Range: 0–10. |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Space** | Toggle Play / Stop |
| **Left Arrow** | Step back one packet (stops playback) |
| **Right Arrow** | Step forward one packet (stops playback) |

All shortcuts are disabled when a text input or dropdown is focused.

## Getting Packet Captures

### macOS (tcpdump is pre-installed)

```bash
sudo tcpdump -i en0 -s 0 -c 1000 -w capture.pcap
```

### Windows (Wireshark / tshark)

```cmd
tshark -i "Wi-Fi" -c 1000 -w capture.pcap
```

### Linux

```bash
sudo tcpdump -i eth0 -s 0 -c 1000 -w capture.pcap
```

## Tips

- Protocol headers create tight horizontal bands — fixed fields (version, flags, lengths) that every packet shares.
- Encrypted payloads (TLS, SSH) appear as uniform random noise — a sign encryption is working.
- DNS traffic (port 53) makes great demo data: short, structured, with visible protocol patterns.
- Try **Log X + Fill Width** for the best header structure view.
- Set **Fade Max above 1.0** for overbright glow on the newest packet.
- Use the **scrubber** to quickly scan a large capture, then step through interesting sections.
- Try different **Cold/Hot colors** — green-to-white or purple-to-orange can be easier to read.
