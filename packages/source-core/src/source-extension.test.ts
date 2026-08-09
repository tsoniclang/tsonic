import assert from "node:assert/strict";
import { test } from "node:test";
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
} from "./identity.js";
import { createTsonicCoreSourceExtension } from "./source-extension.js";
import { tsonicAttributeBuilderFactKey } from "./attribute-builder-facts.js";
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
  { kind: "call-marker", exportName: "bindRawPointer", marker: "bind-raw-pointer" },
  { kind: "call-marker", exportName: "equalRawPointer", marker: "equal-raw-pointer" },
  { kind: "call-marker", exportName: "hashRawPointer", marker: "hash-raw-pointer" },
] as const;

const expectedSourceCoreTypeMarkers = [
  { kind: "type-marker", exportName: "Pointer", marker: "pointer" },
  { kind: "type-marker", exportName: "RawPointer", marker: "raw-pointer" },
  { kind: "type-marker", exportName: "FunctionPointer", marker: "function-pointer" },
] as const;

test("source-core virtual module provider owns only neutral core modules", () => {
  const provider = createTsonicCoreVirtualModulesProvider();
  assert.equal(provider.ownsModule(tsonicCoreLangModule, {}).kind, "owned");
  assert.equal(provider.ownsModule(tsonicCoreTypesModule, {}).kind, "owned");
  assert.equal(provider.ownsModule("@tsonic/csharp/lang.js", {}).kind, "unowned");
  assert.equal(provider.ownsModule("@tsonic/csharp/types.js", {}).kind, "unowned");

  const langResolution = assertVirtualModuleResolution(provider.resolveModule(tsonicCoreLangModule, {}));
  assert.equal(langResolution.providerModuleId, tsonicCoreLangModule);
  const declarationModel = assertProviderDeclarationModel(provider.getDeclarationModel(langResolution, {
    context: {},
    materialization: { kind: "complete" },
  }));
  assert.deepEqual(declarationModel.exports.map((entry) => entry.name).filter((name) => name !== "__TsonicAttributeBuilder" && name !== "__TsonicAttributeMemberBuilder"), [
    ...expectedSourceCoreLangIntrinsics.map((entry) => entry.exportName),
  ]);
  assert.equal(declarationModel.exports.some((entry) => entry.name === "int"), false);

  const typesResolution = assertVirtualModuleResolution(provider.resolveModule(tsonicCoreTypesModule, {}));
  assert.equal(typesResolution.providerModuleId, tsonicCoreTypesModule);
  const typesDeclarationModel = assertProviderDeclarationModel(provider.getDeclarationModel(typesResolution, {
    context: {},
    materialization: { kind: "complete" },
  }), tsonicCoreTypesModule);
  assert.deepEqual(typesDeclarationModel.exports.map((entry) => entry.name), [
    ...expectedSourceCorePrimitiveFacts.map((entry) => entry.exportName),
    ...expectedSourceCoreTypeMarkers.map((entry) => entry.exportName),
  ]);
  assert.equal(typesDeclarationModel.exports.some((entry) => entry.name === "writeOnlyRef"), false);

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
  assert.equal(getSourceFact(session, typeAliasType(session, sourceFile, "ImportedLocalInt32"), sourcePrimitiveFactKey), undefined);
  assert.equal(getSourceFact(session, typeAliasType(session, sourceFile, "ImportedLocalUint64"), sourcePrimitiveFactKey), undefined);
  assert.equal(getSourceFact(session, typeAliasType(session, sourceFile, "ShadowedInt32"), sourcePrimitiveFactKey), undefined);
  assert.equal(getSourceFact(session, typeAliasType(session, sourceFile, "ShadowedUint64"), sourcePrimitiveFactKey), undefined);
});

