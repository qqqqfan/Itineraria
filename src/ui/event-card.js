/* 单张事件卡渲染（折叠/展开 + 表单字段）
 *
 * 渲染策略（与 mutate 配合）：
 *   - 名称输入：state 改但不触发任何 rerender —— input 的 value 已是 DOM
 *     里的真相，rerender 反而会打断 IME composing。
 *   - tag 增删 / 交通方式 / 锚点变化 / 折叠展开：rerenderCard，单卡刷新
 *   - 类型切换 / 删除 / 日期变化（影响排序）：renderEventList 全量
 */

import {
  EVENT_TYPES,
  TRANSPORT_MODES,
  emptyAnchor,
  isEventComplete,
  displayDefaultName,
  buildTransportSubtitle,
  statusEmoji,
} from "../events.js";
import { mutate } from "../mutate.js";
import { escapeHtml, makeField } from "../utils/dom.js";
import { ymd, formatDateRange } from "../utils/date.js";
import { computeAutoTags } from "./auto-tags.js";
import { openLocationModal } from "./location-modal.js";
import { renderEventList, rerenderCard } from "./event-list.js";

export function renderEventCard(state, evt) {
  const card = document.createElement("article");
  card.className = "event-card";
  card.dataset.eventId = evt.id;

  const expanded = isCardExpanded(state, evt);
  if (!expanded) card.classList.add("event-card--collapsed");

  card.appendChild(renderCardHeader(state, evt, expanded));
  if (expanded) {
    card.appendChild(renderCardBody(state, evt));
  }
  return card;
}

function isCardExpanded(state, evt) {
  return state.ui.expandedIds.has(evt.id);
}

function tryCollapseCard(state, evt) {
  if (!isEventComplete(evt)) return false;
  mutate(
    state,
    (s) => s.ui.expandedIds.delete(evt.id),
    { persist: false, rerender: "card", cardId: evt.id }
  );
  return true;
}

function expandCard(state, evt) {
  mutate(
    state,
    (s) => s.ui.expandedIds.add(evt.id),
    { persist: false, rerender: "card", cardId: evt.id }
  );
}

function toggleCardExpanded(state, evt) {
  if (isCardExpanded(state, evt)) {
    tryCollapseCard(state, evt);
  } else {
    expandCard(state, evt);
  }
}

