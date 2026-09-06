import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import type { Node, ReadonlySourceFactResolver, Type } from "@tsonic/tsts";
import {
  maximumMemoryLayoutDepth, snapshotMemoryField, snapshotMemoryLayout,
  tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey,
} from "../facts.js";
import type { TsonicMemoryFieldLayoutFact, TsonicMemoryLayoutFact } from "../facts.js";
import { readTsonicMemoryFieldLayout, readTsonicMemoryLayout, resolveTsonicMemoryLayoutObservation } from "../readers.js";
import { selectTsonicRawLocationOperation } from "../../pointers/raw-memory/selection.js";
import { cleanMemorySession, memoryCall, memorySession, memoryTestPrelude, memoryTestRegistration } from "./fixtures.js";

function scalar(): TsonicMemoryLayoutFact {
  return {
    call: {} as Node, sourceType: {} as Type, dataLayoutExpression: {} as Node,
    dataLayout: { providerDeclaration: memoryTestRegistration.providerDeclaration, ...memoryTestRegistration.descriptor },
    byteSize: 4, byteAlignment: 4, stride: 4, fields: [],
  };
}

function field(child: TsonicMemoryLayoutFact, byteOffset = 0): TsonicMemoryFieldLayoutFact {
  return {
    call: {} as Node, sourceType: {} as Type, selector: {} as Node, selectedDeclaration: {} as Node,
    fieldType: child.sourceType, fieldLayoutExpression: {} as Node, fieldLayout: child,
    byteOffset, byteAlignment: child.byteAlignment,
  };
}

test("nested layouts retain the explicitly chosen child and its authored operand through aliases", () => {
  const checked = cleanMemorySession(`
    import { memoryField as slot } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    interface Inner { count: uint32 }
    interface Outer { left: Inner; right: Inner }
    const other = memoryLayout<Inner>(abi, 8, 4, 8,
      slot((value: Inner) => value.count, 4, 4, uint32Layout));
    const selected = memoryLayout<Inner>(abi, 4, 4, 4,
      slot((value: Inner) => value.count, 0, 4, uint32Layout));
    const alias = selected;
    const outer = memoryLayout<Outer>(abi, 16, 4, 16,
      core.memoryField((value: Outer) => value.left, 0, 4, alias),
      core.memoryField((value: Outer) => value.right, 8, 4, other));
  `);
  const layout = readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", 3))!;
  assert.ok(layout);
  assert.deepEqual(layout.fields.map(entry => entry.fieldLayout.byteSize), [4, 8]);
  assert.deepEqual(layout.fields.map(entry => entry.fieldLayout.fields[0]?.byteOffset), [0, 4]);
  for (const [index, entry] of layout.fields.entries()) {
    const call = memoryCall(checked, "memoryField", index);
    assert.equal(entry.fieldLayoutExpression, checked.ast.arguments(call)[3]);
    assert.equal(entry.fieldLayout.call,
      readTsonicMemoryLayout(checked.sourceFacts, entry.fieldLayoutExpression)?.call);
    assert.ok(Object.isFrozen(entry.fieldLayout));
  }
});

