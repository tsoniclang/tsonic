import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import {
  createProgramOptionsForProject,
  createTsonicSemanticSession,
  parseTsonicProjectConfig,
} from "../packages/host/dist/index.js";
import {
  finalizeTargetDiagnostics,
} from "../packages/host/dist/diagnostics.js";
import {
  createSourceProgramNavigation,
  createTargetSourceProgram,
  sourceTypeSyntaxIsCompositional,
} from "../packages/target-api/dist/index.js";
import {
  sourcePrimitiveFactKey,
} from "../packages/tsts/dist/src/index.js";

const tempRoot = resolve(
  process.cwd(),
  ".temp/test-runs/source-navigation",
  `${Date.now()}-${process.pid}`,
);

test("source navigation resolves project references, shapes, constructors, and dispatch", async () => {
  const source = await checkedSource("project-navigation", {
    "src/index.ts": [
      "export class Base {",
      "  read(): number { return 1; }",
      "}",
      "export class Derived extends Base {",
      "  read(): number { return 2; }",
      "}",
      "declare const computedKey: unique symbol;",
      "export class Computed {",
      "  [computedKey](): number { return 3; }",
      "}",
      "export class OptionalConstructor {",
      "  constructor(value: number = 1) { void value; }",
      "}",
      "export class RequiredConstructor {",
      "  constructor(value: number) { void value; }",
      "}",
      "export interface Shape { value: number; }",
      "export const derived = new Derived();",
      "export const optional = new OptionalConstructor();",
      "export const required = new RequiredConstructor(1);",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  const baseClass = namedDeclaration(ast, sourceFile, "Base");
  const derivedClass = namedDeclaration(ast, sourceFile, "Derived");
  const baseRead = namedMember(ast, baseClass, "read");
  const derivedRead = namedMember(ast, derivedClass, "read");
  const computedClass = namedDeclaration(ast, sourceFile, "Computed");
  const computedMember = ast.members(computedClass)[0];
  const derivedBase = heritageBaseReference(ast, derivedClass);
  const derivedReference = constructorReference(ast, sourceFile, "Derived");
  const optionalReference = constructorReference(
    ast,
    sourceFile,
    "OptionalConstructor",
  );
  const requiredReference = constructorReference(
    ast,
    sourceFile,
    "RequiredConstructor",
  );
  const shape = namedDeclaration(ast, sourceFile, "Shape");

  assert.strictEqual(
    navigation.referenceFor(derivedReference)?.declaration,
    derivedClass,
  );
  assert.strictEqual(navigation.referenceFor(derivedBase)?.declaration, baseClass);
  assert.strictEqual(navigation.declarationFor(derivedReference), derivedClass);
  assert.equal(navigation.isProjectDeclaration(derivedClass), true);
  assert.equal(navigation.isProjectShape(derivedReference), true);
  assert.equal(navigation.isProjectShape(ast.name(shape)), true);
  assert.equal(navigation.isProjectConstructibleObject(derivedReference), true);
  assert.equal(navigation.isProjectConstructibleObject(optionalReference), true);
  assert.equal(navigation.isProjectConstructibleObject(requiredReference), false);
  assert.deepEqual(navigation.memberDispatch(baseRead), {
    overridesBase: false,
    hasDerivedOverride: true,
  });
  assert.deepEqual(navigation.memberDispatch(derivedRead), {
    overridesBase: true,
    hasDerivedOverride: false,
  });
  assert.equal(navigation.memberDispatch(computedMember), undefined);
});

test("target source semantics answer checked-source questions without exposing raw checker access", async () => {
  const checked = await checkedSource("target-source-semantics", {
    "src/index.ts": [
      "function identity<T>(value: T): T { return value; }",
      "export const value = identity<string>(\"ready\");",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const call = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsCallExpression(node));
  const first = source.semantics.forFile(sourceFile);
  const second = source.semantics.forNode(call);

  assert.strictEqual(first, second);
  assert.equal(source.semantics.includes(sourceFile), true);
  assert.equal(source.semantics.includes({}), false);
  assert.doesNotThrow(() => source.navigation.referenceFor(sourceFile));
  assert.equal("checker" in first, false);
  assert.equal("typeShape" in first, false);
  assert.equal("getSourceFileQueries" in source, false);
  assert.equal(
    first.getResolvedCallInfo(call)?.sourceSelectedSignatureKind,
    "resolved",
  );
  assert.equal(first.isStringLike(first.getTypeAtLocation(call)), true);
});

test("authored type fact subjects include exact imported semantic provenance", async () => {
  const checked = await checkedSource("authored-imported-type-facts", {
    "src/index.ts": [
      'import type { int32 } from "@tsonic/core/types.js";',
      "export function read(value: int32): int32 { return value; }",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const typeReference = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsTypeReferenceNode(node) &&
    source.ast.text(source.ast.as.AsTypeReferenceNode(node)?.TypeName) === "int32");
  const subjects = source.semantics.forNode(typeReference)
    .getAuthoredTypeFactSubjects(typeReference);
  const primitiveFacts = subjects
    .map((subject) => source.sourceFacts.getFact(subject, sourcePrimitiveFactKey))
    .filter((fact) => fact !== undefined);

  assert.equal(primitiveFacts.length > 0, true);
  assert.deepEqual([...new Set(primitiveFacts.map((fact) => fact.kind))], ["int32"]);
});

test("target source semantics preserve selected signature return syntax", async () => {
  const checked = await checkedSource("selected-call-result", {
    "src/index.ts": [
      "type Mapper<T, U> = (value: T) => U;",
      "export function map<T, U>(value: T, mapper: Mapper<T, U>): U {",
      "  return mapper(value);",
      "}",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const semantics = source.semantics.forFile(sourceFile);
  const call = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsCallExpression(node));
  const resolved = semantics.getResolvedCallInfo(call);

  assert.notEqual(resolved, undefined);
  const result = semantics.selectCallResult(resolved);
  assert.notEqual(result, undefined);
  assert.equal(
    semantics.typeToString(result.selectedReturnType),
    "U",
  );
  assert.equal(semantics.typeToString(result.resultType), "U");
  assert.equal(
    source.ast.kindName(result.authoredTypeNode),
    "KindTypeReference",
  );
  assert.equal(
    source.ast.text(
      source.ast.as.AsTypeReferenceNode(result.authoredTypeNode)?.TypeName,
    ),
    "U",
  );
});

test("target source semantics expand exact selected symbols to their declaration provenance", async () => {
  const checked = await checkedSource("selected-member-provenance", {
    "src/index.ts": [
      "type Found = { kind: \"found\"; value: number };",
      "type Missing = { kind: \"missing\"; value: number };",
      "type Lookup = Found | Missing;",
      "export function read(value: Lookup): string { return value.kind; }",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const semantics = source.semantics.forFile(sourceFile);
  const property = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsPropertyAccessExpression(node));
  const selected = semantics.getResolvedPropertyAccessInfo(property);
  const subjects = semantics.getSelectedFactSubjects(
    selected?.selectedSymbol,
    selected?.selectedDeclaration,
  );

  assert.notEqual(selected?.selectedSymbol, undefined);
  assert.equal(selected?.selectedDeclaration, undefined);
  assert.equal(subjects.includes(selected.selectedSymbol), true);
  assert.deepEqual(
    subjects
      .filter((subject) => source.ast.is.IsPropertySignatureDeclaration(subject))
      .map((declaration) => source.ast.text(source.ast.name(declaration))),
    ["kind", "kind"],
  );
  assert.equal(
    subjects
      .filter((subject) => source.ast.is.IsPropertySignatureDeclaration(subject))
      .every((declaration) =>
        source.navigation.isProjectDeclaration(declaration)
      ),
    true,
  );
});

test("target source semantics expose checker-owned declared value types", async () => {
  const checked = await checkedSource("declared-value-types", {
    "src/index.ts": [
      "export let mutable = 0;",
      "export const immutable = 0;",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const semantics = source.semantics.forFile(sourceFile);
  const mutable = namedVariable(source.ast, sourceFile, "mutable");
  const immutable = namedVariable(source.ast, sourceFile, "immutable");

  assert.equal(
    semantics.typeToString(semantics.getDeclaredValueType(mutable)),
    "number",
  );
  assert.equal(
    semantics.typeToString(semantics.getDeclaredValueType(immutable)),
    "0",
  );
});

test("target source semantics classify value uses against their exact declarations", async () => {
  const checked = await checkedSource("value-type-refinement", {
    "src/index.ts": [
      "export function narrowed(value: string | undefined): string {",
      "  if (value === undefined) return \"missing\";",
      "  return value;",
      "}",
      "export function caught(): unknown {",
      "  try { throw \"boom\"; } catch (error) { return error; }",
      "}",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const semantics = source.semantics.forFile(sourceFile);
  const returnedValue = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsIdentifier(node) &&
    source.ast.text(node) === "value" &&
    source.ast.is.IsReturnStatement(source.ast.parent(node)));
  const returnedError = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsIdentifier(node) &&
    source.ast.text(node) === "error" &&
    source.ast.is.IsReturnStatement(source.ast.parent(node)));
  const literal = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsStringLiteral(node) && source.ast.text(node) === "missing");

  const narrowed = source.semantics.selectValueTypeRefinement(returnedValue);
  assert.equal(narrowed.kind, "resolved");
  assert.equal(
    source.ast.is.IsParameterDeclaration(narrowed.reference.declaration),
    true,
  );
  assert.equal(
    semantics.typeToString(narrowed.declaredType),
    "string | undefined",
  );
  assert.equal(semantics.typeToString(narrowed.selectedType), "string");
  assert.equal(narrowed.refinement.kind, "members");

  const exact = source.semantics.selectValueTypeRefinement(returnedError);
  assert.equal(exact.kind, "resolved");
  assert.equal(
    source.ast.is.IsVariableDeclaration(exact.reference.declaration),
    true,
  );
  assert.equal(semantics.typeToString(exact.declaredType), "unknown");
  assert.equal(semantics.typeToString(exact.selectedType), "unknown");
  assert.equal(exact.refinement.kind, "exact");

  assert.deepEqual(
    source.semantics.selectValueTypeRefinement(literal),
    { kind: "not-project-reference" },
  );
});

test("target source semantics retain authored, contextual, and flow-selected union evidence", async () => {
  const checked = await checkedSource("authored-union-flow-selection", {
    "src/index.ts": [
      "function maybeValue(): string | undefined { return undefined; }",
      "interface Payload { value: string; }",
      "interface Left { left: string; }",
      "interface Right { right: string; }",
      "function payload(): Payload | undefined { return { value: \"ready\" }; }",
      "function either(): Left | Right { return { left: \"ready\" }; }",
      "const value = maybeValue();",
      "export function read(): string {",
      "  if (value === undefined) return \"missing\";",
      "  return value;",
      "}",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const semantics = source.semantics.forFile(sourceFile);
  const declaration = namedDeclaration(source.ast, sourceFile, "maybeValue");
  const authoredType = source.ast.as.AsFunctionDeclaration(declaration)?.Type;
  const call = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsCallExpression(node));
  const sourceResult = semantics.getResolvedCallInfo(call)?.sourceResultType;
  const authoredSemanticType = semantics.getTypeFromTypeNode(authoredType);
  const narrowedValue = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsIdentifier(node) &&
    source.ast.text(node) === "value" &&
    semantics.typeToString(semantics.getTypeAtLocation(node)) === "string");
  const narrowedType = semantics.getTypeAtLocation(narrowedValue);
  const payloadObject = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsObjectLiteralExpression(node) &&
    semantics.selectContextualValueType(node).kind === "selected");
  const eitherObject = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsObjectLiteralExpression(node) &&
    semantics.selectContextualValueType(node).kind === "ambiguous");

  assert.notEqual(authoredType, undefined);
  assert.notEqual(sourceResult, undefined);
  assert.notEqual(authoredSemanticType, undefined);
  assert.notEqual(narrowedType, undefined);
  assert.deepEqual(
    semantics.selectAuthoredType(authoredType, sourceResult),
    {
      kind: "authored-members",
      nodes: [authoredType],
      selectedNullishTypes: [],
    },
  );
  const narrowed = semantics.selectAuthoredType(authoredType, narrowedType);
  assert.equal(narrowed.kind, "authored-members");
  assert.equal(narrowed.nodes.length, 1);
  assert.deepEqual(narrowed.selectedNullishTypes, []);
  assert.equal(source.ast.kindName(narrowed.nodes[0]), "KindStringKeyword");
  const semanticRefinement = semantics.selectTypeRefinement(
    authoredSemanticType,
    narrowedType,
  );
  assert.equal(semanticRefinement.kind, "members");
  assert.equal(semanticRefinement.types.length, 1);
  assert.equal(semantics.isStringLike(semanticRefinement.types[0]), true);
  const contextualPayload = semantics.selectContextualValueType(payloadObject);
  assert.equal(contextualPayload.kind, "selected");
  assert.equal(semantics.typeToString(contextualPayload.type), "Payload");
  const contextualEither = semantics.selectContextualValueType(eitherObject);
  assert.equal(contextualEither.kind, "ambiguous");
  assert.deepEqual(
    contextualEither.types.map((type) => semantics.typeToString(type)),
    ["Left", "Right"],
  );
});

test("effective type arguments ignore non-type declarations on shared symbols", async () => {
  const checked = await checkedSource("effective-type-arguments", {
    "src/index.ts": [
      "interface Box<T> { readonly value: T; }",
      "declare const Box: { new <T>(): Box<T> };",
      "export function read(value: Box<string>): string { return value.value; }",
      "export function count(value: Box<number>): number { return value.value; }",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const semantics = source.semantics.forFile(sourceFile);
  const boxTypeNode = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsTypeReferenceNode(node) &&
    semantics.typeToString(semantics.getTypeFromTypeNode(node)) ===
      "Box<string>");
  const boxType = semantics.getTypeFromTypeNode(boxTypeNode);
  const arguments_ = semantics.getEffectiveTypeArguments(boxType);
  const numberBoxTypeNode = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsTypeReferenceNode(node) &&
    semantics.typeToString(semantics.getTypeFromTypeNode(node)) ===
      "Box<number>");
  const numberBoxType = semantics.getTypeFromTypeNode(numberBoxTypeNode);
  const boxFactSubjects = semantics.getTypeFactSubjects(boxType);

  assert.equal(arguments_?.length, 1);
  assert.equal(boxFactSubjects.includes(boxType), true);
  assert.equal(
    boxFactSubjects.includes(semantics.getTypeSymbol(boxType)),
    true,
  );
  assert.equal(
    boxFactSubjects.some((subject) => subject === namedDeclaration(
      source.ast,
      sourceFile,
      "Box",
    )),
    true,
  );
  assert.equal(semantics.isStringLike(arguments_?.[0]), true);
  assert.equal(semantics.getTypeRelationship(boxType, boxType), "identical");
  assert.equal(
    semantics.getTypeRelationship(boxType, numberBoxType),
    "same-declaration",
  );
  assert.equal(
    semantics.getTypeRelationship(boxType, arguments_[0]),
    "unrelated",
  );
});

test("effective type arguments follow the instantiated generic target through a local alias", async () => {
  const checked = await checkedSource("effective-type-arguments-alias", {
    "src/index.ts": [
      "interface Box<T> { readonly value: T; }",
      "type TextBox = Box<string>;",
      "export function read(value: TextBox): string { return value.value; }",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const semantics = source.semantics.forFile(sourceFile);
  const aliasReference = requiredNode(source.ast, sourceFile, (node) =>
    source.ast.is.IsTypeReferenceNode(node) &&
    source.ast.text(source.ast.as.AsTypeReferenceNode(node)?.TypeName) ===
      "TextBox");
  const aliasType = semantics.getTypeFromTypeNode(aliasReference);
  const arguments_ = semantics.getEffectiveTypeArguments(aliasType);

  assert.equal(semantics.typeToString(aliasType), "TextBox");
  assert.equal(semantics.getSymbolName(semantics.getTypeAliasSymbol(aliasType)), "TextBox");
  assert.equal(semantics.getSymbolName(semantics.getTypeSymbol(aliasType)), "Box");
  assert.equal(arguments_?.length, 1);
  assert.equal(semantics.isStringLike(arguments_?.[0]), true);
});

test("source type syntax distinguishes compositional forms from checker transforms", async () => {
  const checked = await checkedSource("source-type-syntax-composition", {
    "src/index.ts": [
      "interface Box<T> { readonly value: T; }",
      "type Direct = Box<readonly [string, number?]> | null;",
      "type Conditional<T> = T extends Box<infer Value> ? Value : never;",
      "type Indexed<T extends { value: unknown }> = T[\"value\"];",
      "type Mapped<T> = { [Key in keyof T]: T[Key] };",
      "type Key<T> = keyof T;",
      "",
    ].join("\n"),
  });
  const sourceFile = projectSourceFile(checked, "src/index.ts");
  const typeTarget = (name) => {
    const declaration = requiredNode(checked.ast, sourceFile, (node) =>
      checked.ast.is.IsTypeAliasDeclaration(node) &&
      checked.ast.text(checked.ast.name(node)) === name);
    return checked.ast.as.AsTypeAliasDeclaration(declaration)?.Type;
  };

  assert.equal(
    sourceTypeSyntaxIsCompositional(checked.ast, typeTarget("Direct")),
    true,
  );
  for (const name of ["Conditional", "Indexed", "Mapped", "Key"]) {
    assert.equal(
      sourceTypeSyntaxIsCompositional(checked.ast, typeTarget(name)),
      false,
      name,
    );
  }
});

test("host finalizes target source-node diagnostics through the shared AST", async () => {
  const checked = await checkedSource("target-diagnostic-location", {
    "src/index.ts": "export const value = 1;\n",
  });
  const sourceFile = projectSourceFile(checked, "src/index.ts");
  const declaration = namedVariable(checked.ast, sourceFile, "value");
  const diagnostics = finalizeTargetDiagnostics(
    { source: checked },
    [{
      code: "TARGET_EXAMPLE",
      category: "error",
      message: "Example target diagnostic.",
      sourceNode: declaration,
    }],
    process.cwd(),
  );

  assert.equal("sourceNode" in diagnostics[0], false);
  assert.equal(diagnostics[0].sourceSpan?.line, 1);
  assert.equal(diagnostics[0].sourceSpan?.column > 0, true);
  assert.equal(diagnostics[0].sourceSpan?.fileName.endsWith("src/index.ts"), true);
});

test("shared source navigation resolves exact generic and transitive declared heritage", async () => {
  const checked = await checkedSource("declared-heritage", {
    "src/index.ts": [
      "export interface Named<T> { value: T; }",
      "export class Base<T> { value!: T; }",
      "export class Middle<T> extends Base<T> implements Named<T> {}",
      "export class Derived extends Middle<string> {}",
      "export class DefaultBase<T = string> {}",
      "export class DefaultDerived extends DefaultBase {}",
      "export class SameShape { value!: string; }",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const base = namedDeclaration(source.ast, sourceFile, "Base");
  const named = namedDeclaration(source.ast, sourceFile, "Named");
  const middle = namedDeclaration(source.ast, sourceFile, "Middle");
  const derived = namedDeclaration(source.ast, sourceFile, "Derived");
  const defaultDerived = namedDeclaration(
    source.ast,
    sourceFile,
    "DefaultDerived",
  );
  const sameShape = namedDeclaration(source.ast, sourceFile, "SameShape");
  const middleHeritage = source.navigation.declaredHeritage(middle);
  const semantics = source.semantics.forFile(sourceFile);

  assert.equal(middleHeritage.kind, "resolved");
  assert.deepEqual(
    middleHeritage.edges.map((edge) => ({
      kind: edge.kind,
      target: source.ast.text(source.ast.name(edge.target.declaration)),
      typeArguments: edge.typeArguments.map((argument) =>
        source.ast.kindName(argument)),
      selectedTypeArgumentCount: edge.selectedTypeArguments.length,
      selectedTypeArguments: edge.selectedTypeArguments.map((argument) =>
        semantics.typeToString(argument)),
    })),
    [
      {
        kind: "extends",
        target: "Base",
        typeArguments: ["KindTypeReference"],
        selectedTypeArgumentCount: 1,
        selectedTypeArguments: ["T"],
      },
      {
        kind: "implements",
        target: "Named",
        typeArguments: ["KindTypeReference"],
        selectedTypeArgumentCount: 1,
        selectedTypeArguments: ["T"],
      },
    ],
  );
  const defaultHeritage = source.navigation.declaredHeritage(defaultDerived);
  assert.equal(defaultHeritage.kind, "resolved");
  assert.equal(defaultHeritage.edges.length, 1);
  assert.deepEqual(defaultHeritage.edges[0].typeArguments, []);
  assert.equal(defaultHeritage.edges[0].selectedTypeArguments.length, 1);
  assert.equal(
    semantics.isStringLike(
      defaultHeritage.edges[0].selectedTypeArguments[0],
    ),
    true,
  );
  assert.deepEqual(
    source.navigation.declaredHeritagePath(derived, base).kind,
    "related",
  );
  assert.deepEqual(
    source.navigation.declaredHeritagePath(derived, named).kind,
    "related",
  );
  assert.deepEqual(
    source.navigation.declaredHeritagePath(sameShape, named),
    { kind: "unrelated" },
  );
});

test("shared source navigation exposes exact effective class constructors", async () => {
  const checked = await checkedSource("effective-constructors", {
    "src/index.ts": [
      "export class Base<T> { constructor(value: T, count?: number) { void value; void count; } }",
      "export class Derived extends Base<string> {}",
      "export class Explicit extends Base<string> { constructor(value: string) { super(value); } }",
      "export class Empty {}",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const semantics = source.semantics.forFile(sourceFile);
  const constructors = (name) => {
    const declaration = namedDeclaration(source.ast, sourceFile, name);
    const result = source.navigation.classConstructors(declaration);
    assert.equal(result.kind, "resolved");
    return result;
  };

  const derived = constructors("Derived");
  assert.equal(derived.implicit, true);
  assert.deepEqual(
    derived.signatures.map((signature) => ({
      declarationOwner: source.ast.text(
        source.ast.name(source.ast.parent(signature.declaration)),
      ),
      parameters: signature.parameters.map((parameter) => ({
        name: parameter.parameterName,
        type: semantics.typeToString(parameter.selectedType),
        omission: parameter.acceptsOmission,
        rest: parameter.rest,
      })),
    })),
    [{
      declarationOwner: "Base",
      parameters: [
        { name: "value", type: "string", omission: false, rest: false },
        {
          name: "count",
          type: "number | undefined",
          omission: true,
          rest: false,
        },
      ],
    }],
  );
  assert.equal(constructors("Explicit").implicit, false);
  const empty = constructors("Empty");
  assert.equal(empty.implicit, true);
  assert.equal(empty.signatures.length, 1);
  assert.equal(empty.signatures[0].declaration, undefined);
  assert.deepEqual(empty.signatures[0].parameters, []);
});

test("source navigation proves references outside an exact excluded subtree", async () => {
  const source = await checkedSource("reference-usage", {
    "src/index.ts": [
      "export function read(): number {",
      "  const used = 1;",
      "  const unused = 2;",
      "  const neverUsed = 3;",
      "  void unused;",
      "  return used;",
      "}",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  const used = namedVariable(ast, sourceFile, "used");
  const unused = namedVariable(ast, sourceFile, "unused");
  const neverUsed = namedVariable(ast, sourceFile, "neverUsed");
  const checker = source.getSourceFileQueries(sourceFile).checker;
  const usedName = ast.name(used);
  const unusedName = ast.name(unused);
  const neverUsedName = ast.name(neverUsed);
  const usedSymbol = checker.getSymbolAtLocation(usedName, { sourceFile });
  const unusedSymbol = checker.getSymbolAtLocation(unusedName, { sourceFile });
  const neverUsedSymbol = checker.getSymbolAtLocation(neverUsedName, {
    sourceFile,
  });

  assert.notEqual(usedSymbol, undefined);
  assert.notEqual(unusedSymbol, undefined);
  assert.notEqual(neverUsedSymbol, undefined);
  assert.equal(navigation.hasReferenceOutside(usedSymbol, used), true);
  assert.equal(navigation.hasReferenceOutside(unusedSymbol, unused), true);
  assert.equal(navigation.hasReferenceOutside(neverUsedSymbol, neverUsed), false);
  assert.equal(navigation.hasReferenceOutside(usedSymbol, sourceFile), false);
});

test("shared source navigation classifies exact binding writes without treating object mutation as rebinding", async () => {
  const source = await checkedSource("binding-writes", {
    "src/index.ts": [
      "export function update(values: number[]): void {",
      "  let direct = 0;",
      "  direct = 1;",
      "  let compound = 0;",
      "  compound += 1;",
      "  let incremented = 0;",
      "  incremented++;",
      "  let destructured = 0;",
      "  [destructured] = values;",
      "  let propertyTarget = { value: 0 };",
      "  propertyTarget.value = 1;",
      "  let iterated = 0;",
      "  for (iterated of values) void iterated;",
      "  let untouched = 0;",
      "  void untouched;",
      "}",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  const checker = source.getSourceFileQueries(sourceFile).checker;
  const writesFor = (name) => {
    const declaration = namedVariable(ast, sourceFile, name);
    const symbol = checker.getSymbolAtLocation(ast.name(declaration), {
      sourceFile,
    });
    assert.notEqual(symbol, undefined);
    return navigation.bindingWritesWithin(symbol, sourceFile);
  };

  assert.deepEqual(writesFor("direct").map((write) => write.kind), ["assignment"]);
  assert.deepEqual(writesFor("compound").map((write) => write.kind), ["assignment"]);
  assert.deepEqual(writesFor("incremented").map((write) => write.kind), ["update"]);
  assert.deepEqual(writesFor("destructured").map((write) => write.kind), ["assignment"]);
  assert.deepEqual(writesFor("iterated").map((write) => write.kind), ["iteration"]);
  assert.deepEqual(writesFor("propertyTarget"), []);
  assert.deepEqual(writesFor("untouched"), []);
});

test("source navigation resolves shorthand values through the checker-selected value symbol", async () => {
  const source = await checkedSource("shorthand-value-reference", {
    "src/index.ts": [
      "export function make(value: number) {",
      "  return { value };",
      "}",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const parameter = requiredNode(ast, sourceFile, (node) =>
    ast.is.IsParameterDeclaration(node) &&
    ast.text(ast.name(node)) === "value");
  const shorthand = requiredNode(ast, sourceFile, (node) =>
    ast.is.IsShorthandPropertyAssignment(node));
  const reference = ast.name(shorthand);

  assert.notEqual(reference, undefined);
  assert.strictEqual(
    createSourceProgramNavigation(source).referenceFor(reference)?.declaration,
    parameter,
  );
});

test("source navigation classifies runtime import and export dependencies exactly", async () => {
  const cases = [
    moduleCase("side-effect", true, (path) => `import "${path}";`),
    moduleCase("type-import", false, (path, index) => `import type { Shape as Shape${index} } from "${path}";`),
    moduleCase("inline-type-import", false, (path, index) => `import { type Shape as Shape${index} } from "${path}";`),
    moduleCase("mixed-import", true, (path, index) => `import { type Shape as Shape${index}, value as value${index} } from "${path}";`),
    moduleCase("default-and-type", true, (path, index) => `import defaultValue${index}, { type Shape as Shape${index} } from "${path}";`),
    moduleCase("namespace-import", true, (path, index) => `import * as values${index} from "${path}";`),
    moduleCase("type-namespace-import", false, (path, index) => `import type * as values${index} from "${path}";`),
    moduleCase("empty-import", true, (path) => `import {} from "${path}";`),
    moduleCase("type-export", false, (path) => `export type { Shape } from "${path}";`),
    moduleCase("inline-type-export", false, (path) => `export { type Shape } from "${path}";`),
    moduleCase("mixed-export", true, (path) => `export { type Shape, value } from "${path}";`),
    moduleCase("export-star", true, (path) => `export * from "${path}";`),
    moduleCase("namespace-export", true, (path) => `export * as values from "${path}";`),
    moduleCase("type-namespace-export", false, (path) => `export type * as values from "${path}";`),
    moduleCase("empty-export", true, (path) => `export {} from "${path}";`),
  ];
  const files = {
    "src/index.ts": cases
      .map((entry, index) => entry.render(`./${entry.id}.js`, index))
      .join("\n") + "\n",
  };
  for (const entry of cases) {
    files[`src/${entry.id}.ts`] = [
      "export interface Shape { value: number; }",
      "export const value = 1;",
      "export default value;",
      "",
    ].join("\n");
  }
  const source = await checkedSource("module-dependencies", files);
  const entry = projectSourceFile(source, "src/index.ts");
  const dependencies = createSourceProgramNavigation(source)
    .moduleDependencies(entry)
    .map((dependency) => source.ast.getFileName(dependency.sourceFile))
    .map((fileName) => fileName.slice(fileName.lastIndexOf("/") + 1));

  assert.deepEqual(
    dependencies,
    cases.filter((entry) => entry.runtime).map((entry) => `${entry.id}.ts`),
  );
  const references = createSourceProgramNavigation(source)
    .moduleReferences(entry)
    .map((dependency) => source.ast.getFileName(dependency.sourceFile))
    .map((fileName) => fileName.slice(fileName.lastIndexOf("/") + 1));
  assert.deepEqual(
    references,
    cases.map((entry) => `${entry.id}.ts`),
  );
});

test("source navigation classifies top-level await without entering function bodies", async () => {
  const source = await checkedSource("module-top-level-await", {
    "src/entry.ts": [
      "interface Promise<T> {}",
      "declare function ready(): Promise<void>;",
      "export async function nested(): Promise<void> {",
      "  await ready();",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { nested } from \"./entry.js\";",
      "await nested();",
      "",
    ].join("\n"),
  });
  const navigation = createSourceProgramNavigation(source);
  const entry = projectSourceFile(source, "src/entry.ts");
  const index = projectSourceFile(source, "src/index.ts");

  assert.equal(navigation.moduleHasTopLevelAwait(entry), false);
  assert.equal(navigation.moduleHasTopLevelAwait(index), true);
  assert.equal(navigation.moduleHasTopLevelAwait(index), true);
});

test("source navigation never queries declaration-provider files as project source", () => {
  const projectFile = {
    FileName: "/project/index.ts",
    Path: "/project/index.ts",
    IsDeclarationFile: false,
  };
  const providerFile = {
    FileName: "tsts-provider://canonical/System.js.d.ts",
    Path: "tsts-provider://canonical/System.js.d.ts",
    IsDeclarationFile: true,
  };
  const providerDeclaration = {
    Kind: 264,
    Pos: 0,
    End: 20,
    SourceFile: providerFile,
  };
  let queryCount = 0;
  const source = {
    sourceFiles: [projectFile, providerFile],
    ast: {
      getFileName: (sourceFile) => sourceFile.FileName,
      getPath: (sourceFile) => sourceFile.Path,
      getSourceFile: (node) => node?.SourceFile,
      kind: (node) => node?.Kind,
      pos: (node) => node?.Pos,
      end: (node) => node?.End,
      statements: () => [],
      forEachChild: () => undefined,
      is: new Proxy({}, { get: () => () => false }),
    },
    getSourceFileQueries() {
      queryCount += 1;
      throw new Error("Provider declaration files are not project query roots.");
    },
  };
  const navigation = createSourceProgramNavigation(source);

  assert.equal(navigation.referenceFor(providerDeclaration), undefined);
  assert.equal(navigation.declarationFor(providerDeclaration), undefined);
  assert.equal(navigation.isProjectDeclaration(providerDeclaration), false);
  assert.equal(queryCount, 0);
});

test("source navigation resolves imported declaration references without treating them as project source", async () => {
  const source = await checkedSource("external-declaration-reference", {
    "src/provider.d.ts": [
      "export declare class Environment {}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { Environment } from \"./provider.js\";",
      "export const captured = Environment;",
      "",
    ].join("\n"),
  });
  const ast = source.ast;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const captured = namedVariable(ast, sourceFile, "captured");
  const initializer = ast.as.AsVariableDeclaration(captured)?.Initializer;
  assert.notEqual(initializer, undefined);

  const navigation = createSourceProgramNavigation(source);
  const reference = navigation.sourceReferenceFor(initializer);
  assert.equal(ast.is.IsClassDeclaration(reference?.declaration), true);
  assert.equal(ast.text(ast.name(reference?.declaration)), "Environment");
  assert.match(ast.getFileName(reference?.sourceFile), /src\/provider\.d\.ts$/u);
  assert.equal(reference?.project, false);
  assert.equal(navigation.referenceFor(initializer), undefined);
  assert.equal(navigation.isProjectDeclaration(reference?.declaration), false);
});

async function checkedSource(name, files) {
  const projectDirectory = resolve(tempRoot, name);
  const projectConfig = {
    entryPoint: "index.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "demo" }],
  };
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify(projectConfig, null, 2),
    ...files,
  });
  const project = parseTsonicProjectConfig(projectConfig);
  const options = createProgramOptionsForProject({
    project,
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    sourceProfileFiles: Object.entries(files)
      .filter(([relativePath]) => relativePath.endsWith(".d.ts"))
      .map(([relativePath, text]) => ({
        path: resolve(projectDirectory, relativePath),
        text,
      })),
  });
  return createTsonicSemanticSession({
    programOptions: options.programOptions,
    project,
    projectDirectory,
    target: project.targets[0],
    targetPack: fakeTargetPack,
    selectedSurfaces: [],
  }).source;
}

async function writeProject(projectDirectory, files) {
  for (const [relativePath, text] of Object.entries(files)) {
    const outputPath = resolve(projectDirectory, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, text, "utf8");
  }
}

function projectSourceFile(source, suffix) {
  const result = source.sourceFiles.find((sourceFile) =>
    sourceFile !== undefined &&
    source.ast.getFileName(sourceFile).endsWith(suffix));
  assert.notEqual(result, undefined);
  return result;
}

function namedDeclaration(ast, sourceFile, name) {
  return requiredNode(ast, sourceFile, (node) =>
    (
      ast.is.IsClassDeclaration(node) || ast.is.IsInterfaceDeclaration(node) ||
      ast.is.IsFunctionDeclaration(node)
    ) &&
    ast.text(ast.name(node)) === name);
}

function namedMember(ast, declaration, name) {
  const result = ast.members(declaration).find((member) =>
    member !== undefined && ast.text(ast.name(member)) === name);
  assert.notEqual(result, undefined);
  return result;
}

function namedVariable(ast, sourceFile, name) {
  return requiredNode(ast, sourceFile, (node) =>
    ast.is.IsVariableDeclaration(node) &&
    ast.text(ast.name(node)) === name);
}

function constructorReference(ast, sourceFile, name) {
  const expression = requiredNode(ast, sourceFile, (node) =>
    ast.is.IsNewExpression(node) &&
    ast.text(ast.as.AsNewExpression(node)?.Expression) === name);
  const reference = ast.as.AsNewExpression(expression)?.Expression;
  assert.notEqual(reference, undefined);
  return reference;
}

function heritageBaseReference(ast, declaration) {
  const heritage = ast.extendsHeritageElements(declaration)[0];
  assert.notEqual(heritage, undefined);
  assert.equal(ast.is.IsExpressionWithTypeArguments(heritage), true);
  const reference = ast.as.AsExpressionWithTypeArguments(heritage)?.Expression;
  assert.notEqual(reference, undefined);
  return reference;
}

function requiredNode(ast, root, predicate) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) {
      continue;
    }
    if (predicate(node)) {
      return node;
    }
    stack.push(...ast.children(node));
  }
  assert.fail("Expected source node was not found.");
}

function moduleCase(id, runtime, render) {
  return { id, runtime, render };
}

const fakeTargetPack = {
  id: "demo",
  displayName: "Demo Target",
  provider: {
    id: "demo-provider",
    displayName: "Demo Provider",
    sourceCompilerContributions() {
      return {};
    },
  },
  createBackend() {
    return {
      compile() {
        return { artifacts: [], diagnostics: [] };
      },
    };
  },
  createToolchain() {
    return {
      prepare() {
        return { diagnostics: [], producedArtifacts: [] };
      },
    };
  },
};
