/*
 * enemies.js — 敵人圖片管理
 * 根據敵人種類與動作回傳對應的圖片路徑。
 */
(() => {
    "use strict";

    function enemySpritePath(type, state) {
        // 第二章：normal=待機、hit=受擊、attack=攻擊、idle=死亡。
        // 所有 Chapter 2 敵人都放在自己的子資料夾內；蜘蛛 Boss 2 另有 runway1–runway4 離場影格，普通行走為 walk1–walk4，
        // 隱藏 Boss 1 有 walk1–walk8。game.js 會傳入具體影格名稱。
        if (/^chapter2_(enemy_[1-7]|boss_[12])$/.test(type)) {
            // 若其他呼叫端只傳入 "walk"，依這個角色可用的格數自動選擇當前影格。
            if (state === "walk") {
                const frameCount = type === "chapter2_boss_1" ? 8 : 4;
                state = "walk" + (1 + (Math.floor(performance.now() / 130) % frameCount));
            }
            const pose = state === "dead" ? "idle" : (state === "idle" ? "normal" : state);
            return "images/chapter2/enemies/" + type + "/" + type + "_" + pose + ".png";
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
