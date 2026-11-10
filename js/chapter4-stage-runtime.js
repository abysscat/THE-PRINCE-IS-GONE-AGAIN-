/* Chapter 4 Stage Test Runtime — consumes Stage Editor project data directly. */
(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const CANVAS_W = 2048, CANVAS_H = 712, VIEW_W = 1600, VIEW_SCALE = CANVAS_W / VIEW_W, VIEW_H = CANVAS_H / VIEW_SCALE;
  // Chapter 1–3 displayed the old 1774x248 background at the same screen-height
  // scale. Keep that exact camera crop size: the new 1774x1774 artwork simply has
  // seven times more vertical world, rather than being shrunk to fit the viewport.
  const LEGACY_BACKGROUND_HEIGHT = 248;
  const WORLD_SCALE = VIEW_H / LEGACY_BACKGROUND_HEIGHT;
  const HERO_H = 146, HERO_W = HERO_H * 512 / 460;
  const $ = id => document.getElementById(id);
  const audioRuntime = window.PrinceAudioRuntime || null;
  const audioPath = (key, fallback) => audioRuntime?.getSfxPath?.(key, fallback) || fallback;
  function playOptionalSfx(key, volume = .38) { const path = audioPath(key, ''); if (path && audioRuntime?.playSfx) audioRuntime.playSfx(key, '', { volume }); }
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const clone = v => JSON.parse(JSON.stringify(v));
  const imageCache = new Map();
  let externalAssetData = {};
  const keys = new Set();

  const sprites = {
    stand: 'images/hero/hero_stand.webp', jump: 'images/hero/hero_jump.webp',
    walk1: 'images/hero/hero_walk_1_right.webp', walk2: 'images/hero/hero_walk_2_right.webp',
    thrust: 'images/hero/hero_thrust.webp', bash: 'images/hero/hero_bash.webp',
    enemy: 'images/chapter1/enemies/1/chapter1_enemy_1_normal.webp'
  };
  const bgm = new Audio('audio/fantasy_rpg_bgm.ogg');
  bgm.loop = true; bgm.volume = .28; bgm.preload = 'auto';
  // Campaign handoff from the Chapter 3 result screen. This transfers the player's
  // remaining HP/MP and music preference without changing the Chapter 1–3 runtime.
  let campaignState = null;
  try { campaignState = JSON.parse(localStorage.getItem('PRINCE_CHAPTER4_CAMPAIGN_STATE') || 'null'); } catch (error) { campaignState = null; }
  const hasCampaignHandoff = new URLSearchParams(window.location.search).get('campaign') === '1' && !!(campaignState && campaignState.completedChapter === 3);
  let campaignHandoffPending = hasCampaignHandoff;
  let hasStartedStage = false;
  const sfx = { thrust: new Audio(audioPath('playerThrust','audio/spear_thrust.ogg')), bash: new Audio(audioPath('playerBash','audio/shield_bash.ogg')) };
  Object.values(sfx).forEach(a => { a.preload = 'auto'; a.volume = audioRuntime?.getSfxVolume?.(.42) ?? .42; });
  // 第四章沿用第一至第三章真正的 Q 絕招：同一組八格大絕圖片及金焰音效。
  const ultimateFrames = [1, 2, 3, 4, 5, 6, 7, 1].map(frame => asset(`images/hero/hero_big_skill/skin/${frame}.webp`));
  const ultimateFrameScales = [1, 1, 2.325, 2.13, 2.025, 1.80, 1.68, 1.00];
  const ultimateChargeAudio = new Audio(audioPath('ultimateCharge','audio/holy_flame_charge.ogg'));
  ultimateChargeAudio.loop = true; ultimateChargeAudio.volume = audioRuntime?.getSfxVolume?.(.22) ?? .22; ultimateChargeAudio.preload = 'auto';
  const ultimateBlastAudio = new Audio(audioPath('ultimateBlast','audio/holy_flame_blast.ogg'));
  ultimateBlastAudio.volume = audioRuntime?.getSfxVolume?.(.40) ?? .40; ultimateBlastAudio.preload = 'auto';
  const ULTIMATE_CHARGE_MS = 800, ULTIMATE_RELEASE_MS = 360, ULTIMATE_COOLDOWN_MS = 12000;
  let ultimateActive = false, ultimateStartedAt = 0, ultimateCooldownUntil = 0, ultimatePoseUntil = 0;
  let ultimateBurstDone = false, ultimateBurstStartedAt = 0, ultimateBurstX = 0, ultimateBurstY = 0;
  const floatingTexts = [];
  function addFloatingText(text, x, y, duration = 950) { floatingTexts.push({ text, x, y, createdAt: performance.now(), duration }); }
  function stopUltimateChargeSound() { ultimateChargeAudio.pause(); ultimateChargeAudio.currentTime = 0; }
  function playUltimateAudio(audio) { if(audioRuntime?.getConfig?.().settings?.sfxEnabled===false)return; try { audio.pause(); audio.currentTime = 0; const promise = audio.play(); if (promise?.catch) promise.catch(() => {}); } catch (_) {} }

  const demoStage = {
    id: 'chapter4_stage1', name: 'Chapter 4 · Stage 1（內建測試地圖）',
    background: 'images/chapter4/bg1_test.webp', backgroundWidth: 1774, backgroundHeight: 1774, worldWidth: 1774, worldWidthManual: false, width: 1774, height: 1774,
    playerStart: { x: 145, y: 1090 },
    platforms: [
      { id: 'demo_P1', label: 'P1', kind: 'fixed', x1: 0, x2: 1774, y: 1090, imageSrc: '', imageHeight: 68, collisionThickness: 12 },
      { id: 'demo_P2', label: 'P2', kind: 'fixed', x1: 0, x2: 520, y: 970, imageSrc: '', imageHeight: 52, collisionThickness: 12 },
      { id: 'demo_P3', label: 'P3', kind: 'fixed', x1: 520, x2: 765, y: 810, imageSrc: '', imageHeight: 52, collisionThickness: 12 },
      { id: 'demo_P4', label: 'P4', kind: 'fixed', x1: 760, x2: 1080, y: 690, imageSrc: '', imageHeight: 52, collisionThickness: 12 },
      { id: 'demo_P5', label: 'P5', kind: 'fixed', x1: 1100, x2: 1360, y: 835, imageSrc: '', imageHeight: 52, collisionThickness: 12 },
      { id: 'demo_P6', label: 'P6', kind: 'moving', x1: 1280, x2: 1774, y: 610, imageSrc: '', imageHeight: 52, collisionThickness: 12, speed: 85, pauseSeconds: .25, loop: { from: { x: 1527, y: 610 }, to: { x: 1120, y: 500 } } },
      { id: 'demo_P7', label: 'P7', kind: 'fixed', x1: 0, x2: 420, y: 600, imageSrc: '', imageHeight: 52, collisionThickness: 12 },
      { id: 'demo_P8', label: 'P8', kind: 'fixed', x1: 570, x2: 820, y: 440, imageSrc: '', imageHeight: 52, collisionThickness: 12 },
      { id: 'demo_P9', label: 'P9', kind: 'fixed', x1: 850, x2: 1200, y: 300, imageSrc: '', imageHeight: 52, collisionThickness: 12 },
      { id: 'demo_P10', label: 'P10', kind: 'fixed', x1: 1280, x2: 1774, y: 160, imageSrc: '', imageHeight: 52, collisionThickness: 12 }
    ], enemies: [{ id:'demo_enemy_1', label:'E1', type:'chapter4_enemy_1', x:260, y:970, width:100, height:100, size:100, platformId:'demo_P2', patrol:{ points:[{u:.12},{u:.82}], speed:70, pauseSeconds:.5, mode:'pingpong' }, ai:{ alertRange:430, attackRange:230, attackCooldownMs:1450, damage:1, attackPoseMs:420 } }], exits: [], transitions: []
  };
  const exportedStageProject = window.PRINCE_STAGE_CONFIG && Array.isArray(window.PRINCE_STAGE_CONFIG.stages) && window.PRINCE_STAGE_CONFIG.stages.length
    ? clone(window.PRINCE_STAGE_CONFIG) : null;
  if (exportedStageProject?.assetLibrary) {
    for (const item of exportedStageProject.assetLibrary) if (item?.path && item?.dataUrl) externalAssetData[item.path] = item.dataUrl;
  }
  let project = exportedStageProject || { schemaVersion: 1, currentStageId: demoStage.id, stages: [clone(demoStage)] };
  let stage = null, worldW = 1774, worldH = 1158, bg = null, currentStageId = demoStage.id;
  let platformPoses = new Map(), motionTime = 0;
  let cameraX = 0, cameraY = 0, lastTime = performance.now();
  let paused = false, musicEnabled = (hasCampaignHandoff ? campaignState.musicEnabled !== false : true) && audioRuntime?.getConfig?.().settings?.musicEnabled !== false, musicStarted = false;
  let jumpBuffer = 0, coyote = 0, attackCooldown = 0, bashCooldown = 0, specialCooldown = 0;
  let hitTimer = 0, combo = 0, walkTime = 0, transitionElapsed = 0, pendingTransition = null, transitionApplied = false, fallResetCooldown = 0;
  let sourceMode = exportedStageProject ? 'js' : 'demo';
  let hero = makeHero();
  let enemies = [];
  let enemyTotal = 0;
  let enemyProjectiles = [];
  let enemyGroundAttacks = [];
  let enemyImpactParticles = [];
  let stageStartedAt = performance.now();
  let waveRuntime = new Map();
  let activeCheckpoint = null;
  let sceneObjectCooldowns = new Map();
  let sceneObjectActiveFrom = new Map();
  let sceneObjectActiveUntil = new Map();
  let activatedCheckpoints = new Set();
  let checkpointTouching = new Set();

  // Chapter 4 normal enemies now use the same hit feedback and body-spacing
  // rules as Chapter 1–3. These values mirror GAME_TUNING.enemyHitStun.
  const CH4_ENEMY_HIT_COMBO_GAP_MS = 1100;
  const CH4_ENEMY_HIT_STUN_MS = 260;
  const CH4_ENEMY_HIT_POSE_MS = 300;
  const CH4_ENEMY_HIT_FLASH_TIMER_MS = 180;

  function chapter4EnemyKeepOutGap(enemy) {
    // Equivalent to game.js getHeroEnemyKeepOutGap(), converted to Canvas units.
    return Math.max(62 * VIEW_SCALE, hero.w * .24 + enemy.w * .22 + 14 * VIEW_SCALE);
  }

  function keepChapter4HeroAndEnemyApart(enemy, minX, maxX) {
    if (!enemy || enemy.hp <= 0 || enemy.isBoss || !enemyOnSamePlatform(enemy)
        || hero.dash > 0 || performance.now() < hero.knockbackUntil) return;
    const verticalGap = Math.abs((hero.y + hero.h / 2) - (enemy.y + enemy.h / 2));
    if (verticalGap > Math.max(hero.h, enemy.h) * .55) return;
    const heroCenter = hero.x + hero.w / 2;
    const delta = enemy.x - heroCenter;
    const direction = Math.sign(delta) || hero.face || 1;
    const gap = chapter4EnemyKeepOutGap(enemy);
    if (Math.abs(delta) >= gap) return;

    // As in Chapters 1–3: stop the player when moving into an enemy; otherwise
    // let the approaching enemy yield back to the same safe center-to-center gap.
    if (Math.abs(hero.vx) > .05 && hero.vx * direction > 0) {
      const safeHeroCenter = enemy.x - direction * gap;
      hero.x = clamp(safeHeroCenter - hero.w / 2, 0, Math.max(0, worldW - hero.w));
      hero.vx = 0;
      return;
    }

    const nextEnemyX = clamp(heroCenter + direction * gap, minX, maxX);
    if (Math.abs(nextEnemyX - heroCenter) < gap - 1) {
      const safeHeroCenter = nextEnemyX - direction * gap;
      hero.x = clamp(safeHeroCenter - hero.w / 2, 0, Math.max(0, worldW - hero.w));
      hero.vx = 0;
    }
    enemy.x = nextEnemyX;
    enemy.y = enemySurfaceAt(enemy, platformPoses.get(enemy.platformId) || platformPose((stage?.platforms || []).find(p => p.id === enemy.platformId), motionTime)) - enemy.h;
  }

  function applyChapter4EnemyHitFeedback(enemy, now, kind = 'thrust') {
    if (!enemy || enemy.hp <= 0) return;
    enemy.hitPoseDuration = kind === 'ultimate' ? 360 : CH4_ENEMY_HIT_POSE_MS;
    enemy.hitUntil = now + enemy.hitPoseDuration;
    enemy.flash = CH4_ENEMY_HIT_FLASH_TIMER_MS;
    enemy.actionUntil = 0;
    enemy.pose = 'hit';
    enemy.isWalking = false;

    // Match Chapter 1–3 hit displacement: thrust 5%, bash 8%, special 11%,
    // and Goddess ultimate 3.5% of the visible stage width.
    const ratio = kind === 'bash' ? .08 : kind === 'special' ? .11 : kind === 'ultimate' ? .035 : .05;
    const direction = Math.sign(enemy.x - (hero.x + hero.w / 2)) || hero.face || 1;
    const pose = platformPoses.get(enemy.platformId) || platformPose((stage?.platforms || []).find(p => p.id === enemy.platformId), motionTime);
    const bounds = enemyPlatformBounds(enemy, pose);
    enemy.x = clamp(enemy.x + direction * VIEW_W * ratio * VIEW_SCALE, bounds.min, bounds.max);

    // The main game pauses an ordinary enemy's chase/attack on every second hit
    // inside an 1100ms combo window. The hit pose/flash/knockback still happen
    // on every hit, independently of this short AI stun.
    if (now - (Number(enemy.hitComboLastAt) || 0) > CH4_ENEMY_HIT_COMBO_GAP_MS) enemy.hitComboCount = 0;
    enemy.hitComboLastAt = now;
    enemy.hitComboCount = (Number(enemy.hitComboCount) || 0) + 1;
    if (enemy.hitComboCount % 2 === 0) {
      enemy.hitStunUntil = now + CH4_ENEMY_HIT_STUN_MS;
      enemy.lastAttack = now;
      enemy.actionUntil = enemy.hitStunUntil;
    }
  }

  function makeHero() {
    return { x: 145, y: 1090 - HERO_H, vx: 0, vy: 0, w: HERO_W, h: HERO_H,
      ground: false, platformId: null, face: 1, dash: 0, dashCooldown: 0, airDashUsed: false, airDashHitDone: false,
      attack: 0, bashAnim: 0, specialAnim: 0, specialEffect: 0,
      hp: 100, mp: 65, gems: 3, invuln: 0,
      // 受敵人攻擊時：閃爍兩次、向攻擊者反方向擊退，短暫鎖定操作。
      hitFlashStartedAt: 0, hitFlashUntil: 0, inputLockUntil: 0, knockbackUntil: 0 };
  }
  function asset(src) {
    if (!src) return null;
    if (imageCache.has(src)) return imageCache.get(src);
    const img = new Image(); imageCache.set(src, img);
    if (String(src).startsWith('asset://')) {
      const bridge = window.PrinceEnemyRegistryV2;
      if (bridge?.resolveSource) {
        bridge.resolveSource(src).then(url => { if (url && !img.src) img.src = url; else if (url) img.src = url; })
          .catch(error => { img.dataset.assetError = error?.message || 'Enemy asset unavailable'; console.error(`Chapter 4 enemy image load failed: ${src}`, error); });
      } else {
        img.dataset.assetError = 'Enemy Registry V2 bridge is not loaded';
        console.error(`Chapter 4 enemy image cannot load without Registry bridge: ${src}`);
      }
    } else {
      img.src = externalAssetData[src] || src;
    }
    return img;
  }
  function setStatus(message) { const el = $('status'); if (el) el.textContent = message; const stageStatus = $('stageStatus'); if (stageStatus) stageStatus.textContent = message; }
  function playAudio(audio) { if(audioRuntime?.getConfig?.().settings?.sfxEnabled===false)return; try { audio.pause(); audio.currentTime = 0; const p = audio.play(); if (p?.catch) p.catch(() => {}); } catch (_) {} }
  function startMusic() { if (!musicEnabled) return; const row=audioRuntime?.applyMusic?.(bgm,{chapter:4,stageId:currentStageId,stageMusic:stage?.music||'',loop:stage?.musicLoop!==false},'audio/fantasy_rpg_bgm.ogg',stage?.musicVolume??.28); if(!audioRuntime){bgm.volume=.28;if(stage?.music&&bgm.src!==new URL(stage.music,document.baseURI).href){bgm.src=stage.music;bgm.load();}} try { const p = bgm.play(); if (p?.then) p.then(() => { musicStarted = true; }).catch(() => {}); } catch (_) {} }
  function unlockAudio() { if (musicEnabled && !musicStarted) startMusic(); }
  function stageById(id) { return project.stages.find(s => s.id === id) || null; }
  const ENEMY_TYPES = Object.fromEntries(Array.from({length:11},(_,index)=>{const id=`chapter4_enemy_${index+1}`;return [id,{root:`images/chapter4/enemies/${id}/${id}_`,projectile:`images/chapter4/enemies/${id}/${id}_projectile.webp`}];}));
  function enemyRegistryRecord(type) {
    return window.PrinceEnemyRegistryV2?.get?.(type)
      || window.PRINCE_ENEMY_REGISTRY?.enemies?.find?.(record => record.id === type)
      || window.PRINCE_ENEMY_REGISTRY_SEED?.find?.(record => record.id === type)
      || window.PRINCE_BOSS_CONFIG?.bosses?.find?.(record => record.id === type)
      || null;
  }
  function resolveEnemyProjectilePath(source,type,typeDef,registryRecord) {
    const configured=String(source.projectilePath||'').trim();
    const exactProjectile=registryRecord?.animations?.projectile?.frames?.[0]?.path
      || registryRecord?.animations?.projectile?.frames?.[0]?.src
      || '';
    const normalFrame=registryRecord?.animations?.normal?.frames?.[0]?.path
      || registryRecord?.animations?.normal?.frames?.[0]?.src
      || '';
    const normalLegacy=`${source.spriteRoot||typeDef.root||''}normal.webp`;
    // Repair Stage configs previously exported while Registry's generic pose
    // fallback incorrectly returned normal.webp for a missing projectile action.
    if(configured && (configured===normalFrame || configured===normalLegacy)) {
      return exactProjectile || typeDef.projectile || '';
    }
    return configured || exactProjectile || typeDef.projectile || '';
  }
  function syncRegisteredEnemyTypes() {
    const rows=[...(window.PrinceEnemyRegistryV2?.list?.() || window.PRINCE_ENEMY_REGISTRY?.enemies || []),...(window.PRINCE_BOSS_CONFIG?.bosses||[])];
    rows.forEach(record => {
      if(!record?.id || !/^chapter4_(?:enemy|boss)_\d+$/.test(record.id)) return;
      const old=ENEMY_TYPES[record.id] || {};
      ENEMY_TYPES[record.id]={
        root:old.root || `images/enemies_v2/${record.id}/`,
        projectile:record.animations?.projectile?.frames?.[0]?.path || old.projectile || '',
        registry:true
      };
    });
  }
  syncRegisteredEnemyTypes();
  function registrySpritePath(type, pose='normal', timeMs) {
    const bridge=window.PrinceEnemyRegistryV2;
    const frame=String(pose).startsWith('walk') ? bridge?.frameFor?.(type,'walk',timeMs) : (bridge?.frameForExact?.(type,pose,timeMs)||bridge?.frameFor?.(type,pose,timeMs));
    return frame?.path || frame?.src || null;
  }
  function enemySpritePath(typeOrEnemy, pose='normal', timeMs) {
    const type=typeof typeOrEnemy==='string'?typeOrEnemy:typeOrEnemy?.type;
    // Registry frames are full file paths (including asset:// IDs); never append a pose suffix to them.
    const registered=registrySpritePath(type,pose,timeMs);
    if(registered)return registered;
    const def=ENEMY_TYPES[type]||ENEMY_TYPES.chapter4_enemy_1;
    const spriteRoot=typeof typeOrEnemy==='object'?(typeOrEnemy.spriteRoot||def.root):def.root;
    return `${spriteRoot}${pose}.webp`;
  }
  function enemySurfaceAt(enemy, pose) {
    const platform=(stage?.platforms||[]).find(p=>p.id===enemy.platformId);
    if(!platform)return Number(enemy.y||0)*WORLD_SCALE;
    const segment=getStandSegment(platform,pose||platformPoses.get(platform.id)||platformPose(platform,motionTime));
    const minX=Math.min(segment[0].x,segment[1].x),maxX=Math.max(segment[0].x,segment[1].x);
    return lineYAtX(segment,clamp(enemy.x,minX,maxX));
  }
  function enemyPlatformBounds(enemy,pose) {
    const platform=(stage?.platforms||[]).find(p=>p.id===enemy.platformId);
    if(!platform)return {min:0,max:worldW};
    const seg=getStandSegment(platform,pose||platformPoses.get(platform.id)||platformPose(platform,motionTime));
    const margin=Math.max(10,enemy.w*.35);
    return {min:Math.min(seg[0].x,seg[1].x)+margin,max:Math.max(Math.min(seg[0].x,seg[1].x)+margin,Math.max(seg[0].x,seg[1].x)-margin)};
  }

  function platformPose(p, timeMs) {
    let dx = 0, dy = 0;
    if (p.kind === 'moving' && p.loop?.from && p.loop?.to) {
      const ax = Number(p.loop.from.x) * WORLD_SCALE, ay = Number(p.loop.from.y) * WORLD_SCALE;
      const bx = Number(p.loop.to.x) * WORLD_SCALE, by = Number(p.loop.to.y) * WORLD_SCALE;
      const dist = Math.hypot(bx - ax, by - ay);
      if (dist > 1) {
        const speed = Math.max(1, Number(p.speed || 80) * WORLD_SCALE), pause = Math.max(0, Number(p.pauseSeconds) || 0);
        const oneWay = dist / speed, cycle = Math.max(.001, oneWay * 2 + pause * 2), t = (timeMs / 1000) % cycle;
        let ratio;
        if (t < oneWay) ratio = t / oneWay;
        else if (t < oneWay + pause) ratio = 1;
        else if (t < oneWay * 2 + pause) ratio = 1 - (t - oneWay - pause) / oneWay;
        else ratio = 0;
        dx = (bx - ax) * ratio; dy = (by - ay) * ratio;
      }
    }
    return { x1: Number(p.x1) * WORLD_SCALE + dx, x2: Number(p.x2) * WORLD_SCALE + dx, y: Number(p.y) * WORLD_SCALE + dy, dx, dy };
  }
  function computePoses(timeMs) {
    const map = new Map();
    (stage?.platforms || []).forEach(p => map.set(p.id, platformPose(p, timeMs)));
    return map;
  }
  function platformVisualMetrics(p,pose) {
    const image=p.imageSrc?asset(p.imageSrc):null,span=Math.max(20,pose.x2-pose.x1);
    const width=image?.complete&&image.naturalWidth?span*clamp(Number(p.imageScale??100),10,300)/100:span;
    const height=image?.complete&&image.naturalWidth&&image.naturalHeight?width*image.naturalHeight/image.naturalWidth:Math.max(20,Number(p.imageHeight)||52)*WORLD_SCALE;
    return {cx:(pose.x1+pose.x2)/2+Number(p.imageOffsetX||0)*WORLD_SCALE,cy:pose.y+Number(p.imageOffsetY||0)*WORLD_SCALE+height/2,width,height,rotation:(Number(p.imageRotation)||0)*Math.PI/180};
  }
  function imagePointToWorld(point,m) {
    const lx=(point.x-.5)*m.width,ly=(point.y-.5)*m.height,c=Math.cos(m.rotation),sn=Math.sin(m.rotation);
    return {x:m.cx+c*lx-sn*ly,y:m.cy+sn*lx+c*ly};
  }
  function getStandSegment(p,pose) {
    if(!p.standLine)return [{x:pose.x1,y:pose.y},{x:pose.x2,y:pose.y}];
    const m=platformVisualMetrics(p,pose);
    return [imagePointToWorld({x:p.standLine.x1,y:p.standLine.y1},m),imagePointToWorld({x:p.standLine.x2,y:p.standLine.y2},m)];
  }
  function lineYAtX(segment,x) {
    const [a,b]=segment,dx=b.x-a.x;
    if(Math.abs(dx)<.001)return (a.y+b.y)/2;
    const t=clamp((x-a.x)/dx,0,1);return a.y+(b.y-a.y)*t;
  }
  // Match the original Chapter 1–3 background scale. The old 1774x248 art was
  // enlarged to the fixed camera height. Keep that exact pixel-to-camera scale
  // for the new square image: its width keeps the old horizontal travel distance,
  // while its extra image height creates vertical platforming space.
  function prepareSideScrollStage(sourceStage) {
    const prepared = clone(sourceStage);
    const backgroundWidth = Math.max(1, Number(prepared.backgroundWidth) || Number(prepared.width) || 1774);
    const backgroundHeight = Math.max(1, Number(prepared.backgroundHeight) || Number(prepared.height) || 1774);
    const authoredWidth = Math.max(1, Number(prepared.worldWidth) || Number(prepared.width) || backgroundWidth);
    const manualWorldWidth = prepared.worldWidthManual === true;
    const worldWidthSource = manualWorldWidth ? Math.max(backgroundWidth, authoredWidth) : backgroundWidth;
    const worldWidth = worldWidthSource * WORLD_SCALE;
    const worldHeight = backgroundHeight * WORLD_SCALE;
    prepared.worldWidthManual = manualWorldWidth;
    prepared.backgroundWidth = backgroundWidth;
    prepared.backgroundHeight = backgroundHeight;
    prepared.sourceWorldWidth = worldWidthSource;
    prepared.worldWidth = Math.round(worldWidth);
    prepared.width = prepared.worldWidth;
    prepared.height = Math.round(worldHeight);
    prepared.runtimeWorldScale = WORLD_SCALE;
    return { stage: prepared, worldWidth: worldWidth, worldHeight: worldHeight };
  }
  function drawWorldBackground(image) {
    if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return;
    // Draw the single tall image at the same scale as the old short BG. The
    // fixed camera crops a window from it; there is no fit-to-screen or tiling.
    ctx.drawImage(image, 0, 0, image.naturalWidth * WORLD_SCALE, image.naturalHeight * WORLD_SCALE);
  }
  function runtimeAIConfig(id){return window.PRINCE_ENEMY_AI_CONFIG?.enemies?.find?.(item=>item.id===id)||null;}
  function runtimeBossConfig(record, source={}) {
    return source.bossConfig || record?.bossConfig || window.PRINCE_BOSS_CONFIG?.bosses?.find?.(b=>b.id===record?.id)?.bossConfig || null;
  }
  function buildRuntimeEnemy(source,index=0) {
    const requestedType=String(source.type||'chapter4_enemy_1');
    const registryRecord=enemyRegistryRecord(requestedType);
    if (/^chapter[56]_(?:enemy|boss)_\d+$/.test(requestedType)) {
      setStatus(`${requestedType} 尚未有 Chapter 5／6 正式 Runtime；此版本只接通 Chapter 4 自訂敵人。`);
      return null;
    }
    const type=(ENEMY_TYPES[requestedType] || registryRecord)?requestedType:'chapter4_enemy_1';
    const record=enemyRegistryRecord(type);
    const exportedAI=runtimeAIConfig(type)||{};
    const typeDef=ENEMY_TYPES[type]||ENEMY_TYPES.chapter4_enemy_1;
    const bossConfig=runtimeBossConfig(record,source);
    const isBoss=source.isBoss===true||source.isBoss===1||source.boss===true||source.boss===1||source.boss==='1'||source.category==='boss'||source.enemyType==='boss'||record?.type==='boss'||/boss/i.test(type);
    let platformId=source.platformId||'';
    let platform=(stage.platforms||[]).find(p=>p.id===platformId);
    if(!platform&&stage.platforms?.length){platform=stage.platforms.find(p=>p.label==='P2')||stage.platforms[1]||stage.platforms[0];platformId=platform.id;}
    const normalSize=Math.max(40,Number(source.width||source.size||bossConfig?.size||record?.normalSize||100));
    const w=normalSize*WORLD_SCALE,h=Math.max(40,Number(source.height||source.size||bossConfig?.size||record?.normalSize||100))*WORLD_SCALE;
    const maxHp=Math.max(1,Number(source.maxHp ?? source.maxHP ?? source.hp ?? bossConfig?.maxHp ?? record?.hp ?? 3)||3);
    const currentHp=clamp(Number(source.hp ?? maxHp)||maxHp,0,maxHp);
    const resolvedSpriteRoot=(!source.spriteRoot||(type!=='chapter4_enemy_1'&&source.spriteRoot==='images/chapter4/enemies/chapter4_enemy_1/chapter4_enemy_1_'))?typeDef.root:source.spriteRoot;
    const aiSource=source.ai||{};
    const attackModeRaw=aiSource.attackMode ?? bossConfig?.attackMode ?? exportedAI.attackMode ?? record?.attackMode;
    const storedAIType=aiSource.aiType||exportedAI.aiType||record?.aiType||(isBoss?'boss':'legacy-runtime');
    const aiType=(storedAIType==='not-connected'||storedAIType==='custom')?(record?.legacy?'legacy-runtime':'chase'):storedAIType;
    const enemy={id:source.id||`enemy_${index+1}`,label:source.label||record?.name||`E${index+1}`,displayName:bossConfig?.healthBarLabel||source.displayName||source.label||record?.name||`E${index+1}`,
      type,spriteRoot:resolvedSpriteRoot,projectilePath:resolveEnemyProjectilePath({...source,spriteRoot:resolvedSpriteRoot},type,typeDef,record),registryRecordId:record?.id||null,
      x:Number(source.x??80)*WORLD_SCALE,y:Number(source.y??0)*WORLD_SCALE,w,h,platformId,
      isBoss,hp:currentHp,maxHp,flash:0,hitUntil:0,hitPoseDuration:CH4_ENEMY_HIT_POSE_MS,hitStunUntil:0,hitComboCount:0,hitComboLastAt:0,actionUntil:0,lastAttack:0,deathAt:null,pose:'normal',facing:source.facing||'left',
      bossConfig:bossConfig?clone(bossConfig):null,phaseIndex:-1,phaseConfig:null,spawnedAt:performance.now(),phaseStartedAt:0,introStartedAt:0,introUntil:0,deathDurationMs:Math.max(500,Number(bossConfig?.deathDurationMs)||2450),
      patrol:{points:Array.isArray(source.patrol?.points)?clone(source.patrol.points):[],speed:Math.max(1,Number(source.patrol?.speed ?? record?.movementSpeed)||70)*WORLD_SCALE,pauseSeconds:Math.max(0,Number(source.patrol?.pauseSeconds??.5)),mode:source.patrol?.mode||'pingpong'},
      ai:{aiType,attackMode:[1,2,3].includes(Number(attackModeRaw))?Number(attackModeRaw):null,
        alertRange:Math.max(50,Number(aiSource.alertRange ?? exportedAI.detectionRange ?? record?.detectionRange ?? bossConfig?.detectionRange)||430)*WORLD_SCALE,
        attackRange:Math.max(30,Number(aiSource.attackRange ?? exportedAI.attackRange ?? bossConfig?.attackRange ?? record?.attackRange)||230)*WORLD_SCALE,
        attackCooldownMs:Math.max(100,Number(aiSource.attackCooldownMs ?? exportedAI.attackCooldownMs ?? bossConfig?.cooldownMs)||1450),
        damage:Math.max(0,Number(aiSource.damage ?? exportedAI.damage ?? bossConfig?.damage ?? record?.attackDamage)||1),
        attackPoseMs:Math.max(100,Number(aiSource.attackPoseMs)||430),
        movementSpeed:Math.max(1,Number(aiSource.movementSpeed ?? exportedAI.movementSpeed ?? bossConfig?.movementSpeed ?? record?.movementSpeed)||150)*WORLD_SCALE,
        keepDistance:Math.max(30,Number(aiSource.keepDistance ?? exportedAI.keepDistance ?? bossConfig?.attackRange ?? record?.attackRange)||190)*WORLD_SCALE},
      routeIndex:0,routeDir:1,routePause:0,patrolMin:0,patrolMax:0,lastPlatformX1:null,initialX:Number(source.x??80)*WORLD_SCALE,waveId:source.waveId||null};
    if(bossConfig?.introMs>0){enemy.introStartedAt=performance.now();enemy.introUntil=enemy.introStartedAt+Number(bossConfig.introMs);enemy.pose=bossConfig.introAction||'intro';if(bossConfig.introSfx)playOptionalSfx(bossConfig.introSfx,.55);}
    if(platform){const pose=platformPose(platform,0),bounds=enemyPlatformBounds(enemy,pose);enemy.patrolMin=bounds.min;enemy.patrolMax=bounds.max;enemy.x=clamp(enemy.x,bounds.min,bounds.max);enemy.y=enemySurfaceAt(enemy,pose)-enemy.h;enemy.lastPlatformX1=pose.x1;}
    return enemy;
  }
  function stageRectOverlap(object){
    const x=Number(object.x||0)*WORLD_SCALE,y=Number(object.y||0)*WORLD_SCALE,w=Math.max(1,Number(object.width||70))*WORLD_SCALE,h=Math.max(1,Number(object.height||70))*WORLD_SCALE;
    return hero.x<x+w/2&&hero.x+hero.w>x-w/2&&hero.y<y+h/2&&hero.y+hero.h>y-h/2;
  }
  function drawStageObjects(now){
    const groups=[['checkpoints','checkpoint'],['hazards','hazard'],['traps','trap'],['teleports','teleport']];
    for(const [key,type] of groups){
      for(const o of stage?.[key]||[]){
        if(o.enabled===false)continue;
        const x=Number(o.x||0)*WORLD_SCALE,y=Number(o.y||0)*WORLD_SCALE;
        const w=Math.max(1,Number(o.width||70))*WORLD_SCALE,h=Math.max(1,Number(o.height||70))*WORLD_SCALE;
        ctx.save();
        const pulse=.72+.28*Math.sin(now/180);ctx.globalAlpha=.9;
        if(type==='checkpoint'){
          ctx.fillStyle=activatedCheckpoints.has(o.id)?'#70ffb0':'#39d98a';ctx.strokeStyle='#eafff4';ctx.shadowColor='#39d98a';ctx.shadowBlur=14*WORLD_SCALE;
          ctx.fillRect(x-w/2,y-h/2,w,h);ctx.strokeRect(x-w/2,y-h/2,w,h);
          ctx.fillStyle='#082d20';ctx.font=`bold ${16*WORLD_SCALE}px sans-serif`;ctx.textAlign='center';ctx.fillText('CP',x,y+5*WORLD_SCALE);
        } else if(type==='hazard'){
          // Hazard collision remains active, but its damage hitbox/range is never drawn in gameplay.
          // The four decorative frames loop independently from the collision and damage settings.
          const frames=(Array.isArray(o.imageFrames)&&o.imageFrames.length?o.imageFrames:(o.imageSrc?[o.imageSrc]:[])).filter(Boolean);
          const frameMs=clamp(Number(o.animationFrameMs??120),50,1000);
          const framePath=frames.length>1?frames[Math.floor(now/frameMs)%frames.length]:frames[0];
          const image=framePath?asset(framePath):null;
          if(image?.complete&&image.naturalWidth&&image.naturalHeight){
            const drawW=Math.max(1,Number(o.width||120))*WORLD_SCALE*clamp(Number(o.imageScale??100),10,300)/100;
            const drawH=drawW*image.naturalHeight/image.naturalWidth;
            ctx.globalAlpha=clamp(Number(o.imageOpacity??100),0,100)/100;
            ctx.translate(x+Number(o.imageOffsetX||0)*WORLD_SCALE,y+Number(o.imageOffsetY||0)*WORLD_SCALE);
            ctx.rotate((Number(o.imageRotation)||0)*Math.PI/180);
            ctx.drawImage(image,-drawW/2,-drawH/2,drawW,drawH);
          }
        } else if(type==='trap'){
          const startsAt=sceneObjectActiveFrom.has(o.id)?sceneObjectActiveFrom.get(o.id):Infinity;
          const active=now>=startsAt&&(sceneObjectActiveUntil.get(o.id)||0)>=now;
          ctx.fillStyle=o.kind==='fire'?'#ff6b25':o.kind==='electric'?'#ffe04d':'#d99a36';
          ctx.strokeStyle=active?'#ffffff':'#fff1d2';ctx.lineWidth=(active?4:2)*WORLD_SCALE;ctx.globalAlpha=active?1:pulse;
          ctx.fillRect(x-w/2,y-h/2,w,h);ctx.strokeRect(x-w/2,y-h/2,w,h);
          ctx.fillStyle='#fff';ctx.font=`bold ${12*WORLD_SCALE}px sans-serif`;ctx.textAlign='center';ctx.fillText(active?'ACTIVE':'TRAP',x,y+4*WORLD_SCALE);
        } else {
          ctx.strokeStyle='#6beaff';ctx.fillStyle='rgba(36,190,255,.20)';ctx.lineWidth=4*WORLD_SCALE;ctx.shadowColor='#28dfff';ctx.shadowBlur=20*WORLD_SCALE;
          ctx.beginPath();ctx.ellipse(x,y,w*.42,h*.42,0,0,Math.PI*2);ctx.fill();ctx.stroke();
          ctx.beginPath();ctx.ellipse(x,y,w*.22,h*.22,0,0,Math.PI*2);ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  function updateStageObjects(now){
    for(const cp of stage?.checkpoints||[]){
      const overlapping=cp.enabled!==false&&stageRectOverlap(cp);
      if(!overlapping){checkpointTouching.delete(cp.id);continue;}
      if(checkpointTouching.has(cp.id))continue;
      checkpointTouching.add(cp.id);
      const used=activatedCheckpoints.has(cp.id);if(cp.once&&used)continue;
      activeCheckpoint={x:Number(cp.x),y:Number(cp.y)+Math.max(0,Number(cp.height)||72)/2,facing:cp.facing||'right',id:cp.id};
      activatedCheckpoints.add(cp.id);
      const heal=clamp(Number(cp.healPercent)||0,0,100);if(heal>0)hero.hp=Math.min(100,hero.hp+heal);
      setStatus(`已啟用 ${cp.label||'Checkpoint'}；重生點已更新。`);updateHud();
    }
    for(const o of stage?.hazards||[]){if(o.enabled===false||!stageRectOverlap(o))continue;const cooldown=Math.max(100,Number(o.cooldownMs)||850),next=sceneObjectCooldowns.get(o.id)||0;if(now<next)continue;sceneObjectCooldowns.set(o.id,now+cooldown);takeEnemyDamage(Math.max(0,Number(o.damage)||1),o.label||'危險區域',Number(o.x)*WORLD_SCALE);}
    for(const trap of stage?.traps||[]){
      if(trap.enabled===false||!stageRectOverlap(trap)||(trap.trigger&&trap.trigger!=='touch'))continue;
      let activeFrom=sceneObjectActiveFrom.get(trap.id),activeUntil=sceneObjectActiveUntil.get(trap.id);
      // Touching a trap arms its active window once. The delay is a real warning
      // period; damage is only applied while the active window is live.
      if(activeFrom===undefined||now>=(activeUntil||0)){ 
        const delay=Math.max(0,Number(trap.activationDelayMs)||0);
        activeFrom=now+delay;
        activeUntil=activeFrom+Math.max(100,Number(trap.activeDurationMs)||900);
        sceneObjectActiveFrom.set(trap.id,activeFrom);
        sceneObjectActiveUntil.set(trap.id,activeUntil);
      }
      if(now<activeFrom||now>activeUntil)continue;
      const cooldown=Math.max(100,Number(trap.cooldownMs)||900),next=sceneObjectCooldowns.get(trap.id)||0;
      if(now<next)continue;
      sceneObjectCooldowns.set(trap.id,now+cooldown);
      takeEnemyDamage(Math.max(0,Number(trap.damage)||1),trap.label||'陷阱',Number(trap.x)*WORLD_SCALE);
    }
    for(const tp of stage?.teleports||[]){if(tp.enabled===false||!stageRectOverlap(tp)||now<(sceneObjectCooldowns.get(tp.id)||0))continue;sceneObjectCooldowns.set(tp.id,now+Math.max(250,Number(tp.cooldownMs)||1000));const x=Number(tp.destinationX??tp.x)*WORLD_SCALE,y=Number(tp.destinationY??tp.y)*WORLD_SCALE,face=tp.facing==='left'?-1:1;
      if(tp.destinationStageId&&tp.destinationStageId!==currentStageId&&stageById(tp.destinationStageId)){pendingTransition={stageId:tp.destinationStageId,transitionId:tp.destinationTransitionId||'',teleport:{x,y,face}};transitionElapsed=1;transitionApplied=false;setStatus(`傳送至 ${tp.destinationStageId}……`);return;}
      hero.x=clamp(x-hero.w/2,0,Math.max(0,worldW-hero.w));hero.y=y-hero.h;hero.vx=0;hero.vy=0;hero.ground=false;hero.platformId=null;hero.face=face;setStatus(`${tp.label||'傳送點'} 已啟動。`);
    }
  }
  function spawnWaveEnemy(wave,entry,spawnIndex){
    const id=String(entry.enemyId||entry.type||'chapter4_enemy_1');
    if(!/^chapter4_(?:enemy|boss)_\d+$/.test(id)){setStatus(`Wave ${wave.label||wave.id} 使用的 ${id} 尚未支援 Chapter 4 Runtime。`);return false;}
    const record=enemyRegistryRecord(id);if(!record&&!ENEMY_TYPES[id]){setStatus(`Wave 找不到 Enemy Registry：${id}`);return false;}
    const source={id:`${wave.id}_${id}_${spawnIndex+1}`,label:record?.name||id,type:id,x:Number(entry.x??300)+spawnIndex*Number(entry.spacing??55),y:Number(entry.y??900),width:record?.normalSize||100,height:record?.normalSize||100,platformId:entry.platformId||'',waveId:wave.id,ai:{aiType:record?.aiType||((record?.type==='boss')?'boss':'chase'),attackMode:record?.attackMode,alertRange:record?.detectionRange,attackRange:record?.attackRange,damage:record?.attackDamage,movementSpeed:record?.movementSpeed}};
    const enemy=buildRuntimeEnemy(source,enemies.length);if(!enemy)return false;enemies.push(enemy);enemyTotal++;updateHud();return true;
  }
  function updateWaves(now){
    const waves=stage?.waves||[];if(!waves.length)return;
    waves.forEach((wave,index)=>{
      let state=waveRuntime.get(wave.id);if(!state){state={status:'pending',entryIndex:0,spawnedInEntry:0,totalSpawned:0,lastSpawnAt:0,failed:false};waveRuntime.set(wave.id,state);}
      if(wave.enabled===false||state.status==='cleared'||state.status==='failed')return;
      const trigger=wave.trigger||{type:'stageStart'};let triggered=false;
      if(trigger.type==='stageStart')triggered=true;
      else if(trigger.type==='delay')triggered=now-stageStartedAt>=Math.max(0,Number(trigger.delayMs)||0);
      else if(trigger.type==='playerEnter'){const pseudo={x:Number(trigger.x??180),y:Number(trigger.y??180),width:Number(trigger.width??260),height:Number(trigger.height??220)};triggered=stageRectOverlap(pseudo);}
      else if(trigger.type==='previousWaveCleared')triggered=index===0||waves.slice(0,index).every(prev=>{const st=waveRuntime.get(prev.id);return prev.enabled===false||st?.status==='cleared';});
      if(state.status==='pending'&&triggered){state.status='spawning';state.lastSpawnAt=0;setStatus(`${wave.label||wave.id} 開始！`);}
      if(state.status==='spawning'&&now-state.lastSpawnAt>=Math.max(0,Number(wave.spawnIntervalMs)||650)){
        const entries=wave.entries||[];if(state.entryIndex>=entries.length){state.status='waiting-clear';}
        else {const entry=entries[state.entryIndex],count=Math.max(1,Math.floor(Number(entry.count)||1));if(spawnWaveEnemy(wave,entry,state.spawnedInEntry)){state.spawnedInEntry++;state.totalSpawned++;state.lastSpawnAt=now;if(state.spawnedInEntry>=count){state.entryIndex++;state.spawnedInEntry=0;}}else{state.failed=true;state.status='failed';}}
      }
      if(state.status==='spawning'&&state.entryIndex>=(wave.entries||[]).length)state.status='waiting-clear';
      if(state.status==='waiting-clear'&&!enemies.some(e=>e.waveId===wave.id&&e.hp>0)){state.status='cleared';setStatus(`${wave.label||wave.id} 已清除。`);}
    });
  }
  function updateBossPhase(enemy,now){
    const phases=enemy.bossConfig?.phases;if(!enemy.isBoss||!Array.isArray(phases)||!phases.length)return;
    const ratio=enemy.hp/Math.max(1,enemy.maxHp)*100;
    const nextIndex=enemy.phaseIndex+1;
    const nextPhase=phases[nextIndex];
    if(!nextPhase)return;
    const triggerType=nextPhase.triggerType||'hpPercent';
    const phaseTriggered=triggerType==='elapsedMs'
      ? now-(enemy.spawnedAt||now)>=Math.max(0,Number(nextPhase.triggerValue??nextPhase.timeMs)||0)
      : triggerType==='afterPreviousPhase'
        ? (nextIndex===0 ? now>=(enemy.spawnedAt||now) : enemy.phaseIndex===nextIndex-1)
        : ratio<=Number(nextPhase.threshold??80);
    if(phaseTriggered&&now>=(enemy.nextPhaseAt||0)){
      const phase=nextPhase;enemy.phaseIndex=nextIndex;enemy.phaseConfig=phase;enemy.activeSkillId=phase.skillId||'';
      enemy.ai.attackMode=[1,2,3].includes(Number(phase.attackMode))?Number(phase.attackMode):enemy.ai.attackMode;
      enemy.ai.damage=Math.max(0,Number(phase.damage??enemy.ai.damage));
      enemy.ai.attackCooldownMs=Math.max(100,Number(phase.cooldownMs)||enemy.ai.attackCooldownMs);
      enemy.ai.movementSpeed=Math.max(1,Number(phase.movementSpeed)||enemy.ai.movementSpeed/WORLD_SCALE)*WORLD_SCALE;
      enemy.ai.attackRange=Math.max(30,Number(phase.attackRange)||enemy.ai.attackRange/WORLD_SCALE)*WORLD_SCALE;
      enemy.phaseStartedAt=now;enemy.actionUntil=now+Math.max(100,Number(phase.attackPoseMs)||700);enemy.pose=phase.animation||phase.skillId||'attack';
      const phaseDelay=Number(phase.transitionDelayMs);enemy.nextPhaseAt=now+(Number.isFinite(phaseDelay)?clamp(phaseDelay,0,60000):1200);
      playOptionalSfx(phase.sfxKey||'bossPhase',.55);addFloatingText(`PHASE ${nextIndex+1}`,enemy.x,enemy.y-35,1200);setStatus(`${enemy.label} 進入 Phase ${nextIndex+1}${phase.skillId?` · Skill ${phase.skillId}`:''}！`);
    }
  }
  function setStage(stageId, arrivalTransitionId = '') {
    stopUltimateChargeSound(); ultimateActive = false; ultimateBurstDone = false; ultimateBurstStartedAt = 0; ultimatePoseUntil = 0;
    const next = stageById(stageId);
    if (!next) { setStatus(`找不到目的關卡：${stageId || '未設定'}`); return false; }
    const prepared = prepareSideScrollStage(next);
    stage = prepared.stage; currentStageId = next.id;
    worldW = prepared.worldWidth; worldH = prepared.worldHeight;
    bg = asset(stage.background || 'images/chapter4/bg1_test.webp');
    motionTime = 0; platformPoses = computePoses(0);
    const carriedPlayerState = hasStartedStage && hero
      ? { hp: hero.hp, mp: hero.mp, gems: hero.gems }
      : null;
    hero = makeHero();
    if (campaignHandoffPending) {
      const hpValue = Number(campaignState.hp), mpValue = Number(campaignState.mp), gemValue = Number(campaignState.gems);
      hero.hp = clamp(Number.isFinite(hpValue) ? hpValue : 100, 0, 100);
      hero.mp = clamp(Number.isFinite(mpValue) ? mpValue : 65, 0, 100);
      hero.gems = clamp(Number.isFinite(gemValue) ? gemValue : 3, 0, 3);
      campaignHandoffPending = false;
    } else if (carriedPlayerState) {
      hero.hp = clamp(Number(carriedPlayerState.hp) || 0, 0, 100);
      hero.mp = clamp(Number(carriedPlayerState.mp) || 0, 0, 100);
      hero.gems = clamp(Number(carriedPlayerState.gems) || 0, 0, 3);
    }
    hasStartedStage = true;
    floatingTexts.length = 0;
    const arrival = arrivalTransitionId ? (stage.transitions || []).find(t => t.id === arrivalTransitionId) : null;
    const start = arrival || stage.playerStart;
    if (start) { hero.x = Number(start.x) * WORLD_SCALE - hero.w / 2; hero.y = Number(start.y) * WORLD_SCALE - hero.h; if (start.facing === 'left') hero.face = -1; }
    else if (stage.platforms?.length) {
      const spawnPlatform = [...stage.platforms].sort((a,b) => Number(b.y)-Number(a.y))[0];
      const spawnPose = platformPose(spawnPlatform, 0), spawnSurface = getStandSegment(spawnPlatform, spawnPose);
      hero.x = (spawnPose.x1 + spawnPose.x2) / 2 - hero.w / 2; hero.y = lineYAtX(spawnSurface, hero.x + hero.w / 2) - hero.h;
    } else { hero.x = 80; hero.y = worldH - hero.h - 12; }
    hero.x = clamp(hero.x, 0, Math.max(0, worldW - hero.w));
    hero.platformId = null; hero.ground = false;
    syncRegisteredEnemyTypes();
    stageStartedAt=performance.now();waveRuntime=new Map();sceneObjectCooldowns=new Map();sceneObjectActiveFrom=new Map();sceneObjectActiveUntil=new Map();activatedCheckpoints=new Set();checkpointTouching=new Set();
    activeCheckpoint=stage.playerStart?{x:Number(stage.playerStart.x),y:Number(stage.playerStart.y),facing:'right',id:'playerStart'}:null;
    enemies = (stage.enemies || []).map((source,index)=>buildRuntimeEnemy(source,index)).filter(Boolean);
    for(const wave of stage.waves||[])waveRuntime.set(wave.id,{status:'pending',entryIndex:0,spawnedInEntry:0,totalSpawned:0,lastSpawnAt:0,failed:false});
    const bossTestId=new URLSearchParams(window.location.search).get('bossTest');
    if(bossTestId && stage.id && /^chapter4_boss_\d+$/.test(bossTestId)){
      const testPlatform=(stage.platforms||[]).find(p=>p.id===hero.platformId)||(stage.platforms||[])[0];
      const testBoss=buildRuntimeEnemy({id:'boss_test_runtime',type:bossTestId,isBoss:true,x:Math.min(worldW/WORLD_SCALE-180,hero.x/WORLD_SCALE+330),y:testPlatform?.y||hero.y/WORLD_SCALE+hero.h/WORLD_SCALE,width:enemyRegistryRecord(bossTestId)?.bossConfig?.size||160,height:enemyRegistryRecord(bossTestId)?.bossConfig?.size||160,platformId:testPlatform?.id||''},enemies.length);
      if(testBoss){enemies.push(testBoss);setStatus(`Boss Test Mode：${testBoss.label} 已生成。`);}
    }
    enemyTotal = enemies.length;
    enemyProjectiles=[];enemyGroundAttacks=[];enemyImpactParticles=[];
    window.dispatchEvent(new CustomEvent('chapter4:stagechange', { detail: { id: currentStageId, name: stage?.name || currentStageId, enemyCount: enemies.length } }));
    if (musicEnabled && musicStarted) startMusic();
    cameraX = clamp(hero.x - VIEW_W * .45, 0, Math.max(0, worldW - VIEW_W));
    cameraY = clamp(hero.y + hero.h / 2 - VIEW_H * .55, 0, Math.max(0, worldH - VIEW_H));
    updateStageUi(); updateHud();
    const sideScrollMessage = `背景 ${Math.round(stage.backgroundWidth)} × ${Math.round(stage.backgroundHeight)}；沿用 Chapter 1–3 原背景顯示倍率 ${WORLD_SCALE.toFixed(2)}x，固定鏡頭只顯示局部`; 
    if (!stage.platforms?.length) setStatus('目前 Stage 尚未建立平台；請返回 Stage Editor 放置平台後再測試。');
    else setStatus(`${sideScrollMessage}；平台與碰撞依原圖比例對齊，角色操作尺寸及速度保持舊設定。`);
    return true;
  }
  function updateStageUi() {
    const displayName = stage?.name || stage?.id || 'Stage';
    const stageTitle = $('stageTitle');
    if (stageTitle) stageTitle.textContent = displayName;
    const count = $('count');
    if (count) count.textContent = `第四章 · ${displayName}`;
    // Stage 選單及來源資訊只存在於獨立測試頁；正式主線頁不顯示開發工具。
    const picker = $('stagePicker');
    if (picker) {
      picker.innerHTML = project.stages.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name || s.id)} — ${escapeHtml((s.background||'').split('/').pop())}</option>`).join('');
      picker.value = currentStageId;
    }
    const sourceStatus = $('sourceStatus');
    if (sourceStatus) {
      const scrollInfo = `世界 ${Math.round(worldW)} × ${Math.round(worldH)}px · 原圖座標 × ${WORLD_SCALE.toFixed(2)} · 固定鏡頭`;
      sourceStatus.textContent = (sourceMode === 'editor' ? '已接收 Stage Editor 最新工程' : sourceMode === 'json' ? '已載入 Stage JSON' : sourceMode === 'js' ? '已載入 JS 關卡資料' : '內建橫向捲動示範地圖') + ` · ${scrollInfo}`;
    }
  }
  function updateHud() {
    $('hpbar').style.width = `${hero.hp}%`; $('mpbar').style.width = `${hero.mp}%`;
    $('gems').textContent = '◆ '.repeat(Math.max(0, hero.gems)).trim();
    const alive=enemies.filter(e=>e.hp>0).length;
    const clueCount = Array.isArray(campaignState?.clues) ? campaignState.clues.length : 0;
    $('clueBook').textContent = enemyTotal ? `${hasCampaignHandoff ? `線索 ${clueCount}/6 · ` : ''}敵人 ${enemyTotal-alive}/${enemyTotal}` : (hasCampaignHandoff ? `線索 ${clueCount}/6` : '平台測試');
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function drawImageFit(image, x, y, w, h, flip = false, alpha = 1) {
    if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return;
    const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
    const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale, dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
    ctx.save(); ctx.globalAlpha = alpha;
    if (flip) { ctx.translate(dx + dw / 2, 0); ctx.scale(-1, 1); ctx.drawImage(image, -dw / 2, dy, dw, dh); }
    else ctx.drawImage(image, dx, dy, dw, dh);
    ctx.restore();
  }
  function drawFallbackPlatform(x1, x2, y, h) {
    const bottom = y + Math.max(20, h), grad = ctx.createLinearGradient(0, y, 0, bottom);
    grad.addColorStop(0, '#8eacc0'); grad.addColorStop(.24, '#536c83'); grad.addColorStop(1, '#25384d');
    ctx.save(); ctx.beginPath(); ctx.moveTo(x1, y + 8); ctx.lineTo(x1 + 10, y); ctx.lineTo(x2 - 7, y); ctx.lineTo(x2, y + 9); ctx.lineTo(x2 - 8, bottom - 5); ctx.lineTo(x2 - 19, bottom); ctx.lineTo(x1 + 16, bottom - 2); ctx.lineTo(x1, y + 14); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = '#b8d0dd'; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.moveTo(x1 + 8, y + 7); ctx.lineTo(x2 - 8, y + 7); ctx.strokeStyle = 'rgba(225,244,249,.72)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  }
  function drawWorld() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save(); ctx.scale(VIEW_SCALE, VIEW_SCALE);
    const shakeNow=performance.now();let shakeX=0,shakeY=0;
    for(const g of enemyGroundAttacks){const e=shakeNow-g.createdAt;if(e>=1720&&e<1880){const k=1-(e-1720)/160;shakeX=Math.sin(e*.19)*5*WORLD_SCALE*k;shakeY=Math.cos(e*.23)*2.2*WORLD_SCALE*k;break;}}
    ctx.translate(-cameraX+shakeX, -cameraY+shakeY);
    if (bg?.complete && bg.naturalWidth) drawWorldBackground(bg);
    else { ctx.fillStyle = '#08264a'; ctx.fillRect(0, 0, worldW, worldH); }

    for (const p of stage?.platforms || []) {
      const pose = platformPoses.get(p.id) || platformPose(p, motionTime), x1 = pose.x1, x2 = pose.x2, y = pose.y;
      const image = p.imageSrc ? asset(p.imageSrc) : null, imageH = Math.max(12, Number(p.imageHeight) || 52);
      if (image?.complete && image.naturalWidth && image.naturalHeight) {
        const m=platformVisualMetrics(p,pose);
        ctx.save();ctx.globalAlpha=clamp(Number(p.imageOpacity??100),0,100)/100;ctx.translate(m.cx,m.cy);ctx.rotate(m.rotation);ctx.drawImage(image,-m.width/2,-m.height/2,m.width,m.height);ctx.restore();
      } else { const m=platformVisualMetrics(p,pose);ctx.save();ctx.translate(m.cx,m.cy);ctx.rotate(m.rotation);drawFallbackPlatform(-m.width/2,m.width/2,-m.height/2,m.height);ctx.restore(); }
      // Editor collision guides are intentionally not drawn in the playable HTML.
      // The exact same platform/standLine geometry still drives collision in update().
    }

    const now=performance.now();
    drawStageObjects(now);
    for(const enemy of enemies){
      // Chapter 4 Enemy 1: normal=待機、idle=死亡、hit=被擊中、attack=攻擊。
      // Death flow matches the previous Chapter 3 enemies: hit briefly, corpse pose,
      // fade after 1.65s and remove after 2.45s.
      const defeated=enemy.hp<=0;
      const deadElapsed=defeated?Math.max(0,now-(enemy.deathAt??now)):0;
      let pose=enemy.pose||'normal';
      let drawAlpha=1;
      if(defeated){
        const bossDeath=enemy.bossConfig?.deathAction||'death';
        pose=deadElapsed<150?'hit':(enemyRegistryRecord(enemy.type)?.animations?.[bossDeath]?.frames?.length?bossDeath:(enemyRegistryRecord(enemy.type)?.animations?.death?.frames?.length?'death':'idle'));
        const fadeAt=Math.max(400,enemy.deathDurationMs-800);if(deadElapsed>fadeAt)drawAlpha=1-clamp((deadElapsed-fadeAt)/800,0,1);
      }else{
        if(now<(enemy.introUntil||0))pose=enemy.bossConfig?.introAction||'intro';else if(now<enemy.hitUntil)pose='hit';else if(now<enemy.actionUntil)pose=(enemy.isBoss&&(enemy.phaseConfig?.animation||enemy.phaseConfig?.skillId))||'attack';
        else if(enemy.isWalking){const frame=1+(Math.floor(now/145)%4);pose=`walk${frame}`;}else pose='normal';
      }
      let poseElapsed=now;
      const introPose=enemy.bossConfig?.introAction||'intro',deathPose=enemy.bossConfig?.deathAction||'death';
      if(pose==='hit') poseElapsed=Math.max(0,now-((enemy.hitUntil||now)-(enemy.hitPoseDuration||CH4_ENEMY_HIT_POSE_MS)));
      else if(enemy.bossConfig&&now<(enemy.introUntil||0)&&pose===introPose)poseElapsed=Math.max(0,now-(enemy.introStartedAt||now));
      else if(enemy.isBoss&&(enemy.phaseConfig?.animation||enemy.phaseConfig?.skillId)&&pose===(enemy.phaseConfig.animation||enemy.phaseConfig.skillId)&&now<(enemy.actionUntil||0))poseElapsed=Math.max(0,now-(enemy.phaseStartedAt||now));
      else if(pose==='attack') poseElapsed=Math.max(0,now-((enemy.actionUntil||now)-(enemy.ai?.attackPoseMs||430)));
      else if(pose==='death'||(defeated&&pose===deathPose)) poseElapsed=Math.max(0,now-((enemy.deathAt||now)+150));
      const image=asset(enemySpritePath(enemy,pose,poseElapsed));
      // Chapter 4 uses the same per-enemy / per-pose art values exported by Enemy Visual Editor.
      const artBase=window.ENEMY_VISUAL_CONFIG?.entries?.[enemy.type]||window.ENEMY_VISUAL_CONFIG?.entries?.chapter4_enemy_1||{};
      const artPose=artBase.poses?.[pose]||{};
      const actionKey=pose.startsWith('walk')?'walk':pose;
      const action=enemyRegistryRecord(enemy.type)?.animations?.[actionKey]||enemyRegistryRecord(enemy.type)?.animations?.[pose]||{};
      const hasSyncedPose=!!artBase.poses?.[pose];
      const artScale=clamp(Number(artBase.scale)||1,.35,3)*clamp(Number(artPose.scale)||1,.35,3)*(hasSyncedPose?1:clamp((Number(action.size)||100)/100,.2,3));
      const artOffsetX=(Number(artBase.offsetX)||0)+(Number(artPose.offsetX)||0)+(hasSyncedPose?0:(Number(action.x)||0));
      const artOffsetY=(Number(artBase.offsetY)||0)+(Number(artPose.offsetY)||0)+(hasSyncedPose?0:(Number(action.y)||0));
      const drawW=enemy.w*artScale, drawH=enemy.h*artScale;
      const anchorX=clamp(Number(action.anchorX??.5),0,1),anchorY=clamp(Number(action.anchorY??1),0,1);
      const groundAligned=action.groundAlignment!==false;
      const pivotY=groundAligned?enemy.y+enemy.h:enemy.y+enemy.h*anchorY;
      const drawX=enemy.x-drawW*anchorX+artOffsetX/VIEW_SCALE;
      const drawY=pivotY-drawH*anchorY+artOffsetY/VIEW_SCALE;
      ctx.save();
      // Mirror the small recoil motion from Chapter 1–3's enemyHitRecoil CSS,
      // while keeping the original foot anchor and transparent sprite pixels.
      const hitRemaining=Math.max(0,(enemy.hitUntil||0)-now);
      if(!defeated&&hitRemaining>0){
        const duration=Math.max(1,enemy.hitPoseDuration||CH4_ENEMY_HIT_POSE_MS);
        const progress=clamp(1-hitRemaining/duration,0,1);
        const recoilX=Math.sin(progress*Math.PI*3)*5*VIEW_SCALE;
        const recoilAngle=-.07*Math.sin(progress*Math.PI*2);
        const pivotX=enemy.x+recoilX,pivotY=drawY+drawH*.58;
        ctx.translate(pivotX,pivotY);ctx.rotate(recoilAngle);ctx.translate(-pivotX,-pivotY);
      }
      // Flash only the non-transparent sprite pixels; no rectangular overlay.
      if(!defeated&&enemy.flash>95&&enemy.flash<140)ctx.filter='brightness(0) invert(1)';
      drawImageFit(image,drawX,drawY,drawW,drawH,enemy.facing==='left',drawAlpha);
      ctx.restore();

      // 與第一至第三章一致：敵人上方固定顯示名稱及紅色 HP 條；死亡後隱藏。
      if(!defeated){
        // 與主線敵人 UI 尺寸接近：名稱在上、血條在下，置中固定於敵人頭頂。
        const uiScale=VIEW_W/Math.max(1,canvas.clientWidth);
        const barWidth=clamp(window.innerWidth*.07,68,88)*uiScale,barHeight=8*uiScale;
        const barX=enemy.x-barWidth/2,barY=drawY-15*uiScale;
        const label=String(enemy.displayName||enemy.label||'敵人');
        ctx.save();
        ctx.font=`800 ${10*uiScale}px system-ui, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
        const labelWidth=Math.max(32*uiScale,ctx.measureText(label).width+12*uiScale),labelHeight=18*uiScale;
        const labelX=enemy.x-labelWidth/2,labelY=drawY-40*uiScale;
        ctx.fillStyle='rgba(23,36,59,.92)';ctx.strokeStyle='#8194ad';ctx.lineWidth=uiScale;
        ctx.beginPath();ctx.roundRect(labelX,labelY,labelWidth,labelHeight,5*uiScale);ctx.fill();ctx.stroke();
        ctx.fillStyle='#fff3d0';ctx.fillText(label,enemy.x,labelY+labelHeight/2+.5*uiScale);
        ctx.fillStyle='#1a2639';ctx.fillRect(barX,barY,barWidth,barHeight);
        ctx.strokeStyle='#101b2c';ctx.lineWidth=uiScale;ctx.strokeRect(barX+.5*uiScale,barY+.5*uiScale,barWidth-uiScale,barHeight-uiScale);
        const hpRatio=clamp(enemy.hp/Math.max(1,enemy.maxHp),0,1);
        if(hpRatio>0){ctx.fillStyle=enemy.bossConfig?.healthBarColor||'#e75b5d';ctx.fillRect(barX+uiScale,barY+uiScale,(barWidth-2*uiScale)*hpRatio,barHeight-2*uiScale);}
        ctx.restore();
      }
    }
    for(const g of enemyGroundAttacks){
      const elapsed=now-g.createdAt,warning=elapsed<1600,impactDelay=120,active=elapsed>=1600+impactDelay&&elapsed<1600+impactDelay+g.duration;
      ctx.save();
      if(warning){
        // 地面預警改為單一水平紅線：不再使用圓形／橢圓形或虛線輪廓。
        // 線長輕微脈動，最後 300ms 快速閃爍；只作視覺提示，不改變傷害判定。
        const pulse=.5+.5*Math.sin(elapsed/145*Math.PI*2),halfLength=g.radius*(.82+.18*pulse);
        const fastBlink=elapsed>1300,blink=fastBlink?(Math.floor(elapsed/65)%2===0):true;
        ctx.globalAlpha=blink?.45+.5*pulse:0;ctx.strokeStyle='#ff2525';ctx.shadowColor='#ff1717';ctx.shadowBlur=14*WORLD_SCALE;
        ctx.lineWidth=(4+1.5*pulse)*WORLD_SCALE;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(g.x-halfLength,g.y);ctx.lineTo(g.x+halfLength,g.y);ctx.stroke();
      }else if(elapsed<1720){
        // 爆發前保留 120ms 地面震動空檔，先震動、後顯示攻擊圖片。
      }else if(active){
        const t=clamp((elapsed-1720)/180,0,1),radius=g.radius*(.3+.7*(1-Math.pow(1-t,3)));
        const fadeIn=clamp((elapsed-1720)/90,0,1),fadeOut=clamp((1720+g.duration-elapsed)/130,0,1);
        // 已按方案 A 隱藏紅橙色地面預警／範圍圈；保留冰晶攻擊圖片。
        const groundImage=asset(g.path);if(groundImage?.complete&&groundImage.naturalWidth){const imageScale=(.28+.72*t)*(.72+.28*fadeOut);ctx.globalAlpha=.9*fadeIn*fadeOut;const enlargedImageScale=imageScale*1.5;const imageW=radius*2*enlargedImageScale,imageH=radius*1.1*enlargedImageScale;
          // 以圖片最下方中央點作為固定錨點：由小放大時只向上及左右擴展，不向地面下方漂移。
          drawImageFit(groundImage,g.x-imageW/2+g.imageOffsetX,g.y-imageH+g.imageOffsetY,imageW,imageH,false,1);}
      }else{ /* 攻擊結束淡出時不繪製紅橙色地面圈。 */ }
      ctx.restore();
    }
    // 命中後投射物已移除，只留下爆散粒子及短促衝擊環。
    for(const q of enemyImpactParticles){const a=clamp(q.life/q.maxLife,0,1);ctx.save();ctx.globalAlpha=a;ctx.strokeStyle=q.color;ctx.fillStyle=q.color;ctx.shadowColor=q.color;ctx.shadowBlur=10;
      if(q.ring){const progress=1-a;ctx.lineWidth=3*WORLD_SCALE;ctx.beginPath();ctx.arc(q.x,q.y,q.size*(.35+progress*2.2),0,Math.PI*2);ctx.stroke();}
      else{ctx.beginPath();ctx.arc(q.x,q.y,Math.max(1,q.size*a),0,Math.PI*2);ctx.fill();}ctx.restore();}
    for(const projectile of enemyProjectiles){
      const orb=asset(projectile.path);ctx.save();ctx.translate(projectile.x,projectile.y);ctx.rotate(projectile.rotation||0);if(orb?.complete&&orb.naturalWidth)drawImageFit(orb,-projectile.size/2,-projectile.size/2,projectile.size,projectile.size,false,1);
      else{ctx.fillStyle='#63e8ff';ctx.shadowColor='#63e8ff';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(0,0,projectile.size*.35,0,Math.PI*2);ctx.fill();}ctx.restore();
    }

    const heroNow=performance.now();
    // 主線原版視覺：女神金焰脈動光暈；爆發時顯示 .ultimate-ring 同款三層圓形聖光環。
    if (ultimateBurstStartedAt && heroNow - ultimateBurstStartedAt < 760) {
      const progress = clamp((heroNow - ultimateBurstStartedAt) / 760, 0, 1);
      // 原版 CSS：直徑 min(64vw, 620px)，金色外圈、白色內圈、琥珀色虛線圈。
      const ringDiameter = Math.min(window.innerWidth * .64, 620) * (VIEW_W / Math.max(1, canvas.clientWidth));
      const eased = 1 - Math.pow(1 - progress, 2.2);
      const visualRadius = ringDiameter * .5 * (.08 + .92 * eased);
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.shadowColor = '#ffb000'; ctx.shadowBlur = 26;
      ctx.fillStyle = 'rgba(255,207,61,.20)';
      ctx.beginPath(); ctx.arc(ultimateBurstX, ultimateBurstY, visualRadius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffe36a'; ctx.lineWidth = 7; ctx.stroke();
      ctx.beginPath(); ctx.arc(ultimateBurstX, ultimateBurstY, visualRadius * .76, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff7c2'; ctx.lineWidth = 3; ctx.shadowColor = '#fff1a0'; ctx.stroke();
      ctx.beginPath(); ctx.arc(ultimateBurstX, ultimateBurstY, visualRadius * .44, 0, Math.PI * 2);
      ctx.setLineDash([10, 7]); ctx.strokeStyle = '#ffb600'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    }

    // 主線 floatText 同款金色文字：蓄力名稱、命中敵人時的「神聖爆發」。
    for (let i=floatingTexts.length-1;i>=0;i--) {
      const item=floatingTexts[i],elapsed=heroNow-item.createdAt;
      if(elapsed>=item.duration){floatingTexts.splice(i,1);continue;}
      const t=elapsed/item.duration,alpha=1-t,raise=t*26;
      ctx.save();ctx.globalAlpha=alpha;ctx.font='900 22px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.lineWidth=4;ctx.lineJoin='round';ctx.strokeStyle='rgba(74,37,5,.95)';ctx.shadowColor='#ffcb35';ctx.shadowBlur=16;
      ctx.strokeText(item.text,item.x,item.y-raise);ctx.fillStyle='#fff0a5';ctx.fillText(item.text,item.x,item.y-raise);ctx.restore();
    }

    let sprite = asset(sprites.stand);
    // 受擊透明度必須作為 drawImageFit 的 alpha 參數傳入。
    // drawImageFit 會自行 save/restore Canvas 狀態；若只設定外層 globalAlpha，
    // 內層繪圖會被重設成 1，角色便看不到閃爍（V1.4.0 的問題）。
    let heroDrawAlpha=1;
    if(heroNow<hero.hitFlashUntil){
      // 兩個快速閃爍週期：亮／暗／亮／暗，每 80ms 切換一次。
      const flashPhase=Math.floor((heroNow-hero.hitFlashStartedAt)/80);
      heroDrawAlpha=flashPhase%2===1?.10:1;
    }else if(hero.invuln>0){
      // 閃爍完成後，剩餘無敵時間保持輕微半透明，不再持續閃動。
      heroDrawAlpha=.72;
    }
    if (ultimateActive || heroNow < ultimatePoseUntil) {
      const elapsed = Math.max(0, heroNow - ultimateStartedAt);
      // 主線 game.js 會在 1.16 秒收招後，保留最後一格直到施放後 1.5 秒；第四章保持相同停格時間。
      const frame = ultimateActive ? Math.min(7, Math.floor(elapsed / 130)) : 7;
      const frameImage = ultimateFrames[frame] || ultimateFrames[0];
      const frameScale = ultimateFrameScales[frame] || 1;
      const liftProgress = frame <= 4 ? frame / 4 : ((7 - frame) / 3);
      const drawH = hero.h * (158 / 146) * frameScale, drawW = drawH * 512 / 460;
      const drawX = hero.x + hero.w / 2 - drawW / 2;
      const drawY = hero.y + hero.h - drawH - Math.max(0, VIEW_H * .24 * liftProgress);
      const pulse = (Math.sin((elapsed / 180) * Math.PI * 2) + 1) / 2;
      ctx.save();
      if (ultimateActive) {
        ctx.shadowColor = ultimateBurstDone ? '#fff2a0' : '#ffd43b';
        ctx.shadowBlur = ultimateBurstDone ? 40 : 7 + pulse * 16;
        ctx.filter = ultimateBurstDone ? 'brightness(1.12) saturate(1.2)' : 'sepia(.35) saturate(1.45) brightness(1.12)';
      }
      drawImageFit(frameImage, drawX, drawY, drawW, drawH, false, heroDrawAlpha);
      ctx.restore();
    } else {
      if (hero.specialAnim > 0) sprite = asset(sprites.bash);
      else if (hero.bashAnim > 0) sprite = asset(sprites.bash);
      else if (hero.attack > 0) sprite = asset(sprites.thrust);
      else if (!hero.ground) sprite = asset(sprites.jump);
      else if (Math.abs(hero.vx) > .5) sprite = asset((Math.floor(walkTime / 100) % 2) ? sprites.walk1 : sprites.walk2);
      if (hero.dash > 0) drawImageFit(sprite, hero.x - hero.face * 25, hero.y, hero.w, hero.h, hero.face < 0, .3*heroDrawAlpha);
      drawImageFit(sprite, hero.x, hero.y, hero.w, hero.h, hero.face < 0, heroDrawAlpha);
    }
    if (hero.specialEffect > 0) {
      const p = 1 - hero.specialEffect / 360, radius = 28 + p * 96;
      ctx.save(); ctx.globalAlpha = Math.max(0, .65 * (1 - p)); ctx.strokeStyle = '#ffe7a1'; ctx.lineWidth = 7 - p * 4; ctx.shadowColor = '#ffe7a1'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(hero.x + hero.w / 2, hero.y + hero.h / 2, radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    $('hit').classList.toggle('show', hitTimer > 0 && combo > 0); if (hitTimer > 0 && combo > 0) $('hit').textContent = `${combo} HIT${combo > 1 ? '!' : ''}`;
    const alpha = transitionElapsed > 0 ? (transitionElapsed < 220 ? transitionElapsed / 220 : Math.max(0, 1 - (transitionElapsed - 220) / 220)) : 0;
    $('fadeOverlay').style.opacity = String(clamp(alpha, 0, 1));
  }
  function enemyOnSamePlatform(enemy) { return !!(enemy&&enemy.hp>0&&hero.ground&&hero.platformId&&hero.platformId===enemy.platformId); }
  function damageEnemy(box,label,damage=1,kind=null){
    let hit=false;
    const attackKind=kind||(String(label).includes('盾擊')?'bash':String(label).includes('特殊')?'special':'thrust');
    for(const enemy of enemies){if(enemy.hp<=0)continue;
      const left=enemy.x-enemy.w/2,top=enemy.y;
      const overlap=box.x<left+enemy.w&&box.x+box.w>left&&box.y<top+enemy.h&&box.y+box.h>top;
      if(!overlap)continue;
      const now=performance.now();
      enemy.hp=Math.max(0,enemy.hp-damage);
      applyChapter4EnemyHitFeedback(enemy,now,attackKind);
      hit=true;
      if(enemy.hp<=0){enemy.deathAt=now;enemy.hitUntil=now+150;enemy.hitPoseDuration=150;enemy.isWalking=false;enemy.pose='hit';playOptionalSfx('enemyDeath',.48);}
      else playOptionalSfx('enemyHit',.28);
      combo++;hitTimer=600;hero.mp=Math.min(100,hero.mp+5);
      setStatus(enemy.hp<=0?`${enemy.label} 已被擊敗`:`${label}命中 ${enemy.label}！HP ${enemy.hp}/${enemy.maxHp}`);
    }
    if(hit)updateHud();return hit;
  }
  function sideHitbox(reach = 118, height = 82) { return { x: hero.face > 0 ? hero.x + hero.w - 8 : hero.x - reach + 8, y: hero.y + (hero.h - height) / 2, w: reach, h: height }; }
  function takeEnemyDamage(damage,source='敵人攻擊',attackerX=null){
    const now=performance.now();
    if(hero.invuln>0)return false;
    if(hero.bashAnim>0){setStatus('盾牌成功防禦！');return true;}
    hero.hp=Math.max(0,hero.hp-damage);
    playOptionalSfx('enemyAttack',.36);
    hero.invuln=900;
    hero.hitFlashStartedAt=now;
    hero.hitFlashUntil=now+320;       // 兩個快速閃爍週期（每 80ms 切換一次）。
    hero.inputLockUntil=now+620;      // 擊退及硬直期間不能移動或施放技能。
    hero.knockbackUntil=now+420;
    const heroCenter=hero.x+hero.w/2;
    const sourceX=Number(attackerX);
    const knockDirection=Number.isFinite(sourceX)&&sourceX!==heroCenter
      ? (heroCenter>sourceX?1:-1)
      : -hero.face;
    // 先清除舊輸入／衝刺，避免玩家的按鍵抵消擊退。
    keys.clear(); jumpBuffer=0; hero.dash=0; hero.airDashUsed=false; hero.airDashHitDone=false;
    hero.attack=0; hero.specialAnim=0; hero.specialEffect=0;
    hero.face=knockDirection;
    hero.vx=knockDirection*8.8;
    hero.vy=-7.4;
    hero.ground=false; hero.platformId=null;
    coyote=0;
    if(hero.hp<=0){
      const spawn=activeCheckpoint||stage?.playerStart;
      hero.hp=100;hero.vx=0;hero.vy=0;hero.dash=0;hero.airDashUsed=false;hero.airDashHitDone=false;hero.attack=0;hero.specialAnim=0;
      if(spawn){hero.x=clamp(Number(spawn.x)*WORLD_SCALE-hero.w/2,0,Math.max(0,worldW-hero.w));hero.y=Number(spawn.y)*WORLD_SCALE-hero.h;hero.face=spawn.facing==='left'?-1:1;}
      hero.invuln=1600;hero.inputLockUntil=now+350;hero.knockbackUntil=now+350;
      setStatus(`角色倒下，已返回 ${activeCheckpoint?.id||'Stage 開始點'}。HP 已恢復。`);
    }else setStatus(`${source}！受到攻擊並被擊退，暫時無法操作。HP ${hero.hp}`);
    updateHud();
    return true;
  }
  function jump() { if (!paused && !ultimateActive && transitionElapsed <= 0 && performance.now()>=hero.inputLockUntil) { unlockAudio(); jumpBuffer = 130; } }
  function thrustAttack() {
    if (paused || ultimateActive || transitionElapsed > 0 || performance.now()<hero.inputLockUntil || attackCooldown > 0 || hero.dash > 0) return;
    unlockAudio(); playAudio(sfx.thrust); hero.attack = 190; attackCooldown = 270;
    const hit = damageEnemy(sideHitbox(118, 82), '左右槍刺'); if (!hit) setStatus('左右槍刺');
  }
  function startAirShieldDash() {
    if (paused || ultimateActive || performance.now()<hero.inputLockUntil || hero.dashCooldown > 0 || hero.dash > 0 || hero.airDashUsed) return;
    hero.dash = 175; hero.vx = hero.face * 13; hero.vy = 0; hero.dashCooldown = 650; hero.airDashUsed = true; hero.airDashHitDone = false; hero.bashAnim = 235;
    setStatus('空中盾擊 Dash');
  }
  function shieldBash() {
    if (paused || ultimateActive || transitionElapsed > 0 || performance.now()<hero.inputLockUntil || bashCooldown > 0 || hero.dash > 0) return;
    unlockAudio(); playAudio(sfx.bash);
    if (!hero.ground) { startAirShieldDash(); return; }
    hero.bashAnim = 230; bashCooldown = 430;
    const hit = damageEnemy(sideHitbox(128, 94), '盾擊'); if (!hit) setStatus('盾牌猛擊');
  }
  // 原第四章 C 特殊技能保留：消耗 30 MP、冷卻 1.2 秒、3 點近距離範圍傷害。
  // Q 與聖光按鈕專用於主線「女神降臨・神聖槍爆」，不再取代 C 技能。
  function specialAttack() {
    if (paused || ultimateActive || transitionElapsed > 0 || performance.now() < hero.inputLockUntil || specialCooldown > 0 || hero.dash > 0) return;
    unlockAudio();
    if (hero.mp < 30) { setStatus('能量不足'); return; }
    hero.mp -= 30; specialCooldown = 1200; hero.specialAnim = 540; hero.specialEffect = 360;
    const hit = damageEnemy(sideHitbox(190, 138), '特殊技能', 3);
    if (!hit) setStatus('特殊技能');
    updateHud();
  }

  // 女神降臨・神聖槍爆：依 js/game.js + js/game-tuning.js 原始設定移植。
  // Q 啟動、800ms 蓄力、8 格影格每格 130ms、12 秒冷卻、MP 不消耗。
  function ultimateAttack() {
    if (paused || transitionElapsed > 0 || performance.now() < hero.inputLockUntil || hero.dash > 0 || ultimateActive) return;
    const now = performance.now();
    if (now < ultimateCooldownUntil) {
      setStatus(`絕招冷卻中 ${Math.ceil((ultimateCooldownUntil - now) / 1000)}s`);
      return;
    }
    unlockAudio();
    keys.clear(); jumpBuffer = 0;
    hero.vx = 0; hero.attack = 0; hero.bashAnim = 0; hero.specialAnim = 0; hero.specialEffect = 0; hero.dash = 0;
    ultimateActive = true; ultimateStartedAt = now; ultimateCooldownUntil = now + ULTIMATE_COOLDOWN_MS; ultimatePoseUntil = now + 1500;
    ultimateBurstDone = false; ultimateBurstStartedAt = 0;
    playUltimateAudio(ultimateChargeAudio);
    addFloatingText('女神降臨・神聖槍爆', hero.x + hero.w / 2, hero.y - 28, 950);
    setStatus('女神降臨・神聖槍爆');
  }

  // 與主線相同：只檢查玩家左右 32% 視窗範圍，不額外增加上下橢圓判定。
  function applyUltimateBurst(now) {
    ultimateBurstDone = true; ultimateBurstStartedAt = now;
    ultimateBurstX = hero.x; ultimateBurstY = hero.y + hero.h;
    stopUltimateChargeSound(); playUltimateAudio(ultimateBlastAudio);
    let hits = 0;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const enemyLeft = enemy.x - enemy.w / 2;
      if (Math.abs(enemyLeft - hero.x) > VIEW_W * .32) continue;

      // 與第一至第三章 game-tuning.js 相同：普通敵人 5、盾牌兵 2.5。
      const damage = enemy.type === 'shield' ? 2.5 : 5;
      enemy.hp = Math.max(0, enemy.hp - damage);
      // Share the Chapter 1–3 ultimate hit feedback, including 3.5% recoil,
      // flash/hit pose and the same two-hit combo stun rule.
      applyChapter4EnemyHitFeedback(enemy, now, 'ultimate');
      if (enemy.hp <= 0) {
        enemy.deathAt = now; enemy.hitUntil = now + 150; enemy.hitPoseDuration = 150; enemy.isWalking = false; enemy.pose = 'hit';playOptionalSfx('enemyDeath',.48);
      } else {
        enemy.pose = 'hit';playOptionalSfx('enemyHit',.28);
      }
      combo++; hitTimer = 700; hero.mp = Math.min(100, hero.mp + 5); hits++;
      addFloatingText('神聖爆發！', enemy.x, enemy.y - 26, 950);
    }
    setStatus(hits ? `神聖槍爆！命中 ${hits} 個敵人` : '神聖槍爆！');
    updateHud();
  }

  function updateUltimate(now) {
    if (!ultimateActive) return;
    const elapsed = now - ultimateStartedAt;
    if (!ultimateBurstDone && elapsed >= ULTIMATE_CHARGE_MS) applyUltimateBurst(now);
    if (elapsed >= ULTIMATE_CHARGE_MS + ULTIMATE_RELEASE_MS) {
      ultimateActive = false;
      ultimateBurstDone = false;
      setStatus('神聖槍爆完成');
    }
  }
  function spawnEnemyOrb(enemy,now){
    const path=enemy.projectilePath||(ENEMY_TYPES[enemy.type]||ENEMY_TYPES.chapter4_enemy_1).projectile;
    const startX=enemy.x+(hero.x+hero.w/2>=enemy.x?1:-1)*enemy.w*.28;
    const startY=enemy.y+enemy.h*.42,targetX=hero.x+hero.w/2,targetY=hero.y+hero.h*.5;
    const distance=Math.hypot(targetX-startX,targetY-startY),duration=clamp(distance/.17,1500,3000);
    const visual=window.ENEMY_VISUAL_CONFIG?.entries?.[enemy.type]||{};const baseSize=Math.max(38,Math.min(62,worldW*.033));playOptionalSfx('enemyProjectile',.34);enemyProjectiles.push({path,x:startX,y:startY,startX,startY,targetX,targetY,sourceX:enemy.x,sourceLabel:enemy.label||enemy.type||'敵人',createdAt:now,duration,size:baseSize*clamp(Number(visual.projectileScale)||1,.25,3),rangeScale:clamp(Number(visual.projectileRange)||1,.25,3),rotationSpeed:(Number(visual.projectileRotation)||0)*Math.PI/180,rotation:0,damage:Math.max(1,Number(enemy.ai.damage)||1),arcHeight:clamp(worldH*.34,145*WORLD_SCALE,235*WORLD_SCALE)});
  }
  function patrolTargets(enemy,pose){
    const segment=getStandSegment((stage.platforms||[]).find(p=>p.id===enemy.platformId),pose);const minX=Math.min(segment[0].x,segment[1].x),maxX=Math.max(segment[0].x,segment[1].x);
    const points=(enemy.patrol.points||[]).map(pt=>pose.x1+(pose.x2-pose.x1)*clamp(pt.u,0,1));
    if(points.length>=2)return points.map(x=>clamp(x,minX+enemy.w*.35,maxX-enemy.w*.35));
    const range=Math.min(95*WORLD_SCALE,Math.max(25*WORLD_SCALE,(maxX-minX)*.22));
    return [clamp(enemy.initialX-range,minX+enemy.w*.35,maxX-enemy.w*.35),clamp(enemy.initialX+range,minX+enemy.w*.35,maxX-enemy.w*.35)];
  }
  function heroOnFixedPlatform(){
    // 腳下攻擊可在任何固定平台觸發，包括懸空固定平台；移動平台及空中不觸發。
    if(!hero.ground||!hero.platformId)return false;
    const platform=(stage?.platforms||[]).find(p=>p.id===hero.platformId);
    if(!platform||platform.kind==='moving')return false;
    const pose=platformPoses.get(platform.id)||platformPose(platform,motionTime);
    const segment=getStandSegment(platform,pose);
    // 保留舊規則：樓梯／斜坡表面不觸發，只接受近乎水平的固定站立面。
    const dx=Math.abs(segment[1].x-segment[0].x),dy=Math.abs(segment[1].y-segment[0].y);
    if(dx<1||dy>Math.max(4*WORLD_SCALE,dx*.015))return false;
    return true;
  }
  function spawnGroundAttack(enemy,now){
    // 玩家站在任何水平固定平台（包括懸空固定平台）才會開始預警。
    if(!heroOnFixedPlatform())return;
    const visual=window.ENEMY_VISUAL_CONFIG?.entries?.[enemy.type]||{};
    const radius=Math.max(hero.w*.95,worldW*.055)*clamp(Number(visual.groundScale)||1,.25,3);
    playOptionalSfx('enemyAttack',.34);
    enemyGroundAttacks.push({path:(ENEMY_TYPES[enemy.type]||ENEMY_TYPES.chapter4_enemy_1).projectile,x:hero.x+hero.w/2,y:hero.y+hero.h-5,radius,createdAt:now,duration:clamp(Number(visual.groundDuration)||850,250,3000),imageOffsetX:clamp(Number(visual.groundOffsetX)||0,-200,200)*WORLD_SCALE,imageOffsetY:clamp(Number(visual.groundOffsetY)||0,-200,200)*WORLD_SCALE,damage:Math.max(1,Number(enemy.ai.damage)||1),sourceX:enemy.x,sourceLabel:enemy.label||enemy.type,groundPlatformId:hero.platformId,hit:false});
    return true;
  }
  function updateGroundAttacks(now){
    for(let i=enemyGroundAttacks.length-1;i>=0;i--){
      const g=enemyGroundAttacks[i],elapsed=now-g.createdAt;
      if(elapsed>=1940+g.duration){enemyGroundAttacks.splice(i,1);continue;}
      // 觸發時已鎖定首次記錄的位置；玩家移動／跳離平台不會取消這次攻擊。
      // 判定只使用鎖定座標，圖片 X/Y 偏移不會改變攻擊範圍。
      if(elapsed>=1720&&elapsed<1720+g.duration&&!g.hit){
        const hx=hero.x+hero.w/2,hy=hero.y+hero.h-5;
        if(Math.abs(hx-g.x)<g.radius*.9&&Math.abs(hy-g.y)<Math.max(28*WORLD_SCALE,hero.h*.3)){takeEnemyDamage(g.damage,`${g.sourceLabel} 腳下攻擊`,g.sourceX);g.hit=true;}
      }
    }
  }
  function spawnEnemyImpactBurst(x,y){
    const count=12;
    for(let i=0;i<count;i++){const angle=Math.PI*2*i/count+(Math.random()-.5)*.34,speed=(2.2+Math.random()*4.6)*WORLD_SCALE;
      enemyImpactParticles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-1.2*WORLD_SCALE,life:260+Math.random()*180,maxLife:440,size:(3+Math.random()*5)*WORLD_SCALE,color:i%3===0?'#fff4b0':(i%3===1?'#69eaff':'#b7f7ff')});}
    enemyImpactParticles.push({x,y,vx:0,vy:0,life:190,maxLife:190,size:10*WORLD_SCALE,ring:true,color:'#e8fbff'});
  }
  function updateEnemyImpactParticles(dt){
    for(let i=enemyImpactParticles.length-1;i>=0;i--){const q=enemyImpactParticles[i];q.life-=dt;if(q.life<=0){enemyImpactParticles.splice(i,1);continue;}if(!q.ring){q.x+=q.vx*dt/16.67;q.y+=q.vy*dt/16.67;q.vy+=.12*WORLD_SCALE*dt/16.67;q.vx*=.985;q.size*=.994;}}
  }
  function updateEnemyProjectiles(dt,now){
    for(let i=enemyProjectiles.length-1;i>=0;i--){const p=enemyProjectiles[i],t=clamp((now-p.createdAt)/p.duration,0,1);p.x=p.startX+(p.targetX-p.startX)*t;p.y=p.startY+(p.targetY-p.startY)*t-4*p.arcHeight*t*(1-t);p.rotation=(p.rotationSpeed||0)*(now-p.createdAt)/1000;
      const r=p.size*.34*(p.rangeScale||1),hx=hero.x+hero.w/2,hy=hero.y+hero.h/2;
      if(Math.abs(p.x-hx)<hero.w*.45+r&&Math.abs(p.y-hy)<hero.h*.45+r){const ix=p.x,iy=p.y;enemyProjectiles.splice(i,1);spawnEnemyImpactBurst(ix,iy);takeEnemyDamage(p.damage,`${p.sourceLabel||'敵人'} 能量球`,p.sourceX);continue;}
      if(t>=1){const ix=p.x,iy=p.y;enemyProjectiles.splice(i,1);spawnEnemyImpactBurst(ix,iy);}
    }
    updateEnemyImpactParticles(dt);
  }
  function updateEnemy(dt,scale){
    const now=performance.now();
    // Match Chapter 3's corpse cleanup: fade starts at 1650ms, remove at 2450ms.
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];
      if(e.hp<=0&&e.deathAt!==null&&e.deathAt!==undefined&&now-e.deathAt>=(e.deathDurationMs||2450))enemies.splice(i,1);
    }
    for(const enemy of enemies){if(enemy.hp<=0)continue;
      updateBossPhase(enemy,now);
      const platform=(stage.platforms||[]).find(p=>p.id===enemy.platformId);if(!platform)continue;
      const oldPose=enemy.lastPose||platformPoses.get(platform.id)||platformPose(platform,motionTime),pose=platformPoses.get(platform.id)||platformPose(platform,motionTime);
      if(enemy.lastPose){enemy.x+=pose.x1-enemy.lastPose.x1;}enemy.lastPose={x1:pose.x1,y:pose.y};
      const bounds=enemyPlatformBounds(enemy,pose),minX=bounds.min,maxX=bounds.max;
      enemy.x=clamp(enemy.x,minX,maxX);enemy.y=enemySurfaceAt(enemy,pose)-enemy.h;
      const targets=patrolTargets(enemy,pose),leftBound=Math.min(...targets),rightBound=Math.max(...targets);
      keepChapter4HeroAndEnemyApart(enemy,minX,maxX);
      // Chapter 1–3 ordinary enemies pause pursuit/attacks for 260ms on every
      // second hit in a short combo. Still update their feet on moving platforms.
      if(now<(enemy.hitStunUntil||0)){
        enemy.isWalking=false;
        enemy.y=enemySurfaceAt(enemy,pose)-enemy.h;
        enemy.flash=Math.max(0,enemy.flash-dt);
        continue;
      }
      if(now<(enemy.introUntil||0)){enemy.isWalking=false;enemy.pose=enemy.bossConfig?.introAction||'intro';enemy.y=enemySurfaceAt(enemy,pose)-enemy.h;continue;}
      const heroX=hero.x+hero.w/2,enemyCenter=enemy.x,dx=heroX-enemyCenter,absDx=Math.abs(dx),samePlatform=enemyOnSamePlatform(enemy);
      const verticalNear=Math.abs((hero.y+hero.h/2)-(enemy.y+enemy.h/2))<Math.max(400*WORLD_SCALE,enemy.h*4);
      const aiType=enemy.ai.aiType||'legacy-runtime';
      const ambushRange=aiType==='ambush'?enemy.ai.alertRange*.42:enemy.ai.alertRange;
      const effectiveAlertRange=aiType==='ambush'&&enemy.ambushTriggered?enemy.ai.alertRange:ambushRange;const alerted=aiType==='guard'?absDx<=enemy.ai.alertRange&&verticalNear:(absDx<=effectiveAlertRange&&verticalNear);
      if(aiType==='ambush'&&alerted)enemy.ambushTriggered=true;
      enemy.isWalking=false;
      if(alerted){
        enemy.facing=dx<0?'left':'right';
        const profile=window.ENEMY_VISUAL_CONFIG?.entries?.[enemy.type]||{};const defaultMode=aiType==='ground'?1:aiType==='ranged'?2:(aiType==='boss'?Number(enemy.phaseConfig?.attackMode||enemy.bossConfig?.attackMode||3):(({chapter4_enemy_1:2,chapter4_enemy_5:2,chapter4_enemy_6:1,chapter4_enemy_7:2,chapter4_enemy_8:2})[enemy.type]||3));const profileMode=[1,2,3].includes(Number(enemy.ai.attackMode))?Number(enemy.ai.attackMode):([1,2,3].includes(Number(profile.attackMode))?Number(profile.attackMode):defaultMode);const meleeApproach=Math.max(100*WORLD_SCALE,worldW*.065);const meleeKeepOut=chapter4EnemyKeepOutGap(enemy);const engageDistance=profileMode===1?meleeApproach:profileMode===3?meleeKeepOut:Math.max(118*WORLD_SCALE,Math.min(230*WORLD_SCALE,enemy.ai.attackRange));
        const guard=aiType==='guard';const ranged=aiType==='ranged'||(profileMode===2&&aiType!=='legacy-runtime');const keepDistance=Math.max(40*WORLD_SCALE,enemy.ai.keepDistance||enemy.ai.attackRange*.8);
        if(samePlatform&&!guard&&(absDx>engageDistance||(ranged&&absDx<keepDistance))){
          let step=Math.min(Math.max(0,absDx-engageDistance),enemy.ai.movementSpeed*dt/1000);
          if(ranged&&absDx<keepDistance)step=-Math.min(keepDistance-absDx,enemy.ai.movementSpeed*dt/1000);
          enemy.x=clamp(enemy.x+Math.sign(dx)*step,Math.max(minX,leftBound),Math.min(maxX,rightBound));enemy.isWalking=Math.abs(step)>.2;
        }
        if((absDx<=engageDistance||!samePlatform)&&(!guard||absDx<=enemy.ai.attackRange)){
          if(now-enemy.lastAttack>=enemy.ai.attackCooldownMs&&(profileMode!==1||!enemy.groundCycleNormalNext||now>=(enemy.groundAttackLockUntil||0))){enemy.lastAttack=now;enemy.actionUntil=now+enemy.ai.attackPoseMs;enemy.pose='attack';
            const visual=window.ENEMY_VISUAL_CONFIG?.entries?.[enemy.type]||{};const mode=profileMode;
            const meleeRange=Math.max(100*WORLD_SCALE,worldW*.065);
            if(mode===1){
              // Enemy 6：每輪先腳下攻擊，整段預警／爆發／淡出完成後才接普通近距離攻擊。
              if(!enemy.groundCycleNormalNext){
                if(spawnGroundAttack(enemy,now)){
                  enemy.groundCycleNormalNext=true;
                  const visual=window.ENEMY_VISUAL_CONFIG?.entries?.[enemy.type]||{};
                  enemy.groundAttackLockUntil=now+1940+clamp(Number(visual.groundDuration)||850,250,3000);
                }else if(samePlatform&&absDx<=meleeRange&&hero.ground){
                  // 玩家不在固定平台（例如空中／移動平台）時，跳過腳下攻擊，保留普通攻擊。
                  takeEnemyDamage(enemy.ai.damage,`${enemy.type} 普通攻擊`,enemy.x);
                }
              }else if(now>=(enemy.groundAttackLockUntil||0)){
                if(samePlatform&&absDx<=meleeRange&&hero.ground)takeEnemyDamage(enemy.ai.damage,`${enemy.type} 普通攻擊`,enemy.x);
                enemy.groundCycleNormalNext=false;
              }
            }else if(samePlatform&&absDx<=meleeRange){if(hero.ground)takeEnemyDamage(enemy.ai.damage,`${enemy.type} 近距離攻擊`,enemy.x);}
            else if(mode===2)spawnEnemyOrb(enemy,now);
          }
        }
      }else{
        if(targets.length>=2){
          enemy.routeIndex=clamp(enemy.routeIndex||0,0,targets.length-1);
          const target=targets[enemy.routeIndex],delta=target-enemy.x;
          if(Math.abs(delta)<Math.max(4,enemy.w*.035)){
            enemy.routePause=(enemy.routePause||0)-dt;
            if(enemy.routePause<=0){
              if(enemy.patrol.mode==='loop')enemy.routeIndex=(enemy.routeIndex+1)%targets.length;
              else{let next=enemy.routeIndex+(enemy.routeDir||1);if(next>=targets.length||next<0){enemy.routeDir=-(enemy.routeDir||1);next=enemy.routeIndex+enemy.routeDir;}enemy.routeIndex=clamp(next,0,targets.length-1);}
              enemy.routePause=enemy.patrol.pauseSeconds*1000;
            }
          }else{const step=Math.min(Math.abs(delta),enemy.patrol.speed*dt/1000);enemy.x+=Math.sign(delta)*step;enemy.facing=delta<0?'left':'right';enemy.isWalking=step>.1;}
        }
      }
      if(enemy.hp<=0)continue;
      enemy.y=enemySurfaceAt(enemy,pose)-enemy.h;enemy.flash=Math.max(0,enemy.flash-dt);
      if(now>enemy.actionUntil&&now>enemy.hitUntil&&!enemy.isWalking)enemy.pose='normal';
      else if(enemy.isWalking&&now>enemy.hitUntil&&now>enemy.actionUntil)enemy.pose='walk';
    }
    updateEnemyProjectiles(dt,now);
    updateGroundAttacks(now);
  }
  function checkStageExit() {
    if (!stage || pendingTransition || transitionElapsed > 0) return;
    for (const ex of stage.exits || []) {
      const exX=Number(ex.x)*WORLD_SCALE, exY=Number(ex.y)*WORLD_SCALE, exW=Number(ex.width)*WORLD_SCALE, exH=Number(ex.height)*WORLD_SCALE;
      const overlap = hero.x < exX + exW / 2 && hero.x + hero.w > exX - exW / 2 && hero.y < exY + exH / 2 && hero.y + hero.h > exY - exH / 2;
      if (!overlap) continue;
      const target = stageById(ex.targetStageId), arrival = target?.transitions?.find(t => t.id === ex.targetTransitionId);
      if (!target || !arrival) { setStatus(`${ex.label || '關卡出口'} 尚未設定有效目的 Stage／轉場點。`); continue; }
      pendingTransition = { stageId: target.id, transitionId: arrival.id }; transitionElapsed = 1; transitionApplied = false; setStatus(`前往 ${target.name || target.id}……`); break;
    }
  }
  function applyPendingTransition() {
    if (!pendingTransition || transitionApplied || transitionElapsed < 220) return;
    const dest = pendingTransition; pendingTransition = null; transitionApplied = true; setStage(dest.stageId, dest.transitionId);
    if(dest.teleport&&hero){hero.x=clamp(dest.teleport.x-hero.w/2,0,Math.max(0,worldW-hero.w));hero.y=dest.teleport.y-hero.h;hero.vx=0;hero.vy=0;hero.ground=false;hero.platformId=null;hero.face=dest.teleport.face||1;}
  }
  function update(dt) {
    if (paused) return;
    updateUltimate(performance.now());
    if (transitionElapsed > 0) {
      transitionElapsed += dt; applyPendingTransition();
      if (transitionElapsed >= 440) { transitionElapsed = 0; transitionApplied = false; }
      return;
    }
    const scale = dt / 16.667;
    fallResetCooldown = Math.max(0, fallResetCooldown - dt);
    attackCooldown = Math.max(0, attackCooldown - dt); bashCooldown = Math.max(0, bashCooldown - dt); specialCooldown = Math.max(0, specialCooldown - dt);
    hero.attack = Math.max(0, hero.attack - dt); hero.bashAnim = Math.max(0, hero.bashAnim - dt); hero.specialAnim = Math.max(0, hero.specialAnim - dt); hero.specialEffect = Math.max(0, hero.specialEffect - dt); hero.dashCooldown = Math.max(0, hero.dashCooldown - dt); hero.invuln=Math.max(0,hero.invuln-dt);
    hitTimer = Math.max(0, hitTimer - dt); if (hitTimer <= 0) combo = 0;

    const oldPoses = platformPoses; motionTime += dt; platformPoses = computePoses(motionTime);
    if (hero.ground && hero.platformId) {
      const oldPose = oldPoses.get(hero.platformId), newPose = platformPoses.get(hero.platformId);
      if (oldPose && newPose) { hero.x += newPose.x1 - oldPose.x1; hero.y += newPose.y - oldPose.y; }
    }

    const inputLocked=performance.now()<hero.inputLockUntil;
    const ultimateMovementLocked=ultimateActive;
    const left = !inputLocked&&(keys.has('ArrowLeft') || keys.has('KeyA'));
    const right = !inputLocked&&(keys.has('ArrowRight') || keys.has('KeyD'));
    if(ultimateMovementLocked){
      hero.vx = 0;
    }else if(inputLocked){
      // 擊退前段保留慣性，之後煞停；整段時間忽略玩家方向輸入。
      hero.x += hero.vx * scale;
      hero.vx *= Math.pow(performance.now() < hero.knockbackUntil ? 0.94 : 0.55, scale);
    }else if (hero.dash > 0) {
      hero.x += hero.vx * scale; hero.dash -= dt;
      if (hero.dash <= 0) hero.vx *= .22;
      if (!hero.airDashHitDone && damageEnemy(sideHitbox(150, 112), '空中盾擊')) hero.airDashHitDone = true;
    } else {
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      if (dir) { hero.face = dir; hero.vx += dir * .72 * scale; hero.vx = clamp(hero.vx, -6.2, 6.2); }
      else hero.vx *= Math.pow(.78, scale);
      hero.x += hero.vx * scale;
    }
    hero.x = clamp(hero.x, 0, Math.max(0, worldW - hero.w));
    if (hero.ground) coyote = 105; else coyote = Math.max(0, coyote - dt);
    jumpBuffer = Math.max(0, jumpBuffer - dt);
    if (jumpBuffer > 0 && (hero.ground || coyote > 0)) { hero.vy = -12.8; hero.ground = false; hero.platformId = null; jumpBuffer = 0; coyote = 0; }

    const oldBottom = hero.y + hero.h;
    if (hero.dash <= 0) { hero.vy = Math.min(13, hero.vy + .48 * scale); hero.y += hero.vy * scale; }
    hero.ground = false; hero.platformId = null;
    let landed = null;
    if (hero.vy >= 0 && hero.dash <= 0) {
      const newBottom = hero.y + hero.h;
      for (const p of stage?.platforms || []) {
        const pose = platformPoses.get(p.id); if (!pose) continue;
        const segment=getStandSegment(p,pose),minX=Math.min(segment[0].x,segment[1].x),maxX=Math.max(segment[0].x,segment[1].x);
        const footLeft=hero.x+hero.w*.2,footRight=hero.x+hero.w*.8;
        const overlapLeft=Math.max(footLeft,minX),overlapRight=Math.min(footRight,maxX);
        if(overlapRight<overlapLeft)continue;
        const footX=clamp(hero.x+hero.w*.5,overlapLeft,overlapRight),surfaceY=lineYAtX(segment,footX);
        if(oldBottom<=surfaceY+4&&newBottom>=surfaceY){
          if(!landed||surfaceY<landed.y)landed={id:p.id,y:surfaceY};
        }
      }
    }
    if (landed) { hero.y = landed.y - hero.h; hero.vy = 0; hero.ground = true; hero.platformId = landed.id; hero.airDashUsed = false; }

    if (hero.y > worldH + 260) {
      const respawn=activeCheckpoint||stage.playerStart;
      if (respawn) { hero.x = Number(respawn.x) * WORLD_SCALE - hero.w / 2; hero.y = Number(respawn.y) * WORLD_SCALE - hero.h; hero.face=respawn.facing==='left'?-1:1; }
      else if (stage.platforms?.length) { const base = [...stage.platforms].sort((a,b)=>Number(b.y)-Number(a.y))[0]; const basePose = platformPose(base, motionTime), baseSurface = getStandSegment(base, basePose);
        hero.x = (basePose.x1 + basePose.x2) / 2 - hero.w / 2; hero.y = lineYAtX(baseSurface, hero.x + hero.w / 2) - hero.h; }
      else { hero.x = 50; hero.y = worldH - hero.h - 10; }
      hero.vx = 0; hero.vy = 0; hero.ground = false; hero.platformId = null; hero.airDashUsed = false; hero.airDashHitDone = false;
      if (fallResetCooldown <= 0) { setStatus('掉落：已返回開始位置'); fallResetCooldown = 900; }
    }
    updateStageObjects(performance.now());
    updateWaves(performance.now());
    updateEnemy(dt, scale); checkStageExit();
    cameraX = clamp(hero.x - VIEW_W * .45, 0, Math.max(0, worldW - VIEW_W));
    const targetY = clamp(hero.y + hero.h / 2 - VIEW_H * .55, 0, Math.max(0, worldH - VIEW_H));
    cameraY += (targetY - cameraY) * Math.min(1, .12 * scale);
    walkTime += dt;
  }
  function togglePause() { paused = !paused; $('pauseButton').setAttribute('aria-label', paused ? '繼續遊戲' : '暫停遊戲'); $('pauseOverlay').hidden = !paused; setStatus(paused ? '已暫停' : '繼續遊戲'); }
  function frame(time) { const dt = Math.min(34, Math.max(0, time - lastTime)); lastTime = time; update(dt); drawWorld(); requestAnimationFrame(frame); }
  function requestEditorProject() { try { if (window.opener && !window.opener.closed) window.opener.postMessage({ type: 'PRINCE_STAGE_TEST_REQUEST' }, '*'); } catch (_) {} }
  function validateProject(data) { return !!(data && Array.isArray(data.stages) && data.stages.length && data.stages.every(s => Array.isArray(s.platforms) && Array.isArray(s.exits) && Array.isArray(s.transitions))); }
  function receiveProject(data, mode = 'editor') {
    if (!validateProject(data.project)) { setStatus('Stage Editor 工程資料格式不正確。'); return; }
    project = clone(data.project); externalAssetData = {}; for (const item of project.assetLibrary || []) if (item?.path && item?.dataUrl) externalAssetData[item.path] = item.dataUrl; Object.assign(externalAssetData, data.assetData || {}); imageCache.clear(); sourceMode = mode;
    const targetId = data.stageId || project.currentStageId || project.stages[0].id;
    project.currentStageId = targetId;
    updateStageUi(); setStage(targetId);
  }
  function importJsonFile(file) {
    if (!file) return;
    const reader = new FileReader(); reader.onload = () => {
      try { const parsed = JSON.parse(reader.result); if (!validateProject(parsed)) throw new Error('schema');
        project = parsed; externalAssetData = {}; for (const item of project.assetLibrary || []) if (item?.path && item?.dataUrl) externalAssetData[item.path] = item.dataUrl; imageCache.clear(); sourceMode = 'json'; const id = project.currentStageId || project.stages[0].id; project.currentStageId = id; updateStageUi(); setStage(id); setStatus('已匯入 Stage Editor JSON，可直接測試。');
      } catch (_) { setStatus('JSON 匯入失敗：請選擇 Stage Editor 匯出的完整工程檔。'); }
    }; reader.readAsText(file);
  }

  window.addEventListener('message', event => {
    if (event.data?.type === 'PRINCE_STAGE_TEST_PROJECT') receiveProject(event.data, 'editor');
  });
  window.addEventListener('keydown', event => {
    if (event.target?.closest?.('input,select,textarea')) return;
    if (['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(event.code)) event.preventDefault();
    if (event.code === 'Escape' && !event.repeat) { togglePause(); return; }
    if(performance.now()<hero.inputLockUntil){keys.clear();return;}
    if (!event.repeat) unlockAudio(); keys.add(event.code);
    if ((event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') && !event.repeat) jump();
    if (event.code === 'KeyZ' && !event.repeat) thrustAttack();
    if (event.code === 'KeyX' && !event.repeat) shieldBash();
    if (event.code === 'KeyC' && !event.repeat) specialAttack();
    if (event.code === 'KeyQ' && !event.repeat) ultimateAttack();
  });
  window.addEventListener('keyup', event => keys.delete(event.code)); window.addEventListener('blur', () => keys.clear());
  const buttonActions = [
    { act: 'left', key: 'ArrowLeft', hold: true }, { act: 'jump' }, { act: 'right', key: 'ArrowRight', hold: true },
    { act: 'thrust' }, { act: 'bash' }, { act: 'special' }, { act: 'ultimate' }
  ];
  for (const info of buttonActions) {
    const button = document.querySelector(`[data-act="${info.act}"]`); if (!button) continue;
    button.addEventListener('pointerdown', event => { event.preventDefault();
      if(performance.now()<hero.inputLockUntil){keys.clear();return;}
      unlockAudio(); button.setPointerCapture?.(event.pointerId);
      if (info.hold) keys.add(info.key); if (info.act === 'jump') jump(); if (info.act === 'thrust') thrustAttack(); if (info.act === 'bash') shieldBash(); if (info.act === 'special') specialAttack(); if (info.act === 'ultimate') ultimateAttack();
    });
    const release = () => { if (info.hold) keys.delete(info.key); };
    ['pointerup','pointercancel','lostpointercapture','pointerleave'].forEach(type => button.addEventListener(type, release));
  }
  $('pauseButton').addEventListener('click', togglePause);
  $('musicToggle').addEventListener('click', () => { musicEnabled = !musicEnabled; $('musicToggle').textContent = musicEnabled ? '🎵 音樂：開' : '🔇 音樂：關'; if (musicEnabled) { unlockAudio(); startMusic(); } else { bgm.pause(); musicStarted = false; } });
  const stagePicker = $('stagePicker');
  if (stagePicker) stagePicker.addEventListener('change', event => { setStage(event.target.value); });
  const projectFile = $('projectFile');
  if (projectFile) projectFile.addEventListener('change', event => { importJsonFile(event.target.files?.[0]); event.target.value = ''; });
  const syncEditor = $('syncEditor');
  if (syncEditor) syncEditor.addEventListener('click', () => { requestEditorProject(); setStatus('正在向 Stage Editor 要求最新關卡資料……'); });

  // Shared read-only bridge for Enemy Visual Editor. The editor writes the existing
  // ENEMY_VISUAL_CONFIG object; drawWorld() reads it every frame for live preview.
  window.Chapter4EnemyVisualRuntime = {
    getRuntimeCapabilities(type) {
      const record=enemyRegistryRecord(type);
      return { registered:!!record, chapter4Supported:/^chapter4_enemy_\d+$/.test(String(type||'')), imageBridge:!!window.PrinceEnemyRegistryV2?.resolveSource, animations:Object.keys(record?.animations||{}) };
    },
    getEnemyStats(type) {
      const matches = enemies.filter(enemy => enemy.type === type);
      const first = matches[0];
      return {
        count: matches.length,
        stageId: currentStageId,
        stageName: stage?.name || currentStageId,
        frameSize: first ? `${Math.round(first.w / WORLD_SCALE)} × ${Math.round(first.h / WORLD_SCALE)} px（碰撞框）` : ''
      };
    },
    getStageInfo() {
      return { id: currentStageId, name: stage?.name || currentStageId, enemyCount: enemies.length };
    }
  };

  const requestedStageId = new URLSearchParams(window.location.search).get('stage') || window.CHAPTER4_START_STAGE || project.currentStageId;
  const startupStageId = exportedStageProject && stageById(requestedStageId) ? requestedStageId : demoStage.id;
  updateStageUi(); setStage(startupStageId);
  $('musicToggle').textContent = musicEnabled ? '🎵 音樂：開' : '🔇 音樂：關';
  if (exportedStageProject) setStatus(`已載入 js/prince-stage-config.js：${stage?.name || stage?.id} · 橫向世界 ${Math.round(worldW)}px`);
  // An open Stage Editor tab can still override this file with its latest unsaved in-memory project.
  requestEditorProject();
  requestAnimationFrame(frame);
})();
