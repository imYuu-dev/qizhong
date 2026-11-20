(function () {
  "use strict";

  const viewState = {
    sub: "c2e",          // "c2e" | "e2c"
    unitFilter: "all",   // "all" | 1 | 2 | 3 | 6 | 7
    onlyErrors: false,
    onlyOverlap: false,
    c2eMode: "sentence", // "sentence" | "paragraph"
    e2cMode: "sentence", // "sentence" | "paragraph"
    revealed: {},        // itemId -> boolean
    highlightId: null
  };

  function setOptions(opts) {
    if (!opts) return;
    if (opts.sub) viewState.sub = opts.sub;
    if (opts.unit) viewState.unitFilter = opts.unit;
    if (typeof opts.onlyErrors === "boolean") viewState.onlyErrors = opts.onlyErrors;
    if (opts.targetId) viewState.highlightId = opts.targetId;
  }

  function checkPhraseHits(draft, keyPhrases) {
    const lower = (draft || "").toLowerCase();
    return keyPhrases.map((kp) => {
      // Extract meaningful content words (>= 4 chars) from English phrase
      const words = kp.en.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
      const hits = words.filter((w) => lower.includes(w));
      const matched = words.length > 0 && hits.length >= Math.max(1, Math.ceil(words.length * 0.5));
      return { ...kp, matched };
    });
  }

  function renderStatusBadge(rec) {
    if (rec.inErrorBook) return `<span class="badge badge-danger">错题本待复习（已错/重置）</span>`;
    if (rec.streak >= 2) return `<span class="badge badge-official">✓ 已连续掌握 (${rec.streak}次)</span>`;
    if (rec.lastResult === "correct") return `<span class="badge badge-official">✓ 最近答对 (${rec.correct}/${rec.attempts})</span>`;
    if (rec.attempts > 0) return `<span class="badge badge-warn">已练 ${rec.attempts} 次</span>`;
    return `<span class="badge badge-neutral">未练习</span>`;
  }

  function renderC2E() {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const esc = S.esc;

    let units = D.c2e;
    if (viewState.unitFilter !== "all") {
      units = units.filter((u) => u.unit === Number(viewState.unitFilter));
    }

    if (viewState.c2eMode === "paragraph") {
      return `
        <div class="callout callout-official mb-2">
          <strong>中译英整段模式说明：</strong>教材课后原题为 5 个完整中文段落，考试从中每课抽取 1 句（共 5 句）。下方官方英文译文完全保留教师最新版本，只读不可覆盖。
        </div>
        ${units.map((u) => {
          const pId = `c2e-para-u${u.unit}`;
          const rec = S.getItem(pId);
          const isRev = !!viewState.revealed[pId];
          return `
            <article class="card" id="${pId}">
              <div class="btn-row" style="justify-content:space-between;">
                <h3>Unit ${u.unit} Text A 课后中译英整段（共 ${u.sentenceCount} 句）</h3>
                <div class="btn-row">
                  ${renderStatusBadge(rec)}
                  ${S.hasLocalSources() ? `<a href="${esc(u.sourcePath)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">原文件</a>` : ""}
                </div>
              </div>
              <p class="mt-1"><strong>中文原题：</strong>${esc(u.chinesePrompt)}</p>
              <div class="mt-2">
                <label for="ta-${pId}">独立默写整段英文译文（作答后可揭晓官方译文对照）：</label>
                <textarea id="ta-${pId}" rows="4" lang="en" placeholder="在此默写 Unit ${u.unit} 英文译文..." data-draft-id="${pId}">${esc(rec.draftText)}</textarea>
              </div>
              <div class="btn-row mt-1">
                <button type="button" class="btn btn-primary" data-toggle-reveal="${pId}">${isRev ? "遮挡标准译文" : "揭晓官方标准译文"}</button>
                <button type="button" class="btn btn-outline" data-mark-item="${pId}" data-correct="1">记为掌握 ✓</button>
                <button type="button" class="btn btn-danger-outline" data-mark-item="${pId}" data-correct="0">加入错题本 ✗</button>
              </div>
              ${isRev ? `
                <div class="revealed-official mt-2">
                  <div class="btn-row" style="justify-content:space-between;">
                    <span class="badge badge-official">老师提供的官方参考译文（只读）</span>
                    <span class="muted-text">来源：${esc(u.sourcePath)}</span>
                  </div>
                  <p class="en-prose mt-1" lang="en">${esc(u.officialEnglish)}</p>
                </div>
              ` : `<div class="masked-panel muted-text">官方标准译文已隐藏，请先独立回忆默写后再揭晓。</div>`}
            </article>
          `;
        }).join("")}
      `;
    }

    // Sentence-by-sentence mode
    const cardsHtml = [];
    units.forEach((u) => {
      u.sentences.forEach((s) => {
        const rec = S.getItem(s.id);
        if (viewState.onlyErrors && !rec.inErrorBook && rec.lastResult === "correct") return;
        const isRev = !!viewState.revealed[s.id];
        const isFocus = viewState.highlightId === s.id;
        const phraseChecks = isRev ? checkPhraseHits(rec.draftText, s.keyPhrases) : [];

        cardsHtml.push(`
          <article class="card ${isFocus ? "callout-warn" : ""}" id="${s.id}">
            <div class="btn-row" style="justify-content:space-between;">
              <div>
                <span class="badge badge-official">Unit ${u.unit} · 第 ${s.sentenceIndex}/${u.sentenceCount} 句</span>
                ${renderStatusBadge(rec)}
                ${rec.attempts > 0 ? `<span class="muted-text">练习 ${rec.attempts} 次 · 正确率 ${Math.round((rec.correct / rec.attempts) * 100)}%</span>` : ""}
              </div>
              ${S.hasLocalSources() ? `<a href="${esc(u.sourcePath)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">原题出处</a>` : ""}
            </div>

            <p class="mt-2" style="font-size:1.06rem;font-weight:600;">${esc(s.zh)}</p>

            <div class="mt-1">
              <label for="ta-${s.id}" class="muted-text">独立默写英文（答案默认遮挡）：</label>
              <textarea id="ta-${s.id}" rows="2" lang="en" placeholder="先凭记忆写出英文句子，再核对关键词与官方答案..." data-draft-id="${s.id}">${esc(rec.draftText)}</textarea>
            </div>

            <div class="btn-row mt-1">
              <button type="button" class="btn btn-primary" data-toggle-reveal="${s.id}">${isRev ? "重新遮挡答案" : "揭晓标准答案与解析"}</button>
              <button type="button" class="btn btn-outline" data-mark-item="${s.id}" data-correct="1">我写对了 / 已掌握 ✓</button>
              <button type="button" class="btn btn-danger-outline" data-mark-item="${s.id}" data-correct="0">写错 / 标为错句 ✗</button>
            </div>

            ${isRev ? `
              <div class="revealed-official">
                <span class="badge badge-official">老师提供的官方标准译文（只读）</span>
                <p class="en-prose mt-1" lang="en">${esc(s.officialEn)}</p>
              </div>

              <div class="mt-1">
                <strong>关键短语与表达结构对照${rec.draftText ? "（已自动比对您的默写关键词）" : ""}：</strong>
                <div class="phrase-chips">
                  ${phraseChecks.map((kp) => `
                    <div class="phrase-chip ${kp.matched ? "is-hit" : ""}">
                      <span lang="en"><strong>${kp.matched ? "✓ " : ""}${esc(kp.en)}</strong></span>
                      <span class="muted-text">${esc(kp.zh)}</span>
                    </div>
                  `).join("")}
                </div>
                <p class="muted-text"><strong>句型与语法点：</strong>${esc(s.grammarStructure)}</p>
              </div>

              <div class="revealed-ai">
                <span class="badge badge-ai">AI 补充其他合理表达（仅供拓宽思路，非官方标准答案）</span>
                <ul class="compact-list mt-1" lang="en">
                  ${s.aiAlternatives.map((alt) => `<li>${esc(alt)}</li>`).join("")}
                </ul>
              </div>
            ` : `
              <div class="masked-panel muted-text">
                标准英文译文与短语解析已遮挡。提示：包含 <strong>${s.keyPhrases.length} 个核心短语</strong>，尝试写出后点击揭晓。
              </div>
            `}
          </article>
        `);
      });
    });

    if (cardsHtml.length === 0) {
      return `<div class="card"><p>当前筛选条件下暂无中译英错题或待练句，太棒了！可取消「仅看错题/待巩固」查看全部 29 句。</p></div>`;
    }
    return cardsHtml.join("");
  }

  function renderE2C() {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const esc = S.esc;

    let units = D.e2c;
    if (viewState.unitFilter !== "all") {
      units = units.filter((u) => u.unit === Number(viewState.unitFilter));
    }

    const blocks = [];
    units.forEach((u) => {
      u.passages.forEach((p) => {
        if (viewState.onlyOverlap && !p.isTextAOverlap) return;

        if (viewState.e2cMode === "paragraph") {
          const rec = S.getItem(p.id);
          if (viewState.onlyErrors && !rec.inErrorBook && rec.lastResult === "correct") return;
          const isRev = !!viewState.revealed[p.id];
          blocks.push(`
            <article class="card" id="${p.id}">
              <div class="btn-row" style="justify-content:space-between;">
                <div class="btn-row">
                  <h3>Unit ${u.unit} 英译中 · 原题 ${p.questionIndex}</h3>
                  ${p.isTextAOverlap
                    ? `<span class="badge badge-official">✓ 与 Text A 第 ${esc(p.textAPara)} 段同源 · 扫描${esc(p.scanPages)}</span>`
                    : `<span class="badge badge-neutral">课后拓展段（非 Text A 正文）</span>`}
                  ${renderStatusBadge(rec)}
                </div>
                <div class="btn-row">
                  ${p.isTextAOverlap ? `<button type="button" class="btn btn-sm btn-outline" data-open-texta="${u.unit}" data-para="${esc(p.textAPara.replace(/\D/g, ""))}">回看 Text A 原文</button>` : ""}
                  ${S.hasLocalSources() && p.proofreadLink ? `<a href="${esc(p.proofreadLink)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">原图对照</a>` : ""}
                </div>
              </div>

              ${p.diffNote ? `<div class="callout ${u.unit === 3 && p.questionIndex === 1 ? "callout-danger" : "callout-warn"} mt-1"><strong>来源与版本说明：</strong>${esc(p.diffNote)}</div>` : ""}

              <div class="en-prose mt-1" lang="en">
                ${p.englishParagraphs.map((ep) => `<p class="mb-1">${esc(ep)}</p>`).join("")}
              </div>

              <div class="mt-2">
                <label for="ta-${p.id}">整段独立译为中文（作答后揭晓老师参考译文）：</label>
                <textarea id="ta-${p.id}" rows="4" placeholder="在此输入整段中文翻译..." data-draft-id="${p.id}">${esc(rec.draftText)}</textarea>
              </div>
              <div class="btn-row mt-1">
                <button type="button" class="btn btn-primary" data-toggle-reveal="${p.id}">${isRev ? "遮挡中文译文" : "揭晓老师参考译文与结构解析"}</button>
                <button type="button" class="btn btn-outline" data-mark-item="${p.id}" data-correct="1">翻译准确 ✓</button>
                <button type="button" class="btn btn-danger-outline" data-mark-item="${p.id}" data-correct="0">标记错段待复练 ✗</button>
              </div>

              ${isRev ? `
                <div class="revealed-official">
                  <span class="badge badge-official">老师提供的官方中文参考译文（只读）</span>
                  <p class="mt-1" style="white-space:pre-line;">${esc(p.officialChinese)}</p>
                </div>
                <div class="callout mt-1">
                  <strong>整段语义与逻辑结构：</strong>${esc(p.semanticStructure)}
                </div>
              ` : `<div class="masked-panel muted-text">老师参考译文与整段语义结构已隐藏。</div>`}
            </article>
          `);
          return;
        }

        // E2C Sentence-by-sentence mode
        const visibleSents = p.sentences.filter((s) => {
          const r = S.getItem(s.id);
          return !(viewState.onlyErrors && !r.inErrorBook && r.lastResult === "correct");
        });
        if (visibleSents.length === 0) return;

        blocks.push(`
          <article class="card" id="${p.id}">
            <div class="btn-row" style="justify-content:space-between;">
              <div class="btn-row">
                <h3>Unit ${u.unit} 英译中 · 原题 ${p.questionIndex}（逐句精译 · 共 ${p.sentenceCount} 句）</h3>
                ${p.isTextAOverlap
                  ? `<span class="badge badge-official">✓ 与 Text A 第 ${esc(p.textAPara)} 段同源 · 扫描${esc(p.scanPages)}</span>`
                  : `<span class="badge badge-neutral">课后拓展段</span>`}
              </div>
              <div class="btn-row">
                ${p.isTextAOverlap ? `<button type="button" class="btn btn-sm btn-outline" data-open-texta="${u.unit}" data-para="${esc(p.textAPara.replace(/\D/g, ""))}">回看 Text A 原文</button>` : ""}
                ${S.hasLocalSources() && p.proofreadLink ? `<a href="${esc(p.proofreadLink)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">原图对照</a>` : ""}
              </div>
            </div>

            ${p.diffNote ? `<div class="callout ${u.unit === 3 && p.questionIndex === 1 ? "callout-danger" : "callout-warn"} mt-1"><strong>来源与版本说明：</strong>${esc(p.diffNote)}</div>` : ""}
            <p class="muted-text mt-1"><strong>整段语义结构：</strong>${esc(p.semanticStructure)}</p>

            ${visibleSents.map((s) => {
              const rec = S.getItem(s.id);
              const isRev = !!viewState.revealed[s.id];
              return `
                <div class="masked-panel" style="background:var(--bg-surface);border-style:solid;" id="${s.id}">
                  <div class="btn-row" style="justify-content:space-between;">
                    <strong>第 ${s.sentenceIndex}/${p.sentenceCount} 句</strong>
                    ${renderStatusBadge(rec)}
                  </div>
                  <p class="en-prose mt-1" lang="en">${esc(s.en)}</p>
                  <div class="mt-1">
                    <label for="ta-${s.id}" class="muted-text">口译/笔译该句：</label>
                    <textarea id="ta-${s.id}" rows="2" placeholder="先自己译成中文，再揭晓官方译文与长难句剖析..." data-draft-id="${s.id}">${esc(rec.draftText)}</textarea>
                  </div>
                  <div class="btn-row mt-1">
                    <button type="button" class="btn btn-sm btn-primary" data-toggle-reveal="${s.id}">${isRev ? "遮挡译文" : "揭晓参考译文与长难句"}</button>
                    <button type="button" class="btn btn-sm btn-outline" data-mark-item="${s.id}" data-correct="1">已掌握 ✓</button>
                    <button type="button" class="btn btn-sm btn-danger-outline" data-mark-item="${s.id}" data-correct="0">标为错句 ✗</button>
                  </div>
                  ${isRev ? `
                    <div class="revealed-official mt-1">
                      <span class="badge badge-official">官方参考译文（只读）</span>
                      <p class="mt-1">${esc(s.officialZh)}</p>
                    </div>
                    <div class="phrase-chips">
                      ${s.keyVocab.map((kv) => `
                        <div class="phrase-chip">
                          <strong lang="en">${esc(kv.en)}</strong>
                          <span class="muted-text">${esc(kv.zh)}</span>
                        </div>
                      `).join("")}
                    </div>
                    <p class="muted-text"><strong>长难句与译法拆解：</strong>${esc(s.structureNote)}</p>
                  ` : ""}
                </div>
              `;
            }).join("")}
          </article>
        `);
      });
    });

    if (blocks.length === 0) {
      return `<div class="card"><p>当前筛选条件下没有需要显示的英译中题目，可切换单元或取消错题筛选。</p></div>`;
    }
    return blocks.join("");
  }

  function render() {
    const S = window.PrepStore;
    const panel = document.getElementById("panel-translation");
    const units = [1, 2, 3, 6, 7];

    panel.innerHTML = `
      <h2 id="tab-heading-translation">模块 A：翻译快速记忆（最高确定性抢分）</h2>

      <div class="sub-toolbar">
        <div class="pill-group" role="group" aria-label="翻译题型切换">
          <button type="button" class="pill-btn ${viewState.sub === "c2e" ? "is-active" : ""}" data-sub="c2e">中译英（5 单元 · 29 句）</button>
          <button type="button" class="pill-btn ${viewState.sub === "e2c" ? "is-active" : ""}" data-sub="e2c">英译中（5 单元 · 10 段）</button>
        </div>

        <div class="pill-group" role="group" aria-label="单元筛选">
          <button type="button" class="pill-btn ${viewState.unitFilter === "all" ? "is-active" : ""}" data-unit="all">全部单元</button>
          ${units.map((u) => `
            <button type="button" class="pill-btn ${String(viewState.unitFilter) === String(u) ? "is-active" : ""}" data-unit="${u}">Unit ${u}</button>
          `).join("")}
        </div>
      </div>

      <div class="sub-toolbar">
        <div class="pill-group" role="group" aria-label="练习粒度">
          ${viewState.sub === "c2e" ? `
            <button type="button" class="pill-btn ${viewState.c2eMode === "sentence" ? "is-active" : ""}" data-mode="sentence">逐句默写模式（推荐）</button>
            <button type="button" class="pill-btn ${viewState.c2eMode === "paragraph" ? "is-active" : ""}" data-mode="paragraph">整段对照模式</button>
          ` : `
            <button type="button" class="pill-btn ${viewState.e2cMode === "sentence" ? "is-active" : ""}" data-mode="sentence">逐句精译模式（推荐）</button>
            <button type="button" class="pill-btn ${viewState.e2cMode === "paragraph" ? "is-active" : ""}" data-mode="paragraph">整段连译模式</button>
          `}
        </div>

        <div class="btn-row">
          ${viewState.sub === "e2c" ? `
            <label class="check-item"><input type="checkbox" id="chk-only-overlap" ${viewState.onlyOverlap ? "checked" : ""}> 仅看 Text A 同源第 1 题</label>
          ` : ""}
          <label class="check-item"><input type="checkbox" id="chk-only-errors" ${viewState.onlyErrors ? "checked" : ""}> 仅看错题 / 未答对</label>
          <button type="button" class="btn btn-sm btn-outline" id="btn-hide-all-trans">全部重新遮挡</button>
        </div>
      </div>

      <div id="translation-list">
        ${viewState.sub === "c2e" ? renderC2E() : renderE2C()}
      </div>
    `;

    // Bind events
    panel.querySelectorAll("[data-sub]").forEach((b) => {
      b.addEventListener("click", () => {
        viewState.sub = b.dataset.sub;
        viewState.highlightId = null;
        render();
      });
    });

    panel.querySelectorAll("[data-unit]").forEach((b) => {
      b.addEventListener("click", () => {
        viewState.unitFilter = b.dataset.unit === "all" ? "all" : Number(b.dataset.unit);
        render();
      });
    });

    panel.querySelectorAll("[data-mode]").forEach((b) => {
      b.addEventListener("click", () => {
        if (viewState.sub === "c2e") viewState.c2eMode = b.dataset.mode;
        else viewState.e2cMode = b.dataset.mode;
        render();
      });
    });

    const overlapChk = panel.querySelector("#chk-only-overlap");
    if (overlapChk) {
      overlapChk.addEventListener("change", () => {
        viewState.onlyOverlap = overlapChk.checked;
        render();
      });
    }

    const errChk = panel.querySelector("#chk-only-errors");
    if (errChk) {
      errChk.addEventListener("change", () => {
        viewState.onlyErrors = errChk.checked;
        render();
      });
    }

    panel.querySelector("#btn-hide-all-trans").addEventListener("click", () => {
      viewState.revealed = {};
      S.announce("已重新遮挡全部翻译答案");
      render();
    });

    panel.querySelectorAll("[data-draft-id]").forEach((ta) => {
      ta.addEventListener("input", () => {
        S.saveItemDraft(ta.dataset.draftId, ta.value);
      });
    });

    panel.querySelectorAll("[data-toggle-reveal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.toggleReveal;
        viewState.revealed[id] = !viewState.revealed[id];
        render();
      });
    });

    panel.querySelectorAll("[data-mark-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.markItem;
        const ok = btn.dataset.correct === "1";
        viewState.revealed[id] = true;
        S.recordAttempt(id, ok);
        S.announce(ok ? "已标记为掌握" : "已加入错题本，后续冲刺将优先推送");
        render();
      });
    });

    panel.querySelectorAll("[data-open-texta]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.PrepApp.openTextASource(Number(btn.dataset.openTexta), Number(btn.dataset.para));
      });
    });

    if (viewState.highlightId) {
      const targetEl = document.getElementById(viewState.highlightId);
      if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  window.PrepTranslationUI = { render, setOptions };
})();
