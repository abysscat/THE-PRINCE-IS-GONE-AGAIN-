/*
 * enemies.js — 敵人圖片管理
 *
 * 這個檔案只負責一件事：
 * 根據敵人的種類（type）和動作（state），找出應該顯示哪張圖片。
 *
 * 例子：
 * EnemyVisuals.enemySpritePath("skeleton", "idle")
 * 會回傳骷髏兵待機時要使用的圖片路徑。
 *
 * 注意：這裡只決定圖片路徑，不負責建立敵人、移動、攻擊或扣血。
 */
(() => {
    "use strict";

    function enemySpritePath(type, state) {
        // 骷髏兵使用自訂圖片資料夾。保留原本 idle 對應的檔名。
        if (type === "skeleton") {
            const folder = "images/enemies/custom/5/";
            const pose = state === "idle" ? "nornal" : state;
            return folder + "enemy_" + pose + ".png";
        }

        // 皇家旗手（archer）。
        if (type === "archer") {
            const folder = "images/enemies/custom/4/";
            return folder + "enemy_" + (state === "idle" ? "idle" : state) + ".png";
        }

        // 關卡頭目（boss）。
        if (type === "boss") {
            const folder = "images/enemies/custom/boss/";
            return folder + "enemy_" + (state === "idle" ? "idle" : state) + ".png";
        }

        // 其他敵人按種類分配到不同圖片資料夾。
        const group =
            type === "assassin" ? "1" :
            (type === "shield" || type === "heavy") ? "2" :
            type === "acolyte" ? "3" :
            null;

        // 沒有自訂資料夾的種類，使用一般敵人圖片。
        if (!group) {
            return "images/enemies/enemy_" + state + ".png";
        }

        const folder = "images/enemies/custom/" + group + "/";

        if (group === "1") {
            return folder + "enemy_" + state + ".png";
        }

        // 盾牌兵和重裝騎士的待機圖沿用攻擊圖片。
        if (group === "2") {
            if (state === "idle") {
                return folder + "enemy_attack.png";
            }
            return folder + "enemy_" + state + ".png";
        }

        // 灰袍祭司的待機圖沿用受擊圖片。
        if (group === "3") {
            if (state === "idle") {
                return folder + "enemy_hit.png";
            }
            return folder + "enemy_" + state + ".png";
        }

        // 保底路徑：若遇到未識別類型，使用一般敵人圖片。
        return "images/enemies/enemy_" + state + ".png";
    }

    // 把函式公開給 game.js 使用。
    window.EnemyVisuals = {
        enemySpritePath
    };
})();
