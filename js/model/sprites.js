import { isShinyMode } from "./mode.js";

/**
 * Local Pokémon HOME sprite paths.
 *
 * Normal art is assets/sprites/<spriteId>.png.
 * Shiny art is resolved from data/shiny-sprites.json: a dedicated file under
 * assets/sprites/shiny/, the base species' shiny file, or the normal file
 * when PokeAPI/sprites has no shiny HOME art. The browser only requests
 * the path recorded there.
 */

export function normalSpriteFile(spriteId) {
  return `assets/sprites/${spriteId}.png`;
}

export function shinySpriteRecord(manifest, spriteId) {
  const record = manifest?.bySpriteId?.[String(spriteId)];
  if (record?.file) return record;
  return {
    kind: "normal",
    file: normalSpriteFile(spriteId),
    note: "No shiny sprite record; using the normal HOME sprite.",
  };
}

export function spriteFileFor(entry, mode = "normal") {
  if (isShinyMode(mode)) return entry.shinySpriteFile || normalSpriteFile(entry.spriteId);
  return normalSpriteFile(entry.spriteId);
}

export function spriteNoteFor(entry, mode = "normal") {
  if (isShinyMode(mode)) return entry.shinySpriteNote || null;
  return entry.spriteNote || null;
}
