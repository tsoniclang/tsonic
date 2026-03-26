/**
 * IR Builder tests: ECMAScript private members, well-known symbols, and instanceof narrowing
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import {
  IrClassDeclaration,
  IrFunctionDeclaration,
  IrMethodDeclaration,
  IrPropertyDeclaration,
  IrVariableDeclaration,
} from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Native library port regressions – private members and instanceof", () => {
    it("preserves ECMAScript private class members and private access paths", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Counter {",
            '  readonly #label: string = "ctr";',
            "  #count: number = 0;",
            "",
            "  get #prefix(): string {",
            "    return this.#label;",
            "  }",
            "",
            "  #increment(): string {",
            "    this.#count += 1;",
            "    return String(this.#count);",
            "  }",
            "",
            "  append(value: string): string;",
            "  append(value: string[]): string;",
            "  append(value: string | string[]): string {",
            "    if (Array.isArray(value)) {",
            "      for (let index = 0; index < value.length; index += 1) {",
            "        const item = value[index]!;",
            "        this.append(item);",
            "      }",
            "      return this.#prefix;",
            "    }",
            "    return `${this.#prefix}:${value}:${this.#increment()}`;",
            "  }",
            "",
            "  read(): string {",
            '    return this.append("value");',
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

        const counterClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Counter"
        );
        expect(counterClass).to.not.equal(undefined);
        if (!counterClass) return;

        const memberNames = counterClass.members
          .filter(
            (member): member is Extract<typeof member, { name: string }> =>
              "name" in member
          )
          .map((member) => member.name);
        expect(memberNames).to.include.members([
          "#label",
          "#count",
          "#prefix",
          "#increment",
          "append",
          "read",
        ]);

        const labelField = counterClass.members.find(
          (member) =>
            member.kind === "propertyDeclaration" && member.name === "#label"
        );
        expect(labelField?.kind).to.equal("propertyDeclaration");
        if (labelField?.kind !== "propertyDeclaration") return;
        expect(labelField.emitAsField).to.equal(true);
        expect(labelField.accessibility).to.equal("private");

        const incrementMethod = counterClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "#increment"
        );
        expect(incrementMethod).to.not.equal(undefined);
        expect(incrementMethod?.accessibility).to.equal("private");

        const readMethod = counterClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "read"
        );
        expect(readMethod).to.not.equal(undefined);
        if (!readMethod?.body) return;

        const readReturn = readMethod.body.statements.at(-1);
        expect(readReturn?.kind).to.equal("returnStatement");
        if (
          !readReturn ||
          readReturn.kind !== "returnStatement" ||
          !readReturn.expression
        ) {
          return;
        }

        expect(readReturn.expression.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves deterministic well-known symbol class members and accesses", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export class Params {",
            "  get [Symbol.toStringTag](): string {",
            '    return "Params";',
            "  }",
            "}",
            "",
            "export function readTag(params: Params): string {",
            "  return params[Symbol.toStringTag];",
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

        const paramsClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Params"
        );
        expect(paramsClass).to.not.equal(undefined);
        if (!paramsClass) return;

        const symbolMember = paramsClass.members.find(
          (member): member is IrPropertyDeclaration =>
            member.kind === "propertyDeclaration" &&
            member.name === "[symbol:toStringTag]"
        );
        expect(symbolMember).to.not.equal(undefined);

        const readTag = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "readTag"
        );
        expect(readTag).to.not.equal(undefined);
        if (!readTag?.body) return;

        const returnStmt = readTag.body.statements.at(-1);
        expect(returnStmt?.kind).to.equal("returnStatement");
        if (
          !returnStmt ||
          returnStmt.kind !== "returnStatement" ||
          !returnStmt.expression ||
          returnStmt.expression.kind !== "memberAccess"
        ) {
          return;
        }

        expect(returnStmt.expression.isComputed).to.equal(false);
        expect(returnStmt.expression.property).to.equal("[symbol:toStringTag]");
        expect(returnStmt.expression.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves deterministic well-known symbol element access on structural receivers", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export function getIterator(source: Iterable<string> | ArrayLike<string>): unknown {",
            "  const iterator = (source as { readonly [Symbol.iterator]?: unknown })[Symbol.iterator];",
            "  return iterator;",
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

        const getIterator = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "getIterator"
        );
        expect(getIterator).to.not.equal(undefined);
        if (!getIterator?.body) return;

        const iteratorDecl = getIterator.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration"
        );
        expect(iteratorDecl).to.not.equal(undefined);
        const initializer = iteratorDecl?.declarations[0]?.initializer;
        expect(initializer?.kind).to.equal("memberAccess");
        if (!initializer || initializer.kind !== "memberAccess") return;

        expect(initializer.isComputed).to.equal(false);
        expect(initializer.property).to.equal("[symbol:iterator]");
        expect(initializer.inferredType).to.deep.equal({
          kind: "unionType",
          types: [
            { kind: "unknownType" },
            { kind: "primitiveType", name: "undefined" },
          ],
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves instanceof fallthrough narrowing for class properties after early-return constructor branches", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function takesString(value: string): void;",
            "interface Chunk {",
            "  readonly length: number;",
            "}",
            "interface ChunkConstructor {",
            "  readonly prototype: Chunk;",
            "  new(length?: number): Chunk;",
            "}",
            "declare const Chunk: ChunkConstructor;",
            "",
            "export class Response {",
            '  body: string | Chunk = "";',
            "  send(): string {",
            "    if (this.body instanceof Chunk) {",
            "      return String(this.body.length);",
            "    }",
            "    takesString(this.body);",
            "    return this.body;",
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

        const sendMethod = responseClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "send"
        );
        expect(sendMethod).to.not.equal(undefined);
        if (!sendMethod?.body) return;

        const callStmt = sendMethod.body.statements.find(
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
