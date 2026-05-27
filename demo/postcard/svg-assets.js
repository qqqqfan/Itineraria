/* 内联 SVG 资产（demo 版本）
 *
 * 真实 v1.0 会有一个 svg/ 目录装数百个线稿，这里只放 demo 需要的两类：
 *   1. 一座山（Seceda 风格的剪影）
 *   2. 路径生成器（用相对坐标点生成手绘风路径）
 *
 * 风格：纯线稿、深棕（#2a221c）、留白多。
 */

/** Seceda 山的剪影线稿 —— 三个尖峰 + 山脚弧线 */
export const SVG_MOUNTAIN_SECEDA = `
<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <g fill="none" stroke="#2a221c" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <!-- 远山 -->
    <path d="M0,150 L40,128 L72,140 L110,118 L150,134 L190,116 L230,132 L268,118 L320,140" opacity="0.45"/>
    <!-- 主山三尖 -->
    <path d="M20,170 L62,118 L78,138 L118,82 L142,114 L168,96 L196,124 L232,72 L256,108 L284,90 L320,148"/>
    <!-- 主山阴影侧（密线） -->
    <path d="M118,82 L132,108" stroke-width="1"/>
    <path d="M132,108 L146,128" stroke-width="0.8"/>
    <path d="M232,72 L246,98" stroke-width="1"/>
    <path d="M246,98 L260,118" stroke-width="0.8"/>
    <!-- 山脚 -->
    <path d="M0,170 Q160,184 320,170" />
    <!-- 一只很小的鸟 -->
    <path d="M260,40 q4,-4 8,0 q4,-4 8,0" stroke-width="1"/>
  </g>
</svg>
`.trim();

/**
 * 用一组相对坐标 [{x:0..1, y:0..1, label?}] 画一条手绘风路径。
 * 起点/终点/带 label 的点画小圆，路径用稍微抖动的曲线连。
 */
export function makeRouteSVG(points, opts = {}) {
  if (!points || points.length < 2) return "";
  const W = 320, H = 160;
  const dashed = !!opts.dashed;

  // 用 Catmull-Rom 风格的 cubic 把 points 串成曲线
  const pxPoints = points.map((p) => ({ x: p.x * W, y: p.y * H, label: p.label }));
  const path = catmullRomPath(pxPoints, 0.4);

  const dots = pxPoints
    .map((p, i) => {
      const isEdge = i === 0 || i === pxPoints.length - 1;
      const r = isEdge ? 3 : (p.label ? 2.5 : 1.6);
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="#2a221c"/>`;
    })
    .join("");

  const labels = pxPoints
    .filter((p) => p.label)
    .map((p) => {
      // 简单避让：靠右的标签往左偏
      const anchor = p.x > W * 0.6 ? "end" : "start";
      const dx = anchor === "end" ? -6 : 6;
      const dy = -7;
      return `<text x="${(p.x + dx).toFixed(1)}" y="${(p.y + dy).toFixed(1)}"
        font-family="Georgia, serif" font-size="10" font-style="italic"
        fill="#2a221c" text-anchor="${anchor}">${escapeXml(p.label)}</text>`;
    })
    .join("");

  return `
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <g fill="none" stroke="#2a221c" stroke-width="1.5" stroke-linecap="round">
    <path d="${path}" ${dashed ? 'stroke-dasharray="2 4"' : ""}/>
  </g>
  ${dots}
  ${labels}
</svg>
`.trim();
}

function catmullRomPath(pts, tension) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) * tension / 3;
    const c1y = p1.y + (p2.y - p0.y) * tension / 3;
    const c2x = p2.x - (p3.x - p1.x) * tension / 3;
    const c2y = p2.y - (p3.y - p1.y) * tension / 3;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
