import assert from "node:assert/strict";
import {
  argumentPassingFactKey,
  attributeFactKey,
  canonicalIdentityFactKey,
  createCompilerSessionFromFiles,
  createSourceSemanticsExtension,
  defaultValueFactKey,
  fieldFactKey,
  flowStateFactKey,
  formatDiagnostics,
  functionPointerFactKey,
  pointerFactKey,
  pointerOperationFactKey,
  rawPointerFactKey,
  rawPointerOperationFactKey,
  sourcePrimitiveFactKey,
  structFactKey,
} from "@tsonic/tsts";
import type {
  AstReader,
  CheckedSourceProgram,
  CompilerSession,
  ExtensionDiagnostic,
  ExtensionFactKey,
  ExtensionFactSubject,
  Node,
  ProviderDeclarationModel,
  ProviderModuleResolution,
  ReadonlySourceFactResolver,
  SourcePrimitiveFact,
  SourceFile,
} from "@tsonic/tsts";
import {
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
} from "../identity.js";
import { createTsonicCoreSourceExtension } from "./source-extension.js";
import { tsonicAttributeBuilderFactKey } from "../attributes/facts.js";
import { tsonicFixedArrayFactKey } from "../fixed-arrays/facts.js";
import { tsonicCoreSourceSemanticsModules } from "./source-modules.js";
import { createTsonicCoreVirtualModulesProvider } from "./virtual-modules.js";

export {
  argumentPassingFactKey,
  attributeFactKey,
  canonicalIdentityFactKey,
  defaultValueFactKey,
  fieldFactKey,
  flowStateFactKey,
  functionPointerFactKey,
  pointerFactKey,
  pointerOperationFactKey,
  rawPointerFactKey,
  rawPointerOperationFactKey,
  sourcePrimitiveFactKey,
  structFactKey,
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
  createTsonicCoreVirtualModulesProvider,
  tsonicAttributeBuilderFactKey,
  tsonicFixedArrayFactKey,
};

export const expectedSourceCorePrimitiveFacts = [
  { exportName: "bool", fact: { kind: "bool", runtimeBase: "boolean" } },
  { exportName: "char", fact: { kind: "char", runtimeBase: "string", signed: false, width: 16 } },
  { exportName: "int8", fact: { kind: "int8", runtimeBase: "number", signed: true, width: 8 } },
  { exportName: "uint8", fact: { kind: "uint8", runtimeBase: "number", signed: false, width: 8 } },
  { exportName: "int16", fact: { kind: "int16", runtimeBase: "number", signed: true, width: 16 } },
  { exportName: "uint16", fact: { kind: "uint16", runtimeBase: "number", signed: false, width: 16 } },
  { exportName: "int32", fact: { kind: "int32", runtimeBase: "number", signed: true, width: 32 } },
  { exportName: "uint32", fact: { kind: "uint32", runtimeBase: "number", signed: false, width: 32 } },
  { exportName: "int64", fact: { kind: "int64", runtimeBase: "bigint", signed: true, width: 64 } },
  { exportName: "uint64", fact: { kind: "uint64", runtimeBase: "bigint", signed: false, width: 64 } },
  { exportName: "int128", fact: { kind: "int128", runtimeBase: "bigint", signed: true, width: 128 } },
  { exportName: "uint128", fact: { kind: "uint128", runtimeBase: "bigint", signed: false, width: 128 } },
  { exportName: "nativeInt", fact: { kind: "native-int", runtimeBase: "number", signed: true } },
  { exportName: "nativeUint", fact: { kind: "native-uint", runtimeBase: "number", signed: false } },
  { exportName: "float16", fact: { kind: "float16", runtimeBase: "number", signed: true, width: 16 } },
  { exportName: "float32", fact: { kind: "float32", runtimeBase: "number", signed: true, width: 32 } },
  { exportName: "float64", fact: { kind: "float64", runtimeBase: "number", signed: true, width: 64 } },
  { exportName: "decimal", fact: { kind: "decimal", runtimeBase: "number", signed: true, width: 128 } },
] satisfies readonly {
  readonly exportName: string;
  readonly fact: SourcePrimitiveFact;
}[];

