import { isShinyMode } from "./mode.js";
import { shinyBoxName } from "./spaces.js";

export const COLUMNS = 6;
export const SLOTS_PER_BOX = 30;

export function slotPosition(slot) {
  const index = slot - 1;
  return {
    row: Math.floor(index / COLUMNS) + 1,
    column: (index % COLUMNS) + 1,
    slot,
  };
}

export function standardPlacement(nationalDex) {
  const boxNumber = Math.floor((nationalDex - 1) / SLOTS_PER_BOX) + 1;
  const slot = ((nationalDex - 1) % SLOTS_PER_BOX) + 1;
  return { boxNumber, ...slotPosition(slot) };
}

export function boxLabel(box) {
  return box.group === "alt" ? `Alt Box ${box.number}` : `Box ${box.number}`;
}

export function locationText(box, slot, mode = "normal") {
  const { row, column } = slotPosition(slot);
  const label = isShinyMode(mode) ? shinyBoxName(box) : boxLabel(box);
  return `${label} · Row ${row}, Col ${column} (Slot ${slot})`;
}

export function formatDex(nationalDex) {
  return `#${String(nationalDex).padStart(4, "0")}`;
}
