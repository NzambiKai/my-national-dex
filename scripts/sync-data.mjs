#!/usr/bin/env node
/**
 * Build the National Living Dex from the original box-order reference and bundle HOME sprites.
 *
 * Order: the committed snapshot at data/sources/dexdb.js, fed through
 * scripts/lib/box-order.mjs, which follows printDex.js
 * (writeDex nat, then alt). Set DEXDB_URL, or write the address in the
 * gitignored file data/sources/dexdb.url, to refresh that snapshot.
 * scripts/check.mjs rebuilds the layout from the snapshot and can compare
 * it with the live file when that address is set.
 *
 * Sprites: https://github.com/PokeAPI/sprites sprites/pokemon/other/home
 * Downloads happen here, at build time. The site only reads assets/sprites.
 *
 *   node scripts/sync-data.mjs
 *   node scripts/sync-data.mjs --no-sprites
 *   node scripts/sync-data.mjs --force
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./lib/csv.mjs";
import { entryId } from "./lib/entry-id.mjs";
import { assignGames } from "./lib/games.mjs";
import { DEXDB_SNAPSHOT, readDexdbUrl } from "./lib/dexdb-source.mjs";
import { loadDexData } from "./lib/load-dex.mjs";
import { flattenLayout, layoutFromDexData } from "./lib/box-order.mjs";
import { resolveSprite } from "./lib/sprites.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");
const skipSprites = process.argv.includes("--no-sprites");
const cacheDir = join(root, "data/sources/cache");
const spriteDir = join(root, "assets/sprites");
const spriteBase = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home";

const REGIONS = [
  [1, 151, "Kanto"],
  [152, 251, "Johto"],
  [252, 386, "Hoenn"],
  [387, 493, "Sinnoh"],
  [494, 649, "Unova"],
  [650, 721, "Kalos"],
  [722, 809, "Alola"],
  [810, 898, "Galar"],
  [899, 905, "Hisui"],
  [906, 1025, "Paldea"],
];

const POKEDEX = {
  lg: [26],
  swsh: [27, 28, 29],
  hisui: [30],
  sv: [31, 32, 33],
};

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "my-national-dex-sync", accept: "text/html,application/json,text/plain,*/*" },
  });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.text();
}

async function cached(name, url) {
  const path = join(cacheDir, name);
  if (!force && (await exists(path))) return readFile(path, "utf8");
  const text = await fetchText(url);
  await writeFile(path, text);
  return text;
}

