/*
 * 王子又不見了！— 遊戲主程式（第三階段：角色顯示工具已分拆）
 *
 * 用途：遊戲流程總管，負責開始／暫停、關卡流程、操作及每幀更新。
 *
 * 已分拆的工具：
 * - game-settings.js：設定資料、圖片路徑及關卡數值
 * - player.js：角色圖片切換及大絕影格的顯示尺寸
 * - enemies.js：依敵人種類和動作尋找圖片路徑
 *
 * 為了降低出錯風險，這一階段只搬走敵人圖片路徑判斷；
 * 敵人生成、戰鬥和遊戲迴圈暫時仍留在本檔案。
 */
(()=> {
    const $=id=>document.getElementById(id),stage=$('stage'),hero=$('hero'),enemies=$('enemies'),overlay=$('overlay');
    let running=false,paused=false,x=0,cameraX=0,worldW=0,stageW=0,stageH=0,bgW=0,hp=100,mp=65,kills=0,levelKills=0,level=1,combo=0,lastHit=0,attackCd=0,jumpT=0,last=0,spawnTimer=0,keys= {
    },moveV=0,jumpY=0,jumpV=0,onGround=true,coyoteMs=0,jumpBufferMs=0,faceDir=1,spawnedThisLevel=0,bossSpawnedThisLevel=false,clues=[],clueIndex=0,exitOpen=false,exitX=0,heroActionUntil=0,heroActionSprite='images/hero/hero_stand.png',ultimateActive=false,ultimateCooldownUntil=0,ultimateToken=0,ultimateStartedAt=0,bashLockUntil=0;
    const world=$('world'),levelBackground=$('levelBackground'),exitPrompt=$('exitPrompt');
    const bossHealthPanel=$('bossHealthPanel'),bossHealthFill=$('bossHealthFill'),bossHealthPercent=$('bossHealthPercent');
    let bossShakeTimer=0;
    // 撞飛物理：鎖定輸入，利用原有跳躍重力完成拋物線。
    let knockbackUntilLanding=false,knockbackDirection=0,knockbackHitUntil=0;
    const bossRush={active:false,boss:null,phase:'',phaseStartedAt:0,runStartedAt:0,originX:0,targetX:0,leftX:0,rightX:0,cameraAnchor:null,currentThreshold:0,triggered:new Set(),queue:[],originalFacing:'right',originalFacingLocked:'0',speed:2.5,hitDashes:new Set(),dashDirection:1,nextTimer:0,cooldownUntil:0};
    // 第一章 Boss 的唯一一次世界末日必殺技；所有位置使用原有 world 座標，完全不改舞台尺寸。
    const chapter1FinalSkill={triggered:false,active:false,phase:'',phaseStartedAt:0,boss:null,cameraAnchor:null,targetX:0,storm:null,sword:null,impact:null,shockwave:null,killedHero:false,originalFacingLocked:'0',swordHeight:0,swordWidth:0,chargeSfx:null,chargeSfxPlayed:false};
    const CHAPTER1_FINAL_CHARGE_MS=5000,CHAPTER1_FINAL_DROP_MS=850,CHAPTER1_FINAL_HIT_DELAY_MS=1000;
    // 音效延遲時間請到 js/game-tuning.js 的 effects.boss1FinalSfxDelayMs 修改。
    const gameSettings=window.GAME_SETTINGS;
    // 可調整數值集中於 js/game-tuning.js；此處只讀取設定，不把數值散落在主程式。
    const gameTuning=window.GAME_TUNING||{};
    const tuneEffects=gameTuning.effects||{};
    const tuneCombat=gameTuning.combat||{};
    const tuneEnemyAI=gameTuning.enemyAI||{};
    // Q 大絕音效由 js/ultimate-sound.js 獨立管理，避免混在戰鬥邏輯中。
    const ultimateSound=window.createUltimateSound();
    const targets=gameSettings.targets,levelConfigs=gameSettings.levels,enemyList=[];
    let pendingChapterTransition=false;
    const bgFiles=gameSettings.backgroundFiles;
    const ultimateSpriteFiles=gameSettings.ultimateSpriteFiles;
    const ultimateFrameImages=ultimateSpriteFiles.map(path=> {
        const image=new Image();
        image.src=path;
        return image
    });
    const heroSpriteFiles=gameSettings.heroSpriteFiles;
    heroSpriteFiles.forEach(path=> {
        const image=new Image();
        image.src=path
    });
    const playerVisuals=window.createPlayerVisuals( {
        getElement:$,hero,gameSettings,getStageHeight:()=>stageH
    });
    const setHeroSprite=playerVisuals.setHeroSprite;
    const setUltimateFrame=playerVisuals.setUltimateFrame;
    const titleAudio=new Audio('audio/title_bgm.wav');
    titleAudio.loop=true;
    titleAudio.volume=0.25;
    const bgmAudio=new Audio('audio/fantasy_rpg_bgm.wav');
    bgmAudio.loop=true;
    bgmAudio.volume=0.28;
    let musicEnabled=true;
    function startTitleMusic() {
        if(!musicEnabled)return;
        try {
            const p=titleAudio.play();
            if(p&&p.catch)p.catch(()=> {
            });
        }
        catch(e) {
        }
    }
    startTitleMusic();
    // 攻擊音效播放引擎：優先使用 Web Audio 的 AudioBufferSourceNode。
    // 每次攻擊建立獨立 source，不重設／中斷任何正在播放的 HTMLAudio，避免手機連擊時截聲。
    const SFX_VOLUME=0.10;
    let attackAudioContext=null;
    const attackAudioBuffers={};
    const attackAudioBufferPromises={};
    const sfxData=window.GAME_SFX_BASE64||{};
    function decodeAudioCompat(ctx, arrayBuffer) {
        return new Promise((resolve,reject)=>{
            let settled=false;
            const ok=buffer=>{if(!settled){settled=true;resolve(buffer)}};
            const fail=error=>{if(!settled){settled=true;reject(error)}};
            try {
                const result=ctx.decodeAudioData(arrayBuffer.slice(0),ok,fail);
                if(result&&typeof result.then==='function')result.then(ok,fail);
            } catch(error) {fail(error)}
        });
    }
    function initAttackAudio() {
        const AudioContextClass=window.AudioContext||window.webkitAudioContext;
        if(!AudioContextClass||!sfxData.thrust||!sfxData.bash)return;
        try {
            attackAudioContext=new AudioContextClass();
            for(const kind of ['thrust','bash']) {
                try {
                    const binary=atob(sfxData[kind]);
                    const bytes=new Uint8Array(binary.length);
                    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
                    attackAudioBufferPromises[kind]=decodeAudioCompat(attackAudioContext,bytes.buffer)
                        .then(buffer=>(attackAudioBuffers[kind]=buffer))
                        .catch(()=>null);
                } catch(error) {
                    attackAudioBufferPromises[kind]=Promise.resolve(null);
                }
            }
        } catch(error) {
            attackAudioContext=null;
        }
    }
    initAttackAudio();
    function unlockAttackAudio() {
        if(attackAudioContext&&attackAudioContext.state==='suspended') {
            try {const p=attackAudioContext.resume();if(p&&p.catch)p.catch(()=>{});} catch(error) {}
        }
    }
    // 捕捉開始按鈕／觸控按鈕的第一個手勢，讓 iOS Safari 有機會解鎖 AudioContext。
    document.addEventListener('pointerdown',unlockAttackAudio,{capture:true,passive:true});
    window.addEventListener('keydown',unlockAttackAudio,{capture:true});

    // 不支援 Web Audio 或音效尚未解碼時，使用可動態擴充的 HTMLAudio 後備通道。
    // 通道全忙時新增通道，不會為了重播而 pause 正在播放的聲音，也不會丟掉這次攻擊。
    const fallbackSfxPools={
        thrust:{src:'audio/spear_thrust.wav',volume:SFX_VOLUME,voices:[]},
        bash:{src:'audio/shield_bash.wav',volume:SFX_VOLUME,voices:[]}
    };
    function createFallbackVoice(pool) {
        const audio=new Audio(pool.src);
        audio.preload='auto';
        audio.volume=pool.volume;
        const voice={audio,busy:false};
        audio.addEventListener('ended',()=>{voice.busy=false;});
        audio.addEventListener('error',()=>{voice.busy=false;});
        pool.voices.push(voice);
        return voice;
    }
    Object.values(fallbackSfxPools).forEach(pool=>{
        for(let i=0;i<4;i++)createFallbackVoice(pool);
    });
    function playFallbackSfx(kind) {
        const pool=fallbackSfxPools[kind];
        let voice=pool.voices.find(v=>!v.busy||v.audio.ended||v.audio.paused&&v.audio.currentTime>0);
        if(!voice)voice=createFallbackVoice(pool);
        const audio=voice.audio;
        try {
            voice.busy=true;
            audio.currentTime=0;
            const result=audio.play();
            if(result&&result.catch)result.catch(()=>{voice.busy=false;});
        } catch(error) {voice.busy=false;}
    }
    function playSfx(kind) {
        const key=kind==='bash'?'bash':'thrust';
        const ctx=attackAudioContext;
        const buffer=attackAudioBuffers[key];
        if(ctx&&buffer) {
            try {
                if(ctx.state==='suspended') {
                    const resumed=ctx.resume();
                    if(resumed&&resumed.catch)resumed.catch(()=>{});
                }
                const source=ctx.createBufferSource();
                const gain=ctx.createGain();
                source.buffer=buffer;
                gain.gain.value=SFX_VOLUME;
                source.connect(gain);
                gain.connect(ctx.destination);
                source.onended=()=>{try{source.disconnect();gain.disconnect();}catch(error){}};
                source.start(0);
                return;
            } catch(error) {
                // Web Audio 發生例外時落回 HTMLAudio 通道。
            }
        }
        playFallbackSfx(key);
    }
    // ===== 畫面提示：顯示傷害、線索等浮動文字 =====
    function floatText(txt,worldX,bottom) {
        const f=document.createElement('div');
        f.className='effects';
        f.textContent=txt;
        f.style.left=((worldX-cameraX)/Math.max(1,stageW)*100)+'%';
        f.style.bottom=bottom+'%';
        stage.appendChild(f);
        setTimeout(()=>f.remove(),tuneEffects.floatTextMs??950)
    }
    // ===== 線索掉落：每關指定一件；成功時暫停並進入兩階段點擊流程 =====
    let clueModalPhase=0, activeClue=null;
    const clueByLevel=gameSettings.cluesByLevel||{};
    const foundClues=new Set();
    function showClue(item) {
        if(!item || foundClues.has(item.id) || clueModalPhase)return;
        foundClues.add(item.id);
        clues.push(item.id);
        activeClue=item;
        clueModalPhase=1;
        paused=true;
        keys={};
        hero.classList.remove('walking');
        $('clueReveal').hidden=false;
        $('clueRevealGlow').src=item.glow;
        $('clueRevealItem').src=item.item;
        $('clueDialogFrame').src=item.frame;
        $('clueDialogTitle').textContent='發現'+item.name+'！';
        $('clueDialogText').textContent=item.dialog;
        $('clueDialog').hidden=true;
        $('clueContinue').hidden=true;
        $('clueBook').textContent='線索 '+clues.length+'/6';
        $('pause').textContent='▶';
    }
    function closeClue() {
        $('clueReveal').hidden=true;
        $('clueDialog').hidden=true;
        clueModalPhase=0;
        activeClue=null;
        paused=false;
        $('pause').textContent='Ⅱ';
        last=performance.now();
        keys={};
    }
    // ===== 世界與鏡頭：計算關卡寬度、角色位置及鏡頭跟隨 =====
    function sizeWorld() {
        stageW=stage.clientWidth;
        stageH=stage.clientHeight;
        const ratio=(levelBackground.naturalWidth&&levelBackground.naturalHeight)?levelBackground.naturalWidth/levelBackground.naturalHeight:7.5;
        bgW=Math.max(stageW,stageH*ratio);
        worldW=bgW;
        world.style.width=worldW+'px';
        world.style.height='100%';
        levelBackground.style.width=bgW+'px';
        levelBackground.style.height='100%';
        const blank=world.querySelector('.world-blank');
        blank.style.left=bgW+'px';
        blank.style.width='0px';
        blank.style.height='100%';
        updateCamera()
    }
    function heroExitX() {
        const hw=hero.getBoundingClientRect().width||116;
        return Math.max(0,bgW-hw*.52)
    }
    let bossCameraReturnUntil=0;
    function updateCamera() {
        if(!stageW) return;
        const maxCamera=Math.max(0,worldW-stageW);
        if(chapter1FinalSkill.active && chapter1FinalSkill.cameraAnchor!==null) {
            // 最終技能期間固定原本鏡頭錨點，特效只在 world 內播放，不推動角色或鏡頭。
            cameraX=Math.max(0,Math.min(maxCamera,chapter1FinalSkill.cameraAnchor));
        } else if(bossRush.active && bossRush.cameraAnchor!==null) {
            cameraX=Math.max(0,Math.min(maxCamera,bossRush.cameraAnchor));
        } else {
            const targetCamera=Math.max(0,Math.min(maxCamera,x-stageW*.45));
            const now=performance.now();
            if(now<bossCameraReturnUntil) {
                // Boss 絕招結束後，鏡頭由固定戰場位置平滑追上主角，避免瞬間跳位。
                const remaining=Math.max(1,bossCameraReturnUntil-now);
                const blend=Math.min(0.16,Math.max(0.035,1/remaining*16));
                cameraX+= (targetCamera-cameraX)*blend;
                if(Math.abs(targetCamera-cameraX)<0.8) {
                    cameraX=targetCamera;
                    bossCameraReturnUntil=0;
                }
            } else {
                cameraX=targetCamera;
            }
        }
        world.style.transform='translate3d('+(-cameraX)+'px,0,0)';
        hero.style.left=x+'px';
        exitPrompt.hidden=!exitOpen;
    }
    // ===== 第二章第 8 關蜘蛛 Boss：四個 HP 階段、兩次召喚與終極毒霧 =====
    // 僅作用於第 8 關 chapter2_boss_2；第 4 關 Boss 與其他關卡沿用原有程式。
    const SPIDER_PLAYER_MAX_HP=100;
    const SPIDER_SKILL_TUNING={
        triple:{threshold:.80,chargeMs:560,activeMs:2300,shotIntervalMs:430,flightMs:1180,damage:7,areaDamage:4,areaMs:3000,poolSafeMs:1000,poolTickMs:500,arcHeight:.46},
        // 60% HP：額外召喚 8 隻小蜘蛛，落點隨機分布於目前可見戰場，不讓小蜘蛛和女神重疊出場。
        minions60:{threshold:.60,minionCount:8,randomSpawn:true},
        brood40:{threshold:.40,chargeMs:880,minionCount:8,totalWaves:1,returnSpeed:.24,returnSide:'left',minionMode:'normal'},
        brood20:{threshold:.20,chargeMs:880,minionCount:4,totalWaves:3,returnSpeed:.24,returnSide:'right',minionMode:'mixed'},
        ultimate:{threshold:.10,chargeMs:5000,activeMs:0},
        // 萬毒蛛域終局：由高處下降，runway4 → runway3 → runway2 → runway1 → normal。
        awakening:{runwayFrameMs:220,normalMs:350}
    };
    const spiderBossSkill={boss:null,queue:[],triggered:new Set(),active:false,phase:'',phaseStartedAt:0,didLaunch:false,token:0,effects:new Set(),timers:new Set(),intervals:new Set(),warning:null,warningArea:null,originalFacingLocked:'0',slowUntil:0,returnStartX:0,returnTargetX:0,returnDuration:0,returnSide:null,killedHero:false,broodWave:0,broodMode:'',lastPoisonTick:0,poisonInterval:null,invulnerable:false,awakeningTriggered:false,ultimateActivated:false,finalHit2Triggered:false,goddessDeadAudioPlayed:false,fullscreenAnimation:null};
    const SPIDER_ASSET_DIR='images/chapter2/enemies/chapter2_boss_2/';
    const SPIDER_LAST_PHASE_FRAMES=['chapter2_boss_2_skin1_last1.png','chapter2_boss_2_skin1_last2.png','chapter2_boss_2_skin1_last3.png','chapter2_boss_2_skin1_last4.png'];
    // 蜘蛛 Boss 專用音效；與普通武器音效分開，避免技能時機互相干擾。
    const spiderBossAudio={
        fight:new Audio('audio/Boss fighting_sound effect.wav'),
        triple:new Audio('audio/boss2 attack.wav'),
        final:new Audio('audio/boss 2_final attack.wav'),
        run:new Audio('audio/Boss fighting_sound run.wav'),
        goddessDead:new Audio('audio/Boss fighting_sound_ggodnees_dead.wav')
    };
    spiderBossAudio.fight.loop=true;
    spiderBossAudio.fight.volume=0.28;
    spiderBossAudio.triple.volume=0.38;
    spiderBossAudio.final.volume=0.42;
    spiderBossAudio.run.volume=0.48;
    spiderBossAudio.goddessDead.volume=0.58;
    Object.values(spiderBossAudio).forEach(audio=>{audio.preload='auto';});
    function spiderStartFightAudio(){
        const audio=spiderBossAudio.fight;
        if(!audio.paused&&!audio.ended)return;
        try{
            audio.loop=true;
            audio.currentTime=0;
            const result=audio.play();
            if(result&&result.catch)result.catch(()=>{});
        }catch(error){}
    }
    function spiderStopFightAudio(){
        const audio=spiderBossAudio.fight;
        try{audio.pause();audio.currentTime=0;}catch(error){}
    }
    function spiderPlayOneShot(audio){
        try{
            audio.pause();
            audio.currentTime=0;
            const result=audio.play();
            if(result&&result.catch)result.catch(()=>{});
        }catch(error){}
    }
    // 多隻蜘蛛小弟可能同時施放毒攻擊；使用獨立播放通道，避免後一隻重設音效而截斷前一隻。
    function spiderPlayOneShotIndependent(audio){
        try{
            const voice=audio.cloneNode();voice.loop=false;voice.volume=audio.volume;voice.currentTime=0;
            const result=voice.play();
            if(result&&result.catch)result.catch(()=>{});
            voice.addEventListener('ended',()=>{voice.removeAttribute('src');voice.load();},{once:true});
        }catch(error){}
    }
    function isSpiderBoss(e){return level===8&&!!e&&e.dataset.boss==='1'&&e.dataset.spriteType==='chapter2_boss_2';}
    function spiderHoldNormalPoseBeforeFinalHit2(e){return isSpiderBoss(e)&&spiderBossSkill.ultimateActivated&&spiderBossSkill.awakeningTriggered&&!spiderBossSkill.finalHit2Triggered&&spiderBossSkill.phase==='ultimateAwakened'&&hp>SPIDER_PLAYER_MAX_HP*.05;}
    function isSpiderBroodProtected(e){return isSpiderBoss(e)&&spiderBossSkill.boss===e&&/^brood/.test(spiderBossSkill.phase)&&spiderBossSkill.active;}
    function spiderPose(e,pose){const img=e?.querySelector('.enemySprite');if(!img)return;img.style.filter='';const file='chapter2_boss_2_'+pose+'.png';const src=SPIDER_ASSET_DIR+file;if(img.getAttribute('src')!==src&&!img.getAttribute('src')?.endsWith('/'+file))img.src=src;}
    function spiderLater(fn,delay){const id=setTimeout(()=>{spiderBossSkill.timers.delete(id);fn();},delay);spiderBossSkill.timers.add(id);return id;}
    function spiderClearInterval(id){if(id!==null&&id!==undefined){clearInterval(id);spiderBossSkill.intervals.delete(id);if(spiderBossSkill.poisonInterval===id)spiderBossSkill.poisonInterval=null;}}
    function spiderRemoveEffect(el){if(el&&el.remove)el.remove();spiderBossSkill.effects.delete(el);if(spiderBossSkill.warning===el)spiderBossSkill.warning=null;if(spiderBossSkill.warningArea===el)spiderBossSkill.warningArea=null;}
    function spiderClearEffects(){
        spiderBossSkill.timers.forEach(id=>clearTimeout(id));spiderBossSkill.timers.clear();
        spiderBossSkill.intervals.forEach(id=>clearInterval(id));spiderBossSkill.intervals.clear();spiderBossSkill.poisonInterval=null;
        spiderBossSkill.effects.forEach(el=>{if(el&&el.remove)el.remove();});spiderBossSkill.effects.clear();
        stage.querySelectorAll('.spider-skill-effect').forEach(el=>el.remove());
        spiderBossSkill.warning=null;spiderBossSkill.warningArea=null;spiderBossSkill.fullscreenAnimation=null;
    }
    function resetSpiderBossSkill(){
        // Boss 死亡、離場或戰鬥重設時，停止循環戰鬥音效並回到開頭。
        spiderStopFightAudio();
        spiderBossSkill.token++;
        const oldBoss=spiderBossSkill.boss;
        if(oldBoss&&oldBoss.isConnected){
            oldBoss.classList.remove('spider-boss-charging','spider-boss-ultimate-charging','spider-boss-dashing','spider-boss-lifting','spider-boss-returning','spider-boss-brood-hidden','spider-boss-awakening','spider-boss-final-hit2');
            oldBoss.dataset.facingLocked=spiderBossSkill.originalFacingLocked||'0';
            oldBoss.style.removeProperty('--spider-charge');oldBoss.style.removeProperty('visibility');oldBoss.style.removeProperty('opacity');oldBoss.style.removeProperty('transform');
            if(!oldBoss.classList.contains('dead'))spiderPose(oldBoss,'normal');
        }
        spiderClearEffects();
        spiderBossSkill.boss=null;spiderBossSkill.queue.length=0;spiderBossSkill.triggered.clear();spiderBossSkill.active=false;spiderBossSkill.phase='';spiderBossSkill.phaseStartedAt=0;spiderBossSkill.didLaunch=false;spiderBossSkill.originalFacingLocked='0';spiderBossSkill.slowUntil=0;spiderBossSkill.returnStartX=0;spiderBossSkill.returnTargetX=0;spiderBossSkill.returnDuration=0;spiderBossSkill.returnSide=null;spiderBossSkill.killedHero=false;spiderBossSkill.broodWave=0;spiderBossSkill.broodMode='';spiderBossSkill.lastPoisonTick=0;spiderBossSkill.invulnerable=false;spiderBossSkill.awakeningTriggered=false;spiderBossSkill.ultimateActivated=false;spiderBossSkill.finalHit2Triggered=false;spiderBossSkill.goddessDeadAudioPlayed=false;spiderBossSkill.fullscreenAnimation=null;
        hero.classList.remove('spider-slow','spider-toxic-glow');document.body.classList.remove('spider-apocalypse');keys.left=false;keys.right=false;
    }
    function spiderEffect(className,left,bottom,width,height,asset){
        const el=asset?document.createElement('img'):document.createElement('div');el.className='spider-skill-effect '+className;el.setAttribute('aria-hidden','true');
        if(asset){el.src=SPIDER_ASSET_DIR+'chapter2_boss_2_'+asset+'.png';el.alt='';el.draggable=false;el.onerror=()=>{el.style.display='none';};}
        el.style.left=left+'px';el.style.bottom=bottom+'px';if(width)el.style.width=width+'px';if(height)el.style.height=height+'px';world.appendChild(el);spiderBossSkill.effects.add(el);return el;
    }
    function spiderStageEffect(className,asset){
        const el=document.createElement('img');el.className='spider-skill-effect '+className;el.setAttribute('aria-hidden','true');el.alt='';el.draggable=false;
        el.src=SPIDER_ASSET_DIR+'chapter2_boss_2_'+asset+'.png';el.onerror=()=>{el.style.display='none';};stage.appendChild(el);spiderBossSkill.effects.add(el);return el;
    }
    // Boss 進入 10% 階段時：全舞台淡入顯示 last1–last4，四格無限循環直到技能重設／戰鬥結束。
    function spiderStartLastPhaseAnimation(){
        if(spiderBossSkill.fullscreenAnimation?.isConnected)return spiderBossSkill.fullscreenAnimation;
        const token=spiderBossSkill.token,img=document.createElement('img');
        img.className='spider-skill-effect spider-last-phase-animation';img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');
        img.src=SPIDER_ASSET_DIR+SPIDER_LAST_PHASE_FRAMES[0];stage.appendChild(img);spiderBossSkill.effects.add(img);spiderBossSkill.fullscreenAnimation=img;
        let frame=0;
        const advance=()=>{
            if(token!==spiderBossSkill.token||!img.isConnected||spiderBossSkill.fullscreenAnimation!==img)return;
            frame=(frame+1)%SPIDER_LAST_PHASE_FRAMES.length;img.src=SPIDER_ASSET_DIR+SPIDER_LAST_PHASE_FRAMES[frame];
            spiderLater(advance,175);
        };
        spiderLater(advance,175);return img;
    }
    function spiderTextEffect(className,left,bottom,width,height,text){const el=spiderEffect(className,left,bottom,width,height,null);el.textContent=text;return el;}
    function spiderHeroCenter(){return x+(hero.offsetWidth||72)*.5;}
    function spiderFacePlayer(e){
        if(!e||!e.isConnected)return;
        const bossCenter=(Number(e.dataset.x)||0)+(e.offsetWidth||300)*.5;
        const faceLeft=spiderHeroCenter()<bossCenter;
        e.dataset.facing=faceLeft?'left':'right';
        // 蜘蛛王原圖本身朝左；要面向右方時才水平翻轉，因此 class 與 facing 資料相反。
        e.classList.toggle('enemy-facing-left',!faceLeft);
    }
    function spiderIsDescending(){return /^awakeningRunway[4321]$/.test(spiderBossSkill.phase)||spiderBossSkill.phase==='awakeningNormal';}
    function spiderClampFinalHP(previousHP,nextHP){
        if(spiderBossSkill.ultimateActivated&&spiderIsDescending())return previousHP;
        // 大絕成功啟動後，玩家最低先保留 5% HP；要到 Boss 進入 hit2 才開始死亡流程。
        let result=nextHP;
        if(spiderBossSkill.ultimateActivated&&!spiderBossSkill.finalHit2Triggered&&result<SPIDER_PLAYER_MAX_HP*.05)result=SPIDER_PLAYER_MAX_HP*.05;
        if(spiderBossSkill.ultimateActivated&&spiderBossSkill.finalHit2Triggered&&result<=0)spiderBossSkill.killedHero=true;
        // 蜘蛛王的大絕把女神打至 1 HP（或一擊跨過 1 HP）時，死亡音效只播一次。
        if(spiderBossSkill.ultimateActivated&&!spiderBossSkill.goddessDeadAudioPlayed&&previousHP>1&&result<=1){
            spiderBossSkill.goddessDeadAudioPlayed=true;
            spiderPlayOneShotIndependent(spiderBossAudio.goddessDead);
        }
        return result;
    }
    function spiderHitPlayer(damage,ignoreJump=false){
        if(!running||hp<=0||(!ignoreJump&&jumpT>0))return false;
        const previousHP=hp;hp=spiderClampFinalHP(previousHP,Math.max(0,hp-damage));floatText('−'+(previousHP-hp),spiderHeroCenter(),34);updateHud();return true;
    }
    function spiderMakeArea(centerX,width,duration,damage,kind='poison',delay=null){
        // 保持素材比例；毒池的可見尺寸亦用來計算命中區域，避免圖像與碰撞大小分離。
        const ratio=kind==='ultimate'?(743/355):(500/300);
        const maxWidth=Math.min(Math.max(1,worldW),Math.max(100,width),Math.max(100,stageH*(kind==='ultimate'?.43:.25)*ratio));
        const areaW=maxWidth,areaH=areaW/ratio;
        const left=Math.max(0,Math.min(Math.max(0,worldW-areaW),centerX-areaW*.5));
        const area=spiderEffect('spider-ground-area '+(kind==='ultimate'?'spider-ultimate-area':'spider-poison-area'),left,Math.max(0,stageH*.105),areaW,areaH,kind==='ultimate'?'poison_big_area':'poison');
        area.style.opacity=kind==='ultimate'?'.78':'.92';
        const safeDelay=delay===null?(kind==='poison'?SPIDER_SKILL_TUNING.triple.poolSafeMs:0):delay;
        const token=spiderBossSkill.token,createdAt=performance.now(),expires=createdAt+duration,armedAt=createdAt+safeDelay;let nextDamageAt=armedAt;
        const tick=now=>{
            if(token!==spiderBossSkill.token||!area.isConnected||!running||hp<=0){spiderRemoveEffect(area);return;}
            if(now>=armedAt&&now>=nextDamageAt&&jumpT===0){
                const heroL=x,heroR=x+(hero.offsetWidth||72);
                if(heroR>left+areaW*.08&&heroL<left+areaW*.92){spiderHitPlayer(damage);nextDamageAt=now+SPIDER_SKILL_TUNING.triple.poolTickMs;}
            }
            if(now>=expires){spiderRemoveEffect(area);return;}
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);return area;
    }
    // 三個落點至少盡量分散；空間不足時退回固定左右、中間位置，避免重疊。
    function spiderRandomLandingTargets(){
        const left=Math.max(cameraX+24,24),right=Math.max(left+1,Math.min(worldW-24,cameraX+stageW-24));
        const span=right-left,minGap=Math.min(Math.max(70,stageW*.12),span*.46),targets=[];
        for(let i=0;i<3;i++){
            let candidate=left+span*(.08+Math.random()*.84),tries=0;
            while(tries++<45&&targets.some(v=>Math.abs(v-candidate)<minGap))candidate=left+span*(.08+Math.random()*.84);
            if(targets.some(v=>Math.abs(v-candidate)<minGap)){
                const slots=[left+span*.17,left+span*.5,left+span*.83];
                const available=slots.filter(v=>!targets.some(t=>Math.abs(t-v)<minGap));
                candidate=available.length?available[0]:left+span*(i+1)/4;
            }
            targets.push(Math.max(left,Math.min(right,candidate)));
        }
        return targets;
    }
    function spiderProjectile(fromX,targetX,damage,flightMs,token,sourceEl=null){
        if(token!==spiderBossSkill.token||!running||hp<=0)return;
        // 使用最新提供的 637×637 綠色毒液球；球體保持正向，顯示尺寸採正方形並按舞台寬度縮放。
        const shotSize=Math.max(68,Math.min(112,stageW*.075));
        const shotWidth=shotSize,shotHeight=shotSize;
        const start=performance.now(),startX=fromX,dist=targetX-fromX;
        const shot=spiderEffect('spider-projectile spider-poison-spray-projectile',fromX-shotWidth*.5,stageH*.14,shotWidth,shotHeight,'skin1_attack');
        let finished=false;
        const finish=(impactX,directHit)=>{
            if(finished)return;finished=true;spiderRemoveEffect(shot);
            if(token!==spiderBossSkill.token||!running||hp<=0)return;
            if(directHit)spiderHitPlayer(damage);
            const impact=spiderEffect('spider-hit-flash',impactX-46,stageH*.105,92,58,'poison');
            spiderLater(()=>spiderRemoveEffect(impact),700);
            const sourceWidth=sourceEl?.offsetWidth||(sourceEl?.dataset?.spiderMinion==='1'?75:300);
            const poolWidth=Math.max(sourceEl?.dataset?.spiderMinion==='1'?88:140,Math.min(360,sourceWidth*.7));
            spiderMakeArea(impactX,poolWidth,SPIDER_SKILL_TUNING.triple.areaMs,SPIDER_SKILL_TUNING.triple.areaDamage,'poison');
        };
        const tick=now=>{
            if(token!==spiderBossSkill.token||!shot.isConnected||!running||hp<=0){spiderRemoveEffect(shot);return;}
            const p=Math.min(1,(now-start)/flightMs),centerX=startX+dist*p;
            shot.style.left=(centerX-shotWidth*.5)+'px';
            shot.style.bottom=(stageH*(.12+Math.sin(Math.PI*p)*SPIDER_SKILL_TUNING.triple.arcHeight))+'px';
            const heroL=x,heroR=x+(hero.offsetWidth||72),halfHit=shotWidth*.36;
            // 只在拋物線下降接近地面時才判定直接命中；碰撞仍以毒液中心計算。
            if(p>.94&&jumpT===0&&centerX+halfHit>heroL&&centerX-halfHit<heroR){finish(centerX,true);return;}
            if(p>=1){const impactHitsHero=jumpT===0&&targetX+halfHit>heroL&&targetX-halfHit<heroR;finish(targetX,impactHitsHero);return;}
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }
    function spiderMinionNormalAttack(minion,now){
        const cooldown=+(minion.dataset.spiderMinionNextAttack||0);if(now<cooldown)return;
        const enemyAI=gameTuning.enemyAI||{},incoming=enemyAI.incomingDamage||{};
        const rawDamage=incoming.skeleton??incoming.default??2;
        const cooldownMs=1550+Math.random()*550;
        minion.dataset.spiderMinionNextAttack=String(now+cooldownMs);minion.dataset.lastAttack=String(now);minion.dataset.actionUntil=String(now+420);
        const img=minion.querySelector('.enemySprite');if(img)img.src=enemySpritePath('chapter2_boss_2','attack');
        minion.classList.add('enemy-attacking');
        spiderLater(()=>{if(minion.isConnected&&!minion.classList.contains('dead')){minion.classList.remove('enemy-attacking');const sp=minion.querySelector('.enemySprite');if(sp)sp.src=enemySpritePath('chapter2_boss_2','normal');}},420);
        if(jumpT===0){
            if(performance.now()<bashLockUntil)floatText('0',x,28);
            else {
                const previousHP=hp;hp=spiderClampFinalHP(previousHP,Math.max(0,hp-Math.ceil(rawDamage/5)));
                floatText('−'+(previousHP-hp),x,28);updateHud();
            }
        }
    }
    function spiderMinionTriple(minion,now){
        const cfg=SPIDER_SKILL_TUNING.triple,token=spiderBossSkill.token,castMs=cfg.chargeMs+cfg.activeMs;
        minion.dataset.spiderMinionCasting='1';minion.dataset.spiderMinionCastingUntil=String(now+castMs);minion.dataset.spiderMinionNextAttack=String(now+6800+Math.random()*900);minion.dataset.actionUntil=String(now+castMs);
        const sourceX=()=> (+minion.dataset.x)+(minion.offsetWidth||75)*.5,targets=spiderRandomLandingTargets();
        targets.forEach((target,i)=>spiderLater(()=>{
            if(token!==spiderBossSkill.token||!running||hp<=0||!minion.isConnected||minion.classList.contains('dead'))return;
            // 蜘蛛小弟的毒三連第一發真正射出時播放 boss2 attack 音效；不是在蓄力開始時播放。
            if(i===0)spiderPlayOneShotIndependent(spiderBossAudio.triple);
            const img=minion.querySelector('.enemySprite');if(img)img.src=SPIDER_ASSET_DIR+'chapter2_boss_2_'+(Math.random()<.5?'skin1':'skin2')+'.png';
            spiderProjectile(sourceX(),target,cfg.damage,cfg.flightMs||1180,token,minion);
        },cfg.chargeMs+i*cfg.shotIntervalMs));
    }
    // 召喚蜘蛛都有自己的 HP、移動與攻擊節奏；40% 階段純普通攻擊，20% 階段混合普通／三連噴射。
    function updateSpiderMinionSkill(minion,now,dt=16){
        if(!minion||!minion.isConnected||minion.classList.contains('dead')||!running||hp<=0)return;
        const img=minion.querySelector('.enemySprite');
        if(minion.dataset.spiderMinionCasting==='1'){
            if(now>=+(minion.dataset.spiderMinionCastingUntil||0)){minion.dataset.spiderMinionCasting='0';if(img&&!minion.classList.contains('dead'))img.src=enemySpritePath('chapter2_boss_2','normal');}
            else return;
        }
        let mx=+(minion.dataset.x||0);const mw=minion.offsetWidth||75,mCenter=mx+mw*.5,hCenter=spiderHeroCenter(),delta=hCenter-mCenter,range=stageW*.075;
        // 小蜘蛛沿用 chapter2_boss_2 原圖（原圖朝左）：class 只在需要面向右方時翻轉，故與 facing 相反。
        const facesLeft=delta<0;minion.dataset.facing=facesLeft?'left':'right';minion.classList.toggle('enemy-facing-left',!facesLeft);
        if(Math.abs(delta)>range){
            const speed=(gameTuning.enemyAI?.approachSpeed?.default??.15)*.82;
            mx=Math.max(24,Math.min(heroExitX()-mw, mx+Math.sign(delta)*dt*speed));minion.dataset.x=String(mx);minion.style.left=mx+'px';
            if(img&&now>=+(minion.dataset.actionUntil||0)){const frame=1+(Math.floor(now/150)%4);img.src=enemySpritePath('chapter2_boss_2','walk'+frame);}
            return;
        }
        if(now<+(minion.dataset.spiderMinionNextAttack||0))return;
        const mode=minion.dataset.spiderMinionMode||'normal';
        if(mode==='mixed'&&Math.random()<.38)spiderMinionTriple(minion,now);
        else spiderMinionNormalAttack(minion,now);
    }
    function spiderSpawnMinions(mode,count,wave,totalWaves,randomized=false){
        const viewportLeft=Math.max(0,cameraX+24),viewportRight=Math.max(viewportLeft,Math.min(Math.max(0,worldW-170),cameraX+stageW-170));
        const enemyHP=gameTuning.enemyHP||{default:2},positions=[];
        if(randomized){
            const minGap=Math.min(100,Math.max(42,(viewportRight-viewportLeft)/Math.max(1,count)*.68));
            const heroL=x-80,heroR=x+(hero.offsetWidth||72)+80;
            for(let i=0;i<count;i++){
                let candidate=viewportLeft,found=false;
                for(let attempt=0;attempt<100;attempt++){
                    candidate=viewportLeft+Math.random()*Math.max(0,viewportRight-viewportLeft);
                    const overlapsHero=candidate+75>heroL&&candidate<heroR;
                    if(!overlapsHero&&!positions.some(px=>Math.abs(px-candidate)<minGap)){found=true;break;}
                }
                if(!found){
                    // 狹窄舞台時使用分散的備援落點，確保 8 隻都會生成。
                    const slot=(i+.5)/count;candidate=viewportLeft+(viewportRight-viewportLeft)*slot;
                }
                positions.push(Math.max(viewportLeft,Math.min(viewportRight,candidate)));
            }
        }else{
            for(let i=0;i<count;i++)positions.push(Math.max(viewportLeft,Math.min(viewportRight,viewportLeft+(viewportRight-viewportLeft)*((i+.5)/count))));
        }
        for(let i=0;i<count;i++){
            const minion=document.createElement('div');minion.className='enemy enemy-spider-minion spider-minion';
            minion.innerHTML='<div class="enemy-name">蜘小弟</div><div class="ehealth"><i></i></div><div class="enemy-art"><img class="enemySprite" src="'+enemySpritePath('chapter2_boss_2','idle')+'" alt="蜘蛛小弟"></div>';
            const px=positions[i];
            // 小蜘蛛原圖本身朝左；與一般敵人的 facing class 規則相反，避免生成時整批背向玩家。
            const facesLeft=px+75*.5>spiderHeroCenter();
            minion.dataset.x=String(px);minion.dataset.type='skeleton';minion.dataset.spriteType='chapter2_boss_2';minion.dataset.boss='0';minion.dataset.spiderMinion='1';minion.dataset.spiderWave=String(wave);minion.dataset.rank='normal';minion.dataset.facingLocked='0';minion.dataset.facing=facesLeft?'left':'right';minion.classList.toggle('enemy-facing-left',!facesLeft);minion.dataset.lastAttack='0';minion.dataset.spiderMinionCasting='0';minion.dataset.spiderMinionCastingUntil='0';minion.dataset.spiderMinionMode=mode;minion.dataset.spiderMinionNextAttack=String(performance.now()+950+Math.random()*1050);
            const hpVal=Math.max(1,Number(enemyHP.skeleton??enemyHP.default??2));minion.dataset.hp=String(hpVal);minion.dataset.maxhp=String(hpVal);minion.style.left=px+'px';
            const img=minion.querySelector('.enemySprite');if(img)img.onerror=()=>{img.style.visibility='hidden';};
            const health=minion.querySelector('.ehealth i');if(health)health.style.width='100%';
            enemies.appendChild(minion);enemyList.push(minion);
        }
        if(randomized)floatText('60% 隨機召喚・'+count+' 隻蜘小弟！',spiderHeroCenter(),62);
        else floatText(mode==='normal'?'蜘小弟・8 隻來襲！':'蜘小弟第 '+wave+'/'+totalWaves+' 波：4 隻！',spiderHeroCenter(),62);
    }
    function spiderBeginReturn(e,now,side){
        const bossW=e.offsetWidth||300;spiderBossSkill.phase='broodReturn';spiderBossSkill.phaseStartedAt=now;spiderBossSkill.active=true;
        spiderBossSkill.returnSide=side;
        if(side==='left'){
            spiderBossSkill.returnStartX=cameraX-bossW*.78;spiderBossSkill.returnTargetX=Math.max(24,cameraX+stageW*.13);
        }else{
            spiderBossSkill.returnStartX=Math.min(Math.max(0,worldW-bossW*.25),cameraX+stageW+bossW*.22);spiderBossSkill.returnTargetX=Math.max(0,Math.min(worldW-bossW,cameraX+stageW*.62));
        }
        spiderBossSkill.returnDuration=Math.max(800,Math.abs(spiderBossSkill.returnTargetX-spiderBossSkill.returnStartX)/(SPIDER_SKILL_TUNING[spiderBossSkill.broodMode]?.returnSpeed||.24));
        e.classList.remove('spider-boss-lifting','spider-boss-brood-hidden');e.classList.add('spider-boss-returning');
        e.style.removeProperty('visibility');e.style.removeProperty('opacity');e.style.removeProperty('transform');
        e.dataset.x=String(spiderBossSkill.returnStartX);e.style.left=e.dataset.x+'px';e.dataset.facingLocked='0';spiderFacePlayer(e);
        spiderPose(e,'walk1');floatText(side==='left'?'蛛王從左方回來！':'蛛王從右方回來！',spiderBossSkill.returnTargetX,54);
    }
    function spiderStartSkill(e,skill,now){
        const cfg=SPIDER_SKILL_TUNING[skill];if(!cfg)return;
        // 60% 階段只召喚 8 隻隨機落點的小蜘蛛，不讓這個事件打斷 Boss 當前動作。
        if(skill==='minions60'){
            spiderSpawnMinions('normal',cfg.minionCount,60,1,true);
            return;
        }
        spiderBossSkill.boss=e;spiderBossSkill.active=true;spiderBossSkill.phase=skill==='brood40'?'brood40Exit':skill==='brood20'?'brood20Exit':skill;spiderBossSkill.phaseStartedAt=now;spiderBossSkill.didLaunch=false;spiderBossSkill.originalFacingLocked=e.dataset.facingLocked||'0';
        const cx=(+e.dataset.x)+(e.offsetWidth||300)*.5;spiderFacePlayer(e);e.dataset.facingLocked='1';
        if(skill==='triple'){
            e.dataset.actionUntil=String(now+cfg.chargeMs+cfg.activeMs);e.classList.add('spider-boss-charging');spiderPose(e,Math.random()<.5?'skin1':'skin2');floatText('腐蝕毒液・三連噴射！',cx,56);
        }else if(skill==='brood40'||skill==='brood20'){
            // 40% 與 20% 階段 Boss 上升離場時，各播放一次 run 音效。
            spiderPlayOneShotIndependent(spiderBossAudio.run);
            spiderBossSkill.broodMode=skill;spiderBossSkill.broodWave=0;e.dataset.actionUntil=String(now+cfg.chargeMs+140);e.classList.add('spider-boss-lifting');spiderPose(e,'runway1');floatText(skill==='brood40'?'蜘小弟・第一波（8 隻）！':'蜘小弟・第二波（3×4 隻）！',cx,56);
        }else if(skill==='ultimate'){
            // 戰鬥循環音效改在 Boss 的 5 秒必死大絕倒數開始時才啟動，不再於 80% HP 播放。
            spiderStartFightAudio();
            e.dataset.actionUntil=String(now+cfg.chargeMs);e.classList.add('spider-boss-charging','spider-boss-ultimate-charging');spiderPose(e,'skin2');spiderStartLastPhaseAnimation();
            const target=spiderHeroCenter(),width=Math.min(stageW*.64,Math.max(240,stageW*.64),stageH*.42*(743/355)),warningHeight=width/(743/355);
            spiderBossSkill.warningArea=spiderEffect('spider-ground-area spider-ultimate-warning-area',Math.max(0,target-width*.5),Math.max(0,stageH*.105),width,warningHeight,'poison_big_area');
            spiderBossSkill.warningArea.style.opacity='.5';
            spiderBossSkill.warning=spiderTextEffect('spider-ultimate-warning',Math.max(cameraX,target-width*.5),stageH*.47,width,58,'⚠ 萬毒蛛域 · 5 秒');
            spiderBossSkill.warning.dataset.targetX=String(target);floatText('毒男聖域・腐臭降臨！',cx,56);
        }
    }
    function spiderLaunchSkill(e,skill){
        const cfg=SPIDER_SKILL_TUNING[skill],token=spiderBossSkill.token;
        if(skill==='triple'){
            // 三連毒真正開始發射時播放一次，不在蓄力時提早播放。
            spiderPlayOneShot(spiderBossAudio.triple);
            const targets=spiderRandomLandingTargets();
            targets.forEach((target,i)=>spiderLater(()=>{
                if(token!==spiderBossSkill.token||!running||hp<=0||!e.isConnected||e.classList.contains('dead'))return;
                spiderPose(e,Math.random()<.5?'skin1':'skin2');spiderProjectile((+e.dataset.x)+(e.offsetWidth||300)*.5,target,cfg.damage,cfg.flightMs,token,e);
            },i*cfg.shotIntervalMs));
        }
    }
    function spiderActivateToxicDomain(e,now){
        if(!e||!e.isConnected||e.classList.contains('dead')||!running||hp<=0)return;
        spiderBossSkill.ultimateActivated=true;spiderStartLastPhaseAnimation();
        const token=spiderBossSkill.token,target=Number(spiderBossSkill.warning?.dataset.targetX??spiderHeroCenter());
        spiderRemoveEffect(spiderBossSkill.warning);spiderRemoveEffect(spiderBossSkill.warningArea);
        // Boss 已離開戰場後才開始全畫面毒霧；使用真正的大範圍毒網 PNG，不拉伸比例。
        const full=spiderStageEffect('spider-ultimate-fullscreen','poison_big_area');full.style.left='0';full.style.top='0';
        const overlay=document.createElement('div');overlay.className='spider-skill-effect spider-toxic-screen-overlay';overlay.setAttribute('aria-hidden','true');stage.appendChild(overlay);spiderBossSkill.effects.add(overlay);
        document.body.classList.add('spider-apocalypse');hero.classList.add('spider-toxic-glow');keys.left=false;keys.right=false;moveV=0;jumpBufferMs=0;jumpV=0;jumpY=0;jumpT=0;onGround=true;hero.classList.remove('jump');hero.style.setProperty('bottom',gameTuning.player?.groundBottom||'14%','important');
        spiderBossSkill.phase='ultimateImpact';spiderBossSkill.phaseStartedAt=now;spiderBossSkill.didLaunch=true;e.dataset.actionUntil=String(now+100000);spiderBossSkill.lastPoisonTick=now;
        if(spiderBossSkill.poisonInterval)spiderClearInterval(spiderBossSkill.poisonInterval);
        spiderBossSkill.poisonInterval=setInterval(()=>{
            if(token!==spiderBossSkill.token||!running||hp<=0||!document.body.classList.contains('spider-apocalypse')){spiderClearInterval(spiderBossSkill.poisonInterval);return;}
            // 下降四格與落地 normal 必須完整播完；期間暫停毒霧扣血，防止提早死亡或跳過動畫。
            if(spiderIsDescending())return;
            const previousHP=hp;hp=spiderClampFinalHP(previousHP,Math.max(0,hp-2));floatText('−'+(previousHP-hp),spiderHeroCenter(),34);updateHud();
            if(hp>0&&hp<=SPIDER_PLAYER_MAX_HP*.10&&!spiderBossSkill.awakeningTriggered)spiderStartAwakening(e,performance.now());
            if(spiderBossSkill.ultimateActivated&&hp<=SPIDER_PLAYER_MAX_HP*.05&&!spiderBossSkill.finalHit2Triggered&&spiderBossSkill.phase==='ultimateAwakened')spiderStartFinalHit2(e,performance.now());
            if(hp<=0){spiderBossSkill.killedHero=true;spiderClearInterval(spiderBossSkill.poisonInterval);}
        },350);
        if(spiderBossSkill.poisonInterval)spiderBossSkill.intervals.add(spiderBossSkill.poisonInterval);
        if(hp>0&&hp<=SPIDER_PLAYER_MAX_HP*.10&&!spiderBossSkill.awakeningTriggered)spiderStartAwakening(e,now);
        floatText('毒男聖域・腐臭降臨！',target,60);
    }
    function spiderStartAwakening(e,now){
        if(spiderBossSkill.awakeningTriggered||!e||!e.isConnected||e.classList.contains('dead'))return;
        spiderBossSkill.awakeningTriggered=true;spiderBossSkill.invulnerable=true;spiderBossSkill.active=true;spiderBossSkill.phase='awakeningRunway4';spiderBossSkill.phaseStartedAt=now;
        // Boss 開始從高處下降時播放動作音效；同一時刻保留原本的大絕攻擊音效。
        spiderPlayOneShotIndependent(spiderBossAudio.run);
        spiderPlayOneShot(spiderBossAudio.final);
        // 將已離場的 Boss 重新放回可見戰場，依 runway4 → runway3 → runway2 → runway1 → normal 完成下降。
        e.classList.remove('spider-boss-lifting','spider-boss-brood-hidden','spider-boss-returning');e.classList.add('spider-boss-awakening');
        e.style.removeProperty('visibility');e.style.removeProperty('opacity');e.style.removeProperty('transform');
        const bossW=e.offsetWidth||300,targetX=Math.max(24,Math.min(worldW-bossW-24,spiderHeroCenter()+stageW*.02-bossW*.5));
        e.dataset.x=String(targetX);e.style.left=targetX+'px';e.dataset.facingLocked='0';spiderFacePlayer(e);
        spiderPose(e,'runway4');e.dataset.actionUntil=String(now+SPIDER_SKILL_TUNING.awakening.runwayFrameMs*4+SPIDER_SKILL_TUNING.awakening.normalMs);
        floatText('蛛王・毒霧覺醒！',targetX,60);
    }
    // 終極技成功啟動後，玩家 HP 到 5% 時固定使用 hit2，直至玩家死亡／重新開始。
    function spiderStartFinalHit2(e,now){
        if(spiderBossSkill.finalHit2Triggered||!spiderBossSkill.ultimateActivated||!e||!e.isConnected||e.classList.contains('dead'))return false;
        if(!spiderBossSkill.awakeningTriggered){spiderStartAwakening(e,now);return false;}
        // 如果玩家在下降途中剛好到達 5%，先完成 runway4→runway3→runway2→runway1→normal。
        if(spiderIsDescending())return false;
        spiderBossSkill.finalHit2Triggered=true;spiderBossSkill.invulnerable=true;spiderBossSkill.active=true;spiderBossSkill.phase='ultimateDeathPose';spiderBossSkill.phaseStartedAt=now;
        e.classList.remove('spider-boss-lifting','spider-boss-brood-hidden','spider-boss-returning','spider-boss-awakening','spider-boss-charging','spider-boss-ultimate-charging');e.classList.add('spider-boss-final-hit2');
        e.style.removeProperty('visibility');e.style.removeProperty('opacity');e.style.removeProperty('transform');e.dataset.actionUntil=String(now+100000);
        clearTimeout(e._spriteTimer);e._spriteTimer=null;
        spiderPose(e,'hit2');return true;
    }
    function updateSpiderBossSkill(now){
        const e=spiderBossSkill.boss;
        if(!e||!e.isConnected||e.classList.contains('dead')||!running){if(e)resetSpiderBossSkill();return false;}
        // 大絕啟動後，即使技能正在執行，也要持續面向玩家。
        spiderFacePlayer(e);
        if(spiderBossSkill.ultimateActivated&&hp<=SPIDER_PLAYER_MAX_HP*.05&&!spiderBossSkill.finalHit2Triggered&&spiderBossSkill.phase==='ultimateAwakened')spiderStartFinalHit2(e,now);
        if(hp<=0)return true;
        if(spiderBossSkill.finalHit2Triggered){spiderPose(e,'hit2');return true;}
        if(!spiderBossSkill.active&&spiderBossSkill.queue.length)spiderStartSkill(e,spiderBossSkill.queue.shift(),now);
        if(!spiderBossSkill.active)return false;
        const skill=spiderBossSkill.phase,elapsed=Math.max(0,now-spiderBossSkill.phaseStartedAt);
        if(skill==='brood40Exit'||skill==='brood20Exit'){
            const cfg=SPIDER_SKILL_TUNING[skill==='brood40Exit'?'brood40':'brood20'];
            const frame=Math.min(4,1+Math.floor(elapsed/175));spiderPose(e,'runway'+frame);
            if(elapsed>=cfg.chargeMs){
                e.classList.remove('spider-boss-lifting');e.classList.add('spider-boss-brood-hidden');e.style.visibility='hidden';
                const wave=++spiderBossSkill.broodWave;spiderSpawnMinions(cfg.minionMode,cfg.minionCount,wave,cfg.totalWaves);
                spiderBossSkill.phase=skill==='brood40Exit'?'brood40Minions':'brood20Minions';spiderBossSkill.phaseStartedAt=now;
            }
            return true;
        }
        if(skill==='brood40Minions'||skill==='brood20Minions'){
            const currentWave=spiderBossSkill.broodWave,alive=enemyList.some(m=>m.dataset.spiderMinion==='1'&&Number(m.dataset.spiderWave)===currentWave&&!m.classList.contains('dead'));
            if(!alive){
                const cfg=SPIDER_SKILL_TUNING[spiderBossSkill.broodMode];
                if(currentWave<(cfg?.totalWaves||1)){
                    const wave=++spiderBossSkill.broodWave;spiderSpawnMinions(cfg.minionMode,cfg.minionCount,wave,cfg.totalWaves);
                }else spiderBeginReturn(e,now,cfg?.returnSide||'left');
            }
            return true;
        }
        if(skill==='broodReturn'){
            const p=Math.min(1,elapsed/Math.max(1,spiderBossSkill.returnDuration));
            const nx=spiderBossSkill.returnStartX+(spiderBossSkill.returnTargetX-spiderBossSkill.returnStartX)*p;
            e.dataset.x=String(nx);e.style.left=nx+'px';
            const frame=1+(Math.floor(elapsed/145)%4),img=e.querySelector('.enemySprite');if(img)img.src=enemySpritePath('chapter2_boss_2','walk'+frame);
            if(p>=1){
                e.classList.remove('spider-boss-returning');e.dataset.facingLocked=spiderBossSkill.originalFacingLocked||'0';
                spiderPose(e,'normal');spiderBossSkill.active=false;spiderBossSkill.phase='';spiderBossSkill.didLaunch=false;
            }
            return true;
        }
        if(skill==='ultimateAscend'){
            const frame=Math.min(4,1+Math.floor(elapsed/190));spiderPose(e,'runway'+frame);
            if(elapsed>=880){e.classList.remove('spider-boss-lifting');e.classList.add('spider-boss-brood-hidden');e.style.visibility='hidden';spiderActivateToxicDomain(e,now);}
            return true;
        }
        if(skill==='ultimateImpact')return true;
        if(/^awakeningRunway[4321]$/.test(skill)){
            const frame=Number(skill.slice(-1));spiderPose(e,'runway'+frame);
            if(elapsed>=SPIDER_SKILL_TUNING.awakening.runwayFrameMs){
                if(frame>1){
                    const nextFrame=frame-1;spiderBossSkill.phase='awakeningRunway'+nextFrame;spiderBossSkill.phaseStartedAt=now;spiderPose(e,'runway'+nextFrame);
                }else{
                    spiderBossSkill.phase='awakeningNormal';spiderBossSkill.phaseStartedAt=now;spiderPose(e,'normal');
                }
            }
            return true;
        }
        if(skill==='awakeningNormal'){
            spiderPose(e,'normal');
            if(elapsed>=SPIDER_SKILL_TUNING.awakening.normalMs){
                e.classList.remove('spider-boss-awakening');e.dataset.actionUntil=String(now);spiderBossSkill.phase='ultimateAwakened';spiderBossSkill.active=false;
            }
            return true;
        }
        const cfg=SPIDER_SKILL_TUNING[skill];if(!cfg)return false;
        if(skill==='ultimate'&&spiderBossSkill.warning){const left=Math.max(0,Math.ceil((cfg.chargeMs-elapsed)/1000));spiderBossSkill.warning.textContent='⚠ 萬毒蛛域 · '+left+' 秒';}
        if(skill==='triple'&&!spiderBossSkill.didLaunch&&elapsed>=cfg.chargeMs){spiderBossSkill.didLaunch=true;spiderLaunchSkill(e,skill);}
        if(skill==='ultimate'&&elapsed>=cfg.chargeMs){
            spiderRemoveEffect(spiderBossSkill.warning);spiderRemoveEffect(spiderBossSkill.warningArea);
            // 蛛王真正開始上升時，播放一次上升動作音效（短音效不循環）。
            spiderPlayOneShotIndependent(spiderBossAudio.run);
            e.classList.remove('spider-boss-charging','spider-boss-ultimate-charging','spider-boss-brood-hidden');e.classList.add('spider-boss-lifting');e.style.removeProperty('visibility');spiderPose(e,'runway1');
            spiderBossSkill.phase='ultimateAscend';spiderBossSkill.phaseStartedAt=now;spiderBossSkill.didLaunch=true;return true;
        }
        if(skill==='triple'&&elapsed>=cfg.chargeMs+cfg.activeMs){
            spiderBossSkill.active=false;spiderBossSkill.phase='';spiderBossSkill.didLaunch=false;e.classList.remove('spider-boss-charging');e.dataset.facingLocked=spiderBossSkill.originalFacingLocked||'0';
            if(!e.classList.contains('dead'))spiderPose(e,'normal');return true;
        }
        return true;
    }

    // 測試頁專用 API：僅在 test_level8.html 設定 GAME_TEST_DIRECT_BOSS=1 時公開。
    // 允許測試人員精確跳到階段，正式遊戲不會顯示或依賴這組函式。
    if(window.GAME_TEST_DIRECT_BOSS===1){
        window.__SPIDER_BOSS_TEST_API={
            getState(){
                const boss=enemyList.find(isSpiderBoss)||spiderBossSkill.boss;
                const minions=enemyList.filter(m=>m.dataset.spiderMinion==='1'&&!m.classList.contains('dead'));
                return {level,hp,maxPlayerHP:SPIDER_PLAYER_MAX_HP,bossHP:boss?Number(boss.dataset.hp):null,bossMaxHP:boss?Number(boss.dataset.maxhp):null,bossX:boss?Number(boss.dataset.x):null,bossVisibility:boss?getComputedStyle(boss).visibility:null,bossSprite:boss?.querySelector('.enemySprite')?.getAttribute('src')||null,phase:spiderBossSkill.phase,active:spiderBossSkill.active,triggered:[...spiderBossSkill.triggered],queued:[...spiderBossSkill.queue],broodWave:spiderBossSkill.broodWave,returnSide:spiderBossSkill.returnSide||null,returnStartX:spiderBossSkill.returnStartX,returnTargetX:spiderBossSkill.returnTargetX,aliveMinions:minions.length,aliveMinionsByWave:[1,2,3,60].map(w=>minions.filter(m=>Number(m.dataset.spiderWave)===w).length),toxic:document.body.classList.contains('spider-apocalypse'),invulnerable:spiderBossSkill.invulnerable,awakeningTriggered:spiderBossSkill.awakeningTriggered,ultimateActivated:spiderBossSkill.ultimateActivated,descending:spiderIsDescending(),descentSequence:['runway4','runway3','runway2','runway1','normal','hit2'],finalHit2Triggered:spiderBossSkill.finalHit2Triggered,fullscreenAnimation:!!spiderBossSkill.fullscreenAnimation?.isConnected,poisonTimerActive:!!spiderBossSkill.poisonInterval,effects:stage.querySelectorAll('.spider-skill-effect').length};
            },
            setBossHPPercent(percent){
                const boss=enemyList.find(isSpiderBoss)||spiderBossSkill.boss;if(!boss||boss.classList.contains('dead'))return false;
                const max=Math.max(1,Number(boss.dataset.maxhp)||80),target=Math.max(1,Math.min(max,Math.round(max*Math.max(0,Math.min(100,Number(percent)||0))/100)));
                const old=Math.max(1,Number(boss.dataset.hp)||max),next=applyEnemyDamage(boss,old-target);boss.dataset.hp=String(Math.max(1,next));
                const bar=boss.querySelector('.ehealth i');if(bar)bar.style.width=(Math.max(1,next)/max*100)+'%';updateBossHealthBar(boss);return true;
            },
            forcePhase(name){
                const boss=enemyList.find(isSpiderBoss)||spiderBossSkill.boss;if(!boss||boss.classList.contains('dead'))return false;
                spiderStopFightAudio();spiderBossSkill.token++;spiderClearEffects();
                enemyList.slice().forEach(m=>{if(m.dataset.spiderMinion==='1'){m.remove();const i=enemyList.indexOf(m);if(i>=0)enemyList.splice(i,1);}});
                boss.classList.remove('spider-boss-charging','spider-boss-ultimate-charging','spider-boss-lifting','spider-boss-returning','spider-boss-brood-hidden','spider-boss-awakening','spider-boss-final-hit2');boss.style.removeProperty('visibility');boss.style.removeProperty('opacity');boss.style.removeProperty('transform');
                spiderBossSkill.boss=boss;spiderBossSkill.active=false;spiderBossSkill.phase='';spiderBossSkill.didLaunch=false;spiderBossSkill.queue.length=0;spiderBossSkill.triggered.clear();spiderBossSkill.broodWave=0;spiderBossSkill.broodMode='';spiderBossSkill.killedHero=false;spiderBossSkill.invulnerable=false;spiderBossSkill.awakeningTriggered=false;spiderBossSkill.ultimateActivated=false;spiderBossSkill.finalHit2Triggered=false;spiderBossSkill.goddessDeadAudioPlayed=false;spiderBossSkill.fullscreenAnimation=null;document.body.classList.remove('spider-apocalypse');hero.classList.remove('spider-toxic-glow');
                const thresholds={triple:75,minions60:60,brood40:39,brood20:19,ultimate:9};if(!(name in thresholds))return false;
                const prior={triple:[],minions60:['triple'],brood40:['triple','minions60'],brood20:['triple','minions60','brood40'],ultimate:['triple','minions60','brood40','brood20']};(prior[name]||[]).forEach(k=>spiderBossSkill.triggered.add(k));spiderBossSkill.triggered.add(name);
                const max=Number(boss.dataset.maxhp)||80;boss.dataset.hp=String(Math.max(1,Math.round(max*thresholds[name]/100)));const bar=boss.querySelector('.ehealth i');if(bar)bar.style.width=(Number(boss.dataset.hp)/max*100)+'%';updateBossHealthBar(boss);
                if(name==='ultimate')hp=100;updateHud();spiderStartSkill(boss,name,performance.now());return true;
            },
            startToxicDomain(){
                const boss=enemyList.find(isSpiderBoss)||spiderBossSkill.boss;if(!boss||boss.classList.contains('dead'))return false;
                spiderBossSkill.token++;spiderClearEffects();enemyList.slice().forEach(m=>{if(m.dataset.spiderMinion==='1'){m.remove();const i=enemyList.indexOf(m);if(i>=0)enemyList.splice(i,1);}});spiderBossSkill.boss=boss;spiderBossSkill.active=true;spiderBossSkill.phase='ultimate';spiderBossSkill.didLaunch=false;spiderBossSkill.warning=null;spiderBossSkill.warningArea=null;spiderBossSkill.ultimateActivated=false;spiderBossSkill.finalHit2Triggered=false;spiderBossSkill.goddessDeadAudioPlayed=false;spiderStartLastPhaseAnimation();spiderBossSkill.triggered.add('triple');spiderBossSkill.triggered.add('brood40');spiderBossSkill.triggered.add('brood20');spiderBossSkill.triggered.add('ultimate');
                boss.classList.remove('spider-boss-lifting','spider-boss-brood-hidden','spider-boss-returning','spider-boss-awakening');boss.style.removeProperty('visibility');boss.dataset.hp=String(Math.max(1,Math.round(Number(boss.dataset.maxhp||80)*.09)));updateBossHealthBar(boss);boss.classList.add('spider-boss-brood-hidden');boss.style.visibility='hidden';spiderActivateToxicDomain(boss,performance.now());return true;
            },
            setPlayerHP(value){hp=Math.max(0,Math.min(SPIDER_PLAYER_MAX_HP,Number(value)||0));updateHud();if(hp<=0&&document.body.classList.contains('spider-apocalypse')){spiderBossSkill.killedHero=true;spiderClearInterval(spiderBossSkill.poisonInterval);}return hp;},
            placePlayerNearBoss(){
                const boss=enemyList.find(isSpiderBoss)||spiderBossSkill.boss;if(!boss||boss.classList.contains('dead'))return false;
                x=Math.max(24,Math.min(heroExitX()-120,(Number(boss.dataset.x)||0)-stageW*.05));keys.left=false;keys.right=false;moveV=0;faceDir=1;hero.style.left=x+'px';hero.classList.remove('face-left');return x;
            },
            placePlayerNearMinion(index=0){
                const minions=enemyList.filter(m=>m.dataset.spiderMinion==='1'&&!m.classList.contains('dead'));const m=minions[Math.max(0,Number(index)||0)];if(!m)return false;
                const mx=Number(m.dataset.x)||0,mw=m.offsetWidth||75,hw=hero.offsetWidth||116,desired=mx+mw*.5-hw*.5-50;
                if(desired>=24){x=Math.min(heroExitX()-hw,desired);faceDir=1;hero.classList.remove('face-left');}else{x=Math.max(24,Math.min(heroExitX()-hw,mx+mw*.5-hw*.5+50));faceDir=-1;hero.classList.add('face-left');}
                keys.left=false;keys.right=false;moveV=0;hero.style.left=x+'px';return {x,minionX:mx,hp:Number(m.dataset.hp),maxhp:Number(m.dataset.maxhp),wave:Number(m.dataset.spiderWave)};
            },
            createPoisonPoolForTest(){hp=SPIDER_PLAYER_MAX_HP;updateHud();x=24;keys.left=false;keys.right=false;moveV=0;hero.style.left=x+'px';const boss=enemyList.find(isSpiderBoss)||spiderBossSkill.boss;if(boss){boss.style.visibility='hidden';boss.classList.add('spider-boss-brood-hidden');}return !!spiderMakeArea(spiderHeroCenter(),220,3000,4,'poison');},
            damageBossForTest(damage=999){
                const boss=enemyList.find(isSpiderBoss)||spiderBossSkill.boss;if(!boss||boss.classList.contains('dead'))return false;
                const current=Math.max(0,Number(boss.dataset.hp)||0),next=applyEnemyDamage(boss,Math.max(0,Number(damage)||0));boss.dataset.hp=String(Math.max(0,next));
                const bar=boss.querySelector('.ehealth i');if(bar)bar.style.width=(Math.max(0,next)/Math.max(1,Number(boss.dataset.maxhp)||1)*100)+'%';updateBossHealthBar(boss);
                if(next<=0){clearTimeout(boss._spriteTimer);clearEnemyFlash(boss);boss.classList.remove('enemy-hit','enemy-attacking');boss.classList.add('dead');const sprite=boss.querySelector('.enemySprite');if(sprite)sprite.src=enemySpritePath(boss.dataset.spriteType||boss.dataset.type,'hit');kills++;levelKills++;resetSpiderBossSkill();}
                updateHud();return {hp:Math.max(0,next),dead:boss.classList.contains('dead')};
            },
            killCurrentMinions(){let n=0;enemyList.forEach(m=>{if(m.dataset.spiderMinion==='1'&&!m.classList.contains('dead')){m.dataset.hp='0';m.classList.add('dead');n++;}});return n;}
        };
    }

    // ===== 第一章 Boss：長血條與 80/60/40/20% 衝刺絕招 =====
    const chapter1BossRushChargeSprite='images/enemies/custom/boss/chapter1_boss_1_attack_skin2.png';
    const chapter1BossRushDashSprite='images/enemies/custom/boss/chapter1_boss_1_attack_skin%201.png';
    const chapter1BossRushChargePreload=new Image();
    chapter1BossRushChargePreload.src=chapter1BossRushChargeSprite;
    // 集氣使用 skin2；衝刺時切回 skin 1。若專用集氣圖未放入專案，才以 skin 1 作安全後備。
    function setBossRushSprite(sprite, phase='windup') {
        if(!sprite)return;
        if(phase==='dashOut'||phase==='dashAcross') {
            sprite.src=chapter1BossRushDashSprite;
        } else {
            sprite.src=(chapter1BossRushChargePreload.complete && chapter1BossRushChargePreload.naturalWidth)
                ? chapter1BossRushChargeSprite : chapter1BossRushDashSprite;
        }
    }
    // 集氣期間把整張角色圖由原色逐漸染成強烈紅色，並同步增強紅色外發光。
    // progress 範圍為 0..1；只處理 Boss 精靈本身，不改變尺寸、位置或碰撞判定。
    function setBossChargeRedGlow(e,progress) {
        const sprite=e?.querySelector('.enemySprite');
        if(!sprite)return;
        const p=Math.max(0,Math.min(1,Number(progress)||0));
        const glow1=(2+18*p).toFixed(1);
        const glow2=(1+28*p).toFixed(1);
        const alpha1=(0.03+0.78*p).toFixed(2);
        const alpha2=(0.01+0.48*p).toFixed(2);
        sprite.style.filter=`grayscale(${(0.55*p).toFixed(3)}) sepia(${p.toFixed(3)}) saturate(${(1+7*p).toFixed(2)}) hue-rotate(${(-42*p).toFixed(1)}deg) brightness(${(1+0.13*p).toFixed(3)}) drop-shadow(0 0 ${glow1}px rgba(255, 0, 28, ${alpha1})) drop-shadow(0 0 ${glow2}px rgba(255, 0, 20, ${alpha2}))`;
    }
    function clearBossChargeRedGlow(e) {
        const sprite=e?.querySelector('.enemySprite');
        if(sprite)sprite.style.removeProperty('filter');
    }
    function isChapter1FinalBoss(e) {
        return level===4 && !!e && e.dataset.boss==='1' && e.dataset.spriteType==='boss';
    }
    function removeChapter1FinalEffects() {
        world.querySelectorAll('.boss1-final-storm,.boss1-final-sword,.boss1-final-impact,.boss1-final-shockwave').forEach(el=>el.remove());
    }
    function resetChapter1FinalSkill() {
        // 玩家在蓄力期間擊敗 Boss 時，立即停止尚未播完的血紅巨劍音效。
        if(chapter1FinalSkill.chargeSfx) {
            try {
                chapter1FinalSkill.chargeSfx.pause();
                chapter1FinalSkill.chargeSfx.currentTime=0;
            } catch (_) {}
        }
        const oldBoss=chapter1FinalSkill.boss;
        if(oldBoss && oldBoss.isConnected) {
            oldBoss.classList.remove('boss1-final-charging');
            clearBossChargeRedGlow(oldBoss);
            oldBoss.classList.remove('boss1-final-frozen');
            if(!oldBoss.classList.contains('dead'))oldBoss.dataset.facingLocked=chapter1FinalSkill.originalFacingLocked||'0';
        }
        hero.classList.remove('boss1-final-killed');
        removeChapter1FinalEffects();
        Object.assign(chapter1FinalSkill,{triggered:false,active:false,phase:'',phaseStartedAt:0,boss:null,cameraAnchor:null,targetX:0,storm:null,sword:null,impact:null,shockwave:null,killedHero:false,originalFacingLocked:'0',swordHeight:0,swordWidth:0,chargeSfx:null,chargeSfxPlayed:false});
    }
    function stopBossRushForFinalSkill(e) {
        clearTimeout(bossRush.nextTimer);bossRush.nextTimer=0;bossRush.cooldownUntil=0;
        const oldBoss=bossRush.boss;
        if(oldBoss && oldBoss.isConnected) {
            oldBoss.classList.remove('boss-rushing');
            oldBoss.style.removeProperty('opacity');oldBoss.style.removeProperty('visibility');
            clearBossChargeRedGlow(oldBoss);
        }
        bossRush.active=false;bossRush.boss=null;bossRush.phase='';bossRush.runStartedAt=0;bossRush.cameraAnchor=null;
        bossRush.currentThreshold=0;bossRush.queue=[];
        clearTimeout(bossShakeTimer);stage.classList.remove('boss-camera-shake');
        if(e && e.isConnected) {
            e.classList.remove('boss-rushing');
            e.style.removeProperty('opacity');e.style.removeProperty('visibility');
            clearBossChargeRedGlow(e);
            clearTimeout(e._spriteTimer);
        }
    }
    function createChapter1FinalStorm() {
        const storm=document.createElement('div');
        storm.className='boss1-final-storm';
        storm.setAttribute('aria-hidden','true');
        storm.innerHTML='<div class="boss1-final-vortex"></div><div class="boss1-final-energy-beam"></div><div class="boss1-final-warning"><strong>世界末日・血紅巨劍</strong><span class="boss1-final-countdown">紅色能量正在匯聚 · 5 秒</span></div>';
        storm.style.left=cameraX+'px';
        storm.style.width=stageW+'px';
        storm.style.setProperty('--boss1-energy-x',Math.max(0,Math.min(stageW,chapter1FinalSkill.targetX-cameraX))+'px');
        world.appendChild(storm);
        chapter1FinalSkill.storm=storm;
    }
    function startChapter1FinalSkill(e) {
        if(!isChapter1FinalBoss(e) || chapter1FinalSkill.triggered || e.classList.contains('dead') || !running)return false;
        chapter1FinalSkill.triggered=true;
        chapter1FinalSkill.active=true;
        chapter1FinalSkill.phase='charge';
        chapter1FinalSkill.phaseStartedAt=performance.now();
        chapter1FinalSkill.boss=e;
        chapter1FinalSkill.cameraAnchor=cameraX;
        chapter1FinalSkill.targetX=x;
        chapter1FinalSkill.killedHero=false;
        chapter1FinalSkill.originalFacingLocked=e.dataset.facingLocked||'0';
        stopBossRushForFinalSkill(e);
        e.dataset.facingLocked='1';
        e.classList.add('boss1-final-charging','boss1-final-frozen');
        e.dataset.lastAttack=String(chapter1FinalSkill.phaseStartedAt);
        e.dataset.actionUntil=String(chapter1FinalSkill.phaseStartedAt+CHAPTER1_FINAL_CHARGE_MS+CHAPTER1_FINAL_DROP_MS+CHAPTER1_FINAL_HIT_DELAY_MS);
        setBossChargeRedGlow(e,0);
        // 將玩家停在觸發當刻的位置；保留其當前垂直位置，不瞬移、不重設尺寸。
        keys.left=false;keys.right=false;moveV=0;jumpBufferMs=0;
        createChapter1FinalStorm();
        floatText('世界末日・血紅巨劍！',x,62);
        return true;
    }
    function applyEnemyDamage(e,damage) {
        const currentHP=Math.max(0,Number(e.dataset.hp)||0);
        let next=currentHP-damage;
        if(isSpiderBoss(e)){
            spiderBossSkill.boss=e;
            // 玩家 HP 到 10% 後的覺醒模式：真正無敵，所有來源傷害均不能改變 Boss HP。
            if(spiderBossSkill.invulnerable||spiderBossSkill.phase==='ultimateAscend'||spiderBossSkill.phase==='ultimateImpact')return currentHP;
            // 倒數滿 5 秒就應立即進入毒霧；只允許倒數結束前把 Boss 擊殺。
            if(spiderBossSkill.active&&spiderBossSkill.phase==='ultimate'&&performance.now()-spiderBossSkill.phaseStartedAt>=SPIDER_SKILL_TUNING.ultimate.chargeMs)return currentHP;
            const maxHP=Math.max(1,Number(e.dataset.maxhp)||1);
            if(next>0){
                Object.entries(SPIDER_SKILL_TUNING).forEach(([skill,cfg])=>{
                    if(Number.isFinite(cfg.threshold)&&!spiderBossSkill.triggered.has(skill)&&next<=maxHP*cfg.threshold){
                        spiderBossSkill.triggered.add(skill);spiderBossSkill.queue.push(skill);
                    }
                });
            }
            return next;
        }
        if(!isChapter1FinalBoss(e))return next;
        const maxHP=Math.max(1,+e.dataset.maxhp||100);

        // 5 秒蓄勢是玩家最後的反擊窗口：蓄勢期間仍可正常削減 Boss HP。
        // 若這段時間把 Boss 打至 0，立即取消必殺技，讓原有死亡流程接手。
        if(chapter1FinalSkill.active) {
            if(chapter1FinalSkill.phase==='charge') {
                if(next<=0) {
                    resetChapter1FinalSkill();
                    return next;
                }
                return next;
            }
            // 5 秒蓄勢已完成、巨劍開始落下後，保留 1 HP 直到必殺技流程結束，
            // 避免落劍動畫途中 Boss 提前死亡而留下未完成的畫面特效。
            return Math.max(1,next);
        }

        // 只有 Boss 存活且第一次降至 10% 或以下，才開始 5 秒蓄勢。
        // 若單次攻擊直接將 Boss 從 10% 以上打至 0，則照常擊敗，不啟動必殺技。
        if(!chapter1FinalSkill.triggered && next>0 && next<=maxHP*0.10) {
            startChapter1FinalSkill(e);
            if(chapter1FinalSkill.active)return next;
        }
        return next;
    }
    function spawnChapter1FinalSword(now) {
        chapter1FinalSkill.targetX=x;
        const sword=document.createElement('img');
        sword.className='boss1-final-sword';
        sword.src='images/effects/boss1_final_sword.png';
        sword.alt='';sword.setAttribute('aria-hidden','true');
        const swordHeight=Math.max(stageH*1.32,420);
        const swordWidth=swordHeight*(344/1083);
        chapter1FinalSkill.swordHeight=swordHeight;
        chapter1FinalSkill.swordWidth=swordWidth;
        sword.style.width=swordWidth+'px';
        sword.style.height=swordHeight+'px';
        sword.style.left=(chapter1FinalSkill.targetX-swordWidth/2)+'px';
        sword.style.top=(-swordHeight)+'px';
        world.appendChild(sword);
        chapter1FinalSkill.sword=sword;
        if(chapter1FinalSkill.storm) {
            chapter1FinalSkill.storm.classList.add('boss1-final-launch');
            const countdown=chapter1FinalSkill.storm.querySelector('.boss1-final-countdown');
            if(countdown)countdown.textContent='蓄勢完成！巨劍落下';
        }
        void sword.offsetHeight;
        requestAnimationFrame(()=>{
            if(!chapter1FinalSkill.active || chapter1FinalSkill.sword!==sword)return;
            const groundY=stageH*0.86;
            sword.style.top=(groundY-swordHeight)+'px';
            sword.classList.add('falling');
        });
        chapter1FinalSkill.phase='fall';
        chapter1FinalSkill.phaseStartedAt=now;
    }
    function spawnChapter1FinalImpact(now) {
        const impact=document.createElement('img');
        impact.className='boss1-final-impact';
        impact.src='images/effects/boss1_final_impact.png';
        impact.alt='';impact.setAttribute('aria-hidden','true');
        const width=Math.max(stageW*1.36,stageH*2.35);
        impact.style.width=width+'px';
        impact.style.height=(width*(802/1484))+'px';
        impact.style.left=(chapter1FinalSkill.targetX-width/2)+'px';
        impact.style.bottom=Math.max(0,stageH*0.03)+'px';
        world.appendChild(impact);
        chapter1FinalSkill.impact=impact;
        const shockwave=document.createElement('div');
        shockwave.className='boss1-final-shockwave';
        shockwave.style.left=(chapter1FinalSkill.targetX-Math.max(stageW*.12,90)/2)+'px';
        shockwave.style.width=Math.max(stageW*.12,90)+'px';
        world.appendChild(shockwave);
        chapter1FinalSkill.shockwave=shockwave;
        if(chapter1FinalSkill.storm)chapter1FinalSkill.storm.classList.add('boss1-final-impact-flash');
        if(chapter1FinalSkill.sword)chapter1FinalSkill.sword.classList.add('planted');
        if(chapter1FinalSkill.storm) {
            const countdown=chapter1FinalSkill.storm.querySelector('.boss1-final-countdown');
            if(countdown)countdown.textContent='巨劍命中！';
        }
        floatText('巨劍墜落！',chapter1FinalSkill.targetX,70);
        chapter1FinalSkill.phase='impact';
        chapter1FinalSkill.phaseStartedAt=now;
    }
    function updateChapter1FinalSkill(now) {
        if(!chapter1FinalSkill.active)return;
        const e=chapter1FinalSkill.boss;
        if(!e || !e.isConnected)return;
        if(chapter1FinalSkill.phase==='charge') {
            const elapsed=Math.max(0,now-chapter1FinalSkill.phaseStartedAt);
            setBossChargeRedGlow(e,Math.min(1,elapsed/CHAPTER1_FINAL_CHARGE_MS));
            // 紅光首次出現後 1 秒才播放 crash2.mp3；若 Boss 已被玩家擊敗，reset 會取消此流程。
            if(elapsed>=(tuneEffects.boss1FinalSfxDelayMs ?? 1000) && !chapter1FinalSkill.chargeSfxPlayed && !e.classList.contains('dead')) {
                chapter1FinalSkill.chargeSfxPlayed=true;
                try {
                    const chargeSfx=new Audio('audio/crash2.mp3');
                    chargeSfx.volume=0.7;
                    chargeSfx.currentTime=0;
                    chapter1FinalSkill.chargeSfx=chargeSfx;
                    const playResult=chargeSfx.play();
                    if(playResult && typeof playResult.catch==='function')playResult.catch(()=>{});
                } catch (_) {}
            }
            const countdown=chapter1FinalSkill.storm?.querySelector('.boss1-final-countdown');
            if(countdown)countdown.textContent='紅色能量正在匯聚 · '+Math.max(0,Math.ceil((CHAPTER1_FINAL_CHARGE_MS-elapsed)/1000))+' 秒';
            if(elapsed>=CHAPTER1_FINAL_CHARGE_MS)spawnChapter1FinalSword(now);
        } else if(chapter1FinalSkill.phase==='fall') {
            if(now-chapter1FinalSkill.phaseStartedAt>=CHAPTER1_FINAL_DROP_MS)spawnChapter1FinalImpact(now);
        } else if(chapter1FinalSkill.phase==='impact') {
            if(now-chapter1FinalSkill.phaseStartedAt>=CHAPTER1_FINAL_HIT_DELAY_MS) {
                // 接觸後完整延遲 1 秒才直接判定死亡，不在巨劍剛落地時提前扣血。
                chapter1FinalSkill.killedHero=true;
                chapter1FinalSkill.phase='done';
                hp=0;
                hero.classList.add('boss1-final-killed');
                updateHud();
            }
        }
    }
    // 第一章 Boss 的原始立繪本身朝左；enemy-facing-left 會水平翻轉立繪，因此不能用「移動方向」直接決定回場時的朝向。
    function faceBossTowardHero(e) {
        if(!e)return;
        const bossCenter=(Number.isFinite(+e.dataset.x)?+e.dataset.x:0)+(e.offsetWidth||100)*.5;
        const heroCenter=x+(hero.offsetWidth||55)*.5;
        const heroIsRight=heroCenter>bossCenter;
        e.classList.toggle('enemy-facing-left',heroIsRight);
        e.dataset.facing=heroIsRight?'right':'left';
    }
    function bossReturnX(e) {
        const width=Math.max(100,e?.offsetWidth||100);
        const min=cameraX+stageW*.61-width*.5;
        const max=cameraX+stageW*.78-width*.5;
        const origin=Number.isFinite(+bossRush.originX)?+bossRush.originX:(Number.isFinite(+(e?.dataset.x))?+(e.dataset.x):cameraX+stageW*.7);
        return Math.max(0,Math.min(Math.max(0,worldW-width),Math.max(min,Math.min(origin,max))));
    }
    // 絕招結束後直接在可視戰場內步行返回；不再有隱藏、透明或畫面外重新進場的流程。
    function beginBossWalkBack(e,now) {
        if(!e||!e.isConnected||e.classList.contains('dead'))return;
        bossRush.phase='walkback';
        bossRush.phaseStartedAt=now;
        const sprite=e.querySelector('.enemySprite');
        if(sprite)sprite.src=enemySpritePath(e.dataset.spriteType||'boss','walk1');
        // 目標設在畫面內，Boss 從目前位置走回戰鬥區；不把位置瞬間移到畫面外。
        bossRush.targetX=bossReturnX(e);
        faceBossTowardHero(e);
    }
    function updateBossHealthBar(e) {
        const boss1=level===4&&e&&e.dataset.boss==='1'&&e.dataset.spriteType==='boss';
        const spider=level===8&&e&&e.dataset.boss==='1'&&e.dataset.spriteType==='chapter2_boss_2';
        if(!boss1&&!spider)return;
        const max=Math.max(1,+e.dataset.maxhp||100);
        const current=Math.max(0,Math.min(max,+e.dataset.hp||0));
        const percent=Math.round(current/max*100);
        if(bossHealthPanel)bossHealthPanel.hidden=e.classList.contains('dead');
        if(bossHealthFill)bossHealthFill.style.width=percent+'%';
        if(bossHealthPercent)bossHealthPercent.textContent=percent+'%';
        const heading=bossHealthPanel?.querySelector('.boss-health-heading strong');
        if(heading)heading.textContent=spider?'萬毒蛛王':'皇廷看更隊長';
    }
    function shakeBossCamera() {
        stage.classList.remove('boss-camera-shake');
        void stage.offsetWidth;
        stage.classList.add('boss-camera-shake');
        clearTimeout(bossShakeTimer);
        bossShakeTimer=setTimeout(()=>stage.classList.remove('boss-camera-shake'),280);
    }
    function startBossRush(e,threshold) {
        if(!e || e.classList.contains('dead') || !running || level!==4)return;
        const width=Math.max(100,e.offsetWidth||600);
        const mapMax=Math.max(0,worldW-width);
        const inset=Math.max(24,stageW*.05);
        // 讓 Boss 的中心在可視區左右兩端之間移動；窄螢幕則以容器位置保留移動幅度。
        const laneLeft=stageW>width+80?cameraX+stageW*.12-width*.5:cameraX+inset;
        const laneRight=stageW>width+80?cameraX+stageW*.88-width*.5:cameraX+stageW*.82;
        const leftX=Math.max(0,Math.min(mapMax,laneLeft));
        const rightX=Math.max(0,Math.min(mapMax,laneRight));
        // 必須保留 Boss 真正的出場位置；即使初始位置超出背景末端，也要返回同一位置。
        const originX=Number.isFinite(+e.dataset.x)?+e.dataset.x:0;
        // 優先衝向距離較遠的畫面一側，確保不會在貼近邊界時原地空轉。
        const targetX=Math.abs(originX-leftX)>=Math.abs(rightX-originX)?leftX:rightX;
        bossRush.active=true;
        bossRush.boss=e;
        bossRush.phase='windup';
        bossRush.phaseStartedAt=performance.now();
        bossRush.runStartedAt=bossRush.phaseStartedAt;
        clearTimeout(bossRush.nextTimer);
        bossRush.nextTimer=0;
        bossRush.originX=originX;
        bossRush.targetX=targetX;
        bossRush.leftX=leftX;
        bossRush.rightX=rightX;
        bossRush.cameraAnchor=cameraX;
        bossRush.currentThreshold=threshold;
        bossRush.hitDashes.clear();
        bossRush.originalFacing=e.dataset.facing||'right';
        bossRush.originalFacingLocked=e.dataset.facingLocked||'0';
        e.dataset.facingLocked='1';
        clearTimeout(e._spriteTimer);
        clearEnemyFlash(e);
        e.classList.remove('enemy-hit','enemy-attacking');
        // 保留可見狀態：每個血量階段不再使用隱藏／透明機制。
        e.style.removeProperty('opacity');
        e.style.removeProperty('visibility');
        e.classList.add('boss-rushing');
        const sprite=e.querySelector('.enemySprite');
        setBossRushSprite(sprite,'windup');
        setBossChargeRedGlow(e,0);
        e.dataset.actionUntil=String(performance.now()+2500);
        floatText('Boss 絕技！',originX,47);
    }
    function startNextBossRush(e) {
        if(bossRush.active || !bossRush.queue.length || !e || e.classList.contains('dead'))return;
        const wait=Math.max(0,bossRush.cooldownUntil-performance.now());
        if(wait>0) {
            // 若下一個血量門檻剛好在恢復間隔中觸發，也必須安排後續啟動，不能留在 queue 裡不動。
            if(!bossRush.nextTimer)bossRush.nextTimer=setTimeout(()=>{
                bossRush.nextTimer=0;bossRush.cooldownUntil=0;
                if(running&&level===4&&e.isConnected&&!e.classList.contains('dead'))startNextBossRush(e);
            },wait);
            return;
        }
        clearTimeout(bossRush.nextTimer);bossRush.nextTimer=0;
        startBossRush(e,bossRush.queue.shift());
    }
    function checkBossRushThreshold(e) {
        if(chapter1FinalSkill.triggered || chapter1FinalSkill.active)return;
        if(level!==4 || !e || e.dataset.boss!=='1' || e.dataset.spriteType!=='boss' || e.classList.contains('dead'))return;
        const max=Math.max(1,+e.dataset.maxhp||100);
        const ratio=Math.max(0,+e.dataset.hp||0)/max;
        [0.8,0.6,0.4,0.2].forEach(threshold=>{
            if(ratio<=threshold && !bossRush.triggered.has(threshold)) {
                bossRush.triggered.add(threshold);
                bossRush.queue.push(threshold);
            }
        });
        startNextBossRush(e);
    }
    function finishBossRush(cancelled=false,now=performance.now()) {
        const e=bossRush.boss;
        if(e && e.isConnected) {
            e.classList.remove('boss-rushing');
            clearBossChargeRedGlow(e);
            e.style.removeProperty('opacity');
            e.style.removeProperty('visibility');
            if(!e.classList.contains('dead')) {
                // 絕招結束後面向女神，而不是沿用上一段衝刺方向造成背對主角。
                e.dataset.facingLocked=bossRush.originalFacingLocked;
                faceBossTowardHero(e);
                const sprite=e.querySelector('.enemySprite');
                if(sprite)sprite.src=enemySpritePath(e.dataset.spriteType||'boss','idle');
                e.dataset.actionUntil=String(now+350);
                e.dataset.lastAttack=String(now);
            }
        }
        // 結束時保留當前鏡頭位置，交由 updateCamera 在短時間內平滑追上主角。
        bossCameraReturnUntil=now+520;
        bossRush.active=false;
        bossRush.phase='';
        bossRush.runStartedAt=0;
        bossRush.cameraAnchor=null;
        bossRush.currentThreshold=0;
        if(cancelled)bossRush.queue=[];
        if(e && e.classList.contains('dead'))bossRush.queue=[];
        bossRush.cooldownUntil=(!cancelled&&e&&!e.classList.contains('dead')&&bossRush.queue.length)?now+650:0;
        clearTimeout(bossRush.nextTimer);
        bossRush.nextTimer=0;
        updateCamera();
        if(!cancelled && e && !e.classList.contains('dead'))startNextBossRush(e);
    }
    function bossDashCollision(e,now,previousX,nextX,dir) {
        const width=e.offsetWidth||100;
        const bossCenterBefore=previousX+width*.5, bossCenterAfter=nextX+width*.5;
        const heroCenter=x+(hero.offsetWidth||55)*.5;
        const hitRadius=Math.min(width*.31,stageW*.085)+(hero.offsetWidth||55)*.28;
        if(Math.min(bossCenterBefore,bossCenterAfter)-hitRadius>heroCenter || Math.max(bossCenterBefore,bossCenterAfter)+hitRadius<heroCenter)return;
        if(bossRush.hitDashes.has(bossRush.phase))return;
        bossRush.hitDashes.add(bossRush.phase);
        // 原有盾擊 0.5 秒內具無敵判定，成功格擋不會被撞飛。
        if(now<bashLockUntil || now<knockbackHitUntil){floatText('防禦！',x,48);return;}
        hp=Math.max(0,hp-8);
        floatText('撞飛！ −8',x,54);
        knockbackHitUntil=now+1100;
        knockbackUntilLanding=true;
        knockbackDirection=dir;
        keys.left=false;keys.right=false;moveV=0;jumpBufferMs=0;
        onGround=false;coyoteMs=0;jumpY=Math.max(jumpY,12);
        jumpV=.78;jumpT=1;
        faceDir=dir<0?1:-1;
        hero.classList.toggle('face-left',faceDir<0);
        hero.classList.add('jump','boss-knocked');
        heroActionUntil=now+1150;
        heroActionSprite='images/hero/hero_jump.png';
        setHeroSprite(heroActionSprite);
        shakeBossCamera();
    }
    function updateBossRush(dt,now) {
        if(!bossRush.active)return;
        const e=bossRush.boss;
        if(!e || !e.isConnected || e.classList.contains('dead')) {finishBossRush(true,now);return;}
        // 全流程保護：任何絕招階段異常卡住，都把 Boss 帶回場內安全位置並結束該次絕招。
        if(bossRush.runStartedAt && now-bossRush.runStartedAt>18000) {
            const safeX=bossReturnX(e);
            e.dataset.x=String(safeX);e.style.left=safeX+'px';
            e.style.removeProperty('opacity');e.style.removeProperty('visibility');
            finishBossRush(false,now);
            return;
        }
        if(bossRush.phase==='windup' || bossRush.phase==='windup2') {
            // 第二次集氣期間持續依玩家實際位置調整朝向，不沿用第一次衝刺的最後方向。
            if(bossRush.phase==='windup2')faceBossTowardHero(e);
            const chargeElapsed=Math.max(0,now-bossRush.phaseStartedAt);
            // 2.5 秒集氣過程逐幀由 0% 漸變到 100%；最後一小段提前到達滿紅，確保滿紅效果可見。
            const chargeProgress=Math.min(1,chargeElapsed/2400);
            setBossChargeRedGlow(e,chargeProgress);
            if(chargeElapsed<2500)return;
            bossRush.phase=bossRush.phase==='windup'?'dashOut':'dashAcross';
            bossRush.phaseStartedAt=now;
            bossRush.targetX=bossRush.phase==='dashOut'?bossRush.targetX:(bossRush.targetX===bossRush.leftX?bossRush.rightX:bossRush.leftX);
            // 集氣滿紅後切換衝刺圖，立即移除紅色染色與光暈，避免影響衝刺造型。
            clearBossChargeRedGlow(e);
            if(bossRush.phase==='dashOut'||bossRush.phase==='dashAcross') {
                setBossRushSprite(e.querySelector('.enemySprite'),bossRush.phase);
            }
        }
        if(bossRush.phase==='walkback') {
            // boss-rushing 會停用 CSS 動畫；因此用 4 張 WALK 圖手動逐格循環，確保回場時真的在行走。
            e.style.removeProperty('opacity');
            e.style.removeProperty('visibility');
            const sprite=e.querySelector('.enemySprite');
            if(sprite) {
                const frame=1+(Math.floor((now-bossRush.phaseStartedAt)/130)%4);
                const walkSrc=enemySpritePath(e.dataset.spriteType||'boss','walk'+frame);
                if(!sprite.getAttribute('src')?.endsWith('/'+walkSrc.split('/').pop()))sprite.src=walkSrc;
            }
            // 防止步行返回流程卡住；4.5 秒仍未到位就落在場內目標位置，避免戰鬥停滯。
            if(now-bossRush.phaseStartedAt>4500) {
                e.dataset.x=String(bossRush.targetX);
                e.style.left=bossRush.targetX+'px';
                finishBossRush(false,now);
                return;
            }
        }
        const current=+e.dataset.x||0,diff=bossRush.targetX-current;
        const step=(bossRush.phase==='walkback' ? .30 : bossRush.speed)*dt;
        const movingDir=Math.sign(diff)||1;
        const next=Math.abs(diff)<=step?bossRush.targetX:current+movingDir*step;
        if(bossRush.phase==='dashOut'||bossRush.phase==='dashAcross')bossDashCollision(e,now,current,next,movingDir);
        e.dataset.x=String(next);e.style.left=next+'px';
        if(bossRush.phase==='walkback') {
            // WALK 朝向以女神實際所在位置判斷，不再以「正在往左走」直接翻轉圖像。
            faceBossTowardHero(e);
        } else {
            // Boss 這套原始立繪天生朝左；只有向右衝刺時才水平翻轉。
            e.dataset.facing=movingDir<0?'left':'right';
            e.classList.toggle('enemy-facing-left',movingDir>0);
        }
        if(Math.abs(diff)>step)return;
        if(bossRush.phase==='dashOut') {
            shakeBossCamera();bossRush.phase='windup2';bossRush.phaseStartedAt=now;
            // 進入第二次集氣時立刻面向玩家，避免沿用剛才衝刺方向而背對玩家。
            faceBossTowardHero(e);
            // 第二次衝刺前重新集氣，切回 skin2，紅色發光從 0% 再次漸增。
            setBossRushSprite(e.querySelector('.enemySprite'),'windup2');
            setBossChargeRedGlow(e,0);
            e.dataset.actionUntil=String(now+2500);
        } else if(bossRush.phase==='dashAcross') {
            // 不再隱藏 Boss：第二次衝刺完成後，直接在畫面內走回戰鬥位置。
            shakeBossCamera();
            beginBossWalkBack(e,now);
        } else if(bossRush.phase==='walkback')finishBossRush(false,now);
    }
    function resetBossRush() {
        if(bossRush.boss && bossRush.boss.isConnected && !bossRush.boss.classList.contains('dead')) {
            bossRush.boss.classList.remove('boss-rushing');
            bossRush.boss.style.removeProperty('opacity');
            bossRush.boss.style.removeProperty('visibility');
            const sprite=bossRush.boss.querySelector('.enemySprite');
            clearBossChargeRedGlow(bossRush.boss);
            if(sprite)sprite.src=enemySpritePath(bossRush.boss.dataset.spriteType||'boss','idle');
        }
        clearTimeout(bossRush.nextTimer);bossRush.nextTimer=0;bossRush.cooldownUntil=0;
        bossRush.active=false;bossRush.boss=null;bossRush.phase='';bossRush.runStartedAt=0;bossRush.cameraAnchor=null;
        bossRush.currentThreshold=0;bossRush.triggered.clear();bossRush.queue=[];
        clearTimeout(bossShakeTimer);stage.classList.remove('boss-camera-shake');
        if(bossHealthPanel)bossHealthPanel.hidden=true;
        if(bossHealthFill)bossHealthFill.style.width='100%';
        if(bossHealthPercent)bossHealthPercent.textContent='100%';
    }
    // ===== Phase 1：惡魔城式角色物理 =====
    // 加速/減速、空中控制、重力、土狼時間與跳躍預輸入；不改動原有戰鬥與關卡規則。
    const PHYSICS=gameTuning.player?.physics||{maxRun:.255,groundAccel:.00155,groundBrake:.00215,airAccel:.00082,gravity:.00205,jumpSpeed:.72,maxFall:.92,coyote:105,jumpBuffer:120};
    function resetMovementPhysics(){
        knockbackUntilLanding=false;knockbackDirection=0;knockbackHitUntil=0;hero.classList.remove('boss-knocked');
        moveV=0;jumpY=0;jumpV=0;onGround=true;coyoteMs=0;jumpBufferMs=0;jumpT=0;
        hero.style.setProperty('bottom',gameTuning.player?.groundBottom||'14%','important');
        hero.classList.remove('jump');
    }
    function requestJump(){
        if(document.body.classList.contains('spider-apocalypse')||ultimateActive||knockbackUntilLanding||performance.now()<bashLockUntil)return;
        jumpBufferMs=PHYSICS.jumpBuffer;
    }
    function updatePlayerPhysics(dt){
        if(document.body.classList.contains('spider-apocalypse')) {
            keys.left=false;keys.right=false;moveV=0;jumpBufferMs=0;jumpV=0;jumpY=0;jumpT=0;onGround=true;hero.classList.remove('walking','jump');
            hero.style.setProperty('bottom',gameTuning.player?.groundBottom||'14%','important');return;
        }
        if(chapter1FinalSkill.active) {
            keys.left=false;keys.right=false;moveV=0;jumpBufferMs=0;
            hero.classList.remove('walking');
            return;
        }
        const bashLocked=performance.now()<bashLockUntil || knockbackUntilLanding;
        if(bashLocked){ keys.left=false; keys.right=false; moveV=0; }
        const dir=bashLocked?0:((keys.right?1:0)-(keys.left?1:0));
        const spiderSlowed=performance.now()<spiderBossSkill.slowUntil;
        const accel=(onGround?PHYSICS.groundAccel:PHYSICS.airAccel)*(spiderSlowed ? .68 : 1);
        const maxRun=PHYSICS.maxRun*(spiderSlowed ? .48 : 1);
        if(!spiderSlowed)hero.classList.remove('spider-slow');
        if(dir){
            moveV+=dir*accel*dt;
            moveV=Math.max(-maxRun,Math.min(maxRun,moveV));
            faceDir=dir;
            hero.classList.toggle('face-left',dir<0);
        }else if(onGround){
            const brake=PHYSICS.groundBrake*dt;
            moveV=Math.abs(moveV)<=brake?0:moveV-Math.sign(moveV)*brake;
        }
        if(ultimateActive) moveV*=Math.max(0,1-dt*.012);
        if(knockbackUntilLanding)moveV=knockbackDirection*.42;
        x=Math.max(0,Math.min(heroExitX(),x+moveV*dt));

        if(onGround)coyoteMs=PHYSICS.coyote; else coyoteMs=Math.max(0,coyoteMs-dt);
        jumpBufferMs=Math.max(0,jumpBufferMs-dt);
        if(jumpBufferMs>0&&(onGround||coyoteMs>0)&&!ultimateActive){
            jumpBufferMs=0;coyoteMs=0;onGround=false;jumpV=PHYSICS.jumpSpeed;jumpT=1;
            setHeroSprite('images/hero/hero_jump.png');hero.classList.add('jump');
        }
        if(!onGround){
            jumpV-=PHYSICS.gravity*dt;
            jumpV=Math.max(-PHYSICS.maxFall,jumpV);
            jumpY+=jumpV*dt;
            jumpT+=dt;
            if(jumpY<=0){jumpY=0;jumpV=0;onGround=true;jumpT=0;hero.classList.remove('jump','boss-knocked');knockbackUntilLanding=false;knockbackDirection=0;moveV=0;}
        }
        hero.style.setProperty('bottom','calc('+(gameTuning.player?.groundBottom||'14%')+' + '+jumpY.toFixed(1)+'px)','important');
        hero.classList.toggle('walking',!ultimateActive&&onGround&&Math.abs(moveV)>.035);
    }

    function placeEnemy(e,px) {
        e.dataset.x=px;
        e.style.left=px+'px'
    }
    function setupLevelBackground() {
        levelBackground.src=(levelConfigs[level-1]&&levelConfigs[level-1].background)||bgFiles[level-1];
        levelBackground.onload=()=> {
            sizeWorld()
        };
        if(levelBackground.complete)sizeWorld()
    }
    window.addEventListener('resize',()=> {
        if(running) {
            sizeWorld();
            updateCamera()
        }
    });
    // ===== HUD：更新血量、能量、關卡與線索數字 =====
    function updateHud() {
        $('hpbar').style.width=hp+'%';
        $('mpbar').style.width=mp+'%';
        const config=levelConfigs[level-1]||{};
        $('count').textContent='第 '+level+' 關 · '+levelKills+' / '+targets[level-1];
        $('count').title='第 '+(config.chapter||1)+' 章：'+(config.name||'冒險');
        $('gems').textContent='◆ '.repeat(Math.max(0,Math.min(3,Math.ceil(mp/34)))).trim()||'◇ ◇ ◇';
        $('clueBook').textContent='線索 '+clues.length+'/6'
    }
    // ===== 敵人圖片：交由 js/enemies.js 尋找圖片路徑 =====
    // 這裡只保留呼叫，不再把每種敵人的圖片規則混在主程式。
    const enemySpritePath = window.EnemyVisuals.enemySpritePath;

    // ===== 敵人：建立一名新敵人並加入清單 =====
    function spawn(xp,boss=false,behind=false) {
        const config=levelConfigs[level-1]||levelConfigs[0];
        const types=config.enemies||['skeleton'];
        let type=boss?'boss':types[Math.floor(Math.random()*types.length)];
        let visualType=type;
        if(boss && config.chapter===2) {
            const clueCount=clues.length;
            const hasAllChapter2Clues=level===8 ? clueCount===6 : ['chapter2_clock','chapter2_jelwellery','chapter2_sword'].every(id=>foundClues.has(id));
            visualType=hasAllChapter2Clues?'chapter2_boss_1':'chapter2_boss_2';
        } else if(!boss && config.chapter2Enemies) {
            visualType='chapter2_enemy_'+(1+Math.floor(Math.random()*7));
        }
        const names= {
            skeleton:'普通兵',archer:'高階兵',shield:'盾牌兵',heavy:'重裝精英',assassin:'刺客',acolyte:'精英級',boss:visualType==='chapter2_boss_1'?'隱藏頭目':'章節頭目'
        };
        const e=document.createElement('div');
        e.className='enemy enemy-'+type;
        e.innerHTML='<div class="enemy-name">'+names[type]+'</div><div class="ehealth"><i></i></div><div class="enemy-art"><img class="enemySprite" src="'+enemySpritePath(visualType,'idle')+'" alt="'+visualType+'"></div>';
        // 圖片路徑保護：若動作影格不存在，退回該敵人的 normal 圖，避免瀏覽器顯示破圖圖示。
        const initialSprite = e.querySelector('.enemySprite');
        if (initialSprite) {
            initialSprite.onerror = function () {
                const fallback = enemySpritePath(visualType, 'normal');
                if (this.getAttribute('src') !== fallback) {
                    this.onerror = function () { this.style.visibility = 'hidden'; };
                    this.src = fallback;
                } else {
                    this.style.visibility = 'hidden';
                }
            };
        }
        // 方向規則：前方敵人持續面向女騎士；後方敵人在生成時鎖定為女騎士當時面向的反方向。
        const initialFacing = behind ? (xp < x ? 'left' : 'right') : (xp > x ? 'right' : 'left');
        e.dataset.facing=initialFacing;
        e.dataset.facingLocked=behind?'1':'0';
        e.classList.toggle('enemy-facing-left', initialFacing==='left');
        e.style.left=xp+'px';
        e.dataset.x=xp;
        e.dataset.type=type;
        e.dataset.spriteType=visualType;
        e.dataset.rank=type==='heavy'?'elite':'normal';
        const enemyHP=gameTuning.enemyHP||{boss:10,chapter1Boss:50,heavy:4,shield:4,assassin:3,acolyte:3,default:2};
        const bossMaxHP=(boss&&level===4)?(enemyHP.chapter1Boss??100):(enemyHP.boss??10);
        const spiderBossMaxHP=(boss&&level===8&&visualType==='chapter2_boss_2')?80:null;
        e.dataset.hp=String(spiderBossMaxHP??(boss?bossMaxHP:(enemyHP[type]??enemyHP.default??2)));
        e.dataset.maxhp=e.dataset.hp;
        e.dataset.boss=boss||type==='boss'?'1':'0';
        e.dataset.lastAttack='0';
        enemies.appendChild(e);
        enemyList.push(e);
        spawnedThisLevel++
    }
    function clearEnemies() {
        resetSpiderBossSkill();
        resetChapter1FinalSkill();
        resetBossRush();
        enemies.innerHTML='';
        enemyList.length=0
    }
    // ===== 開始／重開：重設本局狀態並啟動遊戲迴圈 =====
    function setup() {
        keys= {
        };
        resetMovementPhysics();
        attackCd=0;
        bashLockUntil=0;
        heroActionUntil=0;
        heroActionSprite='images/hero/hero_stand.png';
        ultimateSound.stopAll();
        ultimateActive=false;
        ultimateCooldownUntil=0;
        ultimateToken++;
        pendingChapterTransition=false;
        level=Math.max(1,Math.min(8,Number(window.GAME_START_LEVEL)||1));
        // 第二章角色與敵人整體往下對齊，避免腳底高於背景地面。
        world.classList.toggle('chapter2-world', !!(levelConfigs[level-1] && levelConfigs[level-1].chapter===2));
        levelKills=0;
        exitOpen=false;
        exitPrompt.hidden=true;
        kills=0;
        spawnedThisLevel=0;
        bossSpawnedThisLevel=false;
        clues=[];
        foundClues.clear();
        if(level===8 && Number(window.GAME_TEST_CLUE_COUNT)=== 5) {
            const testClues=['king','letter','piece','chapter2_clock','chapter2_jelwellery','chapter2_sword'].slice(0,5);
            testClues.forEach(id=>{ clues.push(id); foundClues.add(id); });
        }
        clueModalPhase=0; activeClue=null;
        $('clueReveal').hidden=true; $('clueDialog').hidden=true;
        stage.classList.remove('title-mode');
        $('titleScreen').style.display='none';
        $('titlePopup').hidden=true;
        addMusicButton();
        const musicBtn=$('musicToggle');
        if(musicBtn)musicBtn.style.display='block';
        titleAudio.pause();
        titleAudio.currentTime=0;
        bgmAudio.pause();
        bgmAudio.currentTime=0;
        const sprite=$('heroSprite');
        if(sprite) {
            sprite.src='images/hero/hero_stand.png';
            sprite.style.transform='';
        }
        clearEnemies();
        setupLevelBackground();
        sizeWorld();
        x=Math.min(stage.clientWidth*.25,heroExitX()*.45);
        faceDir=1;
        // 初始左側敵人視為後方敵人，生成時鎖定朝左；右側敵人面向女騎士。
        // 測試頁限定：直接生成第 8 關蜘蛛 Boss，跳過普通敵兵清場。
        if(window.GAME_TEST_DIRECT_BOSS===1 && level===8) {
            const testBossX=Math.min(heroExitX()-30,x+stageW*.48);
            spawn(testBossX,true,false);
            const testBoss=enemyList[enemyList.length-1];
            bossSpawnedThisLevel=true;
            if(testBoss&&testBoss.dataset.spriteType==='chapter2_boss_2') {
                updateBossHealthBar(testBoss);
                if(bossHealthPanel)bossHealthPanel.hidden=false;
            }
        } else {
            spawn(Math.max(24,x-stageW*.22),false,true);
            spawn(Math.min(heroExitX()-30,x+stageW*.34),false,false);
        }
        // Boss 關卡先只生成普通敵人；清場後才由主迴圈生成 Boss。

        hp=100;
        mp=65;
        combo=0;
        lastHit=0;
        spawnTimer=0;
        hero.style.left=x+'px';
        hero.classList.remove('face-left','native-left-sprite','walking','thrust','bash','hit','jump','ultimate-anim','ultimate-charge','ultimate-release');
        hero.style.removeProperty('--ultimate-lift');
        hero.style.removeProperty('--ultimate-scale');
        const skillSprite=$('heroSprite');
        if(skillSprite) {
            skillSprite.style.removeProperty('--skill-frame-width');
            skillSprite.style.removeProperty('--skill-frame-height')
        }
        paused=false;
        running=true;
        updateHud();
        overlay.style.display='none';
        $('pause').textContent='Ⅱ';
        if(musicEnabled)startGameMusic();
        last=performance.now();
        requestAnimationFrame(loop)
    }
    // ===== 音樂與音效 =====
    function startGameMusic() {
        if(!musicEnabled)return;
        titleAudio.pause();
        const config=levelConfigs[level-1]||{};
        const musicPath=config.chapter===2?'audio/forest.wav':'audio/fantasy_rpg_bgm.wav';
        const resolvedPath=new URL(musicPath,document.baseURI).href;
        if(bgmAudio.src!==resolvedPath) { bgmAudio.src=musicPath; bgmAudio.load(); }
        try {
            const p=bgmAudio.play();
            if(p&&p.catch)p.catch(()=> {
            });
        }
        catch(e) {
        }
    }
    function addMusicButton() {
        if(document.getElementById('musicToggle'))return;
        const b=document.createElement('button');
        b.id='musicToggle';
        b.textContent='🎵 音樂：開';
        b.style.cssText='position:absolute;right:12px;top:48px;z-index:1000;border:1px solid #ffffff66;border-radius:10px;background:#17243bdd;color:white;padding:8px 10px;font-weight:700;cursor:pointer';
        const st=document.querySelector('.stage')||document.getElementById('app');
        if(st) {
            if(getComputedStyle(st).position==='static')st.style.position='relative';
            st.appendChild(b)
        }
        b.style.display=st.classList.contains('title-mode')?'none':'block';
        b.addEventListener('click',()=> {
            musicEnabled=!musicEnabled;
            b.textContent=musicEnabled?'🎵 音樂：開':'🔇 音樂：關';
            if(musicEnabled) {
                if(running&&!paused)startGameMusic();
                else startTitleMusic()
            }
            else {
                bgmAudio.pause();
                titleAudio.pause()
            }
        })
    }
    // Hit flash timer is per enemy: repeated hits restart the short effect instead of leaving stale glow states.
    function flashEnemy(e, duration) {
        clearTimeout(e._hitFlashTimer);
        e.classList.remove('hitflash');
        void e.offsetWidth;
        e.classList.add('hitflash');
        e._hitFlashTimer=setTimeout(()=> {
            e.classList.remove('hitflash');
            e._hitFlashTimer=0;
        }, Math.max(0, duration || 180));
    }
    function clearEnemyFlash(e) {
        clearTimeout(e._hitFlashTimer);
        e._hitFlashTimer=0;
        e.classList.remove('hitflash');
    }

    // ===== 普通戰鬥：槍刺、盾擊、特殊技能的傷害判定 =====
    function attack(kind) {
        if(!running||paused||document.body.classList.contains('spider-apocalypse')||attackCd>0||knockbackUntilLanding)return;
        const attackStartedAt=performance.now();
        if(kind==='bash'){
            bashLockUntil=attackStartedAt+500;
            keys.left=false; keys.right=false; moveV=0;
            jumpBufferMs=0;
            hero.classList.remove('walking','jump');
        }
        const attackCooldowns=tuneCombat.attackCooldownMs||{thrust:260,bash:430,special:850};
        attackCd=attackCooldowns[kind]??850;
        if(kind==='thrust'||kind==='bash')playSfx(kind);
        const heroSprite=$('heroSprite');
        heroSprite.style.transform='';
        heroSprite.style.transformOrigin='center center';
        hero.classList.remove('native-left-sprite');
        heroSprite.classList.toggle('thrust-sprite',kind==='thrust');
        heroActionSprite=kind==='thrust'?'images/hero/hero_thrust.png':(kind==='bash'||kind==='special'?'images/hero/hero_bash.png':'images/hero/hero_stand.png');
        heroActionUntil=performance.now()+(tuneEffects.heroAttackPoseMs??520);
        setHeroSprite(heroActionSprite);
        hero.classList.remove('thrust','bash');
        void hero.offsetWidth;
        hero.classList.add(kind==='thrust'?'thrust':'bash');
        setTimeout(()=>hero.classList.remove('thrust','bash'),tuneEffects.heroAttackClassMs??190);
        if(kind==='special') {
            if(mp<30) {
                floatText('能量不足',x,34);
                return
            }
            mp-=30;
            floatText('聖光爆發！',x+3,37)
        }
        let hits=0;
        enemyList.forEach(e=> {
            if(e.classList.contains('dead'))return;
            if(isSpiderBroodProtected(e))return;
            if(isSpiderBoss(e)&&spiderBossSkill.invulnerable)return;
            let ex=+e.dataset.x;
            const enemyCenter=ex+(e.offsetWidth||80)*.5;
            const heroCenter=x+(hero.offsetWidth||116)*.5;
            const dx=enemyCenter-heroCenter;
            const range=stageW*(kind==='thrust'?.14:kind==='bash'?.09:.24);
            if(kind==='special'||(dx*faceDir>=0&&Math.abs(dx)<range)) {
                const damage=tuneCombat.damage||{thrust:1,bash:2,special:3,shieldThrust:0.5};
                let type=e.dataset.type,dmg=damage[kind]??3;
                if(type==='shield'&&kind==='thrust')dmg=damage.shieldThrust??0.5;
                let eh=applyEnemyDamage(e,dmg);
                e.dataset.hp=eh;
                e.querySelector('.ehealth i').style.width=Math.max(0,eh/(+e.dataset.maxhp)*100)+'%';
                updateBossHealthBar(e);
                if(eh>0)checkBossRushThreshold(e);
                const es=e.querySelector('.enemySprite');
                const bossIsRushing=bossRush.active&&e===bossRush.boss;
                const spiderSkillLocked=isSpiderBoss(e)&&spiderBossSkill.active;
                if(es&&!bossIsRushing&&!spiderSkillLocked) {
                    es.src=enemySpritePath(e.dataset.spriteType||type,'hit');
                    e.dataset.actionUntil=String(performance.now()+310);
                    clearTimeout(e._spriteTimer);
                    e._spriteTimer=setTimeout(()=> {
                        if(es.isConnected&&!e.classList.contains('dead')&&!(bossRush.active&&e===bossRush.boss))es.src=enemySpritePath(e.dataset.spriteType||type,'idle')
                    },tuneEffects.enemyHitPoseMs??300)
                }
                if(!bossIsRushing&&!spiderSkillLocked && !(chapter1FinalSkill.active && e===chapter1FinalSkill.boss)) {
                    flashEnemy(e,tuneEffects.enemyHitFlashMs??180);
                    const knockbackX=ex+faceDir*stageW*(kind==='thrust'?.05:kind==='bash'?.08:.11);
                    if(e.dataset.boss==='1') {
                        const bossHalf=(e.offsetWidth||80)*.5;
                        e.dataset.x=Math.max(24-bossHalf,Math.min(heroExitX()-20-bossHalf,knockbackX));
                    } else e.dataset.x=Math.max(0,Math.min(worldW-30,knockbackX));
                    e.style.left=e.dataset.x+'px';
                }
                floatText(kind==='thrust'?'槍刺！':kind==='bash'?'盾擊！':'聖光！',ex,32);
                hits++;
                combo++;
                lastHit=performance.now();
                mp=Math.min(100,mp+5);
                if(eh<=0) {
                    if(e.dataset.boss==='1'&&level===4)resetBossRush();
                    clearTimeout(e._spriteTimer);
                    clearEnemyFlash(e);
                    e.classList.remove('enemy-hit','enemy-attacking');
                    // Lock the enemy immediately, briefly show the hit reaction, then leave the corpse.
                    e.classList.add('dead');
                    if(es) {
                        es.src=enemySpritePath(e.dataset.spriteType||type,'hit');
                        e._deathPoseTimer=setTimeout(()=>{
                            if(es.isConnected) es.src=enemySpritePath(e.dataset.spriteType||type,'dead');
                        },tuneEffects.deathHitPoseMs??150);
                    }
                    if(e.dataset.spiderMinion!=='1'){kills++;levelKills++;}
                    if(isSpiderBoss(e))resetSpiderBossSkill();
                    updateBossHealthBar(e);
                    if(clueByLevel[level] && !foundClues.has(clueByLevel[level].id) && Math.random()<0.10)showClue(clueByLevel[level])
                }
            }
        });
        if(hits) {
            $('hit').textContent=combo+' HIT'+(combo>1?'!':'');
            $('hit').classList.add('show');
            setTimeout(()=>$('hit').classList.remove('show'),tuneEffects.hitCounterMs??600)
        }
        updateHud()
    }
    // ===== 絕招：蓄力、播放大絕影格、造成傷害並收招 =====
    function ultimate() {
        if(!running||paused||document.body.classList.contains('spider-apocalypse')||ultimateActive)return;
        const now=performance.now();
        if(now<ultimateCooldownUntil) {
            floatText('絕招冷卻中 '+Math.ceil((ultimateCooldownUntil-now)/1000)+'s',x,38);
            return
        }
        ultimateActive=true;
        ultimateCooldownUntil=now+(tuneCombat.ultimateCooldownMs??12000);
        ultimateStartedAt=now;
        keys.left=false;
        keys.right=false;
        const token=++ultimateToken,heroSprite=$('heroSprite');
        heroActionSprite=ultimateSpriteFiles[0];
        heroActionUntil=now+1500;
        hero.classList.add('ultimate-anim');
        setUltimateFrame(0);
        hero.classList.remove('walking','thrust','bash','hit','jump');
        hero.classList.add('ultimate-charge');
        ultimateSound.startCharge();
        floatText('女神降臨・神聖槍爆',x,43);
        updateHud();
        setTimeout(()=> {
            if(token!==ultimateToken||!running) {
                ultimateSound.stopCharge();
                return;
            }
            ultimateSound.stopCharge();
            ultimateSound.playBlast();
            const ring=document.createElement('div');
            ring.className='ultimate-ring';
            ring.setAttribute('aria-hidden','true');
            ring.style.left=x+'px';
            ring.style.bottom='0%';
            world.appendChild(ring);
            setTimeout(()=>ring.remove(),tuneEffects.ultimateRingMs??760);
            let hits=0;
            enemyList.forEach(e=> {
                if(e.classList.contains('dead'))return;
                if(isSpiderBroodProtected(e))return;
                const ex=+e.dataset.x;
                if(Math.abs(ex-x)>stageW*.32)return;
                const type=e.dataset.type;
                const ultimateDamage=tuneCombat.ultimateDamage||{default:5,shield:2.5};
                let dmg=ultimateDamage.default??5;
                // 特殊技對盾牌兵使用獨立傷害值。
                if(type==='shield')dmg=ultimateDamage.shield??2.5;
                const eh=applyEnemyDamage(e,dmg);
                e.dataset.hp=eh;
                updateBossHealthBar(e);
                if(eh>0)checkBossRushThreshold(e);
                const bar=e.querySelector('.ehealth i');
                if(bar)bar.style.width=Math.max(0,eh/(+e.dataset.maxhp)*100)+'%';
                const es=e.querySelector('.enemySprite');
                const bossIsRushing=bossRush.active&&e===bossRush.boss;
                const spiderSkillLocked=isSpiderBoss(e)&&spiderBossSkill.active;
                if(es&&!bossIsRushing&&!spiderSkillLocked) {
                    es.src=enemySpritePath(e.dataset.spriteType||type,'hit');
                    e.dataset.actionUntil=String(performance.now()+370);
                    clearTimeout(e._spriteTimer);
                    e._spriteTimer=setTimeout(()=> {
                        if(es.isConnected&&!e.classList.contains('dead')&&!(bossRush.active&&e===bossRush.boss))es.src=enemySpritePath(e.dataset.spriteType||type,'idle')
                    },tuneEffects.ultimateEnemyHitPoseMs??360)
                }
                if(!bossIsRushing&&!spiderSkillLocked && !(chapter1FinalSkill.active && e===chapter1FinalSkill.boss)) {
                    flashEnemy(e,tuneEffects.ultimateHitFlashMs??180);
                    const knockbackX=ex+Math.sign(ex-x||faceDir)*stageW*.035;
                    if(e.dataset.boss==='1') {
                        const bossHalf=(e.offsetWidth||80)*.5;
                        e.dataset.x=Math.max(24-bossHalf,Math.min(heroExitX()-20-bossHalf,knockbackX));
                    } else e.dataset.x=Math.max(0,Math.min(worldW-30,knockbackX));
                    e.style.left=e.dataset.x+'px';
                }
                floatText('神聖爆發！',ex,36);
                hits++;
                combo++;
                lastHit=performance.now();
                mp=Math.min(100,mp+5);
                if(eh<=0) {
                    if(e.dataset.boss==='1'&&level===4)resetBossRush();
                    clearTimeout(e._spriteTimer);
                    clearEnemyFlash(e);
                    e.classList.remove('enemy-hit','enemy-attacking');
                    // Lock the enemy immediately, briefly show the hit reaction, then leave the corpse.
                    e.classList.add('dead');
                    if(es) {
                        es.src=enemySpritePath(e.dataset.spriteType||type,'hit');
                        e._deathPoseTimer=setTimeout(()=>{
                            if(es.isConnected) es.src=enemySpritePath(e.dataset.spriteType||type,'dead');
                        },tuneEffects.deathHitPoseMs??150);
                    }
                    if(e.dataset.spiderMinion!=='1'){kills++;levelKills++;}
                    if(isSpiderBoss(e))resetSpiderBossSkill();
                    updateBossHealthBar(e);
                    if(clueByLevel[level] && !foundClues.has(clueByLevel[level].id) && Math.random()<0.50)showClue(clueByLevel[level])
                }
            });
            $('hit').textContent=hits?(combo+' HIT'+(combo>1?'!':'')):'神聖槍爆！';
            $('hit').classList.add('show');
            setTimeout(()=>$('hit').classList.remove('show'),tuneEffects.ultimateHitCounterMs??700);
            hero.classList.remove('ultimate-charge');
            hero.classList.add('ultimate-release');
            setTimeout(()=> {
                hero.classList.remove('ultimate-release','ultimate-anim');
                hero.style.removeProperty('--ultimate-lift');
                hero.style.removeProperty('--ultimate-scale');
                const sprite=$('heroSprite');
                if(sprite) {
                    sprite.style.removeProperty('--skill-frame-width');
                    sprite.style.removeProperty('--skill-frame-height')
                }
                if(running) {
                    heroActionUntil=0;
                    heroActionSprite='images/hero/hero_stand.png';
                    setHeroSprite(keys.left||keys.right?('images/hero/hero_walk_1_'+(faceDir<0?'left':'right')+'.png'):'images/hero/hero_stand.png')
                }
                ultimateActive=false;
                updateHud()
            },tuneEffects.ultimateReleaseMs??360);
            updateHud();
        },tuneEffects.ultimateChargeMs??800);
    }
    // ===== 關卡流程：切換下一關或顯示通關結果 =====
    function startLevel(levelNumber, preserveRun=true) {
        level=levelNumber;
        // Keep chapter-specific CSS selectors active when the game advances into Chapter 2.
        // Without this update, Boss position rules scoped to #world.chapter2-world never match.
        world.classList.toggle('chapter2-world', !!(levelConfigs[level-1] && levelConfigs[level-1].chapter===2));
        levelKills=0;
        spawnedThisLevel=0;
        bossSpawnedThisLevel=false;
        spawnTimer=0;
        exitOpen=false;
        exitPrompt.hidden=true;
        if(preserveRun) { hp=Math.min(100,hp+18); mp=Math.min(100,mp+20); }
        clearEnemies();
        setupLevelBackground();
        x=Math.min(stageW*.12,heroExitX()*.25);
        resetMovementPhysics();
        cameraX=0;
        world.style.transform='translate3d(0,0,0)';
        const config=levelConfigs[level-1]||{};
        if(running && musicEnabled) startGameMusic();
        floatText('第 '+level+' 關：'+(config.name||'冒險'),stageW*.43,54);
        spawn(Math.max(24,x-stageW*.22),false,true);
        spawn(Math.min(heroExitX()-30,x+stageW*.34),false,false);
        // Boss 關卡先只生成普通敵人，待普通敵人全部擊敗後才召喚 Boss。
        updateCamera();
        updateHud()
    }
    function startSecondChapter() {
        pendingChapterTransition=false;
        $('modalTitle').textContent='第二章：王國的秘密';
        $('modalDesc').textContent='新的線索指向王室深處。冒險仍未結束——繼續前往封印之門。';
        overlay.style.display='none';
        $('returnTitle').style.display='none';
        running=true;
        paused=false;
        startLevel(5,false);
        $('pause').textContent='Ⅱ';
        last=performance.now();
        requestAnimationFrame(loop)
    }
    function nextLevel() {
        if(level===4) {
            running=false;
            pendingChapterTransition=true;
            showEnd('第一章完成：王子的失蹤','你已完成第一章，收集到 '+clues.length+' / 6 件線索。北方要塞的秘密仍未解開，現在將直接進入第二章。','進入第二章 ▶');
            return
        }
        if(level>=8) {
            running=false;
            pendingChapterTransition=false;
            showEnd('冒險完成：王國的真相','八關全部完成！你收集到 '+clues.length+' / 6 件線索。王子的失蹤之謎終於揭曉。','再玩一次');
            return
        }
        startLevel(level+1,true)
    }
    // ===== 遊戲主迴圈：每一幀更新角色、敵人與勝負狀態 =====
    function loop(t) {
        if(!running)return;
        const dt=Math.min(45,t-last);
        last=t;
        if(!paused) {
            updateChapter1FinalSkill(t);
            updatePlayerPhysics(dt);
            if(knockbackUntilLanding){setHeroSprite('images/hero/hero_jump.png');}
            else if(ultimateActive) {
                const skillFrame=Math.min(7,Math.floor(Math.max(0,t-ultimateStartedAt)/130));
                heroActionSprite=ultimateSpriteFiles[skillFrame];
                setUltimateFrame(skillFrame)
            }
            else if(t<heroActionUntil) {
                setHeroSprite(heroActionSprite)
            }
            else if(jumpT>0) {
                setHeroSprite('images/hero/hero_jump.png')
            }
            else if(keys.left||keys.right) {
                setHeroSprite('images/hero/hero_walk_'+((Math.floor(t/120)%4)+1)+'_'+(faceDir<0?'left':'right')+'.png');
                // Walking art already has separate left/right images; don't mirror it twice.
                hero.classList.toggle('native-left-sprite',faceDir<0)
            }
            else {
                hero.classList.remove('native-left-sprite');
                setHeroSprite('images/hero/hero_stand.png')
            }
            hero.style.left=x+'px';
            updateCamera();
            updateBossRush(dt,t);
            attackCd=Math.max(0,attackCd-dt);
            if(t-lastHit>1400)combo=0;
            for(let i=enemyList.length-1;
            i>=0;
            i--) {
                const e=enemyList[i];
                if(e.classList.contains('dead')) {
                    if(isSpiderBoss(e)&&spiderBossSkill.boss===e)resetSpiderBossSkill();
                    if(!e.dataset.removed) {
                        e.dataset.removed='1';
                        setTimeout(()=>e.classList.add('fade-out'),tuneEffects.corpseFadeDelayMs??1650);
                        setTimeout(()=> {
                            e.remove();
                            const idx=enemyList.indexOf(e);
                            if(idx>=0)enemyList.splice(idx,1)
                        },tuneEffects.corpseRemoveDelayMs??2450)
                    }
                    continue
                }
                let ex=+e.dataset.x,type=e.dataset.type;
                if(chapter1FinalSkill.active && e===chapter1FinalSkill.boss)continue;
                if(bossRush.active && e===bossRush.boss)continue;
                if(isSpiderBoss(e)){
                    if(!spiderBossSkill.boss)spiderBossSkill.boss=e;
                    if(updateSpiderBossSkill(t))continue;
                }
                if(e.dataset.spiderMinion==='1'){
                    updateSpiderMinionSkill(e,t,dt);
                    continue;
                }
                // 前方敵人持續面向女騎士；後方敵人保留生成時鎖定的相反方向。
                const enemyVisualCenter=ex+(e.dataset.boss==='1'?(e.offsetWidth||80)*.5:0);
                if(isSpiderBoss(e)) spiderFacePlayer(e);
                else if(e.dataset.facingLocked!=='1') {
                    const enemyFacesLeft = x > enemyVisualCenter;
                    e.dataset.facing=enemyFacesLeft?'left':'right';
                    e.classList.toggle('enemy-facing-left',enemyFacesLeft);
                }
                if(Math.abs(enemyVisualCenter-x)>stageW*.07) {
                    const approachSpeed=tuneEnemyAI.approachSpeed||{assassin:0.22,heavy:0.10,shield:0.10,acolyte:0.12,default:0.15};
                    const speed=approachSpeed[type]??approachSpeed.default??0.15;
                    const centerOffset=e.dataset.boss==='1'?(e.offsetWidth||80)*.5:0;
                    ex=Math.max(24-centerOffset,Math.min(heroExitX()-20-centerOffset,ex+Math.sign(x-enemyVisualCenter)*dt*speed));
                    e.dataset.x=ex;
                    e.style.left=ex+'px';
                    // 第一章敵人循環播放 4 格；第二章隱藏 Boss chapter2_boss_1 循環播放 8 格。
                    // 受擊或攻擊期間不切換影格，避免動畫互相覆蓋。
                    if(t>+(e.dataset.actionUntil||0) && !e.classList.contains('hitflash')) {
                        const es=e.querySelector('.enemySprite');
                        if(spiderHoldNormalPoseBeforeFinalHit2(e)) spiderPose(e,'normal');
                        else if(es) {
                            const spriteType=e.dataset.spriteType||type;
                            const frameCount=spriteType==='chapter2_boss_1'?8:4;
                            const frame=1+(Math.floor(t/130)%frameCount);
                            const nextSrc=enemySpritePath(spriteType,'walk'+frame);
                            if(!es.getAttribute('src')?.endsWith('/'+nextSrc.split('/').pop())) es.src=nextSrc;
                        }
                    }
                }
                else {
                    const cooldowns=tuneEnemyAI.attackCooldownMs||{assassin:1150,acolyte:1150,boss:950,default:1700};
                    const lastAtk=+(e.dataset.lastAttack||0),cool=(type==='assassin'||type==='acolyte')?(cooldowns[type]??1150):(type==='boss'?(cooldowns.boss??950):(cooldowns.default??1700));
                    // Return to the idle pose while waiting in attack range (unless a hit/attack animation is active).
                    if(t>+(e.dataset.actionUntil||0) && !e.classList.contains('hitflash')) {
                        const es=e.querySelector('.enemySprite');
                        if(spiderHoldNormalPoseBeforeFinalHit2(e)) spiderPose(e,'normal');
                        else if(es && /_walk[1-8]\.png(?:$|\?)/.test(es.getAttribute('src')||'')) es.src=enemySpritePath(e.dataset.spriteType||type,'idle');
                    }
                    if(t-lastAtk>cool) {
                        e.dataset.lastAttack=String(t);
                        e.dataset.actionUntil=String(t+430);
                        const es=e.querySelector('.enemySprite');
                        if(es) {
                            if(spiderHoldNormalPoseBeforeFinalHit2(e)) spiderPose(e,'normal');
                            else es.src=enemySpritePath(e.dataset.spriteType||type,'attack');
                            clearTimeout(e._spriteTimer);
                            e._spriteTimer=setTimeout(()=> {
                                if(es.isConnected&&!e.classList.contains('hitflash')){
                                    if(spiderHoldNormalPoseBeforeFinalHit2(e))spiderPose(e,'normal');
                                    else es.src=enemySpritePath(e.dataset.spriteType||type,'idle');
                                }
                            },tuneEffects.enemyAttackPoseMs??420)
                        }
                        const incomingDamage=tuneEnemyAI.incomingDamage||{boss:8,heavy:5,assassin:4,acolyte:3,archer:3,default:2};
                        let dmg=incomingDamage[type]??incomingDamage.default??2;
                        if(jumpT===0) {
                            if(performance.now()<bashLockUntil){
                                floatText('0',x,28);
                            }else{
                                const previousHP=hp;hp=spiderClampFinalHP(previousHP,Math.max(0,hp-Math.ceil(dmg/5)));
                                floatText('−'+(previousHP-hp),x,28)
                            }
                        }
                    }
                }
            }
            const currentLevelConfig=levelConfigs[level-1]||{};
            // Boss 關的目標總數包含最後登場的 Boss，因此普通敵人數量要預留 1 名給 Boss。
            const regularEnemyTarget=Math.max(0,targets[level-1]-(currentLevelConfig.boss?1:0));
            const livingEnemyCount=enemyList.filter(e=>!e.classList.contains('dead')).length;
            if(window.GAME_TEST_DIRECT_BOSS!==1 && levelKills<regularEnemyTarget&&livingEnemyCount<4) {
                spawnTimer+=dt;
                if(spawnTimer>(tuneEnemyAI.spawnIntervalMs??1350)&&spawnedThisLevel<regularEnemyTarget) {
                    {
                    const behind=Math.random()<0.38;
                    const offset=stageW*(.22+Math.random()*.22);
                    // 後方以角色當前面向判定：面向右時從左側出現，面向左時從右側出現。
                    const spawnX=behind
                        ? (faceDir>0 ? Math.max(24,x-offset) : Math.min(heroExitX()-30,x+offset))
                        : (faceDir>0 ? Math.min(heroExitX()-30,x+offset+stageW*.18) : Math.max(24,x-offset-stageW*.18));
                    spawn(spawnX,false,behind);
                }
                    spawnTimer=0
                }
            }
            // Boss 關：所有普通敵人都已生成、被擊敗，且場上沒有存活敵人時，才登場 Boss。
            if(currentLevelConfig.boss&&!bossSpawnedThisLevel&&
               spawnedThisLevel>=regularEnemyTarget&&levelKills>=regularEnemyTarget&&
               !enemyList.some(e=>!e.classList.contains('dead'))) {
                const bossX=Math.min(heroExitX()-30,x+stageW*.62);
                spawn(bossX,true,false);
                const spawnedBoss=enemyList[enemyList.length-1];
                if(level===4 && spawnedBoss) {
                    bossRush.boss=spawnedBoss;
                    updateBossHealthBar(spawnedBoss);
                    if(bossHealthPanel)bossHealthPanel.hidden=false;
                } else if(level===8 && spawnedBoss && spawnedBoss.dataset.spriteType==='chapter2_boss_2') {
                    updateBossHealthBar(spawnedBoss);
                    if(bossHealthPanel)bossHealthPanel.hidden=false;
                }
                bossSpawnedThisLevel=true;
                spawnTimer=0;
                floatText('Boss 出現！',bossX,48);
            }
            const levelClearTarget=window.GAME_TEST_DIRECT_BOSS===1&&level===8?1:targets[level-1];
            if(levelKills>=levelClearTarget&&!enemyList.some(e=>!e.classList.contains('dead'))&&!exitOpen) {
                exitOpen=true;
                exitX=heroExitX();
                exitPrompt.hidden=false;
                floatText('出口已開啟！',x,42)
            }
            if(exitOpen&&keys.right&&x>=exitX-1) {
                nextLevel()
            }
            if(hp<=0) {
                const spiderUltKilled=spiderBossSkill.killedHero;
                running=false;
                resetSpiderBossSkill();
                resetBossRush();
                if(chapter1FinalSkill.killedHero) {
                    showEnd('血紅巨劍・期子末日','Boss 1 的終極技能命中女神。巨劍落地後 1 秒，死亡判定已生效。','重新開始');
                } else if(spiderUltKilled) {
                    showEnd('毒男聖域・腐臭降臨','5 秒蓄勢結束，萬毒蛛域吞噬了女神。','重新開始');
                } else {
                    showEnd('女神需要休息！','敵人太多了，重新出發再試一次。已收集的線索會在本次遊戲重開後重置。','重新開始');
                }
            }
            updateHud()
        }
        if(running)requestAnimationFrame(loop)
    }
    // ===== 首頁與彈窗：結束畫面、設定、教學及排行榜 =====
    function showEnd(t,d,b) {
        $('modalTitle').textContent=t;
        $('modalDesc').innerHTML=d;
        $('start').textContent=b;
        $('returnTitle').style.display='block';
        overlay.style.display='flex'
    }
    function showTitle() {
        running=false;
        paused=false;
        resetBossRush();
        keys= {
        };
        resetMovementPhysics();
        attackCd=0;
        bashLockUntil=0;
        heroActionUntil=0;
        heroActionSprite='images/hero/hero_stand.png';
        ultimateSound.stopAll();
        ultimateActive=false;
        ultimateStartedAt=0;
        ultimateToken++;
        bgmAudio.pause();
        bgmAudio.currentTime=0;
        titleAudio.pause();
        titleAudio.currentTime=0;
        clearEnemies();
        hero.style.left='25%';
        hero.classList.remove('face-left','native-left-sprite','walking','thrust','bash','hit','jump','ultimate-anim','ultimate-charge','ultimate-release');
        hero.style.removeProperty('--ultimate-lift');
        hero.style.removeProperty('--ultimate-scale');
        const sprite=$('heroSprite');
        if(sprite) {
            sprite.style.removeProperty('--skill-frame-width');
            sprite.style.removeProperty('--skill-frame-height');
            sprite.src='images/hero/hero_stand.png';
            sprite.style.transform=''
        }
        stage.classList.add('title-mode');
        $('titleScreen').style.display='block';
        overlay.style.display='none';
        $('titlePopup').hidden=true;
        $('pause').textContent='Ⅱ';
        const mb=$('musicToggle');
        if(mb)mb.style.display='none';
        if(musicEnabled)startTitleMusic()
    }
    function openTitlePopup(kind) {
        const heading=$('titlePopupHeading'),body=$('titlePopupBody'),card=$('titlePopup').querySelector('.title-popup-card');
        card.classList.remove('tutorial-card');
        if(kind==='settings') {
            heading.textContent='設定';
            body.innerHTML='<p>背景音樂</p><button class="popup-option" id="musicSetting">'+(musicEnabled?'🔊 音樂：開':'🔇 音樂：關')+'</button><p class="popup-hint">你也可以在戰鬥畫面右上角切換音樂。</p>';
            body.querySelector('#musicSetting').onclick=()=> {
                musicEnabled=!musicEnabled;
                titleAudio.pause();
                bgmAudio.pause();
                body.querySelector('#musicSetting').textContent=musicEnabled?'🔊 音樂：開':'🔇 音樂：關';
                if(musicEnabled)startTitleMusic()
            }
        }
        else if(kind==='tutorial') {
            heading.textContent='聖騎士戰鬥教學';
            card.classList.add('tutorial-card');
            body.innerHTML='<div class="tutorial-controls"><div class="tutorial-control"><b>← / →</b><span>左右移動／控制面向</span></div><div class="tutorial-control"><b>↑</b><span>跳躍（可躲攻擊）</span></div><div class="tutorial-control"><b>Z</b><span>槍刺・Spear Thrust</span></div><div class="tutorial-control"><b>X</b><span>盾擊・Shield Bash</span></div><div class="tutorial-control"><b>C</b><span>特殊技能（消耗 30 能量）</span></div><div class="tutorial-control"><b>Ⅱ / ▶</b><span>暫停 / 繼續</span></div></div><p class="tutorial-note">目標：通過 8 關，收集最多 6 件王子線索。亦可使用畫面上的觸控按鈕。</p>'
        }
        else {
            heading.textContent='排行榜';
            body.innerHTML='<p>🏆 本機排行榜</p><p>完成八關後，王子失蹤的真相將逐漸揭曉。</p>'
        }
        $('titlePopup').hidden=false
    }
    // ===== 輸入控制：把鍵盤和畫面按鈕轉成遊戲動作 =====
    function action(a) {
        if(document.body.classList.contains('spider-apocalypse')){keys.left=false;keys.right=false;return;}
        if(a==='left'||a==='right') {
            keys[a]=true;
            return
        }
        if(a==='ultimate') {
            ultimate();
            return
        }
        if(a==='jump') {
            requestJump();
            return
        }
        attack(a)
    }
    document.querySelectorAll('[data-act]').forEach(b=> {
        let a=b.dataset.act;
        b.addEventListener('pointerdown',e=> {
            e.preventDefault();
            action(a)
        });
        ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=> {
            keys[a]=false
        }))
    });
    window.addEventListener('keydown',e=> {
        if(['ArrowLeft','ArrowRight','ArrowUp',' '].includes(e.key))e.preventDefault();
        if(document.body.classList.contains('spider-apocalypse')){keys.left=false;keys.right=false;return;}
        if(e.key==='ArrowLeft')keys.left=true;
        if(e.key==='ArrowRight')keys.right=true;
        if(e.key==='ArrowUp'&&!e.repeat) requestJump();
        if(e.key.toLowerCase()==='z')attack('thrust');
        if(e.key.toLowerCase()==='x')attack('bash');
        if(e.key.toLowerCase()==='q')ultimate()
    });
    window.addEventListener('keyup',e=> {
        if(e.key==='ArrowLeft')keys.left=false;
        if(e.key==='ArrowRight')keys.right=false
    });
    $('start').addEventListener('click',()=> {
        if(clueModalPhase)return;
        if(pendingChapterTransition) { startSecondChapter(); return; }
        if(running&&paused) {
            keys= {
            };
            paused=false;
            overlay.style.display='none';
            $('pause').textContent='Ⅱ';
            $('returnTitle').style.display='none';
            last=performance.now();
            return
        }
        setup();
        $('returnTitle').style.display='none'
    });
    $('returnTitle').addEventListener('click',showTitle);
    $('titleStart').addEventListener('click',setup);
    $('titleSettings').addEventListener('click',()=>openTitlePopup('settings'));
    $('titleTutorial').addEventListener('click',()=>openTitlePopup('tutorial'));
    $('titleRanking').addEventListener('click',()=>openTitlePopup('ranking'));
    $('closeTitlePopup').addEventListener('click',()=>$('titlePopup').hidden=true);
    $('pause').addEventListener('click',()=> {
        if(!running||clueModalPhase)return;
        paused=!paused;
        $('pause').textContent=paused?'▶':'Ⅱ';
        if(paused) {
            keys= {
            };
            hero.classList.remove('walking');
            $('modalTitle').textContent='遊戲暫停';
            $('modalDesc').textContent='休息一下，王子暫時不會再走失。';
            $('start').textContent='繼續遊戲';
            $('returnTitle').style.display='block';
            overlay.style.display='flex'
        }
        else {
            $('returnTitle').style.display='none';
            overlay.style.display='none';
            last=performance.now()
        }
    });
    // 線索互動：第一下只點物件本體，第二階段按「繼續」才恢復遊戲。
    $('clueRevealItem').addEventListener('click',()=>{
        if(clueModalPhase!==1 || !activeClue)return;
        clueModalPhase=2;
        $('clueReveal').hidden=true;
        $('clueDialog').hidden=false;
        $('clueContinue').hidden=false;
    });
    $('clueRevealItem').addEventListener('keydown',e=>{
        if((e.key==='Enter'||e.key===' ') && clueModalPhase===1){e.preventDefault();$('clueRevealItem').click();}
    });
    $('clueContinue').addEventListener('click',()=>{
        if(clueModalPhase===2)closeClue();
    });
})();
