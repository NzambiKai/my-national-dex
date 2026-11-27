export function normalizeQuery(value) {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/♀/g, " female ")
    .replace(/♂/g, " male ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function haystack(entry) {
  return normalizeQuery(
    [
      entry.title,
      entry.name,
      entry.formName,
      entry.formDetail,
      ...(entry.aliases ?? []),
      String(entry.nationalDex),
      String(entry.nationalDex).padStart(4, "0"),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function byDexThenSlot(a, b) {
  if ((a.kind === "standard") !== (b.kind === "standard")) {
    return a.kind === "standard" ? -1 : 1;
  }
  return a.nationalDex - b.nationalDex || a.slot - b.slot;
}

export function searchEntries(entries, rawQuery, limit = 8) {
  const query = normalizeQuery(rawQuery);
  if (!query) return [];

  const compact = query.replace(/\s/g, "");
  if (/^\d{1,4}$/.test(compact)) {
    const nationalDex = Number(compact);
    return entries
      .filter((entry) => entry.nationalDex === nationalDex)
      .sort(byDexThenSlot)
      .slice(0, limit);
  }

  const parts = query.split(" ");
  const ranked = [];
  for (const entry of entries) {
    const hay = haystack(entry);
    let score = 0;
    if (hay === query) score = 100;
    else if (hay.startsWith(query)) score = 80;
    else if (hay.split(" ").some((word) => word.startsWith(query))) score = 70;
    else if (parts.every((part) => hay.includes(part))) score = 55;
    else if (hay.includes(query)) score = 40;
    if (score > 0) ranked.push({ entry, score });
  }

  ranked.sort((a, b) => b.score - a.score || byDexThenSlot(a.entry, b.entry));
  return ranked.slice(0, limit).map((row) => row.entry);
}
