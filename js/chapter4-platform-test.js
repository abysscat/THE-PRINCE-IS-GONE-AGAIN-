(() => {
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 1774, H = 1158, VW = 1600, CANVAS_W = 2048, CANVAS_H = 712;
const VIEW_SCALE = CANVAS_W / VW, VH = CANVAS_H / VIEW_SCALE;
const asset = (src) => { const image = new Image(); image.src = `images/${src}`; return image; };

const bg = asset('chapter3/bg3/chapter3_stage_1_BG_layer2_loop.webp');
const sprites = {
  stand: asset('hero/hero_stand.webp'), jump: asset('hero/hero_jump.webp'),
  walk1: asset('hero/hero_walk_1_right.webp'), walk2: asset('hero/hero_walk_2_right.webp'),
  thrust: asset('hero/hero_thrust.webp'), bash: asset('hero/hero_bash.webp'),
  enemy: asset('chapter1/enemies/1/chapter1_enemy_1_normal.webp')
};

// 每塊平台的碰撞資料獨立於背景圖；青藍色細線會一直顯示，方便核對實際碰撞位置。
const platforms = [
  { id: 'P1', x: 0, y: 1090, w: 1774, h: 68, type: 'ground' },
  { id: 'P2', x: 0, y: 970, w: 520, h: 24 },
  { id: 'P3', x: 520, y: 810, w: 245, h: 22 },
  { id: 'P4', x: 760, y: 690, w: 320, h: 22 },
  { id: 'P5', x: 1100, y: 835, w: 260, h: 22 },
  { id: 'P6', x: 1280, y: 610, w: 494, h: 24 },
  { id: 'P7', x: 0, y: 600, w: 420, h: 22 },
  { id: 'P8', x: 570, y: 440, w: 250, h: 22 },
  { id: 'P9', x: 850, y: 300, w: 350, h: 22 },
  { id: 'P10', x: 1280, y: 160, w: 494, h: 24 }
];
const platformById = new Map(platforms.map(p => [p.id, p]));

// 原角色 Sprite 是 512x460。所有動作都以相同比例顯示，避免把角色壓扁。
const HERO_H = 146;
const HERO_W = HERO_H * 512 / 460;
const hero = {
  x: 145, y: 1090 - HERO_H, vx: 0, vy: 0, w: HERO_W, h: HERO_H,
  ground: true, platform: 'P1', face: 1,
  dash: 0, dashCooldown: 0, airDashUsed: false, airDashActive: false, airDashHitDone: false,
  attack: 0, bashAnim: 0, specialAnim: 0, specialEffect: 0, walkT: 0,
  hp: 100, mp: 65, gems: 3
};

// 敵人只屬於 P2；活動 X 座標永遠限制於 P2 之內，不會追到其他平台。
const enemyPlatform = platformById.get('P2');
const ENEMY_H = 100, ENEMY_W = ENEMY_H * 294 / 199;
const dummy = {
  x: 330, y: enemyPlatform.y - ENEMY_H, w: ENEMY_W, h: ENEMY_H,
  hp: 3, maxHp: 3, flash: 0, platformId: 'P2',
  minX: enemyPlatform.x + 18,
  maxX: enemyPlatform.x + enemyPlatform.w - ENEMY_W - 18
};

const keys = new Set();
let camY = H - VH, camX = 0, last = performance.now();
let jumpBuffer = 0, coyote = 0, attackCooldown = 0, bashCooldown = 0, specialCooldown = 0;
let paused = false, combo = 0, hitTimer = 0, statusText = 'READY';
let musicEnabled = true, musicStarted = false;
const bgm = new Audio('audio/fantasy_rpg_bgm.ogg');
bgm.loop = true; bgm.volume = 0.28; bgm.preload = 'auto';
const sfx = {
  thrust: new Audio('audio/spear_thrust.ogg'),
  bash: new Audio('audio/shield_bash.ogg')
};
Object.values(sfx).forEach(a => { a.preload = 'auto'; a.volume = 0.42; });
const $ = id => document.getElementById(id);

function setStatus(message) {
  statusText = message;
  const status = $('status');
  if (status) status.textContent = message;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function playAudio(audio) {
  try { audio.pause(); audio.currentTime = 0; const p = audio.play(); if (p?.catch) p.catch(() => {}); } catch (_) {}
}
function startMusic() {
  if (!musicEnabled) return;
  try { const p = bgm.play(); if (p?.then) p.then(() => { musicStarted = true; }).catch(() => {}); } catch (_) {}
}
function unlockAudio() { if (musicEnabled && !musicStarted) startMusic(); }
function updateHud() {
  $('hpbar').style.width = `${hero.hp}%`;
  $('mpbar').style.width = `${hero.mp}%`;
  $('gems').textContent = '◆ '.repeat(Math.max(0, hero.gems)).trim();
  $('count').textContent = `第 16 關 · ${dummy.hp <= 0 ? 1 : 0} / 1`;
  if (dummy.hp <= 0) $('count').textContent = '第 16 關 · 1 / 1';
}
function jump() { if (!paused) { unlockAudio(); jumpBuffer = 130; } }

// 用 contain 計算圖片實際繪製框，任何動作 Sprite 都不會被非等比拉伸。
function drawImageFit(image, x, y, w, h, flip = false, alpha = 1) {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return;
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const drawX = x + (w - drawW) / 2;
  const drawY = y + (h - drawH) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (flip) {
    ctx.translate(drawX + drawW / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, -drawW / 2, drawY, drawW, drawH);
  } else {
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
  }
  ctx.restore();
}
function enemyOnSamePlatform() {
  return dummy.hp > 0 && hero.ground && hero.platform === dummy.platformId;
}
function damageEnemy(box, label, damage = 1) {
  if (dummy.hp <= 0) return false;
  const overlaps = box.x < dummy.x + dummy.w && box.x + box.w > dummy.x &&
    box.y < dummy.y + dummy.h && box.y + box.h > dummy.y;
  if (!overlaps) return false;
  dummy.hp = Math.max(0, dummy.hp - damage);
  dummy.flash = 170;
  if (dummy.hp <= 0) setStatus('敵人已被擊敗');
  else setStatus(`${label}命中！敵人 HP ${dummy.hp}/${dummy.maxHp}`);
  combo++;
  hero.mp = Math.min(100, hero.mp + 5);
  hitTimer = 520;
  updateHud();
  return true;
}
function sideHitbox(reach = 108, height = 72) {
  return {
    x: hero.face > 0 ? hero.x + hero.w - 8 : hero.x - reach + 8,
    y: hero.y + (hero.h - height) * 0.5,
    w: reach, h: height
  };
}
function thrustAttack() {
  if (paused || attackCooldown > 0 || hero.dash > 0) return;
  unlockAudio(); playAudio(sfx.thrust);
  hero.attack = 190; attackCooldown = 270;
  const hit = damageEnemy(sideHitbox(118, 82), '槍刺');
  if (!hit) setStatus('左右槍刺');
}
function shieldBash() {
  if (paused || bashCooldown > 0 || hero.dash > 0) return;
  unlockAudio(); playAudio(sfx.bash);
  if (!hero.ground) { startAirShieldDash(); return; }
  hero.bashAnim = 230; bashCooldown = 430;
  const hit = damageEnemy(sideHitbox(128, 94), '盾擊');
  if (!hit) setStatus('盾牌猛擊');
}
function startAirShieldDash() {
  if (paused || hero.dashCooldown > 0 || hero.dash > 0 || hero.airDashUsed) return;
  hero.dash = 175; hero.vx = hero.face * 13; hero.vy = 0;
  hero.dashCooldown = 650; hero.airDashUsed = true;
  hero.airDashActive = true; hero.airDashHitDone = false; hero.bashAnim = 235;
  setStatus('空中盾擊 Dash');
}
function specialAttack() {
  if (paused || specialCooldown > 0 || hero.dash > 0) return;
  unlockAudio();
  if (hero.mp < 30) { setStatus('能量不足'); return; }
  hero.mp -= 30; specialCooldown = 1200; hero.specialAnim = 540; hero.specialEffect = 360;
  // 沿用舊遊戲特殊技的 30 MP 消耗；只攻擊角色面向方向，不畫出長條攻擊 Bar。
  const hit = damageEnemy(sideHitbox(190, 138), '聖光技能', 3);
  setStatus(hit ? '聖光命中！' : '聖光爆發');
  updateHud();
}
function updateEnemy(dt, scale) {
  if (dummy.hp <= 0) return;
  const assigned = platformById.get(dummy.platformId);
  dummy.y = assigned.y - dummy.h;
  dummy.x = clamp(dummy.x, dummy.minX, dummy.maxX);
  if (enemyOnSamePlatform()) {
    const delta = hero.x - dummy.x;
    if (Math.abs(delta) > 82) dummy.x += Math.sign(delta) * Math.min(Math.abs(delta), 0.12 * scale);
    dummy.x = clamp(dummy.x, dummy.minX, dummy.maxX);
  }
  dummy.flash = Math.max(0, dummy.flash - dt);
}

function update(dt) {
  if (paused) return;
  const scale = dt / 16.667;
  attackCooldown = Math.max(0, attackCooldown - dt);
  bashCooldown = Math.max(0, bashCooldown - dt);
  specialCooldown = Math.max(0, specialCooldown - dt);
  hero.attack = Math.max(0, hero.attack - dt);
  hero.bashAnim = Math.max(0, hero.bashAnim - dt);
  hero.specialAnim = Math.max(0, hero.specialAnim - dt);
  hero.specialEffect = Math.max(0, hero.specialEffect - dt);
  hero.dashCooldown = Math.max(0, hero.dashCooldown - dt);
  hitTimer = Math.max(0, hitTimer - dt);
  if (hitTimer <= 0) combo = 0;

  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  if (hero.dash > 0) {
    hero.x += hero.vx * scale;
    hero.dash -= dt;
    if (hero.dash <= 0) { hero.vx *= 0.22; hero.airDashActive = false; }
    if (hero.airDashActive && !hero.airDashHitDone) {
      hero.airDashHitDone = damageEnemy(sideHitbox(150, 112), '空中盾擊');
    }
  } else {
    const direction = (right ? 1 : 0) - (left ? 1 : 0);
    if (direction) {
      hero.face = direction;
      hero.vx += direction * 0.72 * scale;
      hero.vx = clamp(hero.vx, -6.2, 6.2);
    } else hero.vx *= Math.pow(0.78, scale);
    hero.x += hero.vx * scale;
  }
  hero.x = clamp(hero.x, 0, W - hero.w);

  if (hero.ground) coyote = 105; else coyote = Math.max(0, coyote - dt);
  jumpBuffer = Math.max(0, jumpBuffer - dt);
  if (jumpBuffer > 0 && (hero.ground || coyote > 0)) {
    hero.vy = -12.8; hero.ground = false; hero.platform = 'AIR'; jumpBuffer = 0; coyote = 0;
  }

  const oldBottom = hero.y + hero.h;
  if (hero.dash <= 0) {
    hero.vy = Math.min(13, hero.vy + 0.48 * scale);
    hero.y += hero.vy * scale;
  }
  hero.ground = false;
  let landed = null;
  if (hero.vy >= 0 && hero.dash <= 0) {
    const newBottom = hero.y + hero.h;
    for (const platform of platforms) {
      const horizontalOverlap = hero.x + hero.w * 0.78 > platform.x &&
        hero.x + hero.w * 0.22 < platform.x + platform.w;
      if (oldBottom <= platform.y + 4 && newBottom >= platform.y && horizontalOverlap) {
        if (!landed || platform.y < landed.y) landed = platform;
      }
    }
  }
  if (landed) {
    hero.y = landed.y - hero.h; hero.vy = 0; hero.ground = true;
    hero.platform = landed.id; hero.airDashUsed = false; hero.airDashActive = false;
  }

  if (hero.y > H + 300) {
    hero.x = 145; hero.y = 1090 - hero.h; hero.vx = hero.vy = 0;
    hero.platform = 'P1'; hero.ground = true; hero.airDashUsed = false; hero.airDashActive = false;
    setStatus('回到起點');
  }
  updateEnemy(dt, scale);
  camX = clamp(hero.x - VW * 0.42, 0, W - VW);
  const targetY = clamp(hero.y + hero.h * 0.5 - VH * 0.55, 0, H - VH);
  camY += (targetY - camY) * Math.min(1, 0.12 * scale);
}

function drawPlatforms() {
  ctx.save();
  for (const platform of platforms) {
    // 保留平台碰撞除錯標示：淡色區塊 + 清楚的頂部碰撞線。
    ctx.fillStyle = 'rgba(48, 205, 245, 0.08)';
    ctx.fillRect(platform.x, platform.y, platform.w, Math.max(5, platform.h));
    ctx.strokeStyle = 'rgba(91, 226, 255, 0.88)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(platform.x, platform.y + 1); ctx.lineTo(platform.x + platform.w, platform.y + 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(91, 226, 255, 0.30)';
    ctx.lineWidth = 1;
    ctx.strokeRect(platform.x + .5, platform.y + .5, platform.w - 1, platform.h - 1);
  }
  ctx.restore();
}
function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.save(); ctx.scale(VIEW_SCALE, VIEW_SCALE); ctx.translate(-camX, -camY);
  if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0, W, H);
  else { ctx.fillStyle = '#08264a'; ctx.fillRect(0, 0, W, H); }
  drawPlatforms();

  if (dummy.hp > 0) {
    drawImageFit(sprites.enemy, dummy.x, dummy.y, dummy.w, dummy.h, false, 1);
    if (dummy.flash > 0) {
      ctx.fillStyle = '#ffffff88'; ctx.fillRect(dummy.x, dummy.y, dummy.w, dummy.h);
    }
    // 敵人自己的細小 HP 指示；不會因按下攻擊才在角色旁邊生成長條。
    ctx.fillStyle = '#15243a'; ctx.fillRect(dummy.x, dummy.y - 13, dummy.w, 5);
    ctx.fillStyle = '#e75e68'; ctx.fillRect(dummy.x, dummy.y - 13, dummy.w * (dummy.hp / dummy.maxHp), 5);
  }

  let sprite = sprites.stand;
  if (hero.specialAnim > 0) sprite = sprites.bash;
  else if (hero.bashAnim > 0) sprite = sprites.bash;
  else if (hero.attack > 0) sprite = sprites.thrust;
  else if (!hero.ground) sprite = sprites.jump;
  else if (Math.abs(hero.vx) > 0.5) sprite = (Math.floor(hero.walkT / 100) % 2) ? sprites.walk1 : sprites.walk2;
  hero.walkT += 16.667;

  if (hero.dash > 0) drawImageFit(sprite, hero.x - hero.face * 30, hero.y, hero.w, hero.h, hero.face < 0, 0.32);
  drawImageFit(sprite, hero.x, hero.y, hero.w, hero.h, hero.face < 0, 1);

  // 特殊技能用圓形光暈，不使用攻擊長條 Bar。
  if (hero.specialEffect > 0) {
    const p = 1 - hero.specialEffect / 360;
    const radius = 28 + p * 96;
    ctx.save(); ctx.globalAlpha = Math.max(0, 0.65 * (1 - p));
    ctx.strokeStyle = '#ffe7a1'; ctx.lineWidth = 7 - p * 4;
    ctx.shadowColor = '#ffe7a1'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(hero.x + hero.w / 2, hero.y + hero.h / 2, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  $('hit').classList.toggle('show', hitTimer > 0 && combo > 0);
  if (hitTimer > 0 && combo > 0) $('hit').textContent = `${combo} HIT${combo > 1 ? '!' : ''}`;
}

function togglePause() {
  paused = !paused;
  $('pauseButton').setAttribute('aria-label', paused ? '繼續遊戲' : '暫停遊戲');
  $('pauseOverlay').hidden = !paused;
  setStatus(paused ? '已暫停' : '繼續遊戲');
}
function frame(time) {
  const dt = Math.min(34, time - last);
  last = time; update(dt); render(); requestAnimationFrame(frame);
}

window.addEventListener('keydown', event => {
  if (!event.repeat) unlockAudio();
  const prevent = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'];
  if (prevent.includes(event.code)) event.preventDefault();
  if (event.code === 'Escape' && !event.repeat) { togglePause(); return; }
  keys.add(event.code);
  if ((event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') && !event.repeat) jump();
  if (event.code === 'KeyZ' && !event.repeat) { unlockAudio(); thrustAttack(); }
  if (event.code === 'KeyX' && !event.repeat) { unlockAudio(); shieldBash(); }
  if (event.code === 'KeyC' && !event.repeat) { unlockAudio(); specialAttack(); }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

const buttonActions = [
  { act: 'left', key: 'ArrowLeft', hold: true },
  { act: 'jump', hold: false },
  { act: 'right', key: 'ArrowRight', hold: true },
  { act: 'thrust', hold: false },
  { act: 'bash', hold: false },
  { act: 'special', hold: false }
];
for (const info of buttonActions) {
  const button = document.querySelector(`[data-act="${info.act}"]`);
  if (!button) continue;
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); unlockAudio(); button.setPointerCapture?.(event.pointerId);
    if (info.hold) keys.add(info.key);
    if (info.act === 'jump') jump();
    if (info.act === 'thrust') thrustAttack();
    if (info.act === 'bash') shieldBash();
    if (info.act === 'special') specialAttack();
  });
  const release = () => { if (info.hold) keys.delete(info.key); };
  ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(type => button.addEventListener(type, release));
}
$('pauseButton').addEventListener('click', togglePause);
$('musicToggle').addEventListener('click', () => {
  musicEnabled = !musicEnabled;
  $('musicToggle').textContent = musicEnabled ? '🎵 音樂：開' : '🔇 音樂：關';
  if (musicEnabled) { unlockAudio(); startMusic(); }
  else { bgm.pause(); musicStarted = false; }
});

updateHud();
requestAnimationFrame(frame);
})();
