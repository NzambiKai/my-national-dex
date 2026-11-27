#!/usr/bin/env node
/**
 * Bundle Pokémon HOME shiny sprites from PokeAPI/sprites.
 *
 * Source files:
 *   sprites/pokemon/other/home/shiny/<id>.png
 *   sprites/pokemon/other/home/shiny/female/<id>.png
 *
 * Dedicated art is saved at assets/sprites/shiny/<spriteId>.png
 * (female differences keep the local `<id>-f` name). A form with no shiny
 * HOME file uses the base species' shiny HOME sprite when that file exists,
 * and otherwise the normal sprite already stored in assets/sprites/.
 * data/shiny-sprites.json records every decision. The site never requests
 * these URLs itself.
 *
 *   node scripts/sync-shiny-sprites.mjs
 *   node scripts/sync-shiny-sprites.mjs --force
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");
const shinyDir = join(root, "assets/sprites/shiny");
const shinyBase = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/shiny";

function spriteSort(a, b) {
  const female = (id) => (String(id).endsWith("-f") ? 1 : 0);
  const numeric = (id) => Number(String(id).replace(/-f$/, ""));
  return numeric(a) - numeric(b) || female(a) - female(b);
}

function parseSpriteId(spriteId) {
  const text = String(spriteId);
  if (!/^\d+(-f)?$/.test(text)) throw new Error(`Unexpected sprite id ${text}`);
  return text;
}

function dedicatedUrl(spriteId) {
  if (spriteId.endsWith("-f")) return `${shinyBase}/female/${spriteId.slice(0, -2)}.png`;
  return `${shinyBase}/${spriteId}.png`;
}

function relativeShiny(spriteId) {
  return `assets/sprites/shiny/${spriteId}.png`;
}

function relativeNormal(spriteId) {
  return `assets/sprites/${spriteId}.png`;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchPng(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "my-national-dex-sync" } });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 400 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
        throw new Error(`not a PNG (${bytes.length} bytes)`);
      }
      return bytes;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

async function mapPool(items, limit, task) {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
}

const dex = JSON.parse(await readFile(join(root, "data/dex.json"), "utf8"));
const speciesBySprite = new Map();
const entriesBySprite = new Map();
for (const entry of dex.entries) {
  const spriteId = parseSpriteId(entry.spriteId);
  const speciesId = String(entry.nationalDex);
  const known = speciesBySprite.get(spriteId);
  if (known && known !== speciesId) {
    throw new Error(`Sprite ${spriteId} is used by more than one species (${known}, ${speciesId})`);
  }
  speciesBySprite.set(spriteId, speciesId);
  const list = entriesBySprite.get(spriteId);
  if (list) list.push(entry.id);
  else entriesBySprite.set(spriteId, [entry.id]);
}

const spriteIds = [...speciesBySprite.keys()].sort(spriteSort);
await mkdir(shinyDir, { recursive: true });

const dedicated = new Map();
let finished = 0;
await mapPool(spriteIds, 12, async (spriteId) => {
  const destination = join(shinyDir, `${spriteId}.png`);
  if (!force && (await exists(destination))) {
    dedicated.set(spriteId, true);
  } else {
    const bytes = await fetchPng(dedicatedUrl(spriteId));
    if (bytes) {
      await writeFile(destination, bytes);
      dedicated.set(spriteId, true);
    } else {
      dedicated.set(spriteId, false);
    }
  }
  finished += 1;
  if (finished % 100 === 0 || finished === spriteIds.length) {
    process.stdout.write(`\r${finished}/${spriteIds.length} shiny sprites probed`);
  }
});
process.stdout.write("\n");

const bySpriteId = {};
const fallbacks = [];
const counts = { dedicated: 0, species: 0, normal: 0, total: spriteIds.length };

for (const spriteId of spriteIds) {
  const speciesId = speciesBySprite.get(spriteId);
  const entries = entriesBySprite.get(spriteId);
  if (dedicated.get(spriteId)) {
    bySpriteId[spriteId] = { kind: "dedicated", file: relativeShiny(spriteId) };
    counts.dedicated += 1;
    continue;
  }

  const speciesDiffers = speciesId !== spriteId;
  if (speciesDiffers && dedicated.get(speciesId)) {
    const note = `No dedicated shiny HOME sprite in PokeAPI/sprites; using the base species shiny HOME sprite (#${speciesId.padStart(4, "0")}).`;
    const record = {
      kind: "species",
      file: relativeShiny(speciesId),
      speciesSpriteId: speciesId,
      note,
    };
    bySpriteId[spriteId] = record;
    fallbacks.push({ spriteId, entries, ...record });
    counts.species += 1;
    continue;
  }

  const normalFile = relativeNormal(spriteId);
  if (!(await exists(join(root, normalFile)))) {
    throw new Error(`Missing normal sprite for fallback ${spriteId}`);
  }
  const note = "No shiny HOME sprite in PokeAPI/sprites; using the normal HOME sprite.";
  const record = { kind: "normal", file: normalFile, note };
  bySpriteId[spriteId] = record;
  fallbacks.push({ spriteId, entries, ...record });
  counts.normal += 1;
}

const manifest = {
  note: "Local Pokémon HOME shiny sprites from PokeAPI/sprites (sprites/pokemon/other/home/shiny and shiny/female). kind \"dedicated\" is that sprite's own shiny file under assets/sprites/shiny/. kind \"species\" reuses the base species' shiny HOME file. kind \"normal\" reuses the bundled normal HOME sprite because PokeAPI has no shiny HOME art for that form or its species. The site reads only these local paths.",
  source: "https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/other/home/shiny",
  counts,
  fallbacks,
  bySpriteId,
};

await writeFile(join(root, "data/shiny-sprites.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Shiny sprites: ${counts.dedicated} dedicated, ${counts.species} species fallbacks, ${counts.normal} normal fallbacks (${counts.total} sprite ids).`);
