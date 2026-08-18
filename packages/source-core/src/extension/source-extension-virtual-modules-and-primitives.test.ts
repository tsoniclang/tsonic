import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node } from "@tsonic/tsts";
import {
  functionPointerFactKey,
  pointerFactKey,
  sourcePrimitiveFactKey,
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
  createTsonicCoreVirtualModulesProvider,
  expectedSourceCorePrimitiveFacts,
  expectedSourceCoreLangIntrinsics,
  expectedSourceCoreTypeMarkers,
  assertVirtualModuleResolution,
  assertProviderDeclarationModel,
  assertExtensionDiagnostic,
  sourceCorePrimitiveExportFacts,
  sourceCoreTypeMarkerExportFacts,
  sourceCoreLangExportFacts,
  createCleanSourceCoreSession,
  assertSourcePrimitive,
  argumentMode,
  flowState,
  assertAttributeApplication,
  callExpression,
  propertyCallExpression,
  typeAliasType,
  typeReferenceName,
  nodeFactSubject,
  sourceCoreFacts,
  getSourceFact,
} from "./source-extension.fixtures.js";

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
  assert.deepEqual(declarationModel.exports.map((entry) => entry.name).filter((name) => !name.startsWith("__Tsonic")), [
    "loadNativePointer",
    "storeNativePointer",
    "offsetNativePointer",
    "unsafeContext",
    "safety",
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
    "NativePointer",
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
