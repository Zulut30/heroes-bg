(function () {
  const refreshBtn = document.getElementById("admin-refresh");
  const addManualBtn = document.getElementById("admin-add-manual");
  const saveLocalBtn = document.getElementById("admin-save-local");
  const exportBtn = document.getElementById("admin-export");
  const loadPublishedBtn = document.getElementById("admin-load-published");
  const clearDraftBtn = document.getElementById("admin-clear-draft");
  const searchInput = document.getElementById("admin-search");
  const sourceFiltersEl = document.getElementById("admin-source-filters");
  const poolListEl = document.getElementById("admin-pool-list");
  const tiersEl = document.getElementById("admin-tiers");
  const statusEl = document.getElementById("admin-status");
  const sourceStatusEl = document.getElementById("admin-source-status");
  const diagnosticsEl = document.getElementById("admin-diagnostics");
  const diagnosticsBodyEl = document.getElementById("admin-diagnostics-body");
  const importUrlInput = document.getElementById("admin-import-url");
  const importUrlBtn = document.getElementById("admin-import-url-btn");
  const importJsonInput = document.getElementById("admin-import-json");
  const importJsonBtn = document.getElementById("admin-import-json-btn");
  const importResultEl = document.getElementById("admin-import-result");

  const TIER_ORDER = ["S", "A", "B", "C", "D"];
  const POOL_KEY = "POOL";
  const STORAGE_KEY = "admin-comps-draft-v1";
  const DIFFICULTIES = ["Easy", "Medium", "Hard"];
  const TRENDS = [
    { value: "up", label: "▲" },
    { value: "stable", label: "•" },
    { value: "down", label: "▼" }
  ];
  const RACE_ICON = {
    BEAST: "./assset/зверь.webp",
    DEMON: "./assset/демоны.webp",
    DRAGON: "./assset/драконы.webp",
    ELEMENTAL: "./assset/элементали.webp",
    MECHANICAL: "./assset/механизмы.webp",
    MURLOC: "./assset/мурлоки.webp",
    NAGA: "./assset/наги.webp",
    PIRATE: "./assset/пираты.webp",
    QUILBOAR: "./assset/свинобразы.webp",
    UNDEAD: "./assset/нежить.webp",
    NONE: "./assset/общее.webp",
    ALL: "./assset/общее.webp"
  };
  const RACE_OPTIONS = Object.keys(RACE_ICON);

  const state = {
    comps: new Map(), // uid -> normalized comp
    placements: { [POOL_KEY]: [], S: [], A: [], B: [], C: [], D: [] },
    sourceFilter: "ALL",
    search: ""
  };

  const escape = (value) => window.Shared.escapeHtml(value);

  function makeUid(prefix = "comp") {
    if (window.crypto && window.crypto.randomUUID) {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function setStatus(text, tone) {
    statusEl.textContent = text;
    statusEl.dataset.tone = tone || "";
  }

  function loadDraft() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.comps)) return false;
      state.comps = new Map();
      parsed.comps.forEach((comp) => {
        const uid = comp.uid || makeUid();
        state.comps.set(uid, { ...comp, uid });
      });
      state.placements = { [POOL_KEY]: [], S: [], A: [], B: [], C: [], D: [] };
      const valid = new Set(state.comps.keys());
      [POOL_KEY, ...TIER_ORDER].forEach((bucket) => {
        const list = parsed.placements?.[bucket] || [];
        state.placements[bucket] = list.filter((uid) => valid.has(uid));
      });
      const placed = new Set([...Object.values(state.placements).flat()]);
      [...state.comps.keys()].forEach((uid) => {
        if (!placed.has(uid)) state.placements[POOL_KEY].push(uid);
      });
      return true;
    } catch (error) {
      console.warn("Не удалось прочитать черновик", error);
      return false;
    }
  }

  function saveDraft() {
    try {
      const payload = {
        savedAt: new Date().toISOString(),
        comps: [...state.comps.values()],
        placements: state.placements
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("Не удалось сохранить черновик", error);
    }
  }

  function ingestFromSources(payload) {
    const incoming = (payload?.comps || []).filter(Boolean);
    if (!incoming.length) return 0;
    // Deduplicate already-known by sourceId; keep edits the admin made.
    const knownBySource = new Map();
    state.comps.forEach((comp) => {
      if (comp.sourceId) knownBySource.set(comp.sourceId, comp.uid);
    });
    let added = 0;
    incoming.forEach((rawComp) => {
      const sourceId = rawComp.sourceId || `${rawComp.source}:${rawComp.name}`;
      if (knownBySource.has(sourceId)) return;
      const uid = makeUid(rawComp.source);
      const comp = {
        uid,
        sourceId,
        source: rawComp.source || "manual",
        tier: rawComp.tier || "B",
        race: rawComp.race || "NONE",
        name: rawComp.name || "Без названия",
        subtitle: rawComp.subtitle || "",
        summary: rawComp.summary || "",
        difficulty: rawComp.difficulty || "Medium",
        trend: rawComp.trend || "stable",
        cards: (rawComp.cards || []).map((card) => ({ id: card.id || "", name: card.name || "" }))
      };
      state.comps.set(uid, comp);
      state.placements[POOL_KEY].push(uid);
      added += 1;
    });
    return added;
  }

  function getBucketForUid(uid) {
    return [POOL_KEY, ...TIER_ORDER].find((bucket) => state.placements[bucket].includes(uid));
  }

  function moveCompTo(uid, bucket, indexOverride) {
    const current = getBucketForUid(uid);
    if (!current) return;
    state.placements[current] = state.placements[current].filter((id) => id !== uid);
    const target = state.placements[bucket];
    if (typeof indexOverride === "number" && indexOverride >= 0) {
      target.splice(Math.min(indexOverride, target.length), 0, uid);
    } else {
      target.push(uid);
    }
    if (bucket !== POOL_KEY) {
      const comp = state.comps.get(uid);
      if (comp) comp.tier = bucket;
    }
    saveDraft();
    render();
  }

  function reorderInBucket(uid, direction) {
    const bucket = getBucketForUid(uid);
    if (!bucket) return;
    const list = state.placements[bucket];
    const index = list.indexOf(uid);
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    list.splice(index, 1);
    list.splice(target, 0, uid);
    saveDraft();
    render();
  }

  function deleteComp(uid) {
    if (!confirm("Удалить эту стратегию из админки?")) return;
    state.comps.delete(uid);
    [POOL_KEY, ...TIER_ORDER].forEach((bucket) => {
      state.placements[bucket] = state.placements[bucket].filter((id) => id !== uid);
    });
    saveDraft();
    render();
  }

  function updateComp(uid, patch) {
    const comp = state.comps.get(uid);
    if (!comp) return;
    Object.assign(comp, patch);
    saveDraft();
  }

  function buildSourceChips() {
    const sources = ["ALL", ...new Set([...state.comps.values()].map((c) => c.source))];
    const labels = { ALL: "Все источники", firestone: "Firestone", hsreplay: "HSReplay", manual: "Ручные" };
    sourceFiltersEl.replaceChildren();
    sources.forEach((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chip${state.sourceFilter === value ? " is-active" : ""}`;
      button.innerHTML = `<span class="chip-label">${escape(labels[value] || value)}</span>`;
      button.addEventListener("click", () => {
        state.sourceFilter = value;
        renderPool();
        buildSourceChips();
      });
      sourceFiltersEl.append(button);
    });
  }

  function compMatchesFilters(comp) {
    if (state.sourceFilter !== "ALL" && comp.source !== state.sourceFilter) return false;
    if (state.search) {
      const haystack = `${comp.name} ${comp.subtitle} ${comp.summary} ${comp.race}`.toLowerCase();
      if (!haystack.includes(state.search.toLowerCase())) return false;
    }
    return true;
  }

  function renderCompCard(uid, options = {}) {
    const comp = state.comps.get(uid);
    if (!comp) return null;
    const article = document.createElement("article");
    article.className = `admin-comp${options.compact ? " admin-comp-compact" : ""}`;
    article.dataset.uid = uid;
    article.draggable = true;

    const raceIcon = RACE_ICON[comp.race] || RACE_ICON.NONE;
    const safeName = escape(comp.name);
    const safeSubtitle = escape(comp.subtitle);
    const safeSummary = escape(comp.summary);
    const sourceBadge = comp.source ? `<span class="admin-comp-source admin-comp-source-${comp.source}">${escape(comp.source)}</span>` : "";

    const cardsHtml = (comp.cards || []).slice(0, 6).map((card) => {
      const safeCardName = escape(card.name || card.id || "");
      const src = card.id ? `/api/card-art?id=${encodeURIComponent(card.id)}&locale=ruRU&size=256x` : "";
      return src
        ? `<li class="admin-card" title="${safeCardName}"><img src="${src}" alt="${safeCardName}" loading="lazy" decoding="async"></li>`
        : `<li class="admin-card admin-card-empty" title="${safeCardName}">${safeCardName.slice(0, 1) || "?"}</li>`;
    }).join("");

    const tierOptions = TIER_ORDER.map((t) => `<option value="${t}"${comp.tier === t ? " selected" : ""}>${t}</option>`).join("");
    const difficultyOptions = DIFFICULTIES.map((d) => `<option value="${d}"${comp.difficulty === d ? " selected" : ""}>${d}</option>`).join("");
    const trendOptions = TRENDS.map((t) => `<option value="${t.value}"${comp.trend === t.value ? " selected" : ""}>${t.label} ${t.value}</option>`).join("");
    const raceOptions = RACE_OPTIONS.map((r) => `<option value="${r}"${comp.race === r ? " selected" : ""}>${r}</option>`).join("");

    article.innerHTML = `
      <header class="admin-comp-head">
        <span class="admin-comp-icon" style="background-image:url('${raceIcon}')" aria-hidden="true"></span>
        <div class="admin-comp-titles">
          <input class="admin-input admin-name" data-field="name" value="${safeName}" placeholder="Название">
          <input class="admin-input admin-subtitle" data-field="subtitle" value="${safeSubtitle}" placeholder="EN-сабтайтл">
        </div>
        ${sourceBadge}
      </header>
      <textarea class="admin-input admin-summary" data-field="summary" rows="2" placeholder="Описание стратегии">${safeSummary}</textarea>
      <div class="admin-comp-meta">
        <label>Тир<select class="admin-input" data-field="tier">${tierOptions}</select></label>
        <label>Сложность<select class="admin-input" data-field="difficulty">${difficultyOptions}</select></label>
        <label>Тренд<select class="admin-input" data-field="trend">${trendOptions}</select></label>
        <label>Раса<select class="admin-input" data-field="race">${raceOptions}</select></label>
      </div>
      <ul class="admin-comp-cards">${cardsHtml || '<li class="admin-card admin-card-empty">—</li>'}</ul>
      <footer class="admin-comp-footer">
        <div class="admin-tier-buttons">
          ${TIER_ORDER.map((t) => `<button type="button" class="admin-tier-btn${comp.tier === t && getBucketForUid(uid) === t ? ' is-active' : ''}" data-action="move" data-tier="${t}">${t}</button>`).join("")}
          <button type="button" class="admin-tier-btn" data-action="move" data-tier="${POOL_KEY}">Пул</button>
        </div>
        <div class="admin-row-actions">
          <button type="button" class="admin-row-btn" data-action="up" title="Выше">↑</button>
          <button type="button" class="admin-row-btn" data-action="down" title="Ниже">↓</button>
          <button type="button" class="admin-row-btn admin-row-btn-danger" data-action="delete" title="Удалить">×</button>
        </div>
      </footer>
    `;

    article.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("change", () => {
        const field = input.dataset.field;
        const value = input.value;
        const patch = { [field]: value };
        if (field === "tier" && getBucketForUid(uid) !== POOL_KEY) {
          // Move card to new tier when admin changes the dropdown
          const targetIndex = state.placements[value]?.length ?? 0;
          updateComp(uid, patch);
          moveCompTo(uid, value, targetIndex);
          return;
        }
        updateComp(uid, patch);
      });
      if (input.tagName === "TEXTAREA" || (input.classList.contains("admin-name") || input.classList.contains("admin-subtitle"))) {
        input.addEventListener("input", () => {
          updateComp(uid, { [input.dataset.field]: input.value });
        });
      }
    });

    article.querySelectorAll('[data-action="move"]').forEach((btn) => {
      btn.addEventListener("click", () => moveCompTo(uid, btn.dataset.tier));
    });
    article.querySelector('[data-action="up"]').addEventListener("click", () => reorderInBucket(uid, -1));
    article.querySelector('[data-action="down"]').addEventListener("click", () => reorderInBucket(uid, 1));
    article.querySelector('[data-action="delete"]').addEventListener("click", () => deleteComp(uid));

    article.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", uid);
      article.classList.add("is-dragging");
    });
    article.addEventListener("dragend", () => article.classList.remove("is-dragging"));

    return article;
  }

  function renderPool() {
    poolListEl.replaceChildren();
    const ids = state.placements[POOL_KEY].filter((uid) => {
      const comp = state.comps.get(uid);
      return comp && compMatchesFilters(comp);
    });
    if (!ids.length) {
      const empty = document.createElement("p");
      empty.className = "tier-builder-empty";
      empty.textContent = state.comps.size ? "Все стратегии распределены." : "Нажми «Обновить из источников».";
      poolListEl.append(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    ids.forEach((uid) => {
      const card = renderCompCard(uid, { compact: true });
      if (card) fragment.append(card);
    });
    poolListEl.append(fragment);
  }

  function renderTiers() {
    tiersEl.replaceChildren();
    const fragment = document.createDocumentFragment();
    TIER_ORDER.forEach((tier) => {
      const wrap = document.createElement("section");
      wrap.className = `admin-tier admin-tier-${tier.toLowerCase()}`;
      wrap.dataset.tier = tier;
      const ids = state.placements[tier];
      const placedHtml = ids.length ? "" : '<p class="tier-builder-empty">Перетащи сюда стратегию или нажми кнопку с буквой тира.</p>';
      wrap.innerHTML = `
        <header class="admin-tier-head">
          <span class="strategy-tier-badge admin-tier-badge"><span>${tier}</span></span>
          <h2 class="panel-title">${tier}-тир · ${ids.length}</h2>
        </header>
        <div class="admin-tier-list" data-tier="${tier}">${placedHtml}</div>
      `;
      const listEl = wrap.querySelector(".admin-tier-list");
      ids.forEach((uid) => {
        const card = renderCompCard(uid);
        if (card) listEl.append(card);
      });

      listEl.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        listEl.classList.add("is-drop-target");
      });
      listEl.addEventListener("dragleave", () => listEl.classList.remove("is-drop-target"));
      listEl.addEventListener("drop", (event) => {
        event.preventDefault();
        listEl.classList.remove("is-drop-target");
        const uid = event.dataTransfer.getData("text/plain");
        if (!uid || !state.comps.has(uid)) return;
        moveCompTo(uid, tier);
      });

      fragment.append(wrap);
    });
    tiersEl.append(fragment);
  }

  function render() {
    buildSourceChips();
    renderPool();
    renderTiers();
  }

  function exportCompsJson() {
    const tieredComps = [];
    TIER_ORDER.forEach((tier) => {
      state.placements[tier].forEach((uid) => {
        const comp = state.comps.get(uid);
        if (!comp) return;
        tieredComps.push({
          tier,
          race: comp.race,
          name: comp.name,
          subtitle: comp.subtitle,
          summary: comp.summary,
          difficulty: comp.difficulty,
          trend: comp.trend,
          cards: comp.cards.filter((c) => c.id).map((c) => ({ id: c.id, name: c.name }))
        });
      });
    });
    const payload = {
      source: "admin",
      updatedAt: new Date().toISOString().slice(0, 10),
      sources: [
        "https://www.firestoneapp.com/battlegrounds/comps?rank=25",
        "https://hsreplay.net/battlegrounds/comps/"
      ],
      tiers: TIER_ORDER,
      comps: tieredComps
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "comps.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus(`Экспортировано ${tieredComps.length} стратегий. Положи файл в корень репозитория.`, "ok");
  }

  function renderDiagnostics(payload) {
    if (!payload || !payload.sources) {
      diagnosticsEl.hidden = true;
      return;
    }
    const block = (label, info) => {
      if (!info) return "";
      const errors = (info.errors || []).map((e) => `<li>${escape(e)}</li>`).join("") || "<li>нет ошибок</li>";
      const used = info.usedSource ? `<p class="admin-diagnostics-used">Источник: <code>${escape(info.usedSource)}</code></p>` : "";
      return `
        <div class="admin-diagnostics-block">
          <h3>${escape(label)} · получено ${info.count || 0}</h3>
          ${used}
          <details>
            <summary>Подробности (${(info.errors || []).length})</summary>
            <ul>${errors}</ul>
          </details>
        </div>`;
    };
    diagnosticsBodyEl.innerHTML = `
      ${block("Firestone", payload.sources.firestone)}
      ${block("HSReplay", payload.sources.hsreplay)}
      <p class="admin-diagnostics-note">Запрос обновлён: ${escape(payload.fetchedAt || "")}</p>
    `;
    diagnosticsEl.hidden = false;
  }

  async function refreshFromSources(force = false) {
    setStatus("Запрашиваю Firestone и HSReplay…");
    refreshBtn.disabled = true;
    try {
      const url = `/api/comps-source${force ? "?force=1" : ""}`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const added = ingestFromSources(payload);
      const fs = payload.sources?.firestone?.count || 0;
      const hr = payload.sources?.hsreplay?.count || 0;
      sourceStatusEl.textContent = `Firestone: ${fs} · HSReplay: ${hr} · добавлено новых: ${added}`;
      renderDiagnostics(payload);
      saveDraft();
      render();
      if (added) {
        setStatus(`Добавлено ${added} новых стратегий.`, "ok");
      } else if (fs + hr === 0) {
        setStatus("Источники сейчас не отдают данные. Раскрой «Диагностику источников» ниже, либо добавь стратегии вручную / из опубликованного.", "error");
      } else {
        setStatus("Все полученные стратегии уже есть в админке.", "ok");
      }
    } catch (error) {
      console.error(error);
      setStatus(`Ошибка обновления: ${error.message}`, "error");
    } finally {
      refreshBtn.disabled = false;
    }
  }

  function addManualComp() {
    const uid = makeUid("manual");
    state.comps.set(uid, {
      uid,
      sourceId: `manual:${uid}`,
      source: "manual",
      tier: "B",
      race: "NONE",
      name: "Новая стратегия",
      subtitle: "",
      summary: "",
      difficulty: "Medium",
      trend: "stable",
      cards: []
    });
    state.placements[POOL_KEY].unshift(uid);
    saveDraft();
    render();
    setStatus("Создана пустая стратегия — заполни поля.", "ok");
  }

  function clearDraft() {
    if (!confirm("Стереть весь черновик и начать с пустого листа?")) return;
    window.localStorage.removeItem(STORAGE_KEY);
    state.comps = new Map();
    state.placements = { [POOL_KEY]: [], S: [], A: [], B: [], C: [], D: [] };
    diagnosticsEl.hidden = true;
    sourceStatusEl.textContent = "";
    setStatus("Черновик очищен.", "ok");
    render();
  }

  async function loadPublishedComps() {
    try {
      const response = await fetch("./comps.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      let imported = 0;
      (payload.comps || []).forEach((comp) => {
        const sourceId = `published:${comp.tier}:${comp.name}`;
        const exists = [...state.comps.values()].some((c) => c.sourceId === sourceId);
        if (exists) return;
        const uid = makeUid("published");
        state.comps.set(uid, {
          uid, sourceId,
          source: "published",
          tier: comp.tier || "B",
          race: comp.race || "NONE",
          name: comp.name || "",
          subtitle: comp.subtitle || "",
          summary: comp.summary || "",
          difficulty: comp.difficulty || "Medium",
          trend: comp.trend || "stable",
          cards: (comp.cards || []).map((c) => ({ id: c.id || "", name: c.name || "" }))
        });
        state.placements[comp.tier && TIER_ORDER.includes(comp.tier) ? comp.tier : POOL_KEY].push(uid);
        imported += 1;
      });
      saveDraft();
      render();
      setStatus(`Загружено ${imported} стратегий из текущего comps.json.`, "ok");
    } catch (error) {
      setStatus(`Не удалось загрузить опубликованный comps.json: ${error.message}`, "error");
    }
  }

  function deepFindCompList(obj, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 10) return [];
    if (Array.isArray(obj)) {
      if (obj.length && typeof obj[0] === "object" && obj[0]
          && (obj[0].coreCards || obj[0].coreMinions || obj[0].minions || obj[0].cards)
          && (obj[0].name || obj[0].title)) {
        return obj;
      }
      for (const item of obj) {
        const found = deepFindCompList(item, depth + 1);
        if (found.length) return found;
      }
      return [];
    }
    for (const key of Object.keys(obj)) {
      const found = deepFindCompList(obj[key], depth + 1);
      if (found.length) return found;
    }
    return [];
  }

  function tryParseAny(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  function adoptComps(rawList, source) {
    if (!Array.isArray(rawList) || !rawList.length) return 0;
    const incoming = rawList.map((raw) => ({
      sourceId: `${source}:${raw.name || raw.title || raw.englishName || makeUid()}`,
      source,
      tier: (raw.tier || "B").toUpperCase(),
      race: (raw.tribe || raw.minionTribe || raw.race || "NONE").toUpperCase().replace(/^MINION_/, ""),
      name: raw.name || raw.title || raw.englishName || "Без названия",
      subtitle: raw.englishName || raw.shortName || raw.subtitle || "",
      summary: raw.description || raw.flavor || "",
      difficulty: raw.difficulty || "Medium",
      trend: raw.trend || raw.delta ? (Number(raw.trend ?? raw.delta) > 0 ? "up" : Number(raw.trend ?? raw.delta) < 0 ? "down" : "stable") : "stable",
      cards: (raw.coreCards || raw.coreMinions || raw.cards || raw.minions || []).slice(0, 8).map((card) => ({
        id: String(card?.cardId || card?.id || card?.dbfId || ""),
        name: card?.name || ""
      })).filter((c) => c.id || c.name)
    }));
    return ingestFromSources({ comps: incoming });
  }

  async function importFromUrl() {
    const url = importUrlInput.value.trim();
    if (!url) {
      importResultEl.textContent = "Вставь URL JSON-эндпоинта.";
      return;
    }
    importResultEl.textContent = "Загружаю…";
    importUrlBtn.disabled = true;
    try {
      const response = await fetch(`/api/comps-fetch?url=${encodeURIComponent(url)}`);
      const payload = await response.json();
      if (!payload.ok) {
        importResultEl.textContent = `Ошибка: ${payload.status || ""} ${payload.error || ""}`;
        return;
      }
      const json = tryParseAny(payload.body);
      if (!json) {
        importResultEl.textContent = `Получено ${payload.length} байт, но это не JSON.`;
        return;
      }
      const list = deepFindCompList(json);
      if (!list.length) {
        importResultEl.textContent = `JSON получен (${payload.length} байт), но массив комп не найден.`;
        return;
      }
      const added = adoptComps(list, "imported");
      saveDraft();
      render();
      importResultEl.textContent = `Найдено ${list.length}, добавлено новых: ${added}.`;
      setStatus(`Импортировано из URL: ${added} новых стратегий.`, "ok");
    } catch (error) {
      importResultEl.textContent = `Ошибка: ${error.message}`;
    } finally {
      importUrlBtn.disabled = false;
    }
  }

  function importFromJsonText() {
    const text = importJsonInput.value.trim();
    if (!text) {
      importResultEl.textContent = "Вставь JSON в текстовое поле.";
      return;
    }
    const json = tryParseAny(text);
    if (!json) {
      importResultEl.textContent = "Не получилось распарсить JSON.";
      return;
    }
    const list = Array.isArray(json) ? json : deepFindCompList(json);
    if (!list.length) {
      importResultEl.textContent = "В JSON нет массива комп.";
      return;
    }
    const added = adoptComps(list, "imported");
    saveDraft();
    render();
    importResultEl.textContent = `Найдено ${list.length}, добавлено новых: ${added}.`;
    setStatus(`Импортировано из JSON: ${added} новых стратегий.`, "ok");
  }

  refreshBtn.addEventListener("click", () => refreshFromSources(true));
  addManualBtn.addEventListener("click", addManualComp);
  saveLocalBtn.addEventListener("click", () => { saveDraft(); setStatus("Черновик сохранён в браузере.", "ok"); });
  exportBtn.addEventListener("click", exportCompsJson);
  loadPublishedBtn.addEventListener("click", loadPublishedComps);
  clearDraftBtn.addEventListener("click", clearDraft);
  importUrlBtn.addEventListener("click", importFromUrl);
  importJsonBtn.addEventListener("click", importFromJsonText);
  searchInput.addEventListener("input", window.Shared.debounce((event) => {
    state.search = event.target.value.trim();
    renderPool();
  }, 120));

  if (loadDraft()) {
    setStatus(`Восстановлен черновик (${state.comps.size} стратегий).`, "ok");
    render();
  } else {
    render();
    refreshFromSources();
  }
})();
