/* ===================================================================
   半导体结构 · 交互可视化（纯 Canvas，无依赖）
   <div data-viz="cubic|closepack|miller|edge"></div>
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
    return { cv, resize };
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
    const g = ctx.createRadialGradient(x - r * .35, y - r * .35, r * .15, x, y, r);
    g.addColorStop(0, "#fff"); g.addColorStop(.25, fill); g.addColorStop(1, fill);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
  }

  // ---------- 1. 立方晶胞：简单/体心/面心 + 原子数 ----------
  function vizCubic(host) {
    const { cv, resize } = makeCanvas(host, 320);
    let mode = 0; // 0 P, 1 I, 2 F
    btnRow(host, ["简单立方 P", "体心立方 I", "面心立方 F"], i => { mode = i; draw(); });
    const cap = document.createElement("p");
    cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;";
    host.appendChild(cap);

    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2 + 8, L = Math.min(w, h) * 0.42, ox = L * 0.42, oy = -L * 0.42;
      // 立方体 8 顶点：前面(0..3) 后面(4..7)
      const F = [[cx - L / 2, cy + L / 2], [cx + L / 2, cy + L / 2], [cx + L / 2, cy - L / 2], [cx - L / 2, cy - L / 2]];
      const B = F.map(p => [p[0] + ox, p[1] + oy]);
      // 棱
      ctx.strokeStyle = col.grid; ctx.lineWidth = 1.6;
      function edge(a, b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      for (let i = 0; i < 4; i++) { edge(F[i], F[(i + 1) % 4]); edge(B[i], B[(i + 1) % 4]); edge(F[i], B[i]); }
      const r = L * 0.11;
      // 体心
      if (mode === 1) { const m = [(F[0][0] + B[2][0]) / 2, (F[0][1] + B[2][1]) / 2]; atom(ctx, m[0], m[1], r, col.danger, col.ink); }
      // 面心（6 个面中心）
      if (mode === 2) {
        const faces = [[F[0], F[1], F[2], F[3]], [B[0], B[1], B[2], B[3]],
          [F[0], F[1], B[1], B[0]], [F[2], F[3], B[3], B[2]], [F[1], F[2], B[2], B[1]], [F[0], F[3], B[3], B[0]]];
        faces.forEach(q => { const mx = (q[0][0] + q[2][0]) / 2, my = (q[0][1] + q[2][1]) / 2; atom(ctx, mx, my, r, col.accent, col.ink); });
      }
      // 8 顶点（后画，压住棱）
      [...B, ...F].forEach(p => atom(ctx, p[0], p[1], r, col.primary, col.ink));
      // 文字
      const info = [
        { t: "简单立方 P：只有 8 个顶角原子", n: "8 × 1/8 = 1 个/晶胞" },
        { t: "体心立方 I：顶角 + 1 个体心原子", n: "8×1/8 + 1 = 2 个/晶胞" },
        { t: "面心立方 F：顶角 + 6 个面心原子", n: "8×1/8 + 6×1/2 = 4 个/晶胞" },
      ][mode];
      cap.innerHTML = `<b style="color:var(--primary)">${info.t}</b>　每个晶胞含原子数：<b>${info.n}</b>。顶角原子被 8 个晶胞共有(算 1/8)，面心被 2 个共有(算 1/2)，体心独占(算 1)。`;
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
  }

  // ---------- 2. 密堆积：ABAB(六方) vs ABCABC(立方) ----------
  function vizClosepack(host) {
    const { cv, resize } = makeCanvas(host, 300);
    let mode = 0; // 0 hcp ABAB, 1 ccp ABCABC
    btnRow(host, ["六方密堆 ABAB…", "立方密堆 ABCABC…"], i => { mode = i; draw(); });
    caption(host, "两种最紧密堆积方式：<b style='color:var(--primary)'>A</b>、<b style='color:var(--accent)'>B</b>、<b style='color:var(--danger)'>C</b> 是三种不同的横向位置。第三层落回 A 正上方→<b>六方密堆(hcp, ABAB)</b>；第三层错到新位置 C→<b>立方密堆(ccp=面心立方, ABCABC)</b>。两者空间利用率都是 <b>74.05%</b>。");

    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const r = 16, dx = r * 2.1, dy = r * 1.25;
      const cols = [col.primary, col.accent, col.danger];
      const seq = mode === 0 ? [0, 1, 0, 1] : [0, 1, 2, 0]; // A B A B  /  A B C A
      const names = mode === 0 ? ["A", "B", "A", "B"] : ["A", "B", "C", "A"];
      const offs = [0, dx * 0.5, dx * 1.0]; // A,B,C 横向错位
      const baseY = h - 38, x0 = w / 2 - dx * 2.5;
      for (let layer = 0; layer < 4; layer++) {
        const y = baseY - layer * dy * 1.5;
        const ox = offs[seq[layer]];
        ctx.globalAlpha = 0.45 + layer * 0.14;
        for (let i = 0; i < 6; i++) atom(ctx, x0 + ox + i * dx, y, r, cols[seq[layer]], col.ink);
        ctx.globalAlpha = 1;
        ctx.fillStyle = cols[seq[layer]]; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "left";
        ctx.fillText("第" + (layer + 1) + "层 = " + names[layer], x0 - 4 + 6 * dx, y + 5);
      }
      ctx.fillStyle = col.soft; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(mode === 0 ? "堆垛顺序 A B A B …（Frank 记号 △▽△▽）" : "堆垛顺序 A B C A B C …（Frank 记号 △△△△）", w / 2, 18);
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
  }

  // ---------- 3. 晶面指数（二维演示：截距→倒数→指数） ----------
  function vizMiller(host) {
    const { cv, resize } = makeCanvas(host, 320);
    let hh = 1, kk = 1;
    control(host, "指数 h", 0, 3, 1, 1, v => `h = ${v}`, v => { hh = v; draw(); });
    control(host, "指数 k", 0, 3, 1, 1, v => `k = ${v}`, v => { kk = v; draw(); });
    const cap = document.createElement("p");
    cap.style.cssText = "font-size:13.5px;color:var(--text-soft);margin:10px 0 0;"; host.appendChild(cap);
    caption(host, "二维演示晶面指数 (h k)：晶面在 a 轴截距 = 1/h、b 轴截距 = 1/k。<b>指数越大→截距越小→晶面越靠近原点、越密。</b>指数为 0 表示与该轴平行(截距 ∞)。三维 (h k l) 同理。");

    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const pad = 46, x0 = pad, y0 = h - pad, span = Math.min(w - pad * 2, h - pad * 2);
      const ux = span / 3, uy = span / 3; // 画 3×3 格
      // 点阵
      for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) {
        ctx.fillStyle = col.faint; ctx.beginPath(); ctx.arc(x0 + i * ux, y0 - j * uy, 3.2, 0, 7); ctx.fill();
      }
      // 轴
      ctx.strokeStyle = col.grid; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 3 * ux, y0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 - 3 * uy); ctx.stroke();
      ctx.fillStyle = col.soft; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("a →", x0 + 3 * ux - 8, y0 + 20); ctx.fillText("b ↑", x0 - 18, y0 - 3 * uy + 6);
      ctx.fillStyle = col.warn; ctx.beginPath(); ctx.arc(x0, y0, 5, 0, 7); ctx.fill();
      ctx.fillStyle = col.soft; ctx.fillText("O", x0 - 14, y0 + 16);
      // 截距
      const ix = hh === 0 ? Infinity : 1 / hh, iy = kk === 0 ? Infinity : 1 / kk;
      // 画一族平行晶面（在 0..3 范围内）
      ctx.strokeStyle = col.primary; ctx.lineWidth = 2.6;
      function lineFor(m) {
        // h*x + k*y = m  （x,y 以点阵常数为单位）
        const pts = [];
        if (kk !== 0) { const y = (m - hh * 0) / kk; if (y >= 0 && y <= 3) pts.push([0, y]); }
        if (kk !== 0) { const y = (m - hh * 3) / kk; if (y >= 0 && y <= 3) pts.push([3, y]); }
        if (hh !== 0) { const x = (m - kk * 0) / hh; if (x >= 0 && x <= 3) pts.push([x, 0]); }
        if (hh !== 0) { const x = (m - kk * 3) / hh; if (x >= 0 && x <= 3) pts.push([x, 3]); }
        if (pts.length >= 2) {
          ctx.beginPath(); ctx.moveTo(x0 + pts[0][0] * ux, y0 - pts[0][1] * uy);
          ctx.lineTo(x0 + pts[1][0] * ux, y0 - pts[1][1] * uy); ctx.stroke();
        }
      }
      if (hh === 0 && kk === 0) { /* 无意义 */ }
      else { for (let m = 1; m <= 3; m++) lineFor(m); }
      // 标注截距点
      ctx.fillStyle = col.danger;
      if (isFinite(ix) && ix <= 3) { ctx.beginPath(); ctx.arc(x0 + ix * ux, y0, 5, 0, 7); ctx.fill(); }
      if (isFinite(iy) && iy <= 3) { ctx.beginPath(); ctx.arc(x0, y0 - iy * uy, 5, 0, 7); ctx.fill(); }
      const fx = hh === 0 ? "∞" : (hh === 1 ? "1" : "1/" + hh);
      const fy = kk === 0 ? "∞" : (kk === 1 ? "1" : "1/" + kk);
      cap.innerHTML = (hh === 0 && kk === 0)
        ? "h、k 不能同时为 0。"
        : `晶面指数 <b style="color:var(--primary)">(${hh} ${kk})</b>：a 轴截距 = <b>${fx}</b>，b 轴截距 = <b>${fy}</b>。截距取倒数 → ${hh}, ${kk}，正好就是指数本身。`;
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
  }

  // ---------- 4. 刃型位错：多余半原子面 + 滑移 ----------
  function vizEdge(host) {
    const { cv, resize } = makeCanvas(host, 300);
    let pos = 4; // 位错所在列
    control(host, "滑移：位错位置", 1, 8, 1, 4, v => `第 ${v} 列`, v => { pos = v; draw(); });
    caption(host, "<b style='color:var(--danger)'>刃型位错</b>：上半部多插了<b>半个原子面</b>（红色），它的下端缘就是位错线（⊥）。在切应力下位错<b>逐列移动(滑移)</b>，每移到边缘就完成一个原子间距的滑移——这比整个面同时滑动省力得多。柏氏矢量 b ⊥ 位错线。");

    function draw() {
      const { ctx, w, h } = resize(); const col = C(); ctx.clearRect(0, 0, w, h);
      const cols = 9, rows = 6, padX = 36, padY = 30;
      const gx = (w - padX * 2) / (cols - 1), gy = (h - padY * 2) / (rows - 1), r = Math.min(gx, gy) * 0.16;
      const midRow = Math.floor(rows / 2);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          let x = padX + i * gx; const y = padY + j * gy;
          const above = j < midRow;
          // 上半部在位错列右侧整体“挤入”半列，制造多余半面效果
          if (above) {
            const shift = i >= pos ? -gx * 0.5 : 0;
            x = padX + i * gx + (i >= pos ? 0 : 0) + bend(i, pos, gx, j, midRow);
          } else {
            x = padX + i * gx;
          }
          const isExtra = above && i === pos;
          ctx.strokeStyle = col.grid; ctx.lineWidth = 1;
          atom(ctx, x, y, r, isExtra ? col.danger : col.primary, col.ink);
        }
      }
      // ⊥ 符号
      const tx = padX + pos * gx, ty = padY + midRow * gy;
      ctx.strokeStyle = col.danger; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(tx, ty - gy * 0.5); ctx.lineTo(tx, ty + gy * 0.2);
      ctx.moveTo(tx - gx * 0.28, ty + gy * 0.2); ctx.lineTo(tx + gx * 0.28, ty + gy * 0.2); ctx.stroke();
      ctx.fillStyle = col.danger; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
      ctx.fillText("位错线⊥", tx + gx * 0.32, ty);
    }
    function bend(i, pos, gx, j, midRow) {
      // 轻微弯曲，让多余半面上方原子向中心聚拢，视觉上呈“插入”
      const d = i - pos; const w = (midRow - j) / midRow; // 越靠上越明显
      return -Math.sign(d) * Math.min(Math.abs(d), 2) * gx * 0.06 * w * (Math.abs(d) <= 3 ? 1 : 0);
    }
    draw(); window.addEventListener("resize", draw); host._redraw = draw;
  }

  const REG = { cubic: vizCubic, closepack: vizClosepack, miller: vizMiller, edge: vizEdge };
  function init() {
    document.querySelectorAll("[data-viz]").forEach(host => {
      const fn = REG[host.dataset.viz];
      if (fn) { const card = document.createElement("div"); card.className = "card"; host.appendChild(card); fn(card); }
    });
    const obs = new MutationObserver(() => {
      document.querySelectorAll("[data-viz] .card").forEach(c => { if (c._redraw) c._redraw(); });
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
