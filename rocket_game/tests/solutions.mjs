// 各ミッションの参考解（テストで「解けること」を保証するために使う）。
export const SOLUTIONS = {
  m1: {
    design: {
      stages: [{ diameter: 'S', prop: 'kerolox', tankLength: 3, wall: 'std', engine: 'RK-10', engineCount: 1 }],
      boosters: { type: '', count: 0 }, adapter: 'light', fairing: { diameter: 'S', length: 1.5 }, les: false,
    },
    program: {
      pitch: { startAlt: 1000, endAlt: 45000, endAngle: 0, maxQAlpha: 40 },
      stages: [{ throttle: 60, switchAt: 0, throttle2: 100, switchAt2: 0, throttle3: 100, duration: 60, coast: 0, guidance: 'program' }],
      circ: { enabled: false, lead: 0, duration: 0, throttle: 100, guidance: 'horizontal' },
      fairingAlt: 60e3, lesAlt: 0,
    },
  },
  m2: {
    design: {
      stages: [
        { diameter: 'S', prop: 'kerolox', tankLength: 6, wall: 'heavy', engine: 'RK-10', engineCount: 1 },
        { diameter: 'S', prop: 'kerolox', tankLength: 2, wall: 'std', engine: 'RK-10V', engineCount: 1 },
      ],
      boosters: { type: '', count: 0 }, adapter: 'light', fairing: { diameter: 'S', length: 1.5 }, les: false,
    },
    program: {
      pitch: { startAlt: 500, endAlt: 50000, endAngle: 75, maxQAlpha: 50 },
      stages: [
        { throttle: 90, switchAt: 40, throttle2: 90, switchAt2: 100, throttle3: 80, duration: 90, coast: 3, guidance: 'program' },
        { throttle: 100, switchAt: 0, throttle2: 100, switchAt2: 0, throttle3: 100, duration: 49, coast: 0, guidance: 'program' },
      ],
      circ: { enabled: true, lead: 15, duration: 29.6, throttle: 100, guidance: 'horizontal' },
      fairingAlt: 60e3, lesAlt: 0,
    },
  },
  m3: {
    design: {
      stages: [
        { diameter: 'M', prop: 'kerolox', tankLength: 7, wall: 'std', engine: 'RK-10', engineCount: 4 },
        { diameter: 'S', prop: 'kerolox', tankLength: 3, wall: 'heavy', engine: 'RK-10V', engineCount: 1 },
      ],
      boosters: { type: '', count: 0 }, adapter: 'std', fairing: { diameter: 'M', length: 3 }, les: false,
    },
    program: {
      pitch: { startAlt: 400, endAlt: 45000, endAngle: 65, maxQAlpha: 50 },
      stages: [
        { throttle: 80, switchAt: 60, throttle2: 70, switchAt2: 80, throttle3: 60, duration: 120, coast: 3, guidance: 'program' },
        { throttle: 100, switchAt: 0, throttle2: 100, switchAt2: 0, throttle3: 100, duration: 65, coast: 0, guidance: 'program' },
      ],
      circ: { enabled: true, lead: 19, duration: 36.8, throttle: 100, guidance: 'horizontal' },
      fairingAlt: 60e3, lesAlt: 0,
    },
  },
  m4: {
    design: {
      stages: [
        { diameter: 'M', prop: 'kerolox', tankLength: 10, wall: 'heavy', engine: 'RK-40', engineCount: 1 },
        { diameter: 'M', prop: 'kerolox', tankLength: 3, wall: 'std', engine: 'RK-40V', engineCount: 1 },
      ],
      boosters: { type: '', count: 0 }, adapter: 'std', fairing: { diameter: 'L', length: 3.5 }, les: false,
    },
    program: {
      pitch: { startAlt: 700, endAlt: 50000, endAngle: 75, maxQAlpha: 20 },
      stages: [
        { throttle: 80, switchAt: 30, throttle2: 90, switchAt2: 80, throttle3: 60, duration: 200, coast: 3, guidance: 'program' },
        { throttle: 100, switchAt: 0, throttle2: 100, switchAt2: 0, throttle3: 100, duration: 79, coast: 0, guidance: 'program' },
      ],
      circ: { enabled: true, lead: 9, duration: 17.5, throttle: 100, guidance: 'horizontal' },
      fairingAlt: 60e3, lesAlt: 0,
    },
  },
  m5: {
    design: {
      stages: [
        { diameter: 'M', prop: 'kerolox', tankLength: 10, wall: 'heavy', engine: 'RK-40', engineCount: 1 },
        { diameter: 'M', prop: 'kerolox', tankLength: 3, wall: 'std', engine: 'RK-40V', engineCount: 1 },
      ],
      boosters: { type: '', count: 0 }, adapter: 'heavy', fairing: null, les: true,
    },
    program: {
      pitch: { startAlt: 300, endAlt: 45000, endAngle: 65, maxQAlpha: 40 },
      stages: [
        { throttle: 90, switchAt: 30, throttle2: 90, switchAt2: 80, throttle3: 60, duration: 200, coast: 3, guidance: 'program' },
        { throttle: 100, switchAt: 0, throttle2: 100, switchAt2: 0, throttle3: 100, duration: 12, coast: 0, guidance: 'program' },
      ],
      circ: { enabled: true, lead: 22, duration: 42.1, throttle: 100, guidance: 'horizontal' },
      fairingAlt: 60e3, lesAlt: 30e3,
    },
  },
  m6: {
    design: {
      stages: [
        { diameter: 'M', prop: 'kerolox', tankLength: 10, wall: 'heavy', engine: 'RK-40', engineCount: 1 },
        { diameter: 'M', prop: 'kerolox', tankLength: 3, wall: 'std', engine: 'RK-40V', engineCount: 1 },
      ],
      boosters: { type: '', count: 0 }, adapter: 'docking', fairing: { diameter: 'M', length: 4.5 }, les: false,
    },
    program: {
      pitch: { startAlt: 300, endAlt: 40000, endAngle: 80, maxQAlpha: 60 },
      stages: [
        { throttle: 90, switchAt: 40, throttle2: 80, switchAt2: 90, throttle3: 60, duration: 200, coast: 3, guidance: 'program' },
        { throttle: 100, switchAt: 0, throttle2: 100, switchAt2: 0, throttle3: 100, duration: 18, coast: 0, guidance: 'program' },
      ],
      circ: { enabled: true, lead: 40, duration: 77, throttle: 40, guidance: 'horizontal' },
      fairingAlt: 60e3, lesAlt: 0,
    },
  },
  m7: {
    design: {
      stages: [
        { diameter: 'M', prop: 'kerolox', tankLength: 10, wall: 'heavy', engine: 'RK-40', engineCount: 1 },
        { diameter: 'M', prop: 'hydrolox', tankLength: 8, wall: 'std', engine: 'HL-20', engineCount: 1 },
      ],
      boosters: { type: '', count: 0 }, adapter: 'std', fairing: { diameter: 'M', length: 2 }, les: false,
    },
    program: {
      pitch: { startAlt: 300, endAlt: 45000, endAngle: 70, maxQAlpha: 40 },
      stages: [
        { throttle: 90, switchAt: 40, throttle2: 80, switchAt2: 90, throttle3: 60, duration: 200, coast: 3, guidance: 'program' },
        { throttle: 100, switchAt: 0, throttle2: 100, switchAt2: 0, throttle3: 100, duration: 600, coast: 0, guidance: 'program' },
      ],
      circ: { enabled: false, lead: 0, duration: 0, throttle: 100, guidance: 'horizontal' },
      fairingAlt: 60e3, lesAlt: 0,
    },
  },
};