function renderCardHeader(state, evt, expanded) {
  const header = document.createElement("div");
  header.className = "event-card__header is-clickable";
  header.title = expanded ? "点击折叠" : "点击展开";

  const left = document.createElement("div");
  left.className = "event-card__title-row";

  const handle = document.createElement("button");
  handle.className = "drag-handle";
  handle.type = "button";
  handle.title = "拖动排序";
  handle.innerHTML = "⠿";
  handle.tabIndex = -1;
  handle.addEventListener("click", (e) => e.stopPropagation());
  left.appendChild(handle);

  const typeSelect = document.createElement("select");
  typeSelect.className = "event-card__type";
  EVENT_TYPES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.value;
    opt.textContent = `${t.emoji} ${t.value}`;
    if (t.value === evt.type) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.addEventListener("click", (e) => e.stopPropagation());
  typeSelect.addEventListener("change", (e) => {
    const newType = e.target.value;
    if (newType === evt.type) return;
    mutate(state, (s) => {
      // P0 #3：不再 delete 字段，保留所有数据。
      // 切回原 type 时仍能用之前填的 anchor / from / to / mode。
      // 仅"补齐"目标 type 必需的字段。
      if (newType === "交通") {
        evt.anchorFrom = evt.anchorFrom || emptyAnchor();
        evt.anchorTo = evt.anchorTo || emptyAnchor();
        evt.transportMode = evt.transportMode || "";
      } else {
        evt.anchor = evt.anchor || emptyAnchor();
      }
      evt.type = newType;
      // 类型变了不动展开态：用户在编辑这张卡，强行折叠等于打断思路（bug1）
    }, { rerender: "list" });
  });
  left.appendChild(typeSelect);

  header.appendChild(left);

  if (!expanded) {
    const middle = document.createElement("div");
    middle.className = "event-card__header-summary";

    const nameSpan = document.createElement("span");
    nameSpan.className = "event-card__header-summary-name";
    nameSpan.textContent = (evt.name && evt.name.trim()) || displayDefaultName(evt);
    middle.appendChild(nameSpan);

    const metaParts = [];
    if (evt.date) metaParts.push(formatDateRange(evt.date));
    if (evt.type === "交通") {
      const sub = buildTransportSubtitle(evt);
      if (sub) metaParts.push(sub);
    } else if (evt.anchor && evt.anchor.label) {
      metaParts.push(evt.anchor.label);
    }
    if (metaParts.length) {
      const metaSpan = document.createElement("span");
      metaSpan.className = "event-card__header-summary-meta";
      metaSpan.textContent = ` · ${metaParts.join(" · ")}`;
      middle.appendChild(metaSpan);
    }
    header.appendChild(middle);
  }

  const right = document.createElement("div");
  right.className = "event-card__actions";

  if (!expanded) {
    const hint = document.createElement("span");
    hint.className = "event-card__expand-hint";
    hint.textContent = isEventComplete(evt) ? "▾ 展开" : "▾ 展开（未填完）";
    if (!isEventComplete(evt)) hint.classList.add("event-card__expand-hint--warn");
    right.appendChild(hint);
  } else {
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "event-card__check";
    okBtn.textContent = "✓";
    if (isEventComplete(evt)) {
      okBtn.classList.add("is-ready");
      okBtn.title = "收起卡片";
      okBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        tryCollapseCard(state, evt);
      });
    } else {
      okBtn.disabled = true;
      okBtn.classList.add("is-disabled");
      okBtn.title = "必填项未完成，无法收起";
      okBtn.addEventListener("click", (e) => e.stopPropagation());
    }
    right.appendChild(okBtn);
  }

  const removeBtn = document.createElement("button");
  removeBtn.className = "icon-button";
  removeBtn.type = "button";
  removeBtn.title = "删除";
  removeBtn.innerHTML = "✕";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!window.confirm("确认删除这个事件？此操作不可撤销。")) return;
    mutate(state, (s) => {
      s.events = s.events.filter((x) => x.id !== evt.id);
      s.ui.expandedIds.delete(evt.id);
    }, { rerender: "list" });
  });
  right.appendChild(removeBtn);
  header.appendChild(right);

  header.addEventListener("click", () => toggleCardExpanded(state, evt));

  return header;
}

function renderCardBody(state, evt) {
  const body = document.createElement("div");
  body.className = "event-card__body";

  // 名称：input 直接维护，不触发 rerender → IME 友好
  // 名称不算必填；evt.name 只装用户手填的值，placeholder 灰显派生值。
  const nameField = makeField("名称", false);
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = evt.name || "";
  nameInput.placeholder = namePlaceholderFor(evt);
  // 派生自 anchor（即"会被实际采用的展示名"）的 placeholder 颜色更深一点
  if (hasDerivedDisplayName(evt)) nameInput.classList.add("event-card__name--derived");
  nameInput.addEventListener("input", (e) => {
    // 不 rerender：input 自己就是 DOM 真相
    mutate(state, () => { evt.name = e.target.value; }, { rerender: "none" });
  });
  nameField.appendChild(nameInput);
  body.appendChild(nameField);

  // 地点（按类型分支）
  if (evt.type === "交通") {
    body.appendChild(renderTransportFields(state, evt));
  } else {
    body.appendChild(renderLocationField(state, evt, "anchor", "地点"));
  }

  // 日期（选填）
  body.appendChild(renderDateField(state, evt));

  // 备注 / 标签
  body.appendChild(renderTagsField(state, evt));

  return body;
}

/**
 * 名称输入框 placeholder——直接显示派生出来的"展示名"。
 *
 * 这样原生地实现了"自动生成、灰显、点击重写、不管就保留"：
 *   - placeholder 文字本身就是灰的；
 *   - 用户开始打字 placeholder 自动消失；
 *   - 用户没动 → evt.name 始终是空字符串，列表/折叠摘要走 displayDefaultName 兜底。
 *
 * 关键：evt.name 只装"用户手填"的值，不混入 anchor.label。
 */
/** 当前是否能从 anchor 派生出展示名 —— 决定 placeholder 用浅灰还是中灰。 */
function hasDerivedDisplayName(evt) {
  if (evt.type === "交通") {
    return Boolean(
      (evt.anchorFrom && evt.anchorFrom.label) ||
      (evt.anchorTo && evt.anchorTo.label)
    );
  }
  return Boolean(evt.anchor && evt.anchor.label);
}

