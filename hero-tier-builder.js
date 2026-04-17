(function () {
  const TIER_ORDER = ["S", "A", "B", "C", "D"];
  const UNASSIGNED_KEY = "POOL";

  const raceNames = {
    NONE: "Без типа",
    ALL: "Все типы",
    BEAST: "Звери",
    DEMON: "Демоны",
    DRAGON: "Драконы",
    ELEMENTAL: "Элементали",
    MECHANICAL: "Механизмы",
    MURLOC: "Мурлоки",
    NAGA: "Наги",
    PIRATE: "Пираты",
    QUILBOAR: "Свинобразы",
    UNDEAD: "Нежить"
  };

  const tierLabels = {
    S: "Лучшее ядро",
    A: "Сильный тир",
    B: "Рабочий вариант",
    C: "Ситуативно",
    D: "Слабый тир"
  };

  const state = {
    cards: [],
    cardsById: new Map(),
    placements: {},
    search: "",
    source: "ALL",
    race: "ALL",
    level: "ALL",
    accessorySize: "ALL",
    draggingCardId: null
  };

  const rowsRoot = document.getElementById("tier-builder-rows");
  const poolRoot = document.getElementById("tier-builder-pool");
  const searchInput = document.getElementById("tier-builder-search");
  const sourceFiltersEl = document.getElementById("tier-builder-source-filters");
  const raceFiltersEl = document.getElementById("tier-builder-race-filters");
  const levelFiltersEl = document.getElementById("tier-builder-level-filters");
  const accessoryFiltersEl = document.getElementById("tier-builder-accessory-filters");
  const raceBlockEl = document.getElementById("tier-builder-race-block");
  const levelBlockEl = document.getElementById("tier-builder-level-block");
  const accessoryBlockEl = document.getElementById("tier-builder-accessory-block");
  const resetButton = document.getElementById("tier-builder-reset");
  const unassignedButton = document.getElementById("tier-builder-unassigned");
  const summary = document.getElementById("tier-builder-summary");
  const counter = document.getElementById("tier-builder-counter");

  const raceIcons = {
    ALL: "./assset/общее.webp",
    NONE: "./assset/общее.webp",
    BEAST: "./assset/зверь.webp",
    DEMON: "./assset/демоны.webp",
    DRAGON: "./assset/драконы.webp",
    ELEMENTAL: "./assset/элементали.webp",
    MECHANICAL: "./assset/механизмы.webp",
    MURLOC: "./assset/мурлоки.webp",
    NAGA: "./assset/наги.webp",
    PIRATE: "./assset/пираты.webp",
    QUILBOAR: "./assset/свинобразы.webp",
    UNDEAD: "./assset/нежить.webp"
  };

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, "-")
      .replace(/(^-|-$)/g, "");
  }

  function stripHtml(value) {
    const tmp = document.createElement("div");
    tmp.innerHTML = value || "";
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function getCardArtUrl(card, size = "256x") {
    if (card?.source === "SPELL" || card?.source === "HERO" || card?.source === "ACCESSORY") {
      return card?.image || card?.artUrl || "";
    }

    if (!card?.id) {
      return card?.artUrl || "";
    }

    return `/api/card-art?id=${encodeURIComponent(card.id)}&locale=ruRU&size=${encodeURIComponent(size)}`;
  }

  function getEnglishNameFromImagePath(imagePath) {
    const raw = String(imagePath || "").trim();
    if (!raw) return "";
    const filename = raw.split("/").pop() || raw;
    const withoutExtension = filename.replace(/\.[a-z0-9]+$/i, "");
    try {
      return decodeURIComponent(withoutExtension).replace(/\s+/g, " ").trim();
    } catch (error) {
      return withoutExtension.replace(/\s+/g, " ").trim();
    }
  }

  function normalizeHeroCard(hero, tier) {
    return {
      id: `hero-${slugify(hero.name)}`,
      name: hero.name,
      englishName: getEnglishNameFromImagePath(hero.image),
      text: "",
      techLevel: 0,
      races: [],
      manaCost: 0,
      source: "HERO",
      image: hero.image,
      heroTier: tier
    };
  }

  function normalizeMinionCard(card) {
    return {
      id: String(card.id),
      name: card.name,
      englishName: card.englishName || "",
      slug: card.slug || "",
      text: card.text || "",
      techLevel: card.techLevel || 0,
      races: card.races || [],
      manaCost: 0,
      source: "MINION",
      artUrl: card.artUrl || ""
    };
  }

  function normalizeSpellCard(card) {
    return {
      id: `spell-${card.id}`,
      name: card.name,
      englishName: card.englishName || "",
      slug: card.slug || "",
      text: stripHtml(card.text || ""),
      techLevel: card.tier || 0,
      races: [],
      manaCost: card.manaCost ?? 0,
      source: "SPELL",
      image: card.image || card.cropImage || ""
    };
  }

  function normalizeAccessoryCard(card) {
    return {
      id: card.id,
      name: card.name,
      text: "",
      techLevel: 0,
      races: [],
      manaCost: 0,
      source: "ACCESSORY",
      image: encodeURI(card.image || ""),
      accessorySize: card.size || "SMALL"
    };
  }

  function getHeroCards() {
    return (window.tierData || []).flatMap((tierEntry) => (
      (tierEntry.heroes || []).map((hero) => normalizeHeroCard(hero, tierEntry.tier))
    ));
  }

  function createInitialPlacements(cards) {
    const placements = { [UNASSIGNED_KEY]: cards.map((card) => card.id) };
    TIER_ORDER.forEach((tier) => {
      placements[tier] = [];
    });
    return placements;
  }

  function getCardSearchText(card) {
    return [
      card.name,
      card.englishName,
      card.slug,
      card.text,
      card.source === "SPELL" ? "заклинание spell" : "",
      card.source === "MINION" ? "существо minion" : "",
      card.source === "HERO" ? "герой hero" : "",
      card.source === "ACCESSORY" ? "аксессуар accessory trinket" : "",
      card.accessorySize === "SMALL" ? "малый small" : "",
      card.accessorySize === "LARGE" ? "большой large" : "",
      (card.races || []).join(" "),
      `таверна ${card.techLevel || ""}`,
      `мана ${card.manaCost || ""}`
    ].join(" ");
  }

  function matchesFilters(card) {
    const searchOk = !state.search || normalize(getCardSearchText(card)).includes(normalize(state.search));
    const sourceOk = state.source === "ALL" || card.source === state.source;

    const raceOk = state.race === "ALL"
      ? true
      : state.source !== "ALL" && state.source !== "MINION"
        ? true
        : card.source !== "MINION"
          ? false
          : state.race === "NONE"
            ? !(card.races && card.races.length)
            : (card.races || []).includes(state.race);

    const levelOk = state.level === "ALL"
      ? true
      : card.source === "HERO" || card.source === "ACCESSORY"
        ? true
        : String(card.techLevel || "") === state.level;

    const accessoryOk = state.accessorySize === "ALL"
      ? true
      : card.source !== "ACCESSORY"
        ? true
        : card.accessorySize === state.accessorySize;

    return searchOk && sourceOk && raceOk && levelOk && accessoryOk;
  }

  function syncAccessorySizeFilter() {
    const enabled = state.source === "ACCESSORY";
    if (accessoryBlockEl) {
      accessoryBlockEl.hidden = !enabled;
    }
    if (!enabled && state.accessorySize !== "ALL") {
      state.accessorySize = "ALL";
    }
    if (raceBlockEl) {
      const showRace = state.source === "ALL" || state.source === "MINION";
      raceBlockEl.hidden = !showRace;
      if (!showRace && state.race !== "ALL") {
        state.race = "ALL";
      }
    }
    if (levelBlockEl) {
      const showLevel = state.source !== "HERO" && state.source !== "ACCESSORY";
      levelBlockEl.hidden = !showLevel;
      if (!showLevel && state.level !== "ALL") {
        state.level = "ALL";
      }
    }
  }

  function createFilterChip(label, isActive, onClick, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${isActive ? " is-active" : ""}`;
    if (options.icon) {
      button.style.setProperty("--chip-icon", `url("${options.icon}")`);
      button.classList.add("chip-with-icon");
    }
    button.innerHTML = `
      ${options.icon ? '<span class="chip-icon" aria-hidden="true"></span>' : ""}
      <span class="chip-label">${label}</span>
    `;
    button.addEventListener("click", onClick);
    return button;
  }

  const sourceOptions = [
    { value: "ALL", label: "Все карты" },
    { value: "MINION", label: "Существа" },
    { value: "SPELL", label: "Заклинания" },
    { value: "ACCESSORY", label: "Аксессуары" },
    { value: "HERO", label: "Герои" }
  ];

  const raceOrder = ["ALL", "NONE", "BEAST", "DEMON", "DRAGON", "ELEMENTAL", "MECHANICAL", "MURLOC", "NAGA", "PIRATE", "QUILBOAR", "UNDEAD"];

  function renderSourceFilters() {
    if (!sourceFiltersEl) return;
    sourceFiltersEl.replaceChildren();
    sourceOptions.forEach((option) => {
      sourceFiltersEl.append(createFilterChip(option.label, state.source === option.value, () => {
        state.source = option.value;
        syncAccessorySizeFilter();
        renderSourceFilters();
        renderRaceFilters();
        renderLevelFilters();
        renderAccessoryFilters();
        render();
      }));
    });
  }

  function renderRaceFilters() {
    if (!raceFiltersEl) return;
    raceFiltersEl.replaceChildren();
    raceOrder.forEach((race) => {
      raceFiltersEl.append(createFilterChip(raceNames[race] || race, state.race === race, () => {
        state.race = race;
        renderRaceFilters();
        render();
      }, { icon: raceIcons[race] }));
    });
  }

  function renderLevelFilters() {
    if (!levelFiltersEl) return;
    levelFiltersEl.replaceChildren();
    const levels = [{ value: "ALL", label: "Все уровни" }, ...["1", "2", "3", "4", "5", "6", "7"].map((level) => ({
      value: level,
      label: `Таверна ${level}`,
      icon: `./assset/tier${level}.png`
    }))];
    levels.forEach((item) => {
      levelFiltersEl.append(createFilterChip(item.label, state.level === item.value, () => {
        state.level = item.value;
        renderLevelFilters();
        render();
      }, { icon: item.icon }));
    });
  }

  function renderAccessoryFilters() {
    if (!accessoryFiltersEl) return;
    accessoryFiltersEl.replaceChildren();
    const options = [
      { value: "ALL", label: "Все аксессуары" },
      { value: "SMALL", label: "Только малые" },
      { value: "LARGE", label: "Только большие" }
    ];
    options.forEach((option) => {
      accessoryFiltersEl.append(createFilterChip(option.label, state.accessorySize === option.value, () => {
        state.accessorySize = option.value;
        renderAccessoryFilters();
        render();
      }));
    });
  }

  function getSourceLabel(card) {
    if (card.source === "SPELL") {
      return "Заклинание";
    }
    if (card.source === "HERO") {
      return "Герой";
    }
    if (card.source === "ACCESSORY") {
      return card.accessorySize === "LARGE" ? "Большой аксессуар" : "Малый аксессуар";
    }
    return raceNames[(card.races || [])[0]] || "Существо";
  }

  function getCardMeta(card) {
    if (card.source === "HERO") {
      return card.heroTier ? `${card.heroTier}-тир героев` : "Герой";
    }
    if (card.source === "SPELL") {
      return `Таверна ${card.techLevel || "?"} • Мана ${card.manaCost ?? 0}`;
    }
    if (card.source === "ACCESSORY") {
      return card.accessorySize === "LARGE" ? "Большой аксессуар" : "Малый аксессуар";
    }
    return `Таверна ${card.techLevel || "?"} • ${raceNames[(card.races || [])[0]] || "Без типа"}`;
  }

  function getBucketForCard(cardId) {
    return [UNASSIGNED_KEY, ...TIER_ORDER].find((bucket) => state.placements[bucket].includes(cardId)) || UNASSIGNED_KEY;
  }

  function removeCardFromBuckets(cardId) {
    [UNASSIGNED_KEY, ...TIER_ORDER].forEach((bucket) => {
      state.placements[bucket] = state.placements[bucket].filter((id) => id !== cardId);
    });
  }

  function moveCard(cardId, targetBucket) {
    if (!targetBucket || !state.placements[targetBucket]) {
      return;
    }

    removeCardFromBuckets(cardId);
    state.placements[targetBucket].push(cardId);
    render();
  }

  function reorderCard(cardId, direction) {
    const bucket = getBucketForCard(cardId);
    const ids = [...state.placements[bucket]];
    const index = ids.indexOf(cardId);

    if (index === -1) {
      return;
    }

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= ids.length) {
      return;
    }

    ids.splice(index, 1);
    ids.splice(targetIndex, 0, cardId);
    state.placements[bucket] = ids;
    render();
  }

  function createCardElement(cardId) {
    const card = state.cardsById.get(cardId);
    const bucket = getBucketForCard(cardId);
    const element = document.createElement("article");
    element.className = "tier-builder-card";
    element.draggable = true;
    element.dataset.cardId = cardId;
    element.title = `${card.name} — ${getSourceLabel(card)} — ${getCardMeta(card)}`;
    element.innerHTML = `
      <div class="tier-builder-card-media">
        <img src="${getCardArtUrl(card, "256x")}" alt="${card.name}" loading="lazy" decoding="async">
      </div>
      <div class="tier-builder-card-actions">
        <button class="tier-builder-card-button" type="button" data-action="prev" aria-label="Сдвинуть раньше">←</button>
        <button class="tier-builder-card-button" type="button" data-action="next" aria-label="Сдвинуть позже">→</button>
        <button class="tier-builder-card-button" type="button" data-action="pool" aria-label="Вернуть в пул">×</button>
      </div>
    `;

    element.addEventListener("dragstart", (event) => {
      state.draggingCardId = cardId;
      element.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", cardId);
    });

    element.addEventListener("dragend", () => {
      state.draggingCardId = null;
      element.classList.remove("is-dragging");
      document.querySelectorAll(".tier-builder-row").forEach((row) => row.classList.remove("is-over"));
    });

    element.querySelector('[data-action="prev"]').addEventListener("click", () => reorderCard(cardId, -1));
    element.querySelector('[data-action="next"]').addEventListener("click", () => reorderCard(cardId, 1));
    const poolButton = element.querySelector('[data-action="pool"]');

    if (bucket === UNASSIGNED_KEY) {
      poolButton.textContent = "+";
      poolButton.setAttribute("aria-label", "Отправить в S-тир");
      poolButton.addEventListener("click", () => moveCard(cardId, "S"));
    } else {
      poolButton.addEventListener("click", () => moveCard(cardId, UNASSIGNED_KEY));
    }

    return element;
  }

  function buildDropzone(bucket) {
    const zone = document.createElement("div");
    zone.className = "tier-builder-dropzone";
    zone.dataset.tier = bucket;

    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      zone.closest(".tier-builder-row")?.classList.add("is-over");
    });

    zone.addEventListener("dragleave", () => {
      zone.closest(".tier-builder-row")?.classList.remove("is-over");
    });

    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.closest(".tier-builder-row")?.classList.remove("is-over");
      const cardId = event.dataTransfer.getData("text/plain") || state.draggingCardId;
      if (!cardId) {
        return;
      }

      moveCard(cardId, bucket);
    });

    return zone;
  }

  async function exportTier(tier) {
    const cards = state.placements[tier].map((id) => state.cardsById.get(id)).filter((card) => card && matchesFilters(card));
    if (!cards.length) {
      return;
    }

    const EXPORT_WIDTH = 2400;
    const SIDE_PADDING = 48;
    const TOP_PADDING = 36;
    const BOTTOM_PADDING = 36;
    const COLUMN_GAP = 20;
    const ROW_GAP = 24;
    const COLUMNS = Math.min(cards.length, 6);

    const loaded = await Promise.all(cards.map(async (card) => {
      try {
        const image = await window.Shared.loadImageFromSource(getCardArtUrl(card, "512x"));
        return { card, image };
      } catch (error) {
        console.warn(`Не удалось загрузить карту ${card.name}:`, error);
        return null;
      }
    }));
    const entries = loaded.filter(Boolean);
    if (!entries.length) return;

    const cardWidth = (EXPORT_WIDTH - SIDE_PADDING * 2 - COLUMN_GAP * (COLUMNS - 1)) / COLUMNS;
    const rows = Math.ceil(entries.length / COLUMNS);
    const rowEntries = [];
    for (let r = 0; r < rows; r += 1) {
      rowEntries.push(entries.slice(r * COLUMNS, (r + 1) * COLUMNS));
    }
    const rowHeights = rowEntries.map((row) => (
      Math.max(...row.map(({ image }) => cardWidth * (image.height / image.width)))
    ));
    const totalHeight = TOP_PADDING
      + rowHeights.reduce((sum, h) => sum + h, 0)
      + Math.max(0, rows - 1) * ROW_GAP
      + BOTTOM_PADDING;

    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_WIDTH;
    canvas.height = Math.ceil(totalHeight);
    const ctx = canvas.getContext("2d");

    let cursorY = TOP_PADDING;
    rowEntries.forEach((row, rowIndex) => {
      const rowMaxHeight = rowHeights[rowIndex];
      row.forEach(({ image }, colIndex) => {
        const imageRatio = image.width / image.height;
        const cardHeight = cardWidth / imageRatio;
        const x = SIDE_PADDING + colIndex * (cardWidth + COLUMN_GAP);
        const y = cursorY + (rowMaxHeight - cardHeight) / 2;
        ctx.drawImage(image, x, y, cardWidth, cardHeight);
      });
      cursorY += rowMaxHeight + ROW_GAP;
    });

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Не удалось собрать тир.")), "image/png", 1);
    });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `tier-${tier.toLowerCase()}-${state.source.toLowerCase()}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1200);
  }

  function renderPool() {
    poolRoot.innerHTML = "";

    const cards = state.placements[UNASSIGNED_KEY]
      .map((id) => state.cardsById.get(id))
      .filter((card) => matchesFilters(card));

    if (!cards.length) {
      const empty = document.createElement("p");
      empty.className = "tier-builder-empty";
      empty.textContent = "В пуле нет карт по текущим фильтрам.";
      poolRoot.append(empty);
      return;
    }

    cards.forEach((card) => {
      poolRoot.append(createCardElement(card.id));
    });
  }

  function renderRows() {
    rowsRoot.innerHTML = "";

    TIER_ORDER.forEach((tier) => {
      const row = document.createElement("section");
      row.className = "tier-builder-row";
      row.innerHTML = `
        <div class="tier-builder-row-head">
          <div class="tier-meta">
            <span class="tier-builder-badge">${tier}</span>
            <div>
              <h3 class="tier-title">${tierLabels[tier]}</h3>
              <p class="tier-builder-count">${state.placements[tier].length} карт</p>
            </div>
          </div>
          <button class="secondary-button tier-builder-export" type="button">Скачать тир</button>
        </div>
      `;

      const zone = buildDropzone(tier);
      const cards = state.placements[tier]
        .map((id) => state.cardsById.get(id))
        .filter((card) => matchesFilters(card));

      if (!cards.length) {
        const empty = document.createElement("p");
        empty.className = "tier-builder-empty";
        empty.textContent = "Перетащи сюда карты из пула слева.";
        zone.append(empty);
      } else {
        cards.forEach((card) => zone.append(createCardElement(card.id)));
      }

      row.append(zone);
      row.querySelector(".tier-builder-export").addEventListener("click", () => exportTier(tier));
      rowsRoot.append(row);
    });
  }

  function render() {
    renderPool();
    renderRows();

    const assignedCount = TIER_ORDER.reduce((sum, tier) => sum + state.placements[tier].length, 0);
    const visiblePoolCount = state.placements[UNASSIGNED_KEY]
      .map((id) => state.cardsById.get(id))
      .filter((card) => matchesFilters(card))
      .length;

    counter.textContent = `${assignedCount} карт распределено`;
    summary.textContent = `В пуле ${visiblePoolCount} карт по текущим фильтрам. Всего распределено ${assignedCount}.`;
  }

  async function bootstrap() {
    try {
      const [libraryResponse, spellsResponse, englishNamesResponse] = await Promise.all([
        fetch("./bgs-library.json", { cache: "force-cache" }),
        fetch("./api/battlegrounds-spells?locale=ru_RU&pageSize=200", {
          headers: { Accept: "application/json" }
        }),
        fetch("./api/battlegrounds-card-names?locale=en_US", {
          headers: { Accept: "application/json" }
        }).catch(() => null)
      ]);

      if (!libraryResponse.ok) {
        throw new Error(`Library HTTP ${libraryResponse.status}`);
      }
      if (!spellsResponse.ok) {
        throw new Error(`Spells HTTP ${spellsResponse.status}`);
      }

      const libraryPayload = await libraryResponse.json();
      const spellsPayload = await spellsResponse.json();
      const englishNamesPayload = englishNamesResponse && englishNamesResponse.ok
        ? await englishNamesResponse.json()
        : { cards: [] };

      const englishByKey = new Map();
      (englishNamesPayload.cards || []).forEach((card) => {
        if (card?.id != null) englishByKey.set(String(card.id), card);
        if (card?.slug) englishByKey.set(`slug:${String(card.slug)}`, card);
      });
      const resolveEnglish = (localCard) => (
        englishByKey.get(String(localCard.dbfId))
        || englishByKey.get(String(localCard.id))
        || (localCard.slug ? englishByKey.get(`slug:${String(localCard.slug)}`) : null)
        || null
      );

      const heroes = getHeroCards();
      const minions = Array.isArray(libraryPayload.cards)
        ? libraryPayload.cards.map((card) => {
          const english = resolveEnglish(card);
          return normalizeMinionCard({
            ...card,
            englishName: english?.name || "",
            slug: english?.slug || ""
          });
        })
        : [];
      const spells = Array.isArray(spellsPayload.cards)
        ? spellsPayload.cards.map((card) => {
          const english = resolveEnglish(card);
          return normalizeSpellCard({
            ...card,
            englishName: english?.name || "",
            slug: english?.slug || ""
          });
        })
        : [];
      const accessoriesPayload = window.accessoriesData || {};
      const accessories = [...(accessoriesPayload.small || []), ...(accessoriesPayload.large || [])].map(normalizeAccessoryCard);

      state.cards = [...minions, ...spells, ...accessories, ...heroes];
      state.cardsById = new Map(state.cards.map((card) => [card.id, card]));
      state.placements = createInitialPlacements(state.cards);
      syncAccessorySizeFilter();
      renderSourceFilters();
      renderRaceFilters();
      renderLevelFilters();
      renderAccessoryFilters();
      render();
    } catch (error) {
      console.error(error);
      summary.textContent = "Не удалось загрузить библиотеку для конструктора тир-листов.";
    }
  }

  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    render();
  });

  resetButton.addEventListener("click", () => {
    state.search = "";
    state.source = "ALL";
    state.race = "ALL";
    state.level = "ALL";
    state.accessorySize = "ALL";
    searchInput.value = "";
    syncAccessorySizeFilter();
    renderSourceFilters();
    renderRaceFilters();
    renderLevelFilters();
    renderAccessoryFilters();
    render();
  });

  unassignedButton.addEventListener("click", () => {
    state.placements = createInitialPlacements(state.cards);
    render();
  });

  document.addEventListener("wheel", (event) => {
    if (state.draggingCardId) {
      window.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: "auto" });
    }
  }, { passive: true });

  bootstrap();
})();
