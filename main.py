#!/usr/bin/env python3
"""Gobble's Great Getaway - a turkey escape game entry.

Writes /output/entry.html (one self-contained playable game) and four
1600x900 screenshots under /output/screenshots/. No network access.
"""

import hashlib
import os

from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = "/output"
SHOT_DIR = os.path.join(OUTPUT_DIR, "screenshots")
SHOT_W = 1600
SHOT_H = 900
MAX_SHOT_BYTES = 256 * 1024
MAX_HTML_BYTES = 2 * 1024 * 1024

GAME_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gobble's Great Getaway</title>
<style>
  html, body { margin: 0; padding: 0; background: #1d2b1f; font-family: Georgia, 'Times New Roman', serif; }
  #wrap { max-width: 980px; margin: 0 auto; padding: 12px; text-align: center; }
  h1 { color: #f7d774; font-size: 26px; margin: 6px 0 8px; letter-spacing: 1px; }
  canvas { width: 100%; max-width: 960px; height: auto; border: 4px solid #f7d774; border-radius: 10px; background: #87ceeb; touch-action: none; }
  .row { margin-top: 10px; }
  button { background: #b3541e; color: #fff7e0; border: 2px solid #f7d774; border-radius: 8px; padding: 10px 18px; font-size: 16px; margin: 0 4px; cursor: pointer; font-family: inherit; }
  button:active { background: #8a3f14; }
  p.help { color: #e8e3c8; font-size: 14px; line-height: 1.5; max-width: 760px; margin: 10px auto 0; }
</style>
</head>
<body>
<div id="wrap">
  <h1>Gobble's Great Getaway</h1>
  <canvas id="game" width="960" height="540"></canvas>
  <div class="row">
    <button id="btnStart">Start / Restart</button>
    <button id="btnJump">Jump</button>
    <button id="btnDuck">Duck</button>
    <button id="btnPause">Pause</button>
  </div>
  <p class="help">Help Gobble the turkey escape the farm and reach the forest 1200 m away.
  Jump fences, hay bales and foxes. Duck under the farmer's net. Grab corn for bonus points.
  Keys: Space / Up = jump, Down = duck, P = pause, R = restart. Touch: tap right side to jump, left side to duck.</p>
</div>
<script>
'use strict';
var W = 960, H = 540, GROUND = 440, WIN_DIST = 1200;
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');
var state = 'title'; // title, playing, paused, over, win
var frame = 0, distance = 0, corn = 0, hearts = 3, level = 1, speed = 5;
var obstacles = [], corns = [], spawnTimer = 80, cornTimer = 140;
var scrollFar = 0, scrollMid = 0, scrollNear = 0;
var audioCtx = null;
var turkey = { x: 150, y: GROUND, vy: 0, jumping: false, ducking: false, invincible: 0, legPhase: 0 };
var STAND_H = 66, DUCK_H = 34, TURKEY_W = 64;

function beep(freq, dur, type) {
  try {
    if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* sound is optional */ }
}
function sndJump() { beep(520, 0.12, 'square'); }
function sndCorn() { beep(880, 0.09, 'sine'); setTimeout(function () { beep(1320, 0.09, 'sine'); }, 70); }
function sndHit() { beep(160, 0.25, 'sawtooth'); }
function sndWin() { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { beep(f, 0.18, 'triangle'); }, i * 130); }); }

function resetGame() {
  distance = 0; corn = 0; hearts = 3; level = 1; speed = 5; frame = 0;
  obstacles = []; corns = []; spawnTimer = 80; cornTimer = 140;
  turkey.y = GROUND; turkey.vy = 0; turkey.jumping = false; turkey.ducking = false; turkey.invincible = 0;
}
function startGame() { resetGame(); state = 'playing'; beep(660, 0.1, 'triangle'); }
function doJump() {
  if (state === 'title' || state === 'over' || state === 'win') { startGame(); return; }
  if (state !== 'playing') { return; }
  if (!turkey.jumping) { turkey.vy = -14.5; turkey.jumping = true; turkey.ducking = false; sndJump(); }
}
function setDuck(d) { if (state === 'playing' && !turkey.jumping) { turkey.ducking = d; } }
function togglePause() {
  if (state === 'playing') { state = 'paused'; }
  else if (state === 'paused') { state = 'playing'; }
}

function spawnObstacle() {
  var kinds = ['fence', 'hay', 'fox', 'farmer'];
  var kind = kinds[Math.floor(Math.random() * kinds.length)];
  var o = { kind: kind, x: W + 40, passed: false };
  if (kind === 'fence') { o.w = 56; o.h = 48; }
  if (kind === 'hay') { o.w = 60; o.h = 46; }
  if (kind === 'fox') { o.w = 66; o.h = 34; o.extra = 1.6; }
  if (kind === 'farmer') { o.w = 46; o.h = 112; }
  obstacles.push(o);
}
function spawnCorn() {
  var baseY = GROUND - 60 - Math.random() * 90;
  var n = 3 + Math.floor(Math.random() * 3);
  for (var i = 0; i < n; i++) { corns.push({ x: W + 40 + i * 34, y: baseY - Math.sin(i / (n - 1) * Math.PI) * 26, taken: false }); }
}
function turkeyBox() {
  var h = turkey.ducking ? DUCK_H : STAND_H;
  return { x: turkey.x - TURKEY_W / 2 + 6, y: turkey.y - h, w: TURKEY_W - 12, h: h };
}
function obstacleBox(o) {
  if (o.kind === 'farmer') { return { x: o.x - o.w / 2, y: GROUND - 112, w: o.w, h: 54 }; }
  return { x: o.x - o.w / 2, y: GROUND - o.h, w: o.w, h: o.h };
}
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

function update() {
  if (state !== 'playing') { return; }
  frame++;
  level = Math.min(5, 1 + Math.floor(distance / 300));
  speed = Math.min(11, 5 + (level - 1) * 1.1 + distance / 600);
  distance += speed * 0.09;
  scrollFar += speed * 0.2; scrollMid += speed * 0.5; scrollNear += speed;
  if (distance >= WIN_DIST) { state = 'win'; sndWin(); return; }
  // turkey physics
  if (turkey.jumping) {
    turkey.vy += 0.72; turkey.y += turkey.vy;
    if (turkey.y >= GROUND) { turkey.y = GROUND; turkey.vy = 0; turkey.jumping = false; }
  }
  turkey.legPhase += speed * 0.06;
  if (turkey.invincible > 0) { turkey.invincible--; }
  // spawning
  spawnTimer--;
  if (spawnTimer <= 0) { spawnObstacle(); spawnTimer = Math.max(46, 110 - level * 10) + Math.random() * 50; }
  cornTimer--;
  if (cornTimer <= 0) { spawnCorn(); cornTimer = 150 + Math.random() * 140; }
  // move + collide
  var tb = turkeyBox(), i, o;
  for (i = obstacles.length - 1; i >= 0; i--) {
    o = obstacles[i];
    o.x -= speed + (o.extra || 0);
    if (o.x < -80) { obstacles.splice(i, 1); continue; }
    if (turkey.invincible <= 0 && overlap(tb, obstacleBox(o))) {
      hearts--; turkey.invincible = 100; sndHit();
      obstacles.splice(i, 1);
      if (hearts <= 0) { state = 'over'; }
    }
  }
  for (i = corns.length - 1; i >= 0; i--) {
    var c = corns[i];
    c.x -= speed;
    if (c.x < -40) { corns.splice(i, 1); continue; }
    var cx = turkey.x, cy = turkey.y - (turkey.ducking ? 18 : 36);
    if (!c.taken && Math.abs(c.x - cx) < 36 && Math.abs(c.y - cy) < 42) { c.taken = true; corn++; sndCorn(); corns.splice(i, 1); }
  }
}

function drawSky() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  if (level >= 3) { g.addColorStop(0, '#f2a65a'); g.addColorStop(0.6, '#f7d774'); g.addColorStop(1, '#ffe9b0'); }
  else { g.addColorStop(0, '#6ec6e8'); g.addColorStop(0.7, '#bfe9f7'); g.addColorStop(1, '#eafaf1'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(830, 80, 42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (var i = 0; i < 5; i++) {
    var cx = ((i * 230 - scrollFar * 0.6) % (W + 240) + W + 240) % (W + 240) - 120;
    var cy = 50 + (i % 3) * 34;
    ctx.beginPath(); ctx.ellipse(cx, cy, 52, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 34, cy + 6, 38, 14, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function drawHills() {
  ctx.fillStyle = '#7fbf5f';
  ctx.beginPath(); ctx.moveTo(0, GROUND);
  for (var x = 0; x <= W; x += 20) { ctx.lineTo(x, GROUND - 90 - Math.sin((x + scrollMid) * 0.008) * 36); }
  ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5da244';
  ctx.beginPath(); ctx.moveTo(0, GROUND);
  for (var x2 = 0; x2 <= W; x2 += 20) { ctx.lineTo(x2, GROUND - 40 - Math.sin((x2 + scrollNear * 0.7) * 0.011 + 2) * 20); }
  ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
  // barn silhouette drifting by on the mid layer
  var bx = ((620 - scrollMid * 0.8) % (W + 320) + W + 320) % (W + 320) - 160;
  ctx.fillStyle = '#a63d2a'; ctx.fillRect(bx, GROUND - 118, 110, 78);
  ctx.fillStyle = '#7c2d1e'; ctx.beginPath(); ctx.moveTo(bx - 8, GROUND - 118); ctx.lineTo(bx + 55, GROUND - 152); ctx.lineTo(bx + 118, GROUND - 118); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5b2013'; ctx.fillRect(bx + 38, GROUND - 84, 34, 44);
  // forest appears as the goal nears
  if (distance > WIN_DIST - 220) {
    ctx.fillStyle = '#2e6b34';
    for (var t = 0; t < 6; t++) {
      var tx = W - 30 - t * 44 + Math.min(0, (WIN_DIST - distance - 220) * 0.4);
      ctx.beginPath(); ctx.moveTo(tx, GROUND - 130); ctx.lineTo(tx - 26, GROUND - 40); ctx.lineTo(tx + 26, GROUND - 40); ctx.closePath(); ctx.fill();
      ctx.fillRect(tx - 5, GROUND - 44, 10, 44);
    }
  }
}
function drawGround() {
  ctx.fillStyle = '#8a5a33'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#a06a3a'; ctx.fillRect(0, GROUND, W, 12);
  ctx.strokeStyle = '#6e4525'; ctx.lineWidth = 3;
  for (var i = 0; i < 12; i++) {
    var gx = ((i * 96 - scrollNear) % (W + 96) + W + 96) % (W + 96) - 48;
    ctx.beginPath(); ctx.moveTo(gx, GROUND + 26); ctx.lineTo(gx + 5, GROUND + 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx + 12, GROUND + 28); ctx.lineTo(gx + 16, GROUND + 14); ctx.stroke();
  }
  ctx.fillStyle = '#c98d4b'; ctx.fillRect(0, GROUND + 44, W, 6);
}
function drawTurkey() {
  if (turkey.invincible > 0 && Math.floor(frame / 5) % 2 === 0) { ctx.globalAlpha = 0.35; }
  var x = turkey.x, y = turkey.y, duck = turkey.ducking;
  var bodyY = y - (duck ? 22 : 38), bodyRx = duck ? 36 : 30, bodyRy = duck ? 16 : 24;
  // tail fan
  ctx.fillStyle = '#6b4423';
  for (var i = -2; i <= 2; i++) {
    ctx.save(); ctx.translate(x - 22, bodyY); ctx.rotate(i * 0.32 - 0.5);
    ctx.beginPath(); ctx.ellipse(-16, 0, 20, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = '#8a5a33';
  ctx.beginPath(); ctx.ellipse(x, bodyY, bodyRx, bodyRy, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a9713f';
  ctx.beginPath(); ctx.ellipse(x - 4, bodyY + 2, 16, 10, -0.3, 0, Math.PI * 2); ctx.fill();
  // neck + head
  var hx = x + (duck ? 30 : 26), hy = y - (duck ? 30 : 62);
  ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(x + 16, bodyY - 8); ctx.lineTo(hx, hy + 6); ctx.stroke();
  ctx.fillStyle = '#7fa8c9'; ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8a13a'; ctx.beginPath(); ctx.moveTo(hx + 8, hy - 2); ctx.lineTo(hx + 20, hy + 2); ctx.lineTo(hx + 8, hy + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d64541'; ctx.beginPath(); ctx.ellipse(hx + 6, hy + 10, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d2b1f'; ctx.beginPath(); ctx.arc(hx + 3, hy - 3, 2.2, 0, Math.PI * 2); ctx.fill();
  // legs
  ctx.strokeStyle = '#e8a13a'; ctx.lineWidth = 4;
  var s1 = Math.sin(turkey.legPhase) * 10, s2 = Math.sin(turkey.legPhase + Math.PI) * 10;
  if (turkey.jumping) { s1 = 6; s2 = -6; }
  ctx.beginPath(); ctx.moveTo(x - 6, y - 14); ctx.lineTo(x - 6 + s1, y - 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 10, y - 14); ctx.lineTo(x + 10 + s2, y - 2); ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawObstacle(o) {
  var x = o.x;
  if (o.kind === 'fence') {
    ctx.fillStyle = '#9c6b3f';
    ctx.fillRect(x - 26, GROUND - 48, 8, 48); ctx.fillRect(x + 18, GROUND - 48, 8, 48);
    ctx.fillRect(x - 30, GROUND - 40, 60, 7); ctx.fillRect(x - 30, GROUND - 20, 60, 7);
  } else if (o.kind === 'hay') {
    ctx.fillStyle = '#e5c15c'; ctx.beginPath(); ctx.arc(x, GROUND - 22, 24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c39a35'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, GROUND - 22, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, GROUND - 22, 7, 0, Math.PI * 2); ctx.stroke();
  } else if (o.kind === 'fox') {
    ctx.fillStyle = '#d96f32';
    ctx.beginPath(); ctx.ellipse(x, GROUND - 18, 28, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 26, GROUND - 26, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 32, GROUND - 34); ctx.lineTo(x - 28, GROUND - 44); ctx.lineTo(x - 22, GROUND - 34); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 30, GROUND - 24, 14, 6, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + 40, GROUND - 28, 6, 4, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a34e1f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 14, GROUND - 8); ctx.lineTo(x - 14, GROUND); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 14, GROUND - 8); ctx.lineTo(x + 14, GROUND); ctx.stroke();
  } else if (o.kind === 'farmer') {
    ctx.fillStyle = '#3f6fb5'; ctx.fillRect(x - 11, GROUND - 52, 9, 52); ctx.fillRect(x + 3, GROUND - 52, 9, 52);
    ctx.fillStyle = '#c94f4f'; ctx.fillRect(x - 15, GROUND - 92, 32, 44);
    ctx.fillStyle = '#f2c79b'; ctx.beginPath(); ctx.arc(x + 1, GROUND - 102, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e5c15c'; ctx.fillRect(x - 15, GROUND - 114, 32, 6); ctx.fillRect(x - 7, GROUND - 122, 18, 9);
    ctx.strokeStyle = '#7c5a2e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 14, GROUND - 84); ctx.lineTo(x - 40, GROUND - 66); ctx.stroke();
    ctx.strokeStyle = '#d9d9d9'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 40, GROUND - 66); ctx.lineTo(x - 40, GROUND - 52); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 40, GROUND - 66); ctx.lineTo(x - 48, GROUND - 54); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 40, GROUND - 66); ctx.lineTo(x - 32, GROUND - 54); ctx.stroke();
  }
}
function drawCorn(c) {
  ctx.fillStyle = '#f7d774'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 8, 13, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5da244'; ctx.beginPath(); ctx.ellipse(c.x - 6, c.y + 10, 7, 4, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d9a93a'; ctx.fillRect(c.x - 1, c.y - 9, 2, 18);
}
function drawHeart(x, y, full) {
  ctx.fillStyle = full ? '#e0483e' : 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  ctx.bezierCurveTo(x - 12, y - 4, x - 5, y - 12, x, y - 5);
  ctx.bezierCurveTo(x + 5, y - 12, x + 12, y - 4, x, y + 8);
  ctx.fill();
}
function drawHUD() {
  ctx.fillStyle = 'rgba(20,32,22,0.55)'; ctx.fillRect(0, 0, W, 52);
  for (var i = 0; i < 3; i++) { drawHeart(30 + i * 30, 26, i < hearts); }
  ctx.fillStyle = '#fff7e0'; ctx.font = 'bold 20px Georgia, serif'; ctx.textAlign = 'left';
  ctx.fillText('Corn: ' + corn, 140, 33);
  ctx.fillText('Distance: ' + Math.floor(distance) + ' m', 280, 33);
  ctx.fillText('Level ' + level, 520, 33);
  ctx.fillText('Score: ' + (Math.floor(distance) + corn * 25), 640, 33);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(140, H - 26, W - 280, 10);
  ctx.fillStyle = '#5da244'; ctx.fillRect(140, H - 26, (W - 280) * Math.min(1, distance / WIN_DIST), 10);
  ctx.fillStyle = '#fff7e0'; ctx.font = '13px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('FARM', 140, H - 32); ctx.fillText('FOREST', W - 140, H - 32);
}
function centerText(lines, sizes, colors, startY) {
  ctx.textAlign = 'center';
  var y = startY;
  for (var i = 0; i < lines.length; i++) {
    ctx.font = 'bold ' + sizes[i] + 'px Georgia, serif';
    ctx.fillStyle = colors[i];
    ctx.fillText(lines[i], W / 2, y);
    y += sizes[i] + 16;
  }
}
function draw() {
  drawSky(); drawHills(); drawGround();
  corns.forEach(drawCorn);
  obstacles.forEach(drawObstacle);
  drawTurkey();
  drawHUD();
  if (state === 'title') {
    ctx.fillStyle = 'rgba(20,32,22,0.45)'; ctx.fillRect(0, 52, W, H - 52);
    centerText(["Gobble's Great Getaway", 'Help Gobble escape the farm!', 'Jump: Space / Up / tap right   Duck: Down / tap left', 'Reach the forest at 1200 m. Avoid fences, foxes and the farmer.', 'Press SPACE or tap Start to play'],
      [52, 26, 20, 20, 24], ['#f7d774', '#fff7e0', '#e8e3c8', '#e8e3c8', '#f7d774'], 170);
  } else if (state === 'paused') {
    ctx.fillStyle = 'rgba(20,32,22,0.5)'; ctx.fillRect(0, 52, W, H - 52);
    centerText(['Paused', 'Press P or tap Pause to continue'], [44, 22], ['#f7d774', '#fff7e0'], 260);
  } else if (state === 'over') {
    ctx.fillStyle = 'rgba(60,20,16,0.55)'; ctx.fillRect(0, 52, W, H - 52);
    centerText(['Caught!', 'Distance: ' + Math.floor(distance) + ' m   Corn: ' + corn + '   Score: ' + (Math.floor(distance) + corn * 25), 'Press SPACE or tap Start to try again'],
      [48, 24, 22], ['#ffb3a0', '#fff7e0', '#f7d774'], 240);
  } else if (state === 'win') {
    ctx.fillStyle = 'rgba(20,50,26,0.5)'; ctx.fillRect(0, 52, W, H - 52);
    centerText(['Gobble made it to the forest!', 'Distance: ' + WIN_DIST + ' m   Corn: ' + corn + '   Score: ' + (WIN_DIST + corn * 25), 'Press SPACE or tap Start to play again'],
      [42, 24, 22], ['#b7f0a0', '#fff7e0', '#f7d774'], 240);
  }
}
function loop() { update(); draw(); requestAnimationFrame(loop); }

document.addEventListener('keydown', function (e) {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') { e.preventDefault(); doJump(); }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); setDuck(true); }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); }
  if (e.code === 'KeyR') { startGame(); }
});
document.addEventListener('keyup', function (e) {
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { setDuck(false); }
});
canvas.addEventListener('touchstart', function (e) {
  e.preventDefault();
  var r = canvas.getBoundingClientRect();
  var x = e.touches[0].clientX - r.left;
  if (x > r.width / 2) { doJump(); } else { setDuck(true); setTimeout(function () { setDuck(false); }, 350); }
}, { passive: false });
canvas.addEventListener('mousedown', function (e) {
  var r = canvas.getBoundingClientRect();
  if (e.clientX - r.left > r.width / 2) { doJump(); } else { setDuck(true); setTimeout(function () { setDuck(false); }, 350); }
});
document.getElementById('btnStart').addEventListener('click', startGame);
document.getElementById('btnJump').addEventListener('click', doJump);
document.getElementById('btnDuck').addEventListener('click', function () { setDuck(true); setTimeout(function () { setDuck(false); }, 400); });
document.getElementById('btnPause').addEventListener('click', togglePause);
loop();
</script>
</body>
</html>
"""


def load_font(size, bold=True):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def lerp_color(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_sky(d, dusk=False):
    top = (242, 166, 90) if dusk else (110, 198, 232)
    bottom = (255, 233, 176) if dusk else (234, 250, 241)
    for y in range(SHOT_H):
        d.line([(0, y), (SHOT_W, y)], fill=lerp_color(top, bottom, y / SHOT_H))
    d.ellipse([1330, 60, 1470, 200], fill=(255, 243, 160))
    for cx, cy in [(260, 110), (700, 70), (1080, 140)]:
        d.ellipse([cx - 90, cy - 30, cx + 90, cy + 30], fill=(255, 255, 255))
        d.ellipse([cx - 40, cy - 48, cx + 60, cy + 22], fill=(255, 255, 255))


def draw_land(d, dusk=False):
    ground = 733
    hill_far = (110, 170, 80) if not dusk else (120, 150, 70)
    hill_near = (93, 162, 68) if not dusk else (95, 135, 60)
    d.polygon([(0, ground), (0, 560), (300, 500), (650, 560), (1000, 490), (1350, 550), (1600, 510), (1600, ground)], fill=hill_far)
    d.polygon([(0, ground), (0, 640), (350, 590), (750, 650), (1150, 600), (1600, 650), (1600, ground)], fill=hill_near)
    # barn
    d.rectangle([1080, 540, 1260, 660], fill=(166, 61, 42))
    d.polygon([(1065, 540), (1170, 485), (1275, 540)], fill=(124, 45, 30))
    d.rectangle([1145, 585, 1200, 660], fill=(91, 32, 19))
    # ground strip
    d.rectangle([0, ground, SHOT_W, SHOT_H], fill=(138, 90, 51))
    d.rectangle([0, ground, SHOT_W, ground + 20], fill=(160, 106, 58))
    d.rectangle([0, ground + 73, SHOT_W, ground + 83], fill=(201, 141, 75))


def draw_turkey(d, x, y, scale=1.0, duck=False):
    s = scale
    body_y = y - (36 if duck else 63) * s
    # tail fan
    for i in range(-2, 3):
        d.pieslice([x - 95 * s, body_y - 55 * s + i * 14 * s, x - 10 * s, body_y + 30 * s + i * 14 * s], 120, 240, fill=(107, 68, 35))
    d.ellipse([x - 50 * s, body_y - 40 * s, x + 50 * s, body_y + 40 * s], fill=(138, 90, 51))
    d.ellipse([x - 28 * s, body_y - 14 * s, x + 22 * s, body_y + 18 * s], fill=(169, 113, 63))
    hx = x + (52 if duck else 44) * s
    hy = y - (50 if duck else 104) * s
    d.line([(x + 26 * s, body_y - 12 * s), (hx, hy + 10 * s)], fill=(138, 90, 51), width=max(2, int(15 * s)))
    d.ellipse([hx - 17 * s, hy - 17 * s, hx + 17 * s, hy + 17 * s], fill=(127, 168, 201))
    d.polygon([(hx + 13 * s, hy - 3 * s), (hx + 34 * s, hy + 3 * s), (hx + 13 * s, hy + 8 * s)], fill=(232, 161, 58))
    d.ellipse([hx + 4 * s, hy + 8 * s, hx + 16 * s, hy + 30 * s], fill=(214, 69, 65))
    d.ellipse([hx + 3 * s, hy - 6 * s, hx + 9 * s, hy], fill=(29, 43, 31))
    d.line([(x - 10 * s, y - 22 * s), (x - 20 * s, y - 2 * s)], fill=(232, 161, 58), width=max(2, int(7 * s)))
    d.line([(x + 16 * s, y - 22 * s), (x + 28 * s, y - 2 * s)], fill=(232, 161, 58), width=max(2, int(7 * s)))


def draw_fence(d, x, ground=733):
    d.rectangle([x - 45, ground - 80, x - 31, ground], fill=(156, 107, 63))
    d.rectangle([x + 31, ground - 80, x + 45, ground], fill=(156, 107, 63))
    d.rectangle([x - 50, ground - 66, x + 50, ground - 54], fill=(156, 107, 63))
    d.rectangle([x - 50, ground - 33, x + 50, ground - 21], fill=(156, 107, 63))


def draw_hay(d, x, ground=733):
    d.ellipse([x - 40, ground - 76, x + 40, ground], fill=(229, 193, 92))
    d.ellipse([x - 25, ground - 61, x + 25, ground - 15], outline=(195, 154, 53), width=5)
    d.ellipse([x - 11, ground - 47, x + 11, ground - 29], outline=(195, 154, 53), width=4)


def draw_fox(d, x, ground=733):
    d.ellipse([x - 48, ground - 50, x + 48, ground - 8], fill=(217, 111, 50))
    d.ellipse([x - 62, ground - 60, x - 28, ground - 26], fill=(217, 111, 50))
    d.polygon([(x - 58, ground - 56), (x - 50, ground - 74), (x - 40, ground - 56)], fill=(217, 111, 50))
    d.ellipse([x + 40, ground - 52, x + 82, ground - 28], fill=(217, 111, 50))
    d.ellipse([x + 66, ground - 50, x + 86, ground - 32], fill=(255, 255, 255))
    d.line([(x - 24, ground - 12), (x - 24, ground)], fill=(163, 78, 31), width=7)
    d.line([(x + 24, ground - 12), (x + 24, ground)], fill=(163, 78, 31), width=7)


def draw_farmer(d, x, ground=733):
    d.rectangle([x - 18, ground - 86, x - 3, ground], fill=(63, 111, 181))
    d.rectangle([x + 5, ground - 86, x + 20, ground], fill=(63, 111, 181))
    d.rectangle([x - 25, ground - 153, x + 28, ground - 80], fill=(201, 79, 79))
    d.ellipse([x - 17, ground - 188, x + 20, ground - 151], fill=(242, 199, 155))
    d.rectangle([x - 25, ground - 190, x + 28, ground - 180], fill=(229, 193, 92))
    d.rectangle([x - 11, ground - 203, x + 18, ground - 188], fill=(229, 193, 92))
    d.line([(x - 24, ground - 140), (x - 66, ground - 110)], fill=(124, 90, 46), width=7)
    d.line([(x - 66, ground - 110), (x - 66, ground - 86)], fill=(217, 217, 217), width=4)
    d.line([(x - 66, ground - 110), (x - 79, ground - 90)], fill=(217, 217, 217), width=4)
    d.line([(x - 66, ground - 110), (x - 53, ground - 90)], fill=(217, 217, 217), width=4)


def draw_corn(d, x, y):
    d.ellipse([x - 13, y - 22, x + 13, y + 22], fill=(247, 215, 116))
    d.line([(x, y - 15), (x, y + 15)], fill=(217, 169, 58), width=3)
    d.ellipse([x - 20, y + 12, x - 2, y + 24], fill=(93, 162, 68))


def draw_hud(d, hearts, corn_count, distance_m, level, score):
    d.rectangle([0, 0, SHOT_W, 87], fill=(20, 32, 22))
    for i in range(3):
        cx = 50 + i * 50
        color = (224, 72, 62) if i < hearts else (90, 90, 90)
        d.ellipse([cx - 16, 22, cx, 42], fill=color)
        d.ellipse([cx, 22, cx + 16, 42], fill=color)
        d.polygon([(cx - 15, 36), (cx + 15, 36), (cx, 58)], fill=color)
    font = load_font(34)
    d.text((230, 26), "Corn: %d" % corn_count, font=font, fill=(255, 247, 224))
    d.text((470, 26), "Distance: %d m" % distance_m, font=font, fill=(255, 247, 224))
    d.text((880, 26), "Level %d" % level, font=font, fill=(255, 247, 224))
    d.text((1080, 26), "Score: %d" % score, font=font, fill=(255, 247, 224))
    # progress bar
    d.rectangle([230, SHOT_H - 43, SHOT_W - 230, SHOT_H - 27], fill=(120, 120, 120))
    frac = min(1.0, distance_m / 1200.0)
    d.rectangle([230, SHOT_H - 43, 230 + int((SHOT_W - 460) * frac), SHOT_H - 27], fill=(93, 162, 68))
    small = load_font(22)
    d.text((230, SHOT_H - 72), "FARM", font=small, fill=(255, 247, 224))
    tw = d.textlength("FOREST", font=small)
    d.text((SHOT_W - 230 - tw, SHOT_H - 72), "FOREST", font=small, fill=(255, 247, 224))


def centered(d, text, y, size, color):
    font = load_font(size)
    tw = d.textlength(text, font=font)
    d.text(((SHOT_W - tw) / 2, y), text, font=font, fill=color)


def scene_title():
    img = Image.new("RGB", (SHOT_W, SHOT_H))
    d = ImageDraw.Draw(img)
    draw_sky(d)
    draw_land(d)
    draw_corn(d, 560, 640)
    draw_corn(d, 610, 610)
    draw_corn(d, 660, 640)
    draw_fence(d, 250)
    draw_hay(d, 1350)
    d.rectangle([0, 87, SHOT_W, 470], fill=(20, 32, 22))
    draw_turkey(d, 800, 745, scale=1.9)
    centered(d, "Gobble's Great Getaway", 130, 92, (247, 215, 116))
    centered(d, "Help Gobble escape the farm!", 260, 44, (255, 247, 224))
    centered(d, "Jump: Space / Up / tap right    Duck: Down / tap left", 330, 34, (232, 227, 200))
    centered(d, "Reach the forest at 1200 m. Avoid fences, foxes and the farmer.", 385, 34, (232, 227, 200))
    draw_hud(d, 3, 0, 0, 1, 0)
    centered(d, "Press SPACE or tap Start to play", 800, 36, (247, 215, 116))
    return img


def scene_gameplay():
    img = Image.new("RGB", (SHOT_W, SHOT_H))
    d = ImageDraw.Draw(img)
    draw_sky(d)
    draw_land(d)
    draw_turkey(d, 330, 733, scale=1.7)
    draw_fence(d, 700)
    draw_hay(d, 1080)
    draw_fox(d, 1400)
    for i, cx in enumerate([520, 575, 630, 685]):
        draw_corn(d, cx, 600 - int(28 * (1 - abs(i - 1.5) / 1.5)))
    draw_hud(d, 3, 7, 214, 1, 389)
    return img


def scene_level2():
    img = Image.new("RGB", (SHOT_W, SHOT_H))
    d = ImageDraw.Draw(img)
    draw_sky(d, dusk=True)
    draw_land(d, dusk=True)
    draw_turkey(d, 300, 733, scale=1.7, duck=True)
    draw_farmer(d, 640)
    draw_fence(d, 980)
    draw_fox(d, 1300)
    for i, cx in enumerate([820, 875, 930]):
        draw_corn(d, cx, 585)
    d.rectangle([520, 300, 1080, 390], fill=(20, 32, 22))
    centered(d, "LEVEL 2 - Faster!", 318, 52, (247, 215, 116))
    draw_hud(d, 2, 16, 486, 2, 886)
    return img


def scene_win():
    img = Image.new("RGB", (SHOT_W, SHOT_H))
    d = ImageDraw.Draw(img)
    draw_sky(d)
    draw_land(d)
    # forest on the right
    for tx in [1180, 1280, 1380, 1480, 1560]:
        d.polygon([(tx, 470), (tx - 55, 660), (tx + 55, 660)], fill=(46, 107, 52))
        d.rectangle([tx - 9, 655, tx + 9, 733], fill=(107, 68, 35))
    draw_turkey(d, 760, 733, scale=2.2)
    for cx in [430, 490, 550, 610]:
        draw_corn(d, cx, 630)
    d.rectangle([0, 87, SHOT_W, 360], fill=(20, 50, 26))
    centered(d, "Gobble made it to the forest!", 140, 76, (183, 240, 160))
    centered(d, "Distance: 1200 m    Corn: 24    Score: 1800", 250, 42, (255, 247, 224))
    draw_hud(d, 3, 24, 1200, 5, 1800)
    centered(d, "Press SPACE or tap Start to play again", 800, 36, (247, 215, 116))
    return img


SCENES = [
    ("1-title.png", scene_title),
    ("2-gameplay.png", scene_gameplay),
    ("3-level2.png", scene_level2),
    ("4-win.png", scene_win),
]


def save_shot(img, path):
    img = img.quantize(colors=160, method=Image.MEDIANCUT)
    img.save(path, format="PNG", optimize=True)


def write_outputs():
    os.makedirs(SHOT_DIR, exist_ok=True)
    html_bytes = GAME_HTML.encode("utf-8")
    if len(html_bytes) > MAX_HTML_BYTES:
        raise ValueError("entry.html exceeds 2 MiB")
    for marker in (b"http://", b"https://", b"src=", b"href="):
        if marker in html_bytes:
            raise ValueError("entry.html contains an external reference: %r" % marker)
    html_path = os.path.join(OUTPUT_DIR, "entry.html")
    with open(html_path, "wb") as f:
        f.write(html_bytes)
    print("entry.html %d bytes sha256=%s" % (len(html_bytes), hashlib.sha256(html_bytes).hexdigest()))
    for name, builder in SCENES:
        path = os.path.join(SHOT_DIR, name)
        save_shot(builder(), path)
        with Image.open(path) as check:
            if check.size != (SHOT_W, SHOT_H):
                raise ValueError("%s is %s, expected %sx%s" % (name, check.size, SHOT_W, SHOT_H))
        data = open(path, "rb").read()
        if len(data) > MAX_SHOT_BYTES:
            raise ValueError("%s exceeds 256 KiB" % name)
        print("%s %d bytes sha256=%s" % (name, len(data), hashlib.sha256(data).hexdigest()))


if __name__ == "__main__":
    write_outputs()
