import assert from "node:assert/strict";
import { test } from "node:test";
import { providerVirtualDeclarationFactKey, sourcePrimitiveFactKey } from "@tsonic/tsts";
import type { ReadonlySourceFactResolver } from "@tsonic/tsts";
import { selectTsonicFixedArray } from "../public/facts.js";
import {
  callExpression, checkSource, createCleanSourceCoreSession, createSourceCoreSession,
  definedDiagnostics, getSourceFact, sourceFacts, typeAliasType, typeReferenceName, variableInitializer,
} from "../extension/source-extension.fixtures.js";
import { fixedArrayFactsEqual, tsonicFixedArrayFactKey } from "./facts.js";

test("fixed-array analysis and resolved selection share exact counts and source length runtime bases", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { FixedArray, uint8 } from "@tsonic/core/types.js";
    type Numeric = FixedArray<uint8, 2>;
    type Big = FixedArray<uint8, 2n>;
    type Zero = FixedArray<{}, 0n>;
    type SafeMaximum = FixedArray<{}, 9007199254740991>;
    type Huge = FixedArray<{}, 9007199254740993n>;
    type Adjacent = FixedArray<{}, 9007199254740992n>;
    type Count = 9007199254740993n;
    type LengthAlias = FixedArray<{}, Count>;
    type Hex = FixedArray<{}, 0x20000000000001n>;
    declare const numeric: Numeric;
    declare const big: Big;
    const numericLength = numeric.length;
    const bigintLength = big.length;
  `);
  const source = checkSource(session).getSourceFileQueries(sourceFile);
  const cases = [
    ["Numeric", 2n, "number"], ["Big", 2n, "bigint"], ["Zero", 0n, "bigint"],
    ["SafeMaximum", 9007199254740991n, "number"], ["Huge", 9007199254740993n, "bigint"],
    ["Adjacent", 9007199254740992n, "bigint"], ["LengthAlias", 9007199254740993n, "bigint"],
    ["Hex", 9007199254740993n, "bigint"],
  ] as const;
  for (const [name, length, runtimeBase] of cases) {
    const node = typeAliasType(session, sourceFile, name);
    const produced = getSourceFact(session, node, tsonicFixedArrayFactKey);
    assert.ok(produced !== undefined, name);
    assert.equal(produced.length, length, name);
    assert.equal(produced.lengthRuntimeBase, runtimeBase, name);
    const type = source.checker.getTypeFromTypeNode(node);
    assert.ok(type !== undefined);
    assert.equal(produced.sourceType, type);
    assert.equal(produced.elementSourceType, source.typeShape.getTypeArguments(type)[0]);
    assert.equal(produced.elementType, source.ast.typeArguments(node)[0]);
    const selected = selectTsonicFixedArray(type, source, sourceFacts(session), { authoredTypeNode: node });
    assert.ok(selected?.kind === "selected", name);
    assert.ok(fixedArrayFactsEqual(produced, selected.fact), name);
    assert.ok(Object.isFrozen(selected.fact));
  }
  const numericLength = source.checker.getTypeAtLocation(variableInitializer(session, sourceFile, "numericLength"));
  const bigintLength = source.checker.getTypeAtLocation(variableInitializer(session, sourceFile, "bigintLength"));
  assert.equal(source.typeShape.getNumericLiteralTypeValue(numericLength), 2);
  assert.equal(source.typeShape.getNumericLiteralTypeValue(bigintLength), 2n);
});

test("resolved fixed arrays follow cross-file aliases without treating alias parameters as canonical positions", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { Huge, Pair, Reordered } from "./arrays.js";
    import type { uint32 } from "@tsonic/core/types.js";
    type ImportedHuge = Huge;
    type ImportedPair = Pair<uint32>;
    type ImportedReordered = Reordered<string, uint32>;
  `, {
    "/src/arrays.ts": `
      import type { FixedArray } from "@tsonic/core/types.js";
      type Count = 9007199254740993n;
      export type Huge = FixedArray<{}, Count>;
      export type Pair<Element> = FixedArray<Element, 2n>;
      export type Reordered<Unused, Element> = FixedArray<Element, 2n>;
    `,
  });
  const checked = checkSource(session);
  const source = checked.getSourceFileQueries(sourceFile);
  for (const [name, length] of [["ImportedHuge", 9007199254740993n], ["ImportedPair", 2n], ["ImportedReordered", 2n]] as const) {
    const node = typeAliasType(session, sourceFile, name);
    const type = source.checker.getTypeFromTypeNode(node);
    assert.ok(type !== undefined);
    for (const syntax of [{}, { authoredTypeNode: node }]) {
      const selected = selectTsonicFixedArray(type, source, sourceFacts(session), syntax);
      assert.ok(selected?.kind === "selected", name);
      assert.equal(selected.fact.sourceType, type);
      assert.equal(selected.fact.length, length);
      assert.equal(selected.fact.elementSourceType, source.typeShape.getTypeArguments(type)[0]);
      assert.equal(selected.fact.elementType, undefined);
    }
  }
  const foreignFile = checked.getSourceFile("/src/arrays.ts");
  assert.ok(foreignFile !== undefined);
  const foreign = checked.getSourceFileQueries(foreignFile);
  const type = foreign.checker.getTypeFromTypeNode(typeAliasType(session, foreignFile, "Huge"));
  assert.ok(type !== undefined);
  const selected = selectTsonicFixedArray(type, foreign, sourceFacts(session));
  assert.ok(selected?.kind === "selected");
  assert.equal(selected.fact.length, 9007199254740993n);
});

