import { describe, it } from "mocha";
import { expect } from "chai";
import { compileProjectToCSharp, compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Regression Coverage", () => {
    it("passes contextual string expectations through array element assignments", () => {
      const source = `
        export function main(): string[] {
          const chars: string[] = ["", ""];
          const source = "ab";
          chars[0] = source[0];
          return chars;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include('string[] chars = new string[] { "", "" };');
      expect(csharp).to.include(
        "chars[0] = ((global::System.Func<string, int, string>)"
      );
      expect(csharp).to.include("__tsonic_index < __tsonic_string.Length");
      expect(csharp).to.include("__tsonic_string[__tsonic_index].ToString()");
    });

    it("default-initializes explicit locals without initializers", () => {
      const source = `
        export function pick(flag: boolean): string {
          let name: string;
          if (flag) {
            name = "ok";
          } else {
            name = "no";
          }
          return name;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("string name = default(string);");
    });

    it("prefers typed CLR option overloads over erased unknown for object literals", () => {
      const source = `
        declare class MkdirOptions {
          readonly __tsonic_type_nodejs_MkdirOptions: never;
          recursive?: boolean;
        }

        declare const fs: {
          mkdirSync(path: string, options: MkdirOptions): void;
          mkdirSync(path: string, recursive?: boolean): void;
          mkdirSync(path: string, options: unknown): void;
        };

        export function ensure(dir: string): void {
          fs.mkdirSync(dir, { recursive: true });
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "fs.mkdirSync(dir, new global::Test.MkdirOptions"
      );
      expect(csharp).not.to.include("Dictionary<string, object?>");
    });

    it("uses explicit dictionary construction for dictionary object literal arguments", () => {
      const source = `
        declare function deepEqual(left: Record<string, string>, right: Record<string, string>): void;

        export function run(): void {
          deepEqual({ name: "Alice" }, { name: "Bob" });
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "new global::System.Collections.Generic.Dictionary<string, string>"
      );
      expect(csharp).to.include('["name"] = "Alice"');
      expect(csharp).to.include('["name"] = "Bob"');
    });

    it("emits indexer access for alias-wrapped string dictionaries", () => {
      const source = `
        interface SettingsMap {
          [key: string]: string;
        }

        declare function load(): SettingsMap;

        export function readSetting(): string | undefined {
          const settings = load();
          return settings["waiting_period_threshold"];
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include('return settings["waiting_period_threshold"];');
      expect(csharp).not.to.include("settings.waiting_period_threshold");
    });

    it("emits indexer access for generic-return dictionary aliases after null narrowing", () => {
      const source = `
        type SettingsMap = { [key: string]: string };

        declare const JsonSerializer: {
          Deserialize<T>(json: string): T | undefined;
        };

        export function readSetting(json: string): string | undefined {
          const settingsOrNull = JsonSerializer.Deserialize<SettingsMap>(json);
          if (settingsOrNull === undefined) {
            return undefined;
          }
          const settings = settingsOrNull;
          return settings["waiting_period_threshold"];
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include('return settings["waiting_period_threshold"];');
      expect(csharp).not.to.include("settings.waiting_period_threshold");
    });

    it("passes broad object call expectations through narrowed record locals without storage casts", () => {
      const source = `
        const isObject = (value: unknown): value is Record<string, string | number> => {
          return value !== null && typeof value === "object" && !Array.isArray(value);
        };

        declare function loadRoot(): Record<string, string | number>;

        export function main(): void {
          const root = loadRoot();
          if (!isObject(root)) return;
          const first = Object.entries(root)[0];
          if (first === undefined) return;
          const [key, value] = first;
          if (typeof value === "number") {
            console.log(key, value.toString());
          } else if (typeof value === "string") {
            console.log(key, value.toUpperCase());
          }
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include("global::js.Object.entries(root)");
      expect(csharp).not.to.include(
        "(global::System.Collections.Generic.Dictionary<string, object?>)root"
      );
    });

    it("emits object literals with exact numeric properties after nullish fallback narrowing", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function parseRole(raw: string): int | undefined;

        export function run(raw: string): int {
          const parsedInviteAsRole = parseRole(raw);
          const inviteAsRole = parsedInviteAsRole ?? (400 as int);
          const input = {
            inviteAsRole,
          };
          return input.inviteAsRole;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("inviteAsRole = inviteAsRole");
      expect(csharp).not.to.include("Object literal cannot be synthesized");
    });

    it("preserves optional value-type properties in object literals", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function parseLimit(raw: string, fallback: int): int;

        type Options = {
          limit?: int;
        };

        export function run(limitRaw: string | undefined): int {
          const limit = limitRaw ? parseLimit(limitRaw, 100 as int) : undefined;
          const options: Options = { limit };
          return options.limit ?? (0 as int);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("limit = limit");
      expect(csharp).not.to.include("limit = limit.Value");
      expect(csharp).to.include("int? limit =");
      expect(csharp).not.to.include("var limit =");
    });

    it("preserves optional exact-numeric arguments for function-valued calls", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        type Query = {
          limit?: int;
        };

        declare function takeDeclared(value?: int): void;

        export function run(query: Query): void {
          const takeLocal = (value?: int): void => {};
          const takeTyped: (value?: int) => void = (value?: int): void => {};

          takeDeclared(query.limit);
          takeLocal(query.limit);
          takeTyped(query.limit);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("takeDeclared(query.limit);");
      expect(csharp).to.include("takeLocal(query.limit);");
      expect(csharp).to.include("takeTyped(query.limit);");
      expect(csharp).not.to.include("takeDeclared(query.limit.Value)");
      expect(csharp).not.to.include("takeLocal(query.limit.Value)");
      expect(csharp).not.to.include("takeTyped(query.limit.Value)");
    });

    it("fills omitted optional arguments for imported function-valued object members", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/lib.ts": `
            import type { int } from "@tsonic/core/types.js";

            export const api = {
              take(value?: int): int {
                return value ?? (0 as int);
              },
            };
          `,
          "src/index.ts": `
            import type { int } from "@tsonic/core/types.js";
            import { api } from "./lib.js";

            export function run(): int {
              return api.take();
            }
          `,
        },
        "src/index.ts"
      );

      expect(csharp).not.to.include("api.take();");
      expect(csharp).to.include("api.take(default(int?))");
    });

    it("emits IterableIterator generic class methods as direct enumerable yields", () => {
      const source = `
        export class Box<T> {
          *values(value: T): IterableIterator<T> {
            yield value;
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "global::System.Collections.Generic.IEnumerable<T> values(T value)"
      );
      expect(csharp).to.include("yield return value;");
      expect(csharp).not.to.include("Box__values_exchange");
    });

    it("emits simple Generator generic class methods as direct enumerable yields", () => {
      const source = `
        export class Box<T> {
          *values(value: T): Generator<T, undefined, undefined> {
            yield value;
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "global::System.Collections.Generic.IEnumerable<T> values(T value)"
      );
      expect(csharp).to.include("yield return value;");
      expect(csharp).not.to.include("Box__values_exchange");
      expect(csharp).not.to.include("global::Generator");
    });

    it("emits generator function-expression IIFEs through local iterator functions instead of raw lambdas", () => {
      const source = `
        export class Box<T> {
          values(): IterableIterator<T> {
            return (function* (self: Box<T>): Generator<T, undefined, undefined> {
              for (const value of self.items()) {
                yield value;
              }
            })(this);
          }

          *items(): IterableIterator<T> {
            yield* [] as T[];
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "global::System.Collections.Generic.IEnumerable<T> __tsonic_generator_expr()"
      );
      expect(csharp).to.include("return __tsonic_generator_expr();");
      expect(csharp).to.include(
        "((global::System.Func<Box<T>, global::System.Collections.Generic.IEnumerable<T>>)"
      );
      expect(csharp).to.include("yield return value;");
    });

    it("preserves generic target assertions after iterable narrowing", () => {
      const source = `
        function isIterableObject(value: unknown): value is Iterable<unknown> {
          return true;
        }

        export function first<T>(item: unknown): T | undefined {
          if (isIterableObject(item)) {
            for (const value of item as Iterable<T>) {
              return value;
            }
          }
          return undefined;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "foreach (var value in (global::System.Collections.Generic.IEnumerable<T>)item)"
      );
    });

    it("preserves class-generic iterable assertions after iterable narrowing", () => {
      const source = `
        function isIterableObject(value: unknown): value is Iterable<unknown> {
          return true;
        }

        export class Box<T> {
          first(item: unknown): T | undefined {
            if (isIterableObject(item)) {
              for (const value of item as Iterable<T>) {
                return value;
              }
            }
            return undefined;
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "foreach (var value in (global::System.Collections.Generic.IEnumerable<T>)item)"
      );
    });

    it("preserves class-generic iterable assertions under the js surface", () => {
      const source = `
        function isIterableObject(value: unknown): value is Iterable<unknown> {
          return true;
        }

        export class Box<T> {
          first(item: unknown): T | undefined {
            if (isIterableObject(item)) {
              for (const value of item as Iterable<T>) {
                return value;
              }
            }
            return undefined;
          }
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include(
        "foreach (var value in (global::System.Collections.Generic.IEnumerable<T>)item)"
      );
    });

    it("preserves narrowed iterable casts in for-of loops", () => {
      const source = `
        function isIterableObject(value: unknown): value is Iterable<unknown> {
          return true;
        }

        export function first(value: unknown): unknown {
          if (isIterableObject(value)) {
            for (const item of value) {
              return item;
            }
          }
          return undefined;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include(
        "foreach (var item in (global::System.Collections.Generic.IEnumerable<object?>)value)"
      );
    });

    it("casts structural receiver assertions before well-known-symbol property reads", () => {
      const source = `
        export function getIterator(source: Iterable<string> | ArrayLike<string>): unknown {
          const iterator = (source as { readonly [Symbol.iterator]?: unknown })[Symbol.iterator];
          return iterator;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.match(
        /var iterator = (?:\(object\??\))?\(\((?:global::[A-Za-z0-9_.]+)?__Anon_[A-Za-z0-9_]+\)source\)\.__tsonic_symbol_iterator;/
      );
      expect(csharp).not.to.match(/var iterator = \(object\??\)\(object\??\)/);
    });

    it("keeps nullable value unwraps on the raw local instead of layering casts before .Value", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function parsePostIdRequired(): int | undefined;
        declare function unwrapInt(value: int): int;

        export function run(): int {
          const postIdRaw = parsePostIdRequired();
          if (postIdRaw === undefined) {
            return 0 as int;
          }
          return unwrapInt(postIdRaw);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("return unwrapInt(postIdRaw.Value);");
      expect(csharp).not.to.include("((int)(object)postIdRaw).Value");
    });

    it("does not append .Value after conditional materialization already yields a concrete value type", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        export function resolveWriteLength(lengthOrEncoding?: int | string): int {
          return lengthOrEncoding === undefined || typeof lengthOrEncoding === "string"
            ? 0 as int
            : lengthOrEncoding;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.not.include(".Value");
      expect(csharp).to.include(
        "return ((global::System.Object)(lengthOrEncoding)) == null || ((global::System.Object)(lengthOrEncoding)) != null && lengthOrEncoding.Is2() ? 0 : (lengthOrEncoding.As1());"
      );
    });

    it("omits fabricated nullable defaults for direct calls with authored default parameters", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        class DelayBox {
          wait(delay: int = 1 as int): int {
            return delay;
          }
        }

        function readDelay(delay: int = 0 as int): int {
          return delay;
        }

        export function run(): int {
          return new DelayBox().wait() + readDelay();
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("return new DelayBox().wait() + readDelay();");
      expect(csharp).not.to.include("wait(default(int?))");
      expect(csharp).not.to.include("readDelay(default(int?))");
    });

    it("preserves explicit undefined semantics for authored default parameters", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        class DelayBox {
          wait(delay: int = 1 as int): int {
            return delay;
          }
        }

        export function run(delay?: int): int {
          return new DelayBox().wait(delay);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("public int wait(int? delay = default)");
      expect(csharp).to.include("int __defaulted_delay = delay ?? 1;");
      expect(csharp).to.include("return __defaulted_delay;");
      expect(csharp).to.include("return new DelayBox().wait(delay);");
    });

    it("preserves nullable shadow storage for null-valued parameter defaults", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        class Reader {
          read(position: int | null = null): int | null {
            return position;
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("public int? read(int? position = default)");
      expect(csharp).to.include(
        "int? __defaulted_position = position ?? null;"
      );
      expect(csharp).to.include("return __defaulted_position;");
    });

    it("applies authored constructor defaults before body assignments", () => {
      const source = `
        class PatternBox {
          flags: string;

          constructor(flags: string = "") {
            this.flags = flags;
          }
        }

        export function run(): string {
          return new PatternBox().flags;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("public PatternBox(string? flags = default)");
      expect(csharp).to.include('string __defaulted_flags = flags ?? "";');
      expect(csharp).to.include("this.flags = __defaulted_flags;");
    });

    it("single-evaluates generic nullish fallbacks instead of emitting raw ??", () => {
      const source = `
        export class Box<T> {
          stringify(value: T): string {
            return String(value ?? "");
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.not.include('value ?? ""');
      expect(csharp).to.include(
        '((global::System.Func<T, global::Tsonic.Internal.Union<string, T>>)((T __tsonic_nullish_value) => (object)__tsonic_nullish_value == null ? global::Tsonic.Internal.Union<string, T>.From1("") : global::Tsonic.Internal.Union<string, T>.From2(__tsonic_nullish_value)))(value)'
      );
    });

    it("materializes generic array assertions instead of emitting raw array casts", () => {
      const source = `
        declare class List<T> {
          ToArray(): T[];
        }

        export function run<TResult>(values: List<unknown>): TResult[] {
          return values.ToArray() as TResult[];
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("global::System.Linq.Enumerable.Select");
      expect(csharp).to.include("global::System.Linq.Enumerable.ToArray");
      expect(csharp).to.include("(TResult)__item");
      expect(csharp).not.to.include("return (TResult[])values.ToArray();");
    });

    it("lowers async generator class methods without raw AsyncGenerator return types", () => {
      const source = `
        export class TimersPromises {
          async *setInterval(
            value?: string
          ): AsyncGenerator<string, void> {
            while (true) {
              yield value ?? "tick";
            }
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).not.to.include(
        "Task<global::AsyncGenerator<string, object, object>>"
      );
      expect(csharp).to.include(
        "public async global::System.Collections.Generic.IAsyncEnumerable<string> setInterval"
      );
      expect(csharp).to.include('yield return value ?? "tick";');
      expect(csharp).not.to.include("TimersPromises__setInterval_exchange");
    });

    it("contextualizes numeric nullish fallbacks to the result type", () => {
      const csharp = compileToCSharp(`
        declare function readCount(): number | undefined;

        export function run(): number {
          return (readCount() ?? 0) + 1;
        }
      `);

      expect(csharp).to.match(/\?\?\s*(?:0|0d|\(double\)0)/);
      expect(csharp).to.match(/\+\s*(?:1|1d|\(double\)1)/);
    });
  });
});
