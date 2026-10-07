import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompilerSessionFromFiles,
  createSourceSemanticsExtension,
  formatDiagnostics,
  sourcePrimitive,
  sourcePrimitiveFactKey,
  type Node,
} from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { sourceIndexedTypeEvidence, sourceTransformedTypeFactEvidenceNodes } from "./type-component-evidence.js";
import { sourceBoundTypeRelationship } from "./bound-type-relationship.js";
import { typescriptNoLibUtilityDeclarations } from "../source-profiles/typescript-no-lib-utilities.js";

function fixture(canonicalUtilities = false) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      ...(canonicalUtilities ? {
        "/src/typescript-utilities.d.ts": typescriptNoLibUtilityDeclarations,
        "/src/globals.d.ts": `
          interface Object {}
          interface Function {}
          interface CallableFunction extends Function {}
          interface NewableFunction extends Function {}
          interface String {}
          interface Number {}
          interface Boolean {}
          interface RegExp {}
          interface IArguments { length: number; [index: number]: unknown }
          interface Array<T> { length: number; [index: number]: T }
          interface ReadonlyArray<T> { readonly length: number; readonly [index: number]: T }
        `,
      } : {}),
      "/src/node_modules/@test/native/package.json": JSON.stringify({
        name: "@test/native", version: "1.0.0", type: "module", exports: { "./types.js": "./types.d.ts" },
      }),
      "/src/node_modules/@test/native/types.d.ts": `
        export type word = number;
        export interface Store<T> { readonly [key: string]: T | undefined }
        export interface DerivedStore<T> extends Store<T> {}
      `,
      "/src/index.ts": `
        import type { DerivedStore, word } from "@test/native/types.js";
        type Floating = number;
        type Wide = bigint;
        type Callable = (first: Floating, second: Wide) => string;
        type Indirect = Callable;
        type Exact = word;
        type Mixed = [Exact, Floating];
        type Recursive = { next?: Recursive; value: word };
        type Fields = { first: word; second: word; optional?: word; ordinary: number };
        type First = Fields["first"];
        type Several = Fields["first" | "second"];
        type Optional = Fields["optional"];
        type Present = NonNullable<Fields["optional"]>;
        type PresentAlias = NonNullable<Optional>;
        type PresentNested = NonNullable<PresentAlias>;
        type Absent = NonNullable<null | undefined>;
        type Indexed = { [key: string]: number }[string];
        type ImportedIndexed = DerivedStore<word>[string];
        type NumberIndexed = { readonly [key: number]: word }[number];
        type Deferred<T, K extends keyof T> = T[K];
        type NativeArray = word[];
        type TextArray = string[];
        type Arrays = NativeArray | TextArray;
        type NativeFactory = () => word;
        type Composed = Arrays | NativeFactory;
        type Bound<T> = string | T[];
        type Applied = Bound<word>;
        type Wrong = Bound<boolean>;
        type RecordUnion<T> = { kind: "values"; values: T[] } | { kind: "call"; callback: (value: T) => T };
        type AppliedRecordUnion = RecordUnion<word>;
        type WrongRecordUnion = RecordUnion<boolean>;
        type ForeignRecordUnion<T> = { kind: "values"; values: T[] } | { kind: "call"; callback: (value: T) => T };
        type ForeignAppliedRecordUnion = ForeignRecordUnion<word>;
      `,
    },
    compilerOptions: { strict: true, noLib: canonicalUtilities, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: [{
      moduleSpecifier: "@test/native/types.js", packageName: "@test/native", subpath: "types.js",
      exports: [sourcePrimitive("word", "int32", "number", true, 32)],
    }] })] },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const aliases = new Map<string, Node>();
  for (const declaration of source.ast.statements(file)) {
    if (declaration !== undefined && source.ast.is.IsTypeAliasDeclaration(declaration)) {
      const type = source.ast.typeNode(declaration);
      assert.ok(type);
      aliases.set(source.ast.text(source.ast.name(declaration)), type);
    }
  }
  const alias = (name: string) => {
    const node = aliases.get(name);
    assert.ok(node);
    return node;
  };
  const selected = (name: string) => {
    const type = semantics.types.authoredType(alias(name));
    assert.ok(type);
    return type;
  };
  return { source, semantics, alias, selected };
}

test("transformed components retain ordinary keyword evidence through exact aliases", () => {
  const { source, semantics, alias, selected } = fixture();
  for (const name of ["Floating", "Wide"]) {
    const nodes = sourceTransformedTypeFactEvidenceNodes(source.ast, semantics, alias("Indirect"), selected(name));
    assert.deepEqual(nodes, [alias(name)]);
    assert.ok(Object.isFrozen(nodes));
  }
});

