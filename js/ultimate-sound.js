/* Configurable ultimate ability audio; defaults preserve the original charge and blast sounds. */
(()=> {
  const audioRuntime=window.PrinceAudioRuntime||null;
  const create=(key,fallback,volume,loop=false)=>{
    const path=audioRuntime?.getSfxPath?.(key,fallback)||fallback;
    const audio=new Audio(path);audio.loop=loop;audio.preload='auto';
    audio.volume=audioRuntime?.getSfxVolume?.(volume)??volume;return audio;
  };
  const chargeAudio=create('ultimateCharge','audio/holy_flame_charge.ogg',0.22,true);
  const blastAudio=create('ultimateBlast','audio/holy_flame_blast.ogg',0.40,false);
  function safePlay(audio){if(audioRuntime?.getConfig?.().settings?.sfxEnabled===false)return;try{const result=audio.play();if(result&&result.catch)result.catch(()=>{});}catch(error){}}
  function stopCharge(){try{chargeAudio.pause();chargeAudio.currentTime=0;}catch(error){}}
  window.createUltimateSound=function(){return {
    startCharge(){stopCharge();safePlay(chargeAudio);},stopCharge,
    playBlast(){try{blastAudio.pause();blastAudio.currentTime=0;}catch(error){}safePlay(blastAudio);},
    stopAll(){stopCharge();try{blastAudio.pause();blastAudio.currentTime=0;}catch(error){}}
  };};
})();
