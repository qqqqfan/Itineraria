/* 启动入口（ES module） */

import { createState } from "./state.js";
import { loadPersistedState, loadSharedPayload, migrateV01IfNeeded } from "./storage.js";
import { setRenderers } from "./mutate.js";
import { initTopbar, renderAll, setMode, pingAutosaveHint } from "./ui/topbar.js";
import { initFormBindings, renderEventList, rerenderCard } from "./ui/event-list.js";
import { initLocationModal } from "./ui/location-modal.js";
import { initPreviewBindings, renderPreview } from "./ui/preview-map.js";
import { initLibrary, renderLibrary } from "./ui/library.js";
import { initShareModal } from "./ui/share-modal.js";
import { hasShareHash, parseShareHash } from "./share.js";
import { hasShareIdParam, getShareIdFromUrl, fetchSharePayload, clearShareIdParam } from "./share-api.js";
import { toast } from "./ui/toast.js";

(async function bootstrap() {
  try {
    // v0.1 → v1.0 一次性迁移；后续启动 self-heal 即可
    migrateV01IfNeeded();

    const state = createState();
    window.__studio = state;
    // 必须在 loadPersistedState / renderAll 之前注册：
    // 否则 mutate(..., { rerender: "list" }) 会静默 no-op。
    setRenderers({
      list: renderEventList,
      card: rerenderCard,
      preview: renderPreview,
      library: renderLibrary,
      autosaveHint: pingAutosaveHint,
    });

    // share-link 入口判定:
    //   v0.2+ 短链  -> ?s=<id>     (先查后端拿 payload)
    //   v0.2  长链  -> #t=<base64> (本地解码)
    // 优先短链:出现 ?s 直接走云端,失败回退普通启动并 toast.
    const shareId = hasShareIdParam() ? getShareIdFromUrl() : null;
    const sharedResult = !shareId && hasShareHash() ? parseShareHash(window.location.hash) : null;

    loadPersistedState(state); // 索引依旧装进 tripIndex
    initTopbar(state);
    initFormBindings(state);
    initLocationModal(state);
    initPreviewBindings(state);
    initLibrary(state);
    initShareModal(state);

    // shared 模式渲染完后给 Leaflet 一系列时间让容器 settle,避免 0×0 → 灰瓦片
    const kickSharedMap = () => {
      const tick = () => {
        if (state.preview && state.preview.map) {
          state.preview.map.invalidateSize();
          import("./ui/preview-map.js").then((m) => m.refreshPreviewPoints(state, { fitView: true }));
        }
      };
      window.requestAnimationFrame(() => {
        window.setTimeout(tick, 0);
        window.setTimeout(tick, 200);
        window.setTimeout(tick, 600);
      });
    };

    // 进入 shared 模式的统一动作
    const enterShared = (payload) => {
      state.activeTripId = null;
      loadSharedPayload(state, payload);
      setMode(state, "shared");
      kickSharedMap();
    };

    // 短链分支:异步抓 payload
    if (shareId) {
      try {
        const payload = await fetchSharePayload(shareId);
        enterShared(payload);
      } catch (err) {
        console.warn("[tripstudio] short-link fetch failed:", err);
        toast.error("分享链接无法加载:" + (err && err.message ? err.message : "未知错误"));
        clearShareIdParam();
        if (!state.activeTripId) setMode(state, "library");
        else setMode(state, "form");
      }
    } else if (sharedResult && sharedResult.ok) {
      enterShared(sharedResult.payload);
    } else if (sharedResult && !sharedResult.ok) {
      // 损坏长链:回退到普通启动逻辑 + 友好提示
      console.warn("[tripstudio] share hash invalid:", sharedResult.reason);
      toast.error("分享链接无法识别,可能已损坏或来自不同版本");
      // 把损坏的 hash 清掉,免得刷新继续触发
      window.history.replaceState(null, "",
        window.location.origin + window.location.pathname + window.location.search);
      if (!state.activeTripId) setMode(state, "library");
      else setMode(state, "form");
    } else {
      // 普通启动:空仓库 → library；否则 → form
      if (!state.activeTripId) setMode(state, "library");
      else setMode(state, "form");
    }
    renderAll(state);
    // 反 FOUC:bootstrap 装好了,可以让 main 显出来
    document.documentElement.removeAttribute("data-booting");
    document.documentElement.removeAttribute("data-shared-boot");
    console.info(
      "[tripstudio] bootstrap OK, mode:",
      state.activeMode,
      "trips:",
      state.tripIndex.length,
      "active:",
      state.activeTripId,
      "events:",
      state.events.length
    );
  } catch (err) {
    document.documentElement.removeAttribute("data-booting");
    document.documentElement.removeAttribute("data-shared-boot");
    console.error("[tripstudio] bootstrap failed:", err);
    const banner = document.createElement("div");
    banner.style.cssText =
      "position:fixed;left:0;right:0;top:0;z-index:9999;background:#8d3737;color:#fff;padding:10px 14px;font:13px/1.4 system-ui;";
    banner.textContent = "启动失败:" + (err && err.message ? err.message : err) + "(按 F12 看详情)";
    document.body.appendChild(banner);
  }
})();
