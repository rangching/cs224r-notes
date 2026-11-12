// ==UserScript==
// @name         CS224R 校正雙語字幕
// @namespace    cs224r-notes
// @version      1.0
// @description  在 YouTube 觀看 Stanford CS224R 原片時，疊上校正過的英文字幕與繁中字幕（取代錯誤較多的自動字幕）
// @match        https://www.youtube.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      127.0.0.1
// @connect      localhost
// @connect      github.io
// @downloadURL  https://rangching.github.io/cs224r-notes/cs224r-subs.user.js
// @run-at       document-idle
// ==/UserScript==

/*
 * 用法
 * 1. 在瀏覽器裝 Tampermonkey 或 Violentmonkey，新增腳本，貼上本檔內容。
 * 2. 字幕資料預設讀 GitHub Pages：https://rangching.github.io/cs224r-notes/data/
 *    離線時可在擴充功能選單按「設定字幕資料網址」改成本機 http://127.0.0.1:8765/data/（在 website/site 執行 python3 -m http.server 8765）。
 * 3. 打開任一堂 CS224R 原片，影片下方會出現字幕列；右上角的小按鈕切換 雙語／英／中／關。
 *    建議同時關掉 YouTube 自己的 CC（按 C）。
 */
(function () {
  "use strict";
  // 原片 ID → 網頁的堂次 key（字幕檔是 data/<key>.json）
  const VIDEOS = {
    "EvHRQhMX7_w": "l01", "WxRDyObrm_M": "l02", "KCAOXd4IO9o": "l03", "oejFZShW9hU": "l04",
    "cRGKc-nAWho": "l05", "-7kv6jf0isQ": "l06", "lRDaXnPIzks": "l07", "PDIxDhA9Z6Y": "l08",
    "XKLGuwvSKvI": "l09", "O2VpNnwB4lM": "l10", "PvqyGnOirgA": "l11", "qNdsI_4AQJw": "l12",
    "wSiyEpvoGkA": "l13", "4tlSKdi8teU": "l14", "iKWYLSVAtfM": "l15", "rbaWQQLrzl0": "l16",
    "Hp1WBWghrak": "l17", "07MQNMcxhZU": "tq", "FacJ_1tTSx4": "l18",
  };
  const DEFAULT_BASE = "https://rangching.github.io/cs224r-notes/data/";
  const base = () => GM_getValue("base", DEFAULT_BASE);
  GM_registerMenuCommand("設定字幕資料網址", () => {
    const v = prompt("字幕資料夾網址（結尾要有 /，裡面有 l01.json…）", base());
    if (v) { GM_setValue("base", v.trim()); location.reload(); }
  });
  const MODES = ["both", "en", "zh", "off"], LABEL = { both: "雙語", en: "英", zh: "中", off: "關" };
  let mode = GM_getValue("mode", "both"), cues = [], key = null, box = null, btn = null, video = null, last = -1;

  function fetchJson(url) {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: "GET", url, onload: (r) => (r.status === 200 ? resolve(JSON.parse(r.responseText)) : reject(r.status)), onerror: reject,
    }));
  }
  function ensureUi() {
    const player = document.querySelector("#movie_player");
    if (!player) return false;
    if (!box || !player.contains(box)) {
      box = document.createElement("div");
      Object.assign(box.style, {
        position: "absolute", left: "50%", bottom: "64px", transform: "translateX(-50%)", zIndex: 60, maxWidth: "88%",
        textAlign: "center", pointerEvents: "none", fontFamily: "'Noto Sans TC','PingFang TC',sans-serif",
      });
      btn = document.createElement("button");
      Object.assign(btn.style, {
        position: "absolute", right: "12px", top: "12px", zIndex: 61, padding: "4px 10px", borderRadius: "6px",
        border: "1px solid rgba(255,255,255,.5)", background: "rgba(0,0,0,.6)", color: "#C49BFF", font: "13px sans-serif", cursor: "pointer",
      });
      btn.title = "CS224R 校正字幕：切換顯示";
      btn.addEventListener("click", (e) => { e.stopPropagation(); mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]; GM_setValue("mode", mode); paint(true); });
      player.append(box, btn);
    }
    return true;
  }
  function line(text, size, color) {
    const d = document.createElement("div");
    d.textContent = text;
    Object.assign(d.style, { display: "inline-block", margin: "2px 0", padding: "2px 10px", background: "rgba(0,0,0,.72)", color, fontSize: size, lineHeight: 1.45, borderRadius: "4px" });
    const wrap = document.createElement("div"); wrap.append(d); return wrap;
  }
  function paint(force) {
    if (!box || !video) return;
    btn.textContent = `6.S184 字幕：${LABEL[mode]}`;
    const t = video.currentTime;
    const i = cues.findIndex((c) => t >= c[0] && t < c[1]);
    if (i === last && !force) return;
    last = i;
    box.replaceChildren();
    if (i < 0 || mode === "off") return;
    const big = Math.max(16, Math.round(video.clientWidth / 42)) + "px", small = Math.max(14, Math.round(video.clientWidth / 52)) + "px";
    if (mode !== "zh") box.append(line(cues[i][3], big, "#ffffff"));
    if (mode !== "en") box.append(line(cues[i][2], small, "#C49BFF"));
  }
  async function check() {
    const id = new URLSearchParams(location.search).get("v");
    const k = location.pathname === "/watch" ? VIDEOS[id] : null;
    if (k === key) return;
    key = k; cues = []; last = -1;
    if (box) box.replaceChildren();
    if (btn) btn.style.display = k ? "" : "none";
    if (!k) return;
    try {
      const data = await fetchJson(base() + k + ".json");
      if (key !== k) return;
      cues = data.cues;
      for (let n = 0; n < 50 && !ensureUi(); n++) await new Promise((r) => setTimeout(r, 200));
      btn.style.display = "";
      video = document.querySelector("#movie_player video");
      if (video && !video._s184) { video._s184 = true; video.addEventListener("timeupdate", () => paint(false)); video.addEventListener("seeked", () => paint(true)); }
      paint(true);
    } catch (e) {
      console.warn("[6.S184 字幕] 讀不到字幕資料：", base() + k + ".json", e);
    }
  }
  window.addEventListener("yt-navigate-finish", check);
  check();
})();
