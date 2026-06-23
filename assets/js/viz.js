/* ===================================================================
   半导体结构 · 交互可视化（纯 Canvas，无依赖）
   3D 可旋转晶体结构：cubic 立方晶胞 / diamond 金刚石&闪锌矿 / wurtzite 纤锌矿
     / nacl 氯化钠 / cscl 氯化铯 / rutile 金红石 / perovskite 钙钛矿
     / graphite 石墨 / closepack 密堆积
   晶体学：bravais 14 种布拉菲格子 / reduce 不存在的格子如何并入更小格子 / density 面密度切片
   2D / 动画：miller 晶面指数 / edge 刃型位错 / slip 位错滑移动画
=================================================================== */
(function () {
  "use strict";

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function C() {
    return {
      ink: css("--text") || "#222", soft: css("--text-soft") || "#666", faint: css("--text-faint") || "#999",
      grid: css("--border") || "#ddd", primary: css("--primary") || "#2563d8", accent: css("--accent") || "#0d9488",
      danger: css("--danger") || "#e1463a", warn: css("--warn") || "#c97a00", surface: css("--surface") || "#fff",
    };
  }
  function makeCanvas(host, h) {
    const wrap = document.createElement("div"); wrap.style.cssText = "position:relative;width:100%;";
    const cv = document.createElement("canvas"); cv.style.cssText = "width:100%;display:block;border-radius:10px;";
    wrap.appendChild(cv); host.appendChild(wrap);
    function resize() {
      const w = wrap.clientWidth || 600, dpr = window.devicePixelRatio || 1;
      cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + "px";
      const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w, h };
    }
    return { cv, wrap, resize };
  }
  function control(host, label, min, max, step, val, fmt, onInput) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:12px;margin:14px 0 4px;flex-wrap:wrap;";
    const lab = document.createElement("label"); lab.style.cssText = "font-size:14px;font-weight:600;min-width:120px;";
    const sl = document.createElement("input"); sl.type = "range"; sl.min = min; sl.max = max; sl.step = step; sl.value = val;
    sl.style.cssText = "flex:1;min-width:160px;accent-color:var(--primary);";
    const out = document.createElement("span");
    out.style.cssText = "font-variant-numeric:tabular-nums;font-weight:700;color:var(--primary);min-width:90px;text-align:right;";
    function upd() { out.innerHTML = fmt(parseFloat(sl.value)); lab.innerHTML = label; }
    sl.addEventListener("input", () => { upd(); onInput(parseFloat(sl.value)); }); upd();
    row.appendChild(lab); row.appendChild(sl); row.appendChild(out); host.appendChild(row); return sl;
  }
  function btnRow(host, labels, cb) {
    const row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;";
    labels.forEach((t, i) => {
      const b = document.createElement("button"); b.className = "btn" + (i === 0 ? " primary" : ""); b.textContent = t;
      b.onclick = () => { row.querySelectorAll("button").forEach((x, j) => x.className = "btn" + (j === i ? " primary" : "")); cb(i); };
      row.appendChild(b);
    });
    host.appendChild(row); return row;
  }
  function caption(host, html) {
    const p = document.createElement("p"); p.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;";
    p.innerHTML = html; host.appendChild(p);
  }
  function legend(host, items) {
    const d = document.createElement("div"); d.className = "viz-legend"; d.style.marginTop = "10px";
    d.innerHTML = items.map(it => `<span><i style="background:var(--${it.c})"></i>${it.t}</span>`).join("");
    host.appendChild(d);
  }
  function atom(ctx, x, y, r, fill, ink) {
    if (r < 0.5) r = 0.5;
    const g = ctx.createRadialGradient(x - r * .35, y - r * .35, r * .15, x, y, r);
    g.addColorStop(0, "#fff"); g.addColorStop(.28, fill); g.addColorStop(1, fill);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
  }

  // ---------- 3D 旋转内核 ----------
  function rot(p, ax, ay) {
    const cy = Math.cos(ay), sy = Math.sin(ay);
    const x = p.x * cy + p.z * sy, z = -p.x * sy + p.z * cy, y = p.y;
    const cx = Math.cos(ax), sx = Math.sin(ax);
    return { x: x, y: y * cx - z * sx, z: y * sx + z * cx };
  }
  function interactive3D(host, build, opts) {
    opts = opts || {};
    const { cv, resize } = makeCanvas(host, opts.height || 340);
    cv.style.cursor = "grab"; cv.style.touchAction = "none";
    let ax = opts.ax != null ? opts.ax : -0.5, ay = opts.ay != null ? opts.ay : 0.7;
    let dragging = false, wantSpin = opts.spin !== false, visible = true, raf = null, px = 0, py = 0;
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const scene = build(col); const unit = scene.unit || 1.3;
      const scale = Math.min(w, h) / 2 * 0.80 / unit, cx = w / 2, cy = h / 2;
      const SX = p => cx + p.x * scale, SY = p => cy - p.y * scale;
      if (scene.edges) {
        ctx.strokeStyle = col.grid; ctx.lineWidth = 1.4;
        scene.edges.forEach(e => { const a = rot(e[0], ax, ay), b = rot(e[1], ax, ay);
          ctx.beginPath(); ctx.moveTo(SX(a), SY(a)); ctx.lineTo(SX(b), SY(b)); ctx.stroke(); });
      }
      if (scene.polys) {
        scene.polys.forEach(P => {
          const pr = P.pts.map(p => rot(p, ax, ay));
          ctx.beginPath(); pr.forEach((p, i) => { const X = SX(p), Y = SY(p); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath();
          ctx.fillStyle = P.fill; ctx.globalAlpha = P.alpha == null ? 0.16 : P.alpha; ctx.fill();
          ctx.globalAlpha = 0.6; ctx.strokeStyle = P.stroke || P.fill; ctx.lineWidth = 1.6; ctx.stroke(); ctx.globalAlpha = 1;
        });
      }
      if (scene.edges2) {
        ctx.strokeStyle = col.accent; ctx.lineWidth = 2.6;
        scene.edges2.forEach(e => { const a = rot(e[0], ax, ay), b = rot(e[1], ax, ay);
          ctx.beginPath(); ctx.moveTo(SX(a), SY(a)); ctx.lineTo(SX(b), SY(b)); ctx.stroke(); });
      }
      const PA = scene.atoms.map(a => { const r = rot(a, ax, ay); return { x: r.x, y: r.y, z: r.z, r: a.r, color: a.color }; });
      let zmin = Infinity, zmax = -Infinity; PA.forEach(p => { if (p.z < zmin) zmin = p.z; if (p.z > zmax) zmax = p.z; });
      const span = (zmax - zmin) || 1;
      if (scene.bonds) {
        const bd = scene.bonds.map(b => { const A = PA[b[0]], B = PA[b[1]]; return { A, B, z: (A.z + B.z) / 2 }; }).sort((m, n) => m.z - n.z);
        bd.forEach(b => { ctx.strokeStyle = col.faint; ctx.lineWidth = 3.5; ctx.globalAlpha = 0.45 + 0.55 * ((b.z - zmin) / span);
          ctx.beginPath(); ctx.moveTo(SX(b.A), SY(b.A)); ctx.lineTo(SX(b.B), SY(b.B)); ctx.stroke(); });
        ctx.globalAlpha = 1;
      }
      PA.map((p, i) => i).sort((i, j) => PA[i].z - PA[j].z).forEach(i => {
        const p = PA[i]; ctx.globalAlpha = 0.55 + 0.45 * ((p.z - zmin) / span);
        atom(ctx, SX(p), SY(p), p.r * scale, p.color, col.ink);
      });
      ctx.globalAlpha = 1;
    }
    function tick() { if (wantSpin && visible && !dragging) ay += 0.005; draw(); raf = (wantSpin && visible && !dragging) ? requestAnimationFrame(tick) : null; }
    function start() { if (!raf && wantSpin && visible && !dragging) raf = requestAnimationFrame(tick); else if (!raf) draw(); }
    cv.addEventListener("pointerdown", e => { dragging = true; wantSpin = false; px = e.clientX; py = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (x) {} cv.style.cursor = "grabbing"; if (raf) { cancelAnimationFrame(raf); raf = null; } });
    cv.addEventListener("pointermove", e => { if (!dragging) return; ay += (e.clientX - px) * 0.01; ax += (e.clientY - py) * 0.01; px = e.clientX; py = e.clientY; draw(); });
    cv.addEventListener("pointerup", () => { dragging = false; cv.style.cursor = "grab"; });
    cv.addEventListener("pointercancel", () => { dragging = false; });
    cv.addEventListener("dblclick", () => { wantSpin = !wantSpin; if (wantSpin) start(); });
    window.addEventListener("resize", () => { if (!raf) draw(); });
    host._redraw = () => { if (!raf) draw(); };
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) start(); else if (raf) { cancelAnimationFrame(raf); raf = null; } });
      io.observe(cv);
    }
    draw();
    return { redraw: () => { if (!raf) draw(); } };
  }
  function cubeEdges(s, sz) {
    sz = sz == null ? s : sz; const Cc = [];
    [-sz, sz].forEach(z => [-s, s].forEach(y => [-s, s].forEach(x => Cc.push({ x, y, z }))));
    const E = [];
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      const nz = (Math.abs(Cc[i].x - Cc[j].x) > 1e-9 ? 1 : 0) + (Math.abs(Cc[i].y - Cc[j].y) > 1e-9 ? 1 : 0) + (Math.abs(Cc[i].z - Cc[j].z) > 1e-9 ? 1 : 0);
      if (nz === 1) E.push([Cc[i], Cc[j]]);
    }
    return { corners: Cc, edges: E };
  }
  // 把不对称位置展开成完整单胞（坐标=0 的镜像到 1），居中到 [-.5,.5]
  function expand(list) {
    const out = [], seen = new Set();
    list.forEach(a => {
      const [x, y, z] = a.f;
      const xs = x === 0 ? [0, 1] : [x], ys = y === 0 ? [0, 1] : [y], zs = z === 0 ? [0, 1] : [z];
      xs.forEach(X => ys.forEach(Y => zs.forEach(Z => {
        const k = X + "_" + Y + "_" + Z + "_" + a.c;
        if (!seen.has(k)) { seen.add(k); out.push({ x: X - .5, y: Y - .5, z: Z - .5, c: a.c, r: a.r }); }
      })));
    });
    return out;
  }
  // 晶格块（六方/石墨等）：晶轴向量 + 基元 + 复制范围；按距离连键
  function chunk(A1, A2, A3, basis, ri, rj, rk, bondMax, bondSame) {
    const atoms = [], seen = new Set();
    for (let i = ri[0]; i <= ri[1]; i++) for (let j = rj[0]; j <= rj[1]; j++) for (let k = rk[0]; k <= rk[1]; k++)
      basis.forEach(b => {
        const fx = i + b.f[0], fy = j + b.f[1], fz = k + b.f[2];
        const x = fx * A1[0] + fy * A2[0] + fz * A3[0], y = fx * A1[1] + fy * A2[1] + fz * A3[1], z = fx * A1[2] + fy * A2[2] + fz * A3[2];
        const key = Math.round(x * 50) + "_" + Math.round(y * 50) + "_" + Math.round(z * 50);
        if (!seen.has(key)) { seen.add(key); atoms.push({ x, y, z, c: b.c, r: b.r }); }
      });
    let mx = 0, my = 0, mz = 0; atoms.forEach(a => { mx += a.x; my += a.y; mz += a.z; });
    const n = atoms.length || 1; mx /= n; my /= n; mz /= n; atoms.forEach(a => { a.x -= mx; a.y -= my; a.z -= mz; });
    const bonds = [];
    if (bondMax) for (let p = 0; p < atoms.length; p++) for (let q = p + 1; q < atoms.length; q++) {
      if (!bondSame && atoms[p].c === atoms[q].c) continue;
      const d = Math.hypot(atoms[p].x - atoms[q].x, atoms[p].y - atoms[q].y, atoms[p].z - atoms[q].z);
      if (d < bondMax) bonds.push([p, q]);
    }
    return { atoms, bonds };
  }
  function colorize(atoms, col) { return atoms.map(a => ({ x: a.x, y: a.y, z: a.z, r: a.r, color: col[a.c] })); }
  // 立方/四方结构的通用渲染封装
  function boxStruct(host, spec) {
    const edges = spec.edges || cubeEdges(0.5).edges;
    function build(col) { return { atoms: colorize(spec.atoms, col), bonds: spec.bonds, edges, unit: spec.unit || 1.05 }; }
    interactive3D(host, build, { height: spec.height || 330, ax: spec.ax, ay: spec.ay });
    if (spec.legend) legend(host, spec.legend);
    caption(host, "🖱️ <b>拖动旋转</b>（双击暂停/继续自转）。" + spec.caption);
  }

  // ---------- 立方晶胞 P/I/F ----------
  function vizCubic(host) {
    let mode = 0; const { corners, edges } = cubeEdges(0.5);
    function build(col) {
      const atoms = corners.map(p => ({ x: p.x, y: p.y, z: p.z, r: 0.14, color: col.primary }));
      if (mode === 1) atoms.push({ x: 0, y: 0, z: 0, r: 0.15, color: col.danger });
      if (mode === 2) [[.5, 0, 0], [-.5, 0, 0], [0, .5, 0], [0, -.5, 0], [0, 0, .5], [0, 0, -.5]].forEach(f => atoms.push({ x: f[0], y: f[1], z: f[2], r: 0.14, color: col.accent }));
      return { atoms, edges, unit: 1.05 };
    }
    const api = interactive3D(host, build, { height: 320 });
    btnRow(host, ["简单立方 P", "体心立方 I", "面心立方 F"], i => { mode = i; api.redraw(); });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;"; host.appendChild(cap);
    const info = ["简单立方 P：8×1/8 = <b>1</b> 个/晶胞", "体心立方 I：8×1/8 + 1 = <b>2</b> 个/晶胞", "面心立方 F：8×1/8 + 6×1/2 = <b>4</b> 个/晶胞"];
    const o = api.redraw; api.redraw = () => { o(); cap.innerHTML = "🖱️ <b>拖动旋转</b>（双击暂停/继续）。" + info[mode]; }; api.redraw();
    caption(host, "顶角原子被 8 个晶胞共有(算 1/8)、面心被 2 个共有(算 1/2)、体心独占(算 1)。");
  }

  // ---------- 金刚石 / 闪锌矿 ----------
  function vizDiamond(host) {
    let mode = 0;
    const A = [[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1],[.5,.5,0],[.5,0,.5],[0,.5,.5],[.5,.5,1],[.5,1,.5],[1,.5,.5]].map(p => ({ x: p[0], y: p[1], z: p[2] }));
    const B = [[.25,.25,.25],[.75,.75,.25],[.75,.25,.75],[.25,.75,.75]].map(p => ({ x: p[0], y: p[1], z: p[2] }));
    const cen = p => ({ x: p.x - .5, y: p.y - .5, z: p.z - .5 });
    const bonds = [];
    B.forEach((b, bi) => A.forEach((a, ai) => { if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < .46) bonds.push([ai, A.length + bi]); }));
    const { edges } = cubeEdges(0.5);
    function build(col) {
      const atoms = [];
      A.forEach(p => { const c = cen(p); atoms.push({ x: c.x, y: c.y, z: c.z, r: .10, color: col.primary }); });
      B.forEach(p => { const c = cen(p); atoms.push({ x: c.x, y: c.y, z: c.z, r: .10, color: mode === 0 ? col.primary : col.accent }); });
      return { atoms, bonds, edges, unit: 1.05 };
    }
    const api = interactive3D(host, build, { height: 360, ax: -0.5, ay: 0.6 });
    btnRow(host, ["金刚石型 (同种原子)", "闪锌矿型 (两种原子)"], i => { mode = i; api.redraw(); });
    caption(host, "🖱️ <b>拖动旋转</b>。金刚石 = 两套面心立方沿体对角线错开 1/4 套构，每个原子 sp³ 杂化、与 4 个原子成正四面体键（109°28′）。<b>闪锌矿</b>把其中一套换成另一种原子（蓝/绿）→ 缺对称中心、对称性更低，骨架完全一样。");
  }

  // ---------- 纤锌矿（六方 ZnS）----------
  function vizWurtzite(host) {
    const A1 = [1, 0, 0], A2 = [-0.5, 0.86603, 0], A3 = [0, 0, 1.633];
    const basis = [
      { f: [0, 0, 0], c: "primary", r: .12 }, { f: [1 / 3, 2 / 3, .5], c: "primary", r: .12 },
      { f: [0, 0, .375], c: "accent", r: .12 }, { f: [1 / 3, 2 / 3, .875], c: "accent", r: .12 },
    ];
    const ch = chunk(A1, A2, A3, basis, [0, 1], [0, 1], [0, 0], 0.72, false);
    boxStruct(host, {
      atoms: ch.atoms, bonds: ch.bonds, edges: [], unit: 2.0, height: 360, ax: -0.35, ay: 0.6,
      legend: [{ c: "primary", t: "Zn（金属）" }, { c: "accent", t: "S（非金属）" }],
      caption: "<b>纤锌矿 (六方 ZnS)</b>：S 作<b>六方最紧密堆积 ABAB</b>、Zn 填四面体空隙，配位数都是 <b>4</b>。与闪锌矿(立方 ABCABC)只差堆垛顺序——这里上下层<b>相对</b>。代表：ZnO、GaN、AlN、CdS。",
    });
  }

  // ---------- NaCl 型 ----------
  function vizNaCl(host) {
    const atoms = expand([
      { f: [0, 0, 0], c: "accent", r: .17 }, { f: [.5, .5, 0], c: "accent", r: .17 }, { f: [.5, 0, .5], c: "accent", r: .17 }, { f: [0, .5, .5], c: "accent", r: .17 },
      { f: [.5, 0, 0], c: "primary", r: .11 }, { f: [0, .5, 0], c: "primary", r: .11 }, { f: [0, 0, .5], c: "primary", r: .11 }, { f: [.5, .5, .5], c: "primary", r: .11 },
    ]);
    boxStruct(host, {
      atoms, unit: 1.05, legend: [{ c: "accent", t: "Cl⁻（面心立方）" }, { c: "primary", t: "Na⁺（八面体空隙）" }],
      caption: "<b>NaCl 型</b>：大的 Cl⁻ 作面心立方最紧密堆积，小的 Na⁺ 填入<b>全部八面体空隙</b>（棱心 + 体心）。异号离子配位数 <b>6</b>，立方 \\(O_h\\)。代表：PbS、PbSe、PbTe。",
    });
  }

  // ---------- CsCl 型 ----------
  function vizCsCl(host) {
    const cl = expand([{ f: [0, 0, 0], c: "accent", r: .15 }]);
    const atoms = cl.concat([{ x: 0, y: 0, z: 0, c: "primary", r: .16 }]);
    const bonds = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [8, i]);
    boxStruct(host, {
      atoms, bonds, unit: 1.05, legend: [{ c: "accent", t: "Cl⁻（顶角）" }, { c: "primary", t: "Cs⁺（体心）" }],
      caption: "<b>CsCl 型</b>：两套<b>简单立方</b>子格子沿体对角线错开 1/2 套构（Cl⁻ 顶角、Cs⁺ 体心）。注意它<b>不是体心立方</b>（顶角与体心是不同原子）。配位数 8。",
    });
  }

  // ---------- 金红石 TiO₂（四方）----------
  function vizRutile(host) {
    const u = 0.305, cz = 0.64;
    let atoms = expand([
      { f: [0, 0, 0], c: "primary", r: .13 }, { f: [.5, .5, .5], c: "primary", r: .13 },
      { f: [u, u, 0], c: "accent", r: .10 }, { f: [1 - u, 1 - u, 0], c: "accent", r: .10 },
      { f: [.5 + u, .5 - u, .5], c: "accent", r: .10 }, { f: [.5 - u, .5 + u, .5], c: "accent", r: .10 },
    ]).map(a => ({ x: a.x, y: a.y, z: a.z * cz, c: a.c, r: a.r }));
    boxStruct(host, {
      atoms, edges: cubeEdges(0.5, 0.5 * cz).edges, unit: 1.0, legend: [{ c: "primary", t: "Ti⁴⁺" }, { c: "accent", t: "O²⁻" }],
      caption: "<b>金红石 TiO₂ (AB₂)</b>：<b>四方晶系</b>（c 轴较短，晶胞压扁）。每个 Ti⁴⁺ 位于 6 个 O²⁻ 构成的<b>略变形八面体</b>中心。",
    });
  }

  // ---------- 钙钛矿 CaTiO₃ ----------
  function vizPerovskite(host) {
    const atoms = expand([
      { f: [0, 0, 0], c: "primary", r: .14 }, { f: [.5, .5, .5], c: "danger", r: .12 },
      { f: [.5, .5, 0], c: "accent", r: .10 }, { f: [.5, 0, .5], c: "accent", r: .10 }, { f: [0, .5, .5], c: "accent", r: .10 },
    ]);
    const bonds = [9, 10, 11, 12, 13, 14].map(o => [8, o]);
    boxStruct(host, {
      atoms, bonds, unit: 1.05, legend: [{ c: "primary", t: "Ca（A，顶角）" }, { c: "danger", t: "Ti（B，体心）" }, { c: "accent", t: "O（面心）" }],
      caption: "<b>钙钛矿 CaTiO₃ (ABO₃)</b>：立方晶系。A(Ca) 顶角、B(Ti) 体心、O 在 6 个面心 → Ti 被 6 个 O 围成 <b>TiO₆ 八面体</b>（图中键）。课程也描述为“5 套简单立方套构”。",
    });
  }

  // ---------- 石墨 ----------
  function vizGraphite(host) {
    const A1 = [1.5, 0.866, 0], A2 = [1.5, -0.866, 0], A3 = [0, 0, 2.4];
    const basis = [
      { f: [0, 0, 0], c: "primary", r: .12 }, { f: [1 / 3, 1 / 3, 0], c: "primary", r: .12 },
      { f: [1 / 3, 1 / 3, 1], c: "accent", r: .12 }, { f: [2 / 3, 2 / 3, 1], c: "accent", r: .12 },
    ];
    const ch = chunk(A1, A2, A3, basis, [0, 1], [0, 1], [0, 0], 1.25, true);
    boxStruct(host, {
      atoms: ch.atoms, bonds: ch.bonds, edges: [], unit: 3.0, height: 360, ax: -0.7, ay: 0.5,
      legend: [{ c: "primary", t: "下层 C" }, { c: "accent", t: "上层 C" }],
      caption: "<b>石墨</b>：层内每个 C 以 <b>sp² 共价键</b>连成正六边形蜂巢平面（C–C 142 pm，键已画出）；<b>层与层相距 340 pm</b>、靠较弱的范德华力结合（图中两层间无键、间隙明显）→ 所以石墨易滑移、能导电。典型混合键型晶体。",
    });
  }

  // ---------- 密堆积（3D：ABAB vs ABCABC）----------
  function vizClosepack(host) {
    let mode = 0;
    const e1 = { x: 1, y: 0 }, e2 = { x: 0.5, y: Math.sqrt(3) / 2 }, cc = Math.sqrt(2 / 3);
    const hollow = { x: (e1.x + e2.x) / 3, y: (e1.y + e2.y) / 3 };
    function layerPts() { const P = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) P.push({ x: i * e1.x + j * e2.x, y: i * e1.y + j * e2.y }); return P; }
    function build(col) {
      const base = layerPts(), cxm = e1.x + e2.x, cym = e1.y + e2.y, cols = [col.primary, col.accent, col.danger];
      const seq = mode === 0 ? [0, 1, 0] : [0, 1, 2], atoms = [];
      seq.forEach((t, layer) => { const off = { x: hollow.x * t, y: hollow.y * t };
        base.forEach(p => atoms.push({ x: p.x + off.x - cxm, y: layer * cc - cc, z: p.y + off.y - cym, r: 0.42, color: cols[t] })); });
      return { atoms, unit: 2.5 };
    }
    const api = interactive3D(host, build, { height: 340, ax: -0.85, ay: 0.5 });
    btnRow(host, ["六方密堆 ABAB…", "立方密堆 ABCABC…"], i => { mode = i; api.redraw(); });
    caption(host, "🖱️ <b>拖动旋转</b>看层与层错位。<b style='color:var(--primary)'>A</b>/<b style='color:var(--accent)'>B</b>/<b style='color:var(--danger)'>C</b> 是三种横向位置。第三层落回 A 正上方 = <b>六方密堆 hcp(ABAB)</b>；错到新位置 C = <b>立方密堆 ccp = 面心立方(ABCABC)</b>。两者空间利用率都 <b>74.05%</b>。");
  }

  // ---------- 晶面指数（2D）----------
  function vizMiller(host) {
    const { cv, resize } = makeCanvas(host, 320);
    let hh = 1, kk = 1;
    control(host, "指数 h", 0, 3, 1, 1, v => `h = ${v}`, v => { hh = v; draw(); });
    control(host, "指数 k", 0, 3, 1, 1, v => `k = ${v}`, v => { kk = v; draw(); });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;"; host.appendChild(cap);
    caption(host, "二维演示晶面指数 (h k)：a 轴截距 = 1/h、b 轴截距 = 1/k。<b>指数越大→截距越小→晶面越靠近原点、越密。</b>指数为 0 表示与该轴平行(截距 ∞)。三维 (h k l) 同理。");
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const pad = 46, x0 = pad, y0 = h - pad, span = Math.min(w - pad * 2, h - pad * 2), ux = span / 3, uy = span / 3;
      for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) { ctx.fillStyle = col.faint; ctx.beginPath(); ctx.arc(x0 + i * ux, y0 - j * uy, 3.2, 0, 7); ctx.fill(); }
      ctx.strokeStyle = col.grid; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 3 * ux, y0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 - 3 * uy); ctx.stroke();
      ctx.fillStyle = col.soft; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("a →", x0 + 3 * ux - 8, y0 + 20); ctx.fillText("b ↑", x0 - 18, y0 - 3 * uy + 6);
      ctx.fillStyle = col.warn; ctx.beginPath(); ctx.arc(x0, y0, 5, 0, 7); ctx.fill();
      ctx.fillStyle = col.soft; ctx.fillText("O", x0 - 14, y0 + 16);
      const ix = hh === 0 ? Infinity : 1 / hh, iy = kk === 0 ? Infinity : 1 / kk;
      ctx.strokeStyle = col.primary; ctx.lineWidth = 2.6;
      function lineFor(m) {
        const pts = [];
        if (kk !== 0) { const y = m / kk; if (y >= 0 && y <= 3) pts.push([0, y]); }
        if (kk !== 0) { const y = (m - hh * 3) / kk; if (y >= 0 && y <= 3) pts.push([3, y]); }
        if (hh !== 0) { const x = m / hh; if (x >= 0 && x <= 3) pts.push([x, 0]); }
        if (hh !== 0) { const x = (m - kk * 3) / hh; if (x >= 0 && x <= 3) pts.push([x, 3]); }
        if (pts.length >= 2) { ctx.beginPath(); ctx.moveTo(x0 + pts[0][0] * ux, y0 - pts[0][1] * uy); ctx.lineTo(x0 + pts[1][0] * ux, y0 - pts[1][1] * uy); ctx.stroke(); }
      }
      if (!(hh === 0 && kk === 0)) for (let m = 1; m <= 3; m++) lineFor(m);
      ctx.fillStyle = col.danger;
      if (isFinite(ix) && ix <= 3) { ctx.beginPath(); ctx.arc(x0 + ix * ux, y0, 5, 0, 7); ctx.fill(); }
      if (isFinite(iy) && iy <= 3) { ctx.beginPath(); ctx.arc(x0, y0 - iy * uy, 5, 0, 7); ctx.fill(); }
      const fx = hh === 0 ? "∞" : (hh === 1 ? "1" : "1/" + hh), fy = kk === 0 ? "∞" : (kk === 1 ? "1" : "1/" + kk);
      cap.innerHTML = (hh === 0 && kk === 0) ? "h、k 不能同时为 0。" : `晶面指数 <b style="color:var(--primary)">(${hh} ${kk})</b>：a 轴截距 = <b>${fx}</b>，b 轴截距 = <b>${fy}</b>。截距取倒数 → ${hh}, ${kk}，正好是指数本身。`;
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
  }

  // ---------- 刃型位错（2D）----------
  function vizEdge(host) {
    const { cv, resize } = makeCanvas(host, 330);
    let pos = 4;
    control(host, "切应力下位错位置", 1, 8, 1, 4, v => `第 ${v} 列`, v => { pos = v; draw(); });
    caption(host, "<b style='color:var(--danger)'>刃型位错</b>：上半部多插<b>半个原子面</b>（红），其下端缘就是<b>位错线 ⊥</b>。在<b style='color:var(--accent)'>切应力 τ</b> 作用下位错<b>逐列滑移</b>，移到边缘即完成一个柏氏矢量 <b>b</b> 的滑移（b ⊥ 位错线）。半原子面一侧晶格受<b>压应力</b>、另一侧受<b>张应力</b>——这就是刃型位错的<b>正应力场</b>。");
    function bend(i, pos, gx, j, midRow) { const d = i - pos, wgt = (midRow - j) / midRow; return -Math.sign(d) * Math.min(Math.abs(d), 2) * gx * 0.06 * wgt * (Math.abs(d) <= 3 ? 1 : 0); }
    function arrowH(ctx, x0, y, x1, c) {
      ctx.strokeStyle = c; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      const d = Math.sign(x1 - x0), s = 7; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 - d * s, y - 4); ctx.lineTo(x1 - d * s, y + 4); ctx.closePath(); ctx.fill();
    }
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const cols = 9, rows = 6, padX = 46, padY = 50, gx = (w - padX * 2) / (cols - 1), gy = (h - padY * 2) / (rows - 1), r = Math.min(gx, gy) * 0.16, midRow = Math.floor(rows / 2);
      const tx = padX + pos * gx, slipY = padY + (midRow - 0.5) * gy;
      ctx.strokeStyle = col.grid; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(padX - 16, slipY); ctx.lineTo(w - padX + 16, slipY); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col.faint; ctx.font = "12px sans-serif"; ctx.textAlign = "right"; ctx.fillText("滑移面", w - padX + 14, slipY - 5);
      ctx.fillStyle = col.soft; ctx.textAlign = "left"; ctx.fillText("压应力", 6, padY + gy * 0.6); ctx.fillText("张应力", 6, padY + gy * 4.5);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        let x = padX + i * gx; const y = padY + j * gy, above = j < midRow;
        if (above) x = padX + i * gx + bend(i, pos, gx, j, midRow);
        atom(ctx, x, y, r, (above && i === pos) ? col.danger : col.primary, col.ink);
      }
      ctx.strokeStyle = col.danger; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(tx, slipY - gy * 0.7); ctx.lineTo(tx, slipY); ctx.moveTo(tx - gx * 0.28, slipY); ctx.lineTo(tx + gx * 0.28, slipY); ctx.stroke();
      ctx.fillStyle = col.danger; ctx.font = "bold 12.5px sans-serif"; ctx.textAlign = "left"; ctx.fillText("位错线 ⊥", tx + gx * 0.34, slipY - 5);
      const by = slipY + 17; arrowH(ctx, tx - gx / 2, by, tx + gx / 2, col.ink);
      ctx.fillStyle = col.ink; ctx.font = "italic bold 13px sans-serif"; ctx.textAlign = "center"; ctx.fillText("b", tx, by + 14);
      arrowH(ctx, padX - 10, padY - 26, padX + gx * 1.7, col.accent);
      arrowH(ctx, w - padX + 10, h - 16, w - padX - gx * 1.7, col.accent);
      ctx.fillStyle = col.accent; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left"; ctx.fillText("切应力 τ", padX + gx * 1.8, padY - 22);
      ctx.textAlign = "right"; ctx.fillText("切应力 τ", w - padX - gx * 1.8, h - 12);
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
  }

  // ---------- 平行六面体晶胞通用工具（14 布拉菲 / 格子并入演示） ----------
  function cellVectors(a, b, c, al, be, ga) {
    const d = Math.PI / 180; al *= d; be *= d; ga *= d;
    const bx = b * Math.cos(ga), by = b * Math.sin(ga);
    const cx = c * Math.cos(be);
    const cy = c * (Math.cos(al) - Math.cos(be) * Math.cos(ga)) / Math.sin(ga);
    const cz = Math.sqrt(Math.max(1e-6, c * c - cx * cx - cy * cy));
    return [[a, 0, 0], [bx, by, 0], [cx, cy, cz]];
  }
  // 平行六面体的 8 顶点 + 12 棱（按 i,j,k∈{0,1} 索引，差一个分量相邻）
  function paraCell(o, A, B, Cv) {
    const idx = [], cor = [];
    for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) {
      idx.push([i, j, k]);
      cor.push([o[0] + i * A[0] + j * B[0] + k * Cv[0], o[1] + i * A[1] + j * B[1] + k * Cv[1], o[2] + i * A[2] + j * B[2] + k * Cv[2]]);
    }
    const E = [];
    for (let m = 0; m < 8; m++) for (let n = m + 1; n < 8; n++) {
      const d = (idx[m][0] !== idx[n][0]) + (idx[m][1] !== idx[n][1]) + (idx[m][2] !== idx[n][2]);
      if (d === 1) E.push([cor[m], cor[n]]);
    }
    return { corners: cor, edges: E };
  }
  function latticePoints(p, cent) {
    const V = cellVectors(p[0], p[1], p[2], p[3], p[4], p[5]);
    const fr = [];
    for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) fr.push([x, y, z, "corner"]);
    const add = (x, y, z) => fr.push([x, y, z, cent]);
    if (cent === "I") add(.5, .5, .5);
    if (cent === "F") [[.5, .5, 0], [.5, .5, 1], [.5, 0, .5], [.5, 1, .5], [0, .5, .5], [1, .5, .5]].forEach(q => add(q[0], q[1], q[2]));
    if (cent === "C") { add(.5, .5, 0); add(.5, .5, 1); }
    const pts = fr.map(f => ({
      x: f[0] * V[0][0] + f[1] * V[1][0] + f[2] * V[2][0],
      y: f[0] * V[0][1] + f[1] * V[1][1] + f[2] * V[2][1],
      z: f[0] * V[0][2] + f[1] * V[1][2] + f[2] * V[2][2], t: f[3],
    }));
    let mx = 0, my = 0, mz = 0; pts.forEach(q => { mx += q.x; my += q.y; mz += q.z; });
    const n = pts.length; mx /= n; my /= n; mz /= n; pts.forEach(q => { q.x -= mx; q.y -= my; q.z -= mz; });
    const corners = pts.slice(0, 8), edges = [];
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      const diff = (fr[i][0] !== fr[j][0]) + (fr[i][1] !== fr[j][1]) + (fr[i][2] !== fr[j][2]);
      if (diff === 1) edges.push([corners[i], corners[j]]);
    }
    let maxd = 0; pts.forEach(q => { const dd = Math.hypot(q.x, q.y, q.z); if (dd > maxd) maxd = dd; });
    return { pts, edges, unit: maxd * 1.08 };
  }

  // ---------- 14 种布拉菲格子 ----------
  function vizBravais(host) {
    const SYS = [
      { n: "立方 cubic", sub: "a=b=c，90°", p: [1, 1, 1, 90, 90, 90], cent: ["P", "I", "F"], cn: "3 种" },
      { n: "四方 tetragonal", sub: "a=b≠c，90°", p: [1, 1, 1.5, 90, 90, 90], cent: ["P", "I"], cn: "2 种" },
      { n: "正交 orthorhombic", sub: "a≠b≠c，90°", p: [0.78, 1.06, 1.42, 90, 90, 90], cent: ["P", "I", "F", "C"], cn: "4 种" },
      { n: "六方 hexagonal", sub: "a=b≠c，γ=120°", p: [1, 1, 1.35, 90, 90, 120], cent: ["P"], cn: "1 种" },
      { n: "三方(菱方) trigonal", sub: "a=b=c，α=β=γ≠90°", p: [1, 1, 1, 72, 72, 72], cent: ["R"], cn: "1 种" },
      { n: "单斜 monoclinic", sub: "a≠b≠c，β≠90°", p: [0.85, 1.25, 1.0, 90, 108, 90], cent: ["P", "C"], cn: "2 种" },
      { n: "三斜 triclinic", sub: "三棱三角全不等", p: [0.86, 1.1, 1.32, 82, 98, 110], cent: ["P"], cn: "1 种" },
    ];
    const CN = { P: "简单 P", I: "体心 I", F: "面心 F", C: "底心 C", R: "菱方 R" };
    let si = 0, ci = 0, data = latticePoints(SYS[0].p, SYS[0].cent[0]);
    function rebuild() { data = latticePoints(SYS[si].p, SYS[si].cent[ci]); }
    function build(col) {
      const cmap = { corner: col.primary, I: col.danger, F: col.accent, C: col.warn, R: col.primary, P: col.primary };
      const atoms = data.pts.map(q => ({ x: q.x, y: q.y, z: q.z, r: 0.07 * data.unit, color: cmap[q.t] || col.primary }));
      return { atoms, edges: data.edges, unit: data.unit };
    }
    const api = interactive3D(host, build, { height: 340, ax: -0.45, ay: 0.7 });
    const selWrap = document.createElement("div"); selWrap.style.cssText = "margin:12px 0 2px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;";
    const lab = document.createElement("span"); lab.style.cssText = "font-weight:700;font-size:14px;"; lab.textContent = "选晶系：";
    const sel = document.createElement("select");
    sel.style.cssText = "padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font-size:14px;font-weight:600;flex:1;min-width:220px;";
    SYS.forEach((s, i) => { const o = document.createElement("option"); o.value = i; o.textContent = s.n + "（" + s.sub + "）· " + s.cn; sel.appendChild(o); });
    selWrap.appendChild(lab); selWrap.appendChild(sel); host.appendChild(selWrap);
    const centRow = document.createElement("div"); host.appendChild(centRow);
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;"; host.appendChild(cap);
    function updCap() {
      const c = SYS[si].cent[ci];
      const extra = { P: "只有顶角结点", I: "顶角 + 1 个体心结点", F: "顶角 + 6 个面心结点", C: "顶角 + 上下底面中心结点", R: "三棱等长、三夹角相等但 ≠90° 的菱面体（只有顶角结点）" }[c];
      cap.innerHTML = "🖱️ <b>拖动旋转</b>（双击暂停自转）。当前：<b>" + SYS[si].n + " · " + CN[c] + "</b>——" + extra
        + "。<span style='color:var(--text-faint)'>颜色：<b style='color:var(--primary)'>蓝</b>=顶角、<b style='color:var(--danger)'>红</b>=体心、<b style='color:var(--accent)'>绿</b>=面心、<b style='color:var(--warn)'>橙</b>=底心。</span>";
    }
    function renderCent() {
      centRow.innerHTML = ""; centRow.style.cssText = "display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;";
      SYS[si].cent.forEach((c, i) => {
        const b = document.createElement("button"); b.className = "btn" + (i === ci ? " primary" : ""); b.textContent = CN[c];
        b.onclick = () => { ci = i; rebuild(); renderCent(); api.redraw(); updCap(); };
        centRow.appendChild(b);
      });
    }
    sel.addEventListener("change", () => { si = parseInt(sel.value, 10); ci = 0; rebuild(); renderCent(); api.redraw(); updCap(); });
    renderCent(); updCap();
    caption(host, "<b>14 种布拉菲格子</b>＝7 晶系各自「在不破坏本晶系对称的前提下还能加哪些心」得到的全部独立格子，合计 <b>3+2+4+1+1+2+1=14</b>。逐个晶系切换，看 P/I/F/C 怎么分布——为什么有的晶系有 4 种、有的只有 1 种，下一个图给出原因。");
  }

  // ---------- 不存在的格子如何并入更小的格子 ----------
  function vizReduce(host) {
    let mode = 0;
    const cubeCorners = (c, t) => { const a = []; for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) a.push([x, y, z * c, t]); return a; };
    const CASES = [
      {
        title: "底心立方 → 简单四方", c: 1, unit: 1.32,
        pts: cubeCorners(1, "corner").concat([[.5, .5, 0, "cent"], [.5, .5, 1, "cent"], [.5, -.5, 0, "cent"], [.5, -.5, 1, "cent"]]),
        small: { o: [0, 0, 0], A: [.5, .5, 0], B: [.5, -.5, 0], C: [0, 0, 1] },
        note: "假想的<b>底心立方</b>：它的两个底心（红）与相邻立方体的底心，正好是一个体积只有<b>一半</b>的<b>简单四方</b>（青色小胞）的顶角。对称性没有降低，按「体积最小」原则只承认这个简单四方 → 所以<b>不存在独立的「底心立方」</b>。",
      },
      {
        title: "面心四方 → 体心四方", c: 1.4, unit: 1.5,
        pts: cubeCorners(1.4, "corner").concat([[.5, .5, 0, "cent"], [.5, .5, 1.4, "cent"], [.5, 0, .7, "body"], [0, .5, .7, "cent"], [.5, 1, .7, "cent"], [1, .5, .7, "cent"], [.5, -.5, 0, "cent"], [.5, -.5, 1.4, "cent"]]),
        small: { o: [0, 0, 0], A: [.5, .5, 0], B: [.5, -.5, 0], C: [0, 0, 1.4] },
        note: "假想的<b>面心四方</b>：它的<b>侧面心</b>（橙）恰好落在体积一半的小胞<b>体心</b>，于是它其实就是<b>体心四方</b>（青色小胞）。同理底心四方可化简为简单四方 → 所以四方晶系只有 <b>简单 P、体心 I</b> 两种。",
      },
    ];
    function build(col) {
      const Cs = CASES[mode], ctr = [.5, .5, Cs.c / 2];
      const sh = p => ({ x: p[0] - ctr[0], y: p[1] - ctr[1], z: p[2] - ctr[2] });
      const cmap = { corner: col.primary, cent: col.danger, body: col.warn };
      const atoms = Cs.pts.map(q => { const s = sh(q); return { x: s.x, y: s.y, z: s.z, r: q[3] === "body" ? 0.11 : 0.085, color: cmap[q[3]] }; });
      const big = paraCell([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, Cs.c]);
      const sm = paraCell(Cs.small.o, Cs.small.A, Cs.small.B, Cs.small.C);
      return { atoms, edges: big.edges.map(e => [sh(e[0]), sh(e[1])]), edges2: sm.edges.map(e => [sh(e[0]), sh(e[1])]), unit: Cs.unit };
    }
    const api = interactive3D(host, build, { height: 340, ax: -0.4, ay: 0.68 });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;";
    btnRow(host, CASES.map(c => c.title), i => { mode = i; api.redraw(); cap.innerHTML = "🖱️ <b>拖动旋转</b>。" + CASES[i].note; });
    host.appendChild(cap); cap.innerHTML = "🖱️ <b>拖动旋转</b>。" + CASES[0].note;
    legend(host, [{ c: "primary", t: "原顶角结点" }, { c: "danger", t: "原加心结点" }, { c: "accent", t: "更小的等价格子（青线）" }]);
  }

  // ---------- 面密度切片（面心立方 {100}/{110}/{111}）----------
  function vizDensity(host) {
    const FCC = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1],
      [.5, .5, 0], [.5, .5, 1], [.5, 0, .5], [.5, 1, .5], [0, .5, .5], [1, .5, .5]];
    const PLANES = [
      { k: "{100}", poly: [[.5, 0, 0], [.5, 1, 0], [.5, 1, 1], [.5, 0, 1]], on: p => Math.abs(p[0] - .5) < 1e-6, shape: "正方形网", rank: "中", desc: "面上 4 个结点排成正方形。" },
      { k: "{110}", poly: [[1, 0, 0], [0, 1, 0], [0, 1, 1], [1, 0, 1]], on: p => Math.abs(p[0] + p[1] - 1) < 1e-6, shape: "矩形网", rank: "低", desc: "对角矩形面，结点排得最稀。" },
      { k: "{111}", poly: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], on: p => Math.abs(p[0] + p[1] + p[2] - 1) < 1e-6, shape: "正六边形密排网", rank: "高", desc: "3 顶角 + 3 面心 = 正六边形，排得最密！" },
    ];
    const { edges } = cubeEdges(0.5);
    let pi = 2;
    function build(col) {
      const P = PLANES[pi], sh = p => ({ x: p[0] - .5, y: p[1] - .5, z: p[2] - .5 });
      const atoms = FCC.map(p => { const on = P.on(p), s = sh(p); return { x: s.x, y: s.y, z: s.z, r: on ? 0.12 : 0.07, color: on ? col.danger : css("--text-faint") || "#999" }; });
      return { atoms, edges, polys: [{ pts: P.poly.map(sh), fill: col.primary, alpha: 0.2, stroke: col.primary }], unit: 1.05 };
    }
    const api = interactive3D(host, build, { height: 340, ax: -0.5, ay: 0.6 });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;";
    btnRow(host, PLANES.map(p => p.k), i => { pi = i; api.redraw(); updc(); });
    host.appendChild(cap);
    legend(host, [{ c: "danger", t: "落在该晶面上的结点" }, { c: "text-faint", t: "其它结点" }]);
    function updc() { const P = PLANES[pi]; cap.innerHTML = "🖱️ <b>拖动旋转</b>。蓝色半透明面 = 面心立方里的一张 <b>" + P.k + "</b> 晶面，红色 = 落在面上的结点（<b>" + P.shape + "</b>）。三种面相对面密度：<b>" + P.k + "</b> 属 <b style='color:var(--primary)'>" + P.rank + "</b>。" + P.desc + " 面密度越大越易解理、生长越慢——金刚石结构 Si 的具体面密度数值见上方「结构参数表」。"; }
    updc();
  }

  // ---------- 位错滑移动画 ----------
  function vizSlip(host) {
    const { cv, resize } = makeCanvas(host, 320); cv.style.touchAction = "none";
    const cols = 11, rows = 7, mid = Math.floor(rows / 2);
    let pos = 1.2, playing = true, raf = null, vis = true;
    function disp(i, j, gx) { if (j >= mid) return 0; const d = i - pos, hw = (mid - j) / mid; return -(d / (d * d + 1.2)) * 0.95 * gx * hw; }
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const padX = 36, padY = 38, gx = (w - padX * 2) / (cols - 1), gy = (h - padY * 2) / (rows - 1), r = Math.min(gx, gy) * 0.17;
      const frac = Math.min(1, Math.max(0, (pos - 1) / (cols - 2)));
      // 滑移面虚线
      ctx.strokeStyle = col.grid; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(padX - 8, padY + (mid - 0.5) * gy); ctx.lineTo(w - padX + 8, padY + (mid - 0.5) * gy); ctx.stroke(); ctx.setLineDash([]);
      // 已滑过区域：顶面台阶（左端凸出一个原子间距）
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const above = j < mid; let x = padX + i * gx, y = padY + j * gy;
        if (above) x += disp(i, j, gx);
        const core = above && Math.abs(i - pos) < 0.5;
        atom(ctx, x, y, r, core ? col.danger : col.primary, col.ink);
      }
      // 多余半原子面（红色竖线）+ ⊥
      const tx = padX + pos * gx, ty = padY + (mid - 0.5) * gy;
      ctx.strokeStyle = col.danger; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(tx, padY - 6); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx - gx * 0.26, ty); ctx.lineTo(tx + gx * 0.26, ty); ctx.stroke();
      ctx.fillStyle = col.danger; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
      ctx.fillText("⊥ 位错线", tx + gx * 0.3, ty + 4);
      // 进度条
      ctx.fillStyle = col.soft; ctx.font = "12.5px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(frac >= 1 ? "✓ 完成一次滑移：上半晶体相对下半错动 = 一个柏氏矢量 b" : "位错向右移动中…已完成 " + Math.round(frac * 100) + "%", padX, h - 8);
    }
    function tick() { if (playing && vis) { pos += 0.04; if (pos > cols - 1) pos = 1.0; sl.value = pos; } draw(); raf = (playing && vis) ? requestAnimationFrame(tick) : null; }
    function go() { if (!raf && playing && vis) raf = requestAnimationFrame(tick); else if (!raf) draw(); }
    const btnWrap = document.createElement("div"); btnWrap.style.cssText = "display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;";
    const pb = document.createElement("button"); pb.className = "btn primary"; pb.textContent = "⏸ 暂停";
    pb.onclick = () => { playing = !playing; pb.textContent = playing ? "⏸ 暂停" : "▶ 播放"; pb.className = "btn" + (playing ? " primary" : ""); if (playing) go(); };
    btnWrap.appendChild(pb); host.appendChild(btnWrap);
    const sl = control(host, "位错位置（手动拖动）", 1, cols - 1, 0.05, pos, v => "第 " + v.toFixed(1) + " 列", v => { pos = v; playing = false; pb.textContent = "▶ 播放"; pb.className = "btn"; draw(); });
    caption(host, "<b style='color:var(--danger)'>刃型位错滑移</b>：切应力下，多余半原子面（红色 ⊥）像<b>地毯下的褶皱</b>一样<b>逐列向右移动</b>，只有位错<b>线附近</b>的原子在动——所需应力远小于「整面同步滑动」（这正是实测屈服强度比理论值小 3–4 个数量级的原因）。位错移到边缘，上半晶体就相对下半滑移了<b>一个柏氏矢量 b</b>，表面留下一个台阶。柏氏矢量 b ⊥ 位错线。");
    draw();
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) go(); else if (raf) { cancelAnimationFrame(raf); raf = null; } });
      io.observe(cv);
    } else go();
    window.addEventListener("resize", () => { if (!raf) draw(); }); host._redraw = draw;
  }

  // ===== 第三章 对称性：旋转轴 =====
  function vizRotaxis(host) {
    const { cv, resize } = makeCanvas(host, 300);
    const opts = [1, 2, 3, 4, 6]; let n = 4, ang = 0, raf = null, vis = true;
    function flag(ctx, cx, cy, R, a, col, ink) {
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(5, -11); ctx.stroke();
      atom(ctx, -16, 0, 6, col, ink); ctx.restore();
    }
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2 - 6, R = Math.min(w, h) * 0.3;
      ctx.fillStyle = col.primary; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.fill();
      for (let k = 0; k < n; k++) flag(ctx, cx, cy, R, ang + k * 2 * Math.PI / n, col.accent, col.ink);
      ctx.fillStyle = col.soft; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(n + " 次旋转轴：每转 " + Math.round(360 / n) + "° 与自身重合", cx, h - 10);
    }
    function tick() { if (vis) ang += 0.008; draw(); raf = vis ? requestAnimationFrame(tick) : null; }
    btnRow(host, opts.map(x => x + " 次轴"), i => { n = opts[i]; ang = 0; draw(); });
    caption(host, "<b>晶体里只允许 1、2、3、4、6 次旋转轴</b>——绕轴旋转后还要能与周期性平移点阵重合，这就限死了可能的轴次。<b>没有 5 次、7 次及更高次轴</b>（下一个图给出原因）。看它自转即可。");
    draw();
    if (typeof IntersectionObserver !== "undefined") { const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis && !raf) raf = requestAnimationFrame(tick); else if (!vis && raf) { cancelAnimationFrame(raf); raf = null; } }); io.observe(cv); } else tick();
    window.addEventListener("resize", () => { if (!raf) draw(); }); host._redraw = draw;
  }

  // ===== 第三章：为什么没有 5 次轴（正多边形铺砌）=====
  function vizFivefold(host) {
    const { cv, resize } = makeCanvas(host, 320);
    let n = 5;
    control(host, "正多边形边数", 3, 8, 1, 5, v => "正 " + v + " 边形", v => { n = v; draw(); });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;"; host.appendChild(cap);
    caption(host, "用<b>正多边形铺地砖</b>解释 5 次轴为何不存在：绕一个公共顶点摆正多边形，只有内角能<b>整除 360°</b> 的（正三角形 60°、正方形 90°、正六边形 120°）才能严丝合缝铺满，对应 3/4/6 次轴（连同 1、2 次共 5 种）。正五边形内角 108°，摆 3 个=324°，留 36° 缺口 → <b>晶体里没有 5 次轴</b>。");
    function ngon(ctx, ox, oy, side, theta, col, ink) {
      const ext = 2 * Math.PI / n; let px = ox, py = oy, dir = theta; const pts = [[px, py]];
      for (let k = 0; k < n; k++) { px += Math.cos(dir) * side; py += Math.sin(dir) * side; pts.push([px, py]); dir += ext; }
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      ctx.fillStyle = col; ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.stroke();
    }
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const ox = w / 2, oy = h * 0.62, interior = (n - 2) * 180 / n, intr = interior * Math.PI / 180;
      const fit = Math.floor(360 / interior + 1e-9), side = Math.min(w, h) * 0.27, sum = fit * interior;
      if (sum < 359.99) { ctx.fillStyle = col.danger; ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, side * 1.05, sum * Math.PI / 180, 2 * Math.PI); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
      for (let i = 0; i < fit; i++) ngon(ctx, ox, oy, side, i * intr, col.accent, col.ink);
      ctx.fillStyle = col.primary; ctx.beginPath(); ctx.arc(ox, oy, 4, 0, 7); ctx.fill();
      const gap = Math.round((360 - sum) * 10) / 10;
      cap.innerHTML = "正 <b>" + n + "</b> 边形内角 <b>" + Math.round(interior * 10) / 10 + "°</b>，绕一点摆 <b>" + fit + "</b> 个 = " + Math.round(sum * 10) / 10 + "°——"
        + (Math.abs(sum - 360) < 0.5 ? "<b style='color:var(--accent)'>正好铺满 360° → 允许</b>。" : "<b style='color:var(--danger)'>差 " + gap + "°（红色缺口）填不满 → 这种对称晶体里不存在</b>。");
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
  }

  // ===== 第六章 点缺陷 =====
  function vizPointdefect(host) {
    const { cv, resize } = makeCanvas(host, 320);
    const modes = ["完美晶体", "空位", "间隙原子", "弗仑克尔缺陷", "肖特基缺陷", "置换原子"];
    const notes = [
      "理想晶体：正、负离子（蓝 / 绿）严格交替排列，无缺陷。",
      "<b>空位</b>：某结点上的原子缺失（红色虚线空格），该原子跑到了晶体表面。",
      "<b>间隙原子</b>：多余原子挤进正常结点之间的间隙位置（橙）。",
      "<b>弗仑克尔(Frenkel)缺陷</b>：原子离开自己的结点（留下空位）挤入邻近间隙 → <b>空位 + 间隙成对</b>出现，原子总数守恒、晶体密度不变。常见于 AgBr 等。",
      "<b>肖特基(Schottky)缺陷</b>：一个正离子空位 + 一个负离子空位<b>成对</b>出现（维持电中性），原子迁到表面 → 晶体<b>密度略降</b>。常见于 NaCl 等。",
      "<b>置换原子</b>：杂质原子取代了原结点上的原子（紫）。",
    ];
    let mode = 0;
    btnRow(host, modes, i => { mode = i; draw(); cap.innerHTML = notes[i]; });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;"; host.appendChild(cap);
    legend(host, [{ c: "primary", t: "正离子" }, { c: "accent", t: "负离子" }, { c: "warn", t: "间隙原子" }, { c: "danger", t: "空位" }]);
    function vac(ctx, x, y, r, col) { ctx.strokeStyle = col.danger; ctx.lineWidth = 1.8; ctx.setLineDash([3, 3]); ctx.strokeRect(x - r, y - r, 2 * r, 2 * r); ctx.setLineDash([]); }
    const key = (i, j) => i + "," + j;
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const cols = 7, rows = 5, padX = 42, padY = 30, gx = (w - padX * 2) / (cols - 1), gy = (h - padY * 2) / (rows - 1), r = Math.min(gx, gy) * 0.21;
      const skip = {}, extra = [], arrows = []; const ci = 3, cj = 2;
      if (mode === 1) skip[key(ci, cj)] = 1;
      if (mode === 2) extra.push([ci + 0.5, cj + 0.5, col.warn]);
      if (mode === 3) { skip[key(ci, cj)] = 1; extra.push([ci + 0.5, cj - 0.5, col.warn]); arrows.push([ci, cj, ci + 0.5, cj - 0.5]); }
      if (mode === 4) { skip[key(ci, cj)] = 1; skip[key(ci + 1, cj)] = 1; }
      const subst = mode === 5 ? key(ci, cj) : null;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = padX + i * gx, y = padY + j * gy;
        if (skip[key(i, j)]) { vac(ctx, x, y, r, col); continue; }
        let c = (i + j) % 2 === 0 ? col.primary : col.accent;
        if (subst === key(i, j)) { atom(ctx, x, y, r * 1.18, "#9b59d0", col.ink); continue; }
        atom(ctx, x, y, r, c, col.ink);
      }
      extra.forEach(e => atom(ctx, padX + e[0] * gx, padY + e[1] * gy, r * 0.8, e[2], col.ink));
      arrows.forEach(a => { ctx.strokeStyle = col.warn; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(padX + a[0] * gx, padY + a[1] * gy); ctx.lineTo(padX + a[2] * gx, padY + a[3] * gy); ctx.stroke(); ctx.setLineDash([]); });
    }
    draw(); cap.innerHTML = notes[0]; window.addEventListener("resize", draw); host._redraw = draw;
  }

  // ===== 第六章 掺杂：施主 / 受主 =====
  function vizDoping(host) {
    const { cv, resize } = makeCanvas(host, 330);
    const modes = ["本征 Si", "施主掺杂 (P, n 型)", "受主掺杂 (B, p 型)"];
    const notes = [
      "<b>本征半导体</b>：纯 Si，每个 Si 用 4 个价电子与相邻 4 个 Si 各成 1 对共价键（小圆点 = 共用电子对），没有多余载流子。",
      "<b>施主掺杂（n 型）</b>：5 价的 P 取代 Si，4 个电子成键后<b>多出 1 个电子</b>（蓝 e⁻）束缚很弱、极易挣脱成<b>自由电子</b> → 多数载流子是电子，P 称<b>施主</b>。",
      "<b>受主掺杂（p 型）</b>：3 价的 B 取代 Si，只能成 3 个键，<b>缺 1 个电子留下空穴</b>（红圈），邻键电子来填、空穴随之移动 → 多数载流子是空穴，B 称<b>受主</b>。",
    ];
    let mode = 0;
    btnRow(host, modes, i => { mode = i; draw(); cap.innerHTML = notes[i]; });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;"; host.appendChild(cap);
    const ci = 1, cj = 1;
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const cols = 4, rows = 4, padX = 52, padY = 38, gx = (w - padX * 2) / (cols - 1), gy = (h - padY * 2) / (rows - 1), r = Math.min(gx, gy) * 0.16;
      function bond(i, j, i2, j2, miss) {
        const x1 = padX + i * gx, y1 = padY + j * gy, x2 = padX + i2 * gx, y2 = padY + j2 * gy;
        ctx.strokeStyle = col.faint; ctx.lineWidth = miss ? 1 : 2; if (miss) ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
        if (miss) return;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
        ctx.fillStyle = col.ink; [5, -5].forEach(o => { ctx.beginPath(); ctx.arc(mx + nx * o, my + ny * o, 2, 0, 7); ctx.fill(); });
      }
      const missBond = (i, j, i2, j2) => mode === 2 && ((i === ci && j === cj) || (i2 === ci && j2 === cj)) && i2 === i + 1 && j === j2; // 受主：去掉掺杂原子右侧一根键
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        if (i < cols - 1) bond(i, j, i + 1, j, missBond(i, j, i + 1, j));
        if (j < rows - 1) bond(i, j, i, j + 1, false);
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = padX + i * gx, y = padY + j * gy, doped = i === ci && j === cj && mode > 0;
        atom(ctx, x, y, r * 1.5, doped ? (mode === 1 ? col.primary : col.danger) : col.surface, col.ink);
        ctx.fillStyle = doped ? "#fff" : col.soft; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(doped ? (mode === 1 ? "P" : "B") : "Si", x, y);
      }
      ctx.textBaseline = "alphabetic";
      const dx = padX + ci * gx, dy = padY + cj * gy;
      if (mode === 1) { const ex = dx + gx * 0.4, ey = dy - gy * 0.4; ctx.fillStyle = col.primary; ctx.beginPath(); ctx.arc(ex, ey, 5.5, 0, 7); ctx.fill(); ctx.strokeStyle = col.ink; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = col.primary; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left"; ctx.fillText("e⁻ 自由电子", ex + 10, ey + 4); }
      if (mode === 2) { const hx = dx + gx * 0.5, hy = dy; ctx.strokeStyle = col.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, 7); ctx.stroke(); ctx.fillStyle = col.danger; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left"; ctx.fillText("空穴 h⁺", hx + 11, hy + 4); }
    }
    draw(); cap.innerHTML = notes[0]; window.addEventListener("resize", draw); host._redraw = draw;
    caption(host, "半导体掺杂：取代原子的价电子比 Si（4 价）多 1 个就多 1 个自由电子（施主→n 型），少 1 个就多 1 个空穴（受主→p 型）。靠掺杂精确控制导电类型和载流子浓度，是所有半导体器件的基础。");
  }

  // ===== 第七章 螺型位错（3D 螺旋面，多层）=====
  function vizScrew(host) {
    const N = 3, b = 1.0, sc = 0.46, nL = 3, dy = b;   // nL 层晶面叠成块，整摞被螺旋穿过
    function build(col) {
      const atoms = [], bonds = [], idx = {}; let n = 0;
      const key = (L, i, j) => L + "_" + i + "_" + j;
      for (let L = 0; L < nL; L++) for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
        const u = b * Math.atan2(j + 0.001, i + 0.001) / (2 * Math.PI);   // 螺旋升高量
        idx[key(L, i, j)] = n++;
        atoms.push({ x: i * sc, y: L * dy + u - (nL - 1) * dy / 2, z: j * sc, r: 0.072, color: col.primary });
      }
      for (let L = 0; L < nL; L++) for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
        const a = idx[key(L, i, j)];
        if (i < N) bonds.push([a, idx[key(L, i + 1, j)]]);
        if (j < N && !(i < 0 && j === -1)) bonds.push([a, idx[key(L, i, j + 1)]]);   // 跨螺旋台阶不连键
        if (L < nL - 1) bonds.push([a, idx[key(L + 1, i, j)]]);                       // 竖向原子列
      }
      const yl = (nL - 1) * dy / 2 + b;
      return { atoms, bonds, edges: [[{ x: 0, y: -yl, z: 0 }, { x: 0, y: yl, z: 0 }]], unit: N * sc * 1.7 };
    }
    interactive3D(host, build, { height: 360, ax: -0.7, ay: 0.5 });
    legend(host, [{ c: "primary", t: "原子（多层晶面，螺旋上升）" }]);
    caption(host, "🖱️ <b>拖动旋转</b>。<b>螺型位错</b>：原本平行的<b>多层原子面</b>被连接成<b>一个连续螺旋面</b>——绕<b>位错线</b>（中央竖线）转一圈，整摞面就升高一个<b>柏氏矢量 b</b>（图中有一道螺旋台阶）。<b>b ∥ 位错线</b>（刃型是 b⊥线）；它<b>没有多余半原子面</b>，可在任意含位错线的面上滑移、运动较自由；<b>应力场只有切应力、无正应力</b>（晶体体积不变）。");
  }

  // ===== 第七章 柏氏回路（弗兰克法：实际晶体闭合 / 完整晶体差一个 b）=====
  function vizBurgers(host) {
    const { cv, resize } = makeCanvas(host, 360);
    let mode = 0; const cols = 11, rows = 10, midI = 5, midJ = 4;
    const L = 2, R = 7, T = 2, B = 6;  // 回路：下/上各 4 步，左/右底各 5 步
    btnRow(host, ["(a) 实际晶体（含位错 · 回路闭合）", "(b) 完整参考晶体（同样走法 · 缺口=b）"], i => { mode = i; draw(); cap.innerHTML = mk(); });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;"; host.appendChild(cap);
    function arrow(ctx, x1, y1, x2, y2, c) {
      ctx.strokeStyle = c; ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1), s = 6;
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - s * Math.cos(a - 0.5), y2 - s * Math.sin(a - 0.5)); ctx.lineTo(x2 - s * Math.cos(a + 0.5), y2 - s * Math.sin(a + 0.5)); ctx.closePath(); ctx.fill();
    }
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const padX = 48, padY = 22, gx = (w - padX * 2) / (cols - 1), gy = (h - padY * 2) / (rows - 1), r = Math.min(gx, gy) * 0.14;
      const PX = i => padX + i * gx, PY = j => padY + j * gy;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) atom(ctx, PX(i), PY(j), r, col.primary, col.ink);
      if (mode === 0) { const tx = PX(midI), ty = PY(midJ); ctx.strokeStyle = col.soft; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, PY(midJ - 2)); ctx.lineTo(tx, ty); ctx.stroke(); ctx.beginPath(); ctx.moveTo(tx - 9, ty); ctx.lineTo(tx + 9, ty); ctx.stroke(); }
      const ac = col.accent;
      for (let j = T; j < B; j++) arrow(ctx, PX(L), PY(j), PX(L), PY(j + 1), ac);      // 下（左边）
      for (let i = L; i < R; i++) arrow(ctx, PX(i), PY(B), PX(i + 1), PY(B), ac);      // 右（底边）
      for (let j = B; j > T; j--) arrow(ctx, PX(R), PY(j), PX(R), PY(j - 1), ac);      // 上（右边）
      const topEnd = mode === 0 ? L : L - 1;                                           // (a) 回到起点；(b) 多落一格到 ×
      for (let i = R; i > topEnd; i--) arrow(ctx, PX(i), PY(T), PX(i - 1), PY(T), ac); // 左（顶边）
      ctx.lineWidth = 2; ctx.strokeStyle = col.ink; ctx.fillStyle = col.surface;       // 起点 ○
      ctx.beginPath(); ctx.arc(PX(L), PY(T), r * 1.35, 0, 7); ctx.fill(); ctx.stroke();
      if (mode === 1) {
        const ex = PX(L - 1), ey = PY(T);
        ctx.strokeStyle = col.danger; ctx.lineWidth = 2.4;                             // 终点 ×
        ctx.beginPath(); ctx.moveTo(ex - 6, ey - 6); ctx.lineTo(ex + 6, ey + 6); ctx.moveTo(ex + 6, ey - 6); ctx.lineTo(ex - 6, ey + 6); ctx.stroke();
        arrow(ctx, ex, ey - 17, PX(L), ey - 17, col.danger);                           // b：× → ○
        ctx.fillStyle = col.danger; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.fillText("b", (ex + PX(L)) / 2, ey - 22);
      }
    }
    function mk() {
      return mode === 0
        ? "🅐 <b>实际晶体（含位错 ⊥）</b>：从 ○ 出发逐原子走「下 4 → 右 5 → 上 4 → 左 5」，<b>回到出发点 ○，回路闭合</b>。"
        : "🅑 <b>完整参考晶体</b>：按<b>同样的走法</b>，却停在 <b style='color:var(--danger)'>×</b> 处、回不到 ○。从 × 指向 ○ 的矢量就是<b>柏氏矢量 b</b>。";
    }
    draw(); cap.innerHTML = mk(); window.addEventListener("resize", draw); host._redraw = draw;
    caption(host, "<b>柏氏回路（弗兰克法）求 b</b>：① 在<b>实际含位错晶体</b>里绕位错逐原子走一圈、回到原点（图 a 闭合）；② 到<b>完整参考晶体</b>里按<b>同样的步数</b>再走一遍，终点回不到起点（图 b）；③ <b>从终点到起点的矢量 = 柏氏矢量 b</b>。刃型位错 <b>b ⊥ 位错线</b>；b 与回路大小、路径无关（守恒性）。");
  }

  // ===== 第八章 堆垛层错 =====
  function vizStackfault(host) {
    const SEQ = [
      { name: "正常 fcc：…A B C A B C…（每层都不同于上下邻层）", layers: ["A", "B", "C", "A", "B", "C"], fault: [] },
      { name: "抽出型层错：抽掉一层 → 出现 …A C… 直接相邻", layers: ["A", "B", "C", "A", "C", "A", "B"], fault: [4] },
      { name: "孪晶界：从某层起顺序镜像 …A B C | C B A…", layers: ["A", "B", "C", "C", "B", "A"], fault: [3] },
    ];
    const { cv, resize } = makeCanvas(host, 340); let mode = 0;
    btnRow(host, ["正常 ABCABC", "抽出型层错", "孪晶界"], i => { mode = i; draw(); });
    const off = { A: 0, B: 1, C: 2 };
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const S = SEQ[mode], L = S.layers, n = L.length, padX = 74, padY = 24, rowH = (h - padY * 2) / (n - 1), nb = 5, d = Math.min(rowH * 0.62, (w - padX * 2) / (nb + 0.7)), r = d * 0.46;
      for (let li = 0; li < n; li++) {
        const j = n - 1 - li, y = padY + j * rowH, t = L[li], ox = off[t] * (d / 3), isF = S.fault.indexOf(li) >= 0;
        for (let k = 0; k < nb; k++) atom(ctx, padX + ox + k * d, y, r, isF ? col.danger : (t === "A" ? col.primary : t === "B" ? col.accent : col.warn), col.ink);
        ctx.fillStyle = isF ? col.danger : col.soft; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "right"; ctx.fillText(t, padX - 16, y + 5);
      }
      ctx.fillStyle = col.soft; ctx.font = "12.5px sans-serif"; ctx.textAlign = "center"; ctx.fillText(SEQ[mode].name, w / 2, h - 6);
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
    legend(host, [{ c: "primary", t: "A 层" }, { c: "accent", t: "B 层" }, { c: "warn", t: "C 层" }, { c: "danger", t: "层错处" }]);
    caption(host, "<b>堆垛层错</b>是一种<b>面缺陷</b>：密排面（fcc 的 {111} 面）的堆垛顺序 ABCABC 在某处出错。<b>抽出型</b>＝抽掉一层（出现 …AC… 相邻）；<b>孪晶界</b>＝从某层起顺序镜像反演。层错由<b>部分位错（肖克莱）</b>界定、能量较低。每层横向错开就是密堆里 A/B/C 三种位置。");
  }

  // ===== 第八章 小角度倾斜晶界 D=b/θ =====
  function vizTilt(host) {
    const { cv, resize } = makeCanvas(host, 330); let theta = 10;
    control(host, "取向差 θ", 4, 24, 1, 10, v => v + "°", v => { theta = v; draw(); });
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const bx = w / 2, th = theta * Math.PI / 180, cy = (h - 28) / 2, gx = 25, gy = 25;
      ctx.strokeStyle = col.grid; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, 14); ctx.lineTo(bx, h - 38); ctx.stroke(); ctx.setLineDash([]);
      function grid(sign) {
        ctx.fillStyle = col.faint;
        for (let i = 0; i < 7; i++) for (let j = -5; j <= 5; j++) {
          const x = sign * (i * gx + 10), y = j * gy, a = sign * th / 2, X = x * Math.cos(a) - y * Math.sin(a), Y = x * Math.sin(a) + y * Math.cos(a), px = bx + X, py = cy + Y;
          if (px > 6 && px < w - 6 && py > 12 && py < h - 32) { ctx.beginPath(); ctx.arc(px, py, 2.6, 0, 7); ctx.fill(); }
        }
      }
      grid(-1); grid(1);
      const b = gy, D = b / th; ctx.strokeStyle = col.danger; ctx.lineWidth = 2;
      for (let y = cy - D * 3; y <= cy + D * 3 + 1; y += D) { if (y < 18 || y > h - 42) continue; ctx.beginPath(); ctx.moveTo(bx, y - 7); ctx.lineTo(bx, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(bx - 7, y); ctx.lineTo(bx + 7, y); ctx.stroke(); }
      ctx.fillStyle = col.soft; ctx.font = "13px sans-serif"; ctx.textAlign = "center"; ctx.fillText("θ = " + theta + "°，位错间距 D = b/θ ≈ " + D.toFixed(0) + " px（θ 越大，⊥ 越密）", w / 2, h - 8);
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
    caption(host, "<b>小角度倾斜晶界</b>：取向差 θ 很小的两晶粒之间，晶界本质是<b>一列等间距的刃型位错（⊥）</b>。几何关系 <b>D = b/θ</b>（b 柏氏矢量，θ 取弧度）——θ 越大、位错排得越密；θ 大到约 >10–15° 后位错重叠、模型失效，就成了大角晶界。");
  }

  // ===== 第一章 晶体 vs 非晶体 =====
  function vizAmorphous(host) {
    const { cv, resize } = makeCanvas(host, 320); const cols = 9, rows = 7, offs = [];
    for (let k = 0; k < cols * rows; k++) offs.push([Math.random() - 0.5, Math.random() - 0.5]);
    let mode = 0;
    btnRow(host, ["晶体（远程有序）", "非晶体（长程无序）"], i => { mode = i; draw(); });
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const padX = 34, padY = 28, gx = (w - padX * 2) / (cols - 1), gy = (h - padY * 2) / (rows - 1), r = Math.min(gx, gy) * 0.16, amp = mode === 0 ? 0 : 0.42, pos = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const o = offs[j * cols + i]; pos.push([padX + i * gx + o[0] * amp * gx, padY + j * gy + o[1] * amp * gy]); }
      ctx.strokeStyle = col.faint; ctx.lineWidth = 1.4;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = pos[j * cols + i];
        if (i < cols - 1) { const b = pos[j * cols + i + 1]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        if (j < rows - 1) { const b = pos[(j + 1) * cols + i]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      }
      pos.forEach(p => atom(ctx, p[0], p[1], r, col.primary, col.ink));
      ctx.fillStyle = col.soft; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(mode === 0 ? "周期性排列：长程有序（有平移对称）" : "近程有序、长程无序（如石英玻璃）", w / 2, h - 8);
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
    caption(host, "<b>晶体 vs 非晶体</b>：晶体内部质点<b>周期性重复排列</b>，既近程有序又<b>远程（长程）有序</b> → 有固定熔点、各向异性、能自发长出规则外形（自范性）。非晶体（玻璃、松香、石蜡）<b>只有近程有序、长程无序</b>，像「冻住的液体」→ 无固定熔点、宏观各向同性。区别的根本就在<b>有没有远程有序</b>。");
  }

  // ===== 第二章 四面体 / 八面体空隙 =====
  function vizVoids(host) {
    let mode = 0;
    const TET = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], OCT = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    function build(col) {
      const V = mode === 0 ? TET : OCT, s = mode === 0 ? 0.85 : 0.8, verts = V.map(p => ({ x: p[0] * s, y: p[1] * s, z: p[2] * s }));
      const atoms = verts.map(p => ({ x: p.x, y: p.y, z: p.z, r: 0.26, color: col.primary }));
      atoms.push({ x: 0, y: 0, z: 0, r: mode === 0 ? 0.14 : 0.2, color: col.danger });
      const vi = atoms.length - 1, bonds = verts.map((_, i) => [vi, i]), edges = [];
      for (let a = 0; a < verts.length; a++) for (let b = a + 1; b < verts.length; b++) {
        const d = Math.hypot(verts[a].x - verts[b].x, verts[a].y - verts[b].y, verts[a].z - verts[b].z);
        if (mode === 0 || d < s * 2 * 0.99) edges.push([verts[a], verts[b]]);
      }
      return { atoms, bonds, edges, unit: 1.25 };
    }
    const api = interactive3D(host, build, { height: 340, ax: -0.5, ay: 0.6 });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;";
    btnRow(host, ["四面体空隙", "八面体空隙"], i => { mode = i; api.redraw(); cap.innerHTML = mk(); });
    host.appendChild(cap);
    legend(host, [{ c: "primary", t: "密堆积球（原子）" }, { c: "danger", t: "空隙中心" }]);
    function mk() { return "🖱️ <b>拖动旋转</b>。" + (mode === 0 ? "<b>四面体空隙</b>：4 个球围成正四面体，空隙（红）被 <b>4</b> 个原子包围。" : "<b>八面体空隙</b>：6 个球围成正八面体，空隙（红）被 <b>6</b> 个原子包围，比四面体空隙<b>大</b>。"); }
    cap.innerHTML = mk();
    caption(host, "密堆积里球与球之间留下两种空隙：<b>n 个球 → n 个八面体空隙 + 2n 个四面体空隙</b>。许多化合物就是大离子密堆、小离子<b>填空隙</b>：NaCl=填全部八面体空隙；金刚石/闪锌矿=填一半四面体空隙；金红石=填一半八面体空隙。");
  }

  // ===== 第二章 均摊法 =====
  function vizShare(host) {
    const { corners, edges } = cubeEdges(0.5);
    const em = edges.map(e => ({ x: (e[0].x + e[1].x) / 2, y: (e[0].y + e[1].y) / 2, z: (e[0].z + e[1].z) / 2 }));
    const fc = [[.5, 0, 0], [-.5, 0, 0], [0, .5, 0], [0, -.5, 0], [0, 0, .5], [0, 0, -.5]].map(p => ({ x: p[0], y: p[1], z: p[2] }));
    const types = [
      { tag: "顶角", pts: corners, frac: "1/8", cells: "被 8 个晶胞共有", rr: 0.075 },
      { tag: "棱心", pts: em, frac: "1/4", cells: "被 4 个晶胞共有", rr: 0.065 },
      { tag: "面心", pts: fc, frac: "1/2", cells: "被 2 个晶胞共有", rr: 0.08 },
      { tag: "体心", pts: [{ x: 0, y: 0, z: 0 }], frac: "1", cells: "晶胞独占", rr: 0.095 },
    ];
    let hl = -1;
    function build(col) {
      const cmap = [col.primary, col.accent, col.warn, col.danger], atoms = [];
      types.forEach((t, ti) => t.pts.forEach(p => { const dim = hl >= 0 && hl !== ti; atoms.push({ x: p.x, y: p.y, z: p.z, r: t.rr, color: dim ? (css("--text-faint") || "#999") : cmap[ti] }); }));
      return { atoms, edges, unit: 1.05 };
    }
    const api = interactive3D(host, build, { height: 330, ax: -0.45, ay: 0.7 });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;";
    btnRow(host, ["全部", "顶角", "棱心", "面心", "体心"], i => { hl = i - 1; api.redraw(); cap.innerHTML = mk(); });
    host.appendChild(cap);
    legend(host, [{ c: "primary", t: "顶角 ×1/8" }, { c: "accent", t: "棱心 ×1/4" }, { c: "warn", t: "面心 ×1/2" }, { c: "danger", t: "体心 ×1" }]);
    function mk() { if (hl < 0) return "🖱️ <b>拖动旋转</b>。<b>均摊法</b>：一个原子被几个晶胞共有，它对本晶胞就只贡献几分之一。点上面按钮逐个看。"; const t = types[hl]; return "🖱️ <b>" + t.tag + "原子</b>：" + t.cells + " → 每个晶胞只算 <b>" + t.frac + "</b>。"; }
    cap.innerHTML = mk();
    caption(host, "<b>均摊法</b>口诀：<b>角 1/8、棱 1/4、面 1/2、体心 1</b>。例：面心立方 = 8 顶角×1/8 + 6 面心×1/2 = 1 + 3 = <b>4</b> 个原子/晶胞。");
  }

  // ===== 第四章 三维晶面指数 =====
  function vizMiller3d(host) {
    const planes = [[1, 0, 0], [1, 1, 0], [1, 1, 1], [2, 1, 0], [1, 1, 2], [2, 2, 1]]; let pi = 2;
    const cc = []; for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) cc.push([x, y, z]);
    const EL = []; for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) { const d = (cc[a][0] !== cc[b][0]) + (cc[a][1] !== cc[b][1]) + (cc[a][2] !== cc[b][2]); if (d === 1) EL.push([cc[a], cc[b]]); }
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    function planePoly(h, k, l) {
      const pts = [], push = p => { if (!pts.some(q => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6 && Math.abs(q[2] - p[2]) < 1e-6)) pts.push(p); };
      EL.forEach(e => { const A = e[0], B = e[1], fa = h * A[0] + k * A[1] + l * A[2] - 1, fb = h * B[0] + k * B[1] + l * B[2] - 1;
        if (Math.abs(fa) < 1e-9) push(A); if (Math.abs(fb) < 1e-9) push(B);
        if (fa * fb < -1e-12) { const t = fa / (fa - fb); push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), A[2] + t * (B[2] - A[2])]); } });
      if (pts.length > 2) {
        const c = [0, 1, 2].map(d => pts.reduce((s, p) => s + p[d], 0) / pts.length), n = [h, k, l], aa = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        let u = cross(n, aa); const Lu = Math.hypot(u[0], u[1], u[2]); u = [u[0] / Lu, u[1] / Lu, u[2] / Lu]; const v = cross(n, u);
        pts.sort((p, q) => { const dp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], dq = [q[0] - c[0], q[1] - c[1], q[2] - c[2]]; return Math.atan2(dp[0] * v[0] + dp[1] * v[1] + dp[2] * v[2], dp[0] * u[0] + dp[1] * u[1] + dp[2] * u[2]) - Math.atan2(dq[0] * v[0] + dq[1] * v[1] + dq[2] * v[2], dq[0] * u[0] + dq[1] * u[1] + dq[2] * u[2]); });
      }
      return pts;
    }
    const { edges } = cubeEdges(0.5);
    function build(col) {
      const [h, k, l] = planes[pi], poly = planePoly(h, k, l).map(p => ({ x: p[0] - .5, y: p[1] - .5, z: p[2] - .5 })), atoms = [];
      [[h, 0], [k, 1], [l, 2]].forEach(([c, ax]) => { if (c !== 0) { const p = [-.5, -.5, -.5]; p[ax] = 1 / c - .5; atoms.push({ x: p[0], y: p[1], z: p[2], r: 0.055, color: col.danger }); } });
      return { atoms, edges, polys: poly.length > 2 ? [{ pts: poly, fill: col.primary, alpha: 0.26, stroke: col.primary }] : [], unit: 1.0 };
    }
    const api = interactive3D(host, build, { height: 340, ax: -0.5, ay: 0.62 });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;";
    btnRow(host, planes.map(p => "(" + p.join("") + ")"), i => { pi = i; api.redraw(); updc(); });
    host.appendChild(cap);
    function updc() { const [h, k, l] = planes[pi], f = c => c === 0 ? "∞" : (c === 1 ? "1" : "1/" + c); cap.innerHTML = "🖱️ <b>拖动旋转</b>。晶面 <b>(" + h + k + l + ")</b>：三轴截距 = <b>" + f(h) + ", " + f(k) + ", " + f(l) + "</b>（红点）。指数 = 截距的倒数；指数为 0 → 与该轴<b>平行</b>(截距 ∞)；指数越大→截距越小→晶面越密。"; }
    updc();
    caption(host, "三维晶面指数 (hkl)：取该面在三轴上的<b>截距</b>（以点阵常数为单位），取<b>倒数</b>、化成最简整数比即得 (hkl)。蓝色半透明面是它在立方晶胞里的实际位置，红点是它与三个坐标轴的交点。");
  }

  const REG = { cubic: vizCubic, diamond: vizDiamond, wurtzite: vizWurtzite, nacl: vizNaCl, cscl: vizCsCl, rutile: vizRutile, perovskite: vizPerovskite, graphite: vizGraphite, closepack: vizClosepack, bravais: vizBravais, reduce: vizReduce, density: vizDensity, voids: vizVoids, share: vizShare, rotaxis: vizRotaxis, fivefold: vizFivefold, pointdefect: vizPointdefect, doping: vizDoping, screw: vizScrew, burgers: vizBurgers, stackfault: vizStackfault, tilt: vizTilt, amorphous: vizAmorphous, miller: vizMiller, miller3d: vizMiller3d, edge: vizEdge, slip: vizSlip };
  function init() {
    document.querySelectorAll("[data-viz]").forEach(host => {
      const fn = REG[host.dataset.viz];
      if (fn) { const card = document.createElement("div"); card.className = "card"; host.appendChild(card); fn(card); }
    });
    const obs = new MutationObserver(() => { document.querySelectorAll("[data-viz] .card").forEach(c => { if (c._redraw) c._redraw(); }); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
