import assert from "node:assert/strict";
import { test } from "node:test";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { pointerOperationFactKey } from "@tsonic/tsts";
import { cleanMemorySession, memoryCall } from "../../memory-layout/testing/fixtures.js";
import { createTsonicClosedArrayStorageQueries } from "./array-storage.js";

function inspect(body: string, budget = 4096) {
  const checked = cleanMemorySession(`import { addressOf } from "@tsonic/core/lang.js";
    declare function escape(values: uint32[]): void;
    function exercise() {
      let values: uint32[] = [7, 8];
      const alias = values;
      const pointer = addressOf(values[0]);
      ${body}
      return pointer;
    }`);
  const call = memoryCall(checked, "addressOf");
  const fact = checked.sourceFacts.getFact(call, pointerOperationFactKey);
  assert.ok(fact?.operation === "address-of");
  const queries = createTsonicClosedArrayStorageQueries(createTargetSourceProgram(checked), budget);
  const result = queries.resolve(fact.storageExpression);
  assert.equal(queries.resolve(fact.storageExpression), result);
  assert.ok(Object.isFrozen(result));
  return result;
}

test("native array closure includes aliases, replacement literals and every element use", () => {
  const result = inspect("alias[0] = 11; alias[0]++; values = [99]; let other: uint32[] = [1]; other = alias; other[1] += 2;");
  assert.equal(result.kind, "closed");
  if (result.kind !== "closed") return;
  assert.equal(result.declarations.length, 3);
  assert.equal(result.literals.length, 3);
  assert.equal(result.elements.length, 4);
});

for (const [name, body] of [
  ["escape", "escape(alias);"], ["capture", "const read = () => alias[0]; read();"],
  ["resize", "alias.push(9);"], ["deletion", "delete alias[0];"],
  ["wrapped deletion", "delete (alias[0]);"],
  ["assignment-result escape", "escape(values = [1, 2]);"],
  ["sparse replacement", "values = [1, , 3] as uint32[];"],
  ["spread replacement", "values = [...alias];"],
]) test(`native array closure rejects ${name}`, () => assert.equal(inspect(body!).kind, "unproven"));

test("native array closure rejects an exhausted source budget", () => assert.equal(inspect("alias[0] = 1;", 2).kind, "unproven"));
