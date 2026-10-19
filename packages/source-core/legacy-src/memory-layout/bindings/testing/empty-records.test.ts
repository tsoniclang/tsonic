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
      const layout = memorylayout<${type}>({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, fields: [] });
      const value = bindmemoryrecord(layout);
    `);
    const call = memoryCall(checked, "bindmemoryrecord");
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
    const blank = memoryfield({ select: (value: typeof schema) => value.blank, byteoffset: 0, bytealignment: 1, fieldlayout: emptyLayout });
    const layout = memorylayout<typeof schema>({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, fields: [blank] });
    let original: Empty = bindmemoryrecord(emptyLayout);
    const view = viewptr<Empty, {}>(addressof(original),
      () => bindmemoryrecord(emptyLayout), value => { original = value; });
    const result = bindmemoryrecord(layout, bindmemoryfield(blank, view));
  `, {
    "/src/empty.ts": `
      import { abi } from "test:abi";
      import { memorylayout } from "@tsonic/core/lang.js";
      export type Empty = {};
      export const emptyLayout = memorylayout<Empty>({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, fields: [] });
    `,
  });
  const calls = memoryCalls(checked, "bindmemoryrecord");
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
      const layout = memorylayout<${type}>({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, fields: [] });
      bindmemoryrecord(layout);
    `);
    assert.equal(checked.diagnostics.filter(Boolean).length, 0);
    assert.ok(checked.extensionDiagnostics.some(diagnostic =>
      diagnostic.extensionCode === "SOURCE_CORE_MEMORY_RECORD_BINDING_NOT_PROVEN"));
    assert.equal(checked.sourceFacts.getFact(memoryCall(checked, "bindmemoryrecord"), tsonicMemoryRecordBindingFactKey), undefined);
  });
}
