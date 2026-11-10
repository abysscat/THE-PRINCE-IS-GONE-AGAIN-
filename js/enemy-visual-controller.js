/* Shared Enemy Visual Controller — per enemy + per-pose art control. */
(() => {
  'use strict';

  const TARGET_IDS = [
    'chapter1_enemy_1','chapter1_enemy_2','chapter1_enemy_3','chapter1_enemy_4','chapter1_enemy_5','chapter1_boss_1',
    'chapter2_enemy_1','chapter2_enemy_2','chapter2_enemy_3','chapter2_enemy_4','chapter2_enemy_5','chapter2_enemy_6','chapter2_enemy_7',
    'chapter2_boss_1','chapter2_boss_2','chapter2_boss_2_minion',
    'chapter3_enemy_1','chapter3_enemy_2','chapter3_enemy_3','chapter3_enemy_4','chapter3_enemy_5','chapter3_enemy_6','chapter3_enemy_7','chapter3_enemy_8',
    'chapter3_boss_1','chapter3_boss_1_tentacle'
  ];
  const PREFIX = Object.fromEntries(TARGET_IDS.map(id => [id, id]));
  PREFIX.chapter1_enemy_1='chapter1_enemy_1'; PREFIX.chapter1_enemy_2='chapter1_enemy_2';
  PREFIX.chapter1_enemy_3='chapter1_enemy_3'; PREFIX.chapter1_enemy_4='chapter1_enemy_4'; PREFIX.chapter1_enemy_5='chapter1_enemy_5';
  PREFIX.chapter1_boss_1='chapter1_boss_1';
  PREFIX.chapter2_boss_2_minion='chapter2_boss_2';
  PREFIX.chapter3_enemy_7='chapter3_enemy_6'; PREFIX.chapter3_enemy_8='chapter3_enemy_6';
  PREFIX.chapter3_boss_1_tentacle='chapter3_boss_1';

  const number = (v, fallback, min, max) => {
    const n=Number(v); return Math.min(max,Math.max(min,Number.isFinite(n)?n:fallback));
  };
  const currentConfig=()=>window.ENEMY_VISUAL_CONFIG||{};
  const entryFor=id=>currentConfig().entries?.[id]||{};

  function targetIdFor(enemy) {
    const type=enemy?.dataset?.spriteType||'';
    if(type==='assassin')return 'chapter1_enemy_1';
    if(type==='shield'||type==='heavy')return 'chapter1_enemy_2';
    if(type==='acolyte')return 'chapter1_enemy_3';
    if(type==='archer')return 'chapter1_enemy_4';
    if(type==='skeleton')return 'chapter1_enemy_5';
    if(type==='boss' && !enemy.dataset.chapter3Tentacle)return 'chapter1_boss_1';
    if(type==='chapter2_boss_2'&&enemy.classList.contains('spider-minion'))return 'chapter2_boss_2_minion';
    if(TARGET_IDS.includes(type))return type;
    return null;
  }

  function getArtControl(enemy) {
    const art=enemy.querySelector(':scope > .enemy-art')||enemy.querySelector('.enemy-art');
    if(!art)return null;
    let control=art.querySelector(':scope > .eve-art-control');
    if(!control){
      control=document.createElement('div'); control.className='eve-art-control';
      while(art.firstChild)control.appendChild(art.firstChild);
      art.appendChild(control);
    }
    return control;
  }

  function getSpriteControl(enemy, control) {
    const img=enemy.querySelector('.enemySprite');
    if(!img)return null;
    if(img.parentElement?.classList.contains('eve-sprite-control'))return {wrapper:img.parentElement,img};
    const wrapper=document.createElement('div'); wrapper.className='eve-sprite-control';
    const parent=img.parentNode;
    parent.insertBefore(wrapper,img); wrapper.appendChild(img);
    return {wrapper,img};
  }

  function normalizePose(raw) { return String(raw||'').trim().toLowerCase().replace(/[\s-]+/g,'_'); }
  function poseKeyFromImage(img,id) {
    const raw=(img?.getAttribute('src')||img?.src||'').split(/[?#]/)[0];
    let filename=raw.slice(raw.lastIndexOf('/')+1);
    try { filename=decodeURIComponent(filename); } catch(e) {}
    filename=filename.replace(/\.webp$/i,'').replace(/\.(png|jpe?g)$/i,'');
    const prefix=PREFIX[id]||id;
    const marker=prefix+'_';
    const at=filename.toLowerCase().indexOf(marker.toLowerCase());
    if(at>=0)return normalizePose(filename.slice(at+marker.length));
    const match=filename.match(/_(normal|attack|hit\d*|idle|walk\d+|jump\d+|skill\d+)$/i);
    return match?normalizePose(match[1]):'';
  }

  function applyPose(enemy,id,wrapper,img) {
    const key=poseKeyFromImage(img,id);
    const pose=entryFor(id).poses?.[key];
    if(pose){
      const scale=number(pose.scale,1,.35,3);
      const x=number(pose.offsetX,0,-150,150);
      const y=number(pose.offsetY,0,-150,150);
      wrapper.style.setProperty('transform',`translate(${x}px, ${y}px) scale(${scale})`,'important');
      wrapper.style.setProperty('transform-origin','50% 100%','important');
      wrapper.dataset.pose=key;
    }else{
      wrapper.style.removeProperty('transform');
      wrapper.style.removeProperty('transform-origin');
      delete wrapper.dataset.pose;
    }
  }

  // Legacy Chapter 2 Enemy 6 walk-foot compensation remains supported and stacks
  // on the frame outside the new per-image pose scaling layer.
  function applyChapter2Enemy6Pose(enemy) {
    if(!enemy||enemy.dataset.spriteType!=='chapter2_enemy_6')return;
    const control=getArtControl(enemy);
    const frame=control?.querySelector('.enemy-art-frame');
    const img=enemy.querySelector('.enemySprite');
    if(!frame||!img)return;
    const source=img.getAttribute('src')||img.src||'';
    const match=source.match(/chapter2_enemy_6_(walk[1-4])\.webp(?:[?#]|$)/i);
    const pose=match?match[1].toLowerCase():'';
    const override=currentConfig().poseOverrides?.chapter2_enemy_6?.[pose]||null;
    if(override){
      const scale=number(override.scale,1,.5,2.5);
      const offset=number(override.offsetYPercent,0,-20,40);
      frame.style.setProperty('transform',`translateY(${offset}%) scale(${scale})`,'important');
      frame.style.setProperty('transform-origin','50% 100%','important');
      frame.dataset.enemy6WalkPose=pose;
    }else{
      frame.style.removeProperty('transform');
      frame.style.removeProperty('transform-origin');
      delete frame.dataset.enemy6WalkPose;
    }
  }

  function applyEnemy(enemy) {
    if(!enemy||!enemy.isConnected)return;
    const id=targetIdFor(enemy); if(!id)return;
    const control=getArtControl(enemy); if(!control)return;
    const config=entryFor(id);
    const baseScale=number(config.scale,1,.35,3);
    const x=number(config.offsetX,0,-150,150);
    const y=number(config.offsetY,0,-150,150);
    control.style.setProperty('scale',String(baseScale),'important');
    control.style.setProperty('translate',`${x}px ${y}px`,'important');
    control.style.setProperty('transform-origin','50% 100%','important');
    const spriteControl=getSpriteControl(enemy,control);
    if(spriteControl)applyPose(enemy,id,spriteControl.wrapper,spriteControl.img);
    applyChapter2Enemy6Pose(enemy);
  }

  function applyAll() {
    const root=document.getElementById('enemies');
    if(!root)return;
    root.querySelectorAll(':scope > .enemy').forEach(applyEnemy);
  }

  function init() {
    const root=document.getElementById('enemies'); if(!root)return;
    applyAll();
    const observer=new MutationObserver(records=>{
      const touched=new Set();
      records.forEach(record=>{
        if(record.type==='childList'){
          record.addedNodes.forEach(node=>{
            if(node.nodeType!==1)return;
            if(node.matches?.('.enemy'))touched.add(node);
            node.querySelectorAll?.('.enemy').forEach(enemy=>touched.add(enemy));
          });
        } else if(record.type==='attributes'&&record.target.matches?.('.enemySprite')) {
          const enemy=record.target.closest('#enemies > .enemy'); if(enemy)touched.add(enemy);
        }
      });
      touched.forEach(applyEnemy);
    });
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
    window.EnemyVisualController={apply:applyAll,applyEnemy,getConfig:()=>JSON.parse(JSON.stringify(currentConfig()))};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
