import assert from "node:assert/strict";
import { test } from "node:test";
import {
  argumentPassingFactKey,
  attributeFactKey,
  canonicalIdentityFactKey,
  createCompilerSessionFromFiles,
  createExtensionConsumerQueries,
  defaultValueFactKey,
  fieldFactKey,
  flowStateFactKey,
  formatDiagnostics,
  functionPointerFactKey,
  pointerFactKey,
  sourcePrimitiveFactKey,
  structFactKey,
} from "@tsonic/tsts";
import type {
  AstReader,
  CompilerSession,
  ExtensionDiagnostic,
  Node,
  ProviderDeclarationModel,
  ProviderModuleResolution,
  SourceFile,
} from "@tsonic/tsts";
import {
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
} from "./identity.js";
import { createTsonicCoreSourceExtension } from "./source-extension.js";
import { createTsonicCoreVirtualModulesProvider } from "./virtual-modules.js";

test("source-core virtual module provider owns only neutral core modules", () => {
  const provider = createTsonicCoreVirtualModulesProvider();
  assert.equal(provider.ownsModule(tsonicCoreLangModule, {}).kind, "owned");
  assert.equal(provider.ownsModule(tsonicCoreTypesModule, {}).kind, "owned");
  assert.equal(provider.ownsModule("@tsonic/csharp/lang.js", {}).kind, "unowned");
  assert.equal(provider.ownsModule("@tsonic/csharp/types.js", {}).kind, "unowned");

  const langResolution = assertVirtualModuleResolution(provider.resolveModule(tsonicCoreLangModule, {}));
  assert.equal(langResolution.providerModuleId, tsonicCoreLangModule);
  const declarationModel = assertProviderDeclarationModel(provider.getDeclarationModel(langResolution));
  assert.deepEqual(declarationModel.exports.map((entry) => entry.name).filter((name) => name !== "__TsonicAttributeBuilder" && name !== "__TsonicAttributeMemberBuilder"), [
    "out",
    "ref",
    "inref",
    "borrow",
    "borrowMut",
    "move",
    "struct",
    "field",
    "attribute",
    "defaultof",
    "ptr",
    "fnptr",
  ]);
  assert.equal(declarationModel.exports.some((entry) => entry.name === "int"), false);

  const unownedResolution = provider.resolveModule("@tsonic/csharp/lang.js", {});
  assert.equal(assertExtensionDiagnostic(unownedResolution).extensionCode, "TSONIC_SOURCE_CORE_MODULE_UNOWNED");
});

