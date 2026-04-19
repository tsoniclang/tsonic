import { describe, it } from "mocha";
import { expect } from "chai";
import { compileProjectToCSharp, compileToCSharp } from "./helpers.js";

describe("Integration: CLR iterable overloads", () => {
  it("routes iterator-bearing class arguments through symbol iterators for CLR IEnumerable overloads", () => {
    const csharp = compileToCSharp(`
      import type { IEnumerable } from "@tsonic/dotnet/System.Collections.Generic.js";

      declare const Symbol: {
        readonly iterator: unique symbol;
      };

      interface Iterator<T> {}

      interface IterableIterator<T> extends Iterator<T> {
        [Symbol.iterator](): IterableIterator<T>;
      }

      declare class Assert {
        static Equal<T>(expected: IEnumerable<T>, actual: IEnumerable<T>): void;
        static Equal<T>(expected: T, actual: T): void;
      }

      declare class Bytes {
        [Symbol.iterator](): IterableIterator<number>;
      }

      export function run(left: Bytes, right: Bytes): void {
        Assert.Equal(left, right);
      }
    `);

    expect(csharp).to.match(
      /Assert\.Equal\(left\.__tsonic_symbol_iterator\(\), right\.__tsonic_symbol_iterator\(\)\);/
    );
    expect(csharp).to.not.include("Assert.Equal(left, right);");
  });

  it("calls exact member overload wrappers after narrowing inside overload implementations", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";
      import { overloads as O } from "@tsonic/core/lang.js";

      class Socket {
        connect(port: int, host?: string, connectionListener?: () => void): void;
        connect(path: string, connectionListener?: () => void): void;
        connect(
          _portOrPath: any,
          _hostOrListener?: any,
          _connectionListener?: any
        ): any {
          throw new Error("stub");
        }
        connect_port(
          port: int,
          host?: string,
          connectionListener?: () => void
        ): void {}
        connect_path(
          path: string,
          connectionListener?: () => void
        ): void {}
      }

      O<Socket>().method(x => x.connect_port).family(x => x.connect);
      O<Socket>().method(x => x.connect_path).family(x => x.connect);

      export function open(
        portOrPath: int | string,
        hostOrListener?: string | (() => void),
        connectionListener?: () => void
      ): Socket {
        const socket = new Socket();
        if (typeof portOrPath === "string") {
          const listener =
            typeof hostOrListener === "function" ? hostOrListener : undefined;
          socket.connect(portOrPath, listener);
          return socket;
        }
        return socket;
      }
    `);

    expect(csharp).to.include("socket.connect((portOrPath.As2()), listener);");
    expect(csharp).to.not.include(
      "socket.connect((string)(portOrPath.As2()), global::Tsonic.Internal.Union<global::System.Action, string>.From1(listener));"
    );
  });

  it("adapts surface-backed typed arrays into iterable overload carriers", () => {
    const csharp = compileProjectToCSharp(
      {
        "package.json": JSON.stringify(
          { name: "emitter-test-project", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "src/index.ts": [
          "export function run(buffer: Uint8Array, length: number): Uint8Array {",
          "  const result = new Uint8Array(length);",
          "  result.set(buffer, length - buffer.length);",
          "  return result;",
          "}",
        ].join("\n"),
        "node_modules/@fixture/js/package.json": JSON.stringify(
          { name: "@fixture/js", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/@fixture/js/tsonic.surface.json": JSON.stringify(
          {
            schemaVersion: 1,
            id: "@fixture/js",
            extends: ["@tsonic/js"],
            requiredTypeRoots: ["."],
          },
          null,
          2
        ),
        "node_modules/@fixture/js/globals.ts": [
          "declare global {",
          '  const Uint8Array: typeof import("./src/uint8-array.js").Uint8Array;',
          "}",
          "",
          "export {};",
        ].join("\n"),
        "node_modules/@fixture/js/tsonic.package.json": JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@fixture/js"],
            source: {
              namespace: "fixture.js",
              ambient: ["./globals.ts"],
              exports: {
                "./typed-array-core.js": "./src/typed-array-core.ts",
                "./uint8-array.js": "./src/uint8-array.ts",
              },
            },
          },
          null,
          2
        ),
        "node_modules/@fixture/js/src/typed-array-core.ts": [
          'import { overloads as O } from "@tsonic/core/lang.js";',
          "",
          "export type TypedArrayInput<TElement extends number> =",
          "  | TElement[]",
          "  | Iterable<number>;",
          "",
          "export class TypedArrayBase<",
          "  TElement extends number,",
          "  TSelf extends TypedArrayBase<TElement, TSelf>,",
          "> {",
          "  public length: number = 0;",
          "  public constructor() {}",
          "  public set(index: number, value: number): void;",
          "  public set(source: TypedArrayInput<TElement>, offset?: number): void;",
          "  public set(_sourceOrIndex: any, _offsetOrValue: any = 0): any {",
          '    throw new Error("stub");',
          "  }",
          "  public set_index(index: number, value: number): void {",
          "    void index;",
          "    void value;",
          "  }",
          "  public set_source(",
          "    source: TypedArrayInput<TElement>,",
          "    offset?: number",
          "  ): void {",
          "    void source;",
          "    void offset;",
          "  }",
          "  public *[Symbol.iterator](): Generator<TElement, undefined, undefined> {",
          "    return undefined as never;",
          "  }",
          "}",
          "",
          "O<InstanceType<typeof TypedArrayBase>>().method(x => x.set_index).family(x => x.set);",
          "O<InstanceType<typeof TypedArrayBase>>().method(x => x.set_source).family(x => x.set);",
        ].join("\n"),
        "node_modules/@fixture/js/src/uint8-array.ts": [
          'import { TypedArrayBase } from "./typed-array-core.js";',
          "",
          "export class Uint8Array extends TypedArrayBase<number, Uint8Array> {",
          "  public constructor() {",
          "    super();",
          "  }",
          "}",
        ].join("\n"),
      },
      "src/index.ts",
      { surface: "@fixture/js" }
    );

    expect(csharp).to.include("result.set(");
    expect(csharp).to.include("buffer.__tsonic_symbol_iterator()");
    expect(csharp).to.not.include(
      "result.set(buffer, length - buffer.length);"
    );
    expect(csharp).to.not.include("result.set(global::Tsonic.Internal.Union");
  });

  it("keeps scalar equality overloads for JsValue event payload assertions", () => {
    const csharp = compileProjectToCSharp(
      {
        "package.json": JSON.stringify(
          { name: "emitter-test-project", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/xunit-types/package.json": JSON.stringify(
          { name: "xunit-types", version: "1.0.0", type: "module" },
          null,
          2
        ),
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
        "node_modules/@tsonic/dotnet/package.json": JSON.stringify(
          { name: "@tsonic/dotnet", version: "1.0.0", type: "module" },
          null,
          2
        ),
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
        "src/index.ts": [
          'import { Assert } from "xunit-types/Xunit.js";',
          "",
          "declare class EventEmitter {",
          "  static once(emitter: EventEmitter, eventName: string): Promise<JsValue[]>;",
          "}",
          "export async function run(): Promise<void> {",
          '  const task = EventEmitter.once(new EventEmitter(), "test");',
          "  const args = await task;",
          '  Assert.Equal("arg1", args[0]);',
          "}",
        ].join("\n"),
      },
      "src/index.ts"
    );

    const assertLine = csharp
      .split("\n")
      .find((line) => line.includes('Assert.Equal("arg1", '));

    expect(assertLine).to.not.equal(undefined);
    expect(assertLine).to.not.include("IAsyncEnumerable");
    expect(assertLine).to.not.include("IEnumerable");
  });

  it("boxes numeric literals for JsValue equality assertions over real xunit overloads", () => {
    const csharp = compileProjectToCSharp(
      {
        "package.json": JSON.stringify(
          { name: "emitter-test-project", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/xunit-types/package.json": JSON.stringify(
          { name: "xunit-types", version: "1.0.0", type: "module" },
          null,
          2
        ),
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
        "src/index.ts": [
          'import { Assert } from "xunit-types/Xunit.js";',
          "",
          "export function run(received: JsValue): void {",
          "  Assert.Equal(42, received);",
          "}",
        ].join("\n"),
      },
      "src/index.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("Assert.Equal((object)(double)42, received);");
    expect(csharp).to.not.include("Assert.Equal(42, received);");
  });

  it("boxes numeric literals for optional broad-object equality assertions over real xunit overloads", () => {
    const csharp = compileProjectToCSharp(
      {
        "package.json": JSON.stringify(
          { name: "emitter-test-project", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/@tsonic/core/package.json": JSON.stringify(
          { name: "@tsonic/core", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/@tsonic/core/types.js": "export {};",
        "node_modules/@tsonic/core/types.d.ts":
          "export type JsValue = object | string | number | boolean | bigint | symbol | null;",
        "node_modules/xunit-types/package.json": JSON.stringify(
          { name: "xunit-types", version: "1.0.0", type: "module" },
          null,
          2
        ),
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
        "src/index.ts": [
          'import { Assert } from "xunit-types/Xunit.js";',
          'import type { JsValue } from "@tsonic/core/types.js";',
          "",
          "export function run(): void {",
          "  let received: JsValue | undefined = undefined;",
          "  Assert.Equal(42, received);",
          "}",
        ].join("\n"),
      },
      "src/index.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("Assert.Equal((object)(double)42, received);");
    expect(csharp).to.not.include("Assert.Equal(42, received);");
  });

  it("widens generic equality to object over Memory<char> siblings for JsValue array elements", () => {
    const csharp = compileProjectToCSharp(
      {
        "package.json": JSON.stringify(
          { name: "emitter-test-project", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/xunit-types/package.json": JSON.stringify(
          { name: "xunit-types", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/xunit-types/Xunit.js":
          'export { Assert } from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit.d.ts":
          'export { Assert } from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit/internal/index.js":
          "export const Assert = undefined;",
        "node_modules/xunit-types/Xunit/internal/index.d.ts": [
          'import type { char } from "@tsonic/core/types.js";',
          'import type { Memory_1 } from "@tsonic/dotnet/System/internal/index.js";',
          "",
          "export declare class Assert {",
          "  static Equal(expected: Memory_1<char>, actual: Memory_1<char>): void;",
          "  static Equal(expected: string, actual: string): void;",
          "  static Equal<T>(expected: T, actual: T): void;",
          "}",
        ].join("\n"),
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
        "node_modules/@tsonic/core/package.json": JSON.stringify(
          { name: "@tsonic/core", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/@tsonic/core/types.js": "export {};",
        "node_modules/@tsonic/core/types.d.ts": [
          "export type char = string;",
          "export type JsValue = object | string | number | boolean | bigint | symbol | null;",
        ].join("\n"),
      },
      "src/index.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("Assert.Equal((object)(double)1, ");
    expect(csharp).to.not.include(
      "(global::System.Memory<char>)(object)args[0]"
    );
    expect(csharp).to.not.include("(int)(object)args[0]");
  });

  it("preserves explicit JsValue callback storage for later numeric equality assertions", () => {
    const csharp = compileProjectToCSharp(
      {
        "package.json": JSON.stringify(
          { name: "emitter-test-project", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/xunit-types/package.json": JSON.stringify(
          { name: "xunit-types", version: "1.0.0", type: "module" },
          null,
          2
        ),
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
        "src/index.ts": [
          'import { Assert } from "xunit-types/Xunit.js";',
          "",
          "declare class EventEmitter {",
          "  on(eventName: string, listener: (value: JsValue) => void): void;",
          "  emit(eventName: string, value: JsValue): void;",
          "}",
          "",
          "export function run(emitter: EventEmitter): void {",
          "  let received: JsValue = undefined;",
          '  emitter.on("test", (value) => {',
          "    received = value;",
          "  });",
          '  emitter.emit("test", 42);',
          "  Assert.Equal(42, received);",
          "}",
        ].join("\n"),
      },
      "src/index.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("Assert.Equal((object)(double)42, received);");
    expect(csharp).to.not.include("Assert.Equal(42, received);");
  });

  it("keeps broad NotNull overloads when sibling source overloads still mention Nullable<T>", () => {
    const csharp = compileProjectToCSharp(
      {
        "package.json": JSON.stringify(
          { name: "emitter-test-project", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "src/index.ts": [
          'import { Assert } from "xunit-types/Xunit.js";',
          "",
          "class Holder {",
          "  value?: string;",
          "}",
          "",
          "export function run(holder: Holder): void {",
          "  Assert.NotNull(holder.value);",
          "}",
        ].join("\n"),
        "node_modules/xunit-types/package.json": JSON.stringify(
          { name: "xunit-types", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/xunit-types/Xunit.js":
          'export { Assert as Assert } from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit.d.ts":
          'export { Assert as Assert } from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit/internal/index.js":
          "export const Assert = undefined;",
        "node_modules/xunit-types/Xunit/internal/index.d.ts": [
          'import type { Nullable_1 } from "@tsonic/dotnet/System/internal/index.js";',
          "",
          "export interface Assert$instance {}",
          "",
          "export declare const Assert: (abstract new() => Assert$instance) & {",
          "  NotNull<T extends unknown>(value: Nullable_1<T>): T;",
          "  NotNull(object: unknown): void;",
          "};",
        ].join("\n"),
        "node_modules/@tsonic/dotnet/package.json": JSON.stringify(
          { name: "@tsonic/dotnet", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/@tsonic/dotnet/System/internal/index.js": "export {};",
        "node_modules/@tsonic/dotnet/System/internal/index.d.ts": [
          "export interface Nullable_1$instance<T> {",
          "  readonly __tsonic_type_System_Nullable_1: never;",
          "  readonly HasValue: boolean;",
          "  readonly Value: T;",
          "}",
          "export type Nullable_1<T> = Nullable_1$instance<T>;",
        ].join("\n"),
      },
      "src/index.ts"
    );

    expect(csharp).to.include("Assert.NotNull(holder.value);");
    expect(csharp).to.not.include("Nullable<T>");
    expect(csharp).to.not.include("System.Nullable<T>");
  });

  it("materializes runtime-union arguments for broad NotNull overloads", () => {
    const csharp = compileProjectToCSharp(
      {
        "package.json": JSON.stringify(
          { name: "emitter-test-project", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "src/index.ts": [
          'import { Assert } from "xunit-types/Xunit.js";',
          "",
          "class BufferLike {}",
          "",
          "declare function read(): string | BufferLike;",
          "",
          "export function run(): void {",
          "  const result = read();",
          "  Assert.NotNull(result);",
          "}",
        ].join("\n"),
        "node_modules/xunit-types/package.json": JSON.stringify(
          { name: "xunit-types", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/xunit-types/Xunit.js":
          'export { Assert as Assert } from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit.d.ts":
          'export { Assert as Assert } from "./Xunit/internal/index.js";',
        "node_modules/xunit-types/Xunit/internal/index.js":
          "export const Assert = undefined;",
        "node_modules/xunit-types/Xunit/internal/index.d.ts": [
          'import type { Nullable_1 } from "@tsonic/dotnet/System/internal/index.js";',
          "",
          "export interface Assert$instance {}",
          "",
          "export declare const Assert: (abstract new() => Assert$instance) & {",
          "  NotNull<T extends unknown>(value: Nullable_1<T>): T;",
          "  NotNull(object: unknown): void;",
          "};",
        ].join("\n"),
        "node_modules/@tsonic/dotnet/package.json": JSON.stringify(
          { name: "@tsonic/dotnet", version: "1.0.0", type: "module" },
          null,
          2
        ),
        "node_modules/@tsonic/dotnet/System/internal/index.js": "export {};",
        "node_modules/@tsonic/dotnet/System/internal/index.d.ts": [
          "export interface Nullable_1$instance<T> {",
          "  readonly __tsonic_type_System_Nullable_1: never;",
          "  readonly HasValue: boolean;",
          "  readonly Value: T;",
          "}",
          "export type Nullable_1<T> = Nullable_1$instance<T>;",
        ].join("\n"),
      },
      "src/index.ts"
    );

    expect(csharp).to.include(
      "Assert.NotNull(result.Match<object>(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => __tsonic_union_member_2));"
    );
  });
});