function stripTags(value) {
  return String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&eacute;/gi, "é")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function rowsOf(html) {
  const rows = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function spriteMap(html) {
  const map = new Map();
  for (const match of html.matchAll(/\/small\/(\d{3,4})(-[a-z0-9]+)?\.png/g)) {
    const dex = Number(match[1]);
    if (dex < 1 || dex > 1025) continue;
    const set = map.get(dex) ?? new Set();
    set.add(match[2] || "");
    map.set(dex, set);
  }
  return map;
}

function unionSprites(maps) {
  const map = new Map();
  for (const source of maps) {
    for (const [dex, suffixes] of source) {
      const set = map.get(dex) ?? new Set();
      suffixes.forEach((suffix) => set.add(suffix));
      map.set(dex, set);
    }
  }
  return map;
}

function imageNumbers(html) {
  const numbers = new Set();
  for (const match of html.matchAll(/\/small\/(\d{3,4})(?:-[a-z0-9]+)?\.png/g)) {
    const dex = Number(match[1]);
    if (dex >= 1 && dex <= 1025) numbers.add(dex);
  }
  return numbers;
}

function exclusiveMap(html) {
  const map = new Map();
  for (const match of html.matchAll(/\/icon\/(?:new\/|letsgo\/)?(\d{3,4})(-[a-z0-9]+)?\.png/g)) {
    const suffix = match[2] || "";
    if (suffix === "-gi" || suffix === "-pa") continue;
    const dex = Number(match[1]);
    if (dex < 1 || dex > 1025) continue;
    const set = map.get(dex) ?? new Set();
    set.add(suffix);
    map.set(dex, set);
  }
  return map;
}

function sectionByTitle(html, pattern) {
  const parts = html.split(/<h2\b[^>]*>/i).slice(1);
  const match = parts.find((part) => pattern.test(stripTags(part.slice(0, 240))));
  if (!match) throw new Error(`Missing section ${pattern}`);
  return match;
}

function parseRegional(html, region) {
  const map = new Map();
  for (const cells of rowsOf(html)) {
    const ndex = cells.find((cell) => /^#\d{3,4}$/.test(cell));
    if (!ndex) continue;
    const { gamesFromRegionalCell } = regionalParser;
    const games = gamesFromRegionalCell(cells.at(-1));
    if (!games || games.size === 0) continue;
    const key = `${Number(ndex.slice(1))}:${region}`;
    if (!map.has(key)) map.set(key, [...games]);
  }
  return map;
}

let regionalParser;
async function loadSources() {
  await mkdir(cacheDir, { recursive: true });
  const { gamesFromRegionalCell } = await import("./lib/games.mjs");
  regionalParser = { gamesFromRegionalCell };

  const configuredUrl = await readDexdbUrl(root);
  const dexSource = configuredUrl
    ? await cached("dexdb.js", configuredUrl)
    : await readFile(join(root, DEXDB_SNAPSHOT), "utf8");
  if (!configuredUrl) {
    console.log("DEXDB_URL is not set. Using the committed snapshot at data/sources/dexdb.js.");
  }
  await writeFile(join(root, DEXDB_SNAPSHOT), dexSource);

  const csvNames = ["pokemon.csv", "pokemon_types.csv", "types.csv", "pokemon_species_names.csv", "pokemon_dex_numbers.csv", "encounters.csv"];
  const csv = {};
  for (const name of csvNames) {
    csv[name] = parseCsv(await cached(name, `https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/${name}`));
  }

  const pages = {
    lg: "https://www.serebii.net/letsgopikachueevee/exclusives.shtml",
    swsh: "https://www.serebii.net/swordshield/exclusives.shtml",
    bdspEx: "https://www.serebii.net/brilliantdiamondshiningpearl/exclusives.shtml",
    svEx: "https://www.serebii.net/scarletviolet/exclusives.shtml",
    galar: "https://www.serebii.net/swordshield/galarpokedex.shtml",
    armor: "https://www.serebii.net/swordshield/isleofarmordex.shtml",
    crown: "https://www.serebii.net/swordshield/thecrowntundradex.shtml",
    hisui: "https://www.serebii.net/legendsarceus/hisuipokedex.shtml",
    bdspSinnoh: "https://www.serebii.net/brilliantdiamondshiningpearl/sinnohpokedex.shtml",
    bdspOther: "https://www.serebii.net/brilliantdiamondshiningpearl/otherpokemon.shtml",
    bdspTransfer: "https://www.serebii.net/brilliantdiamondshiningpearl/transferonly.shtml",
    bdspUnobtainable: "https://www.serebii.net/brilliantdiamondshiningpearl/unobtainable.shtml",
    paldea: "https://www.serebii.net/scarletviolet/paldeapokedex.shtml",
    kitakami: "https://www.serebii.net/scarletviolet/kitakamipokedex.shtml",
    blueberry: "https://www.serebii.net/scarletviolet/blueberrypokedex.shtml",
    alolan: "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=Alolan_form&prop=text&format=json",
    galarian: "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=Galarian_form&prop=text&format=json",
    hisuian: "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=Hisuian_form&prop=text&format=json",
    paldean: "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=Paldean_form&prop=text&format=json",
    za: "https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=List_of_Pok%C3%A9mon_in_Pok%C3%A9mon_Legends:_Z-A&prop=text&format=json",
  };
  const html = {};
  for (const [name, url] of Object.entries(pages)) {
    process.stdout.write(`\rfetch ${name}`.padEnd(40));
    const body = await cached(`${name}.txt`, url);
    html[name] = body.includes('"parse"') ? JSON.parse(body).parse.text["*"] : body;
  }
  process.stdout.write("\n");

  const names = new Map();
  for (const row of csv["pokemon_species_names.csv"]) {
    if (row.local_language_id === "9") names.set(Number(row.pokemon_species_id), row.name);
  }

  const membership = (ids) => {
    const set = new Set();
    for (const row of csv["pokemon_dex_numbers.csv"]) {
      if (ids.includes(Number(row.pokedex_id))) set.add(Number(row.species_id));
    }
    return set;
  };

  const lgHtml = html.lg;
  const pikachuAt = lgHtml.indexOf("Let's Go, Pikachu!</u>");
  const eeveeAt = lgHtml.indexOf("Let's Go, Eevee!</u>");
  if (pikachuAt < 0 || eeveeAt < 0) throw new Error("Could not split the Let's Go exclusive list");

  const exclusives = new Map([
    ["lgp", exclusiveMap(lgHtml.slice(pikachuAt, eeveeAt))],
    ["lge", exclusiveMap(lgHtml.slice(eeveeAt))],
    ["sw", exclusiveMap(sectionByTitle(html.swsh, /Sword/))],
    ["sh", exclusiveMap(sectionByTitle(html.swsh, /Shield/))],
    ["bd", exclusiveMap(sectionByTitle(html.bdspEx, /Brilliant Diamond/))],
    ["sp", exclusiveMap(sectionByTitle(html.bdspEx, /Shining Pearl/))],
    ["s", exclusiveMap(sectionByTitle(html.svEx, /Scarlet/))],
    ["v", exclusiveMap(sectionByTitle(html.svEx, /Violet/))],
  ]);

  const sinnoh = imageNumbers(html.bdspSinnoh);
  const other = imageNumbers(html.bdspOther);
  const transfer = imageNumbers(html.bdspTransfer);
  const unobtainable = imageNumbers(html.bdspUnobtainable);
  const bdsp = new Set([...sinnoh, ...other].filter((dex) => !transfer.has(dex) && !unobtainable.has(dex)));

  const regional = new Map([
    ...parseRegional(html.alolan, "alola"),
    ...parseRegional(html.galarian, "galar"),
    ...parseRegional(html.hisuian, "hisui"),
    ...parseRegional(html.paldean, "paldea"),
  ]);

  const za = new Map();
  for (const cells of rowsOf(html.za)) {
    const ndex = cells.find((cell) => /^#\d{3,4}$/.test(cell));
    const avail = cells.find((cell) => /^(Yes|Event|Transfer|No)\b/.test(cell));
    if (!ndex || !avail || cells.length < 5) continue;
    const dex = Number(ndex.slice(1));
    const list = za.get(dex) ?? [];
    list.push({ name: cells[4], yes: avail.startsWith("Yes") });
    za.set(dex, list);
  }

  const byIdentifier = new Map();
  const defaultBySpecies = new Map();
  for (const row of csv["pokemon.csv"]) {
    const record = { id: Number(row.id), identifier: row.identifier, speciesId: Number(row.species_id) };
    byIdentifier.set(row.identifier, record);
    if (row.is_default === "1") defaultBySpecies.set(record.speciesId, record.id);
  }

  const encounters = new Map();
  const trackedVersions = new Set(["31", "32", "33", "34", "35", "36", "50", "51"]);
  for (const row of csv["encounters.csv"]) {
    if (!trackedVersions.has(row.version_id)) continue;
    const pokemonId = Number(row.pokemon_id);
    const set = encounters.get(pokemonId) ?? new Set();
    set.add(Number(row.version_id));
    encounters.set(pokemonId, set);
  }

  const typeName = new Map(csv["types.csv"].map((row) => [row.id, row.identifier]));
  const typesByPokemon = new Map();
  for (const row of csv["pokemon_types.csv"]) {
    const list = typesByPokemon.get(row.pokemon_id) ?? [];
    list.push(row);
    typesByPokemon.set(row.pokemon_id, list);
  }

  return {
    dexSource,
    names,
    lg: membership(POKEDEX.lg),
    swsh: membership(POKEDEX.swsh),
    hisui: membership(POKEDEX.hisui),
    sv: membership(POKEDEX.sv),
    bdsp,
    swshSprites: unionSprites([spriteMap(html.galar), spriteMap(html.armor), spriteMap(html.crown)]),
    hisuiSprites: spriteMap(html.hisui),
    svSprites: unionSprites([spriteMap(html.paldea), spriteMap(html.kitakami), spriteMap(html.blueberry)]),
    exclusives,
    regional,
    za,
    encounters,
    byIdentifier,
    defaultBySpecies,
    typeName,
    typesByPokemon,
  };
}

function pad(number) {
  return String(number).padStart(4, "0");
}

function titleCase(label) {
  return String(label)
    .split(" ")
    .map((word) => (word && /[a-zà-ÿ]/i.test(word) ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function nidoranAliases(name) {
  if (name.includes("♀")) return ["nidoran female", "nidoran♀"];
  if (name.includes("♂")) return ["nidoran male", "nidoran♂"];
  return [];
}

function describe(slot, name) {
  const aliases = nidoranAliases(name);
  if (slot.kind === "standard") {
    return { title: name, formName: null, formDetail: null, aliases };
  }
  if (slot.kind === "regional") {
    const adjective = { alola: "Alolan", galar: "Galarian", hisui: "Hisuian", paldea: "Paldean" }[slot.region];
    return {
      title: `${adjective} ${name}`,
      formName: adjective,
      formDetail: `${adjective} Form`,
      aliases: [`${adjective.toLowerCase()} ${name.toLowerCase()}`, ...aliases],
    };
  }
  if (slot.kind === "gender") {
    return {
      title: `${name} (${slot.formLabel})`,
      formName: slot.formLabel,
      formDetail: slot.formLabel,
      aliases: [`${name} ${slot.formLabel}`.toLowerCase(), ...aliases],
    };
  }
  const label = titleCase(slot.formLabel);
  if (slot.speciesSlug === "tauros") {
    return {
      title: "Paldean Tauros",
      formName: "Paldean",
      formDetail: label,
      aliases: ["paldean tauros", label.toLowerCase(), slot.formLabel],
    };
  }
  if (slot.speciesSlug === "unown") {
    return { title: `Unown (${label})`, formName: label, formDetail: label, aliases: [`unown ${label}`.toLowerCase()] };
  }
  const oneWord = !label.includes(" ");
  return {
    title: oneWord ? `${label} ${name}` : `${name} (${label})`,
    formName: label,
    formDetail: oneWord ? `${label} Form` : label,
    aliases: [label.toLowerCase(), String(slot.formLabel).toLowerCase()].filter((alias, index, list) => alias && list.indexOf(alias) === index),
  };
}

function regionTitle(start, end) {
  return REGIONS.filter(([from, to]) => end >= from && start <= to)
    .map((region) => region[2])
    .join(" · ");
}

function typesFor(sources, pokemonId) {
  const rows = sources.typesByPokemon.get(String(pokemonId)) ?? [];
  return rows
    .slice()
    .sort((a, b) => Number(a.slot) - Number(b.slot))
    .map((row) => sources.typeName.get(row.type_id))
    .filter(Boolean);
}

const spriteJobs = new Map();

async function fetchPng(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": "my-national-dex-sync" } });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 400 || bytes[0] !== 0x89 || bytes[1] !== 0x50) throw new Error(`not a PNG (${bytes.length} bytes)`);
      return bytes;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }
  throw lastError;
}

async function ensureSprite(spriteId, url) {
  const key = String(spriteId);
  if (!spriteJobs.has(key)) {
    spriteJobs.set(key, (async () => {
      const destination = join(spriteDir, `${key}.png`);
      if (!force && (await exists(destination))) return true;
      const bytes = await fetchPng(url);
      if (!bytes) return false;
      await writeFile(destination, bytes);
      return true;
    })());
  }
  return spriteJobs.get(key);
}

async function spriteFor(slot, sources) {
  const fallback = [...sources.byIdentifier.values()].find((row) => row.id === sources.defaultBySpecies.get(slot.nationalDex)) ?? null;
  const resolved = resolveSprite(slot, sources.byIdentifier, fallback);
  if (skipSprites) {
    return {
      spriteId: resolved.female ? `${resolved.pokemonId}-f` : resolved.pokemonId,
      pokemonId: resolved.pokemonId,
      note: resolved.note,
    };
  }
  const notes = [];
  if (resolved.female) {
    const female = await ensureSprite(`${resolved.pokemonId}-f`, `${spriteBase}/female/${resolved.pokemonId}.png`);
    if (female) return { spriteId: `${resolved.pokemonId}-f`, pokemonId: resolved.pokemonId, note: null };
    notes.push(`No female HOME sprite for ${resolved.identifier}; using the default HOME sprite.`);
  } else if (resolved.note) {
    notes.push(resolved.note);
  }
  const own = await ensureSprite(resolved.pokemonId, `${spriteBase}/${resolved.pokemonId}.png`);
  if (own) return { spriteId: resolved.pokemonId, pokemonId: resolved.pokemonId, note: notes.join(" ") || null };
  const speciesId = sources.defaultBySpecies.get(slot.nationalDex);
  if (speciesId && speciesId !== resolved.pokemonId) {
    const species = await ensureSprite(speciesId, `${spriteBase}/${speciesId}.png`);
    if (species) {
      notes.push(`No HOME sprite for ${resolved.identifier}; using ${sources.byIdentifier.get(slot.speciesSlug)?.identifier ?? "the species"} (#${speciesId}).`);
      return { spriteId: speciesId, pokemonId: speciesId, note: notes.join(" ") };
    }
  }
  throw new Error(`No HOME sprite for ${slot.speciesSlug} ${slot.formSuffix} (${resolved.identifier})`);
}

async function mapPool(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

const sources = await loadSources();
const layout = layoutFromDexData(loadDexData(sources.dexSource));
const slots = flattenLayout(layout);
const seen = new Set();
const drafts = slots.map((slot) => {
  const id = entryId(slot);
  if (seen.has(id)) throw new Error(`Duplicate id ${id}`);
  seen.add(id);
  const name = sources.names.get(slot.nationalDex);
  if (!name) throw new Error(`Missing English name for ${slot.nationalDex}`);
  const described = describe(slot, name);
  const availability = assignGames(slot, sources);
  const positionIndex = slot.slot - 1;
  return {
    slot,
    entry: {
      id,
      nationalDex: slot.nationalDex,
      name,
      title: described.title,
      formName: described.formName,
      formDetail: described.formDetail,
      kind: slot.kind,
      types: [],
      spriteId: null,
      boxId: slot.boxId,
      slot: slot.slot,
      row: Math.floor(positionIndex / 6) + 1,
      column: (positionIndex % 6) + 1,
      games: availability.games,
      aliases: described.aliases,
      ...(availability.availabilityNote ? { availabilityNote: availability.availabilityNote } : {}),
    },
  };
});

await mkdir(spriteDir, { recursive: true });
let finished = 0;
await mapPool(drafts, skipSprites ? 1 : 8, async (draft) => {
  const art = await spriteFor(draft.slot, sources);
  draft.entry.spriteId = art.spriteId;
  draft.entry.types = typesFor(sources, art.pokemonId);
  if (art.note) draft.entry.spriteNote = art.note;
  finished += 1;
  if (!skipSprites && (finished % 50 === 0 || finished === drafts.length)) {
    process.stdout.write(`\r${finished}/${drafts.length} sprites`);
  }
});
if (!skipSprites) process.stdout.write("\n");

const entries = drafts.map((draft) => draft.entry);
const boxes = [];
for (const box of layout) {
  const first = box.slots[0];
  const sample = entries.find((entry) => entry.boxId === (box.section === "national"
    ? `standard-${String(boxes.filter((item) => item.group === "standard").length + 1).padStart(2, "0")}`
    : `alt-${String(boxes.filter((item) => item.group === "alt").length + 1).padStart(2, "0")}`));
  const boxEntries = entries.filter((entry) => entry.boxId === sample.boxId);
  const standard = box.section === "national";
  const start = boxEntries[0].nationalDex;
  const end = boxEntries.at(-1).nationalDex;
  boxes.push({
    id: sample.boxId,
    group: standard ? "standard" : "alt",
    number: standard ? boxes.filter((item) => item.group === "standard").length + 1 : boxes.filter((item) => item.group === "alt").length + 1,
    title: standard ? regionTitle(start, end) : box.label,
    rangeLabel: standard ? `#${pad(start)}–#${pad(end)}` : box.label,
    subtitle: boxEntries.length === 1 ? boxEntries[0].title : `${boxEntries[0].title} – ${boxEntries.at(-1).title}`,
    dexStart: standard ? start : null,
    dexEnd: standard ? end : null,
    catalogued: true,
  });
  if (first && sample.nationalDex !== first.nationalDex) {
    throw new Error(`Box alignment drifted for ${sample.boxId}`);
  }
}

const fallbacks = entries
  .filter((entry) => entry.spriteNote)
  .map((entry) => ({ id: entry.id, name: entry.title, spriteId: entry.spriteId, note: entry.spriteNote }));

await writeFile(join(root, "data/dex.json"), `${JSON.stringify({
  note: "Full National Living Dex. Standard boxes follow National Dex order, 30 slots per box, in the order the original box-order reference builds from its dex database. Alt Forms / Variants follow that reference's alt section: Alolan, Galarian, Hisuian, Paldean, gender differences, other forms, then Unown, Vivillon, and Alcremie. spriteId is the local Pokémon HOME file in assets/sprites. games lists Nintendo Switch main-series titles where this exact form is obtainable in-game. Row and column use a 6-column box.",
  source: "original box-order reference",
  entries,
}, null, 2)}\n`);

await writeFile(join(root, "data/boxes.json"), `${JSON.stringify({
  columns: 6,
  slotsPerBox: 30,
  nationalDexCount: 1025,
  groups: [
    { id: "standard", label: "National Dex" },
    { id: "alt", label: "Alt Forms / Variants" },
  ],
  boxes,
}, null, 2)}\n`);

await writeFile(join(root, "data/collection.json"), `${JSON.stringify({
  instructions: "Caught Pokémon, by id from data/dex.json. This list starts empty. Add an id when it is caught, for example \"0001\" or \"0037-alola\". Remove an id to mark it missing. The app treats every other Pokémon as missing.",
  caught: [],
}, null, 2)}\n`);

await writeFile(join(root, "data/sprite-fallbacks.json"), `${JSON.stringify({
  note: "Slots whose form has no dedicated Pokémon HOME sprite in PokeAPI/sprites. The app still loads the local file named by spriteId.",
  count: fallbacks.length,
  fallbacks,
}, null, 2)}\n`);

const standardCount = entries.filter((entry) => entry.kind === "standard").length;
const altCount = entries.length - standardCount;
console.log(`Wrote ${entries.length} entries (${standardCount} standard, ${altCount} alt) in ${boxes.length} boxes. Sprite fallbacks: ${fallbacks.length}.`);

// Optional gitignored comparison file. A normal checkout does not include it.
const goldenPath = join(root, "data/sources/golden-dex.json");
if (await exists(goldenPath)) {
  const golden = JSON.parse(await readFile(goldenPath, "utf8"));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const mismatches = [];
  for (const old of golden.entries) {
    const next = byId.get(old.id);
    if (!next) {
      mismatches.push(`${old.id} missing`);
      continue;
    }
    if (next.games.join() !== old.games.join()) mismatches.push(`${old.id} games ${next.games.join() || "—"} (was ${old.games.join() || "—"})`);
  }
  console.log(mismatches.length ? mismatches.join("\n") : "Golden game rows match.");
}
