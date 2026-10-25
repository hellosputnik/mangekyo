import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
function crc(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++)
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, body) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc(Buffer.concat([name, body])));
  return Buffer.concat([length, name, body, checksum]);
}
for (const size of [192, 512]) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const horizontal = (x - size / 2) / size,
        vertical = (y - size / 2) / size;
      const radius = Math.hypot(horizontal, vertical);
      const angle = Math.atan2(vertical, horizontal);
      const petal = Math.abs(Math.sin(angle * 4));
      const mark = radius < 0.28 && radius > 0.07 && petal > 0.38;
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      raw.set(mark ? [239, 83, 80, 255] : [23, 15, 15, 255], offset);
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  writeFileSync(
    `public/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