test("source-core records primitive facts only from core types aliases and namespaces", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { int32 as I32, float64 as Float } from "@tsonic/core/types.js";
    import type * as coreTypes from "@tsonic/core/types.js";
    import type { int32 as localI32 } from "./local.js";

    type LocalInt32 = number;
    type Direct = I32;
    type AliasChain = Direct;
    type Namespaced = coreTypes.uint64;
    type NamespacedFloat = coreTypes.float32;
    type ImportedLocal = localI32;
    type SameSpellingLocal = LocalInt32;
    type FloatAlias = Float;
  `, {
    "/src/local.ts": "export type int32 = number;",
  });

  assertSourcePrimitive(session, typeReference(session, sourceFile, "I32"), "int32", {
    runtimeBase: "number",
    width: 32,
    signed: true,
    identity: "@tsonic/core/types.js::int32",
  });
  assertSourcePrimitive(session, typeReference(session, sourceFile, "Direct"), "int32", {
    runtimeBase: "number",
    width: 32,
    signed: true,
    identity: "@tsonic/core/types.js::int32",
  });
  assertSourcePrimitive(session, typeReference(session, sourceFile, "coreTypes.uint64"), "uint64", {
    runtimeBase: "bigint",
    width: 64,
    signed: false,
    identity: "@tsonic/core/types.js::uint64",
  });
  assertSourcePrimitive(session, typeReference(session, sourceFile, "coreTypes.float32"), "float32", {
    runtimeBase: "number",
    width: 32,
    signed: true,
    identity: "@tsonic/core/types.js::float32",
  });
  assertSourcePrimitive(session, typeReference(session, sourceFile, "Float"), "float64", {
    runtimeBase: "number",
    width: 64,
    signed: true,
    identity: "@tsonic/core/types.js::float64",
  });
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "localI32"), sourcePrimitiveFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "LocalInt32"), sourcePrimitiveFactKey), undefined);
});

test("source-core records storage and flow marker facts from aliases and namespaces without guessing names", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { out as writeOut, ref as readWrite, inref as readOnly, borrow as shared, borrowMut as mutable, move as moved } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import { out as localOut, borrow as localBorrow } from "./local.js";

    let value = 0;
    let index = 0;
    const box = { field: 1, values: [1] };
    writeOut(value);
    readWrite(box.field);
    readOnly(box.values[index]);
    lang.out(box.field);
    lang.ref(value);
    lang.inref(box.values[0]);
    shared(value);
    mutable(box.field);
    moved(box.values[index]);
    lang.borrow(value);
    lang.borrowMut(box.field);
    lang.move(box.values[index]);
    localOut(value);
    localBorrow(value);
    function out(value: number): number {
      return value;
    }
    out(value);
    function shadow(writeOut: (value: number) => number, lang: { out(value: number): number }) {
      writeOut(value);
      lang.out(value);
    }
  `, {
    "/src/local.ts": [
      "export function out<T>(value: T): T { return value; }",
      "export function borrow<T>(value: T): T { return value; }",
    ].join("\n"),
  });

  assert.equal(argumentMode(session, callExpression(session, sourceFile, "writeOut", 0)), "byref-writeonly-must-init");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "readWrite")), "byref-readwrite");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "readOnly")), "byref-readonly");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "lang.out", 0)), "byref-writeonly-must-init");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "lang.ref")), "byref-readwrite");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "lang.inref")), "byref-readonly");

  assert.equal(flowState(session, callExpression(session, sourceFile, "shared")), "borrowed-shared");
  assert.equal(flowState(session, callExpression(session, sourceFile, "mutable")), "borrowed-mut");
  const movedCall = callExpression(session, sourceFile, "moved");
  assert.equal(flowState(session, movedCall), "moved");
  assert.equal(flowState(session, firstCallArgument(session, movedCall)), "moved");
  assert.equal(flowState(session, callExpression(session, sourceFile, "lang.borrow")), "borrowed-shared");
  assert.equal(flowState(session, callExpression(session, sourceFile, "lang.borrowMut")), "borrowed-mut");
  assert.equal(flowState(session, callExpression(session, sourceFile, "lang.move")), "moved");

  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "localOut"), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "localBorrow"), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "out"), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "writeOut", 1), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.out", 1), argumentPassingFactKey), undefined);

  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  const consumer = createExtensionConsumerQueries(extensionHost, "source-core-test");
  assert.equal(consumer.getArgumentPassingFact(callExpression(session, sourceFile, "lang.out", 0))?.mode, "byref-writeonly-must-init");
  assert.equal(consumer.getFact(callExpression(session, sourceFile, "lang.move"), flowStateFactKey)?.state, "moved");
});

