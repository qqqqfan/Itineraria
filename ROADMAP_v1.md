# TripStudio v1.0 — 落地路线图

> 配套文档：[PRD_v3.md](./PRD_v3.md)
> 创建：2026-05-27
> 性质：工程视角的执行计划，与 PRD 同步演化

---

## 总体顺序

```
Phase 0  模块拆分 + 死代码清理        ──┐
Phase 1  代码 review P0/P1 修复        │  不改变产品行为，
Phase 2  Trip 数据层（多 trip / 快照） │  纯重构 + 补缺，安全
                                       ──┘
Phase 3  保存仪式 + 作品视图           ──┐
Phase 4  8 模块明信片渲染引擎          │  v1.0 新功能，
Phase 5  真实数据接入层（天气/日落）   │  按 PRD v3 落地
Phase 6  静态素材库（邮戳/地图/线稿）  │
Phase 7  PDF 导出                      ──┘

Phase 8  AI 文本接入（待决策）         ── 决策门
```

Phase 0–1 必须在 Phase 2 之前完成。否则在 2228 行单文件上叠新功能=代码债务复利。

---

## Phase 0：模块拆分 + 死代码清理

**目标**：当前 `app.js` 2228 行 → 拆成 ES module 多文件。零行为变化。

**时间预算**：1 天

**拆分目标结构**：
```
src/
  bootstrap.js          // 入口，启动顺序
  state.js              // createState + mutate(state, fn) 集中数据流
  storage.js            // localStorage 读写 + 旧版迁移
  events.js             // event 数据模型 + sortedEvents / hasDate / isComplete
  ui/
    topbar.js           // 顶栏 + mode 切换
    event-list.js       // 事件列表 + 卡片渲染
    event-card.js       // 单卡片渲染（与 event-list 解耦）
    location-modal.js   // 地点搜索 + 地图浮窗
    preview-map.js      // 预览地图
    preview-list.js     // 预览列表
    preview-axis.js     // 横轴
  geo/
    nominatim.js        // OSM 搜索 + auto-anchor
    osrm.js             // 自驾路径
    geo-utils.js        // haversine / great-circle / 重心
  data/
    sample.js           // SAMPLE_GRAND_TOUR_2026（从 app.js 抽出）
  utils/
    date.js             // ymd / formatDateRange / weekdayOf / nightsBetween
    dom.js              // escapeHtml / makeField / makeColoredDivIcon
```

**index.html 改动**：单 `<script type="module" src="./src/bootstrap.js">`

**同时执行的清理**（PRD v3 已确认砍掉的）：
- 删除 `LEGACY_STORAGE_KEY` + `migrateLegacyEvent` + `note` 字段兼容（v1.0 之前未公开发布）
- `__autoAnchorRunning` 全局 let → 进入 state
- `sample-grand-tour-2026.json` 磁盘文件删除（与 inline 数据二选一）

**验收**：
- 浏览器打开 [index.html](index.html) 行为与拆前完全一致
- 任何一个 module 单测可独立加载
- `app.js` 文件不复存在

**不做**：渲染粒度优化、响应式重写、引入构建工具、引入 npm 依赖。

---

## Phase 1：代码 review P0/P1 修复

**目标**：修掉前面 review 列出的高优问题。仍然零产品行为变化（用户感知层面），但稳定性大幅提升。

**时间预算**：1.5 天

**P0 修复**：

| # | 问题 | 修复方案 | 文件 |
|---|------|---------|------|
| 1 | 全量 renderEventList 17 处 → IME 中断 / 焦点丢失 / 滚动丢失 | 引入 `rerenderCard(state, eventId)` 单卡级渲染；list 重渲只在结构变化（添加/删除/拖拽/类型切换）时触发 | event-list.js |
| 2 | mutate 数据 + persist + render 三件事散落 | `mutate(state, fn, { rerender: 'card' \| 'list' \| 'preview' })` 集中分发 | state.js |
| 3 | 类型切换 delete 字段 → 用户回切丢数据 | 保留所有字段，isComplete 按当前 type 判断；类型切换不再删字段 | event-card.js |

