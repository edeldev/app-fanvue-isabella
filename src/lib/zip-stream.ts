type ZipSource = { name: string; url: string; size: number | null };
const encoder = new TextEncoder();
const table = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) { let value = index; for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; table[index] = value >>> 0; }
const write16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
const write32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value >>> 0, true);
function crc32(crc: number, chunk: Uint8Array) { let value = crc; for (const byte of chunk) value = table[(value ^ byte) & 0xff] ^ (value >>> 8); return value >>> 0; }
function header(name: Uint8Array) { const bytes = new Uint8Array(30 + name.length), view = new DataView(bytes.buffer); write32(view, 0, 0x04034b50); write16(view, 4, 20); write16(view, 6, 8); write16(view, 8, 0); write16(view, 26, name.length); bytes.set(name, 30); return bytes; }
function descriptor(crc: number, size: number) { const bytes = new Uint8Array(16), view = new DataView(bytes.buffer); write32(view, 0, 0x08074b50); write32(view, 4, crc); write32(view, 8, size); write32(view, 12, size); return bytes; }
function central(name: Uint8Array, crc: number, size: number, offset: number) { const bytes = new Uint8Array(46 + name.length), view = new DataView(bytes.buffer); write32(view, 0, 0x02014b50); write16(view, 4, 20); write16(view, 6, 20); write16(view, 8, 8); write32(view, 16, crc); write32(view, 20, size); write32(view, 24, size); write16(view, 28, name.length); write32(view, 42, offset); bytes.set(name, 46); return bytes; }
function end(entries: number, centralSize: number, centralOffset: number) { const bytes = new Uint8Array(22), view = new DataView(bytes.buffer); write32(view, 0, 0x06054b50); write16(view, 8, entries); write16(view, 10, entries); write32(view, 12, centralSize); write32(view, 16, centralOffset); return bytes; }

export function zipContentLength(sources: ZipSource[]) {
  if (sources.some((source) => source.size === null)) return null;
  return sources.reduce((total, source) => { const length = encoder.encode(source.name).length; return total + 30 + length + Number(source.size) + 16 + 46 + length; }, 22);
}

export function createZipStream(sources: ZipSource[]) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let offset = 0;
      const directory: Uint8Array[] = [];
      try {
        for (const source of sources) {
          const name = encoder.encode(source.name), localOffset = offset, local = header(name);
          controller.enqueue(local); offset += local.length;
          const response = await fetch(source.url);
          if (!response.ok || !response.body) throw new Error("ASSET_DOWNLOAD_FAILED");
          const reader = response.body.getReader(); let crc = 0xffffffff, size = 0;
          while (true) { const { done, value } = await reader.read(); if (done) break; crc = crc32(crc, value); size += value.length; controller.enqueue(value); offset += value.length; }
          crc = (crc ^ 0xffffffff) >>> 0;
          const tail = descriptor(crc, size); controller.enqueue(tail); offset += tail.length;
          directory.push(central(name, crc, size, localOffset));
        }
        const centralOffset = offset;
        for (const entry of directory) { controller.enqueue(entry); offset += entry.length; }
        controller.enqueue(end(directory.length, offset - centralOffset, centralOffset)); controller.close();
      } catch (error) { controller.error(error); }
    },
  });
}
