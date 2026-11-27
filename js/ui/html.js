const TYPE_INK = {
  normal: "#2a2618",
  fire: "#ffffff",
  water: "#ffffff",
  electric: "#3d3204",
  grass: "#ffffff",
  ice: "#16323a",
  fighting: "#ffffff",
  poison: "#ffffff",
  ground: "#3d3204",
  flying: "#ffffff",
  psychic: "#ffffff",
  bug: "#2a2618",
  rock: "#2a2416",
  ghost: "#ffffff",
  dragon: "#ffffff",
  dark: "#ffffff",
  steel: "#1c2b33",
  fairy: "#3d3204",
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

export function typePill(type) {
  const ink = TYPE_INK[type] ?? "#ffffff";
  return `<span class="type-pill type-${escapeHtml(type)}" style="color:${ink}">${escapeHtml(type)}</span>`;
}

export function gamePill(game) {
  return `<span class="game-pill" style="background:${escapeHtml(game.color)};color:${escapeHtml(game.ink)}">${escapeHtml(game.short)}</span>`;
}
