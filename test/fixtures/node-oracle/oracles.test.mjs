import assert from "node:assert/strict";
import test from "node:test";
import { nodeOraclePrograms, assertOracleOutput, runNodeOracle } from "./index.mjs";

test("shared Node oracles retain exactly six stream and five ordering programs", () => {
  assert.equal(nodeOraclePrograms.length, 11);
  assert.equal(new Set(nodeOraclePrograms.map(program => program.id)).size, 11);
  assert.equal(nodeOraclePrograms.filter(program => program.family === "streams").length, 6);
  assert.deepEqual(nodeOraclePrograms.filter(program => program.family === "ordering").map(program => program.id),
    ["entryExportAndCall", "entryTopLevelOnly", "thenTiming", "storedAwaitTiming", "fireAndForget"]);
  assert.deepEqual(nodeOraclePrograms.filter(program => program.divergence !== undefined).map(program =>
    [program.id, program.divergence.id]), [["storedAwaitTiming", "D10"], ["fireAndForget", "D10"]]);
});

for (const program of nodeOraclePrograms) {
  test(`shared Node oracle ${program.id} retains its complete observations`, { timeout: 65_000 }, () => {
    runNodeOracle(program);
  });
}

test("oracle comparisons reject missing, duplicated, reordered and unapproved observations", () => {
  const program = nodeOraclePrograms.find(program => program.id === "thenTiming");
  for (const target of ["node", "rust", "csharp"]) {
    for (const stdout of ["after\n", "after\ncallback\ncallback\n", "callback\nafter\n"]) {
      assert.throws(() => assertOracleOutput(program, target, stdout), { code: "ERR_ASSERTION" });
    }
  }
  assert.throws(() => assertOracleOutput(program, "unregistered", "after\ncallback\n"), { code: "ERR_ASSERTION" });
});
