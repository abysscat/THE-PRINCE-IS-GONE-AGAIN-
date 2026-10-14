/*
 * 遊戲設定資料（第二階段安全分拆）
 * 這個檔案只存放可調整的資料，不負責執行遊戲流程。
 * 修改關卡數量、圖片路徑、技能影格大小或線索文字時，可先查看這裡。
 */
window.GAME_SETTINGS = {
  // 每一關需要擊敗的敵人數量
  targets: [10, 12, 14, 16],

  // 各關卡背景圖片路徑
  backgroundFiles: [
    'images/bg/bg1.png',
    'images/bg/bg2.png',
    'images/bg/bg3.png',
    'images/bg/bg4.png'
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

  // 遊戲中可收集的三條線索（名稱、說明）
  clueItems: [
    ['王室徽章', '村民說，王子曾帶著徽章往森林方向離開。'],
    ['染血密信', '密信上寫著：「把王子帶往北方要塞。」'],
    ['披風碎片', '披風內側繡著暗號，指向要塞深處。']
  ]
};
