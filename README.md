# National Living Dex

A static, Pokémon HOME–inspired tracker for a National Living Dex. It is a plain site for GitHub Pages: Bootstrap 5.3.9 and Google Fonts come from a CDN, and every sprite and Pokédex record is stored in this repository. Nothing calls PokéAPI while you browse.

The address bar stays on the site URL. The last box, the selected Pokémon, the All / Caught / Missing filter, and the Switch game filter are saved in `localStorage`, so an iOS Safari bookmark reopens on a clean URL.

## Mockup scope

The data model already maps the full National Dex, #0001–#1025, as 35 standard boxes of 30 slots, plus a separate Alt Forms / Variants group. This first cut bundles real HOME sprites and catch data for four boxes so the interactions can be reviewed live:

| Box | Range | What it shows |
| --- | --- | --- |
| Box 1 | #0001–#0030 | Bulbasaur–Nidorina |
| Box 2 | #0031–#0060 | Nidoqueen–Poliwag |
| Box 34 | #0991–#1020 | Paldea, Iron Bundle–Gouging Fire |
| Alt Box 1 | — | Alolan, Galarian, Hisuian, and Paldean forms, plus Heat Rotom and female Meowstic and Indeedee |

Boxes are grouped the way Pokémon HOME groups them: Box Spaces of 30. Box Space 1/2 is boxes 1–30 (`0001 - 0900`). Box Space 2/2 is boxes 31–35 (`0901 - 1025`) plus Alt Forms, labelled `Alt 1` so the National Dex and the variant boxes stay distinct. Another Box Space opens on its own if more Alt Forms boxes are added. Empty ranges are reserved slots, not empty catches.

Caught and missing are a realistic mix in `data/collection.json`. Edit that file, or send a pull request, when a Pokémon joins the Living Dex. `id` is the key. `name`, `box`, and `slot` are there so the diff is readable.

## Run it

From the repository root:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/`. Opening `index.html` as a file will not load the JSON modules.

Search by name or Dex number, then press Enter. The grid jumps to that box, pulses the slot, and opens the detail panel (a side card on a wide screen, an offcanvas sheet on a phone). On a wide screen the panel opens on the first Pokémon in the current box, or on the last Pokémon you selected.

The All / Caught / Missing filter combines with a Nintendo Switch game filter. Pick Scarlet, for example, and the grid, the box counts, and the overall progress bar all narrow to Pokémon catchable in that game. Missing plus a game shows what is still uncaught and obtainable there.

The detail lists only Nintendo Switch main-series games: Let's Go Pikachu, Let's Go Eevee, Sword, Shield, Brilliant Diamond, Shining Pearl, Legends: Arceus, Scarlet, Violet, and Legends: Z-A. Version exclusives list one version. Walking Wake and Iron Leaves have no pills, because they are limited Tera Raid events and none is active. Uncaught slots use a darker desaturated sprite on a slate tile so pale Pokémon stay readable.

## Layout

- `data/` is the schema: games, the full box map, the bundled dex, and the caught file.
- `js/model/` loads that data and owns slot math and search.
- `js/model/spaces.js` groups boxes into Pokémon HOME Box Spaces of 30.
- `js/state/store.js` persists the box, the selected Pokémon, the status filter, and the game filter.
- `js/ui/box.js` is the Box Space bar, the box picker, and the 6×5 grid.
- `js/ui/detail.js` is the Pokémon panel and the Switch-game list.
- `assets/sprites/` holds Pokémon HOME PNGs named by PokéAPI sprite id.

## Sprites

`scripts/sync-data.mjs` reads `data/dex.json` and downloads any missing file from the PokeAPI sprites repository:

`sprites/pokemon/other/home/<spriteId>.png`

```bash
node scripts/sync-data.mjs
```

Pass `--force` to replace files that are already on disk. Add a row to `data/dex.json` and `data/collection.json`, then run the script, when a new box is filled in.

`node scripts/check.mjs` checks placement, search, a few Switch-game expectations, and that every sprite file exists.
