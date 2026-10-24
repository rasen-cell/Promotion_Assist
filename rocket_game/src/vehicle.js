// 設計データから機体を組み立て、制約チェックと性能見積もりを行う。
import {
  G0, DIAMETERS, PROPELLANTS, ENGINES, BOOSTERS, INTERSTAGE, INTERSTAGE_ADAPTER_FACTOR,
  ADAPTERS, LES, TANK_LENGTH, FAIRING_LENGTH, BOOSTER_MIN_CORE_RATIO,
  maxEngineCount, tankSpec, fairingSpec, massFlow,
} from './parts.js';
import { unlockedFor } from './missions.js';

export const ADAPTER_LENGTH = 0.4;

// 機体を組み立てる。errors が空なら打ち上げ可能。
export function buildVehicle(design, mission) {
  const errors = [];
  const warnings = [];
  const unlocked = unlockedFor(mission.id);
  const payload = mission.payload;
  const stagesIn = design.stages || [];

  if (stagesIn.length === 0) errors.push('段が 1 つもありません。');
  if (stagesIn.length > mission.maxStages) errors.push(`このミッションで使える段数は ${mission.maxStages} 段までです。`);

  const stages = [];
  const elements = [];
  let z = 0;
  let cost = 0;

  stagesIn.forEach((s, i) => {
    const label = `第${i + 1}段`;
    const dia = DIAMETERS[s.diameter];
    const prop = PROPELLANTS[s.prop];
    const engine = ENGINES[s.engine];
    if (!dia || !prop || !engine) { errors.push(`${label}: パーツが未選択です。`); return; }
    if (!unlocked.diameters.has(s.diameter)) errors.push(`${label}: 直径 ${s.diameter} はまだ使えません。`);
    if (!unlocked.props.has(s.prop)) errors.push(`${label}: ${prop.short} はまだ使えません。`);
    if (!unlocked.engines.has(s.engine)) errors.push(`${label}: エンジン ${engine.id} はまだ使えません。`);
    if (engine.prop !== s.prop) errors.push(`${label}: ${engine.id} は${PROPELLANTS[engine.prop].short}用です。タンクの推進剤と合いません。`);
    if (DIAMETERS[engine.diameter].d > dia.d) errors.push(`${label}: ${engine.id}（直径 ${engine.diameter}）は ${s.diameter} タンクの下に付きません。`);
    const maxN = DIAMETERS[engine.diameter].d > dia.d ? 0 : maxEngineCount(s.diameter, engine.diameter);
    const count = Math.max(1, Math.round(s.engineCount || 1));
    if (count > maxN && maxN > 0) errors.push(`${label}: ${s.diameter} タンクに ${engine.id} は ${maxN} 基までしか並びません。`);
    const length = Number(s.tankLength);
    if (!(length >= TANK_LENGTH.min && length <= TANK_LENGTH.max)) errors.push(`${label}: タンク長は ${TANK_LENGTH.min}〜${TANK_LENGTH.max} m です。`);
    if (i > 0) {
      const below = stagesIn[i - 1];
      if (DIAMETERS[below.diameter] && dia.d > DIAMETERS[below.diameter].d) errors.push(`${label}: 上段（${s.diameter}）が下段（${below.diameter}）より太くなっています。`);
    }

    const tank = tankSpec(s.diameter, s.prop, Math.max(0, length || 0), s.wall || 'std');
    const engineMass = engine.mass * count;
    const engineLen = engine.length;
    cost += tank.cost + engine.cost * count;

    // 1 段目のエンジンは最下部、上段のエンジンは段間部に収まる
    if (i === 0) {
      elements.push({ key: `s${i}-engine`, kind: 'engine', stage: i, label: `${label} エンジン`, z0: z, length: engineLen, diameter: dia.d, mass: engineMass });
      z += engineLen;
    }
    const tankEl = {
      key: `s${i}-tank`, kind: 'tank', stage: i, label: `${label} タンク`, z0: z, length, diameter: dia.d,
      mass: tank.dryMass, prop: s.prop, axial: tank.axial, bend: tank.bend, wallHeavy: s.wall === 'heavy',
    };
    elements.push(tankEl);
    z += length;
    if (i > 0) {
      // 上段エンジンは段間部の中にある（質量は上段に属する）
      elements.splice(elements.indexOf(tankEl), 0, { key: `s${i}-engine`, kind: 'engine', stage: i, label: `${label} エンジン`, z0: tankEl.z0, length: 0, drawLength: engineLen, diameter: DIAMETERS[engine.diameter].d, mass: engineMass, nested: true });
    }

    const st = {
      index: i, label, diameter: s.diameter, d: dia.d, prop: s.prop, engine, count,
      engineMass, tankDry: tank.dryMass, propMass: tank.propMass, tank,
      mdotVac: massFlow(engine.thrustVac, engine.ispVac) * count,
      thrustVac: engine.thrustVac * count,
      interstageMass: 0,
    };
    stages.push(st);

    // この段の上に段間部（下段と一緒に分離）
    const upper = stagesIn[i + 1];
    if (upper && ENGINES[upper.engine] && DIAMETERS[upper.diameter]) {
      const upEngine = ENGINES[upper.engine];
      const isLen = Math.max(0.6, upEngine.length + 0.2);
      const changes = upper.diameter !== s.diameter;
      const base = INTERSTAGE[s.diameter];
      const mass = base.mass * (changes ? INTERSTAGE_ADAPTER_FACTOR : 1);
      const upTank = tankSpec(s.diameter, 'kerolox', 1, 'heavy');
      elements.push({
        key: `s${i}-inter`, kind: 'interstage', stage: i, label: `${label}/${i + 2} 段間部`, z0: z, length: isLen,
        diameter: dia.d, topDiameter: DIAMETERS[upper.diameter].d, mass, axial: upTank.axial, bend: upTank.bend,
      });
      st.interstageMass = mass;
      cost += base.cost * (changes ? INTERSTAGE_ADAPTER_FACTOR : 1);
      z += isLen;
    }
  });

  const topStage = stages[stages.length - 1];
  const stackTop = z;

  // ブースター（第 1 段）
  let boosters = null;
  const b = design.boosters || { type: '', count: 0 };
  if (b.count > 0 && stages[0]) {
    const spec = BOOSTERS[b.type];
    if (!spec) errors.push('ブースターの種類が未選択です。');
    else {
      if (!unlocked.boosters.has(b.type)) errors.push(`ブースター ${b.type} はまだ使えません。`);
      if (![2, 4].includes(b.count)) errors.push('ブースターは 2 本か 4 本です。');
      const core = stages[0];
      const bd = DIAMETERS[spec.diameter].d;
      if (bd > core.d) errors.push(`ブースター ${b.type}（直径 ${spec.diameter}）は第1段（${core.diameter}）より太いので取り付けられません。`);
      if (b.count === 4 && bd >= core.d) errors.push(`ブースター 4 本には、ブースターより太い第1段が必要です。`);
      const tankLen = stagesIn[0].tankLength;
      if (tankLen < spec.length * BOOSTER_MIN_CORE_RATIO) errors.push(`ブースター ${b.type}（長さ ${spec.length} m）の取付には第1段タンク長 ${(spec.length * BOOSTER_MIN_CORE_RATIO).toFixed(1)} m 以上が必要です。`);
      const mdot = massFlow(spec.thrustVac, spec.ispVac) * b.count;
      boosters = {
        spec, count: b.count, prop: spec.prop * b.count, dry: spec.dry * b.count, mdot,
        thrustVac: spec.thrustVac * b.count, burnTime: spec.prop / massFlow(spec.thrustVac, spec.ispVac),
        z0: stages[0] ? elements.find((e) => e.key === 's0-tank').z0 : 0, length: spec.length, d: bd,
      };
      cost += spec.cost * b.count;
    }
  }

  // ペイロードアダプタ
  const adapter = ADAPTERS[design.adapter];
  if (!adapter) errors.push('ペイロードアダプタが未選択です。');
  else {
    if (!unlocked.adapters.has(design.adapter)) errors.push(`アダプタ「${adapter.label}」はまだ使えません。`);
    cost += adapter.cost;
  }
  if (payload.needsDocking && !(adapter && adapter.docking)) errors.push('このペイロードにはドッキング機構付きアダプタが必要です。');

  // フェアリング
  let fairing = null;
  const fd = design.fairing;
  if (payload.exposed) {
    if (fd) errors.push(`${payload.name}はフェアリングに収めません（外装が耐熱構造です）。フェアリングを外してください。`);
  } else if (!fd) {
    errors.push('ペイロードを空気から守るフェアリングが必要です。');
  } else {
    const fdia = DIAMETERS[fd.diameter];
    if (!fdia) errors.push('フェアリングの直径が未選択です。');
    else {
      if (!unlocked.diameters.has(fd.diameter)) errors.push(`直径 ${fd.diameter} のフェアリングはまだ使えません。`);
      const flen = Number(fd.length);
      if (!(flen >= FAIRING_LENGTH.min && flen <= FAIRING_LENGTH.max)) errors.push(`フェアリング円筒部の長さは ${FAIRING_LENGTH.min}〜${FAIRING_LENGTH.max} m です。`);
      const spec = fairingSpec(fd.diameter, Math.max(0, flen || 0));
      if (topStage && fdia.rank > DIAMETERS[topStage.diameter].rank + 1) errors.push(`フェアリング（${fd.diameter}）は最上段（${topStage.diameter}）より 1 クラス太いところまでです。`);
      if (topStage && fdia.rank < DIAMETERS[topStage.diameter].rank) errors.push(`フェアリング（${fd.diameter}）が最上段（${topStage.diameter}）より細く、取り付けられません。`);
      if (spec.innerDiameter < payload.diameter) errors.push(`フェアリング内径 ${spec.innerDiameter.toFixed(2)} m < ペイロード直径 ${payload.diameter} m。入りません。`);
      const need = ADAPTER_LENGTH + payload.length;
      if (spec.usableLength < need) errors.push(`フェアリングの収容長 ${spec.usableLength.toFixed(2)} m < 必要長 ${need.toFixed(2)} m（アダプタ込み）。円筒部を伸ばしてください。`);
      fairing = { ...spec, diameter: fd.diameter, d: fdia.d, cylinder: flen };
      elements.push({ key: 'fairing', kind: 'fairing', stage: 'top', label: 'フェアリング', z0: stackTop, length: spec.totalLength, diameter: fdia.d, mass: spec.mass, maxQ: spec.maxQ });
      cost += spec.cost;
    }
  }
  if (payload.exposed && topStage) {
    const capRank = DIAMETERS.S.d >= payload.diameter ? 0 : DIAMETERS.M.d >= payload.diameter ? 1 : 2;
    if (capRank > DIAMETERS[topStage.diameter].rank + 1) errors.push(`${payload.name}（直径 ${payload.diameter} m）を載せるには最上段が細すぎます。`);
  }

  elements.push({ key: 'adapter', kind: 'adapter', stage: 'top', label: 'ペイロードアダプタ', z0: stackTop, length: ADAPTER_LENGTH, diameter: Math.min(payload.diameter, topStage ? topStage.d : payload.diameter), mass: adapter ? adapter.mass : 0, axial: adapter ? adapter.axial : 0 });
  elements.push({ key: 'payload', kind: 'payload', stage: 'top', label: payload.name, z0: stackTop + ADAPTER_LENGTH, length: payload.length, diameter: payload.diameter, mass: payload.mass });

  // 緊急脱出塔
  let les = null;
  if (design.les) {
    if (!unlocked.les) errors.push('緊急脱出塔はまだ使えません。');
    if (!payload.crew) errors.push('緊急脱出塔は有人カプセル専用です。');
    les = { ...LES };
    elements.push({ key: 'les', kind: 'les', stage: 'top', label: '緊急脱出塔', z0: stackTop + ADAPTER_LENGTH + payload.length, length: LES.length, diameter: 0.6, mass: LES.mass });
    cost += LES.cost;
  } else if (payload.crew) {
    errors.push('有人飛行には緊急脱出塔（LES）が必須です。');
  }

  const top = Math.max(...elements.map((e) => e.z0 + e.length));
  const maxD = Math.max(...elements.map((e) => e.diameter), boosters ? 0 : 0);

  if (cost > mission.budget + 1e-9) errors.push(`予算超過です（${cost.toFixed(1)} / ${mission.budget} 億円）。`);

  const vehicle = { stages, elements, boosters, adapter, fairing, les, payload, cost, height: top, maxDiameter: maxD, errors, warnings };
  vehicle.analysis = analyze(vehicle);
  const a = vehicle.analysis;
  if (a.stages[0] && a.stages[0].twr < 1.0) errors.push(`発射時の推力重量比が ${a.stages[0].twr.toFixed(2)} で 1 未満です。浮き上がりません。`);
  else if (a.stages[0] && a.stages[0].twr < 1.2) warnings.push(`発射時の推力重量比が ${a.stages[0].twr.toFixed(2)} と低く、重力損失が大きくなります。`);
  a.stages.forEach((s, i) => {
    if (i > 0 && s.twr < 0.3) warnings.push(`第${i + 1}段の推力重量比が ${s.twr.toFixed(2)} と低く、軌道に乗る前に落ちる恐れがあります。`);
  });
  const slender = top / maxD;
  if (slender > 18) warnings.push(`機体が細長すぎます（全長/直径 = ${slender.toFixed(1)}）。最大動圧付近の曲げに注意。`);
  return vehicle;
}