test("source-core reports non-storage diagnostics for byref markers", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { out, ref, inref } from "@tsonic/core/lang.js";

    let value = 1;
    out(value + 1);
    ref(value + 1);
    inref(value + 1);
  `);

  const diagnostics = definedDiagnostics(session.getDiagnostics("semantic", sourceFile));
  assert.deepEqual(diagnostics.map(diagnosticCode).sort(numberSort), [9901101, 9901101, 9901101]);
  assert.deepEqual(session.extensionHost?.diagnostics.all().map((diagnostic) => diagnostic.extensionCode).sort(), [
    "SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT",
    "SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT",
    "SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT",
  ]);

  session.ensureBound();
  for (const calleeText of ["out", "ref", "inref"]) {
    const call = callExpression(session, sourceFile, calleeText);
    assert.notEqual(session.extensionHost?.facts.get(call, argumentPassingFactKey), undefined);
    assert.equal(session.extensionHost?.facts.get(firstCallArgument(session, call), argumentPassingFactKey), undefined);
  }
});

test("source-core records abstract struct, field, attribute, and default facts", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { attribute, defaultof, field, struct } from "@tsonic/core/lang.js";
    import type { bool, char, int32 } from "@tsonic/core/types.js";
    import { field as localField } from "./local.js";

    class RouteAttribute {}
    class User {
      name = "";
    }

    const defaultChar = defaultof<char>();
    const Point = struct({ x: field<int32>(), ok: field<bool>(), ignored: localField<int32>() });
    attribute<User>().add(RouteAttribute, "user");
  `, {
    "/src/local.ts": "export function field<T>(): T { throw new Error('local field'); }",
  });

  const defaultCall = callExpression(session, sourceFile, "defaultof");
  const defaultFact = session.extensionHost?.facts.get(defaultCall, defaultValueFactKey);
  assert.equal(typeReferenceName(session, defaultFact?.type as Node | undefined), "char");

  const fieldFacts = [
    session.extensionHost?.facts.get(callExpression(session, sourceFile, "field", 0), fieldFactKey),
    session.extensionHost?.facts.get(callExpression(session, sourceFile, "field", 1), fieldFactKey),
  ];
  assert.deepEqual(fieldFacts.map((fact) => fact?.name), ["x", "ok"]);
  assert.equal(session.extensionHost?.facts.get(fieldFacts[0]?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");
  assert.equal(session.extensionHost?.facts.get(fieldFacts[1]?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "bool");
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "localField"), fieldFactKey), undefined);

  const attributeFact = session.extensionHost?.facts.get(propertyCallExpression(session, sourceFile, "add"), attributeFactKey);
  assert.equal(attributeFact?.attributeName, "RouteAttribute");
  assert.equal(typeReferenceName(session, attributeFact?.applicationTarget as Node | undefined), "User");
  assert.equal(attributeFact?.arguments?.length, 1);

  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  const structFact = extensionHost.facts.get(callExpression(session, sourceFile, "struct"), structFactKey);
  assert.equal(structFact?.valueType, true);
  assert.deepEqual(structFact?.fields?.map((field) => field.name), ["x", "ok"]);
  const consumer = createExtensionConsumerQueries(extensionHost, "source-core-test");
  assert.equal(consumer.getDefaultValueFact(defaultCall)?.type, defaultFact?.type);
  assert.equal(consumer.getStructFact(callExpression(session, sourceFile, "struct"))?.fields?.length, 2);
  assert.equal(consumer.getAttributeFact(propertyCallExpression(session, sourceFile, "add"))?.attributeName, "RouteAttribute");
});

