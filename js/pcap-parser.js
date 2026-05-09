const PCAP_MAGIC_LE = 0xa1b2c3d4;
const PCAP_MAGIC_BE = 0xd4c3b2a1;
const PCAP_MAGIC_NS_LE = 0xa1b23c4d;
const PCAP_MAGIC_NS_BE = 0x4d3cb2a1;
const PCAPNG_SHB_MAGIC = 0x0a0d0d0a;

export function parseFile(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const magic = view.getUint32(0, false);

  if (magic === PCAPNG_SHB_MAGIC) {
    return parsePcapng(arrayBuffer);
  }
  return parsePcap(arrayBuffer);
}

function parsePcap(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const magic = view.getUint32(0, true);

  let littleEndian;
  if (magic === PCAP_MAGIC_LE || magic === PCAP_MAGIC_NS_LE) {
    littleEndian = true;
  } else if (magic === PCAP_MAGIC_BE || magic === PCAP_MAGIC_NS_BE) {
    littleEndian = false;
  } else {
    throw new Error('Not a valid pcap file');
  }

  const packets = [];
  let offset = 24;

  while (offset + 16 <= arrayBuffer.byteLength) {
    const capturedLen = view.getUint32(offset + 8, littleEndian);
    offset += 16;

    if (offset + capturedLen > arrayBuffer.byteLength) break;

    packets.push(new Uint8Array(arrayBuffer, offset, capturedLen));
    offset += capturedLen;
  }

  return packets;
}

function parsePcapng(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const packets = [];
  let offset = 0;

  let byteOrder = true;
  const bom = view.getUint32(8, true);
  if (bom === 0x1a2b3c4d) {
    byteOrder = true;
  } else {
    byteOrder = false;
  }

  while (offset + 8 <= arrayBuffer.byteLength) {
    const blockType = view.getUint32(offset, byteOrder);
    const blockLen = view.getUint32(offset + 4, byteOrder);

    if (blockLen < 12 || offset + blockLen > arrayBuffer.byteLength) break;

    if (blockType === 0x00000006) {
      const capturedLen = view.getUint32(offset + 20, byteOrder);
      const dataOffset = offset + 28;
      if (dataOffset + capturedLen <= offset + blockLen) {
        packets.push(new Uint8Array(arrayBuffer, dataOffset, capturedLen));
      }
    } else if (blockType === 0x00000003) {
      const capturedLen = view.getUint32(offset + 12, byteOrder);
      const dataOffset = offset + 16;
      if (dataOffset + capturedLen <= offset + blockLen) {
        packets.push(new Uint8Array(arrayBuffer, dataOffset, capturedLen));
      }
    }

    offset += blockLen;
  }

  return packets;
}
