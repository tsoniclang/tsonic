import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Regression Coverage", () => {
    it("preserves reference nullable narrowing across repeated reassignment guards", () => {
      const source = `
        class ImageDimensions {
          width: number;
          height: number;

          constructor(width: number, height: number) {
            this.width = width;
            this.height = height;
          }
        }

        declare const Resource: {
          parsePngDimensions(bytes: string): ImageDimensions | undefined;
          parseJpegDimensions(bytes: string): ImageDimensions | undefined;
          parseGifDimensions(bytes: string): ImageDimensions | undefined;
        };

        export function parseImageDimensions(bytes: string): ImageDimensions | undefined {
          let dims = Resource.parsePngDimensions(bytes);
          if (dims !== undefined) return dims;

          dims = Resource.parseJpegDimensions(bytes);
          if (dims !== undefined) return dims;

          dims = Resource.parseGifDimensions(bytes);
          if (dims !== undefined) return dims;

          return undefined;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include("if (dims != null)");
      expect(csharp).to.not.include("if ((object)dims != null)");
      expect(csharp).to.not.include("return (object)dims;");
      expect(csharp).to.include("return dims;");
    });

    it("materializes Array.isArray-narrowed unknown locals before array storage declarations", () => {
      const source = `
        export function parseJsonStringArray(value: unknown): string[] | undefined {
          if (!Array.isArray(value)) return undefined;
          const values = value as unknown[];
          const items: string[] = [];
          for (let i = 0; i < values.length; i++) {
            const current = values[i];
            if (typeof current === "string") items.push(current);
          }
          return items;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include("object?[] values = (object?[])value;");
      expect(csharp).to.not.include("object?[] values = value;");
    });

    it("preserves System.Array storage for broad array assertions after Array.isArray fallthrough guards", () => {
      const source = `
        export function firstDefined(value: unknown): boolean {
          if (!Array.isArray(value)) {
            return false;
          }

          return (value as unknown[]).length > 0 && (value as unknown[])[0] !== undefined;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include("((global::System.Array)value).Length > 0");
      expect(csharp).to.include("((global::System.Array)value).GetValue(0)");
      expect(csharp).to.not.include("(object?[])value");
    });

    it("uses narrowed array storage for JS array wrapper member calls after Array.isArray fallthrough guards", () => {
      const source = `
        export function appendHeader(value: string | string[]): string {
          if (Array.isArray(value)) {
            return value.join("|");
          }

          return value;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.match(
        /global::Tsonic\.Internal\.ArrayInterop\.WrapArray\(\(?value\.As1\(\)\)?\)\.join\("\|"\)/
      );
      expect(csharp).to.not.include(
        'global::Tsonic.Internal.ArrayInterop.WrapArray(value).join("|")'
      );
      expect(csharp).to.include("internal static class ArrayInterop");
    });

    it("preserves System.Array storage for broad array assertions inside nested callbacks", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function compare(
          left: (index: int) => unknown,
          right: (index: int) => unknown
        ): void;

        export function run(left: unknown, right: unknown): void {
          if (!Array.isArray(left) || !Array.isArray(right)) {
            return;
          }

          compare(
            (index) => (left as unknown[])[index],
            (index) => (right as unknown[])[index]
          );
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include("((global::System.Array)left).GetValue(index)");
      expect(csharp).to.include(
        "((global::System.Array)right).GetValue(index)"
      );
      expect(csharp).to.not.include("((object?[])left)[index]");
      expect(csharp).to.not.include("((object?[])right)[index]");
    });

    it("preserves System.Array storage through Array.isArray boolean alias gates", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function compare(
          left: object,
          right: object,
          leftLength: int,
          rightLength: int,
          getLeftValue: (index: int) => unknown,
          getRightValue: (index: int) => unknown
        ): boolean;

        export function run(left: unknown, right: unknown): boolean {
          const leftIsArray = Array.isArray(left);
          const rightIsArray = Array.isArray(right);
          if (leftIsArray || rightIsArray) {
            if (!leftIsArray || !rightIsArray) {
              return false;
            }

            return compare(
              left as object,
              right as object,
              (left as unknown[]).length,
              (right as unknown[]).length,
              (index) => (left as unknown[])[index],
              (index) => (right as unknown[])[index]
            );
          }

          return false;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include("((global::System.Array)left).Length");
      expect(csharp).to.include("((global::System.Array)right).Length");
      expect(csharp).to.include("((global::System.Array)left).GetValue(index)");
      expect(csharp).to.include(
        "((global::System.Array)right).GetValue(index)"
      );
      expect(csharp).to.not.include("(object?[])left");
      expect(csharp).to.not.include("(object?[])right");
    });

    it("preserves System.Array storage through bound Array.isArray boolean alias gates", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function compare(
          left: object,
          right: object,
          leftLength: int,
          rightLength: int,
          getLeftValue: (index: int) => unknown,
          getRightValue: (index: int) => unknown
        ): boolean;

        export function run(left: unknown, right: unknown): boolean {
          const leftIsArray = Array.isArray(left);
          const rightIsArray = Array.isArray(right);
          if (leftIsArray || rightIsArray) {
            if (!leftIsArray || !rightIsArray) {
              return false;
            }

            return compare(
              left as object,
              right as object,
              (left as unknown[]).length,
              (right as unknown[]).length,
              (index) => (left as unknown[])[index],
              (index) => (right as unknown[])[index]
            );
          }

          return false;
        }
      `;

      const csharp = compileToCSharp(source, "/test/assert-module.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include("((global::System.Array)left).Length");
      expect(csharp).to.include("((global::System.Array)right).Length");
      expect(csharp).to.include("((global::System.Array)left).GetValue(index)");
      expect(csharp).to.include(
        "((global::System.Array)right).GetValue(index)"
      );
      expect(csharp).to.not.include("(object?[])left");
      expect(csharp).to.not.include("(object?[])right");
    });

    it("materializes Object.entries Array.isArray fallthrough assertions to CLR arrays", () => {
      const source = `
        export function parse(root: unknown): number {
          if (root === null || typeof root !== "object" || Array.isArray(root)) {
            return 0;
          }

          const entries = Object.entries(root);
          for (let i = 0; i < entries.length; i++) {
            const [key, value] = entries[i]!;
            if (key.toLowerCase() !== "mounts" || !Array.isArray(value)) {
              continue;
            }

            const mountsValue = value as unknown[];
            return mountsValue.length;
          }

          return 0;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include("!(value is global::System.Array)");
      expect(csharp).to.include("object?[] mountsValue = (object?[])value;");
      expect(csharp).to.not.include("(global::js.Array)value");
    });

    it("keeps nullable reference assignments nominal after local null guards", () => {
      const source = `
        class PageContext {
          slug: string;

          constructor(slug: string) {
            this.slug = slug;
          }
        }

        class MenuEntry {
          page: PageContext | undefined;

          constructor() {
            this.page = undefined;
          }
        }

        const findPageByRef = (pageRef: string): PageContext | undefined => {
          if (pageRef === "") {
            return undefined;
          }

          return new PageContext(pageRef);
        };

        export function attach(entry: MenuEntry, pageRef: string): void {
          const resolved = findPageByRef(pageRef);
          if (resolved !== undefined) {
            entry.page = resolved;
          }
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include("if (resolved != null)");
      expect(csharp).to.include("entry.page = resolved;");
      expect(csharp).to.not.include("entry.page = (object)resolved;");
    });

    it("selects the exact reachable runtime-union array arm for overloaded generic returns", () => {
      const source = `
        import { overloads as O } from "@tsonic/core/lang.js";
        import type { int } from "@tsonic/core/types.js";

        declare function mapString(source: string): string[];
        declare function mapStringMapped<TResult>(
          source: string,
          mapfn: (value: string, index: int) => TResult
        ): TResult[];
        declare function mapIterable<T>(source: Iterable<T>): T[];
        declare function mapIterableMapped<T, TResult>(
          source: Iterable<T>,
          mapfn: (value: T, index: int) => TResult
        ): TResult[];

        export class Array<T = unknown> {
          static from(source: string): string[];
          static from<TResult>(
            source: string,
            mapfn: (value: string, index: int) => TResult
          ): TResult[];
          static from<T>(source: Iterable<T>): T[];
          static from<T, TResult>(
            source: Iterable<T>,
            mapfn: (value: T, index: int) => TResult
          ): TResult[];
          static from(_source: any, _mapfn?: any): any {
            throw new Error("stub");
          }
          static from_string(source: string): string[] {
            return mapString(source);
          }
          static from_stringMapped<TResult>(
            source: string,
            mapfn: (value: string, index: int) => TResult
          ): TResult[] {
            return mapStringMapped(source, mapfn);
          }
          static from_iterable<T>(source: Iterable<T>): T[] {
            return mapIterable(source);
          }
          static from_iterableMapped<T, TResult>(
            source: Iterable<T>,
            mapfn: (value: T, index: int) => TResult
          ): TResult[] {
            return mapIterableMapped(source, mapfn);
          }
        }

        O<typeof Array>().method(x => x.from_string).family(x => x.from);
        O<typeof Array>().method(x => x.from_stringMapped).family(x => x.from);
        O<typeof Array>().method(x => x.from_iterable).family(x => x.from);
        O<typeof Array>().method(x => x.from_iterableMapped).family(x => x.from);
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include(
        "public static T[] from<T>(global::System.Collections.Generic.IEnumerable<T> source)"
      );
      expect(csharp).to.include("return mapIterable(source);");
      expect(csharp).to.include(
        "public static TResult[] from<T, TResult>(global::System.Collections.Generic.IEnumerable<T> source, global::System.Func<T, int, TResult> mapfn)"
      );
      expect(csharp).to.include("return mapIterableMapped(source, mapfn);");
      expect(csharp).to.not.include("from_iterable");
      expect(csharp).to.not.include("Union<string[], T[], TResult[]>");
    });

    it("routes source-backed map for-of loops through symbol iterators", () => {
      const source = `
        export function visit(menuBuilders: Map<string, string[]>): void {
          for (const [menuName, builders] of menuBuilders) {
            console.log(menuName, builders.length.toString());
          }
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include(
        "foreach (var __item in menuBuilders.__tsonic_symbol_iterator())"
      );
      expect(csharp).to.not.include("foreach (var __item in menuBuilders)");
    });

    it("preserves union array element types through for-of guards and string assertions", () => {
      const source = `
        export function lower(headers: (string | null)[] | string[]): string {
          let lowered = "";

          for (const headerName of headers) {
            if (headerName === undefined || headerName === null) {
              continue;
            }

            lowered = (headerName as string).toLowerCase();
          }

          return lowered;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("foreach (var headerName in headers)");
      expect(csharp).to.include(
        "global::js.String.toLowerCase(((string)headerName))"
      );
    });

    it("keeps source-declared js.Array length accesses nominal", () => {
      const source = `
        import { Array } from "@tsonic/js/index.js";
        import type { int } from "@tsonic/core/types.js";

        export function readLength(self: Array<int>): int {
          return self.length;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include("return self.length;");
      expect(csharp).to.not.include("return self.Length;");
      expect(csharp).to.not.include("new global::js.Array<int>(self).length");
    });

    it("materializes narrowed union locals before array mutation wrappers", () => {
      const source = `
        export function append(
          result: Record<string, string | string[]>,
          key: string,
          value: string
        ): void {
          const existing = result[key];
          if (existing !== undefined) {
            if (Array.isArray(existing)) {
              existing.push(value);
            } else {
              result[key] = [existing, value];
            }
          } else {
            result[key] = value;
          }
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.not.include("new global::js.Array<string>(existing)");
      expect(csharp).to.include(
        "global::Tsonic.Internal.ArrayInterop.WrapArray((existing.As1())).push(value);"
      );
    });

    it("preserves tuple returns through source-backed array map callbacks", () => {
      const source = `
        import { Directory, Path } from "@tsonic/dotnet/System.IO.js";

        export const readdirSync = (path: string): string[] =>
          Directory.GetFileSystemEntries(path)
            .map((entry) => Path.GetFileName(entry) ?? "")
            .filter((entry) => entry.length > 0);

        type Entry = { readonly name: string; readonly value: string };
        declare const params: Entry[];

        export const entries = (): Array<[string, string]> =>
          params.map((param) => [param.name, param.value]);
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include(
        "global::System.IO.Directory.GetFileSystemEntries(path)"
      );
      expect(csharp).to.include(
        '.map((string entry) => global::System.IO.Path.GetFileName(entry) ?? "").toArray()'
      );
      expect(csharp).to.include(
        ".filter((string entry) => entry.Length > 0).toArray()"
      );
      expect(csharp).to.match(
        /map\(\((?:Entry|Entry__Alias) param\) => \(param\.name, param\.value\)\)\.toArray\(\)/
      );
      expect(csharp).to.not.include(
        "Select<string[], global::System.ValueTuple<string, string>>"
      );
      expect(csharp).to.not.include("new string[] { param.name, param.value }");
    });

    it("keeps nullable CLR string returns direct when broad unknown is expected", () => {
      const source = `
        declare function getText(): string | null;

        export function fromText(): unknown {
          return getText();
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("return getText();");
      expect(csharp).to.not.include("getText().Match");
    });

    it("keeps nullable member-call strings direct when broad unknown is expected", () => {
      const source = `

        class Reader {
          GetText(): string | null {
            return null;
          }
        }

        export function fromReader(reader: Reader): unknown {
          return reader.GetText();
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("return reader.GetText();");
      expect(csharp).to.not.include("reader.GetText().Match");
    });

    it("keeps nullable arrow returns direct when broad unknown is expected", () => {
      const source = `

        class Reader {
          GetText(): string | null {
            return null;
          }
        }

        export const fromReader = (reader: Reader): unknown => {
          return reader.GetText();
        };
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("return reader.GetText();");
      expect(csharp).to.not.include("reader.GetText().Match");
    });

    it("keeps nullable declaration-only member calls direct when broad unknown is expected", () => {
      const source = `

        declare class Reader {
          GetText(): string | null;
        }

        export const fromReader = (reader: Reader): unknown => {
          return reader.GetText();
        };
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("return reader.GetText();");
      expect(csharp).to.not.include("reader.GetText().Match");
    });

    it("preserves nullish coalescing with null for nullable numeric values flowing into unknown slots", () => {
      const source = `
        import type { int, long } from "@tsonic/core/types.js";

        class User {
          BotType?: int;
          BotOwnerId?: long;
        }

        export function run(u: User): Record<string, unknown> {
          const resp: Record<string, unknown> = {};
          resp["bot_type"] = u.BotType ?? null;
          resp["bot_owner_id"] = u.BotOwnerId ?? null;
          return resp;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include('resp["bot_type"] =');
      expect(csharp).to.include('resp["bot_owner_id"] =');
      expect(csharp).to.include("u.BotType ?? null");
      expect(csharp).to.include("u.BotOwnerId ?? null");
      expect(csharp).to.not.include("u.BotType ?? default");
      expect(csharp).to.not.include("u.BotOwnerId ?? default");
    });

    it("keeps numeric nullish fallbacks unboxed until after coalescing in broad unknown slots", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        class UserSetting {
          EmailAddressVisibility!: int;
        }

        export function run(setting?: UserSetting | null): Record<string, unknown> {
          const entry: Record<string, unknown> = {};
          entry["email_address_visibility"] = setting?.EmailAddressVisibility ?? 1;
          return entry;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include(
        'entry["email_address_visibility"] = setting?.EmailAddressVisibility ?? 1;'
      );
      expect(csharp).not.to.include("(object)(double)(setting?.EmailAddressVisibility");
      expect(csharp).to.not.include("?? (object)(double)1");
    });

    it("preserves runtime-union member numbering across nested array and instanceof fallthrough guards", () => {
      const source = `
        type RequestHandler = (value: string) => void;
        type MiddlewareLike = RequestHandler | Router | readonly MiddlewareLike[];

        class Router {}

        function isMiddlewareHandler(value: MiddlewareLike): value is RequestHandler {
          return typeof value === "function";
        }

        export function flatten(entries: readonly MiddlewareLike[]): readonly (RequestHandler | Router)[] {
          const result: (RequestHandler | Router)[] = [];
          const append = (handler: MiddlewareLike): void => {
            if (Array.isArray(handler)) {
              for (let index = 0; index < handler.length; index += 1) {
                append(handler[index]!);
              }
              return;
            }
            if (handler instanceof Router) {
              result.push(handler);
              return;
            }
            if (!isMiddlewareHandler(handler)) {
              throw new Error("middleware handlers must be functions");
            }
            result.push(handler);
          };
          return result;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include("if (handler.Is1())");
      expect(csharp).to.include(
        "for (int index = 0; index < (handler.As1()).Length; index += 1)"
      );
      expect(csharp).to.not.include(
        "new global::js.Array<global::Tsonic.Internal.Union<object?[], global::System.Action<string>, Router>>((handler.As1())).length"
      );
      expect(csharp).to.not.include("isMiddlewareHandler(handler.Match");
      expect(csharp).to.include("if (handler.Is3())");
      expect(csharp).to.include(
        "Router handler__is_1 = (Router)handler.As3();"
      );
      expect(csharp).to.include("if (!isMiddlewareHandler(handler))");
      expect(csharp).to.include(
        'throw new global::js.Error("middleware handlers must be functions");'
      );
      expect(csharp).to.include(
        "global::Tsonic.Internal.ArrayInterop.WrapArray(result)"
      );
      expect(csharp).to.include("result = __tsonic_arrayWrapper");
    });

    it("prefers assignable conditional supertypes without double runtime-union projection", () => {
      const source = `
        class TemplateValue {}
        class PageValue extends TemplateValue {
          slug: string;
          constructor(slug: string) {
            super();
            this.slug = slug;
          }
        }

        declare function resolve(flag: boolean): TemplateValue;
        declare function consume(value: TemplateValue): void;

        export function run(flag: boolean): void {
          const actual = flag ? new PageValue("home") : resolve(flag);
          consume(actual);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.not.include("actual.Match");
      expect(csharp).to.not.include(")).Match");
      expect(csharp).to.include("consume(actual);");
    });

    it("preserves exact rest arrays when forwarding single spreads into params calls", () => {
      const source = `
        type Handler = () => void;

        class Router {
          get(path: string, ...handlers: Handler[]): this {
            void path;
            void handlers;
            return this;
          }

          use(path: string, ...handlers: Handler[]): this {
            void path;
            void handlers;
            return this;
          }
        }

        export class App extends Router {
          override get(path: string, ...handlers: Handler[]): this {
            return super.get(path, ...handlers);
          }

          override use(path: string, ...handlers: Handler[]): this {
            const args = [path, ...handlers] as [string, ...Handler[]];
            return super.use(...args);
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("base.get(path, handlers)");
      expect(csharp).to.not.include("ToArray((object[])(object)handlers)");
      expect(csharp).to.not.include(
        "new global::js.Array<object>(args).slice(1).toArray()"
      );
      expect(csharp).to.not.include(
        "global::Tsonic.Internal.ArrayInterop.WrapArray(args).slice(1).toArray()"
      );
      expect(csharp).to.not.include("args.slice(1)");
      expect(csharp).to.include("global::System.Linq.Enumerable.Skip(args, 1)");
    });

    it("emits marker-bound rest overload bodies directly without wrapper slicing", () => {
      const source = `
        import { overloads as O } from "@tsonic/core/lang.js";

        export class Values {
          append(item: string): void;
          append(...items: string[]): void;
          append(_value: any, ..._rest: any[]): any {
            throw new Error("stub");
          }

          append_one(item: string): void {
            void item;
          }

          append_many(...items: string[]): void {
            void items;
          }
        }

        O<Values>().method(x => x.append_one).family(x => x.append);
        O<Values>().method(x => x.append_many).family(x => x.append);
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("public void append(string item)");
      expect(csharp).to.include("public void append(params string[] items)");
      expect(csharp).to.not.include("__tsonic_overload_impl_");
      expect(csharp).to.not.include("global::System.Linq.Enumerable.Skip(");
      expect(csharp).to.not.include("new global::js.Array<string>(");
    });

    it("narrows reassigned locals before native array mutation interop calls", () => {
      const source = `
        class Item {
          name: string;

          constructor(name: string) {
            this.name = name;
          }
        }

        export function run(): number {
          const items: Item[] = [];
          let entry = items.find((current) => current.name === "x");
          if (entry === undefined) {
            entry = new Item("x");
            items.push(entry);
          }
          return items.length;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.match(/\.push\((?:\(Item\))?entry\);/);
      expect(csharp).to.not.include(".push((object)entry);");
    });

    it("narrows reassigned member accesses before subsequent reads", () => {
      const source = `
        class Item {
          name: string;

          constructor(name: string) {
            this.name = name;
          }
        }

        declare function consume(item: Item): void;

        class Holder {
          current: Item | undefined;

          setCurrent(name: string): void {
            this.current = new Item(name);
            consume(this.current);
          }
        }

        export function run(): void {
          new Holder().setCurrent("ok");
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("consume(this.current);");
      expect(csharp).not.to.include("consume((object)this.current)");
      expect(csharp).not.to.include("consume(this.current.Value)");
    });

    it("lowers typed object spreads into record-root dictionary results", () => {
      const source = `
        type ApiKeyData = {
          apiKey: string;
          userId: string;
        };

        export function buildResponse(data: ApiKeyData): Record<string, unknown> {
          return { result: "success", msg: "", ...data };
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "global::System.Collections.Generic.Dictionary<string, object?>"
      );
      expect(csharp).to.include('__tmp["result"] = "success"');
      expect(csharp).to.include('__tmp["msg"] = ""');
      expect(csharp).to.include('__tmp["apiKey"] = __spread.apiKey');
      expect(csharp).to.include('__tmp["userId"] = __spread.userId');
    });

    it("lowers dictionary spreads into record-root dictionary results", () => {
      const source = `
        type StringMap = {
          [key: string]: string;
        };

        export function buildResponse(data: StringMap): Record<string, unknown> {
          return { result: "success", ...data, msg: "" };
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("foreach (var __entry in __spread)");
      expect(csharp).to.include("__tmp[__entry.Key] = __entry.Value;");
      expect(csharp).to.include('__tmp["result"] = "success";');
      expect(csharp).to.include('__tmp["msg"] = "";');
    });

    it("uses element access for index-signature property reads and writes", () => {
      const source = `
        export function buildState(): Record<string, unknown> {
          const state: Record<string, unknown> = {};
          state.user_id = "u1";
          state.email = "u@example.com";
          const bot = state.user_id;
          state.is_bot = bot === "u1";
          return state;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include('state["user_id"] = "u1";');
      expect(csharp).to.include('state["email"] = "u@example.com";');
      expect(csharp).to.match(/var bot = .*state\["user_id"\];/);
      expect(csharp).to.match(/state\["is_bot"\] = .*bot.*"u1".*;/);
      expect(csharp).not.to.include("state.user_id");
      expect(csharp).not.to.include("state.email");
      expect(csharp).not.to.include("state.is_bot");
    });
  });
});