test("source-core records direct provider-owned facts for every core lang intrinsic", () => {
  assert.deepEqual(sourceCoreLangExportFacts(), expectedSourceCoreLangIntrinsics);
  assert.deepEqual(sourceCoreTypeMarkerExportFacts(), expectedSourceCoreTypeMarkers);

  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { attribute, sharedBorrow, mutableBorrow, defaultValue, field, readOnlyRef, move, writeOnlyRef, readWriteRef, struct } from "@tsonic/core/lang.js";
    import type { bool, FunctionPointer, int32, Pointer } from "@tsonic/core/types.js";

    class RouteAttribute {}
    class User {
      name = "";
    }

    let value = 0;
    writeOnlyRef(value);
    readWriteRef(value);
    readOnlyRef(value);
    sharedBorrow(value);
    mutableBorrow(value);
    move(value);
    const zero = defaultValue<int32>();
    const Point = struct({ id: field<int32>() });
    attribute<User>().add(RouteAttribute);
    type DirectPointer = Pointer<int32>;
    type DirectFunctionPointer = FunctionPointer<[int32], bool>;
  `);

  assert.equal(argumentMode(session, callExpression(session, sourceFile, "writeOnlyRef")), "byref-writeonly-must-init");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "readWriteRef")), "byref-readwrite");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "readOnlyRef")), "byref-readonly");
  assert.equal(flowState(session, callExpression(session, sourceFile, "sharedBorrow")), "borrowed-shared");
  assert.equal(flowState(session, callExpression(session, sourceFile, "mutableBorrow")), "borrowed-mut");
  assert.equal(flowState(session, callExpression(session, sourceFile, "move")), "moved");

  const defaultFact = sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "defaultValue"));
  assert.equal(typeReferenceName(session, defaultFact?.type as Node | undefined), "int32");

  const fieldFact = sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "field"));
  assert.equal(fieldFact?.name, "id");
  assert.equal(getSourceFact(session, fieldFact?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");

  assert.deepEqual(sourceCoreFacts(session).getStructFact(callExpression(session, sourceFile, "struct"))?.fields?.map((field) => field.name), ["id"]);
  assertAttributeApplication(session, propertyCallExpression(session, sourceFile, "add"), "User", "RouteAttribute", 0);

  const pointerFact = getSourceFact(session, typeAliasType(session, sourceFile, "DirectPointer"), pointerFactKey);
  assert.equal(pointerFact?.mutability, "readwrite");
  assert.equal(typeReferenceName(session, nodeFactSubject(pointerFact?.pointee)), "int32");

  const functionPointerFact = getSourceFact(session, typeAliasType(session, sourceFile, "DirectFunctionPointer"), functionPointerFactKey);
  assert.equal(functionPointerFact?.parameters.length, 1);
  assert.equal(typeReferenceName(session, nodeFactSubject(functionPointerFact?.result)), "bool");
  assert.deepEqual(functionPointerFact?.abi, ["target-default"]);
});

test("source-core records storage and flow marker facts from aliases and namespaces without guessing names", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { writeOnlyRef as writeOut, readWriteRef as readWrite, readOnlyRef as readOnly, sharedBorrow as shared, mutableBorrow as mutable, move as moved } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import { writeOnlyRef as localOut, readWriteRef as localRef, readOnlyRef as localInref, sharedBorrow as localBorrow, mutableBorrow as localBorrowMut, move as localMove } from "./local.js";

    let value = 0;
    let index = 0;
    const box = { field: 1, values: [1] };
    writeOut(value);
    readWrite(box.field);
    readOnly(box.values[index]);
    lang.writeOnlyRef(box.field);
    lang.readWriteRef(value);
    lang.readOnlyRef(box.values[0]);
    shared(value);
    mutable(box.field);
    moved(box.values[index]);
    lang.sharedBorrow(value);
    lang.mutableBorrow(box.field);
    lang.move(box.values[index]);
    localOut(value);
    localRef(value);
    localInref(value);
    localBorrow(value);
    localBorrowMut(value);
    localMove(value);
    function writeOnlyRef(value: number): number {
      return value;
    }
    writeOnlyRef(value);
    function shadow(
      writeOut: (value: number) => number,
      readWrite: (value: number) => number,
      readOnly: (value: number) => number,
      shared: (value: number) => number,
      mutable: (value: number) => number,
      moved: (value: number) => number,
      lang: {
        writeOnlyRef(value: number): number;
        readWriteRef(value: number): number;
        readOnlyRef(value: number): number;
        sharedBorrow(value: number): number;
        mutableBorrow(value: number): number;
        move(value: number): number;
      },
    ) {
      writeOut(value);
      readWrite(value);
      readOnly(value);
      lang.writeOnlyRef(value);
      lang.readWriteRef(value);
      lang.readOnlyRef(value);
      shared(value);
      mutable(value);
      moved(value);
      lang.sharedBorrow(value);
      lang.mutableBorrow(value);
      lang.move(value);
    }
  `, {
    "/src/local.ts": [
      "export function writeOnlyRef<T>(value: T): T { return value; }",
      "export function readWriteRef<T>(value: T): T { return value; }",
      "export function readOnlyRef<T>(value: T): T { return value; }",
      "export function sharedBorrow<T>(value: T): T { return value; }",
      "export function mutableBorrow<T>(value: T): T { return value; }",
      "export function move<T>(value: T): T { return value; }",
    ].join("\n"),
  });

  assert.equal(argumentMode(session, callExpression(session, sourceFile, "writeOut", 0)), "byref-writeonly-must-init");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "readWrite")), "byref-readwrite");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "readOnly")), "byref-readonly");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "lang.writeOnlyRef", 0)), "byref-writeonly-must-init");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "lang.readWriteRef")), "byref-readwrite");
  assert.equal(argumentMode(session, callExpression(session, sourceFile, "lang.readOnlyRef")), "byref-readonly");

  const sharedCall = callExpression(session, sourceFile, "shared", 0);
  assert.equal(flowState(session, sharedCall), "borrowed-shared");
  assert.equal(flowState(session, firstCallArgument(session, sharedCall)), "borrowed-shared");
  const mutableCall = callExpression(session, sourceFile, "mutable", 0);
  assert.equal(flowState(session, mutableCall), "borrowed-mut");
  assert.equal(flowState(session, firstCallArgument(session, mutableCall)), "borrowed-mut");
  const movedCall = callExpression(session, sourceFile, "moved");
  assert.equal(flowState(session, movedCall), "moved");
  assert.equal(flowState(session, firstCallArgument(session, movedCall)), "moved");
  const namespaceBorrowCall = callExpression(session, sourceFile, "lang.sharedBorrow", 0);
  assert.equal(flowState(session, namespaceBorrowCall), "borrowed-shared");
  assert.equal(flowState(session, firstCallArgument(session, namespaceBorrowCall)), "borrowed-shared");
  const namespaceBorrowMutCall = callExpression(session, sourceFile, "lang.mutableBorrow", 0);
  assert.equal(flowState(session, namespaceBorrowMutCall), "borrowed-mut");
  assert.equal(flowState(session, firstCallArgument(session, namespaceBorrowMutCall)), "borrowed-mut");
  const namespaceMoveCall = callExpression(session, sourceFile, "lang.move", 0);
  assert.equal(flowState(session, namespaceMoveCall), "moved");
  assert.equal(flowState(session, firstCallArgument(session, namespaceMoveCall)), "moved");

  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "localOut"), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "localRef"), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "localInref"), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "localBorrow"), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "localBorrowMut"), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "localMove"), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "writeOnlyRef"), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "writeOut", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "readWrite", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "readOnly", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.writeOnlyRef", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.readWriteRef", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.readOnlyRef", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "shared", 1), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "mutable", 1), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "moved", 1), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.sharedBorrow", 1), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.mutableBorrow", 1), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.move", 1), flowStateFactKey), undefined);

  assert.equal(sourceCoreFacts(session).getArgumentPassingFact(callExpression(session, sourceFile, "lang.writeOnlyRef", 0))?.mode, "byref-writeonly-must-init");
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.move"), flowStateFactKey)?.state, "moved");
});

