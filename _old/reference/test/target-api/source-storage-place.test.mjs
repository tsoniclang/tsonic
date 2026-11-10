import assert from "node:assert/strict";
import test from "node:test";
import { sourcePrimitive } from "@tsonic/tsts";
import { getTargetCompilationPaths, resolveProjectPaths } from "../../packages/host/dist/index.js";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

const typesModule = "@example/native/types.js";
const langModule = "@example/native/lang.js";
const langDeclaration = `
import type { ptr } from './types.js';
export declare function out<T>(value: T): T;
export declare function ref<T>(value: T): T;
export declare function inref<T>(value: T): T;
export declare function borrow<T>(value: T): T;
export declare function borrowMut<T>(value: T): T;
export declare function move<T>(value: T): T;
export declare function addressOf<T>(storage: T): ptr<T>;
export declare function allocatePointer<T>(initial: T): ptr<T>;
export declare function loadPointer<T>(pointer: ptr<T>): T;
export declare function storePointer<T>(pointer: ptr<T>, value: T): void;
export declare function equalPointer<T>(left: ptr<T> | undefined, right: ptr<T> | undefined): boolean;
export declare function hashPointer<T>(pointer: ptr<T> | undefined): number;
export declare function bindPointer<T>(identity: object, read: () => T, write: (value: T) => void): ptr<T>;
export declare function projectPointer<F, T>(pointer: ptr<F> | undefined, fromSource: (value: F) => T, toSource: (value: T) => F): ptr<T> | undefined;
`;

