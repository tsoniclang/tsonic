/**
 * Tests for basic global identifier resolution in IR conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  buildIrModule,
  createTestProgram,
  BindingRegistry,
} from "./helpers.js";
import type { IrIdentifierExpression } from "./helpers.js";
import {
  runAnonymousTypeLoweringPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
} from "../validation/index.js";

describe("Binding Resolution in IR", () => {
  describe("Global Identifier Resolution", () => {
    it("should resolve console to CLR type when binding exists", () => {
      const source = `
        export function test() {
          console.log("hello");
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.console",
          },
        },
      });

      const { testProgram, ctx, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      expect(funcDecl?.kind).to.equal("functionDeclaration");

      if (funcDecl?.kind !== "functionDeclaration") return;

      // Find the console.log call in the function body
      const exprStmt = funcDecl.body.statements[0];
      expect(exprStmt?.kind).to.equal("expressionStatement");

      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");

      if (callExpr.kind !== "call") return;

      const memberExpr = callExpr.callee;
      expect(memberExpr.kind).to.equal("memberAccess");

      if (memberExpr.kind !== "memberAccess") return;

      const consoleExpr = memberExpr.object as IrIdentifierExpression;
      expect(consoleExpr.kind).to.equal("identifier");
      expect(consoleExpr.name).to.equal("console");
      expect(consoleExpr.resolvedClrType).to.equal("Tsonic.Runtime.console");
      expect(consoleExpr.resolvedAssembly).to.equal("Tsonic.Runtime");
    });

    it("should not resolve identifiers without bindings", () => {
      const source = `
        export function test() {
          customGlobal.method();
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements[0];
      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      if (callExpr.kind !== "call") return;

      const memberExpr = callExpr.callee;
      if (memberExpr.kind !== "memberAccess") return;

      const globalExpr = memberExpr.object as IrIdentifierExpression;
      expect(globalExpr.kind).to.equal("identifier");
      expect(globalExpr.name).to.equal("customGlobal");
      expect(globalExpr.resolvedClrType).to.equal(undefined);
      expect(globalExpr.resolvedAssembly).to.equal(undefined);
    });

    it("should resolve Math to CLR type", () => {
      const source = `
        export function test() {
          return Math.sqrt(16);
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        bindings: {
          Math: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.Math",
          },
        },
      });

      const { testProgram, ctx, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "returnStatement"
      );
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression)
        return;

      const callExpr = returnStmt.expression;
      if (callExpr.kind !== "call") return;

      const memberExpr = callExpr.callee;
      if (memberExpr.kind !== "memberAccess") return;

      const mathExpr = memberExpr.object as IrIdentifierExpression;
      expect(mathExpr.kind).to.equal("identifier");
      expect(mathExpr.name).to.equal("Math");
      expect(mathExpr.resolvedClrType).to.equal("Tsonic.Runtime.Math");
      expect(mathExpr.resolvedAssembly).to.equal("Tsonic.Runtime");
    });

    it("prefers the global binding when a module binding shares the same alias", () => {
      const source = `
        export function test() {
          console.error("hello");
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/js.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "js",
            type: "js.console",
          },
        },
      });
      bindings.addBindings("/test/nodejs.json", {
        bindings: {
          console: {
            kind: "module",
            assembly: "nodejs",
            type: "nodejs.console",
          },
        },
      });

      const { testProgram, ctx, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements[0];
      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      if (callExpr.kind !== "call") return;

      const memberExpr = callExpr.callee;
      if (memberExpr.kind !== "memberAccess") return;

      const consoleExpr = memberExpr.object as IrIdentifierExpression;
      expect(consoleExpr.kind).to.equal("identifier");
      expect(consoleExpr.name).to.equal("console");
      expect(consoleExpr.resolvedClrType).to.equal("js.console");
      expect(consoleExpr.resolvedAssembly).to.equal("js");
    });

    it("prefers the exact CLR numeric alias overload for explicitly typed arguments", () => {
      const source = `
        type byte = number;
        type int = number;

        class JsonValue {
          static Create(value: byte): JsonValue;
          static Create(value: int): JsonValue;
          static Create(value: string): JsonValue;
          static Create(_value: unknown): JsonValue {
            return new JsonValue();
          }
        }

        export function test() {
          const extra: int = 42;
          return JsonValue.Create(extra);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body.find(
        (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
      );
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "returnStatement"
      );
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression) {
        return;
      }

      const callExpr = returnStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      expect(callExpr.parameterTypes?.[0]).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("keeps the resolved CLR overload when an unannotated number also matches a non-numeric overload", () => {
      const source = `
        type int = number;

        declare class TimeSpan {
          readonly ticks: int;
        }

        declare const process: {
          WaitForExit(milliseconds: int): boolean;
          WaitForExit(timeout: TimeSpan): boolean;
        };

        export function test(timeout: number): boolean {
          return process.WaitForExit(timeout);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body.find(
        (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
      );
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "returnStatement"
      );
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression) {
        return;
      }

      const callExpr = returnStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      expect(callExpr.parameterTypes?.[0]).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("does not let broad-number evidence override a distinct first-argument shape", () => {
      const source = `
        type int = number;

        declare const values: Iterable<number>;

        declare class BufferLike {
          set(index: int, value: number): void;
          set(values: Iterable<number>, offset?: int): void;
        }

        declare const buffer: BufferLike;

        export function test(length: number): void {
          buffer.set(values, length);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body.find(
        (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
      );
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "expressionStatement"
      );
      expect(exprStmt?.kind).to.equal("expressionStatement");
      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      expect(callExpr.parameterTypes?.[1]).to.deep.equal({
        kind: "unionType",
        types: [
          {
            kind: "primitiveType",
            name: "int",
          },
          {
            kind: "primitiveType",
            name: "undefined",
          },
        ],
      });
      expect(callExpr.parameterTypes?.[0]).to.not.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("keeps explicit string-return overloads over sibling char overloads", () => {
      const source = `
        type char = string;

        declare const Console: {
          WriteLine(value: char): void;
          WriteLine(value: string): void;
        };

        function formatArgs(): string {
          return "";
        }

        export function test(): void {
          Console.WriteLine(formatArgs());
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body.find(
        (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
      );
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "expressionStatement"
      );
      expect(exprStmt?.kind).to.equal("expressionStatement");
      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      expect(callExpr.parameterTypes?.[0]).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });

    it("keeps string overloads for multi-character ternary expressions", () => {
      const source = `
        type char = string;

        declare const Console: {
          WriteLine(value: char): void;
          WriteLine(value: string): void;
        };

        declare const ok: boolean;

        export function test(): void {
          Console.WriteLine(ok ? "READY" : "WAIT");
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body.find(
        (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
      );
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "expressionStatement"
      );
      expect(exprStmt?.kind).to.equal("expressionStatement");
      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      expect(callExpr.parameterTypes?.[0]).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });

    it("keeps string overloads for identifiers inferred from multi-character literals", () => {
      const source = `
        type char = string;

        declare const Console: {
          WriteLine(value: char): void;
          WriteLine(value: string): void;
        };

        export function test(): void {
          const message = "inner";
          Console.WriteLine(message);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body.find(
        (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
      );
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "expressionStatement"
      );
      expect(exprStmt?.kind).to.equal("expressionStatement");
      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      expect(callExpr.parameterTypes?.[0]).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });

    it("keeps exact string overloads over sibling char and rest-format overloads", () => {
      const source = `
        type char = string;

        declare const Console: {
          WriteLine(value: char): void;
          WriteLine(value: string): void;
          WriteLine(format: string, ...args: unknown[]): void;
        };

        function formatArgs(): string {
          return "hello";
        }

        export function test(): void {
          Console.WriteLine(formatArgs());
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body.find(
        (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
      );
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "expressionStatement"
      );
      expect(exprStmt?.kind).to.equal("expressionStatement");
      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      expect(callExpr.parameterTypes?.length).to.equal(1);
      expect(callExpr.parameterTypes?.[0]).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });

    it("keeps string overloads for concatenation expressions", () => {
      const source = `
        type char = string;

        declare const Console: {
          WriteLine(value: char): void;
          WriteLine(value: string): void;
        };

        function formatArgs(): string {
          return "hello";
        }

        export function test(): void {
          Console.WriteLine("WARN: " + formatArgs());
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body.find(
        (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
      );
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "expressionStatement"
      );
      expect(exprStmt?.kind).to.equal("expressionStatement");
      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      expect(callExpr.parameterTypes?.[0]).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });

    it("keeps string overloads for null-checked string identifiers", () => {
      const source = `
        type char = string;

        declare const writer: {
          Write(value: char): void;
          Write(value: string): void;
        };

        declare const maybeText: string | null;

        export function test(): void {
          if (maybeText !== null) {
            writer.Write(maybeText);
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body.find(
        (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
      );
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const ifStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "ifStatement"
      );
      expect(ifStmt?.kind).to.equal("ifStatement");
      if (ifStmt?.kind !== "ifStatement") return;
      expect(ifStmt.thenStatement.kind).to.equal("blockStatement");
      if (ifStmt.thenStatement.kind !== "blockStatement") return;
      const thenStmt = ifStmt.thenStatement.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "expressionStatement" }> =>
          stmt.kind === "expressionStatement"
      );
      expect(thenStmt?.kind).to.equal("expressionStatement");
      if (thenStmt?.kind !== "expressionStatement") return;

      const callExpr = thenStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      expect(callExpr.parameterTypes?.[0]).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });

    it("keeps exact-arity string overloads over longer sibling overloads", () => {
      const source = `
        type char = string;
        type int = number;

        declare const value: {
          Split(separator: char, options: boolean): string[];
          Split(separator: string, options: boolean): string[];
          Split(separator: string, count: int, options: boolean): string[];
        };

        declare const separator: string;

        export function test(options: boolean): string[] {
          return value.Split(separator, options);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body.find(
        (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
      );
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "returnStatement"
      );
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression) {
        return;
      }

      const callExpr = returnStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      expect(callExpr.parameterTypes?.length).to.equal(2);
      expect(callExpr.parameterTypes?.[0]).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
    });

    it("keeps exact numeric aliases returned from helper calls when sibling overloads share the same first argument shape", () => {
      const source = `
        type char = string;
        type int = number;

        declare enum StringComparison {
          CurrentCulture = 0,
        }

        declare const value: {
          LastIndexOf(search: char, startIndex: int): int;
          LastIndexOf(search: string, startIndex: int): int;
          LastIndexOf(search: string, comparisonType: StringComparison): int;
        };

        declare const searchString: string;
        declare const position: int;

        declare function clamp(
          value: int,
          minimum: int,
          maximum: int
        ): int;

        export function test(): int {
          return value.LastIndexOf(
            searchString,
            clamp(position, 0 as int, position)
          );
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body.find(
        (stmt) => stmt.kind === "functionDeclaration" && stmt.name === "test"
      );
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements.find(
        (stmt) => stmt.kind === "returnStatement"
      );
      expect(returnStmt?.kind).to.equal("returnStatement");
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression) {
        return;
      }

      const callExpr = returnStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      expect(callExpr.parameterTypes?.length).to.equal(2);
      expect(callExpr.parameterTypes?.[0]).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });
      expect(callExpr.parameterTypes?.[1]).to.deep.equal({
        kind: "primitiveType",
        name: "int",
      });
    });

    it("should resolve global function bindings with csharpName on identifier callees", () => {
      const source = `
        export function test() {
          setInterval(() => {}, 1000);
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        bindings: {
          setInterval: {
            kind: "global",
            assembly: "js",
            type: "js.Timers",
            csharpName: "Timers.setInterval",
          },
        },
      });

      const { testProgram, ctx, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      expect(funcDecl?.kind).to.equal("functionDeclaration");

      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements[0];
      expect(exprStmt?.kind).to.equal("expressionStatement");

      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");

      if (callExpr.kind !== "call") return;

      const calleeExpr = callExpr.callee;
      expect(calleeExpr.kind).to.equal("identifier");

      if (calleeExpr.kind !== "identifier") return;

      expect(calleeExpr.name).to.equal("setInterval");
      expect(calleeExpr.csharpName).to.equal("Timers.setInterval");
      expect(calleeExpr.resolvedClrType).to.equal("js.Timers");
      expect(calleeExpr.resolvedAssembly).to.equal("js");
    });

    it("uses the unique CLR runtime overload for global bindings while preserving the ambient surface", () => {
      const source = `
        declare function setInterval(
          handler: (...args: unknown[]) => void,
          timeout?: number,
          ...args: unknown[]
        ): number;

        export function test() {
          setInterval(() => {}, 1000);
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        bindings: {
          setInterval: {
            kind: "global",
            assembly: "Acme.ExternalRuntime",
            type: "Acme.ExternalRuntime.Timers",
            csharpName: "Timers.setInterval",
          },
        },
      });
      bindings.addBindings("/test/Acme.ExternalRuntime/bindings.json", {
        namespace: "Acme.ExternalRuntime",
        types: [
          {
            clrName: "Acme.ExternalRuntime.Timers",
            assemblyName: "Acme.ExternalRuntime",
            methods: [
              {
                clrName: "setInterval",
                normalizedSignature:
                  "setInterval|(System.Action,System.Double):System.Double|static=true",
                parameterCount: 2,
                declaringClrType: "Acme.ExternalRuntime.Timers",
                declaringAssemblyName: "Acme.ExternalRuntime",
                semanticSignature: {
                  parameters: [
                    {
                      kind: "parameter",
                      pattern: {
                        kind: "identifierPattern",
                        name: "handler",
                      },
                      type: {
                        kind: "referenceType",
                        name: "System.Action",
                        resolvedClrType: "System.Action",
                      },
                      isOptional: false,
                      isRest: false,
                      passing: "value",
                    },
                    {
                      kind: "parameter",
                      pattern: {
                        kind: "identifierPattern",
                        name: "timeout",
                      },
                      type: {
                        kind: "primitiveType",
                        name: "number",
                      },
                      isOptional: false,
                      isRest: false,
                      passing: "value",
                    },
                  ],
                  returnType: {
                    kind: "primitiveType",
                    name: "number",
                  },
                },
              },
              {
                clrName: "setInterval",
                normalizedSignature:
                  "setInterval|(System.Action_1,System.Double,System.Object):System.Double|static=true",
                parameterCount: 3,
                declaringClrType: "Acme.ExternalRuntime.Timers",
                declaringAssemblyName: "Acme.ExternalRuntime",
                semanticSignature: {
                  typeParameters: ["T0"],
                  parameters: [
                    {
                      kind: "parameter",
                      pattern: {
                        kind: "identifierPattern",
                        name: "handler",
                      },
                      type: {
                        kind: "referenceType",
                        name: "Action_1",
                        resolvedClrType: "System.Action`1",
                        typeArguments: [
                          {
                            kind: "typeParameterType",
                            name: "T0",
                          },
                        ],
                      },
                      isOptional: false,
                      isRest: false,
                      passing: "value",
                    },
                    {
                      kind: "parameter",
                      pattern: {
                        kind: "identifierPattern",
                        name: "timeout",
                      },
                      type: {
                        kind: "primitiveType",
                        name: "number",
                      },
                      isOptional: false,
                      isRest: false,
                      passing: "value",
                    },
                    {
                      kind: "parameter",
                      pattern: {
                        kind: "identifierPattern",
                        name: "arg0",
                      },
                      type: {
                        kind: "typeParameterType",
                        name: "T0",
                      },
                      isOptional: false,
                      isRest: false,
                      passing: "value",
                    },
                  ],
                  returnType: {
                    kind: "primitiveType",
                    name: "number",
                  },
                },
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });

      const { testProgram, ctx, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements[0];
      expect(exprStmt?.kind).to.equal("expressionStatement");
      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      const runtimeHandlerType = callExpr.parameterTypes?.[0];
      expect(runtimeHandlerType?.kind).to.equal("referenceType");
      if (runtimeHandlerType?.kind === "referenceType") {
        expect(runtimeHandlerType.resolvedClrType).to.equal("System.Action");
      }

      const surfaceHandlerType = callExpr.surfaceParameterTypes?.[0];
      expect(surfaceHandlerType?.kind).to.equal("functionType");
      if (surfaceHandlerType?.kind === "functionType") {
        expect(surfaceHandlerType.parameters).to.have.length(1);
        expect(surfaceHandlerType.parameters[0]?.isRest).to.equal(true);
      }

      const runtimeHandler = callExpr.arguments[0];
      expect(runtimeHandler?.kind).to.equal("arrowFunction");
      if (runtimeHandler?.kind === "arrowFunction") {
        expect(runtimeHandler.inferredType?.kind).to.equal("functionType");
        if (runtimeHandler.inferredType?.kind === "functionType") {
          expect(runtimeHandler.inferredType.parameters).to.have.length(0);
        }
      }

      const lowered = runAnonymousTypeLoweringPass([module]).modules;
      const proofResult = runNumericProofPass(lowered);
      expect(proofResult.ok).to.equal(true);
      if (!proofResult.ok) return;

      const refreshed = runCallResolutionRefreshPass(proofResult.modules, ctx)
        .modules[0];
      const refreshedFuncDecl = refreshed?.body[0];
      expect(refreshedFuncDecl?.kind).to.equal("functionDeclaration");
      if (refreshedFuncDecl?.kind !== "functionDeclaration") return;

      const refreshedExprStmt = refreshedFuncDecl.body.statements[0];
      expect(refreshedExprStmt?.kind).to.equal("expressionStatement");
      if (refreshedExprStmt?.kind !== "expressionStatement") return;

      const refreshedCallExpr = refreshedExprStmt.expression;
      expect(refreshedCallExpr.kind).to.equal("call");
      if (refreshedCallExpr.kind !== "call") return;

      const refreshedRuntimeHandlerType = refreshedCallExpr.parameterTypes?.[0];
      expect(refreshedRuntimeHandlerType?.kind).to.equal("referenceType");
      if (refreshedRuntimeHandlerType?.kind === "referenceType") {
        expect(refreshedRuntimeHandlerType.resolvedClrType).to.equal(
          "System.Action"
        );
      }

      const refreshedSurfaceHandlerType =
        refreshedCallExpr.surfaceParameterTypes?.[0];
      expect(refreshedSurfaceHandlerType?.kind).to.equal("functionType");
      if (refreshedSurfaceHandlerType?.kind === "functionType") {
        expect(refreshedSurfaceHandlerType.parameters).to.have.length(1);
        expect(refreshedSurfaceHandlerType.parameters[0]?.isRest).to.equal(
          true
        );
      }
    });

    it("prefers typed object overloads over erased unknown overloads for object literals", () => {
      const source = `
        declare class MkdirOptions {
          readonly __tsonic_type_nodejs_MkdirOptions: never;
          recursive?: boolean;
        }

        declare const fs: {
          mkdirSync(path: string, options: MkdirOptions): void;
          mkdirSync(path: string, recursive?: boolean): void;
          mkdirSync(path: string, options: unknown): void;
        };

        export function test(dir: string): void {
          fs.mkdirSync(dir, { recursive: true });
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements[0];
      expect(exprStmt?.kind).to.equal("expressionStatement");
      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      const optionsType = callExpr.parameterTypes?.[1];
      expect(optionsType?.kind).to.equal("referenceType");
      if (optionsType?.kind !== "referenceType") return;
      expect(optionsType.name).to.equal("MkdirOptions");
    });

    it("extracts structural members from tsbindgen-style accessor instance aliases", () => {
      const source = `
        declare interface MkdirOptions$instance {
          readonly __tsonic_type_nodejs_MkdirOptions: never;
          get recursive(): boolean | undefined;
          set recursive(value: boolean | undefined);
          get mode(): number | undefined;
          set mode(value: number | undefined);
        }

        declare const MkdirOptions: {
          new(): MkdirOptions;
        };

        declare type MkdirOptions = MkdirOptions$instance;

        declare const fs: {
          mkdirSync(path: string, options: MkdirOptions): void;
          mkdirSync(path: string, recursive?: boolean): void;
          mkdirSync(path: string, options: unknown): void;
        };

        export function test(dir: string): void {
          fs.mkdirSync(dir, { recursive: true });
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements[0];
      expect(exprStmt?.kind).to.equal("expressionStatement");
      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      const optionsType = callExpr.parameterTypes?.[1];
      expect(optionsType?.kind).to.equal("referenceType");
      if (optionsType?.kind !== "referenceType") return;
      expect(optionsType.name).to.equal("MkdirOptions$instance");
      expect(optionsType.structuralMembers?.map((m) => m.name)).to.deep.equal([
        "recursive",
        "mode",
      ]);
    });
  });
});
