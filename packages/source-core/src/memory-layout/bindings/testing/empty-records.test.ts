import assert from "node:assert/strict";
import { test } from "node:test";
import { readTsonicMemoryType, selectTsonicMemoryRecordBinding, tsonicMemoryRecordBindingFactKey } from "../../../public/facts.js";
import { memoryCall, memoryCalls, memorySession } from "../../testing/fixtures.js";
import { bindingPrelude, bindingSession } from "./fixtures.js";

for (const [name, declaration, type] of [
  ["anonymous", "", "{}"],
  ["type alias", "type Empty = {};", "Empty"],
  ["type query", "const schema: {} = struct({});", "typeof schema"],
  ["named interface", "interface Empty {}", "Empty"],
] as const) {
  test(`empty ${name} record retains its exact zero-field binding`, () => {
    const checked = bindingSession(`
      import { struct } from "@tsonic/core/lang.js";
      ${declaration}
      const layout = memoryLayout<${type}>(abi, 0, 1, 0);
      const value = bindMemoryRecord(layout);
    `);
    const call = memoryCall(checked, "bindMemoryRecord");
    const selected = selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, call);
    assert.ok(selected?.kind === "resolved");
    assert.deepEqual(selected.operation.fields, []);
    assert.equal(selected.operation.layout.byteSize, 0);
    assert.equal(selected.operation.layout.stride, 0);
    assert.equal(readTsonicMemoryType(checked.sourceFacts, call)?.identity,
      readTsonicMemoryType(checked.sourceFacts, selected.operation.layout.call)?.identity);
    assert.ok(Object.isFrozen(selected.operation.fields));
  });
}

test("cross-file empty aliases and a nested empty pointer view retain record identity", () => {
  const checked = bindingSession(`
    import { struct, field } from "@tsonic/core/lang.js";
    import type { Empty } from "./empty.js";
    import { emptyLayout } from "./empty.js";
    const schema: { blank: {} } = struct({ blank: field<{}>() });
    const blank = memoryField((value: typeof schema) => value.blank, 0, 1, emptyLayout);
    const layout = memoryLayout<typeof schema>(abi, 0, 1, 0, blank);
    let original: Empty = bindMemoryRecord(emptyLayout);
    const view = viewPointer<Empty, {}>(addressOf(original),
      () => bindMemoryRecord(emptyLayout), value => { original = value; });
    const result = bindMemoryRecord(layout, bindMemoryField(blank, view));
  `, {
    "/src/empty.ts": `
      import { abi } from "test:abi";
      import { memoryLayout } from "@tsonic/core/lang.js";
      export type Empty = {};
      export const emptyLayout = memoryLayout<Empty>(abi, 0, 1, 0);
    `,
  });
  const calls = memoryCalls(checked, "bindMemoryRecord");
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(selectTsonicMemoryRecordBinding(checked.ast, checked.sourceFacts, call)?.kind, "resolved");
  }
});

for (const [name, declaration, type] of [
  ["open object", "", "object"],
  ["never", "", "never"],
  ["void", "", "void"],
  ["number", "", "number"],
  ["indexed object", "interface Indexed { [key: string]: uint32 }", "Indexed"],
  ["callable", "type Callable = () => void", "Callable"],
  ["constructor", "type Constructor = new () => {}", "Constructor"],
] as const) {
  test(`a fieldless ${name} is not an empty data record`, () => {
    const checked = memorySession(bindingPrelude + `
      ${declaration}
      const layout = memoryLayout<${type}>(abi, 0, 1, 0);
      bindMemoryRecord(layout);
    `);
    assert.equal(checked.diagnostics.filter(Boolean).length, 0);
    assert.ok(checked.extensionDiagnostics.some(diagnostic =>
      diagnostic.extensionCode === "SOURCE_CORE_MEMORY_RECORD_BINDING_NOT_PROVEN"));
    assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "bindMemoryRecord"), tsonicMemoryRecordBindingFactKey), undefined);
  });
}