test("source-core keeps flow marker facts on exact call and argument subjects", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { sharedBorrow, mutableBorrow, move } from "@tsonic/core/lang.js";

    let source = { field: 1 };
    let unrelated = { field: 2 };
    const borrowed = sharedBorrow(source);
    const mutable = mutableBorrow(source.field);
    const movedValue = move(source);
    const laterSource = source;
    const laterField = source.field;
    const laterUnrelated = unrelated;
  `);

  const borrowCall = callExpression(session, sourceFile, "sharedBorrow");
  assert.equal(flowState(session, borrowCall), "borrowed-shared");
  assert.equal(flowState(session, firstCallArgument(session, borrowCall)), "borrowed-shared");
  assert.equal(flowState(session, variableDeclaration(session, sourceFile, "borrowed")), undefined);

  const borrowMutCall = callExpression(session, sourceFile, "mutableBorrow");
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

test("source-core handles source primitive array destructured parameters", () => {
  const { session } = createCleanSourceCoreSession(`
    import type { int32 } from "@tsonic/core/types.js";

    function sum([first = 10, second = 20, ...rest]: int32[]): int32 {
      return first + second + rest.length;
    }

    function nested([[first], [, second]]: int32[][]): int32 {
      return first + second;
    }

    const result = sum([1, 2, 3]);
    const nestedResult = nested([[7], [0, 8]]);
  `);

  assert.ok(checkSource(session).getSourceFile("/src/index.ts") !== undefined);
});

test("source-core reports non-storage diagnostics for byref markers", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { writeOnlyRef, readWriteRef, readOnlyRef } from "@tsonic/core/lang.js";

    let value = 1;
    writeOnlyRef(value + 1);
    readWriteRef(value + 1);
    readOnlyRef(value + 1);
  `);

  const checked = checkSource(session);
  const diagnostics = definedDiagnostics(checked.diagnostics);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode).sort(), [
    "SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT",
    "SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT",
    "SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT",
  ]);
  assert.deepEqual(checked.extensionDiagnostics.map((diagnostic) => diagnostic.numericCode), [
    9901101,
    9901101,
    9901101,
  ]);

  for (const calleeText of ["writeOnlyRef", "readWriteRef", "readOnlyRef"]) {
    const call = callExpression(session, sourceFile, calleeText);
    assert.notEqual(getSourceFact(session, call, argumentPassingFactKey), undefined);
    assert.equal(getSourceFact(session, firstCallArgument(session, call), argumentPassingFactKey), undefined);
  }
});

test("source-core records abstract struct, field, attribute, and default facts", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { attribute, defaultValue, field, struct } from "@tsonic/core/lang.js";
    import type { bool, char, int32 } from "@tsonic/core/types.js";
    import { field as localField } from "./local.js";

    class RouteAttribute {}
    class User {
      name = "";
    }

    const defaultChar = defaultValue<char>();
    const Point = struct({ x: field<int32>(), ok: field<bool>() });
    const ignored = localField<int32>();
    attribute<User>().add(RouteAttribute, "user");
  `, {
    "/src/local.ts": "export function field<T>(): T { throw new Error('local field'); }",
  });

  const defaultCall = callExpression(session, sourceFile, "defaultValue");
  const defaultFact = sourceCoreFacts(session).getDefaultValueFact(defaultCall);
  assert.equal(typeReferenceName(session, defaultFact?.type as Node | undefined), "char");

  const fieldFacts = [
    sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "field", 0)),
    sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "field", 1)),
  ];
  assert.deepEqual(fieldFacts.map((fact) => fact?.name), ["x", "ok"]);
  assert.equal(getSourceFact(session, fieldFacts[0]?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");
  assert.equal(getSourceFact(session, fieldFacts[1]?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "bool");
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "localField")), undefined);

  const attributeCall = propertyCallExpression(session, sourceFile, "add");
  assertAttributeApplication(session, attributeCall, "User", "RouteAttribute", 1);

  const structFact = sourceCoreFacts(session).getStructFact(callExpression(session, sourceFile, "struct"));
  assert.equal(structFact?.valueType, true);
  assert.deepEqual(structFact?.fields?.map((field) => field.name), ["x", "ok"]);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(defaultCall)?.type, defaultFact?.type);
  assert.equal(sourceCoreFacts(session).getStructFact(callExpression(session, sourceFile, "struct"))?.fields?.length, 2);
  assert.equal(getSourceFact(session, attributeCall, tsonicAttributeBuilderFactKey)?.kind, "application");
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
      defaultValue<T>(): T { throw new Error("local default"); },
    };

    const defaultBool = lang.defaultValue<bool>();
    const Point = lang.struct({ id: lang.field<int32>() });
    const skipped = local.field<int32>();
    lang.attribute<User>().add(RouteAttribute);
    const fakeDefault = local.defaultValue<bool>();
    const Fake = local.struct({ id: local.field<int32>() });
    local.attribute<User>().add(RouteAttribute);
  `);

  const defaultCall = callExpression(session, sourceFile, "lang.defaultValue");
  const defaultFact = sourceCoreFacts(session).getDefaultValueFact(defaultCall);
  assert.equal(typeReferenceName(session, defaultFact?.type as Node | undefined), "bool");

  const fieldCall = callExpression(session, sourceFile, "lang.field");
  const fieldFact = sourceCoreFacts(session).getFieldFact(fieldCall);
  assert.equal(fieldFact?.name, "id");
  assert.equal(getSourceFact(session, fieldFact?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");

  assert.deepEqual(sourceCoreFacts(session).getStructFact(callExpression(session, sourceFile, "lang.struct"))?.fields?.map((field) => field.name), ["id"]);
  assertAttributeApplication(session, propertyCallExpression(session, sourceFile, "add", 0), "User", "RouteAttribute", 0);
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "local.field", 0)), undefined);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "local.defaultValue")), undefined);
  assert.equal(sourceCoreFacts(session).getStructFact(callExpression(session, sourceFile, "local.struct")), undefined);
  assert.equal(getSourceFact(session, propertyCallExpression(session, sourceFile, "add", 1), tsonicAttributeBuilderFactKey), undefined);
});

