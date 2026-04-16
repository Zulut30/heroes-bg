(function () {
  const MAX_DOWNLOAD_SIZE_MB = 1.95;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Не удалось загрузить изображение: ${src}`));
      image.src = src;
    });
  }

  function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Не удалось собрать изображение."));
      }, type, quality);
    });
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    });

    if (line) {
      lines.push(line);
    }

    return lines.length ? lines : [""];
  }

  async function compressForWordPress(blob, fileName) {
    if (!window.imageCompression) {
      return blob;
    }

    try {
      const compressed = await window.imageCompression(blob, {
        maxSizeMB: MAX_DOWNLOAD_SIZE_MB,
        maxWidthOrHeight: 2200,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.92,
        preserveExif: false
      });

      return new File([compressed], `${fileName}.webp`, { type: "image/webp" });
    } catch (error) {
      console.warn("Сжатие не удалось, использую исходный blob.", error);
      return blob;
    }
  }

  function debounce(callback, delay = 180) {
    let timeoutId;
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => callback(...args), delay);
    };
  }

  async function exportCardSheet(items, options = {}) {
    const cards = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!cards.length) {
      throw new Error("Нет карт для экспорта.");
    }

    const title = options.title || "Тир-лист Героев";
    const subtitle = options.subtitle || `${cards.length} карточек`;
    const fileBaseName = options.fileBaseName || "battlegrounds-export";
    const columns = Math.min(options.columns || 8, 8);
    const gap = options.gap || 28;
    const cardWidth = options.cardWidth || 176;
    const artRatio = options.artRatio || 1.38;
    const cardHeight = options.cardHeight || Math.round(cardWidth * artRatio) + 94;
    const padding = options.padding || 46;
    const headerHeight = options.headerHeight || 180;
    const rows = Math.ceil(cards.length / columns);
    const canvas = document.createElement("canvas");

    canvas.width = padding * 2 + columns * cardWidth + (columns - 1) * gap;
    canvas.height = headerHeight + padding + rows * cardHeight + (rows - 1) * gap + padding;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#07101f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "rgba(219, 192, 122, 0.24)");
    gradient.addColorStop(0.45, "rgba(19, 32, 57, 0.14)");
    gradient.addColorStop(1, "rgba(121, 183, 255, 0.18)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(248, 241, 219, 0.92)";
    ctx.font = '700 42px "BgDisplay", Georgia, serif';
    ctx.fillText(title, padding, 74);

    ctx.fillStyle = "rgba(200, 210, 232, 0.9)";
    ctx.font = '500 22px "Segoe UI", sans-serif';
    ctx.fillText(subtitle, padding, 112);

    await Promise.all(
      cards.map(async (card, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const x = padding + column * (cardWidth + gap);
        const y = headerHeight + row * (cardHeight + gap);
        const artY = y + 14;
        const artHeight = Math.round(cardWidth * artRatio);
        const img = await loadImage(card.image || card.artUrl);

        ctx.save();
        roundedRect(ctx, x, y, cardWidth, cardHeight, 22);
        ctx.fillStyle = "rgba(13, 20, 35, 0.96)";
        ctx.fill();
        ctx.restore();

        ctx.save();
        roundedRect(ctx, x + 10, artY, cardWidth - 20, artHeight, 18);
        ctx.clip();
        ctx.drawImage(img, x + 10, artY, cardWidth - 20, artHeight);
        ctx.restore();

        ctx.fillStyle = "rgba(248, 241, 219, 0.96)";
        ctx.font = '700 20px "Segoe UI", sans-serif';
        const lines = wrapText(ctx, card.name, cardWidth - 22).slice(0, 3);
        lines.forEach((line, lineIndex) => {
          ctx.fillText(line, x + 12, artY + artHeight + 28 + lineIndex * 22);
        });

        const metaBits = [];
        if (card.meta) {
          metaBits.push(card.meta);
        }
        if (card.averagePlace) {
          metaBits.push(`Среднее ${card.averagePlace}`);
        }

        if (metaBits.length) {
          ctx.fillStyle = "rgba(200, 210, 232, 0.88)";
          ctx.font = '500 16px "Segoe UI", sans-serif';
          ctx.fillText(metaBits.join(" • "), x + 12, y + cardHeight - 16);
        }
      })
    );

    const rawBlob = await canvasToBlob(canvas, "image/webp", 0.94);
    const resultBlob = await compressForWordPress(rawBlob, fileBaseName);
    const blobUrl = URL.createObjectURL(resultBlob);
    const link = document.createElement("a");

    link.href = blobUrl;
    link.download = resultBlob.name || `${fileBaseName}.webp`;
    document.body.append(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 800);
    return resultBlob;
  }

  window.Shared = {
    MAX_DOWNLOAD_SIZE_MB,
    loadImage,
    debounce,
    exportCardSheet
  };
})();
