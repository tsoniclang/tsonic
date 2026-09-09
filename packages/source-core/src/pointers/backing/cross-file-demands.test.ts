import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import type { ReadonlySourceFactResolver } from "@tsonic/tsts";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { assertMemoryDiagnostics, memoryCalls, memorySession } from "../../memory-layout/testing/fixtures.js";
import { readTsonicMemoryType, tsonicMemoryTypeFactKey } from "../../memory-layout/type-contract/facts.js";
import { tsonicDataLayoutFactKey } from "../../memory-layout/facts.js";
import { selectTsonicRawLocationOperation } from "../raw-memory/selection.js";
import { createTsonicPointerBackingDemands } from "./demands.js";

const prelude = `
import { abi } from "test:abi";
import type { Pointer, uint32 } from "@tsonic/core/types.js";
import { allocatePointer, memoryLayout, memoryField, toRawPointer } from "@tsonic/core/lang.js";
import type { Inner, Outer } from "./types.js";
`;

function recordLayout(options: {
  readonly childStride?: number;
  readonly offset?: number;
  readonly alignment?: number;
  readonly swapped?: boolean;
} = {}): string {
  return `
    const word = memoryLayout<uint32>(abi, 4, 4, ${options.childStride ?? 4});
    const inner = memoryLayout<Inner>(abi, 8, 4, 8,
      memoryField((value: Inner) => value.${options.swapped ? "second" : "first"}, 0, 4, word),
      memoryField((value: Inner) => value.${options.swapped ? "first" : "second"}, 4, 4, word));
    const layout = memoryLayout<Outer>(abi, 16, 8, 16,
      memoryField((value: Outer) => value.inner, ${options.offset ?? 0}, ${options.alignment ?? 4}, inner));
  `;
}

function session(local: string, remote: string, type: string, value: string) {
  const checked = memorySession(prelude + `
    import { remote } from "./barrel.js";
    ${local}
    const alias = remote;
    const pointer = allocatePointer<${type}>(${value});
    toRawPointer(pointer, layout);
    toRawPointer(pointer, alias);
  `, { extraFiles: {
    "/src/layout.ts": prelude + remote + "\nexport { layout as remote };",
    "/src/barrel.ts": 'export { remote } from "./layout.js";',
    "/src/types.ts": `import type { uint32 } from "@tsonic/core/types.js";
      export interface Inner { first: uint32; second: uint32 }
      export interface Outer { inner: Inner }`,
  } });
  const diagnostics = checked.diagnostics.filter(entry => entry !== undefined);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  assertMemoryDiagnostics(checked);
  const source = createTargetSourceProgram(checked);
  const calls = memoryCalls(checked, "toRawPointer");
  assert.equal(calls.length, 2);
  const layouts = calls.map(call => {
    const selected = selectTsonicRawLocationOperation(source.ast, source.sourceFacts, call);
    assert.ok(selected?.kind === "resolved");
    return selected.layout;
  });
  return { source, calls, layouts };
}

const scalar = "const layout = memoryLayout<uint32>(abi, 4, 4, 4);";
const cases = [
  ["scalar", scalar, "uint32", "3"],
  ["nullable pointer", "const layout = memoryLayout<Pointer<uint32> | undefined>(abi, 8, 8, 8);",
    "Pointer<uint32> | undefined", "allocatePointer<uint32>(3)"],
  ["nested record", recordLayout(), "Outer", "{ inner: { first: 1, second: 2 } }"],
] as const;