test("fixed-array selection unwraps inferred factory return arguments and retains supplied primitive annotations", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { create } from "./factory.js";
    import type { int32, uint32 } from "@tsonic/core/types.js";
    const inferred = create({}, 9007199254740993n);
    const unsigned = create<uint32, 2n>(0, 2n);
    const signed = create<int32, 2n>(0, 2n);
  `, {
    "/src/factory.d.ts": `
      import type { FixedArray } from "@tsonic/core/types.js";
      interface Layout<Value> { readonly value: Value; }
      export declare function create<Element, Count extends number | bigint>(
        element: Element, count: Count
      ): Layout<FixedArray<Element, Count>>;
    `,
  });
  const source = checkSource(session).getSourceFileQueries(sourceFile);
  for (const [index, primitive] of [undefined, "uint32", "int32"].entries()) {
    const call = callExpression(session, sourceFile, "create", index);
    const selected = source.checker.getResolvedCallInfo(call);
    assert.ok(selected?.outcome === "applicable");
    const arrayType = source.typeShape.getTypeArguments(selected.sourceResultType)[0];
    const element = selected.sourceSelectedMethodTypeArguments?.[0];
    assert.ok(arrayType !== undefined && element !== undefined);
    const fixed = selectTsonicFixedArray(arrayType, source, sourceFacts(session), { elementType: element.explicitTypeNode });
    assert.ok(fixed?.kind === "selected");
    assert.equal(fixed.fact.sourceType, arrayType);
    assert.equal(fixed.fact.elementSourceType, element.selectedType);
    assert.equal(fixed.fact.length, index === 0 ? 9007199254740993n : 2n);
    assert.equal(fixed.fact.lengthRuntimeBase, "bigint");
    assert.equal(fixed.fact.elementType, element.explicitTypeNode);
    if (primitive === undefined) {
      assert.equal(fixed.fact.elementType, undefined);
    } else {
      assert.equal(typeReferenceName(session, fixed.fact.elementType), primitive);
      assert.equal(getSourceFact(session, fixed.fact.elementType, sourcePrimitiveFactKey)?.kind, primitive);
    }
  }
});

test("fixed-array selector distinguishes invalid canonical extents from noncanonical types", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import type { FixedArray, uint8 } from "@tsonic/core/types.js";
    type Open = FixedArray<uint8, number>;
    type OpenBig = FixedArray<uint8, bigint>;
    type Negative = FixedArray<uint8, -1>;
    type NegativeBig = FixedArray<uint8, -9007199254740993n>;
    type Fractional = FixedArray<uint8, 1.5>;
    type UnsafeInteger = FixedArray<uint8, 9007199254740993>;
    type Ambiguous = FixedArray<uint8, 2 | 3>;
    type Anything = FixedArray<uint8, any>;
    type Never = FixedArray<uint8, never>;
  `);
  const checked = checkSource(session);
  const diagnostics = definedDiagnostics(checked.extensionDiagnostics);
  assert.equal(diagnostics.length, 9);
  assert.ok(diagnostics.every(diagnostic => diagnostic.extensionCode === "SOURCE_CORE_FIXED_ARRAY_LENGTH_NOT_LITERAL"));
  const source = checked.getSourceFileQueries(sourceFile);
  for (const name of ["Open", "OpenBig", "Negative", "NegativeBig", "Fractional", "UnsafeInteger", "Ambiguous", "Anything", "Never"]) {
    const node = typeAliasType(session, sourceFile, name);
    const type = source.checker.getTypeFromTypeNode(node);
    assert.ok(type !== undefined);
    assert.equal(selectTsonicFixedArray(type, source, sourceFacts(session))?.kind, "invalid", name);
    assert.equal(getSourceFact(session, node, tsonicFixedArrayFactKey), undefined, name);
  }
});

