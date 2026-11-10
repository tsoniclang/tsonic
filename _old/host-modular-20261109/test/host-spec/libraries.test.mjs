import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test, { before } from "node:test";
import { orderedDomain } from "./runner/assertions.mjs";
import { withSpecProject } from "./runner/project.mjs";
import { inspectHostStructure } from "../architecture/tooling/host-gates.mjs";
import { compileHostModuleInIsolation } from "../scripts/host-isolated.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const directory = "packages/host/src/libraries/";
const expectedFiles = ["base-text.ts", "contract.ts", "core-attributes.ts", "core-comptime.ts", "core-markers.ts",
  "core-memory.ts", "core-primitives.ts", "core-safety.ts", "core.ts", "identities.ts", "js-capabilities.ts",
  "js-globals.ts", "js-regexp.ts", "js-string.ts", "js.ts", "register.ts"];
const expectedModules = ["@tsonic/core/types.js", "@tsonic/core/lang.js", "@tsonic/js/types.js", "@tsonic/js/lang.js"];
const primitivePairs = [["bool", "bool"], ["char", "char"], ["int8", "int8"], ["uint8", "uint8"],
  ["int16", "int16"], ["uint16", "uint16"], ["int32", "int32"], ["uint32", "uint32"],
  ["int64", "int64"], ["uint64", "uint64"], ["int128", "int128"], ["uint128", "uint128"],
  ["nativeInt", "native-int"], ["nativeUint", "native-uint"], ["float16", "float16"],
  ["float32", "float32"], ["float64", "float64"], ["decimal", "decimal"]];
const markerPairs = [["Pointer", "pointer"], ["RawPointer", "raw-pointer"], ["FunctionPointer", "function-pointer"],
  ["FixedArray", "fixed-array"], ["writeonlyref", "write-only-reference"], ["readwriteref", "read-write-reference"],
  ["readonlyref", "read-only-reference"], ["sharedborrow", "shared-borrow"], ["mutableborrow", "mutable-borrow"],
  ["move", "move"], ["struct", "struct"], ["field", "field"], ["attribute", "attribute"],
  ["defaultvalue", "default-value"], ["addressof", "address-of"], ["allocateptr", "allocate"], ["loadptr", "load"],
  ["storeptr", "store"], ["equalptr", "equal-pointer"], ["hashptr", "hash-pointer"], ["bindptr", "bind-pointer"],
  ["projectptr", "project-pointer"], ["equalrawptr", "equal-raw-pointer"], ["hashrawptr", "hash-raw-pointer"]];
const expectedTypes = ["DataLayout", "MemoryLayout", "MemoryFieldLayout", "MemoryFieldBinding", "NativePointer",
  ...primitivePairs.map(([name]) => name), "Pointer", "RawPointer", "FunctionPointer", "FixedArray"];
const expectedCalls = ["__TsonicAttributeBuilder", "__TsonicAttributeMemberBuilder", "__TsonicMemoryLayoutDescriptor",
  "__TsonicMemoryArrayLayoutDescriptor", "__TsonicMemoryFieldDescriptor", "torawptr", "reinterpretrawptr", "offsetrawptr",
  "rawptrtoaddressinteger", "addressintegertorawptr", "memorylayout", "memoryarraylayout", "memoryfield", "bindmemoryfield",
  "bindmemoryrecord", "sizeof", "alignof", "strideof", "fieldoffsetof", "keepalive", "viewptr", "comptime", "comptimeif",
  "unroll", "loadnativeptr", "storenativeptr", "offsetnativeptr", "unsafecontext", "safety", "__TsonicSafetyBuilder",
  "__TsonicSafetyMemberBuilder", ...markerPairs.slice(4).map(([name]) => name)];
let sourceLibraries;

before(async () => {
  const inputs = sourceInputs();
  const parent = resolve(repository, ".temp/libraries-runtime");
  mkdirSync(parent, { recursive: true });
  const runtime = mkdtempSync(resolve(parent, "current-"));
  const result = spawnSync(resolve(repository, "node_modules/.bin/tsgo"), ["--ignoreConfig", "--strict",
    "--noUncheckedIndexedAccess", "--exactOptionalPropertyTypes", "--skipLibCheck", "false", "--noUnusedLocals",
    "--noUnusedParameters", "--noImplicitReturns", "--noFallthroughCasesInSwitch", "--noEmitOnError",
    "--module", "nodenext", "--target", "es2020", "--types", "node", "--rootDir", "packages/host/src", "--outDir", runtime,
    ...inputs.libraries, ...inputs.model], { cwd: repository, encoding: "utf8", timeout: 60000, maxBuffer: 131072 });
  assert.equal(result.error === undefined, true, "current complete Libraries compiler starts");
  assert.equal(result.signal, null); assert.equal(result.stderr, "");
  assert.equal(result.status, 0, result.stdout.slice(0, 8192));
  writeFileSync(resolve(repository, ".temp/libraries-current-runtime.txt"), runtime);
  ({ sourceLibraries } = await import(pathToFileURL(resolve(runtime, "libraries/register.js")).href));
});

function domain(actual, expected, label) {
  orderedDomain(actual, expected, Object.is, label);
}

function fields(value, expected, label) {
  domain(Object.keys(value).sort(), [...expected].sort(), label);
}

function absent(value, label) {
  assert.deepEqual(value, { kind: "none" }, label);
}

function allFrozen(value, active = new Set()) {
  assert.notEqual(typeof value, "function", "recipes never contain executable callbacks");
  if (value === null || typeof value !== "object" || active.has(value)) return;
  active.add(value);
  assert.equal(Object.isFrozen(value), true, "every reachable own record/vector is frozen");
  assert.equal(Object.getPrototypeOf(value), Array.isArray(value) ? Array.prototype : Object.prototype);
  assert.equal(value instanceof Map || value instanceof Set, false, "no mutable collection backing");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const [name, descriptor] of Object.entries(descriptors)) {
    assert.equal("value" in descriptor, true, `own data descriptor ${name}`);
    assert.equal(descriptor.get, undefined);
    assert.equal(descriptor.set, undefined);
    allFrozen(descriptor.value, active);
  }
}

function recipe(type) {
  switch (type.kind) {
    case "source-primitive": fields(type, ["kind", "name"], "primitive fields"); return type.name;
    case "type-parameter": fields(type, ["kind", "name"], "parameter type fields"); return `$${type.name}`;
    case "source-global":
      fields(type, ["kind", "name", "typeArguments"], "global reference fields");
      return `${type.name}<${type.typeArguments.map(recipe).join(",")}>`;
    case "provider-ref": {
      fields(type, ["kind", "moduleSpecifier", "exportName", "localName", "namespaceImport", "typeArguments"], "provider fields");
      absent(type.localName, "no invented local alias"); absent(type.namespaceImport, "no invented namespace alias");
      return `${type.moduleSpecifier === "@tsonic/core/types.js" ? "core" : type.moduleSpecifier === "@tsonic/core/lang.js"
        ? "lang" : type.moduleSpecifier === "@tsonic/js/types.js" ? "js" : type.moduleSpecifier}:${type.exportName}<${type.typeArguments.map(recipe).join(",")}>`;
    }
    case "function":
      fields(type, ["kind", "id", "parameters", "returnType", "typeParameters"], "function recipe fields");
      return `${type.id}${binders(type.typeParameters)}(${type.parameters.map(parameterRecipe).join(",")})->${recipe(type.returnType)}`;
    case "array": fields(type, ["kind", "elementType"], "array recipe fields"); return `Array<${recipe(type.elementType)}>`;
    case "union": fields(type, ["kind", "types"], "union recipe fields"); return `(${type.types.map(recipe).join("|")})`;
    case "literal": fields(type, ["kind", "value"], "literal fields"); return JSON.stringify(type.value);
    default:
      assert.equal(["any", "unknown", "void", "never", "undefined", "boolean", "string", "number", "bigint", "object"].includes(type.kind), true);
      fields(type, ["kind"], "atomic recipe fields"); return type.kind;
  }
}

function binders(parameters) {
  return `<${parameters.map(parameter => {
    fields(parameter, ["name", "constraints", "defaultType", "variance"], "full binder record");
    assert.equal(parameter.variance, "invariant"); absent(parameter.defaultType, "original unspecified binder default");
    return `${parameter.name}${parameter.constraints.length ? `:${parameter.constraints.map(recipe).join("&")}` : ""}`;
  }).join(",")}>`;
}

function parameterRecipe(parameter) {
  fields(parameter, ["name", "type", "passingMode", "optional", "rest", "defaultType"], "full formal record");
  assert.equal(parameter.passingMode, "by-value"); absent(parameter.defaultType, "no fabricated initializer/default type");
  assert.equal(typeof parameter.optional, "boolean"); assert.equal(typeof parameter.rest, "boolean");
  return `${parameter.rest ? "..." : ""}${parameter.name}${parameter.optional ? "?" : ""}:${recipe(parameter.type)}`;
}

function head(signature) {
  fields(signature, ["id", "name", "accessibility", "parameters", "returnType", "typeParameters", "documentation"], "complete signature");
  assert.equal(signature.accessibility, "public"); absent(signature.documentation, "original signature documentation");
  assert.equal(signature.returnType.kind, "present", "actual original result exists");
  return `${signature.id}|${signature.name.kind === "present" ? signature.name.value : "-"}|${binders(signature.typeParameters)}(${signature.parameters.map(parameterRecipe).join(",")})->${recipe(signature.returnType.value)}`;
}

function declarationShape(value) {
  fields(value, ["id", "name", "exportName", "exportKind", "kind", "typeFamily", "type", "typeParameters", "heritage",
    "members", "signatures", "documentation"], "complete declaration fields");
  assert.equal(value.name, value.id); assert.equal(value.exportName, value.id); assert.equal(value.exportKind, "named");
  absent(value.typeFamily, "original type family"); absent(value.documentation, "original declaration documentation");
  assert.deepEqual(value.heritage, []);
  return { id: value.id, kind: value.kind, binders: binders(value.typeParameters),
    type: value.type.kind === "present" ? recipe(value.type.value) : "-",
    members: value.members.map(member => {
      fields(member, ["id", "name", "kind", "static", "readonly", "optional", "type", "signatures", "documentation"], "full member record");
      assert.equal(member.static, false); assert.equal(member.optional, false); absent(member.documentation, "original member documentation");
      return { id: member.id, name: member.name, kind: member.kind, readonly: member.readonly,
        type: member.type.kind === "present" ? recipe(member.type.value) : "-", signatures: member.signatures.map(head) };
    }), signatures: value.signatures.map(head) };
}

const expectedHead = (id, parameters, result, typeParameters = "<>", name = "-") =>
  `${id}|${name}|${typeParameters}(${parameters})->${result}`;
const expectedProperty = (id, name, type, readonly = true) => ({ id, name, kind: "property", readonly, type, signatures: [] });
const expectedMethod = (id, name, signatures, kind = "method", readonly = false) =>
  ({ id, name, kind, readonly, type: "-", signatures });
const expectedDeclaration = (id, kind, binders = "<>", members = [], signatures = [], type = "-") =>
  ({ id, kind, binders, type, members, signatures });
const expectedFunction = (name, signatures) => expectedDeclaration(name, "function", "<>", [], signatures);

