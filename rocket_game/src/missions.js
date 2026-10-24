// ミッション定義。ペイロードは発注者支給品で、設計側は寸法・質量・許容値に合わせるだけ。
// unlock は、そのミッションで新たに使えるようになるパーツ。以前のミッションの分も引き継ぐ。

export const MISSIONS = [
  {
    id: 'm1',
    title: 'はじめての宇宙',
    client: 'ホーム大学 超高層大気研究室',
    brief: '観測機器を宇宙空間（高度 70 km 以上）まで運び、さらに上の 90 km に到達させてください。軌道に乗せる必要はありません。',
    hint: '機体が重すぎても軽すぎても失敗します。推力重量比（TWR）は 1.3〜2.5 くらいが目安です。燃焼時間は「最大」まで使わなくても届きます。',
    payload: { name: '超高層大気観測パッケージ', mass: 150, diameter: 0.8, length: 1.0, maxG: 15, maxQExposed: 1000, exposed: false },
    objective: { type: 'altitude', minApex: 90e3 },
    maxStages: 1,
    budget: 12,
    costTargets: [8, 6],
    unlock: { diameters: ['S'], props: ['kerolox'], engines: ['RK-10'], boosters: [], adapters: ['light', 'std'], les: false },
  },
  {
    id: 'm2',
    title: '低軌道へ',
    client: 'ホーム宇宙機構 技術試験衛星班',
    brief: '小型試験衛星を、近地点 75 km 以上・遠地点 250 km 以下の周回軌道に投入してください。',
    hint: '2 段式にし、第 2 段は真空用エンジンにします。第 2 段の最初の噴射で遠地点を上げ、遠地点付近で再着火して近地点を上げます（円化）。地上から低軌道までは、重力と空気による損失込みで 4,000〜4,500 m/s の Δv が目安です。円化の噴射時間は、飛行ログに出る「目安」を参考にしてください。',
    payload: { name: '技術試験衛星「つばさ」', mass: 500, diameter: 1.0, length: 1.2, maxG: 8, maxQExposed: 1000, exposed: false },
    objective: { type: 'orbit', minPeriapsis: 75e3, maxApoapsis: 250e3 },
    maxStages: 2,
    budget: 25,
    costTargets: [18, 13],
    unlock: { diameters: [], props: [], engines: ['RK-10V'], boosters: ['SB-1'], adapters: [], les: false },
  },
  {
    id: 'm3',
    title: '精密観測衛星',
    client: 'ホーム天文台',
    brief: '大型望遠鏡衛星を近地点 100 km 以上・遠地点 220 km 以下に投入してください。光学系が繊細なため、打ち上げ中の加速度は 3.5 G までです。',
    hint: '推進剤が減ると機体が軽くなり、同じ推力でも加速度が上がります。段の後半でスロットルを下げましょう（切替 1・切替 2）。M 直径パーツが使えます。上段より太いフェアリングは、上段のタンクに大きな曲げを生みます。',
    payload: { name: '宇宙望遠鏡「ひかり」', mass: 1200, diameter: 2.0, length: 3.5, maxG: 3.5, maxQExposed: 800, exposed: false },
    objective: { type: 'orbit', minPeriapsis: 100e3, maxApoapsis: 220e3 },
    maxStages: 2,
    budget: 50,
    costTargets: [42, 34],
    unlock: { diameters: ['M'], props: [], engines: ['RK-40', 'RK-40V'], boosters: [], adapters: ['heavy'], les: false },
  },
  {
    id: 'm4',
    title: '大型通信衛星',
    client: 'ホーム通信',
    brief: '直径 3.2 m の通信衛星を、近地点 80 km 以上・遠地点 1,800〜2,600 km の遷移軌道に投入してください。',
    hint: 'L 直径のフェアリングが必要です。上段より 1 クラス太いフェアリング（ハンマーヘッド）も使えますが、曲げモーメントが増えます。液体水素エンジンは高性能ですがタンクが長くなります。',
    payload: { name: '通信衛星「こだま 3」', mass: 2500, diameter: 3.2, length: 4.5, maxG: 6, maxQExposed: 800, exposed: false },
    objective: { type: 'orbit', minPeriapsis: 80e3, minApoapsis: 1800e3, maxApoapsis: 2600e3 },
    maxStages: 3,
    budget: 80,
    costTargets: [65, 52],
    unlock: { diameters: ['L'], props: ['hydrolox'], engines: ['HL-20', 'RK-90'], boosters: ['SB-2'], adapters: [], les: false },
  },
  {
    id: 'm5',
    title: '有人周回飛行',
    client: 'ホーム宇宙機構 有人飛行室',
    brief: '3 名乗りカプセルを近地点 90 km 以上・遠地点 300 km 以下に投入してください。乗員保護のため加速度は 5 G まで、緊急脱出塔（LES）を高度 25 km 以上まで保持すること。',
    hint: 'カプセルは耐熱シールド付きなのでフェアリングは付けません（付けられません）。脱出塔は重いので、25 km を過ぎたら早めに投棄すると得です。',
    payload: { name: '有人カプセル「あけぼの」', mass: 3000, diameter: 2.4, length: 3.0, maxG: 5, maxQExposed: 60e3, exposed: true, crew: 3 },
    objective: { type: 'orbit', minPeriapsis: 90e3, maxApoapsis: 300e3 },
    maxStages: 3,
    budget: 75,
    costTargets: [60, 45],
    unlock: { diameters: [], props: [], engines: ['HL-60'], boosters: [], adapters: [], les: true },
  },
  {
    id: 'm6',
    title: 'ステーション補給',
    client: 'ホーム軌道ステーション運用センター',
    brief: '補給船を、ステーションの軌道（高度 120 km の円軌道）に合わせて近地点・遠地点とも 115〜125 km に投入してください。ドッキング機構付きアダプタが必要です。',
    hint: '投入後のランデブーとドッキングは補給船が自動で行います。設計側の仕事は誤差 ±5 km の精密な軌道投入です。円化の噴射時間を 1 秒単位で詰めましょう。',
    payload: { name: '補給船「はこぶね」', mass: 4000, diameter: 2.3, length: 5.0, maxG: 6, maxQExposed: 800, exposed: false, needsDocking: true },
    objective: { type: 'orbit', minPeriapsis: 115e3, minApoapsis: 115e3, maxApoapsis: 125e3 },
    maxStages: 3,
    budget: 80,
    costTargets: [65, 52],
    unlock: { diameters: [], props: [], engines: [], boosters: [], adapters: ['docking'], les: false },
  },
  {
    id: 'm7',
    title: '惑星間探査機',
    client: 'ホーム宇宙機構 深宇宙探査室',
    brief: '探査機をホームの重力圏から脱出させてください（脱出速度を超える双曲線軌道、無限遠での速度 500 m/s 以上）。',
    hint: '低軌道に入るより 1,000 m/s 以上多くの Δv が要ります。上段に液体水素エンジンを使うのが近道です。円化は不要で、上段を一気に燃やし切って構いません。',
    payload: { name: '外惑星探査機「はるか」', mass: 1000, diameter: 1.8, length: 2.5, maxG: 7, maxQExposed: 800, exposed: false },
    objective: { type: 'escape', minVInf: 500 },
    maxStages: 3,
    budget: 90,
    costTargets: [75, 58],
    unlock: { diameters: [], props: [], engines: [], boosters: [], adapters: [], les: false },
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id);
}

