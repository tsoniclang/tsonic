import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { orderingOraclePrograms } from "./ordering.mjs";
import { streamOraclePrograms } from "./streams.mjs";

export const nodeOraclePrograms = Object.freeze([...streamOraclePrograms, ...orderingOraclePrograms]);

export function oracleOutputLines(stdout) {
  return stdout.trim() === "" ? [] : stdout.trimEnd().split(/\r?\n/u);
}

export function assertOracleOutput(program, target, stdout) {
  assert.equal(["node", "rust", "csharp"].includes(target), true, "an explicit oracle target is required");
  const expected = target === "node" ? program.nodeOutput : program.divergence?.output ?? program.nodeOutput;
  assert.deepEqual(oracleOutputLines(stdout), expected, `${program.id}: ${target} complete output`);
}

export function runNodeOracle(program) {
  const executed = spawnSync(process.execPath, ["--input-type=module-typescript", "--unhandled-rejections=strict"], {
    input: program.source, encoding: "utf8", timeout: 60_000, maxBuffer: 1_048_576,
  });
  assert.equal(executed.error === undefined, true, `${program.id}: Node starts and completes within its bound`);
  assert.equal(executed.status, 0, `${program.id}: ${executed.stderr}`);
  assertOracleOutput(program, "node", executed.stdout);
  return executed.stdout;
}