function namePlaceholderFor(evt) {
  if (evt.type === "交通") {
    const f = (evt.anchorFrom && evt.anchorFrom.label) || "出发地";
    const t = (evt.anchorTo && evt.anchorTo.label) || "到达地";
    return `${f} → ${t}`;
  }
  if (evt.anchor && evt.anchor.label) return evt.anchor.label;
  // 没锚地之前给类型样例做引导
  switch (evt.type) {
    case "酒店": return "酒店名（锚定后自动填入）";
    case "餐饮": return "店名（锚定后自动填入）";
    case "活动": return "活动名（锚定后自动填入）";
    case "游览":
    default:    return "景点/地点（锚定后自动填入）";
  }
}

function renderTransportFields(state, evt) {
  const wrap = document.createElement("div");
  wrap.className = "field field--wide transport-fields";

  // 交通方式（必填）
  const modeField = makeField("交通方式", true);
  const modeSelect = document.createElement("select");
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "请选择";
  modeSelect.appendChild(blank);
  TRANSPORT_MODES.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    if (m.value === evt.transportMode) opt.selected = true;
    modeSelect.appendChild(opt);
  });
  if (!evt.transportMode) modeSelect.classList.add("is-empty");
  modeSelect.addEventListener("change", (e) => {
    mutate(state, (s) => {
      evt.transportMode = e.target.value;
      s.preview.transportCache.delete(evt.id);
    }, { rerender: "card", cardId: evt.id });
    // mode 变了，预览的 marker emoji + auto-tag 都得刷
    rerenderPreviewIfActive(state);
  });
  modeField.appendChild(modeSelect);
  wrap.appendChild(modeField);

  const fromTo = document.createElement("div");
  fromTo.className = "transport-from-to";
  fromTo.appendChild(renderLocationField(state, evt, "anchorFrom", "出发地点"));
  fromTo.appendChild(renderLocationField(state, evt, "anchorTo", "到达地点"));
  wrap.appendChild(fromTo);

  return wrap;
}

function rerenderPreviewIfActive(state) {
  // 如果当前在预览模式，刷一下 preview。这里用动态 import 避免循环。
  if (state.activeMode !== "preview") return;
  import("./preview-map.js").then((m) => m.renderPreview(state));
}

function renderLocationField(state, evt, field, label) {
  const wrap = document.createElement("div");
  wrap.className = "field field--wide location-field";

  const span = document.createElement("span");
  span.className = "field__label";
  span.innerHTML = `${escapeHtml(label)} <em class="field__required">*</em>`;
  wrap.appendChild(span);

  const anchor = evt[field] || emptyAnchor();
  const button = document.createElement("button");
  button.type = "button";
  button.className = `location-chip location-chip--${anchor.status}`;

  const dot = document.createElement("span");
  dot.className = "location-chip__dot";
  dot.textContent = statusEmoji(anchor.status);
  button.appendChild(dot);

  const text = document.createElement("span");
  text.className = "location-chip__text";
  text.textContent = anchor.label || (anchor.status === "none" ? "点击搜索并锚定地点" : "未命名地点");
  button.appendChild(text);

  if (anchor.status !== "none" && anchor.lat != null) {
    const coord = document.createElement("span");
    coord.className = "location-chip__coord";
    coord.textContent = `${anchor.lat.toFixed(3)}, ${anchor.lon.toFixed(3)}`;
    button.appendChild(coord);
  }

  button.addEventListener("click", () => openLocationModal(state, evt.id, field, label));
  wrap.appendChild(button);
  return wrap;
}

