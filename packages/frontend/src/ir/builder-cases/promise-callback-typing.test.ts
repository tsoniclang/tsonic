/**
 * IR Builder tests: Promise callback typing
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import {
  createTestProgram,
  createProgram,
  createProgramContext,
} from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Promise callback typing", () => {
    it("should not poison Promise.then callbacks to void before generic resolution settles", () => {
      const source = `
        declare class Promise<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): Promise<TResult1 | TResult2>;
        }

        interface PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        export function chainScore(seed: Promise<number>): Promise<number> {
          return seed.then((value) => value + 1);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "chainScore"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const returnStmt = fn.body.statements[0];
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (!returnStmt || returnStmt.kind !== "returnStatement") return;

      const call = returnStmt.expression;
      expect(call?.kind).to.equal("call");
      if (!call || call.kind !== "call") return;

      const callback = call.arguments[0];
      expect(callback?.kind).to.equal("arrowFunction");
      if (!callback || callback.kind !== "arrowFunction") return;

      expect(callback.parameters[0]?.type).to.deep.equal({
        kind: "primitiveType",
        name: "number",
      });
      expect(callback.inferredType).to.deep.equal({
        kind: "functionType",
        parameters: callback.parameters,
        returnType: {
          kind: "primitiveType",
          name: "number",
        },
      });
    });

    it("infers Promise constructor generic from contextual return type", () => {
      const source = `
        declare function setTimeout(fn: () => void, ms: number): void;

        declare class PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        declare class Promise<T> {
          constructor(
            executor: (
              resolve: (value: T | PromiseLike<T>) => void,
              reject: (reason: unknown) => void
            ) => void
          );
        }

        export function delay(ms: number): Promise<void> {
          return new Promise((resolve) => {
            setTimeout(() => resolve(), ms);
          });
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "delay"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const returnStmt = fn.body.statements[0];
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (!returnStmt || returnStmt.kind !== "returnStatement") return;

      const ctor = returnStmt.expression;
      expect(ctor?.kind).to.equal("new");
      if (!ctor || ctor.kind !== "new") return;

      expect(ctor.inferredType).to.deep.equal({
        kind: "referenceType",
        name: "Promise",
        typeArguments: [{ kind: "voidType" }],
      });

      const executor = ctor.arguments[0];
      expect(executor?.kind).to.equal("arrowFunction");
      if (!executor || executor.kind !== "arrowFunction") return;

      expect(executor.parameters[0]?.type).to.not.equal(undefined);
      expect(executor.parameters[0]?.type?.kind).to.equal("functionType");
    });

    it("infers Promise.all element type from async wrapper array arguments", () => {
      const source = `
        interface PromiseLike<T> {
          then<TResult1 = T, TResult2 = never>(
            onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
          ): PromiseLike<TResult1 | TResult2>;
        }

        declare class Promise<T> {
          static all<T>(values: readonly (T | PromiseLike<T>)[]): Promise<T[]>;
        }

        async function runWorker(name: string): Promise<number> {
          return 1;
        }

        export async function main(): Promise<void> {
          const results = await Promise.all([
            runWorker("a"),
            runWorker("b"),
            runWorker("c"),
          ]);
          void results;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "main"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const decl = fn.body.statements[0];
      expect(decl?.kind).to.equal("variableDeclaration");
      if (!decl || decl.kind !== "variableDeclaration") return;

      const initializer = decl.declarations[0]?.initializer;
      expect(initializer?.kind).to.equal("await");
      if (!initializer || initializer.kind !== "await") return;

      const call = initializer.expression;
      expect(call?.kind).to.equal("call");
      if (!call || call.kind !== "call") return;

      expect(call.inferredType).to.deep.include({
        kind: "referenceType",
        name: "Promise",
        typeArguments: [
          {
            kind: "arrayType",
            elementType: {
              kind: "primitiveType",
              name: "number",
            },
            origin: "explicit",
          },
        ],
      });
      expect(initializer.inferredType).to.deep.equal({
        kind: "arrayType",
        elementType: {
          kind: "primitiveType",
          name: "number",
        },
        origin: "explicit",
      });
    });

    it("preserves generic receiver substitutions for js-surface method calls", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-map-keys-")
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

        const jsRoot = path.join(tempDir, "node_modules", "@tsonic", "js");
        fs.mkdirSync(jsRoot, { recursive: true });
        fs.writeFileSync(
          path.join(jsRoot, "package.json"),
          JSON.stringify(
            { name: "@tsonic/js", version: "0.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(path.join(jsRoot, "index.js"), "export {};\n");
        fs.writeFileSync(
          path.join(jsRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@tsonic/js",
              extends: [],
              requiredTypeRoots: ["."],
              useStandardLib: false,
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(jsRoot, "index.d.ts"),
          [
            "declare global {",
            "  interface SymbolConstructor {",
            "    readonly iterator: symbol;",
            "  }",
            "  const Symbol: SymbolConstructor;",
            "  interface IteratorResult<T> {",
            "    done: boolean;",
            "    value: T;",
            "  }",
            "  interface Iterator<T> {",
            "    next(): IteratorResult<T>;",
            "  }",
            "  interface Iterable<T> {",
            "    [Symbol.iterator](): Iterator<T>;",
            "  }",
            "  interface IterableIterator<T>",
            "    extends Iterator<T>, Iterable<T> {",
            "    [Symbol.iterator](): IterableIterator<T>;",
            "  }",
            "  interface ArrayLike<T> {",
            "    readonly length: int;",
            "    readonly [index: int]: T;",
            "  }",
            "  interface Array<T> {",
            "    readonly length: int;",
            "    readonly [index: int]: T;",
            "  }",
            "  interface ArrayConstructor {",
            "    from<T>(source: Iterable<T> | ArrayLike<T>): T[];",
            "  }",
            "  interface Map<K, V> {",
            "    set(key: K, value: V): this;",
            "    keys(): IterableIterator<K>;",
            "  }",
            "  interface MapConstructor {",
            "    new <K, V>(): Map<K, V>;",
            "  }",
            "  const Array: ArrayConstructor;",
            "  const Map: MapConstructor;",
            "}",
            "export {};",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "const counts = new Map<string, number>();",
            'counts.set("alpha", 1);',
            "export const keys = Array.from(counts.keys());",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
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

        const keysDecl = moduleResult.value.body.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "keys"
        );
        expect(keysDecl).to.not.equal(undefined);
        if (!keysDecl) return;

        const initializer = keysDecl.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("call");
        if (!initializer || initializer.kind !== "call") return;

        expect(initializer.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
          origin: "explicit",
        });

        const keysCall = initializer.arguments[0];
        expect(keysCall?.kind).to.equal("call");
        if (!keysCall || keysCall.kind !== "call") return;

        expect(keysCall.inferredType?.kind).to.equal("referenceType");
        if (keysCall.inferredType?.kind !== "referenceType") return;
        expect(["Iterable", "IterableIterator", "IEnumerable_1"]).to.include(
          keysCall.inferredType.name
        );
        expect(keysCall.inferredType.typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "string" },
        ]);

        const callee = keysCall.callee;
        expect(callee.kind).to.equal("memberAccess");
        if (callee.kind !== "memberAccess") return;

        expect(callee.inferredType?.kind).to.equal("functionType");
        if (callee.inferredType?.kind !== "functionType") return;
        expect(callee.inferredType.parameters).to.deep.equal([]);
        expect(callee.inferredType.returnType.kind).to.equal("referenceType");
        if (callee.inferredType.returnType.kind !== "referenceType") return;
        expect(["Iterable", "IterableIterator", "IEnumerable_1"]).to.include(
          callee.inferredType.returnType.name
        );
        if (callee.inferredType.returnType.typeArguments) {
          expect(callee.inferredType.returnType.typeArguments).to.deep.equal([
            { kind: "primitiveType", name: "string" },
          ]);
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("infers Array.from element types from js-source generators that are structurally iterable", () => {
      const fixtureRoot = path.resolve(
        "..",
        "..",
        "test/fixtures/js-surface-array-from-map-keys/packages/js-surface-array-from-map-keys"
      );
      const entryPath = path.join(fixtureRoot, "src/index.ts");
      const sourceRoot = path.join(fixtureRoot, "src");

      const programResult = createProgram([entryPath], {
        projectRoot: fixtureRoot,
        sourceRoot,
        rootNamespace: "JsSurfaceArrayFromMapKeys",
        surface: "@tsonic/js",
      });

      expect(programResult.ok).to.equal(true);
      if (!programResult.ok) return;

      const program = programResult.value;
      const sourceFile =
        program.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        ) ??
        program.sourceFiles.find((file) =>
          file.fileName.endsWith("/src/index.ts")
        );
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const ctx = createProgramContext(program, {
        sourceRoot,
        rootNamespace: "JsSurfaceArrayFromMapKeys",
      });

      const moduleResult = buildIrModule(
        sourceFile,
        program,
        {
          sourceRoot,
          rootNamespace: "JsSurfaceArrayFromMapKeys",
        },
        ctx
      );

      expect(moduleResult.ok).to.equal(true);
      if (!moduleResult.ok) return;

      const mainDecl = moduleResult.value.body.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "functionDeclaration" }> =>
          stmt.kind === "functionDeclaration" && stmt.name === "main"
      );
      expect(mainDecl).to.not.equal(undefined);
      if (!mainDecl) return;

      const keysDecl = mainDecl.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations[0]?.name.kind === "identifierPattern" &&
          stmt.declarations[0]?.name.name === "keys"
      );
      expect(keysDecl).to.not.equal(undefined);
      if (!keysDecl) return;

      const initializer = keysDecl.declarations[0]?.initializer;
      expect(initializer?.kind).to.equal("call");
      if (!initializer || initializer.kind !== "call") return;

      expect(initializer.inferredType).to.deep.equal({
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "string" },
        origin: "explicit",
      });

      const keysCall = initializer.arguments[0];
      expect(keysCall?.kind).to.equal("call");
      if (!keysCall || keysCall.kind !== "call") return;

      expect(keysCall.inferredType?.kind).to.equal("referenceType");
      if (keysCall.inferredType?.kind !== "referenceType") return;
      expect(keysCall.inferredType.name).to.equal("Generator");
      expect(keysCall.inferredType.typeArguments).to.deep.equal([
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "undefined" },
        { kind: "primitiveType", name: "undefined" },
      ]);
    });

    it("preserves receiver substitutions for locals derived from this-owned generic members", () => {
      const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "tsonic-builder-this-member-generics-")
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

        const jsRoot = path.join(tempDir, "node_modules", "@tsonic", "js");
        fs.mkdirSync(jsRoot, { recursive: true });
        fs.writeFileSync(
          path.join(jsRoot, "package.json"),
          JSON.stringify(
            { name: "@tsonic/js", version: "0.0.0", type: "module" },
            null,
            2
          )
        );
        fs.writeFileSync(path.join(jsRoot, "index.js"), "export {};\n");
        fs.writeFileSync(
          path.join(jsRoot, "tsonic.surface.json"),
          JSON.stringify(
            {
              schemaVersion: 1,
              id: "@tsonic/js",
              extends: [],
              requiredTypeRoots: ["."],
              useStandardLib: false,
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          path.join(jsRoot, "index.d.ts"),
          [
            "declare global {",
            "  interface Array<T> {",
            "    readonly length: int;",
            "    slice(start?: int, end?: int): T[];",
            "  }",
            "  interface Map<K, V> {",
            "    get(key: K): V | undefined;",
            "  }",
            "  interface MapConstructor {",
            "    new <K, V>(): Map<K, V>;",
            "  }",
            "  const Map: MapConstructor;",
            "}",
            "export {};",
            "",
          ].join("\n")
        );

        const entryPath = path.join(srcDir, "index.ts");
        fs.writeFileSync(
          entryPath,
          [
            "type EventListener = (...args: unknown[]) => void;",
            "type ListenerRegistration = {",
            "  readonly invoke: EventListener;",
            "};",
            "export class Emitter {",
            "  private readonly listenersByEvent: Map<string, ListenerRegistration[]> =",
            "    new Map<string, ListenerRegistration[]>();",
            "  public emit(eventName: string, ...args: unknown[]): boolean {",
            "    const registrations = this.listenersByEvent.get(eventName);",
            "    if (registrations === undefined || registrations.length === 0) {",
            "      return false;",
            "    }",
            "    const snapshot = registrations.slice();",
            "    for (const registration of snapshot) {",
            "      registration.invoke(...args);",
            "    }",
            "    return true;",
            "  }",
            "}",
          ].join("\n")
        );

        const programResult = createProgram([entryPath], {
          projectRoot: tempDir,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          surface: "@tsonic/js",
        });

        expect(programResult.ok).to.equal(true);
        if (!programResult.ok) return;

        const sourceFile = programResult.value.sourceFiles.find(
          (file) => path.resolve(file.fileName) === path.resolve(entryPath)
        );
        expect(sourceFile).to.not.equal(undefined);
        if (!sourceFile) return;

        const ctx = createProgramContext(programResult.value, {
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
        });

        const moduleResult = buildIrModule(
          sourceFile,
          programResult.value,
          {
            sourceRoot: srcDir,
            rootNamespace: "TestApp",
          },
          ctx
        );

        expect(moduleResult.ok).to.equal(true);
        if (!moduleResult.ok) return;

        const emitterClass = moduleResult.value.body.find(
          (stmt) => stmt.kind === "classDeclaration" && stmt.name === "Emitter"
        );
        expect(emitterClass).to.not.equal(undefined);
        if (!emitterClass || emitterClass.kind !== "classDeclaration") return;

        const emitMethod = emitterClass.members.find(
          (member) =>
            member.kind === "methodDeclaration" && member.name === "emit"
        );
        expect(emitMethod).to.not.equal(undefined);
        if (
          !emitMethod ||
          emitMethod.kind !== "methodDeclaration" ||
          !emitMethod.body
        ) {
          return;
        }

        const snapshotDecl = emitMethod.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0]?.name.name === "snapshot"
        );
        expect(snapshotDecl).to.not.equal(undefined);
        if (!snapshotDecl) return;

        const snapshotInitializer = snapshotDecl.declarations[0]?.initializer;
        expect(snapshotInitializer?.inferredType?.kind).to.equal("arrayType");
        if (snapshotInitializer?.inferredType?.kind !== "arrayType") return;
        expect(snapshotInitializer.inferredType.origin).to.equal("explicit");
        expect(snapshotInitializer.inferredType.elementType.kind).to.equal(
          "referenceType"
        );
        if (snapshotInitializer.inferredType.elementType.kind !== "referenceType") {
          return;
        }
        expect(snapshotInitializer.inferredType.elementType.name).to.equal(
          "ListenerRegistration"
        );

        const forOf = emitMethod.body.statements.find(
          (stmt) => stmt.kind === "forOfStatement"
        );
        expect(forOf).to.not.equal(undefined);
        if (
          !forOf ||
          forOf.kind !== "forOfStatement" ||
          forOf.body.kind !== "blockStatement"
        ) {
          return;
        }

        expect(forOf.expression.inferredType?.kind).to.equal("arrayType");
        if (forOf.expression.inferredType?.kind !== "arrayType") return;
        expect(forOf.expression.inferredType.origin).to.equal("explicit");
        expect(forOf.expression.inferredType.elementType.kind).to.equal(
          "referenceType"
        );
        if (forOf.expression.inferredType.elementType.kind !== "referenceType") {
          return;
        }
        expect(forOf.expression.inferredType.elementType.name).to.equal(
          "ListenerRegistration"
        );

        const invokeExpr = forOf.body.statements[0];
        expect(invokeExpr?.kind).to.equal("expressionStatement");
        if (!invokeExpr || invokeExpr.kind !== "expressionStatement") return;
        expect(invokeExpr.expression.kind).to.equal("call");
        if (invokeExpr.expression.kind !== "call") return;
        expect(invokeExpr.expression.callee.kind).to.equal("memberAccess");
        if (invokeExpr.expression.callee.kind !== "memberAccess") return;
        expect(invokeExpr.expression.callee.inferredType).to.deep.equal({
          kind: "functionType",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "args" },
              type: {
                kind: "arrayType",
                elementType: { kind: "unknownType", explicit: true },
                origin: "explicit",
              },
              initializer: undefined,
              isOptional: false,
              isRest: true,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
        });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("threads constructor surface parameter types for unknown-typed arguments", () => {
      const source = `
        class AssertionError extends Error {
          public actual: unknown = undefined;
          public expected: unknown = undefined;
          public operator: string = "";

          public constructor(
            message?: string,
            actual?: unknown,
            expected?: unknown,
            operator: string = ""
          ) {
            super(message);
            this.actual = actual;
            this.expected = expected;
            this.operator = operator;
          }
        }

        export function create(): AssertionError {
          return new AssertionError("Test message", 5, 10, "===");
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const fn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "create"
      );
      expect(fn).to.not.equal(undefined);
      if (!fn) return;

      const returnStmt = fn.body.statements[0];
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (!returnStmt || returnStmt.kind !== "returnStatement") return;

      const ctor = returnStmt.expression;
      expect(ctor?.kind).to.equal("new");
      if (!ctor || ctor.kind !== "new") return;

      expect(ctor.parameterTypes?.[1]).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "unknownType", explicit: true },
          { kind: "primitiveType", name: "undefined" },
        ],
      });
      expect(ctor.surfaceParameterTypes?.[1]).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "unknownType", explicit: true },
          { kind: "primitiveType", name: "undefined" },
        ],
      });
      expect(ctor.parameterTypes?.[2]).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "unknownType", explicit: true },
          { kind: "primitiveType", name: "undefined" },
        ],
      });
      expect(ctor.surfaceParameterTypes?.[2]).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "unknownType", explicit: true },
          { kind: "primitiveType", name: "undefined" },
        ],
      });
    });
  });
});