for (const [name, layout, type, value] of cases) {
  test(`cross-file ${name} backing demands share one origin in either discovery order`, () => {
    const { source, calls, layouts } = session(layout, layout, type, value);
    const left = readTsonicMemoryType(source.sourceFacts, layouts[0]!.call);
    const right = readTsonicMemoryType(source.sourceFacts, layouts[1]!.call);
    assert.ok(left && right);
    assert.equal(left.identity, right.identity);
    if (name !== "nested record") assert.notEqual(left.sourceType, right.sourceType);
    else {
      const first = layouts[0]!.fields[0]!.fieldLayout.fields[0]!;
      const second = layouts[1]!.fields[0]!.fieldLayout.fields[0]!;
      assert.equal(first.selectedDeclaration, second.selectedDeclaration);
      assert.notEqual(first.fieldType, second.fieldType);
    }
    for (const order of [calls, [...calls].reverse()]) {
      const demands = createTsonicPointerBackingDemands(source);
      for (const call of order) {
        demands.record(call);
        demands.record(call);
      }
      assert.deepEqual(demands.issues().map(issue => issue.reason), []);
      assert.equal(demands.entries().length, 1);
      assert.equal(demands.entries()[0]!.origin.operation, "allocate");
    }
  });
}

for (const [name, local, remote, type, value] of [
  ["size", scalar, "const layout = memoryLayout<uint32>(abi, 8, 4, 8);", "uint32", "3"],
  ["alignment", scalar, "const layout = memoryLayout<uint32>(abi, 4, 2, 4);", "uint32", "3"],
  ["stride", scalar, "const layout = memoryLayout<uint32>(abi, 4, 4, 8);", "uint32", "3"],
  ...([
    ["nested stride", { childStride: 8 }],
    ["field offset", { offset: 4 }],
    ["field alignment", { alignment: 2 }],
    ["selected field declaration", { swapped: true }],
  ] as const).map(([name, options]) => [name, recordLayout(), recordLayout(options),
    "Outer", "{ inner: { first: 1, second: 2 } }"] as const),
] as const) {
  test(`cross-file backing demands preserve exact ${name} conflicts in either order`, () => {
    const { source, calls } = session(local, remote, type, value);
    for (const order of [calls, [...calls].reverse()]) {
      const demands = createTsonicPointerBackingDemands(source);
      for (const call of order) demands.record(call);
      assert.deepEqual(demands.issues().map(issue => issue.reason), [
        "One pointer origin has incompatible physical layout demands.",
      ]);
      assert.equal(demands.entries().length, 1);
      assert.equal(demands.issues()[0]!.node, order[1]);
    }
  });
}

test("backing reconciliation cannot accept missing, relocated, forged or foreign memory witnesses or a stale ABI", () => {
  const { source, calls, layouts } = session(scalar, scalar, "uint32", "3");
  const remote = layouts[1]!;
  const contract = readTsonicMemoryType(source.sourceFacts, remote.call)!;
  const foreign = session(scalar, scalar, "uint32", "3");
  const foreignContract = readTsonicMemoryType(foreign.source.sourceFacts, foreign.layouts[1]!.call)!;
  for (const mutation of ["missing", "relocated", "forged", "foreign", "stale-abi"]) {
    const facts: ReadonlySourceFactResolver = {
      ...source.sourceFacts,
      getFact(subject, key) {
        const fact = source.sourceFacts.getFact(subject, key);
        if (Object.is(key, tsonicMemoryTypeFactKey) && subject === remote.call) {
          if (mutation === "missing") return undefined;
          if (mutation === "relocated") return { ...contract, call: layouts[0]!.call } as typeof fact;
          if (mutation === "forged") return { ...contract, identity: Object.freeze({}) } as typeof fact;
          if (mutation === "foreign") return { ...contract, identity: foreignContract.identity } as typeof fact;
        }
        if (mutation === "stale-abi" && Object.is(key, tsonicDataLayoutFactKey) && subject === remote.dataLayoutExpression) {
          return { ...remote.dataLayout, fingerprint: "stale-abi" } as typeof fact;
        }
        return fact;
      },
    };
    const demands = createTsonicPointerBackingDemands({ ...source, sourceFacts: facts });
    for (const call of calls) demands.record(call);
    assert.equal(demands.entries().length, 1, mutation);
    assert.equal(demands.issues().length, 1, mutation);
    assert.equal(demands.issues()[0]!.node, calls[1], mutation);
    assert.equal(selectTsonicRawLocationOperation(source.ast, facts, calls[1]!)?.kind, "rejected", mutation);
  }
});
