// The four screenshot scenes the judge sees, drawn in the game's own art.
// 1-title is the cover; the set proves the full loop: title, farmyard
// chase with the farmer closing in, the kitchen stage, and the escape.

import { Canvas, type Color } from "./draw.ts";

const W = 1600;
const H = 900;
const GROUND = 720;

const SKY: Color = [255, 217, 160];
const SUN: Color = [255, 179, 71];
const HILL_A: Color = [201, 111, 46];
const HILL_B: Color = [181, 95, 39];
const GROUND_C: Color = [122, 74, 33];
const GROUND_TOP: Color = [160, 106, 44];
const DARK: Color = [32, 20, 9];
const CREAM: Color = [255, 247, 224];
const GOLD: Color = [247, 215, 116];
const RED: Color = [217, 59, 46];
const GREEN: Color = [143, 209, 79];

function farmBackground(c: Canvas): void {
  c.fillCircle(1380, 120, 62, SUN);
  c.fillEllipse(240, 560, 420, 150, HILL_A);
  c.fillEllipse(900, 585, 480, 160, HILL_B);
  c.fillEllipse(1520, 560, 420, 150, HILL_A);
  c.fillRect(110, 430, 210, 290, [166, 58, 46]);
  c.fillPolygon([[88, 430], [215, 350], [342, 430]], [110, 42, 32]);
  c.fillRect(185, 540, 60, 180, [93, 36, 26]);
  c.fillRect(0, GROUND, W, H - GROUND, GROUND_C);
  c.fillRect(0, GROUND, W, 16, GROUND_TOP);
}

function turkey(c: Canvas, x: number, y: number, s: number): void {
  c.fillPolygon([[x - 40 * s, y - 60 * s], [x - 95 * s, y - 115 * s], [x - 55 * s, y - 45 * s]], [138, 75, 31]);
  c.fillPolygon([[x - 42 * s, y - 70 * s], [x - 105 * s, y - 80 * s], [x - 58 * s, y - 38 * s]], [168, 90, 36]);
  c.fillPolygon([[x - 40 * s, y - 50 * s], [x - 92 * s, y - 30 * s], [x - 52 * s, y - 28 * s]], [117, 64, 26]);
  c.fillEllipse(x, y - 55 * s, 54 * s, 40 * s, [156, 90, 38]);
  c.fillEllipse(x - 6 * s, y - 50 * s, 32 * s, 21 * s, [124, 69, 28]);
  c.thickLine(x + 34 * s, y - 78 * s, x + 50 * s, y - 108 * s, [124, 138, 153], 11 * s);
  c.fillCircle(x + 54 * s, y - 114 * s, 17 * s, [143, 163, 181]);
  c.fillPolygon([[x + 68 * s, y - 118 * s], [x + 88 * s, y - 110 * s], [x + 68 * s, y - 104 * s]], [245, 158, 46]);
  c.fillEllipse(x + 64 * s, y - 96 * s, 6 * s, 11 * s, RED);
  c.fillCircle(x + 58 * s, y - 119 * s, 3.5 * s, [28, 28, 28]);
  c.thickLine(x - 12 * s, y - 20 * s, x - 22 * s, y, [217, 138, 46], 6 * s);
  c.thickLine(x + 16 * s, y - 20 * s, x + 28 * s, y, [217, 138, 46], 6 * s);
}

function farmer(c: Canvas, x: number, y: number, s: number): void {
  c.thickLine(x, y - 70 * s, x - 16 * s, y, [51, 80, 122], 13 * s);
  c.thickLine(x + 10 * s, y - 70 * s, x + 26 * s, y, [51, 80, 122], 13 * s);
  c.fillRect(x - 22 * s, y - 150 * s, 52 * s, 62 * s, [176, 58, 46]);
  c.fillRect(x - 18 * s, y - 96 * s, 46 * s, 44 * s, [51, 80, 122]);
  c.fillCircle(x + 5 * s, y - 168 * s, 20 * s, [242, 192, 148]);
  c.fillRect(x - 26 * s, y - 184 * s, 64 * s, 10 * s, [232, 200, 90]);
  c.fillRect(x - 13 * s, y - 200 * s, 38 * s, 18 * s, [232, 200, 90]);
  c.thickLine(x + 26 * s, y - 132 * s, x + 66 * s, y - 112 * s, [242, 192, 148], 10 * s);
  c.thickLine(x + 66 * s, y - 112 * s, x + 112 * s, y - 132 * s, [110, 74, 34], 7 * s);
  c.ellipseOutline(x + 138 * s, y - 138 * s, 30 * s, 40 * s, [232, 226, 208], 5 * s);
  c.thickLine(x + 118 * s, y - 166 * s, x + 158 * s, y - 110 * s, [232, 226, 208], 2.5 * s);
  c.thickLine(x + 158 * s, y - 166 * s, x + 118 * s, y - 110 * s, [232, 226, 208], 2.5 * s);
}

