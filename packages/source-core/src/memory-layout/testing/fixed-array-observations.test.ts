import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import {
  createTsonicMemoryMetadataIndex, readTsonicMemoryType, readTsonicRawMemoryOperation,
  resolveTsonicMemoryLayoutObservation, selectTsonicRawLocationOperation,
  tsonicDataLayoutFactKey, tsonicFixedArrayFactKey, tsonicMemoryFieldLayoutFactKey,
  tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey, tsonicMemoryTypeFactKey,
} from "../../public/facts.js";
import { memoryCall, memoryCalls, valueMemoryLayout } from "./fixtures.js";
import {
  arrayLayoutAt, arrayMemoryLayout, arraySession, assertArrayObservation, cleanArraySession,
} from "./fixed-array-fixtures.js";

function observedArrays() {
  const checked = cleanArraySession(`
    interface Entry { count: uint32 }
    const entry = memoryLayout<Entry>(abi, 8, 4, 8,
      memoryField((value: Entry) => value.count, 4, 4, word));
    const entries = memoryArrayLayout<Entry, 2>(abi, 16, 4, 20, entry, 2);
    const nested = memoryArrayLayout(abi, 36, 4, 40, entries, 2);
    interface Holder { entries: FixedArray<Entry, 2> }
    const holder = memoryLayout<Holder>(abi, 24, 4, 24,
      memoryField((value: Holder) => value.entries, 4, 4, entries));
    declare const pointer: Pointer<FixedArray<FixedArray<Entry, 2>, 2>> | undefined;
    sizeOf(nested); alignOf(nested); strideOf(nested);
    fieldOffsetOf(holder, value => value.entries);
    toRawPointer(pointer, nested);
    reinterpretRawPointer(raw, nested);
    toRawPointer<FixedArray<FixedArray<Entry, 2>, 2>>(undefined, nested);
    reinterpretRawPointer<FixedArray<FixedArray<Entry, 2>, 2>>(undefined, nested);
  `);
  const layout = arrayLayoutAt(checked, 1);
  const child = arrayMemoryLayout(layout.elementLayout);
  const field = valueMemoryLayout(child.elementLayout).fields[0]!;
  return { checked, layout, child, field };
}

test("public array observations and raw conversions preserve the whole selected graph and inferred pointee", () => {
  const { checked, layout } = observedArrays();
  assertArrayObservation(checked, "sizeOf", 36);
  assertArrayObservation(checked, "alignOf", 4);
  assertArrayObservation(checked, "strideOf", 40);
  assertArrayObservation(checked, "fieldOffsetOf", 4);
  assert.equal(layout.elementLayout.stride, 20);
  for (const name of ["toRawPointer", "reinterpretRawPointer"]) {
    for (const call of memoryCalls(checked, name)) {
      const selected = selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, call);
      assert.ok(selected?.kind === "resolved");
      assert.equal(selected.layout.call, layout.call);
      assert.equal(selected.operation.layoutExpression, checked.ast.arguments(call)[1]);
      assert.equal(selected.memoryType, readTsonicMemoryType(checked.sourceFacts, layout.call)?.identity);
      assert.notEqual(selected.memoryType, readTsonicMemoryType(checked.sourceFacts, layout.elementLayout.call)?.identity);
      assert.ok(Object.isFrozen(selected));
    }
    const inferred = readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, name));
    assert.ok(inferred?.operation === "to-raw" || inferred?.operation === "reinterpret");
    if (inferred.operation === "reinterpret") assert.equal(inferred.explicitPointeeTypeNode, undefined);
    assert.ok(inferred.pointeeType);
  }
});

