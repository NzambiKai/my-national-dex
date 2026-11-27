export function buildRegions(boxFile) {
  return (boxFile.regions ?? []).map((region) => {
    const boxes = region.group
      ? boxFile.boxes.filter((box) => box.group === region.group)
      : boxFile.boxes.filter(
          (box) => box.group === "standard" && box.number >= region.from && box.number <= region.to,
        );
    return { id: region.id, label: region.label, boxes };
  });
}

export function regionContaining(regions, box, preferredId) {
  if (!box) return regions[0] ?? null;
  const matches = regions.filter((region) => region.boxes.some((item) => item.id === box.id));
  return matches.find((region) => region.id === preferredId) ?? matches[0] ?? regions[0] ?? null;
}
