import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildModuleDependencyGraph } from "./dependency-graph.js";
import type { IrExpressionStatement, IrFunctionDeclaration, IrModule } from "../ir/types.js";

const installMinimalJsSurface = (projectRoot: string): void => {
  const jsRoot = path.join(projectRoot, "node_modules", "@tsonic", "js");
  fs.mkdirSync(jsRoot, { recursive: true });
  fs.writeFileSync(
    path.join(jsRoot, "package.json"),
    JSON.stringify(
      { name: "@tsonic/js", version: "1.0.0", type: "module" },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(jsRoot, "tsonic.surface.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "@tsonic/js",
        extends: [],
        requiredTypeRoots: [],
        useStandardLib: true,
      },
      null,
      2
    )
  );
};

const normalizeSlashes = (value: string): string => value.replace(/\\/g, "/");

const findModuleByFilePath = (
  modules: readonly IrModule[],
  filePath: string
): IrModule | undefined =>
  modules.find(
    (module) => normalizeSlashes(module.filePath) === normalizeSlashes(filePath)
  );

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

const writeTestFixture = (
  tempDir: string,
  files: Record<string, string>
): void => {
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(tempDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }
};

describe("Dependency Graph", function () {
  this.timeout(60_000);

  it("keeps scalar xunit equality overloads in the full dependency graph when later arguments are unknown", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-xunit-equal-event-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      installMinimalJsSurface(tempDir);
      writeTestFixture(tempDir, {
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
        "node_modules/@tsonic/core/package.json": JSON.stringify({
          name: "@tsonic/core",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/core/types.js": "export {};",
        "node_modules/@tsonic/core/types.d.ts": [
          "export type char = string;",
        ].join("\n"),
        "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
          name: "@tsonic/dotnet",
          version: "1.0.0",
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
        "node_modules/xunit-types/package.json": JSON.stringify({
          name: "xunit-types",
          version: "1.0.0",
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
      });

      const entryPath = path.join(tempDir, "src", "index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = findModuleByFilePath(result.value.modules, "index.ts");
      expect(module).to.not.equal(undefined);
      if (!module) return;

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
      expect(call.surfaceParameterTypes).to.deep.equal([
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "string" },
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps string equality overloads in the full dependency graph when char aliases flow into string surfaces", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-xunit-equal-path-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      installMinimalJsSurface(tempDir);
      writeTestFixture(tempDir, {
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
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/core/types.js": "export {};",
        "node_modules/@tsonic/core/types.d.ts": [
          "export type char = string;",
        ].join("\n"),
        "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
          name: "@tsonic/dotnet",
          version: "1.0.0",
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
        "node_modules/xunit-types/package.json": JSON.stringify({
          name: "xunit-types",
          version: "1.0.0",
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
      });

      const entryPath = path.join(tempDir, "src", "index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = findModuleByFilePath(result.value.modules, "index.ts");
      expect(module).to.not.equal(undefined);
      if (!module) return;

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
      expect(call.surfaceParameterTypes).to.deep.equal([
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "string" },
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps scalar xunit class overloads through facade re-exports when later arguments are unknown", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-xunit-equal-class-event-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      installMinimalJsSurface(tempDir);
      writeTestFixture(tempDir, {
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
        "node_modules/@tsonic/core/package.json": JSON.stringify({
          name: "@tsonic/core",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/core/types.js": "export {};",
        "node_modules/@tsonic/core/types.d.ts": "export type char = string;",
        "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
          name: "@tsonic/dotnet",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/dotnet/System.Collections.Generic.js": "export {};",
        "node_modules/@tsonic/dotnet/System.Collections.Generic.d.ts": [
          'import type * as Internal from "./System.Collections.Generic/internal/index.js";',
          "export type IEnumerable<T> = Internal.IEnumerable_1$instance<T>;",
          "export type IAsyncEnumerable<T> = Internal.IAsyncEnumerable_1$instance<T>;",
        ].join("\n"),
        "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
          "export {};",
        "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
          [
            "export interface IEnumerable_1$instance<T> {",
            "  readonly __tsonic_iface_System_Collections_Generic_IEnumerable_1: never;",
            "}",
            "export interface IAsyncEnumerable_1$instance<T> {",
            "  readonly __tsonic_iface_System_Collections_Generic_IAsyncEnumerable_1: never;",
            "}",
          ].join("\n"),
        "node_modules/@tsonic/dotnet/System.js": "export {};",
        "node_modules/@tsonic/dotnet/System.d.ts": [
          'import type * as Internal from "./System/internal/index.js";',
          "export type IEquatable<T> = Internal.IEquatable_1$instance<T>;",
          "export type Memory<T> = Internal.Memory_1$instance<T>;",
          "export type ReadOnlyMemory<T> = Internal.ReadOnlyMemory_1$instance<T>;",
          "export type ReadOnlySpan<T> = Internal.ReadOnlySpan_1$instance<T>;",
          "export type Span<T> = Internal.Span_1$instance<T>;",
          "export type Char = string;",
        ].join("\n"),
        "node_modules/@tsonic/dotnet/System/internal/index.js": "export {};",
        "node_modules/@tsonic/dotnet/System/internal/index.d.ts": [
          "export interface IEquatable_1$instance<T> {",
          "  readonly __tsonic_iface_System_IEquatable_1: never;",
          "}",
          "export interface Memory_1$instance<T> {",
          "  readonly __tsonic_iface_System_Memory_1: never;",
          "}",
          "export interface ReadOnlyMemory_1$instance<T> {",
          "  readonly __tsonic_iface_System_ReadOnlyMemory_1: never;",
          "}",
          "export interface ReadOnlySpan_1$instance<T> {",
          "  readonly __tsonic_iface_System_ReadOnlySpan_1: never;",
          "}",
          "export interface Span_1$instance<T> {",
          "  readonly __tsonic_iface_System_Span_1: never;",
          "}",
        ].join("\n"),
        "node_modules/xunit-types/package.json": JSON.stringify({
          name: "xunit-types",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/xunit-types/Xunit.js":
          'export { Assert } from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit.d.ts": [
          'export { Assert } from "./Xunit/internal/index.js";',
        ].join("\n"),
        "node_modules/xunit-types/Xunit/internal/index.js": "export {};",
        "node_modules/xunit-types/Xunit/internal/index.d.ts": [
          'import type { IAsyncEnumerable, IEnumerable as IEnumerable__System_Collections_Generic } from "@tsonic/dotnet/System.Collections.Generic.js";',
          'import type { Char, IEquatable, Memory, ReadOnlyMemory, ReadOnlySpan, Span } from "@tsonic/dotnet/System.js";',
          "",
          "export declare class Assert {",
          "  static Equal<T>(expected: IAsyncEnumerable<T>, actual: IAsyncEnumerable<T>): void;",
          "  static Equal<T>(expected: IEnumerable__System_Collections_Generic<T>, actual: IAsyncEnumerable<T>): void;",
          "  static Equal<T>(expected: IEnumerable__System_Collections_Generic<T>, actual: IEnumerable__System_Collections_Generic<T>): void;",
          "  static Equal<T extends IEquatable<T>>(expectedMemory: Memory<T>, actualMemory: Memory<T>): void;",
          "  static Equal<T extends IEquatable<T>>(expectedMemory: ReadOnlyMemory<T>, actualMemory: ReadOnlyMemory<T>): void;",
          "  static Equal(expected: Memory<Char>, actual: Memory<Char>, ignoreCase?: boolean, ignoreLineEndingDifferences?: boolean, ignoreWhiteSpaceDifferences?: boolean, ignoreAllWhiteSpace?: boolean): void;",
          "  static Equal(expected: ReadOnlyMemory<Char>, actual: ReadOnlyMemory<Char>): void;",
          "  static Equal(expected: ReadOnlySpan<Char>, actual: ReadOnlySpan<Char>): void;",
          "  static Equal(expected: Span<Char>, actual: Span<Char>): void;",
          "  static Equal(expected: string, actual: string, ignoreCase?: boolean, ignoreLineEndingDifferences?: boolean, ignoreWhiteSpaceDifferences?: boolean, ignoreAllWhiteSpace?: boolean): void;",
          "  static Equal(expected: string, actual: string): void;",
          "  static Equal<T>(expected: T, actual: T): void;",
          "}",
        ].join("\n"),
      });

      const entryPath = path.join(tempDir, "src", "index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = findModuleByFilePath(result.value.modules, "index.ts");
      expect(module).to.not.equal(undefined);
      if (!module) return;

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
      expect(call.surfaceParameterTypes).to.deep.equal([
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "string" },
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps generic numeric equality when later arguments are unknown over real xunit overloads", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-xunit-equal-numeric-unknown-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      installMinimalJsSurface(tempDir);
      writeTestFixture(tempDir, {
        "src/index.ts": [
          'import { Assert } from "xunit-types/Xunit.js";',
          "",
          "export function run(received: unknown): void {",
          "  Assert.Equal(42, received);",
          "}",
        ].join("\n"),
        "node_modules/@tsonic/core/package.json": JSON.stringify({
          name: "@tsonic/core",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/core/types.js": "export {};",
        "node_modules/@tsonic/core/types.d.ts": [
          "export type double = number;",
        ].join("\n"),
        "node_modules/xunit-types/package.json": JSON.stringify({
          name: "xunit-types",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/xunit-types/Xunit.js":
          'export { Assert } from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit.d.ts": [
          'export { Assert } from "./Xunit/internal/index.js";',
        ].join("\n"),
        "node_modules/xunit-types/Xunit/internal/index.js": "export {};",
        "node_modules/xunit-types/Xunit/internal/index.d.ts": [
          'import type { double } from "@tsonic/core/types.js";',
          "",
          "export declare class Assert {",
          "  static Equal(expected: double, actual: double): void;",
          "  static Equal(expected: string, actual: string): void;",
          "  static Equal<T>(expected: T, actual: T): void;",
          "}",
        ].join("\n"),
      });

      const entryPath = path.join(tempDir, "src", "index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = findModuleByFilePath(result.value.modules, "index.ts");
      expect(module).to.not.equal(undefined);
      if (!module) return;

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
        { kind: "unknownType", explicit: true },
        { kind: "unknownType", explicit: true },
      ]);
      expect(call.surfaceParameterTypes).to.deep.equal([
        { kind: "unknownType", explicit: true },
        { kind: "unknownType", explicit: true },
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("preserves explicit unknown storage across callback writes for later xunit equality", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-xunit-equal-callback-unknown-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      installMinimalJsSurface(tempDir);
      writeTestFixture(tempDir, {
        "src/index.ts": [
          'import { Assert } from "xunit-types/Xunit.js";',
          "",
          "declare class EventEmitter {",
          "  on(eventName: string, listener: (value: unknown) => void): void;",
          "  emit(eventName: string, value: unknown): void;",
          "}",
          "",
          "export function run(emitter: EventEmitter): void {",
          "  let received: unknown = undefined;",
          '  emitter.on("test", (value) => {',
          "    received = value;",
          "  });",
          '  emitter.emit("test", 42);',
          "  Assert.Equal(42, received);",
          "}",
        ].join("\n"),
        "node_modules/@tsonic/core/package.json": JSON.stringify({
          name: "@tsonic/core",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/core/types.js": "export {};",
        "node_modules/@tsonic/core/types.d.ts": [
          "export type double = number;",
        ].join("\n"),
        "node_modules/xunit-types/package.json": JSON.stringify({
          name: "xunit-types",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/xunit-types/Xunit.js":
          'export { Assert } from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit.d.ts":
          'export { Assert } from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit/internal/index.js":
          "export const Assert = undefined;",
        "node_modules/xunit-types/Xunit/internal/index.d.ts": [
          'import type { double } from "@tsonic/core/types.js";',
          "",
          "export declare class Assert {",
          "  static Equal(expected: double, actual: double): void;",
          "  static Equal(expected: string, actual: string): void;",
          "  static Equal<T>(expected: T, actual: T): void;",
          "}",
        ].join("\n"),
      });

      const entryPath = path.join(tempDir, "src", "index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = findModuleByFilePath(result.value.modules, "index.ts");
      expect(module).to.not.equal(undefined);
      if (!module) return;

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
        { kind: "unknownType", explicit: true },
        { kind: "unknownType", explicit: true },
      ]);
      expect(call.surfaceParameterTypes).to.deep.equal([
        { kind: "unknownType", explicit: true },
        { kind: "unknownType", explicit: true },
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps string equality class overloads through facade re-exports when char aliases flow into string surfaces", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-xunit-equal-class-path-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      installMinimalJsSurface(tempDir);
      writeTestFixture(tempDir, {
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
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/core/types.js": "export {};",
        "node_modules/@tsonic/core/types.d.ts": "export type char = string;",
        "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
          name: "@tsonic/dotnet",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/dotnet/System.Collections.Generic.js": "export {};",
        "node_modules/@tsonic/dotnet/System.Collections.Generic.d.ts": [
          'import type * as Internal from "./System.Collections.Generic/internal/index.js";',
          "export type IEnumerable<T> = Internal.IEnumerable_1$instance<T>;",
        ].join("\n"),
        "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.js":
          "export {};",
        "node_modules/@tsonic/dotnet/System.Collections.Generic/internal/index.d.ts":
          [
            "export interface IEnumerable_1$instance<T> {",
            "  readonly __tsonic_iface_System_Collections_Generic_IEnumerable_1: never;",
            "}",
          ].join("\n"),
        "node_modules/@tsonic/dotnet/System.js": "export {};",
        "node_modules/@tsonic/dotnet/System.d.ts": [
          'import type * as Internal from "./System/internal/index.js";',
          "export type Memory<T> = Internal.Memory_1$instance<T>;",
          "export type ReadOnlyMemory<T> = Internal.ReadOnlyMemory_1$instance<T>;",
          "export type ReadOnlySpan<T> = Internal.ReadOnlySpan_1$instance<T>;",
          "export type Span<T> = Internal.Span_1$instance<T>;",
          "export type Char = string;",
        ].join("\n"),
        "node_modules/@tsonic/dotnet/System/internal/index.js": "export {};",
        "node_modules/@tsonic/dotnet/System/internal/index.d.ts": [
          "export interface Memory_1$instance<T> {",
          "  readonly __tsonic_iface_System_Memory_1: never;",
          "}",
          "export interface ReadOnlyMemory_1$instance<T> {",
          "  readonly __tsonic_iface_System_ReadOnlyMemory_1: never;",
          "}",
          "export interface ReadOnlySpan_1$instance<T> {",
          "  readonly __tsonic_iface_System_ReadOnlySpan_1: never;",
          "}",
          "export interface Span_1$instance<T> {",
          "  readonly __tsonic_iface_System_Span_1: never;",
          "}",
        ].join("\n"),
        "node_modules/@tsonic/dotnet/System.IO.js": "export {};",
        "node_modules/@tsonic/dotnet/System.IO.d.ts": [
          'import type { Char } from "@tsonic/dotnet/System.js";',
          "",
          "export declare const Path: {",
          "  readonly DirectorySeparatorChar: Char;",
          "};",
        ].join("\n"),
        "node_modules/xunit-types/package.json": JSON.stringify({
          name: "xunit-types",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/xunit-types/Xunit.js":
          'export { Assert } from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit.d.ts": [
          'export { Assert } from "./Xunit/internal/index.js";',
        ].join("\n"),
        "node_modules/xunit-types/Xunit/internal/index.js": "export {};",
        "node_modules/xunit-types/Xunit/internal/index.d.ts": [
          'import type { IEnumerable as IEnumerable__System_Collections_Generic } from "@tsonic/dotnet/System.Collections.Generic.js";',
          'import type { Char, Memory, ReadOnlyMemory, ReadOnlySpan, Span } from "@tsonic/dotnet/System.js";',
          "",
          "export declare class Assert {",
          "  static Equal<T>(expected: IEnumerable__System_Collections_Generic<T>, actual: IEnumerable__System_Collections_Generic<T>): void;",
          "  static Equal(expected: Memory<Char>, actual: Memory<Char>): void;",
          "  static Equal(expected: ReadOnlyMemory<Char>, actual: ReadOnlyMemory<Char>): void;",
          "  static Equal(expected: ReadOnlySpan<Char>, actual: ReadOnlySpan<Char>): void;",
          "  static Equal(expected: Span<Char>, actual: Span<Char>): void;",
          "  static Equal(expected: string, actual: string): void;",
          "  static Equal<T>(expected: T, actual: T): void;",
          "}",
        ].join("\n"),
      });

      const entryPath = path.join(tempDir, "src", "index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = findModuleByFilePath(result.value.modules, "index.ts");
      expect(module).to.not.equal(undefined);
      if (!module) return;

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
      expect(call.surfaceParameterTypes).to.deep.equal([
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "string" },
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
