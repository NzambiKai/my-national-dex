function pad(number) {
  return String(number).padStart(4, "0");
}

export function entryId(slot) {
  const n = pad(slot.nationalDex);
  if (slot.kind === "standard") return n;
  if (slot.kind === "regional") return `${n}-${slot.region}`;
  if (slot.kind === "gender") return slot.region === "hisui" ? `${n}-hisui-${slot.gender}` : `${n}-${slot.gender}`;
  if (slot.speciesSlug === "tauros" && slot.formSuffix === "-blaze-breed") return `${n}-paldea-blaze`;
  if (slot.speciesSlug === "tauros" && slot.formSuffix === "-aqua-breed") return `${n}-paldea-aqua`;
  if (slot.speciesSlug === "tauros" && slot.formSuffix === "-combat-breed") return `${n}-paldea-combat`;
  const raw = (slot.formSuffix || "").replace(/^-/, "");
  return `${n}-${raw || "normal"}`;
}
