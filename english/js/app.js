(function () {
  "use strict";

  const TAB_TITLES = {
    home: "快速抢分 | 研究生英语期中备考系统",
    translation: "翻译快背 | 研究生英语期中备考系统",
    cloze: "完形专练 | 研究生英语期中备考系统",
    summary: "16 篇 Summary | 研究生英语期中备考系统",
    mock: "全真模拟与错题本 | 研究生英语期中备考系统"
  };

  let currentTab = "home";
  const sprint = {
    active: false,
    queue: [],
    index: 0,
    remainingSec: 0,
    timerId: null
  };

  function renderCurrentTab() {
    if (currentTab === "home") window.PrepHomeUI.render();
    else if (currentTab === "translation") window.PrepTranslationUI.render();
    else if (currentTab === "cloze") window.PrepClozeUI.render();
    else if (currentTab === "summary") window.PrepSummaryUI.render();
    else if (currentTab === "mock") window.PrepMockUI.render();
  }

  function navigate(tab, opts) {
    if (!TAB_TITLES[tab]) tab = "home";
    currentTab = tab;

    if (tab === "translation" && opts) window.PrepTranslationUI.setOptions(opts);
    if (tab === "cloze" && opts) window.PrepClozeUI.setOptions(opts);
    if (tab === "summary" && opts) window.PrepSummaryUI.setOptions(opts);
    if (tab === "mock" && opts) window.PrepMockUI.setOptions(opts);

    document.querySelectorAll(".nav-tab").forEach((btn) => {
      const isCur = btn.dataset.tab === tab;
      btn.classList.toggle("is-active", isCur);
      if (isCur) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });

    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.id !== `panel-${tab}`;
    });

    document.title = TAB_TITLES[tab];
    renderCurrentTab();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formatMMSS(sec) {
    const s = Math.max(0, sec);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function updateSprintBanner() {
    const banner = document.getElementById("sprint-banner");
    const titleEl = document.getElementById("sprint-title");
    const detailEl = document.getElementById("sprint-detail");
    const timerEl = document.getElementById("sprint-timer");
    const nextBtn = document.getElementById("btn-sprint-next");
    if (!banner) return;

    if (!sprint.active || sprint.queue.length === 0) {
      banner.hidden = true;
      return;
    }

    const cur = sprint.queue[sprint.index];
    banner.hidden = false;
    titleEl.textContent = `冲刺队列 第 ${sprint.index + 1} / ${sprint.queue.length} 项：`;
    detailEl.textContent = cur.label;
    timerEl.textContent = formatMMSS(sprint.remainingSec);
    nextBtn.textContent = sprint.index + 1 < sprint.queue.length ? "完成本项 → 下一项" : "完成全部冲刺 ✓";
  }

  function executeSprintItem(item) {
    navigate(item.tab, item);
    updateSprintBanner();
  }

  function startSprint(minutes, queue) {
    if (!queue || !queue.length) return;
    sprint.active = true;
    sprint.queue = queue;
    sprint.index = 0;
    sprint.remainingSec = minutes * 60;
    if (sprint.timerId) clearInterval(sprint.timerId);
    sprint.timerId = setInterval(() => {
      if (!sprint.active) return;
      sprint.remainingSec--;
      const timerEl = document.getElementById("sprint-timer");
      if (timerEl) timerEl.textContent = formatMMSS(sprint.remainingSec);
      if (sprint.remainingSec <= 0) {
        clearInterval(sprint.timerId);
        window.PrepStore.announce("限时冲刺时间到！请完成手头这道题后复盘错题本。");
      }
    }, 1000);
    window.PrepStore.announce(`已启动 ${minutes} 分钟冲刺模式，共安排 ${queue.length} 项高价值任务`);
    executeSprintItem(queue[0]);
  }

  function stopSprint() {
    sprint.active = false;
    if (sprint.timerId) clearInterval(sprint.timerId);
    updateSprintBanner();
    navigate("home");
  }

  function openTextASource(unitNum, highlightPara) {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const esc = S.esc;
    const unitObj = D.cloze.find((u) => u.unit === Number(unitNum));
    if (!unitObj) return;

    const dlg = document.getElementById("dialog-source");
    const titleEl = document.getElementById("dialog-source-title");
    const bodyEl = document.getElementById("dialog-source-body");

    titleEl.textContent = `Unit ${unitObj.unit} Text A 原文溯源：${unitObj.title}`;
    const localFiles = S.hasLocalSources();
    bodyEl.innerHTML = `
      <div class="callout callout-official mb-2">
        <p><strong>作者：</strong>${esc(unitObj.author)}${localFiles ? ` · <strong>来源：</strong><a href="${esc(unitObj.sourcePath)}" target="_blank" rel="noopener">${esc(unitObj.sourcePath)}</a>` : ""}</p>
        ${localFiles ? `
          <p class="mt-1"><strong>扫描页快捷跳转：</strong>
            ${unitObj.scans.map((sc) => `
              <a href="${esc(sc.anchor)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline" style="margin-inline-end:0.35rem;">第 ${sc.page} 页图文对照 (${sc.paras[0]}–${sc.paras[sc.paras.length - 1]}段)</a>
              <a href="${esc(sc.img)}" target="_blank" rel="noopener" class="muted-text" style="margin-inline-end:0.6rem;">[原图]</a>
            `).join("")}
          </p>
        ` : `<p class="muted-text mt-1">在线版已保留原文段落核对；原始扫描图片仅存于本地离线目录，未推送至公开仓库。</p>`}
      </div>
      ${unitObj.notes.length ? `<div class="callout callout-warn mb-2">${unitObj.notes.map((n) => esc(n)).join("<br>")}</div>` : ""}
      <div class="en-prose" lang="en">
        ${unitObj.paragraphs.map((p) => {
          const isTarget = Number(highlightPara) === p.num;
          return `
            <div class="source-para ${isTarget ? "is-highlighted" : ""}" id="modal-para-${p.num}">
              <div class="btn-row" style="justify-content:space-between;">
                <span class="badge ${isTarget ? "badge-warn" : "badge-neutral"}">第 [${p.num}] 段 · 扫描第 ${p.scanPages.join("/")} 页</span>
                ${localFiles && p.proofreadLink ? `<a href="${esc(p.proofreadLink)}" target="_blank" rel="noopener" class="muted-text" style="font-size:0.84rem;">核对原图</a>` : ""}
              </div>
              ${p.section ? `<h4 class="mt-1">${esc(p.section)}</h4>` : ""}
              <p class="mt-1">${esc(p.text)}</p>
            </div>
          `;
        }).join("")}
      </div>
    `;

    dlg.showModal();
    if (highlightPara) {
      const target = document.getElementById(`modal-para-${highlightPara}`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function openSummarySource(articleId) {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const esc = S.esc;
    const a = D.summary16.find((x) => x.id === articleId);
    if (!a) return;

    const dlg = document.getElementById("dialog-source");
    const titleEl = document.getElementById("dialog-source-title");
    const bodyEl = document.getElementById("dialog-source-body");

    titleEl.textContent = `Ch ${a.chapter} ${a.part} 原文：${a.title}`;
    const localFiles = S.hasLocalSources();
    bodyEl.innerHTML = `
      <div class="callout callout-official mb-2">
        <p><strong>作者：</strong><span lang="en">${esc(a.author)}</span> · <strong>共 ${a.paragraphCount} 段（${a.sourceWordCount} 词）</strong></p>
        ${localFiles ? `<p class="mt-1"><strong>文件出处：</strong><a href="${esc(a.sourcePath)}" target="_blank" rel="noopener">${esc(a.sourcePath)}</a></p>` : ""}
        ${a.metadataNote ? `<p class="mt-1"><strong>核验提示：</strong>${esc(a.metadataNote)}</p>` : ""}
      </div>
      <div class="en-prose" lang="en">
        ${a.intro ? `<p class="muted-text mb-2"><em>${esc(a.intro)}</em></p>` : ""}
        ${a.paragraphs.map((p) => `
          ${p.subheading ? `<h4>${esc(p.subheading)}</h4>` : ""}
          <div class="source-para">
            <p><strong>[${p.num}]</strong> ${esc(p.text)}</p>
          </div>
        `).join("")}
      </div>
    `;
    dlg.showModal();
  }

  function openGuideDialog() {
    const D = window.EXAM_PREP_DATA;
    const esc = window.PrepStore.esc;
    const dlg = document.getElementById("dialog-guide");
    const body = document.getElementById("dialog-guide-body");

    body.innerHTML = `
      <p class="muted-text mb-2">来源：${esc(D.teacherGuide.meta.sourceDoc)}（${esc(D.teacherGuide.meta.institution)}）</p>
      ${D.teacherGuide.summaryFiveGates.map((g) => `
        <div class="callout ${g.gate === 1 ? "callout-danger" : g.gate === 2 ? "callout-official" : ""} mb-1">
          <h3>${esc(g.title)}</h3>
          <p><strong>课堂原规则：</strong>${esc(g.teacherRule)}</p>
          <p class="muted-text mt-1"><strong>执行建议：</strong>${esc(g.studyAdvice)}</p>
        </div>
      `).join("")}
      <div class="callout mt-2">
        <strong>罗素《What I Have Lived For》课堂改写金句：</strong>
        <p class="en-prose mt-1" lang="en">In "What I Have Lived For," the prologue to his autobiography, Bertrand Russell sums up the three passions that governed his life.</p>
        <p class="en-prose mt-1" lang="en">His inability to lessen human suffering brought him great pain and sorrow.</p>
      </div>
    `;
    dlg.showModal();
  }

  function refreshHeaderAndSettings() {
    const S = window.PrepStore;
    const badge = document.getElementById("header-error-count");
    if (badge) badge.textContent = S.getErrorCount();

    const statsList = document.getElementById("settings-stats-list");
    if (statsList) {
      const st = window.EXAM_PREP_DATA.stats;
      statsList.innerHTML = `
        <li><strong>官方中译英：</strong>${st.c2eUnits} 个单元 / ${st.c2eSentences} 个精准对齐句子（只读保留）</li>
        <li><strong>官方英译中：</strong>${st.e2cPassages} 段 / ${st.e2cSentences} 句（第 1 题均标明 Text A 同源位置）</li>
        <li><strong>Text A 完形（AI 模拟）：</strong>${st.clozeUnits} 篇 / ${st.clozeQuestions} 道模拟空（清晰标注 AI 模拟）</li>
        <li><strong>Summary 16 篇（AI 参考范文）：</strong>${st.summaryArticles} 篇全部独立建卡（112–149 词精简示范）</li>
      `;
    }
  }

  function setupDialogsAndTheme() {
    // Fallback light dismiss only when browser lacks dialog closedBy
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      document.querySelectorAll('dialog[closedby="any"]').forEach((dialog) => {
        let pressedOutside = false;
        dialog.addEventListener("pointerdown", (e) => { pressedOutside = outside(e, dialog); });
        dialog.addEventListener("pointerup", (e) => {
          if (pressedOutside && outside(e, dialog)) dialog.close();
        });
      });
    }

    document.querySelectorAll("dialog").forEach((dlg) => {
      dlg.addEventListener("close", () => { dlg.returnValue = ""; });
    });

    // Theme UI sync
    const S = window.PrepStore;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemHint = () => {
      const hint = document.getElementById("system-theme-hint");
      if (hint) hint.textContent = mq.matches ? "当前深色" : "当前浅色";
    };
    updateSystemHint();
    mq.addEventListener("change", updateSystemHint);

    const syncThemeRadios = () => {
      const pref = S.getThemePreference();
      const radio = document.querySelector(`input[name="theme-mode"][value="${pref}"]`);
      if (radio) radio.checked = true;
    };
    syncThemeRadios();

    document.querySelectorAll('input[name="theme-mode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.checked) {
          S.setThemePreference(radio.value);
          S.announce("外观主题已切换");
        }
      });
    });

    window.addEventListener("storage", (e) => {
      if (e.key === "color-scheme") {
        S.setThemePreference(S.getThemePreference());
        syncThemeRadios();
      }
    });

    // Backup Export / Import / Reset
    document.getElementById("btn-export-progress").addEventListener("click", () => {
      const json = S.exportJson();
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `english-midterm-progress-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      S.announce("学习进度 JSON 已导出");
    });

    document.getElementById("input-import-progress").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          S.importJson(String(reader.result || ""));
          refreshHeaderAndSettings();
          renderCurrentTab();
          S.announce("学习进度已成功恢复！");
        } catch (err) {
          S.announce("恢复失败：" + err.message);
        }
      };
      reader.readAsText(file, "utf-8");
      e.target.value = "";
    });

    const resetBox = document.getElementById("reset-confirm-box");
    document.getElementById("btn-request-reset").addEventListener("click", () => { resetBox.hidden = false; });
    document.getElementById("btn-cancel-reset").addEventListener("click", () => { resetBox.hidden = true; });
    document.getElementById("btn-confirm-reset").addEventListener("click", () => {
      S.resetAll();
      resetBox.hidden = true;
      refreshHeaderAndSettings();
      renderCurrentTab();
      S.announce("已清空全部练习记录");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.EXAM_PREP_DATA) {
      document.getElementById("main-content").innerHTML = `<div class="card"><h2>数据加载失败</h2><p>未找到离线数据包 <code>data/bundle.js</code>。</p></div>`;
      return;
    }

    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => navigate(btn.dataset.tab));
    });

    document.getElementById("btn-open-guide").addEventListener("click", openGuideDialog);
    document.getElementById("btn-jump-errors").addEventListener("click", () => navigate("mock", { sub: "errors" }));
    document.getElementById("btn-open-settings").addEventListener("click", () => {
      refreshHeaderAndSettings();
      document.getElementById("dialog-settings").showModal();
    });

    document.getElementById("btn-sprint-next").addEventListener("click", () => {
      if (!sprint.active) return;
      if (sprint.index + 1 < sprint.queue.length) {
        sprint.index++;
        executeSprintItem(sprint.queue[sprint.index]);
      } else {
        window.PrepStore.announce("恭喜完成本轮全部冲刺任务！");
        stopSprint();
      }
    });
    document.getElementById("btn-sprint-stop").addEventListener("click", stopSprint);

    setupDialogsAndTheme();
    const switchPolBtn = document.getElementById("btn-switch-politics");
    if (switchPolBtn && window.PrepStore.isHostedWithPolitics()) {
      switchPolBtn.hidden = false;
    }
    const footerLocal = document.getElementById("footer-local-links");
    if (footerLocal && !window.PrepStore.hasLocalSources()) {
      footerLocal.hidden = true;
      footerLocal.innerHTML = "";
    }
    window.PrepStore.subscribe(refreshHeaderAndSettings);
    refreshHeaderAndSettings();
    navigate("home");
  });

  window.PrepApp = {
    navigate,
    startSprint,
    stopSprint,
    openTextASource,
    openSummarySource
  };
})();
