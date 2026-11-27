import { locationText, slotPosition } from "./location.js";

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status})`);
  }
  return response.json();
}

export async function loadCatalog() {
  const [dex, boxFile, gameFile, collection] = await Promise.all([
    fetchJson("./data/dex.json"),
    fetchJson("./data/boxes.json"),
    fetchJson("./data/games.json"),
    fetchJson("./data/collection.json"),
  ]);

  const games = gameFile.games;
  const gameById = new Map(games.map((game) => [game.id, game]));
  const caughtById = new Map(collection.entries.map((entry) => [entry.id, entry.caught === true]));
  const boxById = new Map(boxFile.boxes.map((box) => [box.id, box]));

  const entries = dex.entries.map((entry) => {
    const box = boxById.get(entry.boxId);
    if (!box) {
      throw new Error(`Entry ${entry.id} points at unknown box ${entry.boxId}`);
    }
    return {
      ...entry,
      caught: caughtById.get(entry.id) === true,
      box,
      position: slotPosition(entry.slot),
      locationText: locationText(box, entry.slot),
      gamesResolved: entry.games.map((id) => gameById.get(id)).filter(Boolean),
    };
  });

  return {
    entries,
    boxes: boxFile.boxes,
    groups: boxFile.groups,
    games,
    columns: boxFile.columns,
    slotsPerBox: boxFile.slotsPerBox,
  };
}

export function entriesInBox(entries, boxId) {
  return entries.filter((entry) => entry.boxId === boxId).sort((a, b) => a.slot - b.slot);
}

export function boxProgress(entries, boxId) {
  const list = entriesInBox(entries, boxId);
  if (list.length === 0) return null;
  const caught = list.filter((entry) => entry.caught).length;
  return { caught, total: list.length };
}
