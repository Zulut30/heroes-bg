(function () {
  const TIER_ORDER = ["S", "A", "B", "C", "D"];
  const TIER_TITLES = {
    S: "Лучшие стратегии",
    A: "Сильные стратегии",
    B: "Крепкая середина",
    C: "Ситуативные стратегии",
    D: "Слабые стратегии"
  };

  const state = {
    payload: null,
    strategies: [],
    archetype: "all",
    source: "firestone",
    exportColumns: 3,
    preview: null,
    exporting: false
  };

  const TYPE_META = {
    all: { label: "Все", icon: "./assset/общее.webp" },
    beast: { label: "Звери", icon: "./assset/зверь.webp" },
    demon: { label: "Демоны", icon: "./assset/демоны.webp" },
    dragon: { label: "Драконы", icon: "./assset/драконы.webp" },
    elemental: { label: "Элементали", icon: "./assset/элементали.webp" },
    mech: { label: "Механизмы", icon: "./assset/механизмы.webp" },
    murloc: { label: "Мурлоки", icon: "./assset/мурлоки.webp" },
    naga: { label: "Нага", icon: "./assset/наги.webp" },
    pirate: { label: "Пираты", icon: "./assset/пираты.webp" },
    quilboar: { label: "Свинобразы", icon: "./assset/свинобразы.webp" },
    undead: { label: "Нежить", icon: "./assset/нежить.webp" },
    neutral: { label: "Общие", icon: "./assset/общее.webp" }
  };

  const $ = (selector) => document.querySelector(selector);

  function formatNumber(value, digits = 2) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "—";
    }
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    }).format(number);
  }

  function formatInt(value) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "—";
    }
    return new Intl.NumberFormat("ru-RU").format(number);
  }

  function setStatus(text) {
    const status = $("#strategy-tiers-status");
    if (status) {
      status.textContent = text;
    }
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (text != null) {
      el.textContent = text;
    }
    return el;
  }

  function filteredStrategies() {
    if (state.archetype === "all") {
      return state.strategies;
    }
    return state.strategies.filter((item) => item.archetypeKey === state.archetype);
  }

  function renderFilters() {
    const wrap = $("#strategy-filters");
    if (!wrap) {
      return;
    }

    const counts = state.strategies.reduce((acc, item) => {
      acc.set(item.archetypeKey, (acc.get(item.archetypeKey) || 0) + 1);
      return acc;
    }, new Map());
    const archetypes = Array.from(counts.entries())
      .map(([key, count]) => [key, TYPE_META[key]?.label || key, count])
      .sort((a, b) => a[1].localeCompare(b[1], "ru"));

    wrap.innerHTML = "";
    const all = createFilterButton("all", state.strategies.length);
    all.type = "button";
    all.addEventListener("click", () => {
      state.archetype = "all";
      render();
    });
    wrap.append(all);

    archetypes.forEach(([key, , count]) => {
      const button = createFilterButton(key, count);
      button.type = "button";
      button.addEventListener("click", () => {
        state.archetype = key;
        render();
      });
      wrap.append(button);
    });
  }

  function createFilterButton(key, count) {
    const meta = TYPE_META[key] || { label: key, icon: "•" };
    const button = createEl("button", `chip strategy-type-chip strategy-type-${key}${state.archetype === key ? " is-active" : ""}`);
    button.type = "button";
    button.style.setProperty("--chip-icon", `url("${meta.icon}")`);
    button.append(
      createEl("span", "chip-icon strategy-type-icon"),
      createEl("span", "strategy-type-label", meta.label),
      createEl("span", "strategy-type-count", String(count))
    );
    return button;
  }

  function renderSourceToggle() {
    document.querySelectorAll("#strategy-source-toggle [data-source]").forEach((button) => {
      const isActive = button.dataset.source === state.source;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function renderExportColumnToggle() {
    document.querySelectorAll("[data-export-columns]").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.exportColumns) === state.exportColumns);
    });
  }

  function attachFrameFallback(img, card) {
    img.addEventListener("error", () => {
      if (img.dataset.fallbackUsed === "true") {
        return;
      }
      img.dataset.fallbackUsed = "true";
      img.src = card.fallback;
    }, { once: true });
  }

  function ensurePreview() {
    if (state.preview) {
      return state.preview;
    }
    const preview = createEl("div", "strategy-card-preview");
    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    preview.append(image);
    document.body.append(preview);
    state.preview = preview;
    return preview;
  }

  function movePreview(event) {
    const preview = ensurePreview();
    const pad = 18;
    const rect = preview.getBoundingClientRect();
    let left = event.clientX + pad;
    let top = event.clientY + pad;
    if (left + rect.width > window.innerWidth - pad) {
      left = event.clientX - rect.width - pad;
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = window.innerHeight - rect.height - pad;
    }
    preview.style.left = `${Math.max(pad, left)}px`;
    preview.style.top = `${Math.max(pad, top)}px`;
  }

  function showPreview(event, card) {
    const preview = ensurePreview();
    const image = preview.querySelector("img");
    image.src = card.card || card.fallback;
    image.alt = card.name || "";
    image.onerror = () => {
      if (image.src !== card.fallback) {
        image.src = card.fallback;
      }
    };
    preview.classList.add("is-visible");
    movePreview(event);
  }

  function hidePreview() {
    if (state.preview) {
      state.preview.classList.remove("is-visible");
    }
  }

  function renderStrategyCard(strategy) {
    const card = createEl("article", "strategy-tier-card");

    const header = createEl("div", "strategy-tier-card-header");
    const titleBlock = createEl("div", "strategy-tier-title-block");
    titleBlock.append(
      createEl("span", "strategy-tier-kicker", `${strategy.archetype} · ${strategy.source}`),
      createEl("h3", "strategy-tier-name", strategy.title)
    );
    const tier = createEl("span", `strategy-tier-mark strategy-tier-mark-${String(strategy.tier).toLowerCase()}`, strategy.tier);
    header.append(titleBlock, tier);

    const stats = createEl("dl", "strategy-tier-stats");
    const statRows = strategy.sourceKey === "hsreplay"
      ? [
          ["Сложн.", strategy.difficulty || "—"],
          ["Источник", strategy.source || "—"]
        ]
      : [
          ["AVG", formatNumber(strategy.avgPlacement, 2)],
          ["Игры", formatInt(strategy.games)],
          ["Сложн.", strategy.difficulty || "—"],
          ["Источник", strategy.source || "—"]
        ];
    if (strategy.sourceKey === "hsreplay") {
      stats.classList.add("strategy-tier-stats-compact");
    }
    statRows.forEach(([label, value]) => {
      const item = createEl("div", "strategy-tier-stat");
      item.append(createEl("dt", "", label), createEl("dd", "", value));
      stats.append(item);
    });

    card.append(header, stats);

    const frames = createEl("div", "strategy-frame-grid");
    strategy.cards.forEach((cardData) => {
      const frame = createEl("span", "strategy-frame");
      frame.tabIndex = 0;
      const img = document.createElement("img");
      img.src = cardData.frame;
      img.alt = cardData.name || "";
      img.loading = "lazy";
      img.decoding = "async";
      attachFrameFallback(img, cardData);
      frame.append(img);
      frame.addEventListener("mouseenter", (event) => showPreview(event, cardData));
      frame.addEventListener("mousemove", movePreview);
      frame.addEventListener("mouseleave", hidePreview);
      frame.addEventListener("focus", (event) => showPreview(event, cardData));
      frame.addEventListener("blur", hidePreview);
      frames.append(frame);
    });

    card.append(frames);
    return card;
  }

  function renderTier(tier, items) {
    const section = createEl("section", "tier-section strategy-tier-section");
    const header = createEl("div", "tier-header");
    const meta = createEl("div", "tier-meta");
    meta.append(
      createEl("span", `tier-badge tier-badge-${tier.toLowerCase()}`, tier),
      createEl("div", "", "")
    );
    meta.lastElementChild.append(
      createEl("h2", "tier-title", TIER_TITLES[tier]),
      createEl("p", "tier-summary", `${items.length} ${items.length === 1 ? "стратегия" : "стратегий"} · ${state.source === "hsreplay" ? "HSReplay comps" : "Firestone: статистика конкретных компов"}`)
    );
    header.append(meta);
    const actions = createEl("div", "tier-builder-row-actions");
    const pngButton = createEl("button", "secondary-button", "PNG");
    const webpButton = createEl("button", "secondary-button", "WebP");
    pngButton.type = "button";
    webpButton.type = "button";
    pngButton.addEventListener("click", (event) => runExport(event.currentTarget, () => exportTier(tier, items, "png")));
    webpButton.addEventListener("click", (event) => runExport(event.currentTarget, () => exportTier(tier, items, "webp")));
    actions.append(pngButton, webpButton);
    header.append(actions);

    const grid = createEl("div", "strategy-tier-grid");
    items.forEach((item) => grid.append(renderStrategyCard(item)));
    section.append(header, grid);
    return section;
  }

  function render() {
    renderFilters();
    const root = $("#strategy-tiers");
    if (!root) {
      return;
    }
    root.innerHTML = "";
    const items = filteredStrategies();
    TIER_ORDER.forEach((tier) => {
      const tierItems = items.filter((item) => item.tier === tier);
      if (tierItems.length) {
        root.append(renderTier(tier, tierItems));
      }
    });
  }

  function canvasRoundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function truncateText(ctx, text, maxWidth) {
    const value = String(text || "");
    if (ctx.measureText(value).width <= maxWidth) {
      return value;
    }
    let low = 0;
    let high = value.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (ctx.measureText(`${value.slice(0, mid)}…`).width <= maxWidth) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return `${value.slice(0, low)}…`;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function imageForExport(card) {
    return await loadImage(card.card) || await loadImage(card.frame) || await loadImage(card.fallback);
  }

  function drawCoverImage(ctx, img, x, y, width, height) {
    if (!img) {
      return;
    }
    const scale = Math.min(width / img.width, height / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    ctx.drawImage(img, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  async function renderExportCanvas(items, title) {
    const scale = items.length > 12 ? 2 : 3;
    const strategyWidth = 690;
    const strategyHeight = 650;
    const gap = 24;
    const margin = 54;
    const columns = state.exportColumns === 4 ? 4 : 3;
    const rows = Math.max(1, Math.ceil(items.length / columns));
    const headerHeight = 112;
    const width = margin * 2 + columns * strategyWidth + (columns - 1) * gap;
    const height = margin * 2 + headerHeight + rows * strategyHeight + (rows - 1) * gap;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#10213d");
    gradient.addColorStop(0.5, "#07101f");
    gradient.addColorStop(1, "#0d1526");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(219, 192, 122, 0.11)";
    ctx.beginPath();
    ctx.arc(width * 0.12, height * 0.02, 360, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f8f1db";
    ctx.font = "800 42px Segoe UI, sans-serif";
    ctx.fillText(title, margin, margin + 44);
    ctx.fillStyle = "#dbc07a";
    ctx.font = "800 18px Segoe UI, sans-serif";
    ctx.fillText("Manacost Battleground · Firestone", margin, margin + 78);

    const imageJobs = items.map((item) => Promise.all(item.cards.slice(0, 10).map(imageForExport)));
    const imageRows = await Promise.all(imageJobs);

    items.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = margin + col * (strategyWidth + gap);
      const y = margin + headerHeight + row * (strategyHeight + gap);

      canvasRoundRect(ctx, x, y, strategyWidth, strategyHeight, 16);
      ctx.fillStyle = "rgba(8, 17, 32, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(219, 192, 122, 0.32)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.fillStyle = "#dbc07a";
      ctx.font = "800 18px Segoe UI, sans-serif";
      ctx.fillText(`${item.archetype} · ${item.source}`, x + 24, y + 38);

      ctx.fillStyle = "#f8f1db";
      ctx.font = "900 34px Segoe UI, sans-serif";
      ctx.fillText(truncateText(ctx, item.title, strategyWidth - 116), x + 24, y + 82);

      canvasRoundRect(ctx, x + strategyWidth - 86, y + 28, 56, 56, 10);
      ctx.fillStyle = item.tier === "S" || item.tier === "A" ? "#dbc07a" : "rgba(255,255,255,0.11)";
      ctx.fill();
      ctx.fillStyle = item.tier === "S" || item.tier === "A" ? "#08111e" : "#f8f1db";
      ctx.font = "900 34px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(item.tier, x + strategyWidth - 58, y + 68);
      ctx.textAlign = "left";

      const stats = item.sourceKey === "hsreplay"
        ? [
            ["Сложн.", item.difficulty || "—"],
            ["Источник", item.source || "—"]
          ]
        : [
            ["AVG", formatNumber(item.avgPlacement, 2)],
            ["Игры", formatInt(item.games)],
            ["Сложн.", item.difficulty || "—"]
          ];
      stats.forEach(([label, value], statIndex) => {
        const sx = x + 24 + statIndex * 142;
        canvasRoundRect(ctx, sx, y + 108, 126, 62, 10);
        ctx.fillStyle = "rgba(255,255,255,0.065)";
        ctx.fill();
        ctx.fillStyle = "#8f9bb3";
        ctx.font = "800 13px Segoe UI, sans-serif";
        ctx.fillText(label, sx + 12, y + 131);
        ctx.fillStyle = "#f8f1db";
        ctx.font = "900 22px Segoe UI, sans-serif";
        ctx.fillText(truncateText(ctx, value, 102), sx + 12, y + 158);
      });

      const cardGridY = y + 190;
      const cardGap = 10;
      const exportCardWidth = (strategyWidth - 48 - cardGap * 4) / 5;
      const exportCardHeight = exportCardWidth / 0.66;
      const images = imageRows[index] || [];
      item.cards.slice(0, 10).forEach((card, cardIndex) => {
        const fx = x + 24 + (cardIndex % 5) * (exportCardWidth + cardGap);
        const fy = cardGridY + Math.floor(cardIndex / 5) * (exportCardHeight + 12);
        canvasRoundRect(ctx, fx, fy, exportCardWidth, exportCardHeight, 10);
        ctx.fillStyle = "rgba(255,255,255,0.045)";
        ctx.fill();
        ctx.save();
        canvasRoundRect(ctx, fx, fy, exportCardWidth, exportCardHeight, 10);
        ctx.clip();
        drawCoverImage(ctx, images[cardIndex], fx, fy, exportCardWidth, exportCardHeight);
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.09)";
        ctx.lineWidth = 1;
        canvasRoundRect(ctx, fx, fy, exportCardWidth, exportCardHeight, 10);
        ctx.stroke();
      });
    });

    return canvas;
  }

  async function saveCanvas(canvas, fileType, fileName) {
    const mime = fileType === "webp" ? "image/webp" : "image/png";
    const quality = fileType === "webp" ? 0.92 : undefined;
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Не удалось собрать изображение.")), mime, quality);
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.${fileType}`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function exportTier(tier, items, fileType) {
    const canvas = await renderExportCanvas(items, `${tier}-тир: стратегии`);
    await saveCanvas(canvas, fileType, `strategy-tier-${tier.toLowerCase()}`);
  }

  async function exportAll(fileType) {
    const items = filteredStrategies();
    const canvas = await renderExportCanvas(items, "Тир-лист стратегий");
    await saveCanvas(canvas, fileType, "strategy-tier-list");
  }

  async function runExport(button, task) {
    if (state.exporting) {
      return;
    }
    state.exporting = true;
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = "Готовлю...";
    hidePreview();
    try {
      await task();
    } catch (error) {
      console.error(error);
      setStatus("Не удалось скачать тир-лист.");
    } finally {
      button.disabled = false;
      button.textContent = previousText;
      state.exporting = false;
    }
  }

  function bindDownloads() {
    const png = $("#strategy-download-png");
    const webp = $("#strategy-download-webp");
    if (png) {
      png.addEventListener("click", (event) => runExport(event.currentTarget, () => exportAll("png")));
    }
    if (webp) {
      webp.addEventListener("click", (event) => runExport(event.currentTarget, () => exportAll("webp")));
    }
  }

  function bindExportColumns() {
    document.querySelectorAll("[data-export-columns]").forEach((button) => {
      button.addEventListener("click", () => {
        const columns = Number(button.dataset.exportColumns);
        state.exportColumns = columns === 4 ? 4 : 3;
        try {
          window.localStorage.setItem("strategy-tiers-export-columns", String(state.exportColumns));
        } catch (_) {
          // Ignore private-mode storage failures.
        }
        renderExportColumnToggle();
      });
    });
    try {
      const saved = Number(window.localStorage.getItem("strategy-tiers-export-columns"));
      if (saved === 3 || saved === 4) {
        state.exportColumns = saved;
      }
    } catch (_) {
      // Ignore private-mode storage failures.
    }
    renderExportColumnToggle();
  }

  function bindSourceToggle() {
    document.querySelectorAll("#strategy-source-toggle [data-source]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextSource = button.dataset.source || "firestone";
        if (nextSource === state.source) {
          return;
        }
        state.source = nextSource;
        state.archetype = "all";
        init();
      });
    });
    renderSourceToggle();
  }

  async function init() {
    try {
      renderSourceToggle();
      setStatus(`Загружаю стратегии ${state.source === "hsreplay" ? "HSReplay" : "Firestone"}...`);
      const response = await fetch(`./api/bg-strategy-stats?source=${encodeURIComponent(state.source)}`, {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const strategies = Array.isArray(payload?.strategies) ? payload.strategies : [];
      if (!strategies.length) {
        throw new Error("В ответе нет стратегий.");
      }
      state.payload = payload;
      state.strategies = strategies;
      const fetched = payload.fetchedAt ? new Date(payload.fetchedAt) : null;
      const date = fetched && !Number.isNaN(fetched.getTime())
        ? fetched.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "";
      setStatus(`${strategies.length} стратегий · ${payload.source}${date ? ` · обновлено ${date}` : ""}`);
      render();
    } catch (error) {
      setStatus("Не удалось загрузить статистику стратегий.");
      const root = $("#strategy-tiers");
      if (root) {
        root.innerHTML = "";
      }
      console.error(error);
    }
  }

  window.addEventListener("DOMContentLoaded", init);
  window.addEventListener("DOMContentLoaded", bindDownloads);
  window.addEventListener("DOMContentLoaded", bindSourceToggle);
  window.addEventListener("DOMContentLoaded", bindExportColumns);
}());
