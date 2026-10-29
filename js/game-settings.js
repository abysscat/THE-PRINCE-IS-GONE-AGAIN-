/*
 * 關卡與素材資料設定。
 * 一關的章節、名稱、目標數、背景與敵人名單都放在同一個 levels 項目中，避免第一章和第二章各自維護清單。
 * 本檔只存資料；尺寸、移動、戰鬥數值請修改 js/game-tuning.js。
 */
// 每一列就是一關：chapter=章節編號、target=通關目標、name=關卡名稱、background=背景圖片路徑、enemies=可出現的敵人種類；boss:true 代表這關有 Boss。
const GAME_LEVELS = [
  { chapter: 1, target: 10, name: '失蹤的起點', background: 'images/chapter1/bg/chapter1_BG1.png', enemies: ['skeleton'] },
  { chapter: 1, target: 12, name: '被遺棄的森林', background: 'images/chapter1/bg/chapter1_BG2.png', enemies: ['skeleton', 'archer', 'assassin'] },
  { chapter: 1, target: 14, name: '地下監牢', background: 'images/chapter1/bg/chapter1_BG3.png', enemies: ['archer', 'shield', 'skeleton', 'heavy', 'acolyte'] },
  { chapter: 1, target: 16, name: '黑暗要塞', background: 'images/chapter1/bg/chapter1_BG4.png', enemies: ['archer', 'shield', 'heavy', 'assassin', 'acolyte'], boss: true },
  { chapter: 2, target: 10, name: '封印之門', background: 'images/chapter2/bg/chapter2_stage_1_BG.png', enemies: ['skeleton', 'archer', 'assassin'], chapter2Enemies: true },
  { chapter: 2, target: 12, name: '失落的王室檔案', background: 'images/chapter2/bg/chapter2_stage_2_BG.png', enemies: ['archer', 'shield', 'heavy', 'acolyte'], chapter2Enemies: true },
  { chapter: 2, target: 14, name: '禁忌聖殿', background: 'images/chapter2/bg/chapter2_stage_3_BG.png', enemies: ['shield', 'heavy', 'assassin', 'acolyte'], chapter2Enemies: true },
  { chapter: 2, target: 18, name: '王國的真相', background: 'images/chapter2/bg/chapter2_stage_4_BG.png', enemies: ['archer', 'shield', 'heavy', 'assassin', 'acolyte'], chapter2Enemies: true, boss: true },
  // 第 9 關：水晶洞升降機與五波戰鬥；完成後接到碼頭全景。
  { chapter: 3, target: 25, name: '水晶洞升降機', background: 'images/chapter3/bg3/chapter3_stage_1_BG_layer1.png', enemies: ['assassin'], elevator: true, music: 'audio/ghost.ogg' },
  // 第 10 關：電梯後先抵達 chapter3_bg22。此區是無敵人的過場探索關。
  { chapter: 3, target: 0, name: '海港上岸', background: 'images/chapter3/bg3/chapter3_bg22.png', enemies: [], noEnemies: true, groundBottom: '14%' },
  // 第 11–14 關：沿用既有的第三章背景與敵人素材。
  { chapter: 3, target: 12, name: '海港通道', background: 'images/chapter3/bg3/chapter3_stage_3_BG.png', enemies: ['chapter3_enemy_2', 'chapter3_enemy_3'], chapter3Enemies: true, groundBottom: '14%', music: 'audio/Monster waves.ogg' },
  { chapter: 3, target: 14, name: '倉庫外圍', background: 'images/chapter3/bg3/chapter3_stage_4_BG.png', enemies: ['chapter3_enemy_4', 'chapter3_enemy_5'], chapter3Enemies: true, groundBottom: '14%', music: 'audio/Monster waves.ogg' },
  { chapter: 3, target: 14, name: '水手廚房', background: 'images/chapter3/bg3/chapter3_stage_5_BG.png', enemies: ['chapter3_enemy_6', 'chapter3_enemy_7'], chapter3Enemies: true, groundBottom: '14%', music: 'audio/Monster waves.ogg' },
  { chapter: 3, target: 18, name: '港口主廚區', background: 'images/chapter3/bg3/chapter3_stage_6_BG.png', enemies: ['chapter3_enemy_2', 'chapter3_enemy_3', 'chapter3_enemy_4', 'chapter3_enemy_5', 'chapter3_enemy_6', 'chapter3_enemy_7', 'chapter3_enemy_8'], chapter3Enemies: true, groundBottom: '14%', music: 'audio/Monster waves.ogg' },
  // 第 15 關：真正可戰鬥的第三章雷暴 Boss 關，開場直接召喚 Boss。
  { chapter: 3, target: 1, name: '雷暴海王', background: 'images/chapter3/bg3/chapter3_stage_7_layer1_bg.png', enemies: [], chapter3Boss: true, boss: true, groundBottom: '14%', music: 'audio/Monster waves.ogg' }
];

