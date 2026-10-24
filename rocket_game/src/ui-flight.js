// 打ち上げの再生表示: 軌道図（Canvas）とテレメトリのグラフ。
import { PLANET, propagateKepler, orbitOf } from './planet.js';

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

// 最終軌道の楕円を点列で（束縛軌道のみ）
export function orbitPoints(result) {
  const o = result.final && result.final.orbit;
  if (!o || !o.bound || result.final.periapsisAlt < -PLANET.radius * 0.9) return null;
  const { r, v } = result.final;
  const ob = orbitOf(r, v);
  if (!ob.bound) return null;
  const period = 2 * Math.PI * Math.sqrt(ob.a ** 3 / PLANET.mu);
  const pts = [];
  for (let k = 0; k <= 180; k++) {
    const res = propagateKepler(r, v, (period * k) / 180);
    if (res) pts.push(res.r);
  }
  return pts;
}

export function drawTrajectory(canvas, result, upto, { orbit = null, showOrbit = false } = {}) {
  const { ctx, w, h } = fitCanvas(canvas);
  const tel = result.telemetry;
  const R = PLANET.radius;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = css('--sky');
  ctx.fillRect(0, 0, w, h);

  // 表示範囲: これまでの軌跡（＋最終軌道）を収める。最低 160 km 四方。
  const pts = tel.slice(0, upto + 1);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const add = (p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); };
  pts.forEach(add);
  add({ x: 0, y: R });
  if (showOrbit && orbit) orbit.forEach(add);
  const span = Math.max(160e3, maxX - minX, (maxY - minY) * (w / h));
  const cxw = (minX + maxX) / 2;
  const cyw = (minY + maxY) / 2;
  const s = (Math.min(w, h * (w / h)) * 0.86) / span;
  const sx = (x) => w / 2 + (x - cxw) * s;
  const sy = (y) => h / 2 - (y - cyw) * s;

  // 大気と惑星
  ctx.beginPath();
  ctx.arc(sx(0), sy(0), (R + PLANET.atmosphereTop) * s, 0, Math.PI * 2);
  ctx.fillStyle = css('--atmo');
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx(0), sy(0), R * s, 0, Math.PI * 2);
  ctx.fillStyle = css('--planet');
  ctx.fill();
  ctx.strokeStyle = css('--planet-edge');
  ctx.lineWidth = 1;
  ctx.stroke();

  // 最終軌道
  if (showOrbit && orbit) {
    ctx.beginPath();
    orbit.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = css('--orbit');
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 軌跡（燃焼中は太く）
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    ctx.beginPath();
    ctx.moveTo(sx(a.x), sy(a.y));
    ctx.lineTo(sx(b.x), sy(b.y));
    ctx.strokeStyle = b.thrust > 0 ? css('--burn') : css('--coast');
    ctx.lineWidth = b.thrust > 0 ? 2.5 : 1.5;
    ctx.stroke();
  }

  // 発射地点と現在位置
  ctx.fillStyle = css('--ink');
  ctx.beginPath(); ctx.arc(sx(0), sy(R), 3, 0, Math.PI * 2); ctx.fill();
  const cur = pts[pts.length - 1];
  if (cur) {
    ctx.beginPath();
    ctx.arc(sx(cur.x), sy(cur.y), 5, 0, Math.PI * 2);
    ctx.fillStyle = result.failure && upto >= tel.length - 1 ? css('--bad') : css('--accent');
    ctx.fill();
  }

  // 縮尺バー
  const niceKm = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const target = (w * 0.22) / s / 1000;
  const km = niceKm.find((k) => k >= target) || 5000;
  const len = km * 1000 * s;
  ctx.strokeStyle = css('--muted');
  ctx.fillStyle = css('--muted');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(14, h - 16); ctx.lineTo(14 + len, h - 16);
  ctx.moveTo(14, h - 20); ctx.lineTo(14, h - 12);
  ctx.moveTo(14 + len, h - 20); ctx.lineTo(14 + len, h - 12);
  ctx.stroke();
  ctx.font = '11px ' + css('--font-data');
  ctx.fillText(`${km.toLocaleString('ja-JP')} km`, 18 + len, h - 12);
}

// 1 系列の折れ線グラフ。limit があれば赤い横線、cursor は再生位置。
export function drawChart(canvas, xs, ys, { label, unit, limit = null, xMax, cursor = null, color, digits = 0 }) {
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const padL = 40, padR = 8, padT = 18, padB = 18;
  let yMax = Math.max(1e-9, ...ys.filter((_, i) => xs[i] <= xMax));
  if (limit != null) yMax = Math.max(yMax, limit * 1.08);
  yMax = niceCeil(yMax);
  const X = (x) => padL + (x / xMax) * (w - padL - padR);
  const Yp = (y) => h - padB - (y / yMax) * (h - padT - padB);
  ctx.font = '10.5px ' + css('--font-data');
  ctx.fillStyle = css('--muted');
  ctx.strokeStyle = css('--grid');
  ctx.lineWidth = 1;
  for (let k = 0; k <= 2; k++) {
    const yv = (yMax * k) / 2;
    ctx.beginPath(); ctx.moveTo(padL, Yp(yv)); ctx.lineTo(w - padR, Yp(yv)); ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(fmt(yv, digits), padL - 5, Yp(yv) + 3.5);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = css('--ink');
  ctx.font = '600 11px ' + css('--font-body');
  ctx.fillText(`${label}（${unit}）`, padL, 12);
  ctx.font = '10.5px ' + css('--font-data');
  ctx.fillStyle = css('--muted');
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(xMax)} s`, w - padR, h - 4);
  ctx.textAlign = 'left';
  ctx.fillText('0', padL, h - 4);

  if (limit != null) {
    ctx.strokeStyle = css('--bad');
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(padL, Yp(limit)); ctx.lineTo(w - padR, Yp(limit)); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > xMax) break;
    if (cursor != null && xs[i] > cursor) break;
    const px = X(xs[i]), py = Yp(ys[i]);
    if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = color || css('--accent');
  ctx.lineWidth = 1.75;
  ctx.stroke();
  if (cursor != null && cursor <= xMax) {
    ctx.strokeStyle = css('--muted');
    ctx.beginPath(); ctx.moveTo(X(cursor), padT); ctx.lineTo(X(cursor), h - padB); ctx.stroke();
  }
}

function niceCeil(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}
function fmt(v, digits) {
  return v.toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
