import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const cliRoot = resolve(import.meta.dirname, "../../../packages/cli");
const packageJson = JSON.parse(
  readFileSync(resolve(cliRoot, "package.json"), "utf8"),
);

test("the CLI package exposes one executable ESM entrypoint", () => {
  assert.deepEqual(packageJson.bin, { tsonic: "./dist/src/index.js" });
  const entrypoint = resolve(cliRoot, packageJson.bin.tsonic);
  assert.equal(
    readFileSync(entrypoint, "utf8").startsWith("#!/usr/bin/env node\n"),
    true,
  );
  assert.notEqual(statSync(entrypoint).mode & 0o111, 0);
});

test("the project creator package exposes one executable ESM entrypoint", () => {
  const creatorRoot = resolve(import.meta.dirname, "../../../packages/create-tsonic");
  const creatorPackageJson = JSON.parse(
    readFileSync(resolve(creatorRoot, "package.json"), "utf8"),
  );
  assert.deepEqual(creatorPackageJson.bin, {
    "create-tsonic": "./dist/src/index.js",
  });
  const entrypoint = resolve(creatorRoot, creatorPackageJson.bin["create-tsonic"]);
  assert.equal(readFileSync(entrypoint, "utf8").startsWith("#!/usr/bin/env node\n"), true);
  assert.notEqual(statSync(entrypoint).mode & 0o111, 0);
});
