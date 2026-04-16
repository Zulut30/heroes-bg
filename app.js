const tierData = [
  {
    tier: "S",
    title: "S Тир",
    heroes: [
      { name: "Король воргенов Генн", popularity: "89.3%", averagePlace: "3.72", image: "./heroes_bg/Genn, Worgen King.png" },
    ],
  },
  {
    tier: "A",
    title: "A Тир",
    heroes: [
      { name: "Миллифисент Манашторм", popularity: "33.2%", averagePlace: "3.83", image: "./heroes_bg/Millificent Manastorm.png" },
      { name: "Ченваала", popularity: "46.9%", averagePlace: "3.88", image: "./heroes_bg/Chenvaala.png" },
      { name: "Смертокрыл", popularity: "9.0%", averagePlace: "3.90", image: "./heroes_bg/Deathwing.png" },
      { name: "Король-лич", popularity: "50.0%", averagePlace: "3.92", image: "./heroes_bg/The Lich King.png" },
      { name: "Воевода Саурфанг", popularity: "20.4%", averagePlace: "3.98", image: "./heroes_bg/Overlord Saurfang.png" },
      { name: "Раканишу", popularity: "17.9%", averagePlace: "4.00", image: "./heroes_bg/Rakanishu.png" },
      { name: "Морхи", popularity: "65.4%", averagePlace: "4.02", image: "./heroes_bg/Morchie.png" },
      { name: "Ониксия", popularity: "27.9%", averagePlace: "4.02", image: "./heroes_bg/Onyxia.png" },
      { name: "Королева Пыхлевых", popularity: "16.9%", averagePlace: "4.02", image: "./heroes_bg/Queen Wagtoggle.png" },
      { name: "Мурозонд Освобожденный", popularity: "61.1%", averagePlace: "4.03", image: "./heroes_bg/Murozond, Unbounded.png" },
      { name: "Кнопка", popularity: "63.6%", averagePlace: "4.04", image: "./heroes_bg/Buttons.png" },
      { name: "Терон Кровожад", popularity: "55.9%", averagePlace: "4.05", image: "./heroes_bg/Teron Gorefiend.png" },
      { name: "Торим, владыка бури", popularity: "58.3%", averagePlace: "4.06", image: "./heroes_bg/Thorim, Stormlord.png" },
      { name: "Джим Рейнор", popularity: "22.8%", averagePlace: "4.06", image: "./heroes_bg/Jim Raynor.png" },
      { name: "Ахалаймахалай", popularity: "26.5%", averagePlace: "4.06", image: "./heroes_bg/The Great Akazamzarak.png" },
      { name: "Снид", popularity: "17.4%", averagePlace: "4.07", image: "./heroes_bg/Sneed.png" },
      { name: "Экзарх Отаар", popularity: "15.5%", averagePlace: "4.07", image: "./heroes_bg/Exarch Othaar.png" },
      { name: "Н'Зот", popularity: "35.3%", averagePlace: "4.09", image: "./heroes_bg/N'Zoth.png" },
      { name: "Леди Вайш", popularity: "24.4%", averagePlace: "4.10", image: "./heroes_bg/Lady Vashj.png" },
      { name: "Сильвана Ветрокрылая", popularity: "56.9%", averagePlace: "4.10", image: "./heroes_bg/Sylvanas Windrunner.png" },
      { name: "Дрыжеглот", popularity: "48.0%", averagePlace: "4.12", image: "./heroes_bg/Shudderwock.png" },
      { name: "Король Мукла", popularity: "9.9%", averagePlace: "4.13", image: "./heroes_bg/King Mukla.png" },
      { name: "Лоскутик", popularity: "32.4%", averagePlace: "4.13", image: "./heroes_bg/Patchwerk.png" },
      { name: "Сэр Финли Мрргглтон", popularity: "47.0%", averagePlace: "4.14", image: "./heroes_bg/Sir Finley Mrrgglton.png" },
      { name: "Королева Азшара", popularity: "33.1%", averagePlace: "4.15", image: "./heroes_bg/Queen Azshara.png" },
      { name: "Ини Штормоверь", popularity: "28.1%", averagePlace: "4.16", image: "./heroes_bg/Ini Stormcoil.png" },
    ],
  },
  {
    tier: "B",
    title: "B Тир",
    heroes: [
      { name: "Капитан Юдора", popularity: "35.7%", averagePlace: "4.17", image: "./heroes_bg/Captain Eudora.png" },
      { name: "Грибомант Флургл", popularity: "29.3%", averagePlace: "4.17", image: "./heroes_bg/Fungalmancer Flurgl.png" },
      { name: "Мурлок Холмс", popularity: "26.4%", averagePlace: "4.18", image: "./heroes_bg/Murloc Holmes.png" },
      { name: "Укротитель ящеров Бранн", popularity: "59.2%", averagePlace: "4.18", image: "./heroes_bg/Dinotamer Brann.png" },
      { name: "Ал'акир", popularity: "26.8%", averagePlace: "4.18", image: "./heroes_bg/Al'Akir.png" },
      { name: "Менеджер Марин", popularity: "69.2%", averagePlace: "4.18", image: "./heroes_bg/Marin the Manager.png" },
      { name: "Йогг-Сарон", popularity: "30.4%", averagePlace: "4.19", image: "./heroes_bg/Yogg-Saron, Hope's End.png" },
      { name: "Ванндар Грозовая Вершина", popularity: "34.2%", averagePlace: "4.20", image: "./heroes_bg/Vanndar Stormpike.png" },
      { name: "Мутанус Пожиратель", popularity: "30.5%", averagePlace: "4.20", image: "./heroes_bg/Mutanus the Devourer.png" },
      { name: "Танцор Дэрил", popularity: "20.3%", averagePlace: "4.21", image: "./heroes_bg/Dancin' Deryl.png" },
      { name: "Дрек'Тар", popularity: "32.3%", averagePlace: "4.21", image: "./heroes_bg/Drek'Thar.png" },
      { name: "Маиев Песнь Теней", popularity: "17.1%", averagePlace: "4.22", image: "./heroes_bg/Maiev Shadowsong.png" },
      { name: "Предсказатель Нобундо", popularity: "28.0%", averagePlace: "4.22", image: "./heroes_bg/Farseer Nobundo.png" },
      { name: "Вол'джин", popularity: "12.6%", averagePlace: "4.22", image: "./heroes_bg/Vol'jin.png" },
      { name: "Билетекус", popularity: "32.5%", averagePlace: "4.23", image: "./heroes_bg/Tickatus.png" },
      { name: "А. Ф. Ка", popularity: "51.2%", averagePlace: "4.24", image: "./heroes_bg/A. F. Kay.png" },
      { name: "Посол Фаэлин", popularity: "53.3%", averagePlace: "4.24", image: "./heroes_bg/Ambassador Faelin.png" },
      { name: "Доктор Гуляка", popularity: "19.8%", averagePlace: "4.24", image: "./heroes_bg/Doctor Holli'dae.png" },
      { name: "Инге Стальной Гимн", popularity: "10.4%", averagePlace: "4.25", image: "./heroes_bg/Inge, the Iron Hymn.png" },
      { name: "Музыкальный менеджер Е.Т.С.", popularity: "43.9%", averagePlace: "4.25", image: "./heroes_bg/E.T.C., Band Manager.png" },
      { name: "Миллхаус Манашторм", popularity: "13.7%", averagePlace: "4.25", image: "./heroes_bg/Millhouse Manastorm.png" },
      { name: "И'Шарадж", popularity: "21.3%", averagePlace: "4.25", image: "./heroes_bg/Y'Shaarj.png" },
      { name: "Сайлас Новолуний", popularity: "28.8%", averagePlace: "4.25", image: "./heroes_bg/Silas Darkmoon.png" },
      { name: "Элиза Звездочет", popularity: "19.8%", averagePlace: "4.25", image: "./heroes_bg/Elise Starseeker.png" },
      { name: "Мастер Нгуен", popularity: "55.6%", averagePlace: "4.26", image: "./heroes_bg/Master Nguyen.png" },
      { name: "Рокара", popularity: "10.4%", averagePlace: "4.26", image: "./heroes_bg/Rokara.png" },
      { name: "Крысиный король", popularity: "25.4%", averagePlace: "4.28", image: "./heroes_bg/The Rat King.png" },
      { name: "Пират Глазастик", popularity: "34.3%", averagePlace: "4.28", image: "./heroes_bg/Patches the Pirate.png" },
      { name: "Галакронд", popularity: "41.3%", averagePlace: "4.28", image: "./heroes_bg/Galakrond.png" },
      { name: "Артанис", popularity: "19.0%", averagePlace: "4.29", image: "./heroes_bg/Artanis.png" },
      { name: "Варден Луч Рассвета", popularity: "31.9%", averagePlace: "4.29", image: "./heroes_bg/Varden Dawngrasp.png" },
      { name: "Механо-усилитель", popularity: "20.2%", averagePlace: "4.29", image: "./heroes_bg/Enhance-o Mechano.png" },
      { name: "Джордж Падший", popularity: "20.2%", averagePlace: "4.29", image: "./heroes_bg/George the Fallen.png" },
    ],
  },
  {
    tier: "C",
    title: "C Тир",
    heroes: [
      { name: "Король воров Вихлепых", popularity: "23.4%", averagePlace: "4.31", image: "./heroes_bg/Heistbaron Togwaggle.png" },
      { name: "Сир Денатрий", popularity: "75.9%", averagePlace: "4.32", image: "./heroes_bg/Sire Denathrius.png" },
      { name: "Тамсин Роум", popularity: "15.1%", averagePlace: "4.33", image: "./heroes_bg/Tamsin Roame.png" },
      { name: "Озумат", popularity: "11.7%", averagePlace: "4.33", image: "./heroes_bg/Ozumat.png" },
      { name: "Кариэль Роум", popularity: "6.1%", averagePlace: "4.33", image: "./heroes_bg/Cariel Roame.png" },
      { name: "Принц Кель'тас", popularity: "17.7%", averagePlace: "4.34", image: "./heroes_bg/Kael'thas Sunstrider.png" },
      { name: "Ло, живая легенда", popularity: "33.0%", averagePlace: "4.35", image: "./heroes_bg/Loh, the Living Legend.png" },
      { name: "Тюремщик", popularity: "10.1%", averagePlace: "4.35", image: "./heroes_bg/The Jailer.png" },
      { name: "Эдвин ван Клифф", popularity: "10.1%", averagePlace: "4.36", image: "./heroes_bg/Edwin VanCleef.png" },
      { name: "Бру'кан", popularity: "12.2%", averagePlace: "4.37", image: "./heroes_bg/Bru'kan.png" },
      { name: "Капитан Др-р-р-робитель", popularity: "47.9%", averagePlace: "4.37", image: "./heroes_bg/Cap'n Hoggarr.png" },
      { name: "Мистер Бигглсуорт", popularity: "21.8%", averagePlace: "4.37", image: "./heroes_bg/Mr. Bigglesworth.png" },
      { name: "Лорд Джараксус", popularity: "37.1%", averagePlace: "4.37", image: "./heroes_bg/Lord Jaraxxus.png" },
      { name: "Крагг Поднебесный", popularity: "20.9%", averagePlace: "4.37", image: "./heroes_bg/Skycap'n Kragg.png" },
      { name: "Клонист Зерек", popularity: "43.5%", averagePlace: "4.37", image: "./heroes_bg/Zerek, Master Cloner.png" },
      { name: "К'Тун", popularity: "9.7%", averagePlace: "4.38", image: "./heroes_bg/C'Thun.png" },
      { name: "Малигос", popularity: "20.9%", averagePlace: "4.38", image: "./heroes_bg/Malygos.png" },
      { name: "Рок-мастер Вун", popularity: "36.2%", averagePlace: "4.39", image: "./heroes_bg/Rock Master Voone.png" },
      { name: "Лесной властелин Кенарий", popularity: "47.1%", averagePlace: "4.39", image: "./heroes_bg/Forest Lord Cenarius.png" },
      { name: "Аранна Звездочет", popularity: "26.7%", averagePlace: "4.40", image: "./heroes_bg/Aranna Starseeker.png" },
      { name: "Синдрагоса", popularity: "37.3%", averagePlace: "4.40", image: "./heroes_bg/Sindragosa.png" },
      { name: "Тавиш Грозовая Вершина", popularity: "23.3%", averagePlace: "4.41", image: "./heroes_bg/Tavish Stormpike.png" },
      { name: "Смотритель", popularity: "19.4%", averagePlace: "4.41", image: "./heroes_bg/The Curator.png" },
      { name: "Серокрон", popularity: "31.5%", averagePlace: "4.41", image: "./heroes_bg/Greybough.png" },
      { name: "Бурекрыл", popularity: "26.7%", averagePlace: "4.41", image: "./heroes_bg/Galewing.png" },
      { name: "Джандис Барова", popularity: "20.8%", averagePlace: "4.42", image: "./heroes_bg/Jandice Barov.png" },
      { name: "Кок Пирожок", popularity: "24.0%", averagePlace: "4.42", image: "./heroes_bg/Cookie the Cook.png" },
      { name: "Гафф Рунический Тотем", popularity: "36.9%", averagePlace: "4.42", image: "./heroes_bg/Guff Runetotem.png" },
      { name: "Суперзлодей Рафаам", popularity: "24.5%", averagePlace: "4.42", image: "./heroes_bg/Arch-Villain Rafaam.png" },
    ],
  },
  {
    tier: "D",
    title: "D Тир",
    heroes: [
      { name: "Иллидан", popularity: "27.6%", averagePlace: "4.45", image: "./heroes_bg/Illidan Stormrage.png" },
      { name: "Ноздорму", popularity: "23.6%", averagePlace: "4.45", image: "./heroes_bg/Nozdormu.png" },
      { name: "Рено Джексон", popularity: "47.6%", averagePlace: "4.46", image: "./heroes_bg/Reno Jackson.png" },
      { name: "Страж леса Ому", popularity: "35.9%", averagePlace: "4.48", image: "./heroes_bg/Forest Warden Omu.png" },
      { name: "Вечная Токи", popularity: "40.1%", averagePlace: "4.48", image: "./heroes_bg/Infinite Toki.png" },
      { name: "Зирелла", popularity: "27.5%", averagePlace: "4.48", image: "./heroes_bg/Xyrella.png" },
      { name: "Керриган, Королева Клинков", popularity: "9.4%", averagePlace: "4.49", image: "./heroes_bg/Kerrigan, Queen of Blades.png" },
      { name: "Принц Галливикс", popularity: "44.1%", averagePlace: "4.49", image: "./heroes_bg/Trade Prince Gallywix.png" },
      { name: "Рагнарос", popularity: "13.9%", averagePlace: "4.50", image: "./heroes_bg/Ragnaros the Firelord.png" },
      { name: "Капитан Кривоклык", popularity: "17.0%", averagePlace: "4.50", image: "./heroes_bg/Captain Hooktusk.png" },
      { name: "Лич Баз'хиал", popularity: "19.4%", averagePlace: "4.51", image: "./heroes_bg/Lich Baz'hial.png" },
      { name: "Куртрус Ливень Пепла", popularity: "24.1%", averagePlace: "4.51", image: "./heroes_bg/Kurtrus Ashfallen.png" },
      { name: "Скаббс Маслорез", popularity: "31.1%", averagePlace: "4.51", image: "./heroes_bg/Scabbs Cutterbutter.png" },
      { name: "Зефрис Великий", popularity: "33.1%", averagePlace: "4.52", image: "./heroes_bg/Zephrys, the Great.png" },
      { name: "Змеиные глазки", popularity: "44.9%", averagePlace: "4.54", image: "./heroes_bg/Snake eyes.png" },
      { name: "Вестник смерти Черношип", popularity: "15.5%", averagePlace: "4.57", image: "./heroes_bg/Death Speaker Blackthorn.png" },
      { name: "Искательница Хроми", popularity: "26.0%", averagePlace: "4.58", image: "./heroes_bg/Time Twister Chromie.png" },
      { name: "Пирамидон", popularity: "13.7%", averagePlace: "4.59", image: "./heroes_bg/Pyramad.png" },
      { name: "Тесс Седогрив", popularity: "44.5%", averagePlace: "4.60", image: "./heroes_bg/Tess Greymane.png" },
      { name: "Профессор Мерзоцид", popularity: "15.6%", averagePlace: "4.64", image: "./heroes_bg/Professor Putricide.png" },
      { name: "Алекстраза", popularity: "21.6%", averagePlace: "4.67", image: "./heroes_bg/Alexstrasza.png" },
      { name: "Господин Часовщик", popularity: "67.4%", averagePlace: "4.71", image: "./heroes_bg/Mister Clocksworth.png" },
      { name: "Тей'телан Кровавый Взор", popularity: "9.6%", averagePlace: "4.75", image: "./heroes_bg/Tae'thelan Bloodwatcher.png" },
      { name: "Изера", popularity: "21.7%", averagePlace: "4.85", image: "./heroes_bg/Ysera.png" },
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
const bgsLibraryContainer = document.querySelector("#bgs-library");
const bgsLibraryStatus = document.querySelector("#bgs-library-status");
const bgsRaceFilters = document.querySelector("#bgs-race-filters");
const MAX_DOWNLOAD_SIZE_MB = 2;
const MAX_DOWNLOAD_SIZE_BYTES = MAX_DOWNLOAD_SIZE_MB * 1024 * 1024;
const raceLabels = {
  OVERVIEW: "Все карты",
  ALL: "Все типы",
  NONE: "Без типа",
  BEAST: "Звери",
  DEMON: "Демоны",
  DRAGON: "Драконы",
  ELEMENTAL: "Элементали",
  MECHANICAL: "Механизмы",
  MURLOC: "Мурлоки",
  NAGA: "Наги",
  PIRATE: "Пираты",
  QUILBOAR: "Свинобразы",
  UNDEAD: "Нежить",
};

let bgsLibraryData = null;
let activeRaceFilter = "OVERVIEW";

function buildStats() {
  const totalHeroes = tierData.reduce((sum, tier) => sum + tier.heroes.length, 0);
  const availableImages = tierData.reduce(
    (sum, tier) => sum + tier.heroes.filter((hero) => hero.image).length,
    0,
  );
  const missingImages = totalHeroes - availableImages;

  const chips = [
    `${totalHeroes} героев`,
    `${tierData.length} тиров`,
    `${availableImages} изображений`,
    missingImages === 0 ? "Все изображения загружены" : `${missingImages} без локального PNG`,
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
  averagePlace.textContent = `Среднее ${hero.averagePlace}`;
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
    placeholder.textContent = `${hero.name}\nPNG не найден`;
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
      button.textContent = "Собираю WebP...";
      try {
        await exportTierImage(tierInfo);
        button.textContent = "WebP скачан";
      } catch (error) {
        console.error(error);
        button.textContent = "Ошибка экспорта";
      }

      setTimeout(() => {
        button.disabled = false;
        button.textContent = "Скачать WebP";
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

function getCardRaces(card) {
  return card.races?.length ? card.races : ["NONE"];
}

function getRaceOptions(cards) {
  const races = new Set(["OVERVIEW"]);
  cards.forEach((card) => {
    getCardRaces(card).forEach((race) => races.add(race));
  });

  const ordered = ["OVERVIEW", "ALL", "BEAST", "DEMON", "DRAGON", "ELEMENTAL", "MECHANICAL", "MURLOC", "NAGA", "PIRATE", "QUILBOAR", "UNDEAD", "NONE"];
  return ordered.filter((race) => races.has(race));
}

function renderRaceFilters(cards) {
  const races = getRaceOptions(cards);
  bgsRaceFilters.innerHTML = "";

  races.forEach((race) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `race-filter${race === activeRaceFilter ? " is-active" : ""}`;
    button.textContent = raceLabels[race] || race;
    button.addEventListener("click", () => {
      activeRaceFilter = race;
      renderRaceFilters(cards);
      renderBgsLibrary(cards);
    });
    bgsRaceFilters.appendChild(button);
  });
}

function createLibraryCard(card) {
  const article = document.createElement("article");
  article.className = "library-card";

  const image = document.createElement("img");
  image.src = card.artUrl;
  image.alt = card.name;
  image.loading = "lazy";
  article.appendChild(image);

  const body = document.createElement("div");
  body.className = "library-card-body";

  const title = document.createElement("h4");
  title.className = "library-card-name";
  title.textContent = card.name;
  body.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "library-card-meta";
  meta.textContent = `${card.attack}/${card.health} • ${getCardRaces(card).map((race) => raceLabels[race] || race).join(", ")}`;
  body.appendChild(meta);

  if (card.text) {
    const text = document.createElement("p");
    text.className = "library-card-text";
    text.textContent = card.text;
    body.appendChild(text);
  }

  article.appendChild(body);
  return article;
}

function renderBgsLibrary(cards) {
  const filteredCards = activeRaceFilter === "OVERVIEW"
    ? cards
    : cards.filter((card) => getCardRaces(card).includes(activeRaceFilter));

  bgsLibraryContainer.innerHTML = "";

  if (filteredCards.length === 0) {
    bgsLibraryStatus.textContent = "Для этого типа существ карт не найдено.";
    return;
  }

  bgsLibraryStatus.textContent = `${filteredCards.length} карт • ${raceLabels[activeRaceFilter] || activeRaceFilter}`;

  for (let tavernLevel = 1; tavernLevel <= 7; tavernLevel += 1) {
    const levelCards = filteredCards.filter((card) => card.techLevel === tavernLevel);
    if (levelCards.length === 0) {
      continue;
    }

    const group = document.createElement("section");
    group.className = "tavern-group";

    const header = document.createElement("div");
    header.className = "tavern-group-header";

    const title = document.createElement("h3");
    title.className = "tavern-group-title";
    title.textContent = `Уровень таверны ${tavernLevel}`;
    header.appendChild(title);

    const count = document.createElement("div");
    count.className = "tavern-group-count";
    count.textContent = `${levelCards.length} карт`;
    header.appendChild(count);

    const grid = document.createElement("div");
    grid.className = "library-grid";
    levelCards.forEach((card) => grid.appendChild(createLibraryCard(card)));

    group.appendChild(header);
    group.appendChild(grid);
    bgsLibraryContainer.appendChild(group);
  }
}

async function loadBgsLibrary() {
  try {
    const response = await fetch("./bgs-library.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    bgsLibraryData = await response.json();
    renderRaceFilters(bgsLibraryData.cards);
    renderBgsLibrary(bgsLibraryData.cards);
  } catch (error) {
    console.error(error);
    bgsLibraryStatus.textContent = "Не удалось загрузить библиотеку карт HearthstoneJSON.";
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Не удалось создать blob из canvas."));
      }
    }, type, quality);
  });
}

async function compressForWordPress(canvas, fileBaseName) {
  const webpBlob = await canvasToBlob(canvas, "image/webp", 0.96);

  if (webpBlob.size <= MAX_DOWNLOAD_SIZE_BYTES) {
    return webpBlob;
  }

  if (!window.imageCompression) {
    return webpBlob;
  }

  const sourceFile = new File([webpBlob], `${fileBaseName}.webp`, { type: "image/webp" });
  const compressed = await window.imageCompression(sourceFile, {
    maxSizeMB: MAX_DOWNLOAD_SIZE_MB,
    fileType: "image/webp",
    initialQuality: 0.92,
    useWebWorker: true,
    alwaysKeepResolution: true,
    preserveExif: false,
  });

  if (compressed.size <= MAX_DOWNLOAD_SIZE_BYTES) {
    return compressed;
  }

  return window.imageCompression(sourceFile, {
    maxSizeMB: MAX_DOWNLOAD_SIZE_MB,
    fileType: "image/webp",
    initialQuality: 0.84,
    maxWidthOrHeight: Math.round(Math.max(canvas.width, canvas.height) / 3.5),
    useWebWorker: true,
    preserveExif: false,
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
  const imageRatio = 272 / 256;
  const cardWidth = 176;
  const imageHeight = Math.round(cardWidth * imageRatio);
  const footerHeight = 56;
  const cardHeight = imageHeight + footerHeight;
  const rows = Math.ceil(tierInfo.heroes.length / columns);
  const width = padding * 2 + columns * cardWidth + (columns - 1) * gap;
  const height = 178 + padding * 2 + rows * cardHeight + (rows - 1) * gap;
  const canvas = document.createElement("canvas");
  const scale = Math.max(3, Math.ceil(window.devicePixelRatio || 1));

  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const images = await Promise.all(
    tierInfo.heroes.map((hero) => (hero.image ? loadImage(hero.image) : Promise.resolve(null))),
  );

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
  ctx.font = "700 34px TierDisplay";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tierInfo.tier, padding + 66, padding + 38);

  ctx.textAlign = "left";
  ctx.fillStyle = "#f6f1df";
  ctx.font = "700 38px TierDisplay";
  ctx.fillText("Тир-лист Героев", padding + 160, padding + 42);

  ctx.fillStyle = "#b8c1d1";
  ctx.font = "600 18px TierDisplay";
  ctx.fillText(`${tierInfo.title} • ${tierInfo.heroes.length} героев • средний ранг ${calculateTierAverage(tierInfo.heroes)}`, padding + 160, padding + 78);

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
      ctx.drawImage(loadedImage, x, y, cardWidth, imageHeight);
    } else {
      const placeholderGradient = ctx.createLinearGradient(x, y, x, y + imageHeight);
      placeholderGradient.addColorStop(0, "rgba(244, 206, 100, 0.22)");
      placeholderGradient.addColorStop(1, "rgba(18, 30, 55, 0.92)");
      ctx.fillStyle = placeholderGradient;
      ctx.fillRect(x, y, cardWidth, imageHeight);
      ctx.fillStyle = "#fff0b5";
      ctx.font = "800 20px TierDisplay";
      ctx.textAlign = "center";
      wrapText(ctx, hero.name, x + cardWidth / 2, y + imageHeight / 2 - 16, cardWidth - 22, 24);
      ctx.font = "700 15px TierDisplay";
      ctx.fillStyle = "rgba(255, 246, 214, 0.8)";
      ctx.fillText("PNG не найден", x + cardWidth / 2, y + imageHeight - 24);
    }

    const fade = ctx.createLinearGradient(x, y + imageHeight * 0.48, x, y + imageHeight);
    fade.addColorStop(0, "rgba(4, 8, 15, 0)");
    fade.addColorStop(1, "rgba(4, 8, 15, 0.96)");
    ctx.fillStyle = fade;
    ctx.fillRect(x, y, cardWidth, imageHeight);
    ctx.restore();

    ctx.fillStyle = "rgba(3, 8, 15, 0.72)";
    roundedRect(ctx, x + 10, y + 10, 108, 28, 14);
    ctx.fill();
    ctx.fillStyle = "#fff6d6";
    ctx.font = "800 13px TierDisplay";
    ctx.textAlign = "left";
    ctx.fillText(`Среднее ${hero.averagePlace}`, x + 19, y + 28);

    ctx.fillStyle = "#f8f4ea";
    ctx.font = "800 16px TierDisplay";
    wrapText(ctx, hero.name, x + 14, y + cardHeight - 36, cardWidth - 28, 19, false);
  });

  const compressedBlob = await compressForWordPress(canvas, `${tierInfo.tier.toLowerCase()}-tier-heroes`);
  const objectUrl = URL.createObjectURL(compressedBlob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${tierInfo.tier.toLowerCase()}-tier-heroes.webp`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
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
loadBgsLibrary();
