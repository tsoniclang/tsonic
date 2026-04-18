/**
 * IR Builder tests: Array.isArray and typeof narrowing regressions
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import {
  IrClassDeclaration,
  IrExpressionStatement,
  IrFunctionDeclaration,
  IrMethodDeclaration,
  IrVariableDeclaration,
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

        expect(itemsInit.expression.inferredType?.kind).to.equal("arrayType");
        if (
          !itemsInit.expression.inferredType ||
          itemsInit.expression.inferredType.kind !== "arrayType"
        ) {
          return;
        }
        expect(itemsInit.expression.inferredType.elementType.kind).to.equal(
          "unknownType"
        );

        const itemsType = itemsInit.targetType;
        expect(itemsType?.kind).to.equal("arrayType");
        if (!itemsType || itemsType.kind !== "arrayType") return;
        expect(itemsType.elementType.kind).to.equal("unknownType");
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps Object.entries tuple values as unknown[] after Array.isArray fallthrough guards", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "export function parse(root: unknown): number {",
            '  if (root === null || typeof root !== "object" || Array.isArray(root)) {',
            "    return 0;",
            "  }",
            "  const entries = Object.entries(root);",
            "  for (let i = 0; i < entries.length; i++) {",
            "    const [key, value] = entries[i]!;",
            '    if (key.toLowerCase() !== "mounts" || !Array.isArray(value)) {',
            "      continue;",
            "    }",
            "    const mountsValue = value as unknown[];",
            "    return mountsValue.length;",
            "  }",
            "  return 0;",
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

        const parseFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "parse"
        );
        expect(parseFn).to.not.equal(undefined);
        if (!parseFn) return;

        const loop = parseFn.body.statements.find(
          (stmt): stmt is Extract<typeof stmt, { kind: "forStatement" }> =>
            stmt.kind === "forStatement"
        );
        expect(loop).to.not.equal(undefined);
        if (!loop || loop.body.kind !== "blockStatement") return;

        const mountsDecl = loop.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations.some(
              (decl) =>
                decl.name.kind === "identifierPattern" &&
                decl.name.name === "mountsValue"
            )
        );
        expect(mountsDecl).to.not.equal(undefined);
        if (!mountsDecl) return;

        const mountsInit = mountsDecl.declarations[0]?.initializer;
        expect(mountsInit?.kind).to.equal("typeAssertion");
        if (!mountsInit || mountsInit.kind !== "typeAssertion") return;

        expect(mountsInit.expression.inferredType?.kind).to.equal("arrayType");
        if (
          !mountsInit.expression.inferredType ||
          mountsInit.expression.inferredType.kind !== "arrayType"
        ) {
          return;
        }
        expect(mountsInit.expression.inferredType.elementType.kind).to.equal(
          "unknownType"
        );

        expect(mountsInit.targetType?.kind).to.equal("arrayType");
        if (
          !mountsInit.targetType ||
          mountsInit.targetType.kind !== "arrayType"
        ) {
          return;
        }
        expect(mountsInit.targetType.elementType.kind).to.equal("unknownType");
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

    it("narrows source-owned union aliases to concrete typeof leaves in conditional expressions", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class MkdirOptions {",
            "  recursive?: boolean;",
            "}",
            "",
            "type MkdirOptionsLike = boolean | MkdirOptions;",
            "",
            "export function pick(options?: MkdirOptionsLike): boolean {",
            "  const recursive =",
            '    typeof options === "boolean" ? options : options?.recursive ?? false;',
            "  return recursive;",
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

        const aliasDecl = result.value.body.find(
          (
            stmt
          ): stmt is Extract<typeof stmt, { kind: "typeAliasDeclaration" }> =>
            stmt.kind === "typeAliasDeclaration" &&
            stmt.name === "MkdirOptionsLike"
        );
        expect(aliasDecl?.type.kind).to.equal("unionType");
        if (!aliasDecl || aliasDecl.type.kind !== "unionType") return;
        expect(aliasDecl.type.runtimeCarrierFamilyKey).to.equal(
          "runtime-union:alias:TestApp.MkdirOptionsLike"
        );
        expect(aliasDecl.type.runtimeCarrierName).to.equal("MkdirOptionsLike");
        expect(aliasDecl.type.runtimeCarrierNamespace).to.equal("TestApp");

        const fn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "pick"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const recursiveDecl = fn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0].name.name === "recursive"
        );
        expect(recursiveDecl).to.not.equal(undefined);
        const init = recursiveDecl?.declarations[0]?.initializer;
        expect(init?.kind).to.equal("conditional");
        if (!init || init.kind !== "conditional") return;

        expect(init.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "boolean",
        });
        expect(init.whenTrue.inferredType).to.deep.equal({
          kind: "primitiveType",
          name: "boolean",
        });

        const falseBranch = init.whenFalse;
        expect(falseBranch.kind).to.equal("logical");
        if (falseBranch.kind !== "logical") return;
        const optionalRead =
          falseBranch.left.kind === "typeAssertion"
            ? falseBranch.left.expression
            : falseBranch.left;
        expect(optionalRead.kind).to.equal("memberAccess");
        if (optionalRead.kind !== "memberAccess") return;
        expect(optionalRead.object.inferredType?.kind).to.equal("unionType");
        if (optionalRead.object.inferredType?.kind !== "unionType") return;
        expect(
          optionalRead.object.inferredType.types.map((member) =>
            member.kind === "primitiveType"
              ? member.name
              : member.kind === "referenceType"
                ? member.name
                : member.kind
          )
        ).to.deep.equal(["undefined", "MkdirOptions"]);
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

    it("narrows predicate fallthrough after an earlier instanceof exclusion to the remaining member", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class Buffer {}",
            "class Uint8Array {}",
            "",
            "declare function isNumberArray(",
            "  value: number[] | Uint8Array,",
            "): value is number[];",
            "declare function fromArray(value: number[]): void;",
            "declare function fromUint8Array(value: Uint8Array): void;",
            "",
            "export function fromNonString(value: number[] | Buffer | Uint8Array): void {",
            "  if (value instanceof Buffer) {",
            "    return;",
            "  }",
            "",
            "  if (isNumberArray(value)) {",
            "    fromArray(value);",
            "    return;",
            "  }",
            "",
            "  fromUint8Array(value);",
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
            stmt.kind === "functionDeclaration" && stmt.name === "fromNonString"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const finalCall = [...fn.body.statements]
          .reverse()
          .find(
            (stmt): stmt is IrExpressionStatement =>
              stmt.kind === "expressionStatement" &&
              stmt.expression.kind === "call" &&
              stmt.expression.callee.kind === "identifier" &&
              stmt.expression.callee.name === "fromUint8Array"
          );
        expect(finalCall).to.not.equal(undefined);
        if (!finalCall || finalCall.expression.kind !== "call") return;

        const narrowedArg = finalCall.expression.arguments[0];
        expect(narrowedArg?.inferredType?.kind).to.equal("referenceType");
        if (narrowedArg?.inferredType?.kind !== "referenceType") return;
        expect(narrowedArg.inferredType.name).to.equal("Uint8Array");
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps static predicate parameter surfaces on the wider carrier after earlier exclusions", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class Uint8Array {}",
            "",
            "export class Buffer {",
            "  private static isNumberArray(",
            "    value: number[] | Buffer | Uint8Array,",
            "  ): value is number[] {",
            "    return Array.isArray(value);",
            "  }",
            "",
            "  static fromNonString(value: number[] | Buffer | Uint8Array): void {",
            "    if (value instanceof Buffer) {",
            "      return;",
            "    }",
            "",
            "    if (Buffer.isNumberArray(value)) {",
            "      return;",
            "    }",
            "",
            "    void value;",
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

        const bufferClass = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Buffer"
        );
        expect(bufferClass).to.not.equal(undefined);
        if (!bufferClass) return;

        const fromNonString = bufferClass.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" &&
            member.name === "fromNonString"
        );
        expect(fromNonString).to.not.equal(undefined);
        if (!fromNonString?.body) return;

        const predicateIf = fromNonString.body.statements.find(
          (
            stmt,
            index
          ): stmt is Extract<
            (typeof fromNonString.body.statements)[number],
            { kind: "ifStatement" }
          > =>
            index > 0 &&
            stmt.kind === "ifStatement" &&
            stmt.condition.kind === "call" &&
            stmt.condition.callee.kind === "memberAccess" &&
            stmt.condition.callee.property === "isNumberArray"
        );
        expect(predicateIf).to.not.equal(undefined);
        if (!predicateIf || predicateIf.condition.kind !== "call") return;

        const parameterType = predicateIf.condition.parameterTypes?.[0];
        expect(parameterType?.kind).to.equal("unionType");
        if (!parameterType || parameterType.kind !== "unionType") return;
        expect(parameterType.types).to.have.length(3);
        expect(
          parameterType.types.map((member) =>
            member.kind === "referenceType"
              ? member.name
              : member.kind === "arrayType"
                ? "array"
                : member.kind
          )
        ).to.deep.equal(["array", "Buffer", "Uint8Array"]);
      } finally {
        fixture.cleanup();
      }
    });

    it("preserves instanceof fallthrough across iterable-compatible reference types", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "class Uint8Array {",
            "  [Symbol.iterator](): Iterator<number> {",
            "    return undefined as unknown as Iterator<number>;",
            "  }",
            "}",
            "",
            "class Buffer {",
            "  [Symbol.iterator](): Iterator<number> {",
            "    return undefined as unknown as Iterator<number>;",
            "  }",
            "}",
            "",
            "declare function isNumberArray(",
            "  value: number[] | Buffer | Uint8Array,",
            "): value is number[];",
            "declare function fromUint8Array(value: Uint8Array): void;",
            "",
            "export function fromNonString(value: number[] | Buffer | Uint8Array): void {",
            "  if (value instanceof Buffer) {",
            "    return;",
            "  }",
            "",
            "  if (isNumberArray(value)) {",
            "    return;",
            "  }",
            "",
            "  fromUint8Array(value);",
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
            stmt.kind === "functionDeclaration" && stmt.name === "fromNonString"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const finalCall = [...fn.body.statements]
          .reverse()
          .find(
            (stmt): stmt is IrExpressionStatement =>
              stmt.kind === "expressionStatement" &&
              stmt.expression.kind === "call" &&
              stmt.expression.callee.kind === "identifier" &&
              stmt.expression.callee.name === "fromUint8Array"
          );
        expect(finalCall).to.not.equal(undefined);
        if (!finalCall || finalCall.expression.kind !== "call") return;

        const narrowedArg = finalCall.expression.arguments[0];
        expect(narrowedArg?.inferredType?.kind).to.equal("referenceType");
        if (narrowedArg?.inferredType?.kind !== "referenceType") return;
        expect(narrowedArg.inferredType.name).to.equal("Uint8Array");
      } finally {
        fixture.cleanup();
      }
    });

    it("does not leak instanceof narrowing past early-return conjunction fallthrough", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare function stringToBytes(value: string): Uint8Array;",
            "",
            "const toBytes = (msg: Uint8Array | string): Uint8Array => {",
            '  if (typeof msg === "string") {',
            "    return stringToBytes(msg);",
            "  }",
            "  return msg;",
            "};",
            "",
            "export function parseSendArgs(",
            "  msg: Uint8Array | string,",
            "  args: unknown[],",
            "  arg0: unknown,",
            "  arg1: unknown,",
            "): Uint8Array {",
            '  if (msg instanceof Uint8Array && args.length >= 2 && typeof arg0 === "number" && typeof arg1 === "number") {',
            "    return msg;",
            "  }",
            "  const data = toBytes(msg);",
            "  return data;",
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
            stmt.kind === "functionDeclaration" && stmt.name === "parseSendArgs"
        );
        expect(fn).to.not.equal(undefined);
        if (!fn) return;

        const dataDecl = fn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0].name.name === "data"
        );
        expect(dataDecl).to.not.equal(undefined);
        const init = dataDecl?.declarations[0]?.initializer;
        expect(init?.kind).to.equal("call");
        if (!init || init.kind !== "call") return;

        expect(init.arguments[0]?.inferredType?.kind).to.equal("unionType");
        if (init.arguments[0]?.inferredType?.kind !== "unionType") return;
        expect(init.arguments[0].inferredType.types).to.have.length(2);
        expect(init.arguments[0].inferredType.types[0]).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(init.arguments[0].inferredType.types[1]?.kind).to.equal(
          "referenceType"
        );
        if (init.arguments[0].inferredType.types[1]?.kind !== "referenceType") {
          return;
        }
        expect(init.arguments[0].inferredType.types[1].name).to.equal(
          "Uint8Array"
        );
      } finally {
        fixture.cleanup();
      }
    });
  });
});
