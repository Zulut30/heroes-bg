(function () {
  const searchInput = document.getElementById("builder-search");
  const raceSelect = document.getElementById("builder-race");
  const levelSelect = document.getElementById("builder-level");
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
  const EXPORT_HEIGHT = 1320;
  const SLOT_CARD_WIDTH = 0.19;

  const raceNames = {
    NONE: "Без типа",
    ALL: "Все типы",
    BEAST: "Звери",
    DEMON: "Демоны",
    DRAGON: "Драконы",
    ELEMENTAL: "Элементали",
    MECHANICAL: "Механизмы",
    MURLOC: "Мурлоки",
    NAGA: "Нага",
    PIRATE: "Пираты",
    QUILBOAR: "Свинобразы",
    UNDEAD: "Нежить"
  };

  const state = {
    cards: [],
    filtered: [],
    placed: [],
    search: "",
    race: "ALL",
    level: "ALL",
    activeId: null
  };

  function getCardArtUrl(card, size = "512x") {
    if (!card?.id) {
      return card?.artUrl || "";
    }
    return `/api/card-art?id=${encodeURIComponent(card.id)}&locale=ruRU&size=${encodeURIComponent(size)}`;
  }

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
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
    return {
      x: (column + 0.5) / BOARD_COLUMNS,
      y: (row + 0.5) / BOARD_ROWS
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

  function matchesFilters(card) {
    const searchOk = !state.search || normalize([
      card.name,
      card.text,
      (card.races || []).join(" "),
      `таверна ${card.techLevel}`
    ].join(" ")).includes(normalize(state.search));

    const raceOk = state.race === "ALL"
      ? true
      : state.race === "NONE"
        ? !(card.races && card.races.length)
        : (card.races || []).includes(state.race);

    const levelOk = state.level === "ALL" ? true : String(card.techLevel || "") === state.level;
    return searchOk && raceOk && levelOk;
  }

  function renderLibrary() {
    libraryEl.replaceChildren();
    if (!state.filtered.length) {
      setStatus("По текущим фильтрам ничего не найдено.");
      return;
    }

    setStatus(`Доступно ${state.filtered.length} карт для перетаскивания.`);

    state.filtered.forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "builder-card";
      button.draggable = true;
      button.innerHTML = `
        <img class="builder-card-art" src="${getCardArtUrl(card, "256x")}" alt="${card.name}" loading="lazy" decoding="async">
        <div class="builder-card-copy">
          <strong>${card.name}</strong>
          <span>${raceNames[(card.races || [])[0]] || "Без типа"} • Таверна ${card.techLevel || "?"}</span>
        </div>
      `;

      button.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", card.id);
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
    hint.textContent = "Перетащи карты в невидимую сетку 5 × 3 и собери стратегию";
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

    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_WIDTH;
    canvas.height = EXPORT_HEIGHT;
    const ctx = canvas.getContext("2d");

    for (const card of state.placed) {
      const image = await window.Shared.loadImageFromSource(card.artUrl);
      const slotPosition = getSlotPosition(card.slot);
      const cardWidth = EXPORT_WIDTH * SLOT_CARD_WIDTH;
      const cardHeight = cardWidth / 0.76;
      const x = EXPORT_WIDTH * slotPosition.x - cardWidth / 2;
      const y = EXPORT_HEIGHT * slotPosition.y - cardHeight / 2;
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

  async function bootstrap() {
    try {
      const response = await fetch("./bgs-library.json", { cache: "force-cache" });
      const payload = await response.json();
      state.cards = Array.isArray(payload.cards) ? payload.cards : [];
      state.filtered = state.cards;
      renderLibrary();
      renderBoard();
    } catch (error) {
      console.error(error);
      setStatus("Не удалось загрузить библиотеку карт.");
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
    const card = state.cards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }

    addCardToBoard(card, getNearestSlot(event.clientX, event.clientY));
  });

  searchInput.addEventListener("input", window.Shared.debounce((event) => {
    state.search = event.target.value;
    updateLibrary();
  }, 120));

  raceSelect.addEventListener("change", (event) => {
    state.race = event.target.value;
    updateLibrary();
  });

  levelSelect.addEventListener("change", (event) => {
    state.level = event.target.value;
    updateLibrary();
  });

  clearButton.addEventListener("click", () => {
    state.placed = [];
    state.activeId = null;
    renderBoard();
  });

  exportPngButton.addEventListener("click", () => exportBoard("png"));
  exportWebpButton.addEventListener("click", () => exportBoard("webp"));

  bootstrap();
})();
