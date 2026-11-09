import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import childProcess from "node:child_process";
import filesystem from "node:fs";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compileHostModuleInIsolation } from "../scripts/host-isolated.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const compiler = resolve(repository, "node_modules/@typescript/native-preview/bin/tsgo.js");
const temporary = resolve(repository, ".temp/host-isolation-fixtures");
const model = "packages/host/src/model/contract.ts";
const contract = "packages/host/src/constants/contract.ts";
const implementation = "packages/host/src/constants/value.ts";
const lawful = new Map([
  [model, "export interface Fact { readonly value: number; }"],
  [contract, 'import type { Fact } from "../model/contract.js"; export interface Answer { readonly fact: Fact; }'],
  [implementation, 'import type { Fact } from "../model/contract.js"; export function value(fact: Fact): number { return fact.value + 1; }'],
]);

async function fixture(files, body) {
  mkdirSync(temporary, { recursive: true });
  const root = mkdtempSync(resolve(temporary, "case-"));
  try {
    for (const [file, text] of files) {
      mkdirSync(dirname(resolve(root, file)), { recursive: true });
      writeFileSync(resolve(root, file), text);
    }
    const input = { root, module: "constants", sourceFiles: [contract, implementation], dependencyContracts: [model],
      outputDirectory: ".temp/isolation" };
    return await body(input);
  } finally { rmSync(root, { recursive: true }); }
}

test("a complete whole module compiles against freshly checked declarations without peer implementations", async () => {
  await fixture(lawful, async input => {
    const result = await compileHostModuleInIsolation(input);
    assert.equal(result.kind, "passed", result.log.slice(0, 4096));
    assert.equal(Object.isFrozen(result), true);
    assert.equal((result.log.match(/strict compiler exit=0/gu) ?? []).length, 2,
      "both fresh dependency checking and the isolated current module ran");
    assert.deepEqual(readdirSync(resolve(input.root, input.outputDirectory)), [], "only this operation's rebuildable stage is disposed");
  });
});

test("Host I/O isolation checks its real installed platform declarations without exposing peer implementations", async () => {
  const contract = "packages/host/src/project/contract.ts";
  const implementation = "packages/host/src/project/paths.ts";
  const files = new Map([
    [contract, "export interface FileName { readonly value: string; }"],
    [implementation, 'import { isAbsolute } from "node:path"; export function absolute(value: string): boolean { return value.length > 0 && isAbsolute(value); }'],
  ]);
  await fixture(files, async input => {
    const result = await compileHostModuleInIsolation({ ...input, module: "project", sourceFiles: [contract, implementation], dependencyContracts: [] });
    assert.equal(result.kind, "passed", result.log.slice(-4096));
    assert.match(result.log, /@types\/node/u);
    assert.deepEqual(readdirSync(resolve(input.root, input.outputDirectory)), []);
  });
});

test("only Ingress implementation uses the real pinned checker declarations behind a closed contract", async () => {
  const contract = "packages/host/src/ingress/contract.ts";
  const implementation = "packages/host/src/ingress/reader.ts";
  const files = new Map([
    [contract, "export interface Observation { readonly flags: number; }"],
    [implementation, 'import type { Type } from "@tsonic/tsts"; export function flags(type: Type): number { return type.flags; }'],
  ]);
  await fixture(files, async input => {
    const result = await compileHostModuleInIsolation({ ...input, module: "ingress", sourceFiles: [contract, implementation], dependencyContracts: [] });
    assert.equal(result.kind, "passed", result.log.slice(0, 4096));
    assert.match(result.log, /packages\/tsts\/dist/u);
    assert.deepEqual(readdirSync(resolve(input.root, input.outputDirectory)), []);
  });
});

test("private type-only dependencies cannot pass by including a peer implementation", async () => {
  const files = new Map(lawful);
  files.set(implementation, 'import type { Private } from "../model/private.js"; export function value(input: Private): number { return input.value; }');
  files.set("packages/host/src/model/private.ts", "export interface Private { readonly value: number; }");
  await fixture(files, async input => {
    const result = await compileHostModuleInIsolation(input);
    assert.equal(result.kind, "failed");
    assert.match(result.log, /isolated-compile/u);
    assert.deepEqual(readdirSync(resolve(input.root, input.outputDirectory)), []);
  });
});

