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
    },moveV=0,jumpY=0,jumpV=0,onGround=true,coyoteMs=0,jumpBufferMs=0,faceDir=1,spawnedThisLevel=0,bossSpawnedThisLevel=false,clues=[],clueIndex=0,exitOpen=false,exitX=0,heroActionUntil=0,heroActionSprite='images/hero/hero_stand.png',ultimateActive=false,ultimateCooldownUntil=0,ultimateToken=0,ultimateStartedAt=0,bashLockUntil=0,attackMoveLockUntil=0;
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
    // 升降機可由獨立測試頁啟用，或在正式流程第 9 關啟用。
    const elevatorStandaloneTest=window.GAME_TEST_ELEVATOR===1;
    let elevatorMode=elevatorStandaloneTest;
    let chapter3BossMode=false;
    const CHAPTER3_BOSS_DIR='images/chapter3/enemies/chapter3_boss/';
    // 最終絕招沿用舊版實際存在的四張閃電圖（第 4 張檔名為 attack5）。
    const CHAPTER3_BOSS_LIGHTNING_ATTACK_FRAMES=[1,2,3,5];
    const CHAPTER3_BOSS_BG_FRAMES=[1,2,3,4].map(n=>'images/chapter3/bg3/chapter3_stage_7_layer2_bg'+n+'.png');
    const chapter3BossState={boss:null,phase:'',phaseStartedAt:0,triggered:new Set(),queue:[],lastAttackAt:0,jumpCount:0,jumpIndex:0,jumpMode:'',wave:0,nextWaveAt:0,lightningPlan:[],lightningEffects:[],lastBgFrameAt:0,bgFrame:0,bgDarkness:0,bgFadeFrom:0,bgFadeTo:0,bgFadeStartedAt:0,bgFadeDuration:0,mixed20Active:false,mixed20NextTentacleAt:0,mixed20NextLightningAt:0,tentacleSpawnQueue:[],tentacleSpawnNextAt:0,countdown:null,killedHeroByUltimate:false,finalTriggered:false,pendingFinal:false,ultimateFx:null};
    const elevatorState={phase:'lift',wave:1,betweenMs:0,transitionMs:0,exitStartedAt:0,exitDurationMs:1250,startedAt:0,scrollY:0,scrollProgress:0,scrollMax:0,scrollHeight:0,scrollSpeed:0,shakeNextAt:0,shakeStartedAt:0,shakeUntil:0,shakeX:0,shakeY:0,brakeStartedAt:0,brakeDurationMs:0,brakeStartOffset:0,brakeDistance:0,brakeStartSpeed:0,brakeTargetOffset:0,stopShakeStartedAt:0,stopShakeUntil:0};
    // 第三章鬼魂發射使用者指定的原始藍青色圓球素材；慢速高拋物線、命中只扣血，不建立毒池。
    const ghostProjectiles=[];
    const GHOST_ORB_ASSET='images/chapter3/enemies/chapter3_enemy_1/chapter3_2_skin1_enemy_1_attack.png';
    // 升降機專用提示：原版本在首波生成後呼叫 announce()，但沒有定義函式，令 setup() 中途停止。
    let elevatorAnnouncementTimer=0;
    function announce(message, seconds=1.8){
        if(!elevatorMode)return;
        let notice=$('elevatorAnnouncement');
        if(!notice){
            notice=document.createElement('div');
            notice.id='elevatorAnnouncement';
            notice.className='elevator-announcement';
            notice.setAttribute('role','status');
            notice.setAttribute('aria-live','polite');
            notice.hidden=true;
            stage.appendChild(notice);
        }
        if(elevatorAnnouncementTimer){window.clearTimeout(elevatorAnnouncementTimer);elevatorAnnouncementTimer=0;}
        notice.textContent=message;
        notice.hidden=false;
        notice.classList.add('is-visible');
        elevatorAnnouncementTimer=window.setTimeout(()=>{
            notice.classList.remove('is-visible');
            notice.hidden=true;
            elevatorAnnouncementTimer=0;
        }, Math.max(0.2, Number(seconds)||1.8)*1000);
    }
    // 可調整數值集中於 js/game-tuning.js；此處只讀取設定，不把數值散落在主程式。
    const gameTuning=window.GAME_TUNING||{};
    const tuneEffects=gameTuning.effects||{};
    const tuneCombat=gameTuning.combat||{};
    const tuneEnemyAI=gameTuning.enemyAI||{};
    // 第三章海況效果：只讀取背景檔名決定效果，不更改戰鬥、碰撞或 HUD。
    const seaWeatherState={profile:null,startedAt:0,nextLightningAt:0,pulses:[],shakeStartedAt:0,shakeUntil:0,shakeStrength:0,nextDarkAt:0,darkStartedAt:0,darkUntil:0,darkDuration:0,darkStrength:0};
    const seaRainOverlay=$('seaRainOverlay'),seaLightningFlash=$('seaLightningFlash'),seaBackgroundDarken=$('seaBackgroundDarken');
    const SEA_WEATHER_PROFILES={
        // Stage 3–5 使用舊 Stage 6 的持續搖晃幅度；海況、閃電及暗化頻率逐關加強。
        stage3:{id:'stage3',ampX:7.1,ampY:4.15,periodX:2350,periodY:2950,lightning:true,rain:false,lightningMin:4700,lightningMax:7800,doubleChance:.18,strongChance:.36,flashAlpha:.50,strongFlashAlpha:.72,shakeStrength:6.4,shakeDurationMs:205,darkMin:8500,darkMax:13500,darkHoldMs:3000,darkFlickerMs:2100,darkStrength:.44},
        stage4:{id:'stage4',ampX:7.1,ampY:4.15,lightning:true,rain:false,lightningMin:3500,lightningMax:6000,doubleChance:.30,strongChance:.42,flashAlpha:.56,strongFlashAlpha:.80,shakeStrength:6.4,shakeDurationMs:215,darkMin:6300,darkMax:10300,darkHoldMs:3000,darkFlickerMs:2100,darkStrength:.53},
        stage5:{id:'stage5',ampX:7.1,ampY:4.15,periodX:1600,periodY:2050,lightning:true,rain:false,lightningMin:2700,lightningMax:4700,doubleChance:.36,strongChance:.48,flashAlpha:.61,strongFlashAlpha:.86,shakeStrength:6.4,shakeDurationMs:225,darkMin:4400,darkMax:7200,darkHoldMs:3000,darkFlickerMs:2100,darkStrength:.61},
        // Stage 6 is the storm peak: stronger continuous movement, more frequent/brighter lightning, and longer impact shake.
        stage6:{id:'stage6',ampX:9.3,ampY:5.45,periodX:1280,periodY:1690,lightning:true,rain:true,lightningMin:2100,lightningMax:4300,doubleChance:.42,strongChance:.56,flashAlpha:.68,strongFlashAlpha:.94,shakeStrength:8.2,shakeDurationMs:265},
        // 新增 Boss 關：保留第六關持續雨幕及閃電，並加入第五關式突然變暗。
        stage7:{id:'stage7',ampX:8.3,ampY:4.9,periodX:1380,periodY:1810,lightning:true,rain:true,lightningMin:1700,lightningMax:3400,doubleChance:.46,strongChance:.62,flashAlpha:.70,strongFlashAlpha:.96,shakeStrength:8.5,shakeDurationMs:270,darkMin:4400,darkMax:7200,darkHoldMs:3000,darkFlickerMs:2100,darkStrength:.61}
    };
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
    const titleAudio=new Audio('audio/title_bgm.ogg');
    titleAudio.loop=true;
    titleAudio.volume=0.25;
    const bgmAudio=new Audio('audio/fantasy_rpg_bgm.ogg');
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
        thrust:{src:'audio/spear_thrust.ogg',volume:SFX_VOLUME,voices:[]},
        bash:{src:'audio/shield_bash.ogg',volume:SFX_VOLUME,voices:[]}
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
    // 第三章雷暴 Boss 音效：閃電獨立播放；所有觸手共用唯一 Audio 通道與有限佇列。
    const chapter3BossSfxFiles={
        lightning:'audio/chapter3_boss/lightning_04.ogg',
        charge1:'audio/chapter3_boss/tentacle_charge_1.ogg',
        charge2:'audio/chapter3_boss/tentacle_charge_2.ogg',
        attack1:'audio/chapter3_boss/tentacle_attack_1.ogg',
        attack2:'audio/chapter3_boss/tentacle_attack_2.ogg'
    };
    const chapter3BossSfxPools={};
    const chapter3TentacleAudio={
        audio:null,queue:[],active:null,nextId:1,paused:false,maxQueue:48,
        getAudio(){if(!this.audio){this.audio=new Audio();this.audio.preload='auto';this.audio.volume=.34;this.audio.addEventListener('ended',()=>this.finishCurrent());this.audio.addEventListener('error',()=>this.finishCurrent());}return this.audio;},
        enqueue(tentacle,kind){
            if(!tentacle||tentacle.classList.contains('dead')||tentacle.dataset.chapter3Tentacle!=='1')return;
            const src=chapter3BossSfxFiles[kind];if(!src)return;
            if(!tentacle.dataset.tentacleAudioId)tentacle.dataset.tentacleAudioId='tentacle-'+(this.nextId++);
            const id=tentacle.dataset.tentacleAudioId;
            // 同一觸手同一事件只入列一次；不累積重複的集氣／攻擊事件。
            const cycle=Number(tentacle.dataset.audioActionCycle)||0;
            const eventKey=kind==='spawn'?'spawn':(kind+'_'+cycle);
            const stateKey='audio_'+eventKey;
            if(tentacle.dataset[stateKey]==='1')return;
            tentacle.dataset[stateKey]='1';
            const actualKind=kind==='spawn'?(Math.random()<.5?'attack1':'attack2'):kind;
            if(this.queue.length>=this.maxQueue){
                // 壓力過大時丟棄最舊的待播項，避免無限排隊；不丟棄目前播放項。
                const staleIndex=this.queue.findIndex(item=>!item.owner||item.owner.classList.contains('dead'));
                if(staleIndex>=0)this.queue.splice(staleIndex,1);else return;
            }
            this.queue.push({id,owner:tentacle,kind:actualKind,src:chapter3BossSfxFiles[actualKind]});
            this.pump();
        },
        pump(){
            if(this.paused||this.active)return;
            while(this.queue.length){
                const item=this.queue.shift();
                if(!item.owner||!item.owner.isConnected||item.owner.classList.contains('dead')||item.owner.dataset.tentacleAudioId!==item.id)continue;
                const audio=this.getAudio();this.active=item;
                try{audio.pause();audio.currentTime=0;audio.src=item.src;audio.volume=item.kind.startsWith('charge')?.30:.34;const result=audio.play();if(result&&result.catch)result.catch(()=>{if(this.active===item)this.finishCurrent();});}
                catch(error){this.finishCurrent();}
                return;
            }
        },
        finishCurrent(){const audio=this.audio;this.active=null;if(audio){try{audio.pause();audio.currentTime=0;}catch(error){}}if(!this.paused)this.pump();},
        removeTentacle(tentacle){
            if(!tentacle)return;const id=tentacle.dataset.tentacleAudioId;if(!id)return;
            this.queue=this.queue.filter(item=>item.id!==id);
            if(this.active&&this.active.id===id){const audio=this.audio;this.active=null;if(audio){try{audio.pause();audio.currentTime=0;}catch(error){}}}
            tentacle.dataset.audio_spawn='0';tentacle.dataset.audio_charge1='0';tentacle.dataset.audio_charge2='0';tentacle.dataset.audio_attack1='0';tentacle.dataset.audio_attack2='0';
            if(!this.paused)this.pump();
        },
        pause(){this.paused=true;if(this.audio&&!this.audio.paused){try{this.audio.pause();}catch(error){}}},
        resume(){if(!this.paused)return;this.paused=false;if(this.active&&this.active.owner&&!this.active.owner.classList.contains('dead')){const result=this.getAudio().play();if(result&&result.catch)result.catch(()=>this.finishCurrent());}else this.pump();},
        clear(){this.queue.length=0;this.active=null;this.paused=false;if(this.audio){try{this.audio.pause();this.audio.currentTime=0;this.audio.removeAttribute('src');this.audio.load();}catch(error){}}}
    };
    function playChapter3BossSfx(kind){
        if(kind==='charge1'||kind==='charge2'||kind==='attack1'||kind==='attack2')return; // 觸手必須經由單一管理器播放。
        const src=chapter3BossSfxFiles[kind];if(!src)return;
        let pool=chapter3BossSfxPools[kind];if(!pool){pool=chapter3BossSfxPools[kind]={voices:[],volume:.42};}
        let voice=pool.voices.find(item=>item.audio.ended||item.audio.paused||item.audio.currentTime===0);
        if(!voice){const audio=new Audio(src);audio.preload='auto';audio.volume=pool.volume;voice={audio};pool.voices.push(voice);}
        try{voice.audio.pause();voice.audio.currentTime=0;voice.audio.src=src;voice.audio.volume=pool.volume;const result=voice.audio.play();if(result&&result.catch)result.catch(()=>{});}catch(error){}
    }
    function stopChapter3BossSfx(){
        Object.values(chapter3BossSfxPools).forEach(pool=>pool.voices.forEach(voice=>{try{voice.audio.pause();voice.audio.currentTime=0;}catch(error){}}));
        chapter3TentacleAudio.clear();
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
        chapter3TentacleAudio.resume();
        $('pause').textContent='Ⅱ';
        last=performance.now();
        keys={};
    }
    // ===== 世界與鏡頭：計算關卡寬度、角色位置及鏡頭跟隨 =====
    function sizeWorld() {
        stageW=stage.clientWidth;
        stageH=stage.clientHeight;
        if(elevatorMode){
            // Layer 1 與一般關卡 BG 相同：依舞台高度縮放、保留原圖比例，world 可水平捲動。
            const layer1=$('elevatorForeground');
            const ratio=(layer1&&layer1.naturalWidth&&layer1.naturalHeight)?layer1.naturalWidth/layer1.naturalHeight:7.15;
            bgW=Math.max(stageW,stageH*ratio);worldW=bgW;
            world.style.width=worldW+'px';world.style.height=stageH+'px';
            levelBackground.style.width=worldW+'px';levelBackground.style.height=stageH+'px';
            if(layer1){layer1.style.width=worldW+'px';layer1.style.height=stageH+'px';}
            const bgView=$('elevatorBgViewport');
            if(bgView){bgView.style.width=worldW+'px';bgView.style.height=stageH+'px';}
            const exitBackdrop=$('elevatorExitBackdrop');
            if(exitBackdrop){exitBackdrop.style.width=worldW+'px';exitBackdrop.style.height=stageH+'px';}
            const blank=world.querySelector('.world-blank');
            blank.style.left=bgW+'px';blank.style.width='0px';blank.style.height=stageH+'px';
            elevatorMeasureBackground();
            updateCamera();
            return;
        }
        if(chapter3BossMode){
            // Boss 關跟電梯關一樣保留 Layer 1 原始長寬比，視窗只顯示鏡頭目前所在的一段。
            const layer1=$('elevatorForeground'),bgView=$('elevatorBgViewport');
            const ratio=(layer1&&layer1.naturalWidth&&layer1.naturalHeight)?layer1.naturalWidth/layer1.naturalHeight:7.15;
            bgW=Math.max(stageW,stageH*ratio);worldW=bgW;
            world.style.width=worldW+'px';world.style.height=stageH+'px';
            levelBackground.style.width=worldW+'px';levelBackground.style.height=stageH+'px';
            if(layer1){layer1.style.width=worldW+'px';layer1.style.height=stageH+'px';}
            if(bgView){bgView.style.width=worldW+'px';bgView.style.height=stageH+'px';bgView.style.backgroundSize='auto 100%';}
            const blank=world.querySelector('.world-blank');
            blank.style.left=bgW+'px';blank.style.width='0px';blank.style.height=stageH+'px';
            updateCamera();
            return;
        }
        const ratio=(levelBackground.naturalWidth&&levelBackground.naturalHeight)?levelBackground.naturalWidth/levelBackground.naturalHeight:7.5;
        const currentConfig=levelConfigs[level-1]||{};
        // Chapter 3's four side-scrolling storm arenas must always leave room for the camera to track the hero.
        // On unusually wide viewports, retain at least 1.8 view widths of world so scrolling cannot collapse to zero.
        const isChapter3SeaArena=currentConfig.chapter===3&&!currentConfig.elevator&&!currentConfig.noEnemies&&/chapter3_stage_[3-6]_BG\.png$/.test(currentConfig.background||'');
        const minimumWorldWidth=isChapter3SeaArena?stageW*1.8:stageW;
        bgW=Math.max(stageW,stageH*ratio,minimumWorldWidth);
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
    function getSeaWeatherProfile(){
        if(elevatorMode)return null;
        const config=levelConfigs[level-1]||{};
        if(config.chapter3Boss)return SEA_WEATHER_PROFILES.stage7;
        const bg=config.background||'';
        if(bg.endsWith('chapter3_stage_3_BG.png'))return SEA_WEATHER_PROFILES.stage3;
        if(bg.endsWith('chapter3_stage_4_BG.png'))return SEA_WEATHER_PROFILES.stage4;
        if(bg.endsWith('chapter3_stage_5_BG.png'))return SEA_WEATHER_PROFILES.stage5;
        if(bg.endsWith('chapter3_stage_6_BG.png'))return SEA_WEATHER_PROFILES.stage6;
        return null;
    }
    function clearSeaWeather(){
        seaWeatherState.profile=null;seaWeatherState.pulses=[];seaWeatherState.nextLightningAt=0;seaWeatherState.shakeStartedAt=0;seaWeatherState.shakeUntil=0;seaWeatherState.shakeStrength=0;seaWeatherState.nextDarkAt=0;seaWeatherState.darkStartedAt=0;seaWeatherState.darkUntil=0;seaWeatherState.darkDuration=0;seaWeatherState.darkStrength=0;
        stage.classList.remove('sea-weather-enabled','sea-rain-active');
        if(seaLightningFlash)seaLightningFlash.style.opacity='0';
        if(seaRainOverlay)seaRainOverlay.style.opacity='0';
        if(seaBackgroundDarken)seaBackgroundDarken.style.opacity='0';
    }
    function updateSeaWeather(t,forceReset=false){
        const profile=getSeaWeatherProfile();
        if(!profile){if(seaWeatherState.profile)clearSeaWeather();return;}
        if(forceReset||!seaWeatherState.profile||seaWeatherState.profile.id!==profile.id){
            seaWeatherState.profile=profile;seaWeatherState.startedAt=t;seaWeatherState.pulses=[];seaWeatherState.shakeStartedAt=0;seaWeatherState.shakeUntil=0;seaWeatherState.shakeStrength=0;
            seaWeatherState.darkStartedAt=0;seaWeatherState.darkUntil=0;seaWeatherState.darkDuration=0;seaWeatherState.darkStrength=0;
            seaWeatherState.nextLightningAt=profile.lightning?t+profile.lightningMin+Math.random()*(profile.lightningMax-profile.lightningMin):Number.POSITIVE_INFINITY;
            seaWeatherState.nextDarkAt=profile.darkMin?t+profile.darkMin+Math.random()*(profile.darkMax-profile.darkMin):Number.POSITIVE_INFINITY;
            stage.classList.add('sea-weather-enabled');stage.classList.toggle('sea-rain-active',!!profile.rain);
            if(seaRainOverlay)seaRainOverlay.style.opacity=profile.rain?'1':'0';
            if(seaLightningFlash)seaLightningFlash.style.opacity='0';
            if(seaBackgroundDarken)seaBackgroundDarken.style.opacity='0';
        }
        if(profile.lightning&&t>=seaWeatherState.nextLightningAt){
            if(chapter3BossMode)playChapter3BossSfx('lightning');
            const strong=Math.random()<profile.strongChance;
            const strength=strong?profile.strongFlashAlpha:profile.flashAlpha;
            seaWeatherState.pulses.push({start:t,duration:strong?255:195,alpha:strength});
            if(Math.random()<profile.doubleChance){
                seaWeatherState.pulses.push({start:t+105,duration:strong?205:160,alpha:strength*(strong?.82:.72)});
            }
            // 強閃電帶來更明顯的短震；持續時間依關卡逐步增加。
            if(strong){seaWeatherState.shakeStartedAt=t;seaWeatherState.shakeUntil=t+(profile.shakeDurationMs||210);seaWeatherState.shakeStrength=profile.shakeStrength;}
            seaWeatherState.nextLightningAt=t+profile.lightningMin+Math.random()*(profile.lightningMax-profile.lightningMin);
        }
        // Stage 3–5：突然變暗並維持 3 秒，之後像故障燈光般暗／亮交替數次，再逐步回復。
        if(profile.darkMin&&t>=seaWeatherState.nextDarkAt){
            seaWeatherState.darkStartedAt=t;
            const holdMs=profile.darkHoldMs||3000;
            const flickerMs=profile.darkFlickerMs||2100;
            seaWeatherState.darkDuration=holdMs+flickerMs;
            seaWeatherState.darkUntil=t+seaWeatherState.darkDuration;
            seaWeatherState.darkStrength=profile.darkStrength;
            // 下一次只在這輪暗化與閃爍完全結束後開始，避免效果中途被重設。
            seaWeatherState.nextDarkAt=seaWeatherState.darkUntil+profile.darkMin+Math.random()*(profile.darkMax-profile.darkMin);
        }
        let darkAlpha=0;
        if(t<seaWeatherState.darkUntil&&seaWeatherState.darkDuration>0){
            const elapsed=Math.max(0,t-seaWeatherState.darkStartedAt);
            const holdMs=profile.darkHoldMs||3000;
            const flickerMs=profile.darkFlickerMs||2100;
            if(elapsed<90){
                // 快速壓暗，像船艙燈光突然熄掉。
                darkAlpha=seaWeatherState.darkStrength*Math.min(1,elapsed/70);
            }else if(elapsed<holdMs){
                // 維持明顯暗場整整約 3 秒。
                darkAlpha=seaWeatherState.darkStrength;
            }else{
                // 關燈／亮燈交替逐次減弱；最後一次逐漸淡出至正常亮度。
                const p=Math.max(0,Math.min(1,(elapsed-holdMs)/flickerMs));
                const flickerKeys=[
                    [0,1.00],[.07,.12],[.16,.94],[.25,.08],[.35,.78],
                    [.46,.18],[.57,.66],[.68,.10],[.79,.42],[.90,.05],[1,0]
                ];
                let value=0;
                for(let i=0;i<flickerKeys.length-1;i++){
                    const a=flickerKeys[i],b=flickerKeys[i+1];
                    if(p>=a[0]&&p<=b[0]){
                        const segment=(p-a[0])/(b[0]-a[0]);
                        value=a[1]+(b[1]-a[1])*segment;
                        break;
                    }
                }
                darkAlpha=seaWeatherState.darkStrength*Math.max(0,Math.min(1,value));
            }
        }
        if(seaBackgroundDarken)seaBackgroundDarken.style.opacity=darkAlpha.toFixed(3);
        seaWeatherState.pulses=seaWeatherState.pulses.filter(p=>t-p.start<p.duration);
        let alpha=0;
        for(const pulse of seaWeatherState.pulses){
            const progress=Math.max(0,(t-pulse.start)/pulse.duration);
            const envelope=progress<.10?1:Math.max(0,1-(progress-.10)/.90);
            alpha=Math.max(alpha,pulse.alpha*envelope);
        }
        if(seaLightningFlash)seaLightningFlash.style.opacity=alpha.toFixed(3);
    }
    function getSeaCameraOffset(t=performance.now()){
        const p=seaWeatherState.profile;
        if(!p)return {x:0,y:0};
        const elapsed=Math.max(0,t-seaWeatherState.startedAt);
        const phaseX=elapsed/p.periodX*Math.PI*2,phaseY=elapsed/p.periodY*Math.PI*2;
        let sx=Math.sin(phaseX)*p.ampX+Math.sin(phaseX*.47+1.1)*p.ampX*.22;
        let sy=Math.sin(phaseY+0.65)*p.ampY+Math.sin(phaseY*.63+2.0)*p.ampY*.18;
        if(t<seaWeatherState.shakeUntil){
            const life=Math.max(0,1-(t-seaWeatherState.shakeStartedAt)/Math.max(1,seaWeatherState.shakeUntil-seaWeatherState.shakeStartedAt));
            const phase=(t-seaWeatherState.shakeStartedAt)*.105;
            sx+=Math.sin(phase*1.7)*seaWeatherState.shakeStrength*life;
            sy+=Math.cos(phase*2.1)*seaWeatherState.shakeStrength*.52*life;
        }
        return {x:sx,y:sy};
    }
    let bossCameraReturnUntil=0;
    function updateCamera() {
        if(!stageW) return;
        // Derive the scroll range from both the tracked world size and the actually rendered background.
        // This guards against stale measurements when the image finishes loading during level startup.
        const declaredWorldWidth=Number.parseFloat(world.style.width)||0;
        const renderedBackgroundWidth=(levelBackground&&levelBackground.offsetWidth)||Number.parseFloat(levelBackground&&levelBackground.style.width)||0;
        const effectiveWorldWidth=Math.max(stageW,worldW||0,bgW||0,declaredWorldWidth,renderedBackgroundWidth);
        if(effectiveWorldWidth>worldW){
            worldW=effectiveWorldWidth;
            world.style.width=worldW+'px';
        }
        if(elevatorMode){
            // 電梯場景保留既有的 transform 相機；避免上一個海上關卡的 left 偏移殘留。
            world.style.left='0px';
            const maxCamera=Math.max(0,effectiveWorldWidth-stageW);
            cameraX=Math.max(0,Math.min(maxCamera,x-stageW*.45));
            const sx=Number(elevatorState.shakeX)||0, sy=Number(elevatorState.shakeY)||0;
            world.style.transform='translate3d('+(-cameraX+sx).toFixed(2)+'px,'+sy.toFixed(2)+'px,0)';
            const exitBackdrop=$('elevatorExitBackdrop');
            if(exitBackdrop&&!exitBackdrop.hidden){
                exitBackdrop.style.width=worldW+'px';
                exitBackdrop.style.height=stageH+'px';
                exitBackdrop.style.transform='translate3d('+(-cameraX+sx).toFixed(2)+'px,'+sy.toFixed(2)+'px,0)';
            }
            hero.style.left=x+'px';
            exitPrompt.hidden=!exitOpen;
            return;
        }
        const maxCamera=Math.max(0,effectiveWorldWidth-stageW);
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
        const seaOffset=getSeaCameraOffset(performance.now());
        const currentConfig=levelConfigs[level-1]||{};
        const useSeparateSeaCamera=(currentConfig.chapter===3&&!currentConfig.elevator&&!currentConfig.noEnemies&&/chapter3_stage_[3-6]_BG\.png$/.test(currentConfig.background||''))||chapter3BossMode;
        if(useSeparateSeaCamera){
            // Move the world with `left` and reserve `transform` for the storm sway. This prevents any transform animation/compositor rule from cancelling camera follow.
            world.style.left=(-cameraX).toFixed(2)+'px';
            world.style.transform='translate3d('+seaOffset.x.toFixed(2)+'px,'+seaOffset.y.toFixed(2)+'px,0)';
            if(chapter3BossMode){const bgView=$('elevatorBgViewport');if(bgView)bgView.style.backgroundPositionX=(cameraX*.75).toFixed(2)+'px';}
        }else{
            world.style.left='0px';
            world.style.transform='translate3d('+(-cameraX+seaOffset.x).toFixed(2)+'px,'+seaOffset.y.toFixed(2)+'px,0)';
        }
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
        fight:new Audio('audio/Boss fighting_sound effect.ogg'),
        triple:new Audio('audio/boss2 attack.ogg'),
        final:new Audio('audio/boss 2_final attack.ogg'),
        run:new Audio('audio/Boss fighting_sound run.ogg'),
        goddessDead:new Audio('audio/Boss fighting_sound_ggodnees_dead.ogg')
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
            spiderBossSkill.warning.dataset.targetX=String(target);floatText('萬毒蛛域・天羅降臨！',cx,56);
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
        floatText('萬毒蛛域降臨！',target,60);
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
    const chapter1BossRushChargeSprite='images/chapter1/boss/chapter1_boss_1_attack_skin2.png';
    const chapter1BossRushDashSprite='images/chapter1/boss/chapter1_boss_1_attack_skin%201.png';
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
        if(isChapter3Boss(e)){
            const maxHP=Math.max(1,Number(e.dataset.maxhp)||100);
            const state=chapter3BossState;
            // Boss 離場、觸手清場、背景轉場及右側重新入場期間均不可隔空削血。
            if(e.style.visibility==='hidden')return currentHP;
            if(['finalTentacles','finalThunder','finalAttack','finalImpact','finalDead'].includes(state.phase)||state.killedHeroByUltimate)return currentHP;
            if(state.mixed20Active&&state.phase!=='mixed20Combat'&&state.phase!=='mixed20ExitFade')return currentHP;
            // 五秒倒數已到就鎖定 Boss，不讓下一個畫面更新前的攻擊越過絕招判定。
            if(state.phase==='finalCharge'&&performance.now()-state.phaseStartedAt>=5000)return currentHP;
            if(next>0){
                const oldRatio=currentHP/maxHP,newRatio=next/maxHP;
                [0.80,0.60,0.40,0.20].forEach(threshold=>{
                    const key=String(Math.round(threshold*100));
                    if(oldRatio>threshold&&newRatio<=threshold&&!state.triggered.has(key)){
                        state.triggered.add(key);state.queue.push(threshold);
                    }
                });
                // 20% 混合階段到達 12% 即開始收尾；保留真實傷害後的 HP，不設血量鎖。
                if(state.mixed20Active&&state.phase!=='mixed20ExitFade'&&oldRatio>0.12&&newRatio<=0.12){
                    state.triggered.add('12');
                    chapter3BossStartMixed20Exit(e,performance.now());
                    if(newRatio<=0.10)state.pendingFinal=true;
                    return next;
                }
                if(state.phase==='mixed20ExitFade'&&newRatio<=0.10)state.pendingFinal=true;
                // 若單次高傷害同時跨過 20% 及更低門檻，先鎖在 20%，
                // 讓排隊中的 80/60/40/20 階段依序完成，不可直接跳過混合模式。
                if(!state.mixed20Active&&state.queue.includes(0.2))return Math.max(1,maxHP*0.20);
                if(newRatio<=0.10&&!state.finalTriggered&&state.phase!=='mixed20ExitFade'){
                    state.triggered.add('10');
                    chapter3BossStartFinal(e,performance.now());
                }
            }
            return next;
        }
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
        sword.src='images/chapter1/boss/boss1_final_sword.png';
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
        impact.src='images/chapter1/boss/boss1_final_impact.png';
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
    function isChapter3Boss(e){return !!e&&e.dataset.boss==='1'&&e.dataset.spriteType==='chapter3_boss_1';}
    function updateBossHealthBar(e) {
        const boss1=level===4&&e&&e.dataset.boss==='1'&&e.dataset.spriteType==='boss';
        const spider=level===8&&e&&e.dataset.boss==='1'&&e.dataset.spriteType==='chapter2_boss_2';
        const chapter3Boss=isChapter3Boss(e);
        if(!boss1&&!spider&&!chapter3Boss)return;
        const max=Math.max(1,+e.dataset.maxhp||100);
        const current=Math.max(0,Math.min(max,+e.dataset.hp||0));
        const percent=Math.round(current/max*100);
        if(bossHealthPanel)bossHealthPanel.hidden=e.classList.contains('dead');
        if(bossHealthFill)bossHealthFill.style.width=percent+'%';
        if(bossHealthPercent)bossHealthPercent.textContent=percent+'%';
        const heading=bossHealthPanel?.querySelector('.boss-health-heading strong');
        if(heading)heading.textContent=chapter3Boss?'雷暴海王':(spider?'萬毒蛛王':'皇廷看更隊長');
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
    function activeGroundBottom(){
        // 全遊戲共用同一條站立基準；關卡、升降機停靠與出口轉場都不得另外覆寫。
        return gameTuning.player?.groundBottom || '14%';
    }
    const PHYSICS=gameTuning.player?.physics||{maxRun:.255,groundAccel:.00155,groundBrake:.00215,airAccel:.00082,gravity:.00205,jumpSpeed:.72,maxFall:.92,coyote:105,jumpBuffer:120};
    function resetMovementPhysics(){
        knockbackUntilLanding=false;knockbackDirection=0;knockbackHitUntil=0;hero.classList.remove('boss-knocked');
        moveV=0;jumpY=0;jumpV=0;onGround=true;coyoteMs=0;jumpBufferMs=0;jumpT=0;
        hero.style.setProperty('bottom',activeGroundBottom(),'important');
        hero.classList.remove('jump');
    }
    function requestJump(){
        if(chapter3BossPlayerLocked()||document.body.classList.contains('spider-apocalypse')||ultimateActive||knockbackUntilLanding||performance.now()<bashLockUntil||performance.now()<attackMoveLockUntil)return;
        jumpBufferMs=PHYSICS.jumpBuffer;
    }
    function updatePlayerPhysics(dt){
        if(chapter3BossPlayerLocked()){
            keys.left=false;keys.right=false;moveV=0;jumpBufferMs=0;jumpV=0;jumpY=0;jumpT=0;onGround=true;
            hero.classList.remove('walking','jump');hero.style.setProperty('bottom',activeGroundBottom(),'important');return;
        }
        if(document.body.classList.contains('spider-apocalypse')) {
            keys.left=false;keys.right=false;moveV=0;jumpBufferMs=0;jumpV=0;jumpY=0;jumpT=0;onGround=true;hero.classList.remove('walking','jump');
            hero.style.setProperty('bottom',activeGroundBottom(),'important');return;
        }
        if(chapter1FinalSkill.active) {
            keys.left=false;keys.right=false;moveV=0;jumpBufferMs=0;
            hero.classList.remove('walking');
            return;
        }
        const now=performance.now();
        const movementLocked=ultimateActive || now<attackMoveLockUntil || now<bashLockUntil || now<knockbackHitUntil || knockbackUntilLanding;
        if(movementLocked){ keys.left=false; keys.right=false; moveV=0; }
        const dir=movementLocked?0:((keys.right?1:0)-(keys.left?1:0));
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
        hero.style.setProperty('bottom','calc('+(activeGroundBottom())+' + '+jumpY.toFixed(1)+'px)','important');
        hero.classList.toggle('walking',!ultimateActive&&onGround&&Math.abs(moveV)>.035);
    }

    function placeEnemy(e,px) {
        e.dataset.x=px;
        e.style.left=px+'px'
    }
    function setupLevelBackground() {
        const config=levelConfigs[level-1]||{};
        levelBackground.src=config.background||bgFiles[level-1];
        levelBackground.onload=()=> { sizeWorld(); };
        if(chapter3BossMode){
            const bgView=$('elevatorBgViewport'),layer1=$('elevatorForeground'),exit=$('elevatorExitBackdrop');
            if(bgView){bgView.hidden=false;bgView.style.backgroundImage='url("'+CHAPTER3_BOSS_BG_FRAMES[0]+'")';bgView.style.backgroundPositionX='0px';bgView.style.backgroundSize='auto 100%';bgView.style.backgroundRepeat='repeat-x';bgView.style.filter='brightness(1)';}
            if(layer1){layer1.hidden=false;layer1.onload=()=>{if(chapter3BossMode)sizeWorld();};layer1.src='images/chapter3/bg3/chapter3_stage_7_layer1_bg.png';if(layer1.complete&&layer1.naturalWidth)sizeWorld();}
            if(exit)exit.hidden=true;
            chapter3BossState.bgFrame=0;chapter3BossState.lastBgFrameAt=performance.now();
        }
        if(levelBackground.complete)sizeWorld()
    }
    window.addEventListener('resize',()=> {
        if(running) {
            sizeWorld();
            updateCamera();
            enemyList.forEach(applyChapter3FootAnchor)
        }
    });
    // ===== HUD：更新血量、能量、關卡與線索數字 =====
    function updateHud() {
        $('hpbar').style.width=hp+'%';
        $('mpbar').style.width=mp+'%';
        const config=levelConfigs[level-1]||{};
        if(elevatorMode){
            if(elevatorState.phase==='dock') $('count').textContent=elevatorStandaloneTest?'碼頭 · 下一版':'第 9 關完成 · 碼頭';
            else if(elevatorState.phase==='exit') $('count').textContent='出口轉場';
            else if(elevatorState.phase==='braking') $('count').textContent='第 5 波完成 · 升降機減速中';
            else if(elevatorState.phase==='stopping') $('count').textContent='第 5 波完成 · 升降機急停中';
            else if(elevatorState.phase==='stopped') $('count').textContent='升降機已停 · 25 / 25';
            else $('count').textContent='第 '+elevatorState.wave+' / 5 波 · '+levelKills+' / 25';
            $('count').title='第三章：水晶洞升降機';
        }else{
            $('count').textContent='第 '+level+' 關 · '+levelKills+' / '+targets[level-1];
            $('count').title='第 '+(config.chapter||1)+' 章：'+(config.name||'冒險');
        }
        $('gems').textContent='◆ '.repeat(Math.max(0,Math.min(3,Math.ceil(mp/34)))).trim()||'◇ ◇ ◇';
        $('clueBook').textContent='線索 '+clues.length+'/6'
    }
    // ===== 敵人圖片：交由 js/enemies.js 尋找圖片路徑 =====
    // 這裡只保留呼叫，不再把每種敵人的圖片規則混在主程式。
    const enemySpritePath = window.EnemyVisuals.enemySpritePath;

    // 第三章自訂素材的「可見鞋底錨點」校正值，單位為 PNG 原始畫布像素（515×284）。
    // 之前只把任何非透明像素貼到底線；淡 alpha、武器／衣襬等會誤導底線，故改以逐幀鞋底視覺位置校正。
    // 值代表要把該幀美術圖層向下移的原圖像素；不會更改敵人容器、AI、碰撞或 14% 地面座標。
    const CHAPTER3_FOOT_ANCHORS = {
        chapter3_enemy_2: { normal:24, attack:24, walk1:12, walk2:24, walk3:20, walk4:20 },
        chapter3_enemy_4: { normal:24, attack:24, walk1:13, walk2:24, walk3:22, walk4:19 },
        // normal 待機姿勢也要校正，否則 walk 與 normal 切換時會出現垂直跳位。
        // normal 值取相鄰行走影格的中間基準，降低姿勢切換時的視覺落差。
        chapter3_enemy_5: { normal:3, walk1:9, walk2:3, walk3:1, walk4:1 },
        chapter3_enemy_7: { normal:2, walk1:4, walk2:1, walk3:3, walk4:1 },
        chapter3_enemy_8: { walk1:1, walk2:1, walk3:1, walk4:1 }
    };
    function applyChapter3FootAnchor(enemy) {
        if (!enemy || !enemy.isConnected) return;
        const anchors = CHAPTER3_FOOT_ANCHORS[enemy.dataset.spriteType];
        const sprite = enemy.querySelector('.enemySprite');
        const frame = enemy.querySelector('.enemy-art-frame');
        if (!anchors || !sprite || !frame) return;
        const src = (sprite.getAttribute('src') || '').split('?')[0];
        const filename = src.slice(src.lastIndexOf('/') + 1);
        const match = filename.match(/_(normal|attack2|attack|hit|idle|walk\d+)\.png$/);
        const pose = match ? match[1] : '';
        const sourcePixels = Number(anchors[pose] || 0);
        // image is width-constrained (source width 515 px); inner offset is then scaled by the enemy-art multiplier.
        const renderedSourceScale = (enemy.offsetWidth || 150) / 515;
        frame.style.transform = `translateY(${(sourcePixels * renderedSourceScale).toFixed(2)}px)`;
    }
    function observeChapter3FootAnchor(enemy, sprite) {
        if (!CHAPTER3_FOOT_ANCHORS[enemy.dataset.spriteType] || !sprite) return;
        const observer = new MutationObserver(() => applyChapter3FootAnchor(enemy));
        observer.observe(sprite, { attributes:true, attributeFilter:['src'] });
        enemy._chapter3FootAnchorObserver = observer;
        applyChapter3FootAnchor(enemy);
    }
    function disconnectChapter3FootAnchorObserver(enemy) {
        if (enemy && enemy._chapter3FootAnchorObserver) {
            enemy._chapter3FootAnchorObserver.disconnect();
            enemy._chapter3FootAnchorObserver = null;
        }
    }

    // ===== 敵人：建立一名新敵人並加入清單 =====
    function spawn(xp,boss=false,behind=false) {
        const config=levelConfigs[level-1]||levelConfigs[0];
        const types=(config.enemies&&config.enemies.length)?config.enemies:['skeleton'];
        const chosenType=boss?'boss':types[Math.floor(Math.random()*types.length)];
        let type=chosenType;
        let visualType=chosenType;
        const chapter3Names={
            chapter3_enemy_2:'逃犯',chapter3_enemy_3:'黑袍神醫',chapter3_enemy_4:'正字逃犯',
            chapter3_enemy_5:'大隻佬EX',chapter3_enemy_6:'普通水手',
            chapter3_enemy_7:'被批評廚房副手',chapter3_enemy_8:'被批評廚房主廚'
        };
        const chapter3CombatTypes={
            chapter3_enemy_2:'assassin',chapter3_enemy_3:'acolyte',chapter3_enemy_4:'assassin',
            chapter3_enemy_5:'heavy',chapter3_enemy_6:'skeleton',chapter3_enemy_7:'heavy',chapter3_enemy_8:'heavy'
        };
        if(boss && config.chapter3Boss) {
            visualType='chapter3_boss_1';
            type='boss';
        } else if(!boss && config.chapter3Enemies && chapter3Names[chosenType]) {
            // visualType 決定第三章專屬 PNG；type 則沿用現有戰鬥系統的碰撞、血量與 AI 數值。
            visualType=chosenType;
            type=chapter3CombatTypes[chosenType]||'assassin';
        } else if(boss && config.chapter===2) {
            const clueCount=clues.length;
            const hasAllChapter2Clues=level===8 ? clueCount===6 : ['chapter2_clock','chapter2_jelwellery','chapter2_sword'].every(id=>foundClues.has(id));
            visualType=hasAllChapter2Clues?'chapter2_boss_1':'chapter2_boss_2';
        } else if(!boss && config.chapter2Enemies) {
            visualType='chapter2_enemy_'+(1+Math.floor(Math.random()*7));
        }
        const names= {
            skeleton:'普通兵',archer:'高階兵',shield:'盾牌兵',heavy:'重裝精英',assassin:'刺客',acolyte:'精英級',boss:visualType==='chapter3_boss_1'?'雷暴海王':(visualType==='chapter2_boss_1'?'隱藏頭目':'章節頭目')
        };
        if(elevatorStandaloneTest&&type==='assassin')names.assassin='測試怪物 1';
        else if(level===9&&type==='assassin')names.assassin='水晶洞怪物';
        const displayName=chapter3Names[visualType]||names[type]||'敵人';
        const e=document.createElement('div');
        e.className='enemy enemy-'+type;
        e.innerHTML='<div class="enemy-name">'+displayName+'</div><div class="ehealth"><i></i></div><div class="enemy-art"><div class="enemy-art-frame"><img class="enemySprite" src="'+enemySpritePath(visualType,'idle')+'" alt="'+displayName+'"></div></div>';
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
        // 第三章新敵人素材預設面向畫面右方，生成時依玩家位置決定是否水平翻轉，之後每幀自動追蹤玩家。
        // 不鎖定這批敵人的初始朝向，避免從玩家身後生成時一直背對玩家。舊章節維持原本規則。
        const usesChapter3Facing = /^chapter3_enemy_[1-8]$/.test(visualType);
        const initialFacing = usesChapter3Facing
            ? (xp > x ? 'left' : 'right')
            : (behind ? (xp < x ? 'left' : 'right') : (xp > x ? 'right' : 'left'));
        e.dataset.facing=initialFacing;
        e.dataset.facingLocked=usesChapter3Facing?'0':(behind?'1':'0');
        e.classList.toggle('enemy-facing-left', initialFacing==='left');
        e.style.left=xp+'px';
        e.dataset.x=xp;
        e.dataset.type=type;
        e.dataset.spriteType=visualType;
        e.dataset.rank=type==='heavy'?'elite':'normal';
        const enemyHP=gameTuning.enemyHP||{boss:10,chapter1Boss:50,heavy:4,shield:4,assassin:3,acolyte:3,default:2};
        const bossMaxHP=(boss&&config.chapter3Boss)?100:((boss&&level===4)?(enemyHP.chapter1Boss??100):(enemyHP.boss??10));
        const spiderBossMaxHP=(boss&&level===8&&visualType==='chapter2_boss_2')?80:null;
        e.dataset.hp=String(spiderBossMaxHP??(boss?bossMaxHP:(enemyHP[type]??enemyHP.default??2)));
        e.dataset.maxhp=e.dataset.hp;
        e.dataset.boss=boss||type==='boss'?'1':'0';
        e.dataset.lastAttack='0';
        enemies.appendChild(e);
        // 逐幀依真正鞋底位置校正畫面；src 變化時會即時更新，包括走路／攻擊／受擊及回到待機。
        observeChapter3FootAnchor(e, initialSprite);
        enemyList.push(e);
        spawnedThisLevel++
    }
    function chapter3BossSpawnAtLevelStart(){
        spawnedThisLevel=0;bossSpawnedThisLevel=true;
        const provisionalX=Math.max(24,Math.min(heroExitX()-120,x+stageW*.40));
        spawn(provisionalX,true,false);
        const boss=enemyList[enemyList.length-1];
        if(boss){
            // Boss 放大後仍要完整出現在目前鏡頭右側，而不是生成在畫面外。
            const bossWidth=boss.offsetWidth||460;
            const heroCenter=x+(hero.offsetWidth||70)*.5;
            const visibleCenterLimit=cameraX+stageW-bossWidth*.5-18;
            const desiredCenter=Math.min(visibleCenterLimit,heroCenter+stageW*.46);
            const bx=Math.max(24,Math.min(Math.max(24,heroExitX()-bossWidth-24),desiredCenter-bossWidth*.5));
            boss.dataset.x=String(bx);boss.style.left=bx+'px';
            chapter3BossStartEncounter(boss,performance.now());updateBossHealthBar(boss);if(bossHealthPanel)bossHealthPanel.hidden=false;
        }
    }

    // ===== 第三章真正 Boss 戰：沿用正式玩家／攻擊系統，技能由逐幀更新控制 =====
    function chapter3BossPose(boss,pose){
        if(!boss||!boss.isConnected)return;
        const img=boss.querySelector('.enemySprite');
        if(img){const src=enemySpritePath('chapter3_boss_1',pose);if(!img.getAttribute('src')?.endsWith('/'+src.split('/').pop()))img.src=src;}
        boss.dataset.chapter3Pose=pose;
    }
    function chapter3BossFaceHero(boss){
        if(!boss||!boss.isConnected)return;
        const bossCenter=(Number(boss.dataset.x)||0)+(boss.offsetWidth||460)*.5;
        const heroCenter=x+(hero.offsetWidth||70)*.5;
        // 與第二關蜘蛛 Boss 完全一致：第三章 Boss 原圖預設朝左。
        // 面向左方時保留原圖；面向右方時才水平反轉 enemy-art。
        const faceLeft=heroCenter<bossCenter;
        boss.dataset.facing=faceLeft?'left':'right';
        boss.dataset.facingLocked='0';
        boss.classList.toggle('enemy-facing-left',!faceLeft);
    }
    // 與第二章蜘蛛 Boss 相同：每個更新影格都重新讀取玩家座標、面向及追擊位置。
    // stopRange 是 Boss 與玩家中心之間的安全距離；speed 使用 px/ms，沿用一般 Boss 的追近速度。
    function chapter3BossTrackPlayer(boss,dt,stopRange,speed){
        if(!boss||!boss.isConnected)return {outOfRange:false,moving:false,distance:0};
        const bossWidth=Math.max(1,boss.offsetWidth||460);
        const heroCenter=x+(hero.offsetWidth||70)*.5;
        const currentX=Number(boss.dataset.x)||0;
        const bossCenter=currentX+bossWidth*.5;
        const signedDistance=heroCenter-bossCenter;
        const distance=Math.abs(signedDistance);
        chapter3BossFaceHero(boss);
        if(distance<=stopRange)return {outOfRange:false,moving:false,distance};

        // 動態目標位置：保持在玩家前方的攻擊距離，不再走向預先寫死的固定 X 座標。
        const targetCenter=heroCenter-Math.sign(signedDistance)*stopRange;
        const maxLeft=Math.max(0,heroExitX()-bossWidth);
        const targetX=Math.max(0,Math.min(maxLeft,targetCenter-bossWidth*.5));
        const delta=targetX-currentX;
        const step=Math.max(0,Number(dt)||0)*Math.max(0,Number(speed)||0.15);
        const nextX=Math.max(0,Math.min(maxLeft,currentX+Math.sign(delta)*Math.min(Math.abs(delta),step)));
        if(Math.abs(nextX-currentX)>.01){
            boss.dataset.x=String(nextX);
            boss.style.left=nextX+'px';
        }
        // 面向也在位置更新後再確認一次，讓玩家越過 Boss 時能即時轉身。
        chapter3BossFaceHero(boss);
        return {outOfRange:true,moving:Math.abs(nextX-currentX)>.01,distance};
    }
    function chapter3BossRegisterHit(boss,duration=310){
        if(!boss||boss.classList.contains('dead')||chapter3BossState.boss!==boss)return;
        // 特殊技能與最終絕招的動畫不由普通受擊覆蓋。
        if(chapter3BossState.phase!=='combat'&&chapter3BossState.phase!=='mixed20Combat')return;
        const now=performance.now();
        boss.dataset.chapter3HitUntil=String(now+Math.max(120,Number(duration)||310));
        boss.dataset.chapter3AttackUntil='0';
        boss.dataset.chapter3AttackHitAt='0';
        boss.dataset.chapter3AttackHitDone='1';
        chapter3BossPose(boss,'hit');
    }
    function chapter3BossSetLift(boss,pixels){
        if(!boss)return;
        boss.style.setProperty('--chapter3-boss-lift',Math.max(0,Number(pixels)||0).toFixed(1)+'px');
    }
    function chapter3BossDropCountdown(){
        if(chapter3BossState.countdown){chapter3BossState.countdown.remove();chapter3BossState.countdown=null;}
    }
    function chapter3BossClearLightning(){
        chapter3BossState.lightningEffects.forEach(effect=>effect.el?.remove());
        chapter3BossState.lightningEffects.length=0;
        chapter3BossState.lightningPlan.forEach(item=>item.warning?.remove());
        chapter3BossState.lightningPlan.length=0;
        world.querySelectorAll('.chapter3-boss-lightning').forEach(el=>el.remove());
    }
    function chapter3BossStopEffects(removeBlackout=false){
        chapter3BossClearLightning();chapter3BossDropCountdown();
        if(chapter3BossState.playerElectricityEffect){
            chapter3BossState.playerElectricityEffect.el?.remove();
            chapter3BossState.playerElectricityEffect=null;
        }
        hero.classList.remove('boss-knocked');
        stage.querySelectorAll('.chapter3-boss-blackout,.chapter3-boss-final-lightning,.chapter3-boss-final-impact-flash').forEach(el=>el.remove());
        hero.classList.remove('chapter3-boss-final-hit');
        if(!removeBlackout){ /* 黑幕由最後絕招專用函式重新建立。 */ }
        if(chapter3BossState.boss){chapter3BossState.boss.classList.remove('chapter3-boss-charging','chapter3-boss-final-charge');chapter3BossSetLift(chapter3BossState.boss,0);}
    }
    function chapter3BossReset(){
        chapter3BossStopEffects(true);stopChapter3BossSfx();
        chapter3BossState.boss=null;chapter3BossState.phase='';chapter3BossState.phaseStartedAt=0;chapter3BossState.triggered.clear();chapter3BossState.queue.length=0;
        chapter3BossState.lastAttackAt=0;chapter3BossState.jumpCount=0;chapter3BossState.jumpIndex=0;chapter3BossState.jumpMode='';chapter3BossState.wave=0;chapter3BossState.nextWaveAt=0;
        chapter3BossState.bgDarkness=0;chapter3BossState.bgFadeFrom=0;chapter3BossState.bgFadeTo=0;chapter3BossState.bgFadeStartedAt=0;chapter3BossState.bgFadeDuration=0;
        chapter3BossState.mixed20Active=false;chapter3BossState.mixed20NextTentacleAt=0;chapter3BossState.mixed20NextLightningAt=0;chapter3BossState.tentacleSpawnQueue.length=0;chapter3BossState.tentacleSpawnNextAt=0;
        const bgView=$('elevatorBgViewport');if(bgView)bgView.style.filter='brightness(1)';
        chapter3BossState.killedHeroByUltimate=false;chapter3BossState.finalTriggered=false;chapter3BossState.pendingFinal=false;
    }
    function chapter3BossStartEncounter(boss,now=performance.now()){
        chapter3BossReset();chapter3BossState.boss=boss;chapter3BossState.phase='intro';chapter3BossState.phaseStartedAt=now;
        boss.dataset.facingLocked='0';boss.classList.remove('enemy-facing-left');boss.dataset.chapter3HitUntil='0';boss.dataset.chapter3AttackUntil='0';boss.dataset.chapter3AttackHitAt='0';boss.dataset.chapter3AttackHitDone='1';boss.style.visibility='visible';boss.style.opacity='1';boss.classList.add('chapter3-boss-intro');
        chapter3BossFaceHero(boss);
        chapter3BossSetLift(boss,Math.max(160,stageH*.60));chapter3BossPose(boss,'jump3');
        updateBossHealthBar(boss);if(bossHealthPanel)bossHealthPanel.hidden=false;
        floatText('雷暴海王降臨！',Number(boss.dataset.x)||x,58);
    }
    function chapter3BossFinishPhase(now){
        const state=chapter3BossState,boss=state.boss;if(!boss||boss.classList.contains('dead'))return;
        boss.classList.remove('chapter3-boss-charging','chapter3-boss-skill60-charge');chapter3BossSetLift(boss,0);boss.style.visibility='visible';boss.style.opacity='1';
        if(state.queue.length){
            const threshold=state.queue.shift();chapter3BossStartPhase(boss,threshold,now);return;
        }
        state.phase='combat';state.phaseStartedAt=now;state.lastAttackAt=now-700;boss.dataset.chapter3AttackUntil='0';boss.dataset.chapter3HitUntil='0';chapter3BossFaceHero(boss);chapter3BossPose(boss,'normal');
    }
    function chapter3BossStartPhase(boss,threshold,now){
        const state=chapter3BossState;if(!boss||boss.classList.contains('dead'))return;
        state.phaseStartedAt=now;state.jumpCount=0;state.jumpIndex=0;state.jumpMode='';state.wave=0;state.nextWaveAt=0;
        chapter3BossClearLightning();boss.style.visibility='visible';boss.style.opacity='1';chapter3BossSetLift(boss,0);
        boss.classList.remove('chapter3-boss-skill60-charge','chapter3-boss-final-charge');
        if(threshold===0.8){state.phase='jump80';state.jumpMode='charge';boss.classList.add('chapter3-boss-charging');chapter3BossPose(boss,'jump1');}
        else if(threshold===0.6){state.phase='skill60Charge';boss.classList.add('chapter3-boss-charging','chapter3-boss-skill60-charge');chapter3BossPose(boss,'skill1');}
        else if(threshold===0.4){state.phase='tentacle40Intro';boss.classList.add('chapter3-boss-charging');chapter3BossPose(boss,'jump1');}
        else if(threshold===0.2){
            state.phase='mixed20Launch';state.mixed20Active=true;state.mixed20NextTentacleAt=0;state.mixed20NextLightningAt=0;
            boss.style.visibility='visible';boss.classList.remove('chapter3-boss-jumping','chapter3-boss-launch-burst');
            boss.classList.add('chapter3-boss-charging','chapter3-boss-launch-squash');chapter3BossPose(boss,'jump1');chapter3BossSetLift(boss,0);
        }
    }
    function chapter3BossUltimateTentaclePath(frame){
        const n=Math.max(1,Math.min(4,Number(frame)||1));
        const file=n===1?'chapter3_boss_1_other_1png.png':'chapter3_boss_1_other_'+n+'.png';
        return CHAPTER3_BOSS_DIR+file;
    }
    function chapter3BossUltimateLightningPath(frameIndex){
        const n=CHAPTER3_BOSS_LIGHTNING_ATTACK_FRAMES[Math.max(0,Math.min(CHAPTER3_BOSS_LIGHTNING_ATTACK_FRAMES.length-1,Number(frameIndex)||0))];
        return CHAPTER3_BOSS_DIR+'chapter3_boss_1_skin1_attack'+n+'.png';
    }
    function chapter3BossUltimateExplosionPath(frame){
        const n=Math.max(0,Math.min(11,Number(frame)||0)).toString().padStart(5,'0');
        return CHAPTER3_BOSS_DIR+'Energy 016 Impact Explosion Radial/Energy 016 Impact Explosion Radial_'+n+'.png';
    }
    function chapter3BossCreateUltimateOverlay(now){
        const state=chapter3BossState;
        stage.querySelectorAll('.chapter3-boss-ultimate-overlay').forEach(el=>el.remove());
        const root=document.createElement('div');root.className='chapter3-boss-ultimate-overlay';root.setAttribute('aria-hidden','true');
        const sky=document.createElement('div');sky.className='chapter3-boss-ultimate-sky';root.appendChild(sky);
        const tentacles=document.createElement('div');tentacles.className='chapter3-boss-ultimate-tentacle-layer';root.appendChild(tentacles);
        const thunder=document.createElement('div');thunder.className='chapter3-boss-ultimate-thunder-layer';root.appendChild(thunder);
        const impact=document.createElement('div');impact.className='chapter3-boss-ultimate-impact-layer';root.appendChild(impact);
        stage.appendChild(root);
        state.ultimateFx={root,sky,tentacleLayer:tentacles,thunderLayer:thunder,impactLayer:impact,tentacles:[],warnings:[],warningRefs:[null,null,null],pillars:[],strikes:[false,false,false],explosion:null,finalBolt:null,lastTentacleFrameAt:0};
        // 在五秒蓄力期間預載所有素材，避免正式播放時逐格等待磁碟／瀏覽器讀取。
        const preloadPaths=[1,2,3,4].map(chapter3BossUltimateTentaclePath)
            .concat(CHAPTER3_BOSS_LIGHTNING_ATTACK_FRAMES.map((_,i)=>chapter3BossUltimateLightningPath(i)))
            .concat(Array.from({length:12},(_,i)=>chapter3BossUltimateExplosionPath(i)));
        state.ultimateFx.preloaded={};
        preloadPaths.forEach(path=>{const image=new Image();image.src=encodeURI(path);state.ultimateFx.preloaded[path]=image;});
        requestAnimationFrame(()=>{if(root.isConnected)root.classList.add('is-active');});
    }
    function chapter3BossCreateUltimateTentacles(now){
        const fx=chapter3BossState.ultimateFx;if(!fx||!fx.tentacleLayer)return;
        fx.tentacles.forEach(el=>el.remove());fx.tentacles.length=0;
        const width=Math.max(1,stage.clientWidth||stageW),height=Math.max(1,stage.clientHeight||stageH);
        // 16 條觸手平均覆蓋畫面水平位置，每條隨機大小、角度及水平翻轉；底部固定貼齊 60% 階段觸手的地面基準線。
        const count=16;
        const groundBottom='var(--tune-ground-bottom, 14%)';
        // 每次重新洗牌 16 個明顯不同的尺寸級距，確保同一畫面不會全部看起來差不多大。
        const sizeLevels=Array.from({length:count},(_,i)=>.42+(i/(count-1))*.88);
        for(let i=sizeLevels.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[sizeLevels[i],sizeLevels[j]]=[sizeLevels[j],sizeLevels[i]];}
        for(let index=0;index<count;index++){
            const cell=width/count;
            const centerX=cell*(index+.5)+(Math.random()-.5)*cell*.48;
            const size=Math.max(.40,Math.min(1.32,sizeLevels[index]+(Math.random()-.5)*.035));
            const tentacleWidth=width*.245*size;
            const tentacleHeight=height*.92*size;
            const rotation=((Math.random()-.5)*28).toFixed(1)+'deg';
            const slide=centerX<width*.5?'-38%':'38%';
            const flip=Math.random()<.5?-1:1;
            const img=document.createElement('img');img.className='chapter3-boss-ultimate-tentacle';img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');
            img.dataset.frame='1';img.dataset.index=String(index);img.dataset.baseWidth=String(tentacleWidth);img.dataset.baseHeight=String(tentacleHeight);
            img.src=encodeURI(chapter3BossUltimateTentaclePath(1));
            img.style.left=(centerX-tentacleWidth*.5)+'px';img.style.top='auto';img.style.bottom=groundBottom;
            img.style.width=tentacleWidth+'px';img.style.height=tentacleHeight+'px';
            img.style.objectFit='contain';img.style.objectPosition='center bottom';
            img.style.setProperty('--tentacle-rotation',rotation);img.style.setProperty('--tentacle-slide',slide);img.style.setProperty('--tentacle-flip',String(flip));
            fx.tentacleLayer.appendChild(img);fx.tentacles.push(img);
            requestAnimationFrame(()=>img.classList.add('is-visible'));
        }
        fx.lastTentacleFrameAt=now;
    }
    function chapter3BossUpdateUltimateTentacles(now){
        const fx=chapter3BossState.ultimateFx;if(!fx||!fx.tentacles.length||now-fx.lastTentacleFrameAt<125)return;
        fx.lastTentacleFrameAt=now;
        fx.tentacles.forEach(img=>{
            const frame=1+((Number(img.dataset.frame)||1)%4);img.dataset.frame=String(frame);
            img.src=encodeURI(chapter3BossUltimateTentaclePath(frame));
        });
    }
    function chapter3BossConvergeUltimateTentacles(){
        const fx=chapter3BossState.ultimateFx;if(!fx||!fx.tentacles.length)return;
        const width=Math.max(1,stage.clientWidth||stageW),height=Math.max(1,stage.clientHeight||stageH);
        const targetX=Math.max(width*.16,Math.min(width*.84,(x-cameraX)+(hero.offsetWidth||70)*.5));
        const count=fx.tentacles.length;
        fx.tentacles.forEach((img,index)=>{
            const t=count===1?0:(index/(count-1)-.5);
            const baseWidth=Math.max(1,Number(img.dataset.baseWidth)||width*.30);
            const baseHeight=Math.max(1,Number(img.dataset.baseHeight)||height);
            const tentacleWidth=baseWidth*1.12,tentacleHeight=baseHeight*1.08;
            const centerX=targetX+t*width*.54;
            const top=height*(.015+(index%3)*.105);
            img.style.left=(centerX-tentacleWidth*.5)+'px';img.style.top=top+'px';
            img.style.width=tentacleWidth+'px';img.style.height=tentacleHeight+'px';
            img.style.setProperty('--tentacle-slide','0%');
            img.style.setProperty('--tentacle-rotation',(index%2===0?'-':'')+(18+(index%4)*9)+'deg');
            img.classList.add('is-converging');
        });
    }
    function chapter3BossUltimateSpawnWarning(index,now){
        const fx=chapter3BossState.ultimateFx;if(!fx)return;
        const positions=[.18,.50,.82],warning=document.createElement('div');
        warning.className='chapter3-boss-ultimate-warning';warning.setAttribute('aria-hidden','true');
        warning.style.left=(positions[index]*100)+'%';fx.thunderLayer.appendChild(warning);
        fx.warnings.push({el:warning,startedAt:now,expiresAt:now+430});fx.warningRefs[index]=warning;
    }
    function chapter3BossUltimateSpawnPillar(index,now){
        const fx=chapter3BossState.ultimateFx;if(!fx)return;
        const positions=[.18,.50,.82],img=document.createElement('img');
        img.className='chapter3-boss-ultimate-pillar';img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');
        const width=Math.max(220,(stage.clientWidth||stageW)*.43);
        img.style.left=((stage.clientWidth||stageW)*positions[index]-width*.5)+'px';img.style.width=width+'px';
        img.style.height=((stage.clientHeight||stageH)*1.18)+'px';img.src=encodeURI(chapter3BossUltimateLightningPath(0));
        fx.thunderLayer.appendChild(img);fx.pillars.push({el:img,startedAt:now,endsAt:now+520,lastFrame:-1});
    }
    function chapter3BossUpdateUltimateThunder(elapsed,now){
        const fx=chapter3BossState.ultimateFx;if(!fx)return;
        const warningTimes=[0,560,1120],strikeDelay=230;
        warningTimes.forEach((at,index)=>{
            if(!fx.strikes[index]&&elapsed>=at){fx.strikes[index]=true;chapter3BossUltimateSpawnWarning(index,now);}
            if(fx.strikes[index]&&elapsed>=at+strikeDelay&& !fx['strikeFired'+index]){
                fx['strikeFired'+index]=true;
                fx.warningRefs[index]?.remove();fx.warningRefs[index]=null;
                chapter3BossUltimateSpawnPillar(index,now);
            }
        });
        fx.warnings=fx.warnings.filter(item=>{
            if(now>=item.expiresAt){item.el?.remove();return false;}
            return item.el?.isConnected;
        });
        fx.pillars=fx.pillars.filter(item=>{
            const frame=Math.min(3,Math.floor((now-item.startedAt)/105));
            if(frame!==item.lastFrame&&frame<CHAPTER3_BOSS_LIGHTNING_ATTACK_FRAMES.length){item.el.src=encodeURI(chapter3BossUltimateLightningPath(frame));item.lastFrame=frame;}
            if(now>=item.endsAt){item.el.remove();return false;}
            return item.el.isConnected;
        });
    }
    function chapter3BossUltimateStartImpact(now){
        const fx=chapter3BossState.ultimateFx;if(!fx)return;
        const width=Math.max(320,Math.min((stage.clientWidth||stageW)*.68,(stage.clientHeight||stageH)*1.48));
        const targetX=Math.max(width*.5,Math.min((stage.clientWidth||stageW)-width*.5,(x-cameraX)+(hero.offsetWidth||70)*.5));
        const explosion=document.createElement('img');explosion.className='chapter3-boss-ultimate-explosion';explosion.alt='';explosion.draggable=false;explosion.setAttribute('aria-hidden','true');
        explosion.style.width=width+'px';explosion.style.height=width+'px';explosion.style.left=(targetX-width*.5)+'px';explosion.style.top=((stage.clientHeight||stageH)*.5-width*.5)+'px';
        explosion.src=encodeURI(chapter3BossUltimateExplosionPath(0));fx.impactLayer.appendChild(explosion);fx.explosion={el:explosion,startedAt:now,lastFrame:0};
        const bolt=document.createElement('img');bolt.className='chapter3-boss-ultimate-final-bolt';bolt.alt='';bolt.draggable=false;bolt.setAttribute('aria-hidden','true');
        bolt.src=encodeURI(chapter3BossUltimateLightningPath(2));fx.impactLayer.appendChild(bolt);fx.finalBolt=bolt;
        const flash=document.createElement('div');flash.className='chapter3-boss-ultimate-whiteout';flash.setAttribute('aria-hidden','true');fx.impactLayer.appendChild(flash);
    }
    function chapter3BossUpdateUltimateExplosion(now){
        const fx=chapter3BossState.ultimateFx;if(!fx||!fx.explosion)return;
        const frame=Math.min(11,Math.floor((now-fx.explosion.startedAt)/66));
        if(frame!==fx.explosion.lastFrame){fx.explosion.el.src=encodeURI(chapter3BossUltimateExplosionPath(frame));fx.explosion.lastFrame=frame;}
    }
    function chapter3BossStartFinal(boss,now){
        const state=chapter3BossState;if(!boss||boss.classList.contains('dead')||state.finalTriggered)return;
        state.finalTriggered=true;state.ambientLightningNextAt=0;chapter3BossClearLightning();state.phase='finalCharge';state.phaseStartedAt=now;state.queue.length=0;state.jumpMode='';state.wave=0;
        // 五秒倒數期間玩家仍可移動及攻擊；倒數結束後才鎖定並播放舊版完整終極演出。
        state.mixed20Active=false;state.mixed20NextTentacleAt=0;state.mixed20NextLightningAt=0;state.tentacleSpawnQueue.length=0;state.tentacleSpawnNextAt=0;
        chapter3BossStopEffects(true);
        chapter3BossTransitionBackground(.34,now,900);
        chapter3BossRemoveAllTentacles();
        chapter3BossCreateUltimateOverlay(now);
        boss.classList.remove('chapter3-boss-charging');boss.classList.add('chapter3-boss-final-charge');
        chapter3BossSetLift(boss,0);boss.style.visibility='visible';chapter3BossPose(boss,'skill1');
        const node=document.createElement('div');node.id='chapter3BossCountdown';node.className='chapter3-boss-countdown';node.setAttribute('role','status');node.setAttribute('aria-live','assertive');
        node.textContent='⚡ 絕招蓄能：5 秒';stage.appendChild(node);state.countdown=node;
        floatText('匠心觸手・最後 5 秒！',Number(boss.dataset.x)||x,66);
    }
    function chapter3BossKilled(boss){
        if(chapter3BossState.boss!==boss)return;
        chapter3BossState.phase='dead';chapter3BossState.queue.length=0;
        chapter3BossStopEffects(true);
        boss.classList.remove('chapter3-boss-charging','chapter3-boss-skill60-charge','chapter3-boss-final-charge');chapter3BossSetLift(boss,0);
        enemyList.forEach(e=>{if(e.dataset.chapter3Tentacle==='1'&&!e.classList.contains('dead')){chapter3TentacleAudio.removeTentacle(e);e.classList.add('dead');}});
        updateBossHealthBar(boss);
    }
    function chapter3BossHeroHit(damage,label='−'){
        if(!running||paused||hp<=0||jumpT>0)return false;
        if(performance.now()<bashLockUntil){floatText('防禦！',x,32);return false;}
        const previous=hp;hp=Math.max(0,hp-damage);floatText(label+(previous-hp),x,33);updateHud();return true;
    }
    function chapter3BossVisibleRandomX(padding=100){
        const min=Math.max(30,cameraX+padding),max=Math.max(min+5,cameraX+stageW-padding);
        return Math.max(0,Math.min(heroExitX()-40,min+Math.random()*(max-min)));
    }
    function chapter3BossSpawnTentacle(xp,wave){
        const displayName='雷暴觸手',e=document.createElement('div');
        e.className='enemy chapter3-boss-tentacle enemy-skeleton chapter3-tentacle-emerging';
        e.innerHTML='<div class="enemy-name">'+displayName+'</div><div class="ehealth" role="progressbar" aria-label="雷暴觸手生命值" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i></i></div><div class="enemy-art"><div class="enemy-art-frame"><img class="enemySprite" src="'+enemySpritePath('chapter3_boss_1_tentacle','other_1')+'" alt="'+displayName+'"></div></div>';
        e.dataset.x=String(xp);e.style.left=xp+'px';e.dataset.type='skeleton';e.dataset.spriteType='chapter3_boss_1_tentacle';e.dataset.hp=String((gameTuning.enemyHP||{}).default||2);e.dataset.maxhp=e.dataset.hp;
        e.dataset.boss='0';e.dataset.chapter3Tentacle='1';e.dataset.chapter3TentacleWave=String(wave);e.dataset.lastAttack='0';e.dataset.lastAttackFrame='0';e.dataset.facingLocked='1';
        // 每條觸手獨立隨機朝左或朝右，避免同一波全部同向。
        const faceLeft=Math.random()<0.5;e.dataset.facing=faceLeft?'left':'right';e.classList.toggle('enemy-facing-left',faceLeft);
        const healthFill=e.querySelector('.ehealth i');if(healthFill)healthFill.style.width='100%';
        enemies.appendChild(e);enemyList.push(e);
        chapter3TentacleAudio.enqueue(e,'spawn');
        const artFrame=e.querySelector('.enemy-art-frame');if(artFrame){artFrame.addEventListener('animationend',()=>e.classList.remove('chapter3-tentacle-emerging'),{once:true});}
        return e;
    }
    function chapter3BossSpawnTentacleWave(count,wave,spreadAcrossWorld=false){
        const positions=[];const heroCenter=x+(hero.offsetWidth||70)*.5;
        if(spreadAcrossWorld&&count>1){
            // 15 條初始觸手分布在整段可活動世界，避免全部堆在同一個鏡頭寬度內。
            const left=28,right=Math.max(30,heroExitX()-40),span=(right-left)/(count-1);
            for(let i=0;i<count;i++){
                const jitter=(Math.random()-.5)*span*.22;
                positions.push(Math.max(20,Math.min(heroExitX()-35,left+span*i+jitter)));
            }
        }else{
            const occupied=enemyList.filter(e=>e.dataset.chapter3Tentacle==='1'&&!e.classList.contains('dead')).map(e=>Number(e.dataset.x)||0);
            const minGap=Math.max(78,Math.min(150,stageW*.085));
            for(let i=0;i<count;i++){
                let px=chapter3BossVisibleRandomX(85),tries=0;
                while(tries++<14&&occupied.some(existing=>Math.abs(existing-px)<minGap))px=chapter3BossVisibleRandomX(85);
                if(Math.abs(px-heroCenter)<stageW*.055)px=Math.min(heroExitX()-35,px+stageW*.13);
                px=Math.max(20,Math.min(heroExitX()-35,px));positions.push(px);occupied.push(px);
            }
        }
        const state=chapter3BossState;
        let spawnAt=Math.max(performance.now(),state.tentacleSpawnNextAt||0);
        positions.forEach(px=>{state.tentacleSpawnQueue.push({x:px,wave,at:spawnAt});spawnAt+=300;});
        state.tentacleSpawnNextAt=spawnAt;
        return positions.length;
    }
    function chapter3BossUpdateTentacleSpawnQueue(now){
        const state=chapter3BossState,first=state.tentacleSpawnQueue[0];
        if(!first||now<first.at)return;
        state.tentacleSpawnQueue.shift();
        chapter3BossSpawnTentacle(first.x,first.wave);
        // 下一條至少相隔 300ms；即使單幀卡頓，也不會在同一幀補生多條。
        state.tentacleSpawnNextAt=Math.max(state.tentacleSpawnNextAt||0,now+300);
        if(state.tentacleSpawnQueue.length)state.tentacleSpawnQueue[0].at=Math.max(state.tentacleSpawnQueue[0].at,now+300);
        if(first.wave!=='mixed20'){
            const label=first.wave===20?'15 條觸手出現！':'觸手出現！第 '+first.wave+' 波';
            if(!state.tentacleSpawnQueue.some(item=>item.wave===first.wave))floatText(label,first.x||x,57);
        }
    }
    function chapter3BossPendingTentacleCount(wave=null){
        return chapter3BossState.tentacleSpawnQueue.reduce((n,item)=>n+(wave===null||item.wave===wave?1:0),0);
    }
    function chapter3BossAliveTentacleCount(){
        return enemyList.reduce((count,e)=>count+(e.dataset.chapter3Tentacle==='1'&&!e.classList.contains('dead')?1:0),0);
    }
    function chapter3BossRemoveAllTentacles(){
        for(let i=enemyList.length-1;i>=0;i--){
            const e=enemyList[i];if(e.dataset.chapter3Tentacle!=='1')continue;
            clearTimeout(e._spriteTimer);clearTimeout(e._deathPoseTimer);disconnectChapter3FootAnchorObserver(e);
            chapter3TentacleAudio.removeTentacle(e);e.classList.add('dead');e.style.pointerEvents='none';e.style.transition='opacity .28s ease, transform .28s ease';e.style.opacity='0';e.style.transform='scale(.72)';
            enemyList.splice(i,1);setTimeout(()=>e.remove(),320);
        }
    }
    function chapter3BossUpdateTentacle(e,now){
        if(!e||e.classList.contains('dead'))return;
        const img=e.querySelector('.enemySprite'),lastAttack=Number(e.dataset.lastAttack)||0;
        const center=(Number(e.dataset.x)||0)+(e.offsetWidth||100)*.5,heroCenter=x+(hero.offsetWidth||70)*.5;
        const distance=Math.abs(center-heroCenter),phase=e.dataset.attackPhase||'idle';
        const actionUntil=Number(e.dataset.actionUntil)||0;
        // 集氣期間保持蓄力姿勢及光效；完成集氣後才切換攻擊影格和命中判定。
        if(phase==='charge'&&now>=actionUntil){
            e.dataset.attackPhase='attack';e.dataset.actionUntil=String(now+370);
            e.classList.remove('chapter3-tentacle-charging');
            if(img)img.src=enemySpritePath('chapter3_boss_1_tentacle','other_4');
            chapter3TentacleAudio.enqueue(e,e.dataset.attackSfx||'attack1');
            if(distance<75)chapter3BossHeroHit(2);
        }else if(phase==='attack'&&now>=actionUntil){
            e.dataset.attackPhase='idle';e.dataset.actionUntil='0';
        }
        if((e.dataset.attackPhase||'idle')==='idle'&&img){
            const frame=1+(Math.floor(now/145)%4),src=enemySpritePath('chapter3_boss_1_tentacle','other_'+frame);
            if(!img.getAttribute('src')?.endsWith('/'+src.split('/').pop()))img.src=src;
        }
        if((e.dataset.attackPhase||'idle')==='idle'&&distance<Math.max(85,stageW*.07)&&now-lastAttack>1550){
            e.dataset.lastAttack=String(now);e.dataset.attackPhase='charge';e.dataset.actionUntil=String(now+650);
            e.dataset.audioActionCycle=String((Number(e.dataset.audioActionCycle)||0)+1);
            // 每條觸手交替使用兩組集氣／攻擊素材，令多觸手連續出招時仍有聲音變化。
            const alternate=(Math.floor(Math.random()*2)===1);
            e.dataset.attackSfx=alternate?'attack2':'attack1';
            chapter3TentacleAudio.enqueue(e,alternate?'charge2':'charge1');
            e.classList.add('chapter3-tentacle-charging');
            if(img)img.src=enemySpritePath('chapter3_boss_1_tentacle','other_3');
        }
    }
    function chapter3BossPlanLightning(count,duration,sameLocation=false){
        const state=chapter3BossState;state.lightningPlan.forEach(item=>item.warning?.remove());state.lightningPlan.length=0;
        const fixedX=sameLocation?chapter3BossVisibleRandomX(110):null;
        for(let i=0;i<count;i++){
            // 三次落雷分布於 3 秒攻擊段內；每次提前 430ms 顯示地面警示。
            const at=count===1?550:550+i*900;
            const xp=sameLocation?fixedX:chapter3BossVisibleRandomX(120);
            const warning=document.createElement('div');warning.className='chapter3-boss-lightning-warning';
            warning.setAttribute('aria-hidden','true');warning.style.left=(xp-62)+'px';
            warning.style.bottom=(chapter3BossLightningGroundBottom()+4)+'px';world.appendChild(warning);
            state.lightningPlan.push({at,warnAt:Math.max(0,at-430),x:xp,fired:false,warning});
        }
    }
    function chapter3BossLightningGroundBottom(){
        // 所有第三章 Boss 落雷統一再向下移 2%；底部距離由舞台高度 6% 改為 4%。
        return stageH*.04;
    }
    function chapter3BossShowPlayerElectricity(now){
        const state=chapter3BossState;
        const files=[
            'images/effects/chapter3_electricity_1.png',
            'images/effects/chapter3_electricity_2.png',
            'images/effects/chapter3_electricity_3.png',
            'images/effects/chapter3_electricity_4.png'
        ];
        const until=now+2000;
        let fx=state.playerElectricityEffect;
        if(!fx||!fx.el?.isConnected){
            const el=document.createElement('img');
            el.className='chapter3-player-electricity';el.alt='';el.draggable=false;
            el.setAttribute('aria-hidden','true');el.src=files[0];
            el.style.position='absolute';el.style.pointerEvents='none';
            el.style.zIndex='999';el.style.display='block';el.style.visibility='visible';
            el.style.opacity='1';el.style.objectFit='contain';
            world.appendChild(el);
            fx=state.playerElectricityEffect={el,files,start:now,nextFrame:now+85,index:0,ends:until};
        }else{
            fx.ends=until;
        }
        chapter3BossUpdatePlayerElectricity(now);
    }
    function chapter3BossUpdatePlayerElectricity(now){
        const fx=chapter3BossState.playerElectricityEffect;
        if(!fx)return;
        if(!fx.el?.isConnected||now>=fx.ends){
            fx.el?.remove();chapter3BossState.playerElectricityEffect=null;
            hero.classList.remove('boss-knocked');
            return;
        }
        const wr=world.getBoundingClientRect(),hr=hero.getBoundingClientRect();
        // 加大電流外框，覆蓋角色全身四周；隨角色擊退移動，但不影響地面落雷定位。
        const w=Math.max(hr.width*2.45,190),h=Math.max(hr.height*2.35,220);
        fx.el.style.left=(hr.left-wr.left+(hr.width-w)*.5)+'px';
        fx.el.style.top=(hr.top-wr.top+(hr.height-h)*.5)+'px';
        fx.el.style.width=w+'px';fx.el.style.height=h+'px';
        fx.el.style.transform='translateZ(0)';
        if(now>=fx.nextFrame){
            fx.index=(fx.index+1)%fx.files.length;
            fx.el.src=fx.files[fx.index];fx.nextFrame=now+85;
        }
    }
    function chapter3BossSpawnLightningStrike(xp,now,duration=520,requestedFrames=null){
        const el=document.createElement('img');el.className='chapter3-boss-lightning';el.alt='';el.draggable=false;el.setAttribute('aria-hidden','true');
        const frames=(Array.isArray(requestedFrames)&&requestedFrames.length)?requestedFrames:[1,2,3,4];
        const frame=frames[0];el.src=CHAPTER3_BOSS_DIR+'chapter3_boss_1_skin1_attack'+frame+'.png';
        // 明顯加粗可見電柱；高度延伸至畫面頂部，底端以玩家腳底作水平基準。
        const width=Math.max(560,Math.min(820,stageH*1.02));
        const height=Math.max(900,stageH*1.55);
        el.style.width=width+'px';el.style.height=height+'px';el.style.left=(xp-width*.5)+'px';
        el.style.setProperty('bottom',chapter3BossLightningGroundBottom()+'px','important');
        world.appendChild(el);
        chapter3BossState.lightningEffects.push({el,x:xp,width,height,start:now,ends:now+duration,nextFrame:now+85,frame,frames,frameIndex:0,hit:false,followHeroFeet:false});
        return {width,height};
    }
    function chapter3BossTryLightningHit(xp,width){
        const heroRect=hero.getBoundingClientRect(),worldRect=world.getBoundingClientRect();
        const heroWidth=heroRect.width||hero.offsetWidth||70,heroCenter=heroRect.left-worldRect.left+heroWidth*.5;
        const hitHalfWidth=width*.40*.5+heroWidth*.12;
        if(Math.abs(heroCenter-xp)>=hitHalfWidth||jumpT>0||!onGround)return false;
        const now=performance.now();
        if(now<bashLockUntil||now<knockbackHitUntil){floatText('防禦！',x,48);return false;}
        if(!chapter3BossHeroHit(1,'⚡ −'))return false;
        // 落雷命中後改為真正的向外拋飛弧線；鎖定方向直至落地，玩家不能立即走掉抵消效果。
        knockbackHitUntil=now+650;knockbackUntilLanding=true;
        knockbackDirection=heroCenter>=xp?1:-1;
        keys.left=false;keys.right=false;moveV=knockbackDirection*.42;jumpBufferMs=0;
        onGround=false;coyoteMs=0;jumpY=Math.max(jumpY,10);jumpV=.66;jumpT=1;
        faceDir=knockbackDirection;hero.classList.toggle('face-left',faceDir<0);
        hero.classList.add('boss-knocked','jump');setHeroSprite('images/hero/hero_jump.png');
        heroActionUntil=now+650;
        chapter3BossShowPlayerElectricity(now);
        floatText('⚡ 電擊擊退！',x,66);
        return true;
    }
    function chapter3BossUpdateLightningEffects(now){
        const state=chapter3BossState;
        state.lightningEffects=state.lightningEffects.filter(effect=>{
            if(!effect.el?.isConnected||now>=effect.ends){effect.el?.remove();return false;}
            if(now>=effect.nextFrame){effect.nextFrame=now+85;effect.frameIndex=(effect.frameIndex+1)%effect.frames.length;effect.frame=effect.frames[effect.frameIndex];effect.el.src=CHAPTER3_BOSS_DIR+'chapter3_boss_1_skin1_attack'+effect.frame+'.png';}
            return true;
        });
    }
    function chapter3BossUpdateLightning(now){
        const state=chapter3BossState,elapsed=now-state.phaseStartedAt,requestedFrames=[1,2,3,4];
        state.lightningPlan.forEach(item=>{
            if(!item.fired&&elapsed>=item.warnAt)item.warning?.classList.add('is-visible');
            if(!item.fired&&elapsed>=item.at){item.fired=true;item.warning?.remove();item.warning=null;playChapter3BossSfx('lightning');const result=chapter3BossSpawnLightningStrike(item.x,now,520,requestedFrames);chapter3BossTryLightningHit(item.x,result.width);}
        });
        chapter3BossUpdateLightningEffects(now);
        chapter3BossUpdatePlayerElectricity(now);
    }
    function chapter3BossUpdateMixed20Lightning(now){
        // 保留相容入口；閃電統一由每 2 秒一次的全血量階段判定管理。
        chapter3BossUpdateLightningEffects(now);
    }
    function chapter3BossUpdateAmbientLightning(boss,now){
        chapter3BossUpdatePlayerElectricity(now);
        const state=chapter3BossState;
        const hpNow=Math.max(0,Number(boss?.dataset.hp)||0),hpMax=Math.max(1,Number(boss?.dataset.maxhp)||100);
        const ratio=hpNow/hpMax;
        if(ratio<=.10||ratio>1||state.finalTriggered||state.phase==='dead'||state.phase==='finalDead'||state.phase==='mixed20ExitFade'){ 
            if(ratio<=.10){state.ambientLightningNextAt=0;chapter3BossClearLightning();}
            return;
        }
        if(!state.ambientLightningNextAt)state.ambientLightningNextAt=now+2000;
        if(now>=state.ambientLightningNextAt){
            // 每兩秒固定做一次隨機判定；本次可能沒有落雷，也可能同時出現兩道。
            if(Math.random()<.68){
                playChapter3BossSfx('lightning');
                const count=Math.random()<.22?2:1;
                for(let i=0;i<count;i++){
                    const xp=chapter3BossVisibleRandomX(110);
                    const frames=[1,2,3,5].sort(()=>Math.random()-.5);
                    const result=chapter3BossSpawnLightningStrike(xp,now,520+Math.random()*90,frames);
                    chapter3BossTryLightningHit(xp,result.width);
                }
            }
            state.ambientLightningNextAt=now+2000;
        }
        chapter3BossUpdateLightningEffects(now);
        chapter3BossUpdatePlayerElectricity(now);
    }
    function chapter3BossBeginJump(boss,now,mode){
        const state=chapter3BossState;state.jumpMode=mode;state.jumpCount=0;state.jumpIndex=0;state.phaseStartedAt=now;
        boss.classList.remove('chapter3-boss-charging');boss.classList.add('chapter3-boss-jumping');chapter3BossPose(boss,'jump1');chapter3BossSetLift(boss,0);
    }
    function chapter3BossUpdateJumpSequence(boss,now,dt,maxJumps,afterJump){
        const state=chapter3BossState,elapsed=now-state.phaseStartedAt;
        const bossWidth=Math.max(1,boss.offsetWidth||460);
        const maxLeft=Math.max(0,heroExitX()-bossWidth);
        const currentX=Number(boss.dataset.x)||0;
        const heroCenter=()=>x+(hero.offsetWidth||70)*.5;
        const targetForHero=()=>Math.max(0,Math.min(maxLeft,heroCenter()-bossWidth*.5));
        const moveToward=(target,speedPxPerMs)=>{
            const bx=Number(boss.dataset.x)||0,dx=target-bx;
            const step=Math.min(Math.abs(dx),Math.max(0,dt||0)*speedPxPerMs);
            const nx=Math.max(0,Math.min(maxLeft,bx+Math.sign(dx)*step));
            boss.dataset.x=String(nx);boss.style.left=nx+'px';
            return Math.abs(target-nx);
        };
        if(state.jumpMode==='charge'){
            // 先快速追向主角，讓跳躍不是站在原地起跳；起跳前仍持續讀取主角位置。
            const remaining=moveToward(targetForHero(),0.82);
            chapter3BossFaceHero(boss);
            if(elapsed<260){
                if(remaining>Math.max(60,stageW*.045))chapter3BossPose(boss,'walk'+(1+Math.floor(now/85)%8));
                else chapter3BossPose(boss,'jump1');
                chapter3BossSetLift(boss,0);return;
            }
            state.jumpMode='air';state.phaseStartedAt=now;state.jumpStartX=Number(boss.dataset.x)||currentX;state.jumpLandX=null;state.jumpImpactDone=false;
            boss.classList.remove('chapter3-boss-charging');boss.classList.add('chapter3-boss-jumping');chapter3BossPose(boss,'jump1');chapter3BossSetLift(boss,0);return;
        }
        if(state.jumpMode==='wait'){
            if(elapsed<520){chapter3BossPose(boss,'normal');chapter3BossSetLift(boss,0);return;}
            state.jumpMode='air';state.phaseStartedAt=now;state.jumpStartX=Number(boss.dataset.x)||0;state.jumpLandX=null;state.jumpImpactDone=false;
            boss.classList.remove('chapter3-boss-charging');boss.classList.add('chapter3-boss-jumping');chapter3BossPose(boss,'jump1');return;
        }
        if(state.jumpMode!=='air')return;

        // 高速拋物線：上升約 220ms，短暫越過主角頭頂，最後 170ms 加速俯衝落地。
        // 起跳上升期間持續追蹤主角；進入下降段時鎖定一次落點，讓玩家能及時走位閃避。
        const t=Math.max(0,now-state.phaseStartedAt),ascentMs=230,apexEnd=355,descentMs=180,landAt=apexEnd+descentMs,reboundMs=145,recoverUntil=landAt+reboundMs;
        const peak=Math.max(stageH*.46,stageH*.50);
        if(t<ascentMs){
            moveToward(targetForHero(),1.65);chapter3BossFaceHero(boss);
            const p=t/ascentMs;chapter3BossSetLift(boss,peak*(1-Math.pow(1-p,1.35)));
            chapter3BossPose(boss,t<95?'jump1':'jump2');return;
        }
        if(t<apexEnd){
            // 在玩家頭頂略作停頓，清楚讀出高點，接著快速下砸。
            moveToward(targetForHero(),1.2);chapter3BossFaceHero(boss);chapter3BossSetLift(boss,peak);chapter3BossPose(boss,'jump3');return;
        }
        if(state.jumpLandX===null)state.jumpLandX=targetForHero();
        if(t<landAt){
            const fallP=Math.min(1,(t-apexEnd)/descentMs);
            moveToward(state.jumpLandX,2.25);chapter3BossFaceHero(boss);
            // 二次曲線令下降速度愈接近地面愈快，強化俯衝的重量與速度感。
            chapter3BossSetLift(boss,peak*(1-Math.pow(fallP,2.45)));
            chapter3BossPose(boss,fallP<.60?'jump2':'jump1');return;
        }
        // 撞擊瞬間先壓低，再做一次短促小回彈；不是停在空中或大幅跳起。
        const reboundP=Math.max(0,Math.min(1,(t-landAt)/reboundMs));
        const reboundHeight=Math.max(12,stageH*.026);
        chapter3BossSetLift(boss,reboundHeight*Math.sin(Math.PI*reboundP));
        chapter3BossPose(boss,'normal');
        if(!state.jumpImpactDone){
            state.jumpImpactDone=true;
            boss.classList.remove('chapter3-boss-impact');void boss.offsetWidth;boss.classList.add('chapter3-boss-impact');
            setTimeout(()=>boss.classList.remove('chapter3-boss-impact'),280);
            const bossCenter=(Number(boss.dataset.x)||0)+bossWidth*.5;
            const impactRange=Math.max(112,bossWidth*.29);
            if(Math.abs(heroCenter()-bossCenter)<impactRange&&jumpT===0)chapter3BossHeroHit(12,'−');
        }
        if(t>=recoverUntil){
            state.jumpCount++;state.jumpLandX=null;state.jumpImpactDone=false;
            if(state.jumpCount<maxJumps){state.jumpMode='wait';state.phaseStartedAt=now;boss.classList.remove('chapter3-boss-jumping');chapter3BossPose(boss,'normal');chapter3BossSetLift(boss,0);}
            else{state.jumpMode='';boss.classList.remove('chapter3-boss-jumping');chapter3BossSetLift(boss,0);if(typeof afterJump==='function')afterJump(now);}
        }
    }
    function chapter3BossBeginWalkReturn(boss,now,forMixed=false){
        const state=chapter3BossState;state.phase=forMixed?'mixed20Return':'tentacle40Return';state.phaseStartedAt=now;
        const bossWidth=Math.max(1,boss.offsetWidth||460);
        const target=Math.max(cameraX+stageW*.58,Math.min(heroExitX()-bossWidth*.55,cameraX+stageW*.74));
        state.returnTargetX=target;state.returnStartX=Math.min(heroExitX()-bossWidth*.55,cameraX+stageW+bossWidth*.22);
        boss.style.visibility='visible';boss.style.opacity='1';boss.classList.remove('enemy-facing-left');boss.dataset.x=String(state.returnStartX);boss.style.left=state.returnStartX+'px';chapter3BossSetLift(boss,0);
        boss.classList.add('chapter3-boss-returning');if(forMixed)boss.classList.add('chapter3-boss-return-dash');chapter3BossFaceHero(boss);chapter3BossPose(boss,'walk1');
    }
    function chapter3BossUpdateReturn(boss,now,forMixed=false,dt=16){
        const state=chapter3BossState,elapsed=now-state.phaseStartedAt;
        const returnStopRange=Math.max(150,stageW*.14);
        // 參照蜘蛛 Boss broodReturn：Walk1–Walk8 播放期間，每幀追蹤玩家，而不是只走向固定終點。
        const tracking=chapter3BossTrackPlayer(boss,dt,returnStopRange,forMixed?.92:.24);
        chapter3BossPose(boss,'walk'+(1+Math.floor(elapsed/(forMixed?72:135))%8));
        // 一到正常攻擊距離便銜接戰鬥；若玩家持續跑動，最多 7 秒後交由普通追擊 AI 接手。
        if(!tracking.outOfRange||elapsed>=7000){
            boss.classList.remove('chapter3-boss-returning','chapter3-boss-return-dash');chapter3BossSetLift(boss,0);
            if(forMixed)chapter3BossStartMixed20Combat(boss,now);else chapter3BossFinishPhase(now);
        }
    }
    function chapter3BossTransitionBackground(darkness,now,duration=1500){
        const state=chapter3BossState;
        state.bgFadeFrom=state.bgDarkness;state.bgFadeTo=Math.max(0,Math.min(1,Number(darkness)||0));
        state.bgFadeStartedAt=now;state.bgFadeDuration=Math.max(0,Number(duration)||0);
        if(state.bgFadeDuration===0){state.bgDarkness=state.bgFadeTo;const view=$('elevatorBgViewport');if(view)view.style.filter='brightness('+(1-state.bgDarkness).toFixed(3)+')';}
    }
    function chapter3BossUpdateMixed20Launch(boss,now){
        const state=chapter3BossState,elapsed=now-state.phaseStartedAt,squashMs=260,launchMs=470;
        if(elapsed<squashMs){
            boss.style.visibility='visible';chapter3BossSetLift(boss,0);chapter3BossPose(boss,'jump1');return;
        }
        boss.classList.remove('chapter3-boss-launch-squash','chapter3-boss-charging');boss.classList.add('chapter3-boss-launch-burst');
        const p=Math.max(0,Math.min(1,(elapsed-squashMs)/launchMs));
        const travel=Math.max(stageH*1.4,(boss.offsetHeight||500)+stageH+80);
        chapter3BossSetLift(boss,travel*Math.pow(p,2.1));
        chapter3BossPose(boss,p<.34?'jump2':'jump3');
        if(p>=1){
            boss.style.visibility='hidden';boss.classList.remove('chapter3-boss-launch-burst');chapter3BossSetLift(boss,0);
            state.phase='mixed20InitialTentacles';state.phaseStartedAt=now;
            chapter3BossSpawnTentacleWave(15,20,true);
        }
    }
    function chapter3BossBeginMixed20Return(boss,now){
        const state=chapter3BossState;state.phase='mixed20Return';state.phaseStartedAt=now;
        const bossWidth=Math.max(1,boss.offsetWidth||460);
        const target=Math.max(cameraX+stageW*.58,Math.min(heroExitX()-bossWidth*.55,cameraX+stageW*.74));
        state.returnTargetX=target;state.returnStartX=cameraX+stageW+bossWidth*.18;
        boss.style.visibility='visible';boss.style.opacity='1';boss.classList.remove('enemy-facing-left');
        boss.dataset.x=String(state.returnStartX);boss.style.left=state.returnStartX+'px';chapter3BossSetLift(boss,0);
        boss.classList.add('chapter3-boss-returning','chapter3-boss-return-dash');chapter3BossFaceHero(boss);chapter3BossPose(boss,'walk1');
    }
    function chapter3BossStartMixed20Combat(boss,now){
        const state=chapter3BossState;
        state.phase='mixed20Combat';state.phaseStartedAt=now;state.mixed20Active=true;
        state.lastAttackAt=now-700;state.mixed20NextTentacleAt=now+850+Math.random()*750;
        state.mixed20NextLightningAt=0;
        boss.classList.remove('chapter3-boss-returning','chapter3-boss-charging','chapter3-boss-launch-squash','chapter3-boss-launch-burst');
        boss.style.visibility='visible';boss.style.opacity='1';chapter3BossSetLift(boss,0);chapter3BossFaceHero(boss);chapter3BossPose(boss,'normal');
        chapter3BossSpawnTentacleWave(6+Math.floor(Math.random()*5),'mixed20',false);
    }
    function chapter3BossUpdateMixed20Support(now){
        const state=chapter3BossState,alive=chapter3BossAliveTentacleCount(),pending=chapter3BossPendingTentacleCount('mixed20');
        if(alive+pending<6&&pending===0){
            // 觸手低於 6 條時立即補足；不等待下一個隨機生成週期。
            chapter3BossSpawnTentacleWave(Math.min(6-alive,10-alive),'mixed20',false);
            state.mixed20NextTentacleAt=now+800+Math.random()*700;
        }else if(alive+pending<10&&pending===0&&now>=state.mixed20NextTentacleAt){
            const amount=Math.min(10-alive,1+Math.floor(Math.random()*2));
            chapter3BossSpawnTentacleWave(amount,'mixed20',false);
            state.mixed20NextTentacleAt=now+850+Math.random()*1450;
        }
    }
    function chapter3BossStartMixed20Exit(boss,now){
        const state=chapter3BossState;if(!state.mixed20Active||state.phase==='mixed20ExitFade')return;
        state.phase='mixed20ExitFade';state.phaseStartedAt=now;state.mixed20NextTentacleAt=0;state.mixed20NextLightningAt=0;state.tentacleSpawnQueue.length=0;state.tentacleSpawnNextAt=0;
        chapter3BossRemoveAllTentacles();chapter3BossClearLightning();
        // 不修改 boss.dataset.hp：12% 是階段觸發線，不是血量鎖定值。
        updateBossHealthBar(boss);chapter3BossTransitionBackground(0,now,1500);
    }
    function chapter3BossUpdateCombatAI(boss,now,dt,checkQueue=true){
        const state=chapter3BossState;
        if(checkQueue&&state.queue.length){const threshold=state.queue.shift();chapter3BossStartPhase(boss,threshold,now);return;}
        const bossWidth=boss.offsetWidth||460;
        const attackRange=Math.max(150,stageW*.14);
        const hitUntil=Number(boss.dataset.chapter3HitUntil)||0;
        const attackUntil=Number(boss.dataset.chapter3AttackUntil)||0;
        const bossApproachSpeed=gameTuning.enemyAI?.approachSpeed?.boss??gameTuning.enemyAI?.approachSpeed?.default??.15;

        // 跟隨蜘蛛 Boss 的做法：即使正在受擊／攻擊，也持續讀取玩家位置並調整 Boss 座標與面向。
        const tracking=chapter3BossTrackPlayer(boss,dt,attackRange,bossApproachSpeed);
        if(now<hitUntil){chapter3BossPose(boss,'hit');return;}
        if(now<attackUntil){
            chapter3BossPose(boss,'attack');
            const hitAt=Number(boss.dataset.chapter3AttackHitAt)||0;
            if(now>=hitAt&&boss.dataset.chapter3AttackHitDone!=='1'){
                boss.dataset.chapter3AttackHitDone='1';
                const liveHeroCenter=x+(hero.offsetWidth||70)*.5;
                const liveBossCenter=(Number(boss.dataset.x)||0)+bossWidth*.5;
                if(Math.abs(liveHeroCenter-liveBossCenter)<=attackRange&&jumpT===0)chapter3BossHeroHit(8);
            }
            return;
        }
        if(attackUntil>0){boss.dataset.chapter3AttackUntil='0';boss.dataset.chapter3AttackHitAt='0';}
        if(tracking.outOfRange){
            chapter3BossPose(boss,'walk'+(1+Math.floor(now/130)%8));return;
        }
        if(now-state.lastAttackAt>=1350){
            state.lastAttackAt=now;boss.dataset.chapter3AttackUntil=String(now+610);
            boss.dataset.chapter3AttackHitAt=String(now+260);boss.dataset.chapter3AttackHitDone='0';chapter3BossPose(boss,'attack');return;
        }
        chapter3BossPose(boss,'normal');
    }
    function chapter3BossUpdate(boss,now,dt){
        const state=chapter3BossState;if(!boss||boss.classList.contains('dead'))return;
        if(state.boss!==boss)chapter3BossStartEncounter(boss,now);
        chapter3BossUpdateAmbientLightning(boss,now);
        chapter3BossUpdateTentacleSpawnQueue(now);
        // 與第二章蜘蛛 Boss 的 updateSpiderBossSkill 一樣，不論目前播放哪個動作，都逐幀面向玩家。
        if(boss.style.visibility!=='hidden')chapter3BossFaceHero(boss);
        const elapsed=Math.max(0,now-state.phaseStartedAt),hpNow=Math.max(0,Number(boss.dataset.hp)||0),maxHP=Math.max(1,Number(boss.dataset.maxhp)||100);
        if(state.mixed20Active&&state.phase!=='mixed20ExitFade'&&hpNow>0&&hpNow/maxHP<=.12){
            chapter3BossStartMixed20Exit(boss,now);if(hpNow/maxHP<=.10)state.pendingFinal=true;return;
        }
        if(!state.finalTriggered&&state.phase!=='mixed20ExitFade'&&hpNow>0&&hpNow/maxHP<=.10){state.triggered.add('10');chapter3BossStartFinal(boss,now);}
        if(state.phase==='intro'){
            // 初次登場改為短促加速俯衝：由高處直接落到玩家腳底基準線，避免慢慢飄落。
            chapter3BossFaceHero(boss);
            const fallDuration=410;
            const p=Math.max(0,Math.min(1,elapsed/fallDuration));
            const startLift=Math.max(160,stageH*.60);
            chapter3BossSetLift(boss,startLift*(1-Math.pow(p,2.15)));
            chapter3BossPose(boss,p<.48?'jump3':(p<.82?'jump2':'jump1'));
            if(p>=1){
                chapter3BossSetLift(boss,0);boss.classList.remove('chapter3-boss-intro');
                boss.classList.remove('chapter3-boss-impact');void boss.offsetWidth;boss.classList.add('chapter3-boss-impact');
                state.phase='introImpact';state.phaseStartedAt=now;
            }
            return;
        }
        if(state.phase==='introImpact'){
            chapter3BossFaceHero(boss);chapter3BossSetLift(boss,0);
            if(elapsed>=300){boss.classList.remove('chapter3-boss-impact');state.phase='combat';state.phaseStartedAt=now;state.lastAttackAt=now-700;chapter3BossPose(boss,'normal');}
            return;
        }
        if(state.phase==='dead')return;
        if(state.phase==='finalCharge'){
            chapter3BossPose(boss,(Math.floor(elapsed/280)%2)===0?'skill1':'skill2');
            const remain=Math.max(0,Math.ceil((5000-elapsed)/1000));if(state.countdown)state.countdown.textContent='⚡ 絕招蓄能：'+remain+' 秒';
            if(elapsed>=5000){
                state.phase='finalTentacles';state.phaseStartedAt=now;
                chapter3BossLockPlayerForUltimate();chapter3BossCreateUltimateTentacles(now);
                chapter3BossPose(boss,'skill3');if(state.countdown)state.countdown.textContent='觸手降臨！';
            }
            return;
        }
        if(state.phase==='finalTentacles'){
            chapter3BossUpdateUltimateTentacles(now);chapter3BossPose(boss,'skill3');
            if(elapsed>=1050){state.phase='finalThunder';state.phaseStartedAt=now;if(state.countdown)state.countdown.textContent='特殊愛好者天堂！';}
            return;
        }
        if(state.phase==='finalThunder'){
            chapter3BossUpdateUltimateThunder(elapsed,now);chapter3BossUpdateUltimateTentacles(now);chapter3BossPose(boss,'skill4');
            if(elapsed>=1900){
                const fx=state.ultimateFx;if(fx){fx.warnings.forEach(item=>item.el?.remove());fx.warnings.length=0;fx.warningRefs.forEach(el=>el?.remove());fx.pillars.forEach(item=>item.el?.remove());fx.pillars.length=0;}
                state.phase='finalAttack';state.phaseStartedAt=now;if(state.countdown)state.countdown.textContent='觸手降臨！';
            }
            return;
        }
        if(state.phase==='finalAttack'){
            // 保留目前版本的全畫面閃電攻擊；使用實際存在的 1、2、3、5 四張圖。
            const frames=CHAPTER3_BOSS_LIGHTNING_ATTACK_FRAMES,frameDuration=260,animationDuration=frames.length*frameDuration;
            let effect=stage.querySelector('.chapter3-boss-final-lightning');
            if(!effect){effect=document.createElement('img');effect.className='chapter3-boss-final-lightning';effect.alt='';effect.draggable=false;effect.setAttribute('aria-hidden','true');stage.appendChild(effect);}
            const frameIndex=Math.min(frames.length-1,Math.floor(elapsed/frameDuration));
            const src=CHAPTER3_BOSS_DIR+'chapter3_boss_1_skin1_attack'+frames[frameIndex]+'.png';
            if(effect.getAttribute('src')!==src)effect.src=src;
            chapter3BossPose(boss,frameIndex<2?'skill3':'skill4');
            if(elapsed>=animationDuration){
                effect.remove();state.phase='finalImpact';state.phaseStartedAt=now;
                chapter3BossUltimateStartImpact(now);
                hero.classList.add('chapter3-boss-final-hit');
                const impact=document.createElement('div');impact.className='chapter3-boss-final-impact-flash';impact.setAttribute('aria-hidden','true');stage.appendChild(impact);
                if(state.countdown)state.countdown.textContent='天堂製造！';
            }
            return;
        }
        if(state.phase==='finalImpact'){
            chapter3BossUpdateUltimateExplosion(now);
            if(elapsed>=850&&!state.killedHeroByUltimate){
                state.killedHeroByUltimate=true;hp=0;updateHud();
                hero.classList.remove('chapter3-boss-final-hit');
                stage.querySelectorAll('.chapter3-boss-final-impact-flash').forEach(el=>el.remove());
                const blackout=document.createElement('div');blackout.className='chapter3-boss-blackout';blackout.setAttribute('aria-hidden','true');stage.appendChild(blackout);
                state.phase='finalDead';
            }
            return;
        }
        if(state.phase==='finalDead')return;
        if(state.phase==='combat'){
            chapter3BossUpdateCombatAI(boss,now,dt,true);return;
        }
        if(state.phase==='mixed20Launch'){
            chapter3BossUpdateMixed20Launch(boss,now);return;
        }
        if(state.phase==='mixed20InitialTentacles'){
            if(chapter3BossAliveTentacleCount()===0&&chapter3BossPendingTentacleCount()===0){
                state.phase='mixed20FadeToBlack';state.phaseStartedAt=now;chapter3BossTransitionBackground(1,now,1700);
            }
            return;
        }
        if(state.phase==='mixed20FadeToBlack'){
            if(state.bgFadeDuration<=0)chapter3BossBeginMixed20Return(boss,now);
            return;
        }
        if(state.phase==='mixed20Return'){
            chapter3BossUpdateReturn(boss,now,true,dt);return;
        }
        if(state.phase==='mixed20Combat'){
            chapter3BossUpdateCombatAI(boss,now,dt,false);
            chapter3BossUpdateMixed20Support(now);return;
        }
        if(state.phase==='mixed20ExitFade'){
            if(state.bgFadeDuration<=0){
                state.mixed20Active=false;boss.classList.remove('chapter3-boss-returning','chapter3-boss-return-dash','chapter3-boss-charging');boss.style.visibility='visible';
                chapter3BossSetLift(boss,0);chapter3BossFaceHero(boss);
                if(state.pendingFinal||hpNow/maxHP<=.10){state.pendingFinal=false;state.triggered.add('10');chapter3BossStartFinal(boss,now);}
                else{state.phase='combat';state.phaseStartedAt=now;state.lastAttackAt=now-400;chapter3BossPose(boss,'normal');}
            }
            return;
        }
        if(state.phase==='jump80'){
            if(state.jumpMode==='') {state.jumpMode='charge';state.jumpCount=0;state.phaseStartedAt=now;}
            chapter3BossUpdateJumpSequence(boss,now,dt,3,(at)=>{state.jumpMode='';chapter3BossFinishPhase(at);});return;
        }
        if(state.phase==='skill60Charge'){
            const seq=['skill1','skill2','skill3','skill4'];const frame=Math.min(3,Math.floor(elapsed/240));chapter3BossPose(boss,seq[frame]);
            if(elapsed>=960){
                boss.classList.remove('chapter3-boss-charging','chapter3-boss-skill60-charge');
                state.phase='skill60Strike';state.phaseStartedAt=now;
                // 60% 技能原本只更新效果、沒有建立落雷；在攻擊階段開始時安排三次落雷。
                chapter3BossPlanLightning(3,2600,false);
            }return;
        }
        if(state.phase==='skill60Strike'){
            chapter3BossUpdateLightning(now);
            if(elapsed>=3000){chapter3BossClearLightning();state.phase='skill60Recover';state.phaseStartedAt=now;chapter3BossPose(boss,'skill4');}return;
        }
        if(state.phase==='skill60Recover'){
            const reverse=['skill4','skill3','skill2','skill1'];
            const frame=Math.min(3,Math.floor(elapsed/240));chapter3BossPose(boss,reverse[frame]);
            if(elapsed>=960)chapter3BossFinishPhase(now);return;
        }
        if(state.phase==='tentacle40Intro'){
            if(elapsed<180){chapter3BossPose(boss,'jump1');chapter3BossSetLift(boss,stageH*.06);}
            else if(elapsed<360){chapter3BossPose(boss,'jump2');chapter3BossSetLift(boss,stageH*.22);}
            else if(elapsed<600){chapter3BossPose(boss,'jump3');chapter3BossSetLift(boss,stageH*.44);}
            else{boss.style.visibility='hidden';boss.classList.remove('chapter3-boss-charging');chapter3BossSetLift(boss,0);state.phase='tentacle40Wait';state.phaseStartedAt=now;state.wave=1;chapter3BossSpawnTentacleWave(2,state.wave);}
            return;
        }
        if(state.phase==='tentacle40Wait'){
            const alive=enemyList.some(e=>e.dataset.chapter3Tentacle==='1'&&Number(e.dataset.chapter3TentacleWave)===state.wave&&!e.classList.contains('dead'));
            if(!alive&&chapter3BossPendingTentacleCount(state.wave)===0){if(state.wave<3){state.wave++;chapter3BossSpawnTentacleWave(2,state.wave);state.phaseStartedAt=now;}else chapter3BossBeginWalkReturn(boss,now,false);}return;
        }
        if(state.phase==='tentacle40Return'){chapter3BossUpdateReturn(boss,now,false,dt);return;}
    }
    function chapter3BossUpdateBackground(now){
        if(!chapter3BossMode)return;
        const state=chapter3BossState,view=$('elevatorBgViewport');
        if(state.bgFadeDuration>0){
            const p=Math.max(0,Math.min(1,(now-state.bgFadeStartedAt)/state.bgFadeDuration));
            const eased=p*p*(3-2*p);
            state.bgDarkness=state.bgFadeFrom+(state.bgFadeTo-state.bgFadeFrom)*eased;
            if(p>=1)state.bgFadeDuration=0;
        }
        if(view)view.style.filter='brightness('+Math.max(0,1-state.bgDarkness).toFixed(3)+')';
        if(now-state.lastBgFrameAt<170)return;
        state.lastBgFrameAt=now;state.bgFrame=(state.bgFrame+1)%CHAPTER3_BOSS_BG_FRAMES.length;
        if(view)view.style.backgroundImage='url("'+CHAPTER3_BOSS_BG_FRAMES[state.bgFrame]+'")';
    }

    // ===== 第三章：水晶洞升降機測試關 =====
    // 保留正式遊戲的角色物理、槍刺、盾擊、Q 大絕、敵人 AI 與死亡流程；只替換背景及分波流程。
    function elevatorMeasureBackground(){
        if(!elevatorMode)return;
        const bg=$('elevatorBG');
        if(bg&&bg.naturalWidth&&bg.naturalHeight){
            const oldHeight=elevatorState.scrollHeight;
            const oldOffset=oldHeight>0?((elevatorState.scrollY%oldHeight)+oldHeight)%oldHeight:0;
            const oldProgress=oldHeight>0?oldOffset/oldHeight:0;
            // Layer 2 與 Layer 1 使用同一個 world 縮放比例。兩張後景圖上下接續，確保循環期間不會露底。
            const renderWidth=Math.max(stageW,worldW||stageW);
            const renderedH=renderWidth*(bg.naturalHeight/bg.naturalWidth);
            elevatorState.scrollHeight=renderedH;
            // 再比 v2 的現有捲動速度快 5 倍；以舊版 viewport 縮放時計算速度基準，避免世界寬度影響倍率。
            const viewportRenderedH=stageW*(bg.naturalHeight/bg.naturalWidth);
            const viewportScrollRange=Math.max(1,viewportRenderedH-stageH);
            elevatorState.scrollMax=viewportScrollRange;
            if(!['braking','stopping','stopped','exit','dock'].includes(elevatorState.phase)){
                elevatorState.scrollSpeed=(viewportScrollRange/18000)*25; // 保留目前要求的高速 loop 基準。
            }
            elevatorState.scrollY=oldProgress*renderedH;
        }
    }
    function elevatorPlaceBackgroundTiles(){
        const bg=$('elevatorBG'),next=$('elevatorBGNext');
        const height=elevatorState.scrollHeight;
        if(!height||!bg)return;
        const offset=((elevatorState.scrollY%height)+height)%height;
        bg.style.transform='translate3d(0,'+offset.toFixed(2)+'px,0)';
        if(next)next.style.transform='translate3d(0,'+(offset-height).toFixed(2)+'px,0)';
    }
    function elevatorUpdateCameraShake(now){
        // 第 5 波結束時：一次較強的急停震動。背景仍持續 loop 到震動結束才停。
        if(elevatorState.phase==='stopping'){
            const duration=Math.max(1,elevatorState.stopShakeUntil-elevatorState.stopShakeStartedAt);
            const progress=Math.max(0,Math.min(1,(now-elevatorState.stopShakeStartedAt)/duration));
            const envelope=Math.pow(Math.max(0,Math.sin(Math.PI*progress)),0.72);
            // 短促、多次快速擺動構成一次明顯的急停衝擊，而不是長時間持續搖晃。
            const waveX=Math.sin(progress*Math.PI*12)*0.76+Math.sin(progress*Math.PI*22)*0.24;
            const waveY=Math.cos(progress*Math.PI*10)*0.68+Math.sin(progress*Math.PI*18)*0.32;
            elevatorState.shakeX=waveX*24*envelope;
            elevatorState.shakeY=waveY*18*envelope;
            stage.classList.add('elevator-camera-shake','elevator-stop-impact');
            if(progress>=1) elevatorFinishStop();
            return;
        }
        if(elevatorState.phase==='braking'){
            // 減速階段保持畫面穩定；背景慢慢停定後，才觸發一次明顯急停震動。
            stage.classList.remove('elevator-camera-shake');
            elevatorState.shakeStartedAt=0;elevatorState.shakeUntil=0;
            elevatorState.shakeX=0;elevatorState.shakeY=0;
            return;
        }
        const ascending=elevatorState.phase==='lift'||elevatorState.phase==='between';
        if(!ascending){
            stage.classList.remove('elevator-camera-shake','elevator-stop-impact');
            elevatorState.shakeNextAt=0;elevatorState.shakeStartedAt=0;elevatorState.shakeUntil=0;
            elevatorState.shakeX=0;elevatorState.shakeY=0;
            return;
        }
        if(!elevatorState.shakeNextAt)elevatorState.shakeNextAt=now+550;
        if(now>=elevatorState.shakeNextAt&&now>=elevatorState.shakeUntil){
            elevatorState.shakeStartedAt=now;
            elevatorState.shakeUntil=now+280;
            elevatorState.shakeNextAt=now+1900+Math.random()*700;
            stage.classList.add('elevator-camera-shake');
        }
        if(now<elevatorState.shakeUntil&&elevatorState.shakeStartedAt){
            const progress=Math.max(0,Math.min(1,(now-elevatorState.shakeStartedAt)/280));
            const envelope=Math.sin(Math.PI*progress);
            elevatorState.shakeX=(Math.random()*2-1)*7*envelope;
            elevatorState.shakeY=(Math.random()*2-1)*5*envelope;
        }else{
            elevatorState.shakeX=0;elevatorState.shakeY=0;
            stage.classList.remove('elevator-camera-shake');
        }
    }
    function elevatorSetScene(phase){
        elevatorState.phase=phase;
        if(phase!=='lift'&&phase!=='between'&&phase!=='stopping'){stage.classList.remove('elevator-camera-shake','elevator-stop-impact');elevatorState.shakeX=0;elevatorState.shakeY=0;elevatorState.shakeStartedAt=0;elevatorState.shakeUntil=0;}
        const bgView=$('elevatorBgViewport'),fg=$('elevatorForeground'),exit=$('elevatorExitBackdrop'),exitImg=$('elevatorExitImg');
        const usingLift=(phase==='lift'||phase==='between'||phase==='stopping'||phase==='stopped');
        if(bgView)bgView.hidden=!usingLift;
        if(fg)fg.hidden=!usingLift;
        if(exit)exit.hidden=usingLift;
        if(phase==='exit'){
            // 舊版自訂碼頭轉場已移除：現在由 updateElevatorMode 在出口觸發 nextLevel()，
            // 直接使用普通關卡的 startLevel 流程載入 chapter3_bg22，避免臨時畫面重設角色位置。
            nextLevel();
        }
        updateHud();
    }
    // 第 5 波結束後，按使用者提供的參考畫面將 layer2 loop 停在約半個循環的位置。
    // 先以連續減速曲線停到目標位置，然後才做一次大力急停搖晃。
    function elevatorBeginBrake(now){
        const h=Math.max(1,elevatorState.scrollHeight||0);
        const mod=(v,m)=>((v%m)+m)%m;
        const current=mod(elevatorState.scrollY,h);
        const target=h*0.5; // 截圖參考對應到 loop 圖垂直循環約 50% 的場景位置。
        const distance=mod(target-current,h);
        const startSpeed=Math.max(0.08,elevatorState.scrollSpeed||((h*0.5)/1200));
        // 只沿目前向下捲動方向前進到下一個目標位置，不額外多跑一整圈。
        // 使用減速曲線，時長依實際距離決定，確保最後停在參考截圖位置。
        const duration=Math.max(350,(2*distance)/startSpeed);
        elevatorState.phase='braking';
        elevatorState.brakeStartedAt=now;
        elevatorState.brakeDurationMs=duration;
        elevatorState.brakeStartOffset=current;
        elevatorState.brakeDistance=distance;
        elevatorState.brakeStartSpeed=startSpeed;
        elevatorState.brakeTargetOffset=target;
        elevatorState.scrollY=current;
        elevatorState.scrollSpeed=startSpeed;
        elevatorState.shakeX=0;elevatorState.shakeY=0;
        elevatorState.shakeNextAt=0;elevatorState.shakeStartedAt=0;elevatorState.shakeUntil=0;
        stage.classList.remove('elevator-camera-shake','elevator-stop-impact');
        announce('第 5 波完成！升降機正在慢慢減速……',2.4);
        updateHud();
    }
    function elevatorBeginStopImpact(now){
        if(elevatorState.phase!=='braking')return;
        elevatorState.scrollY=elevatorState.brakeTargetOffset;
        elevatorState.scrollSpeed=0;
        elevatorState.phase='stopping';
        elevatorState.stopShakeStartedAt=now;
        elevatorState.stopShakeUntil=now+900;
        elevatorState.shakeNextAt=0;
        elevatorState.shakeStartedAt=0;elevatorState.shakeUntil=0;
        elevatorState.shakeX=0;elevatorState.shakeY=0;
        elevatorPlaceBackgroundTiles();
        stage.classList.add('elevator-camera-shake','elevator-stop-impact');
        announce('升降機到達指定位置！轟——！',1.4);
        updateHud();
    }
    function elevatorFinishStop(){
        if(elevatorState.phase!=='stopping')return;
        elevatorState.scrollSpeed=0;
        elevatorState.shakeX=0;elevatorState.shakeY=0;
        elevatorState.stopShakeStartedAt=0;elevatorState.stopShakeUntil=0;
        stage.classList.remove('elevator-camera-shake','elevator-stop-impact');
        elevatorSetScene('stopped');
        exitOpen=true;
        exitX=heroExitX();
        if(exitPrompt)exitPrompt.textContent='➜ 向右移動前往碼頭';
        exitPrompt.hidden=false;
        announce('升降機已停定！向右走出升降機',2.2);
        updateHud();
        updateCamera();
    }
    function removeGhostProjectiles(){
        while(ghostProjectiles.length){const p=ghostProjectiles.pop();if(p?.el?.isConnected)p.el.remove();}
        world.querySelectorAll('.ghost-toxic-orb').forEach(el=>el.remove());
    }
    function spawnGhostToxicOrb(enemy,now){
        if(!enemy||!enemy.isConnected||!running||!elevatorMode||hp<=0)return;
        const enemyX=Number(enemy.dataset.x)||parseFloat(enemy.style.left)||0;
        const enemyWidth=enemy.offsetWidth||90;
        const enemyCenter=enemyX+enemyWidth*.5;
        const heroCenter=x+(hero.offsetWidth||70)*.5;
        // 固定朝發射當下女神所在方向，並把目標點設在她當下的水平中心。
        const direction=heroCenter>=enemyCenter?1:-1;
        const size=Math.max(38,Math.min(62,stageW*.033));
        const startX=enemyCenter+direction*(enemyWidth*.30);
        const targetX=heroCenter;
        const distance=Math.abs(targetX-startX);
        const travelMs=Math.max(1500,Math.min(3000,distance/0.17));
        const startBottom=Math.max(44,stageH*.20);
        const arcHeight=Math.max(145,Math.min(235,stageH*.34));
        const orb=document.createElement('img');
        orb.className='ghost-toxic-orb';orb.alt='';orb.draggable=false;orb.setAttribute('aria-hidden','true');
        orb.src=GHOST_ORB_ASSET;
        orb.style.width=size+'px';orb.style.height=size+'px';
        orb.style.left=(startX-size*.5)+'px';
        orb.style.bottom=startBottom+'px';
        world.appendChild(orb);
        ghostProjectiles.push({
            el:orb,startX,targetX,x:startX,direction, size, damage:1,
            startBottom,arcHeight,createdAt:now,durationMs:travelMs,expiresAt:now+travelMs+120
        });
    }
    function updateGhostProjectiles(dt,now){
        for(let i=ghostProjectiles.length-1;i>=0;i--){
            const p=ghostProjectiles[i],orb=p.el;
            if(!orb?.isConnected||!running||!elevatorMode||now>p.expiresAt){
                if(orb?.isConnected)orb.remove();ghostProjectiles.splice(i,1);continue;
            }
            // 緩慢飛行的高拋物線：水平移向目標，垂直高度按 4h·t·(1−t) 上升再下降。
            const progress=Math.max(0,Math.min(1,(now-p.createdAt)/p.durationMs));
            p.x=p.startX+(p.targetX-p.startX)*progress;
            const verticalOffset=4*p.arcHeight*progress*(1-progress);
            orb.style.left=(p.x-p.size*.5)+'px';
            orb.style.bottom=(p.startBottom+verticalOffset)+'px';
            // 命中判定在水平重疊時生效；跳躍可閃避，防禦期間可擋下。不存在毒池或持續傷害。
            const heroLeft=x,heroRight=x+(hero.offsetWidth||70);
            const lowEnoughToHit=verticalOffset<=Math.max(28,stageH*.045);
            if(p.x+p.size*.34>=heroLeft&&p.x-p.size*.34<=heroRight&&lowEnoughToHit&&jumpT===0){
                if(now>=bashLockUntil){const previousHP=hp;hp=Math.max(0,hp-p.damage);floatText('−'+(previousHP-hp),x,28);updateHud();}
                else floatText('防禦！',x,34);
                orb.remove();ghostProjectiles.splice(i,1);continue;
            }
            if(progress>=1){if(orb.isConnected)orb.remove();ghostProjectiles.splice(i,1);}
        }
    }

    function elevatorStartWave(waveNo){
        // 新一波開始前清走上一波已死亡的 DOM；所有怪物使用正式的 chapter1_enemy_1 圖片與戰鬥系統。
        enemyList.slice().forEach(e=>{if(e.classList.contains('dead')){clearTimeout(e._spriteTimer);clearTimeout(e._deathPoseTimer);disconnectChapter3FootAnchorObserver(e);e.remove();const idx=enemyList.indexOf(e);if(idx>=0)enemyList.splice(idx,1);}});
        elevatorState.wave=waveNo;elevatorState.phase='lift';elevatorState.betweenMs=0;
        const fractions=[.10,.29,.48,.67,.83];
        const enemySafeMax=Math.max(36,worldW-Math.max(112,Math.min(145,stageW*.11))-18);
        fractions.forEach(f=>{
            const px=Math.max(12,Math.min(enemySafeMax,cameraX+stageW*f));
            spawn(px,false,false);
            const e=enemyList[enemyList.length-1];
            if(e){
                e.dataset.elevatorWave=String(waveNo);e.dataset.facingLocked='0';
                // 電梯關卡統一使用第三章鬼魂素材；normal 是站立常態圖，idle 使用獨立的 chapter3_enemy_1_idle.png，沿用既有敵人 AI、受擊與死亡系統。
                e.dataset.spriteType='chapter3_enemy_1';
                e.dataset.type='assassin';
                const sprite=e.querySelector('.enemySprite');
                if(sprite){
                    sprite.style.visibility='visible';
                    sprite.onerror=function(){
                        // 只在可用影格真的失敗時回退到 walk1；避免舊的 missing normal 圖把角色永久隱藏。
                        const fallback=enemySpritePath('chapter3_enemy_1','walk1');
                        if(!this.src.endsWith('/chapter3_enemy_1_walk1.png')){this.onerror=()=>{this.style.visibility='hidden';};this.src=fallback;}
                        else this.style.visibility='hidden';
                    };
                    sprite.src=enemySpritePath('chapter3_enemy_1','normal');sprite.alt='第三章鬼魂敵人';
                }
                const label=e.querySelector('.enemy-name');if(label)label.textContent='鬼魂';
                const heroCenter=x+(hero.offsetWidth||70)*.5,ghostCenter=(Number(e.dataset.x)||0)+(e.offsetWidth||90)*.5;
                const faceLeft=ghostCenter>heroCenter;e.dataset.facing=faceLeft?'left':'right';e.classList.toggle('enemy-facing-left',faceLeft);
            }
        });
        announce('第 '+waveNo+' 波！5 隻敵人出現',1.8);
        updateHud();
    }
    function elevatorReset(){
        if(elevatorAnnouncementTimer){window.clearTimeout(elevatorAnnouncementTimer);elevatorAnnouncementTimer=0;}
        const previousNotice=$('elevatorAnnouncement');
        if(previousNotice){previousNotice.classList.remove('is-visible');previousNotice.hidden=true;}
        elevatorState.phase='lift';elevatorState.wave=1;elevatorState.betweenMs=0;elevatorState.transitionMs=0;elevatorState.exitStartedAt=0;
        elevatorState.startedAt=performance.now();elevatorState.brakeStartedAt=0;elevatorState.brakeDurationMs=0;elevatorState.brakeStartOffset=0;elevatorState.brakeDistance=0;elevatorState.brakeStartSpeed=0;elevatorState.brakeTargetOffset=0;elevatorState.scrollProgress=0;elevatorState.scrollY=0;elevatorState.scrollMax=0;elevatorState.scrollHeight=0;elevatorState.scrollSpeed=0;elevatorState.shakeNextAt=elevatorState.startedAt+550;elevatorState.shakeStartedAt=0;elevatorState.shakeUntil=0;elevatorState.shakeX=0;elevatorState.shakeY=0;elevatorState.stopShakeStartedAt=0;elevatorState.stopShakeUntil=0;stage.classList.remove('elevator-camera-shake','elevator-stop-impact');
        exitOpen=false;exitPrompt.hidden=true;
        const bgView=$('elevatorBgViewport'),fg=$('elevatorForeground'),exit=$('elevatorExitBackdrop'),exitImg=$('elevatorExitImg'),bg=$('elevatorBG'),bgNext=$('elevatorBGNext');
        if(bgView)bgView.hidden=false;if(fg)fg.hidden=false;if(exit)exit.hidden=true;
        if(bg){bg.src='images/chapter3/bg3/chapter3_stage_1_BG_layer2_loop.png';bg.style.transform='';}
        if(bgNext){bgNext.src='images/chapter3/bg3/chapter3_stage_1_BG_layer2_loop.png';bgNext.style.transform='';}
        if(exitImg)exitImg.src='images/chapter3/bg3/chapter3_bg22.png';
        if(exitPrompt)exitPrompt.textContent='➜ 向右移動前往碼頭';
        elevatorMeasureBackground();
        updateCamera(); // 重開關卡時先按新 world 寬度更新鏡頭，讓第一波生成在目前可視畫面內。
    }
    function elevatorShowChapter3Ready(){
        if(elevatorState.phase!=='dock'||!running)return;
        // 電梯後直接進入已存在的 chapter3_bg22（第 10 關），不再顯示「第三章準備中」。
        const nextLevelNumber=level+1;
        const nextConfig=levelConfigs[nextLevelNumber-1];
        if(nextConfig && nextConfig.chapter===3){
            startLevel(nextLevelNumber,true);
            return;
        }
        // 向後相容：如果日後移除後續關卡設定，才顯示終章提示。
        elevatorState.phase='chapter-ready';
        running=false;paused=false;keys={};resetMovementPhysics();
        hero.classList.remove('walking','jump','thrust','bash');
        setHeroSprite('images/hero/hero_stand.png');
        $('modalTitle').textContent='第三章準備中';
        const endSubtitle=overlay.querySelector('.enTitle');
        if(endSubtitle)endSubtitle.textContent='CHAPTER 3 COMING SOON';
        $('modalDesc').textContent='新的冒險正在準備中，敬請期待！';
        $('start').textContent='重玩';
        $('returnTitle').style.display='none';
        overlay.style.display='flex';
    }
    function updateElevatorMode(dt,now){
        if(elevatorState.phase==='lift'||elevatorState.phase==='between'||elevatorState.phase==='braking'||elevatorState.phase==='stopping'){
            elevatorMeasureBackground();
            if(elevatorState.scrollHeight>0){
                if(elevatorState.phase==='lift'||elevatorState.phase==='between'){
                    // 第 1–4 波期間維持既有高速 loop。
                    elevatorState.scrollY=(elevatorState.scrollY+dt*elevatorState.scrollSpeed)%elevatorState.scrollHeight;
                }else if(elevatorState.phase==='braking'){
                    // 慢慢減速，並把 loop 精準停在使用者參考圖對應的垂直場景位置。
                    const p=Math.max(0,Math.min(1,(now-elevatorState.brakeStartedAt)/Math.max(1,elevatorState.brakeDurationMs)));
                    const eased=p*(2-p); // 初速連續、結尾速度自然降至 0。
                    elevatorState.scrollY=(elevatorState.brakeStartOffset+elevatorState.brakeDistance*eased)%elevatorState.scrollHeight;
                    elevatorState.scrollSpeed=elevatorState.brakeStartSpeed*(1-p);
                    if(p>=1){
                        elevatorState.scrollY=elevatorState.brakeTargetOffset;
                        elevatorBeginStopImpact(now);
                    }
                }
                elevatorState.scrollProgress=elevatorState.scrollY/elevatorState.scrollHeight;
                elevatorPlaceBackgroundTiles();
            }
            // 背景減速完成後才進入停機震動；強烈震動時背景保持在目標位置不再移動。
            elevatorUpdateCameraShake(now);
        }else{
            stage.classList.remove('elevator-camera-shake');
        }
        if(elevatorState.phase==='between'){
            elevatorState.betweenMs-=dt;
            if(elevatorState.betweenMs<=0)elevatorStartWave(elevatorState.wave+1);
        }else if(elevatorState.phase==='lift'){
            const aliveThisWave=enemyList.some(e=>e.dataset.elevatorWave===String(elevatorState.wave)&&!e.classList.contains('dead'));
            if(!aliveThisWave){
                if(elevatorState.wave<5){
                    elevatorSetScene('between');elevatorState.betweenMs=1050;
                    announce('第 '+elevatorState.wave+' 波完成，升降機繼續上升',1.2);
                }else{
                    // 第 5 波清除：後景先減速並停在參考位置，然後升降機大力搖晃一下才完全停定。
                    elevatorBeginBrake(now);
                }
            }
        }else if(elevatorState.phase==='stopped'){
            // 與普通關卡相同：玩家走到出口就呼叫 nextLevel()，由 startLevel 統一重設位置、物理及背景。
            if(exitOpen&&keys.right&&x>=exitX-1)nextLevel();
        }
        updateCamera();
    }
    function clearEnemies() {
        chapter3BossReset();
        resetSpiderBossSkill();
        resetChapter1FinalSkill();
        resetBossRush();
        removeGhostProjectiles();
        enemyList.forEach(disconnectChapter3FootAnchorObserver);
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
        attackMoveLockUntil=0;
        heroActionUntil=0;
        heroActionSprite='images/hero/hero_stand.png';
        ultimateSound.stopAll();
        ultimateActive=false;
        ultimateCooldownUntil=0;
        ultimateToken++;
        pendingChapterTransition=false;
        level=Math.max(1,Math.min(levelConfigs.length||9,Number(window.GAME_START_LEVEL)||1));
        elevatorMode=elevatorStandaloneTest||!!(levelConfigs[level-1]&&levelConfigs[level-1].elevator);
        chapter3BossMode=!!(levelConfigs[level-1]&&levelConfigs[level-1].chapter3Boss);
        document.body.classList.toggle('elevator-mode',elevatorMode);
        document.body.classList.toggle('chapter3-boss-mode',chapter3BossMode);
        if(!elevatorMode&&!chapter3BossMode){
            const bgView=$('elevatorBgViewport'),fg=$('elevatorForeground'),exit=$('elevatorExitBackdrop');
            if(bgView)bgView.hidden=true;if(fg)fg.hidden=true;if(exit)exit.hidden=true;
            stage.classList.remove('elevator-camera-shake','elevator-stop-impact');
        }
        // 第二章角色與敵人整體往下對齊，避免腳底高於背景地面。
        world.classList.toggle('chapter2-world', !!(levelConfigs[level-1] && levelConfigs[level-1].chapter===2));
        world.classList.toggle('chapter3-world', !!(levelConfigs[level-1] && levelConfigs[level-1].chapter===3 && !levelConfigs[level-1].elevator));
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
        const modalSubtitle=overlay.querySelector('.enTitle');
        if(modalSubtitle)modalSubtitle.textContent='THE PRINCE IS GONE AGAIN!';
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
        cameraX=0;bossCameraReturnUntil=0;
        world.style.left='0px';
        world.style.transform='translate3d(0,0,0)';
        setupLevelBackground();
        sizeWorld();
        // 新一局可直接從指定關卡開始；在進入遊戲迴圈前同步開啟對應海況效果。
        updateSeaWeather(performance.now(),true);
        x=Math.min(stage.clientWidth*.25,heroExitX()*.45);
        faceDir=1;
        // 初始左側敵人視為後方敵人，生成時鎖定朝左；右側敵人面向女騎士。
        // 測試頁限定：直接生成第 8 關蜘蛛 Boss，跳過普通敵兵清場。
        if(elevatorMode){
            elevatorReset();
            elevatorStartWave(1);
        } else if(chapter3BossMode){
            chapter3BossSpawnAtLevelStart();
        } else if(window.GAME_TEST_DIRECT_BOSS===1 && level===8) {
            const testBossX=Math.min(heroExitX()-30,x+stageW*.48);
            spawn(testBossX,true,false);
            const testBoss=enemyList[enemyList.length-1];
            bossSpawnedThisLevel=true;
            if(testBoss&&testBoss.dataset.spriteType==='chapter2_boss_2') {
                updateBossHealthBar(testBoss);
                if(bossHealthPanel)bossHealthPanel.hidden=false;
            }
        } else if(!(levelConfigs[level-1]&&levelConfigs[level-1].noEnemies)) {
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
        // Chapter 3 BGM is 20% louder (0.336 vs normal 0.28); other chapters remain unchanged.
        bgmAudio.volume=config.chapter===3?0.336:0.28;
        const fallbackPath=config.chapter===2?'audio/forest.ogg':'audio/fantasy_rpg_bgm.ogg';
        const musicPath=config.music||fallbackPath;
        const resolvedPath=new URL(musicPath,document.baseURI).href;
        // 第 9 關使用 audio/ghost.ogg；若音檔載入失敗，便退回預設背景音樂。
        bgmAudio.onerror = musicPath==='audio/ghost.ogg' ? () => {
            const failedSource=bgmAudio.currentSrc||bgmAudio.src;
            if(!failedSource.endsWith('/audio/ghost.ogg'))return;
            bgmAudio.onerror=null;
            bgmAudio.src=fallbackPath;
            bgmAudio.load();
            if(musicEnabled){
                const fallbackPlay=bgmAudio.play();
                if(fallbackPlay&&fallbackPlay.catch)fallbackPlay.catch(()=>{});
            }
        } : null;
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
        if(!running||paused||chapter3BossPlayerLocked()||document.body.classList.contains('spider-apocalypse')||attackCd>0||knockbackUntilLanding)return;
        const attackStartedAt=performance.now();
        // 普通槍刺採用較短恢復時間；盾擊與特殊技能維持原本硬直。
        const attackRecoveryMs=kind==='thrust'
            ? Math.max(0,Number(tuneEffects.heroThrustRecoveryMs??190))
            : Math.max(0,Number(tuneEffects.heroAttackPoseMs??520));
        attackMoveLockUntil=attackStartedAt+attackRecoveryMs;
        keys.left=false; keys.right=false; moveV=0;
        jumpBufferMs=0;
        hero.classList.remove('walking');
        if(kind==='bash'){
            // 盾擊原有的 500ms 防禦判定保留，不與共用移動鎖混用。
            bashLockUntil=attackStartedAt+500;
            hero.classList.remove('jump');
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
        heroActionUntil=performance.now()+attackRecoveryMs;
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
            if(isChapter3Boss(e)&&e.style.visibility==='hidden')return;
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
                const healthRatio=Math.max(0,Math.min(1,eh/Math.max(1,Number(e.dataset.maxhp)||1)));
                const enemyHealthFill=e.querySelector('.ehealth i');if(enemyHealthFill)enemyHealthFill.style.width=(healthRatio*100)+'%';
                const localHealthBar=e.querySelector('.ehealth');if(localHealthBar&&e.dataset.chapter3Tentacle==='1')localHealthBar.setAttribute('aria-valuenow',String(Math.round(healthRatio*100)));
                updateBossHealthBar(e);
                if(eh>0)checkBossRushThreshold(e);
                const es=e.querySelector('.enemySprite');
                const bossIsRushing=bossRush.active&&e===bossRush.boss;
                const spiderSkillLocked=isSpiderBoss(e)&&spiderBossSkill.active;
                if(es&&!bossIsRushing&&!spiderSkillLocked) {
                    if(isChapter3Boss(e)){
                        chapter3BossRegisterHit(e,tuneEffects.enemyHitPoseMs??300);
                    }else{
                        es.src=enemySpritePath(e.dataset.spriteType||type,'hit');
                        e.dataset.actionUntil=String(performance.now()+310);
                        clearTimeout(e._spriteTimer);
                        e._spriteTimer=setTimeout(()=> {
                            if(es.isConnected&&!e.classList.contains('dead')&&!(bossRush.active&&e===bossRush.boss))es.src=enemySpritePath(e.dataset.spriteType||type,'idle')
                        },tuneEffects.enemyHitPoseMs??300)
                    }
                }
                if(!bossIsRushing&&!spiderSkillLocked&&!isChapter3Boss(e) && !(chapter1FinalSkill.active && e===chapter1FinalSkill.boss)) {
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
                    if(isChapter3Boss(e))chapter3BossKilled(e);
                    clearTimeout(e._spriteTimer);
                    clearEnemyFlash(e);
                    e.classList.remove('enemy-hit','enemy-attacking');
                    // Lock the enemy immediately, briefly show the hit reaction, then leave the corpse.
                    if(e.dataset.chapter3Tentacle==='1')chapter3TentacleAudio.removeTentacle(e);
                    e.classList.add('dead');
                    if(es) {
                        es.src=enemySpritePath(e.dataset.spriteType||type,'hit');
                        e._deathPoseTimer=setTimeout(()=>{
                            if(es.isConnected) es.src=enemySpritePath(e.dataset.spriteType||type,'dead');
                        },tuneEffects.deathHitPoseMs??150);
                    }
                    if(e.dataset.spiderMinion!=='1'&&e.dataset.chapter3Tentacle!=='1'){kills++;levelKills++;}
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
        if(!running||paused||chapter3BossPlayerLocked()||document.body.classList.contains('spider-apocalypse')||ultimateActive)return;
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
        moveV=0;
        jumpBufferMs=0;
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
                if(isChapter3Boss(e)&&e.style.visibility==='hidden')return;
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
                    if(isChapter3Boss(e)){
                        chapter3BossRegisterHit(e,tuneEffects.ultimateEnemyHitPoseMs??360);
                    }else{
                        es.src=enemySpritePath(e.dataset.spriteType||type,'hit');
                        e.dataset.actionUntil=String(performance.now()+370);
                        clearTimeout(e._spriteTimer);
                        e._spriteTimer=setTimeout(()=> {
                            if(es.isConnected&&!e.classList.contains('dead')&&!(bossRush.active&&e===bossRush.boss))es.src=enemySpritePath(e.dataset.spriteType||type,'idle')
                        },tuneEffects.ultimateEnemyHitPoseMs??360)
                    }
                }
                if(!bossIsRushing&&!spiderSkillLocked&&!isChapter3Boss(e) && !(chapter1FinalSkill.active && e===chapter1FinalSkill.boss)) {
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
                    if(isChapter3Boss(e))chapter3BossKilled(e);
                    clearTimeout(e._spriteTimer);
                    clearEnemyFlash(e);
                    e.classList.remove('enemy-hit','enemy-attacking');
                    // Lock the enemy immediately, briefly show the hit reaction, then leave the corpse.
                    if(e.dataset.chapter3Tentacle==='1')chapter3TentacleAudio.removeTentacle(e);
                    e.classList.add('dead');
                    if(es) {
                        es.src=enemySpritePath(e.dataset.spriteType||type,'hit');
                        e._deathPoseTimer=setTimeout(()=>{
                            if(es.isConnected) es.src=enemySpritePath(e.dataset.spriteType||type,'dead');
                        },tuneEffects.deathHitPoseMs??150);
                    }
                    if(e.dataset.spiderMinion!=='1'&&e.dataset.chapter3Tentacle!=='1'){kills++;levelKills++;}
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
        elevatorMode=elevatorStandaloneTest||!!(levelConfigs[level-1]&&levelConfigs[level-1].elevator);
        chapter3BossMode=!!(levelConfigs[level-1]&&levelConfigs[level-1].chapter3Boss);
        document.body.classList.toggle('elevator-mode',elevatorMode);
        document.body.classList.toggle('chapter3-boss-mode',chapter3BossMode);
        if(!elevatorMode&&!chapter3BossMode){
            const bgView=$('elevatorBgViewport'),fg=$('elevatorForeground'),exit=$('elevatorExitBackdrop');
            if(bgView)bgView.hidden=true;if(fg)fg.hidden=true;if(exit)exit.hidden=true;
            stage.classList.remove('elevator-camera-shake','elevator-stop-impact');
        }
        // Keep chapter-specific CSS selectors active when the game advances into Chapter 2.
        world.classList.toggle('chapter2-world', !!(levelConfigs[level-1] && levelConfigs[level-1].chapter===2));
        world.classList.toggle('chapter3-world', !!(levelConfigs[level-1] && levelConfigs[level-1].chapter===3 && !levelConfigs[level-1].elevator));
        levelKills=0;
        spawnedThisLevel=0;
        bossSpawnedThisLevel=false;
        spawnTimer=0;
        exitOpen=false;
        exitPrompt.hidden=true;
        if(preserveRun) { hp=Math.min(100,hp+18); mp=Math.min(100,mp+20); }
        clearEnemies();
        setupLevelBackground();
        sizeWorld();
        x=Math.min(stageW*.12,heroExitX()*.25);
        resetMovementPhysics();
        cameraX=0;
        world.style.left='0px';
        world.style.transform='translate3d(0,0,0)';
        const config=levelConfigs[level-1]||{};
        if(config.noEnemies&&exitPrompt)exitPrompt.textContent='➜ 向右移動，前往下一關';
        else if(exitPrompt)exitPrompt.textContent='➜ 前往下一區';
        if(running && musicEnabled) startGameMusic();
        floatText('第 '+level+' 關：'+(config.name||'冒險'),stageW*.43,54);
        if(elevatorMode){
            elevatorReset();
            elevatorStartWave(1);
        }else if(chapter3BossMode){
            chapter3BossSpawnAtLevelStart();
        }else if(!config.noEnemies){
            spawn(Math.max(24,x-stageW*.22),false,true);
            spawn(Math.min(heroExitX()-30,x+stageW*.34),false,false);
        }
        // 根據當前海港背景切換海浪／閃電效果；只有 stage 6 顯示雨層。
        updateSeaWeather(performance.now(),true);
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
        if(level>=levelConfigs.length) {
            running=false;
            pendingChapterTransition=false;
            showEnd('第三章完成：港口的真相','十五關全部完成！你已穿越水晶洞、海港與雷暴戰場，完成第三章冒險。','再玩一次');
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
            updateSeaWeather(t);
            chapter3BossUpdateBackground(t);
            updateCamera();
            updateGhostProjectiles(dt,t);
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
                        const quickMixedTentacle=e.dataset.chapter3Tentacle==='1'&&chapter3BossState.mixed20Active;
                        const corpseFadeDelay=quickMixedTentacle?260:(tuneEffects.corpseFadeDelayMs??1650);
                        const corpseRemoveDelay=quickMixedTentacle?620:(tuneEffects.corpseRemoveDelayMs??2450);
                        setTimeout(()=>e.classList.add('fade-out'),corpseFadeDelay);
                        setTimeout(()=> {
                            disconnectChapter3FootAnchorObserver(e);
                            e.remove();
                            const idx=enemyList.indexOf(e);
                            if(idx>=0)enemyList.splice(idx,1)
                        },corpseRemoveDelay)
                    }
                    continue
                }
                if(isChapter3Boss(e)){chapter3BossUpdate(e,t,dt);continue;}
                if(e.dataset.chapter3Tentacle==='1'){chapter3BossUpdateTentacle(e,t);continue;}
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
                // 第三章鬼魂與新增敵人都持續自動面向女神。新敵人原圖預設朝右，位於玩家右側時需水平翻轉朝左。
                const spriteTypeForFacing=e.dataset.spriteType||type;
                const isGhostEnemy=elevatorMode&&spriteTypeForFacing==='chapter3_enemy_1';
                const isChapter3Enemy=/^chapter3_enemy_[2-8]$/.test(spriteTypeForFacing);
                const heroCenterX=x+(hero.offsetWidth||70)*.5;
                const enemyVisualCenter=ex+(isGhostEnemy?(e.offsetWidth||90)*.5:(e.dataset.boss==='1'?(e.offsetWidth||80)*.5:0));
                if(isSpiderBoss(e)) spiderFacePlayer(e);
                else if(isGhostEnemy){
                    const ghostFacesLeft=enemyVisualCenter>heroCenterX;
                    e.dataset.facing=ghostFacesLeft?'left':'right';
                    e.classList.toggle('enemy-facing-left',ghostFacesLeft);
                }
                else if(isChapter3Enemy) {
                    // 沿用鬼魂相同的 heroCenterX 判斷；新素材預設朝右，敵人中心在玩家右側時水平翻轉朝左。
                    const chapter3EnemyCenter=ex+(e.offsetWidth||90)*.5;
                    const chapter3FacesLeft=chapter3EnemyCenter>heroCenterX;
                    e.dataset.facing=chapter3FacesLeft?'left':'right';
                    e.classList.toggle('enemy-facing-left',chapter3FacesLeft);
                }
                else if(e.dataset.facingLocked!=='1') {
                    const enemyFacesLeft = x > enemyVisualCenter;
                    e.dataset.facing=enemyFacesLeft?'left':'right';
                    e.classList.toggle('enemy-facing-left',enemyFacesLeft);
                }
                const targetCenter=isGhostEnemy?heroCenterX:x;
                const approachDistance=Math.abs(enemyVisualCenter-targetCenter);
                const approachRange=isGhostEnemy?Math.max(118,stageW*.13):stageW*.07;
                if(approachDistance>approachRange) {
                    const approachSpeed=tuneEnemyAI.approachSpeed||{assassin:0.22,heavy:0.10,shield:0.10,acolyte:0.12,default:0.15};
                    const speed=approachSpeed[type]??approachSpeed.default??0.15;
                    const centerOffset=isGhostEnemy?(e.offsetWidth||90)*.5:(e.dataset.boss==='1'?(e.offsetWidth||80)*.5:0);
                    ex=Math.max(24-centerOffset,Math.min(heroExitX()-20-centerOffset,ex+Math.sign(targetCenter-enemyVisualCenter)*dt*speed));
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
                    const isGhostEnemy=elevatorMode&&e.dataset.spriteType==='chapter3_enemy_1';
                    const cooldowns=tuneEnemyAI.attackCooldownMs||{assassin:1150,acolyte:1150,boss:950,default:1700};
                    const lastAtk=+(e.dataset.lastAttack||0),cool=isGhostEnemy?1450:((type==='assassin'||type==='acolyte')?(cooldowns[type]??1150):(type==='boss'?(cooldowns.boss??950):(cooldowns.default??1700)));
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
                            else {
                                const spriteType=e.dataset.spriteType||type;
                                es.src=enemySpritePath(spriteType,'attack');
                                if(spriteType==='chapter3_enemy_5') {
                                    // 大隻佬 EX 專用兩段式攻擊：attack → attack2 → idle。
                                    clearTimeout(e._attack2Timer);
                                    const expectedActionUntil=Number(e.dataset.actionUntil||0);
                                    e._attack2Timer=setTimeout(()=>{
                                        if(es.isConnected&&!e.classList.contains('dead')&&!e.classList.contains('hitflash')&&Number(e.dataset.actionUntil||0)===expectedActionUntil) {
                                            es.src=enemySpritePath('chapter3_enemy_5','attack2');
                                        }
                                    },180);
                                }
                            }
                            if(isGhostEnemy){
                                // 遠距離特殊技能：鬼魂播放同一張 attack，另外射出指定的藍青色圓球素材，採慢速高拋物線；不生成毒池。
                                const ghostCenter=(Number(e.dataset.x)||0)+(e.offsetWidth||90)*.5;
                                const currentHeroCenter=x+(hero.offsetWidth||70)*.5;
                                if(Math.abs(ghostCenter-currentHeroCenter)>Math.max(100,stageW*.065)) spawnGhostToxicOrb(e,t);
                                else if(jumpT===0){
                                    if(t<bashLockUntil)floatText('防禦！',x,34);
                                    else {const damage=Math.max(1,Math.ceil((tuneEnemyAI.incomingDamage?.assassin??tuneEnemyAI.incomingDamage?.default??2)/5));const previousHP=hp;hp=Math.max(0,hp-damage);floatText('−'+(previousHP-hp),x,28);updateHud();}
                                }
                            }
                            clearTimeout(e._spriteTimer);
                            e._spriteTimer=setTimeout(()=> {
                                if(es.isConnected&&!e.classList.contains('hitflash')){
                                    if(spiderHoldNormalPoseBeforeFinalHit2(e))spiderPose(e,'normal');
                                    else es.src=enemySpritePath(e.dataset.spriteType||type,'idle');
                                }
                            },tuneEffects.enemyAttackPoseMs??420)
                        }
                        if(!isGhostEnemy){
                            const incomingDamage=tuneEnemyAI.incomingDamage||{boss:8,heavy:5,assassin:4,acolyte:3,archer:3,default:2};
                            let dmg=incomingDamage[type]??incomingDamage.default??2;
                            if(jumpT===0) {
                                if(performance.now()<bashLockUntil){floatText('0',x,28);}
                                else {const previousHP=hp;hp=spiderClampFinalHP(previousHP,Math.max(0,hp-Math.ceil(dmg/5)));floatText('−'+(previousHP-hp),x,28);}
                            }
                        }
                    }
                }
            }
            if(elevatorMode){
                updateElevatorMode(dt,t);
            }else{
            const currentLevelConfig=levelConfigs[level-1]||{};
            // Boss 關的目標總數包含最後登場的 Boss，因此普通敵人數量要預留 1 名給 Boss。
            const regularEnemyTarget=Math.max(0,targets[level-1]-(currentLevelConfig.boss?1:0));
            const livingEnemyCount=enemyList.filter(e=>!e.classList.contains('dead')).length;
            if(!chapter3BossMode&&window.GAME_TEST_DIRECT_BOSS!==1 && levelKills<regularEnemyTarget&&livingEnemyCount<4) {
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
                } else if(chapter3BossMode&&spawnedBoss&&isChapter3Boss(spawnedBoss)) {
                    chapter3BossStartEncounter(spawnedBoss,performance.now());updateBossHealthBar(spawnedBoss);
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
            }
            if(hp<=0) {
                const spiderUltKilled=spiderBossSkill.killedHero;
                running=false;
                resetSpiderBossSkill();
                resetBossRush();
                if(chapter1FinalSkill.killedHero) {
                    showEnd('黑仁巨劍・末日降臨','黑仁騎士 的終極技能命中女神。巨劍插入貫穿女神，死亡判定已生效。','重新開始');
                } else if(spiderUltKilled) {
                    showEnd('毒能領域・降臨','5 秒蓄勢結束，毒能吞噬了女神。','重新開始');
                } else if(chapter3BossState.killedHeroByUltimate) {
                    showEnd('匠心觸手：特殊愛好者天堂','五秒蓄能完成，觸手海王的終極電擊擊敗了女神。','重新開始');
                } else {
                    showEnd('女神需要休息！','敵人太多了，重新出發再試一次。已收集的線索會在本次遊戲重開後重置。','重新開始');
                }
            }
            updateHud()
            // Final camera sync after combat/transition logic, so other per-frame updates cannot leave the view behind the hero.
            updateCamera();
        }
        if(running)requestAnimationFrame(loop)
    }
    // ===== 首頁與彈窗：結束畫面、設定、教學及排行榜 =====
    function showEnd(t,d,b) {
        clearSeaWeather();
        $('modalTitle').textContent=t;
        $('modalDesc').innerHTML=d;
        $('start').textContent=b;
        $('returnTitle').style.display='block';
        overlay.style.display='flex'
    }
    function showTitle() {
        running=false;
        paused=false;
        clearSeaWeather();
        if(!elevatorStandaloneTest){
            elevatorMode=false;chapter3BossMode=false;
            document.body.classList.remove('elevator-mode','chapter3-boss-mode');
            const bgView=$('elevatorBgViewport'),fg=$('elevatorForeground'),exit=$('elevatorExitBackdrop');
            if(bgView)bgView.hidden=true;if(fg)fg.hidden=true;if(exit)exit.hidden=true;
            stage.classList.remove('elevator-camera-shake','elevator-stop-impact');
        }
        resetBossRush();
        chapter3BossReset();
        keys= {
        };
        resetMovementPhysics();
        attackCd=0;
        bashLockUntil=0;
        attackMoveLockUntil=0;
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
            body.innerHTML='<div class="tutorial-controls"><div class="tutorial-control"><b>← / →</b><span>左右移動／控制面向</span></div><div class="tutorial-control"><b>↑</b><span>跳躍（可躲攻擊）</span></div><div class="tutorial-control"><b>Z</b><span>槍刺・Spear Thrust</span></div><div class="tutorial-control"><b>X</b><span>盾擊・Shield Bash</span></div><div class="tutorial-control"><b>C</b><span>特殊技能（消耗 30 能量）</span></div><div class="tutorial-control"><b>Ⅱ / ▶</b><span>暫停 / 繼續</span></div></div><p class="tutorial-note">目標：通過 14 關，收集最多 6 件王子線索。亦可使用畫面上的觸控按鈕。</p>'
        }
        else {
            heading.textContent='排行榜';
            body.innerHTML='<p>🏆 本機排行榜</p><p>完成十五關後，將抵達雷暴海港，完成第三章冒險。</p>'
        }
        $('titlePopup').hidden=false
    }
    // ===== 輸入控制：把鍵盤和畫面按鈕轉成遊戲動作 =====
    // 5 秒 finalCharge 倒數仍可操作；只有閃電發動、命中及死亡轉場才鎖定玩家。
    function chapter3BossPlayerLocked(){return document.body.classList.contains('chapter3-boss-mode')&&['finalTentacles','finalThunder','finalAttack','finalImpact','finalDead'].includes(chapter3BossState.phase);}
    function chapter3BossLockPlayerForUltimate(){
        keys.left=false;keys.right=false;moveV=0;jumpBufferMs=0;jumpV=0;jumpY=0;jumpT=0;onGround=true;
        hero.classList.remove('walking','jump');
        hero.style.setProperty('bottom',activeGroundBottom(),'important');
    }
    function action(a) {
        if(chapter3BossPlayerLocked()){keys.left=false;keys.right=false;return;}
        if(document.body.classList.contains('spider-apocalypse')){keys.left=false;keys.right=false;return;}
        if(a==='left'||a==='right') {
            if(ultimateActive||performance.now()<attackMoveLockUntil){keys.left=false;keys.right=false;return;}
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
        if(chapter3BossPlayerLocked()){keys.left=false;keys.right=false;if(['ArrowLeft','ArrowRight','ArrowUp',' ','z','x','q','Z','X','Q'].includes(e.key))e.preventDefault();return;}
        if(document.body.classList.contains('spider-apocalypse')){keys.left=false;keys.right=false;return;}
        if((ultimateActive||performance.now()<attackMoveLockUntil)&&['ArrowLeft','ArrowRight','ArrowUp'].includes(e.key)){keys.left=false;keys.right=false;e.preventDefault();return;}
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
            chapter3TentacleAudio.resume();
            overlay.style.display='none';
            $('pause').textContent='Ⅱ';
            $('returnTitle').style.display='none';
            last=performance.now();
            return
        }
        setup();
        $('returnTitle').style.display='none'
    });
    $('returnTitle').addEventListener('click',()=>{stopChapter3BossSfx();showTitle();});
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
            Object.values(chapter3BossSfxPools).forEach(pool=>pool.voices.forEach(voice=>{try{voice.audio.pause();}catch(error){}}));
            chapter3TentacleAudio.pause();
            // 暫停時立即停止閃電畫面及瞬間震動，避免停格在白閃畫面。
            seaWeatherState.pulses=[];seaWeatherState.shakeUntil=0;
            if(seaLightningFlash)seaLightningFlash.style.opacity='0';
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
            chapter3TentacleAudio.resume();
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