function expectedCatalogue() {
  const definitions = new Map();
  const define = value => definitions.set(value.id, value);
  for (const name of ["DataLayout", "MemoryLayout", "MemoryFieldLayout", "MemoryFieldBinding"]) {
    define(expectedDeclaration(name, "interface", name === "DataLayout" ? "<>" : "<T>", [expectedProperty(`${name}.brand`,
      `__tsonic${name}`, name === "DataLayout" ? '"DataLayout"' : `${name}.brand<>(value:$T)->$T`)]));
  }
  define(expectedDeclaration("NativePointer", "interface", "<T>", [expectedProperty("NativePointer.__tsonicNativePointer",
    "__tsonicNativePointer", "NativePointer.__tsonicNativePointer<>(value:$T)->$T")]));
  for (const [name, primitive] of primitivePairs) define(expectedDeclaration(name, "type", "<>", [], [], primitive));
  for (const [name, binders, input, output] of [["Pointer", "<T>", "$T", "$T"],
    ["RawPointer", "<>", '"RawPointer"', '"RawPointer"'], ["FunctionPointer", "<TArgs,TReturn>", "$TArgs", "$TReturn"]]) {
    define(expectedDeclaration(name, "interface", binders, [expectedProperty(`${name}.__tsonicSourceType`,
      "__tsonicSourceType", `${name}.__tsonicSourceType<>(value:${input})->${output}`)]));
  }
  define(expectedDeclaration("FixedArray", "interface", "<T,TLength:(number|bigint)>", [
    expectedMethod("FixedArray.index", "index", [expectedHead("FixedArray.index(number)", "index:int32", "$T")], "indexer"),
    expectedProperty("FixedArray.length", "length", "int32"),
    expectedMethod("FixedArray.iterator", { kind: "well-known-symbol", name: "iterator" }, [expectedHead("FixedArray.iterator()", "", "Iterator<$T>")]),
  ]));
  const attributeMember = "lang:__TsonicAttributeMemberBuilder<$TOwner>";
  const selector = (owner, name, result) => expectedMethod(`${owner}.${name}`, name, [expectedHead(`${owner}.${name}`,
    `selector:${owner}.${name}.selector<>(target:$TOwner)->unknown`, result, "<>", name)]);
  const application = owner => expectedMethod(`${owner}.add`, "add", [expectedHead(`${owner}.add`,
    `invocation:${owner}.add.invocation<>()->unknown`, "void", "<>", "add")]);
  define(expectedDeclaration("__TsonicAttributeBuilder", "interface", "<TOwner>", [application("__TsonicAttributeBuilder"),
    selector("__TsonicAttributeBuilder", "property", attributeMember), selector("__TsonicAttributeBuilder", "method", attributeMember),
    expectedProperty("__TsonicAttributeBuilder.constructor", "constructor", `__TsonicAttributeBuilder.constructor()<>()->${attributeMember}`, false)]));
  define(expectedDeclaration("__TsonicAttributeMemberBuilder", "interface", "<TOwner>", [application("__TsonicAttributeMemberBuilder"),
    expectedMethod("__TsonicAttributeMemberBuilder.parameter", "parameter", [expectedHead("__TsonicAttributeMemberBuilder.parameter", "name:string", attributeMember, "<>", "parameter")]),
    expectedMethod("__TsonicAttributeMemberBuilder.target", "target", [expectedHead("__TsonicAttributeMemberBuilder.target", "specifier:string", attributeMember, "<>", "target")]),
    expectedProperty("__TsonicAttributeMemberBuilder.constructor", "constructor", "never")]));
  for (const [name, binders, properties] of [
    ["__TsonicMemoryLayoutDescriptor", "<T>", [["datalayout", "core:DataLayout<>"], ["bytesize", "native-uint"],
      ["bytealignment", "native-uint"], ["stride", "native-uint"], ["fields", "Array<core:MemoryFieldLayout<$T>>"]]],
    ["__TsonicMemoryArrayLayoutDescriptor", "<T,TLength:(number|bigint)>", [["datalayout", "core:DataLayout<>"], ["bytesize", "native-uint"],
      ["bytealignment", "native-uint"], ["stride", "native-uint"], ["elementlayout", "core:MemoryLayout<$T>"], ["length", "$TLength"]]],
    ["__TsonicMemoryFieldDescriptor", "<T,TField>", [["select", "memoryfield.selector<>(value:$T)->$TField"],
      ["byteoffset", "native-uint"], ["bytealignment", "native-uint"], ["fieldlayout", "core:MemoryLayout<$TField>"]]],
  ]) define(expectedDeclaration(name, "interface", binders, properties.map(([key, type]) => expectedProperty(`${name}.${key}`, key, type))));
  const memoryHeads = [
    ["torawptr", "torawptr<T>(pointer,layout)", "pointer:(core:Pointer<$T>|undefined),layout:core:MemoryLayout<$T>", "(core:RawPointer<>|undefined)", "<T>"],
    ["reinterpretrawptr", "reinterpretrawptr<T>(pointer,layout)", "pointer:(core:RawPointer<>|undefined),layout:core:MemoryLayout<$T>", "(core:Pointer<$T>|undefined)", "<T>"],
    ["offsetrawptr", "offsetrawptr<TOffset>(pointer,byteOffset,dataLayout)", "pointer:(core:RawPointer<>|undefined),byteOffset:$TOffset,dataLayout:core:DataLayout<>", "(core:RawPointer<>|undefined)", "<TOffset:(number|bigint)>"],
    ["rawptrtoaddressinteger", "rawptrtoaddressinteger<TAddress>(pointer,dataLayout)", "pointer:(core:RawPointer<>|undefined),dataLayout:core:DataLayout<>", "$TAddress", "<TAddress:(number|bigint)>"],
    ["addressintegertorawptr", "addressintegertorawptr<TAddress>(address,dataLayout)", "address:$TAddress,dataLayout:core:DataLayout<>", "(core:RawPointer<>|undefined)", "<TAddress:(number|bigint)>"],
    ["memorylayout", "memorylayout<T>(descriptor)", "descriptor:lang:__TsonicMemoryLayoutDescriptor<$T>", "core:MemoryLayout<$T>", "<T>"],
    ["memoryarraylayout", "memoryarraylayout<T,TLength>(descriptor)", "descriptor:lang:__TsonicMemoryArrayLayoutDescriptor<$T,$TLength>", "core:MemoryLayout<core:FixedArray<$T,$TLength>>", "<T,TLength:(number|bigint)>"],
    ["memoryfield", "memoryfield<T,TField>(descriptor)", "descriptor:lang:__TsonicMemoryFieldDescriptor<$T,$TField>", "core:MemoryFieldLayout<$T>", "<T,TField>"],
    ["bindmemoryfield", "bindmemoryfield<T,TField>(field,pointer)", "field:core:MemoryFieldLayout<$T>,pointer:core:Pointer<$TField>", "core:MemoryFieldBinding<$T>", "<T,TField>"],
    ["bindmemoryrecord", "bindmemoryrecord<T>(layout,...fields)", "layout:core:MemoryLayout<$T>,...fields:Array<core:MemoryFieldBinding<$T>>", "$T", "<T>"],
    ["sizeof", "sizeof<T>(layout)", "layout:core:MemoryLayout<$T>", "native-uint", "<T>"],
    ["alignof", "alignof<T>(layout)", "layout:core:MemoryLayout<$T>", "native-uint", "<T>"],
    ["strideof", "strideof<T>(layout)", "layout:core:MemoryLayout<$T>", "native-uint", "<T>"],
    ["fieldoffsetof", "fieldoffsetof<T,TField>(layout,select)", "layout:core:MemoryLayout<$T>,select:fieldoffsetof.selector<>(value:$T)->$TField", "native-uint", "<T,TField>"],
    ["keepalive", "keepalive<T>(value)", "value:$T", "void", "<T>"],
    ["loadnativeptr", "loadnativeptr<T>(pointer)", "pointer:core:NativePointer<$T>", "$T", "<T>"],
    ["storenativeptr", "storenativeptr<T>(pointer,value)", "pointer:core:NativePointer<$T>,value:$T", "void", "<T>"],
    ["offsetnativeptr", "offsetnativeptr<T>(pointer,elementOffset)", "pointer:core:NativePointer<$T>,elementOffset:native-int", "core:NativePointer<$T>", "<T>"],
  ];
  for (const [name, id, parameters, result, binders] of memoryHeads) define(expectedFunction(name, [expectedHead(id, parameters, result, binders)]));
  define(expectedFunction("viewptr", [
    expectedHead("viewptr<F,T>(pointer,read,write)", "pointer:core:Pointer<$F>,read:viewptr.required.read<>()->$T,write:viewptr.required.write<>(value:$T)->void", "core:Pointer<$T>", "<F,T>"),
    expectedHead("viewptr<F,T>(pointer?,read,write)", "pointer:(core:Pointer<$F>|undefined),read:viewptr.optional.read<>()->$T,write:viewptr.optional.write<>(value:$T)->void", "(core:Pointer<$T>|undefined)", "<F,T>"),
  ]));
  define(expectedFunction("comptime", [expectedHead("comptime<T>(value)", "value:$T", "$T", "<T>"), expectedHead("comptime<T>()", "", "$T", "<T>")]));
  define(expectedFunction("comptimeif", [expectedHead("comptimeif(condition)", "condition:boolean", "boolean")]));
  define(expectedFunction("unroll", [expectedHead("unroll<T>(iterable)", "iterable:$T", "$T", "<T>")]));
  define(expectedFunction("unsafecontext", [expectedHead("unsafecontext()", "", "void"), expectedHead("unsafecontext<T>(expression)", "expression:$T", "$T", "<T>")]));
  define(expectedFunction("safety", [expectedHead("safety(target)", "target:$TOwner", "lang:__TsonicSafetyBuilder<$TOwner>", "<TOwner>"),
    expectedHead("safety<T>()", "", "lang:__TsonicSafetyBuilder<$TOwner>", "<TOwner>")]));
  const terminal = (owner, name, result = "void") => expectedMethod(`${owner}.${name}`, name, [expectedHead(`${owner}.${name}`, "", result, "<>", name)]);
  const safetyMember = "lang:__TsonicSafetyMemberBuilder<$TOwner>";
  define(expectedDeclaration("__TsonicSafetyBuilder", "interface", "<TOwner>", [terminal("__TsonicSafetyBuilder", "requiresunsafe"),
    terminal("__TsonicSafetyBuilder", "safe"), selector("__TsonicSafetyBuilder", "method", safetyMember),
    selector("__TsonicSafetyBuilder", "property", safetyMember), selector("__TsonicSafetyBuilder", "indexer", safetyMember),
    expectedProperty("__TsonicSafetyBuilder.constructor", "constructor", `__TsonicSafetyBuilder.constructor<>()->${safetyMember}`)]));
  define(expectedDeclaration("__TsonicSafetyMemberBuilder", "interface", "<TOwner>", [terminal("__TsonicSafetyMemberBuilder", "requiresunsafe"),
    terminal("__TsonicSafetyMemberBuilder", "safe"), terminal("__TsonicSafetyMemberBuilder", "getter", safetyMember),
    terminal("__TsonicSafetyMemberBuilder", "setter", safetyMember)]));
  for (const name of ["writeonlyref", "readwriteref", "readonlyref", "sharedborrow", "mutableborrow", "move", "struct"]) {
    define(expectedFunction(name, [expectedHead(`${name}(value)`, "value:$T", "$T", "<T>")]));
  }
  for (const name of ["field", "defaultvalue"]) define(expectedFunction(name, [expectedHead(`${name}<T>()`, "", "$T", "<T>")]));
  define(expectedFunction("attribute", [expectedHead("attribute<T>()", "", "lang:__TsonicAttributeBuilder<$T>", "<T>")]));
  for (const [name, id, parameters, result, binders = "<T>"] of [
    ["addressof", "addressof<T>(storage)", "storage:($T|undefined)", "core:Pointer<$T>"],
    ["allocateptr", "allocateptr<T>(initial)", "initial:$T", "core:Pointer<$T>"],
    ["loadptr", "loadptr<T>(pointer)", "pointer:core:Pointer<$T>", "$T"],
    ["storeptr", "storeptr<T>(pointer,value)", "pointer:core:Pointer<$T>,value:$T", "void"],
    ["equalptr", "equalptr<T>(left,right)", "left:(core:Pointer<$T>|undefined),right:(core:Pointer<$T>|undefined)", "boolean"],
    ["hashptr", "hashptr<T>(pointer)", "pointer:(core:Pointer<$T>|undefined)", "uint32"],
    ["bindptr", "bindptr<T>(identity,read,write)", "identity:object,read:bindptr.read<>()->$T,write:bindptr.write<>(value:$T)->void", "core:Pointer<$T>"],
    ["equalrawptr", "equalrawptr(left,right)", "left:(core:RawPointer<>|undefined),right:(core:RawPointer<>|undefined)", "boolean", "<>"],
    ["hashrawptr", "hashrawptr(pointer)", "pointer:(core:RawPointer<>|undefined)", "uint32", "<>"],
  ]) define(expectedFunction(name, [expectedHead(id, parameters, result, binders)]));
  define(expectedFunction("projectptr", [
    expectedHead("projectptr<F,T>(pointer,fromSource,toSource)", "pointer:core:Pointer<$F>,fromSource:projectptr.defined.fromSource<>(value:$F)->$T,toSource:projectptr.defined.toSource<>(value:$T)->$F", "core:Pointer<$T>", "<F,T>"),
    expectedHead("projectptr<F,T>(pointer?,fromSource,toSource)", "pointer:(core:Pointer<$F>|undefined),fromSource:projectptr.optional.fromSource<>(value:$F)->$T,toSource:projectptr.optional.toSource<>(value:$T)->$F", "(core:Pointer<$T>|undefined)", "<F,T>"),
  ]));
  return definitions;
}