test("dependency contracts list the entire freshly checked same-owner data closure explicitly", async () => {
  const data = "packages/host/src/model/data.ts";
  const files = new Map(lawful);
  files.set(model, 'export type { Fact } from "./data.js";');
  files.set(data, "export interface Fact { readonly value: number; }");
  await fixture(files, async input => {
    const missing = await compileHostModuleInIsolation(input);
    assert.equal(missing.kind, "failed");
    assert.match(missing.log, /isolated-compile/u);
    const result = await compileHostModuleInIsolation({ ...input, dependencyContracts: [model, data] });
    assert.equal(result.kind, "passed", result.log.slice(0, 4096));
    writeFileSync(resolve(input.root, data), "export interface Fact { readonly value: number; } export function hidden() { return 1; }");
    const implementationLeak = await compileHostModuleInIsolation({ ...input, dependencyContracts: [model, data] });
    assert.equal(implementationLeak.kind, "failed");
    assert.match(implementationLeak.log, /contract-closure/u);
    await assert.rejects(compileHostModuleInIsolation({ ...input, dependencyContracts: [data] }), /explicit same-owner/u);
  });
});

test("a target-neutral external consumer typechecks against only the real fresh Publication contract", async () => {
  const publication = "packages/host/src/publication/contract.ts";
  const files = new Map([[publication, "export interface Published { readonly value: number; }"]]);
  await fixture(files, async input => {
    const result = await compileHostModuleInIsolation({ ...input, module: "publication", sourceFiles: [publication], dependencyContracts: [] });
    assert.equal(result.kind, "passed", result.log.slice(0, 4096));
    const consumer = resolve(input.root, "consumer.ts");
    writeFileSync(consumer, 'import type { Published } from "./packages/host/src/publication/contract.js"; export function read(value: Published): number { return value.value; }');
    writeFileSync(resolve(input.root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
      strict: true, skipLibCheck: false, noEmitOnError: true, declaration: true, emitDeclarationOnly: true,
      types: [], target: "es2022", module: "nodenext", rootDir: "packages/host/src/publication", outDir: "checked",
    }, files: [publication] }));
    const emitted = spawnSync(process.execPath, [compiler, "--project", resolve(input.root, "tsconfig.json")],
    { cwd: input.root, encoding: "utf8", maxBuffer: 1_048_576, timeout: 60_000 });
    if (emitted.error !== undefined) throw emitted.error;
    assert.equal(emitted.status, 0, `${emitted.stdout}${emitted.stderr}`.slice(0, 8192));
    rmSync(resolve(input.root, publication));
    const generated = resolve(input.root, "checked/contract.d.ts");
    assert.equal(existsSync(generated), true, "the actual fresh Publication declaration exists before consumer checking");
    writeFileSync(consumer, 'import type { Published } from "./checked/contract.js"; export function read(value: Published): number { return value.value; }');
    writeFileSync(resolve(input.root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
      strict: true, skipLibCheck: false, noEmit: true, types: [], target: "es2022", module: "nodenext",
    }, files: ["consumer.ts"] }));
    const compiled = spawnSync(process.execPath, [compiler, "--project", resolve(input.root, "tsconfig.json")],
    { cwd: input.root, encoding: "utf8", maxBuffer: 1_048_576, timeout: 60_000 });
    if (compiled.error !== undefined) throw compiled.error;
    assert.equal(compiled.status, 0, `${compiled.stdout}${compiled.stderr}`.slice(0, 8192));
  });
});

test("real typed readonly Publication data rejects mutation while mutable aliases are valid TypeScript but fail the gate", async () => {
  const publication = "packages/host/src/publication/contract.ts";
  const files = new Map([
    [model, `
      export type Values = readonly number[];
      export type Tuple = readonly [head: number, ...tail: string[]];
      export interface Row { readonly values: Values; }
    `],
    [publication, `
      import type { Values, Tuple, Row } from "../model/contract.js";
      export interface Published {
        readonly values: Values; readonly tuple: Tuple; readonly nested: ReadonlyArray<Row>;
        read(): Values;
        calculate(values: Values, operation: (value: number) => number): number;
      }
    `],
  ]);
  await fixture(files, async input => {
    const request = { ...input, module: "publication", sourceFiles: [publication], dependencyContracts: [model] };
    const result = await compileHostModuleInIsolation(request);
    assert.equal(result.kind, "passed", result.log.slice(0, 4096));
    const consumer = resolve(input.root, "consumer.ts");
    writeFileSync(resolve(input.root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
      strict: true, skipLibCheck: false, noEmit: true, types: [], target: "es2022", module: "nodenext",
    }, files: [model, publication, "consumer.ts"] }));
    const check = () => {
      const compiled = spawnSync(process.execPath, [compiler, "--project", resolve(input.root, "tsconfig.json")],
      { cwd: input.root, encoding: "utf8", maxBuffer: 1_048_576, timeout: 60_000 });
      if (compiled.error !== undefined) throw compiled.error;
      return { status: compiled.status, log: `${compiled.stdout}${compiled.stderr}` };
    };
    writeFileSync(consumer, `
      import type { Published } from "./packages/host/src/publication/contract.js";
      export function read(view: Published): number {
        return view.values.length + view.tuple[0] + view.nested.length + view.read().length +
          view.calculate(view.values, value => value + 1);
      }
    `);
    const valid = check();
    assert.equal(valid.status, 0, valid.log.slice(0, 4096));
    writeFileSync(consumer, `
      import type { Published } from "./packages/host/src/publication/contract.js";
      export function mutate(view: Published): void {
        view.values.push(1);
        view.tuple[0] = 2;
        view.nested[0] = { values: [] };
        view.read().splice(0);
      }
    `);
    const immutable = check();
    assert.deepEqual([...immutable.log.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])), [2339, 2540, 2542, 2339],
      immutable.log.slice(0, 4096));
    assert.equal(immutable.status, 1, immutable.log.slice(0, 4096));
    writeFileSync(resolve(input.root, model), "export type Values = number[]; export type Indirect = Values;");
    writeFileSync(resolve(input.root, publication), `
      import type { Indirect } from "../model/contract.js";
      export interface Published { readonly values: Indirect; }
    `);
    writeFileSync(consumer, `
      import type { Published } from "./packages/host/src/publication/contract.js";
      export function mutate(view: Published): void { view.values.push(1); view.values[0] = 2; }
    `);
    const mutable = check();
    assert.equal(mutable.status, 0, mutable.log.slice(0, 4096));
    const rejected = await compileHostModuleInIsolation(request);
    assert.equal(rejected.kind, "failed");
    assert.match(rejected.log, /contract-closure/u);
    assert.match(rejected.log, /read-only-publication/u);
  });
});

