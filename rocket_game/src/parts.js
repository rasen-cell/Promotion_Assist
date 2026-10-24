// パーツカタログ。質量は kg、推力は N、長さは m、費用は億円。
export const G0 = 9.81;

export const DIAMETERS = {
  S: { id: 'S', label: 'S (1.25 m)', d: 1.25, rank: 0 },
  M: { id: 'M', label: 'M (2.5 m)', d: 2.5, rank: 1 },
  L: { id: 'L', label: 'L (3.75 m)', d: 3.75, rank: 2 },
};
export const DIAMETER_IDS = ['S', 'M', 'L'];

// 推進剤。密度はタンク容積あたりの実効値（kg/m^3）。
export const PROPELLANTS = {
  kerolox: { id: 'kerolox', label: 'ケロシン / 液体酸素', short: 'ケロシン', density: 1000, dryFactor: 1.0, strengthFactor: 1.0, costFactor: 1.0 },
  hydrolox: { id: 'hydrolox', label: '液体水素 / 液体酸素', short: '液水', density: 350, dryFactor: 0.7, strengthFactor: 0.8, costFactor: 1.6 },
};

export const TANK_FILL = 0.9; // 容積のうち推進剤を積める割合
export const TANK_LENGTH = { min: 1, max: 40, step: 0.5 };

// 直径ごとのタンク基準値（標準肉厚・ケロシン）。axial: 許容圧縮荷重 N、bend: 許容曲げモーメント N·m
export const TANK_BASE = {
  S: { dryPerM: 120, axial: 400e3, bend: 180e3, costPerM: 0.6 },
  M: { dryPerM: 350, axial: 1500e3, bend: 1400e3, costPerM: 1.5 },
  L: { dryPerM: 700, axial: 4000e3, bend: 4700e3, costPerM: 3.0 },
};

export const WALLS = {
  std: { id: 'std', label: '標準肉厚', mass: 1.0, strength: 1.0, cost: 1.0 },
  heavy: { id: 'heavy', label: '強化肉厚', mass: 1.5, strength: 1.6, cost: 1.4 },
};

// 液体エンジン。thrustVac: 真空推力 N（流量一定、海面推力は比推力比で減る）
export const ENGINES = {
  'RK-10': { id: 'RK-10', name: 'ハヤテ', diameter: 'S', prop: 'kerolox', mass: 900, thrustVac: 215e3, ispSL: 270, ispVac: 300, minThrottle: 0.5, ignitions: 1, length: 1.6, cost: 3, note: '小型・海面用' },
  'RK-10V': { id: 'RK-10V', name: 'ツバメ', diameter: 'S', prop: 'kerolox', mass: 350, thrustVac: 60e3, ispSL: 100, ispVac: 335, minThrottle: 0.3, ignitions: 3, length: 1.4, cost: 3.5, note: '小型・真空用・再着火可' },
  'RK-40': { id: 'RK-40', name: 'イカヅチ', diameter: 'M', prop: 'kerolox', mass: 2600, thrustVac: 1400e3, ispSL: 275, ispVac: 305, minThrottle: 0.6, ignitions: 1, length: 2.6, cost: 10, note: '中型・海面用' },
  'RK-40V': { id: 'RK-40V', name: 'ハヤブサ', diameter: 'M', prop: 'kerolox', mass: 1200, thrustVac: 280e3, ispSL: 120, ispVac: 345, minThrottle: 0.4, ignitions: 3, length: 2.8, cost: 8, note: '中型・真空用・再着火可' },
  'HL-20': { id: 'HL-20', name: 'ミズチ', diameter: 'M', prop: 'hydrolox', mass: 1500, thrustVac: 110e3, ispSL: 160, ispVac: 450, minThrottle: 0.2, ignitions: 5, length: 2.4, cost: 14, note: '液水・真空用・高比推力' },
  'HL-60': { id: 'HL-60', name: 'オロチ', diameter: 'M', prop: 'hydrolox', mass: 3200, thrustVac: 900e3, ispSL: 360, ispVac: 430, minThrottle: 0.65, ignitions: 1, length: 3.6, cost: 22, note: '液水・海面用' },
  'RK-90': { id: 'RK-90', name: 'ダイダラ', diameter: 'L', prop: 'kerolox', mass: 6500, thrustVac: 4000e3, ispSL: 285, ispVac: 312, minThrottle: 0.6, ignitions: 1, length: 3.6, cost: 25, note: '大型・海面用' },
};

