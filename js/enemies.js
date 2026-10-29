/*
 * enemies.js — 敵人圖片管理
 * 根據敵人種類與動作回傳對應的圖片路徑。
 */
(() => {
    "use strict";

    function enemySpritePath(type, state) {
        // 第三章最終 Boss：素材為獨立 PNG 姿勢，不是 sprite sheet。
        if (type === "chapter3_boss_1") {
            if (state === "idle") state = "normal";
            if (state === "dead") state = "hit";
            if (state === "walk") state = "walk" + (1 + (Math.floor(performance.now() / 130) % 8));
            return "images/chapter3/enemies/chapter3_boss/chapter3_boss_1_" + state + ".png";
        }
        // Boss 召喚的可消滅觸手。第一張檔名保留原素材的 other_1png 拼法。
        if (type === "chapter3_boss_1_tentacle") {
            let n = 1;
            const match = String(state || "").match(/other_?(\d)/);
            if (match) n = Math.max(1, Math.min(4, Number(match[1])));
            const file = n === 1 ? "chapter3_boss_1_other_1png.png" : "chapter3_boss_1_other_" + n + ".png";
            return "images/chapter3/enemies/chapter3_boss/" + file;
        }
        // 第三章鬼魂：素材集中在 chapter3/enemies/chapter3_enemy_1。
        if (type === "chapter3_enemy_1") {
            // 第三章鬼魂以 normal 作正式待機圖、walk1–4 作行走、attack 作普通與特殊攻擊本體、hit 作受擊。
            // 使用者提供的 idle 圖是倒地姿勢，因此 idle 狀態映射到 normal，dead 狀態才映射到 idle。
            // 特殊技能圓球直接使用 chapter3_2_skin1_enemy_1_attack 原圖，不改色、不建立毒池。
            if (state === "walk") state = "walk" + (1 + (Math.floor(performance.now() / 130) % 4));
            if (state === "idle") state = "normal";
            if (state === "normal") state = "normal";
            if (state === "dead") state = "idle";
            if (state === "special") state = "attack";
            const file = "chapter3_enemy_1_" + state;
            return "images/chapter3/enemies/chapter3_enemy_1/" + file + ".png";
        }

        // 第三章新增敵人：每種敵人獨立使用自己的素材資料夾。
        if (/^chapter3_enemy_[2-8]$/.test(type)) {
            if (state === "walk") state = "walk" + (1 + (Math.floor(performance.now() / 130) % 4));
            // enemy_7 與 enemy_8 資料夾內的現有 PNG 檔名仍沿用 chapter3_enemy_6 前綴，
            // 這裡只修正路徑映射，不重命名或覆寫使用者素材。
            const filePrefix = (type === "chapter3_enemy_7" || type === "chapter3_enemy_8")
                ? "chapter3_enemy_6"
                : type;
            const pose = state === "dead" ? "idle" : (state === "idle" ? "normal" : state);
            return "images/chapter3/enemies/" + type + "/" + filePrefix + "_" + pose + ".png?v=20261028-foot-anchor-v5";
        }

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
            // Boss 素材放在 chapter1/boss；普通敵人則依編號放在 chapter1/enemies/1–5。
            const folder = type === "boss"
                ? "images/chapter1/boss/"
                : "images/chapter1/enemies/" + number + "/";
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
