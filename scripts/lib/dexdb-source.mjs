import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Committed snapshot of the original box-order reference. */
export const DEXDB_SNAPSHOT = "data/sources/dexdb.js";

const URL_FILE = "data/sources/dexdb.url";

/**
 * Optional address for refreshing the snapshot.
 * Set DEXDB_URL, or put one address on the first non-comment line of the
 * gitignored file data/sources/dexdb.url. The address is not stored in the repo.
 */
export async function readDexdbUrl(root) {
  const fromEnv = process.env.DEXDB_URL?.trim();
  if (fromEnv) return fromEnv;
  try {
    const text = await readFile(join(root, URL_FILE), "utf8");
    const line = text
      .split(/\r?\n/)
      .map((item) => item.trim())
      .find((item) => item && !item.startsWith("#"));
    return line || null;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
