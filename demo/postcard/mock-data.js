/* 3 张样片 mock —— 开场 / 中段 / 末日
 *
 * 数据全部 hardcoded：
 *   - 天气数字按 Paris / Dolomites 当地 5 月气候范围编一个合理值（demo 阶段不接 API）
 *   - 票根用 grand tour 2026 真实航班信息
 *   - 坐标用 sample.js 里的真值
 *   - SVG 由 svg-assets.js 提供
 */

import { SVG_MOUNTAIN_SECEDA, makeRouteSVG } from "./svg-assets.js";

export const MOCK_POSTCARDS = [
  /* ---------- 1: D1 抵达 巴黎 ---------- */
  {
    id: "pc-2026-05-05",
    date: "2026-05-05",
    modules: {
      header: {
        locationName: "Paris",
        countryCode: "FR",
        date: "2026-05-05",
        dayIndex: 1,
        totalDays: 16,
        coordinate: { lat: 48.8534, lon: 2.3483 },
      },
      stamp: {
        kind: "arrival",
        place: "PARIS · CDG",
        date: "05.MAI.2026",
        tone: "red",
      },
      hero: {
        type: "typo",
        title: "PARIS",
        subtitle: "48.8534° N · 2.3483° E",
        accent: "le 5 mai · jour 1 / 16",
      },
      weather: {
        tempLow: 11,
        tempHigh: 19,
        code: "多云转晴",
        sunrise: "06:21",
        sunset: "21:08",
      },
      map: {
        svgInline: makeRouteSVG([
          { x: 0.86, y: 0.18, label: "CDG" },
          { x: 0.62, y: 0.32 },
          { x: 0.42, y: 0.48 },
          { x: 0.22, y: 0.66, label: "Vendôme" },
        ]),
        caption: "CDG → Place Vendôme · 27 km",
      },
      ticket: {
        kind: "flight",
        carrier: "Air China",
        code: "CA933",
        from: "PEK · T3",
        to: "CDG",
        timeFrom: "01:30",
        timeTo: "06:25",
        note: "13h05  ·  B777-300ER",
      },
      fieldNote: null,
      tip: null,
    },
  },

  /* ---------- 2: D10 山间日 Seceda ---------- */
  {
    id: "pc-2026-05-14",
    date: "2026-05-14",
    modules: {
      header: {
        locationName: "Castelrotto",
        countryCode: "IT",
        date: "2026-05-14",
        dayIndex: 10,
        totalDays: 16,
        coordinate: { lat: 46.6005, lon: 11.7257 },
      },
      stamp: {
        kind: "transit",
        place: "DOLOMITI",
        date: "14.MAG.2026",
        tone: "blue",
      },
      hero: {
        type: "icon",
        svgInline: SVG_MOUNTAIN_SECEDA,
        caption: "SECEDA · 2 519 m",
      },
      weather: {
        tempLow: 4,
        tempHigh: 13,
        code: "晴 · 风",
        sunrise: "05:48",
        sunset: "20:42",
      },
      map: {
        svgInline: makeRouteSVG([
          { x: 0.16, y: 0.72, label: "Castelrotto" },
          { x: 0.34, y: 0.58 },
          { x: 0.52, y: 0.42 },
          { x: 0.74, y: 0.24, label: "Seceda" },
        ], { dashed: true }),
        caption: "Castelrotto → Seceda · 23 km · 缆车 + 徒步",
      },
      ticket: null,
      fieldNote: null,
      tip: null,
    },
  },

  /* ---------- 3: D16 离开 巴黎 ---------- */
  {
    id: "pc-2026-05-20",
    date: "2026-05-20",
    modules: {
      header: {
        locationName: "Paris",
        countryCode: "FR",
        date: "2026-05-20",
        dayIndex: 16,
        totalDays: 16,
        coordinate: { lat: 49.0068, lon: 2.5710 },
      },
      stamp: {
        kind: "departure",
        place: "PARIS · CDG",
        date: "20.MAI.2026",
        tone: "red",
      },
      hero: {
        type: "typo",
        title: "AU REVOIR",
        subtitle: "49.0068° N · 2.5710° E",
        accent: "le 20 mai · jour 16 / 16",
      },
      weather: {
        tempLow: 13,
        tempHigh: 22,
        code: "晴",
        sunrise: "06:00",
        sunset: "21:32",
      },
      map: {
        svgInline: makeRouteSVG([
          { x: 0.18, y: 0.68, label: "Albar" },
          { x: 0.42, y: 0.52 },
          { x: 0.66, y: 0.36 },
          { x: 0.84, y: 0.22, label: "CDG" },
        ]),
        caption: "Le Diamond → CDG · 32 km",
      },
      ticket: {
        kind: "flight",
        carrier: "Air China",
        code: "CA934",
        from: "CDG",
        to: "PEK · T3",
        timeFrom: "11:05",
        timeTo: "次日 04:30",
        note: "9h25  ·  B777-300ER",
      },
      fieldNote: null,
      tip: null,
    },
  },
];
