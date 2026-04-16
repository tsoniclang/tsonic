import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  compileProjectToCSharp,
  compileToCSharp,
} from "./integration-cases/helpers.js";

const repoRoot = path.resolve(process.cwd(), "../..");
const readFixtureSource = (fixtureName: string): string =>
  fs.readFileSync(
    path.join(
      repoRoot,
      "test",
      "fixtures",
      fixtureName,
      "packages",
      fixtureName,
      "src",
      "index.ts"
    ),
    "utf-8"
  );

describe("End-to-End Integration", () => {
  describe("Fixture regression mirrors", () => {
    it("mirrors js-surface-array-from-map-keys", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/index.ts": readFixtureSource("js-surface-array-from-map-keys"),
        },
        "src/index.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("var keys = global::js.Array.from(");
      expect(csharp).to.include("counts.keys()");
      expect(csharp).to.include(
        'global::js.ConsoleModule.log(global::Tsonic.Internal.ArrayInterop.WrapArray(keys).join(","));'
      );
    });

    it("mirrors js-surface-json-unknown-entries", () => {
      const csharp = compileToCSharp(
        readFixtureSource("js-surface-json-unknown-entries"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        'var root = global::js.JSON.parse("{\\"title\\":\\"hello\\",\\"count\\":2}");'
      );
      expect(csharp).to.include("var entries = global::js.Object.entries(root);");
      expect(csharp).to.include(
        'if (global::Tsonic.Runtime.Operators.@typeof(value) == "number")'
      );
      expect(csharp).to.include(
        'global::js.ConsoleModule.log(key, global::js.Number.toString((double)value));'
      );
      expect(csharp).to.include(
        'global::js.ConsoleModule.log(key, global::js.String.toUpperCase((string)value));'
      );
    });

    it("mirrors js-surface-runtime-builtins", () => {
      const csharp = compileToCSharp(
        readFixtureSource("js-surface-runtime-builtins"),
        "/test/test.ts",
        { surface: "@tsonic/js", enableJsonAot: true }
      );

      expect(csharp).to.include(
        'var value = global::js.String.trim("  hello,world  ");'
      );
      expect(csharp).to.include("var now = new global::js.Date();");
      expect(csharp).to.include(
        'var regex = new global::js.RegExp(global::Tsonic.Internal.Union<global::js.RegExp, string>.From2("HELLO"));'
      );
      expect(csharp).to.include(
        'var regexLiteral = new global::js.RegExp(global::Tsonic.Internal.Union<global::js.RegExp, string>.From2("^[A-Z, ]+$"));'
      );
      expect(csharp).to.include('var chars = global::js.Array.from("abcd");');
      expect(csharp).to.include("var more = global::js.Array.of(6, 7, 8);");
      expect(csharp).to.include(
        "var joined = global::Tsonic.Internal.ArrayInterop.WrapArray(filtered).join(\",\");"
      );
      expect(csharp).to.include(
        "var joinedDefault = global::Tsonic.Internal.ArrayInterop.WrapArray(filtered).join();"
      );
      expect(csharp).to.include("global::js.Globals.parseInt(\"123\")");
    });

    it("does not leak instanceof conjunction narrowing into dgram send fallthrough byte conversion", () => {
      const csharp = compileToCSharp(
        [
          'declare function stringToBytes(value: string, encoding: "utf8"): Uint8Array;',
          "",
          "const toBytes = (msg: Uint8Array | string): Uint8Array => {",
          '  if (typeof msg === "string") {',
          '    return stringToBytes(msg, "utf8");',
          "  }",
          "  return msg;",
          "};",
          "",
          "type ParsedSendArgs = {",
          "  data: Uint8Array;",
          "  port?: number;",
          "  address?: string;",
          "  callback?: (error: Error | null, bytes: number) => void;",
          "};",
          "",
          "export const parseSendArgs = (",
          "  msg: Uint8Array | string,",
          "  args: readonly JsValue[],",
          "): ParsedSendArgs => {",
          "  const arg0 = args.length > 0 ? args[0] : undefined;",
          "  const arg1 = args.length > 1 ? args[1] : undefined;",
          "",
          '  if (msg instanceof Uint8Array && args.length >= 2 && typeof arg0 === "number" && typeof arg1 === "number") {',
          "    return { data: msg };",
          "  }",
          "",
          "  const data = toBytes(msg);",
          "  return { data };",
          "};",
        ].join("\n"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("var data = toBytes(msg);");
      expect(csharp).to.not.include(
        "var data = toBytes(global::Tsonic.Internal.Union<string, global::js.Uint8Array>.From2(msg));"
      );
    });

    it("mirrors js-string-array-returns", () => {
      const csharp = compileToCSharp(
        readFixtureSource("js-string-array-returns"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        'string[] parts = global::System.Linq.Enumerable.ToArray(global::js.String.split(path, "/"));'
      );
      expect(csharp).to.include(
        'string[]? maybeMatch = global::js.String.match(path, "docs");'
      );
      expect(csharp).to.include(
        'string[][] allMatches = global::System.Linq.Enumerable.ToArray(global::js.String.matchAll("a-a", "a"));'
      );
      expect(csharp).to.include(
        'return global::Tsonic.Internal.ArrayInterop.WrapArray(parts).join(",");'
      );
      expect(csharp).to.include(
        "global::js.ConsoleModule.log(takeParts(parts), firstMatch, firstAll, global::js.Number.toString(selected.Length));"
      );
    });

    it("mirrors js-surface-node-boolean-tostring primitive member lowering", () => {
      const source = `
        declare function existsSync(path: string): boolean;
        declare function join(...parts: string[]): string;

        export function main(): void {
          const file = join(import.meta.dirname, "src", "index.ts");
          console.log(existsSync(file).toString());
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include(
        "global::js.Boolean.toString(existsSync(file))"
      );
      expect(csharp).to.not.include("existsSync(file).ToString()");
      expect(csharp).to.not.include("existsSync(file).toString()");
      expect(csharp).to.not.include("import.meta");
    });

    it("mirrors js-surface-node-date-union", () => {
      const source = `
        declare class JsDate {
          toISOString(): string;
        }

        declare function statSync(path: string): { readonly mtime: JsDate };

        export function main(): void {
          const maybeDate: JsDate | undefined = undefined;
          const resolved = maybeDate ?? statSync("tsonic.workspace.json").mtime;
          console.log(resolved.toISOString().length.toString());
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include(
        'var resolved = maybeDate ?? statSync("tsonic.workspace.json").mtime;'
      );
      expect(csharp).to.include(
        "global::js.Number.toString(resolved.toISOString().Length)"
      );
      expect(csharp).to.not.include("(object)resolved");
    });

    it("mirrors import-meta-object", () => {
      const csharp = compileToCSharp(readFixtureSource("import-meta-object"), "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include('url = "file:///test/test.ts"');
      expect(csharp).to.include('filename = "/test/test.ts"');
      expect(csharp).to.include('dirname = "/test"');
      expect(csharp).to.not.include("import.meta");
    });

    it("mirrors object-literal-method-accessor-js", () => {
      const csharp = compileToCSharp(
        readFixtureSource("object-literal-method-accessor-js"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("__tmp.inc = () =>");
      expect(csharp).to.include("__tmp.x += 1;");
      expect(csharp).to.include("counter.value");
      expect(csharp).to.include("counter.inc()");
      expect(csharp).to.include("global::js.Number.toString(counter.value)");
    });

    it("mirrors readonly-array-property-mutation", () => {
      const csharp = compileToCSharp(
        readFixtureSource("readonly-array-property-mutation"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("private string[] items { get; set; }");
      expect(csharp).to.include(
        "var __tsonic_arrayWrapper = global::Tsonic.Internal.ArrayInterop.WrapArray(__tsonic_arrayTarget.items);"
      );
      expect(csharp).to.include(
        "var __tsonic_arrayResult = __tsonic_arrayWrapper.push(value);"
      );
      expect(csharp).to.include(
        'return global::Tsonic.Internal.ArrayInterop.WrapArray(this.items).join("-");'
      );
    });

    it("mirrors module-const-array-mutation", () => {
      const csharp = compileToCSharp(
        readFixtureSource("module-const-array-mutation"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "internal static string[] parts = global::System.Array.Empty<string>();"
      );
      expect(csharp).to.include(
        "var __tsonic_arrayWrapper = global::Tsonic.Internal.ArrayInterop.WrapArray(parts);"
      );
      expect(csharp).to.include(
        "var __tsonic_arrayResult = __tsonic_arrayWrapper.push(value);"
      );
      expect(csharp).to.include(
        'global::System.Console.WriteLine(global::Tsonic.Internal.ArrayInterop.WrapArray(parts).join("-"));'
      );
    });

    it("mirrors native-array-push-mutation", () => {
      const csharp = compileToCSharp(
        readFixtureSource("native-array-push-mutation"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "string[] parts = global::System.Array.Empty<string>();"
      );
      expect(csharp).to.include(
        'var __tsonic_arrayResult = __tsonic_arrayWrapper.push("hello");'
      );
      expect(csharp).to.include(
        'var __tsonic_arrayResult__1 = __tsonic_arrayWrapper__1.push("world");'
      );
      expect(csharp).to.include(
        'global::System.Console.WriteLine(global::Tsonic.Internal.ArrayInterop.WrapArray(parts).join("-"));'
      );
    });

    it("preserves narrowed overload carriers for recursive fs-style writeSync calls", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";
        import type { byte, int } from "@tsonic/core/types.js";

        class Buffer {}

        type WritableFsBuffer = byte[] | Buffer;

        function resolveWriteLength(
          buffer: WritableFsBuffer,
          offset: int,
          lengthOrEncoding?: int | string
        ): int {
          void buffer;
          void offset;
          void lengthOrEncoding;
          return 1 as int;
        }

        export class FS {
          writeSync(fd: int, buffer: WritableFsBuffer, offset: int, length: int, position: int | null): int;
          writeSync(fd: int, data: string, position?: int | null, encoding?: string): int;
          writeSync(_fd: any, _bufferOrData: any, _offsetOrPosition?: any, _lengthOrEncoding?: any, _position?: any): any {
            throw new Error("stub");
          }

          writeSync_buffer(
            fd: int,
            buffer: WritableFsBuffer,
            offset: int,
            length: int,
            position: int | null
          ): int {
            void fd;
            void buffer;
            void offset;
            void length;
            void position;
            return 1 as int;
          }

          writeSync_text(
            fd: int,
            data: string,
            position?: int | null,
            encoding?: string
          ): int {
            let bufferOrData: WritableFsBuffer | string = data;
            if (typeof bufferOrData === "string") {
              bufferOrData = new Buffer();
            }

            return this.writeSync(
              fd,
              bufferOrData,
              0 as int,
              resolveWriteLength(bufferOrData, 0 as int, encoding),
              position ?? null
            );
          }
        }

        O<FS>().method(x => x.writeSync_buffer).family(x => x.writeSync);
        O<FS>().method(x => x.writeSync_text).family(x => x.writeSync);
      `, "/test/test.ts", { surface: "@tsonic/js" });

      expect(
        csharp.match(
          /bufferOrData\.Match<global::Tsonic\.Internal\.Union<byte\[], global::Test\.Buffer>>\(/g
        )?.length
      ).to.equal(2);
      expect(csharp).to.not.include(
        "return this.writeSync(fd, (global::Tsonic.Internal.Union<byte[], string, global::Test.Buffer>)bufferOrData"
      );
    });

    it("materializes narrowed runtime-union casts with the cast carrier arity", () => {
      const csharp = compileToCSharp(`
        class Buffer {}

        declare function isNumberArray(value: number[]): boolean;
        declare function fromArray(value: number[]): void;
        declare function fromUint8Array(value: Uint8Array): void;

        function fromNonString(value: number[] | Buffer | Uint8Array): void {
          if (value instanceof Buffer) {
            return;
          }

          if (isNumberArray(value)) {
            fromArray(value);
            return;
          }

          fromUint8Array(value);
        }
      `, "/test/test.ts", { surface: "@tsonic/js" });

      expect(csharp).to.include(
        ".Match<double[]>(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => throw new global::System.InvalidCastException("
      );
      expect(csharp).to.not.include(
        ".Match<double[]>(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => throw new global::System.InvalidCastException(\"Cannot cast runtime union ref#0:global::Test.Buffer:: to arr#0:prim:number:tuple::rest:none\"), __tsonic_union_member_3 =>"
      );
    });

    it("keeps predicate-fallthrough imported typed-array calls on the typed-array branch", () => {
      const csharp = compileProjectToCSharp(
        {
          "package.json": JSON.stringify(
            { name: "emitter-test-project", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "src/index.ts": [
            'import { Uint8Array } from "@fixture/js/index.js";',
            "",
            "class Buffer {}",
            "",
            "declare function isNumberArray(",
            "  value: number[] | Buffer | Uint8Array",
            "): value is number[];",
            "declare function fromArray(value: number[]): void;",
            "declare function fromUint8Array(value: Uint8Array): void;",
            "",
            "export function fromNonString(",
            "  value: number[] | Buffer | Uint8Array",
            "): void {",
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
          "node_modules/@fixture/js/package.json": JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "node_modules/@fixture/js/tsonic.package.json": JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "fixturejs",
                exports: {
                  "./index.js": "./src/index.ts",
                },
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/js/src/index.ts": [
            "export class Uint8Array {}",
          ].join("\n"),
        },
        "src/index.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "fromUint8Array((value.As2()));"
      );
      expect(csharp).not.to.include(
        ").Match<double[]>(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => throw new global::System.InvalidCastException("
      );
    });

    it("keeps static predicate fallthrough calls on the typed-array branch", () => {
      const csharp = compileProjectToCSharp(
        {
          "package.json": JSON.stringify(
            { name: "emitter-test-project", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "src/index.ts": [
            'import { Uint8Array } from "@fixture/js/index.js";',
            "",
            "export class Buffer {",
            "  static fromArray(_value: number[]): Buffer {",
            "    return new Buffer();",
            "  }",
            "",
            "  static fromUint8Array(_value: Uint8Array): Buffer {",
            "    return new Buffer();",
            "  }",
            "",
            "  private static isNumberArray(",
            "    value: number[] | Buffer | Uint8Array,",
            "  ): value is number[] {",
            "    return Array.isArray(value);",
            "  }",
            "",
            "  static fromNonString(",
            "    value: number[] | Buffer | Uint8Array,",
            "  ): Buffer {",
            "    if (value instanceof Buffer) {",
            "      return value;",
            "    }",
            "    if (Buffer.isNumberArray(value)) {",
            "      return Buffer.fromArray(value);",
            "    }",
            "    return Buffer.fromUint8Array(value);",
            "  }",
            "}",
          ].join("\n"),
          "node_modules/@fixture/js/package.json": JSON.stringify(
            { name: "@fixture/js", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "node_modules/@fixture/js/tsonic.package.json": JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "fixturejs",
                exports: {
                  "./index.js": "./src/index.ts",
                },
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/js/src/index.ts": [
            "export class Uint8Array {}",
          ].join("\n"),
        },
        "src/index.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("Buffer.fromUint8Array((value.As3()));");
      expect(csharp).not.to.include(
        "Buffer.fromUint8Array(((global::Tsonic.Internal.Union<double[], global::js.Uint8Array>)"
      );
      expect(csharp).not.to.include(
        ").Match<double[]>(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => throw new global::System.InvalidCastException("
      );
    });

    it("keeps inherited typed-array overload calls on the exact iterable overload surface", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";
        import type { byte, int } from "@tsonic/core/types.js";
        import { overloads as O } from "@tsonic/core/lang.js";

        type TypedArrayInput<TElement extends number> =
          | TElement[]
          | Iterable<number>;

        class TypedArrayBase<TElement extends number> {
          public length: int = 0 as int;

          public set(index: int, value: number): void;
          public set(source: TypedArrayInput<TElement>, offset?: int): void;
          public set(_sourceOrIndex: any, _offsetOrValue: any = 0 as int): any {
            throw new Error("stub");
          }

          public set_index(index: int, value: number): void {
            void index;
            void value;
          }

          public set_source(
            source: TypedArrayInput<TElement>,
            offset?: int
          ): void {
            void source;
            void offset;
          }
        }

        O<InstanceType<typeof TypedArrayBase>>().method(x => x.set_index).family(x => x.set);
        O<InstanceType<typeof TypedArrayBase>>().method(x => x.set_source).family(x => x.set);

        class Uint8Array extends TypedArrayBase<byte> {
          public *[Symbol.iterator](): Generator<byte, undefined, undefined> {
            return undefined as never;
          }
        }

        export function concatBytes(...buffers: Uint8Array[]): Uint8Array {
          let totalLength = 0 as int;
          for (let index = 0 as int; index < buffers.length; index += 1) {
            totalLength += buffers[index]!.length;
          }

          const result = new Uint8Array();
          let offset = 0 as int;
          for (let index = 0 as int; index < buffers.length; index += 1) {
            const buffer = buffers[index]!;
            result.set(buffer, offset);
            offset += buffer.length;
          }
          return result;
        }
      `, "/test/test.ts", { surface: "@tsonic/js" });

      expect(csharp).to.include("result.set(");
      expect(csharp).to.include("buffer.__tsonic_symbol_iterator()");
      expect(csharp).to.include(
        "result.set(global::System.Linq.Enumerable.Select<byte, double>(buffer.__tsonic_symbol_iterator(), __item => __item), offset);"
      );
      expect(csharp).not.to.include("result.set(buffer, offset);");
      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<byte[], global::System.Collections.Generic.IEnumerable<double>>.From2("
      );
      expect(csharp).not.to.include("global::Tsonic.Internal.Union<int, double>.From1(offset)");
      expect(csharp).not.to.include(
        "buffer.__tsonic_symbol_iterator(), __item => __item).__tsonic_symbol_iterator()"
      );
    });

    it("materializes imported typed-array overload calls through the public union wrapper", () => {
      const csharp = compileToCSharp(
        `
          import { Uint8Array } from "@tsonic/js/index.js";

          export function concatBytes(...buffers: Uint8Array[]): Uint8Array {
            let totalLength = 0;
            for (let index = 0; index < buffers.length; index += 1) {
              totalLength += buffers[index]!.length;
            }

            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (let index = 0; index < buffers.length; index += 1) {
              const buffer = buffers[index]!;
              result.set(buffer, offset);
              offset += buffer.length;
            }
            return result;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "result.set(global::System.Linq.Enumerable.Select<byte, double>(buffer.__tsonic_symbol_iterator(), __item => __item), (int)offset);"
      );
      expect(csharp).to.include("buffer.__tsonic_symbol_iterator()");
      expect(csharp).not.to.include("result.set(buffer, offset);");
      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<byte[], global::System.Collections.Generic.IEnumerable<double>>.From2("
      );
      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<int, double>.From1(offset)"
      );
      expect(csharp).not.to.include(
        "buffer.__tsonic_symbol_iterator(), __item => __item).__tsonic_symbol_iterator()"
      );
    });

    it("does not re-adapt typed-array iterable arguments after contextual emission", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";
        import type { byte, int } from "@tsonic/core/types.js";

        type TypedArrayInput<TElement extends number> =
          | TElement[]
          | Iterable<number>;

        class TypedArrayBase<TElement extends number> {
          public length: int = 0 as int;

          public set(index: int, value: number): void;
          public set(source: TypedArrayInput<TElement>, offset?: int): void;
          public set(_sourceOrIndex: unknown, _offsetOrValue: unknown): void {}

          public set_index(index: int, value: number): void {
            void index;
            void value;
          }

          public set_source(
            source: TypedArrayInput<TElement>,
            offset?: int
          ): void {
            void source;
            void offset;
          }
        }

        O<TypedArrayBase<byte>>().method(x => x.set_index).family(x => x.set);
        O<TypedArrayBase<byte>>().method(x => x.set_source).family(x => x.set);

        class Uint8Array extends TypedArrayBase<byte> {
          public *[Symbol.iterator](): Generator<byte, undefined, undefined> {
            return undefined as never;
          }
        }

        class Buffer {
          private readonly _data: Uint8Array;

          public constructor(data: Uint8Array) {
            this._data = data;
          }

          public static fromBuffer(buffer: Buffer): Buffer {
            const copy = new Uint8Array();
            copy.set(buffer._data);
            return new Buffer(copy);
          }
        }
      `, "/test/test.ts", { surface: "@tsonic/js" });

      expect(csharp).to.include(
        "copy.set(global::System.Linq.Enumerable.Select<byte, double>(buffer._data.__tsonic_symbol_iterator(), __item => __item));"
      );
      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<byte[], global::System.Collections.Generic.IEnumerable<double>>.From2("
      );
      expect(csharp).not.to.include(
        "buffer._data.__tsonic_symbol_iterator(), __item => __item).__tsonic_symbol_iterator()"
      );
    });

    it("keeps selected member overload surfaces exact instead of the implementation union", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";
        import type { int } from "@tsonic/core/types.js";

        export class BufferLike {
          set(index: int, value: number): void;
          set(values: Iterable<number>, offset?: int): void;
          set(_sourceOrIndex: unknown, _offsetOrValue: unknown): void {}

          set_index(index: int, value: number): void {
            void index;
            void value;
          }

          set_values(values: Iterable<number>, offset?: int): void {
            void values;
            void offset;
          }
        }

        O<BufferLike>().method(x => x.set_index).family(x => x.set);
        O<BufferLike>().method(x => x.set_values).family(x => x.set);

        export function write(
          target: BufferLike,
          values: Iterable<number>,
          offset: int
        ): void {
          target.set(values, offset);
        }
      `, "/test/test.ts", { surface: "@tsonic/js" });

      expect(csharp).to.include(
        "target.set(values, offset);"
      );
      expect(csharp).to.not.include(
        "target.set(global::Tsonic.Internal.Union<double[], global::System.Collections.Generic.IEnumerable<double>, int>.From2(values), global::Tsonic.Internal.Union<int, double>.From1(offset));"
      );
    });

    it("mirrors json-native-inline-stringify", () => {
      const csharp = compileToCSharp(
        readFixtureSource("json-native-inline-stringify"),
        "/test/test.ts",
        { surface: "@tsonic/js", enableJsonAot: true }
      );

      expect(csharp).to.include(
        'global::Test.TsonicJsonRuntime.Stringify(new global::System.Collections.Generic.Dictionary<string, object?> { ["ok"] = true, ["value"] = (object)(double)3 })'
      );
      expect(csharp).to.not.include("JSON.stringify(");
    });

    it("mirrors json-native-roundtrip", () => {
      const csharp = compileToCSharp(
        readFixtureSource("json-native-roundtrip"),
        "/test/test.ts",
        { surface: "@tsonic/js", enableJsonAot: true }
      );

      expect(csharp).to.include(
        "var parsed = global::System.Text.Json.JsonSerializer.Deserialize<Payload__Alias>(json, global::Test.TsonicJson.Options);"
      );
      expect(csharp).to.include(
        'var roundtrip = global::System.Text.Json.JsonSerializer.Serialize(parsed, global::Test.TsonicJson.Options);'
      );
      expect(csharp).to.include(
        'var parsedNumber = global::System.Text.Json.JsonSerializer.Deserialize<double>("123", global::Test.TsonicJson.Options);'
      );
      expect(csharp).to.include(
        'var parsedBool = global::System.Text.Json.JsonSerializer.Deserialize<bool>("true", global::Test.TsonicJson.Options);'
      );
      expect(csharp).to.include(
        "global::System.Text.Json.JsonSerializer.Serialize(inline, global::Test.TsonicJson.Options)"
      );
      expect(csharp).to.include("global::Test.TsonicJsonRuntime.Stringify(new global::System.Collections.Generic.Dictionary<string, object?>");
    });

    it("infers explicit JsValue through generic createWrapped calls used by flat", () => {
      const csharp = compileToCSharp(`
        import type { int, JsValue } from "@tsonic/core/types.js";

        export class Array<T = JsValue> {
          private readonly valuesStore: T[] = [];

          private createWrapped<TResult>(values: readonly TResult[] | TResult[]): Array<TResult> {
            void values;
            return new Array<TResult>();
          }

          public flat(depth: int = 1 as int): Array<JsValue> {
            const flattened: JsValue[] = [];
            void depth;
            return this.createWrapped(flattened);
          }
        }
      `, "/test/test.ts", { surface: "@tsonic/js" });

      const localArraySection = csharp.slice(
        csharp.lastIndexOf("public class Array<T>")
      );
      expect(localArraySection).to.include("public Array<object?> flat");
      expect(localArraySection).to.include("return this.createWrapped(flattened);");
      expect(localArraySection).not.to.include(
        "return this.createWrapped((TResult[])"
      );
    });

  });
});
