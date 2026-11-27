/**
 * Nintendo Switch catchability for one Living Dex slot.
 *
 * A game is listed only when that exact form can be obtained in-game (wild,
 * permanent gift, or evolution) in that version. Trades from the other version,
 * Pokémon GO, and pre-Switch games are omitted.
 *
 * Sources, all applied by scripts/sync-data.mjs:
 * - PokéAPI pokedex membership for Let's Go, Sword/Shield (including DLC),
 *   Legends: Arceus, and Scarlet/Violet (including DLC).
 * - Serebii dex sprites, so a regional icon does not mark the default form.
 * - Serebii version-exclusive lists, including form suffixes.
 * - Serebii's Brilliant Diamond / Shining Pearl available set
 *   (Sinnoh + Grand Underground and other extras, minus transfer-only and
 *   unobtainable pages). PokéAPI's Sinnoh dex is only the original 151.
 * - Bulbapedia regional-form availability cells for the form itself.
 * - Bulbapedia's Legends: Z-A "normally available" column. Event-only and
 *   transfer-only rows do not count. Mega Evolution rows are ignored.
 */

export const GAME_ORDER = ["lgp", "lge", "sw", "sh", "bd", "sp", "la", "s", "v", "za"];

const PAIRS = [
  ["lgp", "lge"],
  ["sw", "sh"],
  ["bd", "sp"],
  ["s", "v"],
];

const WAKE_NOTE =
  "Walking Wake is not in the permanent Paldea, Kitakami, or Blueberry Pokédex. It can only be caught during a limited Poké Portal Tera Raid event in Scarlet, and no event is active.";
const LEAVES_NOTE =
  "Iron Leaves is not in the permanent Paldea, Kitakami, or Blueberry Pokédex. It can only be caught during a limited Poké Portal Tera Raid event in Violet, and no event is active.";

const SPECIES_NOTES = {
  1009: WAKE_NOTE,
  1010: LEAVES_NOTE,
  893: "Zarude was a Mystery Gift. No Nintendo Switch distribution is currently active.",
};

// Hisuian forms whose Scarlet/Violet method is a current wild encounter or a
// permanent story gift. Bulbapedia's availability column also says "S V" for
// forms that are HOME transfers or ended Tera Raid / outbreak events; those
// stay off the Scarlet and Violet lists.
const HISUIAN_SV = new Set([58, 59, 211, 215, 570, 571]);

const HISUIAN_SV_NOTE =
  "This Hisuian form is in the Scarlet and Violet Pokédex, but the current method is a transfer from Legends: Arceus or a past event, not a permanent in-game catch.";

export function gamesFromRegionalCell(cell) {
  const tokens = String(cell ?? "").split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 16) return null;
  if (tokens.some((token) => token.length > 6)) return null;
  const games = new Set();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (token === "S" && next === "M") {
      index += 1;
      continue;
    }
    if (token === "US" || token === "UM" || token === "Champs" || token === "GO") continue;
    if (token === "P" && next === "E") {
      games.add("lgp");
      games.add("lge");
      index += 1;
      continue;
    }
    if (token === "Sw") games.add("sw");
    else if (token === "Sh") games.add("sh");
    else if (token === "LA") games.add("la");
    else if (token === "ZA" || token === "MD") games.add("za");
    else if (token === "BD") games.add("bd");
    else if (token === "SP") games.add("sp");
    else if (token === "S" && next === "V") {
      games.add("s");
      games.add("v");
      index += 1;
    }
  }
  return games;
}

function ordered(games) {
  return GAME_ORDER.filter((id) => games.has(id));
}

function exclusiveSuffixFor(slot) {
  if (slot.kind === "regional") {
    if (slot.region === "alola") return "-a";
    if (slot.region === "galar") return "-g";
    if (slot.region === "hisui") return "-h";
    return null;
  }
  if (slot.kind === "gender" && slot.gender === "female" && slot.region !== "hisui") return "-f";
  if (slot.kind === "variant" && slot.speciesSlug === "tauros" && slot.formSuffix === "-blaze-breed") return "-b";
  if (slot.kind === "variant" && slot.speciesSlug === "tauros" && slot.formSuffix === "-aqua-breed") return "-a";
  if (slot.kind === "variant" && slot.speciesSlug === "basculin" && slot.formSuffix === "-blue-striped") return "-b";
  if (slot.kind === "gender" && slot.gender === "male") return "";
  return "";
}

