/**
 * Tests for extension method owner resolution in IR conversion —
 * globals pollution guard, CLR owner preference, and surface-independent resolution
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  buildIrModule,
  createTestProgram,
  createProgramContext,
  BindingRegistry,
} from "./helpers.js";

describe("Binding Resolution in IR", () => {
  describe("Extension Method Binding Resolution — Owner Resolution", () => {
    it("does not let differently-cased globals pollute authored identifiers", () => {
      const source = `
        declare const Console: {
          Error: {
            WriteLine(message: string): void;
          };
        };

        export function test(): void {
          Console.Error.WriteLine("boom");
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/globals.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.console",
          },
        },
      });

      const { testProgram, ctx, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements[0];
      if (exprStmt?.kind !== "expressionStatement") return;
      if (exprStmt.expression.kind !== "call") return;
      if (exprStmt.expression.callee.kind !== "memberAccess") return;

      const writeLineAccess = exprStmt.expression.callee;
      expect(writeLineAccess.object.kind).to.equal("memberAccess");
      if (writeLineAccess.object.kind !== "memberAccess") return;
      expect(writeLineAccess.object.object.kind).to.equal("identifier");
      if (writeLineAccess.object.object.kind !== "identifier") return;

      expect(writeLineAccess.object.object.name).to.equal("Console");
      expect(writeLineAccess.object.object.resolvedClrType).to.equal(undefined);
      expect(writeLineAccess.object.memberBinding).to.equal(undefined);
    });

    it("prefers the explicitly requested CLR owner when mixed bindings share a TS alias", () => {
      const source = `
        declare class Console {
          log(...data: unknown[]): void;
          error(...data: unknown[]): void;
        }

        declare const console: Console;

        export function test(): void {
          console.error("boom");
          console.log("ok");
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/globals.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.console",
          },
        },
      });
      bindings.addBindings("/test/js-runtime/bindings.json", {
        namespace: "Tsonic.JSRuntime",
        types: [
          {
            clrName: "Tsonic.JSRuntime.console",
            assemblyName: "Tsonic.JSRuntime",
            methods: [
              {
                clrName: "error",
                normalizedSignature:
                  "error|(System.Object[]):System.Void|static=true",
                parameterCount: 1,
                declaringClrType: "Tsonic.JSRuntime.console",
                declaringAssemblyName: "Tsonic.JSRuntime",
              },
              {
                clrName: "log",
                normalizedSignature:
                  "log|(System.Object[]):System.Void|static=true",
                parameterCount: 1,
                declaringClrType: "Tsonic.JSRuntime.console",
                declaringAssemblyName: "Tsonic.JSRuntime",
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });
      bindings.addBindings("/test/nodejs/bindings.json", {
        namespace: "nodejs",
        types: [
          {
            clrName: "nodejs.console",
            assemblyName: "nodejs",
            methods: [
              {
                clrName: "error",
                normalizedSignature:
                  "error|(System.Object,System.Object[]):System.Void|static=true",
                parameterCount: 2,
                declaringClrType: "nodejs.console",
                declaringAssemblyName: "nodejs",
              },
              {
                clrName: "log",
                normalizedSignature:
                  "log|(System.Object,System.Object[]):System.Void|static=true",
                parameterCount: 2,
                declaringClrType: "nodejs.console",
                declaringAssemblyName: "nodejs",
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });
      bindings.addBindings("/test/system-console/bindings.json", {
        namespace: "System",
        types: [
          {
            clrName: "System.Console",
            assemblyName: "System.Console",
            methods: [],
            properties: [
              {
                clrName: "Error",
                normalizedSignature:
                  "Error|:System.IO.TextWriter|static=true|accessor=get",
                declaringClrType: "System.Console",
                declaringAssemblyName: "System.Console",
              },
            ],
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

      const funcDecl = result.value.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const errorStmt = funcDecl.body.statements[0];
      const logStmt = funcDecl.body.statements[1];
      if (errorStmt?.kind !== "expressionStatement") return;
      if (logStmt?.kind !== "expressionStatement") return;
      if (errorStmt.expression.kind !== "call") return;
      if (logStmt.expression.kind !== "call") return;
      if (errorStmt.expression.callee.kind !== "memberAccess") return;
      if (logStmt.expression.callee.kind !== "memberAccess") return;

      expect(errorStmt.expression.callee.memberBinding?.type).to.equal(
        "Tsonic.JSRuntime.console"
      );
      expect(errorStmt.expression.callee.memberBinding?.member).to.equal(
        "error"
      );
      expect(logStmt.expression.callee.memberBinding?.type).to.equal(
        "Tsonic.JSRuntime.console"
      );
      expect(logStmt.expression.callee.memberBinding?.member).to.equal("log");
    });

    it("should resolve the same extension methods regardless of selected surface", () => {
      const source = `
        interface String { trim(): string; }

        export function test(s: string): string {
          return s.trim();
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/Tsonic.JSRuntime/bindings.json", {
        namespace: "Tsonic.JSRuntime",
        types: [
          {
            clrName: "System.String",
            assemblyName: "Tsonic.JSRuntime",
            methods: [
              {
                clrName: "trim",
                normalizedSignature:
                  "trim|(System.String):System.String|static=true",
                parameterCount: 1,
                declaringClrType: "Tsonic.JSRuntime.StringExtensions",
                declaringAssemblyName: "Tsonic.JSRuntime",
                isExtensionMethod: true,
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });

      const { testProgram, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const jsProgram = {
        ...testProgram,
        options: {
          ...testProgram.options,
          surface: "@tsonic/js" as const,
        },
      };

      const ctx = createProgramContext(jsProgram, options);

      const result = buildIrModule(sourceFile, jsProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements[0];
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression)
        return;
      if (returnStmt.expression.kind !== "call") return;
      if (returnStmt.expression.callee.kind !== "memberAccess") return;

      expect(returnStmt.expression.callee.memberBinding).to.not.equal(
        undefined
      );
      expect(
        returnStmt.expression.callee.memberBinding?.isExtensionMethod
      ).to.equal(true);
      expect(returnStmt.expression.callee.memberBinding?.type).to.equal(
        "Tsonic.JSRuntime.StringExtensions"
      );
      expect(returnStmt.expression.callee.memberBinding?.member).to.equal(
        "trim"
      );
    });
  });
});
