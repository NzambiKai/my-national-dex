import { isShinyMode } from "./mode.js";

export const BOXES_PER_SPACE = 30;

export function padDex(number) {
  return String(number).padStart(4, "0");
}

export function homeRange(box) {
  if (box?.dexStart == null || box?.dexEnd == null) return box?.rangeLabel ?? "";
  return `${padDex(box.dexStart)} - ${padDex(box.dexEnd)}`;
}

export function shinyBoxName(box) {
  if (!box) return "";
  if (box.group === "alt") return `S Alt ${box.number}`;
  if (box.dexStart == null || box.dexEnd == null) return `S ${box.rangeLabel ?? box.title ?? box.number}`;
  return `S ${padDex(box.dexStart)}-${padDex(box.dexEnd)}`;
}

export function boxHeading(box, mode = "normal") {
  if (!box) return "";
  if (isShinyMode(mode)) return shinyBoxName(box);
  if (box.group === "alt") return `Alt ${box.number}`;
  return `Box ${box.number} · ${homeRange(box)}`;
}

export function spaceTileName(box, mode = "normal") {
  if (isShinyMode(mode)) return shinyBoxName(box);
  if (box.group === "alt") return `Alt ${box.number}`;
  return String(box.number);
}

function spaceSummary(boxes, mode = "normal") {
  const shiny = isShinyMode(mode);
  const standard = boxes.filter((box) => box.group === "standard");
  const alt = boxes.filter((box) => box.group !== "standard");
  const parts = [];
  if (standard.length) {
    const start = padDex(standard[0].dexStart);
    const end = padDex(standard[standard.length - 1].dexEnd);
    parts.push(shiny ? `S ${start}-${end}` : `${start} - ${end}`);
  }
  if (alt.length === 1) parts.push(shiny ? `S Alt ${alt[0].number}` : `Alt ${alt[0].number}`);
  else if (alt.length > 1) {
    const span = `${alt[0].number}–${alt[alt.length - 1].number}`;
    parts.push(shiny ? `S Alt ${span}` : `Alt ${span}`);
  }
  return parts.join(" · ");
}

export function spaceLabel(space, mode = "normal") {
  if (!space) return "";
  if (isShinyMode(mode)) return spaceSummary(space.boxes, mode);
  return space.label;
}

export function buildBoxSpaces(boxes, perSpace = BOXES_PER_SPACE) {
  const standard = boxes
    .filter((box) => box.group === "standard")
    .sort((a, b) => a.number - b.number);
  const rest = boxes
    .filter((box) => box.group !== "standard")
    .sort((a, b) => String(a.group).localeCompare(String(b.group)) || a.number - b.number);
  const ordered = [...standard, ...rest];
  const chunks = [];
  for (let index = 0; index < ordered.length; index += perSpace) {
    chunks.push(ordered.slice(index, index + perSpace));
  }
  return chunks.map((slice, index) => ({
    index,
    number: index + 1,
    total: chunks.length,
    boxes: slice,
    label: spaceSummary(slice),
  }));
}

export function spaceIndexForBox(spaces, boxId) {
  const index = spaces.findIndex((space) => space.boxes.some((box) => box.id === boxId));
  return index < 0 ? 0 : index;
}
