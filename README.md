# TripStudio

> 把一段还没发生的旅行**先走一遍** —— 录入行程、锚定地图、一键分享给朋友。

**线上体验**:<https://tripstudio-d8g4493cjc152b482-1437904407.tcloudbaseapp.com/>

不需要注册。打开就能用。

---

## 这是什么

一个纯前端的小工具,用来把脑子里那段"想去 / 在 / 去过"的旅行**摆在地图上**:

- **多 trip 仓库**:每段旅行一个独立作品,在 Library 里随时切换
- **事件流**:酒店 / 景点 / 交通 / 活动,按天或按事件分组,拖拽排序
- **三态地图锚定**:OSM 自动 geocode → 不准就拖 pin 手工修 → 不重要的就模糊定位
- **时间线 + 地图双视图**:同一份数据两种看法
- **一键分享**:生成短链(`?s=xxxxxxxx`)发给朋友,只读模式打开,90 天有效
- **JSON 导入导出**:本地完整备份

数据存在你自己浏览器的 localStorage,刷新关浏览器都不会丢。

---

## 自己跑一份

无构建。本地起 HTTP 服务就行:

```bash
git clone https://github.com/qqqqfan/Itineraria.git
cd Itineraria
python3 -m http.server 8000
open http://localhost:8000/
```

不能用 `file://` 直接双击 `index.html` —— ES module 会被浏览器拦。

> ⚠️ 短链功能(`?s=xxx`)依赖一个 CloudBase 云函数后端。本地直接 clone 跑也能用,但点"分享"会自动回退到长链(`#t=xxx`,把数据塞 URL 里,3-5KB)。  
> 如果你想自己也搭一份带短链的,见下面 [自己部署带后端的版本](#自己部署带后端的版本)。

---

## 项目结构

```
index.html              入口
styles.css              样式
src/                    模块化前端代码(无构建,原生 ES module)
  bootstrap.js          启动 + 路由(普通 / shared 模式)
  state.js              全局 state
  storage.js            localStorage 多 trip 存储 + v0.1 迁移
  mutate.js             数据流入口(写 state + 触发渲染 + 持久化)
  share.js              v0.2 长链编解码(LZString → URL fragment)
  share-api.js          v0.2+ 短链 HTTP 层(POST/GET CloudBase 后端)
  geo/nominatim.js      OSM 地理编码 + 自动锚定
  ui/                   各分区 UI(topbar / library / event-list / location-modal / preview-map / share-modal)
docs/
  concept.md            产品概念
  voice.md              文案语调约定
```

---

## 自己部署带后端的版本

如果你想 fork 这个项目自己跑一个能短链分享的版本:

### 1. 准备一个云函数后端

任何能跑 Node.js + 暴露 HTTP / 有简单文档库的服务都行。我用的是腾讯云 CloudBase(国内访问稳),也可以是:

- Vercel + Vercel KV
- Cloudflare Workers + KV
- 你自己的 VPS + 任何数据库

后端契约就两个接口:

```
POST /share        body: { payload: <trip-payload> }   →  { id: "xxxxxxxx" }
GET  /share/:id                                         →  { payload: <trip-payload> }
```

详见 [`src/share-api.js`](./src/share-api.js) 顶部注释。

### 2. 把 `src/share-api.js` 里的 URL 换成你的

```js
const SHARE_API_BASE = "https://你的后端/share";
```

### 3. 部署静态站

CloudBase 静态托管 / Vercel / Netlify / GitHub Pages 都行。注意 GitHub Pages 国内访问偶尔不稳。

---

## 外部依赖(全部 CDN)

- [Leaflet](https://leafletjs.com/) 1.9.4 — 地图
- [SortableJS](https://github.com/SortableJS/Sortable) 1.15.2 — 拖拽排序
- [Flatpickr](https://flatpickr.js.org/) — 日期范围
- [LZ-String](https://github.com/pieroxy/lz-string) 1.5.0 — 长链压缩
- [Nominatim](https://nominatim.org/) — OSM 地理编码(公共服务)
- [OSRM](http://project-osrm.org/) — 自驾路径(公共服务)

---

## 版本

| 版本 | 状态 | 内容 |
|------|------|------|
| **v0.1.0** | 已冻结(tag) | 单 trip 录入 MVP |
| **v1.0** | 当前 `v1.0-dev` 分支 | 多 trip 仓库、分享、CloudBase 短链 |
| 未来 | 路线图 | 国内瓦片源切换、明信片渲染引擎、PDF 导出 |

详见 [`PRD_v3.md`](./PRD_v3.md) 与 [`ROADMAP_v1.md`](./ROADMAP_v1.md)。

---

## License

[MIT](./LICENSE)
