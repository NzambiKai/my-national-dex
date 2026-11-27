/**
 * Map a pokedexapp slot onto a Pokémon HOME sprite in PokeAPI/sprites.
 *
 * Files live at sprites/pokemon/other/home/<pokemon id>.png.
 * Female differences that are not their own Pokémon id live at
 * sprites/pokemon/other/home/female/<pokemon id>.png and are stored locally
 * as <id>-f.png. Anything without a dedicated file falls back to the closest
 * real HOME sprite and is recorded in data/sprite-fallbacks.json.
 */

const REGIONAL_SUFFIX = {
  alola: "alola",
  galar: "galar",
  hisui: "hisui",
  paldea: "paldea",
};

const IDENTIFIER_OVERRIDES = {
  "tauros|-combat-breed": "tauros-paldea-combat-breed",
  "tauros|-blaze-breed": "tauros-paldea-blaze-breed",
  "tauros|-aqua-breed": "tauros-paldea-aqua-breed",
  "tauros|-paldea": "tauros-paldea-combat-breed",
  "darmanitan|-galar": "darmanitan-galar-standard",
  "minior|-red-core": "minior-red",
  "minior|-orange-core": "minior-orange",
  "minior|-yellow-core": "minior-yellow",
  "minior|-green-core": "minior-green",
  "minior|-blue-core": "minior-blue",
  "minior|-indigo-core": "minior-indigo",
  "minior|-violet-core": "minior-violet",
  "unown|-a": "unown",
  "unown|-em": "unown-exclamation",
  "unown|-qm": "unown-question",
  "gimmighoul|-chest-form": "gimmighoul",
  "gimmighoul|-roaming-form": "gimmighoul-roaming",
  "poltchageist|-counterfeit-form": "poltchageist",
  "poltchageist|-artisan-form": "poltchageist-artisan",
  "sinistcha|-unremarkable-form": "sinistcha",
  "sinistcha|-masterpiece-form": "sinistcha-masterpiece",
  "tatsugiri|-curly-form": "tatsugiri-curly",
  "tatsugiri|-droopy-form": "tatsugiri-droopy",
  "tatsugiri|-stretchy-form": "tatsugiri-stretchy",
  "squawkabilly|-green-plumage": "squawkabilly-green-plumage",
  "squawkabilly|-blue-plumage": "squawkabilly-blue-plumage",
  "squawkabilly|-yellow-plumage": "squawkabilly-yellow-plumage",
  "squawkabilly|-white-plumage": "squawkabilly-white-plumage",
  "dudunsparce|-two-segment": "dudunsparce-two-segment",
  "dudunsparce|-three-segment": "dudunsparce-three-segment",
  "maushold|-family-of-three": "maushold-family-of-three",
  "maushold|-family-of-four": "maushold-family-of-four",
  "pikachu|-johto-cap": "pikachu-partner-cap",
  "pikachu|-alolan-cap": "pikachu-alola-cap",
  "greninja|-ash": "greninja-ash",
  "zygarde|-50": "zygarde",
  "zygarde|-10": "zygarde-10",
  "pumpkaboo|-average": "pumpkaboo",
  "gourgeist|-average": "gourgeist",
  "burmy|-plant": "burmy",
  "wormadam|-plant": "wormadam",
  "shellos|-west": "shellos",
  "gastrodon|-west": "gastrodon",
  "deerling|-spring": "deerling",
  "sawsbuck|-spring": "sawsbuck",
  "deoxys|-normal": "deoxys",
  "shaymin|-land": "shaymin",
  "basculin|-red-striped": "basculin",
  "keldeo|-ordinary": "keldeo",
  "oricorio|-baile": "oricorio",
  "lycanroc|-midday": "lycanroc",
  "toxtricity|-amped": "toxtricity",
  "urshifu|-single-strike": "urshifu",
  "furfrou|-natural": "furfrou",
  "flabebe|-red": "flabebe",
  "floette|-red": "floette",
  "florges|-red": "florges",
  "ursaluna|-normal": "ursaluna",
  "enamorus|-incarnate": "enamorus",
  "tornadus|-incarnate": "tornadus",
  "thundurus|-incarnate": "thundurus",
  "landorus|-incarnate": "landorus",
  "hoopa|-confined": "hoopa",
  "magearna|": "magearna",
  "zarude|": "zarude",
  "rockruff|": "rockruff",
  "rotom|": "rotom",
  "greninja|": "greninja",
  "pikachu|": "pikachu",
  "vivillon|-poke-ball": "vivillon-poke-ball",
};

