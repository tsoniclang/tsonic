/**
 * IR Builder tests: Array.isArray and typeof narrowing regressions
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import {
  IrClassDeclaration,
  IrMethodDeclaration,
} from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Native library port regressions – Array.isArray and typeof narrowing", () => {
    it("narrows Array.isArray branches for scalar-or-array unions", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export function first(value: string | string[]): string {",
            "  if (Array.isArray(value)) {",
            '    return value[0] ?? "";',
            "  }",
            "  return value;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "first"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const ifStmt = fn.body.statements.find(
          (
            stmt
          ): stmt is Extract<
            IrFunctionDeclaration["body"]["statements"][number],
            { kind: "ifStatement" }
          > => stmt.kind === "ifStatement"
        );
        expect(ifStmt).to.not.equal(undefined);
        if (!ifStmt) return;

        const thenReturn =
          ifStmt.thenStatement.kind === "blockStatement"
            ? ifStmt.thenStatement.statements[0]
            : undefined;
        expect(thenReturn?.kind).to.equal("returnStatement");
        if (
          !thenReturn ||
          thenReturn.kind !== "returnStatement" ||
          !thenReturn.expression
        ) {
          return;
        }
        expect(thenReturn.expression.inferredType?.kind).to.equal(
          "primitiveType"
        );
        if (thenReturn.expression.inferredType?.kind !== "primitiveType") {
          return;
        }
        expect(thenReturn.expression.inferredType.name).to.equal("string");

        const elseReturn = fn.body.statements.find(
          (stmt, index) =>
            index > fn.body.statements.indexOf(ifStmt) &&
            stmt.kind === "returnStatement"
        );
        expect(elseReturn?.kind).to.equal("returnStatement");
        if (
          !elseReturn ||
          elseReturn.kind !== "returnStatement" ||
          !elseReturn.expression
        ) {
          return;
        }
        expect(elseReturn.expression.inferredType?.kind).to.equal(
          "primitiveType"
        );
        if (elseReturn.expression.inferredType?.kind !== "primitiveType") {
          return;
        }
        expect(elseReturn.expression.inferredType.name).to.equal("string");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves Array.isArray fallthrough narrowing after early-return array branches in class methods", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "export class Response {",
            "  append(field: string, value: string | string[]): this {",
            "    if (Array.isArray(value)) {",
            "      for (let index = 0; index < value.length; index += 1) {",
            "        const item = value[index]!;",
            "        this.append(field, item);",
            "      }",
            "      return this;",
            "    }",
            "    takesString(value);",
            "    return this;",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const responseClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Response"
        );
        expect(responseClass).to.not.equal(undefined);
        if (!responseClass) return;

        const appendMethod = responseClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "append"
        );
        expect(appendMethod).to.not.equal(undefined);
        if (!appendMethod?.body) return;

        const callStmt = appendMethod.body.statements.find(
          (stmt, index) => index > 0 && stmt.kind === "expressionStatement"
        );
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const narrowedArg = callStmt.expression.arguments[0];
        expect(narrowedArg?.inferredType?.kind).to.equal("primitiveType");
        if (narrowedArg?.inferredType?.kind !== "primitiveType") return;
        expect(narrowedArg.inferredType.name).to.equal("string");
      } finally {
        fixture.cleanup();
      }
    });

    it("narrows unknown values to unknown[] after Array.isArray fallthrough guards", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export function isItems(value: unknown): boolean {",
            "  if (!Array.isArray(value)) {",
            "    return false;",
            "  }",
            "  const items = value;",
            "  return items.length > 0 && items[0] !== undefined;",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const isItemsFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "isItems"
        );
        expect(isItemsFn).to.not.equal(undefined);
        if (!isItemsFn) return;

        const itemsDecl = isItemsFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "items"
            )
        );
        expect(itemsDecl).to.not.equal(undefined);
        if (!itemsDecl) return;

        const itemsInit = itemsDecl.declarations[0]?.initializer;
        expect(itemsInit?.kind).to.equal("typeAssertion");
        if (!itemsInit || itemsInit.kind !== "typeAssertion") return;

        expect(itemsInit.expression.inferredType?.kind).to.equal("unknownType");

        const itemsType = itemsInit.targetType;
        expect(itemsType?.kind).to.equal("arrayType");
        if (!itemsType || itemsType.kind !== "arrayType") return;
        expect(itemsType.elementType.kind).to.equal("unknownType");
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves typeof fallthrough narrowing for class properties after early-return string branches", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "export class Application {",
            '  mountpath: string | string[] = "/";',
            "  path(): string {",
            '    if (typeof this.mountpath === "string") {',
            "      return this.mountpath;",
            "    }",
            "    takesString(this.mountpath[0]!);",
            "    return this.mountpath[0]!;",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const appClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Application"
        );
        expect(appClass).to.not.equal(undefined);
        if (!appClass) return;

        const pathMethod = appClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "path"
        );
        expect(pathMethod).to.not.equal(undefined);
        if (!pathMethod?.body) return;
        const pathBody = pathMethod.body;

        const callStmt = pathBody.statements.find(
          (stmt) => stmt.kind === "expressionStatement"
        );
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const narrowedArg = callStmt.expression.arguments[0];
        expect(narrowedArg?.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves compound typeof fallthrough narrowing after early-return disjunction branches", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "function combine(left: string | RegExp, right: string | RegExp): string | RegExp {",
            '  if (typeof left !== "string" || typeof right !== "string") {',
            "    return right;",
            "  }",
            "  takesString(left);",
            "  takesString(right);",
            "  return left + right;",
            "}",
            "",
            "export const main = (): string | RegExp => combine('a', 'b');",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const combineFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "combine"
        );
        expect(combineFn).to.not.equal(undefined);
        if (!combineFn) return;

        const callStatements = combineFn.body.statements.filter(
          (stmt): stmt is IrExpressionStatement =>
            stmt.kind === "expressionStatement"
        );
        expect(callStatements).to.have.length(2);

        for (const stmt of callStatements) {
          expect(stmt.expression.kind).to.equal("call");
          if (stmt.expression.kind !== "call") continue;
          const narrowedArg = stmt.expression.arguments[0];
          expect(narrowedArg?.inferredType).to.deep.equal({
            kind: "primitiveType",
            name: "string",
          });
        }
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves Array.isArray fallthrough narrowing for class properties after early-return array branches", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "",
            "export class Response {",
            '  value: string | readonly string[] = "";',
            "  render(): string {",
            "    if (Array.isArray(this.value)) {",
            '      return this.value.join("|");',
            "    }",
            "    takesString(this.value);",
            "    return this.value;",
            "  }",
            "}",
          ].join("\n"),
        },
        "src/index.ts"
      );

      try {
        const result = buildIrModule(
          fixture.sourceFile,
          fixture.testProgram,
          fixture.options,
          fixture.ctx
        );

        expect(result.ok).to.equal(true);
        if (!result.ok) return;

        const responseClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Response"
        );
        expect(responseClass).to.not.equal(undefined);
        if (!responseClass) return;

        const renderMethod = responseClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "render"
        );
        expect(renderMethod).to.not.equal(undefined);
        if (!renderMethod?.body) return;
        const renderBody = renderMethod.body;

        const callStmt = renderBody.statements.find(
          (stmt) => stmt.kind === "expressionStatement"
        );
        expect(callStmt?.kind).to.equal("expressionStatement");
        if (
          !callStmt ||
          callStmt.kind !== "expressionStatement" ||
          callStmt.expression.kind !== "call"
        ) {
          return;
        }

        const narrowedArg = callStmt.expression.arguments[0];
        expect(narrowedArg?.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

  });
});
