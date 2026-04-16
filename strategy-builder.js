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

  function addCardToBoard(card, x = 0.5, y = 0.5) {
    const placedCard = {
      uid: crypto.randomUUID(),
      id: card.id,
      name: card.name,
      artUrl: getCardArtUrl(card, "512x"),
      x,
      y,
      width: 0.22
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

  function updatePlacedCard(uid, nextPatch) {
    state.placed = state.placed.map((card) => (
      card.uid === uid ? { ...card, ...nextPatch } : card
    ));
    renderBoard();
  }

  function renderBoard() {
    boardEl.replaceChildren();

    const hint = document.createElement("div");
    hint.className = "strategy-board-hint";
    hint.textContent = "Перетащи сюда 5-6 карт из библиотеки, чтобы собрать стратегию";
    if (!state.placed.length) {
      boardEl.append(hint);
    }

    state.placed.forEach((card) => {
      const tile = document.createElement("article");
      tile.className = `placed-card${state.activeId === card.uid ? " is-active" : ""}`;
      tile.style.left = `${card.x * 100}%`;
      tile.style.top = `${card.y * 100}%`;
      tile.style.width = `${card.width * 100}%`;
      tile.innerHTML = `
        <img class="placed-card-art" src="${card.artUrl}" alt="${card.name}">
        <button class="placed-card-remove" type="button" aria-label="Удалить карту">×</button>
      `;

      tile.addEventListener("pointerdown", (event) => {
        if (event.target.closest(".placed-card-remove")) {
          return;
        }
        state.activeId = card.uid;
        tile.setPointerCapture(event.pointerId);
        const rect = boardEl.getBoundingClientRect();

        const move = (moveEvent) => {
          const nextX = Math.min(1, Math.max(0, (moveEvent.clientX - rect.left) / rect.width));
          const nextY = Math.min(1, Math.max(0, (moveEvent.clientY - rect.top) / rect.height));
          state.placed = state.placed.map((item) => (
            item.uid === card.uid ? { ...item, x: nextX, y: nextY } : item
          ));
          renderBoard();
        };

        const release = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", release);
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
    const width = 2200;
    const height = 1240;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    for (const card of state.placed) {
      const image = await window.Shared.loadImageFromSource(card.artUrl);
      const cardWidth = width * card.width;
      const cardHeight = cardWidth / 0.715;
      const x = width * card.x - cardWidth / 2;
      const y = height * card.y - cardHeight / 2;
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

    const rect = boardEl.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    addCardToBoard(card, x, y);
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
