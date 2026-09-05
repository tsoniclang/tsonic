import assert from "node:assert/strict";
import { globSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function importPackageUnitTests(packageRoot) {
  const sources = globSync("src/**/*.test.ts", { cwd: packageRoot }).sort();
  assert.ok(sources.length > 0, `No authored unit tests found in ${packageRoot}.`);
  for (const source of sources) {
    const relativeSource = relative(resolve(packageRoot, "src"), resolve(packageRoot, source));
    const compiled = resolve(packageRoot, "dist", relativeSource.replace(/\.ts$/u, ".js"));
    await import(pathToFileURL(compiled).href);
  }
}
