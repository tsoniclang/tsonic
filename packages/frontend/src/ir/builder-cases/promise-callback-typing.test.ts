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
        expect(["Iterable", "IEnumerable_1"]).to.include(
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
        expect(["Iterable", "IEnumerable_1"]).to.include(
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
          { kind: "unknownType" },
          { kind: "primitiveType", name: "undefined" },
        ],
      });
      expect(ctor.surfaceParameterTypes?.[1]).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "unknownType" },
          { kind: "primitiveType", name: "undefined" },
        ],
      });
      expect(ctor.parameterTypes?.[2]).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "unknownType" },
          { kind: "primitiveType", name: "undefined" },
        ],
      });
      expect(ctor.surfaceParameterTypes?.[2]).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "unknownType" },
          { kind: "primitiveType", name: "undefined" },
        ],
      });
    });
  });
});
