import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDiagnostics, pointerOperationFactKey, providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import { tsonicCoreLangModule, tsonicCoreTypesModule } from "../identity.js";
import { tsonicSafetyBuilderFactKey } from "../safety/facts.js";
import { sourceSafetySignatureIds } from "../safety/declarations.js";
import { createTsonicCoreVirtualModulesProvider } from "./virtual-modules.js";
import {
  assertProviderDeclarationModel, assertVirtualModuleResolution, callExpression, checkSource,
  createCleanSourceCoreSession, createSourceCoreSession, definedDiagnostics, getSourceFact, propertyCallExpression, sourceAst,
} from "./source-extension.fixtures.js";

const renamedOperations = {
  writeOnlyRef: "writeonlyref", readWriteRef: "readwriteref", readOnlyRef: "readonlyref",
  sharedBorrow: "sharedborrow", mutableBorrow: "mutableborrow", defaultValue: "defaultvalue",
  comptimeIf: "comptimeif", addressOf: "addressof", allocatePointer: "allocateptr",
  loadPointer: "loadptr", storePointer: "storeptr", equalPointer: "equalptr",
  hashPointer: "hashptr", bindPointer: "bindptr", projectPointer: "projectptr",
  viewPointer: "viewptr", equalRawPointer: "equalrawptr", hashRawPointer: "hashrawptr",
  loadNativePointer: "loadnativeptr", storeNativePointer: "storenativeptr", offsetNativePointer: "offsetnativeptr",
  toRawPointer: "torawptr", reinterpretRawPointer: "reinterpretrawptr", offsetRawPointer: "offsetrawptr",
  rawPointerToAddressInteger: "rawptrtoaddressinteger", addressIntegerToRawPointer: "addressintegertorawptr",
  memoryLayout: "memorylayout", memoryArrayLayout: "memoryarraylayout", memoryField: "memoryfield",
  bindMemoryField: "bindmemoryfield", bindMemoryRecord: "bindmemoryrecord", sizeOf: "sizeof",
  alignOf: "alignof", strideOf: "strideof", fieldOffsetOf: "fieldoffsetof", keepAlive: "keepalive",
  unsafeContext: "unsafecontext",
} as const;
const unchangedOperations = ["move", "struct", "field", "attribute", "comptime", "unroll", "safety"] as const;

function declarationModel(moduleSpecifier: string) {
  const provider = createTsonicCoreVirtualModulesProvider();
  return assertProviderDeclarationModel(provider.getDeclarationModel(
    assertVirtualModuleResolution(provider.resolveModule(moduleSpecifier, {})),
    { context: {}, materialization: { kind: "complete" } },
  ), moduleSpecifier);
}

test("core has exactly the locked 37 replacements and seven unchanged operations, without aliases", () => {
  assert.equal(Object.keys(renamedOperations).length, 37);
  assert.equal(unchangedOperations.length, 7);
  const declarations = declarationModel(tsonicCoreLangModule).exports.filter(entry => entry.kind === "function");
  const expected = [...Object.values(renamedOperations), ...unchangedOperations].sort();
  assert.deepEqual(declarations.map(entry => entry.name).sort(), expected);
  assert.equal(new Set(expected).size, 44);
  for (const declaration of declarations) {
    assert.equal(declaration.id, declaration.name);
    assert.match(declaration.name, /^[a-z]+$/u);
    assert.equal(declaration.name.includes("pointer"), false);
    assert.ok(declaration.signatures?.length);
    for (const signature of declaration.signatures ?? []) {
      assert.ok(signature.id.startsWith(`${declaration.name}<`) || signature.id.startsWith(`${declaration.name}(`));
    }
  }
  const types = declarationModel(tsonicCoreTypesModule).exports;
  for (const name of ["Pointer", "RawPointer", "NativePointer", "FunctionPointer", "FixedArray",
    "DataLayout", "MemoryLayout", "MemoryFieldLayout", "MemoryFieldBinding", "nativeInt", "nativeUint"]) {
    assert.equal(types.filter(entry => entry.name === name && entry.id === name).length, 1, name);
  }
  assert.equal(types.some(entry => entry.name === "ptr" || entry.name === "pointer" || entry.name === "nativeint"), false);
});

for (const form of ["named", "alias", "namespace"] as const) {
  test(`all superseded operation exports reject through ${form} access`, () => {
    const names = Object.keys(renamedOperations);
    const source = form === "namespace"
      ? `import * as core from "@tsonic/core/lang.js"; ${names.map(name => `core.${name};`).join("\n")}`
      : `import { ${names.map(name => form === "alias" ? `${name} as removed_${name}` : name).join(", ")} } from "@tsonic/core/lang.js";`;
    const { session } = createSourceCoreSession(source);
    const diagnostics = definedDiagnostics(checkSource(session).diagnostics);
    assert.equal(diagnostics.length, names.length);
    const formatted = formatDiagnostics(diagnostics, "/src");
    for (const name of names) assert.ok(formatted.includes(`'${name}'`), name);
  });
}

