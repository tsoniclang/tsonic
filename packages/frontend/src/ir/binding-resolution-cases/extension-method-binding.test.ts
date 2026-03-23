/**
 * Tests for extension method binding resolution in IR conversion —
 * primitive wrapper methods, string extensions, object-literal receivers,
 * PascalCase folding, and ambiguous case-fold guards
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  buildIrModule,
  createTestProgram,
  BindingRegistry,
} from "./helpers.js";

describe("Binding Resolution in IR", () => {
  describe("Extension Method Binding Resolution", () => {
    it("should prefer surface wrapper bindings for numeric primitive instance methods", () => {
      const source = `
        interface Number { toString(): string; }

        export function test(value: number): string {
          return value.toString();
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/Tsonic.JSRuntime/bindings.json", {
        bindings: {
          Number: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.Number",
          },
        },
        namespace: "Tsonic.JSRuntime",
        types: [
          {
            clrName: "Tsonic.JSRuntime.Number",
            assemblyName: "Tsonic.JSRuntime",
            methods: [
              {
                clrName: "toString",
                normalizedSignature:
                  "toString|(System.Double):System.String|static=true",
                parameterCount: 1,
                declaringClrType: "Tsonic.JSRuntime.Number",
                declaringAssemblyName: "Tsonic.JSRuntime",
                isExtensionMethod: true,
              },
            ],
            properties: [],
            fields: [],
          },
          {
            clrName: "System.Double",
            assemblyName: "System.Private.CoreLib",
            methods: [],
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
        "Tsonic.JSRuntime.Number"
      );
      expect(returnStmt.expression.callee.memberBinding?.member).to.equal(
        "toString"
      );
    });

    it("should prefer surface wrapper bindings for boolean primitive instance methods", () => {
      const source = `
        interface Boolean { toString(): string; }

        export function test(value: boolean): string {
          return value.toString();
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/Tsonic.JSRuntime/bindings.json", {
        bindings: {
          Boolean: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.BooleanOps",
          },
        },
        namespace: "Tsonic.JSRuntime",
        types: [
          {
            clrName: "Tsonic.JSRuntime.BooleanOps",
            assemblyName: "Tsonic.JSRuntime",
            methods: [
              {
                clrName: "toString",
                normalizedSignature:
                  "toString|(System.Boolean):System.String|static=true",
                parameterCount: 1,
                declaringClrType: "Tsonic.JSRuntime.BooleanOps",
                declaringAssemblyName: "Tsonic.JSRuntime",
                isExtensionMethod: true,
              },
            ],
            properties: [],
            fields: [],
          },
          {
            clrName: "System.Boolean",
            assemblyName: "System.Private.CoreLib",
            methods: [],
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

      const returnStmt = funcDecl.body.statements[0];
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression) {
        return;
      }
      if (returnStmt.expression.kind !== "call") return;
      if (returnStmt.expression.callee.kind !== "memberAccess") return;

      expect(returnStmt.expression.callee.memberBinding).to.not.equal(
        undefined
      );
      expect(
        returnStmt.expression.callee.memberBinding?.isExtensionMethod
      ).to.equal(true);
      expect(returnStmt.expression.callee.memberBinding?.type).to.equal(
        "Tsonic.JSRuntime.BooleanOps"
      );
      expect(returnStmt.expression.callee.memberBinding?.member).to.equal(
        "toString"
      );
    });

    it("should resolve primitive receiver extension methods via bindings", () => {
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

    it("should keep object-literal method call results as receiver-bound numeric values", () => {
      const source = `
        interface Number { toString(): string; }

        export function run(): string {
          const counter = {
            value: 21,
            inc() {
              this.value += 1;
              return this.value;
            },
          };

          return counter.inc().toString();
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        bindings: {
          Number: {
            kind: "global",
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.Number",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
        },
        namespace: "Tsonic.JSRuntime",
        types: [
          {
            clrName: "Tsonic.JSRuntime.Number",
            assemblyName: "Tsonic.JSRuntime",
            methods: [
              {
                clrName: "toString",
                normalizedSignature:
                  "toString|(System.Double):System.String|static=true",
                parameterCount: 1,
                declaringClrType: "Tsonic.JSRuntime.Number",
                declaringAssemblyName: "Tsonic.JSRuntime",
                isExtensionMethod: true,
                emitSemantics: {
                  callStyle: "receiver",
                },
              },
            ],
            properties: [],
            fields: [],
          },
          {
            clrName: "System.Double",
            assemblyName: "System.Private.CoreLib",
            methods: [],
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

      const funcDecl = result.value.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements[1];
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression) {
        return;
      }
      expect(returnStmt.expression.kind).to.equal("call");
      if (returnStmt.expression.kind !== "call") return;
      expect(returnStmt.expression.inferredType?.kind).to.equal(
        "primitiveType"
      );
      if (returnStmt.expression.inferredType?.kind !== "primitiveType") return;
      expect(returnStmt.expression.inferredType.name).to.equal("string");

      const memberExpr = returnStmt.expression.callee;
      expect(memberExpr.kind).to.equal("memberAccess");
      if (memberExpr.kind !== "memberAccess") return;

      expect(memberExpr.object.kind).to.equal("call");
      if (memberExpr.object.kind !== "call") return;
      expect(memberExpr.object.inferredType?.kind).to.equal("primitiveType");
      if (memberExpr.object.inferredType?.kind !== "primitiveType") return;
      expect(memberExpr.object.inferredType.name).to.equal("number");

      expect(memberExpr.memberBinding).to.not.equal(undefined);
      expect(memberExpr.memberBinding?.isExtensionMethod).to.equal(true);
      expect(memberExpr.memberBinding?.type).to.equal(
        "Tsonic.JSRuntime.Number"
      );
      expect(memberExpr.memberBinding?.member).to.equal("toString");
      expect(memberExpr.memberBinding?.emitSemantics?.callStyle).to.equal(
        "receiver"
      );
    });

    it("resolves lower-cased TS member access to a unique CLR PascalCase member", () => {
      const source = `
        declare class Architecture {}
        declare const current: Architecture;

        export function test(): string {
          return current.toString();
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        namespace: "System.Runtime.InteropServices",
        types: [
          {
            clrName: "System.Runtime.InteropServices.Architecture",
            assemblyName: "System.Runtime.InteropServices.RuntimeInformation",
            baseType: {
              clrName: "System.Enum",
            },
            methods: [],
            properties: [],
            fields: [],
          },
          {
            clrName: "System.Enum",
            assemblyName: "System.Private.CoreLib",
            methods: [
              {
                clrName: "ToString",
                normalizedSignature: "ToString|():System.String|static=false",
                parameterCount: 0,
                declaringClrType: "System.Enum",
                declaringAssemblyName: "System.Private.CoreLib",
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

      const funcDecl = result.value.body[0];
      if (funcDecl?.kind !== "functionDeclaration") return;

      const returnStmt = funcDecl.body.statements[0];
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression) {
        return;
      }
      if (returnStmt.expression.kind !== "call") return;
      if (returnStmt.expression.callee.kind !== "memberAccess") return;

      expect(returnStmt.expression.callee.memberBinding).to.not.equal(
        undefined
      );
      expect(returnStmt.expression.callee.memberBinding?.member).to.equal(
        "ToString"
      );
      expect(returnStmt.expression.callee.memberBinding?.type).to.equal(
        "System.Enum"
      );
    });

    it("does not case-fold member bindings when multiple CLR spellings would match", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        namespace: "Acme.Runtime",
        types: [
          {
            clrName: "Acme.Runtime.Ambiguous",
            assemblyName: "Acme.Runtime",
            methods: [
              {
                clrName: "ToString",
                normalizedSignature: "ToString|():System.String|static=false",
                parameterCount: 0,
                declaringClrType: "Acme.Runtime.Ambiguous",
                declaringAssemblyName: "Acme.Runtime",
              },
              {
                clrName: "toString",
                normalizedSignature: "toString|():System.String|static=false",
                parameterCount: 0,
                declaringClrType: "Acme.Runtime.Ambiguous",
                declaringAssemblyName: "Acme.Runtime",
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });

      expect(bindings.getMemberOverloads("Ambiguous", "tostring")).to.equal(
        undefined
      );
    });
  });
});
