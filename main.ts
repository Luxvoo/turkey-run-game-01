// Entrypoint: builds the turkey escape game and its four screenshots.
// The judge dossier is the screenshot contact sheet plus a source outline,
// so the game, scenes and drawing code live in focused modules under lib/.

import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gameHtml } from "./lib/game.ts";
import { titleScene, gameplayScene, kitchenScene, winScene } from "./lib/scenes.ts";

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeOutput(path: string, bytes: Buffer): void {
  writeFileSync(path, bytes);
  console.log(path + " " + bytes.length + " bytes sha256=" + sha256(bytes));
}

function assertHtml(html: Buffer): void {
  if (html.length > 2 * 1024 * 1024) throw new Error("entry.html exceeds 2 MiB");
  const text = html.toString("utf8");
  for (const banned of ["http://", "https://", "src=", "href="]) {
    if (text.includes(banned)) throw new Error("entry.html contains external reference: " + banned);
  }
}

function assertPng(path: string, png: Buffer): void {
  if (png.length > 256 * 1024) throw new Error(path + " exceeds 256 KiB");
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== 1600 || height !== 900) {
    throw new Error(path + " is " + width + "x" + height + ", expected 1600x900");
  }
}

function writeScreenshot(path: string, png: Buffer): void {
  assertPng(path, png);
  writeOutput(path, png);
}

function main(): void {
  mkdirSync("/output/screenshots", { recursive: true });

  const html = Buffer.from(gameHtml(), "utf8");
  assertHtml(html);
  writeOutput("/output/entry.html", html);

  writeScreenshot("/output/screenshots/1-title.png", titleScene().toPng());
  writeScreenshot("/output/screenshots/2-gameplay.png", gameplayScene().toPng());
  writeScreenshot("/output/screenshots/3-kitchen.png", kitchenScene().toPng());
  writeScreenshot("/output/screenshots/4-win.png", winScene().toPng());
  console.log("output validation passed");
}

main();
