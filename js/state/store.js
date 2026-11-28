const STORAGE_KEY = "nld.preferences";

// UI state stays in localStorage so the address bar can stay on the site URL.
// Fields: boxId, selectedId, mode ("normal" | "shiny").
// Older saves may still contain filter and gameId. Those keys are ignored.
const IGNORED_KEYS = ["filter", "gameId"];

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    for (const key of IGNORED_KEYS) delete parsed[key];
    return parsed;
  } catch {
    return {};
  }
}

export function savePreferences(partial) {
  const next = { ...loadPreferences(), ...partial };
  for (const key of IGNORED_KEYS) delete next[key];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
