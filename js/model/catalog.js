import { locationText, slotPosition } from "./location.js";
import { isShinyMode } from "./mode.js";
import { normalizeQuery } from "./search.js";
import { shinySpriteRecord } from "./sprites.js";
import { buildBoxSpaces } from "./spaces.js";

const boxIndex = new WeakMap();

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status})`);
  }
  return response.json();
}

function caughtIdsFrom(collection) {
  if (Array.isArray(collection?.caught)) return new Set(collection.caught);
  return new Set(
    (collection?.entries ?? []).filter((entry) => entry.caught === true).map((entry) => entry.id),
  );
}

export async function loadCatalog() {
  const [dex, boxFile, gameFile, collection, shinySprites] = await Promise.all([
    fetchJson("./data/dex.json"),
    fetchJson("./data/boxes.json"),
    fetchJson("./data/games.json"),
    fetchJson("./data/collection.json"),
    fetchJson("./data/shiny-sprites.json"),
  ]);

  const games = gameFile.games;
  const gameById = new Map(games.map((game) => [game.id, game]));
  const caughtIds = caughtIdsFrom(collection);
  const shinyCaughtIds = new Set(Array.isArray(collection.shinyCaught) ? collection.shinyCaught : []);
  const boxById = new Map(boxFile.boxes.map((box) => [box.id, box]));

  const entries = dex.entries.map((entry) => {
    const box = boxById.get(entry.boxId);
    if (!box) {
      throw new Error(`Entry ${entry.id} points at unknown box ${entry.boxId}`);
    }
    const shinySprite = shinySpriteRecord(shinySprites, entry.spriteId);
    return {
      ...entry,
      caught: caughtIds.has(entry.id),
      shinyCaught: shinyCaughtIds.has(entry.id),
      shinySpriteFile: shinySprite.file,
      shinySpriteNote: shinySprite.note ?? null,
      box,
      position: slotPosition(entry.slot),
      locationText: locationText(box, entry.slot),
      gamesResolved: entry.games.map((id) => gameById.get(id)).filter(Boolean),
      searchText: normalizeQuery(
        [entry.title, entry.name, entry.formName, entry.formDetail, ...(entry.aliases ?? []), String(entry.nationalDex), String(entry.nationalDex).padStart(4, "0")]
          .filter(Boolean)
          .join(" "),
      ),
    };
  });

  const byBox = new Map();
  for (const entry of entries) {
    const list = byBox.get(entry.boxId);
    if (list) list.push(entry);
    else byBox.set(entry.boxId, [entry]);
  }
  boxIndex.set(entries, byBox);

  return {
    entries,
    boxes: boxFile.boxes,
    groups: boxFile.groups,
    spaces: buildBoxSpaces(boxFile.boxes),
    columns: boxFile.columns,
    slotsPerBox: boxFile.slotsPerBox,
  };
}

export function caughtIn(entry, mode = "normal") {
  return isShinyMode(mode) ? entry.shinyCaught === true : entry.caught === true;
}

export function entriesInBox(entries, boxId) {
  const indexed = boxIndex.get(entries)?.get(boxId);
  if (indexed) return indexed;
  return entries.filter((entry) => entry.boxId === boxId).sort((a, b) => a.slot - b.slot);
}

export function boxProgress(entries, boxId, mode = "normal") {
  const list = entriesInBox(entries, boxId);
  if (list.length === 0) return null;
  const caught = list.filter((entry) => caughtIn(entry, mode)).length;
  return { caught, total: list.length };
}
