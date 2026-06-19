#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = join(dirname(scriptPath), "../../../..");
const testRoot = join(repoRoot, ".temp/source-tests/dist/src");
const testConfig = "packages/tsts/tsconfig.source-tests.json";
const tscPath = join(repoRoot, "node_modules/typescript/bin/tsc");

rmSync(join(repoRoot, ".temp/source-tests"), { recursive: true, force: true });

const build = spawnSync(process.execPath, [tscPath, "-p", testConfig, "--pretty", "false"], {
  cwd: repoRoot,
  stdio: "inherit",
});
if (build.status !== 0 || build.signal !== null) {
  if (build.signal !== null) {
    console.error(`source test build terminated by ${build.signal}`);
  }
  process.exit(build.status ?? 1);
}
cpSync(
  join(repoRoot, "packages/tsts/src/internal/bundled/libs"),
  join(testRoot, "internal/bundled/libs"),
  { recursive: true, force: true },
);

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
  console.error(`Run \`npx tsc -p ${testConfig}\` before inspecting built source tests manually.`);
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
