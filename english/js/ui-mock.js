(function () {
  "use strict";

  const viewState = {
    sub: "exam",            // "exam" | "errors"
    prioritizeWeak: true,
    includeCloze: true,
    includeC2E: true,
    includeE2C: true,
    includeSummary: true,
    paper: null,            // current generated mock exam
    answers: {
      cloze: {},
      c2e: {},
      e2c: {},
      summary: ""
    },
    submitted: false,
    selfMarks: {},          // itemId -> boolean
    elapsedSec: 0,
    timerId: null
  };

  function setOptions(opts) {
    if (!opts) return;
    if (opts.sub) viewState.sub = opts.sub;
  }

  function pickWeighted(arr, weightFn) {
    if (!arr.length) return null;
    if (!viewState.prioritizeWeak) {
      return arr[Math.floor(Math.random() * arr.length)];
    }
    const total = arr.reduce((acc, item) => acc + Math.max(1, weightFn(item)), 0);
    let r = Math.random() * total;
    for (const item of arr) {
      r -= Math.max(1, weightFn(item));
      if (r <= 0) return item;
    }
    return arr[arr.length - 1];
  }

  function generatePaper() {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;

    // 1. Cloze: 1 of 5 Text A
    const clozeUnit = pickWeighted(D.cloze, (u) => {
      return u.clozeSimulation.questions.reduce((acc, q) => acc + S.getPriorityWeight(q.id), 0);
    });

    // 2. C2E: 1 sentence from EACH of the 5 units
    const c2eItems = D.c2e.map((u) => {
      return pickWeighted(u.sentences, (s) => S.getPriorityWeight(s.id));
    });

    // 3. E2C: 2 passages — 1 Text A overlap (Q1) + 1 after-class Q2 from a different unit
    const q1Pool = D.e2c.map((u) => u.passages[0]);
    const e2c1 = pickWeighted(q1Pool, (p) => S.getPriorityWeight(p.id));
    const q2Pool = D.e2c.filter((u) => u.unit !== e2c1.unit).map((u) => u.passages[1]);
    const e2c2 = pickWeighted(q2Pool, (p) => S.getPriorityWeight(p.id));

    // 4. Summary: 1 of 16
    const summaryArticle = pickWeighted(D.summary16, (a) => {
      const r = S.getSummary(a.id);
      if (r.inErrorBook) return 100;
      if (!r.openingMastered) return 70;
      if (!r.fullMastered) return 40;
      return 12;
    });

    viewState.paper = {
      generatedAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      clozeUnit,
      c2eItems,
      e2cItems: [e2c1, e2c2],
      summaryArticle
    };
    viewState.answers = { cloze: {}, c2e: {}, e2c: {}, summary: "" };
    viewState.submitted = false;
    viewState.selfMarks = {};
    viewState.elapsedSec = 0;
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function startTimer() {
    if (viewState.timerId) clearInterval(viewState.timerId);
    viewState.timerId = setInterval(() => {
      if (viewState.submitted) return;
      viewState.elapsedSec++;
      const el = document.getElementById("mock-timer");
      if (el) el.textContent = formatDuration(viewState.elapsedSec);
    }, 1000);
  }

  function renderErrorBook() {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const esc = S.esc;

    // Collect all error items
    const c2eErrs = [];
    D.c2e.forEach((u) => u.sentences.forEach((s) => {
      const r = S.getItem(s.id);
      if (r.inErrorBook) c2eErrs.push({ ...s, rec: r });
    }));

    const e2cErrs = [];
    D.e2c.forEach((u) => u.passages.forEach((p) => {
      const pr = S.getItem(p.id);
      if (pr.inErrorBook) e2cErrs.push({ type: "passage", unit: u.unit, id: p.id, title: `Unit ${u.unit} 原题 ${p.questionIndex}`, text: p.englishParagraphs[0], rec: pr });
      p.sentences.forEach((s) => {
        const sr = S.getItem(s.id);
        if (sr.inErrorBook) e2cErrs.push({ type: "sentence", unit: u.unit, id: s.id, title: `Unit ${u.unit} 原题 ${p.questionIndex} 第 ${s.sentenceIndex} 句`, text: s.en, rec: sr });
      });
    }));

    const clozeErrs = window.PrepClozeUI.getAllQuestions().filter((q) => S.getItem(q.id).inErrorBook);
    const sumErrs = D.summary16.filter((a) => S.getSummary(a.id).inErrorBook);
    const total = c2eErrs.length + e2cErrs.length + clozeErrs.length + sumErrs.length;

    return `
      <div class="callout ${total > 0 ? "callout-warn" : "callout-official"} mb-2">
        <strong>错题与薄弱项回收中心：</strong>当前共 <strong>${total}</strong> 项待巩固内容。连续答对 2 次将自动移出错题本，也可在此直接跳转复练或手动移出。
      </div>

      ${total === 0 ? `
        <div class="card">
          <h3>当前错题本已清零！</h3>
          <p class="muted-text">所有做错或标记的题目都已巩固通过。建议开启一套全真随机模拟卷检验考场状态。</p>
          <button type="button" class="btn btn-primary mt-1" id="btn-back-to-mock">进入全真模拟卷 →</button>
        </div>
      ` : `
        <div class="grid-2">
          <div class="card">
            <div class="btn-row" style="justify-content:space-between;">
              <h3>中译英错句 (${c2eErrs.length})</h3>
              ${c2eErrs.length ? `<button type="button" class="btn btn-sm btn-primary" data-goto-err-tab="translation" data-sub="c2e">进入错题专练</button>` : ""}
            </div>
            ${c2eErrs.length === 0 ? `<p class="muted-text mt-1">暂无错句</p>` : `
              <ul class="compact-list mt-1">
                ${c2eErrs.map((x) => `
                  <li class="mb-1">
                    <strong>Unit ${x.unit} 第 ${x.sentenceIndex} 句：</strong>${esc(x.zh)}
                    <div class="btn-row mt-1">
                      <button type="button" class="btn btn-sm btn-outline" data-goto-err-tab="translation" data-sub="c2e" data-target="${x.id}">去默写</button>
                      <button type="button" class="btn btn-sm btn-outline" data-clear-item-err="${x.id}">移出错题本</button>
                    </div>
                  </li>
                `).join("")}
              </ul>
            `}
          </div>

          <div class="card">
            <div class="btn-row" style="justify-content:space-between;">
              <h3>英译中待巩固 (${e2cErrs.length})</h3>
              ${e2cErrs.length ? `<button type="button" class="btn btn-sm btn-primary" data-goto-err-tab="translation" data-sub="e2c">进入错题专练</button>` : ""}
            </div>
            ${e2cErrs.length === 0 ? `<p class="muted-text mt-1">暂无错项</p>` : `
              <ul class="compact-list mt-1">
                ${e2cErrs.map((x) => `
                  <li class="mb-1">
                    <strong>${esc(x.title)}：</strong><span lang="en">${esc(x.text.slice(0, 90))}...</span>
                    <div class="btn-row mt-1">
                      <button type="button" class="btn btn-sm btn-outline" data-goto-err-tab="translation" data-sub="e2c" data-target="${x.id}">去重译</button>
                      <button type="button" class="btn btn-sm btn-outline" data-clear-item-err="${x.id}">移出错题本</button>
                    </div>
                  </li>
                `).join("")}
              </ul>
            `}
          </div>

          <div class="card">
            <div class="btn-row" style="justify-content:space-between;">
              <h3>完形填空错题 (${clozeErrs.length})</h3>
              ${clozeErrs.length ? `<button type="button" class="btn btn-sm btn-primary" data-goto-err-tab="cloze" data-unit="errors">错题集中复练</button>` : ""}
            </div>
            ${clozeErrs.length === 0 ? `<p class="muted-text mt-1">暂无完形错题</p>` : `
              <ul class="compact-list mt-1">
                ${clozeErrs.map((q) => `
                  <li class="mb-1">
                    <strong>Unit ${q.unit} 第 [${q.paraNum}] 段 (${esc(q.pointType)})：</strong>正确答案 <strong lang="en">${esc(q.correctWord)}</strong>
                    <button type="button" class="btn btn-sm btn-outline" style="margin-inline-start:0.4rem;" data-clear-item-err="${q.id}">移出</button>
                  </li>
                `).join("")}
              </ul>
            `}
          </div>

          <div class="card">
            <div class="btn-row" style="justify-content:space-between;">
              <h3>Summary 待巩固篇目 (${sumErrs.length})</h3>
            </div>
            ${sumErrs.length === 0 ? `<p class="muted-text mt-1">暂无 Summary 待巩固篇目</p>` : `
              <ul class="compact-list mt-1">
                ${sumErrs.map((a) => `
                  <li class="mb-1">
                    <strong>Ch ${a.chapter} ${a.part} · <span lang="en">${esc(a.title)}</span></strong>
                    <div class="btn-row mt-1">
                      <button type="button" class="btn btn-sm btn-outline" data-goto-sum="${a.id}">去限长重练</button>
                      <button type="button" class="btn btn-sm btn-outline" data-clear-sum-err="${a.id}">移出</button>
                    </div>
                  </li>
                `).join("")}
              </ul>
            `}
          </div>
        </div>
      `}
    `;
  }

  function renderMockExam() {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const esc = S.esc;
    if (!viewState.paper) generatePaper();
    const p = viewState.paper;

    const clozeQs = p.clozeUnit.clozeSimulation.questions;
    const clozeCorrect = clozeQs.filter((q) => viewState.answers.cloze[q.id] === q.answer).length;
    const sumDiag = window.PrepSummaryUI.analyzeDraft(p.summaryArticle, viewState.answers.summary);

    return `
      <div class="callout callout-warn mb-2">
        <strong>真实规则 vs 模拟参数严格声明：</strong>
        <ul class="compact-list">
          <li><strong>教师已确认规则：</strong>课内完形 10 分（5 篇 Text A 选 1 篇）；中译英每单元抽 1 句共 5 句；英译中 2 段（1 段出自 Text A 原文，1 段出自课后练习）；Summary 20 分（16 篇 B/C 选 1 篇）。</li>
          <li><strong>未确认与模拟参数：</strong>翻译板块总分尚未由老师正式公布（不擅自设分值）；完形题型因原教材未带正式完形题，使用「AI 模拟 10 空格式」；组卷时勾选“优先错题/未掌握”为辅助复习策略。</li>
        </ul>
      </div>

      <div class="card">
        <div class="btn-row" style="justify-content:space-between;">
          <div class="btn-row">
            <strong>本卷生成时间：${esc(p.generatedAt)}</strong>
            <span class="sprint-timer" id="mock-timer">${formatDuration(viewState.elapsedSec)}</span>
          </div>
          <div class="btn-row">
            <label class="check-item"><input type="checkbox" id="chk-mock-weak" ${viewState.prioritizeWeak ? "checked" : ""}> 优先抽错题/未练</label>
            <button type="button" class="btn btn-outline" id="btn-regenerate-mock">🎲 重新随机组卷</button>
            <button type="button" class="btn btn-primary" id="btn-submit-mock">${viewState.submitted ? "再练一卷（重置）" : "交卷并全面核对"}</button>
          </div>
        </div>
        <div class="btn-row mt-1">
          <label class="check-item"><input type="checkbox" id="chk-inc-cloze" ${viewState.includeCloze ? "checked" : ""}> 1. 课内完形 (10分·AI模拟)</label>
          <label class="check-item"><input type="checkbox" id="chk-inc-c2e" ${viewState.includeC2E ? "checked" : ""}> 2. 中译英 5句 (分值待确认)</label>
          <label class="check-item"><input type="checkbox" id="chk-inc-e2c" ${viewState.includeE2C ? "checked" : ""}> 3. 英译中 2段 (分值待确认)</label>
          <label class="check-item"><input type="checkbox" id="chk-inc-sum" ${viewState.includeSummary ? "checked" : ""}> 4. Summary 写作 (20分)</label>
        </div>
      </div>

      ${viewState.includeCloze ? `
        <section class="card">
          <div class="btn-row" style="justify-content:space-between;">
            <h3>第一部分：课内完形填空（10 分 · 抽中 Unit ${p.clozeUnit.unit}）</h3>
            <span class="badge badge-ai">AI 模拟题（10 空格式）${viewState.submitted ? ` · 得分 ${clozeCorrect}/10` : ""}</span>
          </div>
          <div class="en-prose mt-1" lang="en">
            ${p.clozeUnit.clozeSimulation.paragraphs.map((para) => `
              <p class="mb-1"><strong>[${para.paraNum}]</strong> ${esc(para.maskedText).replace(/\{\{(\d+)\}\}/g, (_, n) => {
                const q = clozeQs.find((x) => x.num === Number(n));
                const pick = viewState.answers.cloze[q.id];
                return `<span class="cloze-blank-token ${viewState.submitted ? (pick === q.answer ? "is-correct" : "is-wrong") : ""}">(${n}) ${pick ? esc(q.options[pick]) : "____"}</span>`;
              })}</p>
            `).join("")}
          </div>
          <div class="grid-2 mt-2">
            ${clozeQs.map((q) => {
              const pick = viewState.answers.cloze[q.id];
              return `
                <div class="masked-panel" style="background:var(--bg-surface);border-style:solid;margin-block:0;">
                  <div class="btn-row" style="justify-content:space-between;">
                    <strong>第 ${q.num} 空</strong>
                    <span class="badge badge-neutral">${esc(q.pointType)}</span>
                  </div>
                  <div class="option-grid">
                    ${["A", "B", "C", "D"].map((l) => {
                      let cls = "option-btn";
                      if (viewState.submitted) {
                        if (l === q.answer) cls += " is-correct";
                        else if (pick === l) cls += " is-wrong";
                      } else if (pick === l) cls += " is-selected";
                      return `<button type="button" class="${cls}" data-mock-cloze="${q.id}" data-letter="${l}">${l}. ${esc(q.options[l])}</button>`;
                    }).join("")}
                  </div>
                  ${viewState.submitted ? `<p class="muted-text mt-1"><strong>解析：</strong>答案 ${q.answer} (${esc(q.correctWord)}) — ${esc(q.contextClue)}</p>` : ""}
                </div>
              `;
            }).join("")}
          </div>
        </section>
      ` : ""}

      ${viewState.includeC2E ? `
        <section class="card">
          <div class="btn-row" style="justify-content:space-between;">
            <h3>第二部分：中译英（每单元随机 1 句，共 5 句 · 分值待确认）</h3>
            <span class="badge badge-official">教材与教师官方标准答案</span>
          </div>
          ${p.c2eItems.map((s) => {
            const draft = viewState.answers.c2e[s.id] || "";
            const selfMark = viewState.selfMarks[s.id];
            return `
              <div class="masked-panel" style="background:var(--bg-surface);border-style:solid;">
                <p><strong>Unit ${s.unit}（第 ${s.sentenceIndex} 句）：</strong>${esc(s.zh)}</p>
                <label for="mock-c2e-${s.id}" class="visually-hidden">Unit ${s.unit} 英文作答</label>
                <textarea id="mock-c2e-${s.id}" rows="2" lang="en" data-mock-c2e="${s.id}" placeholder="输入英文译文...">${esc(draft)}</textarea>
                ${viewState.submitted ? `
                  <div class="revealed-official mt-1">
                    <span class="badge badge-official">官方标准译文（只读）</span>
                    <p class="en-prose mt-1" lang="en">${esc(s.officialEn)}</p>
                    <div class="btn-row mt-1">
                      <button type="button" class="btn btn-sm ${selfMark === true ? "btn-primary" : "btn-outline"}" data-self-mark="${s.id}" data-val="1">自评准确 ✓</button>
                      <button type="button" class="btn btn-sm ${selfMark === false ? "btn-danger" : "btn-danger-outline"}" data-self-mark="${s.id}" data-val="0">标错入错题本 ✗</button>
                    </div>
                  </div>
                ` : ""}
              </div>
            `;
          }).join("")}
        </section>
      ` : ""}

      ${viewState.includeE2C ? `
        <section class="card">
          <div class="btn-row" style="justify-content:space-between;">
            <h3>第三部分：英译中（2 段：1 段 Text A 原段 + 1 段课后段 · 分值待确认）</h3>
            <span class="badge badge-official">老师提供官方中文译文</span>
          </div>
          ${p.e2cItems.map((ep, idx) => {
            const draft = viewState.answers.e2c[ep.id] || "";
            const selfMark = viewState.selfMarks[ep.id];
            return `
              <div class="masked-panel" style="background:var(--bg-surface);border-style:solid;">
                <div class="btn-row" style="justify-content:space-between;">
                  <strong>第 ${idx + 1} 段 · Unit ${ep.unit} 原题 ${ep.questionIndex}</strong>
                  <span class="badge ${ep.isTextAOverlap ? "badge-official" : "badge-neutral"}">${ep.isTextAOverlap ? `Text A 第 ${ep.textAPara} 段同源` : "课后拓展段落"}</span>
                </div>
                ${ep.diffNote && ep.unit === 3 && ep.questionIndex === 1 ? `<div class="callout callout-danger mt-1">${esc(ep.diffNote)}</div>` : ""}
                <p class="en-prose mt-1" lang="en">${esc(ep.englishPrompt)}</p>
                <label for="mock-e2c-${ep.id}" class="visually-hidden">第 ${idx + 1} 段中文作答</label>
                <textarea id="mock-e2c-${ep.id}" rows="3" data-mock-e2c="${ep.id}" placeholder="输入中文译文...">${esc(draft)}</textarea>
                ${viewState.submitted ? `
                  <div class="revealed-official mt-1">
                    <span class="badge badge-official">官方参考译文（只读）</span>
                    <p class="mt-1">${esc(ep.officialChinese)}</p>
                    <div class="btn-row mt-1">
                      <button type="button" class="btn btn-sm ${selfMark === true ? "btn-primary" : "btn-outline"}" data-self-mark="${ep.id}" data-val="1">自评准确 ✓</button>
                      <button type="button" class="btn btn-sm ${selfMark === false ? "btn-danger" : "btn-danger-outline"}" data-self-mark="${ep.id}" data-val="0">标错入错题本 ✗</button>
                    </div>
                  </div>
                ` : ""}
              </div>
            `;
          }).join("")}
        </section>
      ` : ""}

      ${viewState.includeSummary ? `
        <section class="card">
          <div class="btn-row" style="justify-content:space-between;">
            <h3>第四部分：Summary 概述写作（20 分 · 随机 16 选 1）</h3>
            <button type="button" class="btn btn-sm btn-outline" data-open-summary-src="${p.summaryArticle.id}">阅读原文（${p.summaryArticle.paragraphCount} 段）</button>
          </div>
          <p class="mt-1"><strong>抽中篇目：</strong>Ch ${p.summaryArticle.chapter} ${p.summaryArticle.part} · <span lang="en"><strong>${esc(p.summaryArticle.title)}</strong></span> · 作者：<span lang="en"><strong>${esc(p.summaryArticle.author)}</strong></span></p>
          ${p.summaryArticle.metadataNote ? `<div class="callout callout-warn mt-1">${esc(p.summaryArticle.metadataNote)}</div>` : ""}
          <label for="mock-summary-ta" class="mt-1">写出符合教师五关要求的 Summary（建议先看上方原文）：</label>
          <textarea id="mock-summary-ta" rows="7" lang="en" placeholder='In "${esc(p.summaryArticle.title)}," ${esc(p.summaryArticle.author)} argues that ...'>${esc(viewState.answers.summary)}</textarea>
          <div class="word-meter ${sumDiag.lengthLevel}" id="mock-sum-meter">
            <strong>实时词数：<span id="mock-sum-wc">${sumDiag.wc}</span> 词</strong>
            <span id="mock-sum-note">${esc(sumDiag.lengthNote)}</span>
          </div>
          ${viewState.submitted ? `
            <div class="revealed-ai mt-2">
              <div class="btn-row" style="justify-content:space-between;">
                <span class="badge badge-ai">${esc(p.summaryArticle.aiSummaryLabel)}（${p.summaryArticle.wordCount} 词）</span>
                <button type="button" class="btn btn-sm btn-outline" data-goto-sum="${p.summaryArticle.id}">去卡片深度复盘 →</button>
              </div>
              <div class="en-prose mt-1" lang="en" style="white-space:pre-line;">${esc(p.summaryArticle.aiReferenceSummary)}</div>
            </div>
          ` : ""}
        </section>
      ` : ""}

      ${S.getState().mockHistory.length > 0 ? `
        <section class="card">
          <h3>最近模拟考记录</h3>
          <ul class="compact-list">
            ${S.getState().mockHistory.slice(0, 5).map((h) => `
              <li>${new Date(h.createdAt).toLocaleString("zh-CN")} · 用时 ${formatDuration(h.elapsedSec)} · 完形 ${esc(h.clozeScore)} · Summary ${h.summaryWords} 词（Ch ${h.summaryId}）</li>
            `).join("")}
          </ul>
        </section>
      ` : ""}
    `;
  }

  function render() {
    const S = window.PrepStore;
    const panel = document.getElementById("panel-mock");

    panel.innerHTML = `
      <h2 id="tab-heading-mock">模块 D：全真模拟考试与错题本中心</h2>
      <div class="sub-toolbar">
        <div class="pill-group" role="group" aria-label="模拟与错题切换">
          <button type="button" class="pill-btn ${viewState.sub === "exam" ? "is-active" : ""}" data-mock-tab="exam">全真随机模拟卷</button>
          <button type="button" class="pill-btn ${viewState.sub === "errors" ? "is-active" : ""}" data-mock-tab="errors">全局错题本 (${S.getErrorCount()})</button>
        </div>
      </div>
      ${viewState.sub === "exam" ? renderMockExam() : renderErrorBook()}
    `;

    panel.querySelectorAll("[data-mock-tab]").forEach((b) => {
      b.addEventListener("click", () => {
        viewState.sub = b.dataset.mockTab;
        render();
      });
    });

    if (viewState.sub === "exam") {
      startTimer();

      const bindChk = (id, key, regen) => {
        const el = panel.querySelector(id);
        if (el) el.addEventListener("change", () => {
          viewState[key] = el.checked;
          if (regen) generatePaper();
          render();
        });
      };
      bindChk("#chk-mock-weak", "prioritizeWeak", false);
      bindChk("#chk-inc-cloze", "includeCloze", false);
      bindChk("#chk-inc-c2e", "includeC2E", false);
      bindChk("#chk-inc-e2c", "includeE2C", false);
      bindChk("#chk-inc-sum", "includeSummary", false);

      panel.querySelector("#btn-regenerate-mock").addEventListener("click", () => {
        generatePaper();
        S.announce("已按考试结构重新随机组卷");
        render();
      });

      panel.querySelector("#btn-submit-mock").addEventListener("click", () => {
        if (viewState.submitted) {
          generatePaper();
          render();
          return;
        }
        viewState.submitted = true;
        const p = viewState.paper;
        let clozeScore = "未启用";
        if (viewState.includeCloze) {
          let ok = 0;
          p.clozeUnit.clozeSimulation.questions.forEach((q) => {
            const isOk = viewState.answers.cloze[q.id] === q.answer;
            if (isOk) ok++;
            S.recordAttempt(q.id, isOk);
          });
          clozeScore = `${ok}/10`;
        }
        const sumWc = S.countWords(viewState.answers.summary);
        if (viewState.includeSummary && viewState.answers.summary.trim()) {
          S.updateSummary(p.summaryArticle.id, {
            lastDraft: viewState.answers.summary,
            lastWordCount: sumWc,
            attempts: S.getSummary(p.summaryArticle.id).attempts + 1
          });
        }
        S.addMockHistory({
          elapsedSec: viewState.elapsedSec,
          clozeScore,
          summaryId: `${p.summaryArticle.chapter} ${p.summaryArticle.part}`,
          summaryWords: sumWc
        });
        S.announce("已交卷！完形已自动判分入库，请对照翻译与 Summary 标准答案自评。");
        render();
      });

      panel.querySelectorAll("[data-mock-cloze]").forEach((b) => {
        b.addEventListener("click", () => {
          if (viewState.submitted) return;
          viewState.answers.cloze[b.dataset.mockCloze] = b.dataset.letter;
          render();
        });
      });

      panel.querySelectorAll("[data-mock-c2e]").forEach((ta) => {
        ta.addEventListener("input", () => { viewState.answers.c2e[ta.dataset.mockC2e] = ta.value; });
      });

      panel.querySelectorAll("[data-mock-e2c]").forEach((ta) => {
        ta.addEventListener("input", () => { viewState.answers.e2c[ta.dataset.mockE2c] = ta.value; });
      });

      const sumTa = panel.querySelector("#mock-summary-ta");
      if (sumTa) {
        sumTa.addEventListener("input", () => {
          viewState.answers.summary = sumTa.value;
          const d = window.PrepSummaryUI.analyzeDraft(viewState.paper.summaryArticle, sumTa.value);
          const meter = document.getElementById("mock-sum-meter");
          const wcEl = document.getElementById("mock-sum-wc");
          const noteEl = document.getElementById("mock-sum-note");
          if (wcEl) wcEl.textContent = d.wc;
          if (noteEl) noteEl.textContent = d.lengthNote;
          if (meter) meter.className = `word-meter ${d.lengthLevel}`;
        });
      }

      panel.querySelectorAll("[data-self-mark]").forEach((b) => {
        b.addEventListener("click", () => {
          const id = b.dataset.selfMark;
          const ok = b.dataset.val === "1";
          viewState.selfMarks[id] = ok;
          S.recordAttempt(id, ok);
          S.announce(ok ? "已记为准确" : "已标错并存入错题本");
          render();
        });
      });

      panel.querySelectorAll("[data-open-summary-src]").forEach((b) => {
        b.addEventListener("click", () => window.PrepApp.openSummarySource(b.dataset.openSummarySrc));
      });
    }

    // Error book actions
    const backBtn = panel.querySelector("#btn-back-to-mock");
    if (backBtn) backBtn.addEventListener("click", () => { viewState.sub = "exam"; render(); });

    panel.querySelectorAll("[data-goto-err-tab]").forEach((b) => {
      b.addEventListener("click", () => {
        window.PrepApp.navigate(b.dataset.gotoErrTab, {
          sub: b.dataset.sub,
          unit: b.dataset.unit,
          onlyErrors: true,
          targetId: b.dataset.target
        });
      });
    });

    panel.querySelectorAll("[data-goto-sum]").forEach((b) => {
      b.addEventListener("click", () => {
        window.PrepApp.navigate("summary", { sub: "timed", articleId: b.dataset.gotoSum });
      });
    });

    panel.querySelectorAll("[data-clear-item-err]").forEach((b) => {
      b.addEventListener("click", () => {
        S.toggleErrorBook(b.dataset.clearItemErr, false);
        S.announce("已移出错题本");
        render();
      });
    });

    panel.querySelectorAll("[data-clear-sum-err]").forEach((b) => {
      b.addEventListener("click", () => {
        S.updateSummary(b.dataset.clearSumErr, { inErrorBook: false });
        S.announce("已移出待巩固列表");
        render();
      });
    });
  }

  window.PrepMockUI = { render, setOptions };
})();