test("source-core records structural, attribute, and default facts from core namespace imports", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import * as lang from "@tsonic/core/lang.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    class RouteAttribute {}
    class User {
      name = "";
    }
    const local = {
      struct<T>(shape: T): T { return shape; },
      field<T>(): T { throw new Error("local field"); },
      attribute<T>() { return { add(_attribute: object): void {} }; },
      defaultof<T>(): T { throw new Error("local default"); },
    };

    const defaultBool = lang.defaultof<bool>();
    const Point = lang.struct({ id: lang.field<int32>(), skipped: local.field<int32>() });
    lang.attribute<User>().add(RouteAttribute);
    const fakeDefault = local.defaultof<bool>();
    const Fake = local.struct({ id: local.field<int32>() });
    local.attribute<User>().add(RouteAttribute);
  `);

  const defaultCall = callExpression(session, sourceFile, "lang.defaultof");
  const defaultFact = session.extensionHost?.facts.get(defaultCall, defaultValueFactKey);
  assert.equal(typeReferenceName(session, defaultFact?.type as Node | undefined), "bool");

  const fieldCall = callExpression(session, sourceFile, "lang.field");
  const fieldFact = session.extensionHost?.facts.get(fieldCall, fieldFactKey);
  assert.equal(fieldFact?.name, "id");
  assert.equal(session.extensionHost?.facts.get(fieldFact?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");

  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  assert.deepEqual(extensionHost.facts.get(callExpression(session, sourceFile, "lang.struct"), structFactKey)?.fields?.map((field) => field.name), ["id"]);
  assert.equal(extensionHost.facts.get(propertyCallExpression(session, sourceFile, "add", 0), attributeFactKey)?.attributeName, "RouteAttribute");
  assert.equal(extensionHost.facts.get(callExpression(session, sourceFile, "local.field", 0), fieldFactKey), undefined);
  assert.equal(extensionHost.facts.get(callExpression(session, sourceFile, "local.defaultof"), defaultValueFactKey), undefined);
  assert.equal(extensionHost.facts.get(callExpression(session, sourceFile, "local.struct"), structFactKey), undefined);
  assert.equal(extensionHost.facts.get(propertyCallExpression(session, sourceFile, "add", 1), attributeFactKey), undefined);
});

test("source-core reports missing explicit type evidence for target-neutral marker facts", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { attribute, defaultof, field } from "@tsonic/core/lang.js";

    const missingField = field();
    const missingAttribute = attribute();
    const missingDefault = defaultof();
  `);

  const diagnostics = definedDiagnostics(session.getDiagnostics("semantic", sourceFile));
  const extensionCodes = session.extensionHost?.diagnostics.all().map((diagnostic) => diagnostic.extensionCode).sort();
  assert.deepEqual(extensionCodes, [
    "SOURCE_SEMANTICS_MISSING_ATTRIBUTE_TARGET_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_FIELD_TYPE_EVIDENCE",
  ]);
  assert.deepEqual(diagnostics.map(diagnosticCode).sort(numberSort), [9901102, 9901105, 9901106]);

  session.ensureBound();
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "field"), fieldFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "attribute"), attributeFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "defaultof"), defaultValueFactKey), undefined);
});

test("source-core reports missing evidence diagnostics through namespace marker forms", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import * as lang from "@tsonic/core/lang.js";

    const namespaceField = lang.field();
    const namespaceAttribute = lang.attribute();
    const namespaceDefault = lang.defaultof();
  `);

  session.ensureBound();
  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  assert.deepEqual(extensionHost.diagnostics.all().map((diagnostic) => diagnostic.extensionCode).sort(), [
    "SOURCE_SEMANTICS_MISSING_ATTRIBUTE_TARGET_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_FIELD_TYPE_EVIDENCE",
  ]);
  assert.equal(extensionHost.facts.get(callExpression(session, sourceFile, "lang.field"), fieldFactKey), undefined);
  assert.equal(extensionHost.facts.get(callExpression(session, sourceFile, "lang.attribute"), attributeFactKey), undefined);
  assert.equal(extensionHost.facts.get(callExpression(session, sourceFile, "lang.defaultof"), defaultValueFactKey), undefined);
});

test("source-core virtual declarations leave invalid arity to TypeScript checking", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { out, borrow, borrowMut, move } from "@tsonic/core/lang.js";
    import type { ptr, fnptr } from "@tsonic/core/lang.js";

    let value = 1;
    out();
    out(value, value);
    borrow();
    borrow(value, value);
    borrowMut();
    move(value, value);
    type MissingPointer = ptr;
    type ExtraPointer = ptr<number, number>;
    type MissingFunctionPointer = fnptr<[number]>;
    type ExtraFunctionPointer = fnptr<[number], number, number>;
  `);

  const diagnostics = definedDiagnostics(session.getDiagnostics("semantic", sourceFile));
  const formattedDiagnostics = formatDiagnostics(diagnostics, "/src");
  assert.match(formattedDiagnostics, /Expected 1 arguments?, but got 0/);
  assert.match(formattedDiagnostics, /Expected 1 arguments?, but got 2/);
  assert.match(formattedDiagnostics, /Generic type 'ptr' requires 1 type argument/);
  assert.match(formattedDiagnostics, /Generic type 'fnptr' requires 2 type argument/);

  session.ensureBound();
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "out", 0), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "borrow", 0), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "borrowMut"), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "ptr", 0), pointerFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "fnptr", 0), functionPointerFactKey), undefined);
});

