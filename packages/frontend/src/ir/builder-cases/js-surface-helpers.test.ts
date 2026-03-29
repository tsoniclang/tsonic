/**
 * IR Builder tests: JS surface helpers - global bindings, regex, spread arrays
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import { createProgram, createProgramContext } from "./_test-helpers.js";

const writeFixtureJsSurface = (
  tempDir: string,
  exportEntries: Record<string, string>,
  sourceFiles: Readonly<Record<string, string>>,
  ambientSource: string
): string => {
  const surfaceRoot = path.join(tempDir, "node_modules", "@fixture", "js");
  fs.mkdirSync(path.join(surfaceRoot, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(surfaceRoot, "package.json"),
    JSON.stringify(
      { name: "@fixture/js", version: "1.0.0", type: "module" },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(surfaceRoot, "tsonic.surface.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "@fixture/js",
        extends: [],
        requiredTypeRoots: ["."],
        useStandardLib: false,
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(surfaceRoot, "globals.ts"), ambientSource);
  fs.writeFileSync(
    path.join(surfaceRoot, "tsonic.package.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        kind: "tsonic-source-package",
        surfaces: ["@fixture/js"],
        source: {
          namespace: "fixture.js",
          ambient: ["./globals.ts"],
          exports: exportEntries,
        },
      },
      null,
      2
    )
  );

  for (const [relativePath, contents] of Object.entries(sourceFiles)) {
    const absolutePath = path.join(surfaceRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }

  return surfaceRoot;
};

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("JS surface helpers", () => {
    it("attaches explicit computed-access protocol for class index signatures with at/set", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-computed-access-protocol-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        writeFixtureJsSurface(
          tempDir,
          {
            "./RegExp.js": "./src/RegExp.ts",
          },
          {
            "src/RegExp.ts": [
              "export class RegExp {",
              "  public constructor(_pattern: string, _flags?: string) {}",
              "  public test(_value: string): boolean {",
              "    return true;",
              "  }",
              "}",
            ].join("\n"),
          },
          [
            'declare global {',
            '  const RegExp: typeof import("./src/RegExp.js").RegExp;',
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import type { int } from "@tsonic/core/types.js";',
            "class Vec {",
            "  [index: number]: number;",
            "  at(index: int): number | undefined {",
            "    return 0;",
            "  }",
            "  set(index: int, value: number): void {}",
            "  read(index: int): number | undefined {",
            "    return this[index];",
            "  }",
            "  write(index: int, value: number): void {",
            "    this[index] = value as byte;",
            "  }",
            "}",
            "class Holder {",
            "  private readonly data: Vec = new Vec();",
            "  read(index: int): number | undefined {",
            "    return this.data[index];",
            "  }",
            "  write(index: int, value: number): void {",
            "    this.data[index] = value;",
            "  }",
            "}",
            "export { Vec, Holder };",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const vecClass = moduleResult.value.body.find(
          (stmt) =>
            stmt.kind === "classDeclaration" && stmt.name === "Vec"
        );
        expect(vecClass).to.not.equal(undefined);
        if (!vecClass || vecClass.kind !== "classDeclaration") return;

        const readMethod = vecClass.members.find(
          (member) => member.kind === "methodDeclaration" && member.name === "read"
        );
        expect(readMethod).to.not.equal(undefined);
        if (
          !readMethod ||
          readMethod.kind !== "methodDeclaration" ||
          !readMethod.body
        )
          return;

        const readReturn = readMethod.body.statements[0];
        expect(readReturn?.kind).to.equal("returnStatement");
        if (!readReturn || readReturn.kind !== "returnStatement") return;

        const readExpr = readReturn.expression;
        expect(readExpr?.kind).to.equal("memberAccess");
        if (!readExpr || readExpr.kind !== "memberAccess") return;
        expect(readExpr.isComputed).to.equal(true);
        expect(readExpr.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });

        const writeMethod = vecClass.members.find(
          (member) => member.kind === "methodDeclaration" && member.name === "write"
        );
        expect(writeMethod).to.not.equal(undefined);
        if (
          !writeMethod ||
          writeMethod.kind !== "methodDeclaration" ||
          !writeMethod.body
        )
          return;

        const writeExprStmt = writeMethod.body.statements[0];
        expect(writeExprStmt?.kind).to.equal("expressionStatement");
        if (!writeExprStmt || writeExprStmt.kind !== "expressionStatement") return;

        const writeExpr = writeExprStmt.expression;
        expect(writeExpr.kind).to.equal("assignment");
        if (writeExpr.kind !== "assignment") return;
        expect(writeExpr.left.kind).to.equal("memberAccess");
        if (writeExpr.left.kind !== "memberAccess") return;
        expect(writeExpr.left.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });

        const holderClass = moduleResult.value.body.find(
          (stmt) =>
            stmt.kind === "classDeclaration" && stmt.name === "Holder"
        );
        expect(holderClass).to.not.equal(undefined);
        if (!holderClass || holderClass.kind !== "classDeclaration") return;

        const holderReadMethod = holderClass.members.find(
          (member) => member.kind === "methodDeclaration" && member.name === "read"
        );
        expect(holderReadMethod).to.not.equal(undefined);
        if (
          !holderReadMethod ||
          holderReadMethod.kind !== "methodDeclaration" ||
          !holderReadMethod.body
        )
          return;

        const holderReadStmt = holderReadMethod.body.statements[0];
        expect(holderReadStmt?.kind).to.equal("returnStatement");
        if (!holderReadStmt || holderReadStmt.kind !== "returnStatement") return;

        const holderReadExpr = holderReadStmt.expression;
        expect(holderReadExpr?.kind).to.equal("memberAccess");
        if (!holderReadExpr || holderReadExpr.kind !== "memberAccess") return;
        expect(holderReadExpr.isComputed).to.equal(true);
        expect(holderReadExpr.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("attaches explicit computed-access protocol through inherited class index signatures with at/set", () => {
      const tempDir = fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          "tsonic-builder-inherited-computed-access-protocol-"
        )
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        writeFixtureJsSurface(
          tempDir,
          {
            "./RegExp.js": "./src/RegExp.ts",
          },
          {
            "src/RegExp.ts": [
              "export class RegExp {",
              "  public constructor(_pattern: string, _flags?: string) {}",
              "  public test(_value: string): boolean {",
              "    return true;",
              "  }",
              "}",
            ].join("\n"),
          },
          [
            "declare global {",
            '  const RegExp: typeof import("./src/RegExp.js").RegExp;',
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            'import type { int } from "@tsonic/core/types.js";',
            "abstract class VecBase<T> {",
            "  [index: number]: T;",
            "  public at(index: int): T | undefined {",
            "    void index;",
            "    return undefined;",
            "  }",
            "  public set(index: int, value: T): void {",
            "    void index;",
            "    void value;",
            "  }",
            "}",
            "class Vec extends VecBase<number> {}",
            "class Holder {",
            "  private readonly data: Vec = new Vec();",
            "  read(index: int): number | undefined {",
            "    return this.data[index];",
            "  }",
            "  write(index: int, value: number): void {",
            "    this.data[index] = value;",
            "  }",
            "}",
            "export { Vec, Holder };",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const holderClass = moduleResult.value.body.find(
          (stmt) => stmt.kind === "classDeclaration" && stmt.name === "Holder"
        );
        expect(holderClass).to.not.equal(undefined);
        if (!holderClass || holderClass.kind !== "classDeclaration") return;

        const holderReadMethod = holderClass.members.find(
          (member) => member.kind === "methodDeclaration" && member.name === "read"
        );
        expect(holderReadMethod).to.not.equal(undefined);
        if (
          !holderReadMethod ||
          holderReadMethod.kind !== "methodDeclaration" ||
          !holderReadMethod.body
        ) {
          return;
        }

        const holderReadStmt = holderReadMethod.body.statements[0];
        expect(holderReadStmt?.kind).to.equal("returnStatement");
        if (!holderReadStmt || holderReadStmt.kind !== "returnStatement") return;

        const holderReadExpr = holderReadStmt.expression;
        expect(holderReadExpr?.kind).to.equal("memberAccess");
        if (!holderReadExpr || holderReadExpr.kind !== "memberAccess") return;
        expect(holderReadExpr.isComputed).to.equal(true);
        expect(holderReadExpr.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });

        const holderWriteMethod = holderClass.members.find(
          (member) => member.kind === "methodDeclaration" && member.name === "write"
        );
        expect(holderWriteMethod).to.not.equal(undefined);
        if (
          !holderWriteMethod ||
          holderWriteMethod.kind !== "methodDeclaration" ||
          !holderWriteMethod.body
        ) {
          return;
        }

        const holderWriteStmt = holderWriteMethod.body.statements[0];
        expect(holderWriteStmt?.kind).to.equal("expressionStatement");
        if (!holderWriteStmt || holderWriteStmt.kind !== "expressionStatement") {
          return;
        }

        const holderWriteExpr = holderWriteStmt.expression;
        expect(holderWriteExpr.kind).to.equal("assignment");
        if (holderWriteExpr.kind !== "assignment") return;
        expect(holderWriteExpr.left.kind).to.equal("memberAccess");
        if (holderWriteExpr.left.kind !== "memberAccess") return;
        expect(holderWriteExpr.left.accessProtocol).to.deep.equal({
          getterMember: "at",
          setterMember: "set",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("specializes inherited source-package method parameter types through global owner aliases", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-owned-u8-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        writeFixtureJsSurface(
          tempDir,
          {
            "./typed-array-core.js": "./src/typed-array-core.ts",
            "./uint8-array.js": "./src/uint8-array.ts",
          },
          {
            "src/typed-array-core.ts": [
              'import type { int } from "@tsonic/core/types.js";',
              "export type TypedArrayInput<TElement extends number> =",
              "  | TElement[]",
              "  | Iterable<number>;",
              "export class TypedArrayBase<",
              "  TElement extends number,",
              "  TSelf extends TypedArrayBase<TElement, TSelf>,",
              "> {",
              "  public constructor() {}",
              "  public set(source: TypedArrayInput<TElement>, offset?: int): void {",
              "    void source;",
              "    void offset;",
              "  }",
              "}",
            ].join("\n"),
            "src/uint8-array.ts": [
              'import { TypedArrayBase } from "./typed-array-core.js";',
              "export class Uint8Array extends TypedArrayBase<number, Uint8Array> {",
              "  public constructor() {",
              "    super();",
              "  }",
              "}",
            ].join("\n"),
          },
          [
            "declare global {",
            '  const Uint8Array: typeof import("./src/uint8-array.js").Uint8Array;',
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function main(): void {",
            "  const copy = new Uint8Array();",
            "  copy.set(copy);",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
          useStandardLib: false,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const callStmt = fn.body.statements[1];
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (!callStmt || callStmt.kind !== "expressionStatement") return;

        const callExpr = callStmt.expression;
        expect(callExpr.kind).to.equal("call");
        if (callExpr.kind !== "call") return;

        const firstParameterType = callExpr.parameterTypes?.[0];
        expect(firstParameterType).to.not.equal(undefined);
        if (!firstParameterType) return;

        expect(JSON.stringify(firstParameterType)).to.not.include(
          '"kind":"typeParameterType"'
        );
        expect(firstParameterType.kind).to.equal("unionType");
        if (firstParameterType.kind !== "unionType") return;

        const [arrayMember, iterableMember] = firstParameterType.types;
        expect(arrayMember?.kind).to.equal("arrayType");
        expect(iterableMember?.kind).to.equal("referenceType");
        if (!arrayMember || arrayMember.kind !== "arrayType") return;
        if (!iterableMember || iterableMember.kind !== "referenceType") return;

        expect(arrayMember.elementType).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
        expect(iterableMember.name).to.equal("Iterable");
        expect(iterableMember.typeArguments?.[0]).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("specializes direct generic source-package members through global owner aliases", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-owned-map-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        writeFixtureJsSurface(
          tempDir,
          {
            "./map-object.js": "./src/map-object.ts",
          },
          {
            "src/map-object.ts": [
              "export class Map<K, V> {",
              "  public constructor() {}",
              "  public get(key: K): V | undefined {",
              "    void key;",
              "    return undefined;",
              "  }",
              "  public set(key: K, value: V): void {",
              "    void key;",
              "    void value;",
              "  }",
              "}",
            ].join("\n"),
          },
          [
            "declare global {",
            '  const Map: typeof import("./src/map-object.js").Map;',
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function main(label: string = \"default\"): number {",
            "  const counters = new Map<string, number>();",
            "  const next = counters.get(label) ?? 0;",
            "  counters.set(label, next);",
            "  return next;",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
          useStandardLib: false,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const nextDecl = fn.body.statements[1];
        expect(nextDecl?.kind).to.equal("variableDeclaration");
        if (!nextDecl || nextDecl.kind !== "variableDeclaration") return;

        const logicalExpr = nextDecl.declarations[0]?.initializer;
        expect(logicalExpr?.kind).to.equal("logical");
        if (!logicalExpr || logicalExpr.kind !== "logical") return;

        expect(JSON.stringify(logicalExpr.inferredType)).to.not.include(
          '"kind":"typeParameterType"'
        );
        expect(logicalExpr.left.kind).to.equal("call");
        if (logicalExpr.left.kind !== "call") return;

        expect(JSON.stringify(logicalExpr.left.inferredType)).to.not.include(
          '"kind":"typeParameterType"'
        );

        const [firstParameterType] = logicalExpr.left.parameterTypes ?? [];
        expect(firstParameterType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("threads generic surface root global bindings into identifier callees", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-generic-surface-globals-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const surfaceRoot = path.join(tempDir, "node_modules/@fixture/js");
        fs.mkdirSync(surfaceRoot, { recursive: true });
        fs.writeFileSync(
          path.join(surfaceRoot, "package.json"),
          JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(path.join(surfaceRoot, "index.js"), "export {};\n");
        fs.writeFileSync(
          path.join(surfaceRoot, "index.d.ts"),
          [
            'import type { int } from "@tsonic/core/types.js";',
            "",
            "declare global {",
            "  const console: {",
            "    log(...data: unknown[]): void;",
            "  };",
            "  function setInterval(handler: (...args: unknown[]) => void, timeout?: int, ...args: unknown[]): int;",
            "  function clearInterval(id: int): void;",
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "bindings.json"),
          JSON.stringify(
            {
              bindings: {
                console: {
                  kind: "global",
                  assembly: "js",
                  type: "js.console",
                },
                setInterval: {
                  kind: "global",
                  assembly: "js",
                  type: "js.Timers",
                  csharpName: "Timers.setInterval",
                },
                clearInterval: {
                  kind: "global",
                  assembly: "js",
                  type: "js.Timers",
                  csharpName: "Timers.clearInterval",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@fixture/js",
              extends: [],
              requiredTypeRoots: ["."],
              useStandardLib: false,
            },
            null,
            2
          )
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function main(): void {",
            "  const id = setInterval(() => {}, 1000);",
            "  clearInterval(id);",
            '  console.log("tick");',
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
          useStandardLib: false,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const firstStmt = fn.body.statements[0];
        expect(firstStmt?.kind).to.equal("variableDeclaration");
        if (!firstStmt || firstStmt.kind !== "variableDeclaration") return;

        const setIntervalCall = firstStmt.declarations[0]?.initializer;
        expect(setIntervalCall?.kind).to.equal("call");
        if (!setIntervalCall || setIntervalCall.kind !== "call") return;

        expect(setIntervalCall.callee.kind).to.equal("identifier");
        if (setIntervalCall.callee.kind !== "identifier") return;

        expect(setIntervalCall.callee.name).to.equal("setInterval");
        expect(setIntervalCall.callee.resolvedClrType).to.equal(
          "js.Timers"
        );
        expect(setIntervalCall.callee.resolvedAssembly).to.equal(
          "js"
        );
        expect(setIntervalCall.callee.csharpName).to.equal(
          "Timers.setInterval"
        );

        const clearIntervalStmt = fn.body.statements[1];
        expect(clearIntervalStmt?.kind).to.equal("expressionStatement");
        if (
          !clearIntervalStmt ||
          clearIntervalStmt.kind !== "expressionStatement"
        )
          return;

        const clearIntervalCall = clearIntervalStmt.expression;
        expect(clearIntervalCall.kind).to.equal("call");
        if (clearIntervalCall.kind !== "call") return;
        expect(clearIntervalCall.callee.kind).to.equal("identifier");
        if (clearIntervalCall.callee.kind !== "identifier") return;
        expect(clearIntervalCall.callee.csharpName).to.equal(
          "Timers.clearInterval"
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("threads source-package ambient globals declared through static imports", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-package-globals-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const surfaceRoot = path.join(tempDir, "node_modules/@fixture/js");
        fs.mkdirSync(path.join(surfaceRoot, "src"), { recursive: true });
        fs.writeFileSync(
          path.join(surfaceRoot, "package.json"),
          JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.package.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@fixture/js"],
              source: {
                namespace: "fixture.js",
                ambient: ["./globals.ts"],
                exports: {
                  "./Globals.js": "./src/Globals.ts",
                  "./console.js": "./src/console.ts",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@fixture/js",
              extends: [],
              requiredTypeRoots: ["."],
              useStandardLib: false,
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "globals.ts"),
          [
            'import { parseInt as SourceParseInt } from "./src/Globals.js";',
            'import { console as SourceConsole } from "./src/console.js";',
            "",
            "declare global {",
            "  const parseInt: typeof SourceParseInt;",
            "  const console: typeof SourceConsole;",
            "}",
            "",
            "export {};",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "src/Globals.ts"),
          [
            "export const parseInt = (value: string): number => {",
            "  void value;",
            "  return 42;",
            "};",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "src/console.ts"),
          [
            "export const console = {",
            "  log(...data: unknown[]): void {",
            "    void data;",
            "  },",
            "};",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function main(): void {",
            '  const value = parseInt("42");',
            "  console.log(value);",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
          useStandardLib: false,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "main"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const firstStmt = fn.body.statements[0];
        expect(firstStmt?.kind).to.equal("variableDeclaration");
        if (!firstStmt || firstStmt.kind !== "variableDeclaration") return;

        const parseIntCall = firstStmt.declarations[0]?.initializer;
        expect(parseIntCall?.kind).to.equal("call");
        if (!parseIntCall || parseIntCall.kind !== "call") return;

        expect(parseIntCall.callee.kind).to.equal("identifier");
        if (parseIntCall.callee.kind !== "identifier") return;
        expect(parseIntCall.callee.name).to.equal("parseInt");
        expect(parseIntCall.callee.resolvedClrType).to.equal(
          "fixture.js.Globals.parseInt"
        );
        expect(parseIntCall.callee.resolvedAssembly).to.equal("fixture.js");

        const logStmt = fn.body.statements[1];
        expect(logStmt?.kind).to.equal("expressionStatement");
        if (!logStmt || logStmt.kind !== "expressionStatement") return;
        const logCall = logStmt.expression;
        expect(logCall.kind).to.equal("call");
        if (logCall.kind !== "call") return;
        const logCallee =
          logCall.callee.kind === "typeAssertion"
            ? logCall.callee.expression
            : logCall.callee;
        expect(logCallee.kind).to.equal("memberAccess");
        if (logCallee.kind !== "memberAccess") return;
        expect(logCallee.object.kind).to.equal("identifier");
        if (logCallee.object.kind !== "identifier") return;
        expect(logCallee.object.name).to.equal("console");
        expect(logCallee.object.resolvedClrType).to.equal(
          "fixture.js.console.console"
        );
        expect(logCallee.object.resolvedAssembly).to.equal("fixture.js");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("applies the current project source-package ambient instance bindings to its own source files", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-self-source-package-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "@fixture/lib", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(tempDir, "tsonic.package.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@fixture/js"],
              source: {
                namespace: "fixture.lib",
                ambient: ["./globals.ts"],
                exports: {
                  ".": "./src/index.ts",
                  "./index.js": "./src/index.ts",
                  "./Globals.js": "./src/Globals.ts",
                  "./String.js": "./src/String.ts",
                },
              },
            },
            null,
            2
          )
        );

        const surfaceRoot = path.join(tempDir, "node_modules", "@fixture", "js");
        fs.mkdirSync(surfaceRoot, { recursive: true });
        fs.writeFileSync(
          path.join(surfaceRoot, "package.json"),
          JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@fixture/js",
              extends: [],
              requiredTypeRoots: ["."],
              useStandardLib: false,
            },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        fs.writeFileSync(
          path.join(tempDir, "globals.ts"),
          [
            'import { String as SourceString } from "./src/Globals.js";',
            "",
            "declare global {",
            "  interface String {",
            "    trimStart(): string;",
            "    trim(): string;",
            "    replaceAll(searchValue: string, replaceValue: string): string;",
            "    charCodeAt(index: number): number;",
            "  }",
            "  const String: typeof SourceString;",
            "}",
            "",
            "export {};",
          ].join("\n")
        );
        fs.writeFileSync(path.join(srcDir, "index.ts"), "export {};\n");
        fs.writeFileSync(
          path.join(srcDir, "String.ts"),
          [
            "export const trimStart = (value: string): string => value;",
            "export const trim = (value: string): string => value;",
            "export const replaceAll = (",
            "  value: string,",
            "  searchValue: string,",
            "  replaceValue: string",
            "): string => {",
            "  void searchValue;",
            "  void replaceValue;",
            "  return value;",
            "};",
            "export const charCodeAt = (value: string, index: number): number => {",
            "  void value;",
            "  return index;",
            "};",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "Globals.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export const String = (value?: unknown): string => {",
            "  void value;",
            '  return "";',
            "};",
            "",
            "export const digitValue = (ch: string): number => {",
            '  return ch.charCodeAt(0) - "0".charCodeAt(0);',
            "};",
            "",
            "export const normalize = (value: string): string => {",
            '  return value.trimStart().replaceAll("a", "b").trim();',
            "};",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "Fixture.Lib",
          surface: "@fixture/js",
          useStandardLib: false,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "Fixture.Lib",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "Fixture.Lib",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const digitValue = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0].name.name === "digitValue"
        );
        expect(digitValue).to.not.equal(undefined);
        if (!digitValue) return;

        const digitInitializer = digitValue.declarations[0]?.initializer;
        expect(digitInitializer?.kind).to.equal("arrowFunction");
        if (!digitInitializer || digitInitializer.kind !== "arrowFunction") {
          return;
        }
        expect(digitInitializer.body.kind).to.equal("blockStatement");
        if (digitInitializer.body.kind !== "blockStatement") return;
        const digitReturn = digitInitializer.body.statements[0];
        expect(digitReturn?.kind).to.equal("returnStatement");
        if (!digitReturn || digitReturn.kind !== "returnStatement") return;
        const digitExpr = digitReturn.expression;
        expect(digitExpr?.kind).to.equal("binary");
        if (!digitExpr || digitExpr.kind !== "binary") return;
        expect(digitExpr.left.kind).to.equal("call");
        if (digitExpr.left.kind !== "call") return;
        expect(digitExpr.left.callee.kind).to.equal("memberAccess");
        if (digitExpr.left.callee.kind !== "memberAccess") return;
        expect(digitExpr.left.callee.memberBinding?.type).to.equal(
          "fixture.lib.String"
        );
        expect(digitExpr.left.callee.memberBinding?.member).to.equal(
          "charCodeAt"
        );

        const normalizeDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0].name.name === "normalize"
        );
        expect(normalizeDecl).to.not.equal(undefined);
        if (!normalizeDecl) return;

        const normalizeInitializer = normalizeDecl.declarations[0]?.initializer;
        expect(normalizeInitializer?.kind).to.equal("arrowFunction");
        if (
          !normalizeInitializer ||
          normalizeInitializer.kind !== "arrowFunction"
        ) {
          return;
        }

        expect(normalizeInitializer.body.kind).to.equal("blockStatement");
        if (normalizeInitializer.body.kind !== "blockStatement") return;
        const normalizeReturn = normalizeInitializer.body.statements[0];
        expect(normalizeReturn?.kind).to.equal("returnStatement");
        if (
          !normalizeReturn ||
          normalizeReturn.kind !== "returnStatement" ||
          !normalizeReturn.expression
        ) {
          return;
        }

        const trimCall = normalizeReturn.expression;
        expect(trimCall.kind).to.equal("call");
        if (trimCall.kind !== "call") return;
        expect(trimCall.callee.kind).to.equal("memberAccess");
        if (trimCall.callee.kind !== "memberAccess") return;
        expect(trimCall.callee.memberBinding?.type).to.equal(
          "fixture.lib.String"
        );
        expect(trimCall.callee.memberBinding?.member).to.equal("trim");

        expect(trimCall.callee.object.kind).to.equal("call");
        if (trimCall.callee.object.kind !== "call") return;
        expect(trimCall.callee.object.callee.kind).to.equal("memberAccess");
        if (trimCall.callee.object.callee.kind !== "memberAccess") return;
        expect(trimCall.callee.object.callee.memberBinding?.type).to.equal(
          "fixture.lib.String"
        );
        expect(trimCall.callee.object.callee.memberBinding?.member).to.equal(
          "replaceAll"
        );

        expect(trimCall.callee.object.callee.object.kind).to.equal("call");
        if (trimCall.callee.object.callee.object.kind !== "call") return;
        expect(trimCall.callee.object.callee.object.callee.kind).to.equal(
          "memberAccess"
        );
        if (trimCall.callee.object.callee.object.callee.kind !== "memberAccess") {
          return;
        }
        expect(
          trimCall.callee.object.callee.object.callee.memberBinding?.type
        ).to.equal("fixture.lib.String");
        expect(
          trimCall.callee.object.callee.object.callee.memberBinding?.member
        ).to.equal("trimStart");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("treats source-package ambient constructor globals as real type identities", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-source-package-type-identity-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });

        const surfaceRoot = path.join(tempDir, "node_modules/@fixture/js");
        fs.mkdirSync(path.join(surfaceRoot, "src"), { recursive: true });
        fs.writeFileSync(
          path.join(surfaceRoot, "package.json"),
          JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.package.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@fixture/js"],
              source: {
                namespace: "fixture.js",
                ambient: ["./globals.ts"],
                exports: {
                  "./Widget.js": "./src/Widget.ts",
                },
              },
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@fixture/js",
              extends: [],
              requiredTypeRoots: ["."],
              useStandardLib: false,
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "globals.ts"),
          [
            'import { Widget as SourceWidget } from "./src/Widget.js";',
            "",
            "declare global {",
            "  interface Widget extends SourceWidget {}",
            "  const Widget: typeof SourceWidget;",
            "}",
            "",
            "export {};",
          ].join("\n")
        );
        fs.writeFileSync(
          path.join(surfaceRoot, "src/Widget.ts"),
          [
            "export class Widget {",
            "  public isWidget(): boolean {",
            "    return true;",
            "  }",
            "}",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function check(value: string | Widget): boolean {",
            "  if (value instanceof Widget) {",
            "    return value.isWidget();",
            "  }",
            "  return value.length > 0;",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
          useStandardLib: false,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("converts regex literals into RegExp constructor expressions on js surface", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-js-regex-literal-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        writeFixtureJsSurface(
          tempDir,
          {
            "./RegExp.js": "./src/RegExp.ts",
          },
          {
            "src/RegExp.ts": [
              "export class RegExp {",
              "  public constructor(_pattern: string, _flags?: string) {}",
              "  public test(_value: string): boolean {",
              "    return true;",
              "  }",
              "}",
            ].join("\n"),
          },
          [
            "declare global {",
            '  const RegExp: typeof import("./src/RegExp.js").RegExp;',
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "export function isUpper(text: string): boolean {",
            "  return /^[A-Z]+$/i.test(text);",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
          useStandardLib: false,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const fn = moduleResult.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "isUpper"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const returnStmt = fn.body.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") return;

        const testCall = returnStmt.expression;
        expect(testCall?.kind).to.equal("call");
        if (!testCall || testCall.kind !== "call") return;

        expect(testCall.callee.kind).to.equal("memberAccess");
        if (testCall.callee.kind !== "memberAccess") return;

        const regexCtor = testCall.callee.object;
        expect(regexCtor.kind).to.equal("new");
        if (regexCtor.kind !== "new") return;

        expect(regexCtor.callee.kind).to.equal("identifier");
        if (regexCtor.callee.kind !== "identifier") return;

        expect(regexCtor.callee.name).to.equal("RegExp");
        expect(regexCtor.callee.resolvedClrType).to.equal("fixture.js.RegExp");
        expect(regexCtor.arguments).to.deep.equal([
          {
            kind: "literal",
            value: "^[A-Z]+$",
            raw: JSON.stringify("^[A-Z]+$"),
            inferredType: { kind: "primitiveType", name: "string" },
            sourceSpan: regexCtor.arguments[0]?.sourceSpan,
          },
          {
            kind: "literal",
            value: "i",
            raw: JSON.stringify("i"),
            inferredType: { kind: "primitiveType", name: "string" },
            sourceSpan: regexCtor.arguments[1]?.sourceSpan,
          },
        ]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("preserves spread-only array element types on js surface", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-js-spread-array-")
      );

      try {
        fs.writeFileSync(
          path.join(tempDir, "package.json"),
          JSON.stringify(
            { name: "app", version: "1.0.0", type: "module" },
            null,
            2
          )
        );

        const srcDir = path.join(tempDir, "src");
        fs.mkdirSync(srcDir, { recursive: true });
        writeFixtureJsSurface(
          tempDir,
          {
            "./Array.js": "./src/Array.ts",
          },
          {
            "src/Array.ts": [
              "export abstract class Array<T> {",
              "  public abstract sort(compareFn?: (a: T, b: T) => number): T[];",
              "}",
            ].join("\n"),
          },
          [
            'import { Array as SourceArray } from "./src/Array.js";',
            "",
            "declare global {",
            "  interface Array<T> extends SourceArray<T> {}",
            "  const Array: typeof SourceArray;",
            "}",
            "",
            "export {};",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "type MenuEntry = { weight: number };",
            "export const sortMenuEntries = (entries: MenuEntry[]): MenuEntry[] => {",
            "  return [...entries].sort((a: MenuEntry, b: MenuEntry) => a.weight - b.weight);",
            "};",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@fixture/js",
          useStandardLib: false,
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const program = programResult.value;
        const sourceFile = program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(program, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          program,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const sortDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "sortMenuEntries"
        );
        expect(sortDecl).to.not.equal(undefined);
        if (!sortDecl) return;

        const initializer = sortDecl.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("arrowFunction");
        if (!initializer || initializer.kind !== "arrowFunction") return;
        expect(initializer.body.kind).to.equal("blockStatement");
        if (initializer.body.kind !== "blockStatement") return;

        const returnStmt = initializer.body.statements[0];
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (!returnStmt || returnStmt.kind !== "returnStatement") return;

        const sortCall = returnStmt.expression;
        expect(sortCall?.kind).to.equal("call");
        if (!sortCall || sortCall.kind !== "call") return;
        expect(sortCall.callee.kind).to.equal("memberAccess");
        if (sortCall.callee.kind !== "memberAccess") return;
        expect(sortCall.callee.object.kind).to.equal("array");
        if (sortCall.callee.object.kind !== "array") return;

        const inferredType = sortCall.callee.object.inferredType;
        expect(inferredType?.kind).to.equal("arrayType");
        if (!inferredType || inferredType.kind !== "arrayType") return;
        expect(inferredType.elementType.kind).to.equal("referenceType");
        if (inferredType.elementType.kind !== "referenceType") return;
        expect(inferredType.elementType.name).to.equal("MenuEntry");
        const weightMember = inferredType.elementType.structuralMembers?.find(
          (member: { kind: string; name: string }) =>
            member.kind === "propertySignature" && member.name === "weight"
        );
        expect(weightMember).to.not.equal(undefined);
        expect(weightMember?.kind).to.equal("propertySignature");
        if (!weightMember || weightMember.kind !== "propertySignature") return;
        expect(weightMember.type).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
