import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics } from "@tsonic/tsts";
import type { Node } from "@tsonic/tsts";
import {
  argumentPassingFactKey,
  flowStateFactKey,
  functionPointerFactKey,
  pointerFactKey,
  sourcePrimitiveFactKey,
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
  tsonicAttributeBuilderFactKey,
  createSourceCoreSession,
  createCleanSourceCoreSession,
  argumentMode,
  flowState,
  assertAttributeApplication,
  callExpression,
  propertyCallExpression,
  firstCallArgument,
  typeReference,
  variableDeclaration,
  variableInitializer,
  typeReferenceName,
  sourceCoreFacts,
  checkSource,
  sourceAst,
  getSourceFact,
  definedDiagnostics,
  numberSort,
} from "./source-extension.fixtures.js";

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
