/* ==========================================================================
   demo.js — 站内「大屏演示」简化模型（精致版）
   借鉴原项目 Three.js 渲染观感，用 CSS 3D 复刻：
   房屋基座 / 半透明墙 + 顶棱 / 窗框玻璃 / 门框门扇 / 组合式家具 /
   设备造型与状态动画 / 拖拽转视角 / 长按改锚点 / 楼层与背景切换。
   纯静态，无任何依赖。
   ========================================================================== */
(function () {
  'use strict';

  const stage = document.getElementById('stage');
  const world = document.getElementById('dworld');
  const dvp = document.getElementById('dvp');
  if (!stage || !world || !dvp) return;

  /* ---------------- 基本参数 ---------------- */
  const PLAN = { w: 470, d: 340, h: 112 };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let rx = 58, rz = -30, ox = 0, oy = 0;
  let autoRotate = false, labelsOn = true;
  let dragging = false, suppressClick = false;
  let floorIdx = 0;
  let pressTimer = null;
  let devEls = {};

  /* ---------------- 工具 ---------------- */
  function mk(cls, parent) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ---------------- 视角 ---------------- */
  function applyView() {
    world.style.setProperty('--rx', rx + 'deg');
    world.style.setProperty('--rz', rz + 'deg');
    world.style.setProperty('--ox', ox + 'px');
    world.style.setProperty('--oy', oy + 'px');
  }

  /* ---------------- 体块（支持自定义顶面/侧面样式与圆角） ---------------- */
  function box(parent, o) {
    const w = o.w, d = o.d, h = o.h, x = o.x, y = o.y;
    const z0 = o.z0 || 0;
    const c = o.c || '#c9a26e';
    const r = o.r != null ? o.r : 3;
    const g = mk('dbox', parent);

    const top = mk('face top', g);
    top.style.cssText =
      'width:' + w + 'px;height:' + d + 'px;border-radius:' + r + 'px;' +
      'background:' + (o.topBg || shade(c, 1.08)) + ';' +
      'transform:translate(-50%,-50%) translate3d(' + x + 'px,' + y + 'px,' + (z0 + h) + 'px);' +
      'box-shadow:inset 0 0 0 1px rgba(0,0,0,.08), 0 3px 8px rgba(40,30,20,.12)';

    const side = (tf, ww, color) => {
      const s = mk('face side', g);
      s.style.cssText =
        'width:' + ww + 'px;height:' + h + 'px;background:' + color + ';' +
        'box-shadow:inset 0 0 0 1px rgba(0,0,0,.05);' + 'transform:' + tf;
    };
    side('translate(-50%,-100%) translate3d(' + x + 'px,' + (y + d / 2) + 'px,' + z0 + 'px) rotateX(-90deg)',
      w, o.sideBg || shade(c, 0.9));
    side('translate(-50%,-100%) translate3d(' + x + 'px,' + (y - d / 2) + 'px,' + z0 + 'px) rotateX(-90deg)',
      w, shade(c, 0.86));
    side('translate(-50%,-100%) translate3d(' + (x - w / 2) + 'px,' + y + 'px,' + z0 + 'px) rotateZ(90deg) rotateX(-90deg)',
      d, shade(c, 0.8));
    side('translate(-50%,-100%) translate3d(' + (x + w / 2) + 'px,' + y + 'px,' + z0 + 'px) rotateZ(90deg) rotateX(-90deg)',
      d, shade(c, 0.95));
    return g;
  }

  /* ---------------- 组合式家具 ---------------- */
  function fSofa(p, o) {
    const x = o.x, y = o.y, W = 112, D = 44;
    box(p, { x: x, y: y, w: W, d: D, h: 20, c: '#a9714c', r: 6 });                        // 座体
    box(p, { x: x, y: y - D / 2 + 7, w: W, d: 14, h: 22, z0: 20, c: '#9c6540', r: 5 });   // 靠背
    box(p, { x: x - W / 2 + 7, y: y, w: 14, d: D, h: 16, z0: 20, c: '#9c6540', r: 5 });   // 扶手
    box(p, { x: x + W / 2 - 7, y: y, w: 14, d: D, h: 16, z0: 20, c: '#9c6540', r: 5 });
    box(p, { x: x - 22, y: y + 5, w: 44, d: 30, h: 6, z0: 20, c: '#c9925f', r: 6 });      // 坐垫
    box(p, { x: x + 24, y: y + 5, w: 40, d: 30, h: 6, z0: 20, c: '#c28a58', r: 6 });
  }
  function fBed(p, o) {
    const x = o.x, y = o.y, W = o.w || 104, D = o.d || 96;
    box(p, { x: x, y: y, w: W, d: D, h: 16, c: '#b98d63', r: 5 });                        // 床架
    box(p, { x: x, y: y, w: W - 6, d: D - 6, h: 10, z0: 16, c: '#f4f6f9', r: 8 });        // 床垫
    box(p, { x: x, y: y + D / 2 - 26, w: W - 10, d: D * 0.42, h: 5, z0: 26, c: '#93abc9', r: 5 }); // 被子
    box(p, { x: x, y: y - D / 2 + 16, w: W * 0.42, d: 20, h: 7, z0: 26, c: '#ffffff', r: 6 });     // 枕头
  }
  function fTable(p, o) {
    const x = o.x, y = o.y, W = o.w || 78, D = o.d || 48, H = o.h || 42;
    const leg = 5;
    box(p, { x: x, y: y, w: W, d: D, h: 5, c: '#cba877', r: 4, z0: H - 5 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      box(p, { x: x + s[0] * (W / 2 - 8), y: y + s[1] * (D / 2 - 8), w: leg, d: leg, h: H - 5, c: '#a5824f', r: 2 });
    });
  }
  function fCoffee(p, o) {
    const x = o.x, y = o.y, W = 62, D = 34;
    box(p, { x: x, y: y, w: W, d: D, h: 4, c: '#c9a373', r: 4, z0: 14 });
    box(p, { x: x, y: y, w: W - 18, d: D - 14, h: 12, c: '#b98d63', r: 3 });
  }
  function fTv(p, o) {
    const x = o.x, y = o.y;
    box(p, { x: x, y: y, w: 104, d: 22, h: 26, c: '#8d7f6e', r: 4 });                     // 电视柜
    box(p, { x: x, y: y - 6, w: 72, d: 5, h: 42, z0: 34, c: '#20242b', r: 2 });           // 电视
    box(p, { x: x, y: y - 8, w: 64, d: 2, h: 36, z0: 37, c: '#3d4a5c', r: 1 });           // 屏幕
  }
  function fCounter(p, o) {
    const x = o.x, y = o.y, W = 40, D = 96;
    box(p, { x: x, y: y, w: W, d: D, h: 32, c: '#cfd6dd', r: 3 });
    box(p, { x: x, y: y, w: W + 4, d: D + 4, h: 4, z0: 32, c: '#eef1f4', r: 3 });         // 台面
    box(p, { x: x - 6, y: y + 24, w: 22, d: 26, h: 2, z0: 36, c: '#b8c4cf', r: 8 });      // 水槽
    box(p, { x: x + 5, y: y - 22, w: 22, d: 22, h: 2, z0: 36, c: '#3a3f47', r: 8 });      // 灶面
  }
  function fTub(p, o) {
    const x = o.x, y = o.y, W = 64, D = 36;
    const t = box(p, { x: x, y: y, w: W, d: D, h: 18, c: '#f4f7fa', r: 9 });
    // 内腔
    const inner = mk('face top', t);
    inner.style.cssText =
      'width:' + (W - 14) + 'px;height:' + (D - 12) + 'px;border-radius:10px;' +
      'background:radial-gradient(ellipse at 50% 45%, #cfe3ee 0 55%, #e4eef4 78%, #f4f7fa);' +
      'transform:translate(-50%,-50%) translate3d(' + x + 'px,' + y + 'px,18.6px)';
    box(p, { x: x + W / 2 - 4, y: y, w: 4, d: 6, h: 10, z0: 18, c: '#c3cdd6', r: 2 });    // 龙头
  }
  function fToilet(p, o) {
    const x = o.x, y = o.y;
    box(p, { x: x, y: y - 12, w: 28, d: 10, h: 24, c: '#eef1f4', r: 3 });                 // 水箱
    box(p, { x: x, y: y + 4, w: 24, d: 28, h: 14, c: '#f6f8fa', r: 9 });                  // 座圈
  }
  function fWard(p, o) {
    const x = o.x, y = o.y, W = o.w || 56, D = o.d || 42, H = o.h || 78;
    box(p, { x: x, y: y, w: W, d: D, h: H, c: '#a98763', r: 3 });
    box(p, { x: x, y: y, w: W - 6, d: D - 4, h: H - 5, z0: 3, c: '#b69372', r: 2 });      // 柜门
    box(p, { x: x, y: y + D / 2 + 0.5, w: 3, d: 1.5, h: 12, z0: H / 2 - 6, c: '#5c4327', r: 1 }); // 把手
  }
  function fShelf(p, o) {
    const x = o.x, y = o.y, W = 38, D = 106, H = 78;
    box(p, { x: x, y: y, w: W, d: D, h: H, c: '#9c8468', r: 3 });
    for (let i = 1; i <= 3; i++) {
      box(p, { x: x, y: y, w: W - 8, d: D - 8, h: 3, z0: (H / 4) * i, c: '#c9b493', r: 1 }); // 层板
    }
    box(p, { x: x - 4, y: y - 30, w: 10, d: 14, h: 12, z0: H / 4 + 3, c: '#c96f4a', r: 2 }); // 书
    box(p, { x: x + 2, y: y + 10, w: 8, d: 18, h: 14, z0: H / 2 + 3, c: '#5b8cff', r: 2 });
    box(p, { x: x - 2, y: y + 42, w: 12, d: 10, h: 10, z0: H * 0.75 + 3, c: '#2ecf85', r: 2 });
  }
  function fChair(p, o) {
    const x = o.x, y = o.y;
    box(p, { x: x, y: y, w: 28, d: 28, h: 13, c: '#a9714c', r: 5 });
    box(p, { x: x, y: y - 12, w: 28, d: 5, h: 24, z0: 13, c: '#9c6540', r: 3 });
  }
  function fStand(p, o) {
    box(p, { x: o.x, y: o.y, w: 26, d: 26, h: 26, c: '#b98c62', r: 3 });
    box(p, { x: o.x, y: o.y, w: 22, d: 22, h: 2, z0: 13, c: '#8a6238', r: 1 });           // 抽屉缝
  }
  function fCabinet(p, o) {
    box(p, { x: o.x, y: o.y, w: 100, d: 52, h: 22, c: '#c2a887', r: 4 });
    box(p, { x: o.x, y: o.y, w: 94, d: 46, h: 2, z0: 12, c: '#a98c6c', r: 2 });
  }

  const FURN = {
    sofa: fSofa, bed: fBed, table: fTable, coffee: fCoffee, tv: fTv, counter: fCounter,
    tub: fTub, toilet: fToilet, ward: fWard, shelf: fShelf, chair: fChair, stand: fStand, cabinet: fCabinet,
  };

  /* ---------------- 墙体（基座 / 半透明墙 + 顶棱 / 窗框 / 门框） ---------------- */
  function buildWall(parent, W) {
    const horiz = Math.abs(W.y2 - W.y1) < 1;
    const len = horiz ? Math.abs(W.x2 - W.x1) : Math.abs(W.y2 - W.y1);
    const cx = (W.x1 + W.x2) / 2, cy = (W.y1 + W.y2) / 2;
    const H = W.h || PLAN.h;
    const ops = (W.openings || []).slice().sort(function (a, b) { return a.at - b.at; });

    const place = function (el, along, raise) {
      // along: 沿墙轴的偏移（相对墙中心）；raise: 底部抬升
      if (horiz) {
        el.style.transform = 'translate(-50%,-100%) translate3d(' + (cx + along) + 'px,' + cy + 'px,' + (raise || 0) + 'px) rotateX(-90deg)';
      } else {
        el.style.transform = 'translate(-50%,-100%) translate3d(' + cx + 'px,' + (cy + along) + 'px,' + (raise || 0) + 'px) rotateZ(90deg) rotateX(-90deg)';
      }
    };

    const seg = function (a, b) {
      const L = b - a;
      if (L <= 0.5) return;
      const mid = (a + b) / 2;
      const el = mk('dwall', parent);
      el.style.width = L + 'px';
      el.style.height = H + 'px';
      place(el, mid, 0);
      // 顶棱（白色压顶，增加体积感；竖墙需同样旋转）
      const cap = mk('dwall-cap', parent);
      cap.style.width = L + 'px';
      cap.style.height = '8px';
      if (horiz) {
        cap.style.transform = 'translate(-50%,-50%) translate3d(' + (cx + mid) + 'px,' + cy + 'px,' + H + 'px)';
      } else {
        cap.style.transform = 'translate(-50%,-50%) translate3d(' + cx + 'px,' + (cy + mid) + 'px,' + H + 'px) rotateZ(90deg)';
      }
    };

    let cur = -len / 2;
    ops.forEach(function (op) {
      seg(cur, op.at - op.w / 2);

      if (op.type === 'window') {
        // 白色窗框（略大于洞口）+ 玻璃 + 中梃
        const fr = mk('dframe', parent);
        fr.style.width = (op.w + 8) + 'px';
        fr.style.height = (H - 40) + 'px';
        place(fr, op.at, 38);
        const gl = mk('dwall glass', parent);
        gl.style.width = op.w + 'px';
        gl.style.height = (H - 48) + 'px';
        place(gl, op.at, 42);
      }
      if (op.type === 'door') {
        // 门框两侧 + 门楣
        [-1, 1].forEach(function (s) {
          const j = mk('dframe', parent);
          j.style.width = '6px';
          j.style.height = H + 'px';
          place(j, op.at + s * (op.w / 2 + 3), 0);
        });
        const lin = mk('dframe', parent);
        lin.style.width = (op.w + 12) + 'px';
        lin.style.height = (H - 86) + 'px';
        place(lin, op.at, 86);
      }
      cur = op.at + op.w / 2;
    });
    seg(cur, len / 2);
  }

  /* ---------------- 楼层数据 ---------------- */
  const floors = [
    {
      name: '一层',
      floorCls: 'wood',
      zones: [{ x: -150, y: 118, w: 165, d: 100, c: 'rgba(226,236,240,.9)' }],
      rooms: [{ x: -160, y: -95, n: '客厅' }, { x: 148, y: -100, n: '餐厅 · 厨房' }, { x: -145, y: 118, n: '卫浴' }, { x: 150, y: 118, n: '客房' }],
      walls: [
        { x1: -235, y1: -170, x2: 235, y2: -170, openings: [{ at: -70, w: 110, type: 'window' }] },
        { x1: 235, y1: -170, x2: 235, y2: 170, openings: [{ at: 60, w: 96, type: 'window' }] },
        { x1: -235, y1: 170, x2: 235, y2: 170, openings: [{ at: 24, w: 72, type: 'door' }] },
        { x1: -235, y1: -170, x2: -235, y2: 170, openings: [{ at: -10, w: 90, type: 'window' }] },
        { x1: 40, y1: -170, x2: 40, y2: 40, openings: [{ at: -60, w: 80, type: 'window' }] },
        { x1: 40, y1: 40, x2: 235, y2: 40, openings: [] },
      ],
      furn: [
        { k: 'tv', x: -160, y: -152 },
        { k: 'sofa', x: -160, y: -95 },
        { k: 'coffee', x: -160, y: -28 },
        { k: 'table', x: 140, y: -108, w: 78, d: 48, h: 42 },
        { k: 'counter', x: 205, y: -88 },
        { k: 'tub', x: -100, y: 128 },
        { k: 'toilet', x: -186, y: 130 },
        { k: 'bed', x: 152, y: 116, w: 104, d: 96 },
        { k: 'stand', x: 78, y: 58 },
        { k: 'rug', x: -160, y: -60 },
      ],
      devices: [
        { id: 'l1', type: 'ceiling', name: '客厅灯', icon: '💡', x: -160, y: -55, z: 106, watt: 18 },
        { id: 'l2', type: 'lamp', name: '落地灯', icon: '🛋️', x: -58, y: 52, z: 0, watt: 9 },
        { id: 'ac', type: 'ac', name: '空调', icon: '❄️', x: 150, y: -162, z: 30, watt: 780 },
        { id: 'cov', type: 'curtain', name: '窗帘', icon: '🧵', x: -70, y: -166, z: 0, watt: 0, w: 110 },
        { id: 'fan', type: 'fan', name: '风扇', icon: '🌀', x: 96, y: -18, z: 0, watt: 25 },
        { id: 'door', type: 'door', name: '门磁', icon: '🚪', x: 24, y: 168, z: 0, watt: 0, w: 72 },
      ],
    },
    {
      name: '二层',
      floorCls: 'bedroom',
      zones: [],
      rooms: [{ x: -60, y: -110, n: '主卧' }, { x: 150, y: 96, n: '书房' }],
      walls: [
        { x1: -235, y1: -170, x2: 235, y2: -170, openings: [{ at: 40, w: 120, type: 'window' }] },
        { x1: 235, y1: -170, x2: 235, y2: 170, openings: [{ at: 40, w: 90, type: 'window' }] },
        { x1: -235, y1: 170, x2: 235, y2: 170, openings: [{ at: 130, w: 70, type: 'door' }] },
        { x1: -235, y1: -170, x2: -235, y2: 170, openings: [] },
        { x1: -235, y1: -30, x2: 40, y2: -30, openings: [] },
      ],
      furn: [
        { k: 'bed', x: -20, y: -108, w: 112, d: 120 },
        { k: 'stand', x: 60, y: -150 },
        { k: 'ward', x: 175, y: -110, w: 56, d: 42, h: 78 },
        { k: 'table', x: -170, y: -110, w: 88, d: 44, h: 40 },
        { k: 'chair', x: -170, y: -58 },
        { k: 'shelf', x: -200, y: 92 },
        { k: 'cabinet', x: 150, y: 120 },
        { k: 'rug', x: 150, y: 60 },
      ],
      devices: [
        { id: 'l3', type: 'ceiling', name: '主灯', icon: '💡', x: -60, y: -105, z: 108, watt: 24 },
        { id: 'l4', type: 'lamp', name: '床头灯', icon: '🛏️', x: 96, y: -40, z: 0, watt: 6 },
        { id: 'ac2', type: 'ac', name: '空调', icon: '❄️', x: 150, y: -150, z: 30, watt: 620 },
        { id: 'cov2', type: 'curtain', name: '窗帘', icon: '🧵', x: 40, y: -166, z: 0, watt: 0, w: 120 },
      ],
    },
  ];

  /* ---------------- 设备初始状态 ---------------- */
  const state = { l1: false, l2: true, ac: false, cov: true, fan: false, door: false, l3: false, l4: false, ac2: false, cov2: true };

  /* ---------------- 场景 ---------------- */
  const scenes = [
    { name: '回家', set: { door: true, l1: true, ac: true } },
    { name: '观影', set: { l1: false, l2: true, cov: false } },
    { name: '睡眠', set: { l1: false, l2: false, ac: false, cov: false, fan: false, door: false } },
  ];

  /* ================= 渲染 ================= */
  let content = null;
  let fxLayer = null;

  function renderFloor(idx) {
    const F = floors[idx];
    devEls = {};

    if (content) content.remove();
    content = mk('', world);
    content.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d';

    fxLayer = mk('', content);
    fxLayer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;';

    /* 房屋基座（借鉴原项目的底板） */
    box(content, { x: 0, y: 0, w: PLAN.w + 40, d: PLAN.d + 40, h: 14, z0: -14, c: '#e5d3ae', r: 8 });
    box(content, { x: 0, y: 0, w: PLAN.w + 40, d: PLAN.d + 40, h: 2, z0: 0, c: '#efe1c2', r: 6 });

    /* 地板 */
    const fl = mk('dfloor ' + F.floorCls, content);
    fl.style.width = PLAN.w + 'px';
    fl.style.height = PLAN.d + 'px';

    /* 区域地面（卫浴瓷砖等） */
    (F.zones || []).forEach(function (z) {
      const el = mk('dfloor tile', content);
      el.style.width = z.w + 'px';
      el.style.height = z.d + 'px';
      el.style.setProperty('--fx', z.x + 'px');
      el.style.setProperty('--fy', z.y + 'px');
      el.style.setProperty('--fz', '1px');
      el.style.background = z.c;
      el.style.boxShadow = 'inset 0 0 0 1px rgba(120,140,160,.3)';
    });

    /* 地毯 */
    (F.furn || []).forEach(function (f) {
      if (f.k === 'rug') {
        const el = mk('', content);
        el.style.cssText =
          'position:absolute;left:0;top:0;width:110px;height:70px;border-radius:10px;' +
          'transform:translate(-50%,-50%) translate3d(' + f.x + 'px,' + f.y + 'px,1.5px);' +
          'background:linear-gradient(135deg, rgba(247,171,46,.16), rgba(91,140,255,.12));' +
          'box-shadow:inset 0 0 0 2px rgba(150,130,100,.25);pointer-events:none';
      }
    });

    /* 房间名 */
    (F.rooms || []).forEach(function (r) {
      const t = mk('', content);
      t.textContent = r.n;
      t.style.cssText =
        'position:absolute;left:0;top:0;transform:translate3d(' + r.x + 'px,' + r.y + 'px,2px) translate(-50%,-50%);' +
        'font-size:11px;letter-spacing:2px;color:rgba(60,72,88,.4);pointer-events:none;white-space:nowrap';
    });

    /* 墙体 */
    F.walls.forEach(function (w) { buildWall(content, w); });

    /* 家具 */
    F.furn.forEach(function (f) {
      if (f.k === 'rug') return;
      (FURN[f.k] || function () {})(content, f);
    });

    /* 设备 */
    F.devices.forEach(function (d) { renderDevice(d, content); });

    renderQuick();
    updateUI();
  }

  /* ---------------- 单个设备 ---------------- */
  function renderDevice(d, parent) {
    const root = mk('ddev', parent);
    root.dataset.id = d.id;
    root.style.transform = 'translate3d(' + d.x + 'px,' + d.y + 'px,' + (d.z || 0) + 'px)';

    const body = {};

    if (d.type === 'ceiling') {
      const disc = mk('dlamp-disc off', root);
      const ring = mk('', disc);
      ring.style.cssText = 'position:absolute;inset:5px;border-radius:50%;border:2px solid rgba(255,255,255,.75)';
      const glow = mk('dglow', root);
      const pool = mk('dpool', fxLayer);
      pool.style.transform = 'translate3d(' + d.x + 'px,' + d.y + 'px,2px)';
      body.disc = disc; body.glow = glow; body.pool = pool;
    }

    if (d.type === 'lamp') {
      box(root, { x: 0, y: 0, w: 20, d: 20, h: 3, c: '#8c99aa', r: 8 });                  // 底盘
      const pole = mk('dpole', root);
      pole.style.height = '52px';
      pole.style.transform = 'translate(-50%,-100%) rotateX(-90deg)';
      const shade = mk('dlamp-shade off', root);
      shade.style.transform = 'translate3d(0,0,52px)';
      const glow = mk('dglow', root);
      glow.style.transform = 'translate3d(0,0,54px) rotateZ(calc(-1 * var(--rz, -30deg))) rotateX(calc(-1 * var(--rx, 58deg)))';
      glow.style.width = glow.style.height = '120px';
      glow.style.margin = '-60px 0 0 -60px';
      const pool = mk('dpool', fxLayer);
      pool.style.transform = 'translate3d(' + d.x + 'px,' + d.y + 'px,2px)';
      pool.style.width = pool.style.height = '160px';
      pool.style.margin = '-80px 0 0 -80px';
      body.shade = shade; body.glow = glow; body.pool = pool;
    }

    if (d.type === 'ac') {
      box(root, { x: 0, y: 0, w: 82, d: 20, h: 26, z0: 24, c: '#f4f7fa', r: 6 });          // 机身
      box(root, { x: 0, y: 6, w: 74, d: 3, h: 3, z0: 26, c: '#c6d2dd', r: 2 });            // 出风缝
      const led = mk('dac-led', root);                                                     // 状态灯（面向屏幕）
      led.style.transform = 'translate3d(28px,-6px,40px) rotateZ(calc(-1 * var(--rz, -30deg))) rotateX(calc(-1 * var(--rx, 58deg)))';
      const flowWrap = mk('', root);
      flowWrap.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;' +
        'transform:translate3d(0,0,24px) rotateZ(calc(-1 * var(--rz, -30deg))) rotateX(calc(-1 * var(--rx, 58deg)))';
      [-26, -9, 8, 25].forEach(function (dx, i) {
        const ln = mk('dac-flow', flowWrap);
        ln.style.left = dx + 'px';
        ln.style.animationDelay = (i * 0.22) + 's';
      });
      body.flow = flowWrap; body.led = led;
    }

    if (d.type === 'curtain') {
      const w = d.w || 100;
      // 窗帘盒（挂杆，贴在窗楣下方）
      const rail = mk('dframe', root);
      rail.style.width = (w + 10) + 'px';
      rail.style.height = '5px';
      rail.style.transform = 'translate(-50%,-100%) translate3d(0,0,72px) rotateX(-90deg)';
      const p1 = mk('dcurtain', root);
      const p2 = mk('dcurtain', root);
      p1.style.height = p2.style.height = '66px';
      body.p1 = p1; body.p2 = p2; body.win = w;
      root.style.transform = 'translate3d(' + d.x + 'px,' + d.y + 'px,' + 36 + 'px)';
    }

    if (d.type === 'fan') {
      box(root, { x: 0, y: 0, w: 22, d: 22, h: 4, c: '#8c99aa', r: 8 });                   // 底座
      const pole = mk('dpole', root);
      pole.style.height = '42px';
      pole.style.transform = 'translate(-50%,-100%) rotateX(-90deg)';
      const ring = mk('dfan-ring', root);
      ring.style.transform = 'translate3d(0,0,44px)';
      const top = mk('', root);
      top.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;transform:translate3d(0,0,44px);';
      const blades = mk('dfan-blades', top);
      for (let i = 0; i < 3; i++) {
        const b = mk('', blades);
        b.style.cssText = 'position:absolute;left:0;top:0;width:42px;height:9px;margin:-4.5px 0 0 0;' +
          'border-radius:8px 3px 8px 3px;background:linear-gradient(90deg,rgba(110,122,140,.95),rgba(190,202,218,.95));' +
          'transform:rotate(' + (i * 120) + 'deg);transform-origin:0% 50%;';
      }
      body.blades = blades;
    }

    if (d.type === 'door') {
      const w = d.w || 72;
      const leaf = mk('dleaf', root);
      leaf.style.width = (w - 6) + 'px';
      leaf.style.height = (PLAN.h - 12) + 'px';
      // 门板造型：凹槽 + 把手
      leaf.style.background =
        'linear-gradient(90deg, rgba(255,255,255,.14) 0 4px, transparent 4px), ' +
        'radial-gradient(circle 3px at 82% 52%, #4a2f18 0 3px, transparent 3px), ' +
        'linear-gradient(180deg, #a9734a, #8a5a36 70%, #744a2c)';
      body.leaf = leaf; body.doorW = w;
    }

    const label = mk('dlabel', root);
    label.innerHTML = '<span>' + d.name + '</span><small></small>';
    body.label = label;

    root.addEventListener('click', function (e) {
      e.stopPropagation();
      if (suppressClick) return;
      toggle(d.id);
    });

    devEls[d.id] = { d: d, body: body };
    applyDevice(d.id);
  }

  /* ---------------- 状态 → 外观 ---------------- */
  function applyDevice(id) {
    const rec = devEls[id];
    if (!rec) return;
    const on = !!state[id];
    const b = rec.body;

    if (b.disc) {
      b.disc.classList.toggle('off', !on);
      b.glow.classList.toggle('on', on);
      b.pool.classList.toggle('on', on);
    }
    if (b.shade) {
      b.shade.classList.toggle('on', on);
      b.shade.classList.toggle('off', !on);
      b.glow.classList.toggle('on', on);
      b.pool.classList.toggle('on', on);
    }
    if (b.flow) b.flow.classList.toggle('on', on);
    if (b.led) b.led.classList.toggle('on', on);
    if (b.blades) b.blades.classList.toggle('on', on);
    if (b.leaf) {
      const ang = on ? 74 : 0;
      const w = b.doorW;
      b.leaf.style.transform = 'translate(0,-100%) translate3d(-' + (w / 2) + 'px,0,0) rotateZ(' + ang + 'deg) rotateX(-90deg)';
    }
    if (b.p1 && b.p2) {
      const win = rec.d.w || 100;
      const half = win / 2;
      const openW = on ? 18 : half + 2;              // 开：收到两侧；关：两片在中间合拢
      const c = on ? (half - openW / 2) : openW / 2; // 面板中心到窗中心的距离
      b.p1.style.width = openW + 'px';
      b.p2.style.width = openW + 'px';
      b.p1.style.transform = 'translate(-50%,-100%) translate3d(' + (-c) + 'px,0,0) rotateX(-90deg)';
      b.p2.style.transform = 'translate(-50%,-100%) translate3d(' + c + 'px,0,0) rotateX(-90deg)';
    }

    const lbl = b.label;
    if (lbl) {
      lbl.classList.toggle('on', on);
      const small = lbl.querySelector('small');
      if (small) small.textContent = on ? '已开启' : '已关闭';
    }
  }

  /* ---------------- HUD 更新 ---------------- */
  function updateUI() {
    const F = floors[floorIdx];
    const total = F.devices.length;
    const onN = F.devices.filter(function (d) { return state[d.id]; }).length;

    document.getElementById('onCount').textContent = onN;
    document.getElementById('devTotal').textContent = total;
    document.getElementById('ovBar').style.width = (total ? (onN / total) * 100 : 0) + '%';

    let pw = 0;
    floors.forEach(function (fl) {
      fl.devices.forEach(function (d) { if (state[d.id]) pw += (d.watt || 0); });
    });
    document.getElementById('pw').textContent = pw;

    document.querySelectorAll('#quick .q-btn').forEach(function (btn) {
      btn.classList.toggle('on', !!state[btn.dataset.id]);
    });
  }

  function renderQuick() {
    const wrap = document.getElementById('quick');
    wrap.innerHTML = '';
    floors[floorIdx].devices.slice(0, 3).forEach(function (d) {
      const b = document.createElement('button');
      b.className = 'q-btn';
      b.dataset.id = d.id;
      b.innerHTML = '<span>' + (d.icon || '💡') + '</span><span class="tx">' + d.name + '</span>';
      b.addEventListener('click', function (e) { e.stopPropagation(); toggle(d.id); });
      wrap.appendChild(b);
    });
  }

  /* ---------------- 交互动作 ---------------- */
  let toastTimer = null;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  function toggle(id) {
    state[id] = !state[id];
    applyDevice(id);
    updateUI();
    const el = devEls[id];
    const name = el ? el.d.name : id;
    toast(name + ' · ' + (state[id] ? '已开启' : '已关闭'));
  }

  /* ---------------- 场景执行 ---------------- */
  function buildScenes() {
    const wrap = document.getElementById('scenes');
    wrap.innerHTML = '';
    scenes.forEach(function (s) {
      const row = document.createElement('div');
      row.className = 'sc-item';
      row.innerHTML = '<span class="nm">' + s.name + '</span>' +
        '<button class="sc-run" title="执行场景">▶</button>';
      const btn = row.querySelector('.sc-run');
      btn.addEventListener('click', function (e) { e.stopPropagation(); runScene(s, btn); });
      wrap.appendChild(row);
    });
  }

  function runScene(s, btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('busy');
    btn.innerHTML = '<span class="spin"></span>';

    const keys = Object.keys(s.set);
    keys.forEach(function (k, i) {
      setTimeout(function () {
        state[k] = s.set[k];
        applyDevice(k);
        updateUI();
      }, i * 220);
    });

    setTimeout(function () {
      btn.classList.remove('busy');
      btn.classList.add('ok');
      btn.innerHTML = '✓';
      toast('场景「' + s.name + '」已执行');
      setTimeout(function () {
        btn.classList.remove('ok');
        btn.innerHTML = '▶';
        btn.disabled = false;
      }, 1600);
    }, keys.length * 220 + 240);
  }

  /* ---------------- 拖拽 / 锚点 ---------------- */
  function planPoint(ev) {
    const r = stage.getBoundingClientRect();
    const sx = ev.clientX - (r.left + r.width / 2);
    const sy = ev.clientY - (r.top + r.height * 0.52);
    const th = rz * Math.PI / 180;
    const y1 = sy / Math.max(0.35, Math.cos(rx * Math.PI / 180));
    return {
      x: sx * Math.cos(th) + y1 * Math.sin(th),
      y: -sx * Math.sin(th) + y1 * Math.cos(th),
    };
  }

  function pulse(x, y) {
    if (!fxLayer) return;
    const d = mk('pulse-ring', fxLayer);
    d.style.setProperty('--lx', x + 'px');
    d.style.setProperty('--ly', y + 'px');
    setTimeout(function () { d.remove(); }, 1150);
  }

  function setAnchor(x, y) {
    ox = Math.max(-260, Math.min(260, x));
    oy = Math.max(-210, Math.min(210, y));
    applyView();
    pulse(ox, oy);
    toast('旋转锚点已移动 · 长按画面可再次调整');
  }

  let start = null;
  dvp.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    dragging = true;
    suppressClick = false;
    start = { x: e.clientX, y: e.clientY, rz: rz, rx: rx, moved: false };
    dvp.classList.add('dragging');
    dvp.setPointerCapture(e.pointerId);

    const onDevice = !!(e.target.closest && e.target.closest('.ddev'));
    if (!onDevice) {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(function () {
        if (start && !start.moved) {
          const p = planPoint(e);
          suppressClick = true;
          setAnchor(p.x, p.y);
        }
      }, 520);
    }
  });

  dvp.addEventListener('pointermove', function (e) {
    if (!dragging || !start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > 7) {
      start.moved = true;
      clearTimeout(pressTimer);
    }
    rz = start.rz - dx * 0.34;
    rx = Math.max(24, Math.min(78, start.rx - dy * 0.26));
    applyView();
  });

  function endDrag() {
    dragging = false;
    dvp.classList.remove('dragging');
    clearTimeout(pressTimer);
    if (start && start.moved) {
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 30);
    }
    start = null;
  }
  dvp.addEventListener('pointerup', endDrag);
  dvp.addEventListener('pointercancel', endDrag);

  dvp.addEventListener('click', function () {
    if (suppressClick) { suppressClick = false; }
  });

  /* ---------------- 工具按钮 ---------------- */
  const btnRotate = document.getElementById('btnRotate');
  btnRotate.addEventListener('click', function () {
    autoRotate = !autoRotate;
    btnRotate.classList.toggle('on', autoRotate);
    if (autoRotate) startLoop(); else stopLoop();
    toast(autoRotate ? '自动旋转 · 开' : '自动旋转 · 关');
  });

  const btnLabels = document.getElementById('btnLabels');
  btnLabels.addEventListener('click', function () {
    labelsOn = !labelsOn;
    stage.classList.toggle('dlabels-off', !labelsOn);
    btnLabels.classList.toggle('on', labelsOn);
  });

  document.getElementById('btnAnchor').addEventListener('click', function () {
    ox = 0; oy = 0; applyView(); pulse(0, 0);
    toast('旋转锚点已重置到房屋中心');
  });

  const BGS = [
    { k: 'grid', icon: '▦', name: '网格' },
    { k: 'meadow', icon: '🌿', name: '草原' },
    { k: 'beach', icon: '🏖️', name: '沙滩' },
    { k: 'snow', icon: '❄️', name: '雪地' },
    { k: 'night', icon: '🌙', name: '夜色' },
  ];
  let bgIdx = 0;
  const btnBg = document.getElementById('btnBg');
  btnBg.addEventListener('click', function () {
    bgIdx = (bgIdx + 1) % BGS.length;
    stage.dataset.bg = BGS[bgIdx].k;
    btnBg.textContent = BGS[bgIdx].icon + ' ' + BGS[bgIdx].name;
    toast('背景插件 · ' + BGS[bgIdx].name);
  });

  /* ---------------- 楼层 ---------------- */
  document.querySelectorAll('#floors button').forEach(function (b) {
    b.addEventListener('click', function () {
      floorIdx = parseInt(b.dataset.floor, 10);
      document.querySelectorAll('#floors button').forEach(function (x) { x.classList.toggle('active', x === b); });
      renderFloor(floorIdx);
      toast('切换到 · ' + floors[floorIdx].name);
    });
  });

  /* ---------------- 自动旋转循环（仅在需要时运行） ---------------- */
  let rafId = 0;
  let last = performance.now();
  function loop(t) {
    const dt = Math.min(64, t - last) / 16.67;
    last = t;
    if (autoRotate && !dragging) {
      rz += 0.22 * dt;
      applyView();
    }
    rafId = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (rafId || reduceMotion) return;
    last = performance.now();
    rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /* ---------------- 启动 ---------------- */
  applyView();
  stage.classList.toggle('dlabels-off', !labelsOn);
  buildScenes();
  renderFloor(0);

  function fit() {
    const sc = Math.min(1, Math.max(0.52, (stage.clientWidth - 60) / 720));
    world.style.setProperty('--sc', sc.toFixed(3));
  }
  fit();
  window.addEventListener('resize', fit);

  let nudged = false;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting && !nudged && !reduceMotion) {
          nudged = true;
          const from = rz;
          let k = 0;
          const tick = function () {
            k += 1;
            rz = from + Math.sin(k / 7) * 9 * Math.max(0, 1 - k / 46);
            applyView();
            if (k < 46) requestAnimationFrame(tick);
            else { rz = from; applyView(); }
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      });
    }, { threshold: 0.35 });
    io.observe(stage);
  }

  /* ---------------- 省电：演示区不可见 / 标签页隐藏时不跑动画 ---------------- */
  if ('IntersectionObserver' in window) {
    const vis = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!autoRotate) return;
        if (en.isIntersecting && !document.hidden) startLoop();
        else stopLoop();
      });
    }, { threshold: 0.05 });
    vis.observe(stage);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop();
    else if (autoRotate) startLoop();
  });
})();
