import assert from "node:assert/strict";
import { globSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function importPackageUnitTests(packageRoot) {
  const sources = globSync("src/**/*.test.ts", { cwd: packageRoot }).sort();
  assert.ok(sources.length > 0, `No authored unit tests found in ${packageRoot}.`);
  for (const source of sources) {
    const compiled = resolve(packageRoot, source.replace(/^src\//u, "dist/").replace(/\.ts$/u, ".js"));
    await import(pathToFileURL(compiled).href);
  }
}