test("source-core records ptr and fnptr facts from aliases and namespaces without local marker guessing", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { ptr as pointer, fnptr as functionPointer } from "@tsonic/core/lang.js";
    import type * as lang from "@tsonic/core/lang.js";
    import type { int32, bool } from "@tsonic/core/types.js";
    import type { ptr as localPointer, fnptr as localFunctionPointer } from "./local.js";

    type AliasPointer = pointer<int32>;
    type NamespacePointer = lang.ptr<int32>;
    type AliasFunctionPointer = functionPointer<[int32, bool], int32>;
    type NamespaceFunctionPointer = lang.fnptr<[lang.ptr<int32>, int32], bool>;
    type LocalPointer = localPointer<int32>;
    type LocalFunctionPointer = localFunctionPointer<[int32], int32>;
  `, {
    "/src/local.ts": [
      "export type ptr<T> = T;",
      "export type fnptr<TArgs, TReturn> = unknown;",
    ].join("\n"),
  });

  const aliasPointer = typeReference(session, sourceFile, "pointer");
  assert.equal(session.extensionHost?.facts.get(aliasPointer, pointerFactKey)?.mutability, "target-defined");
  assert.equal(session.extensionHost?.facts.get(aliasPointer, pointerFactKey)?.unsafeRequired, true);
  assert.equal(typeReferenceName(session, nodeFactSubject(session.extensionHost?.facts.get(aliasPointer, pointerFactKey)?.pointee)), "int32");

  const namespacePointer = typeReference(session, sourceFile, "lang.ptr", 0);
  assert.equal(session.extensionHost?.facts.get(namespacePointer, pointerFactKey)?.mutability, "target-defined");

  const aliasFunctionPointer = typeReference(session, sourceFile, "functionPointer");
  const aliasFunctionPointerFact = session.extensionHost?.facts.get(aliasFunctionPointer, functionPointerFactKey);
  assert.equal(aliasFunctionPointerFact?.parameters.length, 2);
  assert.equal(typeReferenceName(session, nodeFactSubject(aliasFunctionPointerFact?.result)), "int32");
  assert.deepEqual(aliasFunctionPointerFact?.abi, ["target-default"]);

  const namespaceFunctionPointer = typeReference(session, sourceFile, "lang.fnptr");
  const namespaceFunctionPointerFact = session.extensionHost?.facts.get(namespaceFunctionPointer, functionPointerFactKey);
  assert.equal(namespaceFunctionPointerFact?.parameters.length, 2);
  assert.equal(typeReferenceName(session, nodeFactSubject(namespaceFunctionPointerFact?.result)), "bool");
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "lang.ptr", 1), pointerFactKey)?.unsafeRequired, true);

  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "localPointer"), pointerFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "localFunctionPointer"), functionPointerFactKey), undefined);
});

function assertVirtualModuleResolution(value: ProviderModuleResolution | ExtensionDiagnostic): ProviderModuleResolution {
  assert.equal((value as { readonly kind?: string }).kind, "virtual");
  return value as ProviderModuleResolution;
}

function assertProviderDeclarationModel(value: ProviderDeclarationModel | ExtensionDiagnostic): ProviderDeclarationModel {
  assert.equal((value as { readonly moduleSpecifier?: string }).moduleSpecifier, tsonicCoreLangModule);
  return value as ProviderDeclarationModel;
}

function assertExtensionDiagnostic(value: ProviderModuleResolution | ExtensionDiagnostic): ExtensionDiagnostic {
  assert.equal((value as { readonly category?: string }).category, "error");
  return value as ExtensionDiagnostic;
}

function createSourceCoreSession(sourceText: string, extraFiles: Readonly<Record<string, string>> = {}): {
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
      extensions: [createTsonicCoreSourceExtension()],
    },
  });
  const sourceFile = session.getSourceFile("/src/index.ts");
  assert.ok(sourceFile !== undefined);
  return { session, sourceFile };
}

function createCleanSourceCoreSession(sourceText: string, extraFiles: Readonly<Record<string, string>> = {}): {
  readonly session: CompilerSession;
  readonly sourceFile: SourceFile;
} {
  const { session, sourceFile } = createSourceCoreSession(sourceText, extraFiles);
  const diagnostics = definedDiagnostics(session.getDiagnostics("all", sourceFile));
  assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics, "/src"));
  session.ensureBound();
  return { session, sourceFile };
}

function assertSourcePrimitive(
  session: CompilerSession,
  node: Node,
  kind: string,
  expected: {
    readonly runtimeBase: string;
    readonly width: number;
    readonly signed: boolean;
    readonly identity: string;
  },
): void {
  const fact = session.extensionHost?.facts.get(node, sourcePrimitiveFactKey);
  assert.equal(fact?.kind, kind);
  assert.equal(fact?.runtimeBase, expected.runtimeBase);
  assert.equal(fact?.width, expected.width);
  assert.equal(fact?.signed, expected.signed);
  assert.equal(session.extensionHost?.facts.get(node, canonicalIdentityFactKey)?.id, expected.identity);
}

function argumentMode(session: CompilerSession, call: Node) {
  return session.extensionHost?.facts.get(call, argumentPassingFactKey)?.mode;
}

function flowState(session: CompilerSession, node: Node) {
  return session.extensionHost?.facts.get(node, flowStateFactKey)?.state;
}

function callExpression(session: CompilerSession, sourceFile: SourceFile, calleeText: string, occurrence = 0): Node {
  let seen = 0;
  const found = findNode(sourceFile, session.ast, (node, ast) => {
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

function propertyCallExpression(session: CompilerSession, sourceFile: SourceFile, propertyName: string, occurrence = 0): Node {
  let seen = 0;
  const found = findNode(sourceFile, session.ast, (node, ast) => {
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

function firstCallArgument(session: CompilerSession, call: Node): Node {
  const argument = session.ast.arguments(call)[0];
  assert.ok(argument !== undefined);
  return argument;
}

function typeReference(session: CompilerSession, sourceFile: SourceFile, nameText: string, occurrence = 0): Node {
  let seen = 0;
  const found = findNode(sourceFile, session.ast, (node, ast) => {
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

function typeReferenceName(session: CompilerSession, node: Node | undefined): string {
  if (node === undefined) {
    return "";
  }
  if (session.ast.is.IsTypeReferenceNode(node)) {
    return typeReferenceName(session, session.ast.as.AsTypeReferenceNode(node)?.TypeName);
  }
  if (session.ast.is.IsQualifiedName(node)) {
    const qualifiedName = session.ast.as.AsQualifiedName(node);
    const left = typeReferenceName(session, qualifiedName?.Left);
    const right = typeReferenceName(session, qualifiedName?.Right);
    return left === "" ? right : `${left}.${right}`;
  }
  return session.ast.text(node);
}

function nodeFactSubject(subject: object | undefined): Node | undefined {
  return typeof (subject as Node | undefined)?.Kind === "number" ? subject as Node : undefined;
}

function expressionText(ast: AstReader, node: Node | undefined): string {
  if (node === undefined) {
    return "";
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

function findNode(
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

function definedDiagnostics<T>(diagnostics: readonly (T | undefined)[]): readonly T[] {
  return diagnostics.filter((diagnostic): diagnostic is T => diagnostic !== undefined);
}

function diagnosticCode(diagnostic: unknown): number | undefined {
  return typeof diagnostic === "object" && diagnostic !== null
    ? (diagnostic as { readonly code?: number }).code
    : undefined;
}

function numberSort(left: number | undefined, right: number | undefined): number {
  return (left ?? 0) - (right ?? 0);
}
