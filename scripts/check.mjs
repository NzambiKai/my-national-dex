/**
 * Verify the Living Dex against the original box-order reference.
 *
 * That reference loads a dex database and printDex.js. printDex.js does not
 * ship a box list. It appends cards in this order, 30 per box:
 *   1. writeDex('nat') — National Dex #0001–#1025.
 *   2. writeDex('alt') — Alolan, Galarian, Hisuian, then Paldean forms.
 *      Each region starts a new box.
 *   3. Gender-specific forms (Sneasel adds Hisuian Male and Hisuian Female).
 *   4. Other alt forms, skipping Unown, Vivillon, and Alcremie.
 *   5. Unown, Vivillon, then Alcremie (flavors × toppings).
 * Shiny, Mega, and Gigantamax flags are not slots.
 *
 * scripts/lib/box-order.mjs is that packing. This script rebuilds it from
 * data/sources/dexdb.js (the snapshot scripts/sync-data.mjs saved) and checks
 * data/dex.json slot for slot. Pass --live to also download the current
 * database when DEXDB_URL or data/sources/dexdb.url is set, and require the
 * snapshot to still match.
 */

import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEXDB_SNAPSHOT, readDexdbUrl } from "./lib/dexdb-source.mjs";
import { entryId } from "./lib/entry-id.mjs";
import { loadDexData } from "./lib/load-dex.mjs";
import { flattenLayout, layoutFromDexData } from "./lib/box-order.mjs";
import { matchesView } from "../js/model/catalog.js";
import { locationText, slotPosition, standardPlacement } from "../js/model/location.js";
import { searchEntries } from "../js/model/search.js";
import { buildBoxSpaces, spaceIndexForBox } from "../js/model/spaces.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const live = process.argv.includes("--live");
const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));

const failures = [];
function expect(condition, message) {
  if (!condition) failures.push(message);
}

const dex = await readJson("data/dex.json");
const boxes = await readJson("data/boxes.json");
const games = await readJson("data/games.json");
const collection = await readJson("data/collection.json");
const snapshot = await readFile(join(root, DEXDB_SNAPSHOT), "utf8");
const expected = flattenLayout(layoutFromDexData(loadDexData(snapshot)));

expect(expected.length === dex.entries.length, `catalog has ${dex.entries.length} rows, box-order layout has ${expected.length}`);
expected.forEach((slot, index) => {
  const entry = dex.entries[index];
  if (!entry) return;
  const id = entryId(slot);
  expect(entry.id === id && entry.boxId === slot.boxId && entry.slot === slot.slot && entry.nationalDex === slot.nationalDex, `${id} drifted at index ${index}: got ${entry?.id} ${entry?.boxId} slot ${entry?.slot}`);
});

const standard = dex.entries.filter((entry) => entry.kind === "standard");
const alt = dex.entries.filter((entry) => entry.kind !== "standard");
const standardBoxes = boxes.boxes.filter((box) => box.group === "standard");
const altBoxes = boxes.boxes.filter((box) => box.group === "alt");
expect(standard.length === 1025, `expected 1025 standard Pokémon, got ${standard.length}`);
expect(alt.length === 513, `expected 513 Alt Forms / Variants, got ${alt.length}`);
expect(standardBoxes.length === 35 && altBoxes.length === 21 && boxes.boxes.length === 56, `expected 35 standard + 21 alt boxes, got ${standardBoxes.length}+${altBoxes.length}`);
expect(boxes.boxes.every((box) => box.catalogued), "every box should be catalogued");
expect(altBoxes[0]?.title === "Alolan Forms" && altBoxes.at(-1)?.title === "Alcremie Forms", "alt section order drifted");

const spaces = buildBoxSpaces(boxes.boxes);
expect(spaces.length === 2, `expected 2 Box Spaces, got ${spaces.length}`);
expect(spaces[0].label === "0001 - 0900" && spaces[0].boxes.length === 30, `space 1 drifted: ${spaces[0].label}`);
expect(spaces[1].label === "0901 - 1025 · Alt 1–21" && spaces[1].boxes.length === 26, `space 2 drifted: ${spaces[1].label}`);
expect(spaces[1].boxes.filter((box) => box.group === "standard").length === 5, "space 2 should keep the last standard boxes ahead of Alt Forms");
expect(spaces[1].boxes.filter((box) => box.group === "alt").length === 21, "space 2 should include every Alt Forms box");
expect(spaceIndexForBox(spaces, "standard-01") === 0 && spaceIndexForBox(spaces, "alt-01") === 1, "box space lookup drifted");

const boxById = new Map(boxes.boxes.map((box) => [box.id, box]));
const gameIds = new Set(games.games.map((game) => game.id));
const seenSlots = new Set();
const seenIds = new Set();
for (const entry of dex.entries) {
  expect(!seenIds.has(entry.id), `duplicate id ${entry.id}`);
  seenIds.add(entry.id);
  const key = `${entry.boxId}:${entry.slot}`;
  expect(!seenSlots.has(key), `duplicate slot ${key}`);
  seenSlots.add(key);
  const position = slotPosition(entry.slot);
  expect(entry.row === position.row && entry.column === position.column, `${entry.id} row/col drifted`);
  expect(entry.games.every((id) => gameIds.has(id)), `${entry.id} has an unknown game`);
  expect(entry.types.length > 0, `${entry.id} has no types`);
  if (entry.games.length === 0) expect(entry.availabilityNote, `${entry.id} is uncatchable without a note`);
  if (entry.kind === "standard") {
    const place = standardPlacement(entry.nationalDex);
    const box = boxById.get(entry.boxId);
    expect(place.boxNumber === box?.number && place.slot === entry.slot, `${entry.id} placement drifted`);
  }
}

