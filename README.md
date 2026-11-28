# National Living Dex

A static, Pokémon HOME–inspired tracker for the full National Living Dex. It is a plain site for GitHub Pages: Bootstrap 5.3.9 and Nunito come from a CDN, and every sprite and Pokédex record is stored in this repository. Nothing calls PokéAPI, or any other sprite host, while you browse.

The address bar stays on the site URL. The last box, the selected Pokémon, and the Normal / Shiny mode are saved in `localStorage`. Older saves may still contain a status filter or a Switch game filter; those keys are ignored.

## What is in the dex

The catalog follows the original box-order reference. That reference does not publish a box list. `printDex.js` builds the cards from its dex database:

1. Standard National Dex, #0001–#1025, 30 Pokémon per box.
2. Alt Forms / Variants, in the reference's alt order: Alolan, Galarian, Hisuian, then Paldean forms (each region starts a new box), then gender-specific forms, then other forms, then Unown, Vivillon, and Alcremie. Sneasel adds Hisuian Male and Hisuian Female. Shiny, Mega, and Gigantamax are not slots.

`scripts/lib/box-order.mjs` is that packing. `scripts/sync-data.mjs` reads the snapshot at `data/sources/dexdb.js` and writes one row per card. `node scripts/check.mjs` rebuilds the layout from that snapshot and checks `data/dex.json` slot for slot. To refresh the snapshot, or to run `node scripts/check.mjs --live`, set `DEXDB_URL` or put the address in the gitignored file `data/sources/dexdb.url`.

Boxes are grouped the way Pokémon HOME groups them: Box Spaces of 30. Standards come first, then Alt Forms, with the Alt Forms block labelled on its own inside the Box Space picker. The current catalog is 1,025 standard Pokémon and 513 alt forms, 1,538 cards in 56 boxes and 2 Box Spaces.

Each row has its National Dex number, name, form label, types, Box / Row / Col / Slot, and the Nintendo Switch main-series games where that exact form is obtainable in-game (wild, permanent gift, or evolution). The games are Let's Go Pikachu, Let's Go Eevee, Sword, Shield, Brilliant Diamond, Shining Pearl, Legends: Arceus, Scarlet, Violet, and Legends: Z-A. Pokémon GO and pre-Switch games are omitted. A form with an empty game list is not currently catchable on Switch, and the detail panel says why. Version exclusives list one version. Walking Wake and Iron Leaves stay empty because their Tera Raid events are not active.

## Caught list

`data/collection.json` holds two lists of ids from `data/dex.json`:

- `"caught"` is the Normal Living Dex.
- `"shinyCaught"` is the Shiny Living Dex, kept in box/slot order.

Add an id when a Pokémon is caught, for example `"0001"` or `"0037-alola"`. Remove an id to mark it missing in that mode. Everything not listed is missing. A segmented Normal / Shiny control above the boxes switches which list the progress, sprites, and box labels use. Shiny boxes use Pokémon HOME's `S ` labels, such as `S 0001-0030` and `S Alt 1`. Caught and missing slots are told apart by colour in both modes.

## Run it

From the repository root, serve the folder with any static file server. Opening `index.html` as a file will not load the JSON modules.

Search by name or Dex number, then press Enter. A Dex number returns every form of that species (Alcremie included) and jumps to the one you pick. The grid jumps to that box, pulses the slot, and opens the detail panel: a side card on a wide screen, an offcanvas sheet on a phone.

The Box Space control and the search field share one row. From the `xl` breakpoint up, that row uses the same columns as the box and the detail card: Box Space over the box, search over the detail. Below that they stack, Box Space first. Uncaught slots use a darker desaturated sprite.

## Layout

- `data/dex.json` is every card. `data/boxes.json` is the box map. `data/games.json` is the ten Switch games. `data/collection.json` is the Normal and Shiny caught lists.
- `data/sources/dexdb.js` is the box-order snapshot the order check uses.
- `data/sprite-fallbacks.json` lists forms that have no dedicated HOME file in PokeAPI/sprites and which local sprite is used instead.
- `data/shiny-sprites.json` maps each sprite id to a local shiny HOME file, or to a recorded fallback.
- `js/model/` loads that data and owns slot math, Box Spaces, search, Living Dex mode, and sprite paths. Search text is indexed once when the catalog loads.
- `js/state/store.js` persists the box, the selected Pokémon, and the Normal / Shiny mode. It ignores leftover `filter` and `gameId` keys from older saves.
- `js/ui/box.js` is the Box Space bar, the box picker, and the 6×5 grid. Slot images use `loading="lazy"`.
- `assets/sprites/` holds the Pokémon HOME PNGs. Female differences that are not their own Pokémon id are stored as `<id>-f.png`. `assets/sprites/shiny/` holds the shiny HOME PNGs.

## Sprites and data

`scripts/sync-data.mjs` rebuilds the JSON and downloads any missing HOME PNG from the PokeAPI sprites repository:

`sprites/pokemon/other/home/<id>.png` and `sprites/pokemon/other/home/female/<id>.png`

`scripts/sync-shiny-sprites.mjs` downloads the matching shiny files from `sprites/pokemon/other/home/shiny/` (and `shiny/female/`). A form with no shiny HOME file falls back to the base species' shiny HOME sprite, then to the normal local sprite. Those choices are recorded in `data/shiny-sprites.json`. Re-running either script keeps the ids already listed in `data/collection.json`.

```bash
node scripts/sync-data.mjs
node scripts/sync-shiny-sprites.mjs
node scripts/check.mjs
```

Pass `--force` to replace files that are already on disk. Pass `--no-sprites` to `sync-data.mjs` to rewrite the JSON without downloading. The site never requests those URLs itself. With `DEXDB_URL` unset, sync keeps the committed box-order snapshot and still rebuilds the catalog from it. `node scripts/check.mjs --live` compares that snapshot with the original box-order reference only when the address is configured.

`node scripts/check.mjs` checks the box order, placement, search, the Switch-game cases, both caught lists, and that every normal and shiny sprite file exists and is a PNG.
