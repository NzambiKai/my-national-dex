/**
 * National Living Dex box order from the original box-order reference.
 *
 * The reference does not ship a static box list. `printDex.js` builds it at runtime
 * from its dex database (`const dexData = [...]`):
 *
 *   writeDex('nat', 'normal')  — standard boxes, 30 Pokémon per box, National Dex order
 *   writeDex('alt', 'normal')  — Alt Forms, in this section order:
 *     1. Regional forms, one region at a time: Alolan, Galarian, Hisuian, Paldean.
 *        Each region walks dexData and keeps species whose flag is true. A new box
 *        opens every 30 forms, and the next region always starts a new box.
 *     2. Gender-specific forms. Each flagged species contributes Male then Female.
 *        Sneasel (#215) contributes four: Male, Female, Hisuian Male, Hisuian Female.
 *        A new box opens whenever the running count is divisible by 30.
 *     3. Other alt forms (`alts`), skipping Unown (#201), Vivillon (#666), and
 *        Alcremie (#869). Forms follow `alts[0].forms` / `form-names`. A new box
 *        opens on a multiple of 30 when the next National Dex row exists
 *        (`dexData[dexID]` in printDex.js).
 *     4. Species boxes, in this order: Unown, Vivillon, then Alcremie.
 *        Alcremie (non-shiny) is `flavors × toppings` in the array order in the reference.
 *
 * Shiny boxes repeat the same order and are not part of this tracker.
 * Mega Evolution and Gigantamax flags are stored on dexData but printDex.js never
 * turns them into slots.
 *
 * `layoutFromDexData` returns one slot per card, in the order those cards are appended.
 */

const SPECIES_BOXES = ["201", "666", "869"];

function cleanLabel(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;|&#8217;|’/g, "'")
    .replace(/&ldquo;|&#8220;|“/g, '"')
    .replace(/&rdquo;|&#8221;|”/g, '"')
    .replace(/&eacute;?/g, "é")
    .replace(/&male;|♂/g, "male")
    .replace(/&female;|♀/g, "female")
    .replace(/\s+/g, " ")
    .trim();
}

function slot(pokemon, extra) {
  return {
    nationalDex: Number(pokemon.id),
    speciesSlug: pokemon.name,
    ...extra,
  };
}

export function layoutFromDexData(dexData) {
  if (!Array.isArray(dexData) || dexData.length === 0) {
    throw new Error("box-order dexData is empty");
  }

  const boxes = [];
  const open = (section, label) => {
    const box = { section, label, slots: [] };
    boxes.push(box);
    return box;
  };

  let current = open("national", "National Dex");
  dexData.forEach((pokemon, index) => {
    current.slots.push(
      slot(pokemon, {
        kind: "standard",
        region: null,
        gender: null,
        formSuffix: "",
        formLabel: null,
      }),
    );
    if ((index + 1) % 30 === 0) current = open("national", "National Dex");
  });

  const regions = [
    ["alolan", "Alolan Forms", "alola"],
    ["galarian", "Galarian Forms", "galar"],
    ["hisuian", "Hisuian Forms", "hisui"],
    ["paldean", "Paldean Forms", "paldea"],
  ];
  for (const [flag, label, region] of regions) {
    let count = 0;
    current = open(flag, label);
    for (const pokemon of dexData) {
      if (!pokemon[flag]) continue;
      current.slots.push(
        slot(pokemon, {
          kind: "regional",
          region,
          gender: null,
          formSuffix: `-${region}`,
          formLabel: `${label.replace(" Forms", "")} Form`,
        }),
      );
      count += 1;
      if (count % 30 === 0) current = open(flag, label);
    }
  }

  let genderCount = 0;
  current = open("gender", "Gender-Specific Forms");
  for (const pokemon of dexData) {
    if (!pokemon.gender) continue;
    const dexId = Number(pokemon.id);
    const genders =
      dexId === 215
        ? [
            ["male", null, "Male"],
            ["female", null, "Female"],
            ["male", "hisui", "Hisuian Male"],
            ["female", "hisui", "Hisuian Female"],
          ]
        : [
            ["male", null, "Male"],
            ["female", null, "Female"],
          ];
    for (const [gender, region, formLabel] of genders) {
      current.slots.push(
        slot(pokemon, {
          kind: "gender",
          region,
          gender,
          formSuffix: region ? `-${region}-${gender}` : `-${gender}`,
          formLabel,
        }),
      );
    }
    genderCount += genders.length;
    if (genderCount % 30 === 0) current = open("gender", "Gender-Specific Forms");
  }

  const speciesSkip = new Set(SPECIES_BOXES);
  let altCount = 0;
  current = open("alt", "Alt Forms");
  for (const pokemon of dexData) {
    if (!pokemon.alts || speciesSkip.has(String(pokemon.id))) continue;
    const forms = pokemon.alts[0].forms;
    const names = pokemon.alts[0]["form-names"];
    for (let index = 0; index < forms.length; index += 1) {
      current.slots.push(
        slot(pokemon, {
          kind: "variant",
          region: null,
          gender: null,
          formSuffix: forms[index],
          formLabel: cleanLabel(names[index]),
        }),
      );
      altCount += 1;
      if (altCount % 30 === 0 && dexData[Number(pokemon.id)]) {
        current = open("alt", "Alt Forms");
      }
    }
  }

  for (const speciesId of SPECIES_BOXES) {
    const pokemon = dexData[Number(speciesId) - 1];
    const proper = pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1);
    const label = `${proper} Forms`;
    let count = 0;
    current = open(pokemon.name, label);
    if (pokemon.name !== "alcremie") {
      const forms = pokemon.alts[0].forms;
      const names = pokemon.alts[0]["form-names"];
      for (let index = 0; index < forms.length; index += 1) {
        current.slots.push(
          slot(pokemon, {
            kind: "variant",
            region: null,
            gender: null,
            formSuffix: forms[index],
            formLabel: cleanLabel(names[index]),
          }),
        );
        count += 1;
        if (count % 30 === 0) current = open(pokemon.name, label);
      }
    } else {
      const { flavors, toppings } = pokemon.alts[0];
      for (const flavor of flavors) {
        const flavorName = flavor.replaceAll("-", " ");
        for (const topping of toppings) {
          current.slots.push(
            slot(pokemon, {
              kind: "variant",
              region: null,
              gender: null,
              formSuffix: `-${flavor}-${topping}`,
              formLabel: `${flavorName} ${topping}`,
            }),
          );
          count += 1;
          if (count % 30 === 0) current = open(pokemon.name, label);
        }
      }
    }
  }

  return boxes.filter((box) => box.slots.length > 0);
}

export function flattenLayout(boxes) {
  const slots = [];
  let altNumber = 0;
  boxes.forEach((box, index) => {
    const isStandard = box.section === "national";
    const number = isStandard ? index + 1 : ++altNumber;
    const boxId = isStandard ? `standard-${String(number).padStart(2, "0")}` : `alt-${String(number).padStart(2, "0")}`;
    box.slots.forEach((entry, slotIndex) => {
      slots.push({
        ...entry,
        boxId,
        boxNumber: number,
        boxSection: box.section,
        boxLabel: box.label,
        slot: slotIndex + 1,
      });
    });
  });
  return slots;
}
