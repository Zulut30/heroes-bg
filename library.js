(function () {
  const statusEl = document.getElementById("library-status");
  const resultsEl = document.getElementById("library-results");
  const raceFiltersEl = document.getElementById("race-filters");
  const levelFiltersEl = document.getElementById("level-filters");
  const raceLabelEl = document.getElementById("active-races-label");
  const levelLabelEl = document.getElementById("active-levels-label");
  const searchInput = document.getElementById("card-search");
  const sortSelect = document.getElementById("sort-select");
  const resetButton = document.getElementById("reset-filters");
  const exportButton = document.getElementById("export-selection");
  const excludeDuosInput = document.getElementById("exclude-duos");
  const lightbox = document.getElementById("lightbox");
  const lightboxImage = document.getElementById("lightbox-image");
  const lightboxTitle = document.getElementById("lightbox-title");
  const lightboxMeta = document.getElementById("lightbox-meta");
  const lightboxText = document.getElementById("lightbox-text");
  const lightboxKicker = document.getElementById("lightbox-kicker");
  const lightboxPrev = document.getElementById("lightbox-prev");
  const lightboxNext = document.getElementById("lightbox-next");

  const raceNames = {
    NONE: "Нейтральные",
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

  const raceDecor = {
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

  const state = {
    cards: [],
    filtered: [],
    search: "",
    races: new Set(),
    levels: new Set(),
    excludeDuos: false,
    sort: "tech-name",
    lightboxIndex: -1
  };

  function getCardArtUrl(card, size = "256x") {
    if (!card?.id) {
      return card?.artUrl || "";
    }
    return `/api/card-art?id=${encodeURIComponent(card.id)}&locale=ruRU&size=${encodeURIComponent(size)}`;
  }

  function isDuoCard(card) {
    return /^BGDUO/i.test(String(card?.id || ""));
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase().trim();
  }

  function toAsciiSlug(value) {
    return normalizeText(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "selection";
  }

  function syncStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.search = params.get("q") || "";
    state.sort = params.get("sort") || "tech-name";
    state.races = new Set((params.get("r") || "").split(",").filter(Boolean));
    state.levels = new Set((params.get("lvl") || "").split(",").filter(Boolean));
    state.excludeDuos = params.get("duos") === "off";

    searchInput.value = state.search;
    sortSelect.value = state.sort;
    excludeDuosInput.checked = state.excludeDuos;
  }

  function syncUrlFromState() {
    const params = new URLSearchParams();

    if (state.search) {
      params.set("q", state.search);
    }
    if (state.races.size) {
      params.set("r", [...state.races].join(","));
    }
    if (state.levels.size) {
      params.set("lvl", [...state.levels].join(","));
    }
    if (state.sort !== "tech-name") {
      params.set("sort", state.sort);
    }
    if (state.excludeDuos) {
      params.set("duos", "off");
    }

    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
  }

  function createChip(label, isActive, onClick, options = {}) {
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

  function updateLabels() {
    raceLabelEl.textContent = state.races.size
      ? [...state.races].map((race) => raceNames[race] || race).join(", ")
      : "Все карты";

    levelLabelEl.textContent = state.levels.size
      ? [...state.levels].map((level) => `Таверна ${level}`).join(", ")
      : "Все уровни";
  }

  function renderRaceFilters() {
    const races = ["ALL", "NONE", ...Object.keys(raceNames).filter((key) => !["ALL", "NONE"].includes(key))];
    raceFiltersEl.replaceChildren();

    races.forEach((race) => {
      const isActive = race === "ALL" ? state.races.size === 0 : state.races.has(race);
      raceFiltersEl.append(
        createChip(raceNames[race], isActive, () => {
          if (race === "ALL") {
            state.races.clear();
          } else {
            if (state.races.has(race)) {
              state.races.delete(race);
            } else {
              state.races.add(race);
            }
          }
          updateAndRender();
        }, { icon: raceDecor[race] })
      );
    });
  }

  function renderLevelFilters() {
    levelFiltersEl.replaceChildren();
    ["1", "2", "3", "4", "5", "6", "7"].forEach((level) => {
      levelFiltersEl.append(
        createChip(`Таверна ${level}`, state.levels.has(level), () => {
          if (state.levels.has(level)) {
            state.levels.delete(level);
          } else {
            state.levels.add(level);
          }
          updateAndRender();
        }, { icon: `./assset/tier${level}.png` })
      );
    });
  }

  function matchesRace(card) {
    if (!state.races.size) {
      return true;
    }

    const cardRaces = card.races?.length ? card.races : ["NONE"];
    return [...state.races].some((race) => cardRaces.includes(race));
  }

  function matchesLevel(card) {
    if (!state.levels.size) {
      return true;
    }

    return state.levels.has(String(card.techLevel || 0));
  }

  function matchesDuo(card) {
    if (!state.excludeDuos) {
      return true;
    }
    return !isDuoCard(card);
  }

  function matchesSearch(card) {
    if (!state.search) {
      return true;
    }

    const haystack = [
      card.name,
      card.text,
      (card.races || []).join(" "),
      raceNames[(card.races || [])[0]],
      `таверна ${card.techLevel}`
    ]
      .filter(Boolean)
      .join(" ");

    return normalizeText(haystack).includes(normalizeText(state.search));
  }

  function sortCards(cards) {
    const copy = [...cards];

    copy.sort((a, b) => {
      if (state.sort === "name-asc") {
        return a.name.localeCompare(b.name, "ru");
      }
      if (state.sort === "attack-desc") {
        return (b.attack || 0) - (a.attack || 0) || a.name.localeCompare(b.name, "ru");
      }
      if (state.sort === "health-desc") {
        return (b.health || 0) - (a.health || 0) || a.name.localeCompare(b.name, "ru");
      }

      return (a.techLevel || 0) - (b.techLevel || 0) || a.name.localeCompare(b.name, "ru");
    });

    return copy;
  }

  function getCardMeta(card) {
    const typeLabel = card.races?.length ? card.races.map((race) => raceNames[race] || race).join(", ") : "Нейтральные";
    return `Таверна ${card.techLevel || "?"} • ${typeLabel} • ${card.attack || 0}/${card.health || 0}`;
  }

  function openLightbox(index) {
    state.lightboxIndex = index;
    const card = state.filtered[index];
    if (!card) {
      return;
    }

    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lightboxImage.src = getCardArtUrl(card, "512x");
    lightboxImage.alt = card.name;
    lightboxTitle.textContent = card.name;
    lightboxMeta.textContent = getCardMeta(card);
    lightboxText.textContent = card.text || "Текст карты отсутствует.";
    lightboxKicker.textContent = card.races?.length
      ? card.races.map((race) => raceNames[race] || race).join(" • ")
      : "Нейтральные";
  }

  function closeLightbox() {
    state.lightboxIndex = -1;
    lightbox.hidden = true;
    document.body.style.overflow = "";
    lightboxImage.src = "";
  }

  function moveLightbox(step) {
    if (!state.filtered.length) {
      return;
    }
    const nextIndex = (state.lightboxIndex + step + state.filtered.length) % state.filtered.length;
    openLightbox(nextIndex);
  }

  function renderCard(card, globalIndex) {
    const tile = document.createElement("article");
    tile.className = "card-tile";
    tile.tabIndex = 0;
    tile.innerHTML = `
      <img
        class="card-art"
        src="${getCardArtUrl(card, "256x")}"
        alt="${card.name}"
        loading="lazy"
        decoding="async"
        fetchpriority="low"
      >
      <div class="card-copy">
        <h3 class="card-title">${card.name}</h3>
      </div>
    `;

    const activate = () => openLightbox(globalIndex);
    tile.addEventListener("click", activate);
    tile.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
    return tile;
  }

  function renderResults() {
    resultsEl.replaceChildren();

    if (!state.filtered.length) {
      setStatus("По текущим фильтрам ничего не найдено.");
      return;
    }

    setStatus(`Найдено ${state.filtered.length} карт.`);
    const grid = document.createElement("div");
    grid.className = "library-card-grid library-card-grid-flat";
    state.filtered.forEach((card, index) => {
      grid.append(renderCard(card, index));
    });
    resultsEl.append(grid);
  }

  function applyFilters() {
    state.filtered = sortCards(
      state.cards.filter((card) => matchesRace(card) && matchesLevel(card) && matchesSearch(card) && matchesDuo(card))
    );
  }

  function updateAndRender() {
    updateLabels();
    renderRaceFilters();
    renderLevelFilters();
    syncUrlFromState();
    applyFilters();
    renderResults();
  }

  async function exportCurrentSelection() {
    if (!state.filtered.length) {
      setStatus("Сначала выберите хотя бы одну карту.");
      return;
    }

    try {
      exportButton.disabled = true;
      exportButton.textContent = "Готовлю WebP...";

      const parts = [];
      if (state.races.size) {
        parts.push([...state.races].map((race) => race.toLowerCase()).join("-"));
      }
      if (state.levels.size) {
        parts.push(`tavern-${[...state.levels].join("-")}`);
      }
      if (state.search) {
        parts.push(toAsciiSlug(state.search));
      }

      await window.Shared.exportCardSheet(
        state.filtered.map((card) => ({
          ...card,
          exportImage: getCardArtUrl(card, "512x"),
          image: getCardArtUrl(card, "512x")
        })),
        {
          fileBaseName: parts.length ? `bg-${parts.join("-")}` : "bg-selection",
          columns: 6,
          gap: 10,
          padding: 10,
          cardWidth: 360,
          artHeight: 504,
          renderScale: 1.45,
          showHeader: false,
          showText: false,
          showMeta: false,
          showCardBackground: false,
          background: "transparent",
          maxWidthOrHeight: 3200,
          maxSizeMB: 1.95,
          initialQuality: 0.96,
          outputQuality: 0.98
        }
      );

      exportButton.textContent = "Скачать выборку";
    } catch (error) {
      console.error(error);
      exportButton.textContent = "Ошибка экспорта";
    } finally {
      window.setTimeout(() => {
        exportButton.disabled = false;
        exportButton.textContent = "Скачать выборку";
      }, 900);
    }
  }

  async function bootstrap() {
    syncStateFromUrl();
    renderRaceFilters();
    renderLevelFilters();
    updateLabels();

    try {
      setStatus("Загружаю библиотеку карт...");
      const response = await fetch("./bgs-library.json", { cache: "force-cache" });
      const payload = await response.json();
      state.cards = Array.isArray(payload.cards) ? payload.cards : [];
      applyFilters();
      renderResults();
    } catch (error) {
      console.error(error);
      setStatus("Не удалось загрузить библиотеку карт.");
    }
  }

  searchInput.addEventListener(
    "input",
    window.Shared.debounce((event) => {
      state.search = event.target.value.trim();
      updateAndRender();
    }, 120)
  );

  sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    updateAndRender();
  });

  resetButton.addEventListener("click", () => {
    state.search = "";
    state.races.clear();
    state.levels.clear();
    state.excludeDuos = false;
    state.sort = "tech-name";
    searchInput.value = "";
    sortSelect.value = state.sort;
    excludeDuosInput.checked = false;
    updateAndRender();
  });

  excludeDuosInput.addEventListener("change", (event) => {
    state.excludeDuos = event.target.checked;
    updateAndRender();
  });

  exportButton.addEventListener("click", exportCurrentSelection);
  lightbox.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeLightbox === "true") {
      closeLightbox();
    }
  });
  lightboxPrev.addEventListener("click", () => moveLightbox(-1));
  lightboxNext.addEventListener("click", () => moveLightbox(1));

  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) {
      return;
    }
    if (event.key === "Escape") {
      closeLightbox();
    }
    if (event.key === "ArrowLeft") {
      moveLightbox(-1);
    }
    if (event.key === "ArrowRight") {
      moveLightbox(1);
    }
  });

  bootstrap();
})();
