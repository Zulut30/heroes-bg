(function () {
  const searchInput = document.getElementById("builder-search");
  const sourceSelect = document.getElementById("builder-source");
  const raceSelect = document.getElementById("builder-race");
  const levelSelect = document.getElementById("builder-level");
  const accessorySizeSelect = document.getElementById("builder-accessory-size");
  const clearButton = document.getElementById("builder-clear");
  const exportPngButton = document.getElementById("builder-export-png");
  const exportWebpButton = document.getElementById("builder-export-webp");
  const toggleGridButton = document.getElementById("builder-toggle-grid");
  const toggleBackgroundInput = document.getElementById("builder-toggle-background");
  const quickSlotsEl = document.getElementById("quick-slots");
  const statusEl = document.getElementById("builder-status");
  const libraryEl = document.getElementById("builder-library");
  const boardEl = document.getElementById("strategy-board");
  const counterEl = document.getElementById("builder-counter");

  const BOARD_COLUMNS = 5;
  const BOARD_ROWS = 3;
  const BOARD_SLOT_COUNT = BOARD_COLUMNS * BOARD_ROWS;
  const EXPORT_WIDTH = 2200;
  const EXPORT_SIDE_PADDING = 60;
  const EXPORT_TOP_PADDING = 32;
  const EXPORT_BOTTOM_PADDING = 32;
  const EXPORT_COLUMN_GAP = 24;
  const EXPORT_ROW_GAP = 20;
  const QUICK_SLOTS_COUNT = 10;
  const QUICK_SLOTS_STORAGE_KEY = "strategy-builder-quick-slots-v1";
  const BACKGROUND_STORAGE_KEY = "strategy-builder-background-mode-v1";
  const WALLPAPER_BLUR_PX = 14;
  const WALLPAPER_BRIGHTNESS = 0.45;
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
    draggingPlaced: false,
    showGrid: false,
    backgroundMode: loadBackgroundMode(),
    quickSlots: loadQuickSlots()
  };

  function loadQuickSlots() {
    try {
      const raw = window.localStorage.getItem(QUICK_SLOTS_STORAGE_KEY);
      if (!raw) {
        return new Array(QUICK_SLOTS_COUNT).fill(null);
      }
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      const normalized = new Array(QUICK_SLOTS_COUNT).fill(null);
      for (let index = 0; index < Math.min(QUICK_SLOTS_COUNT, list.length); index += 1) {
        const entry = list[index];
        if (entry && entry.id && entry.source) {
          normalized[index] = { id: String(entry.id), source: String(entry.source) };
        }
      }
      return normalized;
    } catch (error) {
      console.warn("Не удалось прочитать быстрые слоты из localStorage.", error);
      return new Array(QUICK_SLOTS_COUNT).fill(null);
    }
  }

  function saveQuickSlots() {
    try {
      window.localStorage.setItem(QUICK_SLOTS_STORAGE_KEY, JSON.stringify(state.quickSlots));
    } catch (error) {
      console.warn("Не удалось сохранить быстрые слоты.", error);
    }
  }

  function loadBackgroundMode() {
    try {
      const value = window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
      return value === "wallpaper" ? "wallpaper" : "transparent";
    } catch (error) {
      return "transparent";
    }
  }

  function saveBackgroundMode() {
    try {
      window.localStorage.setItem(BACKGROUND_STORAGE_KEY, state.backgroundMode);
    } catch (error) {
      console.warn("Не удалось сохранить режим фона.", error);
    }
  }

  function findCard(id, source) {
    return state.cards.find((card) => String(card.id) === String(id) && card.source === source);
  }

  function getCardArtUrl(card, size = "512x") {
    if (card?.source === "SPELL" || card?.source === "HERO" || card?.source === "ACCESSORY") {
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

  function getEnglishNameFromImagePath(imagePath) {
    const raw = String(imagePath || "").trim();
    if (!raw) {
      return "";
    }

    const filename = raw.split("/").pop() || raw;
    const withoutExtension = filename.replace(/\.[a-z0-9]+$/i, "");

    try {
      return decodeURIComponent(withoutExtension).replace(/\s+/g, " ").trim();
    } catch (error) {
      return withoutExtension.replace(/\s+/g, " ").trim();
    }
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function syncCounter() {
    counterEl.textContent = `${state.placed.length} карт на полотне`;
    boardEl.classList.toggle("is-empty", state.placed.length === 0);
  }

  function applyBoardVisualSettings() {
    boardEl.classList.toggle("show-grid", state.showGrid);
    boardEl.classList.toggle("has-wallpaper", state.backgroundMode === "wallpaper");
    if (toggleGridButton) {
      toggleGridButton.classList.toggle("is-active", state.showGrid);
      toggleGridButton.textContent = state.showGrid ? "Скрыть сетку" : "Показать сетку";
      toggleGridButton.setAttribute("aria-pressed", state.showGrid ? "true" : "false");
    }
    if (toggleBackgroundInput) {
      toggleBackgroundInput.checked = state.backgroundMode === "wallpaper";
    }
  }

  function renderQuickSlots() {
    if (!quickSlotsEl) {
      return;
    }
    quickSlotsEl.replaceChildren();

    for (let index = 0; index < QUICK_SLOTS_COUNT; index += 1) {
      const entry = state.quickSlots[index];
      const card = entry ? findCard(entry.id, entry.source) : null;
      const slot = document.createElement("div");
      slot.className = `quick-slot${card ? " is-filled" : " is-empty"}`;
      slot.dataset.index = String(index);
      slot.title = card ? `${card.name} — клик, чтобы добавить на полотно` : "Пустой быстрый слот";

      if (card) {
        const art = document.createElement("img");
        art.className = "quick-slot-art";
        art.src = getCardArtUrl(card, "256x");
        art.alt = card.name;
        art.loading = "lazy";
        art.decoding = "async";
        slot.append(art);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "quick-slot-remove";
        remove.setAttribute("aria-label", "Убрать из быстрых слотов");
        remove.textContent = "×";
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          state.quickSlots[index] = null;
          saveQuickSlots();
          renderQuickSlots();
        });
        slot.append(remove);

        slot.addEventListener("click", () => {
          addCardToBoard(card);
        });
      }

      slot.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        slot.classList.add("is-drop-target");
      });
      slot.addEventListener("dragleave", () => {
        slot.classList.remove("is-drop-target");
      });
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        slot.classList.remove("is-drop-target");
        const dropped = readCardFromDataTransfer(event.dataTransfer);
        if (!dropped) {
          return;
        }
        const existingIndex = state.quickSlots.findIndex((slotEntry) => (
          slotEntry && String(slotEntry.id) === String(dropped.id) && slotEntry.source === dropped.source
        ));
        if (existingIndex !== -1 && existingIndex !== index) {
          state.quickSlots[existingIndex] = null;
        }
        state.quickSlots[index] = { id: String(dropped.id), source: dropped.source };
        saveQuickSlots();
        renderQuickSlots();
      });

      quickSlotsEl.append(slot);
    }
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
      card.englishName,
      card.slug,
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
        event.dataTransfer.setData("application/x-bg-card", JSON.stringify({
          id: String(card.id),
          source: card.source
        }));
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

    const grid = document.createElement("div");
    grid.className = "strategy-board-grid";
    grid.setAttribute("aria-hidden", "true");
    boardEl.append(grid);

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

    const loadedEntries = await Promise.all(state.placed.map(async (card) => {
      try {
        const image = await window.Shared.loadImageFromSource(card.artUrl);
        return { card, image };
      } catch (error) {
        console.warn(`Не удалось загрузить карту ${card.name}:`, error);
        return null;
      }
    }));
    const entries = loadedEntries.filter(Boolean);

    if (!entries.length) {
      setStatus("Не удалось загрузить ни одной карты для экспорта.");
      return;
    }

    const occupiedRows = [...new Set(entries.map(({ card }) => Math.floor(card.slot / BOARD_COLUMNS)))].sort((a, b) => a - b);
    const rowMap = new Map(occupiedRows.map((row, index) => [row, index]));
    const exportRows = Math.max(1, occupiedRows.length);
    const cardWidth = (EXPORT_WIDTH - EXPORT_SIDE_PADDING * 2 - EXPORT_COLUMN_GAP * (BOARD_COLUMNS - 1)) / BOARD_COLUMNS;
    const maxCardHeight = Math.max(...entries.map(({ image }) => cardWidth * (image.height / image.width)));
    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_WIDTH;
    canvas.height = Math.ceil(EXPORT_TOP_PADDING + exportRows * maxCardHeight + Math.max(0, exportRows - 1) * EXPORT_ROW_GAP + EXPORT_BOTTOM_PADDING);
    const ctx = canvas.getContext("2d");

    if (state.backgroundMode === "wallpaper") {
      try {
        const wallpaper = await window.Shared.loadImageFromSource("./wallpaper.jpg");
        const wallpaperRatio = wallpaper.width / wallpaper.height;
        const canvasRatio = canvas.width / canvas.height;
        let drawW = canvas.width;
        let drawH = canvas.height;
        if (wallpaperRatio > canvasRatio) {
          drawH = canvas.height;
          drawW = drawH * wallpaperRatio;
        } else {
          drawW = canvas.width;
          drawH = drawW / wallpaperRatio;
        }
        const drawX = (canvas.width - drawW) / 2;
        const drawY = (canvas.height - drawH) / 2;
        ctx.save();
        ctx.filter = `blur(${WALLPAPER_BLUR_PX}px) brightness(${WALLPAPER_BRIGHTNESS})`;
        ctx.drawImage(wallpaper, drawX, drawY, drawW, drawH);
        ctx.restore();
        ctx.fillStyle = "rgba(4, 8, 16, 0.35)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } catch (error) {
        console.warn("Не удалось отрисовать игровой фон:", error);
      }
    }

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
      id: String(card.id),
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
      englishName: "",
      slug: "",
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
      const [libraryResponse, spellsResponse, englishNamesResponse] = await Promise.all([
        fetch("./bgs-library.json", { cache: "force-cache" }),
        fetch("./api/battlegrounds-spells?locale=ru_RU&pageSize=200", {
          headers: { Accept: "application/json" }
        }),
        fetch("./api/battlegrounds-card-names?locale=en_US", {
          headers: { Accept: "application/json" }
        })
      ]);

      if (!libraryResponse.ok) {
        throw new Error(`Library HTTP ${libraryResponse.status}`);
      }
      if (!spellsResponse.ok) {
        throw new Error(`Spells HTTP ${spellsResponse.status}`);
      }
      if (!englishNamesResponse.ok) {
        throw new Error(`English names HTTP ${englishNamesResponse.status}`);
      }

      const libraryPayload = await libraryResponse.json();
      const spellsPayload = await spellsResponse.json();
      const englishNamesPayload = await englishNamesResponse.json();
      const englishById = new Map((englishNamesPayload.cards || []).map((card) => [String(card.id), card]));
      const heroes = getHeroCards();
      const minions = Array.isArray(libraryPayload.cards)
        ? libraryPayload.cards.map((card) => normalizeMinionCard({
          ...card,
          englishName: englishById.get(String(card.id))?.name || "",
          slug: englishById.get(String(card.id))?.slug || ""
        }))
        : [];
      const spells = Array.isArray(spellsPayload.cards)
        ? spellsPayload.cards.map((card) => normalizeSpellCard({
          ...card,
          englishName: englishById.get(String(card.id))?.name || "",
          slug: englishById.get(String(card.id))?.slug || ""
        }))
        : [];
      const accessoriesPayload = window.accessoriesData || {};
      const accessories = [...(accessoriesPayload.small || []), ...(accessoriesPayload.large || [])].map(normalizeAccessoryCard);

      state.cards = [...heroes, ...minions, ...spells, ...accessories];
      syncAccessorySizeFilter();
      updateLibrary();
      renderBoard();
      renderQuickSlots();
      applyBoardVisualSettings();
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
    const card = readCardFromDataTransfer(event.dataTransfer);
    if (!card) {
      return;
    }

    addCardToBoard(card, getNearestSlot(event.clientX, event.clientY));
  });

  function readCardFromDataTransfer(dataTransfer) {
    const rich = dataTransfer.getData("application/x-bg-card");
    if (rich) {
      try {
        const parsed = JSON.parse(rich);
        const found = findCard(parsed.id, parsed.source);
        if (found) {
          return found;
        }
      } catch (error) {
        // fall through to text/plain
      }
    }
    const cardId = dataTransfer.getData("text/plain");
    return state.cards.find((item) => String(item.id) === String(cardId)) || null;
  }

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

  exportPngButton.addEventListener("click", () => exportBoard("png"));
  exportWebpButton.addEventListener("click", () => exportBoard("webp"));

  if (toggleGridButton) {
    toggleGridButton.addEventListener("click", () => {
      state.showGrid = !state.showGrid;
      applyBoardVisualSettings();
    });
  }

  if (toggleBackgroundInput) {
    toggleBackgroundInput.addEventListener("change", (event) => {
      state.backgroundMode = event.target.checked ? "wallpaper" : "transparent";
      saveBackgroundMode();
      applyBoardVisualSettings();
    });
  }

  document.addEventListener("wheel", (event) => {
    if (state.draggingLibrary || state.draggingPlaced) {
      window.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: "auto" });
    }
  }, { passive: true });

  bootstrap();
})();
