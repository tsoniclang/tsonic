import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function discoverTestFiles(directory, suffix = ".test.mjs", maximumDepth = Infinity) {
  if (!existsSync(directory)) return [];
  const files = [];
  function visit(current, depth) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory() && depth < maximumDepth) visit(path, depth + 1);
      else if (entry.isFile() && path.endsWith(suffix)) files.push(path);
    }
  }
  visit(directory, 0);
  return files.sort();
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  if (directory === undefined) throw new Error("A test directory is required.");
  const files = discoverTestFiles(directory);
  if (files.length === 0) throw new Error(`No test files were discovered in ${directory}.`);
  process.stdout.write(`${files.join("\0")}\0`);
}
