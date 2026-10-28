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
// One original vector drawing supplies the header, favicon and install artwork.
const foreground = [240, 107, 104];
const background = [23, 15, 15];
const color = "#f06b68";
const gapAngle = 0.55;
const irisRadius = 4.5;
const irisX = 16 + Math.cos(gapAngle) * irisRadius;
const irisY = Math.sin(gapAngle) * irisRadius;
const mark = `<g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 16Q16 2 28 16Q16 30 4 16Z" stroke-width="2.15"/>
  <path d="M${irisX} ${16 + irisY}A${irisRadius} ${irisRadius} 0 1 1 ${irisX} ${16 - irisY}" stroke-width="1.9"/>
  <path d="M16 3.5V5.2M16 26.8V28.5" stroke-width="1.8"/>
  <circle cx="16" cy="16" r="1.25" fill="${color}" stroke="none"/>
</g>`;
const svg = (content) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${content}</svg>\n`;
writeFileSync("public/brand-mark.svg", svg(mark));
writeFileSync(
  "public/icon.svg",
  svg(
    `<path fill="#170f0f" d="M0 0h32v32H0z"/><g transform="translate(16 16) scale(.88) translate(-16 -16)">${mark}</g>`,
  ),
);

function quadratic(start, control, end) {
  return Array.from({ length: 65 }, (_, index) => {
    const progress = index / 64;
    return start.map(
      (value, axis) =>
        (1 - progress) ** 2 * value +
        2 * (1 - progress) * progress * control[axis] +
        progress ** 2 * end[axis],
    );
  });
}
const strokes = [
  {
    width: 2.15,
    points: [
      ...quadratic([4, 16], [16, 2], [28, 16]),
      ...quadratic([28, 16], [16, 30], [4, 16]).slice(1),
    ],
  },
  {
    width: 1.9,
    points: Array.from({ length: 65 }, (_, index) => {
      const angle = gapAngle + (index / 64) * (Math.PI * 2 - gapAngle * 2);
      return [
        16 + Math.cos(angle) * irisRadius,
        16 + Math.sin(angle) * irisRadius,
      ];
    }),
  },
  {
    width: 1.8,
    points: [
      [16, 3.5],
      [16, 5.2],
    ],
  },
  {
    width: 1.8,
    points: [
      [16, 26.8],
      [16, 28.5],
    ],
  },
  {
    width: 2.5,
    points: [
      [16, 16],
      [16, 16],
    ],
  },
];

function iconPixels(size) {
  const sampling = 4;
  const resolution = size * sampling;
  const mask = new Uint8Array(resolution * resolution);
  const scale = resolution / 32;
  const transform = (point) =>
    point.map((value) => ((value - 16) * 0.88 + 16) * scale);
  for (const stroke of strokes) {
    const radius = (stroke.width * 0.88 * scale) / 2;
    for (let index = 1; index < stroke.points.length; index++) {
      const [startX, startY] = transform(stroke.points[index - 1]);
      const [endX, endY] = transform(stroke.points[index]);
      const horizontal = endX - startX,
        vertical = endY - startY;
      const lengthSquared = horizontal ** 2 + vertical ** 2;
      for (
        let y = Math.max(0, Math.floor(Math.min(startY, endY) - radius));
        y < Math.min(resolution, Math.ceil(Math.max(startY, endY) + radius));
        y++
      )
        for (
          let x = Math.max(0, Math.floor(Math.min(startX, endX) - radius));
          x < Math.min(resolution, Math.ceil(Math.max(startX, endX) + radius));
          x++
        ) {
          const progress = lengthSquared
            ? Math.max(
                0,
                Math.min(
                  1,
                  ((x + 0.5 - startX) * horizontal +
                    (y + 0.5 - startY) * vertical) /
                    lengthSquared,
                ),
              )
            : 0;
          if (
            (x + 0.5 - startX - progress * horizontal) ** 2 +
              (y + 0.5 - startY - progress * vertical) ** 2 <=
            radius ** 2
          )
            mask[y * resolution + x] = 1;
        }
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let coverage = 0;
      for (let row = 0; row < sampling; row++)
        for (let column = 0; column < sampling; column++)
          coverage +=
            mask[(y * sampling + row) * resolution + x * sampling + column];
      const alpha = coverage / sampling ** 2;
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      raw.set(
        [
          ...background.map((channel, index) =>
            Math.round(channel + (foreground[index] - channel) * alpha),
          ),
          255,
        ],
        offset,
      );
    }
  return raw;
}

for (const [size, filename] of [
  [32, "favicon-32.png"],
  [180, "apple-touch-icon.png"],
  [192, "icon-192.png"],
  [512, "icon-512.png"],
]) {
  const raw = iconPixels(size);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  writeFileSync(
    `public/${filename}`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
