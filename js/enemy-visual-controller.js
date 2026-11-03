/*
 * Shared Enemy Visual Controller
 * Both index.html and index_Enemy Editor.html load this file and the same
 * js/enemy-visual-config.js. It applies only visual scale/offset to the art
 * layer; enemy frame, collision, HP, AI and movement are left untouched.
 */
(() => {
  'use strict';

  const config = window.ENEMY_VISUAL_CONFIG || {};
  const entries = config.entries || {};
  const targets = [
    ['chapter1_enemy_1', 'assassin'],
    ['chapter1_enemy_2', 'shield'],
    ['chapter1_enemy_2', 'heavy'],
    ['chapter1_enemy_3', 'acolyte'],
    ['chapter1_enemy_4', 'archer'],
    ['chapter1_enemy_5', 'skeleton'],
    ['chapter1_boss_1', 'boss'],
    ...Array.from({ length: 7 }, (_, i) => [`chapter2_enemy_${i + 1}`, `chapter2_enemy_${i + 1}`]),
    ['chapter2_boss_1', 'chapter2_boss_1'],
    ['chapter2_boss_2', 'chapter2_boss_2'],
    ['chapter2_boss_2_minion', 'chapter2_boss_2', true],
    ...Array.from({ length: 8 }, (_, i) => [`chapter3_enemy_${i + 1}`, `chapter3_enemy_${i + 1}`]),
    ['chapter3_boss_1', 'chapter3_boss_1'],
    ['chapter3_boss_1_tentacle', 'chapter3_boss_1_tentacle']
  ];

  function clean(raw) {
    const n = raw || {};
    const number = (value, fallback, min, max) => {
      const parsed = Number(value);
      return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : fallback));
    };
    return {
      scale: number(n.scale, 1, 0.35, 3),
      offsetX: number(n.offsetX, 0, -150, 150),
      offsetY: number(n.offsetY, 0, -150, 150)
    };
  }

  function getControl(enemy) {
    const art = enemy.querySelector(':scope > .enemy-art') || enemy.querySelector('.enemy-art');
    if (!art) return null;
    let control = art.querySelector(':scope > .eve-art-control');
    if (!control) {
      control = document.createElement('div');
      control.className = 'eve-art-control';
      while (art.firstChild) control.appendChild(art.firstChild);
      art.appendChild(control);
    }
    return control;
  }

  function applyOne(id, selector) {
    const entry = clean(entries[id]);
    document.querySelectorAll(selector).forEach(enemy => {
      const control = getControl(enemy);
      if (!control) return;
      control.style.setProperty('scale', String(entry.scale), 'important');
      control.style.setProperty('translate', `${entry.offsetX}px ${entry.offsetY}px`, 'important');
      control.style.setProperty('transform-origin', '50% 100%', 'important');
    });
  }

  function applyAll() {
    targets.forEach(([id, type, isMinion]) => {
      const selector = isMinion
        ? `#enemies > .enemy.spider-minion[data-sprite-type="${type}"]`
        : `#enemies > .enemy[data-sprite-type="${type}"]${id === 'chapter2_boss_2' ? ':not(.spider-minion)' : ''}`;
      applyOne(id, selector);
    });
  }

  function init() {
    const root = document.getElementById('enemies');
    if (!root) return;
    applyAll();
    const observer = new MutationObserver(records => {
      const hasNewEnemy = records.some(record => Array.from(record.addedNodes).some(node =>
        node.nodeType === 1 && (node.matches?.('.enemy') || node.querySelector?.('.enemy'))
      ));
      if (hasNewEnemy) applyAll();
    });
    observer.observe(root, { childList: true, subtree: true });
    window.EnemyVisualController = {
      apply: applyAll,
      getConfig: () => JSON.parse(JSON.stringify(config))
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