const DISTINCT_FEMALE = new Set(["meowstic-female", "indeedee-female", "basculegion-female", "oinkologne-female"]);

// Form suffixes whose artwork is the species' default HOME sprite on purpose.
const DEFAULT_ART = new Set([
  "",
  "-normal",
  "-a",
  "-meadow",
  "-vanilla-cream-strawberry",
  "-average",
  "-chest-form",
  "-counterfeit-form",
  "-unremarkable-form",
  "-curly-form",
  "-green-plumage",
  "-two-segment",
  "-family-of-four",
  "-50",
  "-plant",
  "-west",
  "-spring",
  "-red-striped",
  "-ordinary",
  "-baile",
  "-midday",
  "-amped",
  "-single-strike",
  "-natural",
  "-red",
  "-land",
  "-incarnate",
  "-confined",
  "-solo",
  "-disguised",
  "-aria",
  "-shield",
  "-altered",
  "-red-meteor",
]);

function candidatesFor(slot) {
  const slug = slot.speciesSlug;
  const suffix = slot.formSuffix || "";
  const override = IDENTIFIER_OVERRIDES[`${slug}|${suffix}`];
  const bare = suffix.replace(/^-/, "");
  const list = [];
  if (override) list.push(override);
  if (slot.kind === "regional") {
    const region = REGIONAL_SUFFIX[slot.region];
    list.push(`${slug}-${region}`);
    if (slug === "tauros" && slot.region === "paldea") list.push("tauros-paldea-combat-breed");
  } else if (slot.kind === "gender" && slot.region === "hisui") {
    list.push(`${slug}-hisui`);
  } else if (slot.kind === "gender" && slot.gender === "female") {
    list.push(`${slug}-female`);
  } else if (bare) {
    list.push(`${slug}-${bare}`);
    list.push(`${slug}${suffix}`);
  }
  list.push(slug);
  return [...new Set(list)];
}

export function resolveSprite(slot, byIdentifier, fallbackPokemon = null) {
  const wanted = candidatesFor(slot);
  const match = wanted.map((name) => byIdentifier.get(name)).find(Boolean);
  const species = byIdentifier.get(slot.speciesSlug) || fallbackPokemon;
  const chosen = match || species;
  if (!chosen) {
    throw new Error(`No PokéAPI Pokémon for ${slot.speciesSlug} ${slot.formSuffix}`);
  }

  const distinctFemale = slot.kind === "gender" && slot.gender === "female" && DISTINCT_FEMALE.has(chosen.identifier);
  const cosmeticFemale = slot.kind === "gender" && slot.gender === "female" && !distinctFemale;
  const speciesDefault = fallbackPokemon && chosen.id === fallbackPokemon.id;
  const intendedDefault = slot.kind === "standard" || slot.kind === "gender" || DEFAULT_ART.has(slot.formSuffix || "");
  let note = null;
  if (slot.kind === "regional" && slot.speciesSlug === "tauros" && slot.region === "paldea" && chosen.identifier.includes("combat")) {
    note = "pokedexapp's single Paldean Tauros card has no separate HOME sprite; using Combat Breed.";
  } else if (speciesDefault && !intendedDefault) {
    note = `No dedicated HOME sprite in PokeAPI/sprites; using ${chosen.identifier}.`;
  }

  return {
    pokemonId: chosen.id,
    identifier: chosen.identifier,
    female: cosmeticFemale,
    note,
  };
}
