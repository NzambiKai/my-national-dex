const STORAGE_KEY = "nld.preferences";

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePreferences(partial) {
  const next = { ...loadPreferences(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
