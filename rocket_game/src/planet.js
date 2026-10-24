// 舞台となる惑星「ホーム」。半径 600 km、地表重力 9.81 m/s^2、大気は高度 70 km まで。
import { G0 } from './parts.js';

export const PLANET = {
  name: 'ホーム',
  radius: 600e3,
  mu: G0 * 600e3 * 600e3,
  p0: 101325,
  rho0: 1.225,
  scaleHeight: 7000,
  atmosphereTop: 70e3,
};

export function atmosphere(alt) {
  if (alt >= PLANET.atmosphereTop) return { pressureRatio: 0, density: 0 };
  const f = Math.exp(-Math.max(0, alt) / PLANET.scaleHeight);
  return { pressureRatio: f, density: PLANET.rho0 * f };
}

// 2 次元の軌道要素。r, v は {x, y}。
export function orbitOf(r, v, mu = PLANET.mu) {
  const rm = Math.hypot(r.x, r.y);
  const v2 = v.x * v.x + v.y * v.y;
  const rv = r.x * v.x + r.y * v.y;
  const h = r.x * v.y - r.y * v.x;
  const energy = v2 / 2 - mu / rm;
  const k = v2 - mu / rm;
  const ex = (k * r.x - rv * v.x) / mu;
  const ey = (k * r.y - rv * v.y) / mu;
  const e = Math.hypot(ex, ey);
  const p = (h * h) / mu;
  const periapsis = p / (1 + e);
  const bound = energy < 0 && e < 1;
  const a = bound ? -mu / (2 * energy) : Infinity;
  const apoapsis = bound ? a * (1 + e) : Infinity;
  return { energy, e, a, h, periapsis, apoapsis, bound, ex, ey, rv };
}

// 次の遠地点までの時間（秒）。非束縛軌道では Infinity。
export function timeToApoapsis(r, v, mu = PLANET.mu) {
  const o = orbitOf(r, v, mu);
  if (!o.bound) return Infinity;
  const rm = Math.hypot(r.x, r.y);
  const n = Math.sqrt(mu / (o.a * o.a * o.a));
  if (o.e < 1e-6) return 0;
  let cosNu = (o.ex * r.x + o.ey * r.y) / (o.e * rm);
  cosNu = Math.max(-1, Math.min(1, cosNu));
  let nu = Math.acos(cosNu);
  if (o.rv < 0) nu = 2 * Math.PI - nu;
  const E = 2 * Math.atan2(Math.sqrt(1 - o.e) * Math.sin(nu / 2), Math.sqrt(1 + o.e) * Math.cos(nu / 2));
  let M = E - o.e * Math.sin(E);
  if (M < 0) M += 2 * Math.PI;
  const dM = M <= Math.PI ? Math.PI - M : 3 * Math.PI - M;
  return dM / n;
}

export function circularSpeed(alt) {
  return Math.sqrt(PLANET.mu / (PLANET.radius + alt));
}

// ケプラー運動で dt 秒後の状態を求める（楕円軌道のみ）。
export function propagateKepler(r, v, dt, mu = PLANET.mu) {
  const o = orbitOf(r, v, mu);
  if (!o.bound || o.e < 1e-9) return null;
  const rm = Math.hypot(r.x, r.y);
  const n = Math.sqrt(mu / (o.a ** 3));
  const w = Math.atan2(o.ey, o.ex);           // 近地点の方向
  const sgn = o.h >= 0 ? 1 : -1;              // 回転方向
  let nu = Math.atan2(r.y, r.x) - w;
  nu = sgn * nu;
  const E0 = 2 * Math.atan2(Math.sqrt(1 - o.e) * Math.sin(nu / 2), Math.sqrt(1 + o.e) * Math.cos(nu / 2));
  const M = E0 - o.e * Math.sin(E0) + n * dt;
  let E = M;
  for (let i = 0; i < 30; i++) E -= (E - o.e * Math.sin(E) - M) / (1 - o.e * Math.cos(E));
  const nu1 = 2 * Math.atan2(Math.sqrt(1 + o.e) * Math.sin(E / 2), Math.sqrt(1 - o.e) * Math.cos(E / 2));
  const p = o.a * (1 - o.e * o.e);
  const r1 = p / (1 + o.e * Math.cos(nu1));
  const ang = w + sgn * nu1;
  const vr = Math.sqrt(mu / p) * o.e * Math.sin(nu1);
  const vt = Math.sqrt(mu / p) * (1 + o.e * Math.cos(nu1));
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const tx = -sgn * uy, ty = sgn * ux;
  void rm;
  return { r: { x: r1 * ux, y: r1 * uy }, v: { x: vr * ux + vt * tx, y: vr * uy + vt * ty } };
}
