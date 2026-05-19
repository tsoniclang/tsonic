import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import {
  IrExpressionStatement,
  IrFunctionDeclaration,
  IrVariableDeclaration,
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
    ].filter(
      (entry): entry is NonNullable<typeof entry> => entry !== undefined
    );

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
      ].filter(
        (entry): entry is NonNullable<typeof entry> => entry !== undefined
      );

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

  describe("external iterable overload resolution", () => {
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
            "interface IEnumerable_1<T> {",
            "  [Symbol.iterator](): IterableIterator<T>;",
            "}",
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

    it("prefers IEnumerable_1 overloads for inferred variables with inherited iterator evidence", () => {
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
            "interface IEnumerable_1<T> {",
            "  [Symbol.iterator](): IterableIterator<T>;",
            "}",
            "declare class Assert {",
            "  static Equal<T>(expected: IEnumerable_1<T>, actual: IEnumerable_1<T>): void;",
            "  static Equal<T>(expected: T, actual: T): void;",
            "}",
            "declare class IterableBase<T> {",
            "  [Symbol.iterator](): IterableIterator<T>;",
            "}",
            "declare class Bytes extends IterableBase<number> {}",
            "export function run(): void {",
            "  const left = new Bytes();",
            "  const right = new Bytes();",
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

        expect(call.parameterTypes?.[0]?.kind).to.equal("referenceType");
        expect(call.parameterTypes?.[1]?.kind).to.equal("referenceType");
        if (
          call.parameterTypes?.[0]?.kind !== "referenceType" ||
          call.parameterTypes?.[1]?.kind !== "referenceType"
        ) {
          return;
        }

        expect(call.parameterTypes[0].name).to.equal("IEnumerable_1");
        expect(call.parameterTypes[1].name).to.equal("IEnumerable_1");
        expect(call.parameterTypes[0].typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "number" },
        ]);
        expect(call.parameterTypes[1].typeArguments).to.deep.equal([
          { kind: "primitiveType", name: "number" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers imported nullable IEnumerable_1 overloads for inferred variables with inherited iterator evidence", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "declare const Symbol: {",
            "  readonly iterator: unique symbol;",
            "};",
            "interface Iterator<T> {}",
            "interface IterableIterator<T> extends Iterator<T> {",
            "  [Symbol.iterator](): IterableIterator<T>;",
            "}",
            "declare class IterableBase<T> {",
            "  [Symbol.iterator](): IterableIterator<T>;",
            "}",
            "declare class Bytes extends IterableBase<number> {}",
            "export function run(): void {",
            "  const left = new Bytes();",
            "  const right = new Bytes();",
            "  Assert.Equal(left, right);",
            "}",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js": "export {};",
          "node_modules/xunit-types/Xunit.d.ts": [
            'import type { IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            "",
            "export interface Assert$instance {}",
            "",
            "export declare const Assert: (abstract new() => Assert$instance) & {",
            "  Equal<T>(expected: IEnumerable_1<T> | null, actual: IEnumerable_1<T> | null): void;",
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
              "  [Symbol.iterator](): IterableIterator<T>;",
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

        const callStatement = findEqualCallStatement(runFn.body.statements);
        expect(callStatement).to.not.equal(undefined);
        if (!callStatement) return;

        const call = callStatement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        expect(call.parameterTypes?.[0]).to.deep.include({
          kind: "referenceType",
          name: "IEnumerable_1$instance",
        });
        expect(call.parameterTypes?.[1]).to.deep.include({
          kind: "referenceType",
          name: "IEnumerable_1$instance",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers metadata-backed imported iterable overloads without declaration iterator members", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { Uint8Array } from "@fixture/js/index.js";',
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "export function run(left: Uint8Array, right: Uint8Array): void {",
            "  Assert.Equal(left, right);",
            "}",
          ].join("\n"),
          "node_modules/@fixture/js/package.json": JSON.stringify({
            name: "@fixture/js",
            type: "module",
          }),
          "node_modules/@fixture/js/index.js": "export {};",
          "node_modules/@fixture/js/index.d.ts": [
            "declare const Symbol: { readonly iterator: unique symbol };",
            "interface Iterator<T> {}",
            "interface IterableIterator<T> extends Iterator<T> {",
            "  [Symbol.iterator](): IterableIterator<T>;",
            "}",
            "export declare class TypedArrayBase<TElement extends number> {",
            "  [Symbol.iterator](): IterableIterator<TElement>;",
            "}",
            "export declare class Uint8Array extends TypedArrayBase<number> {}",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js": "export {};",
          "node_modules/xunit-types/Xunit.d.ts": [
            'export { Assert } from "./Xunit/internal/index.js";',
          ].join("\n"),
          "node_modules/xunit-types/Xunit/internal/index.js": "export {};",
          "node_modules/xunit-types/Xunit/internal/index.d.ts": [
            'import type { IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            "",
            "export declare const Assert: {",
            "  Equal<T extends unknown>(expected: IEnumerable_1<T> | null, actual: IEnumerable_1<T> | null): void;",
            "  Equal<T extends unknown>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/bindings.json":
            JSON.stringify({
              namespace: "System.Collections.Generic",
              types: [
                {
                  stableId:
                    "System.Private.CoreLib:System.Collections.Generic.IEnumerable`1",
                  targetName: "System.Collections.Generic.IEnumerable`1",
                  kind: "Interface",
                  accessibility: "Public",
                  isAbstract: true,
                  isSealed: false,
                  isStatic: false,
                  arity: 1,
                  typeParameters: ["T"],
                  iterableShape: {
                    mode: "sync",
                    elementTypeParameterIndex: 0,
                  },
                  methods: [],
                  properties: [],
                  fields: [],
                  events: [],
                  constructors: [],
                },
              ],
            }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T extends unknown> {",
              "  readonly __tsonic_iface_provider_iterable_1: never;",
              "  GetEnumerator(): unknown;",
              "}",
              "export type IEnumerable_1<T extends unknown> = IEnumerable_1$instance<T>;",
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

        const statement = findEqualCallStatement(runFn.body.statements);
        expect(statement).to.not.equal(undefined);
        if (!statement) return;

        const call = statement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        const firstParameterType = call.parameterTypes?.[0];
        const secondParameterType = call.parameterTypes?.[1];

        expect(firstParameterType).to.deep.include({
          kind: "referenceType",
          name: "IEnumerable_1$instance",
        });
        expect(secondParameterType).to.deep.include({
          kind: "referenceType",
          name: "IEnumerable_1$instance",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers metadata-backed imported iterable overloads for imported source-package iterator classes", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
            dependencies: {
              "@fixture/js": "file:node_modules/@fixture/js",
            },
          }),
          "src/index.ts": [
            'import { Uint8Array } from "@fixture/js/index.js";',
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "export function run(left: Uint8Array, right: Uint8Array): void {",
            "  Assert.Equal(left, right);",
            "}",
          ].join("\n"),
          "node_modules/@fixture/js/package.json": JSON.stringify({
            name: "@fixture/js",
            type: "module",
          }),
          "node_modules/@fixture/js/index.ts": [
            'export { Uint8Array } from "./src/uint8-array.js";',
          ].join("\n"),
          "node_modules/@fixture/js/src/typed-array-core.ts": [
            "export class TypedArrayBase<TElement extends number> {",
            "  *values(): Generator<TElement, undefined, undefined> {",
            "    throw new Error('test fixture');",
            "  }",
            "  [Symbol.iterator](): Generator<TElement, undefined, undefined> {",
            "    return this.values();",
            "  }",
            "}",
          ].join("\n"),
          "node_modules/@fixture/js/src/uint8-array.ts": [
            'import { TypedArrayBase } from "./typed-array-core.js";',
            "export class Uint8Array extends TypedArrayBase<number> {",
            "  toByteArrayRaw(): number[] {",
            "    throw new Error('test fixture');",
            "  }",
            "}",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js": "export {};",
          "node_modules/xunit-types/Xunit.d.ts": [
            'export { Assert } from "./Xunit/internal/index.js";',
          ].join("\n"),
          "node_modules/xunit-types/Xunit/internal/index.js": "export {};",
          "node_modules/xunit-types/Xunit/internal/index.d.ts": [
            'import type { IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            "",
            "export declare const Assert: {",
            "  Equal<T extends unknown>(expected: IEnumerable_1<T> | null, actual: IEnumerable_1<T> | null): void;",
            "  Equal<T extends unknown>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/bindings.json":
            JSON.stringify({
              namespace: "System.Collections.Generic",
              types: [
                {
                  stableId:
                    "System.Private.CoreLib:System.Collections.Generic.IEnumerable`1",
                  targetName: "System.Collections.Generic.IEnumerable`1",
                  kind: "Interface",
                  accessibility: "Public",
                  isAbstract: true,
                  isSealed: false,
                  isStatic: false,
                  arity: 1,
                  typeParameters: ["T"],
                  iterableShape: {
                    mode: "sync",
                    elementTypeParameterIndex: 0,
                  },
                  methods: [],
                  properties: [],
                  fields: [],
                  events: [],
                  constructors: [],
                },
              ],
            }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T extends unknown> {",
              "  readonly __tsonic_iface_provider_iterable_1: never;",
              "  GetEnumerator(): unknown;",
              "}",
              "export type IEnumerable_1<T extends unknown> = IEnumerable_1$instance<T>;",
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

        const statement = findEqualCallStatement(runFn.body.statements);
        expect(statement).to.not.equal(undefined);
        if (!statement) return;

        const call = statement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        const firstParameterType = call.parameterTypes?.[0];
        const secondParameterType = call.parameterTypes?.[1];

        expect(firstParameterType).to.deep.include({
          kind: "referenceType",
          name: "IEnumerable_1$instance",
        });
        expect(secondParameterType).to.deep.include({
          kind: "referenceType",
          name: "IEnumerable_1$instance",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("prefers sync metadata-backed iterable overloads across mixed generated external overload families", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
            dependencies: {
              "@fixture/js": "file:node_modules/@fixture/js",
            },
          }),
          "src/index.ts": [
            'import { Uint8Array } from "@fixture/js/index.js";',
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "export function run(left: Uint8Array, right: Uint8Array): void {",
            "  Assert.Equal(left, right);",
            "}",
          ].join("\n"),
          "node_modules/@fixture/js/package.json": JSON.stringify({
            name: "@fixture/js",
            type: "module",
          }),
          "node_modules/@fixture/js/index.ts": [
            'export { Uint8Array } from "./src/uint8-array.js";',
          ].join("\n"),
          "node_modules/@fixture/js/src/typed-array-core.ts": [
            "export class TypedArrayBase<TElement extends number> {",
            "  *values(): Generator<TElement, undefined, undefined> {",
            "    throw new Error('test fixture');",
            "  }",
            "  [Symbol.iterator](): Generator<TElement, undefined, undefined> {",
            "    return this.values();",
            "  }",
            "}",
          ].join("\n"),
          "node_modules/@fixture/js/src/uint8-array.ts": [
            'import { TypedArrayBase } from "./typed-array-core.js";',
            "export class Uint8Array extends TypedArrayBase<number> {",
            "  toByteArrayRaw(): number[] {",
            "    throw new Error('test fixture');",
            "  }",
            "}",
          ].join("\n"),
          "node_modules/xunit-types/package.json": JSON.stringify({
            name: "xunit-types",
            type: "module",
          }),
          "node_modules/xunit-types/Xunit.js": "export {};",
          "node_modules/xunit-types/Xunit.d.ts": [
            'export { Assert } from "./Xunit/internal/index.js";',
          ].join("\n"),
          "node_modules/xunit-types/Xunit/internal/index.js": "export {};",
          "node_modules/xunit-types/Xunit/internal/index.d.ts": [
            'import type { IAsyncEnumerable_1, IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            "",
            "interface IEquatable_1<T extends unknown> {}",
            "",
            "export declare const Assert: {",
            "  Equal<T extends unknown>(expected: IAsyncEnumerable_1<T> | null, actual: IAsyncEnumerable_1<T> | null): void;",
            "  Equal<T extends unknown>(expected: IEnumerable_1<T> | null, actual: IAsyncEnumerable_1<T> | null): void;",
            "  Equal<T extends unknown>(expected: IEnumerable_1<T> | null, actual: IEnumerable_1<T> | null): void;",
            "  Equal<T extends unknown>(expected: T, actual: T): void;",
            "  Equal<T extends NonNullable<unknown> & IEquatable_1<T>>(expected: T[], actual: T[]): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
            name: "@tsonic/dotnet",
            type: "module",
          }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/bindings.json":
            JSON.stringify({
              namespace: "System.Collections.Generic",
              types: [
                {
                  stableId:
                    "System.Private.CoreLib:System.Collections.Generic.IEnumerable`1",
                  targetName: "System.Collections.Generic.IEnumerable`1",
                  kind: "Interface",
                  accessibility: "Public",
                  isAbstract: true,
                  isSealed: false,
                  isStatic: false,
                  arity: 1,
                  typeParameters: ["T"],
                  iterableShape: {
                    mode: "sync",
                    elementTypeParameterIndex: 0,
                  },
                  methods: [],
                  properties: [],
                  fields: [],
                  events: [],
                  constructors: [],
                },
                {
                  stableId:
                    "System.Private.CoreLib:System.Collections.Generic.IAsyncEnumerable`1",
                  targetName: "System.Collections.Generic.IAsyncEnumerable`1",
                  kind: "Interface",
                  accessibility: "Public",
                  isAbstract: true,
                  isSealed: false,
                  isStatic: false,
                  arity: 1,
                  typeParameters: ["T"],
                  iterableShape: {
                    mode: "async",
                    elementTypeParameterIndex: 0,
                  },
                  methods: [],
                  properties: [],
                  fields: [],
                  events: [],
                  constructors: [],
                },
              ],
            }),
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
            "export {};",
          "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
            [
              "export interface IEnumerable_1$instance<T extends unknown> {",
              "  readonly __tsonic_iface_provider_iterable_1: never;",
              "}",
              "export type IEnumerable_1<T extends unknown> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T extends unknown> {",
              "  readonly __tsonic_iface_provider_async_iterable_1: never;",
              "}",
              "export type IAsyncEnumerable_1<T extends unknown> = IAsyncEnumerable_1$instance<T>;",
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

        const statement = findEqualCallStatement(runFn.body.statements);
        expect(statement).to.not.equal(undefined);
        if (!statement) return;

        const call = statement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        const firstParameterType = call.parameterTypes?.[0];
        const secondParameterType = call.parameterTypes?.[1];

        expect(firstParameterType).to.deep.include({
          kind: "referenceType",
          name: "IEnumerable_1$instance",
        });
        expect(secondParameterType).to.deep.include({
          kind: "referenceType",
          name: "IEnumerable_1$instance",
        });
      } finally {
        fixture.cleanup();
      }
    });

    it("keeps array literals on array overloads when sibling source-package iterable overloads exist", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
            dependencies: {
              "@fixture/js": "file:node_modules/@fixture/js",
            },
          }),
          "src/index.ts": [
            'import { Buffer } from "@fixture/js/index.js";',
            "",
            "export function run(): void {",
            "  Buffer.from([1, 2, 3]);",
            "}",
          ].join("\n"),
          "node_modules/@fixture/js/package.json": JSON.stringify({
            name: "@fixture/js",
            type: "module",
          }),
          "node_modules/@fixture/js/index.ts": [
            'export { Buffer } from "./src/buffer.js";',
            'export { Uint8Array } from "./src/uint8-array.js";',
          ].join("\n"),
          "node_modules/@fixture/js/src/typed-array-core.ts": [
            "export class TypedArrayBase<TElement extends number> {",
            "  *values(): Generator<TElement, undefined, undefined> {",
            "    throw new Error('test fixture');",
            "  }",
            "  [Symbol.iterator](): Generator<TElement, undefined, undefined> {",
            "    return this.values();",
            "  }",
            "}",
          ].join("\n"),
          "node_modules/@fixture/js/src/uint8-array.ts": [
            'import { TypedArrayBase } from "./typed-array-core.js";',
            "export class Uint8Array extends TypedArrayBase<number> {}",
          ].join("\n"),
          "node_modules/@fixture/js/src/buffer.ts": [
            'import { Uint8Array } from "./uint8-array.js";',
            "export class Buffer {",
            "  static from(value: string): Buffer;",
            "  static from(value: number[]): Buffer;",
            "  static from(value: Uint8Array): Buffer;",
            "  static from(_value: unknown): Buffer {",
            "    throw new Error('test fixture');",
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

        const runFn = result.value.body.find(
          (stmt): stmt is IrFunctionDeclaration =>
            stmt.kind === "functionDeclaration" && stmt.name === "run"
        );
        expect(runFn).to.not.equal(undefined);
        if (!runFn) return;

        const statement = runFn.body.statements[0];
        expect(statement?.kind).to.equal("expressionStatement");
        if (!statement || statement.kind !== "expressionStatement") return;

        const call = statement.expression;
        expect(call.kind).to.equal("call");
        if (call.kind !== "call") return;

        const firstParameterType = call.parameterTypes?.[0];
        expect(firstParameterType?.kind).to.equal("arrayType");
        if (firstParameterType?.kind !== "arrayType") return;

        expect(firstParameterType.elementType).to.deep.equal({
          kind: "primitiveType",
          name: "number",
        });
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
            "interface IEnumerable_1$instance<T> {",
            "  [Symbol.iterator](): IterableIterator<T>;",
            "}",
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
            'import type { IEnumerable } from "@tsonic/dotnet/System.Collections.Generic.js";',
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
              "  [Symbol.iterator](): IterableIterator<T>;",
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
            "  static once(emitter: EventEmitter, eventName: string): Promise<string[]>;",
            "  emit(eventName: string, ...args: string[]): boolean;",
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
              "  [Symbol.iterator](): IterableIterator<T>;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
              "  [Symbol.asyncIterator](): AsyncIterableIterator<T>;",
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
              "  [Symbol.iterator](): IterableIterator<T>;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
              "  [Symbol.asyncIterator](): AsyncIterableIterator<T>;",
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
            "  static once(emitter: EventEmitter, eventName: string): Promise<string[]>;",
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
              "  [Symbol.iterator](): IterableIterator<T>;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
              "  [Symbol.asyncIterator](): AsyncIterableIterator<T>;",
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

    it("keeps class-value static overloads separate from same-named instance overloads", () => {
      const fixture = createFilesystemTestProgram(
        {
          "src/index.ts": [
            "declare class EventEmitter {",
            "  static once(emitter: EventEmitter, eventName: string): Promise<string[]>;",
            "  once(eventName: string, listener: (...args: string[]) => void): EventEmitter;",
            "}",
            "",
            "export async function run(emitter: EventEmitter): Promise<void> {",
            '  const task = EventEmitter.once(emitter, "test");',
            "  const args = await task;",
            "  args[0];",
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

        const taskDecl = runFn.body.statements.find(
          (stmt): stmt is IrVariableDeclaration =>
            stmt.kind === "variableDeclaration" &&
            stmt.declarations[0]?.name.kind === "identifierPattern" &&
            stmt.declarations[0].name.name === "task"
        );
        expect(taskDecl).to.not.equal(undefined);
        const taskInitializer = taskDecl?.declarations[0]?.initializer;
        expect(taskInitializer?.kind).to.equal("call");
        if (!taskInitializer || taskInitializer.kind !== "call") return;

        const taskType = taskInitializer.inferredType;
        expect(taskType).to.deep.include({
          kind: "referenceType",
          name: "Promise",
        });
        expect(taskType?.kind).to.equal("referenceType");
        if (taskType?.kind !== "referenceType") return;
        const promisedType = taskType.typeArguments?.[0];
        expect(promisedType?.kind).to.equal("arrayType");
        if (promisedType?.kind !== "arrayType") return;
        expect(promisedType.elementType).to.deep.equal({
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
            "  static once(emitter: EventEmitter, eventName: string): Promise<string[]>;",
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
              "  [Symbol.iterator](): IterableIterator<T>;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
              "  [Symbol.asyncIterator](): AsyncIterableIterator<T>;",
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
              "  [Symbol.iterator](): IterableIterator<T>;",
              "}",
              "export type IEnumerable_1<T> = IEnumerable_1$instance<T>;",
              "export interface IAsyncEnumerable_1$instance<T> {",
              "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
              "  [Symbol.asyncIterator](): AsyncIterableIterator<T>;",
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
          { kind: "primitiveType", name: "int" },
          { kind: "primitiveType", name: "int" },
        ]);
      } finally {
        fixture.cleanup();
      }
    });

    it("widens numeric generic equality inference over Memory<char> siblings", () => {
      const fixture = createFilesystemTestProgram(
        {
          "package.json": JSON.stringify({
            name: "test-app",
            type: "module",
          }),
          "src/index.ts": [
            'import { Assert } from "xunit-types/Xunit.js";',
            "",
            "declare class Holder {",
            "  timeout: number;",
            "}",
            "",
            "export function run(holder: Holder): void {",
            "  Assert.Equal(1000, holder.timeout);",
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
            'import type { char } from "@tsonic/core/types.js";',
            'import type { IEnumerable_1 } from "@tsonic/dotnet/System.Collections.Generic/internal/index.js";',
            'import type { Memory_1, ReadOnlyMemory_1 } from "@tsonic/dotnet/System/internal/index.js";',
            "",
            "export interface Assert$instance {}",
            "",
            "export declare const Assert: (abstract new() => Assert$instance) & {",
            "  Equal<T>(expected: IEnumerable_1<T>, actual: IEnumerable_1<T>): void;",
            "  Equal(expected: Memory_1<char>, actual: Memory_1<char>): void;",
            "  Equal(expected: ReadOnlyMemory_1<char>, actual: ReadOnlyMemory_1<char>): void;",
            "  Equal(expected: string, actual: string): void;",
            "  Equal<T>(expected: T, actual: T): void;",
            "};",
          ].join("\n"),
          "node_modules/@tsonic/core/package.json": JSON.stringify({
            name: "@tsonic/core",
            type: "module",
          }),
          "node_modules/@tsonic/core/types.js": "export {};",
          "node_modules/@tsonic/core/types.d.ts": [
            "export type char = string;",
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
              "  [Symbol.iterator](): IterableIterator<T>;",
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
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "number" },
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
              "  [Symbol.iterator](): IterableIterator<T>;",
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
                  ? ((
                      candidate.body as {
                        readonly statements?: readonly unknown[];
                      }
                    ).statements ?? [])
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
        if (firstSurfaceParameterType.types[0]?.kind !== "arrayType") {
          return;
        }
        expect(firstSurfaceParameterType.types[0].elementType).to.deep.include({
          name: "byte",
        });
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
