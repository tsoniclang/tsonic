/**
 * IR Builder tests: Expression Conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import {
  createFilesystemTestProgram,
  createTestProgram,
} from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Expression Conversion", () => {
    it("should convert template literals", () => {
      const source = `
        const greeting = \`Hello \${name}\`;
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const varDecl = result.value.body[0] as IrVariableDeclaration;
        const init = varDecl.declarations[0]?.initializer;
        if (init && init.kind === "templateLiteral") {
          expect(init.kind).to.equal("templateLiteral");
          expect(init.quasis).to.have.length(2);
          expect(init.expressions).to.have.length(1);
        }
      }
    });

    it("should convert arrow functions", () => {
      const source = `
        const double = (x: number) => x * 2;
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const varDecl = result.value.body[0] as IrVariableDeclaration;
        const init = varDecl.declarations[0]?.initializer;
        if (init && init.kind === "arrowFunction") {
          expect(init.kind).to.equal("arrowFunction");
          expect(init.parameters).to.have.length(1);
        }
      }
    });

    it("uses function-typed identifiers for object literal call-argument context", () => {
      const source = `
        type Getter = ({ x }: { x: number }) => number;

        export function main(): void {
          const getX: Getter = ({ x }) => x;
          getX({ x: 4 });
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
    });

    it("contextually types awaited async return object literals against awaited return shapes", () => {
      const source = `
        type HandlerControl = {
          ended: boolean;
          control?: string | null;
          error?: object;
        };

        async function invokeHandlers(): Promise<HandlerControl> {
          return { ended: false, control: "route", error: undefined };
        }

        async function run(): Promise<void> {
          const control = await invokeHandlers();
          if (control.error !== undefined) {
            return;
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) {
        return;
      }

      const runFn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(runFn).to.not.equal(undefined);
      if (!runFn) {
        return;
      }

      const controlDecl = runFn.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations[0]?.name.kind === "identifierPattern" &&
          stmt.declarations[0]?.name.name === "control"
      );
      expect(controlDecl).to.not.equal(undefined);
      if (!controlDecl) {
        return;
      }

      const initializer = controlDecl.declarations[0]?.initializer;
      expect(initializer?.kind).to.equal("await");
      expect(initializer?.inferredType?.kind).to.equal("objectType");
      expect(
        initializer?.inferredType?.kind === "objectType"
          ? initializer.inferredType.members.map((member) => member.name)
          : []
      ).to.deep.equal(["ended", "control", "error"]);
    });

    it("preserves generic constructor parameter surfaces instead of degrading them to any", () => {
      const source = `
        export class IntervalIterationResult<T> {
          done: boolean;
          value: T | undefined;

          constructor(done: boolean, value: T | undefined) {
            this.done = done;
            this.value = value;
          }
        }

        export class IntervalAsyncIterator<T> {
          close(): IntervalIterationResult<T> {
            return new IntervalIterationResult(true, undefined);
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) {
        return;
      }

      const iteratorClass = result.value.body.find(
        (stmt) =>
          stmt.kind === "classDeclaration" &&
          stmt.name === "IntervalAsyncIterator"
      );
      expect(iteratorClass?.kind).to.equal("classDeclaration");
      if (!iteratorClass || iteratorClass.kind !== "classDeclaration") {
        return;
      }

      const closeMethod = iteratorClass.members.find(
        (member) =>
          member.kind === "methodDeclaration" && member.name === "close"
      );
      expect(closeMethod?.kind).to.equal("methodDeclaration");
      if (
        !closeMethod ||
        closeMethod.kind !== "methodDeclaration" ||
        !closeMethod.body
      ) {
        return;
      }

      const returnStmt = closeMethod.body.statements.find(
        (stmt) => stmt.kind === "returnStatement"
      );
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (
        !returnStmt ||
        returnStmt.kind !== "returnStatement" ||
        !returnStmt.expression
      ) {
        return;
      }

      const newExpr = returnStmt.expression;
      expect(newExpr.kind).to.equal("new");
      if (newExpr.kind !== "new") {
        return;
      }

      const assertGenericUndefinedUnion = (
        type:
          | {
              readonly kind: "unionType";
              readonly types: readonly unknown[];
            }
          | undefined
      ): void => {
        expect(type?.kind).to.equal("unionType");
        if (!type || type.kind !== "unionType") {
          return;
        }

        expect(type.types).to.deep.include({
          kind: "typeParameterType",
          name: "T",
        });
        expect(type.types).to.deep.include({
          kind: "primitiveType",
          name: "undefined",
        });
      };

      assertGenericUndefinedUnion(
        newExpr.parameterTypes?.[1] as
          | {
              readonly kind: "unionType";
              readonly types: readonly unknown[];
            }
          | undefined
      );
      assertGenericUndefinedUnion(
        newExpr.surfaceParameterTypes?.[1] as
          | {
              readonly kind: "unionType";
              readonly types: readonly unknown[];
            }
          | undefined
      );
    });

    it("infers generic constructor type arguments through outer generic callback and promise contexts", () => {
      const source = `
        export class IntervalIterationResult<T> {
          done: boolean;
          value: T | undefined;

          constructor(done: boolean, value: T | undefined) {
            this.done = done;
            this.value = value;
          }
        }

        export class IntervalAsyncIterator<T> {
          enqueue(value?: T): void {
            const waiter: (result: IntervalIterationResult<T>) => void = () => {};
            waiter(new IntervalIterationResult(false, value));
          }

          next(value?: T): Promise<IntervalIterationResult<T>> {
            return Promise.resolve(new IntervalIterationResult(false, value));
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) {
        expect.fail(
          `Expected build success, got diagnostic: ${result.error.message}`
        );
        return;
      }

      const iteratorClass = result.value.body.find(
        (stmt) =>
          stmt.kind === "classDeclaration" &&
          stmt.name === "IntervalAsyncIterator"
      );
      expect(iteratorClass?.kind).to.equal("classDeclaration");
      if (!iteratorClass || iteratorClass.kind !== "classDeclaration") {
        return;
      }

      const nextMethod = iteratorClass.members.find(
        (member) =>
          member.kind === "methodDeclaration" && member.name === "next"
      );
      expect(nextMethod?.kind).to.equal("methodDeclaration");
      if (
        !nextMethod ||
        nextMethod.kind !== "methodDeclaration" ||
        !nextMethod.body
      ) {
        return;
      }

      const nextReturn = nextMethod.body.statements.find(
        (stmt) => stmt.kind === "returnStatement"
      );
      expect(nextReturn?.kind).to.equal("returnStatement");
      if (
        !nextReturn ||
        nextReturn.kind !== "returnStatement" ||
        !nextReturn.expression ||
        nextReturn.expression.kind !== "call"
      ) {
        return;
      }

      const promiseResolveArg = nextReturn.expression.arguments[0];
      expect(promiseResolveArg?.kind).to.equal("new");
      if (!promiseResolveArg || promiseResolveArg.kind !== "new") {
        return;
      }

      const inferredType = promiseResolveArg.inferredType;
      expect(inferredType).to.deep.include({
        kind: "referenceType",
        name: "IntervalIterationResult",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      });
      if (!inferredType || inferredType.kind !== "referenceType") {
        return;
      }
      expect(inferredType.resolvedClrType).to.equal(
        "TestApp.IntervalIterationResult"
      );
      expect(inferredType.typeId).to.deep.equal({
        stableId: "TestApp:TestApp.IntervalIterationResult",
        clrName: "TestApp.IntervalIterationResult",
        assemblyName: "TestApp",
        tsName: "IntervalIterationResult",
      });
      expect(promiseResolveArg.typeArguments).to.deep.equal([
        { kind: "typeParameterType", name: "T" },
      ]);
    });

    it("infers generic constructor type arguments through imported generic queue members", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": `
            import { Queue } from "@tsonic/dotnet/System.Collections.Generic.js";

            export class IntervalIterationResult<T> {
              done: boolean;
              value: T | undefined;

              constructor(done: boolean, value: T | undefined) {
                this.done = done;
                this.value = value;
              }
            }

            export class IntervalAsyncIterator<T> {
              #waiters: Queue<
                (result: IntervalIterationResult<T>) => void
              > = new Queue<(result: IntervalIterationResult<T>) => void>();

              enqueue(value?: T): void {
                if (this.#waiters.Count > 0) {
                  const waiter = this.#waiters.Dequeue();
                  waiter(new IntervalIterationResult(false, value));
                }
              }
            }
          `,
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic.d.ts": `
            export declare class Queue<T> {
              Count: number;
              constructor();
              Dequeue(): T;
              Enqueue(value: T): void;
            }
          `,
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) {
          expect.fail(
            `Expected build success, got diagnostic: ${result.error.message}`
          );
          return;
        }

        const iteratorClass = result.value.body.find(
          (stmt) =>
            stmt.kind === "classDeclaration" &&
            stmt.name === "IntervalAsyncIterator"
        );
        expect(iteratorClass?.kind).to.equal("classDeclaration");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves unknown array element types through conditional spread arrays", () => {
      const source = `
        function inspect(value: unknown): string {
          return "";
        }

        function format(message?: unknown, optionalParams: readonly unknown[] = []): string {
          const values =
            message === undefined ? [...optionalParams] : [message, ...optionalParams];
          return values.map((value) => inspect(value)).join(" ");
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "format"
        );
        expect(fn).to.not.equal(undefined);
        const valuesDecl = fn?.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "values"
            )
        );
        const valuesInit = valuesDecl?.declarations[0]?.initializer;
        expect(valuesInit?.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: { kind: "unknownType", explicit: true },
        });
      }
    });

    it("infers generic array callback return types when callbacks omit trailing parameters", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function inspect(value: unknown): string;",
            "",
            "export function format(",
            "  message?: unknown,",
            "  optionalParams: readonly unknown[] = []",
            "): string {",
            "  const values =",
            "    message === undefined ? [...optionalParams] : [message, ...optionalParams];",
            '  return values.map((value) => inspect(value)).join(" ");',
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "format"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const returnStmt = fn.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "returnStatement" }> =>
            stmt.kind === "returnStatement"
        );
        expect(returnStmt?.expression?.kind).to.equal("call");
        if (!returnStmt?.expression || returnStmt.expression.kind !== "call") {
          return;
        }

        const joinCall = returnStmt.expression;
        expect(joinCall.callee.kind).to.equal("memberAccess");
        if (joinCall.callee.kind !== "memberAccess") {
          return;
        }

        expect(joinCall.callee.object.kind).to.equal("call");
        if (joinCall.callee.object.kind !== "call") {
          return;
        }

        expect(joinCall.callee.object.inferredType).to.deep.equal({
          kind: "arrayType",
          elementType: { kind: "primitiveType", name: "string" },
          origin: "explicit",
        });
      } finally {
        fixture.cleanup();
      }
    });
  });
});