function fixture(sourceText, files = {}) {
  const targetPack = createCsharpTargetPack();
  const target = { id: "csharp", options: { outputType: "Library" } };
  const project = { entryPoint: "index.ts", rootDir: ".", targets: [target] };
  const paths = getTargetCompilationPaths(resolveProjectPaths({ projectFilePath: "/src/tsonic.json", project }), target);
  const semanticsModules = [
    { moduleSpecifier: typesModule, packageName: "@example/native", subpath: "types.js", exports: [
      sourcePrimitive("int", "int32", "number", true, 32), { kind: "type-marker", exportName: "ptr", marker: "pointer" },
    ] },
    { moduleSpecifier: langModule, packageName: "@example/native", subpath: "lang.js", exports: [
      ["out", "write-only-reference"], ["ref", "read-write-reference"], ["inref", "read-only-reference"],
      ["borrow", "shared-borrow"], ["borrowMut", "mutable-borrow"], ["move", "move"], ["addressOf", "address-of"],
      ["allocatePointer", "allocate"], ["loadPointer", "load"], ["storePointer", "store"],
      ["equalPointer", "equal-pointer"], ["hashPointer", "hash-pointer"], ["bindPointer", "bind-pointer"],
      ["projectPointer", "project-pointer"],
    ].map(([exportName, marker]) => ({ kind: "call-marker", exportName, marker })) },
  ];
  const checked = checkSourceProgramFixture({
    project, projectDirectory: "/src", currentDirectory: "/src", target, targetPack, paths,
    selectedCapabilities: [], selectedSurfaces: [],
    files: {
      "/src/index.ts": sourceText,
      "/src/node_modules/@example/native/package.json": JSON.stringify({ name: "@example/native", version: "1.0.0", type: "module",
        exports: { "./types.js": { types: "./types.d.ts", default: "./types.js" }, "./lang.js": { types: "./lang.d.ts", default: "./lang.js" } } }),
      "/src/node_modules/@example/native/types.d.ts": "export type int = number; export type ptr<T> = T;",
      "/src/node_modules/@example/native/lang.d.ts": langDeclaration,
      ...files,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    targetContributions: base => ({ ...base, semanticsModules: [...(base.semanticsModules ?? []), ...semanticsModules] }),
  });
  assert.equal(checked.kind === "resolved", true, checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  assert.equal(checked.diagnostics.length === 0, true, "the normal source entry preserves checker, extension and Source diagnostics");
  const source = checked.value;
  const file = source.sourceFiles.find(node => source.ast.getFileName(node) === "/src/index.ts");
  assert.equal(file !== undefined, true, "the original project file exists");
  const nodes = source.facts.navigation.nodesForFiles([file]);
  const initializer = name => {
    const selected = nodes.filter(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === name);
    assert.equal(selected.length === 1, true, `${name}: one original declaration`);
    const value = source.ast.as.AsVariableDeclaration(selected[0]).Initializer;
    assert.equal(value !== undefined, true, `${name}: original initializer`);
    return value;
  };
  const refused = (call, site) => {
    const selected = source.facts.protocols.pointerOperation(call);
    assert.equal(selected.kind === "refused" && selected.source === "tsonic" &&
      selected.code === "TSONIC_SOURCE_FORM_UNSUPPORTED" && selected.site === site, true,
    "the canonical Source refusal retains the exact original operation or operand site");
    assert.equal(source.facts.protocols.pointerOperation(call) === selected, true, "the exact refusal object is retained");
  };
  return { source, initializer, refused };
}

test("canonical Source places retain the original typed-pointer readonly, expression and constant negatives", () => {
  const current = fixture(`
    import type { int, ptr } from "@example/native/types.js";
    import {
      addressOf,
      addressOf as takeAddress,
      allocatePointer,
      loadPointer,
      storePointer,
      equalPointer,
      hashPointer,
      bindPointer,
      projectPointer,
    } from "@example/native/lang.js";
    import * as lang from "@example/native/lang.js";
    import { addressOf as localAddressOf } from "./local.js";

    interface Box { value: int; readonly frozen: int; }
    interface Slots { [index: number]: int; }

    let value!: int;
    let box!: Box;
    let slots!: Slots;
    const direct = addressOf(value);
    const aliased = takeAddress(box.value);
    const indexed = addressOf(slots[0]);
    const allocated = lang.allocatePointer<int>(2);
    const loaded = loadPointer(direct);
    storePointer(allocated, loaded);
    const equal = equalPointer(direct, aliased);
    const nilEqual = equalPointer<int>(undefined, undefined);
    const hash = hashPointer(direct);
    const storage = { value: 3 };
    const bound = bindPointer<int>(
      storage,
      () => storage.value,
      (next) => { storage.value = next; },
    );
    const projected = projectPointer<int, int>(
      direct,
      (source) => source,
      (target) => target,
    );
    const rejected = addressOf(box.frozen);
    const rejectedExpression = addressOf(value + 1);
    const constant: int = 1;
    const rejectedConstant = addressOf(constant);
    const local = localAddressOf(value);
  `, { "/src/local.ts": "export type LocalPointer<T> = { value: T }; export function addressOf<T>(value: T): LocalPointer<T> { return { value }; }" });
  for (const name of ["direct", "aliased", "indexed"]) {
    const call = current.initializer(name);
    const selected = current.source.facts.protocols.pointerOperation(call);
    assert.equal(selected.kind === "resolved" && selected.value.kind === "present" &&
      selected.value.value.family === "typed-location" && selected.value.value.operation === "address-of", true,
    `${name}: original mutable place remains admitted`);
  }
  for (const name of ["rejected", "rejectedExpression", "rejectedConstant"]) {
    const call = current.initializer(name);
    current.refused(call, current.source.ast.arguments(call)[0]);
  }
  const local = current.source.facts.protocols.pointerOperation(current.initializer("local"));
  assert.equal(local.kind === "resolved" && local.value.kind === "none", true, "an unrelated local function has no pointer marker");
});

test("canonical Source places preserve imported and reexported constant versus mutable identity", () => {
  const current = fixture(`
    import { addressOf } from "@example/native/lang.js";
    import { fixed, mutable } from "./values.js";
    import { fixed as reexportedFixed, mutable as reexportedMutable } from "./exports.js";
    const first = addressOf(mutable);
    const second = addressOf(reexportedMutable);
    const invalid = addressOf(fixed);
    const invalidAlias = addressOf(reexportedFixed);
  `, {
    "/src/values.ts": `import type { int } from "@example/native/types.js";
      export const fixed: int = 7; export let mutable: int = 11;`,
    "/src/exports.ts": `export { fixed, mutable } from "./values.js";`,
  });
  const declarations = [];
  for (const name of ["first", "second"]) {
    const selected = current.source.facts.protocols.pointerOperation(current.initializer(name));
    assert.equal(selected.kind === "resolved" && selected.value.kind === "present" &&
      selected.value.value.operation === "address-of" && selected.value.value.declaration.kind === "present", true,
    `${name}: exact mutable imported declaration remains admitted`);
    declarations.push(selected.value.value.declaration.value);
  }
  assert.equal(declarations[0] === declarations[1], true, "both aliases retain the same original mutable declaration");
  for (const name of ["invalid", "invalidAlias"]) {
    const call = current.initializer(name);
    current.refused(call, current.source.ast.arguments(call)[0]);
  }
});

test("canonical Source argument passing retains the original out(value + 1) refusal", () => {
  const current = fixture(`
    import { out, ref as refArg, inref, borrow, borrowMut, move } from "@example/native/lang.js";
    import { out as localOut } from "./local.js";

    let value!: number;
    out(value);
    refArg(value);
    inref(value);
    borrow(value);
    borrowMut(value);
    move(value);
    out(value + 1);
    localOut(value);
  `, { "/src/local.ts": "export function out<T>(value: T): T { return value; }" });
  const { ast } = current.source;
  const file = current.source.sourceFiles.find(sourceFile => ast.getFileName(sourceFile) === "/src/index.ts");
  const calls = current.source.facts.navigation.nodesForFiles([file]).filter(ast.is.IsCallExpression);
  const negatives = calls.filter(call => ast.arguments(call).some(argument => ast.is.IsBinaryExpression(argument)));
  assert.equal(negatives.length === 1, true, "the original negative occurrence is unique");
  const operand = ast.arguments(negatives[0])[0];
  const selected = current.source.facts.protocols.argumentPassing(negatives[0]);
  assert.equal(selected.kind === "refused" && selected.code === "TSONIC_SOURCE_FORM_UNSUPPORTED" && selected.site === operand,
    true, "out(value + 1) is refused at its original operand, not lost with the Legacy diagnostic");
  assert.equal(current.source.facts.protocols.argumentPassing(negatives[0]) === selected, true, "the same Source refusal object is forwarded");
  for (const call of calls.filter(call => call !== negatives[0])) {
    const selected = current.source.facts.protocols.argumentPassing(call);
    const local = ast.text(ast.as.AsCallExpression(call).Expression) === "localOut";
    assert.equal(selected.kind === "resolved" && (local ? selected.value.kind === "none"
      : selected.value.kind === "present" && selected.value.value.role === "argument" &&
        selected.value.value.storageExpression === ast.arguments(call)[0]), true,
    "original valid marker operands and the unmarked local function retain their factual identities");
  }
});

test("ADDITIVE recognized nongeneric pointer marker retains an explicit missing-pointee Source refusal", () => {
  const current = fixture(`
    import { addressOf } from "@example/native/lang.js";
    let value!: number;
    const pointer = addressOf(value);
  `, { "/src/node_modules/@example/native/lang.d.ts": "export declare function addressOf(storage: unknown): unknown;" });
  const call = current.initializer("pointer");
  current.refused(call, call);
});
