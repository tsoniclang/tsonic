import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node, Type } from "@tsonic/tsts";
import { tsonicRawMemoryOperationFactKey } from "../../pointers/raw-memory/facts.js";
import type { TsonicRawMemoryOperationFact } from "../../pointers/raw-memory/facts.js";

for (const operation of ["raw-to-address-integer", "address-integer-to-raw"] as const) {
  test(`${operation} snapshots require and freeze one coherent address domain`, () => {
    const input: TsonicRawMemoryOperationFact = {
      call: {} as Node, resultType: {} as Type, dataLayoutExpression: {} as Node,
      addressWidth: 64, addressRuntimeBase: "bigint", addressSignedness: "unsigned",
      ...(operation === "raw-to-address-integer"
        ? { operation, rawExpression: {} as Node, rawType: {} as Type }
        : { operation, addressExpression: {} as Node, addressType: {} as Type }),
    };
    const captured = tsonicRawMemoryOperationFactKey.snapshot(input);
    assert.ok(Object.isFrozen(captured));
    assert.equal(captured.call, input.call);
    assert.ok(!Object.isFrozen(input.call));
    assert.ok(tsonicRawMemoryOperationFactKey.equals(captured, tsonicRawMemoryOperationFactKey.snapshot(input)));
    for (const patch of [
      { addressWidth: undefined }, { addressRuntimeBase: undefined }, { addressSignedness: undefined },
      { addressWidth: 32 }, { addressRuntimeBase: "number" }, { addressSignedness: "signed" },
      { addressWidth: 128 }, { addressRuntimeBase: "object" }, { unexpected: true },
    ]) {
      const mutated = { ...input, ...patch } as TsonicRawMemoryOperationFact;
      assert.throws(() => tsonicRawMemoryOperationFactKey.snapshot(mutated));
      assert.ok(!tsonicRawMemoryOperationFactKey.equals(captured, mutated));
    }
    const narrow = tsonicRawMemoryOperationFactKey.snapshot({ ...input, addressWidth: 32, addressRuntimeBase: "number" });
    assert.ok(!tsonicRawMemoryOperationFactKey.equals(captured, narrow));
    const otherAbi = { ...input, dataLayoutExpression: {} as Node };
    assert.ok(!tsonicRawMemoryOperationFactKey.equals(captured, tsonicRawMemoryOperationFactKey.snapshot(otherAbi)));
    for (const field of ["addressWidth", "addressRuntimeBase", "addressSignedness"]) {
      let invoked = false;
      const accessor = Object.defineProperty({ ...input }, field, { get() { invoked = true; return 64; } });
      assert.throws(() => tsonicRawMemoryOperationFactKey.snapshot(accessor));
      assert.equal(invoked, false);
    }
  });
}