test("all four canonical module identities, original imports, complete export domains and marker roles", () => {
  domain(Object.keys(sourceLibraries), ["core", "js"], "sole catalogue port");
  const modules = [...sourceLibraries.core.modules, ...sourceLibraries.js.modules];
  domain(modules.map(module => module.identity.moduleSpecifier), expectedModules, "all four modules before inspecting contents");
  domain([sourceLibraries.core.id, sourceLibraries.js.id], ["tsonic.source-core", "tsonic.js.source-semantics"], "original library IDs");
  const exports = [expectedTypes, expectedCalls, ["JsString"], ["jsstr"]];
  for (const [index, module] of modules.entries()) {
    const packageName = index < 2 ? "@tsonic/core" : "@tsonic/js";
    assert.deepEqual(module.identity, { providerId: index < 2 ? "tsonic.source-core.virtual-modules" : "tsonic.js.source-virtual-modules",
      providerVersion: "0.0.1", packageName, moduleSpecifier: expectedModules[index], providerModuleId: expectedModules[index] });
    domain(module.exports.map(item => item.id), exports[index], "complete original ordered exports");
    const importedNames = index === 1 ? ["Pointer", "RawPointer", "NativePointer", "DataLayout", "MemoryLayout", "MemoryFieldLayout", "MemoryFieldBinding", "FixedArray"]
      : index === 3 ? ["JsString"] : [];
    assert.deepEqual(module.imports, importedNames.length === 0 ? [] : [{ moduleSpecifier: expectedModules[index - 1],
      defaultImport: { kind: "none" }, namespaceImport: { kind: "none" }, typeOnly: true,
      namedImports: importedNames.map(exportedName => ({ exportedName, kind: "type" })) }]);
    const roles = index === 0 ? [...primitivePairs.map(([name]) => [name, "source-primitive"]), ...markerPairs.slice(0, 4)]
      : index === 1 ? markerPairs.slice(4) : index === 2 ? [["JsString", "js-string"]] : [["jsstr", "js-string"]];
    domain(module.roles.map(item => `${item.identity.exportId}:${item.role}`), roles.map(([name, role]) => `${name}:${role}`), "all original roles");
    for (const item of module.roles) {
      assert.equal(item.identity.module, module.identity, "same canonical module record, not a lookalike");
      absent(item.identity.memberId, "root role member"); absent(item.identity.signatureId, "root role signature");
    }
  }
});

function verifyCore(actual) {
  const expected = expectedCatalogue();
  domain([...expected.keys()].sort(), [...expectedTypes, ...expectedCalls].sort(), "complete independently authored Core expectations");
  domain(actual.map(value => value.id), [...expectedTypes, ...expectedCalls], "complete actual domain before comparison");
  for (const value of actual) assert.deepEqual(declarationShape(value), expected.get(value.id), value.id);
}

test("every Core recipe preserves each member, signature, ordered binder, formal, result, constraint and default", () => {
  verifyCore(sourceLibraries.core.modules.flatMap(module => module.exports));
});

test("all catalogue records and vectors are frozen own data without executable or mutable retained backing", () => {
  allFrozen(sourceLibraries);
  const first = sourceLibraries.core.modules[0].exports[0];
  assert.throws(() => { sourceLibraries.core.modules.push(sourceLibraries.js.modules[0]); }, TypeError);
  assert.throws(() => { first.members[0].readonly = false; }, TypeError);
  assert.throws(() => { sourceLibraries.js = sourceLibraries.core; }, TypeError);
});

test("JsString retains its entire actual member, index and ordered overload domain without native substitution", () => {
  const expectedNames = ["__tsonicJsStringIdentity", "length", "index", "at", "charAt", "charCodeAt", "codePointAt", "concat",
    "endsWith", "includes", "indexOf", "lastIndexOf", "normalize", "padEnd", "padStart", "repeat", "slice", "startsWith",
    "substring", "substr", "toLowerCase", "toUpperCase", "trim", "trimEnd", "trimStart", "toString", "valueOf", "isWellFormed",
    "toWellFormed", "match", "matchAll", "replace", "replaceAll", "search", "split"];
  const expected = [expectedProperty("__tsonicJsStringIdentity", "__tsonicJsStringIdentity", "never"),
    expectedProperty("length", "length", "int32"),
    expectedMethod("index", "index", [expectedHead("index(index)", "index:int32", "js:JsString<>")], "indexer", true)];
  for (const [name, parameters, result] of [
    ["at", "index:int32", "(js:JsString<>|undefined)"], ["charAt", "index:int32", "js:JsString<>"],
    ["charCodeAt", "index:int32", "int32"], ["codePointAt", "pos:int32", "(int32|undefined)"],
    ["concat", "...strings:Array<js:JsString<>>", "js:JsString<>"],
    ["endsWith", "searchString:js:JsString<>,endPosition?:int32", "boolean"],
    ["includes", "searchString:js:JsString<>,position?:int32", "boolean"],
    ["indexOf", "searchString:js:JsString<>,position?:int32", "int32"],
    ["lastIndexOf", "searchString:js:JsString<>,position?:int32", "int32"],
    ["normalize", "form?:string", "js:JsString<>"], ["padEnd", "maxLength:int32,fillString?:js:JsString<>", "js:JsString<>"],
    ["padStart", "maxLength:int32,fillString?:js:JsString<>", "js:JsString<>"], ["repeat", "count:int32", "js:JsString<>"],
    ["slice", "start?:int32,end?:int32", "js:JsString<>"], ["startsWith", "searchString:js:JsString<>,position?:int32", "boolean"],
    ["substring", "start:int32,end?:int32", "js:JsString<>"], ["substr", "from:int32,length?:int32", "js:JsString<>"],
    ["toLowerCase", "", "js:JsString<>"], ["toUpperCase", "", "js:JsString<>"], ["trim", "", "js:JsString<>"],
    ["trimEnd", "", "js:JsString<>"], ["trimStart", "", "js:JsString<>"], ["toString", "", "js:JsString<>"],
    ["valueOf", "", "js:JsString<>"], ["isWellFormed", "", "boolean"], ["toWellFormed", "", "string"],
    ["match", "regexp:RegExp<>", "(JsRegExpMatchArray<>|null)"],
    ["matchAll", "regexp:RegExp<>", "JsRegExpStringIterator<JsRegExpExecArray<>>"],
  ]) {
    const names = parameters === "" ? "" : parameters.split(",").map(item => item.replace(/^\.\.\./u, "").split(":")[0].replace(/\?$/u, "")).join(",");
    expected.push(expectedMethod(name, name, [expectedHead(`${name}(${names})`, parameters, result)]));
  }
  for (const name of ["replace", "replaceAll"]) expected.push(expectedMethod(name, name, [
    expectedHead(`${name}(searchValue,replaceValue)`, "searchValue:(js:JsString<>|RegExp<>),replaceValue:js:JsString<>", "js:JsString<>"),
    expectedHead(`${name}(searchValue,replacer)`, "searchValue:(js:JsString<>|RegExp<>),replacer:JsRegExpReplaceCallback<>", "js:JsString<>"),
  ]));
  expected.push(expectedMethod("search", "search", [expectedHead("search(regexp)", "regexp:RegExp<>", "int32")]));
  expected.push(expectedMethod("split", "split", [
    expectedHead("split(separator,limit)", "separator:js:JsString<>,limit?:number", "Array<js:JsString<>>"),
    expectedHead("split(regexp,limit)", "separator:RegExp<>,limit?:number", "Array<(js:JsString<>|undefined)>"),
  ]));
  domain(expected.map(item => item.id), expectedNames, "complete independent JsString expectations");
  const jsString = sourceLibraries.js.modules[0].exports[0];
  domain(jsString.members.map(item => item.id), expectedNames, "complete actual JsString members before comparisons");
  assert.deepEqual(declarationShape(jsString), expectedDeclaration("JsString", "interface", "<>", expected));
  assert.deepEqual(declarationShape(sourceLibraries.js.modules[1].exports[0]), expectedFunction("jsstr", [
    expectedHead("jsstr(value)", "value:string", "js:JsString<>"),
  ]));
});

test("canonical Core texts occur once and retain the full shared base, Error, utilities and eighteen aliases", () => {
  domain(sourceLibraries.core.declarations.map(row => row.fileName),
    ["source-base.d.ts", "typescript-utilities.d.ts", "source-primitives.d.ts"], "all canonical Core text fragments");
  domain(sourceLibraries.js.declarations.map(row => row.fileName), ["js-globals.d.ts"], "one JS-specific fragment");
  for (const row of [...sourceLibraries.core.declarations, ...sourceLibraries.js.declarations]) absent(row.module, "global text, not a fake virtual module");
  const [base, utilities, aliases] = sourceLibraries.core.declarations.map(row => row.sourceText);
  const js = sourceLibraries.js.declarations[0].sourceText;
  const combined = [...sourceLibraries.core.declarations, ...sourceLibraries.js.declarations].map(row => row.sourceText).join("\n\n");
  const basePredicates = ["interface Object {}", "interface CallableFunction extends Function {}",
    "interface IArguments {\n  [index: int32]: unknown;\n}", "done?: false;",
    "all<T>(values: readonly Promise<T>[]): Promise<T[]>;", "all<T extends readonly unknown[]>(values: T)",
    "[Symbol.iterator](): IterableIterator<T, TReturn, TNext>;", "[Symbol.asyncIterator](): AsyncIterableIterator<T, TReturn, TNext>;",
    'type UnicodeNormalizationForm = "NFC" | "NFD" | "NFKC" | "NFKD";',
    "readonly name: string;", "readonly message: string;", "readonly stack: string | undefined;", "readonly cause: Error | undefined;",
    "interface ErrorOptions { cause?: Error; }", "interface AsyncDisposable", "interface PromiseLike<T>"];
  assert.equal(basePredicates.length, 16, "full original base/Error and independent optional ErrorOptions purposes");
  for (const text of basePredicates) assert.equal(base.includes(text), true, text);
  assert.equal(base.includes("readonly length:"), false); assert.equal(base.includes("readonly Length:"), false);
  assert.equal(base.includes("stack?:"), false);
  assert.equal(combined.split("interface Error {").length - 1, 1);
  assert.equal(combined.split("interface ErrorOptions {").length - 1, 1);
  assert.equal(combined.split(base).length - 1, 1, "shared base exactly once across the selection");
  assert.equal(combined.split(utilities).length - 1, 1, "shared utility vocabulary exactly once");
  assert.equal(combined.split(aliases).length - 1, 1, "primitive aliases exactly once");
  assert.equal(js.includes("interface Object {}"), false); assert.equal(js.includes("type Awaited<T>"), false);
  assert.equal(aliases, primitivePairs.map(([name]) => `type ${name} = import("@tsonic/core/types.js").${name};`).join("\n"));
  const utilityNames = ["ThisParameterType", "OmitThisParameter", "Awaited", "Partial", "Required", "Readonly", "Pick", "Record",
    "Exclude", "Extract", "Omit", "NonNullable", "Parameters", "ConstructorParameters", "ReturnType", "InstanceType",
    "Uppercase", "Lowercase", "Capitalize", "Uncapitalize", "NoInfer", "ThisType"];
  domain([...utilities.matchAll(/^(?:type|interface) (\w+)/gmu)].map(match => match[1]), utilityNames, "complete no-lib utility declarations");
});

test("all JS capability, typed-array, RegExp and remaining global declaration text retains its exact native slots", () => {
  const text = sourceLibraries.js.declarations[0].sourceText;
  const arrays = [["Int8Array", "int8"], ["Uint8Array", "uint8"], ["Uint8ClampedArray", "uint8"], ["Int16Array", "int16"],
    ["Uint16Array", "uint16"], ["Int32Array", "int32"], ["Uint32Array", "uint32"], ["Float32Array", "float32"], ["Float64Array", "float64"]];
  domain([...text.matchAll(/^interface (\w+) extends TypedArray<\1, (\w+)>/gmu)].map(match => `${match[1]}:${match[2]}`),
    arrays.map(([name, element]) => `${name}:${element}`), "complete independently expected typed-array element inventory");
  for (const [name] of arrays) {
    assert.equal(text.split(`interface ${name}Constructor extends TypedArrayConstructor<${name}> {}`).length - 1, 1);
    assert.equal(text.split(`declare var ${name}: ${name}Constructor;`).length - 1, 1);
  }
  const predicates = ["interface SharedArrayBuffer", "interface Atomics", "getBigUint64(", "setBigUint64(",
    "new (): Uint8Array", "from(arrayLike: string): string[]", "lastIndexOf(searchElement: T, fromIndex?: int32): int32",
    "stringify(value: unknown", "interface ArrayEntriesIterator<T>", "IterableIterator<[int32, T]",
    "sort<TResult extends number | bigint = number>(compareFn?: (a: T, b: T) => TResult)",
    "sort<TResult extends number | bigint = number>(compareFn?: (left: TElement, right: TElement) => TResult)",
    "getInt8(byteOffset: int32): int8;", "getUint32(byteOffset: int32, littleEndian?: boolean): uint32;",
    "[index: int32]: TElement;", "readonly BYTES_PER_ELEMENT: int32;", "readonly byteOffset: int32;",
    "new (length: int32): TArray;", "new <TValue extends number | bigint>(array: ArrayLike<TValue> | Iterable<TValue>): TArray;",
    "fill<TValue extends number | bigint>(value: TValue, start?: int32, end?: int32): TArray;",
    "interface JsRegExpNamedGroups", "interface JsRegExpNamedIndices", "interface JsRegExpExecArray", "interface JsRegExpMatchArray",
    "interface RegExpIndicesArray", "readonly indices: JsRegExpIndicesArray | undefined;",
    "[Symbol.matchAll](string: string): RegExpStringIterator<RegExpExecArray>;",
    "[Symbol.matchAll](string: import(\"@tsonic/js/types.js\").JsString): JsRegExpStringIterator<JsRegExpExecArray>;",
    "escape(string: import(\"@tsonic/js/types.js\").JsString): string;", "readonly unicodeSets: boolean;",
    "type JsRegExpReplaceCallback", "declare var WeakMap: WeakMapConstructor;", "declare var Intl: IntlObject;",
    "interface RangeError extends Error {}", "interface TypeError extends Error {}", "interface URIError extends Error {}"];
  assert.equal(predicates.length, 36, "complete declared pure JS purpose domain before checking");
  for (const predicate of predicates) assert.equal(text.includes(predicate), true, predicate);
  for (const signature of ["split(separator: string, limit?: int32): string[];",
    "split(separator: RegExp, limit?: int32): (string | undefined)[];", "asIntN(bits: int32, value: bigint): bigint;",
    "asUintN(bits: int32, value: bigint): bigint;", "declare function clearTimeout(id?: int32): void;",
    "declare function clearInterval(id?: int32): void;"]) assert.equal(text.split(signature).length - 1, 1, signature);
  assert.equal(text.includes("limit?: number"), false); assert.equal(text.includes("asIntN(bits: number"), false);
  const order = ["readonly match: unique symbol;", "interface RegExpNamedGroups", "type RegExpReplaceCallback", "interface String {\n  match("];
  for (let index = 1; index < order.length; index += 1) assert.equal(text.indexOf(order[index - 1]) < text.indexOf(order[index]), true,
    "original symbol/result/object/String-RegExp order");
});

