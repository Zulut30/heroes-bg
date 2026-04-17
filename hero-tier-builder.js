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
    draggingCardId: null
  };

  const rowsRoot = document.getElementById("tier-builder-rows");
  const poolRoot = document.getElementById("tier-builder-pool");
  const searchInput = document.getElementById("tier-builder-search");
  const sourceSelect = document.getElementById("tier-builder-source");
  const raceSelect = document.getElementById("tier-builder-race");
  const levelSelect = document.getElementById("tier-builder-level");
  const resetButton = document.getElementById("tier-builder-reset");
  const unassignedButton = document.getElementById("tier-builder-unassigned");
  const summary = document.getElementById("tier-builder-summary");
  const counter = document.getElementById("tier-builder-counter");

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

  function normalizeHeroCard(hero, tier) {
    return {
      id: `hero-${slugify(hero.name)}`,
      name: hero.name,
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

    return searchOk && sourceOk && raceOk && levelOk;
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
    element.innerHTML = `
      <div class="tier-builder-card-media">
        <img src="${getCardArtUrl(card, "256x")}" alt="${card.name}" loading="lazy" decoding="async">
      </div>
      <div class="tier-builder-card-copy">
        <strong>${card.name}</strong>
        <span class="tier-builder-card-meta">${getSourceLabel(card)} • ${getCardMeta(card)}</span>
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
      const [libraryResponse, spellsResponse] = await Promise.all([
        fetch("./bgs-library.json", { cache: "force-cache" }),
        fetch("./api/battlegrounds-spells?locale=ru_RU&pageSize=200", {
          headers: { Accept: "application/json" }
        })
      ]);

      if (!libraryResponse.ok) {
        throw new Error(`Library HTTP ${libraryResponse.status}`);
      }
      if (!spellsResponse.ok) {
        throw new Error(`Spells HTTP ${spellsResponse.status}`);
      }

      const libraryPayload = await libraryResponse.json();
      const spellsPayload = await spellsResponse.json();

      const heroes = getHeroCards();
      const minions = Array.isArray(libraryPayload.cards) ? libraryPayload.cards.map(normalizeMinionCard) : [];
      const spells = Array.isArray(spellsPayload.cards) ? spellsPayload.cards.map(normalizeSpellCard) : [];
      const accessoriesPayload = window.accessoriesData || {};
      const accessories = [...(accessoriesPayload.small || []), ...(accessoriesPayload.large || [])].map(normalizeAccessoryCard);

      state.cards = [...minions, ...spells, ...accessories, ...heroes];
      state.cardsById = new Map(state.cards.map((card) => [card.id, card]));
      state.placements = createInitialPlacements(state.cards);
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

  sourceSelect.addEventListener("change", (event) => {
    state.source = event.target.value;
    render();
  });

  raceSelect.addEventListener("change", (event) => {
    state.race = event.target.value;
    render();
  });

  levelSelect.addEventListener("change", (event) => {
    state.level = event.target.value;
    render();
  });

  resetButton.addEventListener("click", () => {
    state.search = "";
    state.source = "ALL";
    state.race = "ALL";
    state.level = "ALL";
    searchInput.value = "";
    sourceSelect.value = "ALL";
    raceSelect.value = "ALL";
    levelSelect.value = "ALL";
    render();
  });

  unassignedButton.addEventListener("click", () => {
    state.placements = createInitialPlacements(state.cards);
    render();
  });

  bootstrap();
})();
