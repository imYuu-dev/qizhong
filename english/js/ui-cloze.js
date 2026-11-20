(function () {
  "use strict";

  const viewState = {
    unit: 1,             // 1 | 2 | 3 | 6 | 7 | "mixed" | "errors"
    sub: "practice",     // "analysis" | "practice"
    selections: {},      // questionId -> "A"|"B"|"C"|"D"
    submitted: {},       // scopeKey -> boolean
    mixedIds: []         // array of questionIds for mixed drill
  };

  function setOptions(opts) {
    if (!opts) return;
    if (opts.unit) viewState.unit = opts.unit;
    if (opts.sub) viewState.sub = opts.sub;
  }

  function getAllQuestions() {
    const out = [];
    window.EXAM_PREP_DATA.cloze.forEach((u) => {
      u.clozeSimulation.paragraphs.forEach((p) => {
        u.clozeSimulation.questions.filter((q) => q.paraNum === p.paraNum).forEach((q) => {
          // Extract local sentence context containing {{q.num}}
          const sentences = p.maskedText.split(/(?<=[.!?])\s+(?=[A-Z\u201c"\{])/);
          const hit = sentences.find((s) => s.includes(`{{${q.num}}}`)) || p.maskedText;
          out.push({ ...q, unitTitle: u.title, sentenceContext: hit });
        });
      });
    });
    return out;
  }

  function generateMixedSet(count) {
    const S = window.PrepStore;
    const all = getAllQuestions();
    // Weighted shuffle favoring errors and unpracticed items
    const scored = all.map((q) => ({
      q,
      score: S.getPriorityWeight(q.id) + Math.random() * 45
    }));
    scored.sort((a, b) => b.score - a.score);
    viewState.mixedIds = scored.slice(0, count).map((x) => x.q.id);
    viewState.submitted["mixed"] = false;
  }

  function renderMaskedParagraph(maskedText, questions, scopeSubmitted) {
    const S = window.PrepStore;
    const esc = S.esc;
    return esc(maskedText).replace(/\{\{(\d+)\}\}/g, (_, numStr) => {
      const q = questions.find((x) => x.num === Number(numStr));
      if (!q) return `[${numStr}]`;
      const picked = viewState.selections[q.id];
      const pickedText = picked ? q.options[picked] : "______";
      let cls = "cloze-blank-token";
      if (scopeSubmitted) {
        cls += picked === q.answer ? " is-correct" : " is-wrong";
      }
      return `<span class="${cls}">(${q.num}) ${esc(pickedText)}</span>`;
    });
  }

  function renderQuestionCard(q, scopeKey, showSentenceContext) {
    const S = window.PrepStore;
    const esc = S.esc;
    const picked = viewState.selections[q.id];
    const isSub = !!viewState.submitted[scopeKey];
    const rec = S.getItem(q.id);

    return `
      <article class="card" id="${q.id}">
        <div class="btn-row" style="justify-content:space-between;">
          <div class="btn-row">
            <strong>第 ${q.num} 题</strong>
            <span class="badge badge-ai">${esc(q.pointType)}</span>
            <span class="badge badge-neutral">Unit ${q.unit} · 第 [${q.paraNum}] 段</span>
            ${rec.inErrorBook ? `<span class="badge badge-danger">错题本</span>` : ""}
          </div>
          <button type="button" class="btn btn-sm btn-outline" data-open-texta="${q.unit}" data-para="${q.paraNum}">查看原文第 [${q.paraNum}] 段</button>
        </div>

        ${showSentenceContext ? `
          <p class="en-prose mt-1" lang="en">${esc(q.sentenceContext).replace(/\{\{(\d+)\}\}/g, () => `<span class="cloze-blank-token">${picked ? esc(q.options[picked]) : "______"}</span>`)}</p>
        ` : ""}

        <div class="option-grid" role="group" aria-label="第 ${q.num} 题选项">
          ${["A", "B", "C", "D"].map((letter) => {
            let cls = "option-btn";
            if (isSub) {
              if (letter === q.answer) cls += " is-correct";
              else if (picked === letter) cls += " is-wrong";
            } else if (picked === letter) {
              cls += " is-selected";
            }
            return `
              <button type="button" class="${cls}" data-pick-q="${q.id}" data-letter="${letter}">
                <strong>${letter}.</strong> ${esc(q.options[letter])}
              </button>
            `;
          }).join("")}
        </div>

        ${isSub ? `
          <div class="callout ${picked === q.answer ? "callout-official" : "callout-danger"}">
            <p>
              <strong>${picked === q.answer ? "✓ 回答正确" : `✗ 回答有误（你选了 ${picked || "未选"}）`}</strong> ·
              正确答案：<strong>${q.answer}. ${esc(q.options[q.answer])}</strong>
            </p>
            <p class="mt-1"><strong>考查知识点：</strong>${esc(q.knowledgePoint)}</p>
            <p class="mt-1"><strong>上下文判断依据：</strong>${esc(q.contextClue)}</p>
            <details class="disclosure mt-1">
              <summary>A / B / C / D 错误与干扰项逐一分析</summary>
              <div class="disclosure-body">
                <ul class="compact-list">
                  ${["A", "B", "C", "D"].map((l) => `<li><strong>${l}. ${esc(q.options[l])}：</strong>${esc(q.distractorAnalysis[l])}</li>`).join("")}
                </ul>
              </div>
            </details>
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderAnalysis(unitObj) {
    const S = window.PrepStore;
    const esc = S.esc;
    const a = unitObj.highFreqAnalysis;
    return `
      <div class="callout callout-official mb-2">
        <div class="btn-row" style="justify-content:space-between;">
          <div>
            <strong>Unit ${unitObj.unit} · ${esc(unitObj.title)}</strong>（作者：${esc(unitObj.author)}）
            <p class="muted-text">课内完形 10 分直接从五篇 Text A 中 5 选 1。吃透以下 5 类高频考点后，再做 AI 模拟题检测。</p>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-sm btn-outline" data-open-texta="${unitObj.unit}" data-para="1">阅读完整 Text A</button>
            ${S.hasLocalSources() ? `<a href="${esc(unitObj.scans[0].anchor)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">原图对照页</a>` : ""}
          </div>
        </div>
      </div>

      ${unitObj.notes.length ? `<div class="callout callout-warn mb-2">${unitObj.notes.map((n) => esc(n)).join("<br>")}</div>` : ""}

      <div class="card">
        <h3>1. 高频核心词汇（10 词）</h3>
        <div style="overflow-x:auto;">
          <table>
            <thead><tr><th>单词</th><th>词性</th><th>考频释义</th><th>原文出处句片段</th><th>溯源</th></tr></thead>
            <tbody>
              ${a.keyVocabulary.map((v) => `
                <tr>
                  <td lang="en"><strong>${esc(v.word)}</strong></td>
                  <td>${esc(v.pos)}</td>
                  <td>${esc(v.meaning)}</td>
                  <td lang="en" class="muted-text">${esc(v.snippet)}</td>
                  <td><button type="button" class="btn btn-sm btn-outline" data-open-texta="${unitObj.unit}" data-para="${v.para}">[${v.para}] 段</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>2. 固定搭配与介词组合</h3>
          <ul class="compact-list">
            ${a.collocations.map((c) => `
              <li>
                <strong lang="en">${esc(c.phrase)}</strong> — ${esc(c.meaning)}
                <button type="button" class="btn btn-sm btn-outline" style="min-block-size:26px;padding:0.1rem 0.45rem;margin-inline-start:0.35rem;" data-open-texta="${unitObj.unit}" data-para="${c.para}">[${c.para}]</button>
              </li>
            `).join("")}
          </ul>
        </div>

        <div class="card">
          <h3>3. 近义 / 形近词辨析</h3>
          <ul class="compact-list">
            ${a.synonymDistinctions.map((s) => `
              <li>
                <strong lang="en">${esc(s.pair)}</strong>：${esc(s.distinction)}
                <button type="button" class="btn btn-sm btn-outline" style="min-block-size:26px;padding:0.1rem 0.45rem;margin-inline-start:0.35rem;" data-open-texta="${unitObj.unit}" data-para="${s.para}">[${s.para}]</button>
              </li>
            `).join("")}
          </ul>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3>4. 重点语法与长难句结构</h3>
          <ul class="compact-list">
            ${a.grammarStructures.map((g) => `
              <li>
                <strong lang="en">${esc(g.pattern)}</strong><br>
                <span>${esc(g.analysis)}</span><br>
                <span class="muted-text" lang="en">例：${esc(g.example)}</span>
                <button type="button" class="btn btn-sm btn-outline" style="min-block-size:26px;padding:0.1rem 0.45rem;" data-open-texta="${unitObj.unit}" data-para="${g.para}">[${g.para}]</button>
              </li>
            `).join("")}
          </ul>
        </div>

        <div class="card">
          <h3>5. 逻辑连接词与上下文线索</h3>
          <ul class="compact-list">
            ${a.discourseMarkers.map((d) => `
              <li>
                <strong lang="en">${esc(d.marker)}</strong> <span class="badge badge-neutral">${esc(d.logic)}</span><br>
                <span>${esc(d.usage)}</span>
                <button type="button" class="btn btn-sm btn-outline" style="min-block-size:26px;padding:0.1rem 0.45rem;" data-open-texta="${unitObj.unit}" data-para="${d.para}">[${d.para}]</button>
              </li>
            `).join("")}
          </ul>
        </div>
      </div>
    `;
  }

  function renderUnitPractice(unitObj) {
    const S = window.PrepStore;
    const esc = S.esc;
    const sim = unitObj.clozeSimulation;
    const scopeKey = `u${unitObj.unit}`;
    const isSub = !!viewState.submitted[scopeKey];
    const correctCount = sim.questions.filter((q) => viewState.selections[q.id] === q.answer).length;

    return `
      <div class="callout callout-ai mb-2">
        <div class="btn-row" style="justify-content:space-between;">
          <div>
            <span class="badge badge-ai">AI 模拟题</span>
            <strong>${esc(sim.sourceNotice)}</strong>
          </div>
          <div class="btn-row">
            ${isSub ? `<span class="badge ${correctCount >= 8 ? "badge-official" : "badge-warn"}">得分：${correctCount} / ${sim.questions.length}</span>` : ""}
            <button type="button" class="btn btn-primary" id="btn-submit-cloze" data-scope="${scopeKey}">${isSub ? "重置本篇重练" : "交卷判分与解析"}</button>
          </div>
        </div>
      </div>

      <div class="cloze-layout">
        <div class="card cloze-passage-sticky">
          <div class="btn-row" style="justify-content:space-between;">
            <h3>Unit ${unitObj.unit} · ${esc(unitObj.title)}</h3>
            <button type="button" class="btn btn-sm btn-outline" data-open-texta="${unitObj.unit}" data-para="${sim.sourceParas[0]}">看完整原文</button>
          </div>
          <p class="muted-text mb-1">选用原文第 [${sim.sourceParas.join("][")}] 段，点击右侧选项，空格实时填入。</p>
          <div class="en-prose" lang="en">
            ${sim.paragraphs.map((p) => `
              <p class="mb-2">
                <span class="badge badge-neutral">[${p.paraNum}]</span>
                ${renderMaskedParagraph(p.maskedText, sim.questions, isSub)}
              </p>
            `).join("")}
          </div>
        </div>

        <div>
          ${sim.questions.map((q) => renderQuestionCard(q, scopeKey, false)).join("")}
        </div>
      </div>
    `;
  }

  function renderMixedOrErrors(mode) {
    const S = window.PrepStore;
    const all = getAllQuestions();
    let list;
    let scopeKey = mode;

    if (mode === "mixed") {
      if (viewState.mixedIds.length === 0) generateMixedSet(10);
      list = viewState.mixedIds.map((id) => all.find((q) => q.id === id)).filter(Boolean);
    } else {
      list = all.filter((q) => S.getItem(q.id).inErrorBook);
    }

    const isSub = !!viewState.submitted[scopeKey];
    const correctCount = list.filter((q) => viewState.selections[q.id] === q.answer).length;

    return `
      <div class="callout callout-ai mb-2">
        <div class="btn-row" style="justify-content:space-between;">
          <div>
            <span class="badge badge-ai">${mode === "mixed" ? "5 篇混合随机抽练" : "完形错题本专练"}</span>
            <span>${mode === "mixed" ? "优先抽取错题与薄弱空，附带该空所在 Text A 原句。" : `当前完形错题本共 ${list.length} 题（连续答对 2 次自动移出）。`}</span>
          </div>
          <div class="btn-row">
            ${mode === "mixed" ? `<button type="button" class="btn btn-sm btn-outline" id="btn-reshuffle-mixed">换一批 10 题</button>` : ""}
            ${list.length > 0 ? `<button type="button" class="btn btn-primary" id="btn-submit-cloze" data-scope="${scopeKey}">${isSub ? "清空选择重做" : `判分并解析 (${correctCount}/${list.length})`}</button>` : ""}
          </div>
        </div>
      </div>
      ${list.length === 0
        ? `<div class="card"><p>当前完形错题本为空！可先完成单篇模拟或混合抽练检验掌握情况。</p></div>`
        : list.map((q) => renderQuestionCard(q, scopeKey, true)).join("")}
    `;
  }

  function render() {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const panel = document.getElementById("panel-cloze");
    const units = [1, 2, 3, 6, 7];
    const errCount = getAllQuestions().filter((q) => S.getItem(q.id).inErrorBook).length;

    let bodyHtml = "";
    if (viewState.unit === "mixed" || viewState.unit === "errors") {
      bodyHtml = renderMixedOrErrors(viewState.unit);
    } else {
      const unitObj = D.cloze.find((x) => x.unit === Number(viewState.unit)) || D.cloze[0];
      bodyHtml = viewState.sub === "analysis" ? renderAnalysis(unitObj) : renderUnitPractice(unitObj);
    }

    panel.innerHTML = `
      <h2 id="tab-heading-cloze">模块 B：完形填空专项训练（课内 5 篇 Text A · 10 分）</h2>

      <div class="sub-toolbar">
        <div class="pill-group" role="group" aria-label="选择单元或随机模式">
          ${units.map((u) => `
            <button type="button" class="pill-btn ${viewState.unit === u ? "is-active" : ""}" data-cloze-unit="${u}">Unit ${u}</button>
          `).join("")}
          <button type="button" class="pill-btn ${viewState.unit === "mixed" ? "is-active" : ""}" data-cloze-unit="mixed">5 篇混合随机抽题</button>
          <button type="button" class="pill-btn ${viewState.unit === "errors" ? "is-active" : ""}" data-cloze-unit="errors">完形错题本 (${errCount})</button>
        </div>

        ${typeof viewState.unit === "number" ? `
          <div class="pill-group" role="group" aria-label="单元视图">
            <button type="button" class="pill-btn ${viewState.sub === "practice" ? "is-active" : ""}" data-cloze-sub="practice">AI 模拟完形（10 空）</button>
            <button type="button" class="pill-btn ${viewState.sub === "analysis" ? "is-active" : ""}" data-cloze-sub="analysis">高频考点精析</button>
          </div>
        ` : ""}
      </div>

      ${bodyHtml}
    `;

    panel.querySelectorAll("[data-cloze-unit]").forEach((b) => {
      b.addEventListener("click", () => {
        const val = b.dataset.clozeUnit;
        viewState.unit = /^\d+$/.test(val) ? Number(val) : val;
        if (viewState.unit === "mixed" && viewState.mixedIds.length === 0) {
          generateMixedSet(10);
        }
        render();
      });
    });

    panel.querySelectorAll("[data-cloze-sub]").forEach((b) => {
      b.addEventListener("click", () => {
        viewState.sub = b.dataset.clozeSub;
        render();
      });
    });

    panel.querySelectorAll("[data-pick-q]").forEach((b) => {
      b.addEventListener("click", () => {
        const qid = b.dataset.pickQ;
        const scopeKey = typeof viewState.unit === "number" ? `u${viewState.unit}` : viewState.unit;
        if (viewState.submitted[scopeKey]) return;
        viewState.selections[qid] = b.dataset.letter;
        render();
      });
    });

    const reshuffle = panel.querySelector("#btn-reshuffle-mixed");
    if (reshuffle) {
      reshuffle.addEventListener("click", () => {
        generateMixedSet(10);
        S.announce("已重新随机抽取 10 道混合完形题");
        render();
      });
    }

    const submitBtn = panel.querySelector("#btn-submit-cloze");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        const scopeKey = submitBtn.dataset.scope;
        const allQ = getAllQuestions();
        let qs;
        if (scopeKey === "mixed") {
          qs = viewState.mixedIds.map((id) => allQ.find((q) => q.id === id)).filter(Boolean);
        } else if (scopeKey === "errors") {
          qs = allQ.filter((q) => S.getItem(q.id).inErrorBook);
        } else {
          const uNum = Number(scopeKey.slice(1));
          qs = allQ.filter((q) => q.unit === uNum);
        }

        if (viewState.submitted[scopeKey]) {
          viewState.submitted[scopeKey] = false;
          qs.forEach((q) => { delete viewState.selections[q.id]; });
          render();
          return;
        }

        viewState.submitted[scopeKey] = true;
        let okCount = 0;
        qs.forEach((q) => {
          const isOk = viewState.selections[q.id] === q.answer;
          if (isOk) okCount++;
          S.recordAttempt(q.id, isOk);
        });
        S.announce(`判分完成：答对 ${okCount} / ${qs.length} 题，错题已自动加入错题本`);
        render();
      });
    }

    panel.querySelectorAll("[data-open-texta]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.PrepApp.openTextASource(Number(btn.dataset.openTexta), Number(btn.dataset.para));
      });
    });
  }

  window.PrepClozeUI = { render, setOptions, getAllQuestions };
})();
