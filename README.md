# National Living Dex

A static, Pokémon HOME–inspired tracker for the full National Living Dex. It is a plain site for GitHub Pages: Bootstrap 5.3.9 and Nunito come from a CDN, and every sprite and Pokédex record is stored in this repository. Nothing calls PokéAPI, or any other sprite host, while you browse.

The address bar stays on the site URL. The last box, the selected Pokémon, the All / Caught / Missing filter, and the Switch game filter are saved in `localStorage`.

## What is in the dex

The catalog follows the box order at [pokedexapp.net/pokedex](https://pokedexapp.net/pokedex/). That page does not publish a box list. `printDex.js` builds the cards from `js/dexDB.json`:

1. Standard National Dex, #0001–#1025, 30 Pokémon per box.
2. Alt Forms / Variants, in the site's alt order: Alolan, Galarian, Hisuian, then Paldean forms (each region starts a new box), then gender-specific forms, then other forms, then Unown, Vivillon, and Alcremie. Sneasel adds Hisuian Male and Hisuian Female. Shiny, Mega, and Gigantamax are not slots.

`scripts/lib/pokedexapp-order.mjs` is that packing. `scripts/sync-data.mjs` downloads the live `dexDB.json`, saves it at `data/sources/pokedexapp-dexdb.js`, and writes one row per card. `node scripts/check.mjs --live` rebuilds the layout from the snapshot and from the live file and requires them to match, slot for slot.

Boxes are grouped the way Pokémon HOME groups them: Box Spaces of 30. Standards come first, then Alt Forms, with the Alt Forms block labelled on its own inside the Box Space picker. The current catalog is 1,025 standard Pokémon and 513 alt forms, 1,538 cards in 56 boxes and 2 Box Spaces.

Each row has its National Dex number, name, form label, types, Box / Row / Col / Slot, and the Nintendo Switch main-series games where that exact form is obtainable in-game (wild, permanent gift, or evolution). The games are Let's Go Pikachu, Let's Go Eevee, Sword, Shield, Brilliant Diamond, Shining Pearl, Legends: Arceus, Scarlet, Violet, and Legends: Z-A. Pokémon GO and pre-Switch games are omitted. A form with an empty game list is not currently catchable on Switch, and the detail panel says why. Version exclusives list one version. Walking Wake and Iron Leaves stay empty because their Tera Raid events are not active.

## Caught list

`data/collection.json` starts empty:

```json
{
  "caught": []
}
```

Add an id from `data/dex.json` when a Pokémon is caught, for example `"0001"` or `"0037-alola"`. Remove an id to mark it missing. Everything not listed is missing.

## Run it

From the repository root:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/`. Opening `index.html` as a file will not load the JSON modules.

Search by name or Dex number, then press Enter. A Dex number returns every form of that species (Alcremie included) and jumps to the one you pick. The grid jumps to that box, pulses the slot, and opens the detail panel: a side card on a wide screen, an offcanvas sheet on a phone.

The All / Caught / Missing filter combines with a Nintendo Switch game filter. Missing plus a game shows what is still uncaught and obtainable there. Uncaught slots use a darker desaturated sprite.

## Layout

- `data/dex.json` is every card. `data/boxes.json` is the box map. `data/games.json` is the ten Switch games. `data/collection.json` is the caught list.
- `data/sources/pokedexapp-dexdb.js` is the pokedexapp snapshot the order check uses.
- `data/sprite-fallbacks.json` lists forms that have no dedicated HOME file in PokeAPI/sprites and which local sprite is used instead.
- `js/model/` loads that data and owns slot math, Box Spaces, and search. Search text is indexed once when the catalog loads.
- `js/state/store.js` persists the box, the selected Pokémon, the status filter, and the game filter.
- `js/ui/box.js` is the Box Space bar, the box picker, and the 6×5 grid. Slot images use `loading="lazy"`.
- `assets/sprites/` holds the Pokémon HOME PNGs. Female differences that are not their own Pokémon id are stored as `<id>-f.png`.

## Sprites and data

`scripts/sync-data.mjs` rebuilds the JSON and downloads any missing HOME PNG from the PokeAPI sprites repository:

`sprites/pokemon/other/home/<id>.png` and `sprites/pokemon/other/home/female/<id>.png`

```bash
node scripts/sync-data.mjs
node scripts/check.mjs --live
```

Pass `--force` to replace files that are already on disk. Pass `--no-sprites` to rewrite the JSON without downloading. The site never requests those URLs itself.

`node scripts/check.mjs` checks the pokedexapp order, placement, search, the Switch-game cases, collection ids, and that every sprite file exists and is a PNG.