// 段ごとの性能見積もり（真空比推力、全開噴射を仮定）
export function analyze(vehicle) {
  const { stages, boosters, adapter, fairing, les, payload } = vehicle;
  const topMass = payload.mass + (adapter ? adapter.mass : 0);
  const out = [];
  let total = 0;
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    let upper = topMass;
    for (let j = i + 1; j < stages.length; j++) {
      const u = stages[j];
      upper += u.engineMass + u.tankDry + u.propMass + u.interstageMass;
    }
    // フェアリング・脱出塔は第 1 段の間だけ載っていると概算
    if (i === 0) upper += (fairing ? fairing.mass : 0) + (les ? les.mass : 0);
    const own = s.engineMass + s.tankDry + s.interstageMass;
    let m0 = upper + own + s.propMass;
    const ve = s.engine.ispVac * G0;
    let dv = 0;
    let twr;
    if (i === 0) {
      const bm = boosters ? boosters.dry + boosters.prop : 0;
      m0 += bm;
      const ispSL = (e) => e.ispSL;
      const thrustSL = s.mdotVac * ispSL(s.engine) * G0 + (boosters ? boosters.mdot * boosters.spec.ispSL * G0 : 0);
      twr = thrustSL / (m0 * G0);
      if (boosters) {
        const tb = Math.min(boosters.burnTime, s.propMass / s.mdotVac);
        const mdot = s.mdotVac + boosters.mdot;
        const tVac = s.thrustVac + boosters.thrustVac;
        const veMix = tVac / mdot;
        const m1 = m0 - mdot * tb;
        dv += veMix * Math.log(m0 / m1);
        const m2 = m1 - boosters.dry - Math.max(0, boosters.prop - boosters.mdot * tb);
        const propLeft = s.propMass - s.mdotVac * tb;
        dv += ve * Math.log(m2 / (m2 - propLeft));
      } else {
        dv = ve * Math.log(m0 / (m0 - s.propMass));
      }
    } else {
      twr = s.thrustVac / (m0 * G0);
      dv = ve * Math.log(m0 / (m0 - s.propMass));
    }
    const burnTime = s.propMass / s.mdotVac;
    total += dv;
    out.push({ index: i, m0, mf: m0 - s.propMass - (i === 0 && boosters ? boosters.dry + boosters.prop : 0), dv, twr, burnTime, propMass: s.propMass });
  }
  const liftoffMass = out[0] ? out[0].m0 : 0;
  return { stages: out, totalDv: total, liftoffMass, boosterBurnTime: boosters ? boosters.burnTime : 0 };
}

