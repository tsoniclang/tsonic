import assert from "node:assert/strict";
import { test } from "node:test";
import {
  argumentPassingFactKey,
  canonicalIdentityFactKey,
  createCompilerSessionFromFiles,
  createExtensionConsumerQueries,
  flowStateFactKey,
  formatDiagnostics,
  functionPointerFactKey,
  pointerFactKey,
  sourcePrimitiveFactKey,
} from "@tsonic/tsts";
import type {
  AstReader,
  CompilerSession,
  ExtensionDiagnostic,
  ExtensionHost,
  Node,
  ProviderDeclarationModel,
  ProviderModuleResolution,
  SourcePrimitiveFact,
  SourceFile,
} from "@tsonic/tsts";
import {
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
} from "./identity.js";
import { createTsonicCoreSourceExtension } from "./source-extension.js";
import { tsonicCoreSourceSemanticsModules } from "./source-modules.js";
import { createTsonicCoreVirtualModulesProvider } from "./virtual-modules.js";

const expectedSourceCorePrimitiveFacts = [
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

const expectedSourceCoreLangIntrinsics = [
  { kind: "call-marker", exportName: "out", marker: "out" },
  { kind: "call-marker", exportName: "ref", marker: "ref" },
  { kind: "call-marker", exportName: "inref", marker: "inref" },
  { kind: "call-marker", exportName: "borrow", marker: "borrow" },
  { kind: "call-marker", exportName: "borrowMut", marker: "borrowMut" },
  { kind: "call-marker", exportName: "move", marker: "move" },
  { kind: "call-marker", exportName: "struct", marker: "struct" },
  { kind: "call-marker", exportName: "field", marker: "field" },
  { kind: "call-marker", exportName: "attribute", marker: "attribute" },
  { kind: "call-marker", exportName: "defaultof", marker: "defaultof" },
  { kind: "type-marker", exportName: "ptr", marker: "ptr" },
  { kind: "type-marker", exportName: "fnptr", marker: "fnptr" },
] as const;

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
    ...expectedSourceCoreLangIntrinsics.map((entry) => entry.exportName),
  ]);
  assert.equal(declarationModel.exports.some((entry) => entry.name === "int"), false);

  const typesResolution = assertVirtualModuleResolution(provider.resolveModule(tsonicCoreTypesModule, {}));
  assert.equal(typesResolution.providerModuleId, tsonicCoreTypesModule);
  const typesDeclarationModel = assertProviderDeclarationModel(provider.getDeclarationModel(typesResolution), tsonicCoreTypesModule);
  assert.deepEqual(typesDeclarationModel.exports.map((entry) => entry.name), [
    ...expectedSourceCorePrimitiveFacts.map((entry) => entry.exportName),
  ]);
  assert.equal(typesDeclarationModel.exports.some((entry) => entry.name === "out"), false);

  const unownedResolution = provider.resolveModule("@tsonic/csharp/lang.js", {});
  assert.equal(assertExtensionDiagnostic(unownedResolution).extensionCode, "TSONIC_SOURCE_CORE_MODULE_UNOWNED");
});

test("source-core records exact facts for every core primitive export", () => {
  assert.deepEqual(sourceCorePrimitiveExportFacts(), expectedSourceCorePrimitiveFacts);

  const namedImports = expectedSourceCorePrimitiveFacts.map((entry) => entry.exportName).join(", ");
  const aliasImports = expectedSourceCorePrimitiveFacts
    .map((entry) => `${entry.exportName} as Alias_${entry.exportName}`)
    .join(", ");
  const directAliases = expectedSourceCorePrimitiveFacts
    .map((entry) => `type Direct_${entry.exportName} = ${entry.exportName};`)
    .join("\n");
  const importedAliases = expectedSourceCorePrimitiveFacts
    .map((entry) => `type ImportedAlias_${entry.exportName} = Alias_${entry.exportName};`)
    .join("\n");
  const namespaceAliases = expectedSourceCorePrimitiveFacts
    .map((entry) => `type Namespace_${entry.exportName} = coreTypes.${entry.exportName};`)
    .join("\n");

  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { ${namedImports} } from "@tsonic/core/types.js";
    import type { ${aliasImports} } from "@tsonic/core/types.js";
    import type * as coreTypes from "@tsonic/core/types.js";

    ${directAliases}
    ${importedAliases}
    ${namespaceAliases}
  `);

  for (const expected of expectedSourceCorePrimitiveFacts) {
    const identity = `${tsonicCoreTypesModule}::${expected.exportName}`;
    assertSourcePrimitive(session, typeAliasType(session, sourceFile, `Direct_${expected.exportName}`), expected.fact, identity);
    assertSourcePrimitive(session, typeAliasType(session, sourceFile, `ImportedAlias_${expected.exportName}`), expected.fact, identity);
    assertSourcePrimitive(session, typeAliasType(session, sourceFile, `Namespace_${expected.exportName}`), expected.fact, identity);
  }
});

test("source-core does not guess primitive facts from same-spelling local aliases", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { int32 as coreInt32 } from "@tsonic/core/types.js";
    import type { int32 as localInt32, uint64 as localUint64 } from "./local.js";

    type int32 = number;
    type uint64 = bigint;
    type Direct = coreInt32;
    type ImportedLocalInt32 = localInt32;
    type ImportedLocalUint64 = localUint64;
    type ShadowedInt32 = int32;
    type ShadowedUint64 = uint64;
  `, {
    "/src/local.ts": [
      "export type int32 = number;",
      "export type uint64 = bigint;",
    ].join("\n"),
  });

  assertSourcePrimitive(session, typeAliasType(session, sourceFile, "Direct"), {
    kind: "int32",
    runtimeBase: "number",
    signed: true,
    width: 32,
  }, `${tsonicCoreTypesModule}::int32`);
  assert.equal(session.extensionHost?.facts.get(typeAliasType(session, sourceFile, "ImportedLocalInt32"), sourcePrimitiveFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeAliasType(session, sourceFile, "ImportedLocalUint64"), sourcePrimitiveFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeAliasType(session, sourceFile, "ShadowedInt32"), sourcePrimitiveFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeAliasType(session, sourceFile, "ShadowedUint64"), sourcePrimitiveFactKey), undefined);
});