test("source-core records structural, attribute, and default facts from aliases without guessing names", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { attribute as coreAttribute, defaultValue as coreDefaultof, field as coreField, struct as coreStruct } from "@tsonic/core/lang.js";
    import { attribute as localAttribute, defaultValue as localDefaultof, field as localField, struct as localStruct } from "./local.js";
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
      "export function defaultValue<T>(): T { throw new Error('local default'); }",
    ].join("\n"),
  });

  const defaultFact = sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "coreDefaultof", 0));
  assert.equal(typeReferenceName(session, defaultFact?.type as Node | undefined), "bool");

  const fieldFact = sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "coreField", 0));
  assert.equal(fieldFact?.name, "id");
  assert.equal(getSourceFact(session, fieldFact?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");

  assert.deepEqual(sourceCoreFacts(session).getStructFact(callExpression(session, sourceFile, "coreStruct", 0))?.fields?.map((field) => field.name), ["id"]);
  assertAttributeApplication(session, propertyCallExpression(session, sourceFile, "add", 0), "User", "RouteAttribute", 0);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "localDefaultof")), undefined);
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "localField")), undefined);
  assert.equal(sourceCoreFacts(session).getStructFact(callExpression(session, sourceFile, "localStruct")), undefined);
  assert.equal(getSourceFact(session, propertyCallExpression(session, sourceFile, "add", 1), tsonicAttributeBuilderFactKey), undefined);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "coreDefaultof", 1)), undefined);
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "coreField", 1)), undefined);
  assert.equal(sourceCoreFacts(session).getStructFact(callExpression(session, sourceFile, "coreStruct", 1)), undefined);
  assert.equal(getSourceFact(session, propertyCallExpression(session, sourceFile, "add", 2), tsonicAttributeBuilderFactKey), undefined);
});

test("source-core rejects every unsupported local barrel re-export deterministically", () => {
  const { session } = createSourceCoreSession(`
    import { writeOnlyRef, readWriteRef, readOnlyRef, sharedBorrow, mutableBorrow, move, struct, field, attribute, defaultValue } from "./barrel.js";
    import type { Pointer as CorePointer, FunctionPointer as CoreFunctionPointer } from "./barrel.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    class RouteAttribute {}
    class User {
      name = "";
    }

    let value = 0;
    writeOnlyRef(value);
    readWriteRef(value);
    readOnlyRef(value);
    sharedBorrow(value);
    mutableBorrow(value);
    move(value);
    const zero = defaultValue<int32>();
    const Point = struct({ id: field<int32>() });
    attribute<User>().add(RouteAttribute);
    type ValuePointer = CorePointer<int32>;
    type ValueFunctionPointer = CoreFunctionPointer<[int32], bool>;
  `, {
    "/src/barrel.ts": [
      "export { writeOnlyRef, readWriteRef, readOnlyRef, sharedBorrow, mutableBorrow, move, struct, field, attribute, defaultValue } from '@tsonic/core/lang.js';",
      "export type { Pointer, FunctionPointer } from '@tsonic/core/types.js';",
    ].join("\n"),
  });

  const reexportDiagnostics = checkSource(session).extensionDiagnostics;
  assert.deepEqual(reexportDiagnostics.map((diagnostic) => diagnostic.extensionCode), [
    "SOURCE_SEMANTICS_CORE_REEXPORT_UNSUPPORTED",
    "SOURCE_SEMANTICS_CORE_REEXPORT_UNSUPPORTED",
  ]);
  assert.deepEqual(reexportDiagnostics.map((diagnostic) => diagnostic.numericCode), [9901110, 9901110]);
  assert.equal(reexportDiagnostics.every((diagnostic) => diagnostic.nodeOrSpan !== undefined), true);

  assert.deepEqual(reexportDiagnostics.map((diagnostic) => (
    diagnostic.evidence?.[0]?.details as { readonly moduleSpecifier?: string } | undefined
  )?.moduleSpecifier), [
    tsonicCoreLangModule,
    tsonicCoreTypesModule,
  ]);
});

test("source-core rejects renamed and namespace local barrels without preserving source-core identity", () => {
  const { session } = createSourceCoreSession(`
    import { writeOut, CoreLang } from "./barrel.js";
    import type { Pointer, Callback } from "./barrel.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    let value = 0;
    writeOut(value);
    CoreLang.writeOnlyRef(value);
    type ValuePointer = Pointer<int32>;
    type ValueCallback = Callback<[int32], bool>;
  `, {
    "/src/barrel.ts": [
      "export { writeOnlyRef as writeOut } from '@tsonic/core/lang.js';",
      "export type { Pointer, FunctionPointer as Callback } from '@tsonic/core/types.js';",
      "export * as CoreLang from '@tsonic/core/lang.js';",
    ].join("\n"),
  });

  assert.deepEqual(checkSource(session).extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode), [
    "SOURCE_SEMANTICS_CORE_REEXPORT_UNSUPPORTED",
    "SOURCE_SEMANTICS_CORE_REEXPORT_UNSUPPORTED",
    "SOURCE_SEMANTICS_CORE_REEXPORT_UNSUPPORTED",
  ]);

  assert.equal(checkSource(session).extensionDiagnostics.every((diagnostic) => diagnostic.nodeOrSpan !== undefined), true);
});

test("source-core rejects unsupported export-star barrels for portable lang intrinsics", () => {
  const { session } = createSourceCoreSession(`
    export * from "@tsonic/core/lang.js";
  `);

  const checked = checkSource(session);
  const diagnostics = definedDiagnostics(checked.diagnostics);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode), [
    "SOURCE_SEMANTICS_CORE_REEXPORT_UNSUPPORTED",
  ]);
  assert.deepEqual(checked.extensionDiagnostics.map((diagnostic) => diagnostic.numericCode), [9901110]);
});

test("source-core rejects unsupported type-only barrels for portable type markers", () => {
  const { session } = createSourceCoreSession(`
    export type { Pointer, FunctionPointer } from "@tsonic/core/types.js";
  `);

  const checked = checkSource(session);
  const diagnostics = definedDiagnostics(checked.diagnostics);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode), [
    "SOURCE_SEMANTICS_CORE_REEXPORT_UNSUPPORTED",
  ]);
  assert.deepEqual(checked.extensionDiagnostics.map((diagnostic) => diagnostic.numericCode), [9901110]);
});

