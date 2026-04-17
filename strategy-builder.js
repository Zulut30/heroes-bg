(function () {
  const searchInput = document.getElementById("builder-search");
  const sourceSelect = document.getElementById("builder-source");
  const raceSelect = document.getElementById("builder-race");
  const levelSelect = document.getElementById("builder-level");
  const accessorySizeSelect = document.getElementById("builder-accessory-size");
  const clearButton = document.getElementById("builder-clear");
  const exportPngButton = document.getElementById("builder-export-png");
  const exportWebpButton = document.getElementById("builder-export-webp");
  const statusEl = document.getElementById("builder-status");
  const libraryEl = document.getElementById("builder-library");
  const boardEl = document.getElementById("strategy-board");
  const counterEl = document.getElementById("builder-counter");

  const BOARD_COLUMNS = 5;
  const BOARD_ROWS = 3;
  const BOARD_SLOT_COUNT = BOARD_COLUMNS * BOARD_ROWS;
  const EXPORT_WIDTH = 2200;
  const EXPORT_SIDE_PADDING = 120;
  const EXPORT_TOP_PADDING = 70;
  const EXPORT_BOTTOM_PADDING = 70;
  const EXPORT_COLUMN_GAP = 82;
  const EXPORT_ROW_GAP = 94;
  const EMPTY_EXPORT_PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sot8JkAAAAASUVORK5CYII=";
  const SLOT_CARD_WIDTH = 0.142;
  const BOARD_INSET_X = 0.048;
  const BOARD_INSET_Y = 0.08;
  const BOARD_COLUMN_GAP = 0.035;
  const BOARD_ROW_GAP = 0.116;

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

  const state = {
    cards: [],
    filtered: [],
    placed: [],
    search: "",
    source: "ALL",
    race: "ALL",
    level: "ALL",
    accessorySize: "ALL",
    activeId: null,
    draggingLibrary: false,
    draggingPlaced: false
  };

  function getCardArtUrl(card, size = "512x") {
    if (card?.source === "HERO" || card?.source === "ACCESSORY") {
      return card?.image || card?.artUrl || "";
    }

    if (!card?.id) {
      return card?.artUrl || "";
    }

    return `/api/card-art?id=${encodeURIComponent(card.id)}&locale=ruRU&size=${encodeURIComponent(size)}`;
  }

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function stripHtml(value) {
    const tmp = document.createElement("div");
    tmp.innerHTML = value || "";
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, "-")
      .replace(/(^-|-$)/g, "");
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function syncCounter() {
    counterEl.textContent = `${state.placed.length} карт на полотне`;
    boardEl.classList.toggle("is-empty", state.placed.length === 0);
  }

  function getSlotPosition(slot) {
    const column = slot % BOARD_COLUMNS;
    const row = Math.floor(slot / BOARD_COLUMNS);
    const usableWidth = 1 - BOARD_INSET_X * 2 - BOARD_COLUMN_GAP * (BOARD_COLUMNS - 1);
    const usableHeight = 1 - BOARD_INSET_Y * 2 - BOARD_ROW_GAP * (BOARD_ROWS - 1);

    return {
      x: BOARD_INSET_X + (usableWidth / BOARD_COLUMNS) * (column + 0.5) + BOARD_COLUMN_GAP * column,
      y: BOARD_INSET_Y + (usableHeight / BOARD_ROWS) * (row + 0.5) + BOARD_ROW_GAP * row
    };
  }

  function getNearestSlot(clientX, clientY) {
    const rect = boardEl.getBoundingClientRect();
    const relativeX = Math.min(0.999, Math.max(0, (clientX - rect.left) / rect.width));
    const relativeY = Math.min(0.999, Math.max(0, (clientY - rect.top) / rect.height));
    const column = Math.min(BOARD_COLUMNS - 1, Math.max(0, Math.floor(relativeX * BOARD_COLUMNS)));
    const row = Math.min(BOARD_ROWS - 1, Math.max(0, Math.floor(relativeY * BOARD_ROWS)));
    return row * BOARD_COLUMNS + column;
  }

  function getFirstFreeSlot() {
    const occupied = new Set(state.placed.map((card) => card.slot));

    for (let slot = 0; slot < BOARD_SLOT_COUNT; slot += 1) {
      if (!occupied.has(slot)) {
        return slot;
      }
    }

    return null;
  }

  function getCardSearchText(card) {
    return [
      card.name,
      card.text,
      card.source === "SPELL" ? "заклинание tavern spell" : "",
      card.source === "MINION" ? "существо minion" : "",
      card.source === "HERO" ? "герой hero" : "",
      card.source === "ACCESSORY" ? "аксессуар accessory trinket малый большой" : "",
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
    accessorySizeSelect.disabled = !enabled;
    if (!enabled && accessorySizeSelect.value !== "ALL") {
      accessorySizeSelect.value = "ALL";
      state.accessorySize = "ALL";
    }
  }

  function getLibraryMeta(card) {
    if (card.source === "SPELL") {
      return `Заклинание • Таверна ${card.techLevel || "?"} • Мана ${card.manaCost ?? 0}`;
    }

    if (card.source === "HERO") {
      return `Герой • ${card.heroTier || "Пул героев"}`;
    }

    if (card.source === "ACCESSORY") {
      return `${card.accessorySize === "LARGE" ? "Большой аксессуар" : "Малый аксессуар"} • Новый слот стратегии`;
    }

    const raceLabel = raceNames[(card.races || [])[0]] || "Без типа";
    return `${raceLabel} • Таверна ${card.techLevel || "?"}`;
  }

  function getSourceLabel(card) {
    if (card.source === "SPELL") {
      return "Заклинание";
    }
    if (card.source === "HERO") {
      return "Герой";
    }
    if (card.source === "ACCESSORY") {
      return "Аксессуар";
    }
    return "Существо";
  }

  function renderLibrary() {
    libraryEl.replaceChildren();

    if (!state.filtered.length) {
      setStatus("По текущим фильтрам ничего не найдено.");
      return;
    }

    const heroCount = state.filtered.filter((card) => card.source === "HERO").length;
    const minionCount = state.filtered.filter((card) => card.source === "MINION").length;
    const spellCount = state.filtered.filter((card) => card.source === "SPELL").length;
    const accessoryCount = state.filtered.filter((card) => card.source === "ACCESSORY").length;
    setStatus(`Доступно ${state.filtered.length} карт: ${heroCount} героев, ${minionCount} существ, ${spellCount} заклинаний и ${accessoryCount} аксессуаров.`);

    state.filtered.forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `builder-card${card.source === "SPELL" ? " is-spell" : ""}${card.source === "HERO" ? " is-hero" : ""}`;
      button.draggable = true;
      button.innerHTML = `
        <div class="builder-card-media">
          <img class="builder-card-art" src="${getCardArtUrl(card, "256x")}" alt="${card.name}" loading="lazy" decoding="async">
        </div>
        <div class="builder-card-copy">
          <div class="builder-card-topline">
            <span class="builder-card-badge">${getSourceLabel(card)}</span>
            <span class="builder-card-tier">${card.source === "HERO" ? card.heroTier || "?" : `Т${card.techLevel || "?"}`}</span>
          </div>
          <strong>${card.name}</strong>
          <span>${getLibraryMeta(card)}</span>
        </div>
      `;

      button.addEventListener("dragstart", (event) => {
        state.draggingLibrary = true;
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", String(card.id));
      });

      button.addEventListener("dragend", () => {
        state.draggingLibrary = false;
      });

      button.addEventListener("click", () => addCardToBoard(card));
      libraryEl.append(button);
    });
  }

  function addCardToBoard(card, preferredSlot = null) {
    const slot = preferredSlot ?? getFirstFreeSlot();

    if (slot === null) {
      setStatus("Все 15 слотов заняты. Удали карту или переставь существующую.");
      return;
    }

    const placedCard = {
      uid: crypto.randomUUID(),
      id: card.id,
      name: card.name,
      source: card.source,
      artUrl: getCardArtUrl(card, "512x"),
      slot
    };

    state.placed.push(placedCard);
    state.activeId = placedCard.uid;
    renderBoard();
  }

  function removePlacedCard(uid) {
    state.placed = state.placed.filter((card) => card.uid !== uid);

    if (state.activeId === uid) {
      state.activeId = state.placed[0]?.uid || null;
    }

    renderBoard();
  }

  function movePlacedCardToSlot(uid, targetSlot) {
    const movingCard = state.placed.find((card) => card.uid === uid);
    if (!movingCard) {
      return;
    }

    const occupant = state.placed.find((card) => card.slot === targetSlot && card.uid !== uid);
    if (!occupant) {
      state.placed = state.placed.map((card) => (
        card.uid === uid ? { ...card, slot: targetSlot } : card
      ));
      renderBoard();
      return;
    }

    const originalSlot = movingCard.slot;
    state.placed = state.placed.map((card) => {
      if (card.uid === uid) {
        return { ...card, slot: targetSlot };
      }
      if (card.uid === occupant.uid) {
        return { ...card, slot: originalSlot };
      }
      return card;
    });

    renderBoard();
  }

  function renderBoard() {
    boardEl.replaceChildren();

    const hint = document.createElement("div");
    hint.className = "strategy-board-hint";
    hint.textContent = "Полотно стало компактнее, а библиотека слева шире. Перетаскивай сюда героев, существ и заклинания.";

    if (!state.placed.length) {
      boardEl.append(hint);
    }

    state.placed.forEach((card) => {
      const slotPosition = getSlotPosition(card.slot);
      const tile = document.createElement("article");
      tile.className = `placed-card${state.activeId === card.uid ? " is-active" : ""}`;
      tile.style.left = `${slotPosition.x * 100}%`;
      tile.style.top = `${slotPosition.y * 100}%`;
      tile.innerHTML = `
        <img class="placed-card-art" src="${card.artUrl}" alt="${card.name}">
        <button class="placed-card-remove" type="button" aria-label="Удалить карту">×</button>
      `;

      tile.addEventListener("pointerdown", (event) => {
        if (event.target.closest(".placed-card-remove")) {
          return;
        }

        state.activeId = card.uid;
        state.draggingPlaced = true;
        const boardRect = boardEl.getBoundingClientRect();
        tile.classList.add("is-dragging");

        const move = (moveEvent) => {
          const localX = moveEvent.clientX - boardRect.left;
          const localY = moveEvent.clientY - boardRect.top;
          tile.style.left = `${localX}px`;
          tile.style.top = `${localY}px`;
        };

        const release = (releaseEvent) => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", release);
          tile.classList.remove("is-dragging");
          state.draggingPlaced = false;
          movePlacedCardToSlot(card.uid, getNearestSlot(releaseEvent.clientX, releaseEvent.clientY));
        };

        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", release);
      });

      tile.querySelector(".placed-card-remove").addEventListener("click", () => removePlacedCard(card.uid));
      boardEl.append(tile);
    });

    syncCounter();
  }

  async function exportBoard(fileType) {
    if (!state.placed.length) {
      setStatus("Сначала добавь хотя бы одну карту на полотно.");
      return;
    }

    const entries = await Promise.all(state.placed.map(async (card) => ({
      card,
      image: await window.Shared.loadImageFromSource(card.artUrl)
    })));

    const occupiedRows = [...new Set(entries.map(({ card }) => Math.floor(card.slot / BOARD_COLUMNS)))].sort((a, b) => a - b);
    const rowMap = new Map(occupiedRows.map((row, index) => [row, index]));
    const exportRows = Math.max(1, occupiedRows.length);
    const cardWidth = (EXPORT_WIDTH - EXPORT_SIDE_PADDING * 2 - EXPORT_COLUMN_GAP * (BOARD_COLUMNS - 1)) / BOARD_COLUMNS;
    const maxCardHeight = Math.max(...entries.map(({ image }) => cardWidth * (image.height / image.width)));
    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_WIDTH;
    canvas.height = Math.ceil(EXPORT_TOP_PADDING + exportRows * maxCardHeight + Math.max(0, exportRows - 1) * EXPORT_ROW_GAP + EXPORT_BOTTOM_PADDING);
    const ctx = canvas.getContext("2d");

    for (const { card, image } of entries) {
      const originalRow = Math.floor(card.slot / BOARD_COLUMNS);
      const compactRow = rowMap.get(originalRow) ?? 0;
      const imageRatio = image.width / image.height;
      const cardHeight = cardWidth / imageRatio;
      const column = card.slot % BOARD_COLUMNS;
      const x = EXPORT_SIDE_PADDING + column * (cardWidth + EXPORT_COLUMN_GAP);
      const rowTop = EXPORT_TOP_PADDING + compactRow * (maxCardHeight + EXPORT_ROW_GAP);
      const y = rowTop + (maxCardHeight - cardHeight) / 2;
      ctx.drawImage(image, x, y, cardWidth, cardHeight);
    }

    const mimeType = fileType === "png" ? "image/png" : "image/webp";
    const extension = fileType === "png" ? "png" : "webp";
    const quality = fileType === "png" ? 1 : 0.98;

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Не удалось собрать стратегию.")), mimeType, quality);
    });

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `strategy-board.${extension}`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1200);
  }

  async function exportBoardStable(fileType) {
    if (!state.placed.length) {
      setStatus("РЎРЅР°С‡Р°Р»Р° РґРѕР±Р°РІСЊ С…РѕС‚СЏ Р±С‹ РѕРґРЅСѓ РєР°СЂС‚Сѓ РЅР° РїРѕР»РѕС‚РЅРѕ.");
      return;
    }

    const occupiedRows = [...new Set(state.placed.map((card) => Math.floor(card.slot / BOARD_COLUMNS)))].sort((a, b) => a - b);
    const rowMap = new Map(occupiedRows.map((row, index) => [row, index]));
    const exportRows = Math.max(1, occupiedRows.length);
    const cardWidth = (EXPORT_WIDTH - EXPORT_SIDE_PADDING * 2 - EXPORT_COLUMN_GAP * (BOARD_COLUMNS - 1)) / BOARD_COLUMNS;
    const compactSlots = Array.from({ length: exportRows * BOARD_COLUMNS }, () => ({
      id: `empty-${crypto.randomUUID()}`,
      name: "",
      exportImage: EMPTY_EXPORT_PIXEL,
      image: EMPTY_EXPORT_PIXEL
    }));

    state.placed.forEach((card) => {
      const originalRow = Math.floor(card.slot / BOARD_COLUMNS);
      const compactRow = rowMap.get(originalRow) ?? 0;
      const column = card.slot % BOARD_COLUMNS;
      compactSlots[compactRow * BOARD_COLUMNS + column] = {
        ...card,
        exportImage: card.artUrl,
        image: card.artUrl
      };
    });

    const mimeType = fileType === "png" ? "image/png" : "image/webp";
    const extension = fileType === "png" ? "png" : "webp";

    await window.Shared.exportCardSheet(compactSlots, {
      fileBaseName: "strategy-board",
      columns: BOARD_COLUMNS,
      gap: EXPORT_COLUMN_GAP,
      padding: EXPORT_SIDE_PADDING,
      cardWidth,
      artHeight: Math.round(cardWidth * 1.7),
      renderScale: 1,
      showHeader: false,
      showText: false,
      showMeta: false,
      showCardBackground: false,
      background: "transparent",
      headerHeight: EXPORT_TOP_PADDING + EXPORT_BOTTOM_PADDING,
      maxWidthOrHeight: fileType === "png" ? EXPORT_WIDTH : 3200,
      maxSizeMB: 1.95,
      initialQuality: 0.96,
      outputQuality: fileType === "png" ? 1 : 0.98,
      outputType: mimeType,
      compress: fileType !== "png"
    });

    setStatus(`Стратегия сохранена в формате ${extension.toUpperCase()}.`);
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
      id: String(card.id),
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

      state.cards = [...heroes, ...minions, ...spells, ...accessories];
      syncAccessorySizeFilter();
      updateLibrary();
      renderBoard();
    } catch (error) {
      console.error(error);
      setStatus("Не удалось загрузить библиотеку героев, карт и заклинаний.");
    }
  }

  function updateLibrary() {
    state.filtered = state.cards.filter(matchesFilters);
    renderLibrary();
  }

  boardEl.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  boardEl.addEventListener("drop", (event) => {
    event.preventDefault();
    const cardId = event.dataTransfer.getData("text/plain");
    const card = state.cards.find((item) => String(item.id) === String(cardId));
    if (!card) {
      return;
    }

    addCardToBoard(card, getNearestSlot(event.clientX, event.clientY));
  });

  searchInput.addEventListener("input", window.Shared.debounce((event) => {
    state.search = event.target.value;
    updateLibrary();
  }, 120));

  sourceSelect.addEventListener("change", (event) => {
    state.source = event.target.value;
    syncAccessorySizeFilter();
    updateLibrary();
  });

  raceSelect.addEventListener("change", (event) => {
    state.race = event.target.value;
    updateLibrary();
  });

  levelSelect.addEventListener("change", (event) => {
    state.level = event.target.value;
    updateLibrary();
  });

  accessorySizeSelect.addEventListener("change", (event) => {
    state.accessorySize = event.target.value;
    updateLibrary();
  });

  clearButton.addEventListener("click", () => {
    state.placed = [];
    state.activeId = null;
    renderBoard();
  });

  exportPngButton.addEventListener("click", () => exportBoardStable("png"));
  exportWebpButton.addEventListener("click", () => exportBoardStable("webp"));

  document.addEventListener("wheel", (event) => {
    if (state.draggingLibrary || state.draggingPlaced) {
      window.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: "auto" });
    }
  }, { passive: true });

  bootstrap();
})();