export const expectedSourceCoreLangIntrinsics = [
  { kind: "call-marker", exportName: "writeOnlyRef", marker: "write-only-reference" },
  { kind: "call-marker", exportName: "readWriteRef", marker: "read-write-reference" },
  { kind: "call-marker", exportName: "readOnlyRef", marker: "read-only-reference" },
  { kind: "call-marker", exportName: "sharedBorrow", marker: "shared-borrow" },
  { kind: "call-marker", exportName: "mutableBorrow", marker: "mutable-borrow" },
  { kind: "call-marker", exportName: "move", marker: "move" },
  { kind: "call-marker", exportName: "struct", marker: "struct" },
  { kind: "call-marker", exportName: "field", marker: "field" },
  { kind: "call-marker", exportName: "attribute", marker: "attribute" },
  { kind: "call-marker", exportName: "defaultValue", marker: "default-value" },
  { kind: "call-marker", exportName: "addressOf", marker: "address-of" },
  { kind: "call-marker", exportName: "allocatePointer", marker: "allocate" },
  { kind: "call-marker", exportName: "loadPointer", marker: "load" },
  { kind: "call-marker", exportName: "storePointer", marker: "store" },
  { kind: "call-marker", exportName: "equalPointer", marker: "equal-pointer" },
  { kind: "call-marker", exportName: "hashPointer", marker: "hash-pointer" },
  { kind: "call-marker", exportName: "bindPointer", marker: "bind-pointer" },
  { kind: "call-marker", exportName: "projectPointer", marker: "project-pointer" },
  { kind: "call-marker", exportName: "equalRawPointer", marker: "equal-raw-pointer" },
  { kind: "call-marker", exportName: "hashRawPointer", marker: "hash-raw-pointer" },
] as const;

export const expectedSourceCoreTypeMarkers = [
  { kind: "type-marker", exportName: "Pointer", marker: "pointer" },
  { kind: "type-marker", exportName: "RawPointer", marker: "raw-pointer" },
  { kind: "type-marker", exportName: "FunctionPointer", marker: "function-pointer" },
  { kind: "type-marker", exportName: "FixedArray", marker: "fixed-array" },
] as const;

export function assertVirtualModuleResolution(value: ProviderModuleResolution | ExtensionDiagnostic): ProviderModuleResolution {
  assert.equal((value as { readonly kind?: string }).kind, "virtual");
  return value as ProviderModuleResolution;
}

export function assertProviderDeclarationModel(value: ProviderDeclarationModel | ExtensionDiagnostic, moduleSpecifier = tsonicCoreLangModule): ProviderDeclarationModel {
  assert.equal((value as { readonly moduleSpecifier?: string }).moduleSpecifier, moduleSpecifier);
  return value as ProviderDeclarationModel;
}

export function assertExtensionDiagnostic(value: ProviderModuleResolution | ExtensionDiagnostic): ExtensionDiagnostic {
  assert.equal((value as { readonly category?: string }).category, "error");
  return value as ExtensionDiagnostic;
}

export function sourceCorePrimitiveExportFacts(): readonly {
  readonly exportName: string;
  readonly fact: SourcePrimitiveFact;
}[] {
  return sourceCoreModuleExports(tsonicCoreTypesModule).flatMap((exportDeclaration) => {
    if (exportDeclaration.kind === "type-marker") {
      return [];
    }
    if (exportDeclaration.kind !== "source-primitive") {
      assert.fail(`Unexpected call marker declaration in ${tsonicCoreTypesModule}.`);
    }
    return [{
      exportName: exportDeclaration.exportName,
      fact: {
        kind: exportDeclaration.primitive,
        runtimeBase: exportDeclaration.runtimeBase,
        ...(exportDeclaration.signed !== undefined ? { signed: exportDeclaration.signed } : {}),
        ...(exportDeclaration.width !== undefined ? { width: exportDeclaration.width } : {}),
      },
    }];
  });
}