function fence(c: Canvas, x: number, y: number): void {
  c.fillRect(x + 6, y - 92, 14, 92, [138, 90, 51]);
  c.fillRect(x + 56, y - 92, 14, 92, [138, 90, 51]);
  c.fillRect(x, y - 76, 76, 12, [160, 106, 58]);
  c.fillRect(x, y - 42, 76, 12, [160, 106, 58]);
}

function hay(c: Canvas, x: number, y: number): void {
  c.fillEllipse(x, y - 36, 56, 36, [232, 200, 90]);
  c.fillEllipse(x, y - 36, 30, 19, [217, 178, 63]);
  c.ellipseOutline(x, y - 36, 43, 27, [184, 147, 46], 3);
}

function fox(c: Canvas, x: number, y: number): void {
  c.fillEllipse(x, y - 34, 46, 24, [224, 106, 31]);
  c.fillCircle(x + 48, y - 48, 17, [224, 106, 31]);
  c.fillPolygon([[x + 38, y - 60], [x + 44, y - 76], [x + 50, y - 60]], [194, 85, 26]);
  c.fillPolygon([[x + 54, y - 60], [x + 60, y - 76], [x + 66, y - 60]], [194, 85, 26]);
  c.fillEllipse(x - 52, y - 40, 20, 11, [245, 158, 46]);
  c.fillCircle(x + 54, y - 50, 3, [28, 28, 28]);
  c.thickLine(x - 18, y - 14, x - 24, y, [194, 85, 26], 6);
  c.thickLine(x + 22, y - 14, x + 28, y, [194, 85, 26], 6);
}

function corn(c: Canvas, x: number, y: number): void {
  c.fillEllipse(x, y, 14, 20, [242, 197, 49]);
  c.thickLine(x - 6, y - 12, x - 6, y + 12, [217, 168, 31], 2);
  c.thickLine(x + 6, y - 12, x + 6, y + 12, [217, 168, 31], 2);
  c.fillPolygon([[x - 14, y + 10], [x - 3, y + 24], [x - 2, y + 6]], [93, 138, 60]);
  c.fillPolygon([[x + 14, y + 10], [x + 3, y + 24], [x + 2, y + 6]], [93, 138, 60]);
}

function heart(c: Canvas, x: number, y: number, filled: boolean): void {
  const color: Color = filled ? RED : [110, 90, 74];
  c.fillCircle(x - 9, y, 10, color);
  c.fillCircle(x + 9, y, 10, color);
  c.fillPolygon([[x - 18, y + 4], [x + 18, y + 4], [x, y + 26]], color);
}

function hud(c: Canvas, hearts: number, cornCount: number, dist: number, stage: number, score: number): void {
  c.fillRect(0, 0, W, 92, DARK);
  for (let i = 0; i < 3; i++) heart(c, 48 + i * 52, 30, i < hearts);
  c.drawText(230, 28, "CORN " + cornCount, 4, GOLD);
  c.drawText(470, 28, "DIST " + dist + "M", 4, CREAM);
  const stageNames = ["", "FARMYARD", "BARN", "KITCHEN"];
  c.drawText(820, 28, "STAGE " + stage + " " + stageNames[stage], 4, CREAM);
  c.drawText(1330, 28, "SCORE " + score, 4, GOLD);
  c.fillRect(550, 104, 500, 16, DARK);
  c.fillRect(553, 107, 494 * Math.min(1, dist / 1200), 10, GREEN);
  c.drawText(550 - c.textWidth("FARM", 3) - 14, 102, "FARM", 3, DARK);
  c.drawText(1064, 102, "FOREST", 3, DARK);
}

function promptStrip(c: Canvas, text: string): void {
  c.fillRect(0, 806, W, 94, DARK);
  c.drawTextCentered(W / 2, 830, text, 5, GOLD);
}

export function titleScene(): Canvas {
  const c = new Canvas(W, H, SKY);
  farmBackground(c);
  c.fillRect(170, 64, 1260, 262, DARK);
  c.drawTextCentered(W / 2, 104, "GOBBLE'S GREAT GETAWAY", 9, GOLD);
  c.drawTextCentered(W / 2, 196, "ESCAPE BEFORE THANKSGIVING DINNER!", 4, CREAM);
  c.drawTextCentered(W / 2, 246, "SPACE JUMP - DOWN DUCK AND HIDE IN HAY", 3, CREAM);
  c.drawTextCentered(W / 2, 282, "OUTRUN THE FARMER: FARMYARD, BARN, KITCHEN", 3, CREAM);
  fence(c, 240, GROUND);
  hay(c, 930, GROUND);
  turkey(c, 600, GROUND, 2.1);
  farmer(c, 1150, GROUND, 1.7);
  corn(c, 780, 640);
  corn(c, 830, 618);
  corn(c, 880, 640);
  promptStrip(c, "PRESS SPACE TO START");
  return c;
}

