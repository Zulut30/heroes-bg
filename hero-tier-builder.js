(function () {
  const TIER_ORDER = ["S", "A", "B", "C", "D"];
  const UNASSIGNED_KEY = "UNASSIGNED";

  const state = {
    search: "",
    tiers: {},
    heroesById: new Map(),
    original: null,
    draggingHeroId: null
  };

  const rowsRoot = document.getElementById("hero-tier-rows");
  const poolRoot = document.getElementById("hero-tier-pool");
  const searchInput = document.getElementById("hero-tier-search");
  const resetButton = document.getElementById("hero-tier-reset");
  const unassignedButton = document.getElementById("hero-tier-unassigned");
  const summary = document.getElementById("hero-tier-summary");
  const counter = document.getElementById("hero-tier-counter");

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, "-")
      .replace(/(^-|-$)/g, "");
  }

  function cloneTiers(tiers) {
    return Object.fromEntries(Object.entries(tiers).map(([key, value]) => [key, [...value]]));
  }

  function createHeroCard(hero, parentTier) {
    const card = document.createElement("article");
    card.className = "tier-builder-card";
    card.draggable = true;
    card.dataset.heroId = hero.id;
    card.dataset.parentTier = parentTier;
    card.innerHTML = `
      <img src="${hero.image}" alt="${hero.name}" loading="lazy">
      <span>${hero.name}</span>
    `;

    card.addEventListener("dragstart", (event) => {
      state.draggingHeroId = hero.id;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", hero.id);
    });

    card.addEventListener("dragend", () => {
      state.draggingHeroId = null;
      card.classList.remove("is-dragging");
      document.querySelectorAll(".tier-builder-row").forEach((row) => row.classList.remove("is-over"));
    });

    return card;
  }

  function getAllTierBuckets() {
    return [UNASSIGNED_KEY, ...TIER_ORDER];
  }

  function findHeroTier(heroId) {
    return getAllTierBuckets().find((tier) => state.tiers[tier].includes(heroId)) || UNASSIGNED_KEY;
  }

  function moveHero(heroId, targetTier) {
    const currentTier = findHeroTier(heroId);
    if (currentTier === targetTier) {
      return;
    }

    state.tiers[currentTier] = state.tiers[currentTier].filter((id) => id !== heroId);
    state.tiers[targetTier].push(heroId);
    render();
  }

  function buildDropzone(tierKey) {
    const zone = document.createElement("div");
    zone.className = "tier-builder-dropzone";
    zone.dataset.tier = tierKey;

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
      const heroId = event.dataTransfer.getData("text/plain") || state.draggingHeroId;
      if (!heroId) {
        return;
      }

      moveHero(heroId, tierKey);
    });

    return zone;
  }

  function renderPool() {
    poolRoot.innerHTML = "";
    const matchingHeroes = state.tiers[UNASSIGNED_KEY]
      .map((id) => state.heroesById.get(id))
      .filter((hero) => hero.name.toLowerCase().includes(state.search));

    if (!matchingHeroes.length) {
      const empty = document.createElement("p");
      empty.className = "tier-builder-empty";
      empty.textContent = "В пуле нет героев под текущий поиск.";
      poolRoot.append(empty);
      return;
    }

    matchingHeroes.forEach((hero) => {
      poolRoot.append(createHeroCard(hero, UNASSIGNED_KEY));
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
              <h3 class="tier-title">${tier}-тир</h3>
              <p class="tier-builder-count">${state.tiers[tier].length} героев</p>
            </div>
          </div>
        </div>
      `;

      const zone = buildDropzone(tier);
      const heroes = state.tiers[tier]
        .map((id) => state.heroesById.get(id))
        .filter((hero) => hero.name.toLowerCase().includes(state.search));

      if (!heroes.length) {
        const empty = document.createElement("p");
        empty.className = "tier-builder-empty";
        empty.textContent = "Сюда можно перетащить героев.";
        zone.append(empty);
      } else {
        heroes.forEach((hero) => zone.append(createHeroCard(hero, tier)));
      }

      row.append(zone);
      rowsRoot.append(row);
    });
  }

  function render() {
    renderPool();
    renderRows();

    const totalAssigned = TIER_ORDER.reduce((sum, tier) => sum + state.tiers[tier].length, 0);
    counter.textContent = `${totalAssigned} героев распределено`;
    summary.textContent = `В пуле ${state.tiers[UNASSIGNED_KEY].length} героев. Поиск: ${state.search || "не задан"}.`;
  }

  function createInitialState() {
    const tiers = { [UNASSIGNED_KEY]: [] };
    TIER_ORDER.forEach((tier) => {
      tiers[tier] = [];
    });

    for (const tierEntry of window.tierData || []) {
      const normalizedTier = TIER_ORDER.includes(tierEntry.tier) ? tierEntry.tier : UNASSIGNED_KEY;
      for (const hero of tierEntry.heroes || []) {
        const id = slugify(hero.name);
        state.heroesById.set(id, { ...hero, id });
        tiers[normalizedTier].push(id);
      }
    }

    state.tiers = tiers;
    state.original = cloneTiers(tiers);
  }

  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });

  resetButton.addEventListener("click", () => {
    state.tiers = cloneTiers(state.original);
    render();
  });

  unassignedButton.addEventListener("click", () => {
    state.tiers = {
      [UNASSIGNED_KEY]: [...state.heroesById.keys()],
      S: [],
      A: [],
      B: [],
      C: [],
      D: []
    };
    render();
  });

  createInitialState();
  render();
})();