test("source-core reports missing explicit type evidence for target-neutral marker facts", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { attribute, defaultValue, field } from "@tsonic/core/lang.js";

    const missingField = field();
    const missingAttribute = attribute();
    const missingDefault = defaultValue();
  `);

  const checked = checkSource(session);
  const diagnostics = definedDiagnostics(checked.diagnostics);
  const extensionCodes = checked.extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode).sort();
  assert.deepEqual(extensionCodes, [
    "SOURCE_SEMANTICS_MISSING_ATTRIBUTE_TARGET_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_FIELD_TYPE_EVIDENCE",
  ]);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(
    checked.extensionDiagnostics.map((diagnostic) => diagnostic.numericCode).sort(numberSort),
    [9901102, 9901105, 9901106],
  );

  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "field")), undefined);
  assert.equal(sourceCoreFacts(session).getAttributeFact(callExpression(session, sourceFile, "attribute")), undefined);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "defaultValue")), undefined);
});

test("source-core reports missing evidence diagnostics through namespace marker forms", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import * as lang from "@tsonic/core/lang.js";

    const namespaceField = lang.field();
    const namespaceAttribute = lang.attribute();
    const namespaceDefault = lang.defaultValue();
  `);

  const checked = checkSource(session);
  assert.deepEqual(checked.extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode).sort(), [
    "SOURCE_SEMANTICS_MISSING_ATTRIBUTE_TARGET_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_FIELD_TYPE_EVIDENCE",
  ]);
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "lang.field")), undefined);
  assert.equal(sourceCoreFacts(session).getAttributeFact(callExpression(session, sourceFile, "lang.attribute")), undefined);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "lang.defaultValue")), undefined);
});

test("source-core reports alias missing-evidence diagnostics without local or shadowed name guesses", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { attribute as coreAttribute, defaultValue as coreDefaultof, field as coreField } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import { attribute as localAttribute, defaultValue as localDefaultof, field as localField } from "./local.js";

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
        defaultValue(): unknown;
      },
    ) {
      coreField();
      coreAttribute();
      coreDefaultof();
      lang.field();
      lang.attribute();
      lang.defaultValue();
    }
  `, {
    "/src/local.ts": [
      "export function field<T>(): T { throw new Error('local field'); }",
      "export function attribute<T>(): { add(attribute: object): void } { return { add(_attribute: object): void {} }; }",
      "export function defaultValue<T>(): T { throw new Error('local default'); }",
    ].join("\n"),
  });

  const checked = checkSource(session);
  assert.deepEqual(checked.extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode).sort(), [
    "SOURCE_SEMANTICS_MISSING_ATTRIBUTE_TARGET_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE",
    "SOURCE_SEMANTICS_MISSING_FIELD_TYPE_EVIDENCE",
  ]);
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "coreField", 0)), undefined);
  assert.equal(sourceCoreFacts(session).getAttributeFact(callExpression(session, sourceFile, "coreAttribute", 0)), undefined);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "coreDefaultof", 0)), undefined);
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "localField")), undefined);
  assert.equal(sourceCoreFacts(session).getAttributeFact(callExpression(session, sourceFile, "localAttribute")), undefined);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "localDefaultof")), undefined);
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "coreField", 1)), undefined);
  assert.equal(sourceCoreFacts(session).getAttributeFact(callExpression(session, sourceFile, "coreAttribute", 1)), undefined);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "coreDefaultof", 1)), undefined);
  assert.equal(sourceCoreFacts(session).getFieldFact(callExpression(session, sourceFile, "lang.field")), undefined);
  assert.equal(sourceCoreFacts(session).getAttributeFact(callExpression(session, sourceFile, "lang.attribute")), undefined);
  assert.equal(sourceCoreFacts(session).getDefaultValueFact(callExpression(session, sourceFile, "lang.defaultValue")), undefined);
});

test("source-core virtual declarations leave invalid arity to TypeScript checking", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { readOnlyRef, writeOnlyRef, readWriteRef as passRef, sharedBorrow as shared, mutableBorrow as mutable, move as moved } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import type { Pointer, FunctionPointer } from "@tsonic/core/types.js";

    let value = 1;
    writeOnlyRef();
    writeOnlyRef(value, value);
    passRef();
    passRef(value, value);
    readOnlyRef();
    readOnlyRef(value, value);
    lang.writeOnlyRef();
    lang.writeOnlyRef(value, value);
    lang.readWriteRef();
    lang.readWriteRef(value, value);
    lang.readOnlyRef();
    lang.readOnlyRef(value, value);
    shared();
    shared(value, value);
    mutable();
    mutable(value, value);
    moved();
    moved(value, value);
    lang.sharedBorrow();
    lang.sharedBorrow(value, value);
    lang.mutableBorrow();
    lang.mutableBorrow(value, value);
    lang.move();
    lang.move(value, value);
    type MissingPointer = Pointer;
    type ExtraPointer = Pointer<number, number>;
    type MissingFunctionPointer = FunctionPointer<[number]>;
    type ExtraFunctionPointer = FunctionPointer<[number], number, number>;
  `);

  const diagnostics = definedDiagnostics(session.getDiagnostics("semantic", sourceFile));
  const formattedDiagnostics = formatDiagnostics(diagnostics, "/src");
  assert.match(formattedDiagnostics, /Expected 1 arguments?, but got 0/);
  assert.match(formattedDiagnostics, /Expected 1 arguments?, but got 2/);
  assert.match(formattedDiagnostics, /Generic type 'Pointer<T>' requires 1 type argument/);
  assert.match(formattedDiagnostics, /Generic type 'FunctionPointer<TArgs, TReturn>' requires 2 type argument/);

  session.ensureBound();
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "writeOnlyRef", 0), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "writeOnlyRef", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "passRef", 0), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "passRef", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "readOnlyRef", 0), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "readOnlyRef", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.writeOnlyRef", 0), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.writeOnlyRef", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.readWriteRef", 0), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.readWriteRef", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.readOnlyRef", 0), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.readOnlyRef", 1), argumentPassingFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "shared", 0), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "shared", 1), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "mutable", 0), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "mutable", 1), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "moved", 0), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "moved", 1), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.sharedBorrow", 0), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.sharedBorrow", 1), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.mutableBorrow", 0), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.mutableBorrow", 1), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.move", 0), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.move", 1), flowStateFactKey), undefined);
  assert.equal(getSourceFact(session, typeReference(session, sourceFile, "Pointer", 0), pointerFactKey), undefined);
  assert.equal(getSourceFact(session, typeReference(session, sourceFile, "FunctionPointer", 0), functionPointerFactKey), undefined);
});