expect(Array.isArray(collection.caught), "collection.caught should be an array of ids");
const caught = new Set();
for (const id of collection.caught ?? []) {
  expect(seenIds.has(id), `caught id ${id} is not in the dex`);
  expect(!caught.has(id), `caught id ${id} is listed twice`);
  caught.add(id);
}

expect(locationText({ group: "standard", number: 1 }, 4) === "Box 1 · Row 1, Col 4 (Slot 4)", "location text");
expect(standardPlacement(1025).boxNumber === 35 && standardPlacement(1025).slot === 5, "final box");

const prepared = dex.entries.map((entry) => ({
  ...entry,
  box: boxById.get(entry.boxId),
  locationText: locationText(boxById.get(entry.boxId), entry.slot),
}));
expect(searchEntries(prepared, "charizard")[0]?.id === "0006", "search charizard");
expect(searchEntries(prepared, "0006")[0]?.id === "0006", "search 0006");
expect(searchEntries(prepared, "6")[0]?.id === "0006", "search 6");
expect(searchEntries(prepared, "alolan vulpix")[0]?.id === "0037-alola", "alolan vulpix search");
expect(searchEntries(prepared, "19").some((entry) => entry.id === "0019"), "dex 19 includes Rattata");
expect(searchEntries(prepared, "19").some((entry) => entry.id === "0019-alola"), "dex 19 includes Alolan Rattata");
expect(searchEntries(prepared, "869").filter((entry) => entry.nationalDex === 869).length > 60, "dex 869 should return Alcremie forms");
expect(searchEntries(prepared, "walking wake")[0]?.id === "1009", "walking wake search");
expect(searchEntries(prepared, "blaze")[0]?.id === "0128-paldea-blaze", "blaze breed search");
expect(searchEntries(prepared, "nidoran female")[0]?.id === "0029", "nidoran female search");

const byId = new Map(dex.entries.map((entry) => [entry.id, entry]));
expect(byId.get("0058").games.includes("la") === false, "Kantonian Growlithe is not in Legends: Arceus");
expect(byId.get("0058").games.includes("lgp") && !byId.get("0058").games.includes("lge"), "Growlithe Let's Go split");
expect(byId.get("0037").games.includes("lge") && !byId.get("0037").games.includes("lgp"), "Vulpix Let's Go split");
expect(byId.get("0037").games.includes("sp") && !byId.get("0037").games.includes("bd"), "Vulpix Brilliant Diamond split");
expect(byId.get("1007").games.join() === "s", "Koraidon is Scarlet only");
expect(byId.get("1008").games.join() === "v", "Miraidon is Violet only");
expect(byId.get("1009").games.length === 0 && byId.get("1009").availabilityNote, "Walking Wake is not currently catchable");
expect(byId.get("1010").games.length === 0, "Iron Leaves is not currently catchable");
expect(byId.get("0037-alola").games.includes("la"), "Alolan Vulpix is obtainable in Hisui");
expect(byId.get("0077-galar").games.join() === "sh", "Galarian Ponyta is Shield only");

const sample = byId.get("0006");
expect(matchesView(sample, { filter: "all", gameId: "s" }) === sample.games.includes("s"), "game filter should follow Scarlet");
expect(matchesView({ caught: false, games: ["s"] }, { filter: "missing", gameId: "s" }), "missing + game keeps catchable gaps");
expect(!matchesView({ caught: true, games: ["s"] }, { filter: "missing", gameId: "s" }), "missing + game hides caught");
expect(!matchesView({ caught: false, games: [] }, { filter: "missing", gameId: "s" }), "missing + game hides Pokémon that are not in that game");
const box1 = dex.entries.filter((entry) => entry.boxId === "standard-01");
expect(box1.filter((entry) => matchesView(entry, { filter: "all", gameId: "bd" })).every((entry) => entry.games.includes("bd")), "box filter stays inside the selected game");

let missingSprites = 0;
let badSprites = 0;
for (const entry of dex.entries) {
  const path = join(root, "assets/sprites", `${entry.spriteId}.png`);
  try {
    await access(path);
    const handle = await readFile(path);
    if (handle.length < 400 || handle[0] !== 0x89 || handle[1] !== 0x50) badSprites += 1;
  } catch {
    missingSprites += 1;
  }
}
expect(missingSprites === 0, `${missingSprites} HOME sprites are missing`);
expect(badSprites === 0, `${badSprites} sprite files are not PNGs`);

if (live) {
  const url = await readDexdbUrl(root);
  expect(url, "DEXDB_URL is not set. Offline check used the committed snapshot. Set DEXDB_URL, or write the address in data/sources/dexdb.url, to compare it with the original box-order reference.");
  if (url) {
    const response = await fetch(url);
    expect(response.ok, `live dex database returned ${response.status}`);
    if (response.ok) {
      const body = await response.text();
      const liveSlots = flattenLayout(layoutFromDexData(loadDexData(body)));
      const same = liveSlots.length === expected.length && liveSlots.every((slot, index) => entryId(slot) === entryId(expected[index]) && slot.boxId === expected[index].boxId && slot.slot === expected[index].slot);
      expect(same, "live box-order reference differs from data/sources/dexdb.js — re-run node scripts/sync-data.mjs");
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

const fallbacks = dex.entries.filter((entry) => entry.spriteNote).length;
console.log(`Catalog ok: ${dex.entries.length} Pokémon (${standard.length} standard, ${alt.length} alt), ${boxes.boxes.length} boxes, ${spaces.length} Box Spaces, ${fallbacks} sprite fallbacks${live ? ", live box order matches" : ""}.`);