function renderDateField(state, evt) {
  const field = makeField("日期（选填）", false);
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "点击选择日期";
  input.value = evt.date ? formatDateRange(evt.date) : "";
  input.readOnly = true;

  const wrap = document.createElement("div");
  wrap.className = "date-field-wrap";
  wrap.appendChild(input);

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "tiny-button date-clear";
  clearBtn.textContent = "清空";
  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 日期变化 → 列表分组/排序变化 → 全量
    mutate(state, () => { evt.date = null; }, { rerender: "list" });
  });
  wrap.appendChild(clearBtn);
  field.appendChild(wrap);

  if (window.flatpickr) {
    window.flatpickr(input, {
      mode: "range",
      dateFormat: "Y-m-d",
      locale: window.flatpickr.l10ns && window.flatpickr.l10ns.zh ? "zh" : undefined,
      defaultDate: evt.date ? [evt.date.from, evt.date.to] : [],
      onClose: (selected) => {
        mutate(state, () => {
          if (selected.length === 2) {
            evt.date = { from: ymd(selected[0]), to: ymd(selected[1]) };
          } else if (selected.length === 1) {
            const d = ymd(selected[0]);
            evt.date = { from: d, to: d };
          }
        }, { rerender: "list" });
      },
    });
  }

  return field;
}

/**
 * 单个用户手填 tag chip：
 *   - 文字部分是 button，点击进入 inline 编辑（input 替换文字）
 *   - × 按钮严格 18px 圆，独立热区
 *   - 编辑提交：Enter / blur 保存；Esc 取消；空字符串等同删除
 */
function renderEditableTagChip(state, evt, tag, idx) {
  const chip = document.createElement("span");
  chip.className = "tag-chip";

  const text = document.createElement("button");
  text.type = "button";
  text.className = "tag-chip__text";
  text.textContent = tag;
  text.title = "点击编辑";
  text.addEventListener("click", () => enterEdit());
  chip.appendChild(text);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "chip-close";
  close.title = "删除";
  close.innerHTML = "✕";
  // 阻止冒泡到 chip / 编辑态文字按钮
  close.addEventListener("pointerdown", (e) => e.stopPropagation());
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    mutate(state, () => { evt.tags.splice(idx, 1); }, { rerender: "card", cardId: evt.id });
  });
  chip.appendChild(close);

  function enterEdit() {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tag-chip__edit";
    input.value = tag;
    input.size = Math.max(4, tag.length + 1);
    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const v = input.value.trim();
      if (v === tag) {
        // 没改动，仅 rerender 还原视图
        rerenderCard(state, evt.id);
        return;
      }
      mutate(state, () => {
        if (!v) evt.tags.splice(idx, 1);
        else evt.tags[idx] = v;
      }, { rerender: "card", cardId: evt.id });
    };
    const cancel = () => {
      if (committed) return;
      committed = true;
      rerenderCard(state, evt.id);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
    input.addEventListener("blur", commit);
    chip.replaceChild(input, text);
    input.focus();
    input.select();
  }

  return chip;
}

function renderTagsField(state, evt) {
  const field = makeField("备注", false);
  field.classList.add("field--tags");
  const hint = document.createElement("span");
  hint.className = "field__hint";
  hint.textContent = "回车添加备注，比如 20:30、5星海景、含早";
  field.appendChild(hint);

  const row = document.createElement("div");
  row.className = "tag-row";

  // 自动 tag（派生数据）—— P1 #7：不带 × 按钮，关掉无意义
  computeAutoTags(evt, state).forEach((auto) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip tag-chip--auto";
    chip.textContent = auto.label;
    if (auto.title) chip.title = auto.title;
    row.appendChild(chip);
  });

  // 用户手填 tag —— 点文字进入编辑态，× 按钮严格热区
  (evt.tags || []).forEach((tag, idx) => {
    row.appendChild(renderEditableTagChip(state, evt, tag, idx));
  });

  const inputWrap = document.createElement("div");
  inputWrap.className = "tag-chip-input";
  inputWrap.innerHTML = `<span class="tag-chip-input__plus">+</span>`;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "tag-input";
  input.placeholder = (evt.tags && evt.tags.length) ? "再加一条" : "回车添加备注…";
  const commit = () => {
    const v = input.value.trim();
    if (!v) return false;
    input.value = "";
    mutate(state, () => { evt.tags.push(v); }, { rerender: "card", cardId: evt.id });
    return true;
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !input.value && evt.tags.length) {
      e.preventDefault();
      mutate(state, () => { evt.tags.pop(); }, { rerender: "card", cardId: evt.id });
    }
  });
  input.addEventListener("blur", () => {
    if (input.value.trim()) commit();
  });
  inputWrap.appendChild(input);
  row.appendChild(inputWrap);
  field.appendChild(row);
  return field;
}