test("canonical operations remain import-only intrinsics, not local-barrel exports", () => {
  const names = [...Object.values(renamedOperations), ...unchangedOperations];
  const { session } = createSourceCoreSession(`export { ${names.join(", ")} } from "@tsonic/core/lang.js";`);
  const checked = checkSource(session);
  assert.deepEqual(definedDiagnostics(checked.diagnostics), []);
  assert.deepEqual(checked.extensionDiagnostics.map(diagnostic => diagnostic.extensionCode), ["SOURCE_SEMANTICS_CORE_REEXPORT_UNSUPPORTED"]);
});

test("authored aliases keep their case while exact calls retain the new canonical declaration identity", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { allocateptr as allocatePointer, loadptr as loadPointer, storeptr as storePointer } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    import type { Pointer, uint32 } from "@tsonic/core/types.js";
    const someValue: Pointer<uint32> = allocatePointer<uint32>(7);
    const copyValue = loadPointer(someValue);
    storePointer(someValue, copyValue);
    core.storeptr(someValue, core.loadptr(someValue));
  `);
  const queries = checkSource(session).getSourceFileQueries(sourceFile);
  for (const [callee, name, operation] of [
    ["allocatePointer", "allocateptr", "allocate"], ["loadPointer", "loadptr", "load"],
    ["storePointer", "storeptr", "store"], ["core.loadptr", "loadptr", "load"], ["core.storeptr", "storeptr", "store"],
  ] as const) {
    const call = callExpression(session, sourceFile, callee);
    const selection = queries.checker.getResolvedCallInfo(call);
    assert.ok(selection?.outcome === "applicable");
    const declaration = queries.checker.getSignatureDeclaration(selection.selectedSignature);
    const identity = getSourceFact(session, declaration, providerVirtualDeclarationFactKey);
    assert.equal(identity?.exportId, name);
    assert.ok(identity?.signatureId?.startsWith(`${name}<`));
    assert.equal(getSourceFact(session, call, pointerOperationFactKey)?.operation, operation);
    const expression = sourceAst(session).as.AsCallExpression(call)?.Expression;
    assert.equal(sourceAst(session).text(sourceAst(session).name(expression) ?? expression), callee.split(".").at(-1));
  }
});

test("ordinary old, new and native-underscore names do not acquire compiler operation facts", () => {
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { loadPointer, loadptr, native_load } from "./native.js";
    const copyValue = loadPointer(1);
    loadptr(copyValue);
    native_load(copyValue);
  `, { "/src/native.ts": `
    export function loadPointer(value: number): number { return value; }
    export function loadptr(value: number): number { return value; }
    export function native_load(value: number): number { return value; }
  ` });
  for (const name of ["loadPointer", "loadptr", "native_load"]) {
    const call = callExpression(session, sourceFile, name);
    assert.equal(getSourceFact(session, call, pointerOperationFactKey), undefined);
    assert.equal(sourceAst(session).text(sourceAst(session).as.AsCallExpression(call)?.Expression), name);
  }
});

test("requiresunsafe is the sole safety terminal spelling on both builders", () => {
  const model = declarationModel(tsonicCoreLangModule);
  for (const [name, signature] of [
    ["__TsonicSafetyBuilder", sourceSafetySignatureIds.requiresUnsafe],
    ["__TsonicSafetyMemberBuilder", sourceSafetySignatureIds.memberRequiresUnsafe],
  ] as const) {
    const builder = model.exports.find(entry => entry.name === name);
    const terminal = builder?.members?.find(member => member.name === "requiresunsafe");
    assert.ok(terminal);
    assert.equal(terminal.id, signature);
    assert.equal(terminal.signatures?.[0]?.id, `${name}.requiresunsafe`);
    assert.equal(builder?.members?.some(member => member.name === "requiresUnsafe"), false);
  }
  const { session, sourceFile } = createCleanSourceCoreSession(`
    import { safety as declareSafety } from "@tsonic/core/lang.js";
    import * as core from "@tsonic/core/lang.js";
    interface Worker { execute(): void; value: number; }
    declareSafety<Worker>().requiresunsafe();
    core.safety<Worker>().method(worker => worker.execute).requiresunsafe();
  `);
  for (const index of [0, 1]) {
    const fact = getSourceFact(session, propertyCallExpression(session, sourceFile, "requiresunsafe", index), tsonicSafetyBuilderFactKey);
    assert.ok(fact?.kind === "application");
    assert.equal(fact.contract, "requires-unsafe");
  }
  const removed = createSourceCoreSession(`
    import { safety } from "@tsonic/core/lang.js";
    interface Worker { execute(): void }
    safety<Worker>().requiresUnsafe();
    safety<Worker>().method(worker => worker.execute).requiresUnsafe();
  `);
  const diagnostics = definedDiagnostics(checkSource(removed.session).diagnostics);
  assert.equal(diagnostics.length, 2);
  assert.match(formatDiagnostics(diagnostics, "/src"), /requiresUnsafe/u);
});
