/*
 * 關卡與素材資料設定。
 * 一關的章節、名稱、目標數、背景與敵人名單都放在同一個 levels 項目中，避免第一章和第二章各自維護清單。
 * 本檔只存資料；尺寸、移動、戰鬥數值請修改 js/game-tuning.js。
 */
const GAME_LEVELS = [
  { chapter: 1, target: 10, name: '失蹤的起點', background: 'images/bg/bg1.png', enemies: ['skeleton'] },
  { chapter: 1, target: 12, name: '被遺棄的森林', background: 'images/bg/bg2.png', enemies: ['skeleton', 'archer', 'assassin'] },
  { chapter: 1, target: 14, name: '地下監牢', background: 'images/bg/bg3.png', enemies: ['archer', 'shield', 'skeleton', 'heavy', 'acolyte'] },
  { chapter: 1, target: 16, name: '黑暗要塞', background: 'images/bg/bg4.png', enemies: ['archer', 'shield', 'heavy', 'assassin', 'acolyte'], boss: true },
  { chapter: 2, target: 10, name: '封印之門', background: 'images/chapter2/bg/chapter2_stage_1_BG.png', enemies: ['skeleton', 'archer', 'assassin'], chapter2Enemies: true },
  { chapter: 2, target: 12, name: '失落的王室檔案', background: 'images/chapter2/bg/chapter2_stage_2_BG.png', enemies: ['archer', 'shield', 'heavy', 'acolyte'], chapter2Enemies: true },
  { chapter: 2, target: 14, name: '禁忌聖殿', background: 'images/chapter2/bg/chapter2_stage_3_BG.png', enemies: ['shield', 'heavy', 'assassin', 'acolyte'], chapter2Enemies: true },
  { chapter: 2, target: 18, name: '王國的真相', background: 'images/chapter2/bg/chapter2_stage_4_BG.png', enemies: ['archer', 'shield', 'heavy', 'assassin', 'acolyte'], chapter2Enemies: true, boss: true }
];

window.GAME_SETTINGS = {
  // 相容性衍生欄位：由 levels 自動產生，不要在這裡手動改一份重複清單。
  levels: GAME_LEVELS,
  targets: GAME_LEVELS.map(level => level.target),
  backgroundFiles: GAME_LEVELS.map(level => level.background),

  // Q 大絕動畫的 8 張圖片。
  ultimateSpriteFiles: Array.from(
    { length: 8 },
    (_, index) => 'images/hero_big%20skill/skin/' + (index + 1) + '.png'
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
    1: { id: 'king', name: '王室徽章', dialog: '你發現了一枚王室徽章，上面的紋章似乎屬於失蹤的王子。', frame: 'images/clues/king_layer1.png', item: 'images/clues/king_layer2.png', glow: 'images/clues/king_layer3.png' },
    2: { id: 'letter', name: '染血密信', dialog: '這封染血的密信似乎隱藏著秘密，信中的內容指向一場不為人知的陰謀。', frame: 'images/clues/letter_layer1.png', item: 'images/clues/letter_layer2.png', glow: 'images/clues/letter_layer3.png' },
    3: { id: 'piece', name: '披風碎片', dialog: '這片紫色披風似乎曾經屬於王子。附近或許還藏著最後的線索。', frame: 'images/clues/piece_layer1.png', item: 'images/clues/piece_layer2.png', glow: 'images/clues/piece_layer3.png' },
    5: { id: 'chapter2_clock', name: '古老時鐘', dialog: '時鐘的指針停在王子失蹤的那一刻。', frame: 'images/chapter2/clues/clock_layer1.png', item: 'images/chapter2/clues/clock_layer2.png', glow: 'images/chapter2/clues/clock_layer3.png' },
    6: { id: 'chapter2_jelwellery', name: '王室珠寶', dialog: '珠寶上的紋章揭示了王室深處的秘密。', frame: 'images/chapter2/clues/jelwellery_layer1.png', item: 'images/chapter2/clues/jelwellery_layer2.png', glow: 'images/chapter2/clues/jelwellery_layer3.png' },
    7: { id: 'chapter2_sword', name: '王者之劍', dialog: '這把劍似乎能開啟通往王國真相的道路。', frame: 'images/chapter2/clues/sword_layer1.png', item: 'images/chapter2/clues/sword_layer2.png', glow: 'images/chapter2/clues/sword_layer3.png' }
  }
};