test("source-core finalizes struct and default owner facts with static field names", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { defaultValue, field, struct } from "@tsonic/core/lang.js";
    import type { bool, int32 } from "@tsonic/core/types.js";

    const zero = defaultValue<int32>();
    const Shape = struct({ "display-name": field<int32>(), 2: field<bool>() });
  `);

  const facts = sourceCoreFacts(session);

  const defaultCall = callExpression(session, sourceFile, "defaultValue");
  assert.equal(facts.getDefaultValueFact(variableDeclaration(session, sourceFile, "zero"))?.type, facts.getDefaultValueFact(defaultCall)?.type);
  assert.equal(typeReferenceName(session, facts.getDefaultValueFact(variableDeclaration(session, sourceFile, "zero"))?.type as Node | undefined), "int32");

  const fieldFacts = [
    facts.getFieldFact(callExpression(session, sourceFile, "field", 0)),
    facts.getFieldFact(callExpression(session, sourceFile, "field", 1)),
  ];
  assert.deepEqual(fieldFacts.map((fact) => fact?.name), ["display-name", "2"]);
  assert.equal(getSourceFact(session, fieldFacts[0]?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "int32");
  assert.equal(getSourceFact(session, fieldFacts[1]?.type as Node | undefined, sourcePrimitiveFactKey)?.kind, "bool");

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
  const diagnostics = checkSource(session).extensionDiagnostics;
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.extensionCode).sort(), [
    "SOURCE_SEMANTICS_STRUCT_FIELD_NOT_PROVEN",
    "SOURCE_SEMANTICS_STRUCT_FIELD_NOT_PROVEN",
  ]);
  assert.equal(new Set(diagnostics.map((diagnostic) => diagnostic.identity)).size, 2);
  assert.equal(diagnostics.every((diagnostic) => diagnostic.nodeOrSpan !== undefined), true);

  const facts = sourceCoreFacts(session);
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
  assert.deepEqual(checkSource(session).extensionDiagnostics.map((diagnostic) => diagnostic.extensionCode), [
    "SOURCE_SEMANTICS_FIELD_CONTEXT_NOT_PROVEN",
  ]);

  const facts = sourceCoreFacts(session);
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

  const facts = sourceCoreFacts(session);
  assert.deepEqual(facts.getStructFact(callExpression(session, sourceFile, "struct", 0))?.fields?.map((field) => field.name), ["value"]);
  assert.deepEqual(facts.getStructFact(callExpression(session, sourceFile, "struct", 1))?.fields?.map((field) => field.name), ["first", "inner", "enabled"]);
  assert.equal(sourceAst(session).kindName(facts.getFieldFact(callExpression(session, sourceFile, "field", 2))?.type as Node | undefined), "KindTypeQuery");
});

test("source-core records Pointer and FunctionPointer facts from aliases and namespaces without local marker guessing", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { bool, FunctionPointer as functionPointer, int32, Pointer as pointer } from "@tsonic/core/types.js";
    import type * as coreTypes from "@tsonic/core/types.js";
    import type { Pointer as localPointer, FunctionPointer as localFunctionPointer } from "./local.js";

    type Pointer<T> = T;
    type FunctionPointer<TArgs, TReturn> = unknown;
    type AliasPointer = pointer<int32>;
    type NamespacePointer = coreTypes.Pointer<int32>;
    type AliasFunctionPointer = functionPointer<[int32, bool], int32>;
    type NamespaceFunctionPointer = coreTypes.FunctionPointer<[coreTypes.Pointer<int32>, int32], bool>;
    type LocalPointer = localPointer<int32>;
    type LocalFunctionPointer = localFunctionPointer<[int32], int32>;
    type ShadowPointer = Pointer<int32>;
    type ShadowFunctionPointer = FunctionPointer<[int32], int32>;
  `, {
    "/src/local.ts": [
      "export type Pointer<T> = T;",
      "export type FunctionPointer<TArgs, TReturn> = unknown;",
    ].join("\n"),
  });

  const aliasPointer = typeReference(session, sourceFile, "pointer");
  assert.equal(getSourceFact(session, aliasPointer, pointerFactKey)?.mutability, "readwrite");
  assert.equal(typeReferenceName(session, nodeFactSubject(getSourceFact(session, aliasPointer, pointerFactKey)?.pointee)), "int32");

  const namespacePointer = typeReference(session, sourceFile, "coreTypes.Pointer", 0);
  assert.equal(getSourceFact(session, namespacePointer, pointerFactKey)?.mutability, "readwrite");

  const aliasFunctionPointer = typeReference(session, sourceFile, "functionPointer");
  const aliasFunctionPointerFact = getSourceFact(session, aliasFunctionPointer, functionPointerFactKey);
  assert.equal(aliasFunctionPointerFact?.parameters.length, 2);
  assert.equal(typeReferenceName(session, nodeFactSubject(aliasFunctionPointerFact?.result)), "int32");
  assert.deepEqual(aliasFunctionPointerFact?.abi, ["target-default"]);

  const namespaceFunctionPointer = typeReference(session, sourceFile, "coreTypes.FunctionPointer");
  const namespaceFunctionPointerFact = getSourceFact(session, namespaceFunctionPointer, functionPointerFactKey);
  assert.equal(namespaceFunctionPointerFact?.parameters.length, 2);
  assert.equal(typeReferenceName(session, nodeFactSubject(namespaceFunctionPointerFact?.result)), "bool");
  assert.equal(getSourceFact(session, typeReference(session, sourceFile, "coreTypes.Pointer", 1), pointerFactKey)?.mutability, "readwrite");

  assert.equal(getSourceFact(session, typeReference(session, sourceFile, "localPointer"), pointerFactKey), undefined);
  assert.equal(getSourceFact(session, typeReference(session, sourceFile, "localFunctionPointer"), functionPointerFactKey), undefined);
  assert.equal(getSourceFact(session, typeReference(session, sourceFile, "Pointer"), pointerFactKey), undefined);
  assert.equal(getSourceFact(session, typeReference(session, sourceFile, "FunctionPointer"), functionPointerFactKey), undefined);
});

