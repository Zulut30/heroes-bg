(function () {
  const TIER_ORDER = ["S", "A", "B", "C", "D"];

  const tierTitles = {
    S: "Лучший выбор",
    A: "Сильные герои",
    B: "Крепкая середина",
    C: "Ситуативные",
    D: "Слабые герои"
  };

  const tierColors = {
    S: "#f2db9b",
    A: "#d8bf79",
    B: "#9fc7ff",
    C: "#7dcaa1",
    D: "#d89779"
  };

  const BACKGROUND_STORAGE_KEY = "hero-tiers-background-mode-v1";
  const TIER_BACKGROUND_STORAGE_KEY = "hero-tiers-tier-backgrounds-v1";
  const BACKGROUND_OPTIONS = [
    { value: "transparent", label: "Без фона", url: null },
    { value: "wallpaper", label: "Фон 1", url: "./wallpaper.webp" },
    { value: "wallpaper1", label: "Фон 2", url: "./wallpaper1.webp" },
    { value: "wallpaper2", label: "Фон 3", url: "./wallpaper2.webp" },
    { value: "wallpaper3", label: "Фон 4", url: "./wallpaper3.webp" }
  ];
  const BACKGROUND_VALUES = new Set(BACKGROUND_OPTIONS.map((option) => option.value));
  const wallpaperImageCache = new Map();

  const tiersRoot = document.getElementById("hero-tiers");
  const statusEl = document.getElementById("hero-tiers-status");
  const template = document.getElementById("hero-tier-template");
  const backgroundPickerEl = document.getElementById("hero-tiers-background-picker");
  const downloadAllPngButton = document.getElementById("hero-tiers-download-all-png");
  const downloadAllWebpButton = document.getElementById("hero-tiers-download-all-webp");

  const staticData = window.heroTierStatic || {};
  const imageByDbfId = staticData.imageByDbfId || {};

  const state = {
    sections: [],
    backgroundMode: loadBackgroundMode(),
    tierBackgrounds: loadTierBackgrounds()
  };

  function loadBackgroundMode() {
    try {
      const value = window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
      return BACKGROUND_VALUES.has(value) ? value : "transparent";
    } catch (error) {
      return "transparent";
    }
  }

  function loadTierBackgrounds() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(TIER_BACKGROUND_STORAGE_KEY) || "{}");
      const result = {};
      Object.entries(raw || {}).forEach(([tier, mode]) => {
        if (BACKGROUND_VALUES.has(mode)) {
          result[tier] = mode;
        }
      });
      return result;
    } catch (error) {
      return {};
    }
  }

  function persistBackgrounds() {
    try {
      window.localStorage.setItem(BACKGROUND_STORAGE_KEY, state.backgroundMode);
      window.localStorage.setItem(TIER_BACKGROUND_STORAGE_KEY, JSON.stringify(state.tierBackgrounds));
    } catch (error) {
      console.warn("Не удалось сохранить режим фона.", error);
    }
  }

  function getTierBackgroundMode(tier) {
    return state.tierBackgrounds[tier] ?? state.backgroundMode;
  }

  function getBackgroundUrl(mode) {
    const entry = BACKGROUND_OPTIONS.find((option) => option.value === mode);
    return entry ? entry.url : null;
  }

  function parsePlacement(value) {
    const numeric = Number.parseFloat(String(value || "").replace(",", "."));
    return Number.isFinite(numeric) ? numeric : null;
  }

  function formatPlacement(value) {
    const numeric = parsePlacement(value);
    return numeric === null ? "—" : numeric.toFixed(2).replace(".", ",");
  }

  function normalizeHero(entry) {
    const dbfId = Number(entry.dbfId) || null;
    return {
      name: String(entry.hero || entry.name || "").trim(),
      dbfId,
      tier: String(entry.tier || "").trim().toUpperCase(),
      pickRate: String(entry.pickRate || entry.pick_rate || "").trim(),
      avgPlace: parsePlacement(entry.avgPlacement || entry.avg_placement),
      avgPlaceLabel: formatPlacement(entry.avgPlacement || entry.avg_placement),
      image: dbfId ? imageByDbfId[String(dbfId)] || "" : ""
    };
  }

  function buildSections(heroes) {
    const byTier = new Map();
    heroes.forEach((hero) => {
      if (!hero.name || !hero.tier) {
        return;
      }
      if (!byTier.has(hero.tier)) {
        byTier.set(hero.tier, []);
      }
      byTier.get(hero.tier).push(hero);
    });

    const order = [...TIER_ORDER, ...[...byTier.keys()].filter((tier) => !TIER_ORDER.includes(tier)).sort()];
    return order
      .filter((tier) => byTier.has(tier))
      .map((tier) => ({
        tier,
        heroes: byTier.get(tier).sort((left, right) => (left.avgPlace ?? 9) - (right.avgPlace ?? 9))
      }));
  }

  async function loadHeroStats() {
    try {
      const payload = await window.Shared.loadJson("./api/bg-hero-stats");
      if (Array.isArray(payload.heroes) && payload.heroes.length) {
        return { heroes: payload.heroes, fetchedAt: payload.fetchedAt, live: true };
      }
      throw new Error("Пустой ответ статистики.");
    } catch (error) {
      console.warn("Статистика героев из API недоступна, использую локальный снапшот.", error);
    }

    const fallback = Array.isArray(staticData.fallbackHeroes) ? staticData.fallbackHeroes : [];
    if (!fallback.length) {
      throw new Error("Нет ни живых данных, ни локального снапшота героев.");
    }
    return { heroes: fallback, fetchedAt: staticData.snapshotAt, live: false };
  }

  function formatHeroCount(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} герой`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} героя`;
    return `${count} героев`;
  }

  function formatDate(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date);
  }

  function renderStatus(result, heroCount) {
    const dateLabel = formatDate(result.fetchedAt);
    const sourceLabel = result.live
      ? "живая статистика HSReplay"
      : "локальный снапшот (API недоступно)";
    statusEl.textContent = `${formatHeroCount(heroCount)} · ${sourceLabel}${dateLabel ? ` · обновлено ${dateLabel}` : ""} · сортировка по среднему месту`;
  }

  function renderHeroTile(hero) {
    const tile = document.createElement("figure");
    tile.className = "hero-tile";
    tile.title = `${hero.name} — среднее место ${hero.avgPlaceLabel}${hero.pickRate ? ` · выбирают в ${hero.pickRate}` : ""}`;

    const media = document.createElement("div");
    media.className = "hero-tile-media";
    if (hero.image) {
      const img = document.createElement("img");
      img.src = hero.image;
      img.alt = hero.name;
      img.loading = "lazy";
      img.decoding = "async";
      media.append(img);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "hero-tile-placeholder";
      placeholder.textContent = hero.name.slice(0, 2);
      media.append(placeholder);
    }

    const place = document.createElement("figcaption");
    place.className = "hero-tile-place";
    place.textContent = hero.avgPlaceLabel;

    const name = document.createElement("span");
    name.className = "hero-tile-name";
    name.textContent = hero.name;

    tile.append(media, place, name);
    return tile;
  }

  function renderTiers() {
    tiersRoot.replaceChildren();
    tierPickerUpdaters.length = 0;
    state.sections.forEach((section) => {
      const fragment = template.content.cloneNode(true);
      const badge = fragment.querySelector(".tier-badge");
      const title = fragment.querySelector(".tier-title");
      const summary = fragment.querySelector(".tier-summary");
      const gallery = fragment.querySelector(".hero-tier-gallery");
      const tierPickerEl = fragment.querySelector(".tier-background-picker");

      badge.textContent = section.tier;
      badge.style.background = `linear-gradient(135deg, ${tierColors[section.tier] || "#f2db9b"}, #b89e61)`;
      title.textContent = tierTitles[section.tier] ? `${section.tier} · ${tierTitles[section.tier]}` : `${section.tier}-тир`;
      summary.textContent = formatHeroCount(section.heroes.length);

      const tierPickerUpdate = buildBackgroundPicker(
        tierPickerEl,
        () => getTierBackgroundMode(section.tier),
        (mode) => {
          state.tierBackgrounds[section.tier] = mode;
        }
      );
      if (tierPickerUpdate) {
        tierPickerUpdaters.push(tierPickerUpdate);
      }

      section.heroes.forEach((hero) => gallery.append(renderHeroTile(hero)));

      fragment.querySelector('[data-export="png"]').addEventListener("click", (event) => {
        runExport(event.currentTarget, () => exportTier(section, "png"));
      });
      fragment.querySelector('[data-export="webp"]').addEventListener("click", (event) => {
        runExport(event.currentTarget, () => exportTier(section, "webp"));
      });

      tiersRoot.append(fragment);
    });
  }

  async function runExport(button, task) {
    const initialText = button.textContent;
    button.disabled = true;
    button.textContent = "Готовлю...";
    try {
      await task();
      button.textContent = initialText;
    } catch (error) {
      console.error(error);
      button.textContent = "Ошибка";
      window.setTimeout(() => {
        button.textContent = initialText;
      }, 1500);
    } finally {
      button.disabled = false;
    }
  }

  // --- Экспорт: та же логика фона, что и в конструкторе стратегий ---

  const EXPORT_CARD_WIDTH = 256;
  const EXPORT_COLUMNS_MAX = 6;
  const EXPORT_SIDE_PADDING = 48;
  const EXPORT_TOP_PADDING = 36;
  const EXPORT_BOTTOM_PADDING = 36;
  const EXPORT_COLUMN_GAP = 20;
  const EXPORT_ROW_GAP = 26;
  const EXPORT_PLACE_HEIGHT = 56;
  const EXPORT_PLACE_GAP = 10;

  async function drawWallpaperBackground(ctx, rect, mode) {
    const url = getBackgroundUrl(mode);
    if (!url) return;
    try {
      let wallpaper = wallpaperImageCache.get(url);
      if (!wallpaper) {
        wallpaper = await window.Shared.loadImageFromSource(url);
        wallpaperImageCache.set(url, wallpaper);
      }
      const blur = 14;
      const bleed = blur * 4;
      const targetW = rect.width + bleed * 2;
      const targetH = rect.height + bleed * 2;
      const wallpaperRatio = wallpaper.width / wallpaper.height;
      const targetRatio = targetW / targetH;
      let drawW;
      let drawH;
      if (wallpaperRatio > targetRatio) {
        drawH = targetH;
        drawW = drawH * wallpaperRatio;
      } else {
        drawW = targetW;
        drawH = drawW / wallpaperRatio;
      }
      const drawX = rect.x - bleed + (targetW - drawW) / 2;
      const drawY = rect.y - bleed + (targetH - drawH) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.width, rect.height);
      ctx.clip();
      ctx.filter = `blur(${blur}px) brightness(0.45)`;
      ctx.drawImage(wallpaper, drawX, drawY, drawW, drawH);
      ctx.restore();
      ctx.fillStyle = "rgba(4, 8, 16, 0.35)";
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    } catch (error) {
      console.warn("Не удалось отрисовать игровой фон:", error);
    }
  }

  async function loadHeroEntries(heroes) {
    const loaded = await Promise.all(heroes.map(async (hero) => {
      if (!hero.image) {
        return null;
      }
      try {
        const image = await window.Shared.loadImageFromSource(hero.image);
        return { hero, image };
      } catch (error) {
        console.warn(`Не удалось загрузить портрет героя ${hero.name}:`, error);
        return null;
      }
    }));
    return loaded.filter(Boolean);
  }

  function buildRows(entries, columns) {
    const rows = [];
    for (let index = 0; index < entries.length; index += columns) {
      rows.push(entries.slice(index, index + columns));
    }
    return rows;
  }

  function measureSection(entries, columns) {
    const rows = buildRows(entries, columns);
    const rowHeights = rows.map((row) => (
      Math.max(...row.map(({ image }) => EXPORT_CARD_WIDTH * (image.height / image.width)))
      + EXPORT_PLACE_GAP + EXPORT_PLACE_HEIGHT
    ));
    const contentHeight = rowHeights.reduce((sum, height) => sum + height, 0)
      + Math.max(0, rows.length - 1) * EXPORT_ROW_GAP;
    return { rows, rowHeights, contentHeight };
  }

  function drawPlacePill(ctx, hero, centerX, topY) {
    const label = hero.avgPlaceLabel;
    ctx.save();
    ctx.font = '700 30px "BgDisplay", Georgia, serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textWidth = ctx.measureText(label).width;
    const pillWidth = Math.max(textWidth + 44, 96);
    const pillHeight = EXPORT_PLACE_HEIGHT - 8;
    const pillX = centerX - pillWidth / 2;
    const pillY = topY + (EXPORT_PLACE_HEIGHT - pillHeight) / 2;
    ctx.fillStyle = "rgba(6, 11, 22, 0.86)";
    window.Shared.roundedRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 215, 154, 0.35)";
    ctx.lineWidth = 2;
    window.Shared.roundedRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(240, 215, 154, 0.96)";
    ctx.fillText(label, centerX, pillY + pillHeight / 2 + 1);
    ctx.restore();
  }

  function drawSectionRows(ctx, layout, startY) {
    let cursorY = startY;
    layout.rows.forEach((row, rowIndex) => {
      const rowHeight = layout.rowHeights[rowIndex];
      const artMaxHeight = rowHeight - EXPORT_PLACE_GAP - EXPORT_PLACE_HEIGHT;
      row.forEach(({ hero, image }, columnIndex) => {
        const cardHeight = EXPORT_CARD_WIDTH * (image.height / image.width);
        const x = EXPORT_SIDE_PADDING + columnIndex * (EXPORT_CARD_WIDTH + EXPORT_COLUMN_GAP);
        const y = cursorY + (artMaxHeight - cardHeight) / 2;
        ctx.drawImage(image, x, y, EXPORT_CARD_WIDTH, cardHeight);
        drawPlacePill(ctx, hero, x + EXPORT_CARD_WIDTH / 2, cursorY + artMaxHeight + EXPORT_PLACE_GAP);
      });
      cursorY += rowHeight + EXPORT_ROW_GAP;
    });
    return cursorY - EXPORT_ROW_GAP;
  }

  function canvasWidthFor(columns) {
    return EXPORT_SIDE_PADDING * 2
      + columns * EXPORT_CARD_WIDTH
      + Math.max(0, columns - 1) * EXPORT_COLUMN_GAP;
  }

  async function exportCanvas(canvas, fileType, fileBaseName) {
    const mime = fileType === "webp" ? "image/webp" : "image/png";
    const quality = fileType === "webp" ? 0.98 : 1;
    const extension = fileType === "webp" ? "webp" : "png";
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Не удалось собрать изображение."))), mime, quality);
    });
    triggerDownload(blob, `${fileBaseName}.${extension}`);
  }

  function triggerDownload(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function prepareExportFont() {
    try {
      await document.fonts.load('700 30px "BgDisplay"');
      await document.fonts.load('700 56px "BgDisplay"');
    } catch (error) {
      // Шрифт не критичен — Canvas откатится на Georgia/serif.
    }
  }

  async function exportTier(section, fileType) {
    const entries = await loadHeroEntries(section.heroes);
    if (!entries.length) {
      throw new Error("Нет портретов для экспорта.");
    }
    await prepareExportFont();

    const columns = Math.min(entries.length, EXPORT_COLUMNS_MAX);
    const layout = measureSection(entries, columns);
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidthFor(columns);
    canvas.height = Math.ceil(EXPORT_TOP_PADDING + layout.contentHeight + EXPORT_BOTTOM_PADDING);
    const ctx = canvas.getContext("2d");

    const mode = getTierBackgroundMode(section.tier);
    if (mode !== "transparent") {
      await drawWallpaperBackground(ctx, { x: 0, y: 0, width: canvas.width, height: canvas.height }, mode);
    }

    drawSectionRows(ctx, layout, EXPORT_TOP_PADDING);
    await exportCanvas(canvas, fileType, `hero-tier-${section.tier.toLowerCase()}`);
  }

  async function exportAllTiers(fileType) {
    const LABEL_HEIGHT = 86;
    const TIER_GAP = 40;

    const sections = [];
    for (const section of state.sections) {
      const entries = await loadHeroEntries(section.heroes);
      if (entries.length) {
        sections.push({ tier: section.tier, entries });
      }
    }
    if (!sections.length) {
      throw new Error("Нет портретов для экспорта.");
    }
    await prepareExportFont();

    const columns = EXPORT_COLUMNS_MAX;
    const layouts = sections.map((section) => ({
      tier: section.tier,
      layout: measureSection(section.entries, columns)
    }));

    const totalHeight = EXPORT_TOP_PADDING
      + layouts.reduce((sum, { layout }) => sum + LABEL_HEIGHT + layout.contentHeight, 0)
      + Math.max(0, layouts.length - 1) * TIER_GAP
      + EXPORT_BOTTOM_PADDING;

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidthFor(columns);
    canvas.height = Math.ceil(totalHeight);
    const ctx = canvas.getContext("2d");

    // Полоса каждого тира рисуется со своим фоном (границы — посередине зазора между тирами).
    let bandTop = 0;
    let measureY = EXPORT_TOP_PADDING;
    for (let index = 0; index < layouts.length; index += 1) {
      const { tier, layout } = layouts[index];
      const sectionBottom = measureY + LABEL_HEIGHT + layout.contentHeight;
      const bandBottom = index === layouts.length - 1
        ? canvas.height
        : sectionBottom + TIER_GAP / 2;
      const mode = getTierBackgroundMode(tier);
      if (mode !== "transparent") {
        await drawWallpaperBackground(ctx, { x: 0, y: bandTop, width: canvas.width, height: bandBottom - bandTop }, mode);
      }
      bandTop = bandBottom;
      measureY = sectionBottom + TIER_GAP;
    }

    let cursorY = EXPORT_TOP_PADDING;
    layouts.forEach(({ tier, layout }, index) => {
      ctx.save();
      ctx.fillStyle = "rgba(240, 215, 154, 0.95)";
      ctx.font = '700 56px "BgDisplay", Georgia, serif';
      ctx.textBaseline = "middle";
      ctx.fillText(`${tier} · ${tierTitles[tier] || `${tier}-тир`}`, EXPORT_SIDE_PADDING, cursorY + LABEL_HEIGHT / 2);
      ctx.restore();
      cursorY += LABEL_HEIGHT;
      cursorY = drawSectionRows(ctx, layout, cursorY) + (index < layouts.length - 1 ? TIER_GAP : 0);
    });

    await exportCanvas(canvas, fileType, "hero-tier-list");
  }

  // --- Переключатели фона (как в конструкторе стратегий) ---
  // Глобальный пикер задаёт фон всем тирам сразу, пикер в шапке тира — только своему.

  const tierPickerUpdaters = [];

  function buildBackgroundPicker(container, getMode, setMode) {
    if (!container) return null;
    container.replaceChildren();
    BACKGROUND_OPTIONS.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "background-chip";
      button.dataset.bg = option.value;
      button.setAttribute("aria-label", option.label);
      button.title = option.label;
      if (option.url) {
        button.style.backgroundImage = `url("${option.url}")`;
      } else {
        button.classList.add("is-transparent");
        button.textContent = "∅";
      }
      button.addEventListener("click", () => {
        setMode(option.value);
        persistBackgrounds();
        refreshBackgroundPickers();
      });
      container.append(button);
    });
    const update = () => {
      container.querySelectorAll(".background-chip").forEach((chip) => {
        chip.classList.toggle("is-active", chip.dataset.bg === getMode());
      });
    };
    update();
    return update;
  }

  let globalPickerUpdate = null;

  function refreshBackgroundPickers() {
    if (globalPickerUpdate) globalPickerUpdate();
    tierPickerUpdaters.forEach((update) => update());
  }

  function renderGlobalBackgroundPicker() {
    globalPickerUpdate = buildBackgroundPicker(
      backgroundPickerEl,
      () => state.backgroundMode,
      (mode) => {
        state.backgroundMode = mode;
        state.tierBackgrounds = {};
      }
    );
  }

  async function bootstrap() {
    renderGlobalBackgroundPicker();
    try {
      const result = await loadHeroStats();
      const heroes = result.heroes.map(normalizeHero);
      state.sections = buildSections(heroes);
      renderStatus(result, heroes.length);
      renderTiers();
    } catch (error) {
      console.error(error);
      statusEl.textContent = "Не удалось загрузить тир-лист героев.";
    }
  }

  if (downloadAllPngButton) {
    downloadAllPngButton.addEventListener("click", (event) => {
      runExport(event.currentTarget, () => exportAllTiers("png"));
    });
  }
  if (downloadAllWebpButton) {
    downloadAllWebpButton.addEventListener("click", (event) => {
      runExport(event.currentTarget, () => exportAllTiers("webp"));
    });
  }

  bootstrap();
})();
