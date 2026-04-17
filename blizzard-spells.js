(function () {
  const status = document.getElementById("spells-status");
  const counter = document.getElementById("spells-counter");
  const grid = document.getElementById("spells-grid");
  const searchInput = document.getElementById("spells-search");
  const filterSelect = document.getElementById("spells-filter");
  const excludeDuosInput = document.getElementById("spells-exclude-duos");
  const resetButton = document.getElementById("spells-reset");
  const exportButton = document.getElementById("spells-export");
  const lightbox = document.getElementById("lightbox");
  const lightboxImage = document.getElementById("lightbox-image");
  const lightboxTitle = document.getElementById("lightbox-title");
  const lightboxMeta = document.getElementById("lightbox-meta");
  const lightboxText = document.getElementById("lightbox-text");
  const lightboxKicker = document.getElementById("lightbox-kicker");
  const lightboxPrev = document.getElementById("lightbox-prev");
  const lightboxNext = document.getElementById("lightbox-next");

  const state = {
    cards: [],
    filtered: [],
    search: "",
    tier: "ALL",
    excludeDuos: false,
    lightboxIndex: -1
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
    const duoOk = state.excludeDuos ? !card.battlegrounds?.duosOnly : true;
    return searchOk && tierOk && duoOk;
  }

  function openLightbox(index) {
    const card = state.filtered[index];
    if (!card) {
      return;
    }

    state.lightboxIndex = index;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lightboxImage.src = card.image;
    lightboxImage.alt = card.name;
    lightboxTitle.textContent = card.name;
    lightboxMeta.textContent = `Таверна ${card.tier || "?"} • Мана ${card.manaCost ?? 0}`;
    lightboxText.textContent = card.text || "Текст карты отсутствует.";
    lightboxKicker.textContent = "Заклинание";
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
      tile.tabIndex = 0;
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
      const index = state.filtered.indexOf(card);
      const activate = () => openLightbox(index);
      tile.addEventListener("click", activate);
      tile.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
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
    state.excludeDuos = false;
    searchInput.value = "";
    filterSelect.value = "ALL";
    excludeDuosInput.checked = false;
    applyFilters();
  });

  excludeDuosInput.addEventListener("change", (event) => {
    state.excludeDuos = event.target.checked;
    applyFilters();
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

  loadSpells();
})();
