#!/usr/bin/env node
/**
 * Download Pokémon HOME sprites for every catalog entry.
 *
 * Source (build time only):
 *   https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/other/home
 *   https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/<spriteId>.png
 *
 * The site never requests these URLs. Re-run this after adding entries to data/dex.json.
 *
 *   node scripts/sync-data.mjs
 *   node scripts/sync-data.mjs --force
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");
const sourceBase = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home";

const dex = JSON.parse(await readFile(join(root, "data/dex.json"), "utf8"));
const spriteIds = [...new Set(dex.entries.map((entry) => entry.spriteId))];
const directory = join(root, "assets/sprites");
await mkdir(directory, { recursive: true });

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadSprite(spriteId) {
  const destination = join(directory, `${spriteId}.png`);
  if (!force && (await fileExists(destination))) {
    return "cached";
  }

  const url = `${sourceBase}/${spriteId}.png`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 500 || bytes[0] !== 0x89) {
        throw new Error(`response was not a PNG (${bytes.length} bytes)`);
      }
      await writeFile(destination, bytes);
      return "downloaded";
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw new Error(`${spriteId}: ${lastError.message}`);
}

const queue = [...spriteIds];
let downloaded = 0;
let cached = 0;
const failures = [];

async function worker() {
  while (queue.length > 0) {
    const spriteId = queue.shift();
    try {
      const result = await downloadSprite(spriteId);
      if (result === "downloaded") downloaded += 1;
      else cached += 1;
    } catch (error) {
      failures.push(error.message);
    }
    const done = downloaded + cached + failures.length;
    process.stdout.write(`\r${done}/${spriteIds.length} sprites`);
  }
}

await Promise.all(Array.from({ length: 6 }, () => worker()));
process.stdout.write("\n");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`HOME sprites ready: ${downloaded} downloaded, ${cached} already on disk.`);
}