test("canonical nullish removal retains its exact authored component", () => {
  const { semantics, alias, selected, source } = fixture(true);
  for (const name of ["Present", "PresentAlias", "PresentNested", "Absent"]) {
    const node = alias(name);
    const transformation = semantics.types.standardTransformation(node, selected(name));
    const expectedKind = name === "PresentNested" ? "component" : "non-nullish";
    assert.ok(transformation?.kind === expectedKind);
    assert.ok(Object.isFrozen(transformation));
    assert.ok(Object.isFrozen(transformation.component));
    assert.ok(transformation.kind === "component" || transformation.kind === "non-nullish");
    const inputNode = transformation.component.authoredTypeNode;
    assert.ok(inputNode);
    assert.equal(inputNode, source.ast.typeArguments(node)[0]);
    const inputType = semantics.types.authoredType(inputNode);
    assert.ok(inputType);
    assert.ok(semantics.types.isIdentical(transformation.component.selectedType, inputType));
    assert.deepEqual(semantics.types.standardTransformation(node, selected("TextArray")), { kind: "unresolved" });
  }
  assert.equal(semantics.types.isNever(selected("Absent")), true);
  const ordinary = fixture();
  assert.equal(ordinary.semantics.types.standardTransformation(ordinary.alias("Present"), ordinary.selected("Present")), undefined);
});

test("native primitive aliases never expose their erased implementation keyword", () => {
  const { source, semantics, alias, selected } = fixture();
  const nodes = sourceTransformedTypeFactEvidenceNodes(source.ast, semantics, alias("Exact"), selected("Floating"));
  assert.equal(nodes.length, 1);
  assert.equal(source.sourceFacts.getFact(nodes[0]!, sourcePrimitiveFactKey)?.kind, "int32");
  assert.equal(source.ast.is.IsKeywordTypeNode(nodes[0]!), false);
});

test("mixed native and ordinary component evidence remains distinguishable", () => {
  const { source, semantics, alias, selected } = fixture();
  const nodes = sourceTransformedTypeFactEvidenceNodes(source.ast, semantics, alias("Mixed"), selected("Floating"));
  assert.equal(nodes.length, 2);
  assert.equal(nodes.filter(node => source.sourceFacts.getFact(node, sourcePrimitiveFactKey)?.kind === "int32").length, 1);
  assert.equal(nodes.filter(node => source.ast.is.IsKeywordTypeNode(node)).length, 1);
});

test("recursive authored closures terminate and return each evidence node once", () => {
  const { semantics, alias } = fixture();
  const nodes = semantics.facts.authoredTypeNodes(alias("Recursive"));
  assert.ok(nodes.length > 0 && nodes.length < 10);
  assert.equal(new Set(nodes).size, nodes.length);
  assert.ok(Object.isFrozen(nodes));
});

test("indexed member evidence retains exact selected symbols, signatures and optionality", () => {
  const { source, semantics, alias } = fixture();
  for (const [name, count, optional] of [["First", 1, false], ["Several", 2, false], ["Optional", 1, true]] as const) {
    const evidence = sourceIndexedTypeEvidence(source.ast, semantics, alias(name));
    assert.ok(evidence);
    assert.equal(evidence.members.length, count);
    assert.ok(Object.isFrozen(evidence));
    assert.ok(Object.isFrozen(evidence.members));
    for (const member of evidence.members) {
      assert.ok(member.selection.kind === "property");
      assert.equal(member.selection.property.optional, optional);
      assert.ok(member.subjects.includes(member.selection.property.symbol));
      assert.ok(Object.isFrozen(member));
      assert.ok(Object.isFrozen(member.subjects));
      assert.equal(new Set(member.subjects).size, member.subjects.length);
    }
  }
  const index = sourceIndexedTypeEvidence(source.ast, semantics, alias("Indexed"));
  assert.ok(index?.members.length === 1);
  const member = index.members[0]!;
  assert.ok(member.selection.kind === "index");
  assert.ok(member.subjects.includes(member.selection.index.declaration!));
  assert.ok(Object.isFrozen(index) && Object.isFrozen(index.members) && Object.isFrozen(member.subjects));
  for (const name of ["Deferred", "Floating"]) {
    assert.equal(sourceIndexedTypeEvidence(source.ast, semantics, alias(name)), undefined);
  }
});