test("source-core records direct provider-owned facts for every core lang intrinsic", () => {
  assert.deepEqual(sourceCoreLangExportFacts(), expectedSourceCoreLangIntrinsics);

  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { attribute, borrow, borrowMut, defaultof, field, inref, move, out, ref, struct } from "@tsonic/core/lang.js";
    import type { fnptr, ptr } from "@tsonic/core/lang.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    class RouteAttribute {}
    class User {
      name = "";
    }

    let value = 0;
    out(value);
    ref(value);
    inref(value);
    borrow(value);
    borrowMut(value);
    move(value);
    const defaultValue = defaultof<int32>();
    const Point = struct({ id: field<int32>() });
    attribute<User>().add(RouteAttribute);
    type DirectPointer = ptr<int32>;
    type DirectFunctionPointer = fnptr<[int32], bool>;
  `);

  assert.equal(argumentMode(session, callExpression(session, sourceFile, "out")), "byref-writeonly-must-init");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "ref")), "byref-readwrite");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "inref")), "byref-readonly");
  assert.equal(flowState(session, callExpression(session, sourceFile, "borrow")), "borrowed-shared");
  assert.equal(flowState(session, callExpression(session, sourceFile, "borrowMut")), "borrowed-mut");
  assert.equal(flowState(session, callExpression(session, sourceFile, "move")), "moved");

  const defaultFact = sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "defaultof"));
  assert.equal(typeReferenceName(session, defaultFact?.type as Node | undefined), "int32");

  const fieldFact = sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "field"));
  assert.equal(fieldFact?.name, "id");
  assert.equal(session.extensionHost?.facts.get(fieldFact?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");

  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  assert.deepEqual(extensionFacts(extensionHost).getStructFact(callExpression(session, sourceFile, "struct"))?.fields?.map((field) => field.name), ["id"]);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(propertyCallExpression(session, sourceFile, "add"))?.attributeName, "RouteAttribute");

  const pointerFact = extensionHost.facts.get(typeAliasType(session, sourceFile, "DirectPointer"), pointerFactKey);
  assert.equal(pointerFact?.mutability, "target-defined");
  assert.equal(pointerFact?.unsafeRequired, true);
  assert.equal(typeReferenceName(session, nodeFactSubject(pointerFact?.pointee)), "int32");

  const functionPointerFact = extensionHost.facts.get(typeAliasType(session, sourceFile, "DirectFunctionPointer"), functionPointerFactKey);
  assert.equal(functionPointerFact?.parameters.length, 1);
  assert.equal(typeReferenceName(session, nodeFactSubject(functionPointerFact?.result)), "bool");
  assert.deepEqual(functionPointerFact?.abi, ["target-default"]);
});

test("source-core records storage and flow marker facts from aliases and namespaces without guessing names", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { out as writeOut, ref as readWrite, inref as readOnly, borrow as shared, borrowMut as mutable, move as moved } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import { out as localOut, ref as localRef, inref as localInref, borrow as localBorrow, borrowMut as localBorrowMut, move as localMove } from "./local.js";

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
    localRef(value);
    localInref(value);
    localBorrow(value);
    localBorrowMut(value);
    localMove(value);
    function out(value: number): number {
      return value;
    }
    out(value);
    function shadow(
      writeOut: (value: number) => number,
      readWrite: (value: number) => number,
      readOnly: (value: number) => number,
      shared: (value: number) => number,
      mutable: (value: number) => number,
      moved: (value: number) => number,
      lang: {
        out(value: number): number;
        ref(value: number): number;
        inref(value: number): number;
        borrow(value: number): number;
        borrowMut(value: number): number;
        move(value: number): number;
      },
    ) {
      writeOut(value);
      readWrite(value);
      readOnly(value);
      lang.out(value);
      lang.ref(value);
      lang.inref(value);
      shared(value);
      mutable(value);
      moved(value);
      lang.borrow(value);
      lang.borrowMut(value);
      lang.move(value);
    }
  `, {
    "/src/local.ts": [
      "export function out<T>(value: T): T { return value; }",
      "export function ref<T>(value: T): T { return value; }",
      "export function inref<T>(value: T): T { return value; }",
      "export function borrow<T>(value: T): T { return value; }",
      "export function borrowMut<T>(value: T): T { return value; }",
      "export function move<T>(value: T): T { return value; }",
    ].join("\n"),
  });

  assert.equal(argumentMode(session, callExpression(session, sourceFile, "writeOut", 0)), "byref-writeonly-must-init");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "readWrite")), "byref-readwrite");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "readOnly")), "byref-readonly");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "lang.out", 0)), "byref-writeonly-must-init");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "lang.ref")), "byref-readwrite");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "lang.inref")), "byref-readonly");

  const sharedCall = callExpression(session, sourceFile, "shared", 0);
  assert.equal(flowState(session, sharedCall), "borrowed-shared");
  assert.equal(flowState(session, firstCallArgument(session, sharedCall)), "borrowed-shared");
  const mutableCall = callExpression(session, sourceFile, "mutable", 0);
  assert.equal(flowState(session, mutableCall), "borrowed-mut");
  assert.equal(flowState(session, firstCallArgument(session, mutableCall)), "borrowed-mut");
  const movedCall = callExpression(session, sourceFile, "moved");
  assert.equal(flowState(session, movedCall), "moved");
  assert.equal(flowState(session, firstCallArgument(session, movedCall)), "moved");
  const namespaceBorrowCall = callExpression(session, sourceFile, "lang.borrow", 0);
  assert.equal(flowState(session, namespaceBorrowCall), "borrowed-shared");
  assert.equal(flowState(session, firstCallArgument(session, namespaceBorrowCall)), "borrowed-shared");
  const namespaceBorrowMutCall = callExpression(session, sourceFile, "lang.borrowMut", 0);
  assert.equal(flowState(session, namespaceBorrowMutCall), "borrowed-mut");
  assert.equal(flowState(session, firstCallArgument(session, namespaceBorrowMutCall)), "borrowed-mut");
  const namespaceMoveCall = callExpression(session, sourceFile, "lang.move", 0);
  assert.equal(flowState(session, namespaceMoveCall), "moved");
  assert.equal(flowState(session, firstCallArgument(session, namespaceMoveCall)), "moved");

  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "localOut"), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "localRef"), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "localInref"), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "localBorrow"), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "localBorrowMut"), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "localMove"), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "out"), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "writeOut", 1), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "readWrite", 1), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "readOnly", 1), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.out", 1), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.ref", 1), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.inref", 1), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "shared", 1), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "mutable", 1), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "moved", 1), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.borrow", 1), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.borrowMut", 1), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.move", 1), flowStateFactKey), undefined);

  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  const consumer = createExtensionConsumerQueries(extensionHost, "source-core-test");
  assert.equal(consumer.getArgumentPassingFact(callExpression(session, sourceFile, "lang.out", 0))?.mode, "byref-writeonly-must-init");
  assert.equal(consumer.getFact(callExpression(session, sourceFile, "lang.move"), flowStateFactKey)?.state, "moved");
});

