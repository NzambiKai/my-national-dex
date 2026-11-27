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

export function locationText(box, slot) {
  const { row, column } = slotPosition(slot);
  return `${boxLabel(box)} · Row ${row}, Col ${column} (Slot ${slot})`;
}

export function formatDex(nationalDex) {
  return `#${String(nationalDex).padStart(4, "0")}`;
}
