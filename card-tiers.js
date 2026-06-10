// Общий движок страниц «Тир-лист существ» и «Тир-лист заклинаний»:
// галерея по тирам S/A/B/C/D с экспортом (как тир-лист героев) + табличный вид со статистикой.
(function () {
  const TIER_ORDER = ["S", "A", "B", "C", "D"];

  const tierColors = {
    S: "#f2db9b",
    A: "#d8bf79",
    B: "#9fc7ff",
    C: "#7dcaa1",
    D: "#d89779"
  };

  const BACKGROUND_OPTIONS = [
    { value: "transparent", label: "Без фона", url: null },
    { value: "wallpaper", label: "Фон 1", url: "./wallpaper.webp" },
    { value: "wallpaper1", label: "Фон 2", url: "./wallpaper1.webp" },
    { value: "wallpaper2", label: "Фон 3", url: "./wallpaper2.webp" },
    { value: "wallpaper3", label: "Фон 4", url: "./wallpaper3.webp" }
  ];
  const BACKGROUND_VALUES = new Set(BACKGROUND_OPTIONS.map((option) => option.value));
  const wallpaperImageCache = new Map();

  function directArtUrl(id, size = "256x") {
    return `https://art.hearthstonejson.com/v1/bgs/latest/ruRU/${encodeURIComponent(size)}/${encodeURIComponent(id)}.png`;
  }

  function proxyArtUrl(id, size = "256x") {
    return `/api/card-art?id=${encodeURIComponent(id)}&locale=ruRU&size=${encodeURIComponent(size)}`;
  }

  function formatNumber(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "—";
    }
    return Number(value).toFixed(digits).replace(".", ",");
  }

  function formatCount(value) {
    if (!Number.isFinite(Number(value))) {
      return "—";
    }
    return new Intl.NumberFormat("ru-RU").format(Number(value));
  }

  function init(config) {
    const tiersRoot = document.getElementById("card-tiers");
    const tableRoot = document.getElementById("card-table");
    const statusEl = document.getElementById("card-tiers-status");
    const template = document.getElementById("card-tier-template");
    const backgroundPickerEl = document.getElementById("card-tiers-background-picker");
    const downloadAllPngButton = document.getElementById("card-tiers-download-all-png");
    const downloadAllWebpButton = document.getElementById("card-tiers-download-all-webp");
    const viewToggleEl = document.getElementById("card-tiers-view-toggle");
    const galleryToolbarEl = document.getElementById("card-tiers-gallery-toolbar");
    const searchInput = document.getElementById("card-table-search");
    const tableWrap = document.getElementById("card-table-wrap");

    const BACKGROUND_STORAGE_KEY = `${config.pageKey}-background-mode-v1`;
    const TIER_BACKGROUND_STORAGE_KEY = `${config.pageKey}-tier-backgrounds-v1`;
    const VIEW_STORAGE_KEY = `${config.pageKey}-view-v1`;

    const nameByDbfId = (config.static && config.static.nameByDbfId) || {};

    const state = {
      items: [],
      sections: [],
      view: loadView(),
      backgroundMode: loadBackgroundMode(),
      tierBackgrounds: loadTierBackgrounds(),
      sortKey: config.defaultSort.key,
      sortDir: config.defaultSort.dir,
      search: ""
    };

    function loadView() {
      try {
        const value = window.localStorage.getItem(VIEW_STORAGE_KEY);
        return value === "table" ? "table" : "gallery";
      } catch (error) {
        return "gallery";
      }
    }

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

    // --- Данные ---

    async function loadStats() {
      try {
        const payload = await window.Shared.loadJson(config.apiUrl);
        const items = payload[config.itemsField];
        if (Array.isArray(items) && items.length) {
          return { items, fetchedAt: payload.fetchedAt, live: true };
        }
        throw new Error("Пустой ответ статистики.");
      } catch (error) {
        console.warn("Статистика из API недоступна, использую локальный снапшот.", error);
      }

      const fallback = (config.static && config.static[config.itemsField]) || [];
      if (!fallback.length) {
        throw new Error("Нет ни живых данных, ни локального снапшота.");
      }
      return { items: fallback, fetchedAt: config.static.snapshotAt, live: false };
    }

    function prepareItems(rawItems) {
      return rawItems
        .filter((item) => item && item.id)
        .map((item) => {
          const metricValue = config.metric.value(item);
          return {
            ...item,
            ruName: nameByDbfId[String(item.dbfId)] || item.name || "",
            metricValue: Number.isFinite(Number(metricValue)) && metricValue !== null ? Number(metricValue) : null,
            metricLabel: config.metric.format(metricValue)
          };
        });
    }

    function deriveSections(items) {
      const rated = items.filter((item) => item.metricValue !== null);
      const direction = config.metric.better === "asc" ? 1 : -1;
      rated.sort((left, right) => direction * (left.metricValue - right.metricValue));

      const cutoffs = config.quantiles; // напр. { S: 0.08, A: 0.25, B: 0.55, C: 0.85 }
      const byTier = new Map(TIER_ORDER.map((tier) => [tier, []]));
      rated.forEach((item, index) => {
        const fraction = (index + 1) / rated.length;
        let tier = "D";
        if (fraction <= cutoffs.S || index === 0) tier = "S";
        else if (fraction <= cutoffs.A) tier = "A";
        else if (fraction <= cutoffs.B) tier = "B";
        else if (fraction <= cutoffs.C) tier = "C";
        item.tier = tier;
        byTier.get(tier).push(item);
      });

      return TIER_ORDER
        .filter((tier) => byTier.get(tier).length)
        .map((tier) => ({ tier, items: byTier.get(tier) }));
    }

    function formatUnitCount(count) {
      const mod10 = count % 10;
      const mod100 = count % 100;
      const forms = config.countForms; // напр. ["существо", "существа", "существ"]
      if (mod10 === 1 && mod100 !== 11) return `${count} ${forms[0]}`;
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${forms[1]}`;
      return `${count} ${forms[2]}`;
    }

    function formatDate(value) {
      const date = new Date(value || "");
      if (Number.isNaN(date.getTime())) {
        return "";
      }
      return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date);
    }

    function renderStatus(result) {
      const dateLabel = formatDate(result.fetchedAt);
      const sourceLabel = result.live ? config.liveLabel : "локальный снапшот (API недоступно)";
      const unrated = state.items.length - state.items.filter((item) => item.metricValue !== null).length;
      const unratedNote = unrated > 0 ? ` · без статистики: ${unrated} (только в таблице)` : "";
      statusEl.textContent = `${formatUnitCount(state.items.length)} · ${sourceLabel}${dateLabel ? ` · обновлено ${dateLabel}` : ""} · ${config.statusNote}${unratedNote}`;
    }

    // --- Галерея ---

    function renderCardTile(item) {
      const tile = document.createElement("figure");
      tile.className = "hero-tile card-render-tile";
      tile.title = `${item.ruName}${item.name && item.name !== item.ruName ? ` (${item.name})` : ""} — ${config.metric.label}: ${item.metricLabel} · таверна ${item.tavernTier || "?"}`;

      const media = document.createElement("div");
      media.className = "hero-tile-media card-render-media";
      const img = document.createElement("img");
      img.src = directArtUrl(item.id, "256x");
      img.alt = item.ruName;
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => {
        if (!img.dataset.fallback) {
          img.dataset.fallback = "1";
          img.src = proxyArtUrl(item.id, "256x");
        }
      }, { once: false });
      media.append(img);

      const place = document.createElement("figcaption");
      place.className = "hero-tile-place";
      place.textContent = item.metricLabel;

      const name = document.createElement("span");
      name.className = "hero-tile-name";
      name.textContent = item.ruName;

      tile.append(media, place, name);
      return tile;
    }

    const tierPickerUpdaters = [];
    let globalPickerUpdate = null;

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

    function refreshBackgroundPickers() {
      if (globalPickerUpdate) globalPickerUpdate();
      tierPickerUpdaters.forEach((update) => update());
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
        title.textContent = `${section.tier} · ${config.tierTitles[section.tier] || `${section.tier}-тир`}`;
        summary.textContent = formatUnitCount(section.items.length);

        const update = buildBackgroundPicker(
          tierPickerEl,
          () => getTierBackgroundMode(section.tier),
          (mode) => {
            state.tierBackgrounds[section.tier] = mode;
          }
        );
        if (update) tierPickerUpdaters.push(update);

        section.items.forEach((item) => gallery.append(renderCardTile(item)));

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

    // --- Экспорт (та же логика фона, что и в конструкторе стратегий) ---

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

    async function loadEntryImage(item) {
      try {
        return await window.Shared.loadImageFromSource(proxyArtUrl(item.id, "512x"));
      } catch (error) {
        try {
          return await window.Shared.loadImageFromSource(directArtUrl(item.id, "512x"));
        } catch (secondError) {
          console.warn(`Не удалось загрузить карту ${item.ruName}:`, secondError);
          return null;
        }
      }
    }

    async function loadEntries(items) {
      const loaded = await Promise.all(items.map(async (item) => {
        const image = await loadEntryImage(item);
        return image ? { item, image } : null;
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

    function drawMetricPill(ctx, item, centerX, topY) {
      const label = item.metricLabel;
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
        row.forEach(({ item, image }, columnIndex) => {
          const cardHeight = EXPORT_CARD_WIDTH * (image.height / image.width);
          const x = EXPORT_SIDE_PADDING + columnIndex * (EXPORT_CARD_WIDTH + EXPORT_COLUMN_GAP);
          const y = cursorY + (artMaxHeight - cardHeight) / 2;
          ctx.drawImage(image, x, y, EXPORT_CARD_WIDTH, cardHeight);
          drawMetricPill(ctx, item, x + EXPORT_CARD_WIDTH / 2, cursorY + artMaxHeight + EXPORT_PLACE_GAP);
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
      const entries = await loadEntries(section.items);
      if (!entries.length) {
        throw new Error("Нет карт для экспорта.");
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
      await exportCanvas(canvas, fileType, `${config.fileBase}-${section.tier.toLowerCase()}`);
    }

    async function exportAllTiers(fileType) {
      const LABEL_HEIGHT = 86;
      const TIER_GAP = 40;

      const sections = [];
      for (const section of state.sections) {
        const entries = await loadEntries(section.items);
        if (entries.length) {
          sections.push({ tier: section.tier, entries });
        }
      }
      if (!sections.length) {
        throw new Error("Нет карт для экспорта.");
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

      // Полоса каждого тира — со своим фоном (границы посередине зазора).
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
        ctx.fillText(`${tier} · ${config.tierTitles[tier] || `${tier}-тир`}`, EXPORT_SIDE_PADDING, cursorY + LABEL_HEIGHT / 2);
        ctx.restore();
        cursorY += LABEL_HEIGHT;
        cursorY = drawSectionRows(ctx, layout, cursorY) + (index < layouts.length - 1 ? TIER_GAP : 0);
      });

      await exportCanvas(canvas, fileType, `${config.fileBase}-list`);
    }

    // --- Таблица ---

    let tooltipEl = null;

    function ensureTooltip() {
      if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.className = "card-hover-preview";
        tooltipEl.hidden = true;
        document.body.append(tooltipEl);
      }
      return tooltipEl;
    }

    function showTooltip(item, clientX, clientY) {
      const tip = ensureTooltip();
      tip.innerHTML = "";
      const img = document.createElement("img");
      img.src = directArtUrl(item.id, "256x");
      img.alt = item.ruName;
      img.addEventListener("error", () => {
        if (!img.dataset.fallback) {
          img.dataset.fallback = "1";
          img.src = proxyArtUrl(item.id, "256x");
        }
      });
      tip.append(img);
      tip.hidden = false;
      positionTooltip(clientX, clientY);
    }

    function positionTooltip(clientX, clientY) {
      if (!tooltipEl || tooltipEl.hidden) return;
      const margin = 16;
      const rect = tooltipEl.getBoundingClientRect();
      let x = clientX + margin;
      let y = clientY - rect.height / 2;
      if (x + rect.width + margin > window.innerWidth) {
        x = clientX - rect.width - margin;
      }
      y = Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin));
      tooltipEl.style.left = `${x}px`;
      tooltipEl.style.top = `${y}px`;
    }

    function hideTooltip() {
      if (tooltipEl) {
        tooltipEl.hidden = true;
      }
    }

    function getSortedItems() {
      const column = config.columns.find((col) => col.key === state.sortKey) || config.columns[0];
      const dir = state.sortDir === "asc" ? 1 : -1;
      const searched = state.search
        ? state.items.filter((item) => (
          `${item.ruName} ${item.name}`.toLowerCase().includes(state.search.toLowerCase())
        ))
        : state.items;
      return [...searched].sort((left, right) => {
        const a = column.sort(left);
        const b = column.sort(right);
        if (a === null || a === undefined || a === "") return 1;
        if (b === null || b === undefined || b === "") return -1;
        if (typeof a === "string" || typeof b === "string") {
          return dir * String(a).localeCompare(String(b), "ru-RU");
        }
        return dir * (a - b);
      });
    }

    function renderTable() {
      if (!tableRoot) return;
      tableRoot.replaceChildren();

      const table = document.createElement("table");
      table.className = "stats-table";

      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      config.columns.forEach((column) => {
        const th = document.createElement("th");
        th.scope = "col";
        if (column.numeric) th.classList.add("is-numeric");
        const isActive = state.sortKey === column.key;
        th.classList.toggle("is-sorted", isActive);
        th.innerHTML = `<button type="button" class="stats-sort">${column.label}${isActive ? `<span class="stats-sort-dir">${state.sortDir === "asc" ? "▲" : "▼"}</span>` : ""}</button>`;
        th.querySelector("button").addEventListener("click", () => {
          if (state.sortKey === column.key) {
            state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
          } else {
            state.sortKey = column.key;
            state.sortDir = column.defaultDir || "desc";
          }
          renderTable();
        });
        headRow.append(th);
      });
      thead.append(headRow);
      table.append(thead);

      const tbody = document.createElement("tbody");
      getSortedItems().forEach((item) => {
        const tr = document.createElement("tr");
        if (item.tier) tr.dataset.tier = item.tier;
        config.columns.forEach((column, index) => {
          const td = document.createElement("td");
          if (column.numeric) td.classList.add("is-numeric");
          if (index === 0) {
            const nameButton = document.createElement("span");
            nameButton.className = "stats-card-name";
            nameButton.textContent = column.value(item);
            if (item.tier) {
              const badge = document.createElement("span");
              badge.className = "stats-tier-chip";
              badge.textContent = item.tier;
              badge.style.background = tierColors[item.tier] || "#f2db9b";
              td.append(badge);
            }
            nameButton.addEventListener("mouseenter", (event) => showTooltip(item, event.clientX, event.clientY));
            nameButton.addEventListener("mousemove", (event) => positionTooltip(event.clientX, event.clientY));
            nameButton.addEventListener("mouseleave", hideTooltip);
            td.append(nameButton);
          } else {
            td.textContent = column.value(item);
          }
          tr.append(td);
        });
        tbody.append(tr);
      });
      table.append(tbody);
      tableRoot.append(table);
    }

    // --- Переключение видов ---

    function applyView() {
      const isGallery = state.view === "gallery";
      tiersRoot.hidden = !isGallery;
      if (galleryToolbarEl) galleryToolbarEl.hidden = !isGallery;
      if (tableWrap) tableWrap.hidden = isGallery;
      if (viewToggleEl) {
        viewToggleEl.querySelectorAll("[data-view]").forEach((button) => {
          button.classList.toggle("is-active", button.dataset.view === state.view);
        });
      }
      if (!isGallery) {
        hideTooltip();
        renderTable();
      }
      try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, state.view);
      } catch (error) {
        // ignore
      }
    }

    if (viewToggleEl) {
      viewToggleEl.querySelectorAll("[data-view]").forEach((button) => {
        button.addEventListener("click", () => {
          state.view = button.dataset.view === "table" ? "table" : "gallery";
          applyView();
        });
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", window.Shared.debounce((event) => {
        state.search = event.target.value.trim();
        renderTable();
      }, 150));
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

    async function bootstrap() {
      globalPickerUpdate = buildBackgroundPicker(
        backgroundPickerEl,
        () => state.backgroundMode,
        (mode) => {
          state.backgroundMode = mode;
          state.tierBackgrounds = {};
        }
      );
      try {
        const result = await loadStats();
        state.items = prepareItems(result.items);
        state.sections = deriveSections(state.items);
        renderStatus(result);
        renderTiers();
        applyView();
      } catch (error) {
        console.error(error);
        statusEl.textContent = "Не удалось загрузить статистику.";
      }
    }

    bootstrap();
  }

  window.CardTiers = { init, formatNumber, formatCount };
})();
