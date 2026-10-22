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
        if(bossRush.active && bossRush.cameraAnchor!==null) {
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
        if(level!==4 || !e || e.dataset.boss!=='1' || e.dataset.spriteType!=='boss')return;
        const max= Math.max(1,+e.dataset.maxhp||100);
        const current=Math.max(0,Math.min(max,+e.dataset.hp||0));
        const percent=Math.round(current/max*100);
        if(bossHealthPanel)bossHealthPanel.hidden=e.classList.contains('dead');
        if(bossHealthFill)bossHealthFill.style.width=percent+'%';
        if(bossHealthPercent)bossHealthPercent.textContent=percent+'%';
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
            if(now-bossRush.phaseStartedAt<2500)return;
            bossRush.phase=bossRush.phase==='windup'?'dashOut':'dashAcross';
            bossRush.phaseStartedAt=now;
            bossRush.targetX=bossRush.phase==='dashOut'?bossRush.targetX:(bossRush.targetX===bossRush.leftX?bossRush.rightX:bossRush.leftX);
            // 集氣結束、Boss 開始衝刺的同一刻，切換成 skin 1。
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
            // 第二次衝刺前重新集氣，切回 skin2。
            setBossRushSprite(e.querySelector('.enemySprite'),'windup2');
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
        if(ultimateActive||knockbackUntilLanding||performance.now()<bashLockUntil)return;
        jumpBufferMs=PHYSICS.jumpBuffer;
    }
    function updatePlayerPhysics(dt){
        const bashLocked=performance.now()<bashLockUntil || knockbackUntilLanding;
        if(bashLocked){ keys.left=false; keys.right=false; moveV=0; }
        const dir=bashLocked?0:((keys.right?1:0)-(keys.left?1:0));
        const accel=onGround?PHYSICS.groundAccel:PHYSICS.airAccel;
        if(dir){
            moveV+=dir*accel*dt;
            moveV=Math.max(-PHYSICS.maxRun,Math.min(PHYSICS.maxRun,moveV));
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
        e.dataset.hp=String(boss?bossMaxHP:(enemyHP[type]??enemyHP.default??2));
        e.dataset.maxhp=e.dataset.hp;
        e.dataset.boss=boss||type==='boss'?'1':'0';
        e.dataset.lastAttack='0';
        enemies.appendChild(e);
        enemyList.push(e);
        spawnedThisLevel++
    }
    function clearEnemies() {
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
        spawn(Math.max(24,x-stageW*.22),false,true);
        spawn(Math.min(heroExitX()-30,x+stageW*.34),false,false);
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
        if(!running||paused||attackCd>0||knockbackUntilLanding)return;
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
            let ex=+e.dataset.x;
            const enemyCenter=ex+(e.offsetWidth||80)*.5;
            const heroCenter=x+(hero.offsetWidth||116)*.5;
            const dx=enemyCenter-heroCenter;
            const range=stageW*(kind==='thrust'?.14:kind==='bash'?.09:.24);
            if(kind==='special'||(dx*faceDir>=0&&Math.abs(dx)<range)) {
                const damage=tuneCombat.damage||{thrust:1,bash:2,special:3,shieldThrust:0.5};
                let type=e.dataset.type,dmg=damage[kind]??3;
                if(type==='shield'&&kind==='thrust')dmg=damage.shieldThrust??0.5;
                let eh=+e.dataset.hp-dmg;
                e.dataset.hp=eh;
                e.querySelector('.ehealth i').style.width=Math.max(0,eh/(+e.dataset.maxhp)*100)+'%';
                updateBossHealthBar(e);
                if(eh>0)checkBossRushThreshold(e);
                const es=e.querySelector('.enemySprite');
                const bossIsRushing=bossRush.active&&e===bossRush.boss;
                if(es&&!bossIsRushing) {
                    es.src=enemySpritePath(e.dataset.spriteType||type,'hit');
                    e.dataset.actionUntil=String(performance.now()+310);
                    clearTimeout(e._spriteTimer);
                    e._spriteTimer=setTimeout(()=> {
                        if(es.isConnected&&!e.classList.contains('dead')&&!(bossRush.active&&e===bossRush.boss))es.src=enemySpritePath(e.dataset.spriteType||type,'idle')
                    },tuneEffects.enemyHitPoseMs??300)
                }
                if(!bossIsRushing) {
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
                    kills++;
                    levelKills++;
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
        if(!running||paused||ultimateActive)return;
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
                const ex=+e.dataset.x;
                if(Math.abs(ex-x)>stageW*.32)return;
                const type=e.dataset.type;
                const ultimateDamage=tuneCombat.ultimateDamage||{default:5,shield:2.5};
                let dmg=ultimateDamage.default??5;
                // 特殊技對盾牌兵使用獨立傷害值。
                if(type==='shield')dmg=ultimateDamage.shield??2.5;
                const eh=+e.dataset.hp-dmg;
                e.dataset.hp=eh;
                updateBossHealthBar(e);
                if(eh>0)checkBossRushThreshold(e);
                const bar=e.querySelector('.ehealth i');
                if(bar)bar.style.width=Math.max(0,eh/(+e.dataset.maxhp)*100)+'%';
                const es=e.querySelector('.enemySprite');
                const bossIsRushing=bossRush.active&&e===bossRush.boss;
                if(es&&!bossIsRushing) {
                    es.src=enemySpritePath(e.dataset.spriteType||type,'hit');
                    e.dataset.actionUntil=String(performance.now()+370);
                    clearTimeout(e._spriteTimer);
                    e._spriteTimer=setTimeout(()=> {
                        if(es.isConnected&&!e.classList.contains('dead')&&!(bossRush.active&&e===bossRush.boss))es.src=enemySpritePath(e.dataset.spriteType||type,'idle')
                    },tuneEffects.ultimateEnemyHitPoseMs??360)
                }
                if(!bossIsRushing) {
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
                    kills++;
                    levelKills++;
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
                if(bossRush.active && e===bossRush.boss)continue;
                // 前方敵人持續面向女騎士；後方敵人保留生成時鎖定的相反方向。
                const enemyVisualCenter=ex+(e.dataset.boss==='1'?(e.offsetWidth||80)*.5:0);
                if(e.dataset.facingLocked!=='1') {
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
                        if(es) {
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
                        if(es && /_walk[1-8]\.png(?:$|\?)/.test(es.getAttribute('src')||'')) es.src=enemySpritePath(e.dataset.spriteType||type,'idle');
                    }
                    if(t-lastAtk>cool) {
                        e.dataset.lastAttack=String(t);
                        e.dataset.actionUntil=String(t+430);
                        const es=e.querySelector('.enemySprite');
                        if(es) {
                            es.src=enemySpritePath(e.dataset.spriteType||type,'attack');
                            clearTimeout(e._spriteTimer);
                            e._spriteTimer=setTimeout(()=> {
                                if(es.isConnected&&!e.classList.contains('hitflash'))es.src=enemySpritePath(e.dataset.spriteType||type,'idle')
                            },tuneEffects.enemyAttackPoseMs??420)
                        }
                        const incomingDamage=tuneEnemyAI.incomingDamage||{boss:8,heavy:5,assassin:4,acolyte:3,archer:3,default:2};
                        let dmg=incomingDamage[type]??incomingDamage.default??2;
                        if(jumpT===0) {
                            if(performance.now()<bashLockUntil){
                                floatText('0',x,28);
                            }else{
                                hp=Math.max(0,hp-Math.ceil(dmg/5));
                                floatText('−'+dmg,x,28)
                            }
                        }
                    }
                }
            }
            const currentLevelConfig=levelConfigs[level-1]||{};
            // Boss 關的目標總數包含最後登場的 Boss，因此普通敵人數量要預留 1 名給 Boss。
            const regularEnemyTarget=Math.max(0,targets[level-1]-(currentLevelConfig.boss?1:0));
            const livingEnemyCount=enemyList.filter(e=>!e.classList.contains('dead')).length;
            if(levelKills<regularEnemyTarget&&livingEnemyCount<4) {
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
                }
                bossSpawnedThisLevel=true;
                spawnTimer=0;
                floatText('Boss 出現！',bossX,48);
            }
            if(levelKills>=targets[level-1]&&!enemyList.some(e=>!e.classList.contains('dead'))&&!exitOpen) {
                exitOpen=true;
                exitX=heroExitX();
                exitPrompt.hidden=false;
                floatText('出口已開啟！',x,42)
            }
            if(exitOpen&&keys.right&&x>=exitX-1) {
                nextLevel()
            }
            if(hp<=0) {
                running=false;
                resetBossRush();
                showEnd('女神需要休息！','敵人太多了，重新出發再試一次。已收集的線索會在本次遊戲重開後重置。','重新開始')
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
