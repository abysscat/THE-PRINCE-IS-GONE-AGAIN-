/*
 * enemies.js — 敵人圖片管理
 * 根據敵人種類與動作回傳對應的圖片路徑。
 */
(() => {
    "use strict";

    function enemySpritePath(type, state) {
        // 第二章：normal=待機、hit=受擊、attack=攻擊、idle=死亡。
        if (/^chapter2_(enemy_[1-7]|boss_[12])$/.test(type)) {
            if (type === "chapter2_boss_1") {
                // 隱藏 Boss 的圖片放在專屬子資料夾，並有 walk1–walk8 八格行走動畫。
                const pose = state === "dead" ? "idle"
                    : (state === "idle" || state === "walk" ? "normal" : state);
                return "images/chapter2/enemies/chapter2_boss_1/chapter2_boss_1_" + pose + ".png";
            }
            // 其他第二章敵人目前沒有行走影格，移動時沿用 normal，避免破圖。
            const safeState = state === "walk" || /^walk[1-8]$/.test(state) ? "normal" : state;
            const pose = safeState === "dead" ? "idle" : (safeState === "idle" ? "normal" : safeState);
            return "images/chapter2/enemies/" + type + "_" + pose + ".png";
        }

        // 第一章：attack=攻擊、hit=受擊、idle=死亡、normal=待機。
        const chapter1Folders = {
            assassin: ["enemy", "1"],
            shield: ["enemy", "2"],
            heavy: ["enemy", "2"],
            acolyte: ["enemy", "3"],
            archer: ["enemy", "4"],
            skeleton: ["enemy", "5"],
            boss: ["boss", "1"]
        };
        const info = chapter1Folders[type];
        if (info) {
            const kind = info[0];
            const number = info[1];
            const folder = "images/enemies/custom/" + (type === "boss" ? "boss" : number) + "/";
            // 第一章各敵人均有 walk1–walk4；game.js 傳入具體影格名稱。
            // 若其他呼叫端傳入 walk，這裡仍可自動循環，避免回退到不存在的 walk.png。
            if (state === "walk") state = "walk" + (1 + (Math.floor(performance.now() / 130) % 4));
            const pose = state === "dead" ? "idle" : (state === "idle" ? "normal" : state);
            return folder + "chapter1_" + kind + "_" + number + "_" + pose + ".png";
        }

        // 其他未指定自訂素材的敵人沿用原有路徑。
        return "images/enemies/enemy_" + state + ".png";
    }

    window.EnemyVisuals = { enemySpritePath };
})();
