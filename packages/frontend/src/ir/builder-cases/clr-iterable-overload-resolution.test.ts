import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import {
  IrClassDeclaration,
  IrExpressionStatement,
  IrFunctionDeclaration,
  IrMethodDeclaration,
  IrReturnStatement,
} from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";
import {
  runAnonymousTypeLoweringPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
} from "../validation/index.js";

const findEqualCallStatement = (
  statements: readonly unknown[]
): IrExpressionStatement | undefined => {
  for (const statement of statements) {
    if (!statement || typeof statement !== "object") {
      continue;
    }

    const candidate = statement as {
      readonly kind?: string;
      readonly expression?: {
        readonly kind?: string;
        readonly callee?: {
          readonly kind?: string;
          readonly property?: unknown;
        };
      };
      readonly body?: unknown;
      readonly statements?: readonly unknown[];
      readonly thenStatement?: unknown;
      readonly elseStatement?: unknown;
    };

    if (
      candidate.kind === "expressionStatement" &&
      candidate.expression?.kind === "call" &&
      candidate.expression.callee?.kind === "memberAccess" &&
      candidate.expression.callee.property === "Equal"
    ) {
      return candidate as IrExpressionStatement;
    }

    const nestedBlocks = [
      candidate.body,
      candidate.thenStatement,
      candidate.elseStatement,
    ].filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

    for (const nested of nestedBlocks) {
      const nestedStatements =
        typeof nested === "object" &&
        nested &&
        (nested as { readonly kind?: string }).kind === "blockStatement"
          ? ((nested as { readonly statements?: readonly unknown[] })
              .statements ?? [])
          : [nested];
      const resolved = findEqualCallStatement(nestedStatements);
      if (resolved) {
        return resolved;
      }
    }

    if (candidate.kind === "blockStatement") {
      const resolved = findEqualCallStatement(candidate.statements ?? []);
      if (resolved) {
        return resolved;
      }
    }
  }

  return undefined;
};