test("source-core keeps flow marker facts on exact call and argument subjects", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { borrow, borrowMut, move } from "@tsonic/core/lang.js";

    let source = { field: 1 };
    let unrelated = { field: 2 };
    const borrowed = borrow(source);
    const mutable = borrowMut(source.field);
    const movedValue = move(source);
    const laterSource = source;
    const laterField = source.field;
    const laterUnrelated = unrelated;
  `);

  const borrowCall = callExpression(session, sourceFile, "borrow");
  assert.equal(flowState(session, borrowCall), "borrowed-shared");
  assert.equal(flowState(session, firstCallArgument(session, borrowCall)), "borrowed-shared");
  assert.equal(flowState(session, variableDeclaration(session, sourceFile, "borrowed")), undefined);

  const borrowMutCall = callExpression(session, sourceFile, "borrowMut");
  assert.equal(flowState(session, borrowMutCall), "borrowed-mut");
  assert.equal(flowState(session, firstCallArgument(session, borrowMutCall)), "borrowed-mut");
  assert.equal(flowState(session, variableDeclaration(session, sourceFile, "mutable")), undefined);

  const moveCall = callExpression(session, sourceFile, "move");
  assert.equal(flowState(session, moveCall), "moved");
  assert.equal(flowState(session, firstCallArgument(session, moveCall)), "moved");
  assert.equal(flowState(session, variableDeclaration(session, sourceFile, "movedValue")), undefined);

  assert.equal(flowState(session, variableInitializer(session, sourceFile, "laterSource")), undefined);
  assert.equal(flowState(session, variableInitializer(session, sourceFile, "laterField")), undefined);
  assert.equal(flowState(session, variableInitializer(session, sourceFile, "laterUnrelated")), undefined);
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
    const Point = struct({ x: field<int32>(), ok: field<bool>() });
    const ignored = localField<int32>();
    attribute<User>().add(RouteAttribute, "user");
  `, {
    "/src/local.ts": "export function field<T>(): T { throw new Error('local field'); }",
  });

  const defaultCall = callExpression(session, sourceFile, "defaultof");
  const defaultFact = sourceCoreFacts(session).getDefaultValueFact(defaultCall);
  assert.equal(typeReferenceName(session, defaultFact?.type as Node | undefined), "char");

  const fieldFacts = [
    sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "field", 0)),
    sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "field", 1)),
  ];
  assert.deepEqual(fieldFacts.map((fact) => fact?.name), ["x", "ok"]);
  assert.equal(session.extensionHost?.facts.get(fieldFacts[0]?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");
  assert.equal(session.extensionHost?.facts.get(fieldFacts[1]?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "bool");
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "localField")), undefined);

  const attributeFact = sourceCoreFacts(session).getAttributeFact(propertyCallExpression(session, sourceFile, "add"));
  assert.equal(attributeFact?.attributeName, "RouteAttribute");
  assert.equal(session.ast.text(attributeFact?.target as Node | undefined), "RouteAttribute");
  assert.equal(attributeFact?.arguments?.length, 1);

  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  const structFact = extensionFacts(extensionHost).getStructFact(callExpression(session, sourceFile, "struct"));
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
    const Point = lang.struct({ id: lang.field<int32>() });
    const skipped = local.field<int32>();
    lang.attribute<User>().add(RouteAttribute);
    const fakeDefault = local.defaultof<bool>();
    const Fake = local.struct({ id: local.field<int32>() });
    local.attribute<User>().add(RouteAttribute);
  `);

  const defaultCall = callExpression(session, sourceFile, "lang.defaultof");
  const defaultFact = sourceCoreFacts(session).getDefaultValueFact(defaultCall);
  assert.equal(typeReferenceName(session, defaultFact?.type as Node | undefined), "bool");

  const fieldCall = callExpression(session, sourceFile, "lang.field");
  const fieldFact = sourceCoreFacts(session).getFieldFact(fieldCall);
  assert.equal(fieldFact?.name, "id");
  assert.equal(session.extensionHost?.facts.get(fieldFact?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");

  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  assert.deepEqual(extensionFacts(extensionHost).getStructFact(callExpression(session, sourceFile, "lang.struct"))?.fields?.map((field) => field.name), ["id"]);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(propertyCallExpression(session, sourceFile, "add", 0))?.attributeName, "RouteAttribute");
  assert.equal(extensionFacts(extensionHost).getFieldFact(callExpression(session, sourceFile, "local.field", 0)), undefined);
  assert.equal(extensionFacts(extensionHost).getDefaultValueFact(callExpression(session, sourceFile, "local.defaultof")), undefined);
  assert.equal(extensionFacts(extensionHost).getStructFact(callExpression(session, sourceFile, "local.struct")), undefined);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(propertyCallExpression(session, sourceFile, "add", 1)), undefined);
});

test("source-core records structural, attribute, and default facts from aliases without guessing names", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { attribute as coreAttribute, defaultof as coreDefaultof, field as coreField, struct as coreStruct } from "@tsonic/core/lang.js";
    import { attribute as localAttribute, defaultof as localDefaultof, field as localField, struct as localStruct } from "./local.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    class RouteAttribute {}
    class User {
      name = "";
    }

    const defaultValue = coreDefaultof<bool>();
    const Point = coreStruct({ id: coreField<int32>() });
    coreAttribute<User>().add(RouteAttribute);
    const localDefault = localDefaultof<bool>();
    const Local = localStruct({ id: localField<int32>() });
    localAttribute<User>().add(RouteAttribute);

    function shadow(
      coreStruct: <T>(shape: T) => T,
      coreField: <T>() => T,
      coreAttribute: <T>() => { add(attribute: object): void },
      coreDefaultof: <T>() => T,
    ) {
      const shadowDefault = coreDefaultof<bool>();
      const Shadow = coreStruct({ id: coreField<int32>() });
      coreAttribute<User>().add(RouteAttribute);
      return { shadowDefault, Shadow };
    }
  `, {
    "/src/local.ts": [
      "export function struct<T>(shape: T): T { return shape; }",
      "export function field<T>(): T { throw new Error('local field'); }",
      "export function attribute<T>(): { add(attribute: object): void } { return { add(_attribute: object): void {} }; }",
      "export function defaultof<T>(): T { throw new Error('local default'); }",
    ].join("\n"),
  });

  const defaultFact = sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "coreDefaultof", 0));
  assert.equal(typeReferenceName(session, defaultFact?.type as Node | undefined), "bool");

  const fieldFact = sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "coreField", 0));
  assert.equal(fieldFact?.name, "id");
  assert.equal(session.extensionHost?.facts.get(fieldFact?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");

  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  assert.deepEqual(extensionFacts(extensionHost).getStructFact(callExpression(session, sourceFile, "coreStruct", 0))?.fields?.map((field) => field.name), ["id"]);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(propertyCallExpression(session, sourceFile, "add", 0))?.attributeName, "RouteAttribute");
  assert.equal(extensionFacts(extensionHost).getDefaultValueFact(callExpression(session, sourceFile, "localDefaultof")), undefined);
  assert.equal(extensionFacts(extensionHost).getFieldFact(callExpression(session, sourceFile, "localField")), undefined);
  assert.equal(extensionFacts(extensionHost).getStructFact(callExpression(session, sourceFile, "localStruct")), undefined);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(propertyCallExpression(session, sourceFile, "add", 1)), undefined);
  assert.equal(extensionFacts(extensionHost).getDefaultValueFact(callExpression(session, sourceFile, "coreDefaultof", 1)), undefined);
  assert.equal(extensionFacts(extensionHost).getFieldFact(callExpression(session, sourceFile, "coreField", 1)), undefined);
  assert.equal(extensionFacts(extensionHost).getStructFact(callExpression(session, sourceFile, "coreStruct", 1)), undefined);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(propertyCallExpression(session, sourceFile, "add", 2)), undefined);
});