// 飛行計画の入力チェック
export function validateProgram(vehicle, program, mission) {
  const errors = [];
  const warnings = [];
  const n = vehicle.stages.length;
  const pp = program.pitch || {};
  if (!(pp.endAngle >= 0 && pp.endAngle <= 90)) errors.push('ピッチ終了角は 0〜90° です。');
  if (!(pp.startAlt >= 100 && pp.startAlt <= 20000)) errors.push('ピッチ開始高度は 100〜20,000 m です。');
  if (!(pp.endAlt > pp.startAlt && pp.endAlt <= 150000)) errors.push('ピッチ終了高度は開始高度より高く、150 km 以下にしてください。');
  if (!(pp.maxQAlpha >= 0 && pp.maxQAlpha <= 500)) errors.push('qα 制限は 0〜500 kPa·° です。');
  for (let i = 0; i < n; i++) {
    const s = vehicle.stages[i];
    const p = (program.stages || [])[i];
    const label = `第${i + 1}段`;
    if (!p) { errors.push(`${label}の飛行計画がありません。`); continue; }
    const minT = Math.round(s.engine.minThrottle * 100);
    const use2 = p.switchAt > 0;
    const use3 = use2 && p.switchAt2 > p.switchAt;
    if (use2 && p.switchAt2 > 0 && !(p.switchAt2 > p.switchAt)) errors.push(`${label}: 切替2 の時刻は切替1 より後にしてください。`);
    for (const [k, name] of [['throttle', '開始スロットル'], ['throttle2', '切替1 後のスロットル'], ['throttle3', '切替2 後のスロットル']]) {
      if (k === 'throttle2' && !use2) continue;
      if (k === 'throttle3' && !use3) continue;
      if (!(p[k] >= minT && p[k] <= 100)) errors.push(`${label}: ${name}は ${s.engine.id} の場合 ${minT}〜100% です。`);
    }
    if (!(p.duration > 0)) errors.push(`${label}: 燃焼時間を入力してください。`);
    const bo = burnoutTime(s, p);
    if (p.duration > bo + 0.05) warnings.push(`${label}: 設定した燃焼時間より先に推進剤が尽きます（${bo.toFixed(1)} 秒で燃焼終了）。`);
    if (i < n - 1 && !(p.coast >= 0 && p.coast <= 600)) errors.push(`${label}: 分離後の慣性飛行は 0〜600 秒です。`);
  }
  const c = program.circ || {};
  if (c.enabled) {
    const top = vehicle.stages[n - 1];
    if (top) {
      const minT = Math.round(top.engine.minThrottle * 100);
      if (top.engine.ignitions < 2) errors.push(`最上段のエンジン ${top.engine.id} は再着火できません。円化噴射を使うには再着火可能なエンジンが必要です。`);
      if (!(c.throttle >= minT && c.throttle <= 100)) errors.push(`円化噴射: スロットルは ${minT}〜100% です。`);
    }
    if (!(c.duration > 0)) errors.push('円化噴射: 燃焼時間を入力してください。');
    if (!(c.lead >= 0 && c.lead <= 600)) errors.push('円化噴射: 遠地点前の開始時間は 0〜600 秒です。');
  }
  if (vehicle.fairing && !(program.fairingAlt >= 20e3 && program.fairingAlt <= 200e3)) errors.push('フェアリング分離高度は 20〜200 km です。');
  if (vehicle.les) {
    if (!(program.lesAlt >= 0)) errors.push('脱出塔の投棄高度を入力してください。');
    else if (program.lesAlt < LES.minJettisonAlt) errors.push(`脱出塔は高度 ${LES.minJettisonAlt / 1000} km 以上まで保持する規則です。`);
  }
  return { errors, warnings };
}

// 段のスロットル: 開始値 → 切替1 の時刻から 2 番目の値 → 切替2 の時刻から 3 番目の値
export function throttleAt(prog, t) {
  if (!(prog.switchAt > 0) || t < prog.switchAt) return prog.throttle;
  if (prog.switchAt2 > prog.switchAt && t >= prog.switchAt2) return prog.throttle3;
  return prog.throttle2;
}

// 段の推進剤がこのスロットル設定で尽きるまでの時間（秒）
export function burnoutTime(stage, prog) {
  let prop = stage.propMass;
  let t = 0;
  const marks = [0, prog.switchAt > 0 ? prog.switchAt : Infinity, prog.switchAt > 0 && prog.switchAt2 > prog.switchAt ? prog.switchAt2 : Infinity, Infinity];
  for (let i = 0; i < 3; i++) {
    const t0 = marks[i];
    const t1 = Math.max(t0, marks[i + 1]);
    if (t0 === Infinity) break;
    const mdot = stage.mdotVac * throttleAt(prog, t0 + 1e-6) / 100;
    if (mdot <= 0) return Infinity;
    const span = t1 - t0;
    if (prop <= mdot * span) return t + prop / mdot;
    prop -= mdot * span;
    t += span;
  }
  return t;
}

