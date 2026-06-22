# Manacost Battleground Public API

Base URL:

```text
https://bg.kolodahearthstone.ru/api/tier-lists
```

## Tier Lists

Use one endpoint for all public tier-list data.

```text
GET /api/tier-lists?list={list}&tier={tier}&source={source}
```

### Parameters

| Parameter | Values | Notes |
| --- | --- | --- |
| `list` | `heroes`, `minions`, `spells`, `trinkets`, `strategies`, `all` | Omit it to get the API catalog. |
| `tier` | `S`, `A`, `B`, `C`, `D` | Optional. If omitted, the response contains all tiers. |
| `source` | `firestone`, `hsreplay` | Used by `strategies`. Other lists use their default source. |

Aliases are supported:

- `accessories` -> `trinkets`
- `strategy`, `comp`, `comps` -> `strategies`
- `hero`, `minion`, `spell`, `trinket` -> plural list names
- `hs` -> `hsreplay`

### Examples

S-tier HSReplay strategies:

```text
https://bg.kolodahearthstone.ru/api/tier-lists?list=strategies&source=hsreplay&tier=S
```

All Firestone strategy tiers:

```text
https://bg.kolodahearthstone.ru/api/tier-lists?list=strategies&source=firestone
```

A-tier accessories/trinkets:

```text
https://bg.kolodahearthstone.ru/api/tier-lists?list=trinkets&tier=A
```

All default tier lists:

```text
https://bg.kolodahearthstone.ru/api/tier-lists?list=all
```

## Response Shape

With `tier`:

```json
{
  "list": "strategies",
  "label": "Тир-лист стратегий",
  "source": "hsreplay",
  "upstreamSource": "HSReplay comps через api.hs-manacost.ru + фреймы db.kolodahs.ru",
  "fetchedAt": "2026-06-22T10:44:00.000Z",
  "generatedAt": "2026-06-22T13:30:00.000Z",
  "tier": "S",
  "availableTiers": ["S", "A", "B", "C", "D"],
  "count": 3,
  "items": []
}
```

Without `tier`:

```json
{
  "list": "trinkets",
  "tier": null,
  "tierCounts": {
    "S": 7,
    "A": 76,
    "B": 40,
    "C": 46,
    "D": 58
  },
  "tiers": {
    "S": [],
    "A": [],
    "B": [],
    "C": [],
    "D": []
  }
}
```

## Images

The public response includes image URLs where available:

- `heroes`: `image`
- `minions`: `image`, `image256`
- `spells`: `image`, `image256`
- `trinkets`: `image`, `imageFallback`
- `strategies`: `cards[].frame`, `cards[].card`, `cards[].fallback`

Strategy card image fields:

- `frame`: frame image from `db.kolodahs.ru/uploads/framed`
- `card`: full card image from `db.kolodahs.ru/uploads/cards`
- `fallback`: upstream HearthstoneJSON art fallback

## Notes

- Strategy source can be switched with `source=firestone` or `source=hsreplay`.
- HSReplay strategies use only the HSReplay comps dataset.
- Minion and spell tier groups are derived the same way as the site UI: by metric quantiles.
- Hero, trinket, and strategy tier groups use upstream tier values.