test("source-core attaches no intrinsic facts through unsupported local barrel re-exports", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { out, ref, inref, borrow, borrowMut, move, struct, field, attribute, defaultof } from "./barrel.js";
    import type { ptr, fnptr } from "./barrel.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    class RouteAttribute {}
    class User {
      name = "";
    }

    let value = 0;
    out(value);
    ref(value);
    inref(value);
    borrow(value);
    borrowMut(value);
    move(value);
    const defaultValue = defaultof<int32>();
    const Point = struct({ id: field<int32>() });
    attribute<User>().add(RouteAttribute);
    type Pointer = ptr<int32>;
    type FunctionPointer = fnptr<[int32], bool>;
  `, {
    "/src/barrel.ts": [
      "export { out, ref, inref, borrow, borrowMut, move, struct, field, attribute, defaultof } from '@tsonic/core/lang.js';",
      "export type { ptr, fnptr } from '@tsonic/core/lang.js';",
    ].join("\n"),
  });

  assert.equal(argumentMode(session, callExpression(session, sourceFile, "out")), undefined);
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "ref")), undefined);
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "inref")), undefined);
  assert.equal(flowState(session, callExpression(session, sourceFile, "borrow")), undefined);
  assert.equal(flowState(session, callExpression(session, sourceFile, "borrowMut")), undefined);
  assert.equal(flowState(session, callExpression(session, sourceFile, "move")), undefined);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "defaultof")), undefined);
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "field")), undefined);

  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  assert.equal(extensionFacts(extensionHost).getStructFact(callExpression(session, sourceFile, "struct")), undefined);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(propertyCallExpression(session, sourceFile, "add")), undefined);
  assert.equal(extensionHost.facts.get(typeReference(session, sourceFile, "ptr"), pointerFactKey), undefined);
  assert.equal(extensionHost.facts.get(typeReference(session, sourceFile, "fnptr"), functionPointerFactKey), undefined);
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
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "field")), undefined);
  assert.equal(sourceCoreFacts(session).getAttributeFact(callExpression(session, sourceFile, "attribute")), undefined);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "defaultof")), undefined);
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
  assert.equal(extensionFacts(extensionHost).getFieldFact(callExpression(session, sourceFile, "lang.field")), undefined);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(callExpression(session, sourceFile, "lang.attribute")), undefined);
  assert.equal(extensionFacts(extensionHost).getDefaultValueFact(callExpression(session, sourceFile, "lang.defaultof")), undefined);
});

test("source-core reports alias missing-evidence diagnostics without local or shadowed name guesses", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { attribute as coreAttribute, defaultof as coreDefaultof, field as coreField } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import { attribute as localAttribute, defaultof as localDefaultof, field as localField } from "./local.js";

    coreField();
    coreAttribute();
    coreDefaultof();
    localField();
    localAttribute();
    localDefaultof();

    function shadow(
      coreField: () => unknown,
      coreAttribute: () => unknown,
      coreDefaultof: () => unknown,
      lang: {
        field(): unknown;
        attribute(): unknown;
        defaultof(): unknown;
      },
    ) {
      coreField();
      coreAttribute();
      coreDefaultof();
      lang.field();
      lang.attribute();
      lang.defaultof();
    }
  `, {
    "/src/local.ts": [
      "export function field<T>(): T { throw new Error('local field'); }",
      "export function attribute<T>(): { add(attribute: object): void } { return { add(_attribute: object): void {} }; }",
      "export function defaultof<T>(): T { throw new Error('local default'); }",
    ].join("\n"),
  });

  session.ensureBound();
  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  assert.deepEqual(extensionHost.diagnostics.all().map((diagnostic) => diagnostic.extensionCode).sort(), [
    "SOURCE_SEMANTICS_MISSING_ATTRIBUTE_TARGET_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_FIELD_TYPE_EVIDENCE",
  ]);
  assert.equal(extensionFacts(extensionHost).getFieldFact(callExpression(session, sourceFile, "coreField", 0)), undefined);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(callExpression(session, sourceFile, "coreAttribute", 0)), undefined);
  assert.equal(extensionFacts(extensionHost).getDefaultValueFact(callExpression(session, sourceFile, "coreDefaultof", 0)), undefined);
  assert.equal(extensionFacts(extensionHost).getFieldFact(callExpression(session, sourceFile, "localField")), undefined);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(callExpression(session, sourceFile, "localAttribute")), undefined);
  assert.equal(extensionFacts(extensionHost).getDefaultValueFact(callExpression(session, sourceFile, "localDefaultof")), undefined);
  assert.equal(extensionFacts(extensionHost).getFieldFact(callExpression(session, sourceFile, "coreField", 1)), undefined);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(callExpression(session, sourceFile, "coreAttribute", 1)), undefined);
  assert.equal(extensionFacts(extensionHost).getDefaultValueFact(callExpression(session, sourceFile, "coreDefaultof", 1)), undefined);
  assert.equal(extensionFacts(extensionHost).getFieldFact(callExpression(session, sourceFile, "lang.field")), undefined);
  assert.equal(extensionFacts(extensionHost).getAttributeFact(callExpression(session, sourceFile, "lang.attribute")), undefined);
  assert.equal(extensionFacts(extensionHost).getDefaultValueFact(callExpression(session, sourceFile, "lang.defaultof")), undefined);
});