**P1 修复**：

| # | 问题 | 修复方案 |
|---|------|---------|
| 4 | 拖针后未 focus 确认按钮（PRD v2 要求 2，仍保留到 v3） | dragend 后给确认按钮 .is-armed 高亮 + focus |
| 5 | 出发地浮窗默认定位（PRD v2 要求 3） | 交通卡片 anchorFrom 浮窗：默认定位到时间最近的已锚定点；anchorTo：定位到 anchorFrom |
| 6 | 有日期卡片可被拖动但被强制还原（PRD v2 要求 5） | dated 组禁用 sortable + 拖时显示提示"调整顺序请修改日期" |
| 7 | 自动 tag × 关闭后任一 render 又会冒出来 | v1.0 直接移除 × 按钮（PRD v3 没要求保留）；保留点击外部隐藏的能力到 v1.1 |
| 8 | runSearch 无 AbortController | 引入 AbortController；浮窗关闭/切目标时 abort |
| 9 | Nominatim 缺少 identifying 参数 | 加 `email=` 参数（OSM 接受） |

**验收**：用户做以下操作不再有任何 UI 跳动：
- 编辑 tag、改名称、改日期
- 切换交通方式
- 拖动有日期的卡片（应被阻止 + 提示）
- 拖针选地点

---

## Phase 2：Trip 数据层

**目标**：让 v1.0 能存多份"旅行"。

**时间预算**：取决于决策（见下）

**🚧 决策门 D1**：

| 选项 | 含义 | 工作量 |
|------|------|--------|
| **D1-A** 完整多 trip | 首页"我的旅行"列表，新建/打开/重命名/删除 | 1.5 天 |
| **D1-B** 单 trip + 快照系统 | 当前编辑区只存 1 份，每次"保存为作品"生成不可编辑快照，快照可列表查看 | 0.8 天 |

**待 lx 拍板。在拍板前 Phase 2 不动手。**

无论选哪个，存储改造点：
- localStorage key 由单 `STORAGE_KEY` → `STORAGE_KEY:current`（编辑中）+ `STORAGE_KEY:works:{id}`（已保存作品）
- 抽 `storage.js` 的 read/write 接口为按 key 操作
- 旧 v2 数据自动迁移到新结构（一次性，迁完删旧 key）

**验收**：
- 用户可以同时拥有"grand tour 2026"和"winter 2027"两份数据
- 关闭浏览器再打开，两份都还在
- 删除一份不影响另一份

---

## Phase 3：保存仪式 + 作品视图

**目标**：从"录入界面"过渡到"作品界面"的一次明确动作。

**时间预算**：1 天

**新增 UI**：
- 录入界面右上角新增"保存为作品"按钮（仅当所有 event 完整且至少 1 张时可点）
- 点击后进入**作品视图**：
  - 顶部：作品标题 + 创建日期 + 主题色（可选）
  - 左/上：行程本（列表 + 地图，沿用现有预览）
  - 右/下：明信片集（解锁机制按 Phase 4 实现，先放占位）
- 作品视图右上有"返回编辑"按钮（如选 D1-A 即返回该 trip 编辑；如选 D1-B 即返回当前编辑区，作品保留为只读快照）

**保存触发的副作用**：
- 序列化 events 数据为 work 快照
- 调用 Phase 4 的明信片生成器（生成完整 schema JSON，不渲染）
- 持久化到 `STORAGE_KEY:works:{id}`

**验收**：
- 录入 → 保存 → 看到作品视图
- 作品视图刷新页面仍在
- 行程本部分与现有预览一致

---

## Phase 4：8 模块明信片渲染引擎

**目标**：把 PRD v3 定义的 8 模块 schema 落成可渲染的 HTML/CSS。

**时间预算**：3 天（最大头）