// 固体ブースター（第1段の側面に 2 本 / 4 本）。点火後は停止もスロットルもできない。
export const BOOSTERS = {
  'SB-1': { id: 'SB-1', name: 'ホムラ', diameter: 'S', prop: 10000, dry: 1500, thrustVac: 520e3, ispSL: 235, ispVac: 255, length: 10, cost: 2.5 },
  'SB-2': { id: 'SB-2', name: 'カグツチ', diameter: 'M', prop: 45000, dry: 6000, thrustVac: 2300e3, ispSL: 245, ispVac: 265, length: 18, cost: 9 },
};
export const BOOSTER_COUNTS = [0, 2, 4];
export const BOOSTER_MIN_CORE_RATIO = 0.7; // コアのタンク長はブースター長の 70% 以上

// 段間部（下段と一緒に分離）。上段エンジンを内側に収める。
export const INTERSTAGE = {
  S: { mass: 80, cost: 0.4 },
  M: { mass: 220, cost: 0.8 },
  L: { mass: 500, cost: 1.5 },
};
export const INTERSTAGE_ADAPTER_FACTOR = 1.5; // 直径が変わる段間部の質量倍率

// ペイロードアダプタ（ペイロードを支える台座）。axial: 許容荷重 N
export const ADAPTERS = {
  light: { id: 'light', label: '軽量 (許容 80 kN)', mass: 50, axial: 80e3, cost: 0.3 },
  std: { id: 'std', label: '標準 (許容 200 kN)', mass: 150, axial: 200e3, cost: 0.6 },
  heavy: { id: 'heavy', label: '強化 (許容 600 kN)', mass: 400, axial: 600e3, cost: 1.2 },
  docking: { id: 'docking', label: 'ドッキング機構付 (許容 300 kN)', mass: 350, axial: 300e3, cost: 3, docking: true },
};

// フェアリング。円筒部の長さを選び、先端に直径×1.2 のノーズが付く。
export const FAIRINGS = {
  S: { massPerM: 80, maxQ: 60e3, costPerM: 0.4 },
  M: { massPerM: 200, maxQ: 55e3, costPerM: 0.8 },
  L: { massPerM: 380, maxQ: 50e3, costPerM: 1.5 },
};
export const FAIRING_LENGTH = { min: 1, max: 14, step: 0.5 };
export const FAIRING_NOSE_RATIO = 1.2;
export const FAIRING_WALL = 0.15; // 内径 = 外径 - 0.15 m
export const FAIRING_NOSE_USABLE = 0.4; // ノーズのうちペイロードが入る長さ（直径比）

export const LES = { mass: 1200, length: 4, cost: 6, minJettisonAlt: 25000 };

export function maxEngineCount(tankDiameter, engineDiameter) {
  const r = DIAMETERS[tankDiameter].d / DIAMETERS[engineDiameter].d;
  return Math.floor(r * r + 1e-6);
}

export function tankSpec(diameter, prop, length, wall) {
  const base = TANK_BASE[diameter];
  const p = PROPELLANTS[prop];
  const w = WALLS[wall];
  const r = DIAMETERS[diameter].d / 2;
  return {
    propMass: Math.PI * r * r * length * TANK_FILL * p.density,
    dryMass: base.dryPerM * length * p.dryFactor * w.mass,
    axial: base.axial * p.strengthFactor * w.strength,
    bend: base.bend * p.strengthFactor * w.strength,
    cost: base.costPerM * length * p.costFactor * w.cost,
  };
}

export function fairingSpec(diameter, length) {
  const f = FAIRINGS[diameter];
  const d = DIAMETERS[diameter].d;
  const nose = d * FAIRING_NOSE_RATIO;
  return {
    mass: f.massPerM * (length + nose),
    totalLength: length + nose,
    innerDiameter: d - FAIRING_WALL,
    usableLength: length + d * FAIRING_NOSE_USABLE,
    maxQ: f.maxQ,
    cost: f.costPerM * (length + nose),
  };
}

// 圧力比 p/p0 に応じた比推力
export function ispAt(engine, pressureRatio) {
  return engine.ispVac + (engine.ispSL - engine.ispVac) * pressureRatio;
}

export function massFlow(thrustVac, ispVac) {
  return thrustVac / (ispVac * G0);
}
