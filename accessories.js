(function () {
  const status = document.getElementById("accessories-status");
  const counter = document.getElementById("accessories-counter");
  const grid = document.getElementById("accessories-grid");
  const searchInput = document.getElementById("accessories-search");
  const resetButton = document.getElementById("accessories-reset");
  const exportButton = document.getElementById("accessories-export");
  const tabButtons = [...document.querySelectorAll("[data-size]")];
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
    size: "ALL",
    lightboxIndex: -1
  };

  function normalize(value) {
    return String(value || "").toLowerCase().trim();
  }

  function getSizeLabel(size) {
    return size === "LARGE" ? "Большой аксессуар" : "Малый аксессуар";
  }

  function applySizeTabs() {
    tabButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.size === state.size);
    });
  }

  function matchesFilters(card) {
    const searchOk = !state.search || normalize(`${card.name} ${getSizeLabel(card.size)}`).includes(normalize(state.search));
    const sizeOk = state.size === "ALL" || card.size === state.size;
    return searchOk && sizeOk;
  }

  function openLightbox(index) {
    const card = state.filtered[index];
    if (!card) {
      return;
    }

    state.lightboxIndex = index;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lightboxImage.src = encodeURI(card.image);
    lightboxImage.alt = card.name;
    lightboxTitle.textContent = card.name;
    lightboxMeta.textContent = getSizeLabel(card.size);
    lightboxText.textContent = "Аксессуар для Battlegrounds.";
    lightboxKicker.textContent = "Аксессуар";
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
    applySizeTabs();

    if (!state.filtered.length) {
      status.textContent = "По текущим фильтрам ничего не найдено.";
      return;
    }

    const smallCount = state.filtered.filter((card) => card.size === "SMALL").length;
    const largeCount = state.filtered.filter((card) => card.size === "LARGE").length;
    status.textContent = `Найдено ${state.filtered.length} аксессуаров: ${smallCount} малых и ${largeCount} больших.`;

    state.filtered.forEach((card) => {
      const tile = document.createElement("article");
      tile.className = "card-tile";
      tile.tabIndex = 0;
      tile.innerHTML = `
        <img
          class="card-art"
          src="${encodeURI(card.image)}"
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
      status.textContent = "Сначала выберите хотя бы один аксессуар.";
      return;
    }

    try {
      exportButton.disabled = true;
      exportButton.textContent = "Готовлю WebP...";

      await window.Shared.exportCardSheet(
        state.filtered.map((card) => ({
          ...card,
          exportImage: encodeURI(card.image),
          image: encodeURI(card.image)
        })),
        {
          fileBaseName: state.size === "ALL" ? "bg-accessories" : `bg-accessories-${state.size.toLowerCase()}`,
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

  function loadAccessories() {
    const payload = window.accessoriesData || {};
    state.cards = [...(payload.small || []), ...(payload.large || [])];
    applyFilters();
  }

  searchInput.addEventListener("input", window.Shared.debounce((event) => {
    state.search = event.target.value.trim();
    applyFilters();
  }, 120));

  resetButton.addEventListener("click", () => {
    state.search = "";
    state.size = "ALL";
    searchInput.value = "";
    applyFilters();
  });

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.size = button.dataset.size;
      applyFilters();
    });
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

  loadAccessories();
})();
