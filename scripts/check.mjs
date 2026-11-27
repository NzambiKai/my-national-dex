import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { locationText, standardPlacement } from "../js/model/location.js";
import { buildBoxSpaces, spaceIndexForBox } from "../js/model/spaces.js";
import { matchesView } from "../js/model/catalog.js";
import { searchEntries } from "../js/model/search.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));

const failures = [];
function expect(condition, message) {
  if (!condition) failures.push(message);
}

const dex = await readJson("data/dex.json");
const boxes = await readJson("data/boxes.json");
const games = await readJson("data/games.json");
const collection = await readJson("data/collection.json");

const boxById = new Map(boxes.boxes.map((box) => [box.id, box]));
const gameIds = new Set(games.games.map((game) => game.id));
const caughtById = new Map(collection.entries.map((entry) => [entry.id, entry.caught]));

const spaces = buildBoxSpaces(boxes.boxes);
expect(spaces.length === 2, `expected 2 Box Spaces, got ${spaces.length}`);
expect(spaces[0].boxes.length === 30 && spaces[0].label === "0001 - 0900", `space 1 drifted: ${spaces[0].label}`);
expect(spaces[0].boxes[0].id === "standard-01" && spaces[0].boxes.at(-1).id === "standard-30", "space 1 should be boxes 1–30");
expect(
  spaces[1].boxes.map((box) => box.id).join() === "standard-31,standard-32,standard-33,standard-34,standard-35,alt-01",
  `space 2 drifted: ${spaces[1].boxes.map((box) => box.id).join()}`,
);
expect(spaces[1].label === "0901 - 1025 · Alt 1", `space 2 label drifted: ${spaces[1].label}`);
expect(spaceIndexForBox(spaces, "standard-01") === 0 && spaceIndexForBox(spaces, "alt-01") === 1, "box space lookup drifted");
const extraAlt = [
  ...boxes.boxes,
  ...Array.from({ length: 30 }, (_, index) => ({
    id: `alt-extra-${index + 2}`,
    group: "alt",
    number: index + 2,
    dexStart: null,
    dexEnd: null,
  })),
];
const grown = buildBoxSpaces(extraAlt);
expect(grown.length === 3, "more Alt Forms boxes should open another Box Space");
expect(grown[1].boxes.filter((box) => box.group === "alt").length === 25, "space 2 should fill the remaining slots with Alt Forms");
expect(grown[2].boxes.length === 6 && grown[2].boxes.every((box) => box.group === "alt"), "overflow Alt Forms should start the next Box Space");

const sample = dex.entries.find((entry) => entry.id === "0006");
expect(matchesView(sample, { filter: "all", gameId: "s" }) === sample.games.includes("s"), "game filter should follow Scarlet");
expect(matchesView({ caught: false, games: ["s"] }, { filter: "missing", gameId: "s" }), "missing + game keeps catchable gaps");
expect(!matchesView({ caught: true, games: ["s"] }, { filter: "missing", gameId: "s" }), "missing + game hides caught");
expect(!matchesView({ caught: false, games: [] }, { filter: "missing", gameId: "s" }), "missing + game hides Pokémon that are not in that game");

expect(boxes.boxes.filter((box) => box.group === "standard").length === 35, "expected 35 standard boxes");
expect(boxes.boxes.filter((box) => box.catalogued).map((box) => box.id).join() === "standard-01,standard-02,standard-34,alt-01", "unexpected catalogued boxes");

const slotKeys = new Set();
for (const entry of dex.entries) {
  const box = boxById.get(entry.boxId);
  expect(box, `missing box ${entry.boxId}`);
  expect(gameIds.size > 0 && entry.games.every((id) => gameIds.has(id)), `${entry.id} has an unknown game`);
  expect(caughtById.has(entry.id), `collection missing ${entry.id}`);
  const key = `${entry.boxId}:${entry.slot}`;
  expect(!slotKeys.has(key), `duplicate slot ${key}`);
  slotKeys.add(key);
  if (entry.kind === "standard") {
    const place = standardPlacement(entry.nationalDex);
    expect(place.boxNumber === box.number && place.slot === entry.slot, `${entry.id} placement drifted`);
  }
}

expect(dex.entries.length === collection.entries.length, "collection and dex sizes differ");
expect(locationText({ group: "standard", number: 1 }, 4) === "Box 1 · Row 1, Col 4 (Slot 4)", "location text");
expect(standardPlacement(6).row === 1 && standardPlacement(6).column === 6, "charizard slot");
expect(standardPlacement(991).boxNumber === 34 && standardPlacement(991).slot === 1, "box 34 start");
expect(standardPlacement(1020).slot === 30 && standardPlacement(1020).row === 5, "box 34 end");
expect(standardPlacement(1025).boxNumber === 35 && standardPlacement(1025).slot === 5, "final box");

const prepared = dex.entries.map((entry) => ({
  ...entry,
  box: boxById.get(entry.boxId),
  locationText: locationText(boxById.get(entry.boxId), entry.slot),
}));

const charizard = searchEntries(prepared, "charizard")[0];
expect(charizard?.id === "0006", "search charizard");
expect(searchEntries(prepared, "0006")[0]?.id === "0006", "search 0006");
expect(searchEntries(prepared, "6")[0]?.id === "0006", "search 6");
const vulpix = searchEntries(prepared, "alolan vulpix");
expect(vulpix[0]?.id === "0037-alola", `alolan vulpix search got ${vulpix[0]?.id}`);
expect(searchEntries(prepared, "19").some((entry) => entry.id === "0019"), "dex 19 includes Rattata");
expect(searchEntries(prepared, "19").some((entry) => entry.id === "0019-alola"), "dex 19 includes Alolan Rattata");
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

const box1 = collection.entries.filter((entry) => entry.box === "Box 1");
expect(box1.length === 30, "box 1 collection size");
expect(box1.filter((entry) => entry.caught).length === 24, "box 1 caught count");

let missingSprites = 0;
for (const entry of dex.entries) {
  try {
    await access(join(root, "assets/sprites", `${entry.spriteId}.png`));
  } catch {
    missingSprites += 1;
  }
}
expect(missingSprites === 0, `${missingSprites} HOME sprites are missing`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Catalog ok: ${dex.entries.length} Pokémon, ${boxes.boxes.length} boxes, sprites present.`);
