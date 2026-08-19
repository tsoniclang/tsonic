import assert from "node:assert/strict";
import test from "node:test";

import {
  finalizeTargetDiagnostics,
} from "../../packages/host/dist/diagnostics.js";
import {
  createSourceProgramNavigation,
  createTargetSourceProgram,
  sourceTypeSyntaxIsCompositional,
} from "../../packages/target-api/dist/public/source.js";
import {
  sourcePrimitiveFactKey,
} from "../../packages/tsts/dist/src/index.js";
import {
  checkedSource,
  constructorReference,
  heritageBaseReference,
  moduleCase,
  namedDeclaration,
  namedMember,
  namedVariable,
  projectSourceFile,
  requiredNode,
} from "../fixtures/source-navigation.mjs";

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

test("source navigation resolves exact class implementations for base and interface members", async () => {
  const source = await checkedSource("project-member-implementation", {
    "src/index.ts": [
      "export interface Readable {",
      "  value: number;",
      "  read(): number;",
      "}",
      "export interface BaseShape {",
      "  value: number;",
      "  read(): number;",
      "}",
      "export interface DerivedShape extends BaseShape {",
      "  value: number;",
      "  read(): number;",
      "}",
      "export class Base {",
      "  read(): number { return 1; }",
      "}",
      "export class Derived extends Base implements Readable {",
      "  value = 2;",
      "  read(): number { return this.value; }",
      "}",
      "export class Inherited extends Derived {}",
      "export class SameSpelling {",
      "  read(): number { return 3; }",
      "}",
      "",
    ].join("\n"),
  });
  const { ast } = source;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  const readable = namedDeclaration(ast, sourceFile, "Readable");
  const baseShape = namedDeclaration(ast, sourceFile, "BaseShape");
  const derivedShape = namedDeclaration(ast, sourceFile, "DerivedShape");
  const base = namedDeclaration(ast, sourceFile, "Base");
  const derived = namedDeclaration(ast, sourceFile, "Derived");
  const inherited = namedDeclaration(ast, sourceFile, "Inherited");
  const sameSpelling = namedDeclaration(ast, sourceFile, "SameSpelling");
  const readableValue = namedMember(ast, readable, "value");
  const readableRead = namedMember(ast, readable, "read");
  const baseShapeValue = namedMember(ast, baseShape, "value");
  const baseShapeRead = namedMember(ast, baseShape, "read");
  const derivedShapeValue = namedMember(ast, derivedShape, "value");
  const derivedShapeRead = namedMember(ast, derivedShape, "read");
  const baseRead = namedMember(ast, base, "read");
  const derivedValue = namedMember(ast, derived, "value");
  const derivedRead = namedMember(ast, derived, "read");

  assert.strictEqual(
    navigation.memberImplementation(derived, baseRead).implementation?.declaration,
    derivedRead,
  );
  assert.strictEqual(
    navigation.memberImplementation(derived, readableRead).implementation?.declaration,
    derivedRead,
  );
  assert.strictEqual(
    navigation.memberImplementation(derived, readableValue).implementation?.declaration,
    derivedValue,
  );
  assert.strictEqual(
    navigation.memberImplementation(inherited, readableRead).implementation?.declaration,
    derivedRead,
  );
  assert.strictEqual(
    navigation.memberImplementation(derivedShape, baseShapeValue).implementation?.declaration,
    derivedShapeValue,
  );
  assert.strictEqual(
    navigation.memberImplementation(derivedShape, baseShapeRead).implementation?.declaration,
    derivedShapeRead,
  );
  assert.deepEqual(
    navigation.memberImplementation(sameSpelling, baseRead),
    { kind: "unrelated" },
  );
});

test("source navigation resolves overload signatures to one concrete callable body", async () => {
  const source = await checkedSource("project-callable-implementation", {
    "src/index.ts": [
      "export function format(value: string): string;",
      "export function format(value: string, suffix?: string): string;",
      "export function format(value: string, suffix?: string): string {",
      "  return value + (suffix ?? '');",
      "}",
      "export class Formatter {",
      "  constructor(prefix: string);",
      "  constructor(prefix: string, suffix?: string);",
      "  constructor(prefix: string, suffix?: string) { void prefix; void suffix; }",
      "  render(value: string): string;",
      "  render(value: string, suffix?: string): string;",
      "  render(value: string, suffix?: string): string { return value + (suffix ?? ''); }",
      "}",
      "",
    ].join("\n"),
  });
  const { ast } = source;
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const navigation = createSourceProgramNavigation(source);
  const functions = ast.statements(sourceFile).filter((statement) =>
    statement !== undefined && ast.is.IsFunctionDeclaration(statement));
  const formatter = namedDeclaration(ast, sourceFile, "Formatter");
  const constructors = ast.members(formatter).filter((member) =>
    member !== undefined && ast.is.IsConstructorDeclaration(member));
  const methods = ast.members(formatter).filter((member) =>
    member !== undefined && ast.is.IsMethodDeclaration(member));

  assert.equal(functions.length, 3);
  assert.equal(constructors.length, 3);
  assert.equal(methods.length, 3);
  for (const declarations of [functions, constructors, methods]) {
    const implementation = declarations[2];
    assert.notEqual(implementation, undefined);
    for (const declaration of declarations) {
      assert.strictEqual(
        navigation.callableImplementation(declaration).implementation?.declaration,
        implementation,
      );
    }
  }
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

test("source navigation separates type-only references from runtime callable uses", async () => {
  const checked = await checkedSource("type-only-declaration-uses", {
    "src/index.ts": [
      "function format(value: number): string { return String(value); }",
      "type FormatParameters = Parameters<typeof format>;",
      "export function call(values: FormatParameters): string {",
      "  return format(values[0]);",
      "}",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const format = namedDeclaration(source.ast, sourceFile, "format");
  const uses = source.navigation.declarationUses(format);
  const summary = source.navigation.declarationUseSummary(format);

  assert.deepEqual(uses.map((use) => use.kind).sort(), ["direct-call", "type-only"]);
  assert.deepEqual(uses.map((use) => use.role).sort(), ["call-target", "type-only"]);
  assert.equal(summary.directCallCount, 1);
  assert.equal(summary.firstClassUseCount, 0);
  assert.equal(summary.hasUnclassifiedValueUse, false);
});

test("source navigation separates class-member mutation from binding writes", async () => {
  const checked = await checkedSource("class-member-use-summary", {
    "src/index.ts": [
      "class Counter {",
      "  value = 0;",
      "  constructor() { this.value = 1; }",
      "  increment(): void { this.value += 1; }",
      "}",
      "const counter = new Counter();",
      "counter.value = 3;",
      "",
    ].join("\n"),
  });
  const source = createTargetSourceProgram(checked);
  const sourceFile = projectSourceFile(source, "src/index.ts");
  const counter = namedDeclaration(source.ast, sourceFile, "Counter");
  const value = namedMember(source.ast, counter, "value");
  const summary = source.navigation.declarationUseSummary(value);

  assert.equal(summary.bindingWritten, false);
  assert.equal(summary.memberWritten, true);
  assert.equal(summary.constructorInitialized, true);
  assert.equal(summary.mutatedAfterInitialization, true);
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
    checked,
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
