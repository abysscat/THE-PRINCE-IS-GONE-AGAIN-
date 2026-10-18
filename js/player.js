/*
 * 角色顯示工具（第三階段安全分拆）
 *
 * 本階段只搬出「切換角色圖片」及「設定大絕動畫影格外觀」兩個工具，
 * 不搬動移動、跳躍、攻擊、受傷或遊戲迴圈，降低影響原有玩法的風險。
 *
 * game.js 啟動時會把需要的元素與設定傳入這個工廠函式，
 * 再取得 setHeroSprite / setUltimateFrame 兩個工具繼續使用。
 */
window.createPlayerVisuals = function ({ getElement, hero, gameSettings, getStageHeight }) {
  const ultimateSpriteFiles = gameSettings.ultimateSpriteFiles;

  // 切換角色圖片；如果圖片已經相同，就不重複設定。
  function setHeroSprite(path) {
    const sprite = getElement('heroSprite');
    if (sprite && sprite.getAttribute('src') !== path) {
      sprite.src = path;
    }
  }

  // 顯示大絕指定影格，並調整每張圖的大小及垂直位置。
  function setUltimateFrame(index) {
    const sprite = getElement('heroSprite');
    const frame = Math.max(0, Math.min(7, index));
    if (!sprite) return;

    setHeroSprite(ultimateSpriteFiles[frame]);

    // 圖片透明邊界不同，所以每張影格有獨立顯示倍率。
    const frameScales = gameSettings.ultimateFrameScales;
    hero.style.setProperty('--ultimate-scale', String(frameScales[frame]));

    // 蓄力動畫時角色升起，後段再逐漸落下。
    const liftProgress = frame <= 4 ? frame / 4 : ((7 - frame) / 3);
    const stageHeight = getStageHeight();
    const lift = Math.max(0, stageHeight * 0.24 * liftProgress);
    hero.style.setProperty('--ultimate-lift', lift + 'px');
  }

  return { setHeroSprite, setUltimateFrame };
};