test("source-core virtual declarations leave invalid arity to TypeScript checking", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { out, borrow as shared, borrowMut as mutable, move as moved } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import type { ptr, fnptr } from "@tsonic/core/lang.js";

    let value = 1;
    out();
    out(value, value);
    shared();
    shared(value, value);
    mutable();
    mutable(value, value);
    moved();
    moved(value, value);
    lang.borrow();
    lang.borrow(value, value);
    lang.borrowMut();
    lang.borrowMut(value, value);
    lang.move();
    lang.move(value, value);
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
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "out", 1), argumentPassingFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "shared", 0), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "shared", 1), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "mutable", 0), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "mutable", 1), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "moved", 0), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "moved", 1), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.borrow", 0), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.borrow", 1), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.borrowMut", 0), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.borrowMut", 1), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.move", 0), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(callExpression(session, sourceFile, "lang.move", 1), flowStateFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "ptr", 0), pointerFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "fnptr", 0), functionPointerFactKey), undefined);
});

test("source-core finalizes struct and default owner facts with static field names", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { defaultof, field, struct } from "@tsonic/core/lang.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    const zero = defaultof<int32>();
    const Shape = struct({ "display-name": field<int32>(), 2: field<bool>() });
  `);

  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  const facts = extensionFacts(extensionHost);

  const defaultCall = callExpression(session, sourceFile, "defaultof");
  assert.equal(facts.getDefaultValueFact(variableDeclaration(session, sourceFile, "zero"))?.type, facts.getDefaultValueFact(defaultCall)?.type);
  assert.equal(typeReferenceName(session, facts.getDefaultValueFact(variableDeclaration(session, sourceFile, "zero"))?.type as Node | undefined), "int32");

  const fieldFacts = [
    facts.getFieldFact(callExpression(session, sourceFile, "field", 0)),
    facts.getFieldFact(callExpression(session, sourceFile, "field", 1)),
  ];
  assert.deepEqual(fieldFacts.map((fact) => fact?.name), ["display-name", "2"]);
  assert.equal(session.extensionHost?.facts.get(fieldFacts[0]?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");
  assert.equal(session.extensionHost?.facts.get(fieldFacts[1]?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "bool");

  const structCall = callExpression(session, sourceFile, "struct");
  assert.deepEqual(facts.getStructFact(structCall)?.fields?.map((field) => field.name), ["display-name", "2"]);
  assert.deepEqual(facts.getStructFact(variableDeclaration(session, sourceFile, "Shape"))?.fields?.map((field) => field.name), ["display-name", "2"]);
});

test("source-core validates non-field struct shape members", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { field, struct } from "@tsonic/core/lang.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    const shorthand = 1;
    const Broken = struct({ ok: field<bool>(), raw: 1, shorthand });
  `);

  session.ensureBound();
  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  assert.deepEqual(extensionHost.diagnostics.all().map((diagnostic) => diagnostic.extensionCode).sort(), [
    "SOURCE_SEMANTICS_STRUCT_FIELD_NOT_PROVEN",
  ]);

  const facts = extensionFacts(extensionHost);
  assert.deepEqual(facts.getStructFact(callExpression(session, sourceFile, "struct"))?.fields?.map((field) => field.name), ["ok"]);
  assert.equal(facts.getFieldFact(callExpression(session, sourceFile, "field"))?.name, "ok");
});

