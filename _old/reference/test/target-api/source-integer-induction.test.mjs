import assert from "node:assert/strict";
import test from "node:test";
import { getTargetCompilationPaths, resolveProjectPaths } from "../../packages/host/dist/index.js";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

const profile = `
interface Object {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments {}
interface Boolean {}
interface Number {}
interface String {}
interface RegExp {}
interface Array<T> { length: number; [index: number]: T; }
interface Iterator<T> { next(): { value: T; done?: boolean }; }
interface SymbolConstructor { readonly iterator: unique symbol; }
declare var Symbol: SymbolConstructor;
`;

function fixture(text) {
  const targetPack = createCsharpTargetPack();
  const target = { id: "csharp", options: { outputType: "Library" } };
  const project = { entryPoint: "index.ts", rootDir: ".", targets: [target] };
  const paths = getTargetCompilationPaths(resolveProjectPaths({ projectFilePath: "/src/tsonic.json", project }), target);
  const checked = checkSourceProgramFixture({ project, projectDirectory: "/src", currentDirectory: "/src", target, targetPack, paths,
    selectedCapabilities: [], selectedSurfaces: [],
    files: {
      "/src/profile.d.ts": profile, "/src/index.ts": text,
      "/src/node_modules/@tsonic/core/package.json": JSON.stringify({ name: "@tsonic/core", version: "1.0.0", type: "module",
        exports: { "./types.js": "./types.d.ts", "./lang.js": "./lang.d.ts" } }),
      "/src/node_modules/@tsonic/core/types.d.ts": "export type int32 = number; export type Pointer<T> = { readonly value: T };",
      "/src/node_modules/@tsonic/core/lang.d.ts": `import type { Pointer } from './types.js';
        export declare function addressof<T>(value: T): Pointer<T>; export declare function readwriteref<T>(value: T): T;`,
    },
    rootFiles: ["/src/profile.d.ts", "/src/index.ts"],
    compilerOptions: { strict: true, noLib: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
  });
  assert.equal(checked.kind === "resolved", true, checked.diagnostics.map(issue => issue.message).join("\n").slice(0, 4096));
  assert.equal(checked.diagnostics.length, 0, "the original full program retains checker, extension and Source diagnostics");
  const source = checked.value;
  const file = source.sourceFiles.find(node => source.ast.getFileName(node) === "/src/index.ts");
  assert.equal(file !== undefined, true, "the original loop file exists");
  const declarations = source.facts.navigation.nodesForFiles([file]).filter(node => source.ast.is.IsVariableDeclaration(node) &&
    source.ast.text(source.ast.name(node)) === "index");
  const proof = declaration => {
    const selected = source.facts.integers.induction(declaration);
    assert.equal(selected.kind === "resolved", true, "the original counter has its exact completed Source outcome");
    if (selected.value.kind === "present") assert.equal(selected.value.value.counterDeclaration === declaration, true);
    return selected.value.kind === "present";
  };
  return { source, declarations, proof };
}

test("bounded induction proves only unchanged zero-based counters with representation-independent uses", () => {
  const current = fixture(`
    declare function consume(value: number): void;
    function loops(values: { length: number; [index: number]: number }) {
      for (let index = 0; index < values.length; index++) consume(values[index]);
      for (let index = 0; index < values.length; index++) { consume(values[index]); values.length++; }
      for (let index: number = 0; index < values.length; index++) consume(values[index]);
      for (let index = 0; index <= values.length; index++) consume(values[index]);
      for (let index = 0.5; index < values.length; index++) consume(values[index]);
      for (let index = 0; index < values.length; index++) { index += 0.5; consume(values[index]); }
      for (let index = 0; index < values.length; index++) consume(index / 2);
      for (let index = 0; index < values.length; index++) { const alias = index; consume(alias / 2); }
      for (let index = 0; index < values.length; index++) { const captured = () => index; consume(captured()); }
      for (let index = 0; index < values.length; index++) consume(index);
    }
  `);
  assert.deepEqual(current.declarations.map(current.proof),
    [true, true, false, false, false, false, false, false, false, false]);
});

test("integer call uses require exact project parameter and by-value evidence", () => {
  const original = `
    import type { int32 } from "@tsonic/core/types.js";
    import { addressof } from "@tsonic/core/lang.js";
    function copy(value: int32): int32 { value++; return value; }
    function floating(value: number): number { return value; }
    declare function external(value: int32): void;
    export function loops(bound: int32): void {
      for (let index = 0; index < bound; index++) copy(index);
      for (let index = 0; index < bound; index++) floating(index);
      for (let index = 0; index < bound; index++) external(index);
      for (let index = 0; index < bound; index++) addressof(index);
    }
  `;
  const current = fixture(original);
  assert.deepEqual(current.declarations.map(current.proof), [true, false, false, false]);
  const referencePassing = fixture(`import { readwriteref } from "@tsonic/core/lang.js";\n${original.replace("copy(index);", "copy(readwriteref(index));")}`);
  assert.deepEqual(referencePassing.declarations.map(referencePassing.proof), [false, false, false, false],
    "the genuine configured reference marker replaces the detached fact override");
  assert.throws(() => current.source.facts.integers.induction(referencePassing.declarations[0]), /exact original node/u,
    "the mandatory same-program premise cannot be replaced by missing or foreign facts");
});
