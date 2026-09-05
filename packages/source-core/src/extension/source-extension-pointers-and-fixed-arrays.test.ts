import assert from "node:assert/strict";
import { test } from "node:test";
import {
  functionPointerFactKey,
  pointerFactKey,
  pointerOperationFactKey,
  rawPointerFactKey,
  rawPointerOperationFactKey,
  tsonicFixedArrayFactKey,
  createSourceCoreSession,
  createCleanSourceCoreSession,
  callExpression,
  typeReference,
  typeAliasType,
  typeReferenceName,
  nodeFactSubject,
  checkSource,
  sourceAst,
  getSourceFact,
  definedDiagnostics,
} from "./source-extension.fixtures.js";

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

test("source-core records exact fixed-array element and length facts without spelling inference", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { FixedArray as fixed, uint8 } from "@tsonic/core/types.js";
    import type * as coreTypes from "@tsonic/core/types.js";
    import type { FixedArray as localFixedArray } from "./local.js";

    type FixedArray<T, N extends number> = readonly T[];
    type Direct = fixed<uint8, 4>;
    type Namespace = coreTypes.FixedArray<uint8, 0x08>;
    type Local = localFixedArray<uint8, 4>;
    type Shadow = FixedArray<uint8, 4>;
  `, {
    "/src/local.ts": "export type FixedArray<T, N extends number> = readonly T[];",
  });

  const direct = getSourceFact(
    session,
    typeReference(session, sourceFile, "fixed"),
    tsonicFixedArrayFactKey,
  );
  assert.equal(direct?.length, 4);
  assert.equal(typeReferenceName(session, direct?.elementType), "uint8");

  const namespace = getSourceFact(
    session,
    typeReference(session, sourceFile, "coreTypes.FixedArray"),
    tsonicFixedArrayFactKey,
  );
  assert.equal(namespace?.length, 8);
  assert.equal(typeReferenceName(session, namespace?.elementType), "uint8");

  assert.equal(getSourceFact(
    session,
    typeReference(session, sourceFile, "localFixedArray"),
    tsonicFixedArrayFactKey,
  ), undefined);
  assert.equal(getSourceFact(
    session,
    typeReference(session, sourceFile, "FixedArray"),
    tsonicFixedArrayFactKey,
  ), undefined);
});

test("source-core rejects non-literal and invalid fixed-array lengths", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import type { FixedArray, uint8 } from "@tsonic/core/types.js";

    type Open = FixedArray<uint8, number>;
    type Negative = FixedArray<uint8, -1>;
    type Fractional = FixedArray<uint8, 1.5>;
    type UnsafeInteger = FixedArray<uint8, 9007199254740992>;
  `);

  const diagnostics = definedDiagnostics(checkSource(session).extensionDiagnostics);
  assert.equal(diagnostics.length, 4);
  assert.ok(diagnostics.every((diagnostic) =>
    diagnostic.extensionCode === "SOURCE_CORE_FIXED_ARRAY_LENGTH_NOT_LITERAL"));
  assert.equal(getSourceFact(
    session,
    typeReference(session, sourceFile, "FixedArray", 0),
    tsonicFixedArrayFactKey,
  ), undefined);
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

test("source-core exposes raw-pointer equality and hash facts without spelling inference", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import type { RawPointer } from "@tsonic/core/types.js";
    import { equalRawPointer, hashRawPointer } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import { equalRawPointer as localEqualRawPointer } from "./local.js";

    type Address = RawPointer;
    declare const first: RawPointer;
    declare const second: RawPointer;
    const equal = equalRawPointer(first, second);
    const namespaced = lang.equalRawPointer(first, second);
    const hash = hashRawPointer(first);
    localEqualRawPointer(first, second);
  `, {
    "/src/local.ts": "export function equalRawPointer(left: object, right: object): boolean { return left === right; }",
  });

  assert.equal(
    getSourceFact(session, typeAliasType(session, sourceFile, "Address"), rawPointerFactKey)?.representation,
    "opaque-identity",
  );
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "equalRawPointer"), rawPointerOperationFactKey)?.operation, "equal-raw-pointer");
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "lang.equalRawPointer"), rawPointerOperationFactKey)?.operation, "equal-raw-pointer");
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "hashRawPointer"), rawPointerOperationFactKey)?.operation, "hash-raw-pointer");
  assert.equal(getSourceFact(session, callExpression(session, sourceFile, "localEqualRawPointer"), rawPointerOperationFactKey), undefined);
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
