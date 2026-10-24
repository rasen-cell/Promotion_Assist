// 新規ミッションの初期設計・初期飛行計画と、入力補助の計算。
import { ENGINES, DIAMETERS, FAIRING_NOSE_USABLE, FAIRING_WALL, FAIRING_LENGTH } from './parts.js';
import { ADAPTER_LENGTH, burnoutTime } from './vehicle.js';

export { burnoutTime };

export function defaultStage() {
  return { diameter: 'S', prop: 'kerolox', tankLength: 4, wall: 'std', engine: 'RK-10', engineCount: 1 };
}

export function defaultStageProgram() {
  return { throttle: 100, switchAt: 0, throttle2: 100, switchAt2: 0, throttle3: 100, duration: 60, coast: 3, guidance: 'program' };
}

// ペイロードが収まる最小のフェアリング
export function fittingFairing(payload, minDiameter = 'S') {
  for (const id of ['S', 'M', 'L']) {
    if (DIAMETERS[id].rank < DIAMETERS[minDiameter].rank) continue;
    const d = DIAMETERS[id].d;
    if (d - FAIRING_WALL < payload.diameter) continue;
    const need = ADAPTER_LENGTH + payload.length - d * FAIRING_NOSE_USABLE;
    const len = Math.max(FAIRING_LENGTH.min, Math.ceil(need / FAIRING_LENGTH.step) * FAIRING_LENGTH.step);
    return { diameter: id, length: len };
  }
  return { diameter: 'L', length: 4 };
}

export function defaultDesign(mission) {
  const p = mission.payload;
  return {
    stages: [defaultStage()],
    boosters: { type: '', count: 0 },
    adapter: p.needsDocking ? 'docking' : 'std',
    fairing: p.exposed ? null : fittingFairing(p),
    les: !!p.crew,
  };
}

export function defaultProgram(mission) {
  const vertical = mission.objective.type === 'altitude';
  return {
    pitch: { startAlt: 500, endAlt: 45000, endAngle: vertical ? 0 : 70, maxQAlpha: 50 },
    stages: [defaultStageProgram()],
    circ: { enabled: false, lead: 20, duration: 30, throttle: 100, guidance: 'horizontal' },
    fairingAlt: 60e3,
    lesAlt: 30e3,
  };
}

export function engineMinThrottle(id) {
  return ENGINES[id] ? Math.round(ENGINES[id].minThrottle * 100) : 0;
}

// 設計の段数に合わせて飛行計画の段を増減する
export function syncProgram(design, program) {
  const n = design.stages.length;
  while (program.stages.length < n) program.stages.push(defaultStageProgram());
  program.stages.length = n;
  return program;
}
