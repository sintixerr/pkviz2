# PkViz2 — Quick Start Guide

## What It Does

PkViz2 visualizes network packet data as a scatterplot. Each byte in a packet becomes a dot on the screen:

- **X axis** = the byte's position within the packet (0 = first byte, up to 1500)
- **Y axis** = the byte's value (0 at bottom, 255 at top)

Load a `.pcap` capture file and watch the packets animate across the display. Patterns in network traffic — protocol headers, repeated values, encrypted vs. plaintext data — become visible as visual structures.

## How the Visualization Works

### Multiple packets at once (Packet Window)

The display shows multiple packets simultaneously. The **Window** setting controls how many (default: 100). As animation plays, packets slide through: the newest packet enters, the oldest drops out.

### Color = Density

When multiple packets in the window share the same byte position AND byte value, that pixel shifts from **cold color** (blue) toward **hot color** (yellow). More overlap = warmer color.

- Blue dot = only one packet has that position/value combination
- Yellow dot = many packets share that exact position/value

### Brightness = Recency

Each packet gets a brightness level based on how recent it is within the window:

- Newest packet = full brightness
- Oldest packet = nearly invisible (faded toward background)

This creates a trailing fade effect as the window advances.

## Controls

### Bottom Bar — Transport

| Button | Action |
|--------|--------|
| **Load** | Open a `.pcap` or `.pcapng` file from your computer |
| **Load Sample** | Load the included `sample.pcap` demo file |
| **Reset** | Jump back to the first packet |
| **« Step** | Step backward one packet (also: Left Arrow key) |
| **Play** | Start animating through packets (also: Space key) |
| **Pause** | Stop animation (also: Space key) |
| **Step »** | Step forward one packet (also: Right Arrow key) |
| **Go to #** | Jump to a specific packet number (type number, press Enter or click Go) |
| **Hex Dump** | Toggle a panel showing the raw hex bytes of the current packet |

### Bottom Bar — Readout

| Display | Meaning |
|---------|---------|
| **PKT** | Current newest packet number in the window |
| **WINDOW** | Range of packets currently displayed (e.g., "401-500") |
| **TOTAL** | Total packets in the loaded file |

### Top Bar — Settings

| Setting | What it does |
|---------|--------------|
| **Window** | How many packets to display at once (default: 100) |
| **Speed** | Animation speed in packets per second (default: 10) |
| **Max Bytes** | Maximum byte position on X axis (default: 1500). Packets longer than this are truncated in the display. |
| **X Scale** | Linear (even spacing) or Logarithmic (early byte positions spread out, later positions compressed — useful because packet headers at the start are often more interesting) |
| **Invert Y** | Flip the Y axis so 0 is at top and 255 at bottom |
| **BG** | Background color of the plot area (default: black) |
| **Cold** | Color for low-density pixels — single packet (default: blue) |
| **Hot** | Color for high-density pixels — many packets overlapping (default: yellow) |
| **Fade Min** | Brightness of the oldest packet in the window (default: 0.1 = nearly invisible) |
| **Fade Max** | Brightness of the newest packet in the window (default: 1.0 = full bright) |

## Keyboard Shortcuts

- **Space** — Play / Pause
- **Left Arrow** — Step back one packet
- **Right Arrow** — Step forward one packet

(Keyboard shortcuts only work when focus is not in an input field)

## Getting Packet Captures

### macOS (tcpdump is pre-installed)

```bash
sudo tcpdump -i en0 -s 0 -c 1000 -w capture.pcap
```

### Windows (install Wireshark)

```cmd
tshark -i "Wi-Fi" -c 1000 -w capture.pcap
```

## Tips

- Use a **small window** (5-10) to clearly see the fade and individual packet structure
- Use a **large window** (500+) to see aggregate patterns and density hotspots
- **Logarithmic X** is great for spotting header patterns — protocol fields cluster in early byte positions
- **DNS traffic** (port 53) makes great demo data — short, structured packets with lots of repetition
- Try different **cold/hot colors** — green-to-white or purple-to-orange can be easier to read than blue-to-yellow
