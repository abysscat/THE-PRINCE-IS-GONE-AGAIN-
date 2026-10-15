/*
 * 遊戲設定資料（第二階段安全分拆）
 * 這個檔案只存放可調整的資料，不負責執行遊戲流程。
 * 修改關卡數量、圖片路徑、技能影格大小或線索文字時，可先查看這裡。
 */
window.GAME_SETTINGS = {
  // 每一關需要擊敗的敵人數量
  targets: [10, 12, 14, 16, 10, 12, 14, 18],

  // 八關資料：第二章先重用現有背景作為佔位，之後可逐關替換。
  levels: [
    { chapter: 1, name: '失蹤的起點', background: 'images/bg/bg1.png', enemies: ['skeleton'] },
    { chapter: 1, name: '被遺棄的森林', background: 'images/bg/bg2.png', enemies: ['skeleton', 'archer', 'assassin'] },
    { chapter: 1, name: '地下監牢', background: 'images/bg/bg3.png', enemies: ['archer', 'shield', 'skeleton', 'heavy', 'acolyte'] },
    { chapter: 1, name: '黑暗要塞', background: 'images/bg/bg4.png', enemies: ['archer', 'shield', 'heavy', 'assassin', 'acolyte'], boss: true },
    { chapter: 2, name: '封印之門', background: 'images/chapter2/bg/chapter2_stage_1_BG.png', enemies: ['skeleton', 'archer', 'assassin'], chapter2Enemies: true },
    { chapter: 2, name: '失落的王室檔案', background: 'images/chapter2/bg/chapter2_stage_2_BG.png', enemies: ['archer', 'shield', 'heavy', 'acolyte'], chapter2Enemies: true },
    { chapter: 2, name: '禁忌聖殿', background: 'images/chapter2/bg/chapter2_stage_3_BG.png', enemies: ['shield', 'heavy', 'assassin', 'acolyte'], chapter2Enemies: true },
    { chapter: 2, name: '王國的真相', background: 'images/chapter2/bg/chapter2_stage_4_BG.png', enemies: ['archer', 'shield', 'heavy', 'assassin', 'acolyte'], chapter2Enemies: true, boss: true }
  ],

  // 各關卡背景圖片路徑
  backgroundFiles: [
    'images/bg/bg1.png',
    'images/bg/bg2.png',
    'images/bg/bg3.png',
    'images/bg/bg4.png',
    'images/chapter2/bg/chapter2_stage_1_BG.png',
    'images/chapter2/bg/chapter2_stage_2_BG.png',
    'images/chapter2/bg/chapter2_stage_3_BG.png',
    'images/chapter2/bg/chapter2_stage_4_BG.png'
  ],

  // 大絕動畫使用的 8 張圖片
  ultimateSpriteFiles: Array.from(
    { length: 8 },
    (_, index) => 'images/hero_big%20skill/skin/' + (index + 1) + '.png'
  ),

  // 一般角色動作圖片
  heroSpriteFiles: [
    'images/hero_stand.png',
    'images/hero_jump.png',
    'images/hero_thrust.png',
    'images/hero_bash.png',
    'images/hero_walk_1.png',
    'images/hero_walk_2.png',
    'images/hero_walk_3.png',
    'images/hero_walk_4.png'
  ],

  // 大絕每張影格的顯示倍率；第 8 張保持 1.00
  ultimateFrameScales: [1, 1, 2.325, 2.13, 2.025, 1.80, 1.68, 1.00],

  // 六件線索：第一章三件＋第二章 clock、jelwellery、sword 三件。
  clueItems: [
    ['王室徽章', '村民說，王子曾帶著徽章往森林方向離開。'],
    ['染血密信', '密信上寫著：「把王子帶往北方要塞。」'],
    ['披風碎片', '披風內側繡著暗號，指向要塞深處。'],
    ['封印印記', '古老的印記顯示，王室曾封鎖一條秘密通道。'],
    ['古老時鐘', '時鐘的指針停在王子失蹤的那一刻。'],
    ['王室珠寶', '珠寶上的紋章揭示了王室深處的秘密。'],
    ['王者之劍', '這把劍似乎能開啟通往王國真相的道路。']
  ]
};
