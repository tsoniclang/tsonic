import assert from "node:assert/strict";
import { test } from "node:test";
import { providerVirtualDeclarationFactKey, sourcePrimitiveFactKey } from "@tsonic/tsts";
import type { Node, ReadonlySourceFactResolver } from "@tsonic/tsts";
import { createTargetSourceProgram } from "@tsonic/target-api/source";
import type { TargetSourceProgram } from "@tsonic/target-api/source";
import { selectTsonicFixedArrayFromSource, tsonicFixedArrayFactKey } from "../public/facts.js";
import { checkSource, createCleanSourceCoreSession, createSourceCoreSession, findNode } from "../extension/source-extension.fixtures.js";

function sourceFile(source: TargetSourceProgram, path: string) {
  const file = source.sourceFiles.find(file => source.ast.getFileName(file) === path);
  assert.ok(file !== undefined, path);
  return file;
}

function aliasNode(source: TargetSourceProgram, path: string, name: string): Node {
  const declaration = findNode(sourceFile(source, path), source.ast, (node, ast) =>
    ast.is.IsTypeAliasDeclaration(node) && ast.text(ast.name(node)) === name);
  const type = source.ast.as.AsTypeAliasDeclaration(declaration)?.Type;
  assert.ok(type !== undefined, name);
  return type;
}

test("target-source fixed-array adapter selects inferred wrapped returns without publishing Type facts", () => {
  const { session } = createCleanSourceCoreSession(`
    import { wrap } from "./factory.js";
    import { remote } from "./remote.js";
    export const local = wrap({}, 9007199254740993n);
    const imported = remote;
  `, {
    "/src/factory.d.ts": `
      import type { FixedArray } from "@tsonic/core/types.js";
      interface Layout<Value> { readonly value: Value; }
      export declare function wrap<Element, Count extends number | bigint>(
        element: Element, count: Count
      ): Layout<FixedArray<Element, Count>>;
    `,
    "/src/remote.ts": `
      import { wrap } from "./factory.js";
      export const remote = wrap({}, 9007199254740992n);
    `,
  });
  const source = createTargetSourceProgram(checkSource(session));
  for (const [path, length] of [["/src/index.ts", 9007199254740993n], ["/src/remote.ts", 9007199254740992n]] as const) {
    const file = sourceFile(source, path);
    const call = findNode(file, source.ast, (node, ast) => ast.is.IsCallExpression(node));
    assert.ok(call !== undefined);
    const semantics = source.semantics.forNode(call);
    const selected = semantics.operations.call(call);
    assert.ok(selected?.outcome === "applicable");
    const arrayType = semantics.types.typeArguments(selected.sourceResultType)[0];
    assert.ok(arrayType !== undefined);
    const before = source.sourceFacts.getFacts(arrayType);
    assert.equal(source.sourceFacts.getFact(arrayType, tsonicFixedArrayFactKey), undefined);
    for (let repeat = 0; repeat < 2; repeat += 1) {
      const fixed = selectTsonicFixedArrayFromSource(arrayType, semantics, source.sourceFacts);
      assert.ok(fixed?.kind === "selected");
      assert.equal(fixed.fact.sourceType, arrayType);
      assert.equal(fixed.fact.elementSourceType, semantics.types.typeArguments(arrayType)[0]);
      assert.equal(fixed.fact.length, length);
      assert.equal(fixed.fact.lengthRuntimeBase, "bigint");
      assert.equal(fixed.fact.elementType, undefined);
      assert.ok(Object.isFrozen(fixed.fact));
    }
    assert.deepEqual(source.sourceFacts.getFacts(arrayType), before);
    assert.equal(source.sourceFacts.getFact(arrayType, tsonicFixedArrayFactKey), undefined);
  }
});

test("target-source fixed-array adapter resolves cross-file aliases through exact provider evidence", () => {
  const { session } = createCleanSourceCoreSession(`
    import type { Huge as Imported, Reordered } from "./barrel.js";
    import type { uint32 } from "@tsonic/core/types.js";
    type LocalHuge = Imported;
    type LocalPair = Reordered<string, uint32>;
  `, {
    "/src/barrel.ts": 'export type { Huge, Reordered } from "./arrays.js";',
    "/src/arrays.ts": `
      import type { FixedArray } from "@tsonic/core/types.js";
      export type Huge = FixedArray<{}, 9007199254740993n>;
      export type Reordered<Unused, Element> = FixedArray<Element, 2>;
    `,
  });
  const source = createTargetSourceProgram(checkSource(session));
  for (const [path, name, count, runtimeBase] of [
    ["/src/index.ts", "LocalHuge", 9007199254740993n, "bigint"],
    ["/src/index.ts", "LocalPair", 2n, "number"],
    ["/src/arrays.ts", "Huge", 9007199254740993n, "bigint"],
  ] as const) {
    const node = aliasNode(source, path, name);
    const semantics = source.semantics.forNode(node);
    const type = semantics.types.authoredType(node);
    assert.ok(type !== undefined);
    const selected = selectTsonicFixedArrayFromSource(type, semantics, source.sourceFacts);
    assert.ok(selected?.kind === "selected", name);
    assert.equal(selected.fact.sourceType, type);
    assert.equal(selected.fact.length, count);
    assert.equal(selected.fact.lengthRuntimeBase, runtimeBase);
    if (name === "LocalPair") assert.equal(selected.fact.elementType, undefined);
    else assert.ok(selected.fact.elementType ===
      source.sourceFacts.getFact(aliasNode(source, "/src/arrays.ts", "Huge"), tsonicFixedArrayFactKey)?.elementType);
    const missing: Pick<ReadonlySourceFactResolver, "getFact"> = {
      getFact: (subject, key) => Object.is(key, providerVirtualDeclarationFactKey) ? undefined : source.sourceFacts.getFact(subject, key),
    };
    assert.equal(selectTsonicFixedArrayFromSource(type, semantics, missing), undefined);
  }
});