window.GAME_SETTINGS = {
  // 相容性衍生欄位：由 levels 自動產生，不要在這裡手動改一份重複清單。
  levels: GAME_LEVELS,
  targets: GAME_LEVELS.map(level => level.target),
  backgroundFiles: GAME_LEVELS.map(level => level.background),

  // Q 大絕動畫的 8 格圖片清單。第 8 格與第 1 格完全相同，因此共用第 1 格，減少一份重複檔案。
  ultimateSpriteFiles: [1, 2, 3, 4, 5, 6, 7, 1].map(
    frame => 'images/hero/hero_big_skill/skin/' + frame + '.png'
  ),

  // 女神常用動作圖片預載清單。
  heroSpriteFiles: [
    'images/hero/hero_stand.png',
    'images/hero/hero_jump.png',
    'images/hero/hero_thrust.png',
    'images/hero/hero_bash.png',
    'images/hero/hero_walk_1.png',
    'images/hero/hero_walk_2.png',
    'images/hero/hero_walk_3.png',
    'images/hero/hero_walk_4.png'
  ],

  // Q 大絕每張影格獨立倍率；第 8 張保持原大。
  ultimateFrameScales: [1, 1, 2.325, 2.13, 2.025, 1.80, 1.68, 1.00],

  // 每關線索的名稱、說明和分層圖片路徑。未在此列出的關卡不會掉落線索。
  cluesByLevel: {
    1: { id: 'king', name: '王室徽章', dialog: '你發現了一枚王室徽章，上面的紋章似乎屬於失蹤的王子。', frame: 'images/chapter1/clues/king_layer1.png', item: 'images/chapter1/clues/king_layer2.png', glow: 'images/chapter1/clues/king_layer3.png' },
    2: { id: 'letter', name: '染血密信', dialog: '這封染血的密信似乎隱藏著秘密，信中的內容指向一場不為人知的陰謀。', frame: 'images/chapter1/clues/letter_layer1.png', item: 'images/chapter1/clues/letter_layer2.png', glow: 'images/chapter1/clues/letter_layer3.png' },
    3: { id: 'piece', name: '披風碎片', dialog: '這片紫色披風似乎曾經屬於王子。附近或許還藏著最後的線索。', frame: 'images/chapter1/clues/piece_layer1.png', item: 'images/chapter1/clues/piece_layer2.png', glow: 'images/chapter1/clues/piece_layer3.png' },
    5: { id: 'chapter2_clock', name: '古老時鐘', dialog: '時鐘的指針停在王子失蹤的那一刻。', frame: 'images/chapter2/clues/clock_layer1.png', item: 'images/chapter2/clues/clock_layer2.png', glow: 'images/chapter2/clues/clock_layer3.png' },
    6: { id: 'chapter2_jelwellery', name: '王室珠寶', dialog: '珠寶上的紋章揭示了王室深處的秘密。', frame: 'images/chapter2/clues/jelwellery_layer1.png', item: 'images/chapter2/clues/jelwellery_layer2.png', glow: 'images/chapter2/clues/jelwellery_layer3.png' },
    7: { id: 'chapter2_sword', name: '王者之劍', dialog: '這把劍似乎能開啟通往王國真相的道路。', frame: 'images/chapter2/clues/sword_layer1.png', item: 'images/chapter2/clues/sword_layer2.png', glow: 'images/chapter2/clues/sword_layer3.png' }
  }
};