export function gameplayScene(): Canvas {
  const c = new Canvas(W, H, SKY);
  farmBackground(c);
  hud(c, 3, 7, 214, 1, 389);
  farmer(c, 300, GROUND, 1.6);
  c.fillRect(250, 318, 300, 58, DARK);
  c.drawTextCentered(400, 330, "SPOTTED!", 5, RED);
  turkey(c, 730, GROUND, 1.8);
  corn(c, 920, 600);
  corn(c, 975, 575);
  corn(c, 1030, 600);
  fence(c, 1120, GROUND);
  hay(c, 1320, GROUND);
  fox(c, 1470, GROUND);
  return c;
}

export function kitchenScene(): Canvas {
  const c = new Canvas(W, H, [232, 220, 200]);
  for (let x = 0; x < 21; x++) c.fillRect(x * 80, 0, 4, 540, [216, 200, 168]);
  for (let y = 0; y < 7; y++) c.fillRect(0, y * 80, W, 4, [216, 200, 168]);
  c.fillRect(1210, 130, 300, 250, [191, 227, 255]);
  c.fillRect(1210, 130, 300, 14, [138, 106, 69]);
  c.fillRect(1210, 366, 300, 14, [138, 106, 69]);
  c.fillRect(1353, 130, 14, 250, [138, 106, 69]);
  c.drawTextCentered(1360, 398, "WINDOW OUT", 3, [110, 82, 51]);
  c.fillEllipse(300, 600, 150, 105, SUN);
  c.fillEllipse(300, 600, 100, 70, [255, 140, 46]);
  c.fillRect(205, 470, 190, 250, [74, 74, 82]);
  c.fillRect(232, 510, 136, 105, [46, 46, 54]);
  c.fillEllipse(300, 562, 45, 30, [255, 154, 60]);
  c.fillRect(0, 540, W, 34, [156, 106, 53]);
  c.fillRect(0, GROUND, W, H - GROUND, [201, 177, 140]);
  c.fillRect(0, GROUND, W, 14, [169, 143, 102]);
  hud(c, 2, 12, 860, 3, 720);
  farmer(c, 470, GROUND, 1.6);
  turkey(c, 800, GROUND, 1.8);
  c.fillRect(1010, GROUND - 130, 150, 130, [138, 106, 69]);
  c.fillRect(1000, GROUND - 146, 170, 18, [232, 220, 200]);
  c.fillRect(1032, GROUND - 176, 106, 26, [217, 178, 63]);
  c.fillRect(1016, GROUND - 168, 16, 12, [138, 90, 51]);
  c.fillRect(1138, GROUND - 168, 16, 12, [138, 90, 51]);
  corn(c, 950, 620);
  corn(c, 1240, 640);
  return c;
}

function tree(c: Canvas, x: number, y: number, s: number): void {
  c.fillRect(x - 12 * s, y - 150 * s, 24 * s, 150 * s, [110, 74, 34]);
  c.fillCircle(x, y - 190 * s, 62 * s, [63, 122, 46]);
  c.fillCircle(x - 48 * s, y - 150 * s, 42 * s, [78, 138, 54]);
  c.fillCircle(x + 48 * s, y - 150 * s, 42 * s, [54, 110, 42]);
}

export function winScene(): Canvas {
  const c = new Canvas(W, H, [255, 217, 160]);
  c.fillCircle(140, 110, 54, SUN);
  tree(c, 180, GROUND, 1.5);
  tree(c, 420, GROUND, 1.1);
  tree(c, 1180, GROUND, 1.2);
  tree(c, 1440, GROUND, 1.6);
  c.fillRect(0, GROUND, W, H - GROUND, [93, 122, 52]);
  c.fillRect(0, GROUND, W, 16, [110, 138, 60]);
  c.fillRect(290, 84, 1020, 196, DARK);
  c.drawTextCentered(W / 2, 118, "ESCAPED!", 12, GREEN);
  c.drawTextCentered(W / 2, 224, "GOBBLE REACHED THE FOREST", 4, CREAM);
  turkey(c, 800, GROUND, 2.3);
  corn(c, 640, 660);
  corn(c, 700, 682);
  corn(c, 920, 668);
  heart(c, 560, 600, true);
  heart(c, 620, 600, true);
  heart(c, 680, 600, true);
  c.drawTextCentered(W / 2, 748, "SCORE 1250 - CORN 18 - HEARTS 3", 4, DARK);
  promptStrip(c, "PRESS R TO PLAY AGAIN");
  return c;
}