**架构**：
```
postcard/
  schema.js           // PostcardData 类型 + 校验
  generator.js        // 输入 (event[], date) → 输出 PostcardData JSON
  renderer.js         // 输入 PostcardData → 输出 HTMLElement
  modules/
    header.js         // [1]
    stamp.js          // [2]
    hero.js           // [3]：大字 / 手绘地图 / SVG 线稿
    weather.js        // [4]
    map.js            // [5]
    ticket.js         // [6]
    field-note.js     // [7] v1.0 留空
    tip.js            // [8] v1.0 留空
  layouts/
    layout-a.css      // 默认布局
  postcard.css        // 共享样式（字体、留白、戳印）
```

**关键约束**（与 PRD v3 对齐）：
- HERO 槽位 v1.0 只有大字排版 / 手绘地图 / SVG 线稿三种，**不调 AI 生图**
- FIELD NOTE / TIP v1.0 留空（CSS 上预留位置但不显示，或显示极简静态文案）
- 所有数字类信息必须来自 Phase 5 的真实数据

**输入输出契约**：
```
Generator 输入:
  events: 某天涉及的所有 event（来自 Phase 2 数据）
  date: YYYY-MM-DD
  context: 行程总坐标范围、是否首日 / 末日

Generator 输出 PostcardData:
  {
    id, date, locationName, coordinate,
    modules: {
      header: {...},
      stamp: {...},
      hero: { type: 'typo' | 'map' | 'icon', payload },
      weather: null | {...},
      map: null | {...},
      ticket: null | {...},
      fieldNote: null,    // v1.0 强制 null
      tip: null,          // v1.0 强制 null
    }
  }

Renderer 输入: PostcardData → 输出 HTMLElement（可截图、可塞进 PDF）
```

**解锁机制**（PRD v3 Q2 → B 选项）：
- 全部明信片在保存时已生成
- UI 默认显示 today 及以前
- 未来日期显示"5 月 8 日解锁"锁态卡 + "偷看"按钮

**验收**：
- 用 grand tour 2026 录入 → 保存 → 看到 35 张明信片占位
- 至少今天/之前的明信片 UI 渲染完整
- 截图任一张明信片，单图可以独立看

---

## Phase 5：真实数据接入层

**目标**：天气、日落、坐标 → 真实数据，不编造。

**时间预算**：1.5 天

**🚧 决策门 D2**：

| 数据 | 候选源 | 推荐 |
|------|--------|-----|
| 天气（历史/预测） | OpenWeather (付费 key) / Open-Meteo (免费) | **Open-Meteo**：免费、无需 key、有历史和未来 16 天预测 |
| 日出/日落 | 自己用经纬度+日期算 | 自算（公式简单，无需 API） |
| 时区 | timezonedb / 自带 lib | tz-lookup（纯前端 npm 包，但 v1.0 拒绝 npm）→ 用 Open-Meteo 返回的 tz |
| 节假日 | nager.date 公开 API | v1.0 不做，v1.1 加 |
| 票价 | 无 | v1.0 不做（票根模块只展示交通方式 + 时间，不展示价格） |

**新增模块**：
```
data/
  weather.js           // Open-Meteo client + cache
  sun.js               // 经纬度+日期 → sunrise/sunset
  resolve.js           // 给 Phase 4 generator 用的统一数据解析入口
```

**缓存策略**：
- 同一 (lat, lon, date) 30 天内只查一次，结果存 localStorage
- 失败兜底：显示"--"，不显示假数据

**验收**：
- grand tour 2026 第一天的明信片，温度/日落是 2026-05-05 巴黎当天的真实数据
- 离线环境下显示缓存数据 / 占位
- 明信片不出现"undefined"

---

## Phase 6：静态素材库

**目标**：邮戳、手绘地图、SVG 线稿三类视觉资产，让明信片真正"好看"。

**时间预算**：2 天（高度依赖素材产出方式）

**🚧 决策门 D3**：素材怎么来？

| 选项 | 优点 | 风险 |
|------|------|------|
| 自己画（lx 或外包） | 完全可控调性 | 时间不可控 |
| 开源 SVG 库（Noun Project / SVG Repo） | 快 | 风格可能拼凑 |
| 程序化生成（手绘风地图用 D3 + 噪声） | 一次写完无限复用 | 调试时间长 |

