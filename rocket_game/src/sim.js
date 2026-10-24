// 打ち上げシミュレーション（2 次元・質点＋構造チェック）。飛行計画どおりに自動で飛ぶ。
import { G0, ispAt } from './parts.js';
import { PLANET, atmosphere, orbitOf, timeToApoapsis, propagateKepler } from './planet.js';
import { buildVehicle, validateProgram, throttleAt } from './vehicle.js';

export const GUST_AOA = 3 * Math.PI / 180; // 設計用の突風迎角
export const CN_ALPHA = 1.0;               // 法線力傾斜（1/rad）
const MAX_TIME = 86400;
export const PITCH_EXP = +(globalThis.process?.env?.PEXP || 0.5);

function cdFor(state) {
  if (state.fairingOn) return 0.3;
  if (state.payloadExposedByDesign) return state.lesOn ? 0.35 : 0.5;
  return 0.6;
}

export function circAdvice(r, v, mass, stage, throttle) {
  const o = orbitOf(r, v);
  if (!o.bound) return null;
  const vApo = Math.abs(o.h) / o.apoapsis;
  const dv = Math.sqrt(PLANET.mu / o.apoapsis) - vApo;
  const ve = stage.engine.ispVac * G0;
  const mdot = stage.mdotVac * throttle;
  const burnTime = mass * (1 - Math.exp(-dv / ve)) / mdot;
  return { dv, burnTime, tta: timeToApoapsis(r, v), propNeeded: mass * (1 - Math.exp(-dv / ve)), propLeft: stage.propLeft };
}

