# TripStudio

> 把一段还没发生的旅行**先走一遍**——录入行程、锚定地图、生成明信片集。

## 当前阶段

- **v0.1.0**：录入侧 MVP。表单 + 地图浮窗 + 三态锚定（precise / manual / none）+ 时间轴预览 + JSON 导入导出。
- **v1.0**（开发中，分支 `v1.0-dev`）：多 trip 管理、保存仪式、明信片集（8 模块渲染引擎）、真实天气数据、PDF 导出。范围与节奏见 [`PRD_v3.md`](./PRD_v3.md) 与 [`ROADMAP_v1.md`](./ROADMAP_v1.md)。

## 版本历史

| 版本 | 状态 | 内容 | 入口 |
|------|------|------|------|
| **v0.1.0** | 已冻结（tag） | 表单 + 地图核心 | `git checkout v0.1.0` |
| **v1.0**   | 开发中 | PRD v3 全集 | 分支 `v1.0-dev` |

> 0.1 是"录入工具"的语义；1.0 是"作品工具"的语义。前者把行程录进来，后者把这趟旅行的痕迹寄回来。

## 快速运行

无构建。本地起 HTTP 服务就行：

```bash
python3 -m http.server 8080
open http://localhost:8080/
```

不能用 `file://` 直接双击 `index.html`，ES module 会被拦。

## 文件结构

```
index.html              入口
src/                    模块化前端代码（utils → geo/data → events/storage → mutate → ui → bootstrap）
styles.css              样式
PRD_v3.md               产品定义（v1.0 权威）
ROADMAP_v1.md           v1.0 实施路线图
```

## 外部依赖（CDN）

- [Leaflet](https://leafletjs.com/) 1.9.4 — 地图
- [SortableJS](https://github.com/SortableJS/Sortable) 1.15.2 — 拖拽排序
- [Flatpickr](https://flatpickr.js.org/) — 日期范围
- [Nominatim](https://nominatim.org/) — OSM 地理编码（公共服务，已声明 email）
- [OSRM](http://project-osrm.org/) — 自驾路径

无后端、无账号、无构建。