export function sourceCoreTypeMarkerExportFacts(): readonly {
  readonly kind: "type-marker";
  readonly exportName: string;
  readonly marker: string;
}[] {
  return sourceCoreModuleExports(tsonicCoreTypesModule).flatMap((exportDeclaration) => {
    if (exportDeclaration.kind === "source-primitive") {
      return [];
    }
    if (exportDeclaration.kind !== "type-marker") {
      assert.fail(`Unexpected call marker declaration in ${tsonicCoreTypesModule}.`);
    }
    return [{
      kind: exportDeclaration.kind,
      exportName: exportDeclaration.exportName,
      marker: exportDeclaration.marker,
    }];
  });
}

export function sourceCoreLangExportFacts(): readonly {
  readonly kind: "call-marker";
  readonly exportName: string;
  readonly marker: string;
}[] {
  return sourceCoreModuleExports(tsonicCoreLangModule).map((exportDeclaration) => {
    if (exportDeclaration.kind !== "call-marker") {
      assert.fail(`Expected only call marker declarations in ${tsonicCoreLangModule}.`);
    }
    return {
      kind: exportDeclaration.kind,
      exportName: exportDeclaration.exportName,
      marker: exportDeclaration.marker,
    };
  });
}

export function sourceCoreModuleExports(moduleSpecifier: string) {
  const module = tsonicCoreSourceSemanticsModules().find((candidate) => candidate.moduleSpecifier === moduleSpecifier);
  assert.ok(module !== undefined, `Missing source-core module '${moduleSpecifier}'.`);
  return module.exports;
}

export function createSourceCoreSession(sourceText: string, extraFiles: Readonly<Record<string, string>> = {}): {
  readonly session: CompilerSession;
  readonly sourceFile: SourceFile;
} {
  const session = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/index.ts": sourceText,
      ...extraFiles,
    },
    compilerOptions: {
      module: "esnext",
      moduleResolution: "bundler",
      strict: true,
      target: "es2022",
    },
    extensionHostOptions: {
      extensions: [
        createSourceSemanticsExtension({
          modules: tsonicCoreSourceSemanticsModules(),
        }),
        createTsonicCoreSourceExtension(),
      ],
    },
  });
  const sourceFile = checkSource(session).getSourceFile("/src/index.ts");
  assert.ok(sourceFile !== undefined);
  return { session, sourceFile };
}

export function createCleanSourceCoreSession(sourceText: string, extraFiles: Readonly<Record<string, string>> = {}): {
  readonly session: CompilerSession;
  readonly sourceFile: SourceFile;
} {
  const { session, sourceFile } = createSourceCoreSession(sourceText, extraFiles);
  const checked = checkSource(session);
  const diagnostics = definedDiagnostics(checked.diagnostics);
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  assert.deepEqual(checked.extensionDiagnostics, []);
  return { session, sourceFile };
}

export function assertSourcePrimitive(
  session: CompilerSession,
  node: Node,
  expected: SourcePrimitiveFact,
  identity: string,
): void {
  const fact = sourceFacts(session).getFact(node, sourcePrimitiveFactKey);
  assert.deepEqual(fact, expected);
  assert.equal(sourceFacts(session).getFact(node, canonicalIdentityFactKey)?.id, identity);
}

export function argumentMode(session: CompilerSession, call: Node) {
  return sourceFacts(session).getFact(call, argumentPassingFactKey)?.mode;
}

export function flowState(session: CompilerSession, node: Node) {
  return sourceFacts(session).getFact(node, flowStateFactKey)?.state;
}