test("source-core records class and struct field contexts while rejecting orphan field markers", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { field, struct } from "@tsonic/core/lang.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    class Counter {
      value = field<int32>();
    }
    const Shape = struct({ enabled: field<bool>() });
    const orphan = field<int32>();
  `);

  session.ensureBound();
  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  assert.deepEqual(extensionHost.diagnostics.all().map((diagnostic) => diagnostic.extensionCode), [
    "SOURCE_SEMANTICS_FIELD_CONTEXT_NOT_PROVEN",
  ]);

  const facts = extensionFacts(extensionHost);
  assert.equal(facts.getFieldFact(callExpression(session, sourceFile, "field", 0))?.name, "value");
  assert.equal(facts.getFieldFact(callExpression(session, sourceFile, "field", 1))?.name, "enabled");
  assert.equal(facts.getFieldFact(callExpression(session, sourceFile, "field", 2)), undefined);
  assert.deepEqual(facts.getStructFact(callExpression(session, sourceFile, "struct"))?.fields?.map((field) => field.name), ["enabled"]);
});

test("source-core preserves member ordering and nested struct type evidence", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { field, struct } from "@tsonic/core/lang.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    const Inner = struct({ value: field<int32>() });
    const Outer = struct({
      first: field<int32>(),
      inner: field<typeof Inner>(),
      enabled: field<bool>(),
    });
  `);

  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined);
  const facts = extensionFacts(extensionHost);
  assert.deepEqual(facts.getStructFact(callExpression(session, sourceFile, "struct", 0))?.fields?.map((field) => field.name), ["value"]);
  assert.deepEqual(facts.getStructFact(callExpression(session, sourceFile, "struct", 1))?.fields?.map((field) => field.name), ["first", "inner", "enabled"]);
  assert.equal(session.ast.kindName(facts.getFieldFact(callExpression(session, sourceFile, "field", 2))?.type as Node | undefined), "KindTypeQuery");
});

