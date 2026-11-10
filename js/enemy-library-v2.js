/* Prince Game Development Editor V2 — Dynamic Enemy Library.
 * Legacy files and globals are intentionally not overwritten.
 */
(() => {
  'use strict';
  const STORAGE_KEY = 'prince-game.enemy-registry.v2';
  const DB_NAME = 'prince-game-enemy-assets-v2';
  const DB_STORE = 'assets';
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  let registry = [];
  let currentId = null;
  let selectedAction = null;
  let currentFrame = 0;
  let previewPlaying = false;
  let previewRaf = 0;
  let lastPreviewFrame = -1;
  let previewStartTime = 0;
  let imageUrls = new Map();
  let dbPromise;
  let isNewRecord = false;
  let dirty = false;
  const visualConfigDirtyIds = new Set();

  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  function setStatus(message, bad = false) {
    $('storageStatus').textContent = message;
    $('storageStatus').style.color = bad ? '#e8a39a' : '#91a4b9';
  }
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('此瀏覽器不支援 IndexedDB')); return; }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('無法開啟 IndexedDB'));
    });
    return dbPromise;
  }
  async function putAsset(file) {
    const db = await openDB();
    const id = `asset_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put({ id, name: file.name, type: file.type, blob: file, size: file.size, addedAt: new Date().toISOString() });
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || new Error('圖片寫入失敗'));
    });
    return { id, name: file.name, type: file.type, size: file.size };
  }
  async function getAsset(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('圖片讀取失敗'));
    });
  }
  async function resolveSource(src) {
    if (!src) return '';
    if (!src.startsWith('asset://')) return src;
    const id = src.slice(8);
    if (imageUrls.has(id)) return imageUrls.get(id);
    const asset = await getAsset(id);
    if (!asset?.blob) throw new Error(`素材不存在：${id}`);
    const url = URL.createObjectURL(asset.blob);
    imageUrls.set(id, url);
    return url;
  }
  function normalizeRecord(record) {
    const r = clone(record || {});
    r.id = String(r.id || '').trim();
    r.name = String(r.name || r.id);
    r.chapter = Math.min(6, Math.max(1, Number(r.chapter) || 1));
    r.type = ['normal', 'elite', 'boss'].includes(r.type) ? r.type : 'normal';
    const supportedAi=['legacy-runtime','patrol','chase','ranged','guard','ambush','ground','boss'];
    if(!supportedAi.includes(r.aiType))r.aiType=r.legacy?'legacy-runtime':'chase';
    r.normalSize = Number(r.normalSize) || 100;
    r.animations = r.animations && typeof r.animations === 'object' ? r.animations : {};
    Object.entries(r.animations).forEach(([key, action]) => {
      action.frames = Array.isArray(action.frames) ? action.frames : [];
      action.fps = Number(action.fps) || 6;
      action.loop = action.loop !== false;
      action.size = Number(action.size) || 100;
      action.x = Number(action.x) || 0; action.y = Number(action.y) || 0;
      action.anchorX = Number.isFinite(Number(action.anchorX)) ? Number(action.anchorX) : 0.5;
      action.anchorY = Number.isFinite(Number(action.anchorY)) ? Number(action.anchorY) : 1;
      action.groundAlignment = action.groundAlignment !== false;
    });
    return r;
  }
  function readRegistry() {
    const candidates=[];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const parsed = JSON.parse(raw); if (parsed && Array.isArray(parsed.enemies)) candidates.push(parsed.enemies); }
    } catch (err) { console.warn('Enemy Registry local data could not be read:', err); }
    candidates.push(window.PRINCE_ENEMY_REGISTRY_V2?.enemies,window.PRINCE_ENEMY_REGISTRY?.enemies,window.PRINCE_ENEMY_REGISTRY_SEED,window.PRINCE_BOSS_CONFIG?.bosses);
    const merged=new Map();
    candidates.filter(Array.isArray).forEach(rows=>rows.forEach(record=>{if(record?.id&&!merged.has(record.id))merged.set(record.id,normalizeRecord(record));}));
    return [...merged.values()];
  }
  function writeRegistry() {
    // Preserve V1.8 visual settings written by another tab before this page saves gameplay fields.
    try {
      const latest = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (Array.isArray(latest?.enemies)) {
        const latestById = new Map(latest.enemies.map(record => [record.id, record]));
        registry.forEach(record => {
          const fresh = latestById.get(record.id);
          if (fresh && fresh.visualConfig && !visualConfigDirtyIds.has(record.id)) record.visualConfig = clone(fresh.visualConfig);
        });
      }
    } catch (error) { console.warn('Could not merge latest Registry visual settings:', error); }
    const payload = { schemaVersion: 1, configVersion: '2.0.0', updatedAt: new Date().toISOString(), enemies: registry };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); }
    catch (err) { throw new Error(`Registry 儲存失敗：${err.message}。請檢查瀏覽器儲存空間。`); }
    window.PRINCE_ENEMY_REGISTRY_V2 = payload;
    visualConfigDirtyIds.clear();
    window.dispatchEvent(new CustomEvent('prince:enemy-registry-updated',{detail:{source:'enemy-library-v2'}}));
    if(window.BroadcastChannel){const channel=new BroadcastChannel(STORAGE_KEY);channel.postMessage({type:'registry-updated',source:'enemy-library-v2',updatedAt:payload.updatedAt});channel.close();}
  }
  function uniqueId(chapter, kind = 'enemy') {
    const prefix = `chapter${chapter}_${kind}`;
    const used = new Set(registry.map(r => r.id));
    let n = 1; while (used.has(`${prefix}_${n}`)) n++;
    return `${prefix}_${n}`;
  }
  function currentRecord() { return registry.find(r => r.id === currentId) || null; }
  function currentAnimation() { const r = currentRecord(); return r && selectedAction ? r.animations[selectedAction] || null : null; }
  function markDirty() { dirty = true; $('saveBtn').textContent = '儲存變更 *'; }
  function clearDirty() { dirty = false; $('saveBtn').textContent = '儲存變更'; }
  function typeLabel(type) { return ({normal:'普通敵人',elite:'精英敵人',boss:'Boss'})[type] || type; }
  function renderList() {
    const query = $('searchInput').value.trim().toLowerCase();
    const chapter = $('chapterFilter').value;
    const type = $('typeFilter').value;
    const rows = registry.filter(r => (!query || `${r.id} ${r.name}`.toLowerCase().includes(query)) && (chapter === 'all' || String(r.chapter) === chapter) && (type === 'all' || r.type === type))
      .sort((a,b) => a.chapter-b.chapter || a.id.localeCompare(b.id, undefined, {numeric:true}));
    $('enemyList').innerHTML = rows.length ? rows.map(r => `
      <button class="elv2-enemy-card ${r.id === currentId ? 'active' : ''}" data-id="${escapeHtml(r.id)}" type="button">
        <span class="elv2-enemy-avatar">C${r.chapter}</span><span class="elv2-enemy-meta"><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.id)} · ${Object.keys(r.animations || {}).length} actions</small></span><span class="elv2-enemy-chip">${typeLabel(r.type)}</span>
      </button>`).join('') : '<p class="elv2-hint" style="padding:12px">沒有符合條件的敵人。</p>';
    $('enemyCount').textContent = `${registry.length} 個登錄項目`;
    $('enemyList').querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', () => selectRecord(btn.dataset.id)));
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function showEditor(show) { $('emptyState').hidden = show; $('editorContent').hidden = !show; }
  function selectRecord(id) {
    stopPreview(); currentId = id; isNewRecord = false;
    const r = currentRecord(); if (!r) { showEditor(false); renderList(); return; }
    showEditor(true);
    $('editorHeading').textContent = r.name || r.id;
    $('editorSubheading').textContent = `${r.id} · Chapter ${r.chapter} · ${r.legacy ? 'Legacy 相容資料' : 'V2 Registry'}`;
    $('enemyId').value = r.id; $('enemyId').disabled = true;
    $('enemyName').value = r.name || '';
    $('enemyChapter').value = String(r.chapter);
    $('enemyType').value = r.type;
    $('normalSize').value = r.normalSize ?? 100;
    $('hp').value = r.hp ?? ''; $('attackDamage').value = r.attackDamage ?? '';
    $('movementSpeed').value = r.movementSpeed ?? ''; $('detectionRange').value = r.detectionRange ?? ''; $('attackRange').value = r.attackRange ?? '';
    $('aiType').value = r.aiType || 'chase';
    const chapter4Ready = Number(r.chapter) === 4 && ['legacy-runtime','patrol','chase','ranged','guard','ambush','ground','boss'].includes(r.aiType || 'chase');
    const visualSyncNote = r.visualConfig ? `已與 ENEMY VISUAL EDITOR V2 同步（基本倍率 ${Number(r.visualConfig.scale||1).toFixed(2)}x）。` : '視覺設定可在 ENEMY VISUAL EDITOR V2 編輯。';
    $('runtimeNotice').textContent = chapter4Ready
      ? `${visualSyncNote}Chapter 4 正式 Stage Runtime 支援 ${r.aiType || 'chase'} AI、攻擊、受擊、擊退及死亡。請在 Chapter 4 Stage 放置後測試。`
      : `${visualSyncNote}資料可保存及編輯，但 Chapter ${r.chapter} 的自訂敵人 Runtime 尚未完整接通；目前不應宣稱可正式戰鬥。`;
    $('duplicateBtn').disabled = false; $('deleteBtn').disabled = false;
    const actions = Object.keys(r.animations || {});
    selectedAction = actions.includes('normal') ? 'normal' : (actions[0] || null);
    renderActions(); renderList();
  }
  function bindRecordFields() {
    const r = currentRecord(); if (!r) return;
    r.name = $('enemyName').value.trim() || r.id;
    r.chapter = Number($('enemyChapter').value);
    r.type = $('enemyType').value;
    r.normalSize = Number($('normalSize').value) || 100;
    const fields = [['hp','hp'],['attackDamage','attackDamage'],['movementSpeed','movementSpeed'],['detectionRange','detectionRange'],['attackRange','attackRange']];
    fields.forEach(([element,key]) => { const v = $(element).value.trim(); r[key] = v === '' ? null : Number(v); });
    r.aiType = $('aiType').value;
    $('editorHeading').textContent = r.name;
    $('runtimeNotice').textContent = Number(r.chapter)===4 && ['legacy-runtime','patrol','chase','ranged','guard','ambush','ground','boss'].includes(r.aiType||'chase')
      ? `Chapter 4 正式 Runtime 支援 ${r.aiType||'chase'}；視覺設定、HP、攻擊、移動及 AI 會隨 Registry 儲存。Chapter 1–3、5–6 的自訂敵人仍需各章 Runtime Adapter。`
      : `Chapter ${r.chapter} 的自訂敵人資料可保存，但正式遊戲 AI Adapter 尚未完整接通。`;
    markDirty();
  }
  function getActionVisualValues(record, actionName, action) {
    const visual = record?.visualConfig;
    const poseKey = actionName === 'walk' ? 'walk1' : actionName;
    const pose = visual?.poses?.[poseKey];
    if (!pose) return { size: action.size ?? 100, x: action.x ?? 0, y: action.y ?? 0 };
    return {
      size: (Number(visual.scale) || 1) * (Number(pose.scale) || 1) * 100,
      x: (Number(visual.offsetX) || 0) + (Number(pose.offsetX) || 0),
      y: (Number(visual.offsetY) || 0) + (Number(pose.offsetY) || 0)
    };
  }
  function renderActions() {
    const r = currentRecord(); if (!r) return;
    const names = Object.keys(r.animations || {});
    $('actionList').innerHTML = names.length ? names.map(name => {
      const a = r.animations[name];
      return `<button type="button" class="elv2-action-item ${name === selectedAction ? 'active' : ''}" data-action-name="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><small>${(a.frames || []).length} frames</small></button>`;
    }).join('') : '<p class="elv2-hint" style="padding:10px">尚未建立動作。</p>';
    $('actionList').querySelectorAll('[data-action-name]').forEach(btn => btn.addEventListener('click', () => selectAction(btn.dataset.actionName)));
    const a = currentAnimation();
    const enabled = !!a; ['actionUpload','playPreviewBtn','prevFrameBtn','nextFrameBtn','removeActionBtn'].forEach(id => $(id).disabled = !enabled);
    $('removeFrameBtn').disabled = !a?.frames?.length;
    if (!a) { $('actionHeading').textContent = '選擇動作'; $('frameInfo').textContent = '0 / 0 frames'; renderFrameStrip(); drawPreview(null); return; }
    $('actionHeading').textContent = selectedAction;
    const visualValues = getActionVisualValues(r, selectedAction, a);
    $('animSize').value = visualValues.size; $('animX').value = visualValues.x; $('animY').value = visualValues.y;
    $('animFps').value = a.fps ?? 6; $('anchorX').value = a.anchorX ?? 0.5; $('anchorY').value = a.anchorY ?? 1;
    $('animLoop').checked = a.loop !== false; $('groundAlignment').checked = a.groundAlignment !== false;
    currentFrame = Math.min(currentFrame, Math.max(0, a.frames.length-1));
    renderFrameStrip(); drawPreview(a); updateFrameInfo();
  }
  function selectAction(name) { stopPreview(); selectedAction = name; currentFrame = 0; renderActions(); }
  function syncActionVisualConfig(record, actionName, action) {
    if (!record || !actionName || !action) return;
    const visual = record.visualConfig || { schemaVersion: 2, scale: 1, offsetX: 0, offsetY: 0, poses: {} };
    visual.poses = visual.poses || {};
    const scale = Math.max(.35, Number(visual.scale) || 1);
    const poseValue = { scale: (Number(action.size) || 100) / 100 / scale, offsetX: (Number(action.x) || 0) - (Number(visual.offsetX) || 0), offsetY: (Number(action.y) || 0) - (Number(visual.offsetY) || 0) };
    if (actionName === 'walk' && action.frames?.length > 1) {
      action.frames.forEach((frame, index) => { visual.poses[`walk${index+1}`] = clone(poseValue); });
    } else visual.poses[actionName] = clone(poseValue);
    visual.schemaVersion = 2;
    record.visualConfig = visual;
    visualConfigDirtyIds.add(record.id);
  }
  function updateActionFields() {
    const a = currentAnimation(); if (!a) return;
    a.size = Number($('animSize').value) || 100; a.x = Number($('animX').value) || 0; a.y = Number($('animY').value) || 0;
    a.fps = Math.max(0.1, Number($('animFps').value) || 6); a.anchorX = clamp(Number($('anchorX').value),0,1); a.anchorY = clamp(Number($('anchorY').value),0,1);
    a.loop = $('animLoop').checked; a.groundAlignment = $('groundAlignment').checked;
    syncActionVisualConfig(currentRecord(), selectedAction, a);
    drawPreview(a); markDirty();
  }
  function clamp(n,min,max){return Math.min(max,Math.max(min,Number(n)||0));}
  async function renderFrameStrip() {
    const a = currentAnimation(); const holder = $('frameStrip');
    if (!a?.frames?.length) { holder.innerHTML = '<span class="elv2-hint">尚未匯入影格。可一次選取多張 PNG / WebP。</span>'; return; }
    holder.innerHTML = '';
    a.frames.forEach((frame,index) => {
      const img = document.createElement('img'); img.className = `elv2-frame-thumb ${index === currentFrame ? 'active' : ''}`; img.alt = `Frame ${index+1}`; img.title = frame.label || frame.name || `Frame ${index+1}`;
      img.addEventListener('click', () => { currentFrame = index; drawPreview(a); updateFrameInfo(); renderFrameStrip(); });
      holder.appendChild(img);
      resolveSource(frame.path || frame.src).then(src => { img.src = src; }).catch(() => { img.alt = `Frame ${index+1} (missing)`; });
    });
  }
  function updateFrameInfo() { const a=currentAnimation(); $('frameInfo').textContent = a?.frames?.length ? `${currentFrame+1} / ${a.frames.length} frames` : '0 / 0 frames'; }
  function drawPreview(action) {
    const canvas = $('previewCanvas'), ctx = canvas.getContext('2d');
    const w=canvas.width,h=canvas.height,groundY=248;
    ctx.clearRect(0,0,w,h); ctx.fillStyle='#0a1421';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(130,154,178,.13)';ctx.lineWidth=1;
    for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(let y=0;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    ctx.strokeStyle='#d9a95e';ctx.setLineDash([8,6]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(18,groundY);ctx.lineTo(w-18,groundY);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#d9a95e';ctx.font='12px sans-serif';ctx.fillText('GROUND ALIGNMENT / FOOT BASELINE',18,groundY+23);
    if (!action?.frames?.length) { ctx.fillStyle='#91a4b9';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText('匯入圖片以預覽動畫',w/2,h/2);ctx.textAlign='left';return; }
    const frame=action.frames[currentFrame] || action.frames[0];
    resolveSource(frame.path || frame.src).then(src => {
      const image=new Image(); image.onload=()=>{
        ctx.clearRect(0,0,w,h);ctx.fillStyle='#0a1421';ctx.fillRect(0,0,w,h);
        ctx.strokeStyle='rgba(130,154,178,.13)';for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
        ctx.strokeStyle='#d9a95e';ctx.setLineDash([8,6]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(18,groundY);ctx.lineTo(w-18,groundY);ctx.stroke();ctx.setLineDash([]);
        const scale=(Number(action.size)||100)/100 * Math.min(1.8,190/Math.max(image.naturalWidth,image.naturalHeight));
        const dw=image.naturalWidth*scale,dh=image.naturalHeight*scale,ax=clamp(action.anchorX??.5,0,1),ay=clamp(action.anchorY??1,0,1);
        const x=w/2+(Number(action.x)||0)-dw*ax; const y=groundY+(Number(action.y)||0)-dh*(action.groundAlignment===false?.5:ay);
        ctx.save();ctx.globalAlpha=.98;ctx.drawImage(image,x,y,dw,dh);ctx.restore();
        const anchorX=w/2+(Number(action.x)||0),anchorY=groundY+(Number(action.y)||0);
        ctx.strokeStyle='#7dc7ed';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(anchorX-8,anchorY);ctx.lineTo(anchorX+8,anchorY);ctx.moveTo(anchorX,anchorY-8);ctx.lineTo(anchorX,anchorY+8);ctx.stroke();
        ctx.fillStyle='#91a4b9';ctx.font='11px sans-serif';ctx.fillText(`${image.naturalWidth} × ${image.naturalHeight}`,w-120,22);
      }; image.onerror=()=>{ctx.fillStyle='#e8a39a';ctx.fillText('圖片載入失敗',w/2,30);}; image.src=src;
    }).catch(err=>{ctx.fillStyle='#e8a39a';ctx.font='13px sans-serif';ctx.fillText(err.message,w/2-80,40);});
  }
  function tickPreview() {
    const a=currentAnimation(); if(!previewPlaying||!a?.frames?.length)return;
    const index=Math.floor((performance.now()-previewStartTime)/1000*Math.max(.1,a.fps||6));
    const next=a.loop?index%a.frames.length:Math.min(index,a.frames.length-1);
    if(next!==lastPreviewFrame){currentFrame=next;lastPreviewFrame=next;drawPreview(a);updateFrameInfo();renderFrameStrip();}
    if(!a.loop&&index>=a.frames.length){stopPreview();return;}
    previewRaf=requestAnimationFrame(tickPreview);
  }
  function startPreview(){const a=currentAnimation();if(!a?.frames?.length){toast('請先為這個動作匯入圖片。');return;}previewPlaying=true;previewStartTime=performance.now();currentFrame=0;lastPreviewFrame=-1;previewRaf=requestAnimationFrame(tickPreview);$('playPreviewBtn').textContent='Ⅱ 暫停';}
  function stopPreview(){previewPlaying=false;if(previewRaf)cancelAnimationFrame(previewRaf);previewRaf=0;$('playPreviewBtn').textContent='▶ 播放';}
  function addEnemy() {
    if (dirty && !saveCurrent()) return;
    const chapter=Number($('chapterFilter').value==='all'?4:$('chapterFilter').value);
    const r=normalizeRecord({id:uniqueId(chapter,'enemy'),name:`Chapter ${chapter} Enemy ${registry.filter(x=>x.chapter===chapter).length+1}`,chapter,type:'normal',normalSize:100,hp:100,attackDamage:1,movementSpeed:70,detectionRange:350,attackRange:100,aiType:'chase',legacy:false,animations:{normal:{frames:[],fps:6,loop:true,size:100,x:0,y:0,anchorX:.5,anchorY:1,groundAlignment:true}}});
    registry.push(r); currentId=r.id; dirty=true; writeRegistry(); clearDirty(); selectRecord(r.id); isNewRecord=true; $('enemyId').disabled=false; $('enemyId').value=r.id; toast(`${r.id} 已建立。請匯入 normal 素材後儲存。`);
  }
  function duplicateEnemy() {
    const r=currentRecord();if(!r)return;
    const copy=normalizeRecord(clone(r)); copy.id=uniqueId(copy.chapter,copy.type==='boss'?'boss':'enemy');copy.name=`${copy.name} Copy`;copy.legacy=false;copy.aiType='chase';
    registry.push(copy);writeRegistry();selectRecord(copy.id);toast(`已複製為 ${copy.id}。`);
  }
  function findReferences(id) {
    const found=[]; const seen=new Set();
    function walk(value,path,depth=0){if(depth>25||value==null)return;if(typeof value==='string'){if(value===id)found.push(path);return;}if(typeof value!=='object'||seen.has(value))return;seen.add(value);if(Array.isArray(value)){value.forEach((v,i)=>walk(v,`${path}[${i}]`,depth+1));}else Object.entries(value).forEach(([k,v])=>walk(v,`${path}.${k}`,depth+1));}
    if(window.PRINCE_STAGE_CONFIG)walk(window.PRINCE_STAGE_CONFIG,'PRINCE_STAGE_CONFIG');
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);if(!key||key===STORAGE_KEY)continue;
      const raw=localStorage.getItem(key);if(!raw||raw.length>12_000_000)continue;
      try{walk(JSON.parse(raw),`LocalStorage:${key}`);}catch{}
    }
    return [...new Set(found)];
  }
  function deleteEnemy() {
    const r=currentRecord();if(!r)return;
    const refs=findReferences(r.id);
    if(refs.length){alert(`無法刪除 ${r.id}：仍被 ${refs.length} 個位置引用。\n\n${refs.slice(0,12).join('\n')}\n\n請先在 Stage／事件資料解除引用，或保留此敵人。`);return;}
    if(!confirm(`確定刪除 ${r.id}？此操作會刪除 Registry 記錄，但不會刪除已匯出的素材檔案。`))return;
    registry=registry.filter(x=>x.id!==r.id);currentId=null;selectedAction=null;writeRegistry();clearDirty();showEditor(false);renderList();toast('Enemy 已從 Registry 刪除。');
  }
  function saveCurrent() {
    const r=currentRecord();if(!r)return true;
    bindRecordFields();
    const requestedId=$('enemyId').value.trim();
    if(!/^[a-zA-Z0-9_-]+$/.test(requestedId)){toast('Enemy ID 只可使用英文字母、數字、底線及連字號。');return false;}
    const duplicate=registry.find(x=>x.id===requestedId&&x!==r);
    if(duplicate){toast(`Enemy ID 重複：${requestedId}`);return false;}
    if(isNewRecord&&requestedId!==r.id){r.id=requestedId;currentId=requestedId;}
    if(!r.name.trim()){toast('請輸入 Enemy Name。');return false;}
    try{writeRegistry();clearDirty();renderList();$('editorHeading').textContent=r.name;$('editorSubheading').textContent=`${r.id} · Chapter ${r.chapter} · V2 Registry`;toast('Enemy Registry 已儲存。');return true;}
    catch(err){toast(err.message);return false;}
  }
  async function importFrames(files) {
    const a=currentAnimation();if(!a)return;
    const valid=[...files].filter(f=>['image/png','image/webp'].includes(f.type));
    if(!valid.length){toast('只支援 PNG / WebP。');return;}
    try{
      for(const file of valid){const asset=await putAsset(file);a.frames.push({path:`asset://${asset.id}`,label:file.name,name:file.name,assetId:asset.id,type:asset.type});}
      renderActions();markDirty();toast(`已匯入 ${valid.length} 張影格，請儲存敵人資料。`);
    }catch(err){toast(`匯入失敗：${err.message}`);}
    $('actionUpload').value='';
  }
  function addAction() {
    const r=currentRecord();if(!r)return;
    const name=prompt('輸入新動作名稱（例如 Attack2 / Skill1 / Projectile）：');if(!name)return;
    const key=name.trim().replace(/\s+/g,'_');if(!/^[a-zA-Z0-9_-]+$/.test(key)){toast('動作名稱只可使用英文字母、數字、底線及連字號。');return;}
    if(r.animations[key]){toast('這個動作已存在。');return;}
    r.animations[key]={frames:[],fps:8,loop:!['attack','hit','death'].includes(key.toLowerCase()),size:100,x:0,y:0,anchorX:.5,anchorY:1,groundAlignment:true};selectedAction=key;currentFrame=0;renderActions();markDirty();
  }
  function updateFrame(direction) {
    const a=currentAnimation();if(!a?.frames?.length)return;
    currentFrame=(currentFrame+direction+a.frames.length)%a.frames.length;drawPreview(a);updateFrameInfo();renderFrameStrip();
  }
  function removeCurrentAction(){const r=currentRecord();if(!r||!selectedAction)return;if(!confirm(`刪除動作 ${selectedAction}？`))return;delete r.animations[selectedAction];selectedAction=Object.keys(r.animations)[0]||null;currentFrame=0;renderActions();markDirty();}
  function removeCurrentFrame(){const a=currentAnimation();if(!a?.frames?.length)return;a.frames.splice(currentFrame,1);currentFrame=Math.max(0,Math.min(currentFrame,a.frames.length-1));renderActions();markDirty();}
  function toPortableRecords(records) {
    const output=clone(records),files=[];
    output.forEach(r=>Object.entries(r.animations||{}).forEach(([action,a])=>(a.frames||[]).forEach((frame,index)=>{
      if(frame.path?.startsWith('asset://')){
        const ext=(frame.name||'frame.webp').toLowerCase().endsWith('.png')?'png':'webp';
        const path=`images/enemies_v2/${r.id}/${action}/${String(index+1).padStart(3,'0')}.${ext}`;
        files.push({id:frame.path.slice(8),path,enemyId:r.id,action,index});frame.path=path;frame.src=undefined;frame.assetId=undefined;frame.name=undefined;
      }
    })));
    return {records:output,files};
  }
  function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  function registrySource(records) {
    return `/* Prince Game Dynamic Enemy Registry V2. Generated ${new Date().toISOString()}. */\nwindow.PRINCE_ENEMY_REGISTRY = ${JSON.stringify({schemaVersion:1,configVersion:'2.0.0',enemies:records},null,2)};\n`;
  }
  function aiSource(records) {
    const ai=records.map(r=>({id:r.id,chapter:r.chapter,type:r.type,aiType:r.aiType,attackMode:r.attackMode,hp:r.hp,attackDamage:r.attackDamage,movementSpeed:r.movementSpeed,detectionRange:r.detectionRange,attackRange:r.attackRange,attackCooldownMs:r.attackCooldownMs,keepDistance:r.keepDistance,patrol:r.patrol||null,bossConfig:r.bossConfig||null}));
    return `/* Prince Game Enemy AI Config V2. Chapter 4 Stage Runtime consumes these behavior parameters. */\nwindow.PRINCE_ENEMY_AI_CONFIG = ${JSON.stringify({schemaVersion:1,configVersion:'2.0.0',enemies:ai},null,2)};\n`;
  }
  async function exportJs(which) {
    if(dirty&&!saveCurrent())return;
    try{
      const portable=toPortableRecords(registry);
      const src=which==='ai'?aiSource(portable.records):registrySource(portable.records);
      const filename=which==='ai'?'enemy-ai-config.js':'enemy-registry.js';
      downloadBlob(new Blob([src],{type:'text/javascript;charset=utf-8'}),filename);
      toast(`${filename} 已輸出。自訂圖片路徑需搭配 Enemy Library ZIP。`);
    }catch(err){toast(`匯出失敗：${err.message}`);}
  }
  // Minimal ZIP writer (STORE method) so the package is portable without external CDN dependencies.
  const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
  function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;}
  function u16(v){return [v&255,(v>>>8)&255];}function u32(v){return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];}
  function concatBytes(parts){const len=parts.reduce((s,p)=>s+p.length,0);const out=new Uint8Array(len);let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;}
  function zipStore(files){
    const encoder=new TextEncoder(),local=[],central=[];let offset=0;const date=new Date(),dosTime=(date.getHours()<<11)|(date.getMinutes()<<5)|(Math.floor(date.getSeconds()/2)),dosDate=((date.getFullYear()-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate();
    for(const file of files){const name=encoder.encode(file.name),data=file.bytes instanceof Uint8Array?file.bytes:new Uint8Array(file.bytes),crc=crc32(data);
      const header=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(dosTime),...u16(dosDate),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)]);
      local.push(header,name,data);
      const cdir=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(dosTime),...u16(dosDate),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]);
      central.push(cdir,name);offset+=header.length+name.length+data.length;
    }
    const centralBytes=concatBytes(central),centralOffset=offset;
    const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralBytes.length),...u32(centralOffset),...u16(0)]);
    return new Blob([...local,centralBytes,end],{type:'application/zip'});
  }
  async function exportPackage() {
    if(dirty&&!saveCurrent())return;
    try{
      const portable=toPortableRecords(registry),files=[];
      const registryJs=registrySource(portable.records),aiJs=aiSource(portable.records);
      const manifest={schemaVersion:1,package:'Prince Game Enemy Library V2',generatedAt:new Date().toISOString(),enemyCount:registry.length,legacyRuntimeEntries:registry.filter(r=>r.legacy).length,customRuntimeEntries:registry.filter(r=>!r.legacy).length,chapter4RuntimeSupported:registry.filter(r=>Number(r.chapter)===4).length,files:[]};
      files.push({name:'js/enemy-registry.js',bytes:new TextEncoder().encode(registryJs)});
      files.push({name:'js/enemy-ai-config.js',bytes:new TextEncoder().encode(aiJs)});
      files.push({name:'enemy-registry.json',bytes:new TextEncoder().encode(JSON.stringify({schemaVersion:1,configVersion:'2.0.0',enemies:portable.records},null,2))});
      for(const item of portable.files){const asset=await getAsset(item.id);if(!asset?.blob)throw new Error(`缺少素材：${item.id}`);files.push({name:item.path,bytes:new Uint8Array(await asset.blob.arrayBuffer())});}
      manifest.files=files.map(f=>({path:f.name,size:f.bytes.length}));
      files.push({name:'PACKAGE_MANIFEST.json',bytes:new TextEncoder().encode(JSON.stringify(manifest,null,2))});
      files.push({name:'README_ZH.txt',bytes:new TextEncoder().encode('Enemy Library V2 素材包\n\n請保留 ZIP 內的 images/enemies_v2/ 相對路徑，並把 js/enemy-registry.js、js/enemy-ai-config.js 放入遊戲 js 資料夾。\n本包是 Enemy Library 資料與自訂圖片素材包，不是完整遊戲 ZIP。Chapter 4 自訂敵人 AI 由 chapter4-stage-runtime.js 執行；Chapter 1–3、5–6 的自訂敵人 Runtime 仍須對應章節 Adapter。\n')});
      downloadBlob(zipStore(files),'prince-enemy-library-v2-package.zip');toast(`Enemy Library ZIP 已匯出（${files.length} 個檔案）。`);
    }catch(err){toast(`ZIP 匯出失敗：${err.message}`);}
  }
  async function importLibraryJSON(file) {
    try{
      const parsed=JSON.parse(await file.text());const rows=Array.isArray(parsed)?parsed:(parsed.enemies||parsed.records);
      if(!Array.isArray(rows))throw new Error('JSON 沒有 enemies 陣列。');
      const ids=new Set(registry.map(r=>r.id));let added=0,skipped=0;
      rows.forEach(raw=>{const r=normalizeRecord(raw);if(!r.id||ids.has(r.id)){skipped++;return;}ids.add(r.id);registry.push(r);added++;});
      writeRegistry();renderList();toast(`匯入完成：新增 ${added} 筆，略過重複／無效 ID ${skipped} 筆。`);
    }catch(err){toast(`JSON 匯入失敗：${err.message}`);}
  }
  function init() {
    registry=readRegistry();
    try{writeRegistry();}catch(err){setStatus('無法保存資料',true);}
    renderList();showEditor(false);
    openDB().then(() => setStatus(`IndexedDB 可用 · ${registry.length} 筆資料`)).catch(err => setStatus(`素材資料庫不可用：${err.message}`, true));
    $('searchInput').addEventListener('input',renderList);$('chapterFilter').addEventListener('change',renderList);$('typeFilter').addEventListener('change',renderList);
    $('addEnemyBtn').addEventListener('click',addEnemy);$('saveBtn').addEventListener('click',saveCurrent);$('saveBtnBottom').addEventListener('click',saveCurrent);
    $('duplicateBtn').addEventListener('click',duplicateEnemy);$('deleteBtn').addEventListener('click',deleteEnemy);
    ['enemyName','enemyChapter','enemyType','normalSize','hp','attackDamage','movementSpeed','detectionRange','attackRange','aiType'].forEach(id=>{ $(id).addEventListener('input',bindRecordFields); $(id).addEventListener('change',bindRecordFields); });
    $('enemyId').addEventListener('input',markDirty);
    $('addActionBtn').addEventListener('click',addAction);$('actionUpload').addEventListener('change',e=>importFrames(e.target.files));$('removeActionBtn').addEventListener('click',removeCurrentAction);$('removeFrameBtn').addEventListener('click',removeCurrentFrame);
    ['animSize','animX','animY','animFps','anchorX','anchorY','animLoop','groundAlignment'].forEach(id=>$(id).addEventListener('input',updateActionFields));
    $('playPreviewBtn').addEventListener('click',()=>previewPlaying?stopPreview():startPreview());$('prevFrameBtn').addEventListener('click',()=>updateFrame(-1));$('nextFrameBtn').addEventListener('click',()=>updateFrame(1));
    $('exportJsBtn').addEventListener('click',()=>exportJs('registry'));$('exportAiBtn').addEventListener('click',()=>exportJs('ai'));$('exportPackageBtn').addEventListener('click',exportPackage);
    $('importLibraryBtn').addEventListener('click',()=>$('importLibraryFile').click());$('importLibraryFile').addEventListener('change',e=>{if(e.target.files[0])importLibraryJSON(e.target.files[0]);e.target.value='';});
    window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
    if(registry.length){selectRecord(registry[0].id);}
    window.addEventListener('storage',event=>{
      if(event.key!==STORAGE_KEY)return;
      if(dirty){setStatus('另一個分頁更新了 Registry；目前有未儲存修改，先儲存或重新載入以合併。',true);return;}
      const selected=currentId;registry=readRegistry();renderList();
      if(selected&&registry.some(record=>record.id===selected))selectRecord(selected);
      else if(registry.length)selectRecord(registry[0].id);
      else showEditor(false);
      setStatus(`已同步另一個分頁的 Registry 更新 · ${registry.length} 筆資料`);
    });
    if(window.BroadcastChannel){const channel=new BroadcastChannel(STORAGE_KEY);channel.addEventListener('message',event=>{
      if(event.data?.type!=='registry-updated'||dirty)return;
      const selected=currentId;registry=readRegistry();renderList();
      if(selected&&registry.some(record=>record.id===selected))selectRecord(selected);
      else if(registry.length)selectRecord(registry[0].id);
      else showEditor(false);
    });}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
