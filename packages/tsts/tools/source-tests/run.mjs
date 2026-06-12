#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = join(dirname(scriptPath), "../../../..");
const testRoot = join(repoRoot, "packages/tsts/dist/src");

async function collectTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const tests = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      tests.push(...await collectTests(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.js")) {
      tests.push(fullPath);
    }
  }
  return tests;
}

try {
  const rootStat = await stat(testRoot);
  if (!rootStat.isDirectory()) {
    throw new Error(`${relative(repoRoot, testRoot)} is not a directory`);
  }
} catch (error) {
  console.error(`Built source tests were not found under ${relative(repoRoot, testRoot)}.`);
  console.error("Run `npx tsc -p packages/tsts/tsconfig.json` before `npm run source:test`.");
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}

const tests = (await collectTests(testRoot)).sort();
if (tests.length === 0) {
  console.error(`No built source tests found under ${relative(repoRoot, testRoot)}.`);
  process.exit(1);
}

console.log(`Running ${tests.length} built source tests.`);
const child = spawn(process.execPath, ["--test", ...tests], {
  cwd: repoRoot,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal !== null) {
    console.error(`source tests terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