test("source-core records FunctionPointer tuple and scalar parameter facts", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { bool, FunctionPointer as callback, int32, Pointer as pointer } from "@tsonic/core/types.js";

    type NoArgs = callback<[], bool>;
    type OneArg = callback<int32, bool>;
    type PointerArg = callback<[pointer<int32>], pointer<bool>>;
  `);

  const noArgsFact = getSourceFact(session, typeReference(session, sourceFile, "callback", 0), functionPointerFactKey);
  assert.equal(noArgsFact?.parameters.length, 0);
  assert.equal(typeReferenceName(session, nodeFactSubject(noArgsFact?.result)), "bool");

  const oneArgFact = getSourceFact(session, typeReference(session, sourceFile, "callback", 1), functionPointerFactKey);
  assert.equal(oneArgFact?.parameters.length, 1);
  assert.equal(typeReferenceName(session, nodeFactSubject(oneArgFact?.parameters[0])), "int32");
  assert.equal(typeReferenceName(session, nodeFactSubject(oneArgFact?.result)), "bool");

  const pointerArgFact = getSourceFact(session, typeReference(session, sourceFile, "callback", 2), functionPointerFactKey);
  assert.equal(pointerArgFact?.parameters.length, 1);
  assert.equal(getSourceFact(session, nodeFactSubject(pointerArgFact?.parameters[0]), pointerFactKey)?.mutability, "readwrite");
  assert.equal(getSourceFact(session, nodeFactSubject(pointerArgFact?.result), pointerFactKey)?.mutability, "readwrite");
});

test("source-core exposes exact typed pointer operation facts without spelling inference", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { addressOf as takeAddress, allocatePointer, bindPointer, equalPointer, hashPointer, loadPointer, projectPointer, storePointer } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import type { int32 } from "@tsonic/core/types.js";
    import { bindPointer as localBindPointer, equalPointer as localEqualPointer, loadPointer as localLoadPointer } from "./local.js";

    let value: int32 = 1;
    const borrowed = takeAddress(value);
    const owned = allocatePointer<int32>(value);
    const first = loadPointer(borrowed);
    storePointer(owned, first);
    const equal = equalPointer(borrowed, borrowed);
    const nilEqual = equalPointer<int32>(undefined, undefined);
    const hash = hashPointer(borrowed);
    const storage = { value };
    const bound = bindPointer<int32>(storage, () => storage.value, next => { storage.value = next; });
    localBindPointer(storage, () => storage.value, next => { storage.value = next; });
    const projected = projectPointer<int32, int32>(borrowed, value => value, value => value);
    const second = lang.loadPointer(owned);
    localLoadPointer(owned);
    localEqualPointer(owned, owned);
  `, {
    "/src/local.ts": `export function loadPointer<T>(pointer: T): T { return pointer; }
export function equalPointer<T>(left: T, right: T): boolean { return left === right; }
export function bindPointer<T>(_identity: object, read: () => T, _write: (value: T) => void): T { return read(); }`,
  });

  const address = getSourceFact(session, callExpression(session, sourceFile, "takeAddress"), pointerOperationFactKey);
  assert.equal(address?.operation, "address-of");
  assert.equal(address?.operation === "address-of" ? sourceAst(session).text(address.storageExpression) : undefined, "value");
  assert.equal(address?.operation === "address-of" ? address.locationIdentity : undefined, address?.operation === "address-of" ? address.storageExpression : undefined);

  const allocation = getSourceFact(session, callExpression(session, sourceFile, "allocatePointer"), pointerOperationFactKey);
  assert.equal(allocation?.operation, "allocate");
  assert.equal(allocation?.operation === "allocate" ? allocation.locationIdentity : undefined, allocation?.operation === "allocate" ? allocation.call : undefined);

  const load = getSourceFact(session, callExpression(session, sourceFile, "loadPointer"), pointerOperationFactKey);
  assert.equal(load?.operation, "load");
  assert.equal(load?.operation === "load" ? sourceAst(session).text(load.pointerExpression) : undefined, "borrowed");

  const store = getSourceFact(session, callExpression(session, sourceFile, "storePointer"), pointerOperationFactKey);
  assert.equal(store?.operation, "store");
  assert.equal(store?.operation === "store" ? sourceAst(session).text(store.pointerExpression) : undefined, "owned");
  assert.equal(store?.operation === "store" ? sourceAst(session).text(store.valueExpression) : undefined, "first");

  const equal = getSourceFact(session, callExpression(session, sourceFile, "equalPointer"), pointerOperationFactKey);
  assert.equal(equal?.operation, "equal-pointer");
  const nilEqual = getSourceFact(session, callExpression(session, sourceFile, "equalPointer", 1), pointerOperationFactKey);
  assert.equal(nilEqual?.operation, "equal-pointer");
    assert.equal(getSourceFact(session, callExpression(session, sourceFile, "hashPointer"), pointerOperationFactKey)?.operation, "hash-pointer");
  const bound = getSourceFact(session, callExpression(session, sourceFile, "bindPointer"), pointerOperationFactKey);
  assert.equal(bound?.operation, "bind-pointer");
  assert.equal(bound?.operation === "bind-pointer" ? bound.locationIdentity : undefined, bound?.operation === "bind-pointer" ? bound.identityExpression : undefined);
    assert.equal(getSourceFact(session, callExpression(session, sourceFile, "projectPointer"), pointerOperationFactKey)?.operation, "project-pointer");

  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.loadPointer"), pointerOperationFactKey)?.operation, "load");
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "localLoadPointer"), pointerOperationFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "localEqualPointer"), pointerOperationFactKey), undefined);
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "localBindPointer"), pointerOperationFactKey), undefined);
});

