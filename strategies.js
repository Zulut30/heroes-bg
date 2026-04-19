(function () {
  const sourceEl = document.getElementById("strategies-source");
  const updatedEl = document.getElementById("strategies-updated");
  const listEl = document.getElementById("strategies-list");
  const difficultyFiltersEl = document.getElementById("strategies-difficulty-filters");
  const tierFiltersEl = document.getElementById("strategies-tier-filters");

  const TIER_ORDER = ["S", "A", "B", "C", "D"];
  const DIFFICULTY_ORDER = ["Easy", "Medium", "Hard"];
  const DIFFICULTY_LABELS = { Easy: "Простая", Medium: "Средняя", Hard: "Сложная" };
  const TREND_GLYPH = { up: "▲", down: "▼", stable: "•" };
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

  const state = {
    payload: null,
    difficulty: "ALL",
    tier: "ALL"
  };

  const escape = (value) => window.Shared.escapeHtml(value);

  function getCardArtUrl(id) {
    return `/api/card-art?id=${encodeURIComponent(id)}&locale=ruRU&size=${encodeURIComponent("256x")}`;
  }

  function difficultyOptions(comps) {
    const present = new Set(comps.map((c) => c.difficulty));
    return [
      { value: "ALL", label: "Любая" },
      ...DIFFICULTY_ORDER.filter((d) => present.has(d)).map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] || d }))
    ];
  }

  function tierOptions(comps) {
    const present = new Set(comps.map((c) => c.tier));
    return [
      { value: "ALL", label: "Все тиры" },
      ...TIER_ORDER.filter((t) => present.has(t)).map((t) => ({ value: t, label: t }))
    ];
  }

  function makeChip(label, isActive, onClick, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${isActive ? " is-active" : ""}`;
    if (options.icon) {
      button.style.setProperty("--chip-icon", `url("${options.icon}")`);
      button.classList.add("chip-with-icon");
    }
    button.innerHTML = `
      ${options.icon ? '<span class="chip-icon" aria-hidden="true"></span>' : ""}
      <span class="chip-label">${escape(label)}</span>
    `;
    button.addEventListener("click", onClick);
    return button;
  }

  function renderFilters() {
    if (!state.payload) return;
    const comps = state.payload.comps || [];

    difficultyFiltersEl.replaceChildren();
    difficultyOptions(comps).forEach((option) => {
      difficultyFiltersEl.append(makeChip(option.label, state.difficulty === option.value, () => {
        state.difficulty = option.value;
        renderFilters();
        renderList();
      }));
    });

    tierFiltersEl.replaceChildren();
    tierOptions(comps).forEach((option) => {
      tierFiltersEl.append(makeChip(option.label, state.tier === option.value, () => {
        state.tier = option.value;
        renderFilters();
        renderList();
      }));
    });
  }

  function passes(comp) {
    if (state.difficulty !== "ALL" && comp.difficulty !== state.difficulty) return false;
    if (state.tier !== "ALL" && comp.tier !== state.tier) return false;
    return true;
  }

  function renderList() {
    if (!state.payload) return;
    const comps = (state.payload.comps || []).filter(passes);

    listEl.replaceChildren();

    if (!comps.length) {
      const empty = document.createElement("p");
      empty.className = "tier-builder-empty";
      empty.textContent = "По текущим фильтрам стратегий нет.";
      listEl.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    const grouped = TIER_ORDER
      .map((tier) => ({ tier, items: comps.filter((c) => c.tier === tier) }))
      .filter((group) => group.items.length);

    grouped.forEach((group) => {
      const section = document.createElement("section");
      section.className = `strategy-tier strategy-tier-${group.tier.toLowerCase()}`;
      const items = group.items.map((comp) => renderCompRow(comp)).join("");
      section.innerHTML = `
        <div class="strategy-tier-badge" aria-hidden="true">
          <span>${escape(group.tier)}</span>
        </div>
        <div class="strategy-tier-rows">${items}</div>
      `;
      fragment.append(section);
    });

    listEl.append(fragment);
  }

  function renderCompRow(comp) {
    const trend = TREND_GLYPH[comp.trend] || "";
    const trendClass = comp.trend ? ` strategy-trend-${comp.trend}` : "";
    const raceIcon = RACE_ICON[comp.race] || RACE_ICON.NONE;
    const cardsHtml = (comp.cards || []).map((card) => {
      const safeName = escape(card.name || card.id || "");
      return `
        <li class="strategy-card" title="${safeName}">
          <img src="${getCardArtUrl(card.id)}" alt="${safeName}" loading="lazy" decoding="async" fetchpriority="low">
        </li>
      `;
    }).join("");

    const difficultyClass = comp.difficulty ? ` is-${comp.difficulty.toLowerCase()}` : "";
    const subtitle = comp.subtitle ? `<span class="strategy-subtitle">${escape(comp.subtitle)}</span>` : "";

    return `
      <article class="strategy-row">
        <div class="strategy-row-icon" style="background-image: url('${raceIcon}');" aria-hidden="true"></div>
        <div class="strategy-row-copy">
          <h3 class="strategy-name">
            ${escape(comp.name)}
            ${trend ? `<span class="strategy-trend${trendClass}" aria-hidden="true">${trend}</span>` : ""}
          </h3>
          ${subtitle}
          <p class="strategy-summary">${escape(comp.summary || "")}</p>
        </div>
        <div class="strategy-difficulty">
          <span class="strategy-difficulty-pill${difficultyClass}">
            ${escape(DIFFICULTY_LABELS[comp.difficulty] || comp.difficulty || "—")}
          </span>
        </div>
        <ul class="strategy-cards">${cardsHtml}</ul>
      </article>
    `;
  }

  function renderMeta() {
    if (!state.payload) return;
    const sources = (state.payload.sources || []).length;
    const total = (state.payload.comps || []).length;
    const sourceLabel = state.payload.source === "live"
      ? `Свежие данные · ${sources} источника`
      : "Курируемая подборка";
    sourceEl.textContent = `${sourceLabel} · ${total} стратегий`;
    updatedEl.textContent = state.payload.updatedAt ? `Обновлено: ${state.payload.updatedAt}` : "";
  }

  async function bootstrap() {
    try {
      const response = await fetch("./comps.json", { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Comps HTTP ${response.status}`);
      }
      state.payload = await response.json();
      renderMeta();
      renderFilters();
      renderList();
    } catch (error) {
      console.error(error);
      sourceEl.textContent = "Не удалось загрузить стратегии.";
    }
  }

  bootstrap();
})();
