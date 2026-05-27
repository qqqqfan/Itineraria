/* 启动入口（ES module） */

import { createState } from "./state.js";
import { loadPersistedState } from "./storage.js";
import { setRenderers } from "./mutate.js";
import { initTopbar, renderAll } from "./ui/topbar.js";
import { initFormBindings, renderEventList, rerenderCard } from "./ui/event-list.js";
import { initLocationModal } from "./ui/location-modal.js";
import { initPreviewBindings, renderPreview } from "./ui/preview-map.js";

(function bootstrap() {
  try {
    const state = createState();
    window.__studio = state;
    // 必须在 loadPersistedState / renderAll 之前注册：
    // 否则 mutate(..., { rerender: "list" }) 会静默 no-op。
    setRenderers({
      list: renderEventList,
      card: rerenderCard,
      preview: renderPreview,
    });
    loadPersistedState(state);
    initTopbar(state);
    initFormBindings(state);
    initLocationModal(state);
    initPreviewBindings(state);
    renderAll(state);
    console.info("[tripstudio] bootstrap OK, events:", state.events.length);
  } catch (err) {
    console.error("[tripstudio] bootstrap failed:", err);
    const banner = document.createElement("div");
    banner.style.cssText =
      "position:fixed;left:0;right:0;top:0;z-index:9999;background:#8d3737;color:#fff;padding:10px 14px;font:13px/1.4 system-ui;";
    banner.textContent = "启动失败：" + (err && err.message ? err.message : err) + "（按 F12 看详情）";
    document.body.appendChild(banner);
  }
})();