const findEqualCallStatements = (
  statements: readonly unknown[]
): readonly IrExpressionStatement[] => {
  const matches: IrExpressionStatement[] = [];

  const visit = (nodes: readonly unknown[]) => {
    for (const statement of nodes) {
      if (!statement || typeof statement !== "object") {
        continue;
      }

      const candidate = statement as {
        readonly kind?: string;
        readonly expression?: {
          readonly kind?: string;
          readonly callee?: {
            readonly kind?: string;
            readonly property?: unknown;
          };
        };
        readonly body?: unknown;
        readonly statements?: readonly unknown[];
        readonly thenStatement?: unknown;
        readonly elseStatement?: unknown;
      };

      if (
        candidate.kind === "expressionStatement" &&
        candidate.expression?.kind === "call" &&
        candidate.expression.callee?.kind === "memberAccess" &&
        candidate.expression.callee.property === "Equal"
      ) {
        matches.push(candidate as IrExpressionStatement);
      }

      const nestedBlocks = [
        candidate.body,
        candidate.thenStatement,
        candidate.elseStatement,
      ].filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

      for (const nested of nestedBlocks) {
        const nestedStatements =
          typeof nested === "object" &&
          nested &&
          (nested as { readonly kind?: string }).kind === "blockStatement"
            ? ((nested as { readonly statements?: readonly unknown[] })
                .statements ?? [])
            : [nested];
        visit(nestedStatements);
      }

      if (candidate.kind === "blockStatement") {
        visit(candidate.statements ?? []);
      }
    }
  };

  visit(statements);
  return matches;
};

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("CLR iterable overload resolution", () => {
    it("infers explicit unknown into generic method parameters from array arguments", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            'import type { int } from "@tsonic/core/types.js";',
            "export class Array<T = unknown> {",
            "  private createWrapped<TResult>(values: readonly TResult[] | TResult[]): Array<TResult> {",
            "    void values;",
            "    return new Array<TResult>();",
            "  }",
            "  public flat(depth: int = 1 as int): Array<unknown> {",
            "    const flattened: unknown[] = [];",
            "    void depth;",
            "    return this.createWrapped(flattened);",
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

        const arrayDecl = result.value.body.find(
          (stmt): stmt is IrClassDeclaration =>
            stmt.kind === "classDeclaration" && stmt.name === "Array"
        );
        expect(arrayDecl).to.exist;
        if (!arrayDecl) return;

        const flatMethod = arrayDecl.members.find(
          (member): member is IrMethodDeclaration =>
            member.kind === "methodDeclaration" && member.name === "flat"
        );
        expect(flatMethod).to.exist;
        if (!flatMethod?.body) return;

        const returnStmt = flatMethod.body.statements.find(
          (stmt): stmt is IrReturnStatement => stmt.kind === "returnStatement"
        );
        expect(returnStmt?.expression?.kind).to.equal("call");
        if (!returnStmt?.expression || returnStmt.expression.kind !== "call") {
          return;
        }

        expect(returnStmt.expression.inferredType?.kind).to.equal(
          "referenceType"
        );
        if (returnStmt.expression.inferredType?.kind !== "referenceType") {
          return;
        }

        expect(returnStmt.expression.inferredType.name).to.equal("Array");
        expect(returnStmt.expression.inferredType.typeArguments).to.deep.equal([
          { kind: "unknownType", explicit: true },
        ]);
        expect(returnStmt.expression.parameterTypes).to.deep.equal([
          {
            kind: "arrayType",
            elementType: { kind: "unknownType", explicit: true },
            origin: "explicit",
          },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers IEnumerable_1 overloads for iterator-bearing class arguments", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare const Symbol: {",
            "  readonly iterator: unique symbol;",
            "};",
            "interface Iterator<T> {}",
            "interface IterableIterator<T> extends Iterator<T> {",
            "  [Symbol.iterator](): IterableIterator<T>;",
            "}",
            "interface IEnumerable_1<T> {}",
            "declare class Assert {",
            "  static Equal<T>(expected: IEnumerable_1<T>, actual: IEnumerable_1<T>): void;",
            "  static Equal<T>(expected: T, actual: T): void;",
            "}",
            "declare class Bytes {",
            "  [Symbol.iterator](): IterableIterator<number>;",
            "}",
            "export function run(left: Bytes, right: Bytes): void {",
            "  Assert.Equal(left, right);",
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

        const runFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const statement = runFn.body.statements[0];
        expect(statement?.kind).to.equal("expressionStatement");
        if (!statement || statement.kind !== "expressionStatement") return;

        const call = (statement as IrExpressionStatement).expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        const firstParameterType = call.parameterTypes?.[0];
        const secondParameterType = call.parameterTypes?.[1];

        expect(firstParameterType?.kind).to.equal("referenceType");
        expect(secondParameterType?.kind).to.equal("referenceType");
        if (
          firstParameterType?.kind !== "referenceType" ||
          secondParameterType?.kind !== "referenceType"
        ) {
          return;
        }

        expect(firstParameterType.name).to.equal("IEnumerable_1");
        expect(secondParameterType.name).to.equal("IEnumerable_1");
        expect(firstParameterType.typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "number" },
        ]);
        expect(secondParameterType.typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "number" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers imported-style IEnumerable aliases backed by $instance wrappers", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare const Symbol: {",
            "  readonly iterator: unique symbol;",
            "};",
            "interface Iterator<T> {}",
            "interface IterableIterator<T> extends Iterator<T> {",
            "  [Symbol.iterator](): IterableIterator<T>;",
            "}",
            "interface IEnumerable_1$instance<T> {}",
            "type IEnumerable<T> = IEnumerable_1$instance<T>;",
            "declare class Assert {",
            "  static Equal<T>(expected: IEnumerable<T>, actual: IEnumerable<T>): void;",
            "  static Equal<T>(expected: T, actual: T): void;",
            "}",
            "declare class Bytes {",
            "  [Symbol.iterator](): IterableIterator<number>;",
            "}",
            "export function run(left: Bytes, right: Bytes): void {",
            "  Assert.Equal(left, right);",
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

        const runFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const statement = runFn.body.statements[0];
        expect(statement?.kind).to.equal("expressionStatement");
        if (!statement || statement.kind !== "expressionStatement") return;

        const call = (statement as IrExpressionStatement).expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        const firstParameterType = call.parameterTypes?.[0];
        const secondParameterType = call.parameterTypes?.[1];

        expect(firstParameterType?.kind).to.equal("referenceType");
        expect(secondParameterType?.kind).to.equal("referenceType");
        if (
          firstParameterType?.kind !== "referenceType" ||
          secondParameterType?.kind !== "referenceType"
        ) {
          return;
        }

        expect(firstParameterType.name).to.equal("IEnumerable_1$instance");
        expect(secondParameterType.name).to.equal("IEnumerable_1$instance");
        expect(firstParameterType.typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "number" },
        ]);
        expect(secondParameterType.typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "number" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers imported IEnumerable overloads over generic catch-all overloads", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            "import type { IEnumerable } from \"@tsonic/dotnet/System.Collections.Generic.js\";",
            "",
            "declare const Symbol: {",
            "  readonly iterator: unique symbol;",
            "};",
            "interface Iterator<T> {}",
            "interface IterableIterator<T> extends Iterator<T> {",
            "  [Symbol.iterator](): IterableIterator<T>;",
            "}",
            "declare class Assert {",
            "  static Equal<T>(expected: IEnumerable<T>, actual: IEnumerable<T>): void;",
            "  static Equal<T>(expected: T, actual: T): void;",
            "}",
            "declare class Bytes {",
            "  [Symbol.iterator](): IterableIterator<number>;",
            "}",
            "export function run(left: Bytes, right: Bytes): void {",
            "  Assert.Equal(left, right);",
            "}",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic.d.ts": [
            'import type * as Internal from "./System.Collections.Generic/internal/index.js";',
            "export type IEnumerable<T> = Internal.IEnumerable_1<T>;",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IEnumerable_1: never;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
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

        const runFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const statement = runFn.body.statements[0];
        expect(statement?.kind).to.equal("expressionStatement");
        if (!statement || statement.kind !== "expressionStatement") return;

        const call = (statement as IrExpressionStatement).expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        const firstParameterType = call.parameterTypes?.[0];
        const secondParameterType = call.parameterTypes?.[1];

        expect(firstParameterType?.kind).to.equal("referenceType");
        expect(secondParameterType?.kind).to.equal("referenceType");
        if (
          firstParameterType?.kind !== "referenceType" ||
          secondParameterType?.kind !== "referenceType"
        ) {
          return;
        }

        expect(firstParameterType.name).to.equal("IEnumerable_1$instance");
        expect(secondParameterType.name).to.equal("IEnumerable_1$instance");
        expect(firstParameterType.typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "number" },
        ]);
        expect(secondParameterType.typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "number" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps scalar xunit equality overloads when only one argument has iterable evidence", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "declare class EventEmitter {",
            "  static once(emitter: EventEmitter, eventName: string): Promise<unknown[]>;",
            "  emit(eventName: string, ...args: unknown[]): boolean;",
            "}",
            "",
            "export async function run(emitter: EventEmitter): Promise<void> {",
            '  const args = await EventEmitter.once(emitter, "test");',
            '  Assert.Equal("arg1", args[0]);',
            "}",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js": "export {};",
          "node_modules/xunit-types/Xunit.d.ts": [
            'import type { IAsyncEnumerable_1, IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            "",
            "export interface Assert$instance {}",
            "",
            "export declare const Assert: (abstract new() => Assert$instance) & {",
            "  Equal<T>(expected: IAsyncEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IEnumerable_1<T>): void;",
            "  Equal(expected: string, actual: string): void;",
            "  Equal<T>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IEnumerable_1: never;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
              "}",
              "export type IAsyncEnumerable_1<T> = IAsyncEnumerable_1$instance<T>;",
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

        const module = result.value;

        const runFn = module.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const callStatement = findEqualCallStatement(runFn.body.statements);
        expect(callStatement).to.not.equal(undefined);
        if (!callStatement) return;

        const call = callStatement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        expect(call.parameterTypes?.[0]).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(call.parameterTypes?.[1]).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps scalar string equality overloads over imported iterable siblings", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "declare const left: string;",
            "declare const right: string;",
            "",
            "export function run(): void {",
            "  Assert.Equal(left, right);",
            "}",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js": "export {};",
          "node_modules/xunit-types/Xunit.d.ts": [
            'import type { IAsyncEnumerable_1, IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            "",
            "export interface Assert$instance {}",
            "",
            "export declare const Assert: (abstract new() => Assert$instance) & {",
            "  Equal<T>(expected: IAsyncEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IEnumerable_1<T>): void;",
            "  Equal(expected: string, actual: string): void;",
            "  Equal<T>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IEnumerable_1: never;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
              "}",
              "export type IAsyncEnumerable_1<T> = IAsyncEnumerable_1$instance<T>;",
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

        const module = result.value;

        const runFn = module.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const callStatement = findEqualCallStatement(runFn.body.statements);
        expect(callStatement).to.not.equal(undefined);
        if (!callStatement) return;

        const call = callStatement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        expect(call.parameterTypes).to.deep.equal([
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "string" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps scalar xunit facade equality overloads through internal re-exports", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "declare class EventEmitter {",
            "  static once(emitter: EventEmitter, eventName: string): Promise<unknown[]>;",
            "}",
            "",
            "export async function run(emitter: EventEmitter): Promise<void> {",
            '  const args = await EventEmitter.once(emitter, "test");',
            '  Assert.Equal("arg1", args[0]);',
            "}",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js":
            'export { Assert as Assert } from "./Xunit/internal/index.js";',
          "node_modules/xunit-types/Xunit.d.ts":
            'export { Assert as Assert } from "./Xunit/internal/index.js";',
          "node_modules/xunit-types/Xunit/internal/index.js":
            "export const Assert = undefined;",
          "node_modules/xunit-types/Xunit/internal/index.d.ts": [
            'import type { IAsyncEnumerable_1, IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            "",
            "export interface Assert$instance {}",
            "",
            "export declare const Assert: (abstract new() => Assert$instance) & {",
            "  Equal<T>(expected: IAsyncEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IEnumerable_1<T>): void;",
            "  Equal(expected: string, actual: string): void;",
            "  Equal<T>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IEnumerable_1: never;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
              "}",
              "export type IAsyncEnumerable_1<T> = IAsyncEnumerable_1$instance<T>;",
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

        const module = result.value;
        const runFn = module.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const callStatement = findEqualCallStatement(runFn.body.statements);
        expect(callStatement).to.not.equal(undefined);
        if (!callStatement) return;

        const call = callStatement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        expect(call.parameterTypes?.[0]).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
        expect(call.parameterTypes?.[1]).to.deep.equal({
          kind: "primitiveType",
          name: "string",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps scalar direct-call equality overloads when generic callable values have Memory<char> siblings", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { char, int } from "@tsonic/core/types.js";',
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "declare class EventEmitter {",
            "  static once(emitter: EventEmitter, eventName: string): Promise<unknown[]>;",
            "}",
            "declare class Counter {",
            "  count: int;",
            "}",
            "",
            "export async function run(emitter: EventEmitter, counter: Counter): Promise<void> {",
            '  const args = await EventEmitter.once(emitter, "test");',
            '  Assert.Equal("arg1", args[0]);',
            "  Assert.Equal(2, counter.count);",
            "}",
          ].join("\n"),
          "node_modules/@tsonic/core/package.json": JSON.stringify({
            name: "@tsonic/core",
            type: "module",
          }),
          "node_modules/@tsonic/core/types.js": "export {};",
          "node_modules/@tsonic/core/types.d.ts": [
            "export type char = string;",
            "export type int = number;",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js":
            'export { Assert as Assert } from "./Xunit/internal/index.js";',
          "node_modules/xunit-types/Xunit.d.ts":
            'export { Assert as Assert } from "./Xunit/internal/index.js";',
          "node_modules/xunit-types/Xunit/internal/index.js":
            "export const Assert = undefined;",
          "node_modules/xunit-types/Xunit/internal/index.d.ts": [
            'import type { char, int } from "@tsonic/core/types.js";',
            'import type { IAsyncEnumerable_1, IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            'import type { Memory_1 } from "@tsonic/dotnet/System/internal/index.js";',
            "",
            "export interface Assert$instance {}",
            "",
            "export declare const Assert: (abstract new() => Assert$instance) & {",
            "  Equal<T>(expected: IAsyncEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal(expected: Memory_1<char>, actual: Memory_1<char>): void;",
            "  Equal(expected: int, actual: int): void;",
            "  Equal(expected: string, actual: string): void;",
            "  Equal<T>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IEnumerable_1: never;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
              "}",
              "export type IAsyncEnumerable_1<T> = IAsyncEnumerable_1$instance<T>;",
            ].join("\n"),
          "node_modules/@tsonic/dotnet/System/internal/index.js": "export {};",
          "node_modules/@tsonic/dotnet/System/internal/index.d.ts": [
            "export interface Memory_1$instance<T> {",
            "  readonly __tsonic_iface_System_Memory_1: never;",
            "}",
            "export type Memory_1<T> = Memory_1$instance<T>;",
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

        const module = result.value;
        const runFn = module.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const calls = findEqualCallStatements(runFn.body.statements).map(
          (statement) => statement.expression
        );
        expect(calls).to.have.length(2);

        const firstCall = calls[0];
        const secondCall = calls[1];
        expect(firstCall?.kind).to.equal("call");
        expect(secondCall?.kind).to.equal("call");
        if (firstCall?.kind !== "call" || secondCall?.kind !== "call") {
          return;
        }

        expect(firstCall.parameterTypes).to.deep.equal([
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "string" },
        ]);
        expect(secondCall.parameterTypes).to.deep.equal([
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "int" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps generic scalar direct-call equality overloads over Memory<char> siblings when int inference mixes reference and primitive forms", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { int } from "@tsonic/core/types.js";',
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "declare class Holder {",
            "  length: int;",
            "}",
            "",
            "export function run(holder: Holder): void {",
            "  Assert.Equal(2, holder.length);",
            "}",
          ].join("\n"),
          "node_modules/@tsonic/core/package.json": JSON.stringify({
            name: "@tsonic/core",
            type: "module",
          }),
          "node_modules/@tsonic/core/types.js": "export {};",
          "node_modules/@tsonic/core/types.d.ts": [
            "export type int = number;",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js":
            'export { Assert as Assert } from "./Xunit/internal/index.js";',
          "node_modules/xunit-types/Xunit.d.ts":
            'export { Assert as Assert } from "./Xunit/internal/index.js";',
          "node_modules/xunit-types/Xunit/internal/index.js":
            "export const Assert = undefined;",
          "node_modules/xunit-types/Xunit/internal/index.d.ts": [
            'import type { IAsyncEnumerable_1, IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            'import type { Memory_1 } from "@tsonic/dotnet/System/internal/index.js";',
            "",
            "export interface Assert$instance {}",
            "",
            "export declare const Assert: (abstract new() => Assert$instance) & {",
            "  Equal<T>(expected: IAsyncEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IEnumerable_1<T>): void;",
            "  Equal(expected: Memory_1<char>, actual: Memory_1<char>): void;",
            "  Equal(expected: string, actual: string): void;",
            "  Equal<T>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IEnumerable_1: never;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
              "}",
              "export type IAsyncEnumerable_1<T> = IAsyncEnumerable_1$instance<T>;",
            ].join("\n"),
          "node_modules/@tsonic/dotnet/System/internal/index.js": "export {};",
          "node_modules/@tsonic/dotnet/System/internal/index.d.ts": [
            "export interface Memory_1$instance<T> {",
            "  readonly __tsonic_iface_System_Memory_1: never;",
            "}",
            "export type Memory_1<T> = Memory_1$instance<T>;",
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

        const module = result.value;
        const runFn = module.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const callStatement = findEqualCallStatement(runFn.body.statements);
        expect(callStatement).to.not.equal(undefined);
        if (!callStatement) return;

        const call = callStatement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        expect(call.parameterTypes).to.deep.equal([
          { kind: "referenceType", name: "int" },
          { kind: "referenceType", name: "int" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps generic scalar equality overloads over Memory<char> siblings for JsValue array elements", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { Assert } from "xunit-types/Xunit.js";',
            'import type { JsValue } from "@tsonic/core/types.js";',
            "",
            "declare class EventEmitter {",
            "  static once(emitter: EventEmitter, eventName: string): Promise<JsValue[]>;",
            "}",
            "",
            "export async function run(emitter: EventEmitter): Promise<void> {",
            '  const args = await EventEmitter.once(emitter, "test");',
            "  Assert.Equal(1, args[0]);",
            "}",
          ].join("\n"),
          "node_modules/@tsonic/core/package.json": JSON.stringify({
            name: "@tsonic/core",
            type: "module",
          }),
          "node_modules/@tsonic/core/types.js": "export {};",
          "node_modules/@tsonic/core/types.d.ts": [
            "export type char = string;",
            "export type JsValue = object | string | number | boolean | bigint | symbol | null;",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js":
            'export { Assert as Assert } from "./Xunit/internal/index.js";',
          "node_modules/xunit-types/Xunit.d.ts":
            'export { Assert as Assert } from "./Xunit/internal/index.js";',
          "node_modules/xunit-types/Xunit/internal/index.js":
            "export const Assert = undefined;",
          "node_modules/xunit-types/Xunit/internal/index.d.ts": [
            'import type { char } from "@tsonic/core/types.js";',
            'import type { Memory_1 } from "@tsonic/dotnet/System/internal/index.js";',
            "",
            "export interface Assert$instance {}",
            "",
            "export declare const Assert: (abstract new() => Assert$instance) & {",
            "  Equal(expected: Memory_1<char>, actual: Memory_1<char>): void;",
            "  Equal(expected: string, actual: string): void;",
            "  Equal<T>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System/internal/index.js": "export {};",
          "node_modules/@tsonic/dotnet/System/internal/index.d.ts": [
            "export interface Memory_1$instance<T> {",
            "  readonly __tsonic_type_System_Memory_1: never;",
            "}",
            "export type Memory_1<T> = Memory_1$instance<T>;",
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
        if (!result.ok) {
          expect.fail(`Expected build success, got diagnostic: ${result.error.message}`);
          return;
        }

        const runDecl = result.value.body.find(
          (statement): statement is IrFunctionDeclaration =>
            statement.kind === "functionDeclaration" && statement.name === "run"
        );
        expect(runDecl).to.not.equal(undefined);
        if (!runDecl?.body) {
          return;
        }

        const callStatement = findEqualCallStatement(runDecl.body.statements);
        expect(callStatement).to.not.equal(undefined);
        if (
          !callStatement ||
          callStatement.kind !== "expressionStatement" ||
          callStatement.expression.kind !== "call"
        ) {
          return;
        }

        expect(callStatement.expression.parameterTypes).to.deep.equal([
          { kind: "referenceType", name: "int" },
          { kind: "referenceType", name: "int" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps generic scalar equality overloads when later arguments are unknown", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "declare class AssertionError {",
            "  message: string;",
            "  actual: unknown;",
            "  expected: unknown;",
            "}",
            "",
            "export function run(error: AssertionError): void {",
            '  Assert.Equal("Test message", error.message);',
            "  Assert.Equal(5, error.actual);",
            "  Assert.Equal(10, error.expected);",
            "}",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js":
            'export { Assert as Assert } from "./Xunit/internal/index.js";',
          "node_modules/xunit-types/Xunit.d.ts":
            'export { Assert as Assert } from "./Xunit/internal/index.js";',
          "node_modules/xunit-types/Xunit/internal/index.js":
            "export const Assert = undefined;",
          "node_modules/xunit-types/Xunit/internal/index.d.ts": [
            'import type { IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            "",
            "export interface Assert$instance {}",
            "",
            "export declare const Assert: (abstract new() => Assert$instance) & {",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IEnumerable_1<T>): void;",
            "  Equal(expected: string, actual: string): void;",
            "  Equal<T>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IEnumerable_1: never;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
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

        const module = result.value;
        const runFn = module.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const calls = findEqualCallStatements(runFn.body.statements).map(
          (statement) => statement.expression
        );
        expect(calls).to.have.length(3);

        const firstCall = calls[0];
        const secondCall = calls[1];
        const thirdCall = calls[2];
        expect(firstCall?.kind).to.equal("call");
        expect(secondCall?.kind).to.equal("call");
        expect(thirdCall?.kind).to.equal("call");
        if (
          firstCall?.kind !== "call" ||
          secondCall?.kind !== "call" ||
          thirdCall?.kind !== "call"
        ) {
          return;
        }

        expect(firstCall.inferredType).to.deep.equal({ kind: "voidType" });
        expect(firstCall.parameterTypes).to.deep.equal([
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "string" },
        ]);

        expect(secondCall.inferredType).to.deep.equal({ kind: "voidType" });
        expect(secondCall.parameterTypes).to.deep.equal([
          { kind: "unknownType", explicit: true },
          { kind: "unknownType", explicit: true },
        ]);

        expect(thirdCall.inferredType).to.deep.equal({ kind: "voidType" });
        expect(thirdCall.parameterTypes).to.deep.equal([
          { kind: "unknownType", explicit: true },
          { kind: "unknownType", explicit: true },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps scalar string equality over the real xunit Equal overload family when later arguments are unknown", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { char } from "@tsonic/core/types.js";',
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "declare class EventEmitter {",
            "  static once(emitter: EventEmitter, eventName: string): Promise<unknown[]>;",
            "}",
            "",
            "export async function run(emitter: EventEmitter): Promise<void> {",
            '  const args = await EventEmitter.once(emitter, "test");',
            '  Assert.Equal("arg1", args[0]);',
            "}",
          ].join("\n"),
          "node_modules/@tsonic/core/package.json": JSON.stringify({
            name: "@tsonic/core",
            type: "module",
          }),
          "node_modules/@tsonic/core/types.js": "export {};",
          "node_modules/@tsonic/core/types.d.ts": [
            "export type char = string;",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js": "export {};",
          "node_modules/xunit-types/Xunit.d.ts": [
            'import type { char } from "@tsonic/core/types.js";',
            'import type { IAsyncEnumerable_1, IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            'import type { IEquatable_1, Memory_1, ReadOnlyMemory_1, ReadOnlySpan_1, Span_1 } from "@tsonic/dotnet/System/internal/index.js";',
            "",
            "export interface Assert$instance {}",
            "",
            "export declare const Assert: (abstract new() => Assert$instance) & {",
            "  Equal<T>(expected: IAsyncEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IAsyncEnumerable_1<T>): void;",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IEnumerable_1<T>): void;",
            "  Equal<T extends IEquatable_1<T>>(expectedMemory: Memory_1<T>, actualMemory: Memory_1<T>): void;",
            "  Equal<T extends IEquatable_1<T>>(expectedMemory: ReadOnlyMemory_1<T>, actualMemory: ReadOnlyMemory_1<T>): void;",
            "  Equal(expected: Memory_1<char>, actual: Memory_1<char>, ignoreCase?: boolean, ignoreLineEndingDifferences?: boolean, ignoreWhiteSpaceDifferences?: boolean, ignoreAllWhiteSpace?: boolean): void;",
            "  Equal(expected: ReadOnlyMemory_1<char>, actual: ReadOnlyMemory_1<char>): void;",
            "  Equal(expected: ReadOnlySpan_1<char>, actual: ReadOnlySpan_1<char>): void;",
            "  Equal(expected: Span_1<char>, actual: Span_1<char>): void;",
            "  Equal(expected: string, actual: string, ignoreCase?: boolean, ignoreLineEndingDifferences?: boolean, ignoreWhiteSpaceDifferences?: boolean, ignoreAllWhiteSpace?: boolean): void;",
            "  Equal(expected: string, actual: string): void;",
            "  Equal<T>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IEnumerable_1: never;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
              "}",
              "export type IAsyncEnumerable_1<T> = IAsyncEnumerable_1$instance<T>;",
            ].join("\n"),
          "node_modules/@tsonic/dotnet/System/internal/index.js": "export {};",
          "node_modules/@tsonic/dotnet/System/internal/index.d.ts": [
            "export interface IEquatable_1$instance<T> {",
            "  readonly __tsonic_iface_System_IEquatable_1: never;",
            "}",
            "export type IEquatable_1<T> = IEquatable_1$instance<T>;",
            "export interface Memory_1$instance<T> {",
            "  readonly __tsonic_iface_System_Memory_1: never;",
            "}",
            "export type Memory_1<T> = Memory_1$instance<T>;",
            "export interface ReadOnlyMemory_1$instance<T> {",
            "  readonly __tsonic_iface_System_ReadOnlyMemory_1: never;",
            "}",
            "export type ReadOnlyMemory_1<T> = ReadOnlyMemory_1$instance<T>;",
            "export interface ReadOnlySpan_1$instance<T> {",
            "  readonly __tsonic_iface_System_ReadOnlySpan_1: never;",
            "}",
            "export type ReadOnlySpan_1<T> = ReadOnlySpan_1$instance<T>;",
            "export interface Span_1$instance<T> {",
            "  readonly __tsonic_iface_System_Span_1: never;",
            "}",
            "export type Span_1<T> = Span_1$instance<T>;",
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

        const runFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const callStatement = findEqualCallStatement(runFn.body.statements);
        expect(callStatement).to.not.equal(undefined);
        if (!callStatement) return;

        const call = callStatement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        expect(call.parameterTypes).to.deep.equal([
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "string" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps string equality over iterable siblings when char aliases are compared to string surfaces", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { Assert } from "xunit-types/Xunit.js";',
            'import { Path } from "@tsonic/dotnet/System.IO.js";',
            "",
            "declare const sep: string;",
            "",
            "export function run(): void {",
            "  Assert.Equal(Path.DirectorySeparatorChar, sep);",
            "}",
          ].join("\n"),
          "node_modules/@tsonic/core/package.json": JSON.stringify({
            name: "@tsonic/core",
            type: "module",
          }),
          "node_modules/@tsonic/core/types.js": "export {};",
          "node_modules/@tsonic/core/types.d.ts": [
            "export type char = string;",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js": "export {};",
          "node_modules/xunit-types/Xunit.d.ts": [
            'import type { char } from "@tsonic/core/types.js";',
            'import type { IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            'import type { Memory_1, ReadOnlyMemory_1, ReadOnlySpan_1, Span_1 } from "@tsonic/dotnet/System/internal/index.js";',
            "",
            "export interface Assert$instance {}",
            "",
            "export declare const Assert: (abstract new() => Assert$instance) & {",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IEnumerable_1<T>): void;",
            "  Equal(expected: Memory_1<char>, actual: Memory_1<char>): void;",
            "  Equal(expected: ReadOnlyMemory_1<char>, actual: ReadOnlyMemory_1<char>): void;",
            "  Equal(expected: ReadOnlySpan_1<char>, actual: ReadOnlySpan_1<char>): void;",
            "  Equal(expected: Span_1<char>, actual: Span_1<char>): void;",
            "  Equal(expected: string, actual: string): void;",
            "  Equal<T>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IEnumerable_1: never;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
            ].join("\n"),
          "node_modules/@tsonic/dotnet/System/internal/index.js": "export {};",
          "node_modules/@tsonic/dotnet/System/internal/index.d.ts": [
            "export interface Memory_1$instance<T> {",
            "  readonly __tsonic_iface_System_Memory_1: never;",
            "}",
            "export type Memory_1<T> = Memory_1$instance<T>;",
            "export interface ReadOnlyMemory_1$instance<T> {",
            "  readonly __tsonic_iface_System_ReadOnlyMemory_1: never;",
            "}",
            "export type ReadOnlyMemory_1<T> = ReadOnlyMemory_1$instance<T>;",
            "export interface ReadOnlySpan_1$instance<T> {",
            "  readonly __tsonic_iface_System_ReadOnlySpan_1: never;",
            "}",
            "export type ReadOnlySpan_1<T> = ReadOnlySpan_1$instance<T>;",
            "export interface Span_1$instance<T> {",
            "  readonly __tsonic_iface_System_Span_1: never;",
            "}",
            "export type Span_1<T> = Span_1$instance<T>;",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/System.IO.js": "export {};",
          "node_modules/@tsonic/dotnet/System.IO.d.ts": [
            'import type { char } from "@tsonic/core/types.js";',
            "",
            "export declare const Path: {",
            "  readonly DirectorySeparatorChar: char;",
            "};",
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

        const runFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const callStatement = findEqualCallStatement(runFn.body.statements);
        expect(callStatement).to.not.equal(undefined);
        if (!callStatement) return;

        const call = callStatement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        expect(call.parameterTypes).to.deep.equal([
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "string" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("refreshes imported iterable overload surfaces after numeric proof narrows integer offsets", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { Uint8Array } from "@fixture/js/index.js";',
            "",
            "export function concatBytes(...buffers: Uint8Array[]): Uint8Array {",
            "  let totalLength = 0;",
            "  for (let index = 0; index < buffers.length; index += 1) {",
            "    totalLength += buffers[index]!.length;",
            "  }",
            "",
            "  const result = new Uint8Array(totalLength);",
            "  let offset = 0;",
            "  for (let index = 0; index < buffers.length; index += 1) {",
            "    const buffer = buffers[index]!;",
            "    result.set(buffer, offset);",
            "    offset += buffer.length;",
            "  }",
            "  return result;",
            "}",
          ].join("\n"),
          "node_modules/@tsonic/core/package.json": JSON.stringify({
            name: "@tsonic/core",
            type: "module",
          }),
          "node_modules/@tsonic/core/types.js": "export {};",
          "node_modules/@tsonic/core/types.d.ts": [
            "export type int = number;",
            "export type byte = number;",
          ].join("\n"),
          "node_modules/@fixture/js/package.json": JSON.stringify({
            name: "@fixture/js",
            type: "module",
          }),
          "node_modules/@fixture/js/index.js": "export {};",
          "node_modules/@fixture/js/index.d.ts": [
            'import type { byte, int } from "@tsonic/core/types.js";',
            "",
            "export declare class TypedArrayBase<TElement extends number> {",
            "  length: int;",
            "  set(index: int, value: number): void;",
            "  set(source: TElement[] | Iterable<number>, offset?: int): void;",
            "  set(",
            "    sourceOrIndex: int | TElement[] | Iterable<number>,",
            "    offsetOrValue?: int | number",
            "  ): void;",
            "}",
            "",
            "export declare class Uint8Array extends TypedArrayBase<byte> {",
            "  constructor(lengthOrValues: int | byte[] | Iterable<number>);",
            "  [Symbol.iterator](): IterableIterator<number>;",
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

        const lowered = runAnonymousTypeLoweringPass([result.value]).modules;
        const proofResult = runNumericProofPass(lowered);
        expect(proofResult.ok).to.equal(true);
        if (!proofResult.ok) return;

        const refreshed = runCallResolutionRefreshPass(
          proofResult.modules,
          fixture.ctx
        );
        const module = refreshed.modules[0];
        expect(module).to.not.equal(undefined);
        if (!module) return;

        const runFn = module.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "concatBytes"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const findSetCall = (
          statements: readonly unknown[]
        ): IrExpressionStatement | undefined => {
          for (const statement of statements) {
            if (!statement || typeof statement !== "object") {
              continue;
            }

            const candidate = statement as {
              readonly kind?: string;
              readonly expression?: {
                readonly kind?: string;
                readonly callee?: {
                  readonly kind?: string;
                  readonly property?: unknown;
                };
              };
              readonly body?: unknown;
              readonly statements?: readonly unknown[];
            };

            if (
              candidate.kind === "expressionStatement" &&
              candidate.expression?.kind === "call" &&
              candidate.expression.callee?.kind === "memberAccess" &&
              candidate.expression.callee.property === "set"
            ) {
              return candidate as IrExpressionStatement;
            }

            if (candidate.kind === "forStatement" && candidate.body) {
              const bodyStatements =
                typeof candidate.body === "object" &&
                candidate.body &&
                (candidate.body as { readonly kind?: string }).kind ===
                  "blockStatement"
                  ? (
                      candidate.body as {
                        readonly statements?: readonly unknown[];
                      }
                    ).statements ?? []
                  : [candidate.body];
              const nested = findSetCall(bodyStatements);
              if (nested) {
                return nested;
              }
            }

            if (candidate.kind === "blockStatement") {
              const nested = findSetCall(candidate.statements ?? []);
              if (nested) {
                return nested;
              }
            }
          }

          return undefined;
        };

        const statement = findSetCall(runFn.body.statements);
        expect(statement).to.not.equal(undefined);
        if (!statement) return;

        const call = statement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        const firstParameterType = call.parameterTypes?.[0];
        const firstSurfaceParameterType = call.surfaceParameterTypes?.[0];
        const secondParameterType = call.parameterTypes?.[1];
        const secondSurfaceParameterType = call.surfaceParameterTypes?.[1];

        expect(firstParameterType?.kind).to.equal("referenceType");
        expect(firstSurfaceParameterType?.kind).to.equal("unionType");
        expect(secondParameterType).to.deep.equal({
          kind: "primitiveType",
          name: "int",
        });
        expect(secondSurfaceParameterType?.kind).to.equal("unionType");

        if (
          firstParameterType?.kind !== "referenceType" ||
          firstSurfaceParameterType?.kind !== "unionType" ||
          secondSurfaceParameterType?.kind !== "unionType"
        ) {
          return;
        }

        expect(firstParameterType.name).to.equal("Iterable");
        expect(firstSurfaceParameterType.types).to.have.length(2);
        expect(firstSurfaceParameterType.types[0]?.kind).to.equal("arrayType");
        expect(firstSurfaceParameterType.types[1]?.kind).to.equal(
          "referenceType"
        );
        expect(secondSurfaceParameterType.types).to.deep.equal([
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "undefined" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

  });
});
