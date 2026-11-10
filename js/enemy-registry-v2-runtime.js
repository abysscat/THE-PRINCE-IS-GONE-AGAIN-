/* Read-only bridge between Enemy Library V2 and Stage Editor canvas previews.
 * This intentionally does not replace the production enemy AI/combat runtime.
 */
(() => {
  'use strict';
  const STORAGE_KEY = 'prince-game.enemy-registry.v2';
  const DB_NAME = 'prince-game-enemy-assets-v2';
  const DB_STORE = 'assets';
  let dbPromise;
  const objectUrls = new Map();
  function list() {
    const candidates=[];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const data = JSON.parse(raw); if (Array.isArray(data.enemies)) candidates.push(data.enemies); }
    } catch (error) { console.warn('Enemy Registry V2 could not be read:', error); }
    candidates.push(window.PRINCE_ENEMY_REGISTRY_V2?.enemies,window.PRINCE_ENEMY_REGISTRY?.enemies,window.PRINCE_ENEMY_REGISTRY_SEED,window.PRINCE_BOSS_CONFIG?.bosses);
    const merged=new Map();
    candidates.filter(Array.isArray).forEach(rows=>rows.forEach(record=>{if(record?.id&&!merged.has(record.id))merged.set(record.id,record);}));
    return [...merged.values()];
  }
  function get(id) { return list().find(record => record.id === id) || null; }
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB unavailable')); return; }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => { const db=request.result; if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE,{keyPath:'id'}); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open enemy asset database'));
    });
    return dbPromise;
  }
  async function loadAsset(id) {
    const db=await openDB();
    const row=await new Promise((resolve,reject)=>{const req=db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});
    if(!row?.blob)throw new Error(`Enemy asset missing: ${id}`);
    return row.blob;
  }
  async function resolveSource(source) {
    if(!source)return '';
    if(!source.startsWith('asset://'))return source;
    const id=source.slice(8);if(objectUrls.has(id))return objectUrls.get(id);
    const blob=await loadAsset(id),url=URL.createObjectURL(blob);objectUrls.set(id,url);return url;
  }
  function animationFor(id, pose='normal') {
    const record=get(id);if(!record)return null;
    const animations=record.animations||{};
    const requested=String(pose||'normal');
    const normalized=requested.startsWith('walk')?'walk':requested;
    const candidates=normalized==='death' ? ['death','dead','idle','normal']
      : normalized==='idle' ? ['idle','normal','death']
      : normalized==='hit' ? ['hit','normal','idle']
      : normalized==='attack2' ? ['attack2','attack','normal','idle']
      : normalized==='attack' ? ['attack','normal','idle']
      : normalized==='walk' ? ['walk','normal','idle']
      : ['normal','idle'];
    for(const key of candidates){
      const action=animations[key];
      if(Array.isArray(action?.frames)&&action.frames.length)return {key,action,frames:action.frames};
    }
    for(const [key,action] of Object.entries(animations)){
      if(Array.isArray(action?.frames)&&action.frames.length)return {key,action,frames:action.frames};
    }
    return null;
  }
  function frameFromAction(action, timeMs) {
    const allFrames=Array.isArray(action?.frames)?action.frames:[];
    if(!allFrames.length)return null;
    const frameCount=Math.max(1,Math.min(allFrames.length,Math.floor(Number(action.frameCount)||allFrames.length)));
    const frames=allFrames.slice(0,frameCount);
    const fps=Math.max(1,Math.min(60,Number(action.fps)||6));
    const rawIndex=Math.floor(Math.max(0,timeMs)*fps/1000);
    const frameIndex=action.loop===false ? Math.min(frames.length-1,rawIndex) : rawIndex%frames.length;
    return frames[frameIndex] || frames[0] || null;
  }
  function frameFor(id, pose='normal', timeMs=(typeof performance!=='undefined'?performance.now():Date.now())) {
    const selected=animationFor(id,pose);if(!selected)return null;
    return frameFromAction(selected.action,timeMs);
  }
  // Exact lookup is required for non-character assets such as projectiles.
  // A missing projectile must NEVER fall back to the enemy's normal sprite.
  function frameForExact(id, pose='normal', timeMs=(typeof performance!=='undefined'?performance.now():Date.now())) {
    const action=get(id)?.animations?.[String(pose||'normal')];
    if(!Array.isArray(action?.frames)||!action.frames.length)return null;
    return frameFromAction(action,timeMs);
  }
  // DOM image bridge for the legacy campaign renderer (HTMLImageElement.src).
  // Canvas Chapter 4 Runtime uses resolveSource() directly via its asset() loader.
  const pendingImages = new WeakMap();
  function resolveImageElement(img) {
    if (!(img instanceof HTMLImageElement)) return;
    const source = img.getAttribute('src') || '';
    if (!source.startsWith('asset://') || pendingImages.get(img) === source) return;
    pendingImages.set(img, source);
    resolveSource(source).then(url => {
      if (url && img.getAttribute('src') === source) {
        img.setAttribute('src', url);
        img.dataset.enemyAssetLoaded = 'true';
      }
    }).catch(error => {
      if (img.getAttribute('src') === source) img.dataset.enemyAssetError = error?.message || 'Enemy asset unavailable';
      console.error(`[Enemy Registry V2] Failed to resolve ${source}`, error);
    }).finally(() => {
      if (pendingImages.get(img) === source) pendingImages.delete(img);
    });
  }
  function installDomImageBridge() {
    if (!document.documentElement || window.__PRINCE_ENEMY_DOM_IMAGE_BRIDGE__) return;
    window.__PRINCE_ENEMY_DOM_IMAGE_BRIDGE__ = true;
    document.querySelectorAll('img').forEach(resolveImageElement);
    const scan = node => {
      if (node?.nodeType !== 1) return;
      if (node.tagName === 'IMG') resolveImageElement(node);
      node.querySelectorAll?.('img').forEach(resolveImageElement);
    };
    const observer = new MutationObserver(records => records.forEach(record => {
      if (record.type === 'attributes') resolveImageElement(record.target);
      else record.addedNodes.forEach(scan);
    }));
    observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['src']});
  }
  installDomImageBridge();
  window.PrinceEnemyRegistryV2 = { list, get, loadAsset, resolveSource, animationFor, frameFor, frameForExact };
})();
