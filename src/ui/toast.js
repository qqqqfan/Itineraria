/* 轻量 Toast：错误/警告/成功统一出口
 *
 * 设计原则：
 *   - 全局单一容器（懒创建），多条 toast 纵向堆叠；
 *   - 默认 4s 自动消失；error 默认 6s；可手动关 ×；
 *   - 不依赖 state，纯 DOM —— 任何模块直接 import 即用。
 */

const DEFAULT_DURATION = { info: 4000, success: 4000, warn: 5000, error: 6000 };

function ensureContainer() {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  return host;
}

export function showToast(message, opts = {}) {
  if (!message) return;
  const level = opts.level || "info";
  const duration = opts.duration != null ? opts.duration : DEFAULT_DURATION[level] || 4000;
  const host = ensureContainer();

  const t = document.createElement("div");
  t.className = `toast toast--${level}`;
  const text = document.createElement("span");
  text.className = "toast__text";
  text.textContent = String(message);
  t.appendChild(text);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast__close";
  close.setAttribute("aria-label", "关闭");
  close.innerHTML = "✕";
  close.addEventListener("click", () => dismiss());
  t.appendChild(close);

  host.appendChild(t);

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    t.classList.add("toast--leaving");
    window.setTimeout(() => {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 260);
  }
  if (duration > 0) {
    window.setTimeout(dismiss, duration);
  }
  return dismiss;
}

export const toast = {
  info: (m, o) => showToast(m, { ...o, level: "info" }),
  success: (m, o) => showToast(m, { ...o, level: "success" }),
  warn: (m, o) => showToast(m, { ...o, level: "warn" }),
  error: (m, o) => showToast(m, { ...o, level: "error" }),
};
