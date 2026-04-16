(function () {
  const tierData = Array.isArray(window.tierData) ? window.tierData : [];
  const tierContainer = document.getElementById("tiers");
  const statsContainer = document.getElementById("hero-stats");
  const template = document.getElementById("tier-template");

  const tierColors = {
    S: "#f2db9b",
    A: "#d8bf79",
    B: "#9fc7ff",
    C: "#7dcaa1",
    D: "#d89779"
  };

  function formatNumber(value) {
    return new Intl.NumberFormat("ru-RU").format(value);
  }

  function createStatCard(value, label) {
    const element = document.createElement("article");
    element.className = "stat-card";
    element.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
    return element;
  }

  function renderStats() {
    const heroCount = tierData.reduce((sum, tier) => sum + tier.heroes.length, 0);
    const averageScore = (
      tierData.flatMap((tier) => tier.heroes).reduce((sum, hero) => sum + Number(hero.averagePlace || 0), 0) /
      Math.max(heroCount, 1)
    ).toFixed(2);

    statsContainer.append(
      createStatCard(formatNumber(heroCount), "героев в базе"),
      createStatCard(formatNumber(tierData.length), "разделов по тиру"),
      createStatCard(averageScore, "средний показатель по всем героям")
    );
  }

  async function handleTierExport(tier) {
    const button = this;
    const fileBaseName = `${tier.tier.toLowerCase()}-tier-heroes`;

    try {
      button.disabled = true;
      button.textContent = "Готовлю WebP...";
      await window.Shared.exportCardSheet(
        tier.heroes.map((hero) => ({
          ...hero
        })),
        {
          fileBaseName,
          columns: 8,
          gap: 12,
          padding: 18,
          cardWidth: 238,
          artHeight: 356,
          showHeader: false,
          showText: false,
          showMeta: false,
          showCardBackground: false,
          background: "transparent",
          maxWidthOrHeight: 2600,
          maxSizeMB: 2,
          initialQuality: 0.96,
          outputQuality: 0.98
        }
      );
      button.textContent = "Скачать WebP";
    } catch (error) {
      console.error(error);
      button.textContent = "Ошибка экспорта";
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = "Скачать WebP";
      }, 900);
    }
  }

  function renderHeroCard(hero) {
    const article = document.createElement("article");
    article.className = "hero-card";
    article.innerHTML = `
      <img
        class="hero-thumb"
        src="${hero.image}"
        alt="${hero.name}"
        loading="lazy"
        decoding="async"
        fetchpriority="low"
      >
      <div class="hero-card-body">
        <span class="hero-rank">Среднее ${hero.averagePlace}</span>
        <h3 class="hero-name">${hero.name}</h3>
        <div class="hero-subtitle">Популярность ${hero.popularity}</div>
      </div>
    `;
    return article;
  }

  function renderTiers() {
    tierData.forEach((tier) => {
      const fragment = template.content.cloneNode(true);
      const section = fragment.querySelector(".tier-section");
      const badge = fragment.querySelector(".tier-badge");
      const title = fragment.querySelector(".tier-title");
      const summary = fragment.querySelector(".tier-summary");
      const grid = fragment.querySelector(".hero-grid");
      const button = fragment.querySelector(".download-button");

      badge.textContent = tier.tier;
      badge.style.background = `linear-gradient(135deg, ${tierColors[tier.tier] || "#f2db9b"}, #b89e61)`;
      title.textContent = tier.title;
      summary.textContent = `${tier.heroes.length} героев`;
      button.addEventListener("click", handleTierExport.bind(button, tier));

      tier.heroes.forEach((hero) => {
        grid.append(renderHeroCard(hero));
      });

      section.dataset.tier = tier.tier;
      tierContainer.append(fragment);
    });
  }

  renderStats();
  renderTiers();
})();
