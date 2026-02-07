/**
 * Tests for binding resolution in IR conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { buildIrModule } from "./builder.js";
import { createProgramContext } from "./program-context.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { IrIdentifierExpression } from "./types.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "./binding/index.js";

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

    const checker = program.getTypeChecker();

    const testProgram = {
      program,
      checker,
      options: {
        projectRoot: "/test",
        sourceRoot: "/test",
        rootNamespace: "TestApp",
        strict: true,
      },
      sourceFiles: [sourceFile],
      declarationSourceFiles: [],
      metadata: new DotnetMetadataRegistry(),
      bindings: bindings || new BindingRegistry(),
      clrResolver: createClrBindingsResolver("/test"),
      binding: createBinding(checker),
    };

    // Create ProgramContext for the test
    const options = { sourceRoot: "/test", rootNamespace: "TestApp" };
    const ctx = createProgramContext(testProgram, options);

    return { testProgram, ctx, options };
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

      const { testProgram, ctx, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

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

      const { testProgram, ctx, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

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

      const { testProgram, ctx, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

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

      const { testProgram, ctx, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

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

      const { testProgram, ctx, options } = createTestProgram(source, bindings);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

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

  describe("Extension Method Binding Resolution", () => {
    it("should resolve instance-style tsbindgen extension methods via __Ext_* container", () => {
      const source = `
        interface IEnumerable_1<T> {}

        interface __Ext_System_Linq_IEnumerable_1<T> {
          // Signature shape doesn't matter for binding lookup; this is an extension marker surface.
          TryGetNonEnumeratedCount(count: number): boolean;
        }

        type ExtensionMethods_System_Linq<TShape> =
          TShape & (TShape extends IEnumerable_1<infer T0> ? __Ext_System_Linq_IEnumerable_1<T0> : {});

        type LinqSeq<T> = ExtensionMethods_System_Linq<IEnumerable_1<T>>;

        declare const xs: LinqSeq<number>;

        export function test() {
          let count = 0;
          return xs.TryGetNonEnumeratedCount(count);
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/System.Linq/bindings.json", {
        namespace: "System.Linq",
        types: [
          {
            clrName: "System.Linq.Enumerable",
            assemblyName: "System.Linq",
            methods: [
              {
                clrName: "TryGetNonEnumeratedCount",
                normalizedSignature:
                  "TryGetNonEnumeratedCount|(IEnumerable_1,System.Int32&):System.Boolean|static=true",
                declaringClrType: "System.Linq.Enumerable",
                declaringAssemblyName: "System.Linq",
                isExtensionMethod: true,
                parameterModifiers: [{ index: 1, modifier: "out" }],
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
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements[1];
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression) return;

      const callExpr = returnStmt.expression;
      if (callExpr.kind !== "call") return;

      const callee = callExpr.callee;
      if (callee.kind !== "memberAccess") return;

      expect(callee.memberBinding).to.not.equal(undefined);
      expect(callee.memberBinding?.isExtensionMethod).to.equal(true);
      expect(callee.memberBinding?.type).to.equal("System.Linq.Enumerable");
      expect(callee.memberBinding?.member).to.equal("TryGetNonEnumeratedCount");

      // CRITICAL: parameterModifiers must be shifted for instance-style extension calls.
      expect(callee.memberBinding?.parameterModifiers).to.deep.equal([
        { index: 0, modifier: "out" },
      ]);

      // And the call itself must carry passing mode for the single argument.
      expect(callExpr.argumentPassing).to.deep.equal(["out"]);
    });

    it("should pick the correct extension method overload for out/ref modifiers based on call arity", () => {
      const source = `
        interface ReadOnlySpan_1<T> {}

        interface __Ext_System_ReadOnlySpan_1<T> {
          Overlaps(other: ReadOnlySpan_1<T>): boolean;
          Overlaps(other: ReadOnlySpan_1<T>, elementOffset: number): boolean;
        }

        type ExtensionMethods_System<TShape> =
          TShape & (TShape extends ReadOnlySpan_1<infer T0> ? __Ext_System_ReadOnlySpan_1<T0> : {});

        type Seq<T> = ExtensionMethods_System<ReadOnlySpan_1<T>>;

        declare const xs: Seq<number>;

        export function test() {
          let off = 0;
          xs.Overlaps(xs);
          return xs.Overlaps(xs, off);
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/System/bindings.json", {
        namespace: "System",
        types: [
          {
            clrName: "System.MemoryExtensions",
            assemblyName: "System",
            methods: [
              {
                clrName: "Overlaps",
                normalizedSignature:
                  "Overlaps|(ReadOnlySpan_1,ReadOnlySpan_1):System.Boolean|static=true",
                parameterCount: 2,
                declaringClrType: "System.MemoryExtensions",
                declaringAssemblyName: "System",
                isExtensionMethod: true,
              },
              {
                clrName: "Overlaps",
                normalizedSignature:
                  "Overlaps|(ReadOnlySpan_1,ReadOnlySpan_1,System.Int32&):System.Boolean|static=true",
                parameterCount: 3,
                declaringClrType: "System.MemoryExtensions",
                declaringAssemblyName: "System",
                isExtensionMethod: true,
                parameterModifiers: [{ index: 2, modifier: "out" }],
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
      if (funcDecl?.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements[1];
      if (exprStmt?.kind !== "expressionStatement") return;
      if (exprStmt.expression.kind !== "call") return;

      // Call 1: overlaps(other) - no out
      expect(exprStmt.expression.argumentPassing).to.deep.equal(["value"]);

      const returnStmt = funcDecl.body.statements[2];
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression) return;
      if (returnStmt.expression.kind !== "call") return;

      // Call 2: overlaps(other, off) - second arg must be out after receiver shift
      expect(returnStmt.expression.argumentPassing).to.deep.equal(["value", "out"]);
    });
  });

  describe("Call-site argument modifier intrinsics (out/ref/inref)", () => {
    it("should erase out(x) marker for out-parameter extension methods", () => {
      const source = `
        interface IEnumerable_1<T> {}

        export function test() {
          interface __Ext_System_Linq_IEnumerable_1<T> {
            // Extension marker surface; binding provides the real parameter modifiers.
            TryGetNonEnumeratedCount(count: number): boolean;
          }

          type ExtensionMethods_System_Linq<TShape> =
            TShape & (TShape extends IEnumerable_1<infer T0> ? __Ext_System_Linq_IEnumerable_1<T0> : {});

          type LinqSeq<T> = ExtensionMethods_System_Linq<IEnumerable_1<T>>;

          declare const xs: LinqSeq<number>;

          let count = 0;
          return xs.TryGetNonEnumeratedCount(out(count));
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/System.Linq/bindings.json", {
        namespace: "System.Linq",
        types: [
          {
            clrName: "System.Linq.Enumerable",
            assemblyName: "System.Linq",
            methods: [
              {
                clrName: "TryGetNonEnumeratedCount",
                normalizedSignature:
                  "TryGetNonEnumeratedCount|(IEnumerable_1,System.Int32&):System.Boolean|static=true",
                declaringClrType: "System.Linq.Enumerable",
                declaringAssemblyName: "System.Linq",
                isExtensionMethod: true,
                parameterModifiers: [{ index: 1, modifier: "out" }],
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

      // No deterministic diagnostics should be emitted for marker usage here.
      expect(ctx.diagnostics.map((d) => d.code)).to.deep.equal([]);

      const module = result.value;
      const funcDecl = module.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements[1];
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression) return;
      if (returnStmt.expression.kind !== "call") return;

      // Marker should be erased and surfaced as passing mode.
      expect(returnStmt.expression.argumentPassing).to.deep.equal(["out"]);

      const firstArg = returnStmt.expression.arguments[0];
      if (!firstArg || firstArg.kind !== "identifier") return;
      expect(firstArg.name).to.equal("count");
    });

    it("should emit TSN7444 when call-site out conflicts with a resolved signature", () => {
      const source = `
        export function f(x: number): void {}

        export function test() {
          let x = 0;
          f(out(x));
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const codes = ctx.diagnostics.map((d) => d.code);
      expect(codes).to.include("TSN7444");
    });
  });
});
