const tierData = [
  {
    tier: "S",
    title: "S Tier",
    heroes: [
      { name: "Genn, Worgen King", popularity: "89.3%", averagePlace: "3.72", image: "./heroes_bg/Genn, Worgen King.png" },
    ],
  },
  {
    tier: "A",
    title: "A Tier",
    heroes: [
      { name: "Millificent Manastorm", popularity: "33.2%", averagePlace: "3.83", image: "./heroes_bg/Millificent Manastorm.png" },
      { name: "Chenvaala", popularity: "46.9%", averagePlace: "3.88", image: "./heroes_bg/Chenvaala.png" },
      { name: "Deathwing", popularity: "9.0%", averagePlace: "3.90", image: "./heroes_bg/Deathwing.png" },
      { name: "The Lich King", popularity: "50.0%", averagePlace: "3.92", image: "./heroes_bg/The Lich King.png" },
      { name: "Overlord Saurfang", popularity: "20.4%", averagePlace: "3.98", image: "./heroes_bg/Overlord Saurfang.png" },
      { name: "Rakanishu", popularity: "17.9%", averagePlace: "4.00", image: "./heroes_bg/Rakanishu.png" },
      { name: "Morchie", popularity: "65.4%", averagePlace: "4.02", image: "./heroes_bg/Morchie.png" },
      { name: "Onyxia", popularity: "27.9%", averagePlace: "4.02", image: "./heroes_bg/Onyxia.png" },
      { name: "Queen Wagtoggle", popularity: "16.9%", averagePlace: "4.02", image: "./heroes_bg/Queen Wagtoggle.png" },
      { name: "Murozond, Unbounded", popularity: "61.1%", averagePlace: "4.03", image: "./heroes_bg/Murozond, Unbounded.png" },
      { name: "Buttons", popularity: "63.6%", averagePlace: "4.04", image: "./heroes_bg/Buttons.png" },
      { name: "Teron Gorefiend", popularity: "55.9%", averagePlace: "4.05", image: "./heroes_bg/Teron Gorefiend.png" },
      { name: "Thorim, Stormlord", popularity: "58.3%", averagePlace: "4.06", image: "./heroes_bg/Thorim, Stormlord.png" },
      { name: "Jim Raynor", popularity: "22.8%", averagePlace: "4.06", image: "./heroes_bg/Jim Raynor.png" },
      { name: "The Great Akazamzarak", popularity: "26.5%", averagePlace: "4.06", image: "./heroes_bg/The Great Akazamzarak.png" },
      { name: "Sneed", popularity: "17.4%", averagePlace: "4.07", image: "./heroes_bg/Sneed.png" },
      { name: "Exarch Othaar", popularity: "15.5%", averagePlace: "4.07", image: "./heroes_bg/Exarch Othaar.png" },
      { name: "N'Zoth", popularity: "35.3%", averagePlace: "4.09", image: "./heroes_bg/N'Zoth.png" },
      { name: "Lady Vashj", popularity: "24.4%", averagePlace: "4.10", image: "./heroes_bg/Lady Vashj.png" },
      { name: "Sylvanas Windrunner", popularity: "56.9%", averagePlace: "4.10", image: "./heroes_bg/Sylvanas Windrunner.png" },
      { name: "Shudderwock", popularity: "48.0%", averagePlace: "4.12", image: "./heroes_bg/Shudderwock.png" },
      { name: "King Mukla", popularity: "9.9%", averagePlace: "4.13", image: "./heroes_bg/King Mukla.png" },
      { name: "Patchwerk", popularity: "32.4%", averagePlace: "4.13", image: "./heroes_bg/Patchwerk.png" },
      { name: "Sir Finley Mrrgglton", popularity: "47.0%", averagePlace: "4.14", image: "./heroes_bg/Sir Finley Mrrgglton.png" },
      { name: "Queen Azshara", popularity: "33.1%", averagePlace: "4.15", image: "./heroes_bg/Queen Azshara.png" },
      { name: "Ini Stormcoil", popularity: "28.1%", averagePlace: "4.16", image: "./heroes_bg/Ini Stormcoil.png" },
    ],
  },
  {
    tier: "B",
    title: "B Tier",
    heroes: [
      { name: "Captain Eudora", popularity: "35.7%", averagePlace: "4.17", image: "./heroes_bg/Captain Eudora.png" },
      { name: "Fungalmancer Flurgl", popularity: "29.3%", averagePlace: "4.17", image: "./heroes_bg/Fungalmancer Flurgl.png" },
      { name: "Murloc Holmes", popularity: "26.4%", averagePlace: "4.18", image: "./heroes_bg/Murloc Holmes.png" },
      { name: "Dinotamer Brann", popularity: "59.2%", averagePlace: "4.18", image: "./heroes_bg/Dinotamer Brann.png" },
      { name: "Al'Akir", popularity: "26.8%", averagePlace: "4.18", image: "./heroes_bg/Al'Akir.png" },
      { name: "Marin the Manager", popularity: "69.2%", averagePlace: "4.18", image: "./heroes_bg/Marin the Manager.png" },
      { name: "Yogg-Saron, Hope's End", popularity: "30.4%", averagePlace: "4.19", image: "./heroes_bg/Yogg-Saron, Hope's End.png" },
      { name: "Vanndar Stormpike", popularity: "34.2%", averagePlace: "4.20", image: "./heroes_bg/Vanndar Stormpike.png" },
      { name: "Mutanus the Devourer", popularity: "30.5%", averagePlace: "4.20", image: "./heroes_bg/Mutanus the Devourer.png" },
      { name: "Dancin' Deryl", popularity: "20.3%", averagePlace: "4.21", image: "./heroes_bg/Dancin' Deryl.png" },
      { name: "Drek'Thar", popularity: "32.3%", averagePlace: "4.21", image: "./heroes_bg/Drek'Thar.png" },
      { name: "Maiev Shadowsong", popularity: "17.1%", averagePlace: "4.22", image: "./heroes_bg/Maiev Shadowsong.png" },
      { name: "Farseer Nobundo", popularity: "28.0%", averagePlace: "4.22", image: "./heroes_bg/Farseer Nobundo.png" },
      { name: "Vol'jin", popularity: "12.6%", averagePlace: "4.22", image: "./heroes_bg/Vol'jin.png" },
      { name: "Tickatus", popularity: "32.5%", averagePlace: "4.23", image: "./heroes_bg/Tickatus.png" },
      { name: "A. F. Kay", popularity: "51.2%", averagePlace: "4.24", image: "./heroes_bg/A. F. Kay.png" },
      { name: "Ambassador Faelin", popularity: "53.3%", averagePlace: "4.24", image: "./heroes_bg/Ambassador Faelin.png" },
      { name: "Doctor Holli'dae", popularity: "19.8%", averagePlace: "4.24", image: "./heroes_bg/Doctor Holli'dae.png" },
      { name: "Inge, the Iron Hymn", popularity: "10.4%", averagePlace: "4.25", image: "./heroes_bg/Inge, the Iron Hymn.png" },
      { name: "E.T.C., Band Manager", popularity: "43.9%", averagePlace: "4.25", image: "./heroes_bg/E.T.C., Band Manager.png" },
      { name: "Millhouse Manastorm", popularity: "13.7%", averagePlace: "4.25", image: "./heroes_bg/Millhouse Manastorm.png" },
      { name: "Y'Shaarj", popularity: "21.3%", averagePlace: "4.25", image: "./heroes_bg/Y'Shaarj.png" },
      { name: "Silas Darkmoon", popularity: "28.8%", averagePlace: "4.25", image: "./heroes_bg/Silas Darkmoon.png" },
      { name: "Elise Starseeker", popularity: "19.8%", averagePlace: "4.25", image: "./heroes_bg/Elise Starseeker.png" },
      { name: "Master Nguyen", popularity: "55.6%", averagePlace: "4.26", image: "./heroes_bg/Master Nguyen.png" },
      { name: "Rokara", popularity: "10.4%", averagePlace: "4.26", image: "./heroes_bg/Rokara.png" },
      { name: "The Rat King", popularity: "25.4%", averagePlace: "4.28", image: "./heroes_bg/The Rat King.png" },
      { name: "Patches the Pirate", popularity: "34.3%", averagePlace: "4.28", image: "./heroes_bg/Patches the Pirate.png" },
      { name: "Galakrond", popularity: "41.3%", averagePlace: "4.28", image: "./heroes_bg/Galakrond.png" },
      { name: "Artanis", popularity: "19.0%", averagePlace: "4.29", image: "./heroes_bg/Artanis.png" },
      { name: "Varden Dawngrasp", popularity: "31.9%", averagePlace: "4.29", image: "./heroes_bg/Varden Dawngrasp.png" },
      { name: "Enhance-o Mechano", popularity: "20.2%", averagePlace: "4.29", image: "./heroes_bg/Enhance-o Mechano.png" },
      { name: "George the Fallen", popularity: "20.2%", averagePlace: "4.29", image: "./heroes_bg/George the Fallen.png" },
    ],
  },
  {
    tier: "C",
    title: "C Tier",
    heroes: [
      { name: "Heistbaron Togwaggle", popularity: "23.4%", averagePlace: "4.31", image: "./heroes_bg/Heistbaron Togwaggle.png" },
      { name: "Sire Denathrius", popularity: "75.9%", averagePlace: "4.32", image: "./heroes_bg/Sire Denathrius.png" },
      { name: "Tamsin Roame", popularity: "15.1%", averagePlace: "4.33", image: "./heroes_bg/Tamsin Roame.png" },
      { name: "Ozumat", popularity: "11.7%", averagePlace: "4.33", image: "./heroes_bg/Ozumat.png" },
      { name: "Cariel Roame", popularity: "6.1%", averagePlace: "4.33", image: "./heroes_bg/Cariel Roame.png" },
      { name: "Kael'thas Sunstrider", popularity: "17.7%", averagePlace: "4.34", image: "./heroes_bg/Kael'thas Sunstrider.png" },
      { name: "Loh, the Living Legend", popularity: "33.0%", averagePlace: "4.35", image: "./heroes_bg/Loh, the Living Legend.png" },
      { name: "The Jailer", popularity: "10.1%", averagePlace: "4.35", image: "./heroes_bg/The Jailer.png" },
      { name: "Edwin VanCleef", popularity: "10.1%", averagePlace: "4.36", image: "./heroes_bg/Edwin VanCleef.png" },
      { name: "Bru'kan", popularity: "12.2%", averagePlace: "4.37", image: "./heroes_bg/Bru'kan.png" },
      { name: "Cap'n Hoggarr", popularity: "47.9%", averagePlace: "4.37", image: "./heroes_bg/Cap'n Hoggarr.png" },
      { name: "Mr. Bigglesworth", popularity: "21.8%", averagePlace: "4.37", image: "./heroes_bg/Mr. Bigglesworth.png" },
      { name: "Lord Jaraxxus", popularity: "37.1%", averagePlace: "4.37", image: "./heroes_bg/Lord Jaraxxus.png" },
      { name: "Skycap'n Kragg", popularity: "20.9%", averagePlace: "4.37", image: "./heroes_bg/Skycap'n Kragg.png" },
      { name: "Zerek, Master Cloner", popularity: "43.5%", averagePlace: "4.37", image: "./heroes_bg/Zerek, Master Cloner.png" },
      { name: "C'Thun", popularity: "9.7%", averagePlace: "4.38", image: "./heroes_bg/C'Thun.png" },
      { name: "Malygos", popularity: "20.9%", averagePlace: "4.38", image: "./heroes_bg/Malygos.png" },
      { name: "Rock Master Voone", popularity: "36.2%", averagePlace: "4.39", image: "./heroes_bg/Rock Master Voone.png" },
      { name: "Forest Lord Cenarius", popularity: "47.1%", averagePlace: "4.39", image: "./heroes_bg/Forest Lord Cenarius.png" },
      { name: "Aranna Starseeker", popularity: "26.7%", averagePlace: "4.40", image: "./heroes_bg/Aranna Starseeker.png" },
      { name: "Sindragosa", popularity: "37.3%", averagePlace: "4.40", image: "./heroes_bg/Sindragosa.png" },
      { name: "Tavish Stormpike", popularity: "23.3%", averagePlace: "4.41", image: "./heroes_bg/Tavish Stormpike.png" },
      { name: "The Curator", popularity: "19.4%", averagePlace: "4.41", image: "./heroes_bg/The Curator.png" },
      { name: "Greybough", popularity: "31.5%", averagePlace: "4.41", image: "./heroes_bg/Greybough.png" },
      { name: "Galewing", popularity: "26.7%", averagePlace: "4.41", image: "./heroes_bg/Galewing.png" },
      { name: "Jandice Barov", popularity: "20.8%", averagePlace: "4.42", image: "./heroes_bg/Jandice Barov.png" },
      { name: "Cookie the Cook", popularity: "24.0%", averagePlace: "4.42", image: "./heroes_bg/Cookie the Cook.png" },
      { name: "Guff Runetotem", popularity: "36.9%", averagePlace: "4.42", image: "./heroes_bg/Guff Runetotem.png" },
      { name: "Arch-Villain Rafaam", popularity: "24.5%", averagePlace: "4.42", image: "./heroes_bg/Arch-Villain Rafaam.png" },
    ],
  },
  {
    tier: "D",
    title: "D Tier",
    heroes: [
      { name: "Illidan Stormrage", popularity: "27.6%", averagePlace: "4.45", image: "./heroes_bg/Illidan Stormrage.png" },
      { name: "Nozdormu", popularity: "23.6%", averagePlace: "4.45", image: "./heroes_bg/Nozdormu.png" },
      { name: "Reno Jackson", popularity: "47.6%", averagePlace: "4.46", image: "./heroes_bg/Reno Jackson.png" },
      { name: "Forest Warden Omu", popularity: "35.9%", averagePlace: "4.48", image: "./heroes_bg/Forest Warden Omu.png" },
      { name: "Infinite Toki", popularity: "40.1%", averagePlace: "4.48", image: "./heroes_bg/Infinite Toki.png" },
      { name: "Xyrella", popularity: "27.5%", averagePlace: "4.48", image: "./heroes_bg/Xyrella.png" },
      { name: "Kerrigan, Queen of Blades", popularity: "9.4%", averagePlace: "4.49", image: "./heroes_bg/Kerrigan, Queen of Blades.png" },
      { name: "Trade Prince Gallywix", popularity: "44.1%", averagePlace: "4.49", image: "./heroes_bg/Trade Prince Gallywix.png" },
      { name: "Ragnaros the Firelord", popularity: "13.9%", averagePlace: "4.50", image: "./heroes_bg/Ragnaros the Firelord.png" },
      { name: "Captain Hooktusk", popularity: "17.0%", averagePlace: "4.50", image: "./heroes_bg/Captain Hooktusk.png" },
      { name: "Lich Baz'hial", popularity: "19.4%", averagePlace: "4.51", image: "./heroes_bg/Lich Baz'hial.png" },
      { name: "Kurtrus Ashfallen", popularity: "24.1%", averagePlace: "4.51", image: "./heroes_bg/Kurtrus Ashfallen.png" },
      { name: "Scabbs Cutterbutter", popularity: "31.1%", averagePlace: "4.51", image: "./heroes_bg/Scabbs Cutterbutter.png" },
      { name: "Zephrys, the Great", popularity: "33.1%", averagePlace: "4.52", image: "./heroes_bg/Zephrys, the Great.png" },
      { name: "Snake Eyes", popularity: "44.9%", averagePlace: "4.54", image: null },
      { name: "Death Speaker Blackthorn", popularity: "15.5%", averagePlace: "4.57", image: "./heroes_bg/Death Speaker Blackthorn.png" },
      { name: "Time Twister Chromie", popularity: "26.0%", averagePlace: "4.58", image: "./heroes_bg/Time Twister Chromie.png" },
      { name: "Pyramad", popularity: "13.7%", averagePlace: "4.59", image: "./heroes_bg/Pyramad.png" },
      { name: "Tess Greymane", popularity: "44.5%", averagePlace: "4.60", image: "./heroes_bg/Tess Greymane.png" },
      { name: "Professor Putricide", popularity: "15.6%", averagePlace: "4.64", image: "./heroes_bg/Professor Putricide.png" },
      { name: "Alexstrasza", popularity: "21.6%", averagePlace: "4.67", image: "./heroes_bg/Alexstrasza.png" },
      { name: "Mister Clocksworth", popularity: "67.4%", averagePlace: "4.71", image: "./heroes_bg/Mister Clocksworth.png" },
      { name: "Tae'thelan Bloodwatcher", popularity: "9.6%", averagePlace: "4.75", image: "./heroes_bg/Tae'thelan Bloodwatcher.png" },
      { name: "Ysera", popularity: "21.7%", averagePlace: "4.85", image: "./heroes_bg/Ysera.png" },
    ],
  },
];