test("public observations and raw selectors reject every omitted selected array or descendant witness", () => {
  const { checked, layout, child, field } = observedArrays();
  const observation = memoryCall(checked, "sizeOf");
  const conversions = [memoryCall(checked, "toRawPointer"), memoryCall(checked, "reinterpretRawPointer")];
  assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, observation)?.kind, "resolved");
  for (const call of conversions) assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, call)?.kind, "resolved");
  const omissions = [
    ["root fixed-array", layout.call, tsonicFixedArrayFactKey],
    ["nested fixed-array", child.call, tsonicFixedArrayFactKey],
    ["root memory type", layout.call, tsonicMemoryTypeFactKey],
    ["selected element operand", layout.elementLayoutExpression, tsonicMemoryLayoutFactKey],
    ["selected element call", child.call, tsonicMemoryLayoutFactKey],
    ["element memory type", child.call, tsonicMemoryTypeFactKey],
    ["element ABI", child.dataLayoutExpression, tsonicDataLayoutFactKey],
    ["nested element operand", child.elementLayoutExpression, tsonicMemoryLayoutFactKey],
    ["nested field", field.call, tsonicMemoryFieldLayoutFactKey],
    ["nested field type", field.call, tsonicMemoryTypeFactKey],
    ["nested leaf operand", field.fieldLayoutExpression, tsonicMemoryLayoutFactKey],
    ["nested leaf type", field.fieldLayout.call, tsonicMemoryTypeFactKey],
  ] as const;
  for (const [name, missingSubject, missingKey] of omissions) {
    const facts: ReadonlySourceFactResolver = {
      getFact(subject, key) {
        if (subject === missingSubject && Object.is(key, missingKey)) return undefined;
        return checked.sourceFacts.getFact(subject, key);
      },
      getFacts: subject => checked.sourceFacts.getFacts(subject),
      getVirtualDeclarationDocument: name => checked.sourceFacts.getVirtualDeclarationDocument(name),
    };
    assert.equal(resolveTsonicMemoryLayoutObservation(facts, observation)?.kind, "rejected", name);
    for (const call of conversions) assert.equal(selectTsonicRawLocationOperation(checked.ast, facts, call)?.kind, "rejected", name);
  }
});

test("stale array counts, child layouts, ABI and foreign type identities cannot survive public selection", () => {
  const { checked, layout, child, field } = observedArrays();
  const foreign = observedArrays();
  const foreignType = readTsonicMemoryType(foreign.checked.sourceFacts, foreign.child.call)!;
  for (const mutation of ["extent", "child-stride", "leaf-offset", "abi", "foreign-type"] as const) {
    const facts: ReadonlySourceFactResolver = {
      getFact(subject, key) {
        const value = checked.sourceFacts.getFact(subject, key);
        if (mutation === "extent" && subject === child.call && Object.is(key, tsonicFixedArrayFactKey)) {
          return { ...child.fixedArray, length: 1n } as typeof value;
        }
        if (mutation === "child-stride" && subject === layout.elementLayoutExpression && Object.is(key, tsonicMemoryLayoutFactKey)) {
          return { ...child, stride: 24 } as typeof value;
        }
        if (mutation === "leaf-offset" && subject === field.call && Object.is(key, tsonicMemoryFieldLayoutFactKey)) {
          return { ...field, byteOffset: 0 } as typeof value;
        }
        if (mutation === "abi" && subject === child.dataLayoutExpression && Object.is(key, tsonicDataLayoutFactKey)) {
          return { ...child.dataLayout, fingerprint: "stale-array-abi" } as typeof value;
        }
        if (mutation === "foreign-type" && subject === child.call && Object.is(key, tsonicMemoryTypeFactKey)) {
          const current = readTsonicMemoryType(checked.sourceFacts, child.call)!;
          return { ...current, identity: foreignType.identity } as typeof value;
        }
        return value;
      },
      getFacts: subject => checked.sourceFacts.getFacts(subject),
      getVirtualDeclarationDocument: name => checked.sourceFacts.getVirtualDeclarationDocument(name),
    };
    assert.equal(resolveTsonicMemoryLayoutObservation(facts, memoryCall(checked, "sizeOf"))?.kind, "rejected", mutation);
    for (const name of ["toRawPointer", "reinterpretRawPointer"]) {
      assert.equal(selectTsonicRawLocationOperation(checked.ast, facts, memoryCall(checked, name))?.kind, "rejected", mutation);
    }
  }
});

test("an array observation cannot be relocated or converted to a synthetic field-offset query", () => {
  const { checked, layout, field } = observedArrays();
  const call = memoryCall(checked, "sizeOf");
  const query = checked.sourceFacts.getFact(call, tsonicMemoryLayoutQueryFactKey)!;
  for (const replacement of [
    { ...query, call: layout.call },
    { ...query, operation: "field-offset" as const, selectedFieldDeclaration: field.selectedDeclaration },
  ]) {
    const facts: ReadonlySourceFactResolver = {
      getFact(subject, key) {
        return subject === call && Object.is(key, tsonicMemoryLayoutQueryFactKey)
          ? replacement as never : checked.sourceFacts.getFact(subject, key);
      },
      getFacts: subject => checked.sourceFacts.getFacts(subject),
      getVirtualDeclarationDocument: name => checked.sourceFacts.getVirtualDeclarationDocument(name),
    };
    assert.equal(resolveTsonicMemoryLayoutObservation(facts, call)?.kind, "rejected");
  }
});

