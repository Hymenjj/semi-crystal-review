/* ===================================================================
   半导体结构 · 交互可视化（纯 Canvas，无依赖）
   3D 可旋转：cubic 立方晶胞 / closepack 密堆积 / diamond 金刚石&闪锌矿
   2D：miller 晶面指数 / edge 刃型位错
   <div data-viz="cubic|closepack|diamond|miller|edge"></div>
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
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative;width:100%;";
    const cv = document.createElement("canvas");
    cv.style.cssText = "width:100%;display:block;border-radius:10px;";
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
    const lab = document.createElement("label");
    lab.style.cssText = "font-size:14px;font-weight:600;min-width:120px;";
    const sl = document.createElement("input");
    sl.type = "range"; sl.min = min; sl.max = max; sl.step = step; sl.value = val;
    sl.style.cssText = "flex:1;min-width:160px;accent-color:var(--primary);";
    const out = document.createElement("span");
    out.style.cssText = "font-variant-numeric:tabular-nums;font-weight:700;color:var(--primary);min-width:90px;text-align:right;";
    function upd() { out.innerHTML = fmt(parseFloat(sl.value)); lab.innerHTML = label; }
    sl.addEventListener("input", () => { upd(); onInput(parseFloat(sl.value)); });
    upd(); row.appendChild(lab); row.appendChild(sl); row.appendChild(out); host.appendChild(row);
    return sl;
  }
  function btnRow(host, labels, cb) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;";
    labels.forEach((t, i) => {
      const b = document.createElement("button");
      b.className = "btn" + (i === 0 ? " primary" : ""); b.textContent = t;
      b.onclick = () => { row.querySelectorAll("button").forEach((x, j) => x.className = "btn" + (j === i ? " primary" : "")); cb(i); };
      row.appendChild(b);
    });
    host.appendChild(row); return row;
  }
  function caption(host, html) {
    const p = document.createElement("p");
    p.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;";
    p.innerHTML = html; host.appendChild(p);
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
    let x = p.x * cy + p.z * sy, z = -p.x * sy + p.z * cy, y = p.y;
    const cx = Math.cos(ax), sx = Math.sin(ax);
    const y2 = y * cx - z * sx, z2 = y * sx + z * cx;
    return { x: x, y: y2, z: z2 };
  }

  // build(col) -> { atoms:[{x,y,z,r,color}], bonds:[[i,j]], edges:[[ptA,ptB]], unit }
  function interactive3D(host, build, opts) {
    opts = opts || {};
    const { cv, resize } = makeCanvas(host, opts.height || 340);
    cv.style.cursor = "grab"; cv.style.touchAction = "none";
    let ax = opts.ax != null ? opts.ax : -0.5, ay = opts.ay != null ? opts.ay : 0.7;
    let dragging = false, spin = opts.spin !== false, raf = null, px = 0, py = 0;

    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const scene = build(col);
      const unit = scene.unit || 1.3;
      const scale = Math.min(w, h) / 2 * 0.80 / unit;
      const cx = w / 2, cy = h / 2;
      const SX = p => cx + p.x * scale, SY = p => cy - p.y * scale;
      // 棱框
      if (scene.edges) {
        ctx.strokeStyle = col.grid; ctx.lineWidth = 1.4;
        scene.edges.forEach(e => { const a = rot(e[0], ax, ay), b = rot(e[1], ax, ay);
          ctx.beginPath(); ctx.moveTo(SX(a), SY(a)); ctx.lineTo(SX(b), SY(b)); ctx.stroke(); });
      }
      const PA = scene.atoms.map(a => { const r = rot(a, ax, ay); return { src: a, x: r.x, y: r.y, z: r.z, r: a.r, color: a.color }; });
      let zmin = Infinity, zmax = -Infinity; PA.forEach(p => { if (p.z < zmin) zmin = p.z; if (p.z > zmax) zmax = p.z; });
      const span = (zmax - zmin) || 1;
      // 键（按深度排序，画在原子之间）
      if (scene.bonds) {
        const bd = scene.bonds.map(b => { const A = PA[b[0]], B = PA[b[1]]; return { A, B, z: (A.z + B.z) / 2 }; }).sort((m, n) => m.z - n.z);
        bd.forEach(b => { ctx.strokeStyle = col.faint; ctx.lineWidth = 3.5; ctx.globalAlpha = 0.5 + 0.5 * ((b.z - zmin) / span);
          ctx.beginPath(); ctx.moveTo(SX(b.A), SY(b.A)); ctx.lineTo(SX(b.B), SY(b.B)); ctx.stroke(); });
        ctx.globalAlpha = 1;
      }
      // 原子：远的先画
      PA.map((p, i) => i).sort((i, j) => PA[i].z - PA[j].z).forEach(i => {
        const p = PA[i]; ctx.globalAlpha = 0.55 + 0.45 * ((p.z - zmin) / span);
        atom(ctx, SX(p), SY(p), p.r * scale, p.color, col.ink);
      });
      ctx.globalAlpha = 1;
      if (opts.overlay) opts.overlay(ctx, w, h, col, scale, cx, cy, (p) => rot(p, ax, ay));
      if (spin && !dragging) ay += 0.005;
    }
    function tick() { draw(); raf = (spin && !dragging) ? requestAnimationFrame(tick) : null; }
    function start() { if (!raf) raf = requestAnimationFrame(tick); }
    cv.addEventListener("pointerdown", e => { dragging = true; spin = false; px = e.clientX; py = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (x) {} cv.style.cursor = "grabbing"; });
    cv.addEventListener("pointermove", e => { if (!dragging) return; ay += (e.clientX - px) * 0.01; ax += (e.clientY - py) * 0.01; px = e.clientX; py = e.clientY; draw(); });
    cv.addEventListener("pointerup", () => { dragging = false; cv.style.cursor = "grab"; });
    cv.addEventListener("pointercancel", () => { dragging = false; });
    cv.addEventListener("dblclick", () => { spin = !spin; if (spin) start(); });
    window.addEventListener("resize", () => { if (!raf) draw(); });
    host._redraw = () => { if (!raf) draw(); };
    start();
    return { redraw: () => { if (!raf) draw(); } };
  }

  function cubeEdges(s) {
    const C = []; [-s, s].forEach(z => [-s, s].forEach(y => [-s, s].forEach(x => C.push({ x, y, z }))));
    const E = [];
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      const d = Math.abs(C[i].x - C[j].x) + Math.abs(C[i].y - C[j].y) + Math.abs(C[i].z - C[j].z);
      if (Math.abs(d - 2 * s) < 1e-6) E.push([C[i], C[j]]);
    }
    return { corners: C, edges: E };
  }

  // ---------- 1. 立方晶胞（3D）----------
  function vizCubic(host) {
    let mode = 0; // 0 P, 1 I, 2 F
    const { corners, edges } = cubeEdges(0.5);
    function build(col) {
      const atoms = corners.map(p => ({ x: p.x, y: p.y, z: p.z, r: 0.14, color: col.primary }));
      if (mode === 1) atoms.push({ x: 0, y: 0, z: 0, r: 0.15, color: col.danger });
      if (mode === 2) [[0.5, 0, 0], [-0.5, 0, 0], [0, 0.5, 0], [0, -0.5, 0], [0, 0, 0.5], [0, 0, -0.5]]
        .forEach(f => atoms.push({ x: f[0], y: f[1], z: f[2], r: 0.14, color: col.accent }));
      return { atoms, edges, unit: 1.05 };
    }
    const api = interactive3D(host, build, { height: 330 });
    btnRow(host, ["简单立方 P", "体心立方 I", "面心立方 F"], i => { mode = i; api.redraw(); });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;"; host.appendChild(cap);
    const info = [
      "简单立方 P：8 个顶角原子 → 8×1/8 = <b>1</b> 个/晶胞",
      "体心立方 I：顶角 + 1 个体心(红) → 8×1/8 + 1 = <b>2</b> 个/晶胞",
      "面心立方 F：顶角 + 6 个面心(绿) → 8×1/8 + 6×1/2 = <b>4</b> 个/晶胞",
    ];
    const orig = api.redraw; api.redraw = () => { orig(); cap.innerHTML = "🖱️ <b>拖动旋转</b>（双击暂停/继续自动转）。" + info[mode]; };
    api.redraw();
    caption(host, "顶角原子被 8 个晶胞共有(算 1/8)、面心被 2 个共有(算 1/2)、体心独占(算 1)。");
  }

  // ---------- 2. 密堆积（3D：ABAB vs ABCABC）----------
  function vizClosepack(host) {
    let mode = 0; // 0 hcp ABAB, 1 ccp ABCABC
    const e1 = { x: 1, y: 0 }, e2 = { x: 0.5, y: Math.sqrt(3) / 2 };
    const cc = Math.sqrt(2 / 3); // 层间距
    const hollow = { x: (e1.x + e2.x) / 3, y: (e1.y + e2.y) / 3 };
    function layerPts() { const P = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) P.push({ x: i * e1.x + j * e2.x, y: i * e1.y + j * e2.y }); return P; }
    function build(col) {
      const base = layerPts();
      const cxm = (e1.x + e2.x), cym = (e1.y + e2.y); // 中心(i=j=1)
      const cols = [col.primary, col.accent, col.danger];
      const seq = mode === 0 ? [0, 1, 0] : [0, 1, 2];
      const atoms = [];
      seq.forEach((t, layer) => {
        const off = { x: hollow.x * t, y: hollow.y * t };
        base.forEach(p => atoms.push({
          x: p.x + off.x - cxm, y: (layer * cc) - cc, z: p.y + off.y - cym, r: 0.42, color: cols[t],
        }));
      });
      return { atoms, unit: 2.5 };
    }
    const api = interactive3D(host, build, { height: 340, ax: -0.85, ay: 0.5 });
    btnRow(host, ["六方密堆 ABAB…", "立方密堆 ABCABC…"], i => { mode = i; api.redraw(); });
    caption(host, "🖱️ <b>拖动旋转</b>看层与层的错位。<b style='color:var(--primary)'>A</b>/<b style='color:var(--accent)'>B</b>/<b style='color:var(--danger)'>C</b> 是三种横向位置。第三层落回 A 正上方 = <b>六方密堆 hcp(ABAB)</b>；第三层错到新位置 C = <b>立方密堆 ccp = 面心立方(ABCABC)</b>。两者空间利用率都 <b>74.05%</b>。");
  }

  // ---------- 3. 金刚石 / 闪锌矿（3D）----------
  function vizDiamond(host) {
    let mode = 0; // 0 金刚石(同种), 1 闪锌矿(两种)
    // 单胞 0..1，居中 -0.5
    const A = [];
    [[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1],
     [.5,.5,0],[.5,0,.5],[0,.5,.5],[.5,.5,1],[.5,1,.5],[1,.5,.5]].forEach(p => A.push({x:p[0],y:p[1],z:p[2]}));
    const B = [[.25,.25,.25],[.75,.75,.25],[.75,.25,.75],[.25,.75,.75]].map(p => ({x:p[0],y:p[1],z:p[2]}));
    const cen = p => ({ x: p.x - 0.5, y: p.y - 0.5, z: p.z - 0.5 });
    // 键：B 与近邻 A（距离 ≈ √3/4 ≈ 0.433）
    const bonds = [];
    B.forEach((b, bi) => A.forEach((a, ai) => {
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d < 0.46) bonds.push([ai, A.length + bi]); // A 在前，B 接在后
    }));
    const { edges } = cubeEdges(0.5);
    function build(col) {
      const atoms = [];
      A.forEach(p => { const c = cen(p); atoms.push({ x: c.x, y: c.y, z: c.z, r: 0.10, color: col.primary }); });
      B.forEach(p => { const c = cen(p); atoms.push({ x: c.x, y: c.y, z: c.z, r: 0.10, color: mode === 0 ? col.primary : col.accent }); });
      return { atoms, bonds, edges, unit: 1.05 };
    }
    const api = interactive3D(host, build, { height: 360, ax: -0.5, ay: 0.6 });
    btnRow(host, ["金刚石型 (同种原子)", "闪锌矿型 (两种原子)"], i => { mode = i; api.redraw(); });
    caption(host, "🖱️ <b>拖动旋转</b>。金刚石 = 两套面心立方沿体对角线错开 1/4 套构，每个原子 sp³ 杂化、与 4 个原子成正四面体键（键角 109°28′）。<b>闪锌矿</b>把其中一套换成另一种原子（如 Ga 蓝、As 绿）→ 缺对称中心、对称性更低。骨架完全一样。");
  }

  // ---------- 4. 晶面指数（2D 演示）----------
  function vizMiller(host) {
    const { cv, resize } = makeCanvas(host, 320);
    let hh = 1, kk = 1;
    control(host, "指数 h", 0, 3, 1, 1, v => `h = ${v}`, v => { hh = v; draw(); });
    control(host, "指数 k", 0, 3, 1, 1, v => `k = ${v}`, v => { kk = v; draw(); });
    const cap = document.createElement("p"); cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;"; host.appendChild(cap);
    caption(host, "二维演示晶面指数 (h k)：a 轴截距 = 1/h、b 轴截距 = 1/k。<b>指数越大→截距越小→晶面越靠近原点、越密。</b>指数为 0 表示与该轴平行(截距 ∞)。三维 (h k l) 同理。");
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const pad = 46, x0 = pad, y0 = h - pad, span = Math.min(w - pad * 2, h - pad * 2);
      const ux = span / 3, uy = span / 3;
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
        if (kk !== 0) { const y = (m - hh * 0) / kk; if (y >= 0 && y <= 3) pts.push([0, y]); }
        if (kk !== 0) { const y = (m - hh * 3) / kk; if (y >= 0 && y <= 3) pts.push([3, y]); }
        if (hh !== 0) { const x = (m - kk * 0) / hh; if (x >= 0 && x <= 3) pts.push([x, 0]); }
        if (hh !== 0) { const x = (m - kk * 3) / hh; if (x >= 0 && x <= 3) pts.push([x, 3]); }
        if (pts.length >= 2) { ctx.beginPath(); ctx.moveTo(x0 + pts[0][0] * ux, y0 - pts[0][1] * uy); ctx.lineTo(x0 + pts[1][0] * ux, y0 - pts[1][1] * uy); ctx.stroke(); }
      }
      if (!(hh === 0 && kk === 0)) for (let m = 1; m <= 3; m++) lineFor(m);
      ctx.fillStyle = col.danger;
      if (isFinite(ix) && ix <= 3) { ctx.beginPath(); ctx.arc(x0 + ix * ux, y0, 5, 0, 7); ctx.fill(); }
      if (isFinite(iy) && iy <= 3) { ctx.beginPath(); ctx.arc(x0, y0 - iy * uy, 5, 0, 7); ctx.fill(); }
      const fx = hh === 0 ? "∞" : (hh === 1 ? "1" : "1/" + hh);
      const fy = kk === 0 ? "∞" : (kk === 1 ? "1" : "1/" + kk);
      cap.innerHTML = (hh === 0 && kk === 0) ? "h、k 不能同时为 0。"
        : `晶面指数 <b style="color:var(--primary)">(${hh} ${kk})</b>：a 轴截距 = <b>${fx}</b>，b 轴截距 = <b>${fy}</b>。截距取倒数 → ${hh}, ${kk}，正好是指数本身。`;
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
  }

  // ---------- 5. 刃型位错（2D）----------
  function vizEdge(host) {
    const { cv, resize } = makeCanvas(host, 300);
    let pos = 4;
    control(host, "滑移：位错位置", 1, 8, 1, 4, v => `第 ${v} 列`, v => { pos = v; draw(); });
    caption(host, "<b style='color:var(--danger)'>刃型位错</b>：上半部多插了<b>半个原子面</b>（红色），它的下端缘就是位错线（⊥）。切应力下位错<b>逐列移动(滑移)</b>，移到边缘就完成一个原子间距的滑移——比整面同时滑动省力得多。柏氏矢量 b ⊥ 位错线。");
    function bend(i, pos, gx, j, midRow) { const d = i - pos, wgt = (midRow - j) / midRow; return -Math.sign(d) * Math.min(Math.abs(d), 2) * gx * 0.06 * wgt * (Math.abs(d) <= 3 ? 1 : 0); }
    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const cols = 9, rows = 6, padX = 36, padY = 30;
      const gx = (w - padX * 2) / (cols - 1), gy = (h - padY * 2) / (rows - 1), r = Math.min(gx, gy) * 0.16;
      const midRow = Math.floor(rows / 2);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        let x = padX + i * gx; const y = padY + j * gy; const above = j < midRow;
        if (above) x = padX + i * gx + bend(i, pos, gx, j, midRow);
        const isExtra = above && i === pos;
        atom(ctx, x, y, r, isExtra ? col.danger : col.primary, col.ink);
      }
      const tx = padX + pos * gx, ty = padY + midRow * gy;
      ctx.strokeStyle = col.danger; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(tx, ty - gy * 0.5); ctx.lineTo(tx, ty + gy * 0.2);
      ctx.moveTo(tx - gx * 0.28, ty + gy * 0.2); ctx.lineTo(tx + gx * 0.28, ty + gy * 0.2); ctx.stroke();
      ctx.fillStyle = col.danger; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
      ctx.fillText("位错线⊥", tx + gx * 0.32, ty);
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
  }

  const REG = { cubic: vizCubic, closepack: vizClosepack, diamond: vizDiamond, miller: vizMiller, edge: vizEdge };
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