test("source-core records ptr and fnptr facts from aliases and namespaces without local marker guessing", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { ptr as pointer, fnptr as functionPointer } from "@tsonic/core/lang.js";
    import type * as lang from "@tsonic/core/lang.js";
    import type { int32, bool } from "@tsonic/core/types.js";
    import type { ptr as localPointer, fnptr as localFunctionPointer } from "./local.js";

    type ptr<T> = T;
    type fnptr<TArgs, TReturn> = unknown;
    type AliasPointer = pointer<int32>;
    type NamespacePointer = lang.ptr<int32>;
    type AliasFunctionPointer = functionPointer<[int32, bool], int32>;
    type NamespaceFunctionPointer = lang.fnptr<[lang.ptr<int32>, int32], bool>;
    type LocalPointer = localPointer<int32>;
    type LocalFunctionPointer = localFunctionPointer<[int32], int32>;
    type ShadowPointer = ptr<int32>;
    type ShadowFunctionPointer = fnptr<[int32], int32>;
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
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "ptr"), pointerFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "fnptr"), functionPointerFactKey), undefined);
});

test("source-core records fnptr tuple and scalar parameter facts", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { fnptr as callback, ptr as pointer } from "@tsonic/core/lang.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    type NoArgs = callback<[], bool>;
    type OneArg = callback<int32, bool>;
    type PointerArg = callback<[pointer<int32>], pointer<bool>>;
  `);

  const noArgsFact = session.extensionHost?.facts.get(typeReference(session, sourceFile, "callback", 0), functionPointerFactKey);
  assert.equal(noArgsFact?.parameters.length, 0);
  assert.equal(typeReferenceName(session, nodeFactSubject(noArgsFact?.result)), "bool");

  const oneArgFact = session.extensionHost?.facts.get(typeReference(session, sourceFile, "callback", 1), functionPointerFactKey);
  assert.equal(oneArgFact?.parameters.length, 1);
  assert.equal(typeReferenceName(session, nodeFactSubject(oneArgFact?.parameters[0])), "int32");
  assert.equal(typeReferenceName(session, nodeFactSubject(oneArgFact?.result)), "bool");

  const pointerArgFact = session.extensionHost?.facts.get(typeReference(session, sourceFile, "callback", 2), functionPointerFactKey);
  assert.equal(pointerArgFact?.parameters.length, 1);
  assert.equal(session.extensionHost?.facts.get(nodeFactSubject(pointerArgFact?.parameters[0]), pointerFactKey)?.unsafeRequired, true);
  assert.equal(session.extensionHost?.facts.get(nodeFactSubject(pointerArgFact?.result), pointerFactKey)?.unsafeRequired, true);
});

test("source-core does not attach type marker facts to shadowed generic type names", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import type { fnptr as callback, ptr as pointer } from "@tsonic/core/lang.js";
    import type * as lang from "@tsonic/core/lang.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    function shadowPointer<pointer>(): pointer<int32> { throw new Error("shadowed pointer"); }
    function shadowCallback<callback>(): callback<[int32], bool> { throw new Error("shadowed callback"); }
    function shadowNamespacePointer<lang>(): lang.ptr<int32> { throw new Error("shadowed namespace pointer"); }
    function shadowNamespaceCallback<lang>(): lang.fnptr<[int32], bool> { throw new Error("shadowed namespace callback"); }
  `);

  const diagnostics = definedDiagnostics(session.getDiagnostics("semantic", sourceFile));
  assert.ok(diagnostics.length > 0);
  session.ensureBound();
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "pointer"), pointerFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "callback"), functionPointerFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "lang.ptr"), pointerFactKey), undefined);
  assert.equal(session.extensionHost?.facts.get(typeReference(session, sourceFile, "lang.fnptr"), functionPointerFactKey), undefined);
});