function sourceInputs() {
  domain(readdirSync(resolve(repository, directory)).sort(), expectedFiles, "all sixteen owned source files");
  const model = "packages/host/src/model/";
  const modelFiles = ["contract.ts", "foundation-data.ts", "syntax-data.ts", "library-data.ts", "input-data.ts", "core-input-data.ts",
    "original-input-data.ts", "program-input-data.ts", "input-answer-data.ts"].map(name => model + name);
  return { libraries: expectedFiles.map(name => directory + name), model: modelFiles };
}

test("the complete real Model and Libraries closures satisfy architecture and whole-module fresh strict isolation", async () => {
  const inputs = sourceInputs();
  const findings = inspectHostStructure({ root: repository, files: [...inputs.libraries, ...inputs.model], declarationFiles: inputs.model });
  assert.deepEqual(findings.map(item => [item.gate, item.file, item.start]), []);
  const result = await compileHostModuleInIsolation({ root: repository, module: "libraries", sourceFiles: inputs.libraries,
    dependencyContracts: inputs.model, outputDirectory: ".temp/libraries-isolated" });
  assert.equal(result.kind, "passed", result.log.slice(0, 8192));
  assert.equal((result.log.match(/strict compiler exit=0/gu) ?? []).length, 2, "actual complete fresh dependency and module checks");
});

test("real composition imports the sole register port while a peer implementation cannot", async () => {
  const inputs = sourceInputs();
  const sources = [...inputs.libraries, ...inputs.model].map(path => ({ path, text: readFileSync(resolve(repository, path), "utf8") }));
  for (const [path, expected] of [["packages/host/src/orchestration/libraries.ts", []],
    ["packages/host/src/ingress/libraries.ts", ["contract-imports"]]]) {
    await withSpecProject([...sources, { path, text: `import { sourceLibraries } from '../libraries/register.js';\nexport function compose() { return sourceLibraries; }` }], project => {
      const findings = inspectHostStructure({ root: project.root, files: project.files, declarationFiles: inputs.model });
      domain(findings.map(item => item.gate).sort(), expected, `actual Libraries composition port at ${path}`);
    });
  }
});

test("actual immutable-data gates reject mutable arrays, maps, callbacks and aliased mutable backing", async () => {
  const inputs = sourceInputs();
  const original = readFileSync(resolve(repository, directory + "register.ts"), "utf8");
  const cases = [
    ["mutable-vector", "const retained = [];\n"], ["mutable-map", "const retained = new Map();\n"],
    ["mutable-alias", "let retained = Object.freeze([]);\n"],
  ];
  domain(cases.map(([name]) => name), ["mutable-vector", "mutable-map", "mutable-alias"], "complete storage mutation gate opposites");
  for (const [name, prefix] of cases) {
    const files = [...inputs.libraries, ...inputs.model].map(path => ({ path,
      text: path === directory + "register.ts" ? prefix + original : readFileSync(resolve(repository, path), "utf8") }));
    await withSpecProject(files, project => {
      const findings = inspectHostStructure({ root: project.root, files: project.files, declarationFiles: inputs.model });
      domain(findings.map(item => item.gate), ["program-lifetime"], name);
    });
  }
  const mutable = Object.freeze({ core: sourceLibraries.core, js: Object.freeze({ ...sourceLibraries.js, modules: [] }) });
  assert.throws(() => allFrozen(mutable), { code: "ERR_ASSERTION" });
  assert.throws(() => allFrozen(Object.freeze({ callback() {} })), { code: "ERR_ASSERTION" });
  assert.throws(() => allFrozen(Object.freeze({ backing: new Map() })), { code: "ERR_ASSERTION" });
  const complete = sourceLibraries.core.modules.flatMap(module => module.exports);
  verifyCore(complete);
  const comptime = complete.find(item => item.id === "comptime");
  assert.equal(comptime.signatures.length, 2, "full independent comptime overload domain before mutations");
  for (const malformed of [[], [...complete, complete[0]], complete.map(item => item === comptime
    ? { ...item, signatures: [item.signatures[0]] } : item), complete.map(item => item === comptime
    ? { ...item, signatures: [] } : item)]) {
    assert.throws(() => verifyCore(malformed), { code: "ERR_ASSERTION" }, "the SAME complete catalogue contract rejects empty/duplicate/truncated data");
  }
});

test("the real export binds strictly and fresh complete declarations reject every readonly and forbidden-recipe mutation", async () => {
  const inputs = sourceInputs();
  const source = `import type { SourceLibraries } from './packages/host/src/libraries/contract.js';
import { sourceLibraries } from './packages/host/src/libraries/register.js';
const declared: SourceLibraries = sourceLibraries;
const actual: typeof sourceLibraries = declared;
export const selected: SourceLibraries = actual;
`;
  const consumer = `import type { SourceLibraries } from './checked/packages/host/src/libraries/contract.js';
import type * as Model from './checked/packages/host/src/model/contract.js';
import { sourceLibraries } from './checked/packages/host/src/libraries/register.js';
declare const declaration: Model.LibraryDeclaration;
declare const member: Model.LibraryMember;
declare const signature: Model.LibrarySignature;
declare const parameter: Model.LibraryParameter;
declare const binder: Model.LibraryTypeParameter;
declare const module: Model.LibraryModule;
const declared: SourceLibraries = sourceLibraries;
const complete: typeof sourceLibraries = declared;
export const selected: SourceLibraries = complete;
void declaration; void member; void signature; void parameter; void binder; void module;
`;
  const negatives = [
    ["readonly-port", "sourceLibraries.core = sourceLibraries.js;", 2540],
    ["readonly-module-vector", "sourceLibraries.core.modules.push(module);", 2339],
    ["readonly-declaration-vector", "module.exports.push(declaration);", 2339],
    ["readonly-member-vector", "declaration.members.push(member);", 2339],
    ["readonly-signature-vector", "member.signatures.push(signature);", 2339],
    ["readonly-parameter-vector", "signature.parameters.push(parameter);", 2339],
    ["readonly-binder-vector", "signature.typeParameters.push(binder);", 2339],
    ["readonly-constraint-vector", "binder.constraints.push({kind:'number'});", 2339],
    ["readonly-identity", "module.identity.providerId = 'other';", 2540],
    ["readonly-export", "declaration.exportName = 'other';", 2540],
    ["readonly-kind", "declaration.kind = 'function';", 2540],
    ["readonly-type", "declaration.type = {kind:'none'};", 2540],
    ["readonly-member", "member.readonly = false;", 2540],
    ["readonly-result", "signature.returnType = {kind:'none'};", 2540],
    ["readonly-passing", "parameter.passingMode = 'move';", 2540],
    ["readonly-optional", "parameter.optional = true;", 2540],
    ["readonly-rest", "parameter.rest = true;", 2540],
    ["readonly-default", "parameter.defaultType = {kind:'none'};", 2540],
    ["readonly-variance", "binder.variance = 'out';", 2540],
    ["callback-recipe", "const bad: Model.LibraryType = () => 1; void bad;", 2322],
    ["map-recipe", "const bad: Model.LibraryType = new Map(); void bad;", 2322],
    ["missing-recipe-vector", "const bad: Model.LibraryType = {kind:'source-global',name:'Object'}; void bad;", 2322],
    ["missing-signature", "const bad: Model.LibrarySignature = {id:'missing'}; void bad;", 2740],
    ["old-factory", "sourceLibraries.createSourceSemanticsVirtualModuleProvider();", 2339],
  ];
  assert.equal(negatives.length, 24, "all expected current public boundary purposes before compiler execution; codes are initially unverified");
  const flags = ["--ignoreConfig", "--strict", "--noUncheckedIndexedAccess", "--exactOptionalPropertyTypes", "--skipLibCheck", "false",
    "--noUnusedLocals", "--noUnusedParameters", "--noImplicitReturns", "--noFallthroughCasesInSwitch", "--noEmitOnError",
    "--module", "nodenext", "--target", "es2020", "--types", "node"];
  const compiler = resolve(repository, "node_modules/.bin/tsgo");
  const compile = (files, extra = []) => {
    const result = spawnSync(compiler, [...flags, ...extra, ...files], {
      cwd: repository, encoding: "utf8", maxBuffer: 131072, timeout: 60000,
    });
    assert.equal(result.error === undefined, true, "installed pinned compiler launches without fallback");
    assert.equal(result.signal, null); assert.equal(result.stderr, "");
    return result;
  };
  const authored = [...inputs.libraries, ...inputs.model].map(path => ({ path, text: readFileSync(resolve(repository, path), "utf8") }));
  await withSpecProject([...authored, { path: "binding.mts", text: source }, { path: "package.json", text: '{"type":"module"}' }], project => {
    const emitted = compile([...inputs.libraries, ...inputs.model, "binding.mts"].map(path => resolve(project.root, path)),
      ["--declaration", "--emitDeclarationOnly", "--rootDir", project.root, "--outDir", resolve(project.root, "checked")]);
    assert.equal(emitted.status, 0, emitted.stdout.slice(0, 8192));
    const expectedDeclarations = [...inputs.libraries, ...inputs.model].map(path => `checked/${path.replace(/\.ts$/u, ".d.ts")}`);
    const actualDeclarations = readdirSync(resolve(project.root, "checked"), { recursive: true }).filter(path => /\.d\.(?:ts|mts)$/u.test(path)).sort();
    domain(actualDeclarations, [...expectedDeclarations.map(path => path.slice("checked/".length)), "binding.d.mts"].sort(),
      "the complete actual emitted Model/Libraries closure before consumer checking");
    writeFileSync(resolve(project.root, "consumer.mts"), consumer);
    const positive = compile([resolve(project.root, "consumer.mts")], ["--noEmit", "--listFiles"]);
    assert.equal(positive.status, 0, positive.stdout.slice(0, 8192));
    const loaded = positive.stdout.split(/\r?\n/u).filter(path => path.startsWith(project.root));
    domain(loaded.filter(path => path.endsWith(".ts") && !path.endsWith(".d.ts")), [], "declaration consumer loads no original implementation");
    domain(loaded.filter(path => path.includes("/model/")).map(path => basename(path)).sort(),
      inputs.model.map(path => basename(path).replace(/\.ts$/u, ".d.ts")).sort(), "actual fresh complete nine-file Model closure");
    for (const [name, text] of negatives) writeFileSync(resolve(project.root, `${name}.mts`), consumer + text);
    const negative = compile(negatives.map(([name]) => resolve(project.root, `${name}.mts`)), ["--noEmit"]);
    assert.equal(negative.status, 1, "actual readonly, recipe and retired-port boundaries reject");
    const diagnostics = [...negative.stdout.matchAll(/^(.*)\(\d+,\d+\): error TS(\d+):/gmu)].map(match => [basename(match[1]), Number(match[2])]);
    assert.equal((negative.stdout.match(/\berror TS\d+:/gu) ?? []).length, negatives.length, negative.stdout.slice(0, 8192));
    domain(diagnostics.map(([name]) => name).sort(), negatives.map(([name]) => `${name}.mts`).sort(), "every exact expected negative file");
    for (const [name, , code] of negatives) {
      const selected = diagnostics.filter(([file]) => file === `${name}.mts`);
      assert.equal(selected.length, 1, name); assert.equal(selected[0][1], code, name);
    }
  });
});

