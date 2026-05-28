/* v0.2 点对点分享：trip → URL fragment → trip
 *
 * 形态：编辑器 → 一次性 URL → 查看器，全 client-side。
 *   - URL fragment（#t=...）浏览器不发到服务器，天然隐私；
 *   - LZString.compressToEncodedURIComponent 走的是 base64-url 安全字符；
 *   - 不依赖 state 持久化路径，纯纯函数 + dom 助手。
 *
 * Payload schema：
 *   { v: 2, trip: {title}, events: [...], previewView: {...} }
 *   v 跟当前 storage SCHEMA_VERSION 对齐；解码时版本不匹配尽力渲染但 toast 提示。
 */

const HASH_PREFIX = "#t=";
const PAYLOAD_VERSION = 2;
const URL_SOFT_LIMIT = 4096; // 4KB —— 超过给 warning，但不阻断

/* ---------- LZString shim：CDN 没起来时也能 fail loud ---------- */

function lz() {
  if (typeof window !== "undefined" && window.LZString) return window.LZString;
  throw new Error("LZString 未加载（检查 CDN 或 vendor）");
}

/* ---------- encode ---------- */

/**
 * 把当前 state 序列化成可分享的 payload 对象（不含序列化形态）.
 * 短链 / 长链都从这里开始.
 */
export function buildSharePayload(state) {
  return {
    v: PAYLOAD_VERSION,
    trip: { title: state.trip.title || "" },
    events: state.events,
    previewView: state.previewView || { tab: "map", sub: "day", hideEdgeTransport: false },
  };
}

/**
 * 把当前 trip 序列化成可贴的完整 URL（hash fragment 形态,纯前端,无后端依赖）.
 * @param {object} state
 * @returns {{ url: string, hash: string, payloadBytes: number, urlBytes: number, oversized: boolean }}
 */
export function buildShareUrl(state) {
  const payload = buildSharePayload(state);
  const json = JSON.stringify(payload);
  const encoded = lz().compressToEncodedURIComponent(json);
  const hash = HASH_PREFIX + encoded;
  // 完整 URL = 当前 origin+pathname（去掉旧 hash / search）+ 新 hash
  const base = window.location.origin + window.location.pathname;
  const url = base + hash;
  return {
    url,
    hash,
    payloadBytes: new Blob([json]).size,
    urlBytes: new Blob([url]).size,
    oversized: url.length > URL_SOFT_LIMIT,
  };
}

/* ---------- decode ---------- */

/**
 * 解析 location.hash 里的 share payload。
 * @param {string} hash 形如 "#t=xxx"
 * @returns {{ ok: true, payload: object } | { ok: false, reason: string }}
 */
export function parseShareHash(hash) {
  if (!hash || typeof hash !== "string") {
    return { ok: false, reason: "no hash" };
  }
  if (!hash.startsWith(HASH_PREFIX)) {
    return { ok: false, reason: "wrong prefix" };
  }
  const encoded = hash.slice(HASH_PREFIX.length);
  if (!encoded) return { ok: false, reason: "empty payload" };
  let json;
  try {
    json = lz().decompressFromEncodedURIComponent(encoded);
  } catch (err) {
    return { ok: false, reason: "decompress failed: " + (err && err.message || err) };
  }
  if (!json) return { ok: false, reason: "decompress empty" };
  let payload;
  try {
    payload = JSON.parse(json);
  } catch (err) {
    return { ok: false, reason: "json parse: " + (err && err.message || err) };
  }
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "payload not object" };
  }
  if (!Array.isArray(payload.events)) {
    return { ok: false, reason: "no events array" };
  }
  return { ok: true, payload };
}

/**
 * 当前页面是不是 share-link 进入的？
 * 用在 bootstrap 头部判断走 shared 还是常规路径。
 */
export function hasShareHash() {
  return typeof window !== "undefined" &&
    window.location.hash &&
    window.location.hash.startsWith(HASH_PREFIX);
}

/**
 * 清掉地址栏里的 #t=...，但不刷新页面 / 不留历史。
 * 用于「复制到我的 Trip」之后:让 URL 回归普通形态。
 */
export function clearShareHash() {
  if (typeof window === "undefined") return;
  const url = window.location.origin + window.location.pathname + window.location.search;
  window.history.replaceState(null, "", url);
}

export const SHARE = {
  HASH_PREFIX,
  PAYLOAD_VERSION,
  URL_SOFT_LIMIT,
};