function assertVirtualModuleResolution(value: ProviderModuleResolution | ExtensionDiagnostic): ProviderModuleResolution {
  assert.equal((value as { readonly kind?: string }).kind, "virtual");
  return value as ProviderModuleResolution;
}

function assertProviderDeclarationModel(value: ProviderDeclarationModel | ExtensionDiagnostic, moduleSpecifier = tsonicCoreLangModule): ProviderDeclarationModel {
  assert.equal((value as { readonly moduleSpecifier?: string }).moduleSpecifier, moduleSpecifier);
  return value as ProviderDeclarationModel;
}

function assertExtensionDiagnostic(value: ProviderModuleResolution | ExtensionDiagnostic): ExtensionDiagnostic {
  assert.equal((value as { readonly category?: string }).category, "error");
  return value as ExtensionDiagnostic;
}

function sourceCorePrimitiveExportFacts(): readonly {
  readonly exportName: string;
  readonly fact: SourcePrimitiveFact;
}[] {
  return sourceCoreModuleExports(tsonicCoreTypesModule).map((exportDeclaration) => {
    if (exportDeclaration.kind !== "source-primitive") {
      assert.fail(`Expected only source primitive declarations in ${tsonicCoreTypesModule}.`);
    }
    return {
      exportName: exportDeclaration.exportName,
      fact: {
        kind: exportDeclaration.primitive,
        runtimeBase: exportDeclaration.runtimeBase,
        ...(exportDeclaration.signed !== undefined ? { signed: exportDeclaration.signed } : {}),
        ...(exportDeclaration.width !== undefined ? { width: exportDeclaration.width } : {}),
      },
    };
  });
}

function sourceCoreLangExportFacts(): readonly {
  readonly kind: "call-marker" | "type-marker";
  readonly exportName: string;
  readonly marker: string;
}[] {
  return sourceCoreModuleExports(tsonicCoreLangModule).map((exportDeclaration) => {
    if (exportDeclaration.kind === "source-primitive") {
      assert.fail(`Expected only lang marker declarations in ${tsonicCoreLangModule}.`);
    }
    return {
      kind: exportDeclaration.kind,
      exportName: exportDeclaration.exportName,
      marker: exportDeclaration.marker,
    };
  });
}

function sourceCoreModuleExports(moduleSpecifier: string) {
  const module = tsonicCoreSourceSemanticsModules().find((candidate) => candidate.moduleSpecifier === moduleSpecifier);
  assert.ok(module !== undefined, `Missing source-core module '${moduleSpecifier}'.`);
  return module.exports;
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
  expected: SourcePrimitiveFact,
  identity: string,
): void {
  const fact = session.extensionHost?.facts.get(node, sourcePrimitiveFactKey);
  assert.deepEqual(fact, expected);
  assert.equal(session.extensionHost?.facts.get(node, canonicalIdentityFactKey)?.id, identity);
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

function typeAliasType(session: CompilerSession, sourceFile: SourceFile, aliasName: string): Node {
  const found = findNode(sourceFile, session.ast, (node, ast) =>
    ast.is.IsTypeAliasDeclaration(node) && ast.text(ast.name(node)) === aliasName);
  const type = session.ast.as.AsTypeAliasDeclaration(found)?.Type;
  assert.ok(type !== undefined, `Missing type alias '${aliasName}'.`);
  return type;
}

function variableDeclaration(session: CompilerSession, sourceFile: SourceFile, variableName: string): Node {
  const found = findNode(sourceFile, session.ast, (node, ast) =>
    ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === variableName);
  assert.ok(found !== undefined, `Missing variable declaration '${variableName}'.`);
  return found;
}

function variableInitializer(session: CompilerSession, sourceFile: SourceFile, variableName: string): Node {
  const initializer = session.ast.as.AsVariableDeclaration(variableDeclaration(session, sourceFile, variableName))?.Initializer;
  assert.ok(initializer !== undefined, `Missing variable initializer '${variableName}'.`);
  return initializer;
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

function sourceCoreFacts(session: CompilerSession) {
  const extensionHost = session.finalizeExtensions();
  assert.ok(extensionHost !== undefined, "Expected source-core extension host.");
  return createExtensionConsumerQueries(extensionHost, "source-core-test");
}

function extensionFacts(extensionHost: ExtensionHost) {
  return createExtensionConsumerQueries(extensionHost, "source-core-test");
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
