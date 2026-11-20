(function () {
  "use strict";

  function computeMetrics() {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;

    let c2eTotal = 0, c2eMastered = 0, c2eErrors = 0;
    D.c2e.forEach((u) => {
      u.sentences.forEach((s) => {
        c2eTotal++;
        const r = S.getItem(s.id);
        if (r.streak >= 1 || r.lastResult === "correct") c2eMastered++;
        if (r.inErrorBook) c2eErrors++;
      });
    });

    let e2cTotal = 0, e2cMastered = 0, e2cErrors = 0;
    D.e2c.forEach((u) => {
      u.passages.forEach((p) => {
        e2cTotal++;
        const allSents = p.sentences;
        const pRec = S.getItem(p.id);
        const sentMastered = allSents.some((s) => S.getItem(s.id).lastResult === "correct");
        if (pRec.lastResult === "correct" || sentMastered) e2cMastered++;
        if (pRec.inErrorBook || allSents.some((s) => S.getItem(s.id).inErrorBook)) e2cErrors++;
      });
    });

    let clozeTotal = 0, clozeMastered = 0, clozeErrors = 0;
    D.cloze.forEach((u) => {
      u.clozeSimulation.questions.forEach((q) => {
        clozeTotal++;
        const r = S.getItem(q.id);
        if (r.lastResult === "correct") clozeMastered++;
        if (r.inErrorBook) clozeErrors++;
      });
    });

    let sumTotal = D.summary16.length, sumOpening = 0, sumStruct = 0, sumFull = 0, sumErrors = 0;
    D.summary16.forEach((a) => {
      const r = S.getSummary(a.id);
      if (r.openingMastered) sumOpening++;
      if (r.structureMastered) sumStruct++;
      if (r.fullMastered) sumFull++;
      if (r.inErrorBook) sumErrors++;
    });

    return {
      c2eTotal, c2eMastered, c2eErrors,
      e2cTotal, e2cMastered, e2cErrors,
      clozeTotal, clozeMastered, clozeErrors,
      sumTotal, sumOpening, sumStruct, sumFull, sumErrors
    };
  }

  function buildSprintQueue(minutes) {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const queue = [];

    // 1. Prioritize C2E errors / unpracticed sentences (highest ROI)
    const c2ePool = [];
    D.c2e.forEach((u) => {
      u.sentences.forEach((s) => {
        c2ePool.push({
          weight: S.getPriorityWeight(s.id),
          task: {
            tab: "translation",
            sub: "c2e",
            unit: u.unit,
            targetId: s.id,
            label: `中译英 Unit ${u.unit} 第 ${s.sentenceIndex} 句`
          }
        });
      });
    });
    c2ePool.sort((a, b) => b.weight - a.weight);

    // 2. E2C passages (prioritize Text A overlap passages & errors)
    const e2cPool = [];
    D.e2c.forEach((u) => {
      u.passages.forEach((p) => {
        const w = S.getPriorityWeight(p.id) + (p.isTextAOverlap ? 15 : 0);
        e2cPool.push({
          weight: w,
          task: {
            tab: "translation",
            sub: "e2c",
            unit: u.unit,
            targetId: p.id,
            label: `英译中 Unit ${u.unit} 原题 ${p.questionIndex}${p.isTextAOverlap ? "（Text A 同源）" : ""}`
          }
        });
      });
    });
    e2cPool.sort((a, b) => b.weight - a.weight);

    // 3. Cloze units sorted by remaining unmastered / error count
    const clozePool = D.cloze.map((u) => {
      let score = 0;
      u.clozeSimulation.questions.forEach((q) => { score += S.getPriorityWeight(q.id); });
      return {
        weight: score,
        task: {
          tab: "cloze",
          unit: u.unit,
          sub: "practice",
          label: `完形填空 Unit ${u.unit}（AI 模拟 10 空）`
        }
      };
    }).sort((a, b) => b.weight - a.weight);

    // 4. Summary articles sorted by unmastered status
    const sumPool = D.summary16.map((a) => {
      const r = S.getSummary(a.id);
      let w = 0;
      if (r.inErrorBook) w += 100;
      if (!r.openingMastered) w += 45;
      if (!r.structureMastered) w += 30;
      if (!r.fullMastered) w += 15;
      return {
        weight: w,
        task: {
          tab: "summary",
          sub: r.openingMastered ? "timed" : "opening",
          articleId: a.id,
          label: `Summary Ch${a.chapter} ${a.part}（${r.openingMastered ? "限长默写" : "首段统领"}）`
        }
      };
    }).sort((a, b) => b.weight - a.weight);

    if (minutes === 15) {
      c2ePool.slice(0, 3).forEach((x) => queue.push(x.task));
      e2cPool.slice(0, 1).forEach((x) => queue.push(x.task));
      sumPool.slice(0, 1).forEach((x) => queue.push(x.task));
    } else if (minutes === 30) {
      c2ePool.slice(0, 5).forEach((x) => queue.push(x.task));
      e2cPool.slice(0, 2).forEach((x) => queue.push(x.task));
      clozePool.slice(0, 1).forEach((x) => queue.push(x.task));
      sumPool.slice(0, 2).forEach((x) => queue.push(x.task));
    } else {
      c2ePool.slice(0, 8).forEach((x) => queue.push(x.task));
      e2cPool.slice(0, 3).forEach((x) => queue.push(x.task));
      clozePool.slice(0, 2).forEach((x) => queue.push(x.task));
      sumPool.slice(0, 3).forEach((x) => queue.push(x.task));
    }
    return queue;
  }

  function getRecommendedAction(m) {
    if (m.c2eErrors + m.e2cErrors + m.clozeErrors + m.sumErrors > 0) {
      return {
        title: `优先清理错题本中的 ${m.c2eErrors + m.e2cErrors + m.clozeErrors + m.sumErrors} 项薄弱题`,
        desc: "考前抢分最忌重复丢同一道题，建议先攻克已标红的翻译错句与完形错题。",
        btnText: "进入错题专练",
        tab: "mock",
        sub: "errors"
      };
    }
    if (m.c2eMastered < m.c2eTotal || m.e2cMastered < m.e2cTotal) {
      return {
        title: "第一轮优先：完成 5 句中译英与 10 段英译中",
        desc: "范围完全锁死且有教师最新标准译文，是最快拿满的确定性得分。",
        btnText: "立即背练翻译",
        tab: "translation"
      };
    }
    if (m.clozeMastered < m.clozeTotal) {
      return {
        title: "第二轮攻坚：吃透 5 篇 Text A 高频完形（10 分）",
        desc: "课内完形直接出自 Unit 1, 2, 3, 6, 7 五篇 Text A，练熟原词搭配与逻辑线索。",
        btnText: "开始完形训练",
        tab: "cloze"
      };
    }
    if (m.sumOpening < m.sumTotal) {
      return {
        title: "第三轮核心：冲刺 16 篇 Summary 首段与逻辑组（20 分）",
        desc: "老师明确表示长度合格且第一段统领全文即可先拿约 16/20，先把 16 篇标题/作者/主旨记全。",
        btnText: "训练 Summary 首段",
        tab: "summary",
        sub: "opening"
      };
    }
    return {
      title: "第四轮收口：全真随机模拟与限长演练",
      desc: "按实际考试结构随机抽题检验输出速度，保持手感与字数控制。",
      btnText: "开启全真模拟",
      tab: "mock"
    };
  }

  function render() {
    const D = window.EXAM_PREP_DATA;
    const S = window.PrepStore;
    const esc = S.esc;
    const m = computeMetrics();
    const rec = getRecommendedAction(m);

    const officialCount = m.c2eTotal + m.e2cTotal;
    const aiCount = m.clozeTotal + m.sumTotal;

    const panel = document.getElementById("panel-home");
    panel.innerHTML = `
      <h2 id="tab-heading-home">快速抢分总控台</h2>

      <div class="callout callout-official mb-2">
        <div class="btn-row" style="justify-content:space-between;">
          <div>
            <strong>当前最值得复习的任务：${esc(rec.title)}</strong>
            <p class="muted-text mt-1">${esc(rec.desc)}</p>
          </div>
          <button type="button" class="btn btn-primary" data-jump-tab="${esc(rec.tab)}" ${rec.sub ? `data-jump-sub="${esc(rec.sub)}"` : ""}>${esc(rec.btnText)} →</button>
        </div>
      </div>

      <div class="grid-4 mb-2">
        <article class="card">
          <div class="btn-row" style="justify-content:space-between;">
            <h3>翻译 · 中译英</h3>
            <span class="badge badge-official">官方原题</span>
          </div>
          <p class="muted-text">5 篇课文各抽 1 句（覆盖全 5 段 ${m.c2eTotal} 句） · 分值待确认</p>
          <progress class="metric-progress" value="${m.c2eMastered}" max="${m.c2eTotal}"></progress>
          <p><strong>${m.c2eMastered} / ${m.c2eTotal} 句</strong> 已答对 · 错题 <strong>${m.c2eErrors}</strong></p>
          <button type="button" class="btn btn-sm btn-outline mt-1" data-jump-tab="translation" data-jump-sub="c2e">练习中译英</button>
        </article>

        <article class="card">
          <div class="btn-row" style="justify-content:space-between;">
            <h3>翻译 · 英译中</h3>
            <span class="badge badge-official">官方原题</span>
          </div>
          <p class="muted-text">5 单元共 ${m.e2cTotal} 段（第 1 题与 Text A 同源） · 总分待确认</p>
          <progress class="metric-progress" value="${m.e2cMastered}" max="${m.e2cTotal}"></progress>
          <p><strong>${m.e2cMastered} / ${m.e2cTotal} 段</strong> 已练过 · 错题 <strong>${m.e2cErrors}</strong></p>
          <button type="button" class="btn btn-sm btn-outline mt-1" data-jump-tab="translation" data-jump-sub="e2c">练习英译中</button>
        </article>

        <article class="card">
          <div class="btn-row" style="justify-content:space-between;">
            <h3>课内完形填空</h3>
            <span class="badge badge-ai">AI 模拟训练</span>
          </div>
          <p class="muted-text">5 篇 Text A 选 1 篇 · <strong>10 分</strong>（50 道模拟空）</p>
          <progress class="metric-progress" value="${m.clozeMastered}" max="${m.clozeTotal}"></progress>
          <p><strong>${m.clozeMastered} / ${m.clozeTotal} 题</strong> 正确 · 错题 <strong>${m.clozeErrors}</strong></p>
          <button type="button" class="btn btn-sm btn-outline mt-1" data-jump-tab="cloze">练习完形</button>
        </article>

        <article class="card">
          <div class="btn-row" style="justify-content:space-between;">
            <h3>Summary 概述</h3>
            <span class="badge badge-ai">AI 参考范文</span>
          </div>
          <p class="muted-text">Ch 1–8 B/C 共 ${m.sumTotal} 篇选 1 · <strong>20 分</strong></p>
          <progress class="metric-progress" value="${m.sumOpening}" max="${m.sumTotal}"></progress>
          <p>首段 <strong>${m.sumOpening}/16</strong> · 结构 <strong>${m.sumStruct}/16</strong> · 全文 <strong>${m.sumFull}/16</strong></p>
          <button type="button" class="btn btn-sm btn-outline mt-1" data-jump-tab="summary">训练 Summary</button>
        </article>
      </div>

      <div class="grid-2">
        <article class="card">
          <h3>限时冲刺模式（自动按优先级组队）</h3>
          <p class="muted-text">根据可用复习时间，自动优先安排：未掌握/错题翻译 → Text A 完形 → Summary 首段与限长。</p>
          <div class="btn-row mt-2">
            <button type="button" class="btn btn-primary" data-sprint-min="15">15 分钟微冲刺（5 项）</button>
            <button type="button" class="btn btn-primary" data-sprint-min="30">30 分钟高效冲刺（10 项）</button>
            <button type="button" class="btn btn-outline" data-sprint-min="60">60 分钟深度冲刺（16 项）</button>
          </div>
          <div class="callout callout-warn mt-2">
            <strong>复习时间分配纪律（依据 11 月 4 日课堂纪要）：</strong>
            <ul class="compact-list">
              <li><strong>不投入主要时间：</strong>4 篇课外阅读理解（教师明确全是课外，无固定范围可背）与课外完形（已核查平台 72 小节均无独立对应材料）。</li>
              <li><strong>资料来源严格区分：</strong>本系统含 <strong>${officialCount}</strong> 项教材与教师官方翻译原题/句段，以及 <strong>${aiCount}</strong> 项 AI 辅助生成练习（50 道完形模拟空 + 16 篇 Summary 学习参考范文），全部明确标识不混淆。</li>
            </ul>
          </div>
        </article>

        <article class="card">
          <h3>四轮高分备考路径</h3>
          <ol class="compact-list">
            ${D.teacherGuide.studyRounds.map((r) => `
              <li class="mb-1">
                <strong>${esc(r.title)}</strong><br>
                <span class="muted-text">${esc(r.target)} — ${esc(r.why)}</span>
                <div><button type="button" class="btn btn-sm btn-outline mt-1" data-jump-tab="${esc(r.actionTab)}">进入第 ${r.round} 轮</button></div>
              </li>
            `).join("")}
          </ol>
        </article>
      </div>

      <article class="card">
        <h3>考试范围与分值对照核验表</h3>
        <div style="overflow-x:auto;">
          <table>
            <thead>
              <tr>
                <th>题型板块</th>
                <th>确定范围</th>
                <th>老师公布分值</th>
                <th>备考优先级</th>
                <th>资料与规则备注</th>
              </tr>
            </thead>
            <tbody>
              ${D.teacherGuide.examScope.map((row) => `
                <tr>
                  <td><strong>${esc(row.name)}</strong></td>
                  <td>${esc(row.scope)}</td>
                  <td>${esc(row.confirmedScore)}</td>
                  <td><span class="badge ${row.id === "reading" ? "badge-neutral" : "badge-official"}">${esc(row.priority)}</span></td>
                  <td>${esc(row.note)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    `;

    panel.querySelectorAll("[data-jump-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.PrepApp.navigate(btn.dataset.jumpTab, { sub: btn.dataset.jumpSub });
      });
    });

    panel.querySelectorAll("[data-sprint-min]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mins = Number(btn.dataset.sprintMin);
        const queue = buildSprintQueue(mins);
        window.PrepApp.startSprint(mins, queue);
      });
    });
  }

  window.PrepHomeUI = { render, computeMetrics };
})();
