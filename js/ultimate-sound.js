/*
 * ultimate-sound.js — 女主角 Q 大絕音效管理
 * startCharge(): 開始蓄力時播放循環火焰聲
 * playBlast(): 大絕爆發時播放一次金焰爆發聲
 * stopAll(): 停止音效（重開遊戲或返回首頁時使用）
 */
(()=> {
  const chargeAudio = new Audio('audio/holy_flame_charge.wav');
  chargeAudio.loop = true;
  chargeAudio.volume = 0.42;

  const blastAudio = new Audio('audio/holy_flame_blast.wav');
  blastAudio.volume = 0.82;

  function safePlay(audio) {
    try {
      const result = audio.play();
      if (result && result.catch) result.catch(() => {});
    } catch (error) {
      // 音效播放失敗不應阻止遊戲繼續運作。
    }
  }

  function stopCharge() {
    chargeAudio.pause();
    chargeAudio.currentTime = 0;
  }

  window.createUltimateSound = function() {
    return {
      startCharge() {
        stopCharge();
        safePlay(chargeAudio);
      },
      stopCharge,
      playBlast() {
        blastAudio.pause();
        blastAudio.currentTime = 0;
        safePlay(blastAudio);
      },
      stopAll() {
        stopCharge();
        blastAudio.pause();
        blastAudio.currentTime = 0;
      }
    };
  };
})();
