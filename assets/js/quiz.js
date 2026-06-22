/* ===================================================================
   半导体结构期末复习 · 自测引擎
   读取 .quiz-item DOM 结构，单选/多选/判断，即时判分 + 解析 + 进度
=================================================================== */
(function () {
  "use strict";

  const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const TYPE_LABEL = { single: "单选", multiple: "多选", judge: "判断" };

  const Picks = {
    key: "semi_review_picks_v1", _d: null,
    load() { if (this._d) return this._d; try { this._d = JSON.parse(localStorage.getItem(this.key)) || {}; } catch (e) { this._d = {}; } return this._d; },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this._d)); } catch (e) {} },
    set(k, arr) { this.load()[k] = arr; this.save(); },
    get(k) { return this.load()[k]; },
  };

  function arrEq(a, b) {
    if (a.length !== b.length) return false;
    const s = new Set(a);
    return b.every(x => s.has(x));
  }

  function enhanceQuiz(quiz) {
    const chId = quiz.dataset.chapter || "misc";
    const items = Array.from(quiz.querySelectorAll(".quiz-item"));
    QMStore.setTotal(chId, items.length);

    const toolbar = document.createElement("div");
    toolbar.className = "quiz-toolbar";
    toolbar.innerHTML = `
      <div class="qstat">已答 <b class="t-ans">0</b> / ${items.length} 题　正确率 <b class="t-acc">—</b></div>
      <div class="spacer"></div>
      <button class="btn ghost t-filter">只看错题</button>
      <button class="btn t-reset">重做本章</button>`;
    quiz.insertBefore(toolbar, quiz.firstChild);

    const tAns = toolbar.querySelector(".t-ans");
    const tAcc = toolbar.querySelector(".t-acc");
    const filterBtn = toolbar.querySelector(".t-filter");
    const resetBtn = toolbar.querySelector(".t-reset");

    function refreshStat() {
      const s = QMStore.stats(chId);
      tAns.textContent = s.answered;
      tAcc.textContent = s.answered ? Math.round(s.correct / s.answered * 100) + "%" : "—";
    }

    items.forEach((item, idx) => {
      const type = item.dataset.type || "single";
      const qid = "q" + (idx + 1);
      const options = Array.from(item.querySelectorAll(".q-options > li"));
      const correctIdx = options.map((o, i) => o.hasAttribute("data-correct") ? i : -1).filter(i => i >= 0);

      const meta = document.createElement("div");
      meta.className = "q-meta";
      meta.innerHTML = `<span class="q-index">第 ${idx + 1} 题</span>
        <span class="q-type ${type}">${TYPE_LABEL[type] || "单选"}</span>
        <span class="q-done"></span>`;
      item.insertBefore(meta, item.firstChild);

      options.forEach((li, i) => {
        const txt = li.innerHTML;
        li.innerHTML = `<span class="opt-key">${LETTERS[i]}</span><span class="opt-text">${txt}</span>`;
        li.dataset.i = i;
      });

      const actions = document.createElement("div");
      actions.className = "q-actions";
      if (type === "multiple") {
        actions.innerHTML = `<button class="btn primary q-submit">提交答案</button><span class="q-hint" style="font-size:13px;color:var(--text-faint)">可多选，选完点提交</span>`;
      }
      const explain = item.querySelector(".q-explain");
      if (explain) {
        const lbl = document.createElement("span");
        lbl.className = "lbl"; lbl.textContent = "解析：";
        explain.insertBefore(lbl, explain.firstChild);
        item.insertBefore(actions, explain);
      } else {
        item.appendChild(actions);
      }

      let selected = new Set();

      function judge() {
        const sel = Array.from(selected);
        const ok = arrEq(sel, correctIdx);
        item.classList.add("answered", ok ? "correct" : "wrong");
        const doneEl = meta.querySelector(".q-done");
        doneEl.textContent = ok ? "✓ 答对" : "✕ 答错";
        options.forEach((li, i) => {
          if (correctIdx.includes(i)) li.classList.add("is-correct");
          if (selected.has(i) && !correctIdx.includes(i)) li.classList.add("is-wrong");
          const mark = correctIdx.includes(i) ? "✓" : (selected.has(i) ? "✕" : "");
          if (mark) { const m = document.createElement("span"); m.className = "mark"; m.textContent = mark; li.appendChild(m); }
        });
        const sb = actions.querySelector(".q-submit"); if (sb) sb.disabled = true, sb.style.display = "none";
        const hint = actions.querySelector(".q-hint"); if (hint) hint.style.display = "none";
        QMStore.setResult(chId, qid, ok);
        Picks.set(chId + ":" + qid, sel);
        refreshStat();
        if (window.MathJax && MathJax.typesetPromise && explain) MathJax.typesetPromise([explain]);
      }

      function restore(sel) {
        selected = new Set(sel);
        judge();
      }

      options.forEach((li, i) => {
        li.addEventListener("click", () => {
          if (item.classList.contains("answered")) return;
          if (type === "multiple") {
            if (selected.has(i)) { selected.delete(i); li.classList.remove("selected"); }
            else { selected.add(i); li.classList.add("selected"); }
          } else {
            selected = new Set([i]);
            options.forEach(o => o.classList.remove("selected"));
            li.classList.add("selected");
            judge();
          }
        });
      });
      const submitBtn = actions.querySelector(".q-submit");
      if (submitBtn) submitBtn.addEventListener("click", () => {
        if (selected.size === 0) { QMToast("请至少选择一项"); return; }
        judge();
      });

      const prev = Picks.get(chId + ":" + qid);
      if (prev && Array.isArray(prev)) restore(prev);
    });

    resetBtn.addEventListener("click", () => {
      if (!confirm("确定清空本章自测记录、重新作答？")) return;
      QMStore.resetChapter(chId);
      items.forEach((item, idx) => { delete Picks.load()[chId + ":q" + (idx + 1)]; });
      Picks.save();
      location.reload();
    });

    let filtered = false;
    filterBtn.addEventListener("click", () => {
      filtered = !filtered;
      filterBtn.classList.toggle("active", filtered);
      filterBtn.textContent = filtered ? "显示全部" : "只看错题";
      items.forEach(item => {
        const wrong = item.classList.contains("wrong");
        item.classList.toggle("hidden", filtered && !wrong);
      });
      if (filtered && !items.some(i => i.classList.contains("wrong"))) QMToast("太棒了，本章没有错题！");
    });

    refreshStat();
  }

  function init() {
    document.querySelectorAll(".quiz").forEach(enhanceQuiz);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
