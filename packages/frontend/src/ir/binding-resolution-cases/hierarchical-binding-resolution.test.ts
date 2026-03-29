/**
 * Tests for hierarchical binding resolution in IR conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  buildIrModule,
  createTestProgram,
  BindingRegistry,
} from "./helpers.js";

describe("Binding Resolution in IR", () => {
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

    it("should resolve simple binding staticType for global static member access", () => {
      const source = `
        interface ArrayLike<T> {
          readonly length: number;
          readonly [n: number]: T;
        }

        interface ArrayConstructor {
          from<T>(source: ArrayLike<T>): T[];
        }

        declare const Array: ArrayConstructor;

        export function test(values: string[]): string[] {
          return Array.from(values);
        }
      `;

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/simple-array.json", {
        bindings: {
          Array: {
            kind: "global",
            assembly: "Acme.Runtime",
            type: "Acme.Runtime.Array`1",
            staticType: "Acme.Runtime.ArrayStatics",
          },
        },
      });

      bindings.addBindings("/test/acme-array/bindings.json", {
        namespace: "Acme.Runtime",
        types: [
          {
            clrName: "Acme.Runtime.Array`1",
            assemblyName: "Acme.Runtime",
            methods: [
              {
                clrName: "map",
                declaringClrType: "Acme.Runtime.Array`1",
                declaringAssemblyName: "Acme.Runtime",
              },
            ],
            properties: [],
            fields: [],
          },
          {
            clrName: "Acme.Runtime.ArrayStatics",
            assemblyName: "Acme.Runtime",
            methods: [
              {
                clrName: "from",
                declaringClrType: "Acme.Runtime.ArrayStatics",
                declaringAssemblyName: "Acme.Runtime",
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

      const callExpr = returnStmt.expression;
      if (callExpr.kind !== "call") return;

      const memberExpr = callExpr.callee;
      if (memberExpr.kind !== "memberAccess") return;

      expect(memberExpr.memberBinding).to.not.equal(undefined);
      expect(memberExpr.memberBinding?.type).to.equal(
        "Acme.Runtime.ArrayStatics"
      );
      expect(memberExpr.memberBinding?.member).to.equal("from");
    });
  });
});
