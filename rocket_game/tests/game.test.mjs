import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, missionById, unlockedFor } from '../src/missions.js';
import { buildVehicle, validateProgram, burnoutTime } from '../src/vehicle.js';
import { simulate } from '../src/sim.js';
import { PLANET, orbitOf, timeToApoapsis, propagateKepler, circularSpeed } from '../src/planet.js';
import { defaultDesign, defaultProgram, syncProgram, fittingFairing } from '../src/defaults.js';
import { SOLUTIONS } from './solutions.mjs';

const clone = (x) => structuredClone(x);

test('すべてのミッションに達成できる参考解がある', () => {
  for (const m of MISSIONS) {
    const sol = SOLUTIONS[m.id];
    assert.ok(sol, `${m.id} の参考解がない`);
    const r = simulate(sol.design, sol.program, m);
    assert.ok(!r.aborted, `${m.id}: ${r.errors && r.errors.join(' / ')}`);
    assert.ok(r.success, `${m.id}: ${r.failure ? r.failure.message : r.checks.map((c) => c.text).join(' / ')}`);
    assert.ok(r.vehicle.cost <= m.budget, `${m.id}: 予算内`);
  }
});

test('パーツはミッションを進めるごとに解放される', () => {
  assert.ok(!unlockedFor('m1').diameters.has('M'));
  assert.ok(unlockedFor('m3').diameters.has('M'));
  assert.ok(unlockedFor('m7').engines.has('HL-20'));
  assert.ok(!unlockedFor('m4').les);
  assert.ok(unlockedFor('m5').les);
});

test('推進剤の合わないエンジンはエラーになる', () => {
  const m = missionById('m7');
  const d = clone(SOLUTIONS.m7.design);
  d.stages[1].engine = 'RK-40V';
  const v = buildVehicle(d, m);
  assert.ok(v.errors.some((e) => e.includes('ケロシン用')));
});

test('タンクの下に並べられるエンジン数には上限がある', () => {
  const m = missionById('m3');
  const d = clone(SOLUTIONS.m3.design);
  d.stages[0].engineCount = 5;
  assert.ok(buildVehicle(d, m).errors.some((e) => e.includes('4 基まで')));
});

test('ペイロードが入らないフェアリングはエラーになる', () => {
  const m = missionById('m4');
  const d = clone(SOLUTIONS.m4.design);
  d.fairing = { diameter: 'M', length: 6 };
  assert.ok(buildVehicle(d, m).errors.some((e) => e.includes('内径')));
  d.fairing = { diameter: 'L', length: 1 };
  assert.ok(buildVehicle(d, m).errors.some((e) => e.includes('収容長')));
});

test('予算超過・上段が太い・脱出塔なしの有人機はエラー', () => {
  const m5 = missionById('m5');
  const d = clone(SOLUTIONS.m5.design);
  d.les = false;
  assert.ok(buildVehicle(d, m5).errors.some((e) => e.includes('緊急脱出塔')));
  const d2 = clone(SOLUTIONS.m5.design);
  d2.stages[0].diameter = 'S';
  d2.stages[0].engine = 'RK-10';
  assert.ok(buildVehicle(d2, m5).errors.some((e) => e.includes('より太く')));
  const d3 = clone(SOLUTIONS.m5.design);
  d3.stages[0].tankLength = 40;
  assert.ok(buildVehicle(d3, m5).errors.some((e) => e.includes('予算超過')));
  const d4 = clone(SOLUTIONS.m5.design);
  d4.fairing = { diameter: 'M', length: 4 };
  assert.ok(buildVehicle(d4, m5).errors.some((e) => e.includes('フェアリングを外して')));
});

test('ブースターは第1段タンクが短すぎると付かない', () => {
  const m = missionById('m2');
  const d = clone(SOLUTIONS.m2.design);
  d.boosters = { type: 'SB-1', count: 2 };
  d.stages[0].tankLength = 5;
  assert.ok(buildVehicle(d, m).errors.some((e) => e.includes('取付')));
  d.stages[0].tankLength = 7;
  assert.ok(!buildVehicle(d, m).errors.some((e) => e.includes('取付')));
});

test('再着火できないエンジンで円化噴射を予定するとエラー', () => {
  const m = missionById('m2');
  const d = clone(SOLUTIONS.m2.design);
  d.stages[1].engine = 'RK-10';
  const v = buildVehicle(d, m);
  const pv = validateProgram(v, SOLUTIONS.m2.program, m);
  assert.ok(pv.errors.some((e) => e.includes('再着火できません')));
});