export function assertAttributeApplication(
  session: CompilerSession,
  call: Node,
  expectedTarget: string,
  expectedAttributeType: string,
  expectedArgumentCount: number,
): void {
  const fact = sourceFacts(session).getFact(call, tsonicAttributeBuilderFactKey);
  assert.equal(fact?.kind, "application");
  if (fact?.kind !== "application") {
    return;
  }
  assert.equal(typeReferenceName(session, fact.applicationTarget as Node), expectedTarget);
  assert.equal(sourceAst(session).text(fact.attributeType as Node), expectedAttributeType);
  assert.equal(fact.arguments.length, expectedArgumentCount);
}

export function callExpression(session: CompilerSession, sourceFile: SourceFile, calleeText: string, occurrence = 0): Node {
  let seen = 0;
  const found = findNode(sourceFile, sourceAst(session), (node, ast) => {
    if (!ast.is.IsCallExpression(node)) {
      return false;
    }
    const expression = ast.as.AsCallExpression(node)?.Expression;
    if (expressionText(ast, expression) !== calleeText) {
      return false;
    }
    if (seen === occurrence) {
      return true;
    }
    seen += 1;
    return false;
  });
  assert.ok(found !== undefined, `Missing call expression '${calleeText}' occurrence ${occurrence}.`);
  return found;
}

export function propertyCallExpression(session: CompilerSession, sourceFile: SourceFile, propertyName: string, occurrence = 0): Node {
  let seen = 0;
  const found = findNode(sourceFile, sourceAst(session), (node, ast) => {
    if (!ast.is.IsCallExpression(node)) {
      return false;
    }
    const expression = ast.as.AsCallExpression(node)?.Expression;
    if (!ast.is.IsPropertyAccessExpression(expression)) {
      return false;
    }
    const name = ast.name(expression);
    if (name === undefined || ast.text(name) !== propertyName) {
      return false;
    }
    if (seen === occurrence) {
      return true;
    }
    seen += 1;
    return false;
  });
  assert.ok(found !== undefined, `Missing property call expression '${propertyName}' occurrence ${occurrence}.`);
  return found;
}

export function firstCallArgument(session: CompilerSession, call: Node): Node {
  const argument = sourceAst(session).arguments(call)[0];
  assert.ok(argument !== undefined);
  return argument;
}

export function typeReference(session: CompilerSession, sourceFile: SourceFile, nameText: string, occurrence = 0): Node {
  let seen = 0;
  const found = findNode(sourceFile, sourceAst(session), (node, ast) => {
    if (!ast.is.IsTypeReferenceNode(node)) {
      return false;
    }
    if (typeReferenceName(session, ast.as.AsTypeReferenceNode(node)?.TypeName) !== nameText) {
      return false;
    }
    if (seen === occurrence) {
      return true;
    }
    seen += 1;
    return false;
  });
  assert.ok(found !== undefined, `Missing type reference '${nameText}' occurrence ${occurrence}.`);
  return found;
}

export function typeAliasType(session: CompilerSession, sourceFile: SourceFile, aliasName: string): Node {
  const found = findNode(sourceFile, sourceAst(session), (node, ast) =>
    ast.is.IsTypeAliasDeclaration(node) && ast.text(ast.name(node)) === aliasName);
  const type = sourceAst(session).as.AsTypeAliasDeclaration(found)?.Type;
  assert.ok(type !== undefined, `Missing type alias '${aliasName}'.`);
  return type;
}

export function variableDeclaration(session: CompilerSession, sourceFile: SourceFile, variableName: string): Node {
  const found = findNode(sourceFile, sourceAst(session), (node, ast) =>
    ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === variableName);
  assert.ok(found !== undefined, `Missing variable declaration '${variableName}'.`);
  return found;
}

export function variableInitializer(session: CompilerSession, sourceFile: SourceFile, variableName: string): Node {
  const initializer = sourceAst(session).as.AsVariableDeclaration(variableDeclaration(session, sourceFile, variableName))?.Initializer;
  assert.ok(initializer !== undefined, `Missing variable initializer '${variableName}'.`);
  return initializer;
}

