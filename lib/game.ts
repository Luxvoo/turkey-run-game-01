// The playable game, returned as one self-contained HTML document.
// Full loop: title screen -> run through farmyard, barn and kitchen ->
// escape to the forest (win) or get caught (game over) -> restart.

export function gameHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gobble's Great Getaway</title>
<style>
  body { margin: 0; background: #201409; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: monospace; }
  canvas { width: 960px; max-width: 96vw; height: auto; border: 4px solid #4a2c10; border-radius: 8px; background: #ffd9a0; touch-action: none; }
</style>
</head>
<body>
<canvas id="game" width="960" height="540"></canvas>
<script>
"use strict";
var cv = document.getElementById("game");
var ctx = cv.getContext("2d");
var W = 960, H = 540, GROUND = 440, WIN_DIST = 1200;

var mode = "title";
var frame = 0;
var distance = 0, score = 0, cornCount = 0, hearts = 3;
var stage = 1, banner = "", bannerT = 0;
var farmerGap = 250, swingT = -1, swingClock = 0;
var flash = 0, winBonusGiven = false;
var obstacles = [], corns = [];
var spawnT = 40, cornT = 120, patternIdx = 0;
var player = { x: 180, y: GROUND, vy: 0, duck: false, hidden: false, inv: 0 };

var SPAWN_GAPS = [88, 66, 108, 76, 96, 70, 116, 82];
var STAGE_TYPES = {
  1: ["fence", "hay", "fox", "fence", "hay", "fox"],
  2: ["crate", "fox", "hay", "crate", "fence", "fox"],
  3: ["pin", "counter", "pot", "pin", "counter", "pot"]
};
var STAGE_NAMES = { 1: "FARMYARD", 2: "BARN", 3: "KITCHEN" };
var OBSTACLE_SIZE = {
  fence: [46, 56], hay: [66, 46], fox: [72, 42],
  crate: [56, 60], pin: [78, 30], counter: [72, 66], pot: [58, 50]
};

var audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
function tone(freq, dur, type, vol, slideTo, delay) {
  if (!audioCtx) return;
  var t = audioCtx.currentTime + (delay || 0);
  var osc = audioCtx.createOscillator();
  var gain = audioCtx.createGain();
  osc.type = type || "square";
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol || 0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(t); osc.stop(t + dur + 0.02);
}
function sfx(name) {
  if (name === "jump") tone(480, 0.14, "square", 0.04, 820);
  else if (name === "corn") tone(950, 0.09, "square", 0.045, 1250);
  else if (name === "hit") tone(160, 0.2, "sawtooth", 0.06, 90);
  else if (name === "caught") tone(420, 0.6, "sawtooth", 0.06, 70);
  else if (name === "win") { tone(523, 0.12, "square", 0.05); tone(659, 0.12, "square", 0.05, null, 0.12); tone(784, 0.12, "square", 0.05, null, 0.24); tone(1046, 0.25, "square", 0.055, null, 0.36); }
}

function stageFor(d) { return d < 400 ? 1 : d < 800 ? 2 : 3; }
function speed() { return 5 + (stage - 1) * 0.8 + distance / 500; }

function reset() {
  distance = 0; score = 0; cornCount = 0; hearts = 3;
  stage = 1; banner = ""; bannerT = 0;
  farmerGap = 250; swingT = -1; swingClock = 0;
  flash = 0; winBonusGiven = false;
  obstacles = []; corns = [];
  spawnT = 50; cornT = 140; patternIdx = 0;
  player.y = GROUND; player.vy = 0; player.duck = false; player.hidden = false; player.inv = 0;
}
function startGame() { ensureAudio(); reset(); mode = "playing"; }
function jump() {
  if (player.y >= GROUND) { player.vy = -15.5; sfx("jump"); }
}
function hit() {
  if (player.inv > 0) return;
  hearts--; score = Math.max(0, score - 30);
  farmerGap -= 42; player.inv = 95; flash = 10;
  sfx("hit");
  if (hearts <= 0) caught();
}
function caught() { mode = "over"; sfx("caught"); }
function win() {
  mode = "win";
  if (!winBonusGiven) { score += hearts * 50 + cornCount * 5; winBonusGiven = true; }
  sfx("win");
}

function spawnObstacle() {
  var types = STAGE_TYPES[stage];
  var type = types[patternIdx % types.length];
  var size = OBSTACLE_SIZE[type];
  obstacles.push({ x: W + 30, w: size[0], h: size[1], type: type, passed: false });
  spawnT = SPAWN_GAPS[patternIdx % SPAWN_GAPS.length];
  patternIdx++;
}
function spawnCorn() {
  var baseY = GROUND - 70 - (patternIdx % 3) * 26;
  for (var i = 0; i < 4; i++) {
    corns.push({ x: W + 40 + i * 34, y: baseY - Math.round(22 * (1 - Math.abs(i - 1.5) / 1.5)), taken: false });
  }
  cornT = 190 + (patternIdx % 4) * 30;
}

function playerBox() {
  var h = player.duck ? 38 : 62;
  return { x: player.x - 24, y: player.y - h, w: 48, h: h };
}
function overlaps(a, b) {
  return a.x + 6 < b.x + b.w && a.x + a.w - 6 > b.x && a.y + 5 < b.y + b.h && a.y + a.h > b.y + 4;
}

function update() {
  frame++;
  if (mode !== "playing") return;
  var sp = speed();
  distance += sp * 0.09;
  score += 0.2;
  var newStage = stageFor(distance);
  if (newStage !== stage) {
    stage = newStage;
    banner = "STAGE " + stage + ": " + STAGE_NAMES[stage];
    bannerT = 130;
  }
  if (bannerT > 0) bannerT--;
  if (distance >= WIN_DIST) { win(); return; }

  player.vy += 0.85;
  player.y += player.vy;
  if (player.y > GROUND) { player.y = GROUND; player.vy = 0; }
  if (player.inv > 0) player.inv--;
  if (flash > 0) flash--;

  player.hidden = false;
  if (player.duck && player.y >= GROUND) {
    for (var i = 0; i < obstacles.length; i++) {
      if (obstacles[i].type === "hay" && Math.abs(obstacles[i].x - player.x) < 115) player.hidden = true;
    }
  }

  if (player.hidden) farmerGap += 0.55;
  else farmerGap -= 0.035 + stage * 0.012;
  farmerGap = Math.max(0, Math.min(285, farmerGap));
  if (farmerGap <= 30) { caught(); return; }

  swingClock++;
  if (swingT < 0 && farmerGap < 155 && swingClock > 150) { swingT = 26; swingClock = 0; }
  if (swingT >= 0) {
    if (swingT === 13 && !player.duck && !player.hidden) hit();
    swingT--;
  }

  spawnT--;
  if (spawnT <= 0) spawnObstacle();
  cornT--;
  if (cornT <= 0) spawnCorn();

  var box = playerBox();
  for (var j = obstacles.length - 1; j >= 0; j--) {
    var o = obstacles[j];
    o.x -= sp;
    if (!o.passed && o.x + o.w < player.x - 24) {
      o.passed = true; score += 10;
      farmerGap = Math.min(285, farmerGap + 5);
    }
    var ob = { x: o.x, y: GROUND - o.h, w: o.w, h: o.h };
    if (overlaps(box, ob)) hit();
    if (o.x + o.w < -40) obstacles.splice(j, 1);
  }
  for (var k = corns.length - 1; k >= 0; k--) {
    var c = corns[k];
    c.x -= sp;
    var cb = { x: c.x - 11, y: c.y - 14, w: 22, h: 28 };
    if (!c.taken && overlaps(box, cb)) {
      c.taken = true; cornCount++; score += 25; sfx("corn");
    }
    if (c.x < -30 || c.taken) corns.splice(k, 1);
  }
}

function ellipse(x, y, rx, ry, color, rot) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
  ctx.fill();
}
function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function tri(x1, y1, x2, y2, x3, y3, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
}
function text(str, x, y, size, color, align) {
  ctx.fillStyle = color;
  ctx.font = "bold " + size + "px monospace";
  ctx.textAlign = align || "left";
  ctx.fillText(str, x, y);
}

function drawBackground() {
  var off = distance * 4;
  if (stage === 1) {
    rect(0, 0, W, H, "#ffd9a0");
    ellipse(830, 80, 42, 42, "#ffb347");
    ellipse(150 - (off * 0.2 % 900), 330, 260, 90, "#c96f2e");
    ellipse(620 - (off * 0.2 % 900), 345, 300, 100, "#b55f27");
    ellipse(1050 - (off * 0.2 % 900), 330, 260, 90, "#c96f2e");
    var bx = 700 - (off * 0.45 % 1100);
    rect(bx, 300, 130, 140, "#a63a2e");
    tri(bx - 12, 300, bx + 65, 252, bx + 142, 300, "#6e2a20");
    rect(bx + 48, 360, 36, 80, "#5d241a");
    rect(0, GROUND, W, H - GROUND, "#7a4a21");
    rect(0, GROUND, W, 10, "#a06a2c");
  } else if (stage === 2) {
    rect(0, 0, W, H, "#8a5a33");
    for (var i = 0; i < 13; i++) rect(i * 80 - (off * 0.3 % 80), 0, 4, GROUND, "#744a29");
    rect(660, 70, 150, 110, "#ffe9b0");
    rect(660, 70, 150, 8, "#5d3a1e"); rect(660, 172, 150, 8, "#5d3a1e");
    rect(728, 70, 8, 110, "#5d3a1e");
    var cx = 120 - (off * 0.5 % 800);
    rect(cx, GROUND - 70, 70, 70, "#b07a3f"); rect(cx + 80, GROUND - 52, 54, 52, "#9c6a35");
    rect(cx + 10, GROUND - 122, 54, 52, "#c08a48");
    rect(0, GROUND, W, H - GROUND, "#5d3a1e");
    rect(0, GROUND, W, 8, "#744a29");
  } else {
    rect(0, 0, W, H, "#e8dcc8");
    for (var tx = 0; tx < 13; tx++) rect(tx * 80 - (off * 0.3 % 80), 0, 3, 300, "#d8c8a8");
    for (var ty = 0; ty < 4; ty++) rect(0, ty * 80, W, 3, "#d8c8a8");
    rect(720, 60, 170, 150, "#bfe3ff");
    rect(720, 60, 170, 10, "#8a6a45"); rect(720, 200, 170, 10, "#8a6a45");
    rect(800, 60, 10, 150, "#8a6a45");
    var ox = 240 - (off * 0.5 % 900);
    ellipse(ox + 55, GROUND - 60, 85, 60, "#ffb347");
    ellipse(ox + 55, GROUND - 60, 58, 40, "#ff8c2e");
    rect(ox, GROUND - 120, 110, 120, "#4a4a52");
    rect(ox + 16, GROUND - 96, 78, 62, "#2e2e36");
    ellipse(ox + 55, GROUND - 65, 26, 18, "#ff9a3c");
    rect(0, 300, W, 26, "#9c6a35");
    rect(0, GROUND, W, H - GROUND, "#c9b18c");
    rect(0, GROUND, W, 8, "#a98f66");
  }
}

function drawTurkey(x, y, duck, phase) {
  var bob = duck ? 8 : Math.sin(phase * 0.5) * 2;
  var bodyY = y - (duck ? 24 : 36) + bob;
  ellipse(x - 30, bodyY - 8, 26, 12, "#8a4b1f", -0.7);
  ellipse(x - 34, bodyY - 20, 26, 12, "#a85a24", -0.25);
  ellipse(x - 32, bodyY + 4, 24, 11, "#75401a", -1.1);
  ellipse(x, bodyY, 34, duck ? 20 : 25, "#9c5a26");
  ellipse(x - 4, bodyY + 3, 20, 13, "#7c451c");
  var headX = x + (duck ? 34 : 30), headY = bodyY - (duck ? 12 : 30);
  ctx.strokeStyle = "#7c8a99"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(x + 22, bodyY - 8); ctx.lineTo(headX, headY + 6); ctx.stroke();
  ellipse(headX, headY, 11, 11, "#8fa3b5");
  tri(headX + 9, headY - 2, headX + 22, headY + 2, headX + 9, headY + 6, "#f59e2e");
  ellipse(headX + 6, headY + 10, 4, 7, "#d93b2e");
  ellipse(headX + 3, headY - 3, 2.5, 2.5, "#1c1c1c");
  ctx.strokeStyle = "#d98a2e"; ctx.lineWidth = 4;
  var legSwing = duck ? 4 : Math.sin(phase * 0.9) * 9;
  ctx.beginPath(); ctx.moveTo(x - 8, bodyY + 18); ctx.lineTo(x - 8 + legSwing, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 10, bodyY + 18); ctx.lineTo(x + 10 - legSwing, y); ctx.stroke();
  if (player.inv > 0 && Math.floor(frame / 4) % 2 === 0 && mode === "playing") {
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, bodyY, 42, 32, 0, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawFarmer(x, y, phase) {
  var bob = Math.abs(Math.sin(phase * 0.55)) * 3;
  var top = y - 108 + bob;
  ctx.strokeStyle = "#33507a"; ctx.lineWidth = 9;
  var swing = Math.sin(phase * 0.55) * 10;
  ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x - 8 + swing, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 6, y - 46); ctx.lineTo(x + 14 - swing, y); ctx.stroke();
  rect(x - 14, top + 26, 34, 42, "#b03a2e");
  rect(x - 12, top + 52, 30, 30, "#33507a");
  ellipse(x + 4, top + 14, 13, 14, "#f2c094");
  rect(x - 16, top + 2, 42, 7, "#e8c85a");
  rect(x - 8, top - 8, 26, 12, "#e8c85a");
  var netDip = swingT >= 0 ? Math.sin((26 - swingT) / 26 * Math.PI) * 26 : 0;
  ctx.strokeStyle = "#f2c094"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(x + 16, top + 36); ctx.lineTo(x + 44, top + 48 + netDip * 0.4); ctx.stroke();
  ctx.strokeStyle = "#6e4a22"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x + 44, top + 48 + netDip * 0.4); ctx.lineTo(x + 76, top + 34 + netDip); ctx.stroke();
  ctx.strokeStyle = "#e8e2d0"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(x + 92, top + 30 + netDip, 20, 26, 0.3, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 80, top + 12 + netDip); ctx.lineTo(x + 104, top + 48 + netDip); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 104, top + 12 + netDip); ctx.lineTo(x + 80, top + 48 + netDip); ctx.stroke();
}

