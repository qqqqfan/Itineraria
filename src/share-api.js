/* v0.2+ 短链：腾讯云 CloudBase 云函数后端
 *
 * 后端契约（云函数 share-api，HTTP 路径 /share）：
 *   POST /share        body: { payload: <trip-payload> }     → { id: "xxxxxxxx" }
 *   GET  /share/:id                                          → { payload: <trip-payload> }
 *
 * 这一层只管"网络请求 + 错误归一化"，不知道 trip 数据长啥样。
 */

// CloudBase HTTP 访问服务的默认域名 + 路由
// 以后换域名（自定义域名/换环境）改这一行即可
const SHARE_API_BASE =
  "https://tripstudio-d8g4493cjc152b482-1437904407.ap-shanghai.app.tcloudbase.com/share";

const REQUEST_TIMEOUT_MS = 12000;

/* fetch + AbortController 超时封装；网络错和服务端错都抛 Error，调用方统一 try/catch */
async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { ...opts, signal: ctrl.signal });
    return resp;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * 把 payload 上传到云端,拿短 ID 拼 URL.
 * @param {object} payload  { v, trip, events, previewView }
 * @returns {Promise<{ id: string, url: string }>}
 * @throws {Error} 网络错 / 服务端 4xx 5xx / payload 太大
 */
export async function uploadSharePayload(payload) {
  let resp;
  try {
    resp = await fetchWithTimeout(SHARE_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("生成超时,请检查网络后重试");
    throw new Error("网络异常,无法连接分享服务");
  }
  if (!resp.ok) {
    if (resp.status === 413) throw new Error("Trip 数据过大,无法用短链分享");
    throw new Error(`分享服务返回错误 (${resp.status})`);
  }
  let body;
  try {
    body = await resp.json();
  } catch (_) {
    throw new Error("分享服务返回了非法响应");
  }
  if (!body || !body.id) throw new Error("分享服务未返回 ID");
  // 当前页面拼出可分享 URL
  const base = window.location.origin + window.location.pathname;
  const url = `${base}?s=${encodeURIComponent(body.id)}`;
  return { id: body.id, url };
}

/**
 * 按 ID 取 payload.
 * @param {string} id
 * @returns {Promise<object>} payload
 * @throws {Error} 找不到 / 已过期 / 网络错
 */
export async function fetchSharePayload(id) {
  if (!id || typeof id !== "string") throw new Error("无效的分享 ID");
  let resp;
  try {
    resp = await fetchWithTimeout(`${SHARE_API_BASE}/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err.name === "AbortError") throw new Error("加载超时,请重试");
    throw new Error("网络异常,无法连接分享服务");
  }
  if (resp.status === 404) throw new Error("分享链接不存在或已被清理");
  if (resp.status === 410) throw new Error("分享链接已过期 (90 天)");
  if (!resp.ok) throw new Error(`分享服务返回错误 (${resp.status})`);
  let body;
  try {
    body = await resp.json();
  } catch (_) {
    throw new Error("分享服务返回了非法响应");
  }
  if (!body || !body.payload) throw new Error("分享服务未返回内容");
  return body.payload;
}

/* ---------- URL 形态判断 ---------- */

/** 当前 URL 是不是短链形态 (?s=xxx)? */
export function hasShareIdParam() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("s");
  return !!(id && /^[a-z0-9]{4,16}$/i.test(id));
}

/** 从 URL query 里取出 share id;失败返回 null */
export function getShareIdFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("s");
  if (!id || !/^[a-z0-9]{4,16}$/i.test(id)) return null;
  return id;
}

/** 清掉 ?s=... query;保留其他 query 参数 */
export function clearShareIdParam() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  params.delete("s");
  const search = params.toString();
  const url =
    window.location.origin +
    window.location.pathname +
    (search ? "?" + search : "") +
    window.location.hash;
  window.history.replaceState(null, "", url);
}