// ミッション i までに解放されたパーツ
export function unlockedFor(missionId) {
  const out = { diameters: new Set(), props: new Set(), engines: new Set(), boosters: new Set(), adapters: new Set(), les: false };
  for (const m of MISSIONS) {
    const u = m.unlock;
    u.diameters.forEach((x) => out.diameters.add(x));
    u.props.forEach((x) => out.props.add(x));
    u.engines.forEach((x) => out.engines.add(x));
    u.boosters.forEach((x) => out.boosters.add(x));
    u.adapters.forEach((x) => out.adapters.add(x));
    out.les = out.les || u.les;
    if (m.id === missionId) break;
  }
  return out;
}

export function objectiveText(m) {
  const o = m.objective;
  const km = (x) => `${(x / 1000).toLocaleString('ja-JP')} km`;
  if (o.type === 'altitude') return `最高到達高度 ${km(o.minApex)} 以上`;
  if (o.type === 'escape') return `脱出軌道（無限遠速度 ${o.minVInf} m/s 以上）`;
  const parts = [`近地点 ${km(o.minPeriapsis)} 以上`];
  if (o.minApoapsis) parts.push(`遠地点 ${km(o.minApoapsis)}〜${km(o.maxApoapsis)}`);
  else parts.push(`遠地点 ${km(o.maxApoapsis)} 以下`);
  return parts.join('・');
}
