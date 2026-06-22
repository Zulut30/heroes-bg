# Manacost Battleground

Static Battlegrounds companion site for Manacost with live tier lists, builders, card libraries, and public JSON endpoints.

Live site: https://bg.kolodahearthstone.ru

## Screenshots

### Strategy Tier Export

![A-tier strategy export](docs/screenshots/strategy-tier-a.webp)

### Strategy Grid Preview

![Strategy grid preview](docs/screenshots/strategy-grid-preview.png)

## Pages

- Hero tier list: https://bg.kolodahearthstone.ru/tier-list.html
- Minion tier list: https://bg.kolodahearthstone.ru/minion-tiers.html
- Spell tier list: https://bg.kolodahearthstone.ru/spell-tiers.html
- Trinket tier list: https://bg.kolodahearthstone.ru/trinket-tiers.html
- Strategy tier list: https://bg.kolodahearthstone.ru/strategy-tiers.html
- Hero tier builder: https://bg.kolodahearthstone.ru/hero-tier-builder.html
- Strategy builder: https://bg.kolodahearthstone.ru/strategy-builder.html

## Public Tier List API

The API is public and served from the same domain:

```text
GET https://bg.kolodahearthstone.ru/api/tier-lists
GET https://bg.kolodahearthstone.ru/api/tier-lists?list=strategies&source=hsreplay&tier=S
GET https://bg.kolodahearthstone.ru/api/tier-lists?list=strategies&source=firestone&tier=A
GET https://bg.kolodahearthstone.ru/api/tier-lists?list=trinkets&tier=S
GET https://bg.kolodahearthstone.ru/api/tier-lists?list=minions&tier=S&background=wallpaper1
GET https://bg.kolodahearthstone.ru/tier-list.html?export=tier&tier=S&background=wallpaper2&format=png
```

Supported query params:

- `list`: `heroes`, `minions`, `spells`, `trinkets`, `strategies`, or `all`
- `tier`: `S`, `A`, `B`, `C`, or `D`
- `source`: `firestone` or `hsreplay` for strategy tier lists
- `background`: `transparent`, `wallpaper`, `wallpaper1`, `wallpaper2`, or `wallpaper3` for hero/minion image exports
- `format`: `png` or `webp` for page export links returned in `exports`

Strategy responses include image URLs for each card:

- `card`: full card image from `db.kolodahs.ru`
- `frame`: frame image from `db.kolodahs.ru`
- `fallback`: HearthstoneJSON fallback art

Full API notes are in [API.md](API.md).

## Strategy Exports

The strategy tier page can download tier images as PNG or WebP. The export layout supports either 3 or 4 strategy cards per row, with 3 per row as the default for taller, more readable images.

## Deployment

The production instance runs on the server as `heroes-bg.service` and serves through Nginx at `bg.kolodahearthstone.ru`.
