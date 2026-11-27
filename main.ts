// Gobble's Great Getaway — a turkey escape game entry.
// Running this program writes /output/entry.html (one static HTML game)
// and four deterministic PNG screenshots under /output/screenshots/.
// Node standard library only: fs, path, zlib.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

type Color = [number, number, number];
type Point = [number, number];

const SHOT_W = 1600;
const SHOT_H = 900;
const GROUND_Y = 760;
const WIN_DISTANCE = 1200;

const INK: Color = [18, 32, 22];
const CREAM: Color = [255, 247, 224];
const GOLD: Color = [247, 215, 116];
const BROWN: Color = [122, 79, 43];
const DARK_BROWN: Color = [90, 56, 30];
const TURKEY_BODY: Color = [139, 92, 52];
const TURKEY_WING: Color = [172, 118, 70];
const HEAD_BLUE: Color = [126, 160, 190];
const RED: Color = [205, 62, 52];
const ORANGE: Color = [232, 130, 46];
const GREEN: Color = [74, 150, 66];
const DARK_GREEN: Color = [38, 96, 48];
const CORN_YELLOW: Color = [250, 205, 92];

// ---------------------------------------------------------------------------
// Minimal RGB framebuffer with drawing helpers
// ---------------------------------------------------------------------------

class Canvas {
  width: number;
  height: number;
  data: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 3);
  }

  set(x: number, y: number, c: Color): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return;
    const i = (iy * this.width + ix) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }

  fillRect(x: number, y: number, w: number, h: number, c: Color): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c);
    }
  }

  gradient(top: Color, bottom: Color, y0: number, y1: number): void {
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const c: Color = [
        Math.round(top[0] + (bottom[0] - top[0]) * t),
        Math.round(top[1] + (bottom[1] - top[1]) * t),
        Math.round(top[2] + (bottom[2] - top[2]) * t),
      ];
      this.fillRect(0, y, this.width, 1, c);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  circle(cx: number, cy: number, r: number, c: Color): void {
    this.ellipse(cx, cy, r, r, c);
  }

  ellipseOutline(cx: number, cy: number, rx: number, ry: number, width: number, c: Color): void {
    const steps = Math.max(24, Math.floor((rx + ry) * 2));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      this.circle(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, width / 2, c);
    }
  }

  polygon(points: Point[], c: Color): void {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p[0]);
      minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]);
      maxY = Math.max(maxY, p[1]);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const xi = points[i][0];
          const yi = points[i][1];
          const xj = points[j][0];
          const yj = points[j][1];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
          }
        }
        if (inside) this.set(x, y, c);
      }
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, width: number, c: Color): void {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.circle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, c);
    }
  }

  heart(x: number, y: number, s: number, c: Color): void {
    this.circle(x - 9 * s, y, 10 * s, c);
    this.circle(x + 9 * s, y, 10 * s, c);
    this.polygon(
      [
        [x - 18 * s, y + 4 * s],
        [x + 18 * s, y + 4 * s],
        [x, y + 26 * s],
      ],
      c,
    );
  }

  text(str: string, x: number, y: number, scale: number, c: Color): void {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const glyph = FONT[ch] ?? FONT[" "];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] === "#") {
            this.fillRect(cx + col * scale, y + row * scale, scale, scale, c);
          }
        }
      }
      cx += 6 * scale;
    }
  }

  textWidth(str: string, scale: number): number {
    return str.length === 0 ? 0 : str.length * 6 * scale - scale;
  }

  centerText(str: string, y: number, scale: number, c: Color): void {
    this.text(str, (this.width - this.textWidth(str, scale)) / 2, y, scale, c);
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (uppercase letters, digits, basic punctuation)
// ---------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  " ": ["     ", "     ", "     ", "     ", "     ", "     ", "     "],
  A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  B: ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
  C: [" ### ", "#   #", "#    ", "#    ", "#    ", "#   #", " ### "],
  D: ["###  ", "#  # ", "#   #", "#   #", "#   #", "#  # ", "###  "],
  E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
  F: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
  G: [" ### ", "#   #", "#    ", "#  ##", "#   #", "#   #", " ####"],
  H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  I: [" ### ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  J: ["  ###", "   # ", "   # ", "   # ", "   # ", "#  # ", " ##  "],
  K: ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
  L: ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  M: ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"],
  N: ["#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #"],
  O: [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  Q: [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
  R: ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  U: ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  V: ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  W: ["#   #", "#   #", "#   #", "# # #", "# # #", "# # #", " # # "],
  X: ["#   #", " # # ", "  #  ", "  #  ", "  #  ", " # # ", "#   #"],
  Y: ["#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  Z: ["#####", "    #", "   # ", "  #  ", " #   ", "#    ", "#####"],
  "0": [" ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### "],
  "1": ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  "2": [" ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####"],
  "3": ["#####", "   # ", "  #  ", "   # ", "    #", "#   #", " ### "],
  "4": ["   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "],
  "5": ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
  "6": ["  ## ", " #   ", "#    ", "#### ", "#   #", "#   #", " ### "],
  "7": ["#####", "    #", "   # ", "  #  ", " #   ", " #   ", " #   "],
  "8": [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "],
  "9": [" ### ", "#   #", "#   #", " ####", "    #", "   # ", " ##  "],
  "!": ["  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "     ", "  #  "],
  ":": ["     ", "  #  ", "     ", "     ", "     ", "  #  ", "     "],
  ".": ["     ", "     ", "     ", "     ", "     ", "     ", "  #  "],
  ",": ["     ", "     ", "     ", "     ", "  #  ", "  #  ", " #   "],
  "'": ["  #  ", "  #  ", " #   ", "     ", "     ", "     ", "     "],
  "-": ["     ", "     ", "     ", " ### ", "     ", "     ", "     "],
  "/": ["    #", "   # ", "   # ", "  #  ", " #   ", " #   ", "#    "],
  "+": ["     ", "  #  ", "  #  ", "#####", "  #  ", "  #  ", "     "],
  "?": [" ### ", "#   #", "    #", "   # ", "  #  ", "     ", "  #  "],
};

// ---------------------------------------------------------------------------
// PNG encoder (IHDR / IDAT / IEND with CRC32)
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(cv: Canvas): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.width, 0);
  ihdr.writeUInt32BE(cv.height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(cv.height * (1 + cv.width * 3));
  for (let y = 0; y < cv.height; y++) {
    const rowStart = y * (1 + cv.width * 3);
    raw[rowStart] = 0; // filter type: none
    raw.set(cv.data.subarray(y * cv.width * 3, (y + 1) * cv.width * 3), rowStart + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Scene drawing
// ---------------------------------------------------------------------------

function drawBackground(cv: Canvas, dusk: boolean): void {
  if (dusk) {
    cv.gradient([64, 48, 96], [232, 138, 88], 0, GROUND_Y);
    cv.circle(1380, 180, 52, [250, 224, 170]);
    cv.circle(1358, 166, 46, [64, 48, 96]);
  } else {
    cv.gradient([110, 186, 228], [190, 230, 244], 0, GROUND_Y);
    cv.circle(1400, 170, 62, [252, 236, 150]);
  }
  const cloud: Color = dusk ? [246, 190, 170] : [255, 255, 255];
  cv.ellipse(260, 150, 110, 30, cloud);
  cv.ellipse(330, 132, 70, 26, cloud);
  cv.ellipse(1080, 120, 95, 26, cloud);
  cv.ellipse(1145, 104, 60, 22, cloud);
  cv.polygon(
    [
      [0, 560],
      [320, 470],
      [640, 545],
      [980, 460],
      [1300, 540],
      [1600, 480],
      [1600, GROUND_Y],
      [0, GROUND_Y],
    ],
    dusk ? [84, 110, 66] : [116, 176, 92],
  );
  cv.polygon(
    [
      [0, 650],
      [420, 565],
      [820, 640],
      [1220, 560],
      [1600, 630],
      [1600, GROUND_Y],
      [0, GROUND_Y],
    ],
    dusk ? [62, 96, 54] : [92, 160, 76],
  );
  cv.fillRect(0, GROUND_Y, SHOT_W, SHOT_H - GROUND_Y, [146, 96, 54]);
  cv.fillRect(0, GROUND_Y, SHOT_W, 14, [170, 116, 66]);
}

function drawHUD(cv: Canvas, hearts: number, corn: number, dist: number, level: number, score: number): void {
  cv.fillRect(0, 0, SHOT_W, 88, INK);
  for (let i = 0; i < 3; i++) {
    cv.heart(48 + i * 62, 30, 1.15, i < hearts ? [232, 76, 66] : [84, 92, 84]);
  }
  cv.text("CORN: " + corn, 230, 30, 4, CREAM);
  cv.text("DISTANCE: " + dist + " M", 470, 30, 4, CREAM);
  cv.text("LEVEL " + level, 900, 30, 4, CREAM);
  cv.text("SCORE: " + score, 1120, 30, 4, CREAM);
  cv.text("FARM", 230, 824, 3, CREAM);
  cv.text("FOREST", 1258, 824, 3, CREAM);
  cv.fillRect(230, 852, 1140, 16, [110, 110, 110]);
  const filled = Math.round(1140 * Math.min(1, dist / WIN_DISTANCE));
  if (filled > 0) cv.fillRect(230, 852, filled, 16, GREEN);
}

function drawTurkey(cv: Canvas, x: number, groundY: number, s: number, duck: boolean): void {
  const bodyY = groundY - (duck ? 62 : 92) * s;
  const headY = groundY - (duck ? 96 : 158) * s;
  const headX = x + (duck ? 108 : 92) * s;
  cv.polygon(
    [
      [x - 70 * s, bodyY + 30 * s],
      [x - 150 * s, bodyY - 60 * s],
      [x - 138 * s, bodyY - 130 * s],
      [x - 100 * s, bodyY - 105 * s],
      [x - 88 * s, bodyY - 150 * s],
      [x - 55 * s, bodyY - 95 * s],
      [x - 40 * s, bodyY - 20 * s],
    ],
    DARK_BROWN,
  );
  cv.line(x - 18 * s, bodyY + 48 * s, x - 34 * s, groundY, 9 * s, ORANGE);
  cv.line(x + 34 * s, bodyY + 48 * s, x + 52 * s, groundY, 9 * s, ORANGE);
  cv.ellipse(x, bodyY, 92 * s, 68 * s, TURKEY_BODY);
  cv.ellipse(x - 6 * s, bodyY + 6 * s, 46 * s, 30 * s, TURKEY_WING);
  cv.line(x + 62 * s, bodyY - 30 * s, headX - 10 * s, headY + 18 * s, 20 * s, HEAD_BLUE);
  cv.circle(headX, headY, 34 * s, HEAD_BLUE);
  cv.polygon(
    [
      [headX + 26 * s, headY - 6 * s],
      [headX + 64 * s, headY + 4 * s],
      [headX + 26 * s, headY + 14 * s],
    ],
    ORANGE,
  );
  cv.ellipse(headX + 30 * s, headY + 30 * s, 11 * s, 20 * s, RED);
  cv.circle(headX + 12 * s, headY - 8 * s, 6 * s, [20, 20, 20]);
}

function drawFence(cv: Canvas, x: number): void {
  cv.fillRect(x, GROUND_Y - 78, 16, 78, BROWN);
  cv.fillRect(x + 74, GROUND_Y - 78, 16, 78, BROWN);
  cv.fillRect(x - 8, GROUND_Y - 66, 106, 13, BROWN);
  cv.fillRect(x - 8, GROUND_Y - 34, 106, 13, BROWN);
}

function drawHay(cv: Canvas, x: number): void {
  cv.circle(x, GROUND_Y - 42, 44, [238, 200, 104]);
  cv.circle(x, GROUND_Y - 42, 30, [226, 182, 84]);
  cv.circle(x, GROUND_Y - 42, 16, [238, 200, 104]);
  cv.circle(x, GROUND_Y - 42, 6, [210, 166, 70]);
}

function drawFox(cv: Canvas, x: number): void {
  cv.line(x - 30, GROUND_Y - 26, x - 34, GROUND_Y, 8, [160, 84, 34]);
  cv.line(x + 34, GROUND_Y - 26, x + 38, GROUND_Y, 8, [160, 84, 34]);
  cv.ellipse(x + 62, GROUND_Y - 48, 34, 15, ORANGE);
  cv.circle(x + 90, GROUND_Y - 48, 12, [255, 255, 255]);
  cv.ellipse(x, GROUND_Y - 44, 58, 26, [224, 116, 44]);
  cv.circle(x - 58, GROUND_Y - 62, 20, [224, 116, 44]);
  cv.polygon(
    [
      [x - 74, GROUND_Y - 76],
      [x - 68, GROUND_Y - 96],
      [x - 58, GROUND_Y - 78],
    ],
    [224, 116, 44],
  );
  cv.circle(x - 66, GROUND_Y - 64, 4, [20, 20, 20]);
}

function drawFarmer(cv: Canvas, x: number): void {
  cv.line(x - 12, GROUND_Y - 70, x - 20, GROUND_Y, 11, [60, 60, 90]);
  cv.line(x + 14, GROUND_Y - 70, x + 24, GROUND_Y, 11, [60, 60, 90]);
  cv.fillRect(x - 26, GROUND_Y - 150, 52, 84, [58, 96, 160]);
  cv.circle(x, GROUND_Y - 172, 24, [240, 196, 150]);
  cv.ellipse(x, GROUND_Y - 192, 42, 10, [210, 170, 70]);
  cv.fillRect(x - 24, GROUND_Y - 212, 48, 22, [210, 170, 70]);
  cv.line(x - 20, GROUND_Y - 140, x - 110, GROUND_Y - 180, 10, [240, 196, 150]);
  cv.line(x - 110, GROUND_Y - 180, x - 170, GROUND_Y - 215, 7, BROWN);
  cv.ellipseOutline(x - 205, GROUND_Y - 228, 46, 34, 6, [200, 200, 200]);
}

function drawCorn(cv: Canvas, x: number, y: number): void {
  cv.polygon(
    [
      [x - 10, y + 18],
      [x - 22, y + 34],
      [x - 2, y + 26],
    ],
    GREEN,
  );
  cv.ellipse(x, y, 13, 24, CORN_YELLOW);
  cv.line(x, y - 18, x, y + 18, 4, [214, 164, 62]);
}

function drawBarn(cv: Canvas, x: number): void {
  cv.fillRect(x, 580, 190, 180, [168, 64, 50]);
  cv.polygon(
    [
      [x - 22, 580],
      [x + 95, 500],
      [x + 212, 580],
    ],
    [120, 44, 36],
  );
  cv.fillRect(x + 70, 655, 52, 105, [84, 36, 28]);
}

function drawTree(cv: Canvas, x: number, h: number): void {
  cv.fillRect(x - 9, GROUND_Y - 70, 18, 70, DARK_BROWN);
  cv.polygon(
    [
      [x - 62, GROUND_Y - 60],
      [x + 62, GROUND_Y - 60],
      [x, GROUND_Y - h],
    ],
    DARK_GREEN,
  );
  cv.polygon(
    [
      [x - 46, GROUND_Y - 120],
      [x + 46, GROUND_Y - 120],
      [x, GROUND_Y - h - 40],
    ],
    [48, 116, 58],
  );
}

function sceneTitle(): Canvas {
  const cv = new Canvas(SHOT_W, SHOT_H);
  drawBackground(cv, false);
  drawBarn(cv, 1150);
  drawFence(cv, 230);
  drawHay(cv, 1360);
  cv.fillRect(0, 88, SHOT_W, 382, INK);
  cv.centerText("GOBBLE'S GREAT GETAWAY", 140, 11, GOLD);
  cv.centerText("HELP GOBBLE ESCAPE THE FARM!", 252, 6, CREAM);
  cv.centerText("JUMP: SPACE / UP / TAP RIGHT", 326, 4, CREAM);
  cv.centerText("DUCK: DOWN / TAP LEFT", 368, 4, CREAM);
  cv.centerText("REACH THE FOREST AT 1200 M", 410, 4, CREAM);
  drawTurkey(cv, 800, GROUND_Y, 1.15, false);
  drawCorn(cv, 590, 668);
  drawCorn(cv, 640, 640);
  drawCorn(cv, 690, 668);
  drawHUD(cv, 3, 0, 0, 1, 0);
  cv.centerText("PRESS SPACE OR TAP START TO PLAY", 786, 4, GOLD);
  return cv;
}

function sceneGameplay(): Canvas {
  const cv = new Canvas(SHOT_W, SHOT_H);
  drawBackground(cv, false);
  drawBarn(cv, 1080);
  drawTurkey(cv, 330, GROUND_Y, 1.05, false);
  drawCorn(cv, 520, 628);
  drawCorn(cv, 575, 600);
  drawCorn(cv, 630, 600);
  drawCorn(cv, 685, 628);
  drawFence(cv, 700);
  drawHay(cv, 1080);
  drawFox(cv, 1420);
  drawHUD(cv, 3, 7, 214, 1, 389);
  return cv;
}

function sceneLevel2(): Canvas {
  const cv = new Canvas(SHOT_W, SHOT_H);
  drawBackground(cv, true);
  drawBarn(cv, 120);
  drawTurkey(cv, 380, GROUND_Y, 1.05, true);
  drawCorn(cv, 600, 640);
  drawCorn(cv, 655, 614);
  drawCorn(cv, 710, 640);
  drawFence(cv, 800);
  drawFarmer(cv, 1250);
  drawHay(cv, 1470);
  drawHUD(cv, 3, 12, 386, 2, 720);
  return cv;
}

function sceneWin(): Canvas {
  const cv = new Canvas(SHOT_W, SHOT_H);
  drawBackground(cv, false);
  drawTree(cv, 1120, 250);
  drawTree(cv, 1260, 300);
  drawTree(cv, 1400, 250);
  drawTree(cv, 1530, 300);
  cv.fillRect(0, 88, SHOT_W, 272, [24, 56, 30]);
  cv.centerText("GOBBLE MADE IT TO THE FOREST!", 150, 8, [170, 235, 160]);
  cv.centerText("DISTANCE: 1200 M  CORN: 24  SCORE: 1800", 262, 5, CREAM);
  drawTurkey(cv, 640, GROUND_Y, 1.2, false);
  drawCorn(cv, 430, 668);
  drawCorn(cv, 480, 640);
  drawCorn(cv, 530, 668);
  drawHUD(cv, 3, 24, 1200, 5, 1800);
  cv.centerText("PRESS SPACE OR TAP START TO PLAY AGAIN", 786, 4, GOLD);
  return cv;
}

// ---------------------------------------------------------------------------
// The playable game (one static HTML file, inline CSS/JS only)
// ---------------------------------------------------------------------------

const GAME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gobble's Great Getaway</title>
<style>
  body { margin: 0; background: #102016; display: grid; place-items: center; min-height: 100vh; }
  canvas { width: min(100vw, 177.78vh); height: auto; display: block; background: #87c5e8; }
</style>
</head>
<body>
<canvas id="game" width="960" height="540"></canvas>
<script>
"use strict";
var cv = document.getElementById("game");
var ctx = cv.getContext("2d");
var W = 960, H = 540, GROUND = 452, WIN_DIST = 1200;
var state = "title"; // title, playing, paused, over, win
var frame = 0, dist = 0, corn = 0, hearts = 3, score = 0, level = 1;
var py = 0, vy = 0, duck = false, inv = 0, spawnT = 80, cornT = 120;
var obstacles = [], corns = [], seed = 987654321;
var audio = null;

function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function beep(freq, dur, type) {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    var o = audio.createOscillator(), g = audio.createGain();
    o.type = type || "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.08, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dur);
  } catch (e) { /* sound is optional */ }
}
function speed() { return 5 + (level - 1) * 0.9; }
function reset() {
  dist = 0; corn = 0; hearts = 3; score = 0; level = 1;
  py = 0; vy = 0; duck = false; inv = 0; spawnT = 80; cornT = 120;
  obstacles = []; corns = []; seed = 987654321;
}
function startGame() { reset(); state = "playing"; beep(523, 0.12); }
function jump() {
  if (state === "title" || state === "over" || state === "win") { startGame(); return; }
  if (state === "playing" && py === 0) { vy = -13.5; beep(392, 0.1); }
}
function spawnObstacle() {
  var kinds = ["fence", "hay", "fox", "farmer"];
  var kind = kinds[Math.floor(rand() * kinds.length)];
  obstacles.push({ kind: kind, x: W + 60 });
}
function spawnCorn() {
  var base = 90 + rand() * 60;
  for (var i = 0; i < 4; i++) {
    corns.push({ x: W + 40 + i * 38, y: GROUND - base - Math.sin(i / 3 * Math.PI) * 26 });
  }
}
function turkeyBox() {
  var h = duck ? 50 : 84;
  return { x: 140, y: GROUND - h + py, w: 78, h: h };
}
function obstacleBox(o) {
  if (o.kind === "fence") return { x: o.x, y: GROUND - 48, w: 56, h: 48 };
  if (o.kind === "hay") return { x: o.x, y: GROUND - 54, w: 54, h: 54 };
  if (o.kind === "fox") return { x: o.x, y: GROUND - 44, w: 70, h: 44 };
  return { x: o.x - 70, y: GROUND - 132, w: 110, h: 62 }; // farmer net zone
}
function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function update() {
  if (state !== "playing") return;
  frame++;
  dist += speed() * 0.09;
  level = Math.min(5, Math.floor(dist / 240) + 1);
  score = Math.floor(dist) + corn * 25;
  if (dist >= WIN_DIST) { state = "win"; beep(784, 0.25, "triangle"); return; }
  vy += 0.7; py += vy;
  if (py >= 0) { py = 0; vy = 0; }
  if (inv > 0) inv--;
  if (--spawnT <= 0) { spawnObstacle(); spawnT = 70 + Math.floor(rand() * 60); }
  if (--cornT <= 0) { spawnCorn(); cornT = 150 + Math.floor(rand() * 120); }
  var tb = turkeyBox();
  for (var i = obstacles.length - 1; i >= 0; i--) {
    var o = obstacles[i];
    o.x -= speed() + (o.kind === "fox" ? 1.2 : 0);
    if (o.x < -140) { obstacles.splice(i, 1); continue; }
    if (inv === 0 && overlap(tb, obstacleBox(o))) {
      obstacles.splice(i, 1);
      hearts--; inv = 90; beep(160, 0.2, "sawtooth");
      if (hearts <= 0) { state = "over"; beep(110, 0.4, "sawtooth"); }
    }
  }
  for (var j = corns.length - 1; j >= 0; j--) {
    var c = corns[j];
    c.x -= speed();
    if (c.x < -40) { corns.splice(j, 1); continue; }
    if (overlap(tb, { x: c.x - 10, y: c.y - 14, w: 20, h: 28 })) {
      corns.splice(j, 1); corn++; beep(880, 0.08, "triangle");
    }
  }
}
function drawHeart(x, y, full) {
  ctx.fillStyle = full ? "#e84c42" : "#545c54";
  ctx.beginPath();
  ctx.moveTo(x, y + 10);
  ctx.bezierCurveTo(x - 12, y - 6, x - 4, y - 14, x, y - 6);
  ctx.bezierCurveTo(x + 4, y - 14, x + 12, y - 6, x, y + 10);
  ctx.fill();
}
function drawTurkey() {
  var x = 178, gy = GROUND + py;
  var bodyY = gy - (duck ? 34 : 52), headY = gy - (duck ? 56 : 92);
  var headX = x + (duck ? 62 : 52);
  ctx.fillStyle = "#5a381e";
  ctx.beginPath();
  ctx.moveTo(x - 34, bodyY + 14); ctx.lineTo(x - 84, bodyY - 34);
  ctx.lineTo(x - 76, bodyY - 72); ctx.lineTo(x - 52, bodyY - 56);
  ctx.lineTo(x - 44, bodyY - 84); ctx.lineTo(x - 26, bodyY - 50);
  ctx.lineTo(x - 18, bodyY - 8); ctx.closePath(); ctx.fill();
  var legSwing = state === "playing" && py === 0 ? Math.sin(frame * 0.35) * 10 : 4;
  ctx.strokeStyle = "#e8822e"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x - 10, bodyY + 26); ctx.lineTo(x - 16 + legSwing, gy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 18, bodyY + 26); ctx.lineTo(x + 24 - legSwing, gy); ctx.stroke();
  if (inv > 0 && Math.floor(frame / 4) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.fillStyle = "#8b5c34";
  ctx.beginPath(); ctx.ellipse(x, bodyY, 52, 38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ac7646";
  ctx.beginPath(); ctx.ellipse(x - 4, bodyY + 4, 26, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#7ea0be"; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(x + 34, bodyY - 16); ctx.lineTo(headX - 6, headY + 10); ctx.stroke();
  ctx.fillStyle = "#7ea0be";
  ctx.beginPath(); ctx.arc(headX, headY, 19, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e8822e";
  ctx.beginPath();
  ctx.moveTo(headX + 14, headY - 3); ctx.lineTo(headX + 36, headY + 2);
  ctx.lineTo(headX + 14, headY + 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#cd3e34";
  ctx.beginPath(); ctx.ellipse(headX + 16, headY + 16, 6, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#141414";
  ctx.beginPath(); ctx.arc(headX + 7, headY - 4, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
function drawObstacle(o) {
  var x = o.x;
  if (o.kind === "fence") {
    ctx.fillStyle = "#7a4f2b";
    ctx.fillRect(x, GROUND - 48, 9, 48); ctx.fillRect(x + 44, GROUND - 48, 9, 48);
    ctx.fillRect(x - 5, GROUND - 40, 63, 8); ctx.fillRect(x - 5, GROUND - 20, 63, 8);
  } else if (o.kind === "hay") {
    ctx.fillStyle = "#eec868";
    ctx.beginPath(); ctx.arc(x + 27, GROUND - 27, 27, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e2b654";
    ctx.beginPath(); ctx.arc(x + 27, GROUND - 27, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#eec868";
    ctx.beginPath(); ctx.arc(x + 27, GROUND - 27, 8, 0, Math.PI * 2); ctx.fill();
  } else if (o.kind === "fox") {
    ctx.fillStyle = "#e0742c";
    ctx.beginPath(); ctx.ellipse(x + 34, GROUND - 26, 34, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 2, GROUND - 36, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 74, GROUND - 28, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(x + 88, GROUND - 28, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#a05422"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x + 18, GROUND - 14); ctx.lineTo(x + 16, GROUND); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 52, GROUND - 14); ctx.lineTo(x + 54, GROUND); ctx.stroke();
  } else {
    ctx.strokeStyle = "#3c3c5a"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x + 18, GROUND - 42); ctx.lineTo(x + 12, GROUND); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 34, GROUND - 42); ctx.lineTo(x + 42, GROUND); ctx.stroke();
    ctx.fillStyle = "#3a60a0"; ctx.fillRect(x + 10, GROUND - 92, 32, 52);
    ctx.fillStyle = "#f0c496";
    ctx.beginPath(); ctx.arc(x + 26, GROUND - 104, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d2aa46"; ctx.fillRect(x + 8, GROUND - 118, 36, 7);
    ctx.strokeStyle = "#f0c496"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x + 12, GROUND - 84); ctx.lineTo(x - 34, GROUND - 108); ctx.stroke();
    ctx.strokeStyle = "#7a4f2b"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 34, GROUND - 108); ctx.lineTo(x - 62, GROUND - 126); ctx.stroke();
    ctx.strokeStyle = "#c8c8c8";
    ctx.beginPath(); ctx.ellipse(x - 84, GROUND - 134, 26, 19, 0, 0, Math.PI * 2); ctx.stroke();
  }
}
function drawCorn(c) {
  ctx.fillStyle = "#facd5c";
  ctx.beginPath(); ctx.ellipse(c.x, c.y, 8, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#d6a43e"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(c.x, c.y - 10); ctx.lineTo(c.x, c.y + 10); ctx.stroke();
}
function hill(offset, base, amp, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, GROUND);
  for (var x = 0; x <= W; x += 40) {
    ctx.lineTo(x, base - Math.abs(Math.sin((x + offset) * 0.008)) * amp);
  }
  ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
}
function draw() {
  var sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, "#6ebae4"); sky.addColorStop(1, "#bee6f4");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GROUND);
  ctx.fillStyle = "#fcec96";
  ctx.beginPath(); ctx.arc(850, 84, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff";
  var co = (frame * 0.4) % 1100;
  ctx.beginPath(); ctx.ellipse(200 - co + 1100, 70, 62, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(640 - co + 1100, 52, 50, 13, 0, 0, Math.PI * 2); ctx.fill();
  hill(frame * 0.8, 400, 70, "#74b05c");
  hill(frame * 1.6, 430, 46, "#5ca04c");
  var bx = 1100 - (frame * 1.6 % 1300);
  ctx.fillStyle = "#a84032"; ctx.fillRect(bx, 330, 110, 122);
  ctx.fillStyle = "#782c24";
  ctx.beginPath();
  ctx.moveTo(bx - 12, 330); ctx.lineTo(bx + 55, 284); ctx.lineTo(bx + 122, 330);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#54241c"; ctx.fillRect(bx + 40, 386, 30, 66);
  ctx.fillStyle = "#926036"; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = "#aa7442"; ctx.fillRect(0, GROUND, W, 8);
  for (var i = 0; i < obstacles.length; i++) drawObstacle(obstacles[i]);
  for (var j = 0; j < corns.length; j++) drawCorn(corns[j]);
  drawTurkey();
  ctx.fillStyle = "#122016"; ctx.fillRect(0, 0, W, 46);
  for (var h = 0; h < 3; h++) drawHeart(26 + h * 34, 24, h < hearts);
  ctx.fillStyle = "#fff7e0"; ctx.font = "bold 19px sans-serif";
  ctx.fillText("Corn: " + corn, 140, 30);
  ctx.fillText("Distance: " + Math.floor(dist) + " m", 300, 30);
  ctx.fillText("Level " + level, 570, 30);
  ctx.fillText("Score: " + score, 700, 30);
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("FARM", 130, 502); ctx.fillText("FOREST", 800, 502);
  ctx.fillStyle = "#6e6e6e"; ctx.fillRect(130, 510, 700, 9);
  ctx.fillStyle = "#4a9642";
  ctx.fillRect(130, 510, 700 * Math.min(1, dist / WIN_DIST), 9);
  ctx.textAlign = "center";
  if (state === "title") {
    ctx.fillStyle = "rgba(18,32,22,0.92)"; ctx.fillRect(0, 46, W, 210);
    ctx.fillStyle = "#f7d774"; ctx.font = "bold 52px sans-serif";
    ctx.fillText("Gobble's Great Getaway", W / 2, 116);
    ctx.fillStyle = "#fff7e0"; ctx.font = "bold 21px sans-serif";
    ctx.fillText("Help Gobble escape the farm!", W / 2, 156);
    ctx.font = "17px sans-serif";
    ctx.fillText("Jump: Space / Up / tap right    Duck: Down / tap left", W / 2, 190);
    ctx.fillText("Reach the forest at 1200 m. Avoid fences, foxes and the farmer.", W / 2, 218);
    ctx.fillStyle = "#f7d774"; ctx.font = "bold 19px sans-serif";
    ctx.fillText("Press SPACE or tap Start to play", W / 2, 486);
  } else if (state === "paused") {
    ctx.fillStyle = "rgba(18,32,22,0.8)"; ctx.fillRect(0, 46, W, 120);
    ctx.fillStyle = "#fff7e0"; ctx.font = "bold 36px sans-serif";
    ctx.fillText("Paused — press P to resume", W / 2, 120);
  } else if (state === "over") {
    ctx.fillStyle = "rgba(60,20,16,0.9)"; ctx.fillRect(0, 46, W, 170);
    ctx.fillStyle = "#f7d774"; ctx.font = "bold 44px sans-serif";
    ctx.fillText("Caught on the farm!", W / 2, 116);
    ctx.fillStyle = "#fff7e0"; ctx.font = "bold 20px sans-serif";
    ctx.fillText("Distance: " + Math.floor(dist) + " m   Corn: " + corn + "   Score: " + score, W / 2, 158);
    ctx.fillText("Press SPACE or tap Start to try again", W / 2, 192);
  } else if (state === "win") {
    ctx.fillStyle = "rgba(24,56,30,0.92)"; ctx.fillRect(0, 46, W, 170);
    ctx.fillStyle = "#aaeb9f"; ctx.font = "bold 44px sans-serif";
    ctx.fillText("Gobble made it to the forest!", W / 2, 116);
    ctx.fillStyle = "#fff7e0"; ctx.font = "bold 20px sans-serif";
    ctx.fillText("Distance: 1200 m   Corn: " + corn + "   Score: " + score, W / 2, 158);
    ctx.fillText("Press SPACE or tap Start to play again", W / 2, 192);
  }
  ctx.textAlign = "left";
}
function loop() { update(); draw(); requestAnimationFrame(loop); }
document.addEventListener("keydown", function (e) {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter") { e.preventDefault(); jump(); }
  if (e.code === "ArrowDown") { e.preventDefault(); duck = true; }
  if (e.code === "KeyP") {
    if (state === "playing") state = "paused";
    else if (state === "paused") state = "playing";
  }
});
document.addEventListener("keyup", function (e) {
  if (e.code === "ArrowDown") duck = false;
});
cv.addEventListener("touchstart", function (e) {
  e.preventDefault();
  var r = cv.getBoundingClientRect();
  var x = e.touches[0].clientX - r.left;
  if (x > r.width / 2) jump(); else { if (state !== "playing") jump(); else duck = true; }
}, { passive: false });
cv.addEventListener("touchend", function () { duck = false; });
cv.addEventListener("mousedown", function () { jump(); });
loop();
</script>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// Program entry: write the game and the four screenshots
// ---------------------------------------------------------------------------

function validateOutputs(htmlPath: string, shotDir: string, shotNames: string[]): void {
  const html = fs.readFileSync(htmlPath, "utf8");
  const htmlBytes = Buffer.byteLength(html, "utf8");
  if (htmlBytes > 2 * 1024 * 1024) throw new Error("entry.html exceeds 2 MiB");
  for (const token of ["http://", "https://", "src=", "href="]) {
    if (html.includes(token)) throw new Error("entry.html contains forbidden reference: " + token);
  }
  for (const name of shotNames) {
    const png = fs.readFileSync(path.join(shotDir, name));
    if (png.length > 256 * 1024) throw new Error(name + " exceeds 256 KiB");
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== SHOT_W || height !== SHOT_H) {
      throw new Error(name + " has wrong dimensions: " + width + "x" + height);
    }
  }
}

function main(): void {
  const outDir = "/output";
  const shotDir = path.join(outDir, "screenshots");
  fs.mkdirSync(shotDir, { recursive: true });

  const htmlPath = path.join(outDir, "entry.html");
  fs.writeFileSync(htmlPath, GAME_HTML, "utf8");
  console.log("entry.html " + Buffer.byteLength(GAME_HTML, "utf8") + " bytes");

  const shots: Array<[string, Canvas]> = [
    ["1-title.png", sceneTitle()],
    ["2-gameplay.png", sceneGameplay()],
    ["3-level2.png", sceneLevel2()],
    ["4-win.png", sceneWin()],
  ];
  for (const [name, cv] of shots) {
    const png = encodePNG(cv);
    fs.writeFileSync(path.join(shotDir, name), png);
    console.log(name + " " + png.length + " bytes");
  }
  validateOutputs(htmlPath, shotDir, shots.map(([name]) => name));
  console.log("output validation passed");
}

main();