const expectedTextLines = [
  [
    "type PropertyKey = string | number | symbol;",
    "type UnicodeNormalizationForm = \"NFC\" | \"NFD\" | \"NFKC\" | \"NFKD\";",
    "interface Object {}",
    "interface Function {}",
    "interface CallableFunction extends Function {}",
    "interface NewableFunction extends Function {}",
    "interface IArguments {",
    "[index: int32]: unknown;",
    "}",
    "interface Boolean {}",
    "interface Number {}",
    "interface RegExp {}",
    "interface Error {",
    "readonly name: string;",
    "readonly message: string;",
    "readonly stack: string | undefined;",
    "readonly cause: Error | undefined;",
    "}",
    "interface ErrorOptions { cause?: Error; }",
    "interface ErrorConstructor {",
    "new (message?: string, options?: ErrorOptions): Error;",
    "(message?: string, options?: ErrorOptions): Error;",
    "captureStackTrace(error: Error): void;",
    "}",
    "declare var Error: ErrorConstructor;",
    "interface PromiseLike<T> {",
    "then<TResult1 = T, TResult2 = never>(",
    "onfulfilled?: ((value: T) => TResult1) | null,",
    "onrejected?: ((reason: unknown) => TResult2) | null",
    "): PromiseLike<TResult1 | TResult2>;",
    "}",
    "interface Promise<T> {",
    "then<TResult1 = T, TResult2 = never>(",
    "onfulfilled?: ((value: T) => TResult1) | null,",
    "onrejected?: ((reason: unknown) => TResult2) | null",
    "): Promise<TResult1 | TResult2>;",
    "catch<TResult = never>(onrejected?: ((reason: unknown) => TResult) | null): Promise<T | TResult>;",
    "}",
    "interface PromiseConstructor {",
    "new <T>(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void): Promise<T>;",
    "resolve<T>(value: T | PromiseLike<T>): Promise<T>;",
    "reject<T = never>(reason?: unknown): Promise<T>;",
    "all<T>(values: readonly Promise<T>[]): Promise<T[]>;",
    "all<T extends readonly unknown[]>(values: T): Promise<{ [K in keyof T]: Awaited<T[K]> }>;",
    "}",
    "declare var Promise: PromiseConstructor;",
    "interface Symbol {",
    "readonly description: string | undefined;",
    "toString(): string;",
    "valueOf(): symbol;",
    "}",
    "interface SymbolConstructor {",
    "readonly iterator: unique symbol;",
    "readonly asyncIterator: unique symbol;",
    "readonly dispose: unique symbol;",
    "readonly asyncDispose: unique symbol;",
    "}",
    "declare var Symbol: SymbolConstructor;",
    "interface IteratorYieldResult<TYield> {",
    "done?: false;",
    "value: TYield;",
    "}",
    "interface IteratorReturnResult<TReturn> {",
    "done: true;",
    "value: TReturn;",
    "}",
    "type IteratorResult<T, TReturn = unknown> = IteratorYieldResult<T> | IteratorReturnResult<TReturn>;",
    "interface Iterator<T, TReturn = unknown, TNext = unknown> {",
    "next(): IteratorResult<T, TReturn>;",
    "next(value: TNext): IteratorResult<T, TReturn>;",
    "}",
    "interface Iterable<T, TReturn = unknown, TNext = unknown> {",
    "[Symbol.iterator](): Iterator<T, TReturn, TNext>;",
    "}",
    "interface IterableIterator<T, TReturn = unknown, TNext = unknown> extends Iterator<T, TReturn, TNext> {",
    "[Symbol.iterator](): IterableIterator<T, TReturn, TNext>;",
    "}",
    "interface AsyncIterator<T, TReturn = unknown, TNext = unknown> {",
    "next(): Promise<IteratorResult<T, TReturn>>;",
    "next(value: TNext): Promise<IteratorResult<T, TReturn>>;",
    "}",
    "interface AsyncIterable<T, TReturn = unknown, TNext = unknown> {",
    "[Symbol.asyncIterator](): AsyncIterator<T, TReturn, TNext>;",
    "}",
    "interface AsyncIterableIterator<T, TReturn = unknown, TNext = unknown> extends AsyncIterator<T, TReturn, TNext> {",
    "[Symbol.asyncIterator](): AsyncIterableIterator<T, TReturn, TNext>;",
    "}",
    "interface Generator<T = unknown, TReturn = unknown, TNext = unknown> extends Iterator<T, TReturn, TNext> {",
    "next(): IteratorResult<T, TReturn>;",
    "next(value: TNext): IteratorResult<T, TReturn>;",
    "return(value: TReturn): IteratorResult<T, TReturn>;",
    "throw(error: unknown): IteratorResult<T, TReturn>;",
    "[Symbol.iterator](): Generator<T, TReturn, TNext>;",
    "}",
    "interface AsyncGenerator<T = unknown, TReturn = unknown, TNext = unknown> extends AsyncIterator<T, TReturn, TNext> {",
    "next(): Promise<IteratorResult<T, TReturn>>;",
    "next(value: TNext): Promise<IteratorResult<T, TReturn>>;",
    "return(value: TReturn): Promise<IteratorResult<T, TReturn>>;",
    "throw(error: unknown): Promise<IteratorResult<T, TReturn>>;",
    "[Symbol.asyncIterator](): AsyncGenerator<T, TReturn, TNext>;",
    "}",
    "interface Disposable {",
    "[Symbol.dispose](): void;",
    "}",
    "interface AsyncDisposable {",
    "[Symbol.asyncDispose](): void | PromiseLike<void>;",
    "}"
  ],
  [
    "type ThisParameterType<T> = T extends (this: infer U, ...args: never) => any ? U : unknown;",
    "type OmitThisParameter<T> = unknown extends ThisParameterType<T>",
    "? T",
    ": T extends (...args: infer A) => infer R",
    "? (...args: A) => R",
    ": T;",
    "type Awaited<T> = T extends null | undefined",
    "? T",
    ": T extends object & { then(onfulfilled: infer F, ...args: infer _): any; }",
    "? F extends ((value: infer V, ...args: infer _) => any)",
    "? Awaited<V>",
    ": never",
    ": T;",
    "type Partial<T> = { [P in keyof T]?: T[P] };",
    "type Required<T> = { [P in keyof T]-?: T[P] };",
    "type Readonly<T> = { readonly [P in keyof T]: T[P] };",
    "type Pick<T, K extends keyof T> = { [P in K]: T[P] };",
    "type Record<K extends keyof any, T> = { [P in K]: T };",
    "type Exclude<T, U> = T extends U ? never : T;",
    "type Extract<T, U> = T extends U ? T : never;",
    "type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;",
    "type NonNullable<T> = T & {};",
    "type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;",
    "type ConstructorParameters<T extends abstract new (...args: any) => any> = T extends abstract new (...args: infer P) => any ? P : never;",
    "type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;",
    "type InstanceType<T extends abstract new (...args: any) => any> = T extends abstract new (...args: any) => infer R ? R : any;",
    "type Uppercase<S extends string> = intrinsic;",
    "type Lowercase<S extends string> = intrinsic;",
    "type Capitalize<S extends string> = intrinsic;",
    "type Uncapitalize<S extends string> = intrinsic;",
    "type NoInfer<T> = intrinsic;",
    "interface ThisType<T> {}"
  ],
  [
    "type bool = import(\"@tsonic/core/types.js\").bool;",
    "type char = import(\"@tsonic/core/types.js\").char;",
    "type int8 = import(\"@tsonic/core/types.js\").int8;",
    "type uint8 = import(\"@tsonic/core/types.js\").uint8;",
    "type int16 = import(\"@tsonic/core/types.js\").int16;",
    "type uint16 = import(\"@tsonic/core/types.js\").uint16;",
    "type int32 = import(\"@tsonic/core/types.js\").int32;",
    "type uint32 = import(\"@tsonic/core/types.js\").uint32;",
    "type int64 = import(\"@tsonic/core/types.js\").int64;",
    "type uint64 = import(\"@tsonic/core/types.js\").uint64;",
    "type int128 = import(\"@tsonic/core/types.js\").int128;",
    "type uint128 = import(\"@tsonic/core/types.js\").uint128;",
    "type nativeInt = import(\"@tsonic/core/types.js\").nativeInt;",
    "type nativeUint = import(\"@tsonic/core/types.js\").nativeUint;",
    "type float16 = import(\"@tsonic/core/types.js\").float16;",
    "type float32 = import(\"@tsonic/core/types.js\").float32;",
    "type float64 = import(\"@tsonic/core/types.js\").float64;",
    "type decimal = import(\"@tsonic/core/types.js\").decimal;"
  ],
  [
    "interface ArrayLike<T> {",
    "readonly length: int32;",
    "readonly [index: int32]: T;",
    "}",
    "interface SymbolConstructor {",
    "(description?: string | number): symbol;",
    "for(key: string): symbol;",
    "keyFor(symbol: symbol): string | undefined;",
    "}",
    "interface WeakKeyTypes {",
    "object: object;",
    "}",
    "type WeakKey = WeakKeyTypes[keyof WeakKeyTypes];",
    "interface WeakMap<K extends WeakKey, V> {",
    "delete(key: K): boolean;",
    "get(key: K): V | undefined;",
    "has(key: K): boolean;",
    "set(key: K, value: V): this;",
    "}",
    "interface WeakMapConstructor {",
    "new <K extends WeakKey, V>(entries?: readonly (readonly [K, V])[] | null): WeakMap<K, V>;",
    "}",
    "declare var WeakMap: WeakMapConstructor;",
    "interface WeakSet<T extends WeakKey> {",
    "add(value: T): this;",
    "delete(value: T): boolean;",
    "has(value: T): boolean;",
    "}",
    "interface WeakSetConstructor {",
    "new <T extends WeakKey>(values?: readonly T[] | null): WeakSet<T>;",
    "}",
    "declare var WeakSet: WeakSetConstructor;",
    "interface ArrayBuffer {",
    "readonly byteLength: int32;",
    "slice(begin?: int32, end?: int32): ArrayBuffer;",
    "}",
    "interface ArrayBufferConstructor {",
    "new (byteLength: int32): ArrayBuffer;",
    "readonly prototype: ArrayBuffer;",
    "}",
    "declare var ArrayBuffer: ArrayBufferConstructor;",
    "interface ArrayBufferView {",
    "readonly buffer: ArrayBuffer;",
    "readonly byteLength: int32;",
    "readonly byteOffset: int32;",
    "}",
    "interface DataView extends ArrayBufferView {",
    "getInt8(byteOffset: int32): int8;",
    "getUint8(byteOffset: int32): uint8;",
    "getInt16(byteOffset: int32, littleEndian?: boolean): int16;",
    "getUint16(byteOffset: int32, littleEndian?: boolean): uint16;",
    "getInt32(byteOffset: int32, littleEndian?: boolean): int32;",
    "getUint32(byteOffset: int32, littleEndian?: boolean): uint32;",
    "getFloat32(byteOffset: int32, littleEndian?: boolean): float32;",
    "getFloat64(byteOffset: int32, littleEndian?: boolean): float64;",
    "setInt8<TValue extends number | bigint>(byteOffset: int32, value: TValue): void;",
    "setUint8<TValue extends number | bigint>(byteOffset: int32, value: TValue): void;",
    "setInt16<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;",
    "setUint16<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;",
    "setInt32<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;",
    "setUint32<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;",
    "setFloat32<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;",
    "setFloat64<TValue extends number | bigint>(byteOffset: int32, value: TValue, littleEndian?: boolean): void;",
    "}",
    "interface DataViewConstructor {",
    "new (buffer: ArrayBuffer, byteOffset?: int32, byteLength?: int32): DataView;",
    "}",
    "declare var DataView: DataViewConstructor;",
    "interface TypedArray<TArray, TElement> extends ArrayBufferView, Iterable<TElement> {",
    "readonly BYTES_PER_ELEMENT: int32;",
    "readonly length: int32;",
    "[index: int32]: TElement;",
    "at(index: int32): TElement | undefined;",
    "fill<TValue extends number | bigint>(value: TValue, start?: int32, end?: int32): TArray;",
    "includes<TValue extends number | bigint>(searchElement: TValue, fromIndex?: int32): boolean;",
    "indexOf<TValue extends number | bigint>(searchElement: TValue, fromIndex?: int32): int32;",
    "join(separator?: string): string;",
    "reverse(): TArray;",
    "set<TValue extends number | bigint>(array: ArrayLike<TValue>, offset?: int32): void;",
    "slice(start?: int32, end?: int32): TArray;",
    "sort<TResult extends number | bigint = number>(compareFn?: (left: TElement, right: TElement) => TResult): TArray;",
    "subarray(begin?: int32, end?: int32): TArray;",
    "}",
    "interface TypedArrayConstructor<TArray> {",
    "new (length: int32): TArray;",
    "new <TValue extends number | bigint>(array: ArrayLike<TValue> | Iterable<TValue>): TArray;",
    "new (buffer: ArrayBuffer, byteOffset?: int32, length?: int32): TArray;",
    "readonly BYTES_PER_ELEMENT: int32;",
    "}",
    "interface Int8Array extends TypedArray<Int8Array, int8> {}",
    "interface Int8ArrayConstructor extends TypedArrayConstructor<Int8Array> {}",
    "declare var Int8Array: Int8ArrayConstructor;",
    "interface Uint8Array extends TypedArray<Uint8Array, uint8> {}",
    "interface Uint8ArrayConstructor extends TypedArrayConstructor<Uint8Array> {}",
    "declare var Uint8Array: Uint8ArrayConstructor;",
    "interface Uint8ClampedArray extends TypedArray<Uint8ClampedArray, uint8> {}",
    "interface Uint8ClampedArrayConstructor extends TypedArrayConstructor<Uint8ClampedArray> {}",
    "declare var Uint8ClampedArray: Uint8ClampedArrayConstructor;",
    "interface Int16Array extends TypedArray<Int16Array, int16> {}",
    "interface Int16ArrayConstructor extends TypedArrayConstructor<Int16Array> {}",
    "declare var Int16Array: Int16ArrayConstructor;",
    "interface Uint16Array extends TypedArray<Uint16Array, uint16> {}",
    "interface Uint16ArrayConstructor extends TypedArrayConstructor<Uint16Array> {}",
    "declare var Uint16Array: Uint16ArrayConstructor;",
    "interface Int32Array extends TypedArray<Int32Array, int32> {}",
    "interface Int32ArrayConstructor extends TypedArrayConstructor<Int32Array> {}",
    "declare var Int32Array: Int32ArrayConstructor;",
    "interface Uint32Array extends TypedArray<Uint32Array, uint32> {}",
    "interface Uint32ArrayConstructor extends TypedArrayConstructor<Uint32Array> {}",
    "declare var Uint32Array: Uint32ArrayConstructor;",
    "interface Float32Array extends TypedArray<Float32Array, float32> {}",
    "interface Float32ArrayConstructor extends TypedArrayConstructor<Float32Array> {}",
    "declare var Float32Array: Float32ArrayConstructor;",
    "interface Float64Array extends TypedArray<Float64Array, float64> {}",
    "interface Float64ArrayConstructor extends TypedArrayConstructor<Float64Array> {}",
    "declare var Float64Array: Float64ArrayConstructor;",
    "interface PromiseFulfilledResult<T> {",
    "status: \"fulfilled\";",
    "value: T;",
    "}",
    "interface PromiseRejectedResult {",
    "status: \"rejected\";",
    "reason: unknown;",
    "}",
    "type PromiseSettledResult<T> = PromiseFulfilledResult<T> | PromiseRejectedResult;",
    "interface Promise<T> {",
    "finally(onfinally?: (() => void) | null): Promise<T>;",
    "}",
    "interface PromiseConstructor {",
    "race<T extends readonly unknown[]>(values: T): Promise<Awaited<T[number]>>;",
    "any<T extends readonly unknown[]>(values: T): Promise<Awaited<T[number]>>;",
    "allSettled<T extends readonly unknown[]>(values: T): Promise<{ [K in keyof T]: PromiseSettledResult<Awaited<T[K]>> }>;",
    "}",
    "interface IntlDateTimeFormat {",
    "format(value?: Date | number): string;",
    "formatToParts(value?: Date | number): IntlDateTimeFormatPart[];",
    "resolvedOptions(): IntlResolvedDateTimeFormatOptions;",
    "}",
    "interface IntlDateTimeFormatPart { type: string; value: string; }",
    "interface IntlDateTimeFormatOptions {",
    "localeMatcher?: \"lookup\" | \"best fit\";",
    "weekday?: \"long\" | \"short\" | \"narrow\";",
    "era?: \"long\" | \"short\" | \"narrow\";",
    "year?: \"numeric\" | \"2-digit\";",
    "month?: \"numeric\" | \"2-digit\" | \"long\" | \"short\" | \"narrow\";",
    "day?: \"numeric\" | \"2-digit\";",
    "hour?: \"numeric\" | \"2-digit\";",
    "minute?: \"numeric\" | \"2-digit\";",
    "second?: \"numeric\" | \"2-digit\";",
    "timeZoneName?: \"long\" | \"short\";",
    "timeZone?: string;",
    "hour12?: boolean;",
    "}",
    "interface IntlResolvedDateTimeFormatOptions {",
    "readonly locale: string;",
    "readonly calendar: string;",
    "readonly numberingSystem: string;",
    "readonly timeZone: string;",
    "}",
    "interface IntlDateTimeFormatConstructor {",
    "new (locales?: string | readonly string[], options?: IntlDateTimeFormatOptions): IntlDateTimeFormat;",
    "}",
    "interface IntlNumberFormat {",
    "format(value: number | bigint): string;",
    "formatToParts(value: number | bigint): IntlNumberFormatPart[];",
    "resolvedOptions(): IntlResolvedNumberFormatOptions;",
    "}",
    "interface BigInt {",
    "toLocaleString(locales?: string | readonly string[], options?: IntlNumberFormatOptions): string;",
    "}",
    "interface IntlNumberFormatPart { type: string; value: string; }",
    "interface IntlNumberFormatOptions {",
    "localeMatcher?: \"lookup\" | \"best fit\";",
    "style?: \"decimal\" | \"percent\" | \"currency\" | \"unit\";",
    "numberingSystem?: string;",
    "currency?: string;",
    "currencyDisplay?: \"symbol\" | \"narrowSymbol\" | \"code\" | \"name\";",
    "currencySign?: \"standard\" | \"accounting\";",
    "unit?: string;",
    "unitDisplay?: \"short\" | \"long\" | \"narrow\";",
    "notation?: \"standard\" | \"scientific\" | \"engineering\" | \"compact\";",
    "compactDisplay?: \"short\" | \"long\";",
    "signDisplay?: \"auto\" | \"never\" | \"always\" | \"exceptZero\" | \"negative\";",
    "useGrouping?: boolean | \"auto\" | \"always\" | \"min2\";",
    "minimumIntegerDigits?: int32;",
    "minimumFractionDigits?: int32;",
    "maximumFractionDigits?: int32;",
    "minimumSignificantDigits?: int32;",
    "maximumSignificantDigits?: int32;",
    "roundingPriority?: \"auto\" | \"morePrecision\" | \"lessPrecision\";",
    "roundingIncrement?: int32;",
    "roundingMode?: \"ceil\" | \"floor\" | \"expand\" | \"trunc\" | \"halfCeil\" | \"halfFloor\" | \"halfExpand\" | \"halfTrunc\" | \"halfEven\";",
    "trailingZeroDisplay?: \"auto\" | \"stripIfInteger\";",
    "}",
    "interface IntlResolvedNumberFormatOptions {",
    "readonly locale: string;",
    "readonly numberingSystem: string;",
    "readonly style: string;",
    "readonly minimumIntegerDigits: int32;",
    "readonly minimumFractionDigits: int32 | undefined;",
    "readonly maximumFractionDigits: int32 | undefined;",
    "readonly minimumSignificantDigits: int32 | undefined;",
    "readonly maximumSignificantDigits: int32 | undefined;",
    "readonly useGrouping: false | \"auto\" | \"always\" | \"min2\";",
    "readonly currency: string | undefined;",
    "readonly currencyDisplay: string | undefined;",
    "readonly currencySign: string | undefined;",
    "readonly unit: string | undefined;",
    "readonly unitDisplay: string | undefined;",
    "readonly notation: string;",
    "readonly compactDisplay: string | undefined;",
    "readonly signDisplay: string;",
    "readonly roundingPriority: string;",
    "readonly roundingIncrement: int32;",
    "readonly roundingMode: string;",
    "readonly trailingZeroDisplay: string;",
    "}",
    "interface IntlNumberFormatConstructor {",
    "new (locales?: string | readonly string[], options?: IntlNumberFormatOptions): IntlNumberFormat;",
    "}",
    "interface IntlCollator {",
    "compare(left: string, right: string): int32;",
    "resolvedOptions(): IntlResolvedCollatorOptions;",
    "}",
    "interface IntlCollatorOptions {",
    "localeMatcher?: \"lookup\" | \"best fit\";",
    "usage?: \"sort\" | \"search\";",
    "sensitivity?: \"base\" | \"accent\" | \"case\" | \"variant\";",
    "ignorePunctuation?: boolean;",
    "numeric?: boolean;",
    "caseFirst?: \"upper\" | \"lower\" | \"false\";",
    "}",
    "interface IntlResolvedCollatorOptions {",
    "readonly locale: string;",
    "readonly usage: string;",
    "readonly sensitivity: string;",
    "readonly ignorePunctuation: boolean;",
    "readonly collation: string;",
    "readonly numeric: boolean;",
    "readonly caseFirst: string;",
    "}",
    "interface IntlCollatorConstructor {",
    "new (locales?: string | readonly string[], options?: IntlCollatorOptions): IntlCollator;",
    "}",
    "interface IntlObject {",
    "readonly DateTimeFormat: IntlDateTimeFormatConstructor;",
    "readonly NumberFormat: IntlNumberFormatConstructor;",
    "readonly Collator: IntlCollatorConstructor;",
    "}",
    "declare var Intl: IntlObject;",
    "type JsonReplacer = (this: unknown, key: string, value: unknown) => unknown;",
    "interface JSON {",
    "stringify(value: unknown, replacer?: JsonReplacer | readonly (string | number)[] | null, space?: string | number): string | undefined;",
    "}",
    "interface ObjectConstructor {",
    "assign<T extends object, U extends object>(target: T, source: U): T & U;",
    "}",
    "interface ReadonlyMap<K, V> {",
    "forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void): void;",
    "}",
    "interface ReadonlySet<T> {",
    "forEach(callbackfn: (value: T, key: T, set: ReadonlySet<T>) => void): void;",
    "union(other: ReadonlySet<T>): Set<T>;",
    "intersection(other: ReadonlySet<T>): Set<T>;",
    "difference(other: ReadonlySet<T>): Set<T>;",
    "symmetricDifference(other: ReadonlySet<T>): Set<T>;",
    "isSubsetOf(other: ReadonlySet<T>): boolean;",
    "isSupersetOf(other: ReadonlySet<T>): boolean;",
    "isDisjointFrom(other: ReadonlySet<T>): boolean;",
    "}",
    "interface Date {",
    "valueOf(): number;",
    "getUTCFullYear(): number;",
    "getUTCMonth(): number;",
    "getUTCDate(): number;",
    "getUTCDay(): number;",
    "getUTCHours(): number;",
    "getUTCMinutes(): number;",
    "getUTCSeconds(): number;",
    "getUTCMilliseconds(): number;",
    "setTime(time: number): number;",
    "setUTCMilliseconds(ms: number): number;",
    "setUTCSeconds(sec: number, ms?: number): number;",
    "setUTCMinutes(min: number, sec?: number, ms?: number): number;",
    "setUTCHours(hours: number, min?: number, sec?: number, ms?: number): number;",
    "setUTCDate(date: number): number;",
    "setUTCMonth(month: number, date?: number): number;",
    "setUTCFullYear(year: number, month?: number, date?: number): number;",
    "toUTCString(): string;",
    "toJSON(): string | null;",
    "}",
    "interface Console {",
    "assert(condition?: boolean, ...data: unknown[]): void;",
    "clear(): void;",
    "count(label?: string): void;",
    "countReset(label?: string): void;",
    "debug(...data: unknown[]): void;",
    "dir(item?: unknown, options?: unknown): void;",
    "dirxml(...data: unknown[]): void;",
    "error(...data: unknown[]): void;",
    "group(...data: unknown[]): void;",
    "groupCollapsed(...data: unknown[]): void;",
    "groupEnd(): void;",
    "info(...data: unknown[]): void;",
    "log(...data: unknown[]): void;",
    "table(tabularData?: unknown, properties?: readonly string[]): void;",
    "time(label?: string): void;",
    "timeEnd(label?: string): void;",
    "timeLog(label?: string, ...data: unknown[]): void;",
    "timeStamp(label?: string): void;",
    "trace(...data: unknown[]): void;",
    "warn(...data: unknown[]): void;",
    "}",
    "declare function setTimeout(callback: () => void, delay?: int32): int32;",
    "declare function clearTimeout(id?: int32): void;",
    "declare function setInterval(callback: () => void, delay?: int32): int32;",
    "declare function clearInterval(id?: int32): void;",
    "interface SymbolConstructor {",
    "readonly match: unique symbol;",
    "readonly matchAll: unique symbol;",
    "readonly replace: unique symbol;",
    "readonly search: unique symbol;",
    "readonly species: unique symbol;",
    "readonly split: unique symbol;",
    "}",
    "interface RegExpNamedGroups {",
    "readonly [key: string]: string | undefined;",
    "}",
    "interface RegExpNamedIndices {",
    "readonly [key: string]: [int32, int32] | undefined;",
    "}",
    "interface RegExpMatchArray extends Array<string | undefined> {",
    "readonly index: int32 | undefined;",
    "readonly input: string | undefined;",
    "readonly groups: RegExpNamedGroups | undefined;",
    "readonly indices: RegExpIndicesArray | undefined;",
    "0: string;",
    "}",
    "interface RegExpExecArray extends Array<string | undefined> {",
    "readonly index: int32;",
    "readonly input: string;",
    "readonly groups: RegExpNamedGroups | undefined;",
    "readonly indices: RegExpIndicesArray | undefined;",
    "0: string;",
    "}",
    "interface RegExpIndicesArray extends Array<[int32, int32] | undefined> {",
    "readonly groups: RegExpNamedIndices | undefined;",
    "}",
    "interface RegExpStringIterator<T> extends IterableIterator<T> {",
    "[Symbol.iterator](): RegExpStringIterator<T>;",
    "}",
    "interface JsRegExpNamedGroups {",
    "readonly [key: string]: import(\"@tsonic/js/types.js\").JsString | undefined;",
    "}",
    "interface JsRegExpNamedIndices {",
    "readonly [key: string]: [int32, int32] | undefined;",
    "}",
    "interface JsRegExpMatchArray extends Array<import(\"@tsonic/js/types.js\").JsString | undefined> {",
    "readonly index: int32 | undefined;",
    "readonly input: import(\"@tsonic/js/types.js\").JsString | undefined;",
    "readonly groups: JsRegExpNamedGroups | undefined;",
    "readonly indices: JsRegExpIndicesArray | undefined;",
    "0: import(\"@tsonic/js/types.js\").JsString;",
    "}",
    "interface JsRegExpExecArray extends Array<import(\"@tsonic/js/types.js\").JsString | undefined> {",
    "readonly index: int32;",
    "readonly input: import(\"@tsonic/js/types.js\").JsString;",
    "readonly groups: JsRegExpNamedGroups | undefined;",
    "readonly indices: JsRegExpIndicesArray | undefined;",
    "0: import(\"@tsonic/js/types.js\").JsString;",
    "}",
    "interface JsRegExpIndicesArray extends Array<[int32, int32] | undefined> {",
    "readonly groups: JsRegExpNamedIndices | undefined;",
    "}",
    "interface JsRegExpStringIterator<T> extends IterableIterator<T> {",
    "[Symbol.iterator](): JsRegExpStringIterator<T>;",
    "}",
    "type RegExpReplaceCallback = (substring: string, ...args: any[]) => string;",
    "type JsRegExpReplaceCallback = (",
    "substring: import(\"@tsonic/js/types.js\").JsString,",
    "...args: any[]",
    ") => import(\"@tsonic/js/types.js\").JsString;",
    "interface RegExp {",
    "exec(string: string): RegExpExecArray | null;",
    "exec(string: import(\"@tsonic/js/types.js\").JsString): JsRegExpExecArray | null;",
    "test(string: string): boolean;",
    "test(string: import(\"@tsonic/js/types.js\").JsString): boolean;",
    "toString(): string;",
    "readonly source: string;",
    "readonly flags: string;",
    "readonly global: boolean;",
    "readonly ignoreCase: boolean;",
    "readonly multiline: boolean;",
    "readonly dotAll: boolean;",
    "readonly hasIndices: boolean;",
    "readonly sticky: boolean;",
    "readonly unicode: boolean;",
    "readonly unicodeSets: boolean;",
    "lastIndex: int32;",
    "[Symbol.match](string: string): RegExpMatchArray | null;",
    "[Symbol.match](string: import(\"@tsonic/js/types.js\").JsString): JsRegExpMatchArray | null;",
    "[Symbol.matchAll](string: string): RegExpStringIterator<RegExpExecArray>;",
    "[Symbol.matchAll](string: import(\"@tsonic/js/types.js\").JsString): JsRegExpStringIterator<JsRegExpExecArray>;",
    "[Symbol.replace](string: string, replaceValue: string): string;",
    "[Symbol.replace](string: string, replacer: RegExpReplaceCallback): string;",
    "[Symbol.replace](string: import(\"@tsonic/js/types.js\").JsString, replaceValue: import(\"@tsonic/js/types.js\").JsString): import(\"@tsonic/js/types.js\").JsString;",
    "[Symbol.replace](string: import(\"@tsonic/js/types.js\").JsString, replacer: JsRegExpReplaceCallback): import(\"@tsonic/js/types.js\").JsString;",
    "[Symbol.search](string: string): int32;",
    "[Symbol.search](string: import(\"@tsonic/js/types.js\").JsString): int32;",
    "[Symbol.split](string: string, limit?: int32): (string | undefined)[];",
    "[Symbol.split](string: import(\"@tsonic/js/types.js\").JsString, limit?: int32): (import(\"@tsonic/js/types.js\").JsString | undefined)[];",
    "}",
    "interface RegExpConstructor {",
    "new (pattern?: RegExp | string | import(\"@tsonic/js/types.js\").JsString, flags?: string): RegExp;",
    "(pattern?: RegExp | string | import(\"@tsonic/js/types.js\").JsString, flags?: string): RegExp;",
    "readonly prototype: RegExp;",
    "readonly [Symbol.species]: RegExpConstructor;",
    "escape(string: string): string;",
    "escape(string: import(\"@tsonic/js/types.js\").JsString): string;",
    "}",
    "declare var RegExp: RegExpConstructor;",
    "interface String {",
    "match(regexp: string | RegExp): RegExpMatchArray | null;",
    "match(matcher: { [Symbol.match](string: string): RegExpMatchArray | null }): RegExpMatchArray | null;",
    "matchAll(regexp: RegExp): RegExpStringIterator<RegExpExecArray>;",
    "matchAll(matcher: { [Symbol.matchAll](string: string): RegExpStringIterator<RegExpExecArray> }): RegExpStringIterator<RegExpExecArray>;",
    "replace(searchValue: string | RegExp, replaceValue: string): string;",
    "replace(searchValue: string | RegExp, replacer: RegExpReplaceCallback): string;",
    "replace(searchValue: { [Symbol.replace](string: string, replaceValue: string): string }, replaceValue: string): string;",
    "replace(searchValue: { [Symbol.replace](string: string, replacer: RegExpReplaceCallback): string }, replacer: RegExpReplaceCallback): string;",
    "replaceAll(searchValue: string | RegExp, replaceValue: string): string;",
    "replaceAll(searchValue: string | RegExp, replacer: RegExpReplaceCallback): string;",
    "replaceAll(searchValue: { [Symbol.replace](string: string, replaceValue: string): string }, replaceValue: string): string;",
    "replaceAll(searchValue: { [Symbol.replace](string: string, replacer: RegExpReplaceCallback): string }, replacer: RegExpReplaceCallback): string;",
    "search(regexp: string | RegExp): int32;",
    "search(searcher: { [Symbol.search](string: string): int32 }): int32;",
    "split(separator: string, limit?: int32): string[];",
    "split(separator: RegExp, limit?: int32): (string | undefined)[];",
    "split<T extends string | undefined>(splitter: { [Symbol.split](string: string, limit?: int32): T[] }, limit?: int32): T[];",
    "}",
    "interface IArguments {",
    "readonly length: int32;",
    "}",
    "interface RangeError extends Error {}",
    "interface RangeErrorConstructor {",
    "new (message?: string): RangeError;",
    "(message?: string): RangeError;",
    "}",
    "declare var RangeError: RangeErrorConstructor;",
    "interface TypeError extends Error {}",
    "interface TypeErrorConstructor {",
    "new (message?: string): TypeError;",
    "(message?: string): TypeError;",
    "}",
    "declare var TypeError: TypeErrorConstructor;",
    "interface URIError extends Error {}",
    "interface URIErrorConstructor {",
    "new (message?: string): URIError;",
    "(message?: string): URIError;",
    "}",
    "declare var URIError: URIErrorConstructor;",
    "interface TemplateStringsArray extends ReadonlyArray<string> {",
    "readonly raw: readonly string[];",
    "}",
    "interface Object {",
    "hasOwnProperty(key: PropertyKey): boolean;",
    "toString(): string;",
    "}",
    "interface ObjectConstructor {",
    "keys(value: object): string[];",
    "values<T>(value: { [key: string]: T } | ArrayLike<T>): T[];",
    "entries<T>(value: { [key: string]: T } | ArrayLike<T>): [string, T][];",
    "assign<T extends object, U extends object>(target: T, source: U): T & U;",
    "hasOwn(value: object, key: PropertyKey): boolean;",
    "is(value: unknown, other: unknown): boolean;",
    "getPrototypeOf(value: object): object | null;",
    "setPrototypeOf(value: object, prototype: object | null): object;",
    "create(value: object | null): object;",
    "defineProperty<T extends object>(target: T, propertyKey: PropertyKey, descriptor: object): T;",
    "defineProperties<T extends object>(target: T, properties: object): T;",
    "freeze<T extends object>(value: T): Readonly<T>;",
    "fromEntries<T = unknown>(entries: Iterable<readonly [PropertyKey, T]>): { [key: string]: T };",
    "getOwnPropertyDescriptor(value: object, propertyKey: PropertyKey): object | undefined;",
    "getOwnPropertyDescriptors(value: object): object;",
    "getOwnPropertyNames(value: object): string[];",
    "getOwnPropertySymbols(value: object): symbol[];",
    "isExtensible(value: object): boolean;",
    "isFrozen(value: object): boolean;",
    "isSealed(value: object): boolean;",
    "preventExtensions<T extends object>(value: T): T;",
    "seal<T extends object>(value: T): T;",
    "}",
    "declare var Object: ObjectConstructor;",
    "interface FunctionConstructor {",
    "new (...args: string[]): Function;",
    "(...args: string[]): Function;",
    "}",
    "declare var Function: FunctionConstructor;",
    "interface Boolean {",
    "toString(): string;",
    "valueOf(): boolean;",
    "}",
    "interface BooleanConstructor {",
    "new (value?: unknown): Boolean;",
    "(value?: unknown): boolean;",
    "}",
    "declare var Boolean: BooleanConstructor;",
    "interface Number {",
    "toString(radix?: int32): string;",
    "toLocaleString(locales?: string | string[], options?: object): string;",
    "valueOf(): number;",
    "toFixed(fractionDigits?: int32): string;",
    "toExponential(fractionDigits?: int32): string;",
    "toPrecision(precision?: int32): string;",
    "}",
    "interface NumberConstructor {",
    "readonly MAX_VALUE: number;",
    "readonly MIN_VALUE: number;",
    "readonly NaN: number;",
    "readonly NEGATIVE_INFINITY: number;",
    "readonly POSITIVE_INFINITY: number;",
    "readonly MAX_SAFE_INTEGER: number;",
    "readonly MIN_SAFE_INTEGER: number;",
    "readonly EPSILON: number;",
    "new (value?: unknown): Number;",
    "(value?: unknown): number;",
    "isFinite(value: unknown): boolean;",
    "isInteger(value: unknown): boolean;",
    "isNaN(value: unknown): boolean;",
    "isSafeInteger(value: unknown): boolean;",
    "parseFloat(value: string): number;",
    "parseInt(value: string, radix?: int32): number;",
    "}",
    "declare var Number: NumberConstructor;",
    "interface String {",
    "[Symbol.iterator](): IterableIterator<string>;",
    "readonly length: int32;",
    "readonly [index: int32]: string;",
    "startsWith(value: string, position?: int32): boolean;",
    "endsWith(value: string, endPosition?: int32): boolean;",
    "includes(value: string, position?: int32): boolean;",
    "trim(): string;",
    "trimStart(): string;",
    "trimEnd(): string;",
    "trimLeft(): string;",
    "trimRight(): string;",
    "toString(): string;",
    "valueOf(): string;",
    "charAt(index: int32): string;",
    "charCodeAt(index: int32): int32;",
    "codePointAt(index: int32): int32 | undefined;",
    "slice(start?: int32, end?: int32): string;",
    "substring(start: int32, end?: int32): string;",
    "substr(start: int32, length?: int32): string;",
    "indexOf(searchString: string, position?: int32): int32;",
    "lastIndexOf(searchString: string, position?: int32): int32;",
    "at(index: int32): string | undefined;",
    "concat(...strings: string[]): string;",
    "repeat(count: int32): string;",
    "padStart(maxLength: int32, fillString?: string): string;",
    "padEnd(maxLength: int32, fillString?: string): string;",
    "normalize(form?: string): string;",
    "localeCompare(that: string, locales?: string | string[], options?: object): int32;",
    "toLowerCase(): string;",
    "toUpperCase(): string;",
    "toLocaleLowerCase(locales?: string | string[]): string;",
    "toLocaleUpperCase(locales?: string | string[]): string;",
    "isWellFormed(): boolean;",
    "toWellFormed(): string;",
    "}",
    "interface StringConstructor {",
    "new (value?: unknown): String;",
    "(value?: unknown): string;",
    "raw(callSite: TemplateStringsArray, ...substitutions: unknown[]): string;",
    "fromCharCode(...codes: int32[]): string;",
    "fromCodePoint(...codes: int32[]): string;",
    "}",
    "declare var String: StringConstructor;",
    "interface Array<T> extends Iterable<T> {",
    "length: int32;",
    "[index: int32]: T;",
    "entries(): ArrayEntriesIterator<T>;",
    "push(...items: T[]): int32;",
    "pop(): T | undefined;",
    "shift(): T | undefined;",
    "unshift(...items: T[]): int32;",
    "slice(start?: int32, end?: int32): T[];",
    "splice(start: int32, deleteCount?: int32, ...items: T[]): T[];",
    "concat(...items: (T | readonly T[])[]): T[];",
    "join(separator?: string): string;",
    "indexOf(searchElement: T, fromIndex?: int32): int32;",
    "lastIndexOf(searchElement: T, fromIndex?: int32): int32;",
    "includes(searchElement: T, fromIndex?: int32): boolean;",
    "reverse(): T[];",
    "sort<TResult extends number | bigint = number>(compareFn?: (a: T, b: T) => TResult): T[];",
    "toSorted<TResult extends number | bigint = number>(compareFn?: (a: T, b: T) => TResult): T[];",
    "at(index: int32): T | undefined;",
    "forEach(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: T[]) => void): void;",
    "map<U>(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: T[]) => U): U[];",
    "filter(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: T[]) => unknown): T[];",
    "reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: import(\"@tsonic/core/types.js\").int32, array: T[]) => T): T;",
    "reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: import(\"@tsonic/core/types.js\").int32, array: T[]) => U, initialValue: U): U;",
    "some(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: T[]) => unknown): boolean;",
    "every(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: T[]) => unknown): boolean;",
    "find(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: T[]) => unknown): T | undefined;",
    "findIndex(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: T[]) => unknown): int32;",
    "findLast(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: T[]) => unknown): T | undefined;",
    "findLastIndex(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: T[]) => unknown): int32;",
    "fill(value: T, start?: int32, end?: int32): T[];",
    "copyWithin(target: int32, start: int32, end?: int32): T[];",
    "}",
    "interface ReadonlyArray<T> extends Iterable<T> {",
    "toSorted<TResult extends number | bigint = number>(compareFn?: (a: T, b: T) => TResult): T[];",
    "readonly length: int32;",
    "readonly [index: int32]: T;",
    "entries(): ArrayEntriesIterator<T>;",
    "slice(start?: int32, end?: int32): T[];",
    "concat(...items: (T | readonly T[])[]): T[];",
    "join(separator?: string): string;",
    "indexOf(searchElement: T, fromIndex?: int32): int32;",
    "lastIndexOf(searchElement: T, fromIndex?: int32): int32;",
    "includes(searchElement: T, fromIndex?: int32): boolean;",
    "at(index: int32): T | undefined;",
    "forEach(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: readonly T[]) => void): void;",
    "map<U>(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: readonly T[]) => U): U[];",
    "filter(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: readonly T[]) => unknown): T[];",
    "some(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: readonly T[]) => unknown): boolean;",
    "every(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: readonly T[]) => unknown): boolean;",
    "find(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: readonly T[]) => unknown): T | undefined;",
    "findIndex(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: readonly T[]) => unknown): int32;",
    "findLast(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: readonly T[]) => unknown): T | undefined;",
    "findLastIndex(callbackfn: (value: T, index: import(\"@tsonic/core/types.js\").int32, array: readonly T[]) => unknown): int32;",
    "}",
    "interface ArrayEntriesIterator<T> extends IterableIterator<[int32, T], undefined, unknown> {",
    "next(): IteratorResult<[int32, T], undefined>;",
    "[Symbol.iterator](): ArrayEntriesIterator<T>;",
    "}",
    "interface ArrayConstructor {",
    "new <T>(arrayLength: int32): T[];",
    "new <T>(...items: T[]): T[];",
    "<T>(arrayLength: int32): T[];",
    "<T>(...items: T[]): T[];",
    "isArray(value: unknown): value is unknown[];",
    "from(arrayLike: string): string[];",
    "from<T>(arrayLike: ArrayLike<T> | Iterable<T>): T[];",
    "from<T, U>(arrayLike: ArrayLike<T> | Iterable<T>, mapfn: (value: T, index: import(\"@tsonic/core/types.js\").int32) => U): U[];",
    "of<T>(...items: T[]): T[];",
    "}",
    "declare var Array: ArrayConstructor;",
    "interface BigInt {",
    "toString(radix?: int32): string;",
    "}",
    "interface BigIntConstructor {",
    "(value: bigint | boolean | number | string): bigint;",
    "asIntN(bits: int32, value: bigint): bigint;",
    "asUintN(bits: int32, value: bigint): bigint;",
    "}",
    "declare var BigInt: BigIntConstructor;",
    "interface Map<K, V> extends ReadonlyMap<K, V> {",
    "readonly size: int32;",
    "get(key: K): V | undefined;",
    "set(key: K, value: V): this;",
    "has(key: K): boolean;",
    "delete(key: K): boolean;",
    "clear(): void;",
    "keys(): IterableIterator<K>;",
    "values(): IterableIterator<V>;",
    "entries(): IterableIterator<[K, V]>;",
    "forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void): void;",
    "}",
    "interface ReadonlyMap<K, V> extends Iterable<[K, V]> {",
    "readonly size: int32;",
    "get(key: K): V | undefined;",
    "has(key: K): boolean;",
    "keys(): IterableIterator<K>;",
    "values(): IterableIterator<V>;",
    "entries(): IterableIterator<[K, V]>;",
    "}",
    "interface MapConstructor {",
    "new <K, V>(entries?: readonly (readonly [K, V])[] | Iterable<readonly [K, V]>): Map<K, V>;",
    "}",
    "declare var Map: MapConstructor;",
    "interface Set<T> extends ReadonlySet<T> {",
    "readonly size: int32;",
    "add(value: T): this;",
    "has(value: T): boolean;",
    "delete(value: T): boolean;",
    "clear(): void;",
    "keys(): IterableIterator<T>;",
    "values(): IterableIterator<T>;",
    "entries(): IterableIterator<[T, T]>;",
    "forEach(callbackfn: (value: T, key: T, set: Set<T>) => void): void;",
    "}",
    "interface ReadonlySet<T> extends Iterable<T> {",
    "readonly size: int32;",
    "has(value: T): boolean;",
    "keys(): IterableIterator<T>;",
    "values(): IterableIterator<T>;",
    "entries(): IterableIterator<[T, T]>;",
    "}",
    "interface SetConstructor {",
    "new <T>(values?: readonly T[] | Iterable<T>): Set<T>;",
    "}",
    "declare var Set: SetConstructor;",
    "interface Date {",
    "getFullYear(): int32;",
    "getMonth(): int32;",
    "getDate(): int32;",
    "getDay(): int32;",
    "getHours(): int32;",
    "getMinutes(): int32;",
    "getSeconds(): int32;",
    "getMilliseconds(): int32;",
    "getTimezoneOffset(): int32;",
    "getTime(): number;",
    "toString(): string;",
    "toISOString(): string;",
    "}",
    "interface DateConstructor {",
    "new (): Date;",
    "new (value: number | string): Date;",
    "(): string;",
    "now(): number;",
    "parse(value: string): number;",
    "UTC(year: int32, monthIndex: int32, date?: int32, hours?: int32, minutes?: int32, seconds?: int32, ms?: int32): number;",
    "}",
    "declare var Date: DateConstructor;",
    "interface JSON {",
    "parse(text: string): unknown;",
    "}",
    "declare var JSON: JSON;",
    "interface Math {",
    "readonly E: number;",
    "readonly LN2: number;",
    "readonly LN10: number;",
    "readonly LOG2E: number;",
    "readonly LOG10E: number;",
    "readonly PI: number;",
    "readonly SQRT1_2: number;",
    "readonly SQRT2: number;",
    "abs(x: number): number;",
    "acos(x: number): number;",
    "acosh(x: number): number;",
    "asin(x: number): number;",
    "asinh(x: number): number;",
    "atan(x: number): number;",
    "atanh(x: number): number;",
    "atan2(y: number, x: number): number;",
    "cbrt(x: number): number;",
    "floor(x: number): number;",
    "ceil(x: number): number;",
    "clz32(x: number): import(\"@tsonic/core/types.js\").int32;",
    "cos(x: number): number;",
    "cosh(x: number): number;",
    "exp(x: number): number;",
    "expm1(x: number): number;",
    "fround(x: number): number;",
    "hypot(...values: number[]): number;",
    "imul(x: number, y: number): import(\"@tsonic/core/types.js\").int32;",
    "log(x: number): number;",
    "log1p(x: number): number;",
    "log10(x: number): number;",
    "log2(x: number): number;",
    "round(x: number): number;",
    "max(...values: number[]): number;",
    "min(...values: number[]): number;",
    "pow(x: number, y: number): number;",
    "sign(x: number): number;",
    "sin(x: number): number;",
    "sinh(x: number): number;",
    "sqrt(x: number): number;",
    "tan(x: number): number;",
    "tanh(x: number): number;",
    "trunc(x: number): number;",
    "random(): number;",
    "}",
    "declare var Math: Math;",
    "interface Console {",
    "log(...data: unknown[]): void;",
    "error(...data: unknown[]): void;",
    "warn(...data: unknown[]): void;",
    "info(...data: unknown[]): void;",
    "debug(...data: unknown[]): void;",
    "trace(...data: unknown[]): void;",
    "assert(condition?: boolean, ...data: unknown[]): void;",
    "time(label?: string): void;",
    "timeLog(label?: string, ...data: unknown[]): void;",
    "timeEnd(label?: string): void;",
    "timeStamp(label?: string): void;",
    "count(label?: string): void;",
    "countReset(label?: string): void;",
    "group(...data: unknown[]): void;",
    "groupCollapsed(...data: unknown[]): void;",
    "groupEnd(): void;",
    "clear(): void;",
    "dir(item?: unknown, options?: unknown): void;",
    "dirxml(...data: unknown[]): void;",
    "table(tabularData?: unknown, properties?: readonly string[]): void;",
    "}",
    "declare var console: Console;",
    "declare function parseInt(value: string, radix?: int32): number;",
    "declare function parseFloat(value: string): number;",
    "declare function isNaN(value: number | bigint): boolean;",
    "declare function isFinite(value: number | bigint): boolean;",
    "declare function setTimeout(callback: () => void, delay?: int32): int32;",
    "declare function clearTimeout(id: int32): void;",
    "declare function setInterval(callback: () => void, delay?: int32): int32;",
    "declare function clearInterval(id: int32): void;",
    "declare function encodeURIComponent(value: string): string;",
    "declare function decodeURIComponent(value: string): string;",
    "interface ProxyConstructor {",
    "new <T extends object>(target: T, handler: object): T;",
    "revocable<T extends object>(target: T, handler: object): { proxy: T; revoke: () => void };",
    "}",
    "declare var Proxy: ProxyConstructor;",
    "declare function eval(source: string): unknown;",
    "interface DataView {",
    "getBigUint64(byteOffset: int32, littleEndian?: boolean): uint64;",
    "setBigUint64(byteOffset: int32, value: uint64, littleEndian?: boolean): void;",
    "}",
    "interface Uint8ArrayConstructor {",
    "new (): Uint8Array;",
    "from(values: readonly uint8[]): Uint8Array;",
    "from(values: Uint8Array): Uint8Array;",
    "}",
    "interface SharedArrayBuffer {",
    "readonly byteLength: int32;",
    "slice(begin?: int32, end?: int32): SharedArrayBuffer;",
    "}",
    "interface SharedArrayBufferConstructor {",
    "new (byteLength: int32): SharedArrayBuffer;",
    "readonly prototype: SharedArrayBuffer;",
    "}",
    "declare var SharedArrayBuffer: SharedArrayBufferConstructor;",
    "interface Atomics {",
    "wait(array: Int32Array, index: int32, value: int32, timeout?: number): \"ok\" | \"not-equal\" | \"timed-out\";",
    "notify(array: Int32Array, index: int32, count?: int32): int32;",
    "load(array: Int32Array, index: int32): int32;",
    "store(array: Int32Array, index: int32, value: int32): int32;",
    "}",
    "declare var Atomics: Atomics;"
  ]
];

test("every authored declaration text line survives the canonical split in original order", () => {
  domain(expectedTextLines.map(lines => lines.length), [107,32,18,841], "complete independently frozen original text domains");
  const actual = [...sourceLibraries.core.declarations, ...sourceLibraries.js.declarations];
  assert.equal(actual.length, 4);
  for (const [index, row] of actual.entries()) {
    domain(row.sourceText.split('\n').map(line => line.trim()).filter(Boolean), expectedTextLines[index], row.fileName);
  }
});
