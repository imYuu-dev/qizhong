(function () {
  "use strict";

  const viewState = {
    sub: "cards",          // "cards" | "opening" | "timed" | "merge" | "random16" | "guide"
    articleId: "ch01-b",
    searchQuery: "",
    filterChapter: "all",
    revealModel: false,
    revealOpening: false,
    revealMerge: {},
    randomHideScaffold: true,
    randomShowModel: false
  };

  function setOptions(opts) {
    if (!opts) return;
    if (opts.sub) viewState.sub = opts.sub;
    if (opts.articleId) {
      viewState.articleId = opts.articleId;
      viewState.revealModel = false;
      viewState.revealOpening = false;
    }
  }

  function getArticle(id) {
    return window.EXAM_PREP_DATA.summary16.find((a) => a.id === id) || window.EXAM_PREP_DATA.summary16[0];
  }

  function analyzeDraft(article, draft) {
    const S = window.PrepStore;
    const text = (draft || "").trim();
    const wc = S.countWords(text);
    const isShort = article.paragraphCount <= 11;
    const minRec = isShort ? 100 : 120;
    const maxRec = isShort ? 150 : 175;

    let lengthLevel = "is-ok";
    let lengthNote = `当前 ${wc} 词，处于学习建议区间（${minRec}–${maxRec} 词，仅供参考，非教师硬性上限）。`;
    if (wc === 0) {
      lengthLevel = "";
      lengthNote = `尚未开始作答。学习建议区间：${minRec}–${maxRec} 词（非教师公布的硬性上限）。`;
    } else if (wc < 80) {
      lengthLevel = "is-warn";
      lengthNote = `当前 ${wc} 词，略短于建议区间（${minRec}–${maxRec} 词），请检查是否遗漏重要逻辑组或核心主旨。`;
    } else if (wc > 190) {
      lengthLevel = "is-over";
      lengthNote = `⚠️ 当前 ${wc} 词，已显著偏长（建议 ≤ 175 词）！教师阅卷第一眼嫌长可能直接判不合格（< 12/20 分风险），请立即删除人名/数字并合并同义段落！`;
    } else if (wc > maxRec) {
      lengthLevel = "is-warn";
      lengthNote = `当前 ${wc} 词，略超出建议上限 ${maxRec} 词，建议继续压缩冗余细节（注意老师提醒罗素示范范文亦略偏长）。`;
    }

    const lower = text.toLowerCase();
    // Check title presence (at least 2 key words >3 chars or full title)
    const titleWords = article.title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
    const titleHitCount = titleWords.filter((w) => lower.includes(w)).length;
    const hasTitle = lower.includes(article.title.toLowerCase()) || (titleWords.length > 0 && titleHitCount >= Math.min(2, titleWords.length));

    // Check author presence (last name or main token)
    const authorTokens = article.author.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !["from", "the", "and", "of", "editors"].includes(w));
    const hasAuthor = authorTokens.some((t) => lower.includes(t));

    // Check mechanical paragraph-by-paragraph phrasing
    const paraByParaMatch = /\b(in paragraph \d+|paragraph \d+|the first paragraph|the second paragraph|the third paragraph)\b/i.test(text);

    // Check reporting verbs
    const hasReportingVerb = /\b(argues?|claims?|states?|explains?|examines?|explores?|highlights?|warns?|notes?|points out|outlines?|analyzes?|evaluates?|asserts?|emphasizes?)\b/i.test(text);

    // Check sentence count and avg sentence length (avoid all ultra-short SVO)
    const sents = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const avgWordsPerSent = sents.length ? Math.round(wc / sents.length) : 0;

    return {
      wc, minRec, maxRec, lengthLevel, lengthNote,
      hasTitle, hasAuthor, paraByParaMatch, hasReportingVerb,
      sentCount: sents.length, avgWordsPerSent
    };
  }

  function renderMasteryBadges(rec) {
    return `
      <span class="badge ${rec.openingMastered ? "badge-official" : "badge-neutral"}">首段${rec.openingMastered ? " ✓" : " ○"}</span>
      <span class="badge ${rec.structureMastered ? "badge-official" : "badge-neutral"}">结构${rec.structureMastered ? " ✓" : " ○"}</span>
      <span class="badge ${rec.fullMastered ? "badge-official" : "badge-neutral"}">全文${rec.fullMastered ? " ✓" : " ○"}</span>
      ${rec.inErrorBook ? `<span class="badge badge-danger">待巩固</span>` : ""}
    `;
  }

  function renderArticleSelector() {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const esc = S.esc;
    const q = viewState.searchQuery.trim().toLowerCase();

    const filtered = D.summary16.filter((a) => {
      if (viewState.filterChapter !== "all" && a.chapter !== Number(viewState.filterChapter)) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q) ||
        a.oneSentenceMainIdeaZh.toLowerCase().includes(q)
      );
    });

    return `
      <div class="card">
        <div class="btn-row" style="justify-content:space-between;">
          <search style="flex:1 1 240px;">
            <label for="summary-search" class="visually-hidden">搜索 16 篇标题、作者或核心观点</label>
            <input type="search" id="summary-search" placeholder="搜索 16 篇文章（标题 / 作者 / 中文主旨）..." value="${esc(viewState.searchQuery)}">
          </search>
          <div class="pill-group" role="group" aria-label="按 Chapter 筛选">
            <button type="button" class="pill-btn ${viewState.filterChapter === "all" ? "is-active" : ""}" data-ch-filter="all">全部 16 篇</button>
            ${[1, 2, 3, 4, 5, 6, 7, 8].map((ch) => `
              <button type="button" class="pill-btn ${String(viewState.filterChapter) === String(ch) ? "is-active" : ""}" data-ch-filter="${ch}">Ch ${ch}</button>
            `).join("")}
          </div>
        </div>

        <div class="grid-4 mt-2">
          ${filtered.map((a) => {
            const rec = S.getSummary(a.id);
            const active = a.id === viewState.articleId;
            return `
              <button type="button" class="option-btn ${active ? "is-selected" : ""}" data-pick-article="${a.id}" style="flex-direction:column;align-items:flex-start;padding:0.55rem 0.7rem;">
                <div class="btn-row" style="justify-content:space-between;width:100%;">
                  <strong>Ch ${a.chapter} ${a.part}</strong>
                  ${a.metadataStatus === "pending" ? `<span class="badge badge-warn">待核对</span>` : `<span class="badge badge-neutral">${a.paragraphCount} 段</span>`}
                </div>
                <span lang="en" style="font-size:0.86rem;line-height:1.3;margin-block:0.2rem;">${esc(a.title)}</span>
                <span class="muted-text" style="font-size:0.78rem;">${esc(a.author)}</span>
                <div class="btn-row mt-1">${renderMasteryBadges(rec)}</div>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderArticleCard(a) {
    const S = window.PrepStore;
    const esc = S.esc;
    const rec = S.getSummary(a.id);

    return `
      <article class="card">
        <div class="btn-row" style="justify-content:space-between;">
          <div>
            <span class="badge badge-official">Chapter ${a.chapter} · ${a.part} · 共 ${a.paragraphCount} 段（原文 ${a.sourceWordCount} 词）</span>
            ${a.metadataStatus === "pending" ? `<span class="badge badge-warn">元数据待试卷核验</span>` : ""}
            ${renderMasteryBadges(rec)}
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-sm btn-outline" data-open-summary-src="${a.id}">弹窗看原文</button>
            ${S.hasLocalSources() ? `<a href="${esc(a.sourcePath)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">原文件</a>` : ""}
          </div>
        </div>

        <h3 class="mt-2" lang="en" style="font-size:1.25rem;">${esc(a.title)}</h3>
        <p class="mt-1"><strong>作者：</strong><span lang="en">${esc(a.author)}</span></p>
        <p class="mt-1"><strong>出处说明：</strong>${esc(a.sourceInfo)}</p>
        ${a.metadataNote ? `<div class="callout callout-warn"><strong>核验提示：</strong>${esc(a.metadataNote)}</div>` : ""}

        <div class="callout callout-official mt-2">
          <p><strong>中文一句话核心观点：</strong>${esc(a.oneSentenceMainIdeaZh)}</p>
          <p class="mt-1"><strong>主要论证结构：</strong>${esc(a.argumentStructure)}</p>
        </div>

        <h4 class="mt-2">段落逻辑合并分组（严禁机械逐段写一句！）</h4>
        <div style="overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>段落区间</th>
                <th>逻辑组主题</th>
                <th>核心论点（写入 Summary）</th>
                <th>必要支撑与应删冗余细节</th>
              </tr>
            </thead>
            <tbody>
              ${a.logicalGroups.map((g) => `
                <tr>
                  <td><strong>${esc(g.paraRange)}</strong></td>
                  <td><strong>${esc(g.groupTitle)}</strong></td>
                  <td>${esc(g.coreClaim)}<br><span class="muted-text">支撑：${esc(g.essentialSupport)}</span></td>
                  <td><span class="badge badge-warn">压缩指南</span> ${esc(g.detailsToOmit)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <div class="grid-2 mt-2">
          <div class="card" style="margin-block-end:0;">
            <h4>重点词汇、学术表达与上位替换</h4>
            <ul class="compact-list">
              ${a.vocabAndHypernyms.map((vh) => `
                <li>
                  <span class="muted-text" lang="en">${esc(vh.concrete)}</span> → <strong lang="en">${esc(vh.hypernym)}</strong><br>
                  <span class="muted-text">${esc(vh.zh)}</span>
                </li>
              `).join("")}
            </ul>
          </div>

          <div class="card" style="margin-block-end:0;">
            <h4>推荐记忆顺序与考场易漏点</h4>
            <p>${esc(a.memoryOrderAndPitfalls)}</p>
            <div class="callout mt-1">
              <strong>第一段统领参考句式：</strong>
              <p class="en-prose mt-1" lang="en">${esc(a.openingFormula)}</p>
            </div>
          </div>
        </div>

        <div class="mt-2">
          <div class="btn-row" style="justify-content:space-between;">
            <div class="btn-row">
              <button type="button" class="btn btn-primary" id="btn-toggle-model-summary">
                ${viewState.revealModel ? "遮挡 AI 精简参考范文" : "揭晓 AI 精简参考范文（先自己回忆再看）"}
              </button>
              <button type="button" class="btn btn-outline" data-summary-sub="opening">练第一段专项 →</button>
              <button type="button" class="btn btn-outline" data-summary-sub="timed">练全文限长默写 →</button>
            </div>
            <div class="btn-row">
              <button type="button" class="btn btn-sm ${rec.openingMastered ? "btn-primary" : "btn-outline"}" data-toggle-sum-flag="openingMastered">首段掌握 ${rec.openingMastered ? "✓" : ""}</button>
              <button type="button" class="btn btn-sm ${rec.structureMastered ? "btn-primary" : "btn-outline"}" data-toggle-sum-flag="structureMastered">结构掌握 ${rec.structureMastered ? "✓" : ""}</button>
              <button type="button" class="btn btn-sm ${rec.fullMastered ? "btn-primary" : "btn-outline"}" data-toggle-sum-flag="fullMastered">全文掌握 ${rec.fullMastered ? "✓" : ""}</button>
              <button type="button" class="btn btn-sm ${rec.inErrorBook ? "btn-danger" : "btn-danger-outline"}" data-toggle-sum-flag="inErrorBook">${rec.inErrorBook ? "已标待巩固 ✗" : "标为待巩固"}</button>
            </div>
          </div>

          ${viewState.revealModel ? `
            <div class="revealed-ai mt-2">
              <div class="btn-row" style="justify-content:space-between;">
                <span class="badge badge-ai">${esc(a.aiSummaryLabel)}</span>
                <span class="badge badge-official">精确词数：${a.wordCount} 词（原文 ${a.sourceWordCount} 词）· ${esc(a.recommendedRange)}</span>
              </div>
              <div class="en-prose mt-1" lang="en" style="white-space:pre-line;">${esc(a.aiReferenceSummary)}</div>
            </div>
          ` : `<div class="masked-panel muted-text">AI 生成学习参考范文已默认遮挡（精确词数 ${a.wordCount} 词）。建议先默出标题、作者、中文主旨和逻辑组再揭晓对照。</div>`}
        </div>

        <details class="disclosure mt-2">
          <summary>展开阅读英文原文全文（${a.paragraphCount} 段 · ${a.sourceWordCount} 词，用于核对忠实度）</summary>
          <div class="disclosure-body en-prose" lang="en">
            ${a.intro ? `<p class="muted-text mb-1"><em>导语：${esc(a.intro)}</em></p>` : ""}
            ${a.paragraphs.map((p) => `
              ${p.subheading ? `<h5>${esc(p.subheading)}</h5>` : ""}
              <p class="mb-1"><strong>[${p.num}]</strong> ${esc(p.text)}</p>
            `).join("")}
          </div>
        </details>
      </article>
    `;
  }

  function renderOpeningDrill(a) {
    const S = window.PrepStore;
    const esc = S.esc;
    const rec = S.getSummary(a.id);
    const diag = analyzeDraft(a, rec.lastOpeningDraft);

    return `
      <article class="card">
        <div class="btn-row" style="justify-content:space-between;">
          <h3>第一段统领专项训练（教师重点：长度合格 + 首段写好 ≈ 16/20 分）</h3>
          <button type="button" class="btn btn-sm btn-outline" data-open-summary-src="${a.id}">看全文抓主旨</button>
        </div>

        <div class="callout callout-official mt-1">
          <p><strong>当前篇目：</strong>Ch ${a.chapter} ${a.part} · <span lang="en"><strong>${esc(a.title)}</strong></span> · 作者：<span lang="en"><strong>${esc(a.author)}</strong></span></p>
          <p class="mt-1"><strong>出处规则提示：</strong>${esc(a.sourceInfo)}</p>
          <p class="mt-1"><strong>套用框架参考：</strong><code lang="en">In "[Title]," [Author] argues/claims/explains/examines that [Main Idea].</code></p>
        </div>

        <div class="mt-2">
          <label for="ta-opening-drill">请凭记忆写出包含「标题 + 作者 +（若有）出处 + 全文统领主旨」的第一段：</label>
          <textarea id="ta-opening-drill" rows="3" lang="en" placeholder='例：In "${esc(a.title)}," ${esc(a.author)} argues that ...'>${esc(rec.lastOpeningDraft)}</textarea>
        </div>

        <div class="btn-row mt-1">
          <span class="badge ${diag.hasTitle ? "badge-official" : "badge-warn"}">${diag.hasTitle ? "✓ 已含标题关键词" : "○ 未检出标题"}</span>
          <span class="badge ${diag.hasAuthor ? "badge-official" : "badge-warn"}">${diag.hasAuthor ? "✓ 已含作者" : "○ 未检出作者"}</span>
          <span class="badge ${diag.hasReportingVerb ? "badge-official" : "badge-neutral"}">${diag.hasReportingVerb ? "✓ 已用学术引述动词" : "○ 建议用 argues/examines/explains 等动词"}</span>
          <span class="badge badge-neutral">首段词数：${diag.wc} 词</span>
        </div>

        <div class="btn-row mt-2">
          <button type="button" class="btn btn-primary" id="btn-toggle-opening-model">${viewState.revealOpening ? "遮挡范文首段" : "揭晓参考首段与主旨对照"}</button>
          <button type="button" class="btn btn-outline" id="btn-mark-opening-ok">首段过关 ✓</button>
        </div>

        ${viewState.revealOpening ? `
          <div class="revealed-ai mt-2">
            <span class="badge badge-ai">参考首段模板（AI 辅助）</span>
            <p class="en-prose mt-1" lang="en">${esc(a.openingFormula)}</p>
            <p class="mt-1"><strong>中文核对核心主旨：</strong>${esc(a.oneSentenceMainIdeaZh)}</p>
          </div>
        ` : `<div class="masked-panel muted-text">写完后点击揭晓，核对你的首段是否真正统领全文（避免只写书名作者而不概括中心论点）。</div>`}
      </article>
    `;
  }

  function renderTimedAndChecker(a, isRandomMode) {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const esc = S.esc;
    const rec = S.getSummary(a.id);
    const diag = analyzeDraft(a, rec.lastDraft);
    const showDetails = !isRandomMode || !viewState.randomHideScaffold;
    const showModel = isRandomMode ? viewState.randomShowModel : viewState.revealModel;

    return `
      <article class="card">
        <div class="btn-row" style="justify-content:space-between;">
          <div>
            <h3>${isRandomMode ? "随机 16 选 1 考场全真模拟（20 分）" : "全文限长默写与教师十项检查器"}</h3>
            <p class="muted-text">Ch ${a.chapter} ${a.part} · <span lang="en"><strong>${esc(a.title)}</strong></span>（${esc(a.author)}）</p>
          </div>
          <div class="btn-row">
            ${isRandomMode ? `
              <button type="button" class="btn btn-primary" id="btn-pick-random-summary">🎲 再随机抽 1 篇</button>
              <button type="button" class="btn btn-outline" id="btn-toggle-scaffold">${viewState.randomHideScaffold ? "显示结构提示" : "切换纯考场视图"}</button>
            ` : ""}
            <button type="button" class="btn btn-outline" data-open-summary-src="${a.id}">阅读原文（${a.paragraphCount} 段）</button>
          </div>
        </div>

        ${a.metadataNote ? `<div class="callout callout-warn mt-1"><strong>待核验提示：</strong>${esc(a.metadataNote)}</div>` : ""}

        ${showDetails ? `
          <div class="callout mt-1">
            <strong>逻辑组记忆脚手架：</strong>
            <ul class="compact-list">
              ${a.logicalGroups.map((g) => `<li><strong>${esc(g.paraRange)} ${esc(g.groupTitle)}：</strong>${esc(g.coreClaim)}</li>`).join("")}
            </ul>
          </div>
        ` : `<div class="callout callout-official mt-1">当前处于<strong>纯考场盲写模式</strong>：只提供标题、作者与原文（请点上方“阅读原文”或下方直接默写）。</div>`}

        <div class="mt-2">
          <label for="ta-full-summary">限时默写 Summary 全文（控制篇幅、首段统领、合并段落、上位替换）：</label>
          <textarea id="ta-full-summary" rows="8" lang="en" placeholder="先写包含标题、作者和全文主旨的第一段，再用 1-2 段合并概括中间核心内容并清晰收尾...">${esc(rec.lastDraft)}</textarea>
        </div>

        <div class="word-meter ${diag.lengthLevel}" id="summary-word-meter">
          <div>
            <strong>实时词数：<span id="live-wc">${diag.wc}</span> 词</strong>
            <span class="muted-text"> · 句数 ${diag.sentCount}（均长 ${diag.avgWordsPerSent} 词/句）</span>
          </div>
          <div id="live-wc-note">${esc(diag.lengthNote)}</div>
        </div>

        <div class="btn-row mt-1">
          <span class="badge ${diag.hasTitle ? "badge-official" : "badge-danger"}">${diag.hasTitle ? "✓ 标题" : "✗ 缺标题"}</span>
          <span class="badge ${diag.hasAuthor ? "badge-official" : "badge-danger"}">${diag.hasAuthor ? "✓ 作者" : "✗ 缺作者"}</span>
          <span class="badge ${diag.hasReportingVerb ? "badge-official" : "badge-warn"}">${diag.hasReportingVerb ? "✓ 学术动词" : "○ 建议规范引述动词"}</span>
          <span class="badge ${diag.paraByParaMatch ? "badge-danger" : "badge-official"}">${diag.paraByParaMatch ? "⚠️ 检出机械逐段过渡词" : "✓ 未见机械逐段模板"}</span>
          <span class="badge ${diag.sentCount > 0 && diag.avgWordsPerSent < 12 ? "badge-warn" : "badge-neutral"}">${diag.sentCount > 0 && diag.avgWordsPerSent < 12 ? "⚠️ 句子偏短碎，建议合并从句" : "句长变化参考"}</span>
        </div>

        <div class="card mt-2" style="background:var(--bg-subtle);">
          <h4>Summary 10 项专项自检清单（基于老师口述经验，仅供参考，不构成自动精确评分）</h4>
          <div class="checklist-grid">
            ${D.teacherGuide.summaryChecklist.map((chk) => `
              <label class="check-item">
                <input type="checkbox" data-chk-id="${chk.id}" ${rec.lastChecklist && rec.lastChecklist[chk.id] ? "checked" : ""}>
                <span>${esc(chk.label)}</span>
              </label>
            `).join("")}
          </div>
          <p class="muted-text mt-1">
            阅卷经验对照：过长有低于 12/20 风险；长度合格且首段完整统领约 16/20；语法与句式再提档争取 17–18/20；19 分属极其惊艳。
          </p>
        </div>

        <div class="btn-row mt-2">
          <button type="button" class="btn btn-primary" id="btn-toggle-timed-model">${showModel ? "遮挡 AI 参考范文" : "提交并揭晓 AI 参考范文对照"}</button>
          <button type="button" class="btn btn-outline" id="btn-save-full-mastered">标记本篇全文过关 ✓</button>
          <button type="button" class="btn btn-danger-outline" id="btn-save-sum-error">加入待巩固列表 ✗</button>
        </div>

        ${showModel ? `
          <div class="revealed-ai mt-2">
            <div class="btn-row" style="justify-content:space-between;">
              <span class="badge badge-ai">${esc(a.aiSummaryLabel)}</span>
              <span class="badge badge-official">范文词数：${a.wordCount} 词（原文 ${a.sourceWordCount} 词）</span>
            </div>
            <div class="en-prose mt-1" lang="en" style="white-space:pre-line;">${esc(a.aiReferenceSummary)}</div>
          </div>
        ` : ""}
      </article>
    `;
  }

  function renderMergeDrills() {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const esc = S.esc;
    return `
      <div class="callout callout-official mb-2">
        <strong>段落合并与上位词替换专项（攻克第三、四关）：</strong>记住老师原话——“十几段的 B/C 文章不能每段一句话，要把讲同一件事的多段合并，用上位词概括细节（如 <code>cheating → academic dishonesty</code>）”。
      </div>
      ${D.summary16.map((a) => {
        const isRev = !!viewState.revealMerge[a.id];
        const draftKey = `merge-${a.id}`;
        const rec = S.getItem(draftKey);
        return `
          <article class="card">
            <div class="btn-row" style="justify-content:space-between;">
              <strong>Ch ${a.chapter} ${a.part} · <span lang="en">${esc(a.title)}</span></strong>
              <button type="button" class="btn btn-sm btn-outline" data-open-summary-src="${a.id}">看原文</button>
            </div>
            <p class="mt-1">${esc(a.mergePractice.prompt)}</p>
            <p class="muted-text mt-1">思路提示：${esc(a.mergePractice.hint)}</p>
            <textarea rows="2" lang="en" class="mt-1" data-merge-draft="${draftKey}" placeholder="尝试自己将上述多段合并压缩为一句话...">${esc(rec.draftText)}</textarea>
            <div class="btn-row mt-1">
              <button type="button" class="btn btn-sm btn-primary" data-toggle-merge="${a.id}">${isRev ? "遮挡参考压缩句" : "查看 AI 参考压缩句"}</button>
            </div>
            ${isRev ? `
              <div class="revealed-ai mt-1">
                <span class="badge badge-ai">参考合并概括句（AI 示例）</span>
                <p class="en-prose mt-1" lang="en">${esc(a.mergePractice.reference)}</p>
              </div>
            ` : ""}
          </article>
        `;
      }).join("")}
    `;
  }

  function renderGuideSection() {
    const D = window.EXAM_PREP_DATA;
    const esc = window.PrepStore.esc;
    return `
      <div class="card">
        <h3>2026 年 11 月 4 日课堂纪要：Summary 阅卷五关精髓</h3>
        ${D.teacherGuide.summaryFiveGates.map((g) => `
          <div class="callout ${g.gate === 1 ? "callout-danger" : g.gate === 2 ? "callout-official" : ""} mt-1">
            <h4>${esc(g.title)}</h4>
            <p><strong>教师原话规则：</strong>${esc(g.teacherRule)}</p>
            <p class="muted-text mt-1"><strong>学习与执行建议：</strong>${esc(g.studyAdvice)}</p>
          </div>
        `).join("")}
      </div>

      <div class="card">
        <h3>课堂真题范例与句式改写精讲（罗素 + 四道单段引用练习）</h3>
        ${D.teacherGuide.classroomExamples.map((ex) => `
          <div class="masked-panel" style="background:var(--bg-surface);border-style:solid;">
            <div class="btn-row" style="justify-content:space-between;">
              <strong>${esc(ex.title)}</strong>
              <span class="badge badge-official">${esc(ex.type)}</span>
            </div>
            <p class="muted-text mt-1"><strong>原文素材：</strong>${esc(ex.original)}</p>
            <p class="en-prose mt-1" lang="en"><strong>课堂范例：</strong>${esc(ex.model)}</p>
            <p class="mt-1"><strong>提分要点：</strong>${esc(ex.takeaway)}</p>
          </div>
        `).join("")}
      </div>
    `;
  }

  function render() {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const panel = document.getElementById("panel-summary");
    const a = getArticle(viewState.articleId);

    const subTabs = [
      { id: "cards", label: "16 篇备考卡片库" },
      { id: "opening", label: "第一段统领专项" },
      { id: "timed", label: "全文限长与十项自检" },
      { id: "merge", label: "段落合并/上位词训练" },
      { id: "random16", label: "随机 16 选 1 模拟" },
      { id: "guide", label: "教师五关与课堂范例" }
    ];

    let contentHtml = "";
    if (viewState.sub === "cards") {
      contentHtml = renderArticleSelector() + renderArticleCard(a);
    } else if (viewState.sub === "opening") {
      contentHtml = renderArticleSelector() + renderOpeningDrill(a);
    } else if (viewState.sub === "timed") {
      contentHtml = renderArticleSelector() + renderTimedAndChecker(a, false);
    } else if (viewState.sub === "random16") {
      contentHtml = renderTimedAndChecker(a, true);
    } else if (viewState.sub === "merge") {
      contentHtml = renderMergeDrills();
    } else {
      contentHtml = renderGuideSection();
    }

    panel.innerHTML = `
      <h2 id="tab-heading-summary">模块 C：16 篇 Summary 专项训练（Ch 1–8 B/C · 16 选 1 · 20 分）</h2>
      <div class="sub-toolbar">
        <div class="pill-group" role="group" aria-label="Summary 训练模式">
          ${subTabs.map((t) => `
            <button type="button" class="pill-btn ${viewState.sub === t.id ? "is-active" : ""}" data-sum-tab="${t.id}">${t.label}</button>
          `).join("")}
        </div>
      </div>
      ${contentHtml}
    `;

    // Bind events
    panel.querySelectorAll("[data-sum-tab]").forEach((b) => {
      b.addEventListener("click", () => {
        viewState.sub = b.dataset.sumTab;
        if (viewState.sub === "random16") {
          const all = D.summary16;
          viewState.articleId = all[Math.floor(Math.random() * all.length)].id;
          viewState.randomShowModel = false;
        }
        render();
      });
    });

    panel.querySelectorAll("[data-summary-sub]").forEach((b) => {
      b.addEventListener("click", () => {
        viewState.sub = b.dataset.summarySub;
        render();
      });
    });

    const searchInput = panel.querySelector("#summary-search");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        viewState.searchQuery = searchInput.value;
        render();
        const restored = document.getElementById("summary-search");
        if (restored) {
          restored.focus();
          restored.setSelectionRange(restored.value.length, restored.value.length);
        }
      });
    }

    panel.querySelectorAll("[data-ch-filter]").forEach((b) => {
      b.addEventListener("click", () => {
        viewState.filterChapter = b.dataset.chFilter;
        render();
      });
    });

    panel.querySelectorAll("[data-pick-article]").forEach((b) => {
      b.addEventListener("click", () => {
        viewState.articleId = b.dataset.pickArticle;
        viewState.revealModel = false;
        viewState.revealOpening = false;
        render();
      });
    });

    panel.querySelectorAll("[data-open-summary-src]").forEach((b) => {
      b.addEventListener("click", () => {
        window.PrepApp.openSummarySource(b.dataset.openSummarySrc);
      });
    });

    const modelBtn = panel.querySelector("#btn-toggle-model-summary");
    if (modelBtn) {
      modelBtn.addEventListener("click", () => {
        viewState.revealModel = !viewState.revealModel;
        render();
      });
    }

    panel.querySelectorAll("[data-toggle-sum-flag]").forEach((b) => {
      b.addEventListener("click", () => {
        const flag = b.dataset.toggleSumFlag;
        const cur = S.getSummary(a.id);
        S.updateSummary(a.id, { [flag]: !cur[flag] });
        S.announce("Summary 掌握状态已更新");
        render();
      });
    });

    // Opening drill handlers
    const taOpen = panel.querySelector("#ta-opening-drill");
    if (taOpen) {
      taOpen.addEventListener("input", () => {
        S.updateSummary(a.id, { lastOpeningDraft: taOpen.value });
      });
    }
    const openModelBtn = panel.querySelector("#btn-toggle-opening-model");
    if (openModelBtn) {
      openModelBtn.addEventListener("click", () => {
        viewState.revealOpening = !viewState.revealOpening;
        render();
      });
    }
    const markOpenBtn = panel.querySelector("#btn-mark-opening-ok");
    if (markOpenBtn) {
      markOpenBtn.addEventListener("click", () => {
        S.updateSummary(a.id, { openingMastered: true, attempts: S.getSummary(a.id).attempts + 1 });
        S.announce(`已标记 Ch ${a.chapter} ${a.part} 首段过关`);
        render();
      });
    }

    // Timed & Random full summary handlers (live update word meter without destroying cursor!)
    const taFull = panel.querySelector("#ta-full-summary");
    if (taFull) {
      taFull.addEventListener("input", () => {
        const d = analyzeDraft(a, taFull.value);
        S.updateSummary(a.id, { lastDraft: taFull.value, lastWordCount: d.wc });
        const meter = document.getElementById("summary-word-meter");
        const wcEl = document.getElementById("live-wc");
        const noteEl = document.getElementById("live-wc-note");
        if (wcEl) wcEl.textContent = d.wc;
        if (noteEl) noteEl.textContent = d.lengthNote;
        if (meter) meter.className = `word-meter ${d.lengthLevel}`;
      });
    }

    panel.querySelectorAll("[data-chk-id]").forEach((chk) => {
      chk.addEventListener("change", () => {
        const cur = S.getSummary(a.id);
        const nextMap = { ...(cur.lastChecklist || {}), [chk.dataset.chkId]: chk.checked };
        S.updateSummary(a.id, { lastChecklist: nextMap });
      });
    });

    const timedModelBtn = panel.querySelector("#btn-toggle-timed-model");
    if (timedModelBtn) {
      timedModelBtn.addEventListener("click", () => {
        if (viewState.sub === "random16") viewState.randomShowModel = !viewState.randomShowModel;
        else viewState.revealModel = !viewState.revealModel;
        render();
      });
    }

    const saveFullBtn = panel.querySelector("#btn-save-full-mastered");
    if (saveFullBtn) {
      saveFullBtn.addEventListener("click", () => {
        const cur = S.getSummary(a.id);
        S.updateSummary(a.id, {
          openingMastered: true,
          structureMastered: true,
          fullMastered: true,
          inErrorBook: false,
          attempts: cur.attempts + 1
        });
        S.announce(`已记录 Ch ${a.chapter} ${a.part} 全文掌握！`);
        render();
      });
    }

    const saveErrBtn = panel.querySelector("#btn-save-sum-error");
    if (saveErrBtn) {
      saveErrBtn.addEventListener("click", () => {
        const cur = S.getSummary(a.id);
        S.updateSummary(a.id, { inErrorBook: true, attempts: cur.attempts + 1 });
        S.announce("已加入待巩固列表");
        render();
      });
    }

    const pickRandBtn = panel.querySelector("#btn-pick-random-summary");
    if (pickRandBtn) {
      pickRandBtn.addEventListener("click", () => {
        const all = D.summary16;
        const others = all.filter((x) => x.id !== a.id);
        viewState.articleId = others[Math.floor(Math.random() * others.length)].id;
        viewState.randomShowModel = false;
        S.announce("已重新随机抽取一篇 Summary");
        render();
      });
    }

    const toggleScaffold = panel.querySelector("#btn-toggle-scaffold");
    if (toggleScaffold) {
      toggleScaffold.addEventListener("click", () => {
        viewState.randomHideScaffold = !viewState.randomHideScaffold;
        render();
      });
    }

    // Merge practice handlers
    panel.querySelectorAll("[data-merge-draft]").forEach((ta) => {
      ta.addEventListener("input", () => {
        S.saveItemDraft(ta.dataset.mergeDraft, ta.value);
      });
    });
    panel.querySelectorAll("[data-toggle-merge]").forEach((b) => {
      b.addEventListener("click", () => {
        viewState.revealMerge[b.dataset.toggleMerge] = !viewState.revealMerge[b.dataset.toggleMerge];
        render();
      });
    });
  }

  window.PrepSummaryUI = { render, setOptions, analyzeDraft };
})();