test("memoryField has only the required child-layout contract", () => {
  const checked = memorySession(memoryTestPrelude + `
    interface Header { count: uint32 }
    memoryField((value: Header) => value.count, 0, 4);
  `);
  assert.match(formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"), /Expected 4 arguments, but got 3/u);
  assert.equal(readTsonicMemoryFieldLayout(checked.sourceFacts, memoryCall(checked, "memoryField")), undefined);
});

for (const [label, child, checkerRejects] of [
  ["unproduced descriptor", "unproduced", false],
  ["different selected field type", "memoryLayout<boolean>(abi, 1, 1, 1)", true],
] as const) {
  test(`field layout rejects ${label} without publishing a field`, () => {
    const checked = memorySession(memoryTestPrelude + `
      interface Header { count: uint32 }
      declare const unproduced: MemoryLayout<uint32>;
      memoryField((value: Header) => value.count, 0, 4, ${child});
    `);
    assert.equal(readTsonicMemoryFieldLayout(checked.sourceFacts, memoryCall(checked, "memoryField")), undefined);
    if (checkerRejects) {
      assert.match(formatDiagnostics(checked.diagnostics.filter(entry => entry !== undefined), "/src"), /not assignable/u);
    } else {
      assert.equal(checked.diagnostics.filter(Boolean).length, 0);
      assert.ok(checked.extensionDiagnostics.some(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_FIELD_LAYOUT_NOT_PROVEN"));
    }
    assert.ok(checked.extensionDiagnostics.every(entry => entry.extensionCode !== "SOURCE_ANALYSIS_FAILED"));
  });
}

test("the full child extent must fit and distinct fields cannot overlap", () => {
  const checked = memorySession(memoryTestPrelude + `
    interface Header { first: uint32; second: uint32 }
    memoryLayout<Header>(abi, 4, 4, 4,
      memoryField((value: Header) => value.first, 4, 4, uint32Layout));
    memoryLayout<Header>(abi, 8, 4, 8,
      memoryField((value: Header) => value.first, 0, 4, uint32Layout),
      memoryField((value: Header) => value.second, 0, 4, uint32Layout));
  `);
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assert.equal(checked.extensionDiagnostics.filter(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_LAYOUT_DIMENSIONS_INVALID").length, 2);
  for (const index of [1, 2]) assert.equal(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", index)), undefined);
});

test("packed field placement does not replace the selected child type alignment", () => {
  const checked = cleanMemorySession(`
    interface Packed { count: uint32 }
    memoryLayout<Packed>(abi, 5, 1, 5,
      memoryField((value: Packed) => value.count, 1, 1, uint32Layout));
  `);
  const layout = readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", 1))!;
  assert.equal(layout.fields[0]?.byteAlignment, 1);
  assert.equal(layout.fields[0]?.fieldLayout.byteAlignment, 4);
});

test("consumers reject missing or stale selected children rather than trusting an embedded descriptor", () => {
  const checked = cleanMemorySession(`
    interface Header { count: uint32 }
    const header = memoryLayout<Header>(abi, 4, 4, 4,
      memoryField((value: Header) => value.count, 0, 4, uint32Layout));
    sizeOf(header);
    reinterpretRawPointer(raw, header);
  `);
  const parent = readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", 1))!;
  const child = parent.fields[0]!;
  const observation = memoryCall(checked, "sizeOf");
  const conversion = memoryCall(checked, "reinterpretRawPointer");
  assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, observation)?.kind, "resolved");
  assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, conversion)?.kind, "resolved");
  for (const mutation of ["missing-child", "stale-child", "missing-field"] as const) {
    const facts: ReadonlySourceFactResolver = {
      getFact(subject, key) {
        if (subject === child.fieldLayoutExpression && Object.is(key, tsonicMemoryLayoutFactKey)) {
          if (mutation === "missing-child") return undefined;
          if (mutation === "stale-child") return { ...child.fieldLayout, stride: 8 } as never;
        }
        if (mutation === "missing-field" && subject === child.call && Object.is(key, tsonicMemoryFieldLayoutFactKey)) return undefined;
        return checked.sourceFacts.getFact(subject, key);
      },
      getFacts: subject => checked.sourceFacts.getFacts(subject),
      getVirtualDeclarationDocument: name => checked.sourceFacts.getVirtualDeclarationDocument(name),
    };
    assert.equal(resolveTsonicMemoryLayoutObservation(facts, observation)?.kind, "rejected", mutation);
    assert.equal(selectTsonicRawLocationOperation(checked.ast, facts, conversion)?.kind, "rejected", mutation);
  }
});

test("snapshot shares child DAGs, freezes nested metadata and compares every child identity", () => {
  const child = scalar();
  const parent = { ...scalar(), byteSize: 8, stride: 8, fields: [field(child), field(child, 4)] };
  const captured = snapshotMemoryLayout(parent);
  assert.equal(captured.fields[0]?.fieldLayout, captured.fields[1]?.fieldLayout);
  assert.ok(!Object.isFrozen(child.call));
  assert.ok(Object.isFrozen(captured.fields[0]?.fieldLayout.fields));
  const changed = { ...parent, fields: [parent.fields[0]!,
    { ...parent.fields[1]!, fieldLayout: { ...child, stride: 8 } }] };
  assert.ok(tsonicMemoryLayoutFactKey.equals(captured, snapshotMemoryLayout(parent)));
  assert.ok(!tsonicMemoryLayoutFactKey.equals(captured, snapshotMemoryLayout(changed)));
  const originalField = captured.fields[0]!;
  assert.ok(tsonicMemoryFieldLayoutFactKey.equals(originalField, snapshotMemoryField(parent.fields[0]!)));
  assert.ok(!tsonicMemoryFieldLayoutFactKey.equals(originalField,
    snapshotMemoryField({ ...parent.fields[0]!, fieldLayout: { ...child, call: {} as Node } })));
  assert.ok(!tsonicMemoryFieldLayoutFactKey.equals(originalField,
    snapshotMemoryField({ ...parent.fields[0]!, fieldLayoutExpression: {} as Node })));
});

for (const mutate of [
  (child: TsonicMemoryLayoutFact) => ({ ...child, dataLayout: { ...child.dataLayout, fingerprint: "another-revision" } }),
  (child: TsonicMemoryLayoutFact) => ({ ...child, dataLayout: { ...child.dataLayout,
    providerDeclaration: { ...child.dataLayout.providerDeclaration, exportId: "another-ABI" } } }),
  (child: TsonicMemoryLayoutFact) => ({ ...child, dataLayout: { ...child.dataLayout, byteOrder: "big" as const } }),
  (child: TsonicMemoryLayoutFact) => ({ ...child, dataLayout: { ...child.dataLayout, addressWidth: 32 as const } }),
]) {
  test("snapshots reject a child with a different ABI identity or descriptor", () => {
    assert.throws(() => snapshotMemoryLayout({ ...scalar(), fields: [field(mutate(scalar()))] }), /different ABI/u);
  });
}

test("zero-sized fields occupy no bytes, including at the aggregate end", () => {
  const empty = { ...scalar(), byteSize: 0, stride: 0 };
  const parent = { ...scalar(), fields: [field(scalar()), field(empty), field(empty, 4)] };
  assert.equal(snapshotMemoryLayout(parent).fields.length, 3);
});

test("cyclic and over-depth physical descriptors reject without stack overflow", () => {
  const fields: TsonicMemoryFieldLayoutFact[] = [];
  const cycle = { ...scalar(), fields };
  fields.push(field(cycle));
  assert.throws(() => snapshotMemoryLayout(cycle), /recursive physical value/u);
  let nested = scalar();
  for (let depth = 0; depth < maximumMemoryLayoutDepth; depth += 1) {
    nested = { ...scalar(), fields: [field(nested)] };
  }
  assert.throws(() => snapshotMemoryLayout(nested), /supported nesting depth/u);
});

test("shared empty-child graphs do not expand exponentially", () => {
  let nested: TsonicMemoryLayoutFact = { ...scalar(), byteSize: 0, stride: 0 };
  for (let depth = 0; depth < 32; depth += 1) {
    nested = { ...scalar(), byteSize: 0, stride: 0, fields: [field(nested), field(nested)] };
  }
  const captured = snapshotMemoryLayout(nested);
  assert.ok(tsonicMemoryLayoutFactKey.equals(captured, snapshotMemoryLayout(nested)));
  assert.equal(captured.fields[0]?.fieldLayout, captured.fields[1]?.fieldLayout);
});

test("independently published field facts keep the same captured child instead of expanding its graph", () => {
  let child = snapshotMemoryLayout({ ...scalar(), byteSize: 0, stride: 0 });
  for (let depth = 0; depth < 32; depth += 1) {
    const left = snapshotMemoryField(field(child));
    const right = snapshotMemoryField(field(child));
    const parent = snapshotMemoryLayout({ ...scalar(), byteSize: 0, stride: 0, fields: [left, right] });
    assert.equal(parent.fields[0]?.fieldLayout, child);
    assert.equal(parent.fields[1]?.fieldLayout, child);
    child = parent;
  }
  const independent = snapshotMemoryLayout(child);
  assert.notEqual(independent, child);
  assert.equal(independent.fields, child.fields);
  assert.ok(tsonicMemoryLayoutFactKey.equals(independent, child));
});

test("source-produced nested descriptors preserve sharing across all fact publications", () => {
  const declarations = ["interface Layer0 {} const layer0 = memoryLayout<Layer0>(abi, 0, 4, 0);"];
  for (let depth = 1; depth <= 24; depth += 1) {
    declarations.push(`interface Layer${depth} { left: Layer${depth - 1}; right: Layer${depth - 1} }
      const layer${depth} = memoryLayout<Layer${depth}>(abi, 0, 4, 0,
        memoryField((value: Layer${depth}) => value.left, 0, 4, layer${depth - 1}),
        memoryField((value: Layer${depth}) => value.right, 0, 4, layer${depth - 1}));`);
  }
  const checked = cleanMemorySession(declarations.join("\n"));
  let layout = readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", 25))!;
  for (let depth = 24; depth !== 0; depth -= 1) {
    assert.equal(layout.fields[0]?.fieldLayout, layout.fields[1]?.fieldLayout);
    layout = layout.fields[0]!.fieldLayout;
  }
  assert.equal(layout.fields.length, 0);
});

test("already captured children cannot bypass the nesting budget", () => {
  let child = snapshotMemoryLayout(scalar());
  for (let depth = 1; depth < maximumMemoryLayoutDepth; depth += 1) {
    child = snapshotMemoryLayout({ ...scalar(), fields: [field(child)] });
  }
  assert.throws(() => snapshotMemoryLayout({ ...scalar(), fields: [field(child)] }), /supported nesting depth/u);
});

test("a child reused along a deeper route cannot bypass the snapshot depth budget", () => {
  const child = { ...scalar(), byteSize: 0, stride: 0 };
  let deeper: TsonicMemoryLayoutFact = child;
  for (let depth = 1; depth < maximumMemoryLayoutDepth; depth += 1) {
    deeper = { ...scalar(), byteSize: 0, stride: 0, fields: [field(deeper)] };
  }
  assert.throws(() => snapshotMemoryLayout({ ...scalar(), byteSize: 0, stride: 0,
    fields: [field(child), field(deeper)] }), /supported nesting depth/u);
});

test("nested accessors are rejected without executing code", () => {
  const selected = field(scalar());
  const invalid = Object.defineProperty({ ...selected }, "fieldLayout", {
    get() { assert.fail("A layout snapshot must not execute a child accessor."); },
  });
  assert.throws(() => snapshotMemoryLayout({ ...scalar(), fields: [invalid] }), /accessor/u);
});

test("wide descriptor snapshots fail at the metadata budget", () => {
  const empty = snapshotMemoryLayout({ ...scalar(), byteSize: 0, stride: 0 });
  const fields = Array.from({ length: 65536 }, () => field(empty));
  assert.throws(() => snapshotMemoryLayout({ ...scalar(), byteSize: 0, stride: 0, fields }), /metadata value budget/u);
});

test("source layout depth failures are diagnosed before a fact transaction is poisoned", () => {
  const declarations = ["interface Layer0 {} const layer0 = memoryLayout<Layer0>(abi, 0, 4, 0);"];
  for (let depth = 1; depth <= maximumMemoryLayoutDepth; depth += 1) {
    declarations.push(`interface Layer${depth} { value: Layer${depth - 1} }
      const layer${depth} = memoryLayout<Layer${depth}>(abi, 0, 4, 0,
        memoryField((value: Layer${depth}) => value.value, 0, 4, layer${depth - 1}));`);
  }
  const checked = memorySession(memoryTestPrelude + declarations.join("\n"));
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assert.deepEqual(checked.extensionDiagnostics.map(entry => entry.extensionCode), ["SOURCE_CORE_MEMORY_LAYOUT_CAPTURE_LIMIT"]);
  assert.equal(readTsonicMemoryLayout(checked.sourceFacts,
    memoryCall(checked, "memoryLayout", maximumMemoryLayoutDepth + 1)), undefined);
  assert.ok(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", maximumMemoryLayoutDepth)));
});