function applyPairs(games, dex, suffix, exclusives) {
  if (suffix == null) return;
  for (const [left, right] of PAIRS) {
    const inLeft = exclusives.get(left)?.get(dex)?.has(suffix) === true;
    const inRight = exclusives.get(right)?.get(dex)?.has(suffix) === true;
    if (inLeft && !inRight) games.delete(right);
    else if (inRight && !inLeft) games.delete(left);
  }
}

function formKey(name, species) {
  let rest = name;
  if (rest.startsWith(species)) rest = rest.slice(species.length).trim();
  if (rest.startsWith(species)) rest = rest.slice(species.length).trim();
  return rest;
}

function zaRowsFor(sources, nationalDex, speciesName) {
  return (sources.za.get(nationalDex) ?? [])
    .map((row) => ({ ...row, key: formKey(row.name, speciesName) }))
    .filter((row) => !/^mega\b/i.test(row.key) && !/mega/i.test(row.key));
}

function zaMatch(slot, rows) {
  const label = String(slot.formLabel ?? "").toLowerCase();
  if (slot.kind === "standard") return rows.find((row) => row.key === "");
  if (slot.kind === "regional") {
    const word = { alola: "alolan", galar: "galarian", hisui: "hisuian", paldea: "paldean" }[slot.region];
    return rows.find((row) => row.key.toLowerCase().includes(`${word} form`)) ?? rows.find((row) => row.key.toLowerCase().includes(word));
  }
  if (slot.kind === "gender" && slot.region === "hisui") {
    return rows.find((row) => /hisuian form/i.test(row.key));
  }
  if (slot.kind === "gender") {
    const wanted = slot.gender === "female" ? /^female\b/i : /^male\b/i;
    return rows.find((row) => wanted.test(row.key)) ?? rows.find((row) => row.key === "");
  }
  const wanted = label.replace(/[^a-z0-9%]+/g, " ").trim();
  if (wanted === "normal") return rows.find((row) => row.key === "");
  if (!wanted) return null;
  return rows.find((row) => row.key.toLowerCase().includes(wanted));
}

function applyZa(games, slot, sources, speciesName, regionalHadZa) {
  const rows = zaRowsFor(sources, slot.nationalDex, speciesName);
  const match = zaMatch(slot, rows);
  if (match) {
    if (match.yes) games.add("za");
    else games.delete("za");
    return;
  }
  if (slot.kind === "regional") {
    if (!regionalHadZa) games.delete("za");
    return;
  }
  const base = rows.find((row) => row.key === "");
  if (base?.yes) games.add("za");
  else games.delete("za");
}