test("indexed member evidence retains cross-file generic readonly declarations and exact read types", () => {
  const { source, semantics, alias, selected } = fixture();
  for (const name of ["ImportedIndexed", "NumberIndexed"]) {
    const evidence = sourceIndexedTypeEvidence(source.ast, semantics, alias(name));
    assert.ok(evidence?.members.length === 1);
    const member = evidence.members[0]!;
    assert.ok(member.selection.kind === "index");
    const declaration = member.selection.index.declaration;
    assert.ok(declaration !== undefined && member.subjects.includes(declaration));
    assert.equal(member.selection.index.readonly, true);
    assert.equal(semantics.types.isIdentical(member.selection.readType, selected(name)), true);
    assert.ok(Object.isFrozen(member.selection) && Object.isFrozen(member.selection.index));
    if (name === "ImportedIndexed") {
      assert.equal(source.ast.getFileName(source.ast.getSourceFile(declaration)!), "/src/node_modules/@test/native/types.d.ts");
    }
  }
});

test("transformed aliases retain indexed selection syntax without requiring a fact on that syntax", () => {
  const { source, semantics, alias, selected } = fixture();
  const nodes = sourceTransformedTypeFactEvidenceNodes(source.ast, semantics, alias("First"), selected("First"));
  assert.ok(nodes.includes(alias("First")));
  assert.equal(source.sourceFacts.getFacts(alias("First")).length, 0);
});

test("composed aliases retain container and callable syntax with exact generic arguments", () => {
  const { source, semantics, alias, selected } = fixture();
  for (const name of ["NativeArray", "TextArray", "NativeFactory"]) {
    const nodes = sourceTransformedTypeFactEvidenceNodes(source.ast, semantics, alias("Composed"), selected(name));
    assert.deepEqual(nodes, [alias(name)]);
    assert.ok(Object.isFrozen(nodes));
    assert.equal(source.sourceFacts.getFacts(nodes[0]!).length, 0);
  }
  assert.deepEqual(sourceTransformedTypeFactEvidenceNodes(source.ast, semantics, alias("NativeArray"), selected("TextArray")), []);
});

test("bound source correspondence retains generic union members and rejects changed bindings", () => {
  const { source, semantics, alias, selected } = fixture();
  const declaration = source.ast.parent(alias("Bound"));
  assert.ok(declaration);
  const application = semantics.types.instantiateAlias(declaration, [selected("Exact")]);
  assert.ok(application);
  const binding = (declaration: Node) => application.bindings.find(entry => entry.declaration === declaration)?.argument;
  assert.equal(sourceBoundTypeRelationship(selected("Bound"), selected("Applied"), semantics, binding), "bound");
  assert.equal(sourceBoundTypeRelationship(selected("Bound"), selected("Wrong"), semantics, binding), undefined);
  assert.equal(sourceBoundTypeRelationship(selected("Bound"), selected("Applied"), semantics, () => undefined), undefined);
  assert.equal(sourceBoundTypeRelationship(selected("NativeArray"), selected("TextArray"), semantics, binding), undefined);
});

test("bound source members preserve exact record and callable declarations without carrier reconstruction", () => {
  const { source, semantics, alias, selected } = fixture();
  const declaration = source.ast.parent(alias("RecordUnion"));
  assert.ok(declaration);
  const application = semantics.types.instantiateAlias(declaration, [selected("Exact")]);
  assert.ok(application);
  const binding = (declaration: Node) => application.bindings.find(entry => entry.declaration === declaration)?.argument;
  const original = semantics.types.unionOrIntersectionTypes(selected("RecordUnion"));
  const applied = semantics.types.unionOrIntersectionTypes(selected("AppliedRecordUnion"));
  assert.equal(original.length, 2);
  for (const member of original) {
    assert.equal(applied.filter(other => sourceBoundTypeRelationship(member, other, semantics, binding) === "bound").length, 1);
    for (const name of ["WrongRecordUnion", "ForeignAppliedRecordUnion"]) {
      assert.ok(semantics.types.unionOrIntersectionTypes(selected(name)).every(other =>
        sourceBoundTypeRelationship(member, other, semantics, binding) === undefined));
    }
  }
  const changed = { ...semantics, types: { ...semantics.types,
    structuralMembers: (...arguments_: Parameters<typeof semantics.types.structuralMembers>) => {
      const relation = semantics.types.structuralMembers(...arguments_);
      return relation.kind !== "available" ? relation : { ...relation, members: relation.members.map(member =>
        member.kind !== "present" ? member : { ...member, source: { ...member.source,
          property: { ...member.source.property, optional: !member.source.property.optional } } }) };
    },
  } };
  assert.ok(original.every(member => applied.every(other => sourceBoundTypeRelationship(member, other, changed, binding) === undefined)));
});
