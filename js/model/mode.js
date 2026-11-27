export const NORMAL_MODE = "normal";
export const SHINY_MODE = "shiny";

export function normalizeMode(value) {
  return value === SHINY_MODE ? SHINY_MODE : NORMAL_MODE;
}

export function isShinyMode(mode) {
  return mode === SHINY_MODE;
}