const tierColors = {
  S: "var(--s)",
  A: "var(--a)",
  B: "var(--b)",
  C: "var(--c)",
  D: "var(--d)",
};

const tiersContainer = document.querySelector("#tiers");
const tierTemplate = document.querySelector("#tier-template");
const statsContainer = document.querySelector("#hero-stats");

function buildStats() {
  const totalHeroes = tierData.reduce((sum, tier) => sum + tier.heroes.length, 0);
  const availableImages = tierData.reduce(
    (sum, tier) => sum + tier.heroes.filter((hero) => hero.image).length,
    0,
  );

  const chips = [
    `${totalHeroes} героев`,
    `${tierData.length} тиров`,
    `${availableImages} изображений`,
    `1 карточка без локального PNG`,
  ];

  statsContainer.innerHTML = "";
  chips.forEach((text) => {
    const chip = document.createElement("span");
    chip.className = "stat-chip";
    chip.textContent = text;
    statsContainer.appendChild(chip);
  });
}

function createHeroCard(hero) {
  const card = document.createElement("article");
  card.className = `hero-card${hero.image ? "" : " missing"}`;

  const averagePlace = document.createElement("span");
  averagePlace.className = "hero-rank";
  averagePlace.textContent = `Avg ${hero.averagePlace}`;
  card.appendChild(averagePlace);

  if (hero.image) {
    const image = document.createElement("img");
    image.src = hero.image;
    image.alt = hero.name;
    image.loading = "lazy";
    card.appendChild(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "hero-placeholder";
    placeholder.textContent = `${hero.name}\nPNG not found`;
    card.appendChild(placeholder);
  }

  const name = document.createElement("div");
  name.className = "hero-name";
  name.textContent = hero.name;
  card.appendChild(name);

  return card;
}

function renderTiers() {
  buildStats();

  tierData.forEach((tierInfo) => {
    const fragment = tierTemplate.content.cloneNode(true);
    const section = fragment.querySelector(".tier-section");
    const badge = fragment.querySelector(".tier-badge");
    const title = fragment.querySelector(".tier-title");
    const summary = fragment.querySelector(".tier-summary");
    const grid = fragment.querySelector(".hero-grid");
    const button = fragment.querySelector(".download-button");

    section.dataset.tier = tierInfo.tier;
    badge.textContent = tierInfo.tier;
    badge.style.background = tierColors[tierInfo.tier];
    title.textContent = tierInfo.title;
    summary.textContent = `${tierInfo.heroes.length} героев • средний ранг ${calculateTierAverage(tierInfo.heroes)}`;

    tierInfo.heroes.forEach((hero) => {
      grid.appendChild(createHeroCard(hero));
    });

    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Собираю PNG...";
      try {
        await exportTierImage(tierInfo);
        button.textContent = "PNG скачан";
      } catch (error) {
        console.error(error);
        button.textContent = "Ошибка экспорта";
      }

      setTimeout(() => {
        button.disabled = false;
        button.textContent = "Скачать PNG";
      }, 1800);
    });

    tiersContainer.appendChild(fragment);
  });
}

