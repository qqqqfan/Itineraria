/* 数据变更集中点
 *
 * 所有"改 state + persist + render"都应该走这里。这样：
 *  - persist 不会被遗忘
 *  - 渲染粒度可控（card / list / preview / all / none）
 *  - 未来要加 undo / 变更日志，只需改这一处
 *
 * 不依赖 ui/*，避免循环依赖。ui/* 通过 setRenderers 注入渲染回调。
 */

import { schedulePersist } from "./storage.js";

let renderers = {
  card: null,         // (state, eventId) => void
  list: null,         // (state) => void
  preview: null,      // (state) => void
  autosaveHint: null, // () => void  —— 顶栏 transient 自动保存反馈
};

export function setRenderers(r) {
  renderers = { ...renderers, ...r };
}

/**
 * @param {object} state
 * @param {(state) => void} fn 实际的 state 修改逻辑
 * @param {object} [opts]
 * @param {boolean} [opts.persist=true] 是否走 schedulePersist
 * @param {'card'|'list'|'preview'|'all'|'none'} [opts.rerender='none']
 * @param {string} [opts.cardId] 当 rerender==='card' 时必填
 */
export function mutate(state, fn, opts = {}) {
  fn(state);

  if (opts.persist !== false) {
    schedulePersist(state);
    if (renderers.autosaveHint) renderers.autosaveHint();
  }

  switch (opts.rerender) {
    case "card":
      if (renderers.card && opts.cardId) renderers.card(state, opts.cardId);
      break;
    case "list":
      if (renderers.list) renderers.list(state);
      break;
    case "preview":
      if (renderers.preview) renderers.preview(state);
      break;
    case "all":
      if (renderers.list) renderers.list(state);
      if (renderers.preview) renderers.preview(state);
      break;
    case "none":
    case undefined:
      break;
  }
}
