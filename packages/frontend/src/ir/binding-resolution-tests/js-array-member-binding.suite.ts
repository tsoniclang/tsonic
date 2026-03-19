/**
 * Tests for JS Array member binding resolution in IR conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  buildIrModule,
  createTestProgram,
  BindingRegistry,
} from "./helpers.js";

describe("Binding Resolution in IR", () => {
  describe("JS Array member binding resolution", () => {
    const createJsArrayBindings = (): BindingRegistry => {
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/js-root.json", {
        bindings: {
          Array: {
            kind: "global",
            assembly: "Acme.Runtime",
            type: "Acme.Runtime.JSArray`1",
            staticType: "Acme.Runtime.JSArrayStatics",
            typeSemantics: {
              contributesTypeIdentity: true,
            },
          },
        },
      });

      bindings.addBindings("/test/acme-array/bindings.json", {
        namespace: "Acme.Runtime",
        types: [
          {
            clrName: "Acme.Runtime.JSArray`1",
            assemblyName: "Acme.Runtime",
            methods: [
              {
                clrName: "push",
                declaringClrType: "Acme.Runtime.JSArray`1",
                declaringAssemblyName: "Acme.Runtime",
              },
              {
                clrName: "join",
                declaringClrType: "Acme.Runtime.JSArray`1",
                declaringAssemblyName: "Acme.Runtime",
              },
              {
                clrName: "map",
                declaringClrType: "Acme.Runtime.JSArray`1",
                declaringAssemblyName: "Acme.Runtime",
              },
              {
                clrName: "find",
                declaringClrType: "Acme.Runtime.JSArray`1",
                declaringAssemblyName: "Acme.Runtime",
              },
              {
                clrName: "findIndex",
                declaringClrType: "Acme.Runtime.JSArray`1",
                declaringAssemblyName: "Acme.Runtime",
              },
            ],
            properties: [],
            fields: [],
          },
          {
            clrName: "Acme.Runtime.JSArrayStatics",
            assemblyName: "Acme.Runtime",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
      });

      return bindings;
    };

    it("resolves array literal instance methods through the Array runtime surface", () => {
      const source = `
        export function test() {
          const segments = ["a", "b"];
          segments.push("c");
          return segments.join(",");
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(
        source,
        createJsArrayBindings()
      );
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const fn = result.value.body[0];
      if (fn?.kind !== "functionDeclaration") return;
      const pushStmt = fn.body.statements[1];
      if (
        pushStmt?.kind !== "expressionStatement" ||
        pushStmt.expression.kind !== "call" ||
        pushStmt.expression.callee.kind !== "memberAccess"
      ) {
        throw new Error("Expected push call expression");
      }

      expect(pushStmt.expression.callee.memberBinding?.member).to.equal("push");
      expect(pushStmt.expression.callee.memberBinding?.type).to.equal(
        "Acme.Runtime.JSArray`1"
      );

      const retStmt = fn.body.statements[2];
      if (
        retStmt?.kind !== "returnStatement" ||
        !retStmt.expression ||
        retStmt.expression.kind !== "call" ||
        retStmt.expression.callee.kind !== "memberAccess"
      ) {
        throw new Error("Expected join return call expression");
      }

      expect(retStmt.expression.callee.memberBinding?.member).to.equal("join");
      expect(retStmt.expression.callee.memberBinding?.type).to.equal(
        "Acme.Runtime.JSArray`1"
      );
    });

    it("resolves array callback methods through the JSArray runtime surface", () => {
      const source = `
        type Todo = { id: number; title: string };

        export function test() {
          const todos: Todo[] = [];
          const todo = todos.find((t) => t.id === 1);
          const index = todos.findIndex((t) => t.id === 1);
          return [todo, index];
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(
        source,
        createJsArrayBindings()
      );
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const fn = result.value.body[1];
      if (fn?.kind !== "functionDeclaration") return;
      const todoDecl = fn.body.statements[1];
      if (
        todoDecl?.kind !== "variableDeclaration" ||
        todoDecl.declarations[0]?.initializer?.kind !== "call" ||
        todoDecl.declarations[0]?.initializer.callee.kind !== "memberAccess"
      ) {
        throw new Error("Expected find() variable declaration");
      }

      expect(
        todoDecl.declarations[0].initializer.callee.memberBinding?.member
      ).to.equal("find");
      expect(
        todoDecl.declarations[0].initializer.callee.memberBinding?.type
      ).to.equal("Acme.Runtime.JSArray`1");

      const indexDecl = fn.body.statements[2];
      if (
        indexDecl?.kind !== "variableDeclaration" ||
        indexDecl.declarations[0]?.initializer?.kind !== "call" ||
        indexDecl.declarations[0]?.initializer.callee.kind !== "memberAccess"
      ) {
        throw new Error("Expected findIndex() variable declaration");
      }

      expect(
        indexDecl.declarations[0].initializer.callee.memberBinding?.member
      ).to.equal("findIndex");
      expect(
        indexDecl.declarations[0].initializer.callee.memberBinding?.type
      ).to.equal("Acme.Runtime.JSArray`1");
    });

    it("resolves nullish-coalesced array instance methods when the fallback is an empty array literal", () => {
      const source = `
        export function test(xs?: string[]) {
          const values = xs ?? [];
          values.push("a");
          return values.map((value) => value.toUpperCase());
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(
        source,
        createJsArrayBindings()
      );
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const fn = result.value.body[0];
      if (fn?.kind !== "functionDeclaration") return;
      const pushStmt = fn.body.statements[1];
      if (
        pushStmt?.kind !== "expressionStatement" ||
        pushStmt.expression.kind !== "call" ||
        pushStmt.expression.callee.kind !== "memberAccess"
      ) {
        throw new Error("Expected push call expression");
      }
      expect(pushStmt.expression.callee.memberBinding?.member).to.equal("push");
      expect(pushStmt.expression.callee.memberBinding?.type).to.equal(
        "Acme.Runtime.JSArray`1"
      );

      const retStmt = fn.body.statements[2];
      if (
        retStmt?.kind !== "returnStatement" ||
        !retStmt.expression ||
        retStmt.expression.kind !== "call" ||
        retStmt.expression.callee.kind !== "memberAccess"
      ) {
        throw new Error("Expected map return call expression");
      }
      expect(retStmt.expression.callee.memberBinding?.member).to.equal("map");
      expect(retStmt.expression.callee.memberBinding?.type).to.equal(
        "Acme.Runtime.JSArray`1"
      );
    });
  });
});
