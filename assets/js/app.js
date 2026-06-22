/* ===================================================================
   半导体结构期末复习 · 核心脚本
   导航注入 / 倒计时 / 主题 / 进度存储 / 首页仪表盘
=================================================================== */
(function () {
  "use strict";

  // ---- 章节清单 ----
  const CHAPTERS = [
    { id: "index", file: "index.html", num: "首", short: "首页",   label: "学习首页",          nav: true },
    { id: "ch1",   file: "ch1.html",   num: "1",  short: "第一章", label: "晶体的特性",        nav: true },
    { id: "ch2",   file: "ch2.html",   num: "2",  short: "第二章", label: "晶体构造理论",      nav: true },
    { id: "ch3",   file: "ch3.html",   num: "3",  short: "第三章", label: "晶体的对称性",      nav: true },
    { id: "ch4",   file: "ch4.html",   num: "4",  short: "第四章", label: "晶向和晶面",        nav: true },
    { id: "ch5",   file: "ch5.html",   num: "5",  short: "第五章", label: "半导体材料结构",    nav: true },
    { id: "ch6",   file: "ch6.html",   num: "6",  short: "第六章", label: "点缺陷",            nav: true },
    { id: "ch7",   file: "ch7.html",   num: "7",  short: "第七章", label: "线缺陷（位错）",    nav: true },
    { id: "ch8",   file: "ch8.html",   num: "8",  short: "第八章", label: "面缺陷",            nav: true },
    { id: "cram",  file: "cram.html",  num: "💊", short: "速记",   label: "人话速记·只记不懂", nav: true },
    { id: "solve", file: "solve.html", num: "🆘", short: "套路",   label: "计算题套路速成",    nav: true },
    { id: "sprint",file: "sprint.html",num: "★",  short: "冲刺",   label: "考前冲刺·速查",     nav: true },
  ];

  // 考试时间：2026年6月24日 15:30
  const EXAM = new Date(2026, 5, 24, 15, 30, 0);

  const Store = {
    key: "semi_review_progress_v1", _data: null,
    load() { if (this._data) return this._data; try { this._data = JSON.parse(localStorage.getItem(this.key)) || {}; } catch (e) { this._data = {}; } return this._data; },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this._data)); } catch (e) {} },
    chapter(id) { const d = this.load(); if (!d[id]) d[id] = { results: {}, total: 0 }; return d[id]; },
    setTotal(id, n) { this.chapter(id).total = n; this.save(); },
    setResult(id, qid, ok) { this.chapter(id).results[qid] = ok ? 1 : 0; this.save(); },
    getResult(id, qid) { return this.chapter(id).results[qid]; },
    stats(id) { const c = this.chapter(id); const answered = Object.keys(c.results).length;
      const correct = Object.values(c.results).filter(v => v === 1).length; return { answered, correct, total: c.total || 0 }; },
    resetChapter(id) { const d = this.load(); d[id] = { results: {}, total: this.chapter(id).total }; this.save(); },
  };

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function countdownText() {
    const now = new Date();
    let ms = EXAM - now;
    if (ms <= 0) return { text: "考试加油！", urgent: true };
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d >= 1) return { text: `距期末考试 ${d} 天 ${h} 小时`, urgent: d <= 3 };
    return { text: `距考试仅剩 ${h}:${pad(m)}`, urgent: true };
  }

  function initTheme() {
    const saved = localStorage.getItem("semi_theme");
    const theme = saved || "light";
    document.documentElement.setAttribute("data-theme", theme);
    return theme;
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("semi_theme", next);
    const btn = document.querySelector(".theme-toggle");
    if (btn) btn.textContent = next === "dark" ? "☀️" : "🌙";
  }

  function buildSidebar(currentId) {
    const sb = el("aside", "sidebar");
    sb.innerHTML = `
      <div class="sidebar-brand">
        <div class="brand-logo">◈</div>
        <div class="brand-text"><b>半导体结构 · 期末通关</b><span>晶体学 / 半导体材料 / 缺陷</span></div>
      </div>`;
    const nav = el("nav", "nav");
    nav.appendChild(el("div", "nav-section-label", "导航"));
    CHAPTERS.forEach(c => {
      const a = el("a", c.id === currentId ? "active" : "");
      a.href = c.file;
      let badge = "";
      if (c.id.startsWith("ch")) {
        const s = Store.stats(c.id);
        if (s.total > 0 && s.answered >= s.total) badge = `<span class="nav-badge">✓ ${s.correct}/${s.total}</span>`;
        else if (s.answered > 0) badge = `<span class="nav-badge partial">${s.answered}/${s.total||"?"}</span>`;
      }
      a.innerHTML = `<span class="nav-num">${c.num}</span><span class="nav-label">${c.short} · ${c.label}</span>${badge}`;
      nav.appendChild(a);
      if (c.id === "index") nav.appendChild(el("div", "nav-section-label", "分章复习"));
      if (c.id === "ch8") nav.appendChild(el("div", "nav-section-label", "急救三件套"));
    });
    sb.appendChild(nav);
    return sb;
  }

  function buildTopbar(currentId) {
    const cur = CHAPTERS.find(c => c.id === currentId) || CHAPTERS[0];
    const cd = countdownText();
    const tb = el("header", "topbar");
    tb.innerHTML = `
      <button class="menu-btn" aria-label="菜单">☰</button>
      <div class="crumb">${cur.id === "index" ? "<b>学习首页</b>" : `<b>${cur.short}</b> · ${cur.label}`}</div>
      <div class="countdown" title="期末考试倒计时"><span class="dot"></span><span class="cd-label">${cd.text}</span></div>
      <button class="theme-toggle" aria-label="切换主题">${document.documentElement.getAttribute("data-theme") === "dark" ? "☀️" : "🌙"}</button>`;
    return tb;
  }

  function mount() {
    const currentId = document.body.dataset.page || "index";
    initTheme();
    const contentSrc = document.querySelector("main.content") || document.querySelector("main");
    const layout = el("div", "layout");
    const sidebar = buildSidebar(currentId);
    const main = el("div", "main");
    const topbar = buildTopbar(currentId);
    main.appendChild(topbar);
    if (contentSrc) { contentSrc.parentNode.removeChild(contentSrc); main.appendChild(contentSrc); }
    const scrim = el("div", "scrim");
    layout.appendChild(sidebar); layout.appendChild(main);
    document.body.insertBefore(layout, document.body.firstChild);
    document.body.appendChild(scrim);
    topbar.querySelector(".theme-toggle").addEventListener("click", toggleTheme);
    const menuBtn = topbar.querySelector(".menu-btn");
    menuBtn.addEventListener("click", () => { sidebar.classList.toggle("open"); scrim.classList.toggle("show"); });
    scrim.addEventListener("click", () => { sidebar.classList.remove("open"); scrim.classList.remove("show"); });
    setInterval(() => { const lbl = topbar.querySelector(".cd-label"); if (lbl) lbl.textContent = countdownText().text; }, 30000);
    if (currentId === "index") renderDashboard();
    initTabs();
    document.querySelectorAll(".solution-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const sol = btn.nextElementSibling;
        const open = sol.classList.toggle("show");
        btn.textContent = open ? "收起解答 ▲" : "查看完整解答 ▼";
        if (open && window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([sol]);
      });
    });
  }

  function initTabs() {
    document.querySelectorAll(".tabs").forEach(tabs => {
      const btns = tabs.querySelectorAll("button");
      const panels = tabs.parentElement.querySelectorAll(".tab-panel");
      btns.forEach((b, i) => {
        b.addEventListener("click", () => {
          btns.forEach(x => x.classList.remove("active"));
          panels.forEach(x => x.classList.remove("active"));
          b.classList.add("active");
          if (panels[i]) panels[i].classList.add("active");
          location.hash = b.dataset.tab || "";
          if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([panels[i]]);
        });
      });
      const h = location.hash.replace("#", "");
      const idx = Array.from(btns).findIndex(b => b.dataset.tab === h);
      if (idx >= 0) btns[idx].click();
    });
  }

  function renderDashboard() {
    const hero = document.querySelector("#hero-meta");
    if (hero) {
      const now = new Date();
      const days = Math.max(0, Math.floor((EXAM - now) / 86400000));
      let totalDone = 0, totalCorrect = 0;
      CHAPTERS.filter(c => c.id.startsWith("ch")).forEach(c => { const s = Store.stats(c.id); totalDone += s.answered; totalCorrect += s.correct; });
      hero.innerHTML = `
        <div><b>${days}</b><span>天后开考</span></div>
        <div><b>8</b><span>章核心考点</span></div>
        <div><b>${totalDone}</b><span>已练习题</span></div>
        <div><b>${totalDone ? Math.round(totalCorrect / totalDone * 100) : 0}%</b><span>正确率</span></div>`;
    }
    const grid = document.querySelector("#ch-grid");
    if (grid) {
      const meta = {
        ch1: { icon: "💎", desc: "晶体/非晶体 · 晶体四大性质 · 电负性 · 五种键型 · 混合键(石墨)" },
        ch2: { icon: "🧊", desc: "点阵/平移群 · 七大晶系 · 14种布拉菲格子 · 密堆积 · 配位多面体" },
        ch3: { icon: "❄️", desc: "7类对称要素 · 晶体学限制(1,2,3,4,6) · 32点群 · 230空间群 · 准晶" },
        ch4: { icon: "📐", desc: "原子坐标 · 晶面/晶向指数 · 倒易点阵 · 晶面间距 · 晶带定律" },
        ch5: { icon: "🔬", desc: "金刚石/闪锌矿/纤锌矿/NaCl型 · 解理/腐蚀/生长 · 固溶体 · 液晶" },
        ch6: { icon: "🕳️", desc: "克文符号 · 弗兰克/肖特基缺陷 · 施主/受主 · 化学计量比偏离" },
        ch7: { icon: "🧬", desc: "刃/螺/混合位错 · 柏氏矢量 · 滑移/攀移 · 应力场/应变能 · 增殖" },
        ch8: { icon: "🧱", desc: "堆垛层错 · 不全位错 · 扩展位错 · 小角晶界 · 孪晶 · 相界" },
      };
      grid.innerHTML = "";
      CHAPTERS.filter(c => c.id.startsWith("ch")).forEach(c => {
        const s = Store.stats(c.id);
        const pct = s.total ? Math.round(s.answered / s.total * 100) : 0;
        const m = meta[c.id] || { icon: c.num, desc: "" };
        const a = el("a", "ch-card");
        a.href = c.file;
        a.innerHTML = `
          <div class="ch-top">
            <div class="ch-icon">${m.icon}</div>
            <div><h3>${c.short} · ${c.label}</h3><div class="ch-sub">点击进入 · 讲解 / 例题 / 自测</div></div>
          </div>
          <div class="ch-desc">${m.desc}</div>
          <div class="ch-foot">
            <div class="progress-bar"><i style="width:${pct}%"></i></div>
            <span>${s.total ? `${s.answered}/${s.total}` : "未开始"}</span>
          </div>`;
        grid.appendChild(a);
      });
    }
  }

  window.QMStore = Store;
  window.QMToast = function (msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = el("div", "toast"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 1800);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