test("target-source resolved selection leaves occurrence-owned primitive annotations intact", () => {
  const { session } = createCleanSourceCoreSession(`
    import type { FixedArray, int32, uint32 } from "@tsonic/core/types.js";
    type Unsigned = FixedArray<uint32, 2>;
    type Signed = FixedArray<int32, 2>;
  `);
  const source = createTargetSourceProgram(checkSource(session));
  for (const [name, primitive] of [["Unsigned", "uint32"], ["Signed", "int32"], ["Unsigned", "uint32"]] as const) {
    const node = aliasNode(source, "/src/index.ts", name);
    const semantics = source.semantics.forNode(node);
    const type = semantics.types.authoredType(node);
    assert.ok(type !== undefined);
    const authored = source.sourceFacts.getFact(node, tsonicFixedArrayFactKey);
    assert.ok(authored?.elementType !== undefined);
    const before = source.sourceFacts.getFacts(type);
    const selected = selectTsonicFixedArrayFromSource(type, semantics, source.sourceFacts);
    assert.ok(selected?.kind === "selected");
    assert.equal(selected.fact.elementType, authored.elementType);
    assert.equal(selected.fact.elementSourceType, authored.elementSourceType);
    assert.equal(source.sourceFacts.getFact(node, tsonicFixedArrayFactKey), authored);
    assert.equal(source.sourceFacts.getFact(authored.elementType, sourcePrimitiveFactKey)?.kind, primitive);
    assert.deepEqual(source.sourceFacts.getFacts(type), before);
    assert.equal(source.sourceFacts.getFact(type, tsonicFixedArrayFactKey), undefined);
  }
});

test("target-source concrete aliases reject contradictory and ambiguous element witnesses", () => {
  const { session } = createCleanSourceCoreSession(`
    import type { FixedArray, int32, uint32 } from "@tsonic/core/types.js";
    type Unsigned = FixedArray<uint32, 2>;
    type Signed = FixedArray<int32, 2>;
  `);
  const source = createTargetSourceProgram(checkSource(session));
  const unsigned = aliasNode(source, "/src/index.ts", "Unsigned");
  const signed = aliasNode(source, "/src/index.ts", "Signed");
  const semantics = source.semantics.forNode(unsigned);
  const type = semantics.types.authoredType(unsigned);
  assert.ok(type !== undefined);
  const contradictory: Pick<ReadonlySourceFactResolver, "getFact"> = {
    getFact(subject, key) {
      const fact = source.sourceFacts.getFact(subject, key);
      return Object.is(key, tsonicFixedArrayFactKey) && fact !== undefined
        ? { ...fact, length: 3n } as typeof fact : fact;
    },
  };
  const mismatch = selectTsonicFixedArrayFromSource(type, semantics, contradictory);
  assert.equal(mismatch?.kind, "invalid");
  const unsignedFact = source.sourceFacts.getFact(unsigned, tsonicFixedArrayFactKey);
  const signedFact = source.sourceFacts.getFact(signed, tsonicFixedArrayFactKey);
  assert.ok(unsignedFact !== undefined && signedFact?.elementType !== undefined);
  const alternate: Pick<ReadonlySourceFactResolver, "getFact"> = {
    getFact(subject, key) {
      const fact = source.sourceFacts.getFact(subject, key);
      return Object.is(key, tsonicFixedArrayFactKey) && subject === signed
        ? { ...unsignedFact, elementType: signedFact.elementType } as typeof fact : fact;
    },
  };
  const ambiguous = selectTsonicFixedArrayFromSource(type, {
    ...semantics,
    facts: { ...semantics.facts, authoredTypeNodes: () => [unsigned, signed] },
  }, alternate);
  assert.equal(ambiguous?.kind, "invalid");
  assert.equal(source.sourceFacts.getFact(type, tsonicFixedArrayFactKey), undefined);
});

test("target-source adapter retains invalid versus noncanonical selection outcomes", () => {
  const { session } = createSourceCoreSession(`
    import type { FixedArray } from "@tsonic/core/types.js";
    type Open = FixedArray<number, number>;
    type Negative = FixedArray<number, -1n>;
    type Unsafe = FixedArray<number, 9007199254740993>;
    type Local = ReadonlyArray<number> & { readonly length: 2 };
  `);
  const checked = checkSource(session);
  assert.equal(checked.extensionDiagnostics.length, 3);
  assert.ok(checked.extensionDiagnostics.every(diagnostic => diagnostic.extensionCode === "SOURCE_CORE_FIXED_ARRAY_LENGTH_NOT_LITERAL"));
  const source = createTargetSourceProgram(checked);
  for (const name of ["Open", "Negative", "Unsafe", "Local"]) {
    const node = aliasNode(source, "/src/index.ts", name);
    const semantics = source.semantics.forNode(node);
    const type = semantics.types.authoredType(node);
    assert.ok(type !== undefined);
    const selected = selectTsonicFixedArrayFromSource(type, semantics, source.sourceFacts);
    assert.equal(selected?.kind, name === "Local" ? undefined : "invalid", name);
    assert.equal(source.sourceFacts.getFact(type, tsonicFixedArrayFactKey), undefined);
  }
});
