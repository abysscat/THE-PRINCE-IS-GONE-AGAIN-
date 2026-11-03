/*
 * ENEMY VISUAL EDITOR
 * 將獨立控制層放在 .enemy-art 內，不改動原本 .enemy-art 的定位／左右翻轉，
 * 只縮放或位移圖片美術層；不更動敵人外框、碰撞、HP、AI 或傷害。
 * 鍵盤 2 開關；調整即時預覽；支援本機保存及匯出 JS。
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'prince-game.enemy-visual-editor.v1';
  const CONFIG_VERSION = String(window.ENEMY_VISUAL_CONFIG?.configVersion || 'bundle-default-v1.5-shared');
  const TARGETS = [
    { id: 'chapter1_enemy_1', label: 'Chapter 1 · Enemy 1（刺客）', selector: '#enemies > .enemy[data-sprite-type="assassin"]' },
    { id: 'chapter1_enemy_2', label: 'Chapter 1 · Enemy 2（盾牌兵／重裝精英）', selector: '#enemies > .enemy[data-sprite-type="shield"], #enemies > .enemy[data-sprite-type="heavy"]' },
    { id: 'chapter1_enemy_3', label: 'Chapter 1 · Enemy 3（精英級）', selector: '#enemies > .enemy[data-sprite-type="acolyte"]' },
    { id: 'chapter1_enemy_4', label: 'Chapter 1 · Enemy 4（弓箭手）', selector: '#enemies > .enemy[data-sprite-type="archer"]' },
    { id: 'chapter1_enemy_5', label: 'Chapter 1 · Enemy 5（普通兵）', selector: '#enemies > .enemy[data-sprite-type="skeleton"]' },
    { id: 'chapter1_boss_1', label: 'Chapter 1 · Boss 1', selector: '#enemies > .enemy[data-sprite-type="boss"]' },

    { id: 'chapter2_enemy_1', label: 'Chapter 2 · Enemy 1', selector: '#enemies > .enemy[data-sprite-type="chapter2_enemy_1"]' },
    { id: 'chapter2_enemy_2', label: 'Chapter 2 · Enemy 2', selector: '#enemies > .enemy[data-sprite-type="chapter2_enemy_2"]' },
    { id: 'chapter2_enemy_3', label: 'Chapter 2 · Enemy 3', selector: '#enemies > .enemy[data-sprite-type="chapter2_enemy_3"]' },
    { id: 'chapter2_enemy_4', label: 'Chapter 2 · Enemy 4', selector: '#enemies > .enemy[data-sprite-type="chapter2_enemy_4"]' },
    { id: 'chapter2_enemy_5', label: 'Chapter 2 · Enemy 5', selector: '#enemies > .enemy[data-sprite-type="chapter2_enemy_5"]' },
    { id: 'chapter2_enemy_6', label: 'Chapter 2 · Enemy 6', selector: '#enemies > .enemy[data-sprite-type="chapter2_enemy_6"]' },
    { id: 'chapter2_enemy_7', label: 'Chapter 2 · Enemy 7', selector: '#enemies > .enemy[data-sprite-type="chapter2_enemy_7"]' },
    { id: 'chapter2_boss_1', label: 'Chapter 2 · Boss 1（隱藏頭目）', selector: '#enemies > .enemy[data-sprite-type="chapter2_boss_1"]' },
    { id: 'chapter2_boss_2', label: 'Chapter 2 · Boss 2（蜘蛛）', selector: '#enemies > .enemy[data-sprite-type="chapter2_boss_2"]:not(.spider-minion)' },
    { id: 'chapter2_boss_2_minion', label: 'Chapter 2 · 蜘蛛小弟', selector: '#enemies > .enemy.spider-minion[data-sprite-type="chapter2_boss_2"]' },

    { id: 'chapter3_enemy_1', label: 'Chapter 3 · Enemy 1（鬼魂）', selector: '#enemies > .enemy[data-sprite-type="chapter3_enemy_1"]' },
    { id: 'chapter3_enemy_2', label: 'Chapter 3 · Enemy 2', selector: '#enemies > .enemy[data-sprite-type="chapter3_enemy_2"]' },
    { id: 'chapter3_enemy_3', label: 'Chapter 3 · Enemy 3', selector: '#enemies > .enemy[data-sprite-type="chapter3_enemy_3"]' },
    { id: 'chapter3_enemy_4', label: 'Chapter 3 · Enemy 4', selector: '#enemies > .enemy[data-sprite-type="chapter3_enemy_4"]' },
    { id: 'chapter3_enemy_5', label: 'Chapter 3 · Enemy 5', selector: '#enemies > .enemy[data-sprite-type="chapter3_enemy_5"]' },
    { id: 'chapter3_enemy_6', label: 'Chapter 3 · Enemy 6', selector: '#enemies > .enemy[data-sprite-type="chapter3_enemy_6"]' },
    { id: 'chapter3_enemy_7', label: 'Chapter 3 · Enemy 7', selector: '#enemies > .enemy[data-sprite-type="chapter3_enemy_7"]' },
    { id: 'chapter3_enemy_8', label: 'Chapter 3 · Enemy 8', selector: '#enemies > .enemy[data-sprite-type="chapter3_enemy_8"]' },
    { id: 'chapter3_boss_1', label: 'Chapter 3 · Boss 1（雷暴海王）', selector: '#enemies > .enemy[data-sprite-type="chapter3_boss_1"]' },
    { id: 'chapter3_boss_1_tentacle', label: 'Chapter 3 · Boss 1 觸手', selector: '#enemies > .enemy[data-sprite-type="chapter3_boss_1_tentacle"]' }
  ];

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const cleanEntry = (raw = {}) => ({
    scale: clamp(raw.scale ?? 1, 0.35, 3),
    offsetX: clamp(raw.offsetX ?? 0, -150, 150),
    offsetY: clamp(raw.offsetY ?? 0, -150, 150)
  });
  const defaults = {};
  TARGETS.forEach(target => { defaults[target.id] = cleanEntry(window.ENEMY_VISUAL_CONFIG?.entries?.[target.id]); });

  // Both HTML entry points start from the same bundled enemy-visual-config.js.
  // Browser drafts are loaded only when the user explicitly requests it, so
  // index.html and index_Enemy Editor.html cannot silently show different sizes.
  let entries = { ...defaults };

  const state = { selected: TARGETS[0].id, showFrame: false, isOpen: false, dirty: false };
  const byId = id => document.getElementById(id);
  const targetById = id => TARGETS.find(item => item.id === id) || TARGETS[0];
  const getNodes = target => {
    try { return Array.from(document.querySelectorAll(target.selector)); }
    catch (error) { return []; }
  };

  function getArtControl(enemy) {
    // 控制層放進 .enemy-art 內，讓原本 .enemy-art 繼續負責定位、翻面及濾鏡。
    // 其內所有原有內容（enemy-art-frame、sprite、特效）一併保留，不改 game.js 查找結構。
    const art = enemy.querySelector(':scope > .enemy-art') || enemy.querySelector('.enemy-art');
    if (!art) return null;
    let control = art.querySelector(':scope > .eve-art-control');
    if (control) return control;

    control = document.createElement('div');
    control.className = 'eve-art-control';
    const existingChildren = Array.from(art.childNodes);
    existingChildren.forEach(child => control.appendChild(child));
    art.appendChild(control);
    return control;
  }

  function applyTarget(target) {
    const config = entries[target.id] || cleanEntry();
    const nodes = getNodes(target);
    nodes.forEach(enemy => {
      const control = getArtControl(enemy);
      if (!control) return;
      control.style.setProperty('scale', String(config.scale), 'important');
      control.style.setProperty('translate', `${config.offsetX}px ${config.offsetY}px`, 'important');
      control.style.setProperty('transform-origin', '50% 100%', 'important');
      enemy.classList.toggle('eve-selected', state.isOpen && target.id === state.selected);
    });
    return nodes;
  }

  function applyAll() {
    TARGETS.forEach(applyTarget);
    refreshStats();
  }
  function selectedNodes() { return getNodes(targetById(state.selected)); }
  function updateLabels() {
    const config = entries[state.selected];
    byId('eve-scale-value').textContent = `${config.scale.toFixed(2)}x`;
    byId('eve-x-value').textContent = `${config.offsetX}px`;
    byId('eve-y-value').textContent = `${config.offsetY}px`;
    byId('eve-scale').value = String(config.scale);
    byId('eve-x').value = String(config.offsetX);
    byId('eve-y').value = String(config.offsetY);
  }
  function refreshStats() {
    const nodes = selectedNodes();
    byId('eve-count').textContent = `${nodes.length} 隻`;
    const first = nodes[0];
    if (first) {
      byId('eve-frame-size').textContent = `${Math.round(first.offsetWidth)} × ${Math.round(first.offsetHeight)} px`;
      byId('eve-preview-size').textContent = `${(entries[state.selected].scale * 100).toFixed(0)}%`;
      byId('eve-empty-note').textContent = '已即時套用到畫面上同類敵人；之後新生成的敵人也會自動套用。';
    } else {
      byId('eve-frame-size').textContent = '尚未生成';
      byId('eve-preview-size').textContent = `${(entries[state.selected].scale * 100).toFixed(0)}%`;
      byId('eve-empty-note').textContent = '目前場上沒有此類敵人。你可以先設定，之後進入對應關卡時會自動套用。';
    }
  }
  function setDirty(message = '有未儲存的調整。按「儲存到本機」可保留設定。') {
    state.dirty = true;
    byId('eve-status').textContent = message;
  }
  function applyCurrent() {
    applyTarget(targetById(state.selected));
    updateLabels();
    refreshStats();
  }
  function setOpen(open) {
    state.isOpen = Boolean(open);
    const panel = byId('enemyVisualEditor');
    panel.hidden = !state.isOpen;
    byId('enemyVisualEditorLauncher').setAttribute('aria-expanded', String(state.isOpen));
    document.body.classList.toggle('eve-show-frame', state.isOpen && state.showFrame);
    if (state.isOpen) {
      applyAll();
      byId('eve-target').focus({ preventScroll: true });
    } else {
      document.querySelectorAll('#enemies > .enemy.eve-selected').forEach(node => node.classList.remove('eve-selected'));
      document.body.classList.remove('eve-show-frame');
    }
  }

  function configSource() {
    const exported = {};
    TARGETS.forEach(target => { exported[target.id] = cleanEntry(entries[target.id]); });
    const exportVersion = `export-${Date.now()}`;
    return `/* Enemy Visual Config — generated by ENEMY VISUAL EDITOR */\nwindow.ENEMY_VISUAL_CONFIG = {\n  schemaVersion: 1,\n  configVersion: ${JSON.stringify(exportVersion)},\n  entries: ${JSON.stringify(exported, null, 2)}\n};\n`;
  }
  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, configVersion: CONFIG_VERSION, entries }));
      state.dirty = false;
      byId('eve-status').textContent = '本機草稿已保存；不會改寫共用設定檔。重開後按「載入本機草稿」可繼續預覽；要同步兩個入口請匯出設定 JS。';
    } catch (error) {
      byId('eve-status').textContent = '瀏覽器未允許本機儲存；請使用「匯出設定 JS」保存設定。';
    }
  }
  function loadLocal() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!stored || !stored.entries || typeof stored.entries !== 'object') {
        byId('eve-status').textContent = '找不到本機草稿。正式遊戲與編輯版目前都使用 js/enemy-visual-config.js。';
        return;
      }
      TARGETS.forEach(target => {
        if (stored.entries[target.id]) entries[target.id] = cleanEntry(stored.entries[target.id]);
      });
      applyAll();
      updateLabels();
      state.dirty = false;
      byId('eve-status').textContent = '已載入本機草稿，現在只在此編輯頁預覽。要同步正式遊戲，請匯出設定 JS 並覆蓋 js/enemy-visual-config.js。';
    } catch (error) {
      byId('eve-status').textContent = '無法讀取本機草稿；請使用正式設定 JS。';
    }
  }

  function exportJS() {
    const blob = new Blob([configSource()], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'enemy-visual-config.js';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    byId('eve-status').textContent = '已匯出 enemy-visual-config.js。覆蓋遊戲 js 資料夾內同名檔案後，index.html 與 index_Enemy Editor.html 會讀取同一套正式設定。';
  }
  async function copyJS() {
    const text = configSource();
    try {
      await navigator.clipboard.writeText(text);
      byId('eve-status').textContent = '設定程式碼已複製。';
    } catch (error) {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (copyError) { copied = false; }
      area.remove();
      byId('eve-status').textContent = copied ? '設定程式碼已複製。' : '無法存取剪貼簿，請使用「匯出設定 JS」。';
    }
  }
  function resetSelected() {
    entries[state.selected] = cleanEntry(defaults[state.selected]);
    applyCurrent();
    setDirty('已重設這種敵人的倍率及位置；按「儲存到本機」才會保留。');
  }

  function buildUI() {
    const launcher = document.createElement('button');
    launcher.id = 'enemyVisualEditorLauncher';
    launcher.type = 'button';
    launcher.innerHTML = '<span aria-hidden="true">⚙</span><span>ENEMY EDITOR · 2</span>';
    launcher.setAttribute('aria-controls', 'enemyVisualEditor');
    launcher.setAttribute('aria-expanded', 'false');

    const panel = document.createElement('section');
    panel.id = 'enemyVisualEditor';
    panel.hidden = true;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Enemy Visual Editor');
    panel.innerHTML = `
      <div class="eve-head">
        <div><h2 class="eve-title">ENEMY VISUAL EDITOR</h2><div class="eve-subtitle">敵人圖片尺寸與位置即時調整</div></div>
        <button class="eve-close" id="eve-close" type="button" aria-label="關閉編輯器">×</button>
      </div>
      <div class="eve-card">
        <label class="eve-field"><span class="eve-labelrow"><span>選擇敵人</span><span class="eve-value" id="eve-count">0 隻</span></span><select id="eve-target"></select></label>
        <div class="eve-field">
          <div class="eve-labelrow"><label for="eve-scale">圖片倍率</label><span class="eve-value" id="eve-scale-value">1.00x</span></div>
          <input id="eve-scale" type="range" min="0.35" max="3" step="0.05" value="1">
          <div class="eve-scale-ends"><span>0.35x 縮小</span><span>1.00x 目前原貌</span><span>3.00x 放大</span></div>
        </div>
        <div class="eve-field">
          <div class="eve-labelrow"><label for="eve-x">左右位置</label><span class="eve-value" id="eve-x-value">0px</span></div>
          <input id="eve-x" type="range" min="-150" max="150" step="1" value="0">
        </div>
        <div class="eve-field">
          <div class="eve-labelrow"><label for="eve-y">上下位置</label><span class="eve-value" id="eve-y-value">0px</span></div>
          <input id="eve-y" type="range" min="-150" max="150" step="1" value="0">
        </div>
        <label class="eve-checkrow"><input id="eve-show-frame" type="checkbox"> 顯示選中敵人的外框（只供參考，不是攻擊判定範圍）</label>
        <div class="eve-stats">
          <div class="eve-stat"><span>敵人外框（不會修改）</span><strong id="eve-frame-size">—</strong></div>
          <div class="eve-stat"><span>圖片額外倍率</span><strong id="eve-preview-size">100%</strong></div>
        </div>
        <p class="eve-note" id="eve-empty-note">目前場上沒有此類敵人。你可以先設定，之後進入對應關卡時會自動套用。</p>
      </div>
      <div class="eve-actions">
        <button class="primary" id="eve-save" type="button">儲存本機草稿</button>
        <button id="eve-load" type="button">載入本機草稿</button>
        <button id="eve-reset" type="button">重設此敵人</button>
        <button id="eve-export" type="button">匯出設定 JS</button>
        <button id="eve-copy" type="button">複製設定程式碼</button>
        <button class="eve-full" id="eve-close-bottom" type="button">完成並關閉</button>
      </div>
      <div class="eve-status" id="eve-status" role="status" aria-live="polite">調整會即時預覽；記得儲存或匯出設定。</div>
      <div class="eve-footer">鍵盤 2：開啟／關閉。正式遊戲 index.html 與本編輯版共用 js/enemy-visual-config.js。載入本機草稿只會暫時覆蓋本編輯頁預覽；要正式同步兩個入口及其他電腦，請匯出設定 JS 並覆蓋 js/enemy-visual-config.js。此工具只改圖片顯示，不改外框、碰撞、HP、AI、移動速度或傷害。</div>
    `;
    document.body.append(launcher, panel);

    const select = byId('eve-target');
    TARGETS.forEach(target => {
      const option = document.createElement('option');
      option.value = target.id;
      option.textContent = target.label;
      select.appendChild(option);
    });
    select.value = state.selected;
    updateLabels();
    refreshStats();

    launcher.addEventListener('click', () => setOpen(!state.isOpen));
    byId('eve-close').addEventListener('click', () => setOpen(false));
    byId('eve-close-bottom').addEventListener('click', () => setOpen(false));
    select.addEventListener('change', () => {
      state.selected = select.value;
      TARGETS.forEach(target => getNodes(target).forEach(node => node.classList.remove('eve-selected')));
      applyCurrent();
    });
    const bindSlider = (id, field, min, max) => {
      byId(id).addEventListener('input', event => {
        entries[state.selected][field] = clamp(event.target.value, min, max);
        applyCurrent();
        setDirty();
      });
    };
    bindSlider('eve-scale', 'scale', 0.35, 3);
    bindSlider('eve-x', 'offsetX', -150, 150);
    bindSlider('eve-y', 'offsetY', -150, 150);
    byId('eve-show-frame').addEventListener('change', event => {
      state.showFrame = event.target.checked;
      document.body.classList.toggle('eve-show-frame', state.isOpen && state.showFrame);
    });
    byId('eve-save').addEventListener('click', saveLocal);
    byId('eve-load').addEventListener('click', loadLocal);
    byId('eve-reset').addEventListener('click', resetSelected);
    byId('eve-export').addEventListener('click', exportJS);
    byId('eve-copy').addEventListener('click', copyJS);
  }

  function init() {
    if (!document.body || !document.getElementById('enemies')) return;
    buildUI();
    applyAll();

    const enemyRoot = document.getElementById('enemies');
    const observer = new MutationObserver(records => {
      let changed = false;
      records.forEach(record => {
        record.addedNodes.forEach(node => {
          if (node.nodeType === 1 && (node.matches?.('.enemy') || node.querySelector?.('.enemy'))) changed = true;
        });
      });
      if (changed) applyAll();
    });
    observer.observe(enemyRoot, { childList: true, subtree: true });

    document.addEventListener('keydown', event => {
      const isEditorShortcut = event.code === 'Digit2' || event.code === 'Numpad2';
      if (!isEditorShortcut || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const active = document.activeElement;
      if (active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) return;
      event.preventDefault();
      setOpen(!state.isOpen);
    });

    window.EnemyVisualEditor = {
      getConfig: () => JSON.parse(JSON.stringify({ schemaVersion: 1, entries })),
      apply: () => applyAll(),
      open: () => setOpen(true),
      close: () => setOpen(false)
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
