/* STAGE EDITOR V1 — platform layout, player start, stage exits and transition spawn points. */
(() => {
  'use strict';

  const DEFAULT_BG = 'images/chapter4/backgrounds/bg1_test.webp';
  const STORAGE_KEY = 'prince-game.stage-editor.v1';
  const $ = (id) => document.getElementById(id);
  const canvas = $('stageCanvas');
  const ctx = canvas.getContext('2d');
  const bgImage = new Image();
  const imageCache = new Map();
  const history = [];
  const defaultStage = () => ({
    id: 'chapter4_stage1', name: 'Chapter 4 · Stage 1', background: DEFAULT_BG,
    width: 1774, height: 1774, backgroundWidth: 1774, backgroundHeight: 1774, worldWidth: 1774, worldWidthManual: false, playerStart: null, platforms: [], enemies: [], exits: [], transitions: [], checkpoints: [], hazards: [], traps: [], teleports: [], waves: []
  });
  // Load the bundled Stage Editor export on first open. Older builds always created
  // a blank Stage 1 here, so the existing Chapter 4 project appeared to be missing.
  const bundledProject = window.PRINCE_STAGE_CONFIG && Array.isArray(window.PRINCE_STAGE_CONFIG.stages) && window.PRINCE_STAGE_CONFIG.stages.length
    ? JSON.parse(JSON.stringify(window.PRINCE_STAGE_CONFIG)) : null;
  const state = {
    project: bundledProject || { schemaVersion: 11, projectName: '王子又不見了！Stage Project', currentStageId: 'chapter4_stage1', assetLibrary: [], stages: [] },
    assetData: new Map(), legacyAssetPaths: new Map(),
    currentTool: 'select', selected: null, drawing: null, dragging: null,
    showCollision: true, showLabels: true, showBackground: true,
    preview: false, motionPlaying: false, motionTime: 0, lastFrame: 0,
    zoom: 1, fitZoom: 1, bgLoaded: false, toastTimer: null, inspectorEditing: false
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  if (!Array.isArray(state.project.stages) || !state.project.stages.length) state.project.stages = [defaultStage()];
  state.project.assetLibrary ||= [];
  state.project.stages.forEach(stage => {
    stage.platforms ||= []; stage.enemies ||= []; stage.exits ||= []; stage.transitions ||= []; stage.checkpoints ||= []; stage.hazards ||= []; stage.traps ||= []; stage.teleports ||= []; stage.waves ||= [];
  });
  if (!state.project.stages.some(stage => stage.id === state.project.currentStageId)) state.project.currentStageId = state.project.stages[0].id;
  const currentStage = () => state.project.stages.find(s => s.id === state.project.currentStageId) || state.project.stages[0];
  const uid = (prefix, rows) => { const used = new Set(rows.map(row => row.id)); let n = 1; while (used.has(`${prefix}_${n}`)) n++; return `${prefix}_${n}`; };
  const nextLabel = (prefix, rows) => { const used = new Set(rows.map(row => row.label)); let n = 1; while (used.has(`${prefix}${n}`)) n++; return `${prefix}${n}`; };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const point = (x, y) => ({ x: Math.round(x), y: Math.round(y) });

  // All chapter art is stored inside images/chapterN. Backgrounds use
  // backgrounds/, while platforms and Hazard art share bg/. Enemy Library
  // assets stay in enemies/. The chapter number comes from chapterN_stageM.
  function chapterNumber(stageOrId = currentStage()) {
    const id = typeof stageOrId === 'string' ? stageOrId : String(stageOrId?.id || '');
    const match = id.match(/chapter(\d+)/i);
    return Math.max(1, Number(match?.[1] || 4));
  }
  function chapterRoot(chapter = chapterNumber()) { return `images/chapter${Math.max(1, Number(chapter) || 4)}`; }
  function chapterAssetFolder(category, chapter = chapterNumber()) {
    const root = chapterRoot(chapter);
    if (category === 'background') return `${root}/backgrounds`;
    if (category === 'enemy') return `${root}/enemies`;
    return `${root}/bg`; // fixed / moving / Hazard decorative art
  }
  function chapterAssetPath(category, filename, chapter = chapterNumber()) {
    const safeName = String(filename || 'asset').split(/[\\/]/).pop().replace(/^\.+/, '') || 'asset';
    return `${chapterAssetFolder(category, chapter)}/${safeName}`;
  }
  function assetChapterNumber(asset, project = state.project) {
    const fromPath = String(asset?.path || '').match(/images\/chapter(\d+)\//i);
    if (fromPath) return Math.max(1, Number(fromPath[1]));
    const id = asset?.id;
    for (const stage of project?.stages || []) {
      if (stage.background === asset?.path) return chapterNumber(stage);
      if ((stage.platforms || []).some(o => o.imageAssetId === id || o.imageSrc === asset?.path)) return chapterNumber(stage);
      if ((stage.hazards || []).some(o => o.hazardImageAssetId === id || (o.hazardImageAssetIds || []).includes(id) || o.imageSrc === asset?.path || (o.imageFrames || []).includes(asset?.path))) return chapterNumber(stage);
    }
    return chapterNumber();
  }
  function inferAssetChapterFromReferences(asset, project = state.project) {
    const id = asset?.id, path = asset?.path;
    // A chapter-scoped path is authoritative. This allows one library image to
    // be reused by another chapter without moving its original file.
    const fromPath = String(path || '').match(/images\/chapter(\d+)\//i);
    if (fromPath) return Math.max(1, Number(fromPath[1]));
    for (const stage of project?.stages || []) {
      if (asset?.category === 'background' && stage.background === path) return chapterNumber(stage);
      if ((stage.platforms || []).some(o => o.imageAssetId === id || (!o.imageAssetId && o.imageSrc === path))) return chapterNumber(stage);
      if ((stage.hazards || []).some(o => o.hazardImageAssetId === id || (o.hazardImageAssetIds || []).includes(id) || (!o.hazardImageAssetId && o.imageSrc === path) || (o.imageFrames || []).includes(path))) return chapterNumber(stage);
    }
    return assetChapterNumber(asset, project);
  }
  function normalizeAssetFolders(project) {
    const pathChanges = new Map();
    const assets = Array.isArray(project.assetLibrary) ? project.assetLibrary : [];
    assets.forEach(asset => {
      if (!asset || typeof asset.path !== 'string' || !asset.path) return;
      const oldPath = asset.path;
      const chapter = inferAssetChapterFromReferences(asset, project);
      const category = ['background', 'enemy'].includes(asset.category) ? asset.category :
        (asset.category === 'hazard' ? 'hazard' : (asset.category === 'moving' ? 'moving' : 'fixed'));
      const targetPath = chapterAssetPath(category, oldPath, chapter);
      if (targetPath !== oldPath) {
        state.legacyAssetPaths.set(targetPath, oldPath);
        asset.path = targetPath;
        pathChanges.set(`${asset.id}::${oldPath}`, targetPath);
      }
      asset.chapter = chapter;
    });
    // Update each object by asset ID first. This avoids ambiguity when two
    // library records temporarily share the same legacy file path.
    for (const stage of project.stages || []) {
      const byId = new Map(assets.filter(Boolean).map(a => [a.id, a]));
      const bgAsset = assets.find(a => a?.category === 'background' &&
        (a._legacyPath === stage.background || state.legacyAssetPaths.get(a.path) === stage.background || a.path === stage.background));
      if (bgAsset) stage.background = bgAsset.path;
      (stage.platforms || []).forEach(platform => {
        const asset = byId.get(platform.imageAssetId) || assets.find(a =>
          ['fixed', 'moving'].includes(a?.category) &&
          (a.path === platform.imageSrc || state.legacyAssetPaths.get(a.path) === platform.imageSrc));
        if (asset) { platform.imageAssetId ||= asset.id; platform.imageSrc = asset.path; }
      });
      (stage.hazards || []).forEach(hazard => {
        const ids = Array.isArray(hazard.hazardImageAssetIds) ? hazard.hazardImageAssetIds.slice(0, 4) : [];
        while (ids.length < 4) ids.push('');
        if (!ids[0] && hazard.hazardImageAssetId) ids[0] = hazard.hazardImageAssetId;
        const legacyFrames = Array.isArray(hazard.imageFrames) ? hazard.imageFrames : [];
        const paths = Array.from({length: 4}, (_, index) => {
          const existingId = ids[index];
          const existingPath = legacyFrames[index] || (index === 0 ? hazard.imageSrc : '');
          const asset = byId.get(existingId) || assets.find(a => a?.category === 'hazard' &&
            (a.path === existingPath || state.legacyAssetPaths.get(a.path) === existingPath));
          if (asset) { ids[index] = asset.id; return asset.path; }
          return existingPath || '';
        });
        hazard.hazardImageAssetIds = ids;
        hazard.imageFrames = paths;
        hazard.hazardImageAssetId = ids[0] || '';
        hazard.imageSrc = paths[0] || '';
      });
    }
    // Keep old paths out of the exported project; the editor uses the in-memory
    // map only to read an un-migrated project folder before the next ZIP export.
    return project;
  }
  function projectChapterNumbers(project = state.project) {
    const values = new Set();
    (project?.stages || []).forEach(stage => values.add(chapterNumber(stage)));
    (project?.assetLibrary || []).forEach(asset => values.add(assetChapterNumber(asset, project)));
    if (!values.size) values.add(4);
    return [...values].sort((a,b)=>a-b);
  }
  function createChapterFolderEntries(chapters, encoder) {
    const folders = [];
    chapters.forEach(chapter => {
      const root = chapterRoot(chapter);
      [root, `${root}/backgrounds`, `${root}/bg`, `${root}/enemies`].forEach(name =>
        folders.push({ name: `${name}/`, bytes: new Uint8Array(0) }));
    });
    return folders;
  }

  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function status(message) { $('canvasStatus').textContent = message; }
  function remember() {
    history.push(clone(state.project));
    if (history.length > 30) history.shift();
  }
  function findObject(ref) {
    if (!ref) return null;
    const stage = currentStage();
    if (ref.type === 'platform') return stage.platforms.find(x => x.id === ref.id) || null;
    if (ref.type === 'enemy') return (stage.enemies||[]).find(x => x.id === ref.id) || null;
    if (ref.type === 'exit') return stage.exits.find(x => x.id === ref.id) || null;
    if (ref.type === 'transition') return stage.transitions.find(x => x.id === ref.id) || null;
    if (ref.type === 'start') return stage.playerStart;
    if (['checkpoint','hazard','trap','teleport','wave'].includes(ref.type)) return (stage[ref.type==='wave'?'waves':ref.type+'s']||[]).find(x=>x.id===ref.id)||null;
    return null;
  }
  function selectObject(type, id) {
    state.selected = type ? { type, id } : null;
    renderObjectList(); renderInspector(); render();
  }
  function nextPlatformLabel(stage) { return nextLabel('P', stage.platforms); }
  function nextExitLabel(stage) { return nextLabel('EX', stage.exits); }
  function nextTransitionLabel(stage) { return nextLabel('TP', stage.transitions); }
  function nextEnemyLabel(stage) { return nextLabel('E', stage.enemies||[]); }
  const ENEMY_TYPES = Object.fromEntries(Array.from({length:11},(_,index)=>{const id=`chapter4_enemy_${index+1}`;return [id,{name:id,root:`images/chapter4/enemies/${id}/${id}_`,projectile:`images/chapter4/enemies/${id}/${id}_projectile.webp`,width:100,height:100}];}));
  function registryRecord(type){return window.PrinceEnemyRegistryV2?.get?.(type)||window.PRINCE_BOSS_CONFIG?.bosses?.find?.(r=>r.id===type)||null;}
  function registryFramePath(type,pose='normal'){
    const bridge=window.PrinceEnemyRegistryV2;
    // Projectile is a separate asset, not a character pose. Use exact lookup so
    // a missing projectile action cannot silently resolve to the normal sprite.
    const frame=pose==='projectile'
      ? (bridge?.frameForExact?.(type,pose) || registryRecord(type)?.animations?.projectile?.frames?.[0] || null)
      : bridge?.frameFor?.(type,pose);
    return frame?.path||frame?.src||null;
  }
  function syncEnemyTypesFromRegistry(){
    const rows=[...(window.PrinceEnemyRegistryV2?.list?.()||[]),...(window.PRINCE_BOSS_CONFIG?.bosses||[])];
    rows.forEach(record=>{
      // This editor is the Chapter 4 Stage Editor; don't offer Chapter 1–3 or 5–6 IDs
      // that its current Production Runtime cannot spawn.
      if(!/^chapter4_(?:enemy|boss)_\d+$/.test(String(record?.id||'')))return;
      const normal=registryFramePath(record.id,'normal');
      const projectile=registryFramePath(record.id,'projectile');
      const old=ENEMY_TYPES[record.id]||{};
      ENEMY_TYPES[record.id]={name:record.name||record.id,root:normal||old.root||`images/enemies_v2/${record.id}/${record.id}_`,projectile:projectile||old.projectile||'',width:Number(record.normalSize)||100,height:Number(record.normalSize)||100,chapter:Number(record.chapter)||4,record};
    });
    const select=$('enemyTypeSelect');
    if(select){
      const keep=select.value||'chapter4_enemy_1';
      select.innerHTML=Object.keys(ENEMY_TYPES).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(id=>{
        const record=registryRecord(id),label=record?.name||ENEMY_TYPES[id].name||id;
        return `<option value="${escapeHtml(id)}">${escapeHtml(id)} · ${escapeHtml(label)}</option>`;
      }).join('');
      select.value=ENEMY_TYPES[keep]?keep:(Object.keys(ENEMY_TYPES)[0]||'chapter4_enemy_1');
    }
  }
  function enemySpritePath(type,pose='normal'){
    const dynamic=registryFramePath(type,pose);if(dynamic)return dynamic;
    const def=ENEMY_TYPES[type]||ENEMY_TYPES.chapter4_enemy_1;return `${def.root}${pose}.webp`;
  }
  syncEnemyTypesFromRegistry();

  function getImage(src) {
    if (!src) return null;
    if (imageCache.has(src)) return imageCache.get(src);
    const image = new Image();
    image.onload = () => { if (src === currentStage().background) setCanvasDimensions(image.naturalWidth, image.naturalHeight); render(); };
    image.onerror = () => {
      const legacyPath = state.legacyAssetPaths.get(src);
      if (legacyPath && image.dataset.legacyPathTried !== '1') {
        image.dataset.legacyPathTried = '1';
        image.src = state.assetData.get(legacyPath) || legacyPath;
        return;
      }
      if (src === currentStage().background) { $('canvasLoading').hidden = true; toast('背景圖片載入失敗，請檢查路徑或重新上傳。'); }
    };
    imageCache.set(src, image);
    if(src.startsWith('asset://')&&window.PrinceEnemyRegistryV2?.loadAsset){
      window.PrinceEnemyRegistryV2.loadAsset(src.slice(8)).then(blob=>{
        const objectUrl=URL.createObjectURL(blob);image.dataset.registryObjectUrl=objectUrl;image.src=objectUrl;
      }).catch(()=>{image.dataset.registryMissing='true';render();});
    }else image.src = state.assetData.get(src) || src;
    return image;
  }
  function rescaleStageGeometry(stage, scaleX, scaleY) {
    if (Math.abs(scaleX - 1) < 0.0001 && Math.abs(scaleY - 1) < 0.0001) return;
    const sx = (value) => Number(value || 0) * scaleX;
    const sy = (value) => Number(value || 0) * scaleY;
    (stage.enemies || []).forEach(enemy=>{enemy.x=sx(enemy.x);enemy.y=sy(enemy.y);enemy.width=sx(enemy.width||100);enemy.height=sy(enemy.height||100);if(enemy.patrol?.speed!=null)enemy.patrol.speed=Number(enemy.patrol.speed)*scaleX;if(enemy.ai?.alertRange!=null)enemy.ai.alertRange=Number(enemy.ai.alertRange)*scaleX;if(enemy.ai?.attackRange!=null)enemy.ai.attackRange=Number(enemy.ai.attackRange)*scaleX;});
    (stage.platforms || []).forEach(platform => {
      platform.x1 = sx(platform.x1); platform.x2 = sx(platform.x2); platform.y = sy(platform.y);
      platform.imageOffsetX = sx(platform.imageOffsetX); platform.imageOffsetY = sy(platform.imageOffsetY);
      if (platform.collisionThickness != null) platform.collisionThickness = sy(platform.collisionThickness);
      if (platform.imageHeight != null) platform.imageHeight = sy(platform.imageHeight);
      if (platform.loop) {
        platform.loop.from.x = sx(platform.loop.from.x); platform.loop.from.y = sy(platform.loop.from.y);
        platform.loop.to.x = sx(platform.loop.to.x); platform.loop.to.y = sy(platform.loop.to.y);
      }
      if (platform.speed != null) platform.speed = Number(platform.speed) * Math.sqrt(Math.abs(scaleX * scaleY));
      // standLine uses normalized image coordinates, so it deliberately stays unchanged.
    });
    (stage.exits || []).forEach(exit => { exit.x = sx(exit.x); exit.y = sy(exit.y); exit.width = sx(exit.width); exit.height = sy(exit.height); });
    (stage.transitions || []).forEach(point => { point.x = sx(point.x); point.y = sy(point.y); });
    for(const key of ['checkpoints','hazards','traps','teleports']) (stage[key]||[]).forEach(object=>{object.x=sx(object.x);object.y=sy(object.y);if(object.width!=null)object.width=sx(object.width);if(object.height!=null)object.height=sy(object.height);if(key==='teleports'){if(object.destinationX!=null)object.destinationX=sx(object.destinationX);if(object.destinationY!=null)object.destinationY=sy(object.destinationY);}});
    (stage.waves||[]).forEach(wave=>{if(wave.trigger?.type==='playerEnter'){wave.trigger.x=sx(wave.trigger.x);wave.trigger.y=sy(wave.trigger.y);wave.trigger.width=sx(wave.trigger.width);wave.trigger.height=sy(wave.trigger.height);} (wave.entries||[]).forEach(entry=>{entry.x=sx(entry.x);entry.y=sy(entry.y);entry.spacing=sx(entry.spacing);});});
    if (stage.playerStart) { stage.playerStart.x = sx(stage.playerStart.x); stage.playerStart.y = sy(stage.playerStart.y); }
  }
  function setCanvasDimensions(width, height) {
    const stage = currentStage();
    const backgroundWidth = Math.max(1, Math.round(width));
    const backgroundHeight = Math.max(1, Math.round(height));
    // The background image defines the authored world dimensions. If an image is
    // replaced by a differently sized version, rescale all placed world geometry
    // proportionally once so platforms and exits remain at the same visual spots.
    let oldBackgroundWidth = Number(stage.backgroundWidth) || Number(stage.width) || backgroundWidth;
    let oldBackgroundHeight = Number(stage.backgroundHeight) || Number(stage.height) || backgroundHeight;
    if (!stage.backgroundWidth && !stage.worldWidthManual && Number(stage.worldWidth || stage.width) >= oldBackgroundWidth * 2.5) {
      oldBackgroundWidth = Number(stage.width) / 3;
    }
    if (oldBackgroundWidth !== backgroundWidth || oldBackgroundHeight !== backgroundHeight) {
      rescaleStageGeometry(stage, backgroundWidth / oldBackgroundWidth, backgroundHeight / oldBackgroundHeight);
    }
    stage.backgroundWidth = backgroundWidth;
    stage.backgroundHeight = backgroundHeight;
    const existingWorld = Number(stage.worldWidth || stage.width) || backgroundWidth;
    const worldWidth = stage.worldWidthManual ? Math.max(backgroundWidth, existingWorld) : backgroundWidth;
    stage.worldWidth = Math.round(worldWidth);
    stage.worldWidthManual = !!stage.worldWidthManual;
    stage.width = stage.worldWidth;
    stage.height = backgroundHeight;
    canvas.width = stage.width;
    canvas.height = stage.height;
    $('worldWidthInput').value = stage.worldWidth;
    $('canvasDimensions').textContent = `世界 ${canvas.width} × ${canvas.height} · 背景 ${backgroundWidth} × ${backgroundHeight}`;
    updateZoom();
    if (typeof renderObjectList === 'function') renderObjectList();
    if (typeof renderInspector === 'function') renderInspector();
  }
  function loadBackground(src) {
    const stage = currentStage();
    stage.background = src || DEFAULT_BG;
    $('backgroundPath').value = stage.background.startsWith('data:') ? '（已上傳並內嵌背景圖片）' : stage.background;
    state.bgLoaded = false; $('canvasLoading').hidden = false;
    const img = getImage(stage.background);
    if (img?.complete && img.naturalWidth) {
      state.bgLoaded = true; setCanvasDimensions(img.naturalWidth, img.naturalHeight); $('canvasLoading').hidden = true; render();
    } else if (img) {
      img.onload = () => { state.bgLoaded = true; setCanvasDimensions(img.naturalWidth, img.naturalHeight); $('canvasLoading').hidden = true; render(); };
      img.onerror = () => { $('canvasLoading').hidden = true; render(); toast('無法讀取背景圖片，請確認檔案路徑。'); };
    }
  }
  function updateZoom() {
    const scroll = $('canvasScroll');
    const usableH = Math.max(180, scroll.clientHeight - 34);
    // Fit the map to the editor's height only. Its width intentionally overflows
    // horizontally so users can edit the complete scrolling world.
    state.fitZoom = Math.min(usableH / canvas.height, 1);
    if (!Number.isFinite(state.fitZoom) || state.fitZoom <= 0) state.fitZoom = .5;
    if (!state.zoom || state.zoom === -1) state.zoom = state.fitZoom;
    const width = canvas.width * state.zoom;
    const height = canvas.height * state.zoom;
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    $('zoomLabel').textContent = `${Math.round(state.zoom * 100)}%`;
  }
  function applyWorldWidth(value, announce=true) {
    const stage = currentStage();
    const bgWidth = Math.max(1, Number(stage.backgroundWidth) || canvas.width);
    const rightmostPlatform = Math.max(0, ...(stage.platforms || []).map(p => Math.max(Number(p.x2)||0, Number(p.loop?.to?.x||0) + Math.max(0,(Number(p.x2)||0)-(Number(p.x1)||0))/2)));
    const rightmostExit = Math.max(0, ...(stage.exits || []).map(e => (Number(e.x) || 0) + (Number(e.width) || 0) / 2));
    const rightmostTransition = Math.max(0, ...(stage.transitions || []).map(t => Number(t.x)||0));
    const rightmostStart = Number(stage.playerStart?.x)||0;
    const minimum = Math.ceil(Math.max(bgWidth, rightmostPlatform, rightmostExit, rightmostTransition, rightmostStart));
    const nextWidth = Math.round(clamp(value, minimum, 50000));
    remember();
    stage.worldWidth = nextWidth;
    stage.worldWidthManual = true;
    stage.width = nextWidth;
    canvas.width = nextWidth;
    $('worldWidthInput').value = nextWidth;
    $('canvasDimensions').textContent = `世界 ${canvas.width} × ${canvas.height} · 背景 ${bgWidth} × ${stage.backgroundHeight || canvas.height}`;
    updateZoom(); render();
    if (announce) { status(`關卡世界寬度已設為 ${nextWidth}px；平台座標未改動。`); toast(`世界寬度：${nextWidth}px。可在右側延伸區繼續放置平台。`); }
  }
  function drawBackgroundAtWorldSize(img) {
    if(!img?.complete||!img.naturalWidth||!img.naturalHeight)return;
    // One background image, one world. Never mirror-tile or stretch it to fill
    // the camera viewport; the camera crops this tall image like the old stages.
    ctx.drawImage(img, 0, 0, Math.min(canvas.width, img.naturalWidth), Math.min(canvas.height, img.naturalHeight));
  }

  function setTool(tool) {
    state.currentTool = tool;
    document.querySelectorAll('.se-tool').forEach(button => button.classList.toggle('active', button.dataset.tool === tool));
    const hints = {
      select: '選取工具：點擊物件選取，拖曳即可移動。',
      standline: '自訂落腳線：先選取平台，再於平台圖片上拖曳紅線；角色會踏在紅線上，而不是圖片頂端。',
      fixed: '固定平台：在地圖上按住並水平拖曳，放開後建立紅色平台及碰撞線。',
      moving: '移動平台：水平拖曳建立綠色平台本體，之後選取平台再畫橙色 Loop 路徑。',
      loop: 'Loop 路徑：先選取一個綠色移動平台，再由平台中心拖到移動終點。',
      start: '角色開始點：在地圖上點一下，設定本關角色出生位置。',
      exit: '關卡出口：在地圖上點一下建立出口觸發區，再於右側設定目的 Stage 和目的轉場點。',
      transition: '轉場點：在目的 Stage 地圖上點一下，設定角色進入該關後的出生位置。',
      enemy: '放置敵人：目前選擇 chapter4_enemy_1。點擊某個平台即可放置，系統會自動鎖定最近的平台。',
      enemyRoute: '敵人行走路線：先選取一隻敵人，再逐點點擊同一平台上的路線位置；在右側可完成或清除路線。',
      checkpoint: 'Checkpoint：放置重生點；玩家觸碰後會記錄位置，死亡／掉落重置返回此處。',
      hazard: 'Hazard：放置持續傷害區域，可設定尖刺、火焰或電流及觸發冷卻。',
      trap: 'Trap：放置觸碰式陷阱，可設定傷害及啟動時間。',
      teleport: 'Teleport：放置傳送點，可傳送到本關座標或另一個 Stage。'
    };
    $('toolHint').textContent = hints[tool] || '';
    canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    if (tool === 'loop' && (!state.selected || state.selected.type !== 'platform' || findObject(state.selected)?.kind !== 'moving')) {
      status('先在右側選取一個綠色移動平台，再畫 Loop 路徑。');
    }
    if(tool==='enemyRoute' && (!state.selected||state.selected.type!=='enemy')) status('先選取一隻敵人，再逐點建立行走路線。');
  }
  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) * canvas.width / rect.width, 0, canvas.width), y: clamp((event.clientY - rect.top) * canvas.height / rect.height, 0, canvas.height) };
  }
  function distToSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  function lineYAtX(segment, x) {
    const [a,b] = segment, dx = b.x - a.x;
    if (Math.abs(dx) < 0.001) return (a.y + b.y) / 2;
    const t = clamp((x - a.x) / dx, 0, 1);
    return a.y + (b.y - a.y) * t;
  }
  function hitTest(p) {
    const stage = currentStage();
    for(let i=(stage.enemies||[]).length-1;i>=0;i--){const e=stage.enemies[i],w=Number(e.width)||100,h=Number(e.height)||100;if(Math.abs(p.x-e.x)<=w*.55&&Math.abs(p.y-e.y)<=h+10)return {type:'enemy',id:e.id};}
    for (const type of ['teleport','trap','hazard','checkpoint']) { const rows=stage[type==='checkpoint'?'checkpoints':type==='hazard'?'hazards':type==='trap'?'traps':'teleports']||[]; for(let i=rows.length-1;i>=0;i--){const o=rows[i];if(Math.abs(p.x-o.x)<=Number(o.width||70)/2+10&&Math.abs(p.y-o.y)<=Number(o.height||70)/2+10)return {type,id:o.id};} }
    for (let i = stage.exits.length - 1; i >= 0; i--) {
      const o = stage.exits[i]; if (Math.abs(p.x - o.x) <= o.width / 2 + 12 && Math.abs(p.y - o.y) <= o.height / 2 + 12) return {type:'exit', id:o.id};
    }
    for (let i = stage.transitions.length - 1; i >= 0; i--) {
      const o = stage.transitions[i]; if (Math.hypot(p.x - o.x, p.y - o.y) < 30) return {type:'transition', id:o.id};
    }
    if (stage.playerStart && Math.hypot(p.x-stage.playerStart.x,p.y-stage.playerStart.y)<32) return {type:'start',id:'playerStart'};
    for (let i = stage.platforms.length - 1; i >= 0; i--) {
      const o = stage.platforms[i];
      if (o.loop && distToSegment(p, o.loop.from, o.loop.to) < 15) return {type:'platform', id:o.id};
      if (o.standLine) { const [a,b]=getStandLinePoints(o); if (distToSegment(p,a,b)<20) return {type:'platform',id:o.id}; }
      if (distToSegment(p, {x:o.x1,y:o.y}, {x:o.x2,y:o.y}) < 20) return {type:'platform', id:o.id};
      const m=getPlatformVisualMetrics(o),local=worldToPlatformImagePoint(p,m);
      if(local.x>=0&&local.x<=1&&local.y>=0&&local.y<=1)return {type:'platform',id:o.id};
    }
    return null;
  }
  function makePlatform(kind, a, b) {
    const stage = currentStage();
    let x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
    if (x2 - x1 < 42) x2 = x1 + 42;
    const y = Math.round((a.y + b.y) / 2);
    const platform = {
      id: uid('platform', stage.platforms), label: nextPlatformLabel(stage), kind,
      x1: Math.round(x1), x2: Math.round(x2), y,
      imageSrc: '', imageAssetId: '', imageHeight: 52, imageScale: 100, imageOffsetX: 0, imageOffsetY: 0, imageRotation: 0, imageOpacity: 100, collisionThickness: 12,
      speed: 80, pauseSeconds: .25, loop: null
    };
    stage.platforms.push(platform);
    selectObject('platform', platform.id);
    status(`${platform.label} 已建立。可在右側上傳平台圖片或調整碰撞範圍。`);
  }
  function makeExit(p) {
    const stage = currentStage();
    const o = { id: uid('exit', stage.exits), label: nextExitLabel(stage), x: Math.round(p.x), y: Math.round(p.y), width: 72, height: 112, targetStageId: '', targetTransitionId: '', effect: 'fade' };
    stage.exits.push(o); selectObject('exit', o.id); status(`${o.label} 關卡出口已建立。請分別設定目的 Stage 和目的轉場點。`);
  }
  function makeTransition(p) {
    const stage = currentStage();
    const o = { id: uid('transition', stage.transitions), label: nextTransitionLabel(stage), x: Math.round(p.x), y: Math.round(p.y), facing: 'right' };
    stage.transitions.push(o); selectObject('transition', o.id); status(`${o.label} 轉場點已建立。角色抵達此關時會在這個位置出生。`);
  }
  function makeSceneObject(type,p){
    const stage=currentStage();const defs={
      checkpoint:{rows:'checkpoints',prefix:'checkpoint',label:'CP',width:58,height:72,heal:20},
      hazard:{rows:'hazards',prefix:'hazard',label:'HZ',width:120,height:42,damage:10},
      trap:{rows:'traps',prefix:'trap',label:'TR',width:90,height:48,damage:15},
      teleport:{rows:'teleports',prefix:'teleport',label:'TP',width:74,height:88,destinationX:Math.round(p.x+240),destinationY:Math.round(p.y)}
    };const d=defs[type];if(!d)return;stage[d.rows]||=[];
    const o={id:uid(d.prefix,stage[d.rows]),label:nextLabel(d.label,stage[d.rows]),x:Math.round(p.x),y:Math.round(p.y),width:d.width,height:d.height,enabled:true};
    if(type==='checkpoint')Object.assign(o,{healPercent:d.heal,once:false});
    if(type==='hazard')Object.assign(o,{damage:d.damage,cooldownMs:850,kind:'spikes',hazardImageAssetId:'',hazardImageAssetIds:['','','',''],imageSrc:'',imageFrames:['','','',''],animationFrameMs:120,imageScale:100,imageOpacity:100,imageOffsetX:0,imageOffsetY:0,imageRotation:0});
    if(type==='trap')Object.assign(o,{damage:d.damage,cooldownMs:900,kind:'crusher',trigger:'touch',activationDelayMs:350,activeDurationMs:900});
    if(type==='teleport')Object.assign(o,{destinationX:d.destinationX,destinationY:d.destinationY,destinationStageId:'',destinationTransitionId:'',cooldownMs:1000,facing:'right'});
    stage[d.rows].push(o);selectObject(type,o.id);status(`${o.label} 已建立；可在右側設定觸發及效果。`);
  }
  function addWave(){
    const stage=currentStage();stage.waves||=[];remember();const id=uid('wave',stage.waves);const firstEnemy=Object.keys(ENEMY_TYPES).find(k=>/^chapter4_enemy_/.test(k))||Object.keys(ENEMY_TYPES)[0]||'chapter4_enemy_1';
    const wave={id,label:nextLabel('W',stage.waves),enabled:true,trigger:{type:stage.waves.length?'previousWaveCleared':'stageStart',delayMs:0,x:180,y:180,width:260,height:220},spawnIntervalMs:650,completion:'all-defeated',entries:[{enemyId:firstEnemy,count:2,platformId:stage.platforms[0]?.id||'',x:300,y:stage.platforms[0]?.y||900,spacing:55}]};
    stage.waves.push(wave);selectObject('wave',id);renderObjectList();renderInspector();toast(`${wave.label} 已建立，可在右側編輯多組敵人出場。`);
  }
  function nearestPlatformAt(p){
    const stage=currentStage();let best=null;
    for(const platform of stage.platforms||[]){const dx=getPlatformMotion(platform),x1=platform.x1+dx.dx,x2=platform.x2+dx.dx,y=platform.y+dx.dy;const segment=getStandLinePoints(platform,x1,x2,y);const minX=Math.min(segment[0].x,segment[1].x),maxX=Math.max(segment[0].x,segment[1].x);if(p.x<minX-8||p.x>maxX+8)continue;const surfaceY=lineYAtX(segment,clamp(p.x,minX,maxX));const distance=Math.abs(p.y-surfaceY);if(!best||distance<best.distance)best={platform,surfaceY,distance};}
    return best&&best.distance<180?best:null;
  }
  function makeEnemy(p){
    const stage=currentStage();stage.enemies||=[];const chosen=$('enemyTypeSelect')?.value||'chapter4_enemy_1';const support=nearestPlatformAt(p);
    const platform=support?.platform||stage.platforms.find(x=>x.label==='P2')||stage.platforms[1]||null;
    const x=Math.round(p.x),surfaceY=support?.surfaceY??(platform?lineYAtX(getStandLinePoints(platform),clamp(p.x,platform.x1,platform.x2)):p.y);
    const meta=registryRecord(chosen);const normalSize=Number(meta?.normalSize)||100;
    const enemy={id:uid('enemy',stage.enemies),label:nextEnemyLabel(stage),type:chosen,spriteRoot:ENEMY_TYPES[chosen]?.root||ENEMY_TYPES.chapter4_enemy_1.root,projectilePath:ENEMY_TYPES[chosen]?.projectile||'',x,y:Math.round(surfaceY),width:normalSize,height:normalSize,platformId:platform?.id||'',facing:'left',patrol:{points:[],speed:Number(meta?.movementSpeed)||70,pauseSeconds:.5,mode:'pingpong'},ai:{aiType:meta?.aiType||'chase',attackMode:meta?.attackMode||null,alertRange:Number(meta?.detectionRange)||430,attackRange:Number(meta?.attackRange)||230,attackCooldownMs:1450,damage:Number(meta?.attackDamage)||1,attackPoseMs:420,movementSpeed:Number(meta?.movementSpeed)||150,keepDistance:Number(meta?.attackRange)||190},registryRuntimeStatus:meta&&!meta.legacy?'chapter4-runtime':'legacy'};
    stage.enemies.push(enemy);selectObject('enemy',enemy.id);status(`${enemy.label} 已放置${platform?`在 ${platform.label} 平台`:'；尚未指定平台'}。可使用「敵人行走路線」加入巡邏節點。`);
  }
  function addEnemyPatrolPoint(p){
    const enemy=findObject(state.selected);if(!enemy||state.selected?.type!=='enemy'){toast('請先選取一隻敵人。');return;}
    const platform=currentStage().platforms.find(x=>x.id===enemy.platformId);if(!platform){toast('請先在右側為敵人指定所屬平台。');return;}
    const motion=getPlatformMotion(platform),x1=platform.x1+motion.dx,x2=platform.x2+motion.dx,segment=getStandLinePoints(platform,x1,x2,platform.y+motion.dy);const minX=Math.min(segment[0].x,segment[1].x),maxX=Math.max(segment[0].x,segment[1].x);const surfaceY=lineYAtX(segment,clamp(p.x,minX,maxX));if(p.x<minX||p.x>maxX||Math.abs(p.y-surfaceY)>150){toast('路線點必須畫在敵人所屬平台上。');return;}const u=clamp((p.x-x1)/Math.max(1,x2-x1),0,1);
    remember();enemy.patrol ||= {points:[],speed:70,pauseSeconds:.5,mode:'pingpong'};enemy.patrol.points ||= [];
    if(enemy.patrol.points.length&&Math.abs(enemy.patrol.points[enemy.patrol.points.length-1].u-u)<.015){toast('這個路線點與上一點太接近。');return;}
    enemy.patrol.points.push({u:Number(u.toFixed(4))});renderObjectList();renderInspector();render();status(`${enemy.label} 已新增巡邏點 ${enemy.patrol.points.length}。`);
  }
  function pointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const p = canvasPoint(event); $('cursorCoords').textContent = `X: ${Math.round(p.x)} · Y: ${Math.round(p.y)}`;
    const stage = currentStage();
    if (state.preview) return;
    if (state.currentTool === 'select') {
      const hit = hitTest(p);
      if (!hit) { selectObject(null); return; }
      selectObject(hit.type, hit.id); remember();
      const object = findObject(hit);
      state.dragging = { ref: hit, start: p, original: clone(object) };
      canvas.setPointerCapture?.(event.pointerId); return;
    }
    if (state.currentTool === 'start') {
      remember(); stage.playerStart = point(p.x, p.y); selectObject('start', 'playerStart'); status('角色開始點已更新。'); return;
    }
    if (state.currentTool === 'exit') { remember(); makeExit(p); return; }
    if (state.currentTool === 'transition') { remember(); makeTransition(p); return; }
    if (state.currentTool === 'enemy') { remember(); makeEnemy(p); return; }
    if(['checkpoint','hazard','trap','teleport'].includes(state.currentTool)){remember();makeSceneObject(state.currentTool,p);return;}
    if (state.currentTool === 'enemyRoute') { addEnemyPatrolPoint(p); return; }
    if (state.currentTool === 'standline') {
      const selected = findObject(state.selected);
      if (!selected || state.selected.type !== 'platform') { toast('請先選取一個平台，再設定落腳線。'); return; }
      state.drawing = { type: 'standline', start: p, end: p, platformId: selected.id };
      canvas.setPointerCapture?.(event.pointerId); render(); return;
    }
    if (state.currentTool === 'loop') {
      const selected = findObject(state.selected);
      if (!selected || state.selected.type !== 'platform' || selected.kind !== 'moving') { toast('請先選取一個綠色移動平台。'); return; }
      state.drawing = { type: 'loop', start: {x:(selected.x1+selected.x2)/2,y:selected.y}, end:p, platformId:selected.id };
      canvas.setPointerCapture?.(event.pointerId); render(); return;
    }
    if (state.currentTool === 'fixed' || state.currentTool === 'moving') {
      state.drawing = { type: state.currentTool, start: p, end: p };
      canvas.setPointerCapture?.(event.pointerId); render();
    }
  }
  function pointerMove(event) {
    const p = canvasPoint(event); $('cursorCoords').textContent = `X: ${Math.round(p.x)} · Y: ${Math.round(p.y)}`;
    if (state.drawing) { state.drawing.end = p; render(); return; }
    if (state.dragging) {
      const dx = p.x - state.dragging.start.x, dy = p.y - state.dragging.start.y;
      const o = findObject(state.dragging.ref), original = state.dragging.original;
      if (!o) return;
      if (state.dragging.ref.type === 'platform') {
        o.x1 = Math.round(original.x1 + dx); o.x2 = Math.round(original.x2 + dx); o.y = Math.round(original.y + dy);
        if (original.loop) o.loop = { from: point(original.loop.from.x + dx, original.loop.from.y + dy), to: point(original.loop.to.x + dx, original.loop.to.y + dy) };
      } else if(state.dragging.ref.type==='enemy') {
        const platform=currentStage().platforms.find(x=>x.id===original.platformId);o.x=Math.round(original.x+dx);
        if(platform){const pm=getPlatformMotion(platform),x1=platform.x1+pm.dx,x2=platform.x2+pm.dx,segment=getStandLinePoints(platform,x1,x2,platform.y+pm.dy);o.x=clamp(o.x,Math.min(segment[0].x,segment[1].x),Math.max(segment[0].x,segment[1].x));o.y=Math.round(lineYAtX(segment,o.x));}
        else o.y=Math.round(original.y+dy);
      } else { o.x = Math.round(original.x + dx); o.y = Math.round(original.y + dy); }
      render();
    }
  }
  function pointerUp(event) {
    const p = canvasPoint(event);
    if (state.dragging) { state.dragging = null; renderObjectList(); renderInspector(); render(); return; }
    if (!state.drawing) return;
    const drawing = state.drawing; state.drawing = null; remember();
    if (drawing.type === 'fixed' || drawing.type === 'moving') {
      makePlatform(drawing.type, drawing.start, p);
    } else if (drawing.type === 'standline') {
      const platform = currentStage().platforms.find(x => x.id === drawing.platformId);
      if (platform) {
        const metrics = getPlatformVisualMetrics(platform);
        const a = worldToPlatformImagePoint(drawing.start, metrics);
        const b = worldToPlatformImagePoint(p, metrics);
        platform.standLine = { x1: clamp(a.x, 0, 1), y1: clamp(a.y, 0, 1), x2: clamp(b.x, 0, 1), y2: clamp(b.y, 0, 1) };
        selectObject('platform', platform.id);
        status(`${platform.label} 自訂落腳線已設定；角色將以紅線作為真正站立面。`);
      }
    } else if (drawing.type === 'loop') {
      const platform = currentStage().platforms.find(x => x.id === drawing.platformId);
      if (platform) {
        platform.loop = { from: point(drawing.start.x, drawing.start.y), to: point(p.x, p.y) };
        selectObject('platform', platform.id);
        status(`${platform.label} Loop 路徑已設定。可按「播放移動」預覽循環移動。`);
      }
    }
    render();
  }

  function drawStonePlatform(o, x1, x2, y) {
    const width = Math.max(12, x2 - x1), h = Math.max(20, o.imageHeight || 52);
    const top = y;
    const bottom = y + h;
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, '#8eacc0'); grad.addColorStop(.24, '#536c83'); grad.addColorStop(1, '#25384d');
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x1, top + 8); ctx.lineTo(x1 + 10, top); ctx.lineTo(x2 - 7, top); ctx.lineTo(x2, top + 9); ctx.lineTo(x2 - 8, bottom - 5); ctx.lineTo(x2 - 19, bottom); ctx.lineTo(x1 + 16, bottom - 2); ctx.lineTo(x1, top + 14); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = '#b8d0dd'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 + 8, top + 7); ctx.lineTo(x2 - 8, top + 7); ctx.strokeStyle = 'rgba(225,244,249,.72)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 + width * .24, top + 15); ctx.lineTo(x1 + width * .20, bottom - 6); ctx.moveTo(x1 + width * .71, top + 14); ctx.lineTo(x1 + width * .76, bottom - 7); ctx.strokeStyle = 'rgba(13,27,43,.65)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  function getPlatformMotion(o) {
    if (!state.motionPlaying || !o.loop) return {dx:0,dy:0};
    const a=o.loop.from,b=o.loop.to,dist=Math.hypot(b.x-a.x,b.y-a.y);
    if (dist<1) return {dx:0,dy:0};
    const speed=Math.max(1,Number(o.speed)||80), pause=Math.max(0,Number(o.pauseSeconds)||0);
    const oneWay=dist/speed, cycle=2*oneWay+2*pause;
    const t=(state.motionTime/1000)%(cycle||1);
    let ratio;
    if(t<oneWay) ratio=t/oneWay;
    else if(t<oneWay+pause) ratio=1;
    else if(t<2*oneWay+pause) ratio=1-(t-oneWay-pause)/oneWay;
    else ratio=0;
    return {dx:(b.x-a.x)*ratio,dy:(b.y-a.y)*ratio};
  }
  // Platform art and its walkable surface are separate. The custom surface is saved
  // as normalized coordinates inside the rendered image, so it survives image swaps,
  // scaling, offsets, rotation and moving-platform motion.
  function getPlatformVisualMetrics(o, x1=o.x1, x2=o.x2, y=o.y) {
    const image=o.imageSrc?getImage(o.imageSrc):null;
    const span=Math.max(20,x2-x1);
    const width=image?.complete&&image.naturalWidth ? span*clamp(o.imageScale??100,10,300)/100 : span;
    const height=image?.complete&&image.naturalWidth&&image.naturalHeight ? width*image.naturalHeight/image.naturalWidth : Math.max(20,Number(o.imageHeight)||52);
    return {cx:(x1+x2)/2+Number(o.imageOffsetX||0),cy:y+Number(o.imageOffsetY||0)+height/2,width,height,rotation:(Number(o.imageRotation)||0)*Math.PI/180};
  }
  function worldToPlatformImagePoint(p,m) {
    const dx=p.x-m.cx,dy=p.y-m.cy,c=Math.cos(m.rotation),sn=Math.sin(m.rotation);
    const lx=c*dx+sn*dy,ly=-sn*dx+c*dy;
    return {x:lx/m.width+.5,y:ly/m.height+.5};
  }
  function platformImageToWorldPoint(p,m) {
    const lx=(p.x-.5)*m.width,ly=(p.y-.5)*m.height,c=Math.cos(m.rotation),sn=Math.sin(m.rotation);
    return {x:m.cx+c*lx-sn*ly,y:m.cy+sn*lx+c*ly};
  }
  function getStandLinePoints(o,x1=o.x1,x2=o.x2,y=o.y) {
    if(!o.standLine) return [{x:x1,y},{x:x2,y}];
    const m=getPlatformVisualMetrics(o,x1,x2,y);
    return [platformImageToWorldPoint({x:o.standLine.x1,y:o.standLine.y1},m),platformImageToWorldPoint({x:o.standLine.x2,y:o.standLine.y2},m)];
  }
  function drawStandLine(o,x1,x2,y,preview=false) {
    const [a,b]=getStandLinePoints(o,x1,x2,y);
    ctx.save();ctx.strokeStyle=o.standLine?'#ff302e':(o.kind==='fixed'?'#e34f4f':'#2dcc82');ctx.lineWidth=o.standLine?6:4;ctx.lineCap='round';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=o.standLine?10:5;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.shadowBlur=0;
    if(o.standLine&&!preview){ctx.fillStyle='#fff';for(const q of [a,b]){ctx.beginPath();ctx.arc(q.x,q.y,4,0,Math.PI*2);ctx.fill();}}ctx.restore();
  }
  function drawPlatform(o, guide=true) {
    const movement=getPlatformMotion(o), dx=movement.dx,dy=movement.dy;
    const x1=o.x1+dx,x2=o.x2+dx,y=o.y+dy;
    const image=o.imageSrc?getImage(o.imageSrc):null;
    if (image?.complete && image.naturalWidth && image.naturalHeight) {
      // Platform artwork is an external asset. Fit by width and preserve its original aspect ratio.
      const metrics=getPlatformVisualMetrics(o,x1,x2,y),drawW=metrics.width,drawH=metrics.height;
      ctx.save();ctx.globalAlpha=clamp(o.imageOpacity??100,0,100)/100;
      ctx.translate(metrics.cx,metrics.cy);ctx.rotate(metrics.rotation);
      ctx.drawImage(image,-drawW/2,-drawH/2,drawW,drawH);ctx.restore();
    } else { const metrics=getPlatformVisualMetrics(o,x1,x2,y); ctx.save();ctx.translate(metrics.cx,metrics.cy);ctx.rotate(metrics.rotation);drawStonePlatform(o,-metrics.width/2,metrics.width/2,-metrics.height/2);ctx.restore(); }
    if (guide && state.showCollision) {
      ctx.save();
      if(!o.standLine){
        const collisionColor=o.kind==='fixed'?'rgba(227,79,79,.22)':'rgba(45,204,130,.22)';ctx.fillStyle=collisionColor;ctx.fillRect(x1,y,Math.max(1,x2-x1),Math.max(2,o.collisionThickness||12));
      }
      ctx.strokeStyle=o.kind==='fixed'?'#e34f4f':'#2dcc82';ctx.lineWidth=o.standLine?2:5;ctx.lineCap='round';ctx.globalAlpha=o.standLine ? 0.34 : 1;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=o.standLine?1:8;
      ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();ctx.globalAlpha=1;ctx.shadowBlur=0;
      ctx.strokeStyle='rgba(255,255,255,.58)';ctx.lineWidth=1.2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();ctx.restore();
      if(o.standLine) drawStandLine(o,x1,x2,y,false);
    }
    if (guide && o.loop) {
      const a=o.loop.from,b=o.loop.to;
      ctx.save(); ctx.strokeStyle='#f0a13b'; ctx.lineWidth=4; ctx.setLineDash([12,8]); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.setLineDash([]);
      drawArrowHead(a,b,'#f0a13b'); drawArrowHead(b,a,'#f0a13b');
      ctx.fillStyle='#f0a13b'; ctx.beginPath(); ctx.arc(a.x,a.y,7,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(b.x,b.y,7,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    if (guide && state.showLabels) drawLabel(o.label||o.id,(x1+x2)/2,y-10,o.kind==='fixed'?'#e85c5c':'#35c887');
    if (state.selected?.type==='platform' && state.selected.id===o.id && guide) {
      ctx.save(); ctx.strokeStyle='#f5d895'; ctx.lineWidth=2; ctx.setLineDash([8,5]); ctx.strokeRect(x1-7,y-5,(x2-x1)+14,(o.imageHeight||52)+10); ctx.restore();
    }
  }
  function drawArrowHead(from,to,color) {
    const angle=Math.atan2(to.y-from.y,to.x-from.x), len=13;
    ctx.save();ctx.translate(to.x,to.y);ctx.rotate(angle);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-len,-len*.55);ctx.lineTo(-len,len*.55);ctx.closePath();ctx.fill();ctx.restore();
  }
  function drawLabel(text,x,y,color='#fff') {
    ctx.save();ctx.font='bold 18px Inter, sans-serif';const w=ctx.measureText(text).width+16;ctx.fillStyle='rgba(8,17,29,.82)';ctx.fillRect(x-w/2,y-21,w,27);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(x-w/2,y-21,w,27);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y-8);ctx.restore();
  }
  function enemyPatrolWorldPoints(enemy,platform){
    if(!platform)return[];const motion=getPlatformMotion(platform),x1=platform.x1+motion.dx,x2=platform.x2+motion.dx,segment=getStandLinePoints(platform,x1,x2,platform.y+motion.dy);
    return (enemy.patrol?.points||[]).map(point=>{const x=x1+clamp(point.u,0,1)*(x2-x1);return {x,y:lineYAtX(segment,x)};});
  }
  function drawEnemyPlacement(enemy,guide=true){
    const platform=currentStage().platforms.find(p=>p.id===enemy.platformId),worldPoints=enemyPatrolWorldPoints(enemy,platform);const pose=enemySpritePath(enemy.type,'normal'),image=getImage(pose);const w=Number(enemy.width)||100,h=Number(enemy.height)||100;
    let footY=Number(enemy.y)||0;if(platform){const pts=getStandLinePoints(platform,platform.x1+getPlatformMotion(platform).dx,platform.x2+getPlatformMotion(platform).dx,platform.y+getPlatformMotion(platform).dy);footY=lineYAtX(pts,clamp(enemy.x,Math.min(pts[0].x,pts[1].x),Math.max(pts[0].x,pts[1].x)));}
    if(image?.complete&&image.naturalWidth){const sc=Math.min(w/image.naturalWidth,h/image.naturalHeight),dw=image.naturalWidth*sc,dh=image.naturalHeight*sc;ctx.save();ctx.translate(enemy.x,footY);if(enemy.facing==='left')ctx.scale(-1,1);ctx.drawImage(image,-dw/2,-dh,dw,dh);ctx.restore();}
    else{ctx.save();ctx.fillStyle='#9e6d62';ctx.beginPath();ctx.ellipse(enemy.x,footY-h/2,w*.35,h*.48,0,0,Math.PI*2);ctx.fill();ctx.restore();}
    if(guide&&worldPoints.length){ctx.save();ctx.strokeStyle='#e5c36f';ctx.lineWidth=4;ctx.setLineDash([9,7]);ctx.beginPath();worldPoints.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));ctx.stroke();ctx.setLineDash([]);worldPoints.forEach((pt,i)=>{ctx.fillStyle='#f5d895';ctx.beginPath();ctx.arc(pt.x,pt.y,6,0,Math.PI*2);ctx.fill();drawLabel(String(i+1),pt.x,pt.y-15,'#d9b767');});ctx.restore();}
    if(guide&&state.showLabels)drawLabel(enemy.label||enemy.id,enemy.x,footY-h-5,'#e8a18c');
    if(guide&&state.selected?.type==='enemy'&&state.selected.id===enemy.id){ctx.save();ctx.strokeStyle='#f5d895';ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.strokeRect(enemy.x-w*.55,footY-h-4,w*1.1,h+8);ctx.restore();}
  }
  function drawStart(start) {
    if (!start) return;
    ctx.save();ctx.translate(start.x,start.y);ctx.strokeStyle='#4d91e3';ctx.fillStyle='rgba(77,145,227,.2)';ctx.lineWidth=4;
    ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(0,-47);ctx.lineTo(0,0);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-47);ctx.lineTo(29,-38);ctx.lineTo(0,-29);ctx.closePath();ctx.fillStyle='#4d91e3';ctx.fill();ctx.restore();
    if(state.showLabels&&!state.preview)drawLabel('START',start.x,start.y-58,'#4d91e3');
    if(state.selected?.type==='start'&&!state.preview){ctx.save();ctx.strokeStyle='#f5d895';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(start.x,start.y,28,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
  function drawExit(o) {
    ctx.save();ctx.translate(o.x,o.y);ctx.fillStyle=state.preview?'rgba(160,120,224,.12)':'rgba(160,120,224,.2)';ctx.strokeStyle='#a078e0';ctx.lineWidth=4;ctx.setLineDash(state.preview?[]:[8,5]);ctx.fillRect(-o.width/2,-o.height/2,o.width,o.height);ctx.strokeRect(-o.width/2,-o.height/2,o.width,o.height);ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(12,0);ctx.moveTo(4,-9);ctx.lineTo(13,0);ctx.lineTo(4,9);ctx.strokeStyle='#e8d9ff';ctx.lineWidth=4;ctx.stroke();ctx.restore();
    if(!state.preview&&state.showLabels)drawLabel(o.label||o.id,o.x,o.y-o.height/2-8,'#a078e0');
    if(!state.preview&&state.selected?.type==='exit'&&state.selected.id===o.id){ctx.save();ctx.strokeStyle='#f5d895';ctx.lineWidth=2;ctx.strokeRect(o.x-o.width/2-5,o.y-o.height/2-5,o.width+10,o.height+10);ctx.restore();}
  }
  function drawTransition(o) {
    ctx.save();ctx.translate(o.x,o.y);ctx.strokeStyle='#39b6bd';ctx.fillStyle='rgba(57,182,189,.18)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-32);ctx.lineTo(0,32);ctx.stroke();ctx.restore();
    if(!state.preview&&state.showLabels)drawLabel(o.label||o.id,o.x,o.y-42,'#39b6bd');
    if(!state.preview&&state.selected?.type==='transition'&&state.selected.id===o.id){ctx.save();ctx.strokeStyle='#f5d895';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(o.x,o.y,29,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
  function drawSceneObject(type,o){
    const styles={checkpoint:{color:'#38c987',fill:'rgba(56,201,135,.20)',glyph:'CP'},hazard:{color:'#ef5350',fill:'rgba(239,83,80,.22)',glyph:'!'},trap:{color:'#e99b36',fill:'rgba(233,155,54,.22)',glyph:'TR'},teleport:{color:'#3dc7d3',fill:'rgba(61,199,211,.20)',glyph:'TP'}};const st=styles[type];if(!st)return;
    if(type==='hazard'){
      const frames=(Array.isArray(o.imageFrames)&&o.imageFrames.length?o.imageFrames:(o.imageSrc?[o.imageSrc]:[])).filter(Boolean);
      const frameMs=clamp(Number(o.animationFrameMs??120),50,1000);
      const framePath=frames.length>1?frames[Math.floor(performance.now()/frameMs)%frames.length]:frames[0];
      const image=framePath?getImage(framePath):null;
      if(image?.complete&&image.naturalWidth&&image.naturalHeight){
        const drawW=Math.max(1,Number(o.width)||120)*clamp(Number(o.imageScale??100),10,300)/100;
        const drawH=drawW*image.naturalHeight/image.naturalWidth;
        ctx.save();ctx.globalAlpha=clamp(Number(o.imageOpacity??100),0,100)/100;ctx.translate(o.x+Number(o.imageOffsetX||0),o.y+Number(o.imageOffsetY||0));ctx.rotate((Number(o.imageRotation)||0)*Math.PI/180);ctx.drawImage(image,-drawW/2,-drawH/2,drawW,drawH);ctx.restore();
      }
      // The rectangle is an editing-only collision guide. Preview/gameplay shows only the assigned art (or nothing).
      if(state.preview)return;
      ctx.save();ctx.translate(o.x,o.y);ctx.fillStyle='rgba(239,83,80,.06)';ctx.strokeStyle=st.color;ctx.lineWidth=3;ctx.setLineDash([8,6]);ctx.fillRect(-o.width/2,-o.height/2,o.width,o.height);ctx.strokeRect(-o.width/2,-o.height/2,o.width,o.height);ctx.setLineDash([]);
      if(!image?.complete||!image.naturalWidth){ctx.fillStyle=st.color;for(let x=-o.width/2+8;x<o.width/2-4;x+=18){ctx.beginPath();ctx.moveTo(x,o.height/2);ctx.lineTo(x+9,-o.height/2+2);ctx.lineTo(x+18,o.height/2);ctx.closePath();ctx.fill();}}
      ctx.restore();if(state.showLabels)drawLabel(`${o.label||type}${o.enabled===false?'（停用）':''}`,o.x,o.y-o.height/2-7,st.color);
      if(state.selected?.type===type&&state.selected.id===o.id){ctx.save();ctx.strokeStyle='#f5d895';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.strokeRect(o.x-o.width/2-6,o.y-o.height/2-6,o.width+12,o.height+12);ctx.restore();}
      return;
    }
    ctx.save();ctx.translate(o.x,o.y);ctx.fillStyle=st.fill;ctx.strokeStyle=st.color;ctx.lineWidth=4;ctx.setLineDash(state.preview?[]:[8,5]);ctx.fillRect(-o.width/2,-o.height/2,o.width,o.height);ctx.strokeRect(-o.width/2,-o.height/2,o.width,o.height);ctx.setLineDash([]);
    if(type==='teleport'){ctx.beginPath();ctx.arc(0,0,Math.min(o.width,o.height)*.28,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,Math.min(o.width,o.height)*.13,0,Math.PI*2);ctx.stroke();}
    else{ctx.font='bold 20px Inter, sans-serif';ctx.fillStyle=st.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(type==='checkpoint'?'⚑':st.glyph,0,0);}
    ctx.restore();if(!state.preview&&state.showLabels)drawLabel(`${o.label||type}${o.enabled===false?'（停用）':''}`,o.x,o.y-o.height/2-7,st.color);
    if(!state.preview&&state.selected?.type===type&&state.selected.id===o.id){ctx.save();ctx.strokeStyle='#f5d895';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.strokeRect(o.x-o.width/2-6,o.y-o.height/2-6,o.width+12,o.height+12);ctx.restore();}
  }
  function drawWaveMarkers(){const waves=currentStage().waves||[];waves.forEach((w,i)=>{const entries=w.entries||[];const x=Number(w.trigger?.x??(120+i*72)),y=Number(w.trigger?.y??90);ctx.save();ctx.fillStyle='rgba(26,35,55,.9)';ctx.strokeStyle='#d7a94a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,19,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 14px Inter';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),x,y);ctx.restore();});}
  function drawDraft() {
    if(!state.drawing)return;const d=state.drawing;ctx.save();ctx.lineWidth=5;ctx.setLineDash([9,6]);ctx.strokeStyle=d.type==='fixed'?'#e34f4f':d.type==='moving'?'#2dcc82':d.type==='standline'?'#ff302e':'#f0a13b';ctx.beginPath();ctx.moveTo(d.start.x,d.start.y);ctx.lineTo(d.end.x,d.end.y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(d.start.x,d.start.y,6,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(d.end.x,d.end.y,6,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function render() {
    if(!ctx)return;const stage=currentStage();
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(state.showBackground && stage.background){const img=getImage(stage.background);if(img?.complete&&img.naturalWidth)drawBackgroundAtWorldSize(img);else{ctx.fillStyle='#14263b';ctx.fillRect(0,0,canvas.width,canvas.height);}}
    else{ctx.fillStyle='#18283c';ctx.fillRect(0,0,canvas.width,canvas.height);}
    if(!state.preview){
      ctx.save();ctx.fillStyle='rgba(255,255,255,.035)';ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;
      for(let x=0;x<canvas.width;x+=100){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
      for(let y=0;y<canvas.height;y+=100){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}ctx.restore();
    }
    stage.platforms.forEach(o=>drawPlatform(o,!state.preview));
    (stage.enemies||[]).forEach(e=>drawEnemyPlacement(e,!state.preview));
    if(!state.preview){drawStart(stage.playerStart);stage.exits.forEach(drawExit);stage.transitions.forEach(drawTransition);['checkpoint','hazard','trap','teleport'].forEach(type=>(stage[type==='checkpoint'?'checkpoints':type==='hazard'?'hazards':type==='trap'?'traps':'teleports']||[]).forEach(o=>drawSceneObject(type,o)));drawWaveMarkers();drawDraft();}
    else{stage.exits.forEach(drawExit);['checkpoint','hazard','trap','teleport'].forEach(type=>(stage[type==='checkpoint'?'checkpoints':type==='hazard'?'hazards':type==='trap'?'traps':'teleports']||[]).forEach(o=>drawSceneObject(type,o)));}
    updateCounters();
  }
  function updateCounters(){const s=currentStage();$('objectCount').textContent=`平台 ${s.platforms.length} · 敵人 ${(s.enemies||[]).length} · 場景物件 ${(s.checkpoints||[]).length+(s.hazards||[]).length+(s.traps||[]).length+(s.teleports||[]).length} · Waves ${(s.waves||[]).length}`;$('canvasStageTitle').textContent=s.name;$('selectedBadge').textContent=state.selected?`${state.selected.type} · ${state.selected.id}`:'未選取';}
  function renderObjectList(){
    const s=currentStage(),rows=[];
    if(s.playerStart)rows.push({type:'start',id:'playerStart',label:'角色開始點',sub:`X ${s.playerStart.x} · Y ${s.playerStart.y}`,color:'#4d91e3'});
    s.platforms.forEach(o=>rows.push({type:'platform',id:o.id,label:`${o.label} · ${o.kind==='fixed'?'固定平台':'移動平台'}`,sub:`X ${o.x1}–${o.x2} · Y ${o.y}`,color:o.kind==='fixed'?'#e05252':'#32b878'}));
    (s.enemies||[]).forEach(o=>rows.push({type:'enemy',id:o.id,label:`${o.label} · ${o.type}`,sub:`平台 ${o.platformId||'未設定'} · 路線 ${(o.patrol?.points||[]).length} 點`,color:'#e89b7d'}));
    s.exits.forEach(o=>rows.push({type:'exit',id:o.id,label:`${o.label} · 關卡出口`,sub:o.targetStageId?`→ ${o.targetStageId}`:'尚未設定目的地',color:'#a078e0'}));
    s.transitions.forEach(o=>rows.push({type:'transition',id:o.id,label:`${o.label} · 轉場點`,sub:`出生位置 X ${o.x} · Y ${o.y}`,color:'#39b6bd'}));
    (s.checkpoints||[]).forEach(o=>rows.push({type:'checkpoint',id:o.id,label:`${o.label} · Checkpoint`,sub:`X ${o.x} · Y ${o.y}`,color:'#38c987'}));
    (s.hazards||[]).forEach(o=>rows.push({type:'hazard',id:o.id,label:`${o.label} · Hazard`,sub:`傷害 ${o.damage||0} · X ${o.x}`,color:'#ef5350'}));
    (s.traps||[]).forEach(o=>rows.push({type:'trap',id:o.id,label:`${o.label} · Trap`,sub:`${o.kind||'trap'} · 傷害 ${o.damage||0}`,color:'#e99b36'}));
    (s.teleports||[]).forEach(o=>rows.push({type:'teleport',id:o.id,label:`${o.label} · Teleport`,sub:`→ X ${o.destinationX} · Y ${o.destinationY}`,color:'#3dc7d3'}));
    (s.waves||[]).forEach(o=>rows.push({type:'wave',id:o.id,label:`${o.label} · Enemy Wave`,sub:`${o.trigger?.type||'stageStart'} · ${(o.entries||[]).length} 組出場`,color:'#d7a94a'}));
    $('objectList').innerHTML=rows.length?rows.map(o=>`<button class="se-object-item ${state.selected?.type===o.type&&state.selected?.id===o.id?'selected':''}" data-select-type="${o.type}" data-select-id="${escapeHtml(o.id)}"><i style="background:${o.color}"></i><strong>${escapeHtml(o.label)}</strong><small>${escapeHtml(o.sub)}</small></button>`).join(''):'<p class="se-empty">目前沒有物件。請在地圖上放置平台或標記。</p>';
    updateCounters();
    renderAssetLibrary();
  }
  function renderAssetRows(hostId,assets,emptyText){
    const host=$(hostId);if(!host)return;
    host.innerHTML=assets.length?assets.map(a=>`<div class="se-asset-row"><span class="se-asset-dot ${a.category==='moving'?'moving':a.category==='hazard'?'hazard':''}"></span><img class="se-asset-thumb" src="${escapeHtml(state.assetData.get(a.path)||state.legacyAssetPaths.get(a.path)||a.path)}" alt=""><div class="se-asset-info"><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.path)}</small></div><button type="button" data-asset-reload="${escapeHtml(a.id)}" title="重新選取此圖片檔案，供打包使用">補載／替換</button><input type="file" data-asset-file="${escapeHtml(a.id)}" accept="image/png,image/webp,image/jpeg" hidden><button type="button" data-asset-remove="${escapeHtml(a.id)}" title="從圖片庫移除">×</button></div>`).join(''):`<p class="se-empty">${emptyText}</p>`;
  }
  function renderAssetLibrary(){
    const chapter=chapterNumber(),assets=(state.project.assetLibrary||[]).filter(a=>assetChapterNumber(a)===chapter);
    renderAssetRows('platformAssetList',assets.filter(a=>a.category==='fixed'||a.category==='moving'),`Chapter ${chapter} 尚未加入平台圖片。上傳 PNG／WebP／JPG 後，會存入 images/chapter${chapter}/bg/。`);
    renderAssetRows('hazardAssetList',assets.filter(a=>a.category==='hazard'),`Chapter ${chapter} 尚未加入 Hazard 圖片。上載後會存入 images/chapter${chapter}/bg/。`);
  }
  function field(label,key,value,type='number',attrs='') {return `<label class="se-prop-field"><span>${label}</span><input type="${type}" data-field="${key}" value="${escapeHtml(value)}" ${attrs}></label>`;}
  function waveField(label,index,key,value){return `<label class="se-prop-field"><span>${label}</span><input type="number" data-wave-entry="${index}" data-wave-field="${key}" value="${escapeHtml(value)}"></label>`;}
  function renderInspector(){
    const ref=state.selected,o=findObject(ref); if(!o){$('inspector').innerHTML='<p class="se-empty">選取地圖上的物件後，可在此調整圖片、尺寸、碰撞和目的地。</p>';return;}
    let html='';
    if(ref.type==='platform'){
      const w=Math.round(o.x2-o.x1),dest=o.loop||{};
      const imageOptions=(state.project.assetLibrary||[]).filter(a=>(a.category==='fixed'||a.category==='moving')&&assetChapterNumber(a)===chapterNumber()).map(a=>`<option value="${escapeHtml(a.id)}" ${a.id===(o.imageAssetId||'')?'selected':''}>${escapeHtml(a.name)} · ${a.category==='moving'?'移動素材':'固定素材'}</option>`).join('');
      html=`<div class="se-prop-group"><div class="se-prop-title">${escapeHtml(o.label)} · ${o.kind==='fixed'?'固定平台':'移動平台'}</div><div class="se-prop-grid">${field('左端 X','x1',o.x1)}${field('右端 X','x2',o.x2)}${field('平台頂部 Y','y',o.y)}${field('平台寬度／碰撞寬','width',w)}${field('碰撞厚度','collisionThickness',o.collisionThickness)}</div></div>
      <div class="se-prop-group"><div class="se-prop-title">外部平台圖片（不拉伸原圖）</div><label class="se-prop-field"><span>從共用圖片庫選擇</span><select data-field="imageAssetId"><option value="">不使用圖片（預設石台）</option>${imageOptions}</select></label><div class="se-prop-grid">${field('圖片縮放 %','imageScale',o.imageScale??100)}${field('圖片透明度 %','imageOpacity',o.imageOpacity??100)}${field('圖片 X 偏移','imageOffsetX',o.imageOffsetX??0)}${field('圖片 Y 偏移','imageOffsetY',o.imageOffsetY??0)}${field('圖片旋轉 °','imageRotation',o.imageRotation??0)}</div><p class="se-small-note">圖片以平台寬度為基準縮放，會保留原始寬高比例。碰撞線仍由平台座標獨立控制。</p><div class="se-prop-actions"><button type="button" data-action="clear-image">移除圖片</button></div></div>
      <div class="se-prop-group"><div class="se-prop-title">角色落腳線（獨立碰撞面）</div><p class="se-small-note">這條紅線才是角色真正站立的位置。請先按左側「自訂落腳線」，再在平台圖片上由左向右拖曳；線的位置會跟隨圖片縮放、偏移及平台移動。</p>
      <div class="se-prop-grid">${field('起點 X %','standX1',o.standLine?Math.round(o.standLine.x1*1000)/10:0,'number','step="0.1" min="0" max="100"')}${field('起點 Y %','standY1',o.standLine?Math.round(o.standLine.y1*1000)/10:0,'number','step="0.1" min="0" max="100"')}${field('終點 X %','standX2',o.standLine?Math.round(o.standLine.x2*1000)/10:100,'number','step="0.1" min="0" max="100"')}${field('終點 Y %','standY2',o.standLine?Math.round(o.standLine.y2*1000)/10:0,'number','step="0.1" min="0" max="100"')}</div>
      <div class="se-prop-actions"><button type="button" data-action="draw-standline">在地圖上重畫落腳線</button><button type="button" data-action="clear-standline">重設為平台頂線</button></div></div>`;
      if(o.kind==='moving') html+=`<div class="se-prop-group"><div class="se-prop-title">移動設定</div><div class="se-prop-grid">${field('速度 px／秒','speed',o.speed)}${field('端點停留秒數','pauseSeconds',o.pauseSeconds,'number','step="0.1" min="0" max="10"')}</div>${o.loop?`<div class="se-prop-title">Loop 終點座標</div><div class="se-prop-grid">${field('終點 X','loopEndX',Math.round(dest.to.x))}${field('終點 Y','loopEndY',Math.round(dest.to.y))}</div>`:'<p class="se-empty">尚未設定橙色 Loop 路徑。選取左側「Loop 路徑」工具，從平台中心拖到移動終點。</p>'}</div>`;
      html+=`<div class="se-prop-group"><div class="se-prop-actions"><button type="button" data-action="delete-object">刪除此平台</button><button type="button" data-action="duplicate-object">複製平台</button></div></div>`;
    } else if(ref.type==='exit'){
      const stageOptions=state.project.stages.map(s=>`<option value="${escapeHtml(s.id)}" ${s.id===o.targetStageId?'selected':''}>${escapeHtml(s.name)} — ${escapeHtml((s.background||'未設定背景').split('/').pop())}</option>`).join('');
      const target=state.project.stages.find(s=>s.id===o.targetStageId);
      const transitionOptions=(target?.transitions||[]).map(t=>`<option value="${escapeHtml(t.id)}" ${t.id===o.targetTransitionId?'selected':''}>${escapeHtml(t.label)} (${escapeHtml(t.id)})</option>`).join('');
      const targetBg=target?.background||'';
      const targetPreview=targetBg?`<div class="se-stage-preview"><img src="${escapeHtml(state.assetData.get(targetBg)||targetBg)}" alt="目的 Stage 背景"><div><strong>${escapeHtml(target?.name||'目的 Stage')}</strong><small>${escapeHtml(targetBg)}</small></div></div>`:'<p class="se-empty">尚未選擇目的 Stage。可先新增目的 Stage，並填入下一關背景路徑。</p>';
      html=`<div class="se-prop-group"><div class="se-prop-title">${escapeHtml(o.label)} · 關卡出口</div><div class="se-prop-grid">${field('中心 X','x',o.x)}${field('中心 Y','y',o.y)}${field('觸發寬度','width',o.width)}${field('觸發高度','height',o.height)}</div><label class="se-prop-field"><span>目的 Stage（已建立的關卡）</span><select data-field="targetStageId"><option value="">未設定</option>${stageOptions}</select></label>${targetPreview}<label class="se-prop-field"><span>目的轉場點 ID（獨立設定）</span><select data-field="targetTransitionId"><option value="">未設定</option>${transitionOptions}</select></label>${target&&!target.transitions?.length?'<p class="se-empty">目的 Stage 尚未放置轉場點，請切換到該 Stage，使用「轉場點」工具設定角色進入位置。</p>':''}<div class="se-prop-group"><div class="se-prop-title">快速新增目的 Stage</div><label class="se-prop-field"><span>下一關背景路徑</span><input class="se-prop-input" id="newTargetBackground" value="${chapterRoot(chapterNumber())}/backgrounds/bg2.webp" spellcheck="false"></label><button type="button" class="se-button full" data-action="create-target-stage">＋ 建立目的 Stage 並自動連接 TP1</button><p class="se-small-note">背景路徑格式：images/chapterN/backgrounds/檔名.webp。平台及 Hazard 圖放 images/chapterN/bg/。</p></div><label class="se-prop-field"><span>轉場效果</span><select data-field="effect"><option value="fade" ${o.effect==='fade'?'selected':''}>淡出／淡入</option><option value="blackout" ${o.effect==='blackout'?'selected':''}>黑屏切換</option><option value="instant" ${o.effect==='instant'?'selected':''}>直接切換</option></select></label><p class="se-empty">出口負責偵測玩家到達；目的 Stage 的轉場點負責提供進入位置，兩者分開設定。</p><div class="se-prop-actions"><button type="button" data-action="delete-object">刪除此出口</button></div></div>`;
    } else if(ref.type==='enemy'){
      const platformOptions=currentStage().platforms.map(p=>`<option value="${escapeHtml(p.id)}" ${p.id===o.platformId?'selected':''}>${escapeHtml(p.label||p.id)} · ${p.kind==='moving'?'移動平台':'固定平台'}</option>`).join('');
      const routeCount=o.patrol?.points?.length||0;
      html=`<div class="se-prop-group"><div class="se-prop-title">${escapeHtml(o.label)} · 敵人設定</div><label class="se-prop-field"><span>敵人種類</span><select data-field="type">${Object.keys(ENEMY_TYPES).map(id=>`<option value="${id}" ${(o.type||'chapter4_enemy_1')===id?'selected':''}>${id} · ${escapeHtml(registryRecord(id)?.name||id)}</option>`).join('')}</select></label><div class="se-prop-grid">${field('X 位置（中心）','x',Math.round(o.x))}${field('敵人大小 %','size',o.size??100)}</div><label class="se-prop-field"><span>所屬平台（敵人不能離開此平台）</span><select data-field="platformId"><option value="">未指定</option>${platformOptions}</select></label><div class="se-prop-title">行走路線</div><p class="se-enemy-route-note">已設定 ${routeCount} 個路線點。使用左側「敵人行走路線」工具，逐點點擊同一平台增加節點；移動平台會帶動整條路線。</p><div class="se-prop-grid">${field('行走速度 px／秒','patrolSpeed',o.patrol?.speed??70)}${field('節點停留秒數','patrolPause',o.patrol?.pauseSeconds??.5,'number','step="0.1" min="0" max="10"')}</div><label class="se-prop-field"><span>巡邏模式</span><select data-field="patrolMode"><option value="pingpong" ${(o.patrol?.mode||'pingpong')==='pingpong'?'selected':''}>來回巡邏</option><option value="loop" ${o.patrol?.mode==='loop'?'selected':''}>循環巡邏</option></select></label><div class="se-prop-actions"><button type="button" data-action="finish-enemy-route">完成路線</button><button type="button" data-action="remove-enemy-route-point">移除最後一點</button><button type="button" data-action="clear-enemy-route">清空路線</button></div></div><div class="se-prop-group"><div class="se-prop-title">AI／戰鬥 Runtime</div><label class="se-prop-field"><span>AI Type</span><select data-field="aiType"><option value="legacy-runtime" ${(o.ai?.aiType||'legacy-runtime')==='legacy-runtime'?'selected':''}>Legacy（原有行為）</option><option value="patrol" ${o.ai?.aiType==='patrol'?'selected':''}>Patrol（巡邏／近戰）</option><option value="chase" ${o.ai?.aiType==='chase'?'selected':''}>Chase（追擊近戰）</option><option value="ranged" ${o.ai?.aiType==='ranged'?'selected':''}>Ranged（遠距投射物）</option><option value="guard" ${o.ai?.aiType==='guard'?'selected':''}>Guard（定點守衛）</option><option value="ambush" ${o.ai?.aiType==='ambush'?'selected':''}>Ambush（近距離伏擊）</option><option value="ground" ${o.ai?.aiType==='ground'?'selected':''}>Ground（地面範圍攻擊）</option><option value="boss" ${o.ai?.aiType==='boss'?'selected':''}>Boss（Phase 戰鬥）</option></select></label><label class="se-prop-field"><span>攻擊模式</span><select data-field="attackMode"><option value="1" ${Number(o.ai?.attackMode)===1?'selected':''}>地面攻擊</option><option value="2" ${Number(o.ai?.attackMode)===2?'selected':''}>遠距投射物</option><option value="3" ${(!o.ai?.attackMode||Number(o.ai?.attackMode)===3)?'selected':''}>近戰</option></select></label><div class="se-prop-grid">${field('HP','maxHp',o.maxHp??registryRecord(o.type)?.hp??3)}${field('偵測距離','alertRange',o.ai?.alertRange??430)}${field('攻擊距離','attackRange',o.ai?.attackRange??230)}${field('攻擊冷卻 ms','attackCooldownMs',o.ai?.attackCooldownMs??1450)}${field('玩家受傷值','damage',o.ai?.damage??1)}${field('攻擊動畫 ms','attackPoseMs',o.ai?.attackPoseMs??420)}${field('移動速度','movementSpeed',o.ai?.movementSpeed??150)}${field('遠程保持距離','keepDistance',o.ai?.keepDistance??190)}</div><p class="se-small-note">新 AI Type 已接 Chapter 4 正式 Stage Runtime。Ranged 需要 Projectile 動作；沒有素材時會顯示能量球 fallback。Boss Phase 請在 Boss Editor 設定。</p><div class="se-prop-actions"><button type="button" data-action="delete-object">刪除此敵人</button></div></div>`;
    } else if(['checkpoint','hazard','trap','teleport'].includes(ref.type)){
      const titles={checkpoint:'Checkpoint 設定',hazard:'Hazard 傷害區域',trap:'Trap 陷阱',teleport:'Teleport 傳送點'};
      html=`<div class="se-prop-group"><div class="se-prop-title">${escapeHtml(o.label)} · ${titles[ref.type]}</div><div class="se-prop-grid">${field('中心 X','x',o.x)}${field('中心 Y','y',o.y)}${field('寬度','width',o.width)}${field('高度','height',o.height)}</div><label class="se-check"><input type="checkbox" data-field="enabled" ${o.enabled!==false?'checked':''}> 啟用物件</label>`;
      if(ref.type==='checkpoint')html+=`<div class="se-prop-grid">${field('觸碰回血 %','healPercent',o.healPercent??20)}</div><label class="se-check"><input type="checkbox" data-field="once" ${o.once?'checked':''}> 只觸發一次</label><p class="se-small-note">玩家接觸後會記錄重生位置。掉落／死亡重置時回到最後啟用的 Checkpoint。</p>`;
      if(ref.type==='hazard'||ref.type==='trap')html+=`<div class="se-prop-grid">${field('每次傷害 HP','damage',o.damage??10)}${field('觸發冷卻 ms','cooldownMs',o.cooldownMs??850)}</div><label class="se-prop-field"><span>外觀／類型</span><select data-field="kind"><option value="${ref.type==='hazard'?'spikes':'crusher'}" ${o.kind===(ref.type==='hazard'?'spikes':'crusher')?'selected':''}>${ref.type==='hazard'?'尖刺':'壓碎陷阱'}</option><option value="fire" ${o.kind==='fire'?'selected':''}>火焰</option><option value="electric" ${o.kind==='electric'?'selected':''}>電流</option></select></label><p class="se-small-note">玩家與區域重疊時造成傷害；冷卻期間不會每一幀重複扣血。</p>`;
      if(ref.type==='hazard'){
        const hazardAssets=(state.project.assetLibrary||[]).filter(a=>a.category==='hazard'&&assetChapterNumber(a)===chapterNumber());
        const frameIds=Array.isArray(o.hazardImageAssetIds)?o.hazardImageAssetIds:(o.hazardImageAssetId?[o.hazardImageAssetId]:[]);
        const frameFields=Array.from({length:4},(_,index)=>{
          const selectedId=frameIds[index]||'';
          const options=hazardAssets.map(a=>`<option value="${escapeHtml(a.id)}" ${a.id===selectedId?'selected':''}>${escapeHtml(a.name)}</option>`).join('');
          const path=(o.imageFrames||[])[index]||(index===0?o.imageSrc:'');
          const preview=path?`<img class="se-hazard-frame-thumb" src="${escapeHtml(state.assetData.get(path)||state.legacyAssetPaths.get(path)||path)}" alt="Hazard 第 ${index+1} 幀">`:`<span class="se-hazard-frame-empty">尚未指定</span>`;
          return `<label class="se-prop-field se-hazard-frame-field"><span>第 ${index+1} 幀</span><select data-field="hazardFrame${index+1}AssetId"><option value="">未設定</option>${options}</select>${preview}</label>`;
        }).join('');
        const assigned=frameIds.filter(Boolean).length;
        html+=`<div class="se-prop-group"><div class="se-prop-title">Hazard 四格動畫（獨立於傷害判定）</div><p class="se-small-note">上載時一次選取 4 張圖，程式會依檔名的數字順序排列（例如 hazard_01、hazard_02、hazard_03、hazard_04）。也可從本章 Hazard 圖片庫逐格指定。已設定 ${assigned}/4 幀。</p><div class="se-hazard-frame-grid">${frameFields}</div><button type="button" class="se-button" data-action="upload-hazard-image">＋ 一次上載 4 張動畫圖片</button><div class="se-prop-grid">${field('每幀播放時間 ms','animationFrameMs',o.animationFrameMs??120)}${field('圖片縮放 %','imageScale',o.imageScale??100)}${field('圖片透明度 %','imageOpacity',o.imageOpacity??100)}${field('圖片 X 偏移','imageOffsetX',o.imageOffsetX??0)}${field('圖片 Y 偏移','imageOffsetY',o.imageOffsetY??0)}${field('圖片旋轉 °','imageRotation',o.imageRotation??0)}</div><p class="se-small-note">四張圖片會依序循環播放。每幀預設 120 ms；傷害判定位置、寬高及扣血冷卻完全不受動畫影響。遊戲畫面不顯示傷害框。</p><div class="se-prop-actions"><button type="button" data-action="clear-hazard-image">移除 Hazard 動畫圖片</button></div></div>`;
      }
      if(ref.type==='trap')html+=`<div class="se-prop-grid">${field('啟動延遲 ms','activationDelayMs',o.activationDelayMs??350)}${field('啟動持續 ms','activeDurationMs',o.activeDurationMs??900)}</div><label class="se-prop-field"><span>觸發方式</span><select data-field="trigger"><option value="touch" ${(!o.trigger||o.trigger==='touch')?'selected':''}>玩家觸碰</option></select></label>`;
      if(ref.type==='teleport'){const options=state.project.stages.map(st=>`<option value="${escapeHtml(st.id)}" ${st.id===o.destinationStageId?'selected':''}>${escapeHtml(st.name||st.id)}</option>`).join('');html+=`<div class="se-prop-grid">${field('目的 X','destinationX',o.destinationX??0)}${field('目的 Y','destinationY',o.destinationY??0)}${field('冷卻 ms','cooldownMs',o.cooldownMs??1000)}</div><label class="se-prop-field"><span>目的 Stage（留空為本關座標）</span><select data-field="destinationStageId"><option value="">本關</option>${options}</select></label><label class="se-prop-field"><span>進入後面向</span><select data-field="facing"><option value="right" ${o.facing!=='left'?'selected':''}>向右</option><option value="left" ${o.facing==='left'?'selected':''}>向左</option></select></label>`;}
      html+=`<div class="se-prop-actions"><button type="button" data-action="delete-object">刪除此物件</button></div></div>`;
    } else if(ref.type==='wave'){
      const entries=o.entries||[];const enemyOpts=Object.keys(ENEMY_TYPES).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
      const entryHtml=entries.map((entry,index)=>`<div class="se-wave-entry"><strong>Spawn ${index+1}</strong><label class="se-prop-field"><span>Enemy ID</span><select data-wave-entry="${index}" data-wave-field="enemyId">${enemyOpts.map(id=>`<option value="${escapeHtml(id)}" ${id===entry.enemyId?'selected':''}>${escapeHtml(id)} · ${escapeHtml(registryRecord(id)?.name||id)}</option>`).join('')}</select></label><div class="se-prop-grid">${waveField('數量',index,'count',entry.count??1)}${waveField('出生 X',index,'x',entry.x??300)}${waveField('出生 Y',index,'y',entry.y??900)}${waveField('間距',index,'spacing',entry.spacing??55)}</div><label class="se-prop-field"><span>出生平台</span><select data-wave-entry="${index}" data-wave-field="platformId"><option value="">自動選擇</option>${currentStage().platforms.map(p=>`<option value="${escapeHtml(p.id)}" ${p.id===entry.platformId?'selected':''}>${escapeHtml(p.label||p.id)}</option>`).join('')}</select></label><button type="button" class="se-button" data-action="remove-wave-entry" data-index="${index}">移除此組</button></div>`).join('');
      html=`<div class="se-prop-group"><div class="se-prop-title">${escapeHtml(o.label)} · Enemy Wave Editor</div><label class="se-check"><input type="checkbox" data-field="enabled" ${o.enabled!==false?'checked':''}> 啟用此 Wave</label><label class="se-prop-field"><span>觸發條件</span><select data-field="triggerType"><option value="stageStart" ${o.trigger?.type==='stageStart'?'selected':''}>Stage 開始</option><option value="delay" ${o.trigger?.type==='delay'?'selected':''}>指定時間後</option><option value="playerEnter" ${o.trigger?.type==='playerEnter'?'selected':''}>玩家進入區域</option><option value="previousWaveCleared" ${o.trigger?.type==='previousWaveCleared'?'selected':''}>上一波全滅</option></select></label><div class="se-prop-grid">${field('延遲 ms','delayMs',o.trigger?.delayMs??0)}${field('出場間隔 ms','spawnIntervalMs',o.spawnIntervalMs??650)}</div><div class="se-prop-title">玩家進入區域（playerEnter）</div><div class="se-prop-grid">${field('區域中心 X','triggerX',o.trigger?.x??180)}${field('區域中心 Y','triggerY',o.trigger?.y??180)}${field('區域寬度','triggerWidth',o.trigger?.width??260)}${field('區域高度','triggerHeight',o.trigger?.height??220)}</div><div class="se-prop-title">出場敵人</div>${entryHtml}<button type="button" class="se-button full" data-action="add-wave-entry">＋ 加入另一組敵人</button><div class="se-prop-actions"><button type="button" data-action="delete-object">刪除此 Wave</button></div><p class="se-small-note">每一組可獨立設定敵人、數量、出生平台及座標。完成條件為該 Wave 所有已生成敵人全部被擊敗。</p></div>`;
    } else if(ref.type==='transition'){
      html=`<div class="se-prop-group"><div class="se-prop-title">${escapeHtml(o.label)} · 轉場點</div><div class="se-prop-grid">${field('出生 X','x',o.x)}${field('出生 Y','y',o.y)}</div><label class="se-prop-field"><span>角色進入後面向</span><select data-field="facing"><option value="right" ${o.facing==='right'?'selected':''}>向右</option><option value="left" ${o.facing==='left'?'selected':''}>向左</option></select></label><p class="se-empty">這是一個獨立的出生位置標記，不會自行觸發離開關卡。</p><div class="se-prop-actions"><button type="button" data-action="delete-object">刪除此轉場點</button></div></div>`;
    } else if(ref.type==='start'){
      html=`<div class="se-prop-group"><div class="se-prop-title">角色開始點</div><div class="se-prop-grid">${field('出生 X','x',o.x)}${field('出生 Y','y',o.y)}</div><p class="se-empty">每個 Stage 各自保存一個角色開始點。轉場進入位置由獨立的轉場點設定。</p><div class="se-prop-actions"><button type="button" data-action="delete-object">移除開始點</button></div></div>`;
    }
    $('inspector').innerHTML=html;
  }
  function setSelectedField(key,value){
    const ref=state.selected,o=findObject(ref); if(!o)return;
    if(ref.type==='exit'&&key==='targetStageId'){o.targetStageId=value||'';o.targetTransitionId='';return;}
    if(ref.type==='wave'&&key==='triggerType'){o.trigger ||= {};o.trigger.type=value;return;}
    if(ref.type==='wave'&&['delayMs','triggerX','triggerY','triggerWidth','triggerHeight'].includes(key)){o.trigger ||= {};const map={delayMs:'delayMs',triggerX:'x',triggerY:'y',triggerWidth:'width',triggerHeight:'height'};o.trigger[map[key]]=Number(value)||0;return;}
    if(ref.type==='wave'&&key==='spawnIntervalMs'){o.spawnIntervalMs=clamp(value,0,30000);return;}
    if(ref.type==='enemy'&&key==='aiType'){o.ai ||= {};o.ai.aiType=value;return;}
    if(ref.type==='enemy'&&key==='attackMode'){o.ai ||= {};o.ai.attackMode=clamp(value,1,3);return;}
    if(ref.type==='enemy'&&key==='maxHp'){o.maxHp=clamp(value,1,999999);return;}
    if(ref.type==='enemy'&&key==='platformId'){o.platformId=value||'';const platform=currentStage().platforms.find(p=>p.id===o.platformId);if(platform){const seg=getStandLinePoints(platform);o.y=Math.round(lineYAtX(seg,clamp(o.x,Math.min(seg[0].x,seg[1].x),Math.max(seg[0].x,seg[1].x))));}return;}
    if(ref.type==='enemy'&&key==='type'){const def=ENEMY_TYPES[value]||ENEMY_TYPES.chapter4_enemy_1;o.type=value;o.spriteRoot=def.root;o.projectilePath=def.projectile;return;}
    if(ref.type==='enemy'&&key==='size'){o.size=clamp(value,40,250);o.width=o.size;o.height=o.size;return;}
    if(ref.type==='enemy'&&key==='x'){o.x=Number(value);const platform=currentStage().platforms.find(p=>p.id===o.platformId);if(platform){const seg=getStandLinePoints(platform);o.y=Math.round(lineYAtX(seg,clamp(o.x,Math.min(seg[0].x,seg[1].x),Math.max(seg[0].x,seg[1].x))));}return;}
    if(ref.type==='wave'&&key==='enabled'){o.enabled=!!value;return;}
    if(['checkpoint','hazard','trap','teleport'].includes(ref.type)&&key==='enabled'){o.enabled=!!value;return;}
    if(['checkpoint','hazard','trap','teleport'].includes(ref.type)&&['x','y','width','height','damage','cooldownMs','healPercent','activeDurationMs','activationDelayMs','destinationX','destinationY'].includes(key)){const limits={width:[20,2000],height:[20,2000],damage:[0,9999],cooldownMs:[100,60000],healPercent:[0,100],activeDurationMs:[100,30000],activationDelayMs:[0,30000]};const range=limits[key]||[-100000,100000];o[key]=clamp(value,range[0],range[1]);return;}
    if(['checkpoint','hazard','trap','teleport'].includes(ref.type)&&['kind','trigger','destinationStageId','destinationTransitionId','facing','once'].includes(key)){o[key]=key==='once'?!!value:value;return;}
    if(ref.type==='wave'&&['label','completion'].includes(key)){o[key]=value;return;}
    if(ref.type==='enemy'&&key==='patrolMode'){o.patrol.mode=value;return;}
    if(ref.type==='enemy'&&['patrolSpeed','patrolPause','alertRange','attackRange','attackCooldownMs','damage','size','attackPoseMs','movementSpeed','keepDistance'].includes(key)){const map={patrolSpeed:['patrol','speed'],patrolPause:['patrol','pauseSeconds'],alertRange:['ai','alertRange'],attackRange:['ai','attackRange'],attackCooldownMs:['ai','attackCooldownMs'],damage:['ai','damage'],attackPoseMs:['ai','attackPoseMs'],movementSpeed:['ai','movementSpeed'],keepDistance:['ai','keepDistance'],size:['size']};const [group,prop]=map[key];if(group==='size')o.size=clamp(value,40,250);else{o[group] ||= {};const ranges={patrolSpeed:[1,500],patrolPause:[0,10],alertRange:[50,2000],attackRange:[30,1200],attackCooldownMs:[100,30000],damage:[0,999],attackPoseMs:[100,5000],movementSpeed:[1,800],keepDistance:[30,1200]};o[group][prop]=clamp(value,...ranges[key]);}return;}
    if(key==='width'&&ref.type==='platform'){o.x2=o.x1+clamp(value,20,4000);return;}
    if(key==='loopEndX'&&ref.type==='platform'&&o.loop){o.loop.to.x=Number(value);return;}
    if(key==='loopEndY'&&ref.type==='platform'&&o.loop){o.loop.to.y=Number(value);return;}
    if(key==='imageAssetId'&&ref.type==='platform'){const asset=(state.project.assetLibrary||[]).find(a=>a.id===value&&['fixed','moving'].includes(a.category));o.imageAssetId=asset?.id||'';o.imageSrc=asset?.path||'';return;}
    if(ref.type==='hazard'&&/^hazardFrame[1-4]AssetId$/.test(key)){
      const index=Number(key.match(/[1-4]/)[0])-1;
      const asset=(state.project.assetLibrary||[]).find(a=>a.id===value&&a.category==='hazard');
      o.hazardImageAssetIds=Array.isArray(o.hazardImageAssetIds)?o.hazardImageAssetIds.slice(0,4):['','','',''];
      o.imageFrames=Array.isArray(o.imageFrames)?o.imageFrames.slice(0,4):['','','',''];
      while(o.hazardImageAssetIds.length<4)o.hazardImageAssetIds.push('');while(o.imageFrames.length<4)o.imageFrames.push('');
      o.hazardImageAssetIds[index]=asset?.id||'';o.imageFrames[index]=asset?.path||'';
      o.hazardImageAssetId=o.hazardImageAssetIds[0]||'';o.imageSrc=o.imageFrames[0]||'';return;
    }
    if(ref.type==='hazard'&&key==='hazardImageAssetId'){const asset=(state.project.assetLibrary||[]).find(a=>a.id===value&&a.category==='hazard');o.hazardImageAssetId=asset?.id||'';o.imageSrc=asset?.path||'';o.hazardImageAssetIds=[asset?.id||'','','',''];o.imageFrames=[asset?.path||'','','',''];return;}
    if(ref.type==='hazard'&&['imageScale','imageOpacity','imageOffsetX','imageOffsetY','imageRotation','animationFrameMs'].includes(key)){const limits={imageScale:[10,300],imageOpacity:[0,100],imageOffsetX:[-1000,1000],imageOffsetY:[-1000,1000],imageRotation:[-180,180],animationFrameMs:[50,1000]};o[key]=clamp(value,...limits[key]);return;}
    if(ref.type==='platform'&&key.startsWith('stand')){const map={standX1:'x1',standY1:'y1',standX2:'x2',standY2:'y2'};o.standLine ||= {x1:0,y1:0,x2:1,y2:0};o.standLine[map[key]]=clamp(value,0,100)/100;return;}
    if(['x1','x2','y','imageHeight','imageScale','imageOffsetX','imageOffsetY','imageRotation','imageOpacity','collisionThickness','speed','pauseSeconds','x','y','width','height'].includes(key)){
      const ranges={x1:[0,canvas.width],x2:[0,canvas.width],y:[0,canvas.height],x:[0,canvas.width],imageHeight:[10,500],imageScale:[10,300],imageOffsetX:[-1000,1000],imageOffsetY:[-1000,1000],imageRotation:[-180,180],imageOpacity:[0,100],collisionThickness:[2,80],speed:[1,800],pauseSeconds:[0,10],width:[20,4000],height:[20,1000]};
      const range=ranges[key]||[-100000,100000];o[key]=clamp(value,range[0],range[1]);
    } else o[key]=value;
  }
  function renderStageSelect(){
    $('stageSelect').innerHTML=state.project.stages.map(s=>`<option value="${escapeHtml(s.id)}" ${s.id===state.project.currentStageId?'selected':''}>${escapeHtml(s.name)} — ${escapeHtml((s.background||'').split('/').pop())}</option>`).join('');
    const s=currentStage();$('stageId').value=s.id;$('stageName').value=s.name;
    $('backgroundPath').value=s.background?.startsWith('data:')?'（已上傳並內嵌背景圖片）':(s.background||'');
    $('worldWidthInput').value=Number(s.worldWidth||s.width)||'';
    const musicSelect=$('stageMusicSelect');
    if(musicSelect){const tracks=window.PrinceAudioRuntime?.listTracks?.()||[];musicSelect.innerHTML='<option value="">沿用遊戲原本音樂／Audio Manager 設定</option>'+tracks.map(t=>`<option value="${escapeHtml(t.path)}">${escapeHtml(t.name)} · ${escapeHtml(t.path)}</option>`).join('');musicSelect.value=s.music||'';}
    if($('stageMusicVolume'))$('stageMusicVolume').value=s.musicVolume??.28;
    if($('stageMusicLoop'))$('stageMusicLoop').checked=s.musicLoop!==false;
    $('canvasStageTitle').textContent=s.name;
  }
  function switchStage(id){
    if(!state.project.stages.some(s=>s.id===id))return;
    state.project.currentStageId=id;state.selected=null;state.drawing=null;state.dragging=null;
    renderStageSelect();renderObjectList();renderAssetLibrary();renderInspector();loadBackground(currentStage().background);status(`已切換到 ${currentStage().name}。圖片素材庫只顯示本章素材，圖片路徑為 ${chapterRoot()}/backgrounds、bg、enemies。`);
  }
  function createStage(){
    remember();const chapter=chapterNumber(),prefix=`chapter${chapter}_stage`;
    const used=(state.project.stages||[]).map(s=>Number(String(s.id||'').match(new RegExp(`^${prefix}(\\d+)$`,'i'))?.[1]||0));
    let n=Math.max(0,...used)+1,id=`${prefix}${n}`;
    const source=currentStage();
    const stage={id,name:`Chapter ${chapter} · Stage ${n}`,background:source.background||'',width:source.width,height:source.height,backgroundWidth:source.backgroundWidth,backgroundHeight:source.backgroundHeight,worldWidth:source.worldWidth,worldWidthManual:source.worldWidthManual,music:source.music||'',musicVolume:source.musicVolume??.28,musicLoop:source.musicLoop!==false,playerStart:null,platforms:[],enemies:[],exits:[],transitions:[],checkpoints:[],hazards:[],traps:[],teleports:[],waves:[]};
    state.project.stages.push(stage);switchStage(id);toast(`已新增 ${id}；本章素材將存入 ${chapterRoot(chapter)}/。`);
  }
  function createChapter(){
    remember();const chapters=projectChapterNumbers();const chapter=Math.max(0,...chapters)+1;
    const id=`chapter${chapter}_stage1`,source=currentStage();
    if(state.project.stages.some(stage=>stage.id===id)){toast(`${id} 已存在。`);return;}
    const stage={id,name:`Chapter ${chapter} · Stage 1`,background:'',width:source.width||1774,height:source.height||1774,backgroundWidth:source.backgroundWidth||source.width||1774,backgroundHeight:source.backgroundHeight||source.height||1774,worldWidth:source.backgroundWidth||source.width||1774,worldWidthManual:false,music:'',musicVolume:.28,musicLoop:true,playerStart:null,platforms:[],enemies:[],exits:[],transitions:[],checkpoints:[],hazards:[],traps:[],teleports:[],waves:[]};
    state.project.stages.push(stage);switchStage(id);toast(`已新增 Chapter ${chapter}。匯出資源 ZIP 時會自動建立 ${chapterRoot(chapter)}/backgrounds、bg、enemies。`);
  }
  function download(filename,content,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function exportJS(){
    const exportProject=clone(state.project);
    exportProject.schemaVersion=11;
    const dataUrlToPath=new Map();
    for(const [path,dataUrl] of state.assetData){if(typeof dataUrl==='string'&&dataUrl.startsWith('data:'))dataUrlToPath.set(dataUrl,path);}
    const warnings=[];
    const pathOnly=value=>{
      if(typeof value!=='string'||!value.startsWith('data:'))return value;
      const replacement=dataUrlToPath.get(value);
      if(replacement)return replacement;
      warnings.push('有圖片沒有外部檔案路徑');
      return '';
    };
    (exportProject.assetLibrary||[]).forEach(asset=>{delete asset.dataUrl;asset.path=pathOnly(asset.path);});
    (exportProject.stages||[]).forEach(stage=>{
      stage.enemies=Array.isArray(stage.enemies)?stage.enemies:[];
      stage.background=pathOnly(stage.background);
      (stage.platforms||[]).forEach(platform=>{platform.imageSrc=pathOnly(platform.imageSrc);});
      (stage.hazards||[]).forEach(hazard=>{hazard.imageSrc=pathOnly(hazard.imageSrc);hazard.imageFrames=(Array.isArray(hazard.imageFrames)?hazard.imageFrames:[]).map(pathOnly);});
    });
    const payload=JSON.stringify(exportProject,null,2);
    const source=`/* Stage Editor path-only export.\n * Backgrounds: images/chapterN/backgrounds/\n * Platforms + Hazard art: images/chapterN/bg/\n * Enemies: images/chapterN/enemies/\n * This JS stores relative paths only. Use the Stage Editor Resource ZIP export\n * to create chapter folders and include the actual image files.\n */\nwindow.PRINCE_STAGE_CONFIG = ${payload};\n`;
    download('prince-stage-config.js',source,'text/javascript;charset=utf-8');
    const enemyCount=exportProject.stages.reduce((n,stage)=>n+(stage.enemies||[]).length,0);
    toast(`JS 已匯出（只含路徑）：${(exportProject.assetLibrary||[]).length} 個素材、${enemyCount} 隻敵人。圖片請放 images/chapterN/backgrounds、bg 或 enemies；要自動建立資料夾請使用「匯出資源 ZIP」。${warnings.length?`另有 ${warnings.length} 個圖片欄位未能轉成路徑。`:''}`);
  }
  function exportJSON(){download('prince-stage-project.json',JSON.stringify(state.project,null,2),'application/json;charset=utf-8');toast('已匯出工程 JSON（圖片請連同資源 ZIP 使用）。');}
  const zipCrcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}return table;})();
  function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=zipCrcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
  function concatBytes(parts){const size=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;}
  function zipStore(files){const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;const now=new Date(),dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|(Math.floor(now.getSeconds()/2)),dosDate=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
    for(const f of files){const name=enc.encode(f.name),data=f.bytes,crc=crc32(data),local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);lv.setUint16(10,dosTime,true);lv.setUint16(12,dosDate,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);lv.setUint16(28,0,true);local.set(name,30);locals.push(local,data);
      const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint16(12,dosTime,true);cv.setUint16(14,dosDate,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,offset,true);central.set(name,46);centrals.push(central);offset+=local.length+data.length;
    }
    const centralSize=centrals.reduce((n,p)=>n+p.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);ev.setUint16(20,0,true);return concatBytes([...locals,...centrals,end]);
  }
  async function exportPackage(){
    const exportProject=clone(state.project);exportProject.schemaVersion=11;
    (exportProject.assetLibrary||[]).forEach(a=>{delete a.dataUrl;delete a.legacyPath;});
    const projectText=JSON.stringify(exportProject,null,2),source=`/* Stage Editor path-only export.\n * Backgrounds: images/chapterN/backgrounds/\n * Platforms + Hazard art: images/chapterN/bg/\n * Enemies: images/chapterN/enemies/\n */\nwindow.PRINCE_STAGE_CONFIG = ${projectText};\n`;
    const enc=new TextEncoder(),chapters=projectChapterNumbers(exportProject);
    const files=[...createChapterFolderEntries(chapters,enc),{name:'prince-stage-project.json',bytes:enc.encode(projectText)},{name:'js/prince-stage-config.js',bytes:enc.encode(source)}];
    files.push({name:'IMAGE_FOLDER_GUIDE.txt',bytes:enc.encode('Stage Editor 圖片資料夾規則\n\n背景圖片：images/chapterN/backgrounds/\n固定平台、移動平台及 Hazard 外觀：images/chapterN/bg/\n敵人圖片：images/chapterN/enemies/\n\nN 是 Stage ID 中的章節號，例如 chapter5_stage1 對應 images/chapter5/。\n匯出 JS 只包含相對路徑；本 ZIP 會建立每章的 backgrounds、bg、enemies 資料夾並放入已登錄圖片。\n')});
    const missing=[],written=new Set(files.map(f=>f.name));
    for(const asset of state.project.assetLibrary||[]){
      if(!asset?.path||written.has(asset.path))continue;
      const legacyPath=state.legacyAssetPaths.get(asset.path);
      const data=state.assetData.get(asset.path)||state.assetData.get(legacyPath)||asset.dataUrl;
      if(data){files.push({name:asset.path,bytes:dataUriToBytes(data)});written.add(asset.path);continue;}
      let assetBytes=null;
      for(const candidate of [asset.path,legacyPath].filter(Boolean)){
        try{const response=await fetch(candidate);if(response.ok){assetBytes=new Uint8Array(await response.arrayBuffer());break;}}catch(_){}
      }
      if(assetBytes){files.push({name:asset.path,bytes:assetBytes});written.add(asset.path);}
      else{missing.push(`${asset.name||asset.path} -> ${asset.path}`);}
    }
    if(missing.length){files.push({name:'MISSING_ASSETS.txt',bytes:enc.encode('以下圖片檔案未能從目前瀏覽器取得。請確認來源檔案存在，或在 Stage Editor 素材庫使用「補載／替換」：\n\n'+missing.join('\n'))});}
    const zip=zipStore(files);download('prince-stage-project-package.zip',new Blob([zip],{type:'application/zip'}),'application/zip');
    toast(`資源 ZIP 已匯出：${chapters.map(n=>`Chapter ${n}`).join('、')} 資料夾已建立；${written.size} 個路徑已打包${missing.length?`；另有 ${missing.length} 個素材未能取得`:''}。`);
  }
  function assetDb(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window)){reject(new Error('IndexedDB unavailable'));return;}const req=indexedDB.open('PrinceStageEditorAssets',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('assets'))req.result.createObjectStore('assets',{keyPath:'path'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function persistAssetBytes(){const db=await assetDb();await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite'),store=tx.objectStore('assets');for(const [path,dataUrl] of state.assetData)store.put({path,dataUrl});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}
  async function restoreAssetBytes(){try{const db=await assetDb();const rows=await new Promise((resolve,reject)=>{const req=db.transaction('assets','readonly').objectStore('assets').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});db.close();rows.forEach(row=>state.assetData.set(row.path,row.dataUrl));}catch(_){}}
  async function saveLocal(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.project));await persistAssetBytes();toast('Stage 草稿及圖片素材已儲存在此瀏覽器。');status('草稿及圖片素材已保存到本機瀏覽器。');}catch(e){toast('草稿已嘗試保存；圖片資料庫不可用，建議另外匯出資源 ZIP。');}}
  async function loadLocal(){try{const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!data?.stages?.length)throw new Error('empty');remember();state.assetData.clear();state.legacyAssetPaths.clear();state.project=normalizeProject(data);await restoreAssetBytes();state.selected=null;imageCache.clear();renderStageSelect();renderObjectList();renderAssetLibrary();renderInspector();loadBackground(currentStage().background);toast('已載入本機 Stage 草稿及圖片素材。');}catch(e){toast('找不到可載入的 Stage 草稿。');}}
  function importJSON(file){const reader=new FileReader();reader.onload=async()=>{try{const data=JSON.parse(reader.result);if(!data||!Array.isArray(data.stages)||!data.stages.length)throw new Error('bad schema');remember();state.assetData.clear();state.legacyAssetPaths.clear();state.project=normalizeProject(data);await restoreAssetBytes();state.project.currentStageId ||= data.stages[0].id;state.selected=null;imageCache.clear();renderStageSelect();renderObjectList();renderAssetLibrary();renderInspector();loadBackground(currentStage().background);toast('JSON 工程已匯入；已嘗試從本機素材庫恢復圖片。');}catch(e){toast('JSON 格式不正確，匯入失敗。');}};reader.readAsText(file);}
  function createTargetStageFromExit(exit,backgroundPath){
    remember();const source=currentStage(),chapter=chapterNumber(source),prefix=`chapter${chapter}_stage`;
    const used=(state.project.stages||[]).map(s=>Number(String(s.id||'').match(new RegExp(`^${prefix}(\\d+)$`,'i'))?.[1]||0));
    let n=Math.max(0,...used)+1,id=`${prefix}${n}`;while(state.project.stages.some(s=>s.id===id)){n++;id=`${prefix}${n}`;}
    const stage={id,name:`Chapter ${chapter} · Stage ${n}`,background:backgroundPath,width:source.backgroundWidth||1774,height:source.backgroundHeight||1774,backgroundWidth:source.backgroundWidth||1774,backgroundHeight:source.backgroundHeight||1774,worldWidth:source.backgroundWidth||1774,worldWidthManual:false,playerStart:null,platforms:[],enemies:[],exits:[],transitions:[{id:'transition_1',label:'TP1',x:160,y:(source.backgroundHeight||1774)-180,facing:'right'}],checkpoints:[],hazards:[],traps:[],teleports:[],waves:[]};
    state.project.stages.push(stage);exit.targetStageId=id;exit.targetTransitionId='transition_1';renderStageSelect();renderObjectList();renderInspector();render();toast(`已新增 ${stage.name}，背景路徑：${backgroundPath}；已自動連接 TP1。`);
  }
  function deleteSelected(){const ref=state.selected;if(!ref)return;remember();const s=currentStage();if(ref.type==='platform')s.platforms=s.platforms.filter(x=>x.id!==ref.id);else if(ref.type==='enemy')s.enemies=(s.enemies||[]).filter(x=>x.id!==ref.id);else if(ref.type==='exit')s.exits=s.exits.filter(x=>x.id!==ref.id);else if(ref.type==='transition')s.transitions=s.transitions.filter(x=>x.id!==ref.id);else if(['checkpoint','hazard','trap','teleport','wave'].includes(ref.type)){const key=ref.type==='wave'?'waves':ref.type==='checkpoint'?'checkpoints':ref.type==='hazard'?'hazards':ref.type==='trap'?'traps':'teleports';s[key]=(s[key]||[]).filter(x=>x.id!==ref.id);}else if(ref.type==='start')s.playerStart=null;selectObject(null);toast('已刪除選取物件。');}
  function duplicateSelected(){const ref=state.selected,o=findObject(ref);if(!o||ref.type!=='platform')return;remember();const s=currentStage(),copy=clone(o);copy.id=uid('platform',s.platforms);copy.label=nextPlatformLabel(s);copy.x1+=35;copy.x2+=35;copy.y-=24;if(copy.loop){copy.loop.from.x+=35;copy.loop.to.x+=35;copy.loop.from.y-=24;copy.loop.to.y-=24;}s.platforms.push(copy);selectObject('platform',copy.id);toast('平台已複製。');}
  function slugify(value){return String(value||'platform').replace(/\.[^.]+$/,'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,42)||'platform';}
  function dataUriToBytes(uri){const comma=uri.indexOf(',');const meta=uri.slice(0,comma),body=uri.slice(comma+1);if(meta.includes(';base64')){const raw=atob(body),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}return new TextEncoder().encode(decodeURIComponent(body));}
  function readAsDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error||new Error('read failed'));r.readAsDataURL(file);});}
  async function addPlatformAsset(file,category){
    if(!file)return;if(!/^image\/(png|webp|jpeg)$/.test(file.type)){toast('請選擇 PNG、WebP 或 JPG 圖片。');return;}
    try{const dataUrl=await readAsDataUrl(file);remember();const ext=file.type==='image/webp'?'webp':file.type==='image/jpeg'?'jpg':'png';const base=slugify(file.name);const id=uid('asset',state.project.assetLibrary||[]);const path=chapterAssetPath(category,`${id}_${base}.${ext}`,chapterNumber());
      const item={id,name:file.name,path,category,mime:file.type};state.project.assetLibrary||=[];state.project.assetLibrary.push(item);state.assetData.set(path,dataUrl);imageCache.delete(path);getImage(path);
      const ref=state.selected,o=findObject(ref);if(ref?.type==='platform'&&o&&o.kind===category){o.imageAssetId=id;o.imageSrc=path;}
      renderObjectList();renderInspector();render();toast(`已加入${category==='moving'?'移動':'固定'}平台圖片庫，圖片保持原始比例。`);
    }catch(error){toast('圖片讀取失敗，請換一張圖片再試。');}
  }
  async function addHazardAnimationAssets(fileList){
    const files=Array.from(fileList||[]).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));if(!files.length)return;
    if(files.length!==4){toast(`Hazard 動畫必須一次選取 4 張圖片；你目前選取了 ${files.length} 張。`);return;}
    if(files.some(file=>!/^image\/(png|webp|jpeg)$/.test(file.type))){toast('四張圖片都必須是 PNG、WebP 或 JPG。');return;}
    try{
      const dataUrls=[];for(const file of files)dataUrls.push(await readAsDataUrl(file));
      remember();state.project.assetLibrary||=[];
      const ids=[],paths=[];
      files.forEach((file,index)=>{
        const ext=file.type==='image/webp'?'webp':file.type==='image/jpeg'?'jpg':'png';
        const base=slugify(file.name);const id=uid('asset',state.project.assetLibrary);const path=chapterAssetPath('hazard',`${id}_frame${index+1}_${base}.${ext}`,chapterNumber());
        state.project.assetLibrary.push({id,name:`Hazard 幀 ${index+1} · ${file.name}`,path,category:'hazard',mime:file.type,animationFrame:index+1});
        state.assetData.set(path,dataUrls[index]);imageCache.delete(path);getImage(path);ids.push(id);paths.push(path);
      });
      const ref=state.selected,o=findObject(ref);
      if(ref?.type==='hazard'&&o){o.hazardImageAssetIds=ids;o.imageFrames=paths;o.hazardImageAssetId=ids[0];o.imageSrc=paths[0];o.animationFrameMs=clamp(o.animationFrameMs??120,50,1000);}
      renderAssetLibrary();renderObjectList();renderInspector();render();
      toast(ref?.type==='hazard'?'4 張 Hazard 動畫圖片已上載並套用，按選取順序循環播放。':'4 張 Hazard 圖片已加入本章素材庫；選取 Hazard 後可逐格套用。');
    }catch(error){console.error(error);toast('Hazard 動畫圖片讀取失敗，請確認四張圖片格式及檔案。');}
  }
  async function replaceImageAsset(assetId,file){
    const asset=(state.project.assetLibrary||[]).find(a=>a.id===assetId);if(!asset||!file)return;
    if(!/^image\/(png|webp|jpeg)$/.test(file.type)){toast('請選擇 PNG、WebP 或 JPG 圖片。');return;}
    try{const dataUrl=await readAsDataUrl(file);remember();state.assetData.set(asset.path,dataUrl);asset.name=file.name;asset.mime=file.type;imageCache.delete(asset.path);getImage(asset.path);renderAssetLibrary();renderInspector();render();toast(`已更新素材：${asset.name}。物件位置及傷害／碰撞設定不變。`);}catch(_){toast('圖片更新失敗，請再試一次。');}
  }
  function normalizeProject(data){
    data.schemaVersion=11;
    data.assetLibrary=Array.isArray(data.assetLibrary)?data.assetLibrary:[];
    data.assetLibrary.forEach(asset=>{if(asset?.path&&typeof asset.dataUrl==='string'&&asset.dataUrl.startsWith('data:'))state.assetData.set(asset.path,asset.dataUrl);delete asset.dataUrl;});
    data.stages.forEach(stage=>{
      stage.backgroundWidth??=Number(stage.width)||1774;
      stage.backgroundHeight??=Number(stage.height)||1774;
      const oldWidth=Number(stage.worldWidth||stage.width)||stage.backgroundWidth;
      if(typeof stage.worldWidthManual!=='boolean'){
        const ratio=oldWidth/Math.max(1,stage.backgroundWidth);
        const looksLikeLegacyAutoThree=ratio>=2.5&&ratio<=3.2;
        stage.worldWidthManual=ratio>1.05&&!looksLikeLegacyAutoThree;
      }
      stage.worldWidth=stage.worldWidthManual?Math.max(stage.backgroundWidth,oldWidth):stage.backgroundWidth;
      stage.width=stage.worldWidth;
      stage.height=stage.backgroundHeight;
      stage.platforms=Array.isArray(stage.platforms)?stage.platforms:[];
      stage.enemies=Array.isArray(stage.enemies)?stage.enemies:[];
      stage.exits=Array.isArray(stage.exits)?stage.exits:[];
      stage.transitions=Array.isArray(stage.transitions)?stage.transitions:[];
      stage.checkpoints=Array.isArray(stage.checkpoints)?stage.checkpoints:[];stage.hazards=Array.isArray(stage.hazards)?stage.hazards:[];stage.traps=Array.isArray(stage.traps)?stage.traps:[];stage.teleports=Array.isArray(stage.teleports)?stage.teleports:[];stage.waves=Array.isArray(stage.waves)?stage.waves:[];
      stage.hazards.forEach(hazard=>{
        hazard.imageScale??=100;hazard.imageOpacity??=100;hazard.imageOffsetX??=0;hazard.imageOffsetY??=0;hazard.imageRotation??=0;hazard.animationFrameMs=clamp(hazard.animationFrameMs??120,50,1000);hazard.hazardImageAssetId??='';
        hazard.hazardImageAssetIds=Array.isArray(hazard.hazardImageAssetIds)?hazard.hazardImageAssetIds.slice(0,4):[];
        hazard.imageFrames=Array.isArray(hazard.imageFrames)?hazard.imageFrames.slice(0,4):[];
        if(typeof hazard.imageSrc==='string'&&hazard.imageSrc.startsWith('data:')){
          const ext=hazard.imageSrc.startsWith('data:image/webp')?'webp':hazard.imageSrc.startsWith('data:image/jpeg')?'jpg':'png';
          const id=uid('asset',data.assetLibrary),path=chapterAssetPath('hazard',`${id}_legacy.${ext}`,chapterNumber(stage));
          data.assetLibrary.push({id,name:`舊 Hazard 圖片 ${id}`,path,category:'hazard',mime:`image/${ext==='jpg'?'jpeg':ext}`});
          state.assetData.set(path,hazard.imageSrc);hazard.hazardImageAssetId=id;hazard.imageSrc=path;
        }
        if(!hazard.hazardImageAssetId&&hazard.imageSrc){const asset=data.assetLibrary.find(a=>a.path===hazard.imageSrc&&a.category==='hazard');if(asset)hazard.hazardImageAssetId=asset.id;}
        if(!hazard.hazardImageAssetIds[0])hazard.hazardImageAssetIds[0]=hazard.hazardImageAssetId||'';
        if(!hazard.imageFrames[0])hazard.imageFrames[0]=hazard.imageSrc||'';
        while(hazard.hazardImageAssetIds.length<4)hazard.hazardImageAssetIds.push('');
        while(hazard.imageFrames.length<4)hazard.imageFrames.push('');
        hazard.hazardImageAssetId=hazard.hazardImageAssetIds[0]||'';hazard.imageSrc=hazard.imageFrames[0]||'';
        // Convert imported data URLs in any additional animation frame into ordinary chapter asset paths.
        hazard.imageFrames=hazard.imageFrames.map((frame,index)=>{
          if(typeof frame!=='string'||!frame.startsWith('data:'))return frame||'';
          const ext=frame.startsWith('data:image/webp')?'webp':frame.startsWith('data:image/jpeg')?'jpg':'png';
          const id=uid('asset',data.assetLibrary),path=chapterAssetPath('hazard',`${id}_frame${index+1}.${ext}`,chapterNumber(stage));
          data.assetLibrary.push({id,name:`Hazard 動畫幀 ${index+1}`,path,category:'hazard',mime:`image/${ext==='jpg'?'jpeg':ext}`});state.assetData.set(path,frame);hazard.hazardImageAssetIds[index]=id;return path;
        });
        hazard.imageSrc=hazard.imageFrames[0]||'';hazard.hazardImageAssetId=hazard.hazardImageAssetIds[0]||'';
      });

      if(typeof stage.background==='string'&&stage.background.startsWith('data:')){
        const ext=stage.background.startsWith('data:image/webp')?'webp':stage.background.startsWith('data:image/jpeg')?'jpg':'png';
        const id=uid('asset',data.assetLibrary),path=chapterAssetPath('background',`${id}_background.${ext}`,chapterNumber(stage));
        state.assetData.set(path,stage.background);
        data.assetLibrary.push({id,name:`${stage.name||stage.id} 背景`,path,category:'background',mime:`image/${ext==='jpg'?'jpeg':ext}`});
        stage.background=path;
      }
      stage.platforms.forEach(platform=>{
        platform.standLine??=null;
        if(platform.standLine){
          const vals=['x1','y1','x2','y2'].map(k=>Number(platform.standLine[k]));
          platform.standLine=vals.every(Number.isFinite)?{x1:clamp(vals[0],0,1),y1:clamp(vals[1],0,1),x2:clamp(vals[2],0,1),y2:clamp(vals[3],0,1)}:null;
        }
        platform.imageScale??=100;platform.imageOffsetX??=0;platform.imageOffsetY??=0;platform.imageRotation??=0;platform.imageOpacity??=100;platform.imageAssetId??='';
        if(typeof platform.imageSrc==='string'&&platform.imageSrc.startsWith('data:')){
          const ext=platform.imageSrc.startsWith('data:image/webp')?'webp':platform.imageSrc.startsWith('data:image/jpeg')?'jpg':'png';
          const id=uid('asset',data.assetLibrary),path=chapterAssetPath(platform.kind==='moving'?'moving':'fixed',`${id}_legacy.${ext}`,chapterNumber(stage));
          data.assetLibrary.push({id,name:`舊平台圖片 ${id}`,path,category:platform.kind==='moving'?'moving':'fixed',mime:`image/${ext==='jpg'?'jpeg':ext}`});
          state.assetData.set(path,platform.imageSrc);platform.imageAssetId=id;platform.imageSrc=path;
        }
        if(!platform.imageAssetId&&platform.imageSrc){const asset=data.assetLibrary.find(a=>a.path===platform.imageSrc);if(asset)platform.imageAssetId=asset.id;}
      });
      stage.enemies.forEach((enemy,index)=>{
        enemy.id ||= uid('enemy',stage.enemies);enemy.label ||= `E${index+1}`;
        enemy.type=ENEMY_TYPES[enemy.type]?enemy.type:'chapter4_enemy_1';if(!enemy.spriteRoot||(enemy.type!=='chapter4_enemy_1'&&enemy.spriteRoot==='images/chapter4/enemies/chapter4_enemy_1/chapter4_enemy_1_'))enemy.spriteRoot=ENEMY_TYPES[enemy.type].root;if(!enemy.projectilePath||(enemy.type!=='chapter4_enemy_1'&&enemy.projectilePath==='images/chapter4/enemies/chapter4_enemy_1/chapter4_enemy_1_projectile.webp'))enemy.projectilePath=ENEMY_TYPES[enemy.type].projectile;
        enemy.width??=Number(enemy.size)||100;enemy.height??=Number(enemy.size)||100;enemy.size??=Math.round((Number(enemy.width)+Number(enemy.height))/2)||100;
        enemy.facing ||= 'left';enemy.platformId ||= '';
        enemy.patrol ||= {points:[],speed:70,pauseSeconds:.5,mode:'pingpong'};
        enemy.patrol.points=Array.isArray(enemy.patrol.points)?enemy.patrol.points:[];
        enemy.patrol.points=enemy.patrol.points.map(point=>({u:clamp(point.u,0,1)}));
        enemy.patrol.speed=clamp(enemy.patrol.speed??70,1,500);
        enemy.patrol.pauseSeconds=clamp(enemy.patrol.pauseSeconds??.5,0,10);
        enemy.patrol.mode=enemy.patrol.mode==='loop'?'loop':'pingpong';
        enemy.ai ||= {};enemy.ai.aiType ||= registryRecord(enemy.type)?.aiType||'chase';enemy.ai.attackMode??=null;enemy.ai.movementSpeed??=Number(registryRecord(enemy.type)?.movementSpeed)||150;enemy.ai.keepDistance??=Number(registryRecord(enemy.type)?.attackRange)||190;
        enemy.ai.alertRange=clamp(enemy.ai.alertRange??430,50,2000);
        enemy.ai.attackRange=clamp(enemy.ai.attackRange??230,50,1200);
        enemy.ai.attackCooldownMs=clamp(enemy.ai.attackCooldownMs??1450,250,10000);
        enemy.ai.damage=clamp(enemy.ai.damage??1,1,100);
        enemy.ai.attackPoseMs=clamp(enemy.ai.attackPoseMs??420,150,3000);enemy.ai.movementSpeed=clamp(enemy.ai.movementSpeed??150,1,800);enemy.ai.keepDistance=clamp(enemy.ai.keepDistance??enemy.ai.attackRange??190,30,1200);
      });
    });
    normalizeAssetFolders(data);
    return data;
  }
  function setPreview(enabled){state.preview=enabled;$('togglePreview').textContent=enabled?'返回編輯模式':'遊戲預覽';setTool(enabled?'select':state.currentTool);render();status(enabled?'預覽模式：顯示平台圖片，編輯線與編號已隱藏。':'編輯模式：可繼續調整平台和標記。');}

  document.querySelectorAll('.se-tool').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.tool)));
  $('stageCanvas').addEventListener('pointerdown',pointerDown);
  $('stageCanvas').addEventListener('pointermove',pointerMove);
  $('stageCanvas').addEventListener('pointerup',pointerUp);
  $('stageCanvas').addEventListener('pointercancel',pointerUp);
  $('stageCanvas').addEventListener('pointerleave',()=>{});
  $('stageCanvas').addEventListener('contextmenu',e=>e.preventDefault());
  $('objectList').addEventListener('click',e=>{const b=e.target.closest('[data-select-type]');if(b)selectObject(b.dataset.selectType,b.dataset.selectId);});
  $('inspector').addEventListener('input',e=>{const ref=state.selected;if(ref?.type==='wave'&&e.target.dataset.waveEntry!==undefined){const w=findObject(ref),i=Number(e.target.dataset.waveEntry),entry=w?.entries?.[i];if(!entry)return;if(!state.inspectorEditing){remember();state.inspectorEditing=true;}const k=e.target.dataset.waveField;entry[k]=['count','x','y','spacing'].includes(k)?Number(e.target.value):e.target.value;renderObjectList();render();return;}const key=e.target.dataset.field;if(!key)return;if(!state.inspectorEditing){remember();state.inspectorEditing=true;}const value=e.target.type==='checkbox'?e.target.checked:(e.target.type==='number'?Number(e.target.value):e.target.value);setSelectedField(key,value);renderObjectList();render();});
  $('inspector').addEventListener('change',e=>{const ref=state.selected;if(ref?.type==='wave'&&e.target.dataset.waveEntry!==undefined){const w=findObject(ref),i=Number(e.target.dataset.waveEntry),entry=w?.entries?.[i];if(!entry)return;state.inspectorEditing=false;const k=e.target.dataset.waveField;entry[k]=['count','x','y','spacing'].includes(k)?Number(e.target.value):e.target.value;renderInspector();renderObjectList();render();return;}const key=e.target.dataset.field;if(!key)return;if(!state.inspectorEditing)remember();state.inspectorEditing=false;const value=e.target.type==='checkbox'?e.target.checked:(e.target.type==='number'?Number(e.target.value):e.target.value);setSelectedField(key,value);renderInspector();renderObjectList();render();});
  $('inspector').addEventListener('click',e=>{const action=e.target.dataset.action;if(action==='delete-object')deleteSelected();if(action==='duplicate-object')duplicateSelected();if(action==='draw-standline'){if(state.selected?.type!=='platform'){toast('請先選取平台。');return;}setTool('standline');status('請在平台圖片上按住並拖曳，畫出角色真正站立的紅線。');}if(action==='clear-standline'){const o=findObject(state.selected);if(o){remember();o.standLine=null;renderInspector();render();toast('已重設為平台原本頂線。');}}if(action==='clear-image'){const o=findObject(state.selected);if(o){remember();o.imageSrc='';o.imageAssetId='';renderInspector();render();toast('已移除平台圖片，改用預設石台外觀。');}}if(action==='clear-hazard-image'){const o=findObject(state.selected);if(state.selected?.type==='hazard'&&o){remember();o.imageSrc='';o.hazardImageAssetId='';o.hazardImageAssetIds=['','','',''];o.imageFrames=['','','',''];renderInspector();render();toast('已移除 Hazard 動畫圖片；傷害判定保留。');}}if(action==='upload-hazard-image')$('uploadHazardAsset')?.click();
    if(action==='add-wave-entry'){const w=findObject(state.selected);if(w?.entries){remember();const first=Object.keys(ENEMY_TYPES)[0]||'chapter4_enemy_1';w.entries.push({enemyId:first,count:1,platformId:currentStage().platforms[0]?.id||'',x:320,y:900,spacing:55});renderInspector();renderObjectList();render();}return;}
    if(action==='remove-wave-entry'){const w=findObject(state.selected),index=Number(e.target.dataset.index);if(w?.entries&&w.entries.length>1){remember();w.entries.splice(index,1);renderInspector();renderObjectList();render();}return;}
    if(action==='finish-enemy-route'){setTool('select');toast('敵人行走路線已完成。');}
    if(action==='remove-enemy-route-point'){const o=findObject(state.selected);if(o?.patrol?.points?.length){remember();o.patrol.points.pop();renderInspector();render();}}
    if(action==='clear-enemy-route'){const o=findObject(state.selected);if(o){remember();o.patrol.points=[];renderInspector();render();toast('已清空敵人行走路線。');}}
    if(action==='create-target-stage'){const exit=findObject(state.selected);if(!exit||state.selected?.type!=='exit')return;createTargetStageFromExit(exit,$('newTargetBackground')?.value?.trim()||`${chapterRoot(chapterNumber())}/backgrounds/bg2.webp`);}
  });
  $('uploadFixedAsset').addEventListener('change',e=>{addPlatformAsset(e.target.files?.[0],'fixed');e.target.value='';});
  $('uploadMovingAsset').addEventListener('change',e=>{addPlatformAsset(e.target.files?.[0],'moving');e.target.value='';});
  $('uploadHazardAsset')?.addEventListener('change',e=>{addHazardAnimationAssets(e.target.files);e.target.value='';});
  for(const listId of ['platformAssetList','hazardAssetList']){
    $(listId)?.addEventListener('click',e=>{
      const reload=e.target.closest('[data-asset-reload]');if(reload){const id=reload.dataset.assetReload;$(listId).querySelector(`[data-asset-file="${id}"]`)?.click();return;}
      const preview=e.target.closest('[data-asset-preview]');if(preview){const a=state.project.assetLibrary.find(x=>x.id===preview.dataset.assetPreview);if(a){const img=getImage(a.path);if(img?.complete&&img.naturalWidth)toast(`${a.name}：${img.naturalWidth} × ${img.naturalHeight}`);else toast(`素材路徑：${a.path}`);}return;}
      const remove=e.target.closest('[data-asset-remove]');if(remove){const a=state.project.assetLibrary.find(x=>x.id===remove.dataset.assetRemove);if(!a)return;if(!confirm(`從圖片庫移除「${a.name}」？已套用到物件的圖片也會一併移除。`))return;remember();state.project.assetLibrary=state.project.assetLibrary.filter(x=>x.id!==a.id);state.project.stages.forEach(st=>{(st.platforms||[]).forEach(p=>{if(p.imageAssetId===a.id){p.imageAssetId='';p.imageSrc='';}});(st.hazards||[]).forEach(h=>{if(Array.isArray(h.hazardImageAssetIds)){h.hazardImageAssetIds=h.hazardImageAssetIds.map(id=>id===a.id?'':id);}if(Array.isArray(h.imageFrames)){h.imageFrames=h.imageFrames.map(path=>path===a.path?'':path);}if(h.hazardImageAssetId===a.id){h.hazardImageAssetId='';h.imageSrc='';}if(h.imageSrc===a.path)h.imageSrc='';});});imageCache.delete(a.path);renderObjectList();renderInspector();render();toast('素材已從圖片庫移除。');}
    });
    $(listId)?.addEventListener('change',e=>{const input=e.target.closest('[data-asset-file]');if(input){replaceImageAsset(input.dataset.assetFile,input.files?.[0]);input.value='';}});
  }
  function updateEnemyLibraryPreview(){const type=$('enemyTypeSelect')?.value||'chapter4_enemy_1';const def=ENEMY_TYPES[type]||ENEMY_TYPES.chapter4_enemy_1;const img=$('enemyLibraryPreview');const src=enemySpritePath(type,'normal');if(img){img.alt=type;img.onerror=()=>{img.alt=`${type}（normal 圖片載入失敗）`;};if(src?.startsWith('asset://'))window.PrinceEnemyRegistryV2?.resolveSource?.(src).then(url=>{img.src=url;}).catch(()=>{img.alt=`${type}（素材不存在）`;});else img.src=src;}const title=$('enemyLibraryTitle');const record=registryRecord(type);if(title)title.textContent=record?.name||`Chapter ${def.chapter||4} ${type.replace(/^chapter\d+_enemy_/,'Enemy ')}`;}
  $('enemyTypeSelect').addEventListener('change',updateEnemyLibraryPreview);
  window.addEventListener('storage',event=>{if(event.key==='prince-game.enemy-registry.v2'){syncEnemyTypesFromRegistry();updateEnemyLibraryPreview();renderObjectList();renderInspector();render();toast('Enemy Registry V2 已更新。');}});
  $('stageSelect').addEventListener('change',e=>switchStage(e.target.value));
  $('addStage').addEventListener('click',createStage);
  $('addChapter')?.addEventListener('click',createChapter);
  $('renameStage').addEventListener('click',()=>{$('stageName').focus();$('stageName').select();toast('修改右側 Stage 名稱欄位後按 Enter 或離開欄位即可套用。');});
  $('addWaveBtn')?.addEventListener('click',addWave);
  $('stageId').addEventListener('change',e=>{const s=currentStage(),next=e.target.value.trim().replace(/[^a-zA-Z0-9_-]/g,'_');if(!next){e.target.value=s.id;return;}if(state.project.stages.some(x=>x!==s&&x.id===next)){toast('Stage ID 已存在，請使用另一個 ID。');e.target.value=s.id;return;}const oldChapter=chapterNumber(s),newChapter=Number(next.match(/^chapter(\d+)_stage/i)?.[1]||oldChapter);if(newChapter!==oldChapter){toast('不可直接修改 Stage 的 Chapter 編號，以免圖片路徑錯章。請使用「新增 Chapter」建立新章節。');e.target.value=s.id;return;}remember();const old=s.id;s.id=next;state.project.stages.forEach(st=>st.exits.forEach(ex=>{if(ex.targetStageId===old)ex.targetStageId=next;}));state.project.currentStageId=next;renderStageSelect();renderObjectList();renderAssetLibrary();renderInspector();});
  $('stageName').addEventListener('change',e=>{remember();currentStage().name=e.target.value.trim()||currentStage().id;renderStageSelect();updateCounters();});
  $('loadBackgroundPath').addEventListener('click',()=>{remember();loadBackground($('backgroundPath').value.trim()||DEFAULT_BG);renderStageSelect();renderInspector();});
  $('applyWorldWidth').addEventListener('click',()=>applyWorldWidth(Number($('worldWidthInput').value)||currentStage().width));
  $('backgroundFile').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;readAsDataUrl(file).then(dataUrl=>{remember();const ext=file.type==='image/webp'?'webp':file.type==='image/jpeg'?'jpg':'png',id=uid('asset',state.project.assetLibrary),path=chapterAssetPath('background',`${id}_${slugify(file.name)}.${ext}`,chapterNumber());state.project.assetLibrary.push({id,name:file.name,path,category:'background',mime:file.type});state.assetData.set(path,dataUrl);imageCache.delete(path);loadBackground(path);renderStageSelect();renderInspector();toast('背景已作為外部圖片路徑加入素材庫；JS 只保存路徑。');}).catch(()=>toast('背景圖片讀取失敗。'));e.target.value='';});
  $('showCollision').addEventListener('change',e=>{state.showCollision=e.target.checked;render();});
  $('showLabels').addEventListener('change',e=>{state.showLabels=e.target.checked;render();});
  $('showBackground').addEventListener('change',e=>{state.showBackground=e.target.checked;render();});
  $('zoomIn').addEventListener('click',()=>{state.zoom=Math.min(2.5,state.zoom*1.15);updateZoom();});
  $('zoomOut').addEventListener('click',()=>{state.zoom=Math.max(.1,state.zoom/1.15);updateZoom();});
  $('fitCanvas').addEventListener('click',()=>{state.zoom=state.fitZoom;updateZoom();});
  $('togglePreview').addEventListener('click',()=>setPreview(!state.preview));
  $('toggleMotion').addEventListener('click',()=>{state.motionPlaying=!state.motionPlaying;$('toggleMotion').textContent=state.motionPlaying?'Ⅱ 停止移動':'▶ 播放移動';if(!state.motionPlaying)state.motionTime=0;render();});
  $('undo').addEventListener('click',()=>{const prev=history.pop();if(!prev){toast('沒有可復原的操作。');return;}state.project=prev;state.selected=null;renderStageSelect();renderObjectList();renderAssetLibrary();renderInspector();loadBackground(currentStage().background);toast('已復原上一個動作。');});
  $('deleteSelected').addEventListener('click',deleteSelected);
  $('testChapter4').addEventListener('click',()=>{
    const url='chapter4_stage_test.html?from=stage-editor';
    const child=window.open(url,'_blank');
    if(!child){toast('瀏覽器封鎖了新視窗，請允許此頁開啟測試頁。');return;}
    toast(`正在開啟 ${currentStage().name} 測試頁……`);
  });
  // The separate Chapter 4 test page requests the editor's latest in-memory project,
  // so unsaved platform edits are included without requiring an export/import step.
  window.addEventListener('message',event=>{
    if(event.data?.type!=='PRINCE_STAGE_TEST_REQUEST'||!event.source)return;
    try{event.source.postMessage({type:'PRINCE_STAGE_TEST_PROJECT',project:clone(state.project),stageId:currentStage().id,assetData:Object.fromEntries(state.assetData)},'*');}
    catch(error){toast('無法將 Stage 工程傳送到測試頁。');}
  });

  $('stageMusicSelect')?.addEventListener('change',e=>{remember();const s=currentStage();s.music=e.target.value||'';renderStageSelect();toast(s.music?'已設定此 Stage 專屬音樂。':'已改為沿用 Audio Manager／原版音樂。');});
  $('stageMusicVolume')?.addEventListener('change',e=>{remember();currentStage().musicVolume=clamp(e.target.value,0,1);toast('Stage 音樂音量已更新。');});
  $('stageMusicLoop')?.addEventListener('change',e=>{remember();currentStage().musicLoop=e.target.checked;toast('Stage 音樂循環設定已更新。');});

  $('saveProject').addEventListener('click',saveLocal);
  $('loadDraft').addEventListener('click',loadLocal);
  $('exportJs').addEventListener('click',exportJS);
  $('exportJson').addEventListener('click',exportJSON);
  $('exportPackage').addEventListener('click',exportPackage);
  $('importJson').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importJSON(file);e.target.value='';});
  $('clearStage').addEventListener('click',()=>{if(!confirm('確定清空目前 Stage 的所有平台、敵人、出口、轉場點和角色開始點？'))return;remember();const s=currentStage();s.platforms=[];s.enemies=[];s.exits=[];s.transitions=[];s.checkpoints=[];s.hazards=[];s.traps=[];s.teleports=[];s.waves=[];s.playerStart=null;selectObject(null);toast('目前 Stage 物件已清空。');});
  window.addEventListener('resize',()=>{updateZoom();});
  window.addEventListener('storage',e=>{if(e.key===window.PrinceAudioRuntime?.STORAGE_KEY)renderStageSelect();});
  window.addEventListener('prince:audio-config-updated',()=>renderStageSelect());

  function animationFrame(timestamp){
    const hasHazardAnimation=(currentStage().hazards||[]).some(h=>(h.imageFrames||[]).filter(Boolean).length>1);
    if(state.motionPlaying){if(state.lastFrame)state.motionTime+=Math.min(50,timestamp-state.lastFrame);state.lastFrame=timestamp;}else state.lastFrame=0;
    if(state.motionPlaying||hasHazardAnimation)render();
    requestAnimationFrame(animationFrame);
  }
  function init(){
    state.project = normalizeProject(state.project);
    state.project.assetLibrary ||= [];
    renderStageSelect();renderObjectList();renderAssetLibrary();renderInspector();loadBackground(currentStage().background);updateEnemyLibraryPreview();setTool('select');
    requestAnimationFrame(()=>{state.zoom=-1;updateZoom();});
    requestAnimationFrame(animationFrame);
    if (bundledProject) status(`已載入內建第四章工程：${state.project.stages.length} 個 Stage，現正編輯 ${currentStage().name || currentStage().id}。`);
  }
  init();
})();
