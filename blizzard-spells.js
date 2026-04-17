(function () {
  const status = document.getElementById("spells-status");
  const counter = document.getElementById("spells-counter");
  const grid = document.getElementById("spells-grid");
  const searchInput = document.getElementById("spells-search");
  const filterSelect = document.getElementById("spells-filter");
  const resetButton = document.getElementById("spells-reset");
  const exportButton = document.getElementById("spells-export");

  const state = {
    cards: [],
    filtered: [],
    search: "",
    tier: "ALL"
  };

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function stripHtml(value) {
    const tmp = document.createElement("div");
    tmp.innerHTML = value || "";
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  }

  function matchesFilters(card) {
    const searchOk = !state.search || normalize(`${card.name} ${card.text} ${card.flavorText}`).includes(normalize(state.search));
    const tierOk = state.tier === "ALL" ? true : String(card.tier || "") === state.tier;
    return searchOk && tierOk;
  }

  function render() {
    grid.innerHTML = "";
    counter.textContent = `${state.filtered.length} карточек`;

    if (!state.filtered.length) {
      status.textContent = "По текущим фильтрам ничего не найдено.";
      return;
    }

    status.textContent = `Найдено ${state.filtered.length} заклинаний.`;

    state.filtered.forEach((card) => {
      const tile = document.createElement("article");
      tile.className = "card-tile";
      tile.innerHTML = `
        <img
          class="card-art"
          src="${card.image}"
          alt="${card.name}"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
        >
      `;
      grid.append(tile);
    });
  }

  function applyFilters() {
    state.filtered = state.cards.filter(matchesFilters);
    render();
  }

  async function exportCurrentSelection() {
    if (!state.filtered.length) {
      status.textContent = "Сначала выберите хотя бы одно заклинание.";
      return;
    }

    try {
      exportButton.disabled = true;
      exportButton.textContent = "Готовлю WebP...";

      await window.Shared.exportCardSheet(
        state.filtered.map((card) => ({
          ...card,
          exportImage: card.image,
          image: card.image
        })),
        {
          fileBaseName: state.tier === "ALL" ? "bg-spells" : `bg-spells-tier-${state.tier}`,
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
    } catch (error) {
      console.error(error);
      status.textContent = `Ошибка экспорта: ${error.message}`;
    } finally {
      window.setTimeout(() => {
        exportButton.disabled = false;
        exportButton.textContent = "Скачать выборку";
      }, 900);
    }
  }

  async function loadSpells() {
    try {
      const response = await fetch("./api/battlegrounds-spells?locale=ru_RU&pageSize=200", {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      state.cards = (payload.cards || []).map((card) => ({
        ...card,
        text: stripHtml(card.text || "")
      }));

      applyFilters();
    } catch (error) {
      status.textContent = `Ошибка загрузки: ${error.message}`;
    }
  }

  searchInput.addEventListener("input", window.Shared.debounce((event) => {
    state.search = event.target.value.trim();
    applyFilters();
  }, 120));

  filterSelect.addEventListener("change", (event) => {
    state.tier = event.target.value;
    applyFilters();
  });

  resetButton.addEventListener("click", () => {
    state.search = "";
    state.tier = "ALL";
    searchInput.value = "";
    filterSelect.value = "ALL";
    applyFilters();
  });

  exportButton.addEventListener("click", exportCurrentSelection);

  loadSpells();
})();
