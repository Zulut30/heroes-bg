(function () {
  const status = document.getElementById("spells-status");
  const counter = document.getElementById("spells-counter");
  const grid = document.getElementById("spells-grid");
  const searchInput = document.getElementById("spells-search");
  const filterSelect = document.getElementById("spells-filter");

  const state = {
    cards: [],
    search: "",
    filter: "ALL"
  };

  function stripHtml(value) {
    const tmp = document.createElement("div");
    tmp.innerHTML = value || "";
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  }

  function matchesFilter(card) {
    switch (state.filter) {
      case "QUEST":
        return card.battlegrounds.quest;
      case "REWARD":
        return card.battlegrounds.reward;
      case "HERO":
        return card.battlegrounds.hero;
      case "DUOS":
        return card.battlegrounds.duosOnly;
      case "SOLOS":
        return card.battlegrounds.solosOnly;
      default:
        return true;
    }
  }

  function render() {
    const cards = state.cards.filter((card) => {
      const haystack = `${card.name} ${card.text} ${card.flavorText}`.toLowerCase();
      return haystack.includes(state.search) && matchesFilter(card);
    });

    counter.textContent = `${cards.length} заклинаний показано`;
    grid.innerHTML = "";

    if (!cards.length) {
      const empty = document.createElement("p");
      empty.className = "tier-builder-empty";
      empty.textContent = "По текущим фильтрам ничего не найдено.";
      grid.append(empty);
      return;
    }

    cards.forEach((card) => {
      const article = document.createElement("article");
      article.className = "spell-card";

      const metaPills = [];
      if (card.battlegrounds.quest) metaPills.push("Задание");
      if (card.battlegrounds.reward) metaPills.push("Награда");
      if (card.battlegrounds.hero) metaPills.push("Герой");
      if (card.battlegrounds.duosOnly) metaPills.push("Только дуо");
      if (card.battlegrounds.solosOnly) metaPills.push("Только соло");
      metaPills.push(`Мана ${card.manaCost}`);

      article.innerHTML = `
        <img class="spell-art" src="${card.image}" alt="${card.name}" loading="lazy">
        <h3 class="spell-name">${card.name}</h3>
        <div class="spell-meta">${metaPills.map((pill) => `<span class="meta-pill">${pill}</span>`).join("")}</div>
        <div class="spell-text">${stripHtml(card.text) || "Описание отсутствует."}</div>
      `;

      grid.append(article);
    });
  }

  async function loadSpells() {
    try {
      const response = await fetch("./api/battlegrounds-spells?locale=ru_RU", {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      state.cards = payload.cards || [];
      status.textContent = `Источник: ${payload.source}. Импортировано ${state.cards.length} заклинаний.`;
      render();
    } catch (error) {
      status.textContent = "Не удалось загрузить заклинания из Blizzard API.";
      grid.innerHTML = `<p class="tier-builder-empty">Ошибка загрузки: ${error.message}</p>`;
    }
  }

  searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });

  filterSelect.addEventListener("change", (event) => {
    state.filter = event.target.value;
    render();
  });

  loadSpells();
})();
