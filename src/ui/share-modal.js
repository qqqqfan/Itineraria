/* 分享模态:把当前 trip 编码成 URL,复制给朋友
 *
 * v0.2+:默认走短链(CloudBase 云函数),失败时回退到 fragment 长链.
 * 入口:topbar 的 🔗 分享按钮 → openShareModal(state)
 */

import { buildShareUrl, buildSharePayload, SHARE } from "../share.js";
import { uploadSharePayload } from "../share-api.js";
import { toast } from "./toast.js";

let lastFocus = null;
let pendingGeneration = 0; // 多次开关模态时丢弃过期请求

export function initShareModal(state) {
  // 触发器:topbar "🔗 分享" 按钮
  document.querySelectorAll("[data-action='open-share']").forEach((btn) => {
    btn.addEventListener("click", () => openShareModal(state));
  });

  // 关闭:背景 / ✕ 按钮 / Esc
  document.querySelectorAll("[data-action='close-share']").forEach((el) => {
    el.addEventListener("click", () => closeShareModal());
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      e.preventDefault();
      closeShareModal();
    }
  });

  // 复制按钮
  const copyBtn = document.querySelector("[data-action='copy-share-url']");
  if (copyBtn) copyBtn.addEventListener("click", () => copyShareUrl());
}

function isOpen() {
  const modal = document.getElementById("share-modal");
  return modal && modal.classList.contains("is-open");
}

export async function openShareModal(state) {
  if (!state.activeTripId || !state.events.length) {
    toast.warn("还没有事件可分享,先在表单里加一条");
    return;
  }
  const modal = document.getElementById("share-modal");
  if (!modal) return;
  const input = document.getElementById("share-url-input");
  const meta = document.getElementById("share-modal-meta");

  // 立刻打开模态,先放 loading 文案,异步上传期间用户能看到状态
  lastFocus = document.activeElement;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  if (input) {
    input.value = "";
    input.placeholder = "正在生成短链…";
    input.disabled = true;
  }
  if (meta) {
    meta.innerHTML = `<span class="share-modal__loading">正在生成短链…</span>`;
  }

  const myGen = ++pendingGeneration;
  const payload = buildSharePayload(state);

  // 默认走短链;失败回退 fragment 长链
  try {
    const { url } = await uploadSharePayload(payload);
    if (myGen !== pendingGeneration) return; // 用户已关或重开,丢弃
    fillShortLink(modal, url);
  } catch (err) {
    if (myGen !== pendingGeneration) return;
    console.warn("短链生成失败,回退长链:", err);
    const fallback = buildShareUrl(state);
    fillLongLinkFallback(modal, fallback, err && err.message);
  }
}

function fillShortLink(modal, url) {
  const input = document.getElementById("share-url-input");
  const meta = document.getElementById("share-modal-meta");
  if (input) {
    input.value = url;
    input.disabled = false;
    input.placeholder = "";
  }
  if (meta) {
    meta.innerHTML = `<span class="share-modal__ok">短链已生成 · 适合贴在聊天软件</span>`;
  }
  if (input) {
    window.setTimeout(() => { input.focus(); input.select(); }, 50);
  }
}

function fillLongLinkFallback(modal, result, errMsg) {
  const input = document.getElementById("share-url-input");
  const meta = document.getElementById("share-modal-meta");
  if (input) {
    input.value = result.url;
    input.disabled = false;
    input.placeholder = "";
  }
  if (meta) {
    const kb = (result.urlBytes / 1024).toFixed(1);
    const reason = errMsg ? `(${errMsg})` : "";
    meta.innerHTML = `<span class="share-modal__warn">短链服务暂不可用 ${reason},已用本地长链兜底 · ${kb}KB</span>`;
  }
  if (input) {
    window.setTimeout(() => { input.focus(); input.select(); }, 50);
  }
}

export function closeShareModal() {
  const modal = document.getElementById("share-modal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  if (lastFocus && typeof lastFocus.focus === "function") {
    try { lastFocus.focus(); } catch (_) {}
  }
  lastFocus = null;
}

async function copyShareUrl() {
  const input = document.getElementById("share-url-input");
  if (!input || !input.value) return;
  const url = input.value;
  let ok = false;
  // 优先 Clipboard API,失败回退 execCommand
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      ok = true;
    }
  } catch (_) {
    ok = false;
  }
  if (!ok) {
    try {
      input.select();
      ok = document.execCommand && document.execCommand("copy");
    } catch (_) {
      ok = false;
    }
  }
  if (ok) {
    toast.success("链接已复制");
  } else {
    toast.warn("复制失败,请手动选中输入框复制");
    input.focus();
    input.select();
  }
}

// 暴露常量供外部使用(目前没人用,先留着)
export { SHARE };