export function typeReferenceName(session: CompilerSession, node: Node | undefined): string {
  if (node === undefined) {
    return "";
  }
  const ast = sourceAst(session);
  if (ast.is.IsTypeReferenceNode(node)) {
    return typeReferenceName(session, ast.as.AsTypeReferenceNode(node)?.TypeName);
  }
  if (ast.is.IsQualifiedName(node)) {
    const qualifiedName = ast.as.AsQualifiedName(node);
    const left = typeReferenceName(session, qualifiedName?.Left);
    const right = typeReferenceName(session, qualifiedName?.Right);
    return left === "" ? right : `${left}.${right}`;
  }
  return ast.text(node);
}

export function nodeFactSubject(subject: object | undefined): Node | undefined {
  return typeof (subject as Node | undefined)?.Kind === "number" ? subject as Node : undefined;
}

export function sourceCoreFacts(session: CompilerSession) {
  const facts = sourceFacts(session);
  return {
    getArgumentPassingFact: (subject: ExtensionFactSubject | undefined) =>
      facts.getFact(subject, argumentPassingFactKey),
    getAttributeFact: (subject: ExtensionFactSubject | undefined) =>
      facts.getFact(subject, attributeFactKey),
    getDefaultValueFact: (subject: ExtensionFactSubject | undefined) =>
      facts.getFact(subject, defaultValueFactKey),
    getFieldFact: (subject: ExtensionFactSubject | undefined) =>
      facts.getFact(subject, fieldFactKey),
    getStructFact: (subject: ExtensionFactSubject | undefined) =>
      facts.getFact(subject, structFactKey),
  };
}

const checkedSources = new WeakMap<CompilerSession, CheckedSourceProgram>();

export function checkSource(session: CompilerSession): CheckedSourceProgram {
  const existing = checkedSources.get(session);
  if (existing !== undefined) {
    return existing;
  }
  const checked = session.checkSource();
  checkedSources.set(session, checked);
  return checked;
}

export function sourceAst(session: CompilerSession): AstReader {
  return checkSource(session).ast;
}

export function sourceFacts(session: CompilerSession): ReadonlySourceFactResolver {
  const facts = checkSource(session).sourceFacts;
  assert.ok(facts !== undefined, "Expected finalized source facts.");
  return facts;
}

export function getSourceFact<T>(
  session: CompilerSession,
  subject: ExtensionFactSubject | undefined,
  key: ExtensionFactKey<T>,
): T | undefined {
  return sourceFacts(session).getFact(subject, key);
}

export function expressionText(ast: AstReader, node: Node | undefined): string {
  if (node === undefined) {
    return "";
  }
  if (ast.is.IsParenthesizedExpression(node)) {
    return expressionText(ast, ast.as.AsParenthesizedExpression(node)?.Expression);
  }
  if (ast.is.IsPropertyAccessExpression(node)) {
    const access = ast.as.AsPropertyAccessExpression(node);
    const receiver = expressionText(ast, access?.Expression);
    const name = ast.text(ast.name(node));
    return receiver === "" ? name : `${receiver}.${name}`;
  }
  if (ast.is.IsCallExpression(node)) {
    return expressionText(ast, ast.as.AsCallExpression(node)?.Expression);
  }
  return ast.text(ast.name(node) ?? node);
}

export function findNode(
  root: SourceFile,
  ast: AstReader,
  predicate: (node: Node, ast: AstReader) => boolean,
): Node | undefined {
  let found: Node | undefined;
  const visit = (node: Node | undefined): void => {
    if (node === undefined || found !== undefined) {
      return;
    }
    if (predicate(node, ast)) {
      found = node;
      return;
    }
    for (const child of ast.children(node)) {
      visit(child);
    }
  };
  visit(root);
  return found;
}

export function definedDiagnostics<T>(diagnostics: readonly (T | undefined)[]): readonly T[] {
  return diagnostics.filter((diagnostic): diagnostic is T => diagnostic !== undefined);
}

export function numberSort(left: number | undefined, right: number | undefined): number {
  return (left ?? 0) - (right ?? 0);
}
