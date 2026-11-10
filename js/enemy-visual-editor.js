/* ENEMY VISUAL EDITOR V2.0 — Chapter → Enemy → individual sprite pose controls. */
(() => {
  'use strict';
  const STORAGE_KEY='prince-game.enemy-visual-editor.v1';
  const CONFIG_VERSION=String(window.ENEMY_VISUAL_CONFIG?.configVersion||'enemy-visual-v2.0');
  const LEGACY_TARGETS=[{"id":"chapter1_enemy_1","chapter":1,"group":"enemy","label":"Enemy 1 · 刺客","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"assassin\"]","assets":[{"pose":"attack","src":"images/chapter1/enemies/1/chapter1_enemy_1_attack.webp"},{"pose":"hit","src":"images/chapter1/enemies/1/chapter1_enemy_1_hit.webp"},{"pose":"idle","src":"images/chapter1/enemies/1/chapter1_enemy_1_idle.webp"},{"pose":"normal","src":"images/chapter1/enemies/1/chapter1_enemy_1_normal.webp"},{"pose":"walk1","src":"images/chapter1/enemies/1/chapter1_enemy_1_walk1.webp"},{"pose":"walk2","src":"images/chapter1/enemies/1/chapter1_enemy_1_walk2.webp"},{"pose":"walk3","src":"images/chapter1/enemies/1/chapter1_enemy_1_walk3.webp"},{"pose":"walk4","src":"images/chapter1/enemies/1/chapter1_enemy_1_walk4.webp"}]},{"id":"chapter1_enemy_2","chapter":1,"group":"enemy","label":"Enemy 2 · 盾牌兵／重裝精英","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"shield\"], #enemies > .enemy[data-sprite-type=\"heavy\"]","assets":[{"pose":"attack","src":"images/chapter1/enemies/2/chapter1_enemy_2_attack.webp"},{"pose":"hit","src":"images/chapter1/enemies/2/chapter1_enemy_2_hit.webp"},{"pose":"idle","src":"images/chapter1/enemies/2/chapter1_enemy_2_idle.webp"},{"pose":"normal","src":"images/chapter1/enemies/2/chapter1_enemy_2_normal.webp"},{"pose":"walk1","src":"images/chapter1/enemies/2/chapter1_enemy_2_walk1.webp"},{"pose":"walk2","src":"images/chapter1/enemies/2/chapter1_enemy_2_walk2.webp"},{"pose":"walk3","src":"images/chapter1/enemies/2/chapter1_enemy_2_walk3.webp"},{"pose":"walk4","src":"images/chapter1/enemies/2/chapter1_enemy_2_walk4.webp"}]},{"id":"chapter1_enemy_3","chapter":1,"group":"enemy","label":"Enemy 3 · 精英級","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"acolyte\"]","assets":[{"pose":"attack","src":"images/chapter1/enemies/3/chapter1_enemy_3_attack.webp"},{"pose":"hit","src":"images/chapter1/enemies/3/chapter1_enemy_3_hit.webp"},{"pose":"idle","src":"images/chapter1/enemies/3/chapter1_enemy_3_idle.webp"},{"pose":"normal","src":"images/chapter1/enemies/3/chapter1_enemy_3_normal.webp"},{"pose":"walk1","src":"images/chapter1/enemies/3/chapter1_enemy_3_walk1.webp"},{"pose":"walk2","src":"images/chapter1/enemies/3/chapter1_enemy_3_walk2.webp"},{"pose":"walk3","src":"images/chapter1/enemies/3/chapter1_enemy_3_walk3.webp"},{"pose":"walk4","src":"images/chapter1/enemies/3/chapter1_enemy_3_walk4.webp"}]},{"id":"chapter1_enemy_4","chapter":1,"group":"enemy","label":"Enemy 4 · 弓箭手","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"archer\"]","assets":[{"pose":"attack","src":"images/chapter1/enemies/4/chapter1_enemy_4_attack.webp"},{"pose":"hit","src":"images/chapter1/enemies/4/chapter1_enemy_4_hit.webp"},{"pose":"idle","src":"images/chapter1/enemies/4/chapter1_enemy_4_idle.webp"},{"pose":"normal","src":"images/chapter1/enemies/4/chapter1_enemy_4_normal.webp"},{"pose":"walk1","src":"images/chapter1/enemies/4/chapter1_enemy_4_walk1.webp"},{"pose":"walk2","src":"images/chapter1/enemies/4/chapter1_enemy_4_walk2.webp"},{"pose":"walk3","src":"images/chapter1/enemies/4/chapter1_enemy_4_walk3.webp"},{"pose":"walk4","src":"images/chapter1/enemies/4/chapter1_enemy_4_walk4.webp"}]},{"id":"chapter1_enemy_5","chapter":1,"group":"enemy","label":"Enemy 5 · 普通兵","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"skeleton\"]","assets":[{"pose":"attack","src":"images/chapter1/enemies/5/chapter1_enemy_5_attack.webp"},{"pose":"hit","src":"images/chapter1/enemies/5/chapter1_enemy_5_hit.webp"},{"pose":"idle","src":"images/chapter1/enemies/5/chapter1_enemy_5_idle.webp"},{"pose":"normal","src":"images/chapter1/enemies/5/chapter1_enemy_5_normal.webp"},{"pose":"walk1","src":"images/chapter1/enemies/5/chapter1_enemy_5_walk1.webp"},{"pose":"walk2","src":"images/chapter1/enemies/5/chapter1_enemy_5_walk2.webp"},{"pose":"walk3","src":"images/chapter1/enemies/5/chapter1_enemy_5_walk3.webp"},{"pose":"walk4","src":"images/chapter1/enemies/5/chapter1_enemy_5_walk4.webp"}]},{"id":"chapter1_boss_1","chapter":1,"group":"boss","label":"Boss 1 · 皇廷看更隊長","kind":"boss","selector":"#enemies > .enemy[data-sprite-type=\"boss\"]","assets":[{"pose":"attack","src":"images/chapter1/boss/chapter1_boss_1_attack.webp"},{"pose":"attack_skin_1","src":"images/chapter1/boss/chapter1_boss_1_attack_skin 1.webp"},{"pose":"attack_skin2","src":"images/chapter1/boss/chapter1_boss_1_attack_skin2.webp"},{"pose":"hit","src":"images/chapter1/boss/chapter1_boss_1_hit.webp"},{"pose":"idle","src":"images/chapter1/boss/chapter1_boss_1_idle.webp"},{"pose":"normal","src":"images/chapter1/boss/chapter1_boss_1_normal.webp"},{"pose":"walk1","src":"images/chapter1/boss/chapter1_boss_1_walk1.webp"},{"pose":"walk2","src":"images/chapter1/boss/chapter1_boss_1_walk2.webp"},{"pose":"walk3","src":"images/chapter1/boss/chapter1_boss_1_walk3.webp"},{"pose":"walk4","src":"images/chapter1/boss/chapter1_boss_1_walk4.webp"}]},{"id":"chapter2_enemy_1","chapter":2,"group":"enemy","label":"Enemy 1","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter2_enemy_1\"]","assets":[{"pose":"attack","src":"images/chapter2/enemies/chapter2_enemy_1/chapter2_enemy_1_attack.webp"},{"pose":"hit","src":"images/chapter2/enemies/chapter2_enemy_1/chapter2_enemy_1_hit.webp"},{"pose":"idle","src":"images/chapter2/enemies/chapter2_enemy_1/chapter2_enemy_1_idle.webp"},{"pose":"normal","src":"images/chapter2/enemies/chapter2_enemy_1/chapter2_enemy_1_normal.webp"},{"pose":"walk1","src":"images/chapter2/enemies/chapter2_enemy_1/chapter2_enemy_1_walk1.webp"},{"pose":"walk2","src":"images/chapter2/enemies/chapter2_enemy_1/chapter2_enemy_1_walk2.webp"},{"pose":"walk3","src":"images/chapter2/enemies/chapter2_enemy_1/chapter2_enemy_1_walk3.webp"},{"pose":"walk4","src":"images/chapter2/enemies/chapter2_enemy_1/chapter2_enemy_1_walk4.webp"}]},{"id":"chapter2_enemy_2","chapter":2,"group":"enemy","label":"Enemy 2","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter2_enemy_2\"]","assets":[{"pose":"attack","src":"images/chapter2/enemies/chapter2_enemy_2/chapter2_enemy_2_attack.webp"},{"pose":"hit","src":"images/chapter2/enemies/chapter2_enemy_2/chapter2_enemy_2_hit.webp"},{"pose":"idle","src":"images/chapter2/enemies/chapter2_enemy_2/chapter2_enemy_2_idle.webp"},{"pose":"normal","src":"images/chapter2/enemies/chapter2_enemy_2/chapter2_enemy_2_normal.webp"},{"pose":"walk1","src":"images/chapter2/enemies/chapter2_enemy_2/chapter2_enemy_2_walk1.webp"},{"pose":"walk2","src":"images/chapter2/enemies/chapter2_enemy_2/chapter2_enemy_2_walk2.webp"},{"pose":"walk3","src":"images/chapter2/enemies/chapter2_enemy_2/chapter2_enemy_2_walk3.webp"},{"pose":"walk4","src":"images/chapter2/enemies/chapter2_enemy_2/chapter2_enemy_2_walk4.webp"}]},{"id":"chapter2_enemy_3","chapter":2,"group":"enemy","label":"Enemy 3","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter2_enemy_3\"]","assets":[{"pose":"attack","src":"images/chapter2/enemies/chapter2_enemy_3/chapter2_enemy_3_attack.webp"},{"pose":"hit","src":"images/chapter2/enemies/chapter2_enemy_3/chapter2_enemy_3_hit.webp"},{"pose":"idle","src":"images/chapter2/enemies/chapter2_enemy_3/chapter2_enemy_3_idle.webp"},{"pose":"normal","src":"images/chapter2/enemies/chapter2_enemy_3/chapter2_enemy_3_normal.webp"},{"pose":"walk1","src":"images/chapter2/enemies/chapter2_enemy_3/chapter2_enemy_3_walk1.webp"},{"pose":"walk2","src":"images/chapter2/enemies/chapter2_enemy_3/chapter2_enemy_3_walk2.webp"},{"pose":"walk3","src":"images/chapter2/enemies/chapter2_enemy_3/chapter2_enemy_3_walk3.webp"},{"pose":"walk4","src":"images/chapter2/enemies/chapter2_enemy_3/chapter2_enemy_3_walk4.webp"}]},{"id":"chapter2_enemy_4","chapter":2,"group":"enemy","label":"Enemy 4","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter2_enemy_4\"]","assets":[{"pose":"attack","src":"images/chapter2/enemies/chapter2_enemy_4/chapter2_enemy_4_attack.webp"},{"pose":"hit","src":"images/chapter2/enemies/chapter2_enemy_4/chapter2_enemy_4_hit.webp"},{"pose":"idle","src":"images/chapter2/enemies/chapter2_enemy_4/chapter2_enemy_4_idle.webp"},{"pose":"normal","src":"images/chapter2/enemies/chapter2_enemy_4/chapter2_enemy_4_normal.webp"},{"pose":"walk1","src":"images/chapter2/enemies/chapter2_enemy_4/chapter2_enemy_4_walk1.webp"},{"pose":"walk2","src":"images/chapter2/enemies/chapter2_enemy_4/chapter2_enemy_4_walk2.webp"},{"pose":"walk3","src":"images/chapter2/enemies/chapter2_enemy_4/chapter2_enemy_4_walk3.webp"},{"pose":"walk4","src":"images/chapter2/enemies/chapter2_enemy_4/chapter2_enemy_4_walk4.webp"}]},{"id":"chapter2_enemy_5","chapter":2,"group":"enemy","label":"Enemy 5","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter2_enemy_5\"]","assets":[{"pose":"attack","src":"images/chapter2/enemies/chapter2_enemy_5/chapter2_enemy_5_attack.webp"},{"pose":"hit","src":"images/chapter2/enemies/chapter2_enemy_5/chapter2_enemy_5_hit.webp"},{"pose":"idle","src":"images/chapter2/enemies/chapter2_enemy_5/chapter2_enemy_5_idle.webp"},{"pose":"normal","src":"images/chapter2/enemies/chapter2_enemy_5/chapter2_enemy_5_normal.webp"},{"pose":"walk1","src":"images/chapter2/enemies/chapter2_enemy_5/chapter2_enemy_5_walk1.webp"},{"pose":"walk2","src":"images/chapter2/enemies/chapter2_enemy_5/chapter2_enemy_5_walk2.webp"},{"pose":"walk3","src":"images/chapter2/enemies/chapter2_enemy_5/chapter2_enemy_5_walk3.webp"},{"pose":"walk4","src":"images/chapter2/enemies/chapter2_enemy_5/chapter2_enemy_5_walk4.webp"}]},{"id":"chapter2_enemy_6","chapter":2,"group":"enemy","label":"Enemy 6","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter2_enemy_6\"]","assets":[{"pose":"attack","src":"images/chapter2/enemies/chapter2_enemy_6/chapter2_enemy_6_attack.webp"},{"pose":"hit","src":"images/chapter2/enemies/chapter2_enemy_6/chapter2_enemy_6_hit.webp"},{"pose":"idle","src":"images/chapter2/enemies/chapter2_enemy_6/chapter2_enemy_6_idle.webp"},{"pose":"normal","src":"images/chapter2/enemies/chapter2_enemy_6/chapter2_enemy_6_normal.webp"},{"pose":"walk1","src":"images/chapter2/enemies/chapter2_enemy_6/chapter2_enemy_6_walk1.webp"},{"pose":"walk2","src":"images/chapter2/enemies/chapter2_enemy_6/chapter2_enemy_6_walk2.webp"},{"pose":"walk3","src":"images/chapter2/enemies/chapter2_enemy_6/chapter2_enemy_6_walk3.webp"},{"pose":"walk4","src":"images/chapter2/enemies/chapter2_enemy_6/chapter2_enemy_6_walk4.webp"}]},{"id":"chapter2_enemy_7","chapter":2,"group":"enemy","label":"Enemy 7","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter2_enemy_7\"]","assets":[{"pose":"attack","src":"images/chapter2/enemies/chapter2_enemy_7/chapter2_enemy_7_attack.webp"},{"pose":"hit","src":"images/chapter2/enemies/chapter2_enemy_7/chapter2_enemy_7_hit.webp"},{"pose":"idle","src":"images/chapter2/enemies/chapter2_enemy_7/chapter2_enemy_7_idle.webp"},{"pose":"normal","src":"images/chapter2/enemies/chapter2_enemy_7/chapter2_enemy_7_normal.webp"},{"pose":"walk1","src":"images/chapter2/enemies/chapter2_enemy_7/chapter2_enemy_7_walk1.webp"},{"pose":"walk2","src":"images/chapter2/enemies/chapter2_enemy_7/chapter2_enemy_7_walk2.webp"},{"pose":"walk3","src":"images/chapter2/enemies/chapter2_enemy_7/chapter2_enemy_7_walk3.webp"},{"pose":"walk4","src":"images/chapter2/enemies/chapter2_enemy_7/chapter2_enemy_7_walk4.webp"}]},{"id":"chapter2_boss_1","chapter":2,"group":"boss","label":"Boss 1 · 隱藏頭目","kind":"boss","selector":"#enemies > .enemy[data-sprite-type=\"chapter2_boss_1\"]","assets":[{"pose":"attack","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_attack.webp"},{"pose":"hit","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_hit.webp"},{"pose":"idle","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_idle.webp"},{"pose":"normal","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_normal.webp"},{"pose":"walk1","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_walk1.webp"},{"pose":"walk2","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_walk2.webp"},{"pose":"walk3","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_walk3.webp"},{"pose":"walk4","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_walk4.webp"},{"pose":"walk5","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_walk5.webp"},{"pose":"walk6","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_walk6.webp"},{"pose":"walk7","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_walk7.webp"},{"pose":"walk8","src":"images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_walk8.webp"}]},{"id":"chapter2_boss_2","chapter":2,"group":"boss","label":"Boss 2 · 蜘蛛王","kind":"boss","selector":"#enemies > .enemy[data-sprite-type=\"chapter2_boss_2\"]:not(.spider-minion)","assets":[{"pose":"attack","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_attack.webp"},{"pose":"hit","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_hit.webp"},{"pose":"hit2","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_hit2.webp"},{"pose":"idle","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_idle.webp"},{"pose":"normal","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_normal.webp"},{"pose":"runway1","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_runway1.webp"},{"pose":"runway2","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_runway2.webp"},{"pose":"runway3","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_runway3.webp"},{"pose":"runway4","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_runway4.webp"},{"pose":"skin1","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_skin1.webp"},{"pose":"skin2","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_skin2.webp"},{"pose":"walk1","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_walk1.webp"},{"pose":"walk2","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_walk2.webp"},{"pose":"walk3","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_walk3.webp"},{"pose":"walk4","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_walk4.webp"}]},{"id":"chapter2_boss_2_minion","chapter":2,"group":"special","label":"蜘蛛小弟","kind":"special","selector":"#enemies > .enemy.spider-minion[data-sprite-type=\"chapter2_boss_2\"]","assets":[{"pose":"attack","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_attack.webp"},{"pose":"hit","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_hit.webp"},{"pose":"idle","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_idle.webp"},{"pose":"normal","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_normal.webp"},{"pose":"walk1","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_walk1.webp"},{"pose":"walk2","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_walk2.webp"},{"pose":"walk3","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_walk3.webp"},{"pose":"walk4","src":"images/chapter2/enemies/chapter2_boss_2/chapter2_boss_2_walk4.webp"}]},{"id":"chapter3_enemy_1","chapter":3,"group":"enemy","label":"Enemy 1","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter3_enemy_1\"]","assets":[{"pose":"attack","src":"images/chapter3/enemies/chapter3_enemy_1/chapter3_enemy_1_attack.webp"},{"pose":"hit","src":"images/chapter3/enemies/chapter3_enemy_1/chapter3_enemy_1_hit.webp"},{"pose":"idle","src":"images/chapter3/enemies/chapter3_enemy_1/chapter3_enemy_1_idle.webp"},{"pose":"normal","src":"images/chapter3/enemies/chapter3_enemy_1/chapter3_enemy_1_normal.webp"},{"pose":"walk1","src":"images/chapter3/enemies/chapter3_enemy_1/chapter3_enemy_1_walk1.webp"},{"pose":"walk2","src":"images/chapter3/enemies/chapter3_enemy_1/chapter3_enemy_1_walk2.webp"},{"pose":"walk3","src":"images/chapter3/enemies/chapter3_enemy_1/chapter3_enemy_1_walk3.webp"},{"pose":"walk4","src":"images/chapter3/enemies/chapter3_enemy_1/chapter3_enemy_1_walk4.webp"}]},{"id":"chapter3_enemy_2","chapter":3,"group":"enemy","label":"Enemy 2","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter3_enemy_2\"]","assets":[{"pose":"attack","src":"images/chapter3/enemies/chapter3_enemy_2/chapter3_enemy_2_attack.webp"},{"pose":"hit","src":"images/chapter3/enemies/chapter3_enemy_2/chapter3_enemy_2_hit.webp"},{"pose":"idle","src":"images/chapter3/enemies/chapter3_enemy_2/chapter3_enemy_2_idle.webp"},{"pose":"normal","src":"images/chapter3/enemies/chapter3_enemy_2/chapter3_enemy_2_normal.webp"},{"pose":"walk1","src":"images/chapter3/enemies/chapter3_enemy_2/chapter3_enemy_2_walk1.webp"},{"pose":"walk2","src":"images/chapter3/enemies/chapter3_enemy_2/chapter3_enemy_2_walk2.webp"},{"pose":"walk3","src":"images/chapter3/enemies/chapter3_enemy_2/chapter3_enemy_2_walk3.webp"},{"pose":"walk4","src":"images/chapter3/enemies/chapter3_enemy_2/chapter3_enemy_2_walk4.webp"}]},{"id":"chapter3_enemy_3","chapter":3,"group":"enemy","label":"Enemy 3","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter3_enemy_3\"]","assets":[{"pose":"attack","src":"images/chapter3/enemies/chapter3_enemy_3/chapter3_enemy_3_attack.webp"},{"pose":"hit","src":"images/chapter3/enemies/chapter3_enemy_3/chapter3_enemy_3_hit.webp"},{"pose":"idle","src":"images/chapter3/enemies/chapter3_enemy_3/chapter3_enemy_3_idle.webp"},{"pose":"normal","src":"images/chapter3/enemies/chapter3_enemy_3/chapter3_enemy_3_normal.webp"},{"pose":"walk1","src":"images/chapter3/enemies/chapter3_enemy_3/chapter3_enemy_3_walk1.webp"},{"pose":"walk2","src":"images/chapter3/enemies/chapter3_enemy_3/chapter3_enemy_3_walk2.webp"},{"pose":"walk3","src":"images/chapter3/enemies/chapter3_enemy_3/chapter3_enemy_3_walk3.webp"},{"pose":"walk4","src":"images/chapter3/enemies/chapter3_enemy_3/chapter3_enemy_3_walk4.webp"}]},{"id":"chapter3_enemy_4","chapter":3,"group":"enemy","label":"Enemy 4","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter3_enemy_4\"]","assets":[{"pose":"attack","src":"images/chapter3/enemies/chapter3_enemy_4/chapter3_enemy_4_attack.webp"},{"pose":"hit","src":"images/chapter3/enemies/chapter3_enemy_4/chapter3_enemy_4_hit.webp"},{"pose":"idle","src":"images/chapter3/enemies/chapter3_enemy_4/chapter3_enemy_4_idle.webp"},{"pose":"normal","src":"images/chapter3/enemies/chapter3_enemy_4/chapter3_enemy_4_normal.webp"},{"pose":"walk1","src":"images/chapter3/enemies/chapter3_enemy_4/chapter3_enemy_4_walk1.webp"},{"pose":"walk2","src":"images/chapter3/enemies/chapter3_enemy_4/chapter3_enemy_4_walk2.webp"},{"pose":"walk3","src":"images/chapter3/enemies/chapter3_enemy_4/chapter3_enemy_4_walk3.webp"},{"pose":"walk4","src":"images/chapter3/enemies/chapter3_enemy_4/chapter3_enemy_4_walk4.webp"}]},{"id":"chapter3_enemy_5","chapter":3,"group":"enemy","label":"Enemy 5","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter3_enemy_5\"]","assets":[{"pose":"attack","src":"images/chapter3/enemies/chapter3_enemy_5/chapter3_enemy_5_attack.webp"},{"pose":"hit","src":"images/chapter3/enemies/chapter3_enemy_5/chapter3_enemy_5_hit.webp"},{"pose":"idle","src":"images/chapter3/enemies/chapter3_enemy_5/chapter3_enemy_5_idle.webp"},{"pose":"normal","src":"images/chapter3/enemies/chapter3_enemy_5/chapter3_enemy_5_normal.webp"},{"pose":"walk1","src":"images/chapter3/enemies/chapter3_enemy_5/chapter3_enemy_5_walk1.webp"},{"pose":"walk2","src":"images/chapter3/enemies/chapter3_enemy_5/chapter3_enemy_5_walk2.webp"},{"pose":"walk3","src":"images/chapter3/enemies/chapter3_enemy_5/chapter3_enemy_5_walk3.webp"},{"pose":"walk4","src":"images/chapter3/enemies/chapter3_enemy_5/chapter3_enemy_5_walk4.webp"}]},{"id":"chapter3_enemy_6","chapter":3,"group":"enemy","label":"Enemy 6","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter3_enemy_6\"]","assets":[{"pose":"attack","src":"images/chapter3/enemies/chapter3_enemy_6/chapter3_enemy_6_attack.webp"},{"pose":"hit","src":"images/chapter3/enemies/chapter3_enemy_6/chapter3_enemy_6_hit.webp"},{"pose":"idle","src":"images/chapter3/enemies/chapter3_enemy_6/chapter3_enemy_6_idle.webp"},{"pose":"normal","src":"images/chapter3/enemies/chapter3_enemy_6/chapter3_enemy_6_normal.webp"},{"pose":"walk1","src":"images/chapter3/enemies/chapter3_enemy_6/chapter3_enemy_6_walk1.webp"},{"pose":"walk2","src":"images/chapter3/enemies/chapter3_enemy_6/chapter3_enemy_6_walk2.webp"},{"pose":"walk3","src":"images/chapter3/enemies/chapter3_enemy_6/chapter3_enemy_6_walk3.webp"},{"pose":"walk4","src":"images/chapter3/enemies/chapter3_enemy_6/chapter3_enemy_6_walk4.webp"}]},{"id":"chapter3_enemy_7","chapter":3,"group":"enemy","label":"Enemy 7","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter3_enemy_7\"]","assets":[{"pose":"attack","src":"images/chapter3/enemies/chapter3_enemy_7/chapter3_enemy_6_attack.webp"},{"pose":"hit","src":"images/chapter3/enemies/chapter3_enemy_7/chapter3_enemy_6_hit.webp"},{"pose":"idle","src":"images/chapter3/enemies/chapter3_enemy_7/chapter3_enemy_6_idle.webp"},{"pose":"normal","src":"images/chapter3/enemies/chapter3_enemy_7/chapter3_enemy_6_normal.webp"},{"pose":"walk1","src":"images/chapter3/enemies/chapter3_enemy_7/chapter3_enemy_6_walk1.webp"},{"pose":"walk2","src":"images/chapter3/enemies/chapter3_enemy_7/chapter3_enemy_6_walk2.webp"},{"pose":"walk3","src":"images/chapter3/enemies/chapter3_enemy_7/chapter3_enemy_6_walk3.webp"},{"pose":"walk4","src":"images/chapter3/enemies/chapter3_enemy_7/chapter3_enemy_6_walk4.webp"}]},{"id":"chapter3_enemy_8","chapter":3,"group":"enemy","label":"Enemy 8","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter3_enemy_8\"]","assets":[{"pose":"attack","src":"images/chapter3/enemies/chapter3_enemy_8/chapter3_enemy_6_attack.webp"},{"pose":"hit","src":"images/chapter3/enemies/chapter3_enemy_8/chapter3_enemy_6_hit.webp"},{"pose":"idle","src":"images/chapter3/enemies/chapter3_enemy_8/chapter3_enemy_6_idle.webp"},{"pose":"normal","src":"images/chapter3/enemies/chapter3_enemy_8/chapter3_enemy_6_normal.webp"},{"pose":"walk1","src":"images/chapter3/enemies/chapter3_enemy_8/chapter3_enemy_6_walk1.webp"},{"pose":"walk2","src":"images/chapter3/enemies/chapter3_enemy_8/chapter3_enemy_6_walk2.webp"},{"pose":"walk3","src":"images/chapter3/enemies/chapter3_enemy_8/chapter3_enemy_6_walk3.webp"},{"pose":"walk4","src":"images/chapter3/enemies/chapter3_enemy_8/chapter3_enemy_6_walk4.webp"}]},{"id":"chapter3_boss_1","chapter":3,"group":"boss","label":"Boss 1 · 雷暴海王","kind":"boss","selector":"#enemies > .enemy[data-sprite-type=\"chapter3_boss_1\"]","assets":[{"pose":"attack","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_attack.webp"},{"pose":"hit","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_hit.webp"},{"pose":"idle","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_idle.webp"},{"pose":"jump1","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_jump1.webp"},{"pose":"jump2","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_jump2.webp"},{"pose":"jump3","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_jump3.webp"},{"pose":"normal","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_normal.webp"},{"pose":"skill1","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_skill1.webp"},{"pose":"skill2","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_skill2.webp"},{"pose":"skill3","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_skill3.webp"},{"pose":"skill4","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_skill4.webp"},{"pose":"walk1","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_walk1.webp"},{"pose":"walk2","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_walk2.webp"},{"pose":"walk3","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_walk3.webp"},{"pose":"walk4","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_walk4.webp"},{"pose":"walk5","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_walk5.webp"},{"pose":"walk6","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_walk6.webp"},{"pose":"walk7","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_walk7.webp"},{"pose":"walk8","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_walk8.webp"}]},{"id":"chapter3_boss_1_tentacle","chapter":3,"group":"boss","label":"Boss 1 · 召喚觸手","kind":"special","selector":"#enemies > .enemy[data-sprite-type=\"chapter3_boss_1_tentacle\"]","assets":[{"pose":"other_1png","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_other_1png.webp"},{"pose":"other_2","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_other_2.webp"},{"pose":"other_3","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_other_3.webp"},{"pose":"other_4","src":"images/chapter3/enemies/chapter3_boss/chapter3_boss_1_other_4.webp"}]},{"id":"chapter4_enemy_1","chapter":4,"group":"enemy","label":"Enemy 1 · 冰雪洞穴守衛","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter4_enemy_1\"]","assets":[{"pose":"attack","src":"images/chapter4/enemies/chapter4_enemy_1/chapter4_enemy_1_attack.webp"},{"pose":"hit","src":"images/chapter4/enemies/chapter4_enemy_1/chapter4_enemy_1_hit.webp"},{"pose":"idle","src":"images/chapter4/enemies/chapter4_enemy_1/chapter4_enemy_1_idle.webp"},{"pose":"normal","src":"images/chapter4/enemies/chapter4_enemy_1/chapter4_enemy_1_normal.webp"},{"pose":"walk1","src":"images/chapter4/enemies/chapter4_enemy_1/chapter4_enemy_1_walk1.webp"},{"pose":"walk2","src":"images/chapter4/enemies/chapter4_enemy_1/chapter4_enemy_1_walk2.webp"},{"pose":"walk3","src":"images/chapter4/enemies/chapter4_enemy_1/chapter4_enemy_1_walk3.webp"},{"pose":"walk4","src":"images/chapter4/enemies/chapter4_enemy_1/chapter4_enemy_1_walk4.webp"}]},{"id":"chapter4_enemy_2","chapter":4,"group":"enemy","label":"Enemy 2 · 待加入素材","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter4_enemy_2\"]","assets":[{"pose":"attack","src":"images/chapter4/enemies/chapter4_enemy_2/chapter4_enemy_2_attack.webp"},{"pose":"hit","src":"images/chapter4/enemies/chapter4_enemy_2/chapter4_enemy_2_hit.webp"},{"pose":"idle","src":"images/chapter4/enemies/chapter4_enemy_2/chapter4_enemy_2_idle.webp"},{"pose":"normal","src":"images/chapter4/enemies/chapter4_enemy_2/chapter4_enemy_2_normal.webp"},{"pose":"walk1","src":"images/chapter4/enemies/chapter4_enemy_2/chapter4_enemy_2_walk1.webp"},{"pose":"walk2","src":"images/chapter4/enemies/chapter4_enemy_2/chapter4_enemy_2_walk2.webp"},{"pose":"walk3","src":"images/chapter4/enemies/chapter4_enemy_2/chapter4_enemy_2_walk3.webp"},{"pose":"walk4","src":"images/chapter4/enemies/chapter4_enemy_2/chapter4_enemy_2_walk4.webp"}]},{"id":"chapter4_enemy_3","chapter":4,"group":"enemy","label":"Enemy 3 · 待加入素材","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter4_enemy_3\"]","assets":[{"pose":"attack","src":"images/chapter4/enemies/chapter4_enemy_3/chapter4_enemy_3_attack.webp"},{"pose":"hit","src":"images/chapter4/enemies/chapter4_enemy_3/chapter4_enemy_3_hit.webp"},{"pose":"idle","src":"images/chapter4/enemies/chapter4_enemy_3/chapter4_enemy_3_idle.webp"},{"pose":"normal","src":"images/chapter4/enemies/chapter4_enemy_3/chapter4_enemy_3_normal.webp"},{"pose":"walk1","src":"images/chapter4/enemies/chapter4_enemy_3/chapter4_enemy_3_walk1.webp"},{"pose":"walk2","src":"images/chapter4/enemies/chapter4_enemy_3/chapter4_enemy_3_walk2.webp"},{"pose":"walk3","src":"images/chapter4/enemies/chapter4_enemy_3/chapter4_enemy_3_walk3.webp"},{"pose":"walk4","src":"images/chapter4/enemies/chapter4_enemy_3/chapter4_enemy_3_walk4.webp"}]},{"id":"chapter4_enemy_4","chapter":4,"group":"enemy","label":"Enemy 4 · 待加入素材","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter4_enemy_4\"]","assets":[{"pose":"attack","src":"images/chapter4/enemies/chapter4_enemy_4/chapter4_enemy_4_attack.webp"},{"pose":"hit","src":"images/chapter4/enemies/chapter4_enemy_4/chapter4_enemy_4_hit.webp"},{"pose":"idle","src":"images/chapter4/enemies/chapter4_enemy_4/chapter4_enemy_4_idle.webp"},{"pose":"normal","src":"images/chapter4/enemies/chapter4_enemy_4/chapter4_enemy_4_normal.webp"},{"pose":"walk1","src":"images/chapter4/enemies/chapter4_enemy_4/chapter4_enemy_4_walk1.webp"},{"pose":"walk2","src":"images/chapter4/enemies/chapter4_enemy_4/chapter4_enemy_4_walk2.webp"},{"pose":"walk3","src":"images/chapter4/enemies/chapter4_enemy_4/chapter4_enemy_4_walk3.webp"},{"pose":"walk4","src":"images/chapter4/enemies/chapter4_enemy_4/chapter4_enemy_4_walk4.webp"}]},{"id":"chapter4_enemy_5","chapter":4,"group":"enemy","label":"Enemy 5 · 待加入素材","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter4_enemy_5\"]","assets":[{"pose":"attack","src":"images/chapter4/enemies/chapter4_enemy_5/chapter4_enemy_5_attack.webp"},{"pose":"hit","src":"images/chapter4/enemies/chapter4_enemy_5/chapter4_enemy_5_hit.webp"},{"pose":"idle","src":"images/chapter4/enemies/chapter4_enemy_5/chapter4_enemy_5_idle.webp"},{"pose":"normal","src":"images/chapter4/enemies/chapter4_enemy_5/chapter4_enemy_5_normal.webp"},{"pose":"walk1","src":"images/chapter4/enemies/chapter4_enemy_5/chapter4_enemy_5_walk1.webp"},{"pose":"walk2","src":"images/chapter4/enemies/chapter4_enemy_5/chapter4_enemy_5_walk2.webp"},{"pose":"walk3","src":"images/chapter4/enemies/chapter4_enemy_5/chapter4_enemy_5_walk3.webp"},{"pose":"walk4","src":"images/chapter4/enemies/chapter4_enemy_5/chapter4_enemy_5_walk4.webp"}]},{"id":"chapter4_enemy_6","chapter":4,"group":"enemy","label":"Enemy 6 · 待加入素材","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter4_enemy_6\"]","assets":[{"pose":"attack","src":"images/chapter4/enemies/chapter4_enemy_6/chapter4_enemy_6_attack.webp"},{"pose":"hit","src":"images/chapter4/enemies/chapter4_enemy_6/chapter4_enemy_6_hit.webp"},{"pose":"idle","src":"images/chapter4/enemies/chapter4_enemy_6/chapter4_enemy_6_idle.webp"},{"pose":"normal","src":"images/chapter4/enemies/chapter4_enemy_6/chapter4_enemy_6_normal.webp"},{"pose":"walk1","src":"images/chapter4/enemies/chapter4_enemy_6/chapter4_enemy_6_walk1.webp"},{"pose":"walk2","src":"images/chapter4/enemies/chapter4_enemy_6/chapter4_enemy_6_walk2.webp"},{"pose":"walk3","src":"images/chapter4/enemies/chapter4_enemy_6/chapter4_enemy_6_walk3.webp"},{"pose":"walk4","src":"images/chapter4/enemies/chapter4_enemy_6/chapter4_enemy_6_walk4.webp"}]},{"id":"chapter4_enemy_7","chapter":4,"group":"enemy","label":"Enemy 7 · 待加入素材","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter4_enemy_7\"]","assets":[{"pose":"attack","src":"images/chapter4/enemies/chapter4_enemy_7/chapter4_enemy_7_attack.webp"},{"pose":"hit","src":"images/chapter4/enemies/chapter4_enemy_7/chapter4_enemy_7_hit.webp"},{"pose":"idle","src":"images/chapter4/enemies/chapter4_enemy_7/chapter4_enemy_7_idle.webp"},{"pose":"normal","src":"images/chapter4/enemies/chapter4_enemy_7/chapter4_enemy_7_normal.webp"},{"pose":"walk1","src":"images/chapter4/enemies/chapter4_enemy_7/chapter4_enemy_7_walk1.webp"},{"pose":"walk2","src":"images/chapter4/enemies/chapter4_enemy_7/chapter4_enemy_7_walk2.webp"},{"pose":"walk3","src":"images/chapter4/enemies/chapter4_enemy_7/chapter4_enemy_7_walk3.webp"},{"pose":"walk4","src":"images/chapter4/enemies/chapter4_enemy_7/chapter4_enemy_7_walk4.webp"}]},{"id":"chapter4_enemy_8","chapter":4,"group":"enemy","label":"Enemy 8 · 待加入素材","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter4_enemy_8\"]","assets":[{"pose":"attack","src":"images/chapter4/enemies/chapter4_enemy_8/chapter4_enemy_8_attack.webp"},{"pose":"hit","src":"images/chapter4/enemies/chapter4_enemy_8/chapter4_enemy_8_hit.webp"},{"pose":"idle","src":"images/chapter4/enemies/chapter4_enemy_8/chapter4_enemy_8_idle.webp"},{"pose":"normal","src":"images/chapter4/enemies/chapter4_enemy_8/chapter4_enemy_8_normal.webp"},{"pose":"walk1","src":"images/chapter4/enemies/chapter4_enemy_8/chapter4_enemy_8_walk1.webp"},{"pose":"walk2","src":"images/chapter4/enemies/chapter4_enemy_8/chapter4_enemy_8_walk2.webp"},{"pose":"walk3","src":"images/chapter4/enemies/chapter4_enemy_8/chapter4_enemy_8_walk3.webp"},{"pose":"walk4","src":"images/chapter4/enemies/chapter4_enemy_8/chapter4_enemy_8_walk4.webp"}]},{"id":"chapter4_enemy_9","chapter":4,"group":"enemy","label":"Enemy 9 · 待加入素材","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter4_enemy_9\"]","assets":[{"pose":"attack","src":"images/chapter4/enemies/chapter4_enemy_9/chapter4_enemy_9_attack.webp"},{"pose":"hit","src":"images/chapter4/enemies/chapter4_enemy_9/chapter4_enemy_9_hit.webp"},{"pose":"idle","src":"images/chapter4/enemies/chapter4_enemy_9/chapter4_enemy_9_idle.webp"},{"pose":"normal","src":"images/chapter4/enemies/chapter4_enemy_9/chapter4_enemy_9_normal.webp"},{"pose":"walk1","src":"images/chapter4/enemies/chapter4_enemy_9/chapter4_enemy_9_walk1.webp"},{"pose":"walk2","src":"images/chapter4/enemies/chapter4_enemy_9/chapter4_enemy_9_walk2.webp"},{"pose":"walk3","src":"images/chapter4/enemies/chapter4_enemy_9/chapter4_enemy_9_walk3.webp"},{"pose":"walk4","src":"images/chapter4/enemies/chapter4_enemy_9/chapter4_enemy_9_walk4.webp"}]},{"id":"chapter4_enemy_10","chapter":4,"group":"enemy","label":"Enemy 10 · 待加入素材","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter4_enemy_10\"]","assets":[{"pose":"attack","src":"images/chapter4/enemies/chapter4_enemy_10/chapter4_enemy_10_attack.webp"},{"pose":"hit","src":"images/chapter4/enemies/chapter4_enemy_10/chapter4_enemy_10_hit.webp"},{"pose":"idle","src":"images/chapter4/enemies/chapter4_enemy_10/chapter4_enemy_10_idle.webp"},{"pose":"normal","src":"images/chapter4/enemies/chapter4_enemy_10/chapter4_enemy_10_normal.webp"},{"pose":"walk1","src":"images/chapter4/enemies/chapter4_enemy_10/chapter4_enemy_10_walk1.webp"},{"pose":"walk2","src":"images/chapter4/enemies/chapter4_enemy_10/chapter4_enemy_10_walk2.webp"},{"pose":"walk3","src":"images/chapter4/enemies/chapter4_enemy_10/chapter4_enemy_10_walk3.webp"},{"pose":"walk4","src":"images/chapter4/enemies/chapter4_enemy_10/chapter4_enemy_10_walk4.webp"}]},{"id":"chapter4_enemy_11","chapter":4,"group":"enemy","label":"Enemy 11 · 新增素材","kind":"enemy","selector":"#enemies > .enemy[data-sprite-type=\"chapter4_enemy_11\"]","assets":[{"pose":"attack","src":"images/chapter4/enemies/chapter4_enemy_11/chapter4_enemy_11_attack.webp"},{"pose":"hit","src":"images/chapter4/enemies/chapter4_enemy_11/chapter4_enemy_11_hit.webp"},{"pose":"idle","src":"images/chapter4/enemies/chapter4_enemy_11/chapter4_enemy_11_idle.webp"},{"pose":"normal","src":"images/chapter4/enemies/chapter4_enemy_11/chapter4_enemy_11_normal.webp"},{"pose":"walk1","src":"images/chapter4/enemies/chapter4_enemy_11/chapter4_enemy_11_walk1.webp"},{"pose":"walk2","src":"images/chapter4/enemies/chapter4_enemy_11/chapter4_enemy_11_walk2.webp"},{"pose":"walk3","src":"images/chapter4/enemies/chapter4_enemy_11/chapter4_enemy_11_walk3.webp"},{"pose":"walk4","src":"images/chapter4/enemies/chapter4_enemy_11/chapter4_enemy_11_walk4.webp"}]}];
  const REGISTRY_STORAGE_KEY='prince-game.enemy-registry.v2';
  function readRegistryRecords(){
    const candidates=[];
    try{
      const raw=localStorage.getItem(REGISTRY_STORAGE_KEY);
      if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed.enemies))candidates.push(parsed.enemies);}
    }catch(error){console.warn('[Enemy Visual Editor] Registry read failed:',error);}
    candidates.push(window.PRINCE_ENEMY_REGISTRY_V2?.enemies,window.PRINCE_ENEMY_REGISTRY?.enemies,window.PRINCE_ENEMY_REGISTRY_SEED);
    const merged=new Map();
    candidates.filter(Array.isArray).forEach(rows=>rows.forEach(record=>{if(record?.id&&!merged.has(record.id))merged.set(record.id,record);}));
    return [...merged.values()];
  }
  function registryActionAssets(record){
    const result=[];
    Object.entries(record.animations||{}).forEach(([actionName,action])=>{
      const frames=Array.isArray(action?.frames)?action.frames:[];
      if(!frames.length)return;
      if(actionName==='walk'&&frames.length>1){
        frames.forEach((frame,index)=>result.push({pose:`walk${index+1}`,src:frame.path||frame.src||'',actionName,frameIndex:index,frames,animation:action}));
      }else{
        const frame=frames[0];
        result.push({pose:actionName,src:frame?.path||frame?.src||'',actionName,frameIndex:0,frames,animation:action});
      }
    });
    return result;
  }
  function buildTargetsFromRegistry(){
    const legacyById=new Map(LEGACY_TARGETS.map(target=>[target.id,target]));
    const merged=[];
    const records=readRegistryRecords();
    records.forEach(record=>{
      if(!record||!record.id)return;
      const old=legacyById.get(record.id);
      const mapped=registryActionAssets(record);
      const target={
        ...(old||{}),
        id:String(record.id),
        chapter:Number(record.chapter)||old?.chapter||1,
        group:old?.group||(record.type==='boss'?'boss':(record.type==='special'?'special':'enemy')),
        label:String(record.name||old?.label||record.id),
        kind:record.type==='boss'?'boss':(record.type==='elite'?'elite':(old?.kind||'enemy')),
        selector:old?.selector||`#enemies > .enemy[data-enemy-id="${String(record.id).replace(/[^a-zA-Z0-9_-]/g,'')}"]`,
        assets:mapped.length?mapped:(old?.assets||[]),
        registryManaged:true,
        registryVisualConfig:record.visualConfig||record.visual||null
      };
      merged.push(target);
      legacyById.delete(record.id);
    });
    // Keep any legacy-only targets in case a partial or older Registry file is supplied.
    legacyById.forEach(target=>merged.push({...target,registryManaged:false,registryVisualConfig:null}));
    return merged.sort((a,b)=>a.chapter-b.chapter||a.id.localeCompare(b.id,undefined,{numeric:true}));
  }
  let TARGETS=buildTargetsFromRegistry();
  const POSE_LABELS={"normal":"normal · 待機","attack":"attack · 攻擊","hit":"hit · 受擊","idle":"idle · 死亡","skin1":"skin1 · 形態 1","skin2":"skin2 · 形態 2","hit2":"hit2 · 特殊受擊","poison":"poison · 毒液形態","poison_big_area":"poison_big_area · 毒霧範圍"};
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const cleanPose=(raw={})=>({scale:clamp(raw.scale??1,.35,3),offsetX:clamp(raw.offsetX??0,-150,150),offsetY:clamp(raw.offsetY??0,-150,150)});
  const cleanEntry=(raw={})=>{
    const poses={}; Object.entries(raw.poses||{}).forEach(([key,value])=>{poses[key]=cleanPose(value);});
    return {scale:clamp(raw.scale??1,.35,3),offsetX:clamp(raw.offsetX??0,-150,150),offsetY:clamp(raw.offsetY??0,-150,150),poses,attackMode:([1,2,3].includes(Number(raw.attackMode))?Number(raw.attackMode):1),projectileScale:clamp(raw.projectileScale??1,.25,3),projectileRange:clamp(raw.projectileRange??1,.25,3),projectileRotation:clamp(raw.projectileRotation??180,0,1080),groundScale:clamp(raw.groundScale??1,.25,3),groundDuration:clamp(raw.groundDuration??850,250,3000),groundOffsetX:clamp(raw.groundOffsetX??0,-200,200),groundOffsetY:clamp(raw.groundOffsetY??0,-200,200)};
  };
  function registryVisualDefaults(target){
    if(!target.registryManaged)return window.ENEMY_VISUAL_CONFIG?.entries?.[target.id]||{};
    const stored=target.registryVisualConfig&&typeof target.registryVisualConfig==='object'?target.registryVisualConfig:{};
    const poses={...(stored.poses||{})};
    (target.assets||[]).forEach(asset=>{
      if(poses[asset.pose])return;
      const action=asset.animation||{};
      poses[asset.pose]={scale:(Number(action.size)||100)/100,offsetX:Number(action.x)||0,offsetY:Number(action.y)||0};
    });
    return {...stored,scale:stored.scale??1,offsetX:stored.offsetX??0,offsetY:stored.offsetY??0,poses};
  }
  const defaults={};
  TARGETS.forEach(target=>{
    const configured=target.registryVisualConfig||window.ENEMY_VISUAL_CONFIG?.entries?.[target.id]||registryVisualDefaults(target);
    defaults[target.id]=cleanEntry(configured||{});
  });
  const entries={}; TARGETS.forEach(target=>{entries[target.id]=cleanEntry(defaults[target.id]);});
  // Chapter 4 attack profiles: 1=melee + ground strike, 2=melee + parabolic projectile, 3=melee only.
  const CH4_ATTACK_DEFAULTS={chapter4_enemy_1:2,chapter4_enemy_2:3,chapter4_enemy_3:3,chapter4_enemy_4:3,chapter4_enemy_5:2,chapter4_enemy_6:1,chapter4_enemy_7:2,chapter4_enemy_8:2,chapter4_enemy_9:3,chapter4_enemy_10:3,chapter4_enemy_11:3};
  TARGETS.filter(t=>t.chapter===4).forEach(t=>{const e=defaults[t.id];if(!window.ENEMY_VISUAL_CONFIG?.entries?.[t.id]?.attackMode){e.attackMode=CH4_ATTACK_DEFAULTS[t.id]||1;entries[t.id].attackMode=e.attackMode;}});
  const existingPoseOverrides=clone(window.ENEMY_VISUAL_CONFIG?.poseOverrides||{});
  window.ENEMY_VISUAL_CONFIG=window.ENEMY_VISUAL_CONFIG||{};
  window.ENEMY_VISUAL_CONFIG.entries=entries;
  window.ENEMY_VISUAL_CONFIG.schemaVersion=2;

  const isChapter4CanvasPage=!!document.getElementById('game');
  const state={chapter:isChapter4CanvasPage?4:1,selected:isChapter4CanvasPage?'chapter4_enemy_1':'chapter1_enemy_1',selectedPose:'normal',showFrame:false,isOpen:false,dirty:false,previewPlaying:false,previewFrame:0,previewTimer:null};
  const byId=id=>document.getElementById(id);
  const targetById=id=>TARGETS.find(target=>target.id===id)||TARGETS[0];
  const getNodes=target=>{try{return Array.from(document.querySelectorAll(target.selector));}catch(e){return[];}};
  const currentEntry=()=>entries[state.selected];
  const selectedAsset=()=>targetById(state.selected).assets.find(asset=>asset.pose===state.selectedPose)||targetById(state.selected).assets[0];
  const selectedAnimation=()=>selectedAsset()?.animation||{};
  function stopActionPreview(){if(state.previewTimer)clearInterval(state.previewTimer);state.previewTimer=null;state.previewPlaying=false;state.previewFrame=0;const button=byId('eve-preview-toggle');if(button)button.textContent='▶ 播放動畫';}
  function showPreviewFrame(index){const asset=selectedAsset(),action=selectedAnimation(),frames=Array.isArray(asset?.frames)&&asset.frames.length?asset.frames:[{path:asset?.src}];if(!frames.length)return;const count=Math.max(1,Math.min(frames.length,Math.floor(Number(action.frameCount)||frames.length)));let frameIndex=index;if(action.loop===false)frameIndex=Math.min(count-1,index);else frameIndex=index%count;const frame=frames[frameIndex]||frames[0];const src=frame?.path||frame?.src||asset?.src;if(src)setEditorImage(byId('eve-pose-preview'),src);}
  function startActionPreview(){stopActionPreview();const asset=selectedAsset(),action=selectedAnimation(),frames=Array.isArray(asset?.frames)&&asset.frames.length?asset.frames:[{path:asset?.src}];if(!asset||frames.length<2){byId('eve-status').textContent='此動作只有一張圖片，沒有可播放的影格。';return;}const count=Math.max(1,Math.min(frames.length,Math.floor(Number(action.frameCount)||frames.length)));const fps=Math.max(1,Math.min(60,Number(action.fps)||6));state.previewPlaying=true;state.previewFrame=0;byId('eve-preview-toggle').textContent='Ⅱ 暫停預覽';showPreviewFrame(0);state.previewTimer=setInterval(()=>{state.previewFrame++;if(state.previewFrame>=count&&action.loop===false){state.previewFrame=count-1;stopActionPreview();return;}showPreviewFrame(state.previewFrame);},1000/fps);}
  function saveSelectedAnimationSettings(){const target=targetById(state.selected),asset=selectedAsset();if(!target?.registryManaged||!asset?.actionName)return;let payload;try{payload=JSON.parse(localStorage.getItem(REGISTRY_STORAGE_KEY)||'null');}catch{}if(!payload||!Array.isArray(payload.enemies))return;const record=payload.enemies.find(item=>item.id===state.selected);if(!record)return;const action=record.animations?.[asset.actionName];if(!action)return;const total=(Array.isArray(action.frames)?action.frames.length:1);action.fps=clamp(byId('eve-action-fps').value,1,60);action.frameCount=clamp(byId('eve-action-frame-count').value,1,Math.max(1,total));action.loop=byId('eve-action-loop').checked;action.anchorX=clamp(byId('eve-action-anchor-x').value,0,100)/100;action.anchorY=clamp(byId('eve-action-anchor-y').value,0,100)/100;action.groundAlignment=byId('eve-action-ground-alignment').checked;payload.updatedAt=new Date().toISOString();payload.animationConfigVersion='enemy-visual-v2.1';try{localStorage.setItem(REGISTRY_STORAGE_KEY,JSON.stringify(payload));window.PRINCE_ENEMY_REGISTRY_V2=payload;asset.animation=action;setDirty('動畫 FPS／影格數／Loop／Anchor／腳底對齊已同步到 Enemy Registry。');if(window.BroadcastChannel){const channel=new BroadcastChannel(REGISTRY_STORAGE_KEY);channel.postMessage({type:'registry-updated',source:'enemy-visual-editor-v2.1',updatedAt:payload.updatedAt});channel.close();}window.dispatchEvent(new CustomEvent('prince:enemy-registry-updated',{detail:{source:'enemy-visual-editor-v2.1'}}));}catch(error){byId('eve-status').textContent=`同步動畫設定失敗：${error.message}`;}}
  const ensurePose=()=>{const entry=currentEntry();entry.poses=entry.poses||{};entry.poses[state.selectedPose]=cleanPose(entry.poses[state.selectedPose]||{});return entry.poses[state.selectedPose];};
  const escapeHtml=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const poseLabel=key=>POSE_LABELS[key]||(
    /^walk\d+$/.test(key)?`${key} · 行走幀 ${key.replace('walk','')}`:
    /^jump\d+$/.test(key)?`${key} · 跳躍幀 ${key.replace('jump','')}`:
    /^skill\d+$/.test(key)?`${key} · 技能幀 ${key.replace('skill','')}`:
    /^skin1_last\d+$/.test(key)?`${key} · 終極階段 ${key.replace('skin1_last','')}`:
    /^runway\d+$/.test(key)?`${key} · 離場幀 ${key.replace('runway','')}`:
    /^other_\d+$/.test(key)?`${key} · 觸手幀 ${key.replace('other_','')}`:
    /^other_\d+png$/.test(key)?`${key} · 觸手幀 ${key.replace('other_','').replace('png','')}`:
    /^attack_skin/.test(key)?`${key} · 特殊攻擊形態`:
    /^skin1_attack/.test(key)?`${key} · 變身攻擊幀`:
    key.replace(/_/g,' ') );
  const poseGroup=key=>{
    if(['normal','attack','hit','idle','hit2'].includes(key))return '基本動作';
    if(/^walk\d+$/.test(key)||/^runway\d+$/.test(key))return /^runway/.test(key)?'離場動作':'移動動作';
    if(/^jump\d+$/.test(key))return '跳躍動作';
    if(/^skill\d+$/.test(key))return '特殊技能';
    if(/^skin1_last\d+$/.test(key))return '終極階段';
    if(/^other_/.test(key))return '召喚／觸手';
    if(/^skin|^attack_skin/.test(key))return '形態／特殊攻擊';
    return '其他 Boss 動作';
  };
  function writeVisualConfigToRegistry(){
    const registryRecords=readRegistryRecords();
    if(!Array.isArray(registryRecords)||!registryRecords.length)return;
    let payload;
    try{payload=JSON.parse(localStorage.getItem(REGISTRY_STORAGE_KEY)||'null');}catch{}
    if(!payload||!Array.isArray(payload.enemies))payload={schemaVersion:1,configVersion:'2.0.0',enemies:[]};
    const present=new Set(payload.enemies.map(record=>record?.id).filter(Boolean));
    registryRecords.forEach(record=>{if(record?.id&&!present.has(record.id)){payload.enemies.push(clone(record));present.add(record.id);}});
    let changed=false;
    TARGETS.forEach(target=>{
      if(!target.registryManaged||!entries[target.id])return;
      const record=payload.enemies.find(item=>item.id===target.id);
      if(!record)return;
      record.visualConfig=cleanEntry(entries[target.id]);
      changed=true;
    });
    if(!changed)return;
    payload.updatedAt=new Date().toISOString();
    payload.visualConfigVersion='enemy-visual-v2.0';
    try{
      localStorage.setItem(REGISTRY_STORAGE_KEY,JSON.stringify(payload));
      window.PRINCE_ENEMY_REGISTRY_V2=payload;
      if(window.BroadcastChannel){const channel=new BroadcastChannel(REGISTRY_STORAGE_KEY);channel.postMessage({type:'registry-updated',source:'enemy-visual-editor-v2.0',updatedAt:payload.updatedAt});channel.close();}
    }catch(error){console.warn('[Enemy Visual Editor] Could not sync visual values to Enemy Registry:',error);}
  }
  function resolveEditorAsset(src){
    if(!src)return Promise.resolve('');
    if(!src.startsWith('asset://'))return Promise.resolve(src);
    if(window.PrinceEnemyRegistryV2?.resolveSource)return window.PrinceEnemyRegistryV2.resolveSource(src);
    const id=src.slice(8),dbName='prince-game-enemy-assets-v2';
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(dbName,1);
      req.onerror=()=>reject(req.error||new Error('無法開啟敵人圖片資料庫'));
      req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('assets')){reject(new Error('找不到敵人圖片資料表'));return;}const get=db.transaction('assets','readonly').objectStore('assets').get(id);get.onerror=()=>reject(get.error);get.onsuccess=()=>{if(!get.result?.blob){reject(new Error(`找不到圖片素材：${id}`));return;}resolve(URL.createObjectURL(get.result.blob));};};
    });
  }
  function setEditorImage(img,src){
    if(!img)return;
    img.dataset.eveSource=src||'';
    if(!src){img.removeAttribute('src');return;}
    resolveEditorAsset(src).then(url=>{if(img.dataset.eveSource===src){img.src=url;img.style.display='';}}).catch(error=>{if(img.dataset.eveSource===src){img.removeAttribute('src');img.alt='圖片載入失敗';img.title=error.message;img.style.opacity='.25';}});
  }
  function resolveEditorImages(root=document){
    root.querySelectorAll?.('img[data-eve-source]').forEach(img=>setEditorImage(img,img.dataset.eveSource));
  }
  function refreshTargetsFromRegistry(){
    const previousSelected=state.selected;
    TARGETS=buildTargetsFromRegistry();
    TARGETS.forEach(target=>{
      if(!entries[target.id]){
        const raw=target.registryVisualConfig||window.ENEMY_VISUAL_CONFIG?.entries?.[target.id]||registryVisualDefaults(target);
        defaults[target.id]=cleanEntry(raw||{});
        entries[target.id]=cleanEntry(defaults[target.id]);
      }else if(target.registryVisualConfig&&!state.dirty){
        entries[target.id]=cleanEntry(target.registryVisualConfig);
        defaults[target.id]=cleanEntry(target.registryVisualConfig);
      }
    });
    if(!TARGETS.some(target=>target.id===state.selected)){
      const first=TARGETS.find(target=>target.chapter===state.chapter)||TARGETS[0];
      state.selected=first?.id||'';
    }
    if(!TARGETS.some(target=>target.id===state.selected&&target.chapter===state.chapter)){
      const first=TARGETS.find(target=>target.chapter===state.chapter);
      if(first)state.selected=first.id;
      else if(TARGETS.length){state.selected=TARGETS[0].id;state.chapter=TARGETS[0].chapter;}
    }
    if(document.getElementById('enemyVisualEditor')){renderChapters();renderEnemies();renderPoses();applySelection();}
    return previousSelected!==state.selected;
  }
  function syncConfig(){
    window.ENEMY_VISUAL_CONFIG.entries=entries;
    window.ENEMY_VISUAL_CONFIG.poseOverrides=existingPoseOverrides;
    window.ENEMY_VISUAL_CONFIG.schemaVersion=2;
    window.EnemyVisualController?.apply();
  }
  function applySelection(){
    syncConfig();
    TARGETS.forEach(target=>getNodes(target).forEach(node=>node.classList.toggle('eve-selected',state.isOpen&&target.id===state.selected)));
    updateLabels(); refreshStats();
  }
  function setDirty(message='有未儲存的調整。請按「儲存草稿」或「匯出設定 JS」。'){
    state.dirty=true;
    writeVisualConfigToRegistry();
    byId('eve-status').textContent=message;
  }
  function refreshStats(){
    const target=targetById(state.selected),nodes=getNodes(target);
    const canvasRuntime=target.chapter===4?window.Chapter4EnemyVisualRuntime:null;
    const canvasStats=canvasRuntime?.getEnemyStats?.(target.id)||null;
    byId('eve-current-target').textContent=target.label;
    if(canvasStats){
      byId('eve-count').textContent=`Canvas 場上 ${canvasStats.count} 隻`;
      byId('eve-frame-size').textContent=canvasStats.count&&canvasStats.frameSize?`Canvas ${canvasStats.frameSize}`:'Canvas 模式';
      byId('eve-empty-note').textContent=canvasStats.count
        ?`第四章 Canvas 即時預覽中：目前關卡「${canvasStats.stageName||canvasStats.stageId||'第四章'}」有 ${canvasStats.count} 隻此類敵人。調整 Size / X / Y 會即時套用到畫面；不會改變碰撞框、HP 或 AI。`
        :`第四章 Canvas Runtime 已連接；目前關卡「${canvasStats.stageName||canvasStats.stageId||'第四章'}」沒有放置這種敵人。可先調整設定，之後在 Stage Editor 加入 ${target.id} 時便會套用。`;
    }else if(target.chapter===4&&document.getElementById('game')){
      byId('eve-count').textContent='Canvas Runtime 準備中';
      byId('eve-frame-size').textContent='Canvas 模式';
      byId('eve-empty-note').textContent='已偵測到第四章 Canvas 頁面；Runtime 尚未提供敵人狀態。設定會寫入 ENEMY_VISUAL_CONFIG。';
    }else{
      byId('eve-count').textContent=`場上 ${nodes.length} 隻`;
      byId('eve-frame-size').textContent=nodes[0]?`${Math.round(nodes[0].offsetWidth)} × ${Math.round(nodes[0].offsetHeight)} px`:'尚未生成';
      byId('eve-empty-note').textContent=nodes.length?'設定會套用到所有目前及之後生成的同類敵人。':(target.chapter===4?'第四章使用獨立 Canvas Runtime。請在第四章頁面開啟 Enemy Editor，設定便會直接套用到 Canvas。':'場上尚未生成此敵人；設定會套用到之後生成的同類敵人。');
    }
  }
  function updateLabels(){
    const base=currentEntry(),pose=cleanPose(base.poses?.[state.selectedPose]||{});
    byId('eve-base-scale-value').textContent=`${base.scale.toFixed(2)}x`;
    byId('eve-base-x-value').textContent=`${base.offsetX}px`;
    byId('eve-base-y-value').textContent=`${base.offsetY}px`;
    byId('eve-base-scale').value=String(base.scale);byId('eve-base-x').value=String(base.offsetX);byId('eve-base-y').value=String(base.offsetY);
    byId('eve-pose-scale-value').textContent=`${pose.scale.toFixed(2)}x`;
    byId('eve-pose-x-value').textContent=`${pose.offsetX}px`;
    byId('eve-pose-y-value').textContent=`${pose.offsetY}px`;
    byId('eve-pose-scale').value=String(pose.scale);byId('eve-pose-x').value=String(pose.offsetX);byId('eve-pose-y').value=String(pose.offsetY);
    byId('eve-combined-scale').textContent=`${(base.scale*pose.scale).toFixed(3)}x`;
    ['attack-mode','projectile-scale','projectile-range','projectile-rotation','ground-scale','ground-duration','ground-offset-x','ground-offset-y'].forEach(k=>{const el=byId('eve-'+k);if(el)el.value=String(base[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??(k==='attack-mode'?1:1));});
    const ring=byId('eve-projectile-range-ring'),core=byId('eve-projectile-core');if(ring)ring.style.transform=`scale(${base.projectileRange})`;if(core)core.style.transform=`scale(${base.projectileScale})`;byId('eve-projectile-scale-value').textContent=base.projectileScale.toFixed(2)+'x';byId('eve-projectile-range-value').textContent=base.projectileRange.toFixed(2)+'x';byId('eve-projectile-rotation-value').textContent=base.projectileRotation+'°';byId('eve-ground-scale-value').textContent=base.groundScale.toFixed(2)+'x';byId('eve-ground-duration-value').textContent=base.groundDuration+'ms';byId('eve-ground-offset-x-value').textContent=base.groundOffsetX+'px';byId('eve-ground-offset-y-value').textContent=base.groundOffsetY+'px';
    byId('eve-pose-title').textContent=poseLabel(state.selectedPose);
    byId('eve-pose-key').textContent=state.selectedPose;
    byId('eve-pose-key-stat').textContent=state.selectedPose;
    const asset=selectedAsset();const action=selectedAnimation();const preview=byId('eve-pose-preview');
    if(asset&&asset.src){preview.alt=poseLabel(state.selectedPose);preview.style.display='block';if(!state.previewPlaying)setEditorImage(preview,asset.src);}
    else {preview.dataset.eveSource='';preview.removeAttribute('src');preview.style.display='none';}
    const totalFrames=Math.max(1,Array.isArray(asset?.frames)?asset.frames.length:1);
    byId('eve-action-fps').value=String(Math.max(1,Math.min(60,Number(action.fps)||6)));
    byId('eve-action-frame-count').value=String(Math.max(1,Math.min(totalFrames,Number(action.frameCount)||totalFrames)));
    byId('eve-action-frame-count').max=String(totalFrames);
    byId('eve-action-loop').checked=action.loop!==false;
    byId('eve-action-anchor-x').value=String(Math.round((Number(action.anchorX??.5))*100));
    byId('eve-action-anchor-y').value=String(Math.round((Number(action.anchorY??1))*100));
    byId('eve-action-ground-alignment').checked=action.groundAlignment!==false;
    byId('eve-action-fps-value').textContent=`${byId('eve-action-fps').value} FPS`;
    byId('eve-action-frame-count-value').textContent=`${byId('eve-action-frame-count').value} / ${totalFrames}`;
    byId('eve-action-anchor-x-value').textContent=`${byId('eve-action-anchor-x').value}%`;
    byId('eve-action-anchor-y-value').textContent=`${byId('eve-action-anchor-y').value}%`;
    byId('eve-preview-toggle').disabled=totalFrames<2;
    if(!state.previewPlaying)byId('eve-preview-toggle').textContent='▶ 播放動畫';
    preview.style.transform=`translate(${pose.offsetX}px, ${pose.offsetY}px) scale(${pose.scale})`;
    preview.onerror=()=>{preview.style.display='none';};
    byId('eve-pose-preview-scale').textContent=`動作倍率 ${pose.scale.toFixed(2)}x · Editor 設定合計 ${ (base.scale*pose.scale).toFixed(3)}x`;
  }
  function renderChapters(){
    const chapters=[...new Set(TARGETS.map(target=>target.chapter))].sort((a,b)=>a-b);
    byId('eve-chapters').innerHTML=chapters.map(ch=>`<button type="button" class="eve-chapter-tab ${state.chapter===ch?'active':''}" data-chapter="${ch}">Chapter ${ch}</button>`).join('');
  }
  function renderEnemies(){
    const chapterTargets=TARGETS.filter(t=>t.chapter===state.chapter);
    const groups=[['enemy','ENEMIES · 普通敵人'],['boss','BOSSES · Boss'],['special','SPECIAL · 召喚／特殊單位']];
    byId('eve-enemy-groups').innerHTML=chapterTargets.length?groups.map(([key,title])=>{
      const list=chapterTargets.filter(t=>t.group===key);if(!list.length)return '';
      return `<section class="eve-enemy-section"><div class="eve-section-title">${title}</div><div class="eve-enemy-grid">${list.map(t=>{
        const icon=t.assets.find(a=>a.pose==='normal')||t.assets[0];
        return `<button type="button" class="eve-enemy-card ${state.selected===t.id?'selected':''}" data-target="${t.id}"><span class="eve-enemy-thumb">${icon&&icon.src?`<img data-eve-source="${escapeHtml(icon.src)}" alt="">`:'<span>—</span>'}</span><span class="eve-enemy-name">${escapeHtml(t.label)}</span></button>`;
      }).join('')}</div></section>`;
    }).join(''):'<p class="eve-note">此 Chapter 尚未有敵人。請先到 Enemy Registry 新增敵人，返回此頁後會自動同步。</p>';
    resolveEditorImages(byId('eve-enemy-groups'));
  }
  function renderPoses(){
    const target=targetById(state.selected),groups=new Map();
    target.assets.forEach(asset=>{const name=poseGroup(asset.pose);if(!groups.has(name))groups.set(name,[]);groups.get(name).push(asset);});
    const preferred=['基本動作','移動動作','跳躍動作','特殊技能','形態／特殊攻擊','終極階段','離場動作','召喚／觸手','其他 Boss 動作'];
    const ordered=[...preferred.filter(name=>groups.has(name)),...Array.from(groups.keys()).filter(name=>!preferred.includes(name))];
    byId('eve-pose-groups').innerHTML=ordered.map(name=>`<section class="eve-pose-section"><div class="eve-section-title">${name}</div><div class="eve-pose-grid">${groups.get(name).map(asset=>`<button type="button" class="eve-pose-card ${state.selectedPose===asset.pose?'selected':''}" data-pose="${escapeHtml(asset.pose)}"><span class="eve-pose-thumb">${asset.src?`<img data-eve-source="${escapeHtml(asset.src)}" alt="">`:'<span>—</span>'}</span><span class="eve-pose-name">${escapeHtml(poseLabel(asset.pose))}</span></button>`).join('')}</div></section>`).join('')||'<p class="eve-note">此敵人尚未匯入動作圖片。請先到 Enemy Registry 匯入圖片並儲存。</p>';
    resolveEditorImages(byId('eve-pose-groups'));
    if(!target.assets.some(a=>a.pose===state.selectedPose))state.selectedPose=target.assets[0]?.pose||'normal';
    updateLabels();
  }
  function selectTarget(id){
    stopActionPreview();state.selected=id;state.chapter=targetById(id).chapter;
    state.selectedPose=targetById(id).assets.some(a=>a.pose==='normal')?'normal':(targetById(id).assets[0]?.pose||'normal');
    renderChapters();renderEnemies();renderPoses();applySelection();
  }
  function resetPose(){
    const entry=currentEntry();if(entry.poses)delete entry.poses[state.selectedPose];
    applySelection();renderPoses();setDirty(`已重設 ${poseLabel(state.selectedPose)}，回復 1.00x 及 0px。`);
  }
  function resetTarget(){
    entries[state.selected]=cleanEntry(defaults[state.selected]);
    applySelection();renderPoses();setDirty('已重設這隻敵人的基本倍率及全部動作設定。');
  }
  function configSource(){
    const exported={};TARGETS.forEach(target=>{exported[target.id]=cleanEntry(entries[target.id]);});
    return `/* Enemy Visual Config — generated by ENEMY VISUAL EDITOR V2.0 */\nwindow.ENEMY_VISUAL_CONFIG = {\n  schemaVersion: 2,\n  configVersion: ${JSON.stringify(`export-${Date.now()}`)},\n  entries: ${JSON.stringify(exported,null,2)},\n  poseOverrides: ${JSON.stringify(existingPoseOverrides,null,2)}\n};\n`;
  }
  function saveLocal(){
    try{syncConfig();writeVisualConfigToRegistry();localStorage.setItem(STORAGE_KEY,JSON.stringify({schemaVersion:2,configVersion:CONFIG_VERSION,entries,poseOverrides:existingPoseOverrides}));state.dirty=false;byId('eve-status').textContent='V2.0 草稿已保存，Enemy Registry 視覺設定已同步。正式舊版 Runtime 仍可匯出 enemy-visual-config.js。';}
    catch(e){byId('eve-status').textContent='瀏覽器未允許本機儲存；請使用「匯出設定 JS」。';}
  }
  function loadLocal(){
    try{
      const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!stored?.entries){byId('eve-status').textContent='找不到本機草稿。';return;}
      refreshTargetsFromRegistry();
      TARGETS.forEach(target=>{if(stored.entries[target.id])entries[target.id]=cleanEntry(stored.entries[target.id]);});
      if(stored.poseOverrides&&typeof stored.poseOverrides==='object')Object.assign(existingPoseOverrides,stored.poseOverrides);
      applySelection();renderPoses();writeVisualConfigToRegistry();state.dirty=false;byId('eve-status').textContent='已載入本機草稿；Enemy Registry 已同步（兼容 v1.7／V2.0 設定）。';
    }catch(e){byId('eve-status').textContent='無法讀取本機草稿。';}
  }
  function exportJS(){
    syncConfig();writeVisualConfigToRegistry();
    const blob=new Blob([configSource()],{type:'text/javascript;charset=utf-8'});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='enemy-visual-config.js';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    byId('eve-status').textContent='已匯出 V2.0 設定（包含 Registry 內全部 Enemy ID）。Registry 視覺資料亦已同步保存。覆蓋 js/enemy-visual-config.js 可供舊版 Runtime 使用。';
  }
  async function copyJS(){
    const text=configSource();try{await navigator.clipboard.writeText(text);byId('eve-status').textContent='設定程式碼已複製。';}
    catch(e){const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();let ok=false;try{ok=document.execCommand('copy');}catch(err){}area.remove();byId('eve-status').textContent=ok?'設定程式碼已複製。':'無法存取剪貼簿，請使用「匯出設定 JS」。';}
  }
  function setOpen(open){
    state.isOpen=Boolean(open);if(!state.isOpen)stopActionPreview();byId('enemyVisualEditor').hidden=!state.isOpen;byId('enemyVisualEditorLauncher').setAttribute('aria-expanded',String(state.isOpen));
    document.body.classList.toggle('eve-show-frame',state.isOpen&&state.showFrame);
    if(state.isOpen){refreshTargetsFromRegistry();applySelection();byId('eve-chapters').querySelector('.active')?.focus({preventScroll:true});}
    else{document.querySelectorAll('#enemies > .enemy.eve-selected').forEach(node=>node.classList.remove('eve-selected'));document.body.classList.remove('eve-show-frame');}
  }
  function buildUI(){
    const launcher=document.createElement('button');launcher.id='enemyVisualEditorLauncher';launcher.type='button';launcher.innerHTML='<span aria-hidden="true">⚙</span><span>ENEMY EDITOR · 2</span>';launcher.setAttribute('aria-controls','enemyVisualEditor');launcher.setAttribute('aria-expanded','false');
    const panel=document.createElement('section');panel.id='enemyVisualEditor';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','Enemy Visual Editor');
    panel.innerHTML=`
      <div class="eve-head"><div><h2 class="eve-title">ENEMY VISUAL EDITOR · V2.0</h2><div class="eve-subtitle">Chapter → Enemy → 與 Enemy Registry 共用 Enemy ID／圖片／動作；每張動作圖片獨立調整 Size / X / Y</div></div><button class="eve-close" id="eve-close" type="button" aria-label="關閉編輯器">×</button></div>
      <div class="eve-card eve-browser-card"><div class="eve-step-title">01 · 選擇 Chapter</div><div class="eve-chapters" id="eve-chapters"></div><div class="eve-step-title">02 · 選擇敵人（圖示使用 normal）</div><div id="eve-enemy-groups"></div></div>
      <div class="eve-card"><div class="eve-selected-heading"><div><div class="eve-step-title">03 · 所選敵人的素材</div><strong id="eve-current-target">—</strong></div><span class="eve-value" id="eve-count">場上 0 隻</span></div><div id="eve-pose-groups"></div></div>
      <div class="eve-card eve-controls-card"><div class="eve-step-title">04 · 個別圖片控制</div><div class="eve-preview-row"><div class="eve-preview-box"><img id="eve-pose-preview" alt="選取的動作素材"><span id="eve-preview-placeholder">未有圖片</span></div><div class="eve-preview-meta"><strong id="eve-pose-title">normal · 待機</strong><code id="eve-pose-key">normal</code><span id="eve-pose-preview-scale">動作倍率 1.00x</span><span>預覽只顯示素材比例，不會改變碰撞盒。</span><button type="button" id="eve-preview-toggle">▶ 播放動畫</button></div></div>
        <div class="eve-divider-label">B · 動作播放／腳底定位（寫入 Enemy Registry）</div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-action-fps">Animation Speed</label><span class="eve-value" id="eve-action-fps-value">6 FPS</span></div><input id="eve-action-fps" type="range" min="1" max="60" step="1" value="6"></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-action-frame-count">Frame Count</label><span class="eve-value" id="eve-action-frame-count-value">1 / 1</span></div><input id="eve-action-frame-count" type="range" min="1" max="1" step="1" value="1"></div>
        <label class="eve-checkrow"><input id="eve-action-loop" type="checkbox" checked> Loop Animation</label>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-action-anchor-x">Anchor Point X</label><span class="eve-value" id="eve-action-anchor-x-value">50%</span></div><input id="eve-action-anchor-x" type="range" min="0" max="100" step="1" value="50"></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-action-anchor-y">Anchor Point Y</label><span class="eve-value" id="eve-action-anchor-y-value">100%</span></div><input id="eve-action-anchor-y" type="range" min="0" max="100" step="1" value="100"></div>
        <label class="eve-checkrow"><input id="eve-action-ground-alignment" type="checkbox" checked> Ground Alignment（腳底固定在平台線）</label>
        <div class="eve-divider-label">A · 整隻敵人的基本倍率</div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-base-scale">基本 Size</label><span class="eve-value" id="eve-base-scale-value">1.00x</span></div><input id="eve-base-scale" type="range" min="0.35" max="3" step="0.05" value="1"></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-base-x">基本左右位置 X</label><span class="eve-value" id="eve-base-x-value">0px</span></div><input id="eve-base-x" type="range" min="-150" max="150" step="1" value="0"></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-base-y">基本上下位置 Y</label><span class="eve-value" id="eve-base-y-value">0px</span></div><input id="eve-base-y" type="range" min="-150" max="150" step="1" value="0"></div>
        <div class="eve-divider-label">C · 目前選取動作的獨立倍率</div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-pose-scale">動作 Size</label><span class="eve-value" id="eve-pose-scale-value">1.00x</span></div><input id="eve-pose-scale" type="range" min="0.35" max="3" step="0.05" value="1"></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-pose-x">動作左右位置 X</label><span class="eve-value" id="eve-pose-x-value">0px</span></div><input id="eve-pose-x" type="range" min="-150" max="150" step="1" value="0"></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-pose-y">動作上下位置 Y</label><span class="eve-value" id="eve-pose-y-value">0px</span></div><input id="eve-pose-y" type="range" min="-150" max="150" step="1" value="0"></div>
        <div class="eve-combined"><span>Editor 倍率（基本 × 動作）</span><strong id="eve-combined-scale">1.000x</strong></div>
        <label class="eve-checkrow"><input id="eve-show-frame" type="checkbox"> 顯示場上選中敵人的外框（非攻擊判定）</label>
        <div class="eve-stats"><div class="eve-stat"><span>敵人外框（不會修改）</span><strong id="eve-frame-size">—</strong></div><div class="eve-stat"><span>目前選取動作</span><strong id="eve-pose-key-stat">獨立控制</strong></div></div>
        <div class="eve-divider-label">D · Chapter 4 攻擊模式</div>
        <div class="eve-field"><label for="eve-attack-mode">攻擊模式</label><select id="eve-attack-mode"><option value="1">1 · 普通攻擊＋腳下攻擊（不會拋物線）</option><option value="2">2 · 普通攻擊＋拋物線攻擊</option><option value="3">3 · 只有普通攻擊</option></select></div>
        <div class="eve-divider-label">E · Projectile 微調（只影響第四章）</div><div class="eve-projectile-preview" id="eve-projectile-preview"><span class="eve-projectile-range-ring" id="eve-projectile-range-ring"></span><span class="eve-projectile-core" id="eve-projectile-core">PROJECTILE</span><small>紅圈＝攻擊影響範圍（編輯器預覽）</small></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-projectile-scale">Projectile 顯示大小</label><span class="eve-value" id="eve-projectile-scale-value">1.00x</span></div><input id="eve-projectile-scale" type="range" min="0.25" max="3" step="0.05" value="1"></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-projectile-range">Projectile 攻擊範圍</label><span class="eve-value" id="eve-projectile-range-value">1.00x</span></div><input id="eve-projectile-range" type="range" min="0.25" max="3" step="0.05" value="1"></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-projectile-rotation">旋轉速度（度／秒）</label><span class="eve-value" id="eve-projectile-rotation-value">180°</span></div><input id="eve-projectile-rotation" type="range" min="0" max="1080" step="15" value="180"></div>
        <div class="eve-divider-label">F · 腳下攻擊微調（X／Y 只移動攻擊圖片，不影響判定）</div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-ground-scale">腳下攻擊最大大小</label><span class="eve-value" id="eve-ground-scale-value">1.00x</span></div><input id="eve-ground-scale" type="range" min="0.25" max="3" step="0.05" value="1"></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-ground-duration">攻擊維持時間</label><span class="eve-value" id="eve-ground-duration-value">850ms</span></div><input id="eve-ground-duration" type="range" min="250" max="3000" step="50" value="850"></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-ground-offset-x">腳下攻擊圖片位置 X（左右）</label><span class="eve-value" id="eve-ground-offset-x-value">0px</span></div><input id="eve-ground-offset-x" type="range" min="-200" max="200" step="1" value="0"></div>
        <div class="eve-field"><div class="eve-labelrow"><label for="eve-ground-offset-y">腳下攻擊圖片位置 Y（上下）</label><span class="eve-value" id="eve-ground-offset-y-value">0px</span></div><input id="eve-ground-offset-y" type="range" min="-200" max="200" step="1" value="0"></div>
        <p class="eve-note">Projectile 攻擊範圍會以編輯器設定倍率顯示／計算；遊戲畫面不會顯示碰撞圈。腳下攻擊先紅色預警 2 秒，再由細至大快速出現，維持後淡出。</p>
        <p class="eve-note" id="eve-empty-note">Chapter 1–3 會套用到場上敵人；第四章使用 Canvas Runtime，於第四章頁面修改時會即時預覽。</p>
      </div>
      <div class="eve-actions"><button class="primary" id="eve-save" type="button">儲存草稿</button><button id="eve-load" type="button">載入草稿</button><button id="eve-reset-pose" type="button">重設此動作</button><button id="eve-reset-target" type="button">重設此敵人</button><button id="eve-export" type="button">匯出設定 JS</button><button id="eve-copy" type="button">複製設定程式碼</button><button class="eve-full" id="eve-close-bottom" type="button">完成並關閉</button></div>
      <div class="eve-status" id="eve-status" role="status" aria-live="polite">Enemy Registry 新增／修改敵人後會自動同步。視覺設定會回寫 Registry，並保留舊版 enemy-visual-config.js 輸出。</div>
      <div class="eve-footer">鍵盤 2 開啟／關閉。基本倍率會影響同一敵人的所有動作；動作倍率只影響目前選取的素材。Editor 設定合計＝基本倍率 × 動作倍率；原有 Chapter 專用外層比例仍會保留。此工具只改圖片顯示，不改碰撞、HP、AI、移動速度、傷害或技能判定。Chapter 4 使用 Canvas 即時讀取同一份設定；匯出設定 JS 後可永久保存調整。</div>`;
    document.body.append(launcher,panel);
    renderChapters();renderEnemies();renderPoses();updateLabels();refreshStats();
    launcher.addEventListener('click',()=>setOpen(!state.isOpen));byId('eve-close').addEventListener('click',()=>setOpen(false));byId('eve-close-bottom').addEventListener('click',()=>setOpen(false));
    byId('eve-chapters').addEventListener('click',event=>{const button=event.target.closest('[data-chapter]');if(!button)return;stopActionPreview();state.chapter=Number(button.dataset.chapter);const first=TARGETS.find(t=>t.chapter===state.chapter);if(first)state.selected=first.id;state.selectedPose=targetById(state.selected).assets.some(a=>a.pose==='normal')?'normal':(targetById(state.selected).assets[0]?.pose||'normal');renderChapters();renderEnemies();renderPoses();applySelection();});
    byId('eve-enemy-groups').addEventListener('click',event=>{const button=event.target.closest('[data-target]');if(button)selectTarget(button.dataset.target);});
    byId('eve-pose-groups').addEventListener('click',event=>{const button=event.target.closest('[data-pose]');if(!button)return;stopActionPreview();state.selectedPose=button.dataset.pose;renderPoses();applySelection();});
    const bind=(id,field,min,max,poseLevel=false)=>byId(id).addEventListener('input',event=>{const object=poseLevel?ensurePose():currentEntry();object[field]=clamp(event.target.value,min,max);applySelection();setDirty();});
    bind('eve-base-scale','scale',.35,3);bind('eve-base-x','offsetX',-150,150);bind('eve-base-y','offsetY',-150,150);
    bind('eve-pose-scale','scale',.35,3,true);bind('eve-pose-x','offsetX',-150,150,true);bind('eve-pose-y','offsetY',-150,150,true);
    const bindEntry=(id,field,min,max)=>byId(id).addEventListener('input',event=>{currentEntry()[field]=clamp(event.target.value,min,max);syncConfig();setDirty();updateLabels();});
    byId('eve-preview-toggle').addEventListener('click',()=>{if(state.previewPlaying)stopActionPreview();else startActionPreview();});
    ['eve-action-fps','eve-action-frame-count','eve-action-anchor-x','eve-action-anchor-y'].forEach(id=>byId(id).addEventListener('input',()=>{byId(id+'-value').textContent=id==='eve-action-fps'?`${byId(id).value} FPS`:id==='eve-action-frame-count'?`${byId(id).value} / ${byId(id).max}`:`${byId(id).value}%`;}));
    ['eve-action-fps','eve-action-frame-count','eve-action-anchor-x','eve-action-anchor-y','eve-action-loop','eve-action-ground-alignment'].forEach(id=>byId(id).addEventListener('change',saveSelectedAnimationSettings));
    byId('eve-attack-mode').addEventListener('change',event=>{currentEntry().attackMode=Number(event.target.value);syncConfig();setDirty();});
    bindEntry('eve-projectile-scale','projectileScale',.25,3);bindEntry('eve-projectile-range','projectileRange',.25,3);bindEntry('eve-projectile-rotation','projectileRotation',0,1080);bindEntry('eve-ground-scale','groundScale',.25,3);bindEntry('eve-ground-duration','groundDuration',250,3000);bindEntry('eve-ground-offset-x','groundOffsetX',-200,200);bindEntry('eve-ground-offset-y','groundOffsetY',-200,200);
    byId('eve-show-frame').addEventListener('change',event=>{state.showFrame=event.target.checked;document.body.classList.toggle('eve-show-frame',state.isOpen&&state.showFrame);});
    byId('eve-save').addEventListener('click',saveLocal);byId('eve-load').addEventListener('click',loadLocal);byId('eve-reset-pose').addEventListener('click',resetPose);byId('eve-reset-target').addEventListener('click',resetTarget);byId('eve-export').addEventListener('click',exportJS);byId('eve-copy').addEventListener('click',copyJS);
  }
  function init(){
    const root=document.getElementById('enemies');
    const canvas=document.getElementById('game');
    // Chapter 1–3 use the DOM enemy layer; Chapter 4 draws enemies on Canvas.
    // Both page types can host the same visual editor.
    if(!document.body||(!root&&!canvas))return;
    buildUI();syncConfig();
    window.addEventListener('storage',event=>{if(event.key===REGISTRY_STORAGE_KEY)refreshTargetsFromRegistry();});
    if(window.BroadcastChannel){const registryChannel=new BroadcastChannel(REGISTRY_STORAGE_KEY);registryChannel.addEventListener('message',event=>{if(event.data?.type==='registry-updated')refreshTargetsFromRegistry();});}
    window.addEventListener('prince:enemy-registry-updated',refreshTargetsFromRegistry);
    if(root){
      const observer=new MutationObserver(records=>{
        let added=false;records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1&&(node.matches?.('.enemy')||node.querySelector?.('.enemy')))added=true;}));
        if(added)window.EnemyVisualController?.apply();
      });observer.observe(root,{childList:true,subtree:true});
    }
    if(canvas){
      document.body.classList.add('eve-canvas-runtime-page');
      window.addEventListener('chapter4:stagechange',()=>{if(state.isOpen&&state.chapter===4)refreshStats();});
    }
    document.addEventListener('keydown',event=>{const shortcut=event.code==='Digit2'||event.code==='Numpad2';if(!shortcut||event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey)return;const active=document.activeElement;if(active&&/^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName))return;event.preventDefault();setOpen(!state.isOpen);});
    window.EnemyVisualEditor={getConfig:()=>JSON.parse(JSON.stringify(window.ENEMY_VISUAL_CONFIG)),getTargets:()=>TARGETS.map(target=>({id:target.id,chapter:target.chapter,label:target.label,group:target.group,poses:(target.assets||[]).map(asset=>asset.pose)})),getEntry:id=>entries[id]?clone(entries[id]):null,refreshRegistry:refreshTargetsFromRegistry,apply:syncConfig,open:()=>setOpen(true),close:()=>setOpen(false),isCanvasMode:!!canvas};
  }
  window.PrinceEnemyVisualRegistryBridge={getTargets:()=>TARGETS.map(target=>({id:target.id,chapter:target.chapter,label:target.label,poses:(target.assets||[]).map(asset=>asset.pose)})),getEntry:id=>entries[id]?clone(entries[id]):null,refresh:refreshTargetsFromRegistry,sync:writeVisualConfigToRegistry};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
