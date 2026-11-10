/* Audio Manager editor: profile-based music/SFX selection with IndexedDB custom assets. */
(() => {
  'use strict';
  const RT = window.PrinceAudioRuntime;
  const $ = id => document.getElementById(id);
  const DB_NAME = 'PrinceGameAudioAssetsV1', STORE = 'assets';
  const MUSIC_KEYS = [{key:'title',label:'首頁音樂'}, ...[1,2,3,4,5,6].map(n=>({key:`chapter${n}`,label:n>=5?`Chapter ${n} 預設音樂（Runtime 尚未接通）`:`Chapter ${n} 預設音樂`,chapter:String(n)}))];
  const SFX_KEYS = [
    ['playerThrust','玩家槍刺','audio/spear_thrust.ogg'],['playerBash','玩家盾擊','audio/shield_bash.ogg'],
    ['ultimateCharge','女主角大絕蓄力','audio/holy_flame_charge.ogg'],['ultimateBlast','女主角大絕爆發','audio/holy_flame_blast.ogg'],
    ['chapter3Lightning','Chapter 3 雷暴閃電','audio/chapter3_boss/lightning_04.ogg'],
    ['chapter3TentacleCharge1','Chapter 3 觸手集氣 1','audio/chapter3_boss/tentacle_charge_1.ogg'],['chapter3TentacleCharge2','Chapter 3 觸手集氣 2','audio/chapter3_boss/tentacle_charge_2.ogg'],
    ['chapter3TentacleAttack1','Chapter 3 觸手攻擊 1','audio/chapter3_boss/tentacle_attack_1.ogg'],['chapter3TentacleAttack2','Chapter 3 觸手攻擊 2','audio/chapter3_boss/tentacle_attack_2.ogg'],
    ['spiderBossFight','蜘蛛 Boss 戰鬥循環','audio/Boss fighting_sound effect.ogg'],['spiderBossTriple','蜘蛛 Boss 三連攻擊','audio/boss2 attack.ogg'],
    ['spiderBossFinal','蜘蛛 Boss 最終攻擊','audio/boss 2_final attack.ogg'],['spiderBossRun','蜘蛛 Boss 移動','audio/Boss fighting_sound run.ogg'],
    ['spiderBossDead','蜘蛛 Boss／玩家死亡','audio/Boss fighting_sound_ggodnees_dead.ogg'],['enemyCharge','敵人蓄力／衝撞','audio/crash2.mp3'],
    ['enemyHit','Chapter 4 敵人受擊（留空靜音）',''],['enemyDeath','Chapter 4 敵人死亡（留空靜音）',''],
    ['enemyAttack','Chapter 4 敵人攻擊（留空靜音）',''],['enemyProjectile','Chapter 4 敵人投射物（留空靜音）',''],
    ['bossIntro','Chapter 4 Boss 登場音效',''],['bossPhase','Boss Phase 1／通用階段音效',''],['bossPhase2','Boss Phase 2 音效',''],['bossPhase3','Boss Phase 3 音效',''],['bossPhase4','Boss Phase 4 音效',''],['bossPhase5','Boss Phase 5 音效','']
  ];
  const enc = new TextEncoder();
  let config = RT.getConfig();
  let previewAudio = null, previewObjectUrl = null;
  let dbPromise;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
      req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
    }); return dbPromise;
  }
  async function dbPut(row){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
  async function dbGet(id){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readonly');const r=tx.objectStore(STORE).get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
  async function dbAll(){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readonly');const r=tx.objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}
  function ensureProfile(){if(!Array.isArray(config.profiles)||!config.profiles.length)config.profiles=[{id:'classic',name:'原版音效',music:{title:'',chapters:{},stages:{}},sfx:{}}];if(!config.profiles.some(p=>p.id===config.activeProfileId))config.activeProfileId=config.profiles[0].id;config.profiles.forEach(p=>{p.music||={title:'',chapters:{},stages:{}};p.music.chapters||={};p.music.stages||={};p.sfx||={};});}
  function profile(){ensureProfile();return config.profiles.find(p=>p.id===config.activeProfileId)||config.profiles[0];}
  function tracks(){return RT.listTracks().sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));}
  function options(selected=''){return '<option value="">沿用原版／不覆蓋</option>'+tracks().map(t=>`<option value="${escapeHtml(t.path)}" ${t.path===selected?'selected':''}>${escapeHtml(t.name)} · ${escapeHtml(t.path)}</option>`).join('');}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function selectedPath(v){return typeof v==='string'?v:(v?.src||'');}
  function render(){ensureProfile();$('profile').innerHTML=config.profiles.map(p=>`<option value="${escapeHtml(p.id)}" ${p.id===config.activeProfileId?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
    ['masterVolume','musicVolume','sfxVolume'].forEach(k=>{$(k).value=config.settings[k]??1;$({masterVolume:'masterOut',musicVolume:'musicOut',sfxVolume:'sfxOut'}[k]).textContent=Math.round(Number($(k).value)*100)+'%';});
    $('musicEnabled').checked=config.settings.musicEnabled!==false;$('sfxEnabled').checked=config.settings.sfxEnabled!==false;
    const p=profile();$('musicBindings').innerHTML=MUSIC_KEYS.map(row=>{const value=row.key==='title'?p.music.title:p.music.chapters[row.chapter];return `<div class="binding"><strong>${row.label}</strong><select data-music-key="${row.key}">${options(selectedPath(value))}</select><button data-preview-path="${escapeHtml(selectedPath(value))}" title="預覽所選音樂">▶</button></div>`;}).join('');
    $('sfxBindings').innerHTML=SFX_KEYS.map(([key,label])=>`<div class="binding"><strong>${label}</strong><select data-sfx-key="${key}">${options(selectedPath(p.sfx[key]))}</select><button data-preview-fallback="${escapeHtml(SFX_KEYS.find(x=>x[0]===key)?.[2]||'')}" data-preview-sfx="${key}" title="預覽音效">▶</button></div>`).join('');
    const stageSelect=$('stageTrack');stageSelect.innerHTML=options('');$('previewTrack').innerHTML=options('');
    renderStages();renderAssets();
  }
  function renderStages(){const rows=Object.entries(profile().music.stages||{});$('stageOverrides').innerHTML=rows.length?rows.map(([id,row])=>`<div class="list-row"><div><b>${escapeHtml(id)}</b><br><small>${escapeHtml(selectedPath(row))} · 音量 ${Math.round((row.volume??1)*100)}% · ${row.loop===false?'單次':'循環'}</small></div><div class="row"><button data-edit-stage="${escapeHtml(id)}">編輯</button><button class="danger" data-remove-stage="${escapeHtml(id)}">移除</button></div></div>`).join(''):'<p class="muted">尚未設定 Stage 專屬音樂。</p>';}
  async function renderAssets(){const rows=config.customAssets||[];$('assetList').innerHTML=rows.length?rows.map(a=>`<div class="list-row"><div><b>${escapeHtml(a.name)}</b><br><small>${escapeHtml(a.path)}</small></div><div class="row"><button data-preview-custom="${escapeHtml(a.id)}">▶</button><button class="danger" data-remove-asset="${escapeHtml(a.id)}">刪除</button></div></div>`).join(''):'<p class="muted">尚未匯入自訂音訊。</p>';}
  function save(){config=RT.saveConfig(config);$('previewStatus').textContent='已儲存至此瀏覽器的 Audio Config。正式遊戲會讀取此設定。';}
  function jsSource(){return `/* Prince Game Audio Config V1. Exported ${new Date().toISOString()} */\nwindow.PRINCE_AUDIO_CONFIG = ${JSON.stringify(config,null,2)};\n`;}
  function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
  function zipStore(files){const locals=[],centrals=[];let offset=0;const now=new Date(),time=(now.getHours()<<11)|(now.getMinutes()<<5)|(Math.floor(now.getSeconds()/2)),date=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();for(const f of files){const name=enc.encode(f.name),data=f.bytes,crc=crc32(data),lh=new Uint8Array(30+name.length),lv=new DataView(lh.buffer);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);lv.setUint16(10,time,true);lv.setUint16(12,date,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);lv.setUint16(28,0,true);lh.set(name,30);locals.push(lh,data);const ch=new Uint8Array(46+name.length),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint16(12,time,true);cv.setUint16(14,date,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,offset,true);ch.set(name,46);centrals.push(ch);offset+=lh.length+data.length;}const centralSize=centrals.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);return new Blob([...locals,...centrals,end],{type:'application/zip'});}
  async function exportPack(){save();const files=[{name:'js/prince-audio-config.js',bytes:enc.encode(jsSource())},{name:'js/prince-audio-config.json',bytes:enc.encode(JSON.stringify(config,null,2))},{name:'AUDIO_PACK_README_ZH.txt',bytes:enc.encode('將 js/prince-audio-config.js 放入工程 js/，並將 audio/ 資料夾合併至工程 audio/。原有音檔不會在此 ZIP 重複打包。自訂音訊路徑由設定檔引用。\n')}];for(const row of config.customAssets||[]){if(row.bundled===true)continue;const stored=await dbGet(row.id);if(stored?.blob){files.push({name:row.path,bytes:new Uint8Array(await stored.blob.arrayBuffer())});}else throw new Error(`自訂音訊缺少本機資料：${row.name}。請重新匯入該檔案。`);}download('prince-audio-pack.zip',zipStore(files));}
  async function playPreview(path,isSfx=false){if(!path)return;$('previewStatus').textContent=`準備播放：${path}`;if(previewAudio){previewAudio.pause();previewAudio=null;}if(previewObjectUrl){URL.revokeObjectURL(previewObjectUrl);previewObjectUrl=null;}const custom=(config.customAssets||[]).find(a=>a.path===path);let source=path;if(custom){const stored=await dbGet(custom.id);if(stored?.blob){previewObjectUrl=URL.createObjectURL(stored.blob);source=previewObjectUrl;}else if(custom.bundled!==true){throw new Error(`找不到自訂音訊：${custom.name}`);}}previewAudio=new Audio(source);previewAudio.volume=isSfx?RT.getSfxVolume(1):RT.getMusicVolume(1);previewAudio.addEventListener('ended',()=>{$('previewStatus').textContent='預覽結束。';if(previewObjectUrl){URL.revokeObjectURL(previewObjectUrl);previewObjectUrl=null;}},{once:true});previewAudio.play().catch(e=>$('previewStatus').textContent=`無法播放：${e.message}`);}
  function bind(){
    $('save').onclick=()=>{try{save();}catch(e){alert(e.message);}};
    $('exportJs').onclick=()=>{save();download('prince-audio-config.js',new Blob([jsSource()],{type:'text/javascript;charset=utf-8'}));};
    $('exportJson').onclick=()=>{save();download('prince-audio-config.json',new Blob([JSON.stringify(config,null,2)],{type:'application/json'}));};
    $('exportPack').onclick=()=>exportPack().catch(e=>alert(e.message));
    $('profile').onchange=e=>{config.activeProfileId=e.target.value;render();};
    $('newProfile').onclick=()=>{const id='profile_'+Date.now();config.profiles.push({id,name:`自訂版本 ${config.profiles.length}`,music:{title:'',chapters:{},stages:{}},sfx:{}});config.activeProfileId=id;render();};
    $('duplicateProfile').onclick=()=>{const p=profile(),copy=JSON.parse(JSON.stringify(p));copy.id='profile_'+Date.now();copy.name=p.name+' 副本';config.profiles.push(copy);config.activeProfileId=copy.id;render();};
    $('renameProfile').onclick=()=>{const name=prompt('輸入音效版本名稱',profile().name);if(name?.trim()){profile().name=name.trim();render();}};
    $('deleteProfile').onclick=()=>{if(config.profiles.length<=1){alert('至少保留一個 Profile。');return;}if(!confirm(`刪除「${profile().name}」？`))return;config.profiles=config.profiles.filter(p=>p.id!==config.activeProfileId);config.activeProfileId=config.profiles[0].id;render();};
    ['masterVolume','musicVolume','sfxVolume'].forEach(k=>$(k).oninput=e=>{config.settings[k]=Number(e.target.value);$({masterVolume:'masterOut',musicVolume:'musicOut',sfxVolume:'sfxOut'}[k]).textContent=Math.round(config.settings[k]*100)+'%';});
    $('musicEnabled').onchange=e=>config.settings.musicEnabled=e.target.checked;$('sfxEnabled').onchange=e=>config.settings.sfxEnabled=e.target.checked;
    $('musicBindings').onchange=e=>{const key=e.target.dataset.musicKey;if(!key)return;const p=profile();if(key==='title')p.music.title=e.target.value;else p.music.chapters[key.replace('chapter','')]=e.target.value;};
    $('sfxBindings').onchange=e=>{const key=e.target.dataset.sfxKey;if(!key)return;if(e.target.value)profile().sfx[key]=e.target.value;else delete profile().sfx[key];};
    $('musicBindings').onclick=e=>{const b=e.target.closest('[data-preview-path]');if(b){const select=b.parentElement.querySelector('select');const key=select.dataset.musicKey;let path=select.value;if(!path){const p=profile();path=key==='title'?(p.music.title||'audio/title_bgm.ogg'):(p.music.chapters[key.replace('chapter','')]||'audio/fantasy_rpg_bgm.ogg');}playPreview(path,false).catch(err=>$('previewStatus').textContent=`預覽失敗：${err.message}`);}};
    $('sfxBindings').onclick=e=>{const b=e.target.closest('[data-preview-sfx]');if(b){const key=b.dataset.previewSfx;const select=b.parentElement.querySelector('select');playPreview(select.value||b.dataset.previewFallback,true).catch(err=>$('previewStatus').textContent=`預覽失敗：${err.message}`);}};
    $('addStageMusic').onclick=()=>{const id=$('stageId').value.trim(),src=$('stageTrack').value;if(!id||!src){alert('請輸入 Stage ID 並選擇音樂。');return;}profile().music.stages[id]={src,volume:Math.max(0,Math.min(1,Number($('stageVol').value)||1)),loop:$('stageLoop').checked};renderStages();};
    $('stageOverrides').onclick=e=>{const edit=e.target.closest('[data-edit-stage]'),remove=e.target.closest('[data-remove-stage]');if(edit){const id=edit.dataset.editStage,row=profile().music.stages[id];$('stageId').value=id;$('stageTrack').value=selectedPath(row);$('stageVol').value=row.volume??1;$('stageLoop').checked=row.loop!==false;}if(remove){delete profile().music.stages[remove.dataset.removeStage];renderStages();}};
    $('uploadAudio').onchange=async e=>{for(const file of [...(e.target.files||[])]){const ext=(file.name.split('.').pop()||'ogg').toLowerCase();if(!['ogg','mp3','wav','m4a'].includes(ext))continue;const id='audio_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),safe=file.name.normalize('NFKD').replace(/[^\w.-]+/g,'_'),path=`audio/${id}_${safe}`;await dbPut({id,name:file.name,path,blob:file,type:file.type});config.customAssets=config.customAssets||[];config.customAssets.push({id,name:file.name,path,mime:file.type});}config=RT.saveConfig(config);render();$('previewStatus').textContent='自訂音訊已保存到 IndexedDB；匯出 Audio Pack ZIP 才會產生可部署的實體檔案。';e.target.value='';};
    $('assetList').onclick=async e=>{const preview=e.target.closest('[data-preview-custom]'),remove=e.target.closest('[data-remove-asset]');if(preview){const row=config.customAssets.find(a=>a.id===preview.dataset.previewCustom);if(row)playPreview(row.path).catch(err=>alert(err.message));else alert('找不到自訂音訊，請重新匯入。');}if(remove){const id=remove.dataset.removeAsset,row=config.customAssets.find(a=>a.id===id);if(!row)return;const used=config.profiles.some(p=>Object.values(p.sfx||{}).some(v=>selectedPath(v)===row.path)||Object.values(p.music?.chapters||{}).some(v=>selectedPath(v)===row.path)||selectedPath(p.music?.title)===row.path||Object.values(p.music?.stages||{}).some(v=>selectedPath(v)===row.path));if(used&&!confirm('這個音訊仍被一個或多個 Profile 使用。刪除後相關選擇會失效，確定刪除？'))return;config.customAssets=config.customAssets.filter(a=>a.id!==id);const d=await db();await new Promise(resolve=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=resolve;});RT.saveConfig(config);render();}};
    $('previewPlay').onclick=()=>playPreview($('previewTrack').value,false).catch(err=>$('previewStatus').textContent=`預覽失敗：${err.message}`);$('previewStop').onclick=()=>{if(previewAudio){previewAudio.pause();previewAudio=null;}if(previewObjectUrl){URL.revokeObjectURL(previewObjectUrl);previewObjectUrl=null;}$('previewStatus').textContent='已停止預覽。';};
    $('importConfig').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!parsed||!Array.isArray(parsed.profiles))throw new Error('不是有效的 Audio Config JSON');config=parsed;ensureProfile();render();alert('設定已匯入，請按「儲存設定」。');}catch(err){alert('匯入失敗：'+err.message);}e.target.value='';};
    window.addEventListener('storage',e=>{if(e.key===RT.STORAGE_KEY){config=RT.getConfig();render();}});
  }
  ensureProfile();bind();render();
})();
