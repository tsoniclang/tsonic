import assert from "node:assert/strict";

import { test } from "node:test";

import { readTsonicDataLayout, readTsonicRawMemoryOperation } from "../readers.js";

import { memoryCalls } from "./fixtures.js";

import { addressSession, assertClean } from "./address-integers-fixtures.js";

for (const width of [32, 64] as const){
for (const byteOrder of ["little", "big"] as const){
test(`${width}-bit ${byteOrder}-endian addresses retain an exact unsigned source result and operand`, () => {
      const type = `uint${width}`;
      const checked = addressSession(`
        const address: ${type} = rawptrtoaddressinteger<${type}>(raw, abi);
        const result: RawPointer | undefined = addressintegertorawptr(address, abi);
        const explicitlySelected = addressintegertorawptr<${type}>(address, abi);
      `, width, byteOrder);
      assertClean(checked);
      const sourceFile = checked.getSourceFile("/src/index.ts");
      assert.ok(sourceFile);
      const { checker } = checked.getSourceFileQueries(sourceFile);
      for (const name of ["rawptrtoaddressinteger", "addressintegertorawptr"] as const) {
        for (const call of memoryCalls(checked, name)) {
          const fact = readTsonicRawMemoryOperation(checked.sourceFacts, call);
          assert.ok(fact?.operation === "raw-to-address-integer" || fact?.operation === "address-integer-to-raw");
          assert.ok(fact.call === call);
          assert.equal(fact.addressWidth, width);
          assert.equal(fact.addressRuntimeBase, width === 32 ? "number" : "bigint");
          assert.equal(fact.addressSignedness, "unsigned");
          const layout = readTsonicDataLayout(checked.sourceFacts, fact.dataLayoutExpression);
          assert.equal(layout?.addressWidth, width);
          assert.equal(layout?.byteOrder, byteOrder);
          const selection = checker.getResolvedCallInfo(call);
          assert.equal(selection?.outcome, "applicable");
          assert.ok(fact.resultType === selection?.sourceResultType);
          if (fact.operation === "raw-to-address-integer") {
            assert.equal(checker.typeToString(fact.resultType), width === 32 ? "number" : "bigint");
            assert.ok(fact.rawExpression === selection?.sourceArguments[0]?.expression);
            assert.ok(fact.rawType === selection?.sourceArguments[0]?.type);
          } else {
            assert.ok(fact.addressExpression === selection?.sourceArguments[0]?.expression);
            assert.ok(fact.addressType === selection?.sourceArguments[0]?.type);
          }
          assert.ok(Object.isFrozen(fact));
        }
      }
    });
}
}

for (const [width, values] of [
  [32, ["0", "2147483648", "4294967295"]],
  [64, ["0n", "9007199254740991n", "9007199254740992n", "9007199254740993n", "18446744073709551615n"]],
] as const){
test(`${width}-bit address constants preserve the complete unsigned range`, () => {
    const source = values.map((value, index) => `
      const address${index}: uint${width} = ${value};
      addressintegertorawptr(address${index}, abi);
      addressintegertorawptr<uint${width}>(${value}, abi);
    `).join("\n");
    const checked = addressSession(source, width);
    assertClean(checked);
    const calls = memoryCalls(checked, "addressintegertorawptr");
    assert.equal(calls.length, values.length * 2);
    for (const call of calls) {
      const fact = readTsonicRawMemoryOperation(checked.sourceFacts, call);
      assert.ok(fact?.operation === "address-integer-to-raw");
      assert.equal(fact.addressWidth, width);
      assert.ok(fact.addressExpression === checked.ast.arguments(call)[0]);
    }
  });
}

test("address domains survive parameters, fields, returns, selected producers and immutable aliases", () => {
  const checked = addressSession(`
    import { rawptrtoaddressinteger as address } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    import type { uint64 as Word } from "@tsonic/core/types.js";
    import type * as types from "@tsonic/core/types.js";
    type Address = Word;
    interface State { address: Address; }
    declare const state: State;
    declare function read(): Address;
    function pass(value: Address) { return addressintegertorawptr(value, abi); }
    const copied = state.address;
    addressintegertorawptr(copied, abi);
    addressintegertorawptr(read(), abi);
    const result = address<Address>(raw, abi);
    const alias = result;
    core.addressintegertorawptr(alias, abi);
    core.addressintegertorawptr(core.rawptrtoaddressinteger<types.uint64>(raw, abi), abi);
  `, 64);
  assertClean(checked);
  for (const call of memoryCalls(checked, "addressintegertorawptr")) {
    const fact = readTsonicRawMemoryOperation(checked.sourceFacts, call);
    assert.ok(fact?.operation === "address-integer-to-raw");
    assert.equal(fact.addressWidth, 64);
    assert.equal(fact.addressRuntimeBase, "bigint");
  }
  assert.equal(memoryCalls(checked, "addressintegertorawptr").length, 5);
});

for (const width of [32, 64] as const){
const marker = `uint${width}`;

const wrappers = [
    (value: string) => `(${value} as ${marker})`,
    (value: string) => `(${value} satisfies ${marker})`,
    (value: string) => `(<${marker}>(${value}))`,
    (value: string) => `(${value})!`,
  ];

for (const valid of [true, false]){
test(`${width}-bit address bounds ${valid ? "accept" : "reject"} constants through erasing wrappers`, () => {
      const values = width === 32
        ? valid ? ["0", "4294967295"] : ["-1", "1.5", "1e309", "4294967296"]
        : valid ? ["0n", "9007199254740993n", "18446744073709551615n"] : ["-1n", "18446744073709551616n"];
      const expressions = values.flatMap((value) => wrappers.map((wrap) => wrap(value)));
      const source = expressions.map((expression) => `addressintegertorawptr<${marker}>(${expression}, abi);`).join("\n");
      const checked = addressSession(source + `
        const original = ${expressions[expressions.length - 1]};
        const alias = original;
        addressintegertorawptr<${marker}>(((alias as ${marker}) satisfies ${marker})!, abi);
      `, width);
      assert.equal(checked.diagnostics.filter((entry) => entry !== undefined).length, 0);
      const calls = memoryCalls(checked, "addressintegertorawptr");
      assert.equal(calls.length, expressions.length + 1);
      if (valid) assertClean(checked);
      else {
        assert.equal(checked.extensionDiagnostics.length, calls.length);
        assert.ok(checked.extensionDiagnostics.every((entry) => entry.extensionCode === "SOURCE_CORE_MEMORY_ADDRESS_INTEGER_NOT_PROVEN"));
      }
      for (const call of calls) {
        const fact = readTsonicRawMemoryOperation(checked.sourceFacts, call);
        if (valid) {
          assert.ok(fact?.operation === "address-integer-to-raw");
          assert.equal(fact.addressWidth, width);
          assert.ok(fact.addressExpression === checked.ast.arguments(call)[0]);
        } else assert.equal(fact, undefined);
      }
    });
}
}