export function simulate(design, program, mission) {
  const vehicle = buildVehicle(design, mission);
  const pv = vehicle.errors.length ? { errors: [], warnings: [] } : validateProgram(vehicle, program, mission);
  if (vehicle.errors.length || pv.errors.length) {
    return { ok: false, aborted: true, errors: [...vehicle.errors, ...pv.errors], vehicle };
  }

  const R = PLANET.radius;
  const stages = vehicle.stages.map((s) => ({ ...s, propLeft: s.propMass, ignitionsLeft: s.engine.ignitions }));
  const last = stages.length - 1;
  const bst = vehicle.boosters ? { ...vehicle.boosters, propLeft: vehicle.boosters.prop, attached: true } : null;
  const payload = vehicle.payload;

  const st = {
    t: 0, x: 0, y: R, vx: 0, vy: 0,
    si: 0, phase: 'burn', burnT: 0, coastT: 0,
    fairingOn: !!vehicle.fairing, lesOn: !!vehicle.les, payloadExposedByDesign: !!payload.exposed,
    liftoff: false, pitchStarted: false,
  };
  stages[0].ignitionsLeft -= 1;

  const events = [];
  const telemetry = [];
  const log = (text, kind = 'info') => events.push({ t: st.t, alt: Math.hypot(st.x, st.y) - R, text, kind });
  const margins = {}; // 要素ごとの最大荷重比
  const stats = { maxQ: 0, maxQt: 0, maxG: 0, maxGt: 0, apex: 0 };
  let failure = null;
  const fail = (kind, message) => { failure = { t: st.t, alt: Math.hypot(st.x, st.y) - R, kind, message }; log(message, 'fail'); };

  log(`第1段点火（${stages[0].engine.id} × ${stages[0].count}${bst ? `、${bst.spec.id} × ${bst.count}` : ''}）`);

  const activeElements = () => vehicle.elements.filter((e) => {
    if (typeof e.stage === 'number') return e.stage >= st.si;
    if (e.key === 'fairing') return st.fairingOn;
    if (e.key === 'les') return st.lesOn;
    return true;
  });
  let elems = activeElements();
  const refresh = () => { elems = activeElements(); };

  const massOf = (e) => e.mass + (e.kind === 'tank' ? stages[e.stage].propLeft : 0);
  const totalMass = () => elems.reduce((m, e) => m + massOf(e), 0) + (bst && bst.attached ? bst.dry + bst.propLeft : 0);

  const sample = (q, g, thrust, m) => {
    telemetry.push({ t: st.t, x: st.x, y: st.y, alt: Math.hypot(st.x, st.y) - R, v: Math.hypot(st.vx, st.vy), q, g, thrust, mass: m, phase: st.phase, si: st.si });
  };
  let nextSample = 0;

  const separate = () => {
    const s = stages[st.si];
    if (bst && bst.attached && st.si === 0) {
      bst.attached = false;
      if (bst.propLeft > 0) log('ブースター燃焼中に第1段を分離しました', 'warn');
    }
    log(`${s.label}分離`);
    st.si += 1;
    refresh();
  };

  const logOrbit = () => {
    const o = orbitOf({ x: st.x, y: st.y }, { x: st.vx, y: st.vy });
    if (o.energy < 0 && !o.bound) log(`現在の軌道: ほぼ真上への弾道飛行（最高到達 ${((-PLANET.mu / o.energy - R) / 1000).toFixed(1)} km）`, 'orbit');
    else if (!o.bound) log(`現在の軌道: 脱出軌道（無限遠速度 ${Math.sqrt(2 * o.energy).toFixed(0)} m/s）`, 'orbit');
    else log(`現在の軌道: 遠地点 ${((o.apoapsis - R) / 1000).toFixed(1)} km / 近地点 ${((o.periapsis - R) / 1000).toFixed(1)} km`, 'orbit');
  };
  // 遠地点で円軌道にするのに必要な Δv と、円化噴射の設定値での噴射時間の目安
  const logCircAdvice = (s) => {
    // 遠地点までに分離予定のフェアリング・脱出塔は質量から除く
    const o = orbitOf({ x: st.x, y: st.y }, { x: st.vx, y: st.vy });
    let mass = totalMass();
    if (o.bound) {
      const apoAlt = o.apoapsis - R;
      if (st.fairingOn && vehicle.fairing && program.fairingAlt <= apoAlt) mass -= vehicle.fairing.mass;
      if (st.lesOn && vehicle.les && program.lesAlt <= apoAlt) mass -= vehicle.les.mass;
    }
    const adv = circAdvice({ x: st.x, y: st.y }, { x: st.vx, y: st.vy }, mass, s, program.circ.throttle / 100);
    if (adv) log(`遠地点で円軌道にするには Δv ≈ ${adv.dv.toFixed(0)} m/s（噴射時間の目安 ${adv.burnTime.toFixed(1)} 秒、遠地点到達まで ${adv.tta.toFixed(0)} 秒）`, 'orbit');
  };

  const ignite = (s, label) => {
    if (s.ignitionsLeft <= 0) { fail('ignition', `${s.label}の ${s.engine.id} は着火回数を使い切っています`); return false; }
    s.ignitionsLeft -= 1;
    log(label);
    return true;
  };

  while (!failure) {
    const rm = Math.hypot(st.x, st.y);
    const alt = rm - R;
    const ux = st.x / rm, uy = st.y / rm;      // 鉛直上向き
    const hx = uy, hy = -ux;                   // 水平（東向き）
    const speed = Math.hypot(st.vx, st.vy);
    const vr = st.vx * ux + st.vy * uy;
    const vh = st.vx * hx + st.vy * hy;
    const gamma = speed > 1 ? Math.atan2(vh, vr) : 0; // 速度ベクトルの鉛直からの角度
    const atm = atmosphere(alt);
    const q = 0.5 * atm.density * speed * speed;
    const s = stages[st.si];
    const prog = program.stages[st.si];

    // --- 推力 ---
    let throttle = 0;
    if (st.phase === 'burn') throttle = throttleAt(prog, st.burnT) / 100;
    else if (st.phase === 'circBurn') throttle = program.circ.throttle / 100;
    const engineOn = throttle > 0 && s.propLeft > 0;
    const mdotC = engineOn ? s.mdotVac * throttle : 0;
    let thrust = mdotC * ispAt(s.engine, atm.pressureRatio) * G0;
    let mdotB = 0;
    if (bst && bst.attached && bst.propLeft > 0) {
      mdotB = bst.mdot;
      thrust += mdotB * (bst.spec.ispVac + (bst.spec.ispSL - bst.spec.ispVac) * atm.pressureRatio) * G0;
    }

    // --- 姿勢 ---
    // 高度に応じたピッチプログラム: 開始高度から終了高度までに、鉛直から終了角まで倒す（平方根カーブ）。
    // 終了高度より上では終了角を保つが、軌道の方が寝ていれば速度方向（プログラード）に合わせる。
    const pp = program.pitch;
    let phi = 0;
    if (st.liftoff && alt > pp.startAlt) {
      if (!st.pitchStarted) { st.pitchStarted = true; log(`ピッチ操作開始（${pp.endAngle}° まで）`); }
      const frac = Math.min(1, (alt - pp.startAlt) / Math.max(1, pp.endAlt - pp.startAlt));
      phi = (pp.endAngle * Math.PI / 180) * Math.pow(frac, PITCH_EXP);
      if (frac >= 1) phi = Math.max(phi, gamma);
      // qα 制限: 動圧 × 迎角 が上限を超えないよう、速度方向からのずれを抑える
      const amax = Math.min(Math.PI / 2, (pp.maxQAlpha * 1000 / Math.max(q, 1)) * Math.PI / 180);
      phi = Math.min(gamma + amax, Math.max(gamma - amax, phi));
    }
    const guidance = st.phase === 'burn' && st.si > 0 ? prog.guidance : st.phase === 'circBurn' ? program.circ.guidance : 'program';
    if (guidance === 'horizontal') phi = Math.PI / 2;
    else if (guidance === 'prograde') phi = gamma;
    if (thrust === 0) phi = gamma; // 慣性飛行中は気流に沿う
    const aoa = speed > 20 ? Math.min(Math.PI / 2, Math.abs(phi - gamma)) : 0;
    const tx = Math.cos(phi) * ux + Math.sin(phi) * hx;
    const ty = Math.cos(phi) * uy + Math.sin(phi) * hy;

    // --- 力 ---
    const m = totalMass();
    const dmax = Math.max(...elems.map((e) => e.diameter));
    let area = Math.PI * dmax * dmax / 4;
    if (bst && bst.attached) area += bst.count * Math.PI * bst.d * bst.d / 4 * 0.5;
    const drag = q * cdFor(st) * area;
    const dx = speed > 0 ? -st.vx / speed * drag : 0;
    const dy = speed > 0 ? -st.vy / speed * drag : 0;
    const gmag = PLANET.mu / (rm * rm);
    let ax = (thrust * tx + dx) / m - gmag * ux;
    let ay = (thrust * ty + dy) / m - gmag * uy;
    const gLoad = Math.hypot(thrust * tx + dx, thrust * ty + dy) / m / G0;

    // 発射台上
    if (!st.liftoff) {
      if (thrust > m * gmag) { st.liftoff = true; log('離床'); }
      else {
        ax = 0; ay = 0;
        if (st.t > 5) { fail('liftoff', '推力が機体重量に届かず、発射台から浮き上がりません'); break; }
      }
    }

    // --- 構造・ペイロードのチェック ---
    if (q > stats.maxQ) { stats.maxQ = q; stats.maxQt = st.t; }
    if (gLoad > stats.maxG && st.liftoff) { stats.maxG = gLoad; stats.maxGt = st.t; }
    if (st.liftoff) {
      const top = Math.max(...elems.map((e) => e.z0 + e.length));
      let above = 0;
      let dref = 0;
      // 上から順に積算。アダプタはペイロード（＋脱出塔）だけを支える。
      const ordered = [...elems].sort((a, b) => (b.z0 + b.length) - (a.z0 + a.length) || b.z0 - a.z0);
      const payloadMass = payload.mass + (st.lesOn && vehicle.les ? vehicle.les.mass : 0);
      for (const e of ordered) {
        above += massOf(e);
        dref = Math.max(dref, e.diameter);
        let axial;
        if (e.kind === 'adapter') axial = payloadMass * Math.max(0, thrust - drag) / m + (st.payloadExposedByDesign ? drag : 0);
        else axial = above * (thrust - drag) / m + drag;
        const L = top - e.z0;
        const bend = q * CN_ALPHA * (GUST_AOA + aoa) * dref * L * L / 2;
        let ratio = 0;
        let why = '';
        if (e.axial) { const r = axial / e.axial; if (r > ratio) { ratio = r; why = `圧縮荷重 ${Math.round(axial / 1000)} kN（許容 ${Math.round(e.axial / 1000)} kN）`; } }
        if (e.bend) { const r = bend / e.bend; if (r > ratio) { ratio = r; why = `曲げモーメント ${Math.round(bend / 1000)} kN·m（許容 ${Math.round(e.bend / 1000)} kN·m）`; } }
        if (e.maxQ) { const r = q / e.maxQ; if (r > ratio) { ratio = r; why = `動圧 ${(q / 1000).toFixed(1)} kPa（許容 ${(e.maxQ / 1000).toFixed(0)} kPa）`; } }
        if (ratio > (margins[e.key] || 0)) margins[e.key] = ratio;
        if (ratio > 1) { fail('structure', `${e.label}が破壊: ${why}`); break; }
      }
      if (failure) break;
      if (gLoad > payload.maxG) { fail('payload-g', `${payload.name}が損傷: 加速度 ${gLoad.toFixed(2)} G（許容 ${payload.maxG} G）`); break; }
      if (!st.fairingOn && q > payload.maxQExposed) { fail('payload-q', `${payload.name}が空力加熱で損傷: 動圧 ${(q / 1000).toFixed(2)} kPa（許容 ${(payload.maxQExposed / 1000).toFixed(2)} kPa）`); break; }
    }

    if (st.t >= nextSample) { sample(q, gLoad, thrust, m); nextSample = st.t + (thrust > 0 || alt < PLANET.atmosphereTop ? 1 : 5); }

    // 真空中で円化噴射を待つ間はケプラー運動で一気に進める
    if (st.phase === 'circWait' && thrust === 0 && alt > PLANET.atmosphereTop && !st.fairingOn && !st.lesOn) {
      const r0 = { x: st.x, y: st.y }, v0 = { x: st.vx, y: st.vy };
      const jump = timeToApoapsis(r0, v0) - program.circ.lead - 10;
      if (jump > 30 && orbitOf(r0, v0).rv > 0) {
        const N = Math.min(120, Math.ceil(jump / 10));
        let ok = true;
        for (let k = 1; k <= N && ok; k++) {
          const res = propagateKepler(r0, v0, jump * k / N);
          if (!res) { ok = false; break; }
          if (k === N) { st.x = res.r.x; st.y = res.r.y; st.vx = res.v.x; st.vy = res.v.y; }
          telemetry.push({ t: st.t + jump * k / N, x: res.r.x, y: res.r.y, alt: Math.hypot(res.r.x, res.r.y) - R, v: Math.hypot(res.v.x, res.v.y), q: 0, g: 0, thrust: 0, mass: m, phase: st.phase, si: st.si });
        }
        if (ok) {
          st.t += jump; nextSample = st.t + 5;
          const a2 = Math.hypot(st.x, st.y) - R;
          if (a2 > stats.apex) stats.apex = a2;
          continue;
        }
      }
    }

    // --- 時間刻み ---
    let dt = thrust > 0 ? (alt < PLANET.atmosphereTop ? 0.05 : 0.1) : (alt < PLANET.atmosphereTop ? 0.2 : 0.5);
    if (st.phase === 'circWait') {
      const tta = timeToApoapsis({ x: st.x, y: st.y }, { x: st.vx, y: st.vy });
      if (tta - program.circ.lead < 3) dt = 0.05;
    }
    if (engineOn) {
      const limit = st.phase === 'burn' ? prog.duration : program.circ.duration;
      dt = Math.min(dt, Math.max(1e-3, limit - st.burnT), Math.max(1e-3, s.propLeft / mdotC));
      if (st.phase === 'burn') for (const sw of [prog.switchAt, prog.switchAt2]) if (sw > st.burnT) dt = Math.min(dt, Math.max(1e-3, sw - st.burnT));
    }
    if (mdotB > 0) dt = Math.min(dt, Math.max(1e-3, bst.propLeft / mdotB));

    // --- 積分（半陰的オイラー） ---
    if (st.liftoff) {
      st.vx += ax * dt; st.vy += ay * dt;
      st.x += st.vx * dt; st.y += st.vy * dt;
    }
    st.t += dt;
    if (engineOn) { s.propLeft = Math.max(0, s.propLeft - mdotC * dt); st.burnT += dt; }
    else if (st.phase === 'burn' || st.phase === 'circBurn') st.burnT += dt;
    if (mdotB > 0) bst.propLeft = Math.max(0, bst.propLeft - mdotB * dt);

    const alt2 = Math.hypot(st.x, st.y) - R;
    if (alt2 > stats.apex) stats.apex = alt2;
    if (st.liftoff && alt2 < 0) { fail('crash', '地表に墜落しました'); break; }

    // --- イベント ---
    if (bst && bst.attached && bst.propLeft <= 1e-6) {
      bst.attached = false;
      log(`ブースター燃焼終了・分離（${bst.spec.id} × ${bst.count}）`);
    }
    if (st.fairingOn && alt2 >= program.fairingAlt) { st.fairingOn = false; refresh(); log('フェアリング分離'); }
    if (st.lesOn && alt2 >= program.lesAlt) { st.lesOn = false; refresh(); log('緊急脱出塔を投棄'); }

    if (st.phase === 'burn' || st.phase === 'circBurn') {
      const limit = st.phase === 'burn' ? prog.duration : program.circ.duration;
      const depleted = s.propLeft <= 1e-6;
      if (st.burnT >= limit - 1e-9 || depleted) {
        const what = st.phase === 'burn' ? `${s.label}燃焼終了` : '円化噴射終了';
        log(depleted && st.burnT < limit - 0.05 ? `${what}（推進剤を使い切りました）` : what, depleted && st.burnT < limit - 0.05 ? 'warn' : 'info');
        if (st.si < last && st.phase === 'burn') logOrbit();
        if (st.phase === 'burn' && st.si < last) {
          separate();
          st.phase = 'coast'; st.coastT = 0;
          if (prog.coast <= 0) { st.phase = 'burn'; st.burnT = 0; if (!ignite(stages[st.si], `${stages[st.si].label}点火`)) break; }
        } else if (st.phase === 'burn' && program.circ && program.circ.enabled) {
          logOrbit();
          if (s.propLeft <= 1e-6) { log('円化噴射用の推進剤が残っていません', 'warn'); st.phase = 'done'; }
          else { st.phase = 'circWait'; logCircAdvice(s); }
        } else { logOrbit(); st.phase = 'done'; }
      }
    } else if (st.phase === 'coast') {
      st.coastT += dt;
      if (st.coastT >= program.stages[st.si - 1].coast - 1e-9) {
        st.phase = 'burn'; st.burnT = 0;
        if (!ignite(stages[st.si], `${stages[st.si].label}点火`)) break;
      }
    } else if (st.phase === 'circWait') {
      const r = { x: st.x, y: st.y }, v = { x: st.vx, y: st.vy };
      const o = orbitOf(r, v);
      const tta = timeToApoapsis(r, v);
      if (o.bound && (tta <= program.circ.lead || o.rv < 0)) {
        if (o.rv < 0 && tta > program.circ.lead) log('遠地点を過ぎてから円化噴射を開始しました', 'warn');
        st.phase = 'circBurn'; st.burnT = 0;
        if (!ignite(s, '円化噴射開始')) break;
      }
    }

    if (st.phase === 'done' || st.phase === 'circWait') {
      const r = { x: st.x, y: st.y }, v = { x: st.vx, y: st.vy };
      const o = orbitOf(r, v);
      const vr2 = o.rv / Math.hypot(st.x, st.y);
      const pendingJettison = (st.fairingOn && vehicle.fairing) || (st.lesOn && vehicle.les);
      if (st.phase === 'done') {
        if (mission.objective.type === 'altitude') { if (vr2 < 0) break; }
        else if (alt2 >= PLANET.atmosphereTop && !pendingJettison && (!o.bound || o.periapsis - R >= PLANET.atmosphereTop)) break;
        else if (vr2 < 0 && alt2 >= PLANET.atmosphereTop) break;
        else if (vr2 < 0 && o.periapsis - R < 0) { /* 落下中: 墜落まで追う */ }
      }
      if (st.phase === 'circWait' && !o.bound) { log('脱出軌道のため円化噴射を行いません', 'warn'); st.phase = 'done'; }
    }
    if (st.t > MAX_TIME) { fail('timeout', '飛行計画が終わりません（24 時間で打ち切り）'); break; }
  }
  sample(0, 0, 0, totalMass());

  // --- 判定 ---
  const r = { x: st.x, y: st.y }, v = { x: st.vx, y: st.vy };
  const orbit = orbitOf(r, v);
  const final = {
    apex: stats.apex,
    periapsisAlt: orbit.periapsis - R,
    apoapsisAlt: orbit.bound ? orbit.apoapsis - R : Infinity,
    bound: orbit.bound,
    vInf: orbit.energy > 0 ? Math.sqrt(2 * orbit.energy) : 0,
    e: orbit.e,
    orbit,
    r, v,
  };
  const checks = [];
  const o = mission.objective;
  if (!failure) {
    if (vehicle.fairing && st.fairingOn) checks.push({ ok: false, text: 'フェアリングが分離されていません（分離高度に届いていない）' });
    if (o.type === 'altitude') {
      checks.push({ ok: final.apex >= o.minApex, text: `最高到達高度 ${(final.apex / 1000).toFixed(1)} km（目標 ${o.minApex / 1000} km 以上）` });
    } else if (o.type === 'orbit') {
      checks.push({ ok: final.periapsisAlt >= o.minPeriapsis, text: `近地点 ${(final.periapsisAlt / 1000).toFixed(1)} km（目標 ${o.minPeriapsis / 1000} km 以上）` });
      const apoText = Number.isFinite(final.apoapsisAlt) ? `${(final.apoapsisAlt / 1000).toFixed(1)} km` : '脱出軌道';
      if (o.minApoapsis) checks.push({ ok: final.bound && final.apoapsisAlt >= o.minApoapsis && final.apoapsisAlt <= o.maxApoapsis, text: `遠地点 ${apoText}（目標 ${o.minApoapsis / 1000}〜${o.maxApoapsis / 1000} km）` });
      else checks.push({ ok: final.bound && final.apoapsisAlt <= o.maxApoapsis, text: `遠地点 ${apoText}（目標 ${o.maxApoapsis / 1000} km 以下）` });
    } else if (o.type === 'escape') {
      checks.push({ ok: !final.bound && final.vInf >= o.minVInf, text: final.bound ? `重力圏を脱出できていません（遠地点 ${(final.apoapsisAlt / 1000).toFixed(0)} km）` : `無限遠速度 ${final.vInf.toFixed(0)} m/s（目標 ${o.minVInf} m/s 以上）` });
    }
  }
  const success = !failure && checks.every((c) => c.ok);
  const stars = success ? 1 + (vehicle.cost <= mission.costTargets[0] ? 1 : 0) + (vehicle.cost <= mission.costTargets[1] ? 1 : 0) : 0;
  if (success) log('ミッション達成', 'success');

  return {
    ok: true, success, stars, failure, checks, final, stats, events, telemetry, margins,
    warnings: [...vehicle.warnings, ...pv.warnings], vehicle, duration: st.t,
  };
}
