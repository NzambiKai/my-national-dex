export function loadDexData(source) {
  const data = new Function(`${source}\n; return dexData;`)();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("box-order dexData did not load");
  }
  return data;
}