test("coherent root and child substitutions cannot rewrite the authentic array element or exact count", () => {
  const checked = cleanArraySession(`
    const unsigned = memoryArrayLayout<uint32, 2>(abi, 8, 4, 8, word, 2);
    const signedWord = memoryLayout<int32>(abi, 4, 4, 4);
    const signed = memoryArrayLayout(abi, 8, 4, 8, signedWord, 2);
    const huge = memoryArrayLayout(abi, 0, 4, 0, empty, 9007199254740993n);
    const otherUnsigned = memoryArrayLayout<uint32, 2>(abi, 8, 4, 8, word, 2);
    sizeOf(unsigned); sizeOf(huge);
    reinterpretRawPointer(raw, unsigned); reinterpretRawPointer(raw, huge);
  `);
  const unsigned = arrayLayoutAt(checked);
  const signed = arrayLayoutAt(checked, 1);
  const huge = arrayLayoutAt(checked, 2);
  const otherUnsigned = arrayLayoutAt(checked, 3);
  assert.notEqual(unsigned.fixedArray.elementSourceType, huge.elementLayout.sourceType);
  assert.ok(unsigned.fixedArray.elementType && otherUnsigned.fixedArray.elementType);
  assert.notEqual(unsigned.fixedArray.elementType, otherUnsigned.fixedArray.elementType);
  const { elementType, ...withoutSyntax } = unsigned.fixedArray;
  assert.ok(elementType);
  const substitutions = [
    ["selected child and embedded element", 0, unsigned, { ...unsigned,
      fixedArray: { ...unsigned.fixedArray, elementSourceType: signed.fixedArray.elementSourceType,
        elementType: signed.fixedArray.elementType },
      elementLayoutExpression: signed.elementLayoutExpression, elementLayout: signed.elementLayout,
    }],
    ["rounded adjacent count", 1, huge, { ...huge, fixedArray: { ...huge.fixedArray, length: 9007199254740992n } }],
    ["coupled element type only", 0, unsigned, { ...unsigned,
      fixedArray: { ...unsigned.fixedArray, elementSourceType: huge.elementLayout.sourceType },
    }],
    ["coupled relocated element syntax", 0, unsigned, { ...unsigned,
      fixedArray: { ...unsigned.fixedArray, elementType: otherUnsigned.fixedArray.elementType },
    }],
    ["coupled omitted element syntax", 0, unsigned, { ...unsigned, fixedArray: withoutSyntax }],
  ] as const;
  for (const [name, index, original, replacement] of substitutions) {
    const captured = Object.freeze({ ...replacement, fixedArray: Object.freeze({ ...replacement.fixedArray }) });
    const facts: ReadonlySourceFactResolver = {
      getFact(subject, key) {
        const value = checked.sourceFacts.getFact(subject, key);
        if (Object.is(key, tsonicMemoryLayoutFactKey)) {
          const layout = checked.sourceFacts.getFact(subject, tsonicMemoryLayoutFactKey);
          if (layout?.call === original.call) return captured as typeof value;
        }
        if (Object.is(key, tsonicFixedArrayFactKey) && subject === original.call) {
          return replacement.fixedArray as typeof value;
        }
        return value;
      },
      getFacts: subject => checked.sourceFacts.getFacts(subject),
      getVirtualDeclarationDocument: name => checked.sourceFacts.getVirtualDeclarationDocument(name),
    };
    const observation = memoryCall(checked, "sizeOf", index);
    const conversion = memoryCall(checked, "reinterpretRawPointer", index);
    assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, observation)?.kind, "resolved");
    assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, conversion)?.kind, "resolved");
    assert.equal(resolveTsonicMemoryLayoutObservation(facts, observation)?.kind, "rejected", name);
    assert.equal(selectTsonicRawLocationOperation(checked.ast, facts, conversion)?.kind, "rejected", name);
  }
});

test("coherent array-to-value replacement cannot erase the authenticated element relationship", () => {
  const checked = cleanArraySession(`
    const array = memoryArrayLayout(abi, 8, 4, 8, word, 2);
    sizeOf(array);
    reinterpretRawPointer(raw, array);
  `);
  const array = arrayLayoutAt(checked);
  const { fixedArray, elementLayoutExpression, elementLayout, ...base } = array;
  assert.ok(fixedArray && elementLayoutExpression && elementLayout);
  const replacement = Object.freeze({ ...base, kind: "value" as const, fields: Object.freeze([]) });
  const facts: ReadonlySourceFactResolver = {
    getFact(subject, key) {
      if (Object.is(key, tsonicMemoryLayoutFactKey)) {
        const selected = checked.sourceFacts.getFact(subject, tsonicMemoryLayoutFactKey);
        if (selected?.call === array.call) return replacement as never;
      }
      if (subject === array.call && Object.is(key, tsonicFixedArrayFactKey)) return undefined;
      return checked.sourceFacts.getFact(subject, key);
    },
    getFacts: subject => checked.sourceFacts.getFacts(subject),
    getVirtualDeclarationDocument: name => checked.sourceFacts.getVirtualDeclarationDocument(name),
  };
  const observation = memoryCall(checked, "sizeOf");
  const conversion = memoryCall(checked, "reinterpretRawPointer");
  assert.equal(resolveTsonicMemoryLayoutObservation(checked.sourceFacts, observation)?.kind, "resolved");
  assert.equal(selectTsonicRawLocationOperation(checked.ast, checked.sourceFacts, conversion)?.kind, "resolved");
  assert.equal(resolveTsonicMemoryLayoutObservation(facts, observation)?.kind, "rejected");
  assert.equal(selectTsonicRawLocationOperation(checked.ast, facts, conversion)?.kind, "rejected");
});

