import assert from "node:assert/strict";
import { test } from "node:test";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import { cleanMemorySession, memoryCall } from "../../memory-layout/testing/fixtures.js";
import { createTsonicPointerBackingDemands } from "./demands.js";
import { selectTsonicRawLocationOperation } from "../raw-memory/selection.js";
import { tsonicRawMemoryOperationFactKey } from "../raw-memory/facts.js";
import { tsonicDataLayoutFactKey } from "../../memory-layout/facts.js";

function collect(text: string) {
  const checked = cleanMemorySession('import { allocateptr, addressof } from "@tsonic/core/lang.js";\n' + text);
  const source = createTargetSourceProgram(checked);
  const demands = createTsonicPointerBackingDemands(source);
  function visit(node: import("@tsonic/tsts").Node): void {
    demands.record(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  }
  for (const file of source.navigation.sourceFiles) visit(file);
  return { checked, source, demands };
}

test("raw demands close local pointer parameters and return paths without selecting a target representation", () => {
  const { demands } = collect(`
    function pass(pointer: Pointer<uint32>): Pointer<uint32> { return pointer; }
    let value: uint32 = 1;
    const pointer = addressof(value);
    torawptr(pass(pointer), uint32Layout);
  `);
  assert.deepEqual(demands.issues(), []);
  assert.equal(demands.entries().length, 1);
  assert.equal(demands.entries()[0]!.origin.operation, "address-of");
  assert.equal(demands.entries()[0]!.layout.byteSize, 4);
});

test("raw demands reject exported caller boundaries including export-list aliases", () => {
  for (const exports of ["export { expose };", "export { expose as publicCall };"]) {
    const { demands } = collect(`
      function expose(pointer: Pointer<uint32>) { return torawptr(pointer, uint32Layout); }
      ${exports}
      expose(allocateptr<uint32>(1));
    `);
    assert.ok(demands.issues().some(issue => issue.reason.includes("open caller boundary")));
  }
});

test("one origin cannot silently choose the first incompatible layout demand", () => {
  const { demands } = collect(`
    const pointer = allocateptr<uint32>(1);
    const other = memorylayout<uint32>({ datalayout: abi, bytesize: 8, bytealignment: 4, stride: 8, fields: [] });
    torawptr(pointer, uint32Layout);
    torawptr(pointer, other);
  `);
  assert.ok(demands.issues().some(issue => issue.reason.includes("incompatible physical layout")));
});

test("one physical origin reconciles nested child layouts rather than only parent extents", () => {
  for (const stride of [4, 8]) {
    const { demands } = collect(`
      interface RecordValue { value: uint32 }
      const child = memorylayout<uint32>({ datalayout: abi, bytesize: 4, bytealignment: 4, stride: ${stride}, fields: [] });
      const first = memorylayout<RecordValue>({
        datalayout: abi,
        bytesize: 4,
        bytealignment: 4,
        stride: 4,
        fields: [memoryfield({ select: (record: RecordValue) => record.value, byteoffset: 0, bytealignment: 4, fieldlayout: uint32Layout })],
      });
      const second = memorylayout<RecordValue>({
        datalayout: abi,
        bytesize: 4,
        bytealignment: 4,
        stride: 4,
        fields: [memoryfield({ select: (record: RecordValue) => record.value, byteoffset: 0, bytealignment: 4, fieldlayout: child })],
      });
      const pointer = allocateptr<RecordValue>({ value: 1 });
      torawptr(pointer, first);
      torawptr(pointer, second);
    `);
    assert.equal(demands.issues().some(issue => issue.reason.includes("incompatible physical layout")), stride !== 4);
    assert.equal(demands.entries().length, 1);
  }
});

test("raw location selection retains inferred pointee evidence and rejects moved calls and stale ABI facts", () => {
  const { checked, source } = collect("const pointer = reinterpretrawptr(undefined, uint32Layout);");
  const call = memoryCall(checked, "reinterpretrawptr");
  const selected = selectTsonicRawLocationOperation(source.ast, source.sourceFacts, call);
  assert.equal(selected?.kind, "resolved");
  if (selected?.kind !== "resolved" || selected.operation.operation !== "reinterpret") return;
  assert.equal(selected.operation.explicitPointeeTypeNode, undefined);
  assert.ok(selected.operation.pointeeType);
  for (const mutation of ["call", "abi"]) {
    const facts: typeof source.sourceFacts = {
      ...source.sourceFacts,
      getFact(subject, key) {
        const fact = source.sourceFacts.getFact(subject, key);
        if (Object.is(key, tsonicRawMemoryOperationFactKey) && subject === call && mutation === "call") {
          return { ...selected.operation, call: selected.layout.call } as typeof fact;
        }
        if (Object.is(key, tsonicDataLayoutFactKey) && fact !== undefined && mutation === "abi") {
          return { ...selected.layout.dataLayout, fingerprint: "changed-abi" } as typeof fact;
        }
        return fact;
      },
    };
    assert.equal(selectTsonicRawLocationOperation(source.ast, facts, call)?.kind, "rejected");
  }
});
