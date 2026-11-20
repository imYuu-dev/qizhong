(function () {
  "use strict";

  const STORAGE_KEY = "hnu_grad_english_midterm_v1";
  const THEME_KEY = "color-scheme";

  function defaultState() {
    return {
      version: 1,
      items: {},        // keyed by itemId (c2e-..., e2c-..., cloze-...)
      summaries: {},    // keyed by ch01-b .. ch08-c
      mockHistory: [],  // array of completed mock summaries
      updatedAt: null
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        ...defaultState(),
        ...parsed,
        items: parsed.items || {},
        summaries: parsed.summaries || {},
        mockHistory: Array.isArray(parsed.mockHistory) ? parsed.mockHistory : []
      };
    } catch (e) {
      return defaultState();
    }
  }

  let state = loadState();
  const listeners = new Set();

  function saveState() {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Fall back silently to in-memory state if storage is blocked
    }
    listeners.forEach((fn) => {
      try { fn(state); } catch (_) {}
    });
  }

  function getItem(id) {
    return state.items[id] || {
      attempts: 0,
      correct: 0,
      streak: 0,
      lastResult: null,
      lastPracticedAt: null,
      inErrorBook: false,
      draftText: ""
    };
  }

  function recordAttempt(id, isCorrect, extra) {
    const prev = getItem(id);
    const nextStreak = isCorrect ? prev.streak + 1 : 0;
    state.items[id] = {
      ...prev,
      ...(extra || {}),
      attempts: prev.attempts + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
      streak: nextStreak,
      lastResult: isCorrect ? "correct" : "wrong",
      lastPracticedAt: new Date().toISOString(),
      // Auto enter error book on miss; auto clear after 2 consecutive correct answers
      inErrorBook: isCorrect ? (nextStreak >= 2 ? false : prev.inErrorBook) : true
    };
    saveState();
    return state.items[id];
  }

  function toggleErrorBook(id, forceVal) {
    const prev = getItem(id);
    const val = typeof forceVal === "boolean" ? forceVal : !prev.inErrorBook;
    state.items[id] = {
      ...prev,
      inErrorBook: val,
      streak: val ? 0 : prev.streak
    };
    saveState();
    return state.items[id];
  }

  function saveItemDraft(id, draftText) {
    const prev = getItem(id);
    state.items[id] = { ...prev, draftText };
    saveState();
  }

  function getSummary(aid) {
    return state.summaries[aid] || {
      openingMastered: false,
      structureMastered: false,
      fullMastered: false,
      attempts: 0,
      lastWordCount: 0,
      lastDraft: "",
      lastOpeningDraft: "",
      lastChecklist: {},
      inErrorBook: false,
      lastPracticedAt: null
    };
  }

  function updateSummary(aid, patch) {
    const prev = getSummary(aid);
    state.summaries[aid] = {
      ...prev,
      ...patch,
      lastPracticedAt: new Date().toISOString()
    };
    saveState();
    return state.summaries[aid];
  }

  function addMockHistory(entry) {
    state.mockHistory.unshift({
      ...entry,
      createdAt: new Date().toISOString()
    });
    if (state.mockHistory.length > 20) state.mockHistory.length = 20;
    saveState();
  }

  function exportJson() {
    return JSON.stringify(state, null, 2);
  }

  function importJson(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object" || !parsed.items || !parsed.summaries) {
      throw new Error("备份文件格式不正确，缺少 items 或 summaries 字段。");
    }
    state = {
      ...defaultState(),
      ...parsed,
      items: parsed.items || {},
      summaries: parsed.summaries || {},
      mockHistory: Array.isArray(parsed.mockHistory) ? parsed.mockHistory : []
    };
    saveState();
  }

  function resetAll() {
    state = defaultState();
    saveState();
  }

  function getErrorCount() {
    let count = 0;
    for (const k of Object.keys(state.items)) {
      if (state.items[k].inErrorBook) count++;
    }
    for (const k of Object.keys(state.summaries)) {
      if (state.summaries[k].inErrorBook) count++;
    }
    return count;
  }

  function getPriorityWeight(id) {
    const rec = getItem(id);
    if (rec.inErrorBook) return 100;
    if (rec.attempts === 0) return 60;
    if (rec.lastResult === "wrong") return 80;
    if (rec.streak >= 2) return 10; // mastered: lower review frequency
    return 35;
  }

  function esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function countWords(text) {
    if (!text || !text.trim()) return 0;
    const matches = text.match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g);
    return matches ? matches.length : 0;
  }

  function announce(msg) {
    const live = document.getElementById("live-announcer");
    if (live) {
      live.textContent = "";
      requestAnimationFrame(() => { live.textContent = msg; });
    }
    const toast = document.getElementById("toast-bar");
    if (toast) {
      toast.textContent = msg;
      toast.hidden = false;
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => { toast.hidden = true; }, 2600);
    }
  }

  function getThemePreference() {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === "light" || v === "dark" ? v : "system";
    } catch (_) {
      return "system";
    }
  }

  function setThemePreference(mode) {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (mode === "light" || mode === "dark") {
      if (meta) meta.content = mode;
      try { localStorage.setItem(THEME_KEY, mode); } catch (_) {}
    } else {
      if (meta) meta.content = "light dark";
      try { localStorage.removeItem(THEME_KEY); } catch (_) {}
    }
  }

  function isHostedWithPolitics() {
    return /\/english(\/|$)/i.test(location.pathname) || location.hostname.endsWith("github.io");
  }

  function hasLocalSources() {
    return !isHostedWithPolitics() && (location.protocol === "file:" || location.hostname === "localhost" || location.hostname === "127.0.0.1");
  }

  window.PrepStore = {
    getState: () => state,
    subscribe: (fn) => listeners.add(fn),
    getItem,
    recordAttempt,
    toggleErrorBook,
    saveItemDraft,
    getSummary,
    updateSummary,
    addMockHistory,
    exportJson,
    importJson,
    resetAll,
    getErrorCount,
    getPriorityWeight,
    esc,
    countWords,
    announce,
    getThemePreference,
    setThemePreference,
    hasLocalSources,
    isHostedWithPolitics
  };
})();
