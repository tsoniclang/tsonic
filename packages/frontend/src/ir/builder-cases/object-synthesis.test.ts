/**
 * IR Builder tests: Object synthesis in generic calls
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import { createTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Call Inference Regressions – object synthesis", () => {
    it("infers boolean declaration types for shorthand object synthesis in generic calls", () => {
      const source = `
        function ok<T>(data: T): T {
          return data;
        }

        export function run(anchor: string, numAfter: number, numBefore: number): {
          foundAnchor: boolean;
          foundNewest: boolean;
          foundOldest: boolean;
        } {
          const foundAnchor = anchor !== "newest" && anchor !== "oldest";
          const foundNewest = numAfter < 1 || anchor === "newest";
          const foundOldest = numBefore < 1 || anchor === "oldest";
          return ok({ foundAnchor, foundNewest, foundOldest });
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
    });

    it("lowers method shorthand to function-valued properties during object synthesis", () => {
      const source = `
        interface Ops {
          add: (x: number, y: number) => number;
        }
        function box<T>(x: T): T { return x; }
        export function run(): number {
          const ops = box<Ops>({
            add(x: number, y: number): number {
              return x + y;
            },
          });
          return ops.add(1, 2);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration"
      );
      expect(decl).to.not.equal(undefined);
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "ops"
      )?.initializer;
      expect(initializer?.kind).to.equal("call");
      if (!initializer || initializer.kind !== "call") return;

      const arg0 = initializer.arguments[0];
      expect(arg0?.kind).to.equal("object");
      if (!arg0 || arg0.kind !== "object") return;

      const addProp = arg0.properties.find(
        (prop) => prop.kind === "property" && prop.key === "add"
      );
      expect(addProp).to.not.equal(undefined);
      if (!addProp || addProp.kind !== "property") return;
      expect(addProp.value.kind).to.equal("functionExpression");
    });

    it("supports computed string-literal method shorthand during synthesis", () => {
      const source = `
        interface Ops {
          add: (x: number, y: number) => number;
        }
        function box<T>(x: T): T { return x; }
        export function run(): number {
          const ops = box<Ops>({
            ["add"](x: number, y: number): number {
              return x + y;
            },
          });
          return ops.add(1, 2);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration"
      );
      const initializer = decl?.declarations[0]?.initializer;
      expect(initializer?.kind).to.equal("call");
      if (!initializer || initializer.kind !== "call") return;

      const arg0 = initializer.arguments[0];
      expect(arg0?.kind).to.equal("object");
      if (!arg0 || arg0.kind !== "object") return;

      const computedAddProp = arg0.properties.find((prop) => {
        if (prop.kind !== "property") return false;
        return prop.key === "add" && prop.value.kind === "functionExpression";
      });
      expect(computedAddProp).to.not.equal(undefined);
    });

    it("rewrites object-literal method arguments.length to a fixed arity literal", () => {
      const source = `
        interface Ops {
          add: (x: number, y: number) => number;
        }
        function box<T>(x: T): T { return x; }
        export function run(): number {
          const ops = box<Ops>({
            add(x: number, y: number): number {
              return arguments.length + x + y;
            },
          });
          return ops.add(1, 2);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration"
      );
      const initializer = decl?.declarations[0]?.initializer;
      expect(initializer?.kind).to.equal("call");
      if (!initializer || initializer.kind !== "call") return;

      const arg0 = initializer.arguments[0];
      expect(arg0?.kind).to.equal("object");
      if (!arg0 || arg0.kind !== "object") return;

      const addProp = arg0.properties.find(
        (prop) => prop.kind === "property" && prop.key === "add"
      );
      expect(addProp).to.not.equal(undefined);
      if (!addProp || addProp.kind !== "property") return;
      expect(addProp.value.kind).to.equal("functionExpression");
      if (addProp.value.kind !== "functionExpression") return;

      const stmt = addProp.value.body?.statements[0];
      expect(stmt?.kind).to.equal("returnStatement");
      if (!stmt || stmt.kind !== "returnStatement" || !stmt.expression) return;

      expect(stmt.expression.kind).to.equal("binary");
      if (stmt.expression.kind !== "binary") return;
      expect(stmt.expression.left.kind).to.equal("binary");
      if (stmt.expression.left.kind !== "binary") return;
      expect(stmt.expression.left.left.kind).to.equal("literal");
      if (stmt.expression.left.left.kind !== "literal") return;
      expect(stmt.expression.left.left.value).to.equal(2);
    });

    it("rewrites object-literal method arguments[n] to captured parameter temps", () => {
      const source = `
        interface Ops {
          add: (x: number, y: number) => number;
        }
        function box<T>(x: T): T { return x; }
        export function run(): number {
          const ops = box<Ops>({
            add(x: number, y: number): number {
              return (arguments[0] as number) + y;
            },
          });
          return ops.add(1, 2);
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration"
      );
      const initializer = decl?.declarations[0]?.initializer;
      expect(initializer?.kind).to.equal("call");
      if (!initializer || initializer.kind !== "call") return;

      const arg0 = initializer.arguments[0];
      expect(arg0?.kind).to.equal("object");
      if (!arg0 || arg0.kind !== "object") return;

      const addProp = arg0.properties.find(
        (prop) => prop.kind === "property" && prop.key === "add"
      );
      expect(addProp).to.not.equal(undefined);
      if (!addProp || addProp.kind !== "property") return;
      expect(addProp.value.kind).to.equal("functionExpression");
      if (addProp.value.kind !== "functionExpression" || !addProp.value.body)
        return;

      const [captureDecl, returnStmt] = addProp.value.body.statements;
      expect(captureDecl?.kind).to.equal("variableDeclaration");
      if (!captureDecl || captureDecl.kind !== "variableDeclaration") return;

      const captureInit = captureDecl.declarations[0]?.initializer;
      expect(captureInit?.kind).to.equal("identifier");
      if (!captureInit || captureInit.kind !== "identifier") return;
      expect(captureInit.name).to.equal("x");

      expect(returnStmt?.kind).to.equal("returnStatement");
      if (
        !returnStmt ||
        returnStmt.kind !== "returnStatement" ||
        !returnStmt.expression ||
        returnStmt.expression.kind !== "binary"
      ) {
        return;
      }

      expect(returnStmt.expression.left.kind).to.equal("typeAssertion");
      if (returnStmt.expression.left.kind !== "typeAssertion") return;
      expect(returnStmt.expression.left.expression.kind).to.equal("identifier");
      if (returnStmt.expression.left.expression.kind !== "identifier") return;
      expect(returnStmt.expression.left.expression.name).to.include(
        "__tsonic_object_method_argument_0"
      );
    });
  });
});