**v1.0 务实路径**：
- 邮戳：8–10 个常用国家/地区的预设 SVG，自己设计或外包
- 手绘地图：用 Leaflet + 一个手绘风 tile（Stamen Watercolor 或类似）截屏渲染
- SVG 线稿：v1.0 完全不做，HERO 不可选 icon 类型，只剩"大字"和"手绘地图"两种

**验收**：
- 巴黎、米兰、罗马、东京、北京等常用地点都有邮戳
- 当日地图 hero 视觉接近 PRD v3 描述的"老 Lonely Planet"气质

---

## Phase 7：PDF 导出

**目标**：用户能把作品 share 给 peer 的最低成本路径。

**时间预算**：0.5 天

**实现**：
- 浏览器原生 `window.print()` + 打印 CSS（每张明信片一页）
- 可选：html2canvas + jsPDF（如果原生打印效果不够）

**验收**：
- 一键导出 PDF，35 张明信片每张一页
- PDF 用 iPhone / 微信打开正常显示
- lx 把 PDF 发给同行人，对方读完表情或反馈是 v1.0 北极星的判断依据

---

## Phase 8：AI 文本接入（待决策）

**🚧 决策门 D4**（最重要的产品判断）：

PRD v3 把 AI 推到 v1.1。但 lx 在 review 中保留意见："如果 v1.0 跑出来明信片显得空心，当场加 AI"。

**触发条件**：Phase 7 完成 + lx 自己看完整套明信片，给出判断：
- 判断 A："已经够，达到北极星" → AI 推到 v1.1，v1.0 收尾发布
- 判断 B："差点意思，FIELD NOTE / TIP 必须有内容" → 加 Phase 8

**Phase 8 内容**（如果触发）：
- 接入 Claude API（直接前端 fetch，key 用户自带或 lx 自掏）
- 为每张明信片调用一次 AI，输入：events + 真实数据，输出：3-5 行 field note + 1 行 tip
- 严格 JSON schema 校验
- 失败兜底：模块仍留空
- 估算工作量：1.5 天

---

## 时间汇总

| Phase | 工作量 | 说明 |
|-------|-------|------|
| 0 模块拆分 | 1 天 | |
| 1 P0/P1 修复 | 1.5 天 | |
| 2 Trip 数据层 | 0.8 / 1.5 天 | 取决于 D1 |
| 3 保存仪式 | 1 天 | |
| 4 明信片引擎 | 3 天 | 最大头 |
| 5 真实数据 | 1.5 天 | |
| 6 静态素材 | 2 天 | 取决于 D3，可能更长 |
| 7 PDF 导出 | 0.5 天 | |
| 8 AI（可选） | 1.5 天 | 决策门 |
| **合计** | **11.3 ~ 13.5 天** | 含决策门下限 / 上限 |

---

## 待决策清单（不阻塞 Phase 0/1 开工）

- **D1**：多 trip vs 快照系统（影响 Phase 2）
- **D2**：天气数据源（推荐 Open-Meteo，需 lx confirm）
- **D3**：素材产出方式（邮戳/线稿谁来画）
- **D4**：v1.0 是否在最后加 AI（Phase 7 结束时回答）

Phase 0 和 Phase 1 没有任何决策依赖，**可以立即开工**。

---

## 立即开工的下一步

如果 lx 确认这个 ROADMAP，我建议直接进 Phase 0：
1. 创建 `src/` 目录结构
2. 把 [app.js](app.js) 按 module 边界切开，每个文件 export 必要的函数
3. 改 [index.html](index.html) 为 `<script type="module">`
4. 浏览器跑一遍 sample → 确认行为不变
5. 删除 LEGACY 迁移代码 + sample-grand-tour-2026.json

完成后立刻提交一次 commit，建立干净的起点。

*Phase 1 紧接着进，可以同一个工作段完成。*

---

*文档更新：2026-05-27 v1.0*
