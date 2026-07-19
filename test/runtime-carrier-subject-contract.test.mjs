import assert from "node:assert/strict";
import test from "node:test";

import {
  getRuntimeCarrier,
} from "../packages/host/dist/target-facts/runtime-carriers.js";

const concreteTask = Object.freeze({
  kind: "target-named",
  id: "System.Threading.Tasks.Task",
});

test("host runtime-carrier lookup rejects concrete facts attached to declaration symbols", () => {
  const symbol = fakeSymbol("Task");
  const facts = fakeFacts({
    runtimeCarriers: new Map([[symbol, { carrier: concreteTask }]]),
    selectedCalls: new Map([[symbol, { member: { returnType: concreteTask } }]]),
  });

  assert.equal(getRuntimeCarrier(facts, symbol), undefined);
});

test("host runtime-carrier lookup preserves declaration-invariant source primitives on symbols", () => {
  const symbol = fakeSymbol("int32");
  const facts = fakeFacts({
    sourcePrimitives: new Map([[symbol, { kind: "int32" }]]),
  });

  assert.deepEqual(getRuntimeCarrier(facts, symbol), {
    kind: "source-primitive",
    name: "int32",
  });
});

test("host runtime-carrier lookup consumes concrete facts from exact semantic types", () => {
  const type = { flags: 1, id: 1 };
  const facts = fakeFacts({
    runtimeCarriers: new Map([[type, { carrier: concreteTask }]]),
  });

  assert.deepEqual(getRuntimeCarrier(facts, type), concreteTask);
});

function fakeSymbol(name) {
  return {
    Flags: 1,
    CheckFlags: 0,
    Name: name,
  };
}

function fakeFacts(options = {}) {
  return {
    getRuntimeCarrierFact: (subject) => options.runtimeCarriers?.get(subject),
    getSelectedTargetCall: (subject) => options.selectedCalls?.get(subject),
    getSourcePrimitiveFact: (subject) => options.sourcePrimitives?.get(subject),
  };
}
