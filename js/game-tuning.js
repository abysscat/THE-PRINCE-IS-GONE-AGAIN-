/*
 * ============================================================
 * 新手集中調整表：大小、位置、移動、戰鬥與特效
 * ============================================================
 * 大部分遊戲調整先改這個檔案，不要再到多個 CSS 檔案找同一個角色。
 * 這是「設定資料」；真正執行遊戲流程的程式仍在 game.js。
 *
 * 長度可用 px / % / clamp(...) / calc(...). 例如 imageOffsetY: '20px'。
 * 比例 scale: 1 是原始大小；1.5 是放大 1.5 倍；0.8 是縮小 20%。
 * containerBottom 數值較大通常會向上；較小／負數通常會向下。
 */
(function () {
  'use strict';

  const TUNING = {
    // 女神本體尺寸、地面基準與手機畫面縮放。
    player: {
      width: '116px',
      height: '158px',
      mobileScale: 0.78,
      groundBottom: '14%',
      physics: {
        maxRun: 0.255,          // 水平最高速度；越大跑越快
        groundAccel: 0.00155,   // 地面加速
        groundBrake: 0.00215,   // 放開方向鍵後的煞車速度
        airAccel: 0.00082,      // 空中轉向能力
        gravity: 0.00205,       // 重力；越大落下越快
        jumpSpeed: 0.72,        // 起跳力量；越大跳越高
        maxFall: 0.92,           // 最大下落速度
        coyote: 105,             // 離開平台後仍可起跳的時間（毫秒）
        jumpBuffer: 120          // 提前按跳躍的輸入緩衝（毫秒）
      }
    },

    // 一般敵人外框尺寸。這裡控制外框，不直接裁切素材 PNG。
    enemySizes: {
      default: {
        width: 'clamp(112px, 11vw, 145px)',
        height: 'clamp(92px, 12vw, 120px)'
      },
      heavy: {
        width: 'clamp(128px, 12vw, 155px)',
        height: 'clamp(102px, 13vw, 130px)'
      },
      acolyte: {
        width: 'clamp(112px, 11vw, 145px)',
        height: 'clamp(92px, 12vw, 120px)'
      }
    },

    // 第二章普通敵人各自可以有不同的圖片縮放與上下偏移。
    // 不要修改名稱：它們必須和 data-sprite-type 對得上。
    chapter2Enemies: {
      containerWidth: 'clamp(112px, 11vw, 145px)',
      containerHeight: 'clamp(92px, 12vw, 120px)',
      sprites: {
        chapter2_enemy_1: { imageScale: 1, imageOffsetY: '0px' },
        chapter2_enemy_2: { imageScale: 1, imageOffsetY: '0px' },
        chapter2_enemy_3: { imageScale: 1, imageOffsetY: '0px' },
        chapter2_enemy_4: { imageScale: 1, imageOffsetY: '0px' },
        chapter2_enemy_5: { imageScale: 1, imageOffsetY: '0px' },
        chapter2_enemy_6: { imageScale: 1, imageOffsetY: '0px' },
        chapter2_enemy_7: { imageScale: 1, imageOffsetY: '0px' }
      }
    },

    // 三種 Boss 的外框位置和圖片大小分開設定。
    // 外框 bottom 控制整隻角色基準位置；imageOffsetY 只移動圖片。
    bosses: {
      chapter1: {
        containerWidth: '600px',
        containerHeight: '550px',
        containerBottom: '50px',
        imageScale: 0.7,
        imageOffsetY: '0px'
      },
      chapter2Boss1: {
        containerWidth: '600px',
        containerHeight: '500px',
        containerBottom: 'calc(14% - 30px)',
        imageScale: 1.5,
        imageOffsetY: '0px'
      },
      chapter2Boss2: {
        containerWidth: '600px',
        containerHeight: '550px',
        // 與隱藏 Boss 1 使用相近的地面基準，避免整個 Boss 下沉。
        containerBottom: 'calc(14% - 30px)',
        imageScale: 1.5,
        // 不再額外把圖片向下推 80px；調整的是整體站位，不改大小。
        imageOffsetY: '0px'
      }
    },

    // 敵人生命值。boss 是 Boss 的最大生命值；default 是沒列出的普通敵人。
    enemyHP: {
      boss: 10,
      heavy: 4,
      shield: 4,
      assassin: 3,
      acolyte: 3,
      default: 2
    },

    // 敵人追近速度、攻擊間隔與傷害。數字大不一定代表遊戲更好玩，請少量測試。
    enemyAI: {
      approachSpeed: {
        assassin: 0.22,
        heavy: 0.10,
        shield: 0.10,
        acolyte: 0.12,
        default: 0.15
      },
      attackCooldownMs: {
        assassin: 1150,
        acolyte: 1150,
        boss: 950,
        default: 1700
      },
      incomingDamage: {
        boss: 8,
        heavy: 5,
        assassin: 4,
        acolyte: 3,
        archer: 3,
        default: 2
      },
      spawnIntervalMs: 1350
    },

    // 女神攻擊傷害與間隔。特殊技仍然消耗 30 MP，這裡只控制傷害與動作冷卻。
    combat: {
      attackCooldownMs: { thrust: 260, bash: 430, special: 850 },
      damage: { thrust: 1, bash: 2, special: 3, shieldThrust: 0.5 },
      ultimateDamage: { default: 5, shield: 2.5 },
      ultimateCooldownMs: 12000
    },

    // 特效時間（毫秒）。延長死亡保留時間不會增加敵人血量或改變關卡目標。
    effects: {
      floatTextMs: 950,
      heroAttackPoseMs: 520,
      heroAttackClassMs: 190,
      enemyHitPoseMs: 300,
      ultimateEnemyHitPoseMs: 360,
      enemyAttackPoseMs: 420,
      enemyHitFlashMs: 140,
      ultimateHitFlashMs: 180,
      deathHitPoseMs: 150,
      hitCounterMs: 600,
      ultimateHitCounterMs: 700,
      ultimateChargeMs: 800,
      ultimateReleaseMs: 360,
      ultimateRingMs: 760,
      corpseFadeDelayMs: 1650,
      corpseRemoveDelayMs: 2450,
      deathFadeMs: 800,
      enemyHitAnimationMs: 180,
      cluePulseSeconds: 1.8,
      clueRevealMs: 650
    }
  };

  // 將設定傳給 game.js。
  window.GAME_TUNING = TUNING;

  // 把外觀資料轉成 CSS 變數，讓 10-game-tuning.css 成為統一的樣式套用層。
  const root = document.documentElement;
  const set = (name, value) => {
    if (value !== undefined && value !== null) root.style.setProperty(name, String(value));
  };
  const pxMs = value => `${Number(value)}ms`;

  set('--tune-hero-width', TUNING.player.width);
  set('--tune-hero-height', TUNING.player.height);
  set('--tune-hero-mobile-scale', TUNING.player.mobileScale);
  set('--tune-ground-bottom', TUNING.player.groundBottom);
  set('--tune-enemy-width', TUNING.enemySizes.default.width);
  set('--tune-enemy-height', TUNING.enemySizes.default.height);
  set('--tune-heavy-width', TUNING.enemySizes.heavy.width);
  set('--tune-heavy-height', TUNING.enemySizes.heavy.height);
  set('--tune-acolyte-width', TUNING.enemySizes.acolyte.width);
  set('--tune-acolyte-height', TUNING.enemySizes.acolyte.height);
  set('--tune-c2-enemy-width', TUNING.chapter2Enemies.containerWidth);
  set('--tune-c2-enemy-height', TUNING.chapter2Enemies.containerHeight);

  Object.entries(TUNING.chapter2Enemies.sprites).forEach(([type, sprite]) => {
    const cssType = type.replaceAll('_', '-');
    set(`--tune-${cssType}-scale`, sprite.imageScale ?? 1);
    set(`--tune-${cssType}-y`, sprite.imageOffsetY ?? '0px');
  });

  const bossCss = [
    ['c1-boss', TUNING.bosses.chapter1],
    ['c2-boss1', TUNING.bosses.chapter2Boss1],
    ['c2-boss2', TUNING.bosses.chapter2Boss2]
  ];
  bossCss.forEach(([prefix, boss]) => {
    set(`--tune-${prefix}-width`, boss.containerWidth);
    set(`--tune-${prefix}-height`, boss.containerHeight);
    set(`--tune-${prefix}-bottom`, boss.containerBottom);
    set(`--tune-${prefix}-scale`, boss.imageScale ?? 1);
    set(`--tune-${prefix}-y`, boss.imageOffsetY ?? '0px');
  });

  set('--tune-death-fade-ms', pxMs(TUNING.effects.deathFadeMs));
  set('--tune-enemy-hit-animation-ms', pxMs(TUNING.effects.enemyHitAnimationMs));
  set('--tune-clue-pulse-seconds', `${TUNING.effects.cluePulseSeconds}s`);
  set('--tune-clue-reveal-ms', pxMs(TUNING.effects.clueRevealMs));
})();