test("fresh contract emission rejects private declaration leaks and never trusts a stale declaration", async () => {
  const files = new Map(lawful);
  files.set(model, 'export type Fact = import("./private.js").Private;');
  files.set("packages/host/src/model/private.ts", "export interface Private { readonly value: number; }");
  files.set("packages/host/dist/model/contract.d.ts", "export interface Fact { readonly value: number; }");
  await fixture(files, async input => {
    const result = await compileHostModuleInIsolation(input);
    assert.equal(result.kind, "failed");
    assert.match(result.log, /isolated-compile/u);
    assert.equal(existsSync(resolve(input.root, "packages/host/dist/model/contract.d.ts")), true,
      "the caller's unrelated output is neither used nor removed");
  });
});

test("compiler-resolved ambient dependencies cannot escape through ancestor package lookup", async () => {
  const files = new Map(lawful);
  files.set(model, '/// <reference types="ambient-peer" />\nexport interface Fact { readonly value: number; }');
  files.set("node_modules/ambient-peer/package.json", JSON.stringify({ name: "ambient-peer", types: "index.d.ts" }));
  files.set("node_modules/ambient-peer/index.d.ts", "interface HiddenPeer { readonly value: number; }");
  await fixture(files, async input => {
    const result = await compileHostModuleInIsolation(input);
    assert.equal(result.kind, "failed");
    assert.match(result.log, /Compiler resolved an undeclared source or peer declaration/u);
    assert.deepEqual(readdirSync(resolve(input.root, input.outputDirectory)), []);
  });
});

test("strict dependency and module compiler failures are returned with actual diagnostics", async () => {
  for (const file of [model, implementation]) {
    const files = new Map(lawful);
    files.set(file, file === model ? "export interface Fact { readonly value: number; } export const broken: string = 1;"
      : "export function value(): number { return 'wrong'; }");
    await fixture(files, async input => {
      const result = await compileHostModuleInIsolation(input);
      assert.equal(result.kind, "failed");
      assert.match(result.log, /TS2322/u);
      assert.deepEqual(readdirSync(resolve(input.root, input.outputDirectory)), []);
    });
  }
});

test("successive isolation runs emit the actual current dependency rather than reuse an old success", async () => {
  await fixture(lawful, async input => {
    const first = await compileHostModuleInIsolation(input);
    assert.equal(first.kind, "passed", first.log.slice(0, 4096));
    writeFileSync(resolve(input.root, model), "export interface Fact { readonly value: string; }");
    const changed = await compileHostModuleInIsolation(input);
    assert.equal(changed.kind, "failed");
    assert.match(changed.log, /TS2322/u);
  });
});

