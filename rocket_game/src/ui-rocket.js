// 機体側面図（SVG）。縮尺は全長に合わせる。margins を渡すと最大荷重比で色分けする。
import { DIAMETERS, BOOSTERS } from './parts.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function marginClass(r) {
  if (r == null) return '';
  if (r >= 1) return 'm-bad';
  if (r >= 0.85) return 'm-hot';
  if (r >= 0.6) return 'm-warm';
  return 'm-ok';
}

export function renderRocket(vehicle, { margins = null, height = 560, width = 320 } = {}) {
  const els = vehicle.elements;
  if (!els.length) return '<svg class="rocket-svg" viewBox="0 0 10 10"></svg>';
  const top = vehicle.height;
  const b = vehicle.boosters;
  const halfW = Math.max(...els.map((e) => e.diameter / 2)) + (b ? b.d * 1.05 : 0);
  const padTop = 14, padBottom = 26, rulerW = 34, labelW = 116;
  const scale = Math.min((height - padTop - padBottom) / top, (width - rulerW - labelW - 16) / (halfW * 2));
  const cx = rulerW + 8 + halfW * scale;
  const Y = (z) => height - padBottom - z * scale;
  const W = (d) => d * scale;
  const parts = [];
  const labels = [];
  const fill = (e, base) => (margins && margins[e.key] != null ? `class="part ${marginClass(margins[e.key])}"` : `class="part ${base}"`);

  // 定規
  const step = top > 60 ? 10 : 5;
  parts.push(`<line class="ruler" x1="${rulerW}" y1="${Y(0)}" x2="${rulerW}" y2="${Y(top)}"/>`);
  for (let z = 0; z <= top + 1e-6; z += step) {
    parts.push(`<line class="ruler" x1="${rulerW - 5}" y1="${Y(z)}" x2="${rulerW}" y2="${Y(z)}"/><text class="ruler-t" x="${rulerW - 8}" y="${Y(z) + 3.5}" text-anchor="end">${z}</text>`);
  }
  parts.push(`<text class="ruler-t" x="${rulerW - 8}" y="${height - 6}" text-anchor="end">m</text>`);
  parts.push(`<line class="ground" x1="${rulerW}" y1="${Y(0)}" x2="${width - 4}" y2="${Y(0)}"/>`);

  // ブースター
  if (b) {
    const spec = BOOSTERS[b.spec.id];
    const coreR = vehicle.stages[0].d / 2;
    const offs = b.count === 4 ? [-1, 1] : [-1, 1];
    for (const sgn of offs) {
      const x0 = cx + sgn * (coreR + b.d / 2) * scale - W(b.d) / 2;
      const y1 = Y(b.z0 + spec.length);
      const y0 = Y(b.z0);
      const cls = b.count === 4 ? 'part booster booster4' : 'part booster';
      parts.push(`<path ${'class="' + cls + '"'} d="M${x0},${y0} L${x0},${y1 + W(b.d) * 0.8} L${x0 + W(b.d) / 2},${y1} L${x0 + W(b.d)},${y1 + W(b.d) * 0.8} L${x0 + W(b.d)},${y0} Z"/>`);
      parts.push(`<path class="part bell" d="M${x0 + W(b.d) * 0.25},${y0} L${x0 + W(b.d) * 0.75},${y0} L${x0 + W(b.d) * 0.9},${y0 + W(0.9)} L${x0 + W(b.d) * 0.1},${y0 + W(0.9)} Z"/>`);
    }
    labels.push({ y: Y(b.z0 + spec.length * 0.5), text: `${b.spec.id} ×${b.count}` });
  }

  for (const e of els) {
    const d = e.diameter;
    if (e.kind === 'engine') {
      const st = vehicle.stages[e.stage];
      const len = e.drawLength || e.length;
      const yTop = Y(e.z0 + e.length);
      const yBot = yTop + len * scale;
      const n = st.count;
      const tankD = st.d;
      const bw = Math.min(DIAMETERS[st.engine.diameter].d * 0.8, (tankD / n) * 0.95);
      const cols = n <= 4 ? n : Math.ceil(Math.sqrt(n));
      const used = Math.min(cols, n);
      for (let i = 0; i < used; i++) {
        const xc = cx + (i - (used - 1) / 2) * (tankD / used) * scale;
        const tw = W(bw * 0.35), bwid = W(bw);
        parts.push(`<path class="part bell${e.nested ? ' nested' : ''}" d="M${xc - tw / 2},${yTop} L${xc + tw / 2},${yTop} L${xc + bwid / 2},${yBot} L${xc - bwid / 2},${yBot} Z"/>`);
      }
      if (n > used) parts.push(`<text class="count-t" x="${cx}" y="${yBot + 11}" text-anchor="middle">×${n}</text>`);
      continue;
    }
    const y0 = Y(e.z0), y1 = Y(e.z0 + e.length);
    if (e.kind === 'tank') {
      const x = cx - W(d) / 2;
      const prop = e.prop === 'hydrolox' ? 'tank-lh2' : 'tank-rp1';
      parts.push(`<rect ${fill(e, prop)} x="${x}" y="${y1}" width="${W(d)}" height="${y0 - y1}"/>`);
      if (e.wallHeavy) parts.push(`<rect class="wall-heavy" x="${x}" y="${y1}" width="${W(d)}" height="${y0 - y1}"/>`);
      labels.push({ y: (y0 + y1) / 2, text: `第${e.stage + 1}段 ${e.length} m`, key: e.key });
    } else if (e.kind === 'interstage') {
      const td = e.topDiameter;
      parts.push(`<path ${fill(e, 'inter')} d="M${cx - W(d) / 2},${y0} L${cx + W(d) / 2},${y0} L${cx + W(td) / 2},${y1} L${cx - W(td) / 2},${y1} Z"/>`);
    } else if (e.kind === 'adapter') {
      const topD = Math.min(e.diameter, vehicle.payload.diameter);
      parts.push(`<path ${fill(e, 'adapter')} d="M${cx - W(topD * 0.9) / 2},${y0} L${cx + W(topD * 0.9) / 2},${y0} L${cx + W(topD * 0.6) / 2},${y1} L${cx - W(topD * 0.6) / 2},${y1} Z"/>`);
    } else if (e.kind === 'payload') {
      if (vehicle.payload.exposed) {
        parts.push(`<path class="part capsule" d="M${cx - W(d) / 2},${y0} L${cx + W(d) / 2},${y0} L${cx + W(d * 0.32) / 2},${y1} L${cx - W(d * 0.32) / 2},${y1} Z"/>`);
      } else {
        parts.push(`<rect class="payload" x="${cx - W(d) / 2}" y="${y1}" width="${W(d)}" height="${y0 - y1}" rx="${W(0.12)}"/>`);
      }
      labels.push({ y: (y0 + y1) / 2, text: 'ペイロード' });
    } else if (e.kind === 'fairing') {
      const f = vehicle.fairing;
      const yc = Y(e.z0 + f.cylinder);
      const x0 = cx - W(d) / 2, x1 = cx + W(d) / 2;
      parts.push(`<path ${fill(e, 'fairing')} d="M${x0},${y0} L${x0},${yc} C${x0},${yc - (yc - y1) * 0.55} ${cx - W(d) * 0.18},${y1 + 2} ${cx},${y1} C${cx + W(d) * 0.18},${y1 + 2} ${x1},${yc - (yc - y1) * 0.55} ${x1},${yc} L${x1},${y0} Z"/>`);
      labels.push({ y: (y0 + yc) / 2, text: `フェアリング ${f.diameter}`, key: e.key });
    } else if (e.kind === 'les') {
      parts.push(`<line class="les-rod" x1="${cx}" y1="${y0}" x2="${cx}" y2="${y1 + W(1.2)}"/>`);
      parts.push(`<rect class="part les" x="${cx - W(0.5) / 2}" y="${y1}" width="${W(0.5)}" height="${W(1.4)}" rx="${W(0.1)}"/>`);
      labels.push({ y: y1 + W(0.7), text: '脱出塔' });
    }
  }

  // ラベル（重ならないよう縦に押し出す）
  labels.sort((a, b2) => a.y - b2.y);
  let last = -Infinity;
  const lx = width - labelW + 6;
  for (const l of labels) {
    const y = Math.max(l.y, last + 13);
    last = y;
    const pct = margins && l.key && margins[l.key] != null ? ` ${Math.round(margins[l.key] * 100)}%` : '';
    parts.push(`<text class="label-t" x="${lx}" y="${y + 3.5}">${esc(l.text)}${pct ? `<tspan class="pct ${marginClass(margins[l.key])}">${pct}</tspan>` : ''}</text>`);
  }

  return `<svg class="rocket-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="機体側面図 全長 ${top.toFixed(1)} m">${parts.join('')}</svg>`;
}