test("raw array conversion rejects a different primitive pointee despite identical carrier and total dimensions", () => {
  const checked = arraySession(`
    const signed = memoryLayout<int32>(abi, 4, 4, 4);
    const array = memoryArrayLayout(abi, 8, 4, 8, signed, 2);
    declare const pointer: Pointer<FixedArray<uint32, 2>>;
    toRawPointer(pointer, array);
    reinterpretRawPointer<FixedArray<uint32, 2>>(raw, array);
    sizeOf(array);
  `);
  assert.equal(checked.diagnostics.filter(Boolean).length, 0);
  assert.equal(checked.extensionDiagnostics.filter(entry => entry.extensionCode === "SOURCE_CORE_MEMORY_POINTEE_LAYOUT_NOT_PROVEN").length, 2);
  for (const name of ["toRawPointer", "reinterpretRawPointer"]) {
    assert.equal(readTsonicRawMemoryOperation(checked.sourceFacts, memoryCall(checked, name)), undefined);
  }
  assertArrayObservation(checked, "sizeOf", 8);
});

function metadataFixture(escape = "") {
  const checked = cleanArraySession(`
    const child = (word);
    const array = memoryArrayLayout(abi, 8, 4, 8, child, 2);
    const alias = (array);
    const size = sizeOf(alias);
    declare const pointer: Pointer<FixedArray<uint32, 2>>;
    toRawPointer(pointer, alias);
    ${escape}
  `);
  const source = createTargetSourceProgram(checked);
  const index = createTsonicMemoryMetadataIndex(source);
  function declaration(name: string): Node {
    const pending: Node[] = [checked.getSourceFile("/src/index.ts")!];
    while (pending.length !== 0) {
      const node = pending.pop()!;
      if (checked.ast.is.IsVariableDeclaration(node) && checked.ast.text(checked.ast.name(node)) === name) return node;
      for (const child of checked.ast.children(node)) if (child !== undefined) pending.push(child);
    }
    assert.fail(`Missing declaration ${name}`);
  }
  return { checked, source, index, declaration };
}

test("array metadata erasure follows the selected child and immutable aliases without erasing pointer operands", () => {
  const { checked, source, index, declaration } = metadataFixture();
  for (const name of ["word", "child", "array", "alias"]) {
    const selected = index.declaration(declaration(name));
    assert.equal(selected?.value.kind, "memory-layout");
    assert.deepEqual(selected?.issues, []);
    assert.equal(index.declaration(declaration(name)), selected);
  }
  assert.equal(index.declaration(declaration("size")), undefined);
  const metadata = index.value(declaration("alias"));
  assert.ok(metadata?.kind === "memory-layout");
  assert.equal(arrayMemoryLayout(metadata.fact).fixedArray.length, 2n);
  assert.equal(index.isCompileTimeExpression(memoryCall(checked, "memoryArrayLayout")), true);
  const operands = source.ast.arguments(memoryCall(checked, "toRawPointer"));
  assert.equal(index.isCompileTimeExpression(operands[0]!), false);
  assert.equal(index.isCompileTimeExpression(operands[1]!), true);
  assert.equal(index.isCompileTimeExpression(memoryCall(checked, "sizeOf")), false);
});

for (const [name, escape] of [
  ["return", "function escape() { return array; }"],
  ["ordinary call", "function consume(value: MemoryLayout<FixedArray<uint32, 2>>) {} consume(array);"],
  ["container", "const values = [array];"],
  ["mutable alias", "let mutable = array;"],
] as const) {
  test(`array descriptor ${name} remains an explicit runtime metadata escape`, () => {
    const { index, declaration } = metadataFixture(escape);
    const issues = index.declaration(declaration("array"))?.issues;
    assert.equal(issues?.length, 1);
    assert.match(issues![0]!.reason, /runtime value/u);
  });
}