function drawObstacle(o) {
  var y = GROUND - o.h;
  if (o.type === "fence") {
    rect(o.x + 4, y, 8, o.h, "#8a5a33"); rect(o.x + 34, y, 8, o.h, "#8a5a33");
    rect(o.x, y + 10, o.w, 7, "#a06a3a"); rect(o.x, y + 30, o.w, 7, "#a06a3a");
  } else if (o.type === "hay") {
    ellipse(o.x + o.w / 2, y + o.h / 2, o.w / 2, o.h / 2, "#e8c85a");
    ellipse(o.x + o.w / 2, y + o.h / 2, o.w / 4, o.h / 4, "#d9b23f");
    ctx.strokeStyle = "#b8932e"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, y + o.h / 2, o.w / 3, o.h / 3, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (o.type === "fox") {
    ellipse(o.x + 30, y + 24, 28, 15, "#e06a1f");
    ellipse(o.x + 58, y + 16, 11, 10, "#e06a1f");
    tri(o.x + 52, y + 8, o.x + 56, y - 2, o.x + 60, y + 8, "#c2551a");
    tri(o.x + 62, y + 8, o.x + 66, y - 2, o.x + 70, y + 8, "#c2551a");
    ellipse(o.x + 6, y + 20, 12, 7, "#f59e2e", 0.6);
    ellipse(o.x + 62, y + 15, 2, 2, "#1c1c1c");
    ctx.strokeStyle = "#c2551a"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(o.x + 20, y + 36); ctx.lineTo(o.x + 16, GROUND); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(o.x + 42, y + 36); ctx.lineTo(o.x + 46, GROUND); ctx.stroke();
  } else if (o.type === "crate") {
    rect(o.x, y, o.w, o.h, "#b07a3f");
    ctx.strokeStyle = "#7c5226"; ctx.lineWidth = 4;
    ctx.strokeRect(o.x + 3, y + 3, o.w - 6, o.h - 6);
    ctx.beginPath(); ctx.moveTo(o.x + 3, y + 3); ctx.lineTo(o.x + o.w - 3, y + o.h - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(o.x + o.w - 3, y + 3); ctx.lineTo(o.x + 3, y + o.h - 3); ctx.stroke();
  } else if (o.type === "pin") {
    rect(o.x + 12, y + 6, o.w - 24, 18, "#d9b23f");
    rect(o.x, y + 11, 12, 8, "#8a5a33"); rect(o.x + o.w - 12, y + 11, 12, 8, "#8a5a33");
  } else if (o.type === "counter") {
    rect(o.x, y, o.w, o.h, "#8a6a45");
    rect(o.x - 4, y - 8, o.w + 8, 12, "#e8dcc8");
    rect(o.x + 10, y + 16, o.w - 20, 8, "#6e5233");
  } else if (o.type === "pot") {
    ellipse(o.x + o.w / 2, y + 26, o.w / 2, 24, "#5a5a66");
    rect(o.x + 6, y + 2, o.w - 12, 8, "#3e3e48");
    ellipse(o.x + o.w / 2, y + 2, 6, 5, "#d93b2e");
  }
}

function drawCornItem(c) {
  ellipse(c.x, c.y, 9, 13, "#f2c531");
  ctx.strokeStyle = "#d9a81f"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(c.x - 5, c.y - 8); ctx.lineTo(c.x - 5, c.y + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(c.x + 5, c.y - 8); ctx.lineTo(c.x + 5, c.y + 8); ctx.stroke();
  tri(c.x - 9, c.y + 6, c.x - 2, c.y + 16, c.x - 1, c.y + 4, "#5d8a3c");
  tri(c.x + 9, c.y + 6, c.x + 2, c.y + 16, c.x + 1, c.y + 4, "#5d8a3c");
}

function heart(x, y, filled) {
  var c = filled ? "#d93b2e" : "#6e5a4a";
  ellipse(x - 6, y, 7, 7, c);
  ellipse(x + 6, y, 7, 7, c);
  tri(x - 12, y + 3, x + 12, y + 3, x, y + 17, c);
}

function drawHud() {
  rect(0, 0, W, 54, "rgba(32,20,9,0.82)");
  for (var i = 0; i < 3; i++) heart(30 + i * 34, 18, i < hearts);
  text("CORN " + cornCount, 140, 34, 20, "#f7d774");
  text("DIST " + Math.floor(distance) + "M", 270, 34, 20, "#fff7e0");
  text("STAGE " + stage + " " + STAGE_NAMES[stage], 450, 34, 20, "#fff7e0");
  text("SCORE " + Math.floor(score), 760, 34, 20, "#f7d774");
  rect(330, 62, 300, 12, "#4a2c10");
  rect(332, 64, 296 * Math.min(1, distance / WIN_DIST), 8, "#8fd14f");
  text("FARM", 292, 74, 13, "#fff7e0", "right");
  text("FOREST", 640, 74, 13, "#fff7e0", "left");
  if (bannerT > 0) {
    rect(280, 120, 400, 52, "rgba(32,20,9,0.85)");
    text(banner, W / 2, 155, 26, "#f7d774", "center");
  }
}

function panel(title, lines, accent) {
  rect(180, 110, 600, 300, "rgba(32,20,9,0.88)");
  ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.strokeRect(180, 110, 600, 300);
  text(title, W / 2, 178, 40, accent, "center");
  for (var i = 0; i < lines.length; i++) text(lines[i], W / 2, 228 + i * 30, 19, "#fff7e0", "center");
}

function draw() {
  drawBackground();
  var i;
  for (i = 0; i < corns.length; i++) drawCornItem(corns[i]);
  for (i = 0; i < obstacles.length; i++) drawObstacle(obstacles[i]);
  var farmerX = player.x - farmerGap - 60;
  if (mode === "title") {
    drawFarmer(650, GROUND, 4);
    drawTurkey(300, GROUND, false, 4);
  } else {
    drawFarmer(farmerX, GROUND, frame);
    drawTurkey(player.x, player.y, player.duck, frame);
    if (player.hidden) text("HIDDEN", player.x, player.y - 84, 16, "#8fd14f", "center");
    if (mode === "playing" && farmerGap < 95 && Math.floor(frame / 8) % 2 === 0) {
      text("SPOTTED!", farmerX + 40, GROUND - 150, 22, "#ff4a3c", "center");
    }
  }
  drawHud();
  if (flash > 0) rect(0, 0, W, H, "rgba(217,59,46,0.25)");
  if (mode === "title") {
    panel("GOBBLE'S GREAT GETAWAY", [
      "ESCAPE BEFORE THANKSGIVING DINNER!",
      "SPACE / UP: JUMP    DOWN: DUCK + HIDE IN HAY",
      "OUTRUN THE FARMER: FARMYARD, BARN, KITCHEN",
      "REACH THE FOREST AT 1200M",
      "SPACE OR TAP TO START"
    ], "#f7d774");
  } else if (mode === "paused") {
    panel("PAUSED", ["P: RESUME", "R: RESTART"], "#f7d774");
  } else if (mode === "over") {
    panel("CAUGHT!", [
      "THE FARMER GOT GOBBLE AT " + Math.floor(distance) + "M",
      "SCORE " + Math.floor(score) + "   CORN " + cornCount,
      "SPACE OR R: TRY AGAIN"
    ], "#ff4a3c");
  } else if (mode === "win") {
    panel("ESCAPED!", [
      "GOBBLE REACHED THE FOREST!",
      "SCORE " + Math.floor(score) + "   CORN " + cornCount + "   HEARTS " + hearts,
      "SPACE OR R: PLAY AGAIN"
    ], "#8fd14f");
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

document.addEventListener("keydown", function (e) {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "ArrowDown") e.preventDefault();
  ensureAudio();
  if (e.code === "Space" || e.code === "ArrowUp") {
    if (mode === "title" || mode === "over" || mode === "win") startGame();
    else if (mode === "playing") jump();
  } else if (e.code === "ArrowDown") {
    player.duck = true;
  } else if (e.code === "KeyP") {
    if (mode === "playing") mode = "paused";
    else if (mode === "paused") mode = "playing";
  } else if (e.code === "KeyR") {
    if (mode !== "title") startGame();
  }
});
document.addEventListener("keyup", function (e) {
  if (e.code === "ArrowDown") player.duck = false;
});
cv.addEventListener("touchstart", function (e) {
  e.preventDefault(); ensureAudio();
  if (mode !== "playing") { startGame(); return; }
  var r = cv.getBoundingClientRect();
  var x = (e.touches[0].clientX - r.left) / r.width * W;
  if (x < W / 2) player.duck = true; else jump();
}, { passive: false });
cv.addEventListener("touchend", function () { player.duck = false; });
cv.addEventListener("mousedown", function (e) {
  ensureAudio();
  if (mode !== "playing") { startGame(); return; }
  var r = cv.getBoundingClientRect();
  var x = (e.clientX - r.left) / r.width * W;
  if (x < W / 2) player.duck = true; else jump();
});
cv.addEventListener("mouseup", function () { player.duck = false; });

reset();
loop();
</script>
</body>
</html>
`;
}