test("source inventory, paths, contract closure and admitted execution are authenticated before compilation", async () => {
  await fixture(lawful, async input => {
    await assert.rejects(compileHostModuleInIsolation({ ...input, sourceFiles: [contract] }), /complete exact/u);
    await assert.rejects(compileHostModuleInIsolation({ ...input, module: "missing" }), /declared whole/u);
    await assert.rejects(compileHostModuleInIsolation({ ...input, dependencyContracts: [model, model] }), /distinct/u);
    await assert.rejects(compileHostModuleInIsolation({ ...input, outputDirectory: "../outside" }), /disposable/u);
    await assert.rejects(compileHostModuleInIsolation({ ...input, dependencyContracts: ["../outside.ts"] }), /canonical/u);
    await assert.rejects(compileHostModuleInIsolation({ ...input, dependencyContracts: [implementation] }), /original declared/u);
    writeFileSync(resolve(input.root, "packages/host/src/constants/readme.txt"), "not a source file");
    mkdirSync(resolve(input.root, "packages/host/src/constants/nested"));
    writeFileSync(resolve(input.root, "packages/host/src/constants/nested/extra.ts"), "export interface Extra { readonly value: number; }");
    await assert.rejects(compileHostModuleInIsolation(input), /complete exact/u);
    rmSync(resolve(input.root, "packages/host/src/constants/nested"), { recursive: true });
    symlinkSync(resolve(input.root, model), resolve(input.root, "packages/host/src/constants/hidden.ts"));
    await assert.rejects(compileHostModuleInIsolation(input), /symlink/u);
  });
  await fixture(lawful, async input => {
    const admission = process.env.TSONIC_TEST_ADMISSION;
    try {
      delete process.env.TSONIC_TEST_ADMISSION;
      await assert.rejects(compileHostModuleInIsolation(input), /admitted process-group/u);
    } finally { process.env.TSONIC_TEST_ADMISSION = admission; }
  });
  await fixture(lawful, async input => {
    rmSync(resolve(input.root, contract));
    await assert.rejects(compileHostModuleInIsolation({ ...input, sourceFiles: [implementation] }), /actual contract/u);
  });
  await fixture(lawful, async input => {
    await assert.rejects(compileHostModuleInIsolation({ ...input, module: "model", sourceFiles: [model], dependencyContracts: [contract] }), /declared dependency closure/u);
  });
  await fixture(lawful, async input => {
    symlinkSync(repository, resolve(input.root, "foreign"));
    await assert.rejects(compileHostModuleInIsolation({ ...input, dependencyContracts: ["foreign/package.json"] }), /escapes/u);
    mkdirSync(resolve(input.root, ".temp"));
    symlinkSync(repository, resolve(input.root, ".temp/foreign"));
    await assert.rejects(compileHostModuleInIsolation({ ...input, outputDirectory: ".temp/foreign" }), /escapes/u);
    symlinkSync(resolve(input.root, model), resolve(input.root, "packages/host/src/model/alias.ts"));
    await assert.rejects(compileHostModuleInIsolation({ ...input, dependencyContracts: [model, "packages/host/src/model/alias.ts"] }), /original owned/u);
  });
});

test("missing compiler and original compiler process errors fail visibly and dispose only their own stage", async context => {
  await fixture(lawful, async input => {
    const original = filesystem.existsSync;
    const missing = context.mock.method(filesystem, "existsSync", path => path === compiler ? false : original(path));
    syncBuiltinESMExports();
    try { await assert.rejects(compileHostModuleInIsolation(input), /installed pinned/u); }
    finally { missing.mock.restore(); syncBuiltinESMExports(); }
    const failure = new Error("original compiler process failure");
    const processError = context.mock.method(childProcess, "spawnSync", () => ({ error: failure }));
    syncBuiltinESMExports();
    try { await assert.rejects(compileHostModuleInIsolation(input), error => error === failure); }
    finally { processError.mock.restore(); syncBuiltinESMExports(); }
    assert.deepEqual(readdirSync(resolve(input.root, input.outputDirectory)), []);
    const signal = context.mock.method(childProcess, "spawnSync", () => ({ signal: "SIGTERM" }));
    syncBuiltinESMExports();
    try { await assert.rejects(compileHostModuleInIsolation(input), /terminated with SIGTERM/u); }
    finally { signal.mock.restore(); syncBuiltinESMExports(); }
    assert.deepEqual(readdirSync(resolve(input.root, input.outputDirectory)), []);
  });
});

test("tooling contracts are checked against the actual JavaScript implementations, not only declaration models", () => {
  const result = spawnSync(process.execPath, [compiler, "--ignoreConfig", "--strict", "--allowJs", "--checkJs", "false",
    "--noEmit", "--skipLibCheck", "false", "--types", "node", "--target", "es2022", "--module", "nodenext",
    resolve(repository, "test/architecture/tooling/host-gates.mjs"), resolve(repository, "test/scripts/host-isolated.mjs")],
  { cwd: repository, encoding: "utf8", maxBuffer: 1_048_576, timeout: 60_000 });
  if (result.error !== undefined) throw result.error;
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`.slice(0, 8192));
});
