/**
 * Tests for tsbindgen-style extension method resolution, overload selection,
 * numeric/array receiver extensions, and call-site argument modifiers in IR conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  buildIrModule,
  createTestProgram,
  BindingRegistry,
} from "./helpers.js";

describe("Binding Resolution in IR", () => {
  describe("Extension Method Binding Resolution — tsbindgen & Modifiers", () => {
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
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression)
        return;

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
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression)
        return;
      if (returnStmt.expression.kind !== "call") return;

      // Call 2: overlaps(other, off) - second arg must be out after receiver shift
      expect(returnStmt.expression.argumentPassing).to.deep.equal([
        "value",
        "out",
      ]);
    });

    it("should resolve numeric primitive extension methods via bindings", () => {
      const source = `
        interface Number { toFixed(fractionDigits?: number): string; }

        export function test(n: number): string {
          return n.toFixed(2);
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/Tsonic.JSRuntime/bindings.json", {
        namespace: "Tsonic.JSRuntime",
        types: [
          {
            clrName: "System.Double",
            assemblyName: "Tsonic.JSRuntime",
            methods: [
              {
                clrName: "toFixed",
                normalizedSignature:
                  "toFixed|(System.Double,System.Int32):System.String|static=true",
                parameterCount: 2,
                declaringClrType: "Tsonic.JSRuntime.NumberExtensions",
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
      const fn = module.body[0];
      if (fn?.kind !== "functionDeclaration") return;
      const ret = fn.body.statements[0];
      if (ret?.kind !== "returnStatement" || !ret.expression) return;
      if (ret.expression.kind !== "call") return;
      if (ret.expression.callee.kind !== "memberAccess") return;

      expect(ret.expression.callee.memberBinding).to.not.equal(undefined);
      expect(ret.expression.callee.memberBinding?.type).to.equal(
        "Tsonic.JSRuntime.NumberExtensions"
      );
      expect(ret.expression.callee.memberBinding?.member).to.equal("toFixed");
      expect(ret.expression.callee.memberBinding?.isExtensionMethod).to.equal(
        true
      );
    });

    it("should resolve array receiver extension methods via bindings", () => {
      const source = `
        interface Array<T> { join(separator?: string): string; }

        export function test(xs: number[]): string {
          return xs.join(",");
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/Tsonic.JSRuntime/bindings.json", {
        namespace: "Tsonic.JSRuntime",
        types: [
          {
            clrName: "System.Array",
            assemblyName: "Tsonic.JSRuntime",
            methods: [
              {
                clrName: "join",
                normalizedSignature:
                  "join|(System.Array,System.String):System.String|static=true",
                parameterCount: 2,
                declaringClrType: "Tsonic.JSRuntime.ArrayExtensions",
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
      const fn = module.body[0];
      if (fn?.kind !== "functionDeclaration") return;
      const ret = fn.body.statements[0];
      if (ret?.kind !== "returnStatement" || !ret.expression) return;
      if (ret.expression.kind !== "call") return;
      if (ret.expression.callee.kind !== "memberAccess") return;

      expect(ret.expression.callee.memberBinding).to.not.equal(undefined);
      expect(ret.expression.callee.memberBinding?.type).to.equal(
        "Tsonic.JSRuntime.ArrayExtensions"
      );
      expect(ret.expression.callee.memberBinding?.member).to.equal("join");
      expect(ret.expression.callee.memberBinding?.isExtensionMethod).to.equal(
        true
      );
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
      if (returnStmt?.kind !== "returnStatement" || !returnStmt.expression)
        return;
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