test("fixed-array selection requires provider facts rather than marker names or structural similarity", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { FixedArray as Canonical } from "@tsonic/core/types.js";
    import type { FixedArray as Foreign } from "./local.js";
    type FixedArray<Element, Count extends number | bigint> = ReadonlyArray<Element> & { readonly length: Count };
    type Local = FixedArray<number, 2>;
    type Imported = Foreign<number, 2>;
    type Real = Canonical<number, 2>;
  `, {
    "/src/local.ts": "export interface FixedArray<Element, Count extends number | bigint> { readonly length: Count; readonly [index: number]: Element; }",
  });
  const source = checkSource(session).getSourceFileQueries(sourceFile);
  const facts = sourceFacts(session);
  for (const name of ["Local", "Imported"]) {
    const node = typeAliasType(session, sourceFile, name);
    const type = source.checker.getTypeFromTypeNode(node);
    assert.ok(type !== undefined);
    assert.equal(selectTsonicFixedArray(type, source, facts, { authoredTypeNode: node }), undefined);
  }
  const real = typeAliasType(session, sourceFile, "Real");
  const type = source.checker.getTypeFromTypeNode(real);
  assert.ok(type !== undefined);
  assert.equal(selectTsonicFixedArray(type, source, facts)?.kind, "selected");
  const missing: Pick<ReadonlySourceFactResolver, "getFact"> = {
    getFact: (subject, key) => Object.is(key, providerVirtualDeclarationFactKey) ? undefined : facts.getFact(subject, key),
  };
  assert.equal(selectTsonicFixedArray(type, source, missing, { authoredTypeNode: real }), undefined);
});

test("fixed-array selection rejects mismatched authored array and element evidence", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { FixedArray } from "@tsonic/core/types.js";
    type Pair = FixedArray<number, 2>;
    type Triple = FixedArray<number, 3>;
    type WrongElement = string;
  `);
  const source = checkSource(session).getSourceFileQueries(sourceFile);
  const type = source.checker.getTypeFromTypeNode(typeAliasType(session, sourceFile, "Pair"));
  assert.ok(type !== undefined);
  assert.equal(selectTsonicFixedArray(type, source, sourceFacts(session), {
    authoredTypeNode: typeAliasType(session, sourceFile, "Triple"),
  })?.kind, "invalid");
  assert.equal(selectTsonicFixedArray(type, source, sourceFacts(session), {
    elementType: typeAliasType(session, sourceFile, "WrongElement"),
  })?.kind, "invalid");
});
