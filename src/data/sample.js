/* 示例数据（v1.0 形态，已锚定） */
/* 与磁盘上的 sample-grand-tour-2026.json 内容保持一致；内联进来是为了
 * 在 file:// 协议下也能用（fetch ./xxx.json 会被 CORS 拦）。
 * 所有 anchor.status === "precise"，因此点"示例"立即出地图，零网络等待。
 */

import { normalizeLoadedEvent } from "../storage.js";

export const SAMPLE_GRAND_TOUR_2026 = {
  trip: { title: "Grand Tour 2026" },
  events: [
    { id: "sample-01", type: "交通", name: "CA933 PEK → CDG", date: { from: "2026-05-05", to: "2026-05-05" }, tags: [], sortIndex: 0, transportMode: "flight",
      anchorFrom: { status: "precise", lat: 40.0802322, lon: 116.5938886, label: "北京首都国际机场 T3" },
      anchorTo:   { status: "precise", lat: 49.0068908, lon: 2.571082,    label: "Paris CDG" } },
    { id: "sample-02", type: "酒店", name: "Park Hyatt Paris-Vendôme", date: { from: "2026-05-05", to: "2026-05-07" }, tags: [], sortIndex: 1,
      anchor: { status: "precise", lat: 48.8690233, lon: 2.330489, label: "Park Hyatt Paris-Vendôme" } },
    { id: "sample-03", type: "游览", name: "Paris", date: { from: "2026-05-06", to: "2026-05-06" }, tags: [], sortIndex: 2,
      anchor: { status: "precise", lat: 48.8534951, lon: 2.3483915, label: "Paris" } },
    { id: "sample-04", type: "交通", name: "Paris → Dijon", date: { from: "2026-05-07", to: "2026-05-07" }, tags: [], sortIndex: 3, transportMode: "drive",
      anchorFrom: { status: "precise", lat: 48.8690233, lon: 2.330489, label: "Park Hyatt Paris-Vendôme" },
      anchorTo:   { status: "precise", lat: 47.3236121, lon: 5.037034,  label: "Aloft Dijon" } },
    { id: "sample-05", type: "酒店", name: "Aloft by Marriott Dijon", date: { from: "2026-05-07", to: "2026-05-08" }, tags: [], sortIndex: 4,
      anchor: { status: "precise", lat: 47.3236121, lon: 5.037034, label: "Aloft Dijon" } },
    { id: "sample-06", type: "交通", name: "Dijon → Puligny-Montrachet", date: { from: "2026-05-08", to: "2026-05-08" }, tags: [], sortIndex: 5, transportMode: "drive",
      anchorFrom: { status: "precise", lat: 47.3236121, lon: 5.037034,  label: "Aloft Dijon" },
      anchorTo:   { status: "precise", lat: 46.944175,  lon: 4.7566827, label: "Maison Deveney Mars" } },
    { id: "sample-07", type: "游览", name: "Burgundy", date: { from: "2026-05-08", to: "2026-05-08" }, tags: [], sortIndex: 6,
      anchor: { status: "precise", lat: 46.9487302, lon: 4.7531515, label: "Puligny-Montrachet" } },
    { id: "sample-08", type: "酒店", name: "Maison Deveney Mars", date: { from: "2026-05-08", to: "2026-05-09" }, tags: [], sortIndex: 7,
      anchor: { status: "precise", lat: 46.944175, lon: 4.7566827, label: "Maison Deveney Mars" } },
    { id: "sample-09", type: "交通", name: "Montrachet → Gordes → Aix → Cannes", date: { from: "2026-05-09", to: "2026-05-09" }, tags: [], sortIndex: 8, transportMode: "drive",
      anchorFrom: { status: "precise", lat: 46.944175,  lon: 4.7566827, label: "Maison Deveney Mars" },
      anchorTo:   { status: "precise", lat: 43.5509574, lon: 7.0253676, label: "ibis Cannes Plage La Bocca" } },
    { id: "sample-10", type: "游览", name: "Gordes", date: { from: "2026-05-09", to: "2026-05-09" }, tags: [], sortIndex: 9,
      anchor: { status: "precise", lat: 43.9110641, lon: 5.2002043, label: "Gordes 石头村" } },
    { id: "sample-11", type: "酒店", name: "ibis Cannes Plage La Bocca", date: { from: "2026-05-09", to: "2026-05-10" }, tags: [], sortIndex: 10,
      anchor: { status: "precise", lat: 43.5509574, lon: 7.0253676, label: "ibis Cannes Plage La Bocca" } },
    { id: "sample-12", type: "交通", name: "Cannes → Nice → Roquebrune-Cap-Martin", date: { from: "2026-05-10", to: "2026-05-10" }, tags: [], sortIndex: 11, transportMode: "drive",
      anchorFrom: { status: "precise", lat: 43.5509574, lon: 7.0253676, label: "ibis Cannes Plage La Bocca" },
      anchorTo:   { status: "precise", lat: 43.7597611, lon: 7.4520286, label: "Hôtel Le Roquebrune" } },
    { id: "sample-13", type: "游览", name: "Cote d'Azur", date: { from: "2026-05-10", to: "2026-05-10" }, tags: [], sortIndex: 12,
      anchor: { status: "precise", lat: 43.7009358, lon: 7.2683912, label: "Nice" } },
    { id: "sample-14", type: "酒店", name: "Hôtel Le Roquebrune", date: { from: "2026-05-10", to: "2026-05-11" }, tags: [], sortIndex: 13,
      anchor: { status: "precise", lat: 43.7597611, lon: 7.4520286, label: "Hôtel Le Roquebrune" } },
    { id: "sample-15", type: "交通", name: "Roquebrune → Milan", date: { from: "2026-05-11", to: "2026-05-11" }, tags: [], sortIndex: 14, transportMode: "drive",
      anchorFrom: { status: "precise", lat: 43.7597611, lon: 7.4520286, label: "Hôtel Le Roquebrune" },
      anchorTo:   { status: "precise", lat: 45.4641943, lon: 9.1896346, label: "Milan" } },
    { id: "sample-16", type: "酒店", name: "Park Hyatt Milan", date: { from: "2026-05-11", to: "2026-05-12" }, tags: [], sortIndex: 15,
      anchor: { status: "precise", lat: 45.4641943, lon: 9.1896346, label: "Park Hyatt Milan" } },
    { id: "sample-17", type: "交通", name: "Milan → Lake Como", date: { from: "2026-05-12", to: "2026-05-12" }, tags: [], sortIndex: 16, transportMode: "drive",
      anchorFrom: { status: "precise", lat: 45.4641943, lon: 9.1896346, label: "Park Hyatt Milan" },
      anchorTo:   { status: "precise", lat: 46.0883343, lon: 9.2782283, label: "Casa Olea Hotel" } },
    { id: "sample-18", type: "酒店", name: "Casa Olea Hotel", date: { from: "2026-05-12", to: "2026-05-13" }, tags: [], sortIndex: 17,
      anchor: { status: "precise", lat: 46.0883343, lon: 9.2782283, label: "Casa Olea Hotel" } },
    { id: "sample-19", type: "交通", name: "Lake Como → Bolzano", date: { from: "2026-05-13", to: "2026-05-13" }, tags: [], sortIndex: 18, transportMode: "drive",
      anchorFrom: { status: "precise", lat: 46.0883343, lon: 9.2782283,  label: "Casa Olea Hotel" },
      anchorTo:   { status: "precise", lat: 46.4984781, lon: 11.3547399, label: "Four Points by Sheraton Bolzano" } },
    { id: "sample-20", type: "酒店", name: "Four Points by Sheraton Bolzano", date: { from: "2026-05-13", to: "2026-05-14" }, tags: [], sortIndex: 19,
      anchor: { status: "precise", lat: 46.4984781, lon: 11.3547399, label: "Four Points by Sheraton Bolzano" } },
    { id: "sample-21", type: "交通", name: "Bolzano → Castelrotto", date: { from: "2026-05-14", to: "2026-05-14" }, tags: [], sortIndex: 20, transportMode: "drive",
      anchorFrom: { status: "precise", lat: 46.4984781, lon: 11.3547399, label: "Four Points by Sheraton Bolzano" },
      anchorTo:   { status: "precise", lat: 46.5512958, lon: 11.5685132, label: "Sonus Alpis" } },
    { id: "sample-22", type: "游览", name: "Seceda hiking", date: { from: "2026-05-14", to: "2026-05-14" }, tags: [], sortIndex: 21,
      anchor: { status: "precise", lat: 46.6005922, lon: 11.7257836, label: "Seceda, Santa Cristina" } },
    { id: "sample-23", type: "酒店", name: "Sonus Alpis", date: { from: "2026-05-14", to: "2026-05-16" }, tags: [], sortIndex: 22,
      anchor: { status: "precise", lat: 46.5512958, lon: 11.5685132, label: "Sonus Alpis" } },
    { id: "sample-24", type: "游览", name: "Alpe Siusi", date: { from: "2026-05-15", to: "2026-05-15" }, tags: [], sortIndex: 23,
      anchor: { status: "precise", lat: 46.531056, lon: 11.6247091, label: "Alpe di Siusi" } },
    { id: "sample-25", type: "游览", name: "Funes", date: { from: "2026-05-15", to: "2026-05-15" }, tags: [], sortIndex: 24,
      anchor: { status: "precise", lat: 46.6451, lon: 11.6968408, label: "Valle di Funes" } },
    { id: "sample-26", type: "交通", name: "Castelrotto → Gosausee → Hallstatt → St Wolfgang", date: { from: "2026-05-16", to: "2026-05-16" }, tags: [], sortIndex: 25, transportMode: "drive",
      anchorFrom: { status: "precise", lat: 46.5512958, lon: 11.5685132, label: "Sonus Alpis" },
      anchorTo:   { status: "precise", lat: 47.7393246, lon: 13.4456573, label: "Scalaria Sunset Wing" } },
    { id: "sample-27", type: "游览", name: "Hallstatt", date: { from: "2026-05-16", to: "2026-05-16" }, tags: [], sortIndex: 26,
      anchor: { status: "precise", lat: 47.5347939, lon: 13.5988875, label: "Hallstatt" } },
    { id: "sample-28", type: "酒店", name: "Scalaria", date: { from: "2026-05-16", to: "2026-05-17" }, tags: [], sortIndex: 27,
      anchor: { status: "precise", lat: 47.7393246, lon: 13.4456573, label: "Scalaria Sunset Wing" } },
    { id: "sample-29", type: "交通", name: "St Wolfgang → Luxembourg", date: { from: "2026-05-17", to: "2026-05-17" }, tags: [], sortIndex: 28, transportMode: "drive",
      anchorFrom: { status: "precise", lat: 47.7393246, lon: 13.4456573, label: "Scalaria Sunset Wing" },
      anchorTo:   { status: "precise", lat: 49.6007119, lon: 6.1328727,  label: "Luxembourg Marriott Hotel Alfa" } },
    { id: "sample-30", type: "酒店", name: "Luxembourg Marriott Hotel Alfa", date: { from: "2026-05-17", to: "2026-05-18" }, tags: [], sortIndex: 29,
      anchor: { status: "precise", lat: 49.6007119, lon: 6.1328727, label: "Luxembourg Marriott Hotel Alfa" } },
    { id: "sample-31", type: "游览", name: "卢森堡老城", date: { from: "2026-05-18", to: "2026-05-18" }, tags: [], sortIndex: 30,
      anchor: { status: "precise", lat: 49.6116, lon: 6.1319, label: "Luxembourg Old Town (Place d'Armes)" } },
    { id: "sample-32", type: "交通", name: "Luxembourg → Paris", date: { from: "2026-05-18", to: "2026-05-18" }, tags: [], sortIndex: 31, transportMode: "drive",
      anchorFrom: { status: "precise", lat: 49.6007119, lon: 6.1328727, label: "Luxembourg Marriott Hotel Alfa" },
      anchorTo:   { status: "precise", lat: 48.8534951, lon: 2.3483915, label: "Paris" } },
    { id: "sample-33", type: "酒店", name: "Maison Albar Hotels Le Diamond", date: { from: "2026-05-18", to: "2026-05-20" }, tags: [], sortIndex: 32,
      anchor: { status: "precise", lat: 48.8753905, lon: 2.2944392, label: "Maison Albar Hôtel" } },
    { id: "sample-34", type: "游览", name: "巴黎", date: { from: "2026-05-19", to: "2026-05-19" }, tags: [], sortIndex: 33,
      anchor: { status: "precise", lat: 48.8534951, lon: 2.3483915, label: "Paris" } },
    { id: "sample-35", type: "交通", name: "CA934 巴黎 → 北京", date: { from: "2026-05-20", to: "2026-05-20" }, tags: [], sortIndex: 34, transportMode: "flight",
      anchorFrom: { status: "precise", lat: 49.0068908, lon: 2.571082,    label: "Paris CDG" },
      anchorTo:   { status: "precise", lat: 40.0802322, lon: 116.5938886, label: "北京首都国际机场 T3" } },
  ],
};

export function buildSampleEvents() {
  // sample 已是 v1.0 形态，深拷贝即可（避免共享引用导致后续修改污染常量）
  // 用 normalizeLoadedEvent 兜一层，确保字段缺失时也补齐 emptyAnchor
  return SAMPLE_GRAND_TOUR_2026.events.map((s, i) => {
    const cloned = JSON.parse(JSON.stringify(s));
    const evt = normalizeLoadedEvent(cloned);
    evt.sortIndex = (typeof cloned.sortIndex === "number") ? cloned.sortIndex : i;
    return evt;
  });
}
