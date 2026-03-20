/**
 * IR Builder tests: Statement Conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import {
  IrFunctionDeclaration,
  IrVariableDeclaration,
  IrClassDeclaration,
  IrInterfaceDeclaration,
} from "../types.js";
import { createTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Statement Conversion", () => {
    it("should convert function declarations", () => {
      const source = `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        expect(body).to.have.length(1);

        const firstItem = body[0];
        if (!firstItem) throw new Error("Missing body item");
        expect(firstItem.kind).to.equal("functionDeclaration");

        const func = firstItem as IrFunctionDeclaration;
        expect(func.name).to.equal("add");
        expect(func.parameters).to.have.length(2);
        expect(func.isExported).to.equal(true);
      }
    });

    it("should convert variable declarations", () => {
      // Use explicit type annotation for object literal to avoid synthetic type generation
      const source = `
        interface Named { name: string }
        const x = 10;
        let y: string = "hello";
        export const z: Named = { name: "test" };
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        // 4 statements: interface + 3 variable declarations
        expect(body).to.have.length(4);

        const firstDecl = body[0] as IrInterfaceDeclaration;
        expect(firstDecl.kind).to.equal("interfaceDeclaration");

        const firstVar = body[1] as IrVariableDeclaration;
        expect(firstVar.kind).to.equal("variableDeclaration");
        expect(firstVar.declarationKind).to.equal("const");

        const secondVar = body[2] as IrVariableDeclaration;
        expect(secondVar.declarationKind).to.equal("let");

        const thirdVar = body[3] as IrVariableDeclaration;
        expect(thirdVar.isExported).to.equal(true);
      }
    });

    it("should convert class declarations", () => {
      const source = `
        export class User {
          private name: string;
          constructor(name: string) {
            this.name = name;
          }
          getName(): string {
            return this.name;
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (result.ok) {
        const body = result.value.body;
        expect(body).to.have.length(1);

        const cls = body[0] as IrClassDeclaration;
        expect(cls.kind).to.equal("classDeclaration");
        expect(cls.name).to.equal("User");
        expect(cls.isExported).to.equal(true);
        expect(cls.members).to.have.length.greaterThan(0);
      }
    });

    it("preserves readonly-only constructor parameter properties as class members", () => {
      const source = `
        export class BoolValue {
          constructor(readonly value: boolean) {}
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const cls = result.value.body.find(
        (stmt): stmt is IrClassDeclaration =>
          stmt.kind === "classDeclaration" && stmt.name === "BoolValue"
      );
      expect(cls).to.not.equal(undefined);
      if (!cls) return;

      const valueProp = cls.members.find(
        (member) =>
          member.kind === "propertyDeclaration" && member.name === "value"
      );
      expect(valueProp).to.not.equal(undefined);
      expect(valueProp?.kind).to.equal("propertyDeclaration");
      if (!valueProp || valueProp.kind !== "propertyDeclaration") return;

      expect(valueProp.isReadonly).to.equal(true);
      expect(valueProp.accessibility).to.equal("public");
      expect(valueProp.type).to.deep.equal({
        kind: "primitiveType",
        name: "boolean",
      });
    });

    it("places parameter-property assignments after a leading super call", () => {
      const source = `
        class Base {
          constructor(readonly tag: string) {}
        }

        export class Derived extends Base {
          constructor(readonly value: boolean) {
            super("ok");
          }
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const cls = result.value.body.find(
        (stmt): stmt is IrClassDeclaration =>
          stmt.kind === "classDeclaration" && stmt.name === "Derived"
      );
      expect(cls).to.not.equal(undefined);
      if (!cls) return;

      const ctor = cls.members.find(
        (member) => member.kind === "constructorDeclaration"
      );
      expect(ctor).to.not.equal(undefined);
      expect(ctor?.kind).to.equal("constructorDeclaration");
      if (!ctor || ctor.kind !== "constructorDeclaration" || !ctor.body) return;

      expect(ctor.body.statements[0]?.kind).to.equal("expressionStatement");
      expect(ctor.body.statements[1]?.kind).to.equal("expressionStatement");
      const firstExpr = ctor.body.statements[0];
      const secondExpr = ctor.body.statements[1];
      if (
        !firstExpr ||
        firstExpr.kind !== "expressionStatement" ||
        !secondExpr ||
        secondExpr.kind !== "expressionStatement"
      ) {
        return;
      }

      expect(firstExpr.expression.kind).to.equal("call");
      if (firstExpr.expression.kind === "call") {
        expect(firstExpr.expression.callee.kind).to.equal("identifier");
        if (firstExpr.expression.callee.kind === "identifier") {
          expect(firstExpr.expression.callee.name).to.equal("super");
        }
      }

      expect(secondExpr.expression.kind).to.equal("assignment");
      if (secondExpr.expression.kind === "assignment") {
        expect(secondExpr.expression.left.kind).to.equal("memberAccess");
        if (secondExpr.expression.left.kind === "memberAccess") {
          expect(secondExpr.expression.left.object.kind).to.equal("this");
          expect(secondExpr.expression.left.property).to.equal("value");
        }
      }
    });
  });
});