function calculateTierAverage(heroes) {
  const sum = heroes.reduce((total, hero) => total + Number(hero.averagePlace), 0);
  return (sum / heroes.length).toFixed(2);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
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

async function exportTierImage(tierInfo) {
  const columns = 8;
  const gap = 24;
  const padding = 42;
  const cardWidth = 156;
  const cardHeight = 214;
  const rows = Math.ceil(tierInfo.heroes.length / columns);
  const width = padding * 2 + columns * cardWidth + (columns - 1) * gap;
  const height = 178 + padding * 2 + rows * cardHeight + (rows - 1) * gap;
  const canvas = document.createElement("canvas");
  const scale = window.devicePixelRatio > 1 ? 2 : 1;

  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  const images = await Promise.all(tierInfo.heroes.map((hero) => (hero.image ? loadImage(hero.image) : Promise.resolve(null))));

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#101d36");
  gradient.addColorStop(0.55, "#0a1222");
  gradient.addColorStop(1, "#060b14");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.15, 24, 20, width * 0.15, 24, width * 0.52);
  glow.addColorStop(0, "rgba(244, 206, 100, 0.28)");
  glow.addColorStop(1, "rgba(244, 206, 100, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = tierColors[tierInfo.tier];
  roundedRect(ctx, padding, padding, 132, 72, 24);
  ctx.fill();

  ctx.fillStyle = "#07111e";
  ctx.font = "700 34px Cinzel";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tierInfo.tier, padding + 66, padding + 38);

  ctx.textAlign = "left";
  ctx.fillStyle = "#f6f1df";
  ctx.font = "700 40px Cinzel";
  ctx.fillText(`${tierInfo.title} Heroes`, padding + 160, padding + 42);

  ctx.fillStyle = "#b8c1d1";
  ctx.font = "600 18px Manrope";
  ctx.fillText(`${tierInfo.heroes.length} heroes • avg place ${calculateTierAverage(tierInfo.heroes)}`, padding + 160, padding + 78);

  tierInfo.heroes.forEach((hero, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = padding + column * (cardWidth + gap);
    const y = padding + 118 + row * (cardHeight + gap);

    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    roundedRect(ctx, x, y, cardWidth, cardHeight, 20);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    roundedRect(ctx, x, y, cardWidth, cardHeight, 20);
    ctx.stroke();

    ctx.save();
    roundedRect(ctx, x, y, cardWidth, cardHeight, 20);
    ctx.clip();

    const loadedImage = images[index];
    if (loadedImage) {
      ctx.drawImage(loadedImage, x, y, cardWidth, cardHeight);
    } else {
      const placeholderGradient = ctx.createLinearGradient(x, y, x, y + cardHeight);
      placeholderGradient.addColorStop(0, "rgba(244, 206, 100, 0.22)");
      placeholderGradient.addColorStop(1, "rgba(18, 30, 55, 0.92)");
      ctx.fillStyle = placeholderGradient;
      ctx.fillRect(x, y, cardWidth, cardHeight);
      ctx.fillStyle = "#fff0b5";
      ctx.font = "800 20px Manrope";
      ctx.textAlign = "center";
      wrapText(ctx, hero.name, x + cardWidth / 2, y + cardHeight / 2 - 16, cardWidth - 22, 24);
      ctx.font = "700 15px Manrope";
      ctx.fillStyle = "rgba(255, 246, 214, 0.8)";
      ctx.fillText("PNG not found", x + cardWidth / 2, y + cardHeight - 24);
    }

    const fade = ctx.createLinearGradient(x, y + cardHeight * 0.48, x, y + cardHeight);
    fade.addColorStop(0, "rgba(4, 8, 15, 0)");
    fade.addColorStop(1, "rgba(4, 8, 15, 0.96)");
    ctx.fillStyle = fade;
    ctx.fillRect(x, y, cardWidth, cardHeight);
    ctx.restore();

    ctx.fillStyle = "rgba(3, 8, 15, 0.72)";
    roundedRect(ctx, x + 10, y + 10, 76, 28, 14);
    ctx.fill();
    ctx.fillStyle = "#fff6d6";
    ctx.font = "800 13px Manrope";
    ctx.textAlign = "left";
    ctx.fillText(`Avg ${hero.averagePlace}`, x + 19, y + 28);

    ctx.fillStyle = "#f8f4ea";
    ctx.font = "800 16px Manrope";
    wrapText(ctx, hero.name, x + 14, y + cardHeight - 48, cardWidth - 28, 19, false);
  });

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${tierInfo.tier.toLowerCase()}-tier-heroes.png`;
  link.click();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, center = true) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  ctx.textAlign = center ? "center" : "left";

  for (let index = 0; index < words.length; index += 1) {
    const testLine = `${line}${words[index]} `;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && index > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = `${words[index]} `;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  ctx.fillText(line.trim(), x, currentY);
}

renderTiers();