test('脱出塔は高度 25 km 未満で投棄できない', () => {
  const m = missionById('m5');
  const v = buildVehicle(SOLUTIONS.m5.design, m);
  const p = clone(SOLUTIONS.m5.program);
  p.lesAlt = 10e3;
  assert.ok(validateProgram(v, p, m).errors.some((e) => e.includes('25 km')));
});

test('推力不足では離床できない', () => {
  const m = missionById('m1');
  const d = clone(SOLUTIONS.m1.design);
  d.stages[0].tankLength = 30;
  const r = simulate(d, SOLUTIONS.m1.program, m);
  assert.ok(r.aborted ? r.errors.some((e) => e.includes('推力重量比')) : r.failure.kind === 'liftoff');
});

test('繊細なペイロードは全開のままだと加速度超過で壊れる', () => {
  const m = missionById('m3');
  const p = clone(SOLUTIONS.m3.program);
  Object.assign(p.stages[0], { throttle2: 100, throttle3: 100 });
  const r = simulate(SOLUTIONS.m3.design, p, m);
  assert.equal(r.failure && r.failure.kind, 'payload-g');
});

test('最大動圧付近で無理に倒すと曲げで壊れる', () => {
  const m = missionById('m4');
  const p = clone(SOLUTIONS.m4.program);
  p.pitch.maxQAlpha = 300;
  p.pitch.endAlt = 15000;
  p.pitch.endAngle = 85;
  const r = simulate(SOLUTIONS.m4.design, p, m);
  assert.equal(r.failure && r.failure.kind, 'structure');
  assert.match(r.failure.message, /曲げ|動圧/);
});

test('フェアリングを低く分離するとペイロードが空力加熱で損傷する', () => {
  const m = missionById('m2');
  const p = clone(SOLUTIONS.m2.program);
  p.fairingAlt = 20e3;
  const r = simulate(SOLUTIONS.m2.design, p, m);
  assert.equal(r.failure && r.failure.kind, 'payload-q');
});

test('軌道要素: 円軌道の近地点・遠地点', () => {
  const r = { x: 0, y: PLANET.radius + 100e3 };
  const v = { x: circularSpeed(100e3), y: 0 };
  const o = orbitOf(r, v);
  assert.ok(Math.abs(o.periapsis - r.y) < 10);
  assert.ok(Math.abs(o.apoapsis - r.y) < 10);
});

test('ケプラー伝播で遠地点に着く', () => {
  const r = { x: 0, y: PLANET.radius + 80e3 };
  const v = { x: circularSpeed(80e3) * 1.05, y: 0 };
  const tta = timeToApoapsis(r, v);
  const res = propagateKepler(r, v, tta);
  const o = orbitOf(r, v);
  assert.ok(Math.abs(Math.hypot(res.r.x, res.r.y) - o.apoapsis) < 50);
});

test('燃え尽き時刻はスロットル設定を反映する', () => {
  const m = missionById('m3');
  const v = buildVehicle(SOLUTIONS.m3.design, m);
  const s = v.stages[0];
  const full = s.propMass / s.mdotVac;
  const base = { throttle: 100, switchAt: 0, throttle2: 100, switchAt2: 0, throttle3: 100 };
  assert.ok(Math.abs(burnoutTime(s, base) - full) < 1e-6);
  assert.ok(Math.abs(burnoutTime(s, { ...base, throttle: 50 }) - full * 2) < 1e-6);
  const t = burnoutTime(s, { ...base, switchAt: 10, throttle2: 50 });
  assert.ok(Math.abs(t - (10 + (full - 10) * 2)) < 1e-6);
});

test('初期設計は打ち上げ前のチェックで止まるだけで、例外を出さない', () => {
  for (const m of MISSIONS) {
    const d = defaultDesign(m);
    const p = syncProgram(d, defaultProgram(m));
    const r = simulate(d, p, m);
    assert.ok(r.aborted || r.ok);
  }
});

test('フェアリングの自動選定はペイロードを収める', () => {
  for (const m of MISSIONS) {
    if (m.payload.exposed) continue;
    const f = fittingFairing(m.payload);
    const d = { ...clone(SOLUTIONS[m.id].design), fairing: f };
    const v = buildVehicle(d, m);
    assert.ok(!v.errors.some((e) => e.includes('内径') || e.includes('収容長')), `${m.id}: ${v.errors.join(' / ')}`);
  }
});