export function assignGames(slot, sources) {
  const dex = slot.nationalDex;
  const speciesName = sources.names.get(dex) ?? slot.speciesSlug;
  const notes = [];

  if (SPECIES_NOTES[dex]) {
    return { games: [], availabilityNote: SPECIES_NOTES[dex] };
  }

  const family = () => {
    const games = new Set();
    if (sources.lg.has(dex)) {
      games.add("lgp");
      games.add("lge");
    }
    const swshSprites = sources.swshSprites.get(dex);
    const swshMember = sources.swsh.has(dex);
    if (swshSprites && swshSprites.size > 0) {
      if (swshSprites.has("")) {
        games.add("sw");
        games.add("sh");
      }
    } else if (swshMember) {
      games.add("sw");
      games.add("sh");
    }
    const versions = sources.encounters?.get(sources.defaultBySpecies.get(dex));
    if (versions) {
      if ([33, 35, 36].some((id) => versions.has(id))) games.add("sw");
      if ([34, 50, 51].some((id) => versions.has(id))) games.add("sh");
      if (versions.has(31)) games.add("lgp");
      if (versions.has(32)) games.add("lge");
    }
    if (sources.bdsp.has(dex)) {
      games.add("bd");
      games.add("sp");
    }
    const hisuiSprites = sources.hisuiSprites.get(dex);
    const hisuiMember = sources.hisui.has(dex);
    if (hisuiSprites && hisuiSprites.size > 0) {
      if (hisuiSprites.has("") || dex === 215) games.add("la");
    } else if (hisuiMember) {
      games.add("la");
    }
    const svSprites = sources.svSprites.get(dex);
    if (sources.sv.has(dex) && !(svSprites && svSprites.size > 0 && !svSprites.has(""))) {
      games.add("s");
      games.add("v");
    }
    if (dex === 808 || dex === 809) {
      games.delete("lgp");
      games.delete("lge");
      notes.push("Let's Go receives Meltan from Pokémon GO. That method is outside this tracker. Both are catchable in Legends: Z-A.");
    }
    return games;
  };

  let games = new Set();
  let regionalHadZa = false;

  if (slot.kind === "regional") {
    const cell = sources.regional.get(`${dex}:${slot.region}`);
    games = new Set(cell ?? []);
    regionalHadZa = games.has("za");
    if (slot.region === "hisui" && !HISUIAN_SV.has(dex)) {
      if (games.delete("s") | games.delete("v")) notes.push(HISUIAN_SV_NOTE);
    }
    applyPairs(games, dex, exclusiveSuffixFor(slot), sources.exclusives);
  } else if (slot.kind === "gender" && slot.region === "hisui") {
    const regional = assignGames({ ...slot, kind: "regional", region: "hisui", gender: null, formSuffix: "-hisui", formLabel: "Hisuian Form" }, sources);
    return regional;
  } else if (slot.kind === "variant" && slot.speciesSlug === "tauros") {
    games = new Set(["s", "v"]);
    if (slot.formSuffix === "-blaze-breed") applyPairs(games, dex, "-b", sources.exclusives);
    else if (slot.formSuffix === "-aqua-breed") applyPairs(games, dex, "-a", sources.exclusives);
  } else if (slot.kind === "variant" && slot.speciesSlug === "basculin" && slot.formSuffix === "-white-striped") {
    games = new Set(["la", "s", "v"]);
  } else if (slot.kind === "variant" && slot.speciesSlug === "ursaluna" && slot.formSuffix === "-bloodmoon") {
    games = new Set(["s", "v"]);
  } else {
    games = family();
    let suffix = exclusiveSuffixFor(slot);
    if (slot.kind === "gender" && slot.gender === "female") {
      const listed = ["lgp", "lge", "sw", "sh", "bd", "sp", "s", "v"].some((game) => sources.exclusives.get(game)?.get(dex)?.has("-f"));
      if (!listed) suffix = "";
    }
    applyPairs(games, dex, suffix, sources.exclusives);
  }

  applyZa(games, slot, sources, speciesName, regionalHadZa);

  if (slot.kind === "variant" && slot.speciesSlug === "pikachu" && String(slot.formSuffix).includes("cap")) {
    games.clear();
    notes.push("Cap Pikachu were event distributions and are not catchable in a Nintendo Switch main-series game.");
  }
  if (slot.kind === "variant" && slot.speciesSlug === "greninja" && slot.formSuffix === "-ash") {
    games.clear();
    notes.push("Ash-Greninja is not catchable in a Nintendo Switch main-series game.");
  }
  if (slot.kind === "variant" && slot.speciesSlug === "vivillon" && (slot.formSuffix === "-fancy" || slot.formSuffix === "-poke-ball")) {
    games.clear();
    notes.push("This Vivillon pattern was an event distribution and is not currently available on Nintendo Switch.");
  }
  if (slot.kind === "variant" && slot.formSuffix === "-roaming-form") {
    if (games.delete("za")) {
      notes.push("Roaming Form is catchable in Scarlet and Violet. In Legends: Z-A it is transfer-only.");
    }
  }
  if (slot.speciesSlug === "magearna" && /original/i.test(slot.formLabel ?? "")) {
    games.delete("za");
    notes.push("Magearna Original Color is transfer-only in Legends: Z-A.");
  }

  if (dex === 151 && (games.has("lgp") || games.has("lge")) && slot.kind === "standard") {
    notes.push("In Let's Go, Mew is obtained from a Poké Ball Plus.");
  }
  if ((dex === 491 || dex === 492) && games.has("la") && slot.kind === "standard") {
    notes.push("In Legends: Arceus this Pokémon is a save-data bonus from Brilliant Diamond, Shining Pearl, or Sword and Shield. It is not in the Brilliant Diamond or Shining Pearl dex as a catch.");
  }

  if (games.size === 0 && notes.length === 0) {
    notes.push("Not currently catchable in any Nintendo Switch main-series game.");
  }

  return {
    games: ordered(games),
    availabilityNote: notes.join(" ") || null,
  };
}
