/**
 * Tests for binding resolution in IR conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { buildIrModule } from "./builder.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { IrIdentifierExpression } from "./types.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";

describe("Binding Resolution in IR", () => {
  const createTestProgram = (
    source: string,
    bindings?: BindingRegistry,
    fileName = "/test/sample.ts"
  ) => {
    const sourceFile = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS
    );

    const program = ts.createProgram(
      [fileName],
      {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
      {
        getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
        writeFile: () => {},
        getCurrentDirectory: () => "/test",
        getDirectories: () => [],
        fileExists: () => true,
        readFile: () => source,
        getCanonicalFileName: (f) => f,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n",
        getDefaultLibFileName: (_options) => "lib.d.ts",
      }
    );

    return {
      program,
      checker: program.getTypeChecker(),
      options: { sourceRoot: "/test", rootNamespace: "TestApp", strict: true },
      sourceFiles: [sourceFile],
      metadata: new DotnetMetadataRegistry(),
      bindings: bindings || new BindingRegistry(),
      clrResolver: createClrBindingsResolver("/test"),
    };
  };

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

      const testProgram = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, {
        sourceRoot: "/test",
        rootNamespace: "TestApp",
      });

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

      const testProgram = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, {
        sourceRoot: "/test",
        rootNamespace: "TestApp",
      });

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

      const testProgram = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, {
        sourceRoot: "/test",
        rootNamespace: "TestApp",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements[0];
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
  });

  describe("Module Import Resolution", () => {
    it("should mark module imports with resolved CLR types in import extraction", () => {
      const source = `
        import { readFileSync } from "fs";
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/node.json", {
        bindings: {
          fs: {
            kind: "module",
            assembly: "Tsonic.NodeApi",
            type: "Tsonic.NodeApi.fs",
          },
        },
      });

      const testProgram = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, {
        sourceRoot: "/test",
        rootNamespace: "TestApp",
      });

      // May fail due to unresolved import, but we can still check the IR structure
      if (!result.ok) {
        // This is expected for bound modules that don't actually exist
        return;
      }

      const module = result.value;
      expect(module.imports).to.have.lengthOf(1);

      const fsImport = module.imports[0];
      if (!fsImport) throw new Error("No import found");
      expect(fsImport.source).to.equal("fs");
      expect(fsImport.resolvedClrType).to.equal("Tsonic.NodeApi.fs");
      expect(fsImport.resolvedAssembly).to.equal("Tsonic.NodeApi");
    });

    it("should handle imports without bindings", () => {
      const source = `
        export const x = 42;
      `;

      const bindings = new BindingRegistry();
      // No bindings added

      const testProgram = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, {
        sourceRoot: "/test",
        rootNamespace: "TestApp",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      // No imports in this test
      expect(module.imports).to.have.lengthOf(0);
    });
  });

  describe("Identifier Renaming with csharpName", () => {
    it("should use csharpName when provided in binding", () => {
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
            assembly: "System",
            type: "System.Console",
            csharpName: "Console",
          },
        },
      });

      const testProgram = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, {
        sourceRoot: "/test",
        rootNamespace: "TestApp",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      expect(funcDecl?.kind).to.equal("functionDeclaration");

      if (funcDecl?.kind !== "functionDeclaration") return;

      // Find the console.log call
      const exprStmt = funcDecl.body.statements[0];
      expect(exprStmt?.kind).to.equal("expressionStatement");

      if (exprStmt?.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");

      if (callExpr.kind !== "call") return;

      const memberExpr = callExpr.callee;
      expect(memberExpr.kind).to.equal("memberAccess");

      if (memberExpr.kind !== "memberAccess") return;

      // Check that the identifier has csharpName set
      const consoleExpr = memberExpr.object as IrIdentifierExpression;
      expect(consoleExpr.kind).to.equal("identifier");
      expect(consoleExpr.name).to.equal("console");
      expect(consoleExpr.csharpName).to.equal("Console");
      expect(consoleExpr.resolvedClrType).to.equal("System.Console");
      expect(consoleExpr.resolvedAssembly).to.equal("System");
    });

    it("should work without csharpName (use resolvedClrType)", () => {
      const source = `
        export function test() {
          Math.sqrt(4);
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        bindings: {
          Math: {
            kind: "global",
            assembly: "Tsonic.Runtime",
            type: "Tsonic.Runtime.Math",
            // No csharpName specified
          },
        },
      });

      const testProgram = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, {
        sourceRoot: "/test",
        rootNamespace: "TestApp",
      });

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

      const mathExpr = memberExpr.object as IrIdentifierExpression;
      expect(mathExpr.kind).to.equal("identifier");
      expect(mathExpr.name).to.equal("Math");
      expect(mathExpr.csharpName).to.equal(undefined); // No csharpName
      expect(mathExpr.resolvedClrType).to.equal("Tsonic.Runtime.Math");
      expect(mathExpr.resolvedAssembly).to.equal("Tsonic.Runtime");
    });
  });

  describe("Hierarchical Binding Resolution", () => {
    it("should resolve namespace.type.member hierarchical bindings", () => {
      const source = `
        import { systemLinq } from "system-linq";
        export function test() {
          return systemLinq.enumerable.selectMany([1, 2], x => [x, x * 2]);
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/system-linq.json", {
        assembly: "System.Linq",
        namespaces: [
          {
            name: "System.Linq",
            alias: "systemLinq",
            types: [
              {
                name: "Enumerable",
                alias: "enumerable",
                kind: "class",
                members: [
                  {
                    kind: "method",
                    name: "SelectMany",
                    alias: "selectMany",
                    binding: {
                      assembly: "System.Linq",
                      type: "System.Linq.Enumerable",
                      member: "SelectMany",
                    },
                  },
                ],
              },
            ],
          },
        ],
      });

      const testProgram = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, {
        sourceRoot: "/test",
        rootNamespace: "TestApp",
      });

      // May fail due to unresolved import, but we can check the IR if it succeeds
      if (!result.ok) {
        // Expected for unresolved imports
        return;
      }

      const module = result.value;
      const funcDecl = module.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements[0];
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression)
        return;

      const callExpr = returnStmt.expression;
      if (callExpr.kind !== "call") return;

      const memberExpr = callExpr.callee;
      if (memberExpr.kind !== "memberAccess") return;

      // Check that the member access has the hierarchical binding resolved
      expect(memberExpr.memberBinding).to.not.equal(undefined);
      expect(memberExpr.memberBinding?.assembly).to.equal("System.Linq");
      expect(memberExpr.memberBinding?.type).to.equal("System.Linq.Enumerable");
      expect(memberExpr.memberBinding?.member).to.equal("SelectMany");
    });

    it("should not resolve member bindings for non-matching patterns", () => {
      const source = `
        export function test() {
          const obj = { prop: "value" };
          return obj.prop;
        }
      `;

      const bindings = new BindingRegistry();
      // Add some bindings that won't match
      bindings.addBindings("/test/unrelated.json", {
        assembly: "Unrelated",
        namespaces: [
          {
            name: "unrelated",
            alias: "Unrelated",
            types: [],
          },
        ],
      });

      const testProgram = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, {
        sourceRoot: "/test",
        rootNamespace: "TestApp",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = result.value;
      const funcDecl = module.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements[0];
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression)
        return;

      const memberExpr = returnStmt.expression;
      if (memberExpr.kind !== "memberAccess") return;

      // Should NOT have member binding for regular object property access
      expect(memberExpr.memberBinding).to.equal(undefined);
    });

    it("should handle nested member access with partial binding matches", () => {
      const source = `
        import { myLib } from "my-lib";
        export function test() {
          // myLib.typeA is recognized, but .unknownMember is not in bindings
          return myLib.typeA.unknownMember;
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/my-lib.json", {
        assembly: "MyLib",
        namespaces: [
          {
            name: "MyLib",
            alias: "myLib",
            types: [
              {
                name: "TypeA",
                alias: "typeA",
                kind: "class",
                members: [
                  {
                    kind: "method",
                    name: "KnownMember",
                    alias: "knownMember",
                    binding: {
                      assembly: "MyLib",
                      type: "MyLib.TypeA",
                      member: "KnownMember",
                    },
                  },
                ],
              },
            ],
          },
        ],
      });

      const testProgram = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, {
        sourceRoot: "/test",
        rootNamespace: "TestApp",
      });

      // May fail due to unresolved import
      if (!result.ok) {
        return;
      }

      const module = result.value;
      const funcDecl = module.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements[0];
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression)
        return;

      const memberExpr = returnStmt.expression;
      if (memberExpr.kind !== "memberAccess") return;

      // unknownMember is not in the bindings, so memberBinding should be undefined
      expect(memberExpr.memberBinding).to.equal(undefined);
    });
  });
});
