import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("safety application readers require complete compiler-owned fact contracts", () => {
  const directory = resolve(".temp/test-runs/safety-application-contracts", `${Date.now()}-${process.pid}`);
  mkdirSync(directory, { recursive: true });
  const owner = fileURLToPath(new URL("../../packages/target-api/dist/public/analysis.js", import.meta.url));
  const configuration = resolve(directory, "tsconfig.json");
  writeFileSync(configuration, JSON.stringify({ compilerOptions: { noEmit: true, strict: true, skipLibCheck: true,
    target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", types: ["node"] }, files: ["consumer.ts"] }));
  const check = source => {
    writeFileSync(resolve(directory, "consumer.ts"), `
      import type { TargetSafetyApplicationFact, TargetSafetyApplicationIndexInput } from ${JSON.stringify(owner)};
      ${source}
    `);
    const result = spawnSync(resolve("node_modules/.bin/tsgo"), ["--project", configuration, "--pretty", "false"],
      { encoding: "utf8", timeout: 60_000, maxBuffer: 65_536 });
    assert.equal(result.error === undefined, true, "the real compiler finishes inside the process-group guard");
    return result;
  };
  const accepted = check(`export type Input = TargetSafetyApplicationIndexInput<unknown,
    TargetSafetyApplicationFact | { readonly kind: "builder-state"; readonly label: string }>;`);
  assert.equal(accepted.status, 0, accepted.stdout || accepted.stderr);
  const rejected = check(`
    export type Incomplete = TargetSafetyApplicationIndexInput<unknown, { readonly kind: "application" }>;
    export type Unrecognized = TargetSafetyApplicationIndexInput<unknown, { readonly kind: "unrecognized" }>;
  `);
  assert.equal(rejected.status, 1, rejected.stdout || rejected.stderr);
  const diagnostics = rejected.stdout.split("\n").filter(line => line.includes("error TS"));
  assert.equal(diagnostics.length, 2, rejected.stdout.slice(0, 8192));
  assert.equal(diagnostics.every(line => line.includes("error TS2344:") && line.includes("TargetSafetyBuilderFact")), true,
    diagnostics.join("\n"));
});