test("source-core exposes opaque raw-pointer identity facts without spelling inference", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { RawPointer } from "@tsonic/core/types.js";
    import { bindRawPointer, equalRawPointer, hashRawPointer } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import { bindRawPointer as localBindRawPointer } from "./local.js";

    type Address = RawPointer;
    const identity = {};
    const first = bindRawPointer(identity); const second = lang.bindRawPointer(identity);
    const equal = equalRawPointer(first, second);
    const hash = hashRawPointer(first);
    localBindRawPointer(identity);
  `, {
    "/src/local.ts": "export function bindRawPointer(identity: object): object { return identity; }",
  });

  assert.equal(
    getSourceFact(session, typeAliasType(session, sourceFile, "Address"), rawPointerFactKey)?.representation,
    "opaque-identity",
  );
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "bindRawPointer"), rawPointerOperationFactKey)?.operation, "bind-raw-pointer");
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.bindRawPointer"), rawPointerOperationFactKey)?.operation, "bind-raw-pointer");
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "equalRawPointer"), rawPointerOperationFactKey)?.operation, "equal-raw-pointer");
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "hashRawPointer"), rawPointerOperationFactKey)?.operation, "hash-raw-pointer");
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "localBindRawPointer"), rawPointerOperationFactKey), undefined);
});

test("source-core does not attach type marker facts to shadowed generic type names", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import type { bool, FunctionPointer as callback, int32, Pointer as pointer } from "@tsonic/core/types.js";
    import type * as coreTypes from "@tsonic/core/types.js";

    function shadowPointer<pointer>(): pointer<int32> { throw new Error("shadowed pointer"); }
    function shadowCallback<callback>(): callback<[int32], bool> { throw new Error("shadowed callback"); }
    function shadowNamespacePointer<coreTypes>(): coreTypes.Pointer<int32> { throw new Error("shadowed namespace pointer"); }
    function shadowNamespaceCallback<coreTypes>(): coreTypes.FunctionPointer<[int32], bool> { throw new Error("shadowed namespace callback"); }
  `);

  const diagnostics = definedDiagnostics(session.getDiagnostics("semantic", sourceFile));
  assert.ok(diagnostics.length > 0);
  session.ensureBound();
  assert.equal(getSourceFact(session, typeReference(session, sourceFile, "pointer"), pointerFactKey), undefined);
  assert.equal(getSourceFact(session, typeReference(session, sourceFile, "callback"), functionPointerFactKey), undefined);
  assert.equal(getSourceFact(session, typeReference(session, sourceFile, "coreTypes.Pointer"), pointerFactKey), undefined);
  assert.equal(getSourceFact(session, typeReference(session, sourceFile, "coreTypes.FunctionPointer"), functionPointerFactKey), undefined);
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

function sourceCoreTypeMarkerExportFacts(): readonly {
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

function sourceCoreLangExportFacts(): readonly {
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

function createCleanSourceCoreSession(sourceText: string, extraFiles: Readonly<Record<string, string>> = {}): {
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

function assertSourcePrimitive(
  session: CompilerSession,
  node: Node,
  expected: SourcePrimitiveFact,
  identity: string,
): void {
  const fact = sourceFacts(session).getFact(node, sourcePrimitiveFactKey);
  assert.deepEqual(fact, expected);
  assert.equal(sourceFacts(session).getFact(node, canonicalIdentityFactKey)?.id, identity);
}

function argumentMode(session: CompilerSession, call: Node) {
  return sourceFacts(session).getFact(call, argumentPassingFactKey)?.mode;
}

function flowState(session: CompilerSession, node: Node) {
  return sourceFacts(session).getFact(node, flowStateFactKey)?.state;
}

function assertAttributeApplication(
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

function callExpression(session: CompilerSession, sourceFile: SourceFile, calleeText: string, occurrence = 0): Node {
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

function propertyCallExpression(session: CompilerSession, sourceFile: SourceFile, propertyName: string, occurrence = 0): Node {
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

function firstCallArgument(session: CompilerSession, call: Node): Node {
  const argument = sourceAst(session).arguments(call)[0];
  assert.ok(argument !== undefined);
  return argument;
}

function typeReference(session: CompilerSession, sourceFile: SourceFile, nameText: string, occurrence = 0): Node {
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

function typeAliasType(session: CompilerSession, sourceFile: SourceFile, aliasName: string): Node {
  const found = findNode(sourceFile, sourceAst(session), (node, ast) =>
    ast.is.IsTypeAliasDeclaration(node) && ast.text(ast.name(node)) === aliasName);
  const type = sourceAst(session).as.AsTypeAliasDeclaration(found)?.Type;
  assert.ok(type !== undefined, `Missing type alias '${aliasName}'.`);
  return type;
}

function variableDeclaration(session: CompilerSession, sourceFile: SourceFile, variableName: string): Node {
  const found = findNode(sourceFile, sourceAst(session), (node, ast) =>
    ast.is.IsVariableDeclaration(node) && ast.text(ast.name(node)) === variableName);
  assert.ok(found !== undefined, `Missing variable declaration '${variableName}'.`);
  return found;
}

function variableInitializer(session: CompilerSession, sourceFile: SourceFile, variableName: string): Node {
  const initializer = sourceAst(session).as.AsVariableDeclaration(variableDeclaration(session, sourceFile, variableName))?.Initializer;
  assert.ok(initializer !== undefined, `Missing variable initializer '${variableName}'.`);
  return initializer;
}

function typeReferenceName(session: CompilerSession, node: Node | undefined): string {
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

function nodeFactSubject(subject: object | undefined): Node | undefined {
  return typeof (subject as Node | undefined)?.Kind === "number" ? subject as Node : undefined;
}

function sourceCoreFacts(session: CompilerSession) {
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

function checkSource(session: CompilerSession): CheckedSourceProgram {
  const existing = checkedSources.get(session);
  if (existing !== undefined) {
    return existing;
  }
  const checked = session.checkSource();
  checkedSources.set(session, checked);
  return checked;
}

function sourceAst(session: CompilerSession): AstReader {
  return checkSource(session).ast;
}

function sourceFacts(session: CompilerSession): ReadonlySourceFactResolver {
  const facts = checkSource(session).sourceFacts;
  assert.ok(facts !== undefined, "Expected finalized source facts.");
  return facts;
}

function getSourceFact<T>(
  session: CompilerSession,
  subject: ExtensionFactSubject | undefined,
  key: ExtensionFactKey<T>,
): T | undefined {
  return sourceFacts(session).getFact(subject, key);
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

function numberSort(left: number | undefined, right: number | undefined): number {
  return (left ?? 0) - (right ?? 0);
}
