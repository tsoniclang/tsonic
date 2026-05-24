import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("Integration: TSTS blocker regressions", () => {
  it("lowers optional calls returning unconstrained generic nullish values without C# conditional-access nullable synthesis", () => {
    const csharp = compileToCSharp(`
      class Box<K, V> {
        get(_key: K): V | undefined {
          throw new Error("stub");
        }
      }

      export class Holder<K, V> {
        private box: Box<K, V> | undefined;

        get(key: K): V | undefined {
          return this.box?.get(key);
        }
      }
    `);

    expect(csharp).to.include("__tsonic_optional_receiver_");
    expect(csharp).to.not.include("this.box?.get(key)");
  });

  it("keeps explicit array generic call arguments at the source array depth", () => {
    const csharp = compileToCSharp(`
      declare const Symbol: {
        readonly iterator: unique symbol;
      };

      interface Iterator<T> {}
      interface IterableIterator<T> extends Iterator<T> {
        [Symbol.iterator](): IterableIterator<T>;
      }
      interface Iterable<T> {
        [Symbol.iterator](): IterableIterator<T>;
      }

      declare class Assert {
        static Equal<T>(expected: T, actual: T): void;
        static Equal<T>(expected: T[], actual: T[]): void;
      }

      declare const source: Iterable<number>;

      export function run(): void {
        Assert.Equal<readonly number[]>([1, 2], [...source]);
      }
    `);

    expect(csharp).to.include("Assert.Equal<double[]>(");
    expect(csharp).to.include("new double[] { 1, 2 }");
    expect(csharp).to.not.include("new double[][]");
  });

  it("adapts numeric spread-array segments to explicit array generic arguments", () => {
    const csharp = compileToCSharp(`
      declare const Symbol: {
        readonly iterator: unique symbol;
      };

      interface Iterator<T> {}
      interface IterableIterator<T> extends Iterator<T> {
        [Symbol.iterator](): IterableIterator<T>;
      }
      interface Iterable<T> {
        [Symbol.iterator](): IterableIterator<T>;
      }

      declare class Assert {
        static Equal<T>(expected: Iterable<T> | null, actual: Iterable<T> | null): void;
        static Equal<T>(expected: T, actual: T): void;
        static Equal<T>(expected: T[], actual: T[]): void;
      }

      class MultiMap<K, V> {
        static groupBy<K, V>(items: Iterable<V>, groupId: (item: V) => K): MultiMap<K, V> {
          throw new Error("stub");
        }

        get(_key: K): readonly V[] {
          throw new Error("stub");
        }
      }

      export function run(): void {
        const items = [1, 2, 3, 4, 5, 6];
        const grouped = MultiMap.groupBy(items, (item) => item % 2 === 0 ? "even" : "odd");
        Assert.Equal<readonly number[]>([2, 4, 6], [...grouped.get("even")]);
      }
    `);

    expect(csharp).to.include("Assert.Equal<double[]>");
    expect(csharp).to.include("global::System.Linq.Enumerable.Select<int, double>");
    expect(csharp).to.not.include(
      "Assert.Equal<double[]>(new double[] { 2, 4, 6 }, global::System.Linq.Enumerable.ToArray(grouped.get(\"even\")))"
    );
  });

  it("writes back borrowed map array values after length-changing mutations", () => {
    const csharp = compileToCSharp(
      `
        export function append(
          map: Map<string, number[]>,
          key: string,
          value: number
        ): void {
          const existing = map.get(key);
          if (existing !== undefined) {
            existing.push(value);
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("existing = __tsonic_arrayWrapper.toArray();");
    expect(csharp).to.include("map.set(key, existing);");
  });

  it("emits a default throw for exhaustive literal-union switch statements", () => {
    const csharp = compileToCSharp(`
      type Operator = "<" | "<=" | "=" | ">=" | ">";

      export function compare(operator: Operator, cmp: number): boolean {
        switch (operator) {
          case "<":
            return cmp < 0;
          case "<=":
            return cmp <= 0;
          case "=":
            return cmp === 0;
          case ">=":
            return cmp >= 0;
          case ">":
            return cmp > 0;
        }
      }
    `);

    expect(csharp).to.include("default:");
    expect(csharp).to.include(
      'throw new global::System.InvalidOperationException("Unreachable exhaustive switch case.");'
    );
  });

  it("routes string split with RegExp separators through the JS surface", () => {
    const csharp = compileToCSharp(
      `
        const WHITESPACE = /\\s+/;

        export function parts(value: string): string[] {
          return value.trim().split(WHITESPACE);
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::js.String.split");
    expect(csharp).to.include("WHITESPACE");
    expect(csharp).to.include(".From1(WHITESPACE)");
  });

  it("keeps callable and static JS globals on their distinct binding owners", () => {
    const csharp = compileToCSharp(
      `
        export const viaCall = String(123);
        export const viaStatic = String.fromCharCode(72, 105);
        export const viaObject = Object.is(Number.NaN, Number.NaN);
        export const viaNegativeZero = Object.is(0, -0);
        export const viaBigInt = Number(BigInt(2) ** BigInt(10));
        export const viaTextEncoder = new TextEncoder().encode("Hi");
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::js.Globals.String");
    expect(csharp).to.include("global::js.StringConstructor.fromCharCode");
    expect(csharp).to.include("global::js.Object.@is");
    expect(csharp).to.include("-0.0");
    expect(csharp).to.include("global::js.Globals.BigInt");
    expect(csharp).to.include("global::System.Numerics.BigInteger.Pow");
    expect(csharp).to.include("new global::js.TextEncoder()");
    expect(csharp).to.not.include("global::js.StringConstructor((object)");
    expect(csharp).to.not.include(" ** ");
  });

  it("lowers JS number bitwise operators through ECMAScript coercion helpers", () => {
    const csharp = compileToCSharp(
      `
        export const toInt32 = (value: number): number => value | 0;
        export const toUint32 = (value: number): number => value >>> 0;
        export const leftShift = (value: number, shift: number): number => value << shift;
        export const signedRightShift = (value: number, shift: number): number => value >> shift;
        export const bitwiseAnd = (left: number, right: number): number => left & right;
        export const bitwiseXor = (left: number, right: number): number => left ^ right;
        export const bitwiseNot = (value: number): number => ~value;
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::Tsonic.Runtime.Operators.BitwiseOr");
    expect(csharp).to.include(
      "global::Tsonic.Runtime.Operators.UnsignedRightShift"
    );
    expect(csharp).to.include("global::Tsonic.Runtime.Operators.LeftShift");
    expect(csharp).to.include(
      "global::Tsonic.Runtime.Operators.SignedRightShift"
    );
    expect(csharp).to.include("global::Tsonic.Runtime.Operators.BitwiseAnd");
    expect(csharp).to.include("global::Tsonic.Runtime.Operators.BitwiseXor");
    expect(csharp).to.include("global::Tsonic.Runtime.Operators.BitwiseNot");
    expect(csharp).to.not.include("(int)value | (int)0");
    expect(csharp).to.not.include("(int)value >>> (int)0");
  });

  it("emits signed numeric literal unions without leaking anyType into runtime union carriers", () => {
    const csharp = compileToCSharp(`
      export type Comparison = -1 | 0 | 1;

      export const ComparisonLessThan: Comparison = -1;
      export const ComparisonEqual: Comparison = 0;
      export const ComparisonGreaterThan: Comparison = 1;

      export function compareStringsCaseSensitive(a: string, b: string): Comparison {
        if (a < b) return ComparisonLessThan;
        if (a > b) return ComparisonGreaterThan;
        return ComparisonEqual;
      }

      export function getStringComparer(
        ignoreCase: boolean
      ): (a: string, b: string) => Comparison {
        return ignoreCase ? compareStringsCaseSensitive : compareStringsCaseSensitive;
      }
    `);

    expect(csharp).to.include("double compareStringsCaseSensitive");
    expect(csharp).to.include("global::System.Func<string, string, double>");
    expect(csharp).to.not.include("__TsonicUnion");
    expect(csharp).to.not.include("object compareStringsCaseSensitive");
  });

  it("types ECMAScript numeric globals and bigint literals before union adaptation", () => {
    const csharp = compileToCSharp(
      `
        declare class Assert {
          static Equal<T>(expected: T, actual: T): void;
        }

        export interface EvaluatorResult {
          readonly value: string | number | boolean | bigint | undefined;
        }

        export function anyToString(v: EvaluatorResult["value"]): string {
          if (typeof v === "bigint") return v.toString();
          return "";
        }

        export class AnyToStringTests {
          numbers(): void {
            Assert.Equal("NaN", anyToString(NaN));
            Assert.Equal("Infinity", anyToString(Infinity));
          }

          bigints(): void {
            Assert.Equal("42", anyToString(42n));
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::js.Globals.NaN");
    expect(csharp).to.include("global::js.Globals.Infinity");
    expect(csharp).to.include("global::System.Numerics.BigInteger.Parse(\"42\")");
    expect(csharp).to.include(".Is1()");
    expect(csharp).to.include(
      ".ToString(global::System.Globalization.CultureInfo.InvariantCulture)"
    );
    expect(csharp).to.not.include("if (false)");
    expect(csharp).to.not.include(".toString()");
  });

  it("emits literal const strings as compile-time constants for switch labels", () => {
    const csharp = compileToCSharp(`
      export const extensionTs = ".ts";
      export const extensionJs = ".js";

      export function mapExtension(ext: string): string {
        switch (ext) {
          case extensionTs:
            return extensionJs;
          default:
            return "";
        }
      }
    `);

    expect(csharp).to.include('public const string extensionTs = ".ts";');
    expect(csharp).to.include("case extensionTs:");
    expect(csharp).to.not.include("public static readonly string extensionTs");
  });

  it("emits tuple numeric literal element access through ValueTuple members", () => {
    const csharp = compileToCSharp(`
      export function first(pair: [string, string]): string {
        return pair[0];
      }

      export function second(pair: [string, string]): string {
        return pair[1];
      }
    `);

    expect(csharp).to.include("return pair.Item1;");
    expect(csharp).to.include("return pair.Item2;");
    expect(csharp).to.not.include("pair[0]");
    expect(csharp).to.not.include("pair[1]");
  });

  it("adapts Map values when returning readonly map views with readonly value supertypes", () => {
    const csharp = compileToCSharp(
      `
        export class Holder {
          private readonly values = new Map<string, Set<string>>();

          view(): ReadonlyMap<string, ReadonlySet<string>> {
            return this.values;
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("new global::js.ReadonlyMapView");
    expect(csharp).to.include(
      "global::js.ReadonlyMapView<string, global::js.Set<string>, global::js.ReadonlySet<string>>"
    );
    expect(csharp).to.not.include(
      "(global::js.ReadonlyMap<string, global::js.ReadonlySet<string>>)this.values"
    );
  });

  it("does not re-emit inherited discriminant properties narrowed by sub-interfaces", () => {
    const csharp = compileToCSharp(`
      interface GlobElement {
        readonly kind: "slash" | "literal";
      }

      interface SlashElement extends GlobElement {
        kind: "slash";
      }

      interface LiteralElement extends GlobElement {
        kind: "literal";
        value: string;
      }

      type Element = SlashElement | LiteralElement;

      export function slash(): Element {
        return { kind: "slash" };
      }

      export function literal(): Element {
        return { kind: "literal", value: "x" };
      }

      export function text(element: GlobElement): string {
        return element.kind;
      }
    `);

    expect(csharp).to.include("class SlashElement : GlobElement");
    expect(csharp).to.include("class LiteralElement : GlobElement");
    expect(csharp).to.include("public required string kind { get; init; }");
    expect(csharp).to.not.match(
      /class\s+SlashElement\s*:\s*GlobElement[\s\S]*?public\s+required\s+string\s+kind\s*\{/
    );
    expect(csharp).to.not.match(
      /class\s+LiteralElement\s*:\s*GlobElement[\s\S]*?public\s+required\s+string\s+kind\s*\{/
    );
    expect(csharp).to.include("public required string value { get; set; }");
    expect(csharp).to.match(
      /Element\.From\d+\(new SlashElement\s*\{\s*kind = "slash"\s*\}\)/
    );
    expect(csharp).to.match(
      /Element\.From\d+\(new LiteralElement\s*\{\s*kind = "literal", value = "x"\s*\}\)/
    );
    expect(csharp).to.not.match(/new SlashElement\s*\{\s*kind = "literal"/);
    expect(csharp).to.not.match(/new LiteralElement\s*\{\s*kind = "slash"/);
  });

  it("preserves length-changing array mutations performed through helper parameters", () => {
    const csharp = compileToCSharp(
      `
        function append(parts: string[], value: string): void {
          parts.push(value);
        }

        export function run(): string {
          const parts: string[] = [];
          append(parts, "a");
          append(parts, "b");
          return parts.join(",");
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.match(/append\s*\(\s*ref\s+string\[\]\s+parts/);
    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.Push(ref parts, value)"
    );
    expect(csharp).to.include('append(ref parts, "a")');
    expect(csharp).to.include('append(ref parts, "b")');
  });

  it("preserves runtime absence for generic array reads returned as optional values", () => {
    const csharp = compileToCSharp(
      `
        export function singleOrUndefined<T>(slice: readonly T[]): T | undefined {
          return slice.length === 1 ? slice[0] : undefined;
        }

        export function lastOrUndefined<T>(slice: readonly T[]): T | undefined {
          return slice[slice.length - 1];
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("public static object? singleOrUndefined<T>");
    expect(csharp).to.include(
      "slice.Length == 1 ? global::Tsonic.Internal.ArrayInterop.ReadOptionalObject<T>(slice, 0) : default(object)"
    );
    expect(csharp).to.include("public static object? lastOrUndefined<T>");
    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.ReadOptionalObject<T>(slice, slice.Length - 1)"
    );
    expect(csharp).to.not.include("return slice[slice.Length - 1];");
    expect(csharp).to.include("internal static class ArrayInterop");
  });

  it("emits numeric generic constraints as nullable-capable value constraints for optional element reads", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        export class NumericBox<T extends number> {
          data: T[];

          constructor(data: T[]) {
            this.data = data;
          }

          at(index: int): T | undefined {
            return this.data[index];
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "where T : struct, global::System.Numerics.INumber<T>"
    );
    expect(csharp).to.include("public T? at(int index)");
    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.ReadOptionalValue<T>(this.data, index)"
    );
  });

  it("keeps generic optional callback results in an object carrier until nullish checks complete", () => {
    const csharp = compileToCSharp(
      `
        export function mapNonNil<T, U>(
          slice: readonly T[],
          f: (item: T) => U | undefined | null
        ): readonly U[] {
          const out: U[] = [];
          for (const item of slice) {
            const mapped = f(item);
            if (mapped !== undefined && mapped !== null) {
              out.push(mapped);
            }
          }
          return out;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::System.Func<T, object?> f");
    expect(csharp).to.include("var mapped = ((global::System.Func<T, object?>)f)(item);");
    expect(csharp).to.include("push((U)mapped)");
    expect(csharp).to.not.include(
      "var mapped = global::Tsonic.Internal.GenericOptional.FromObject<U>"
    );
  });

  it("routes Array.prototype.flatMap through the JS array surface", () => {
    const csharp = compileToCSharp(
      `
        export function expand(values: readonly number[]): readonly number[] {
          return values.flatMap((value) => [value, value * 10]);
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.WrapArray(values).flatMap"
    );
    expect(csharp).to.include(".toArray()");
    expect(csharp).to.not.include(".SelectMany(");
  });

  it("does not re-adapt contextualized generic array call returns after callback widening", () => {
    const csharp = compileToCSharp(
      `
        declare class Assert {
          static Equal<T>(expected: T, actual: T): void;
        }

        export function map<T, U>(
          arr: readonly T[],
          f: (item: T) => U
        ): readonly U[] {
          const out: U[] = [];
          for (const item of arr) {
            out.push(f(item));
          }
          return out;
        }

        export class Tests {
          map_applies_transform(): void {
            Assert.Equal<readonly number[]>([2, 4, 6], map([1, 2, 3], (n) => n * 2));
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "Assert.Equal<double[]>(new double[] { 2, 4, 6 }, global::Test.test.map(new int[] { 1, 2, 3 }, (int n) => (double)(n * 2)))"
    );
    expect(csharp).to.not.include(
      "global::System.Linq.Enumerable.Select<int, double>(global::Test.test.map"
    );
  });

  it("emits explicit type arguments when optional generic callback results erase inference", () => {
    const csharp = compileToCSharp(
      `
        declare class Assert {
          static Equal<T>(expected: T, actual: T): void;
        }

        export function mapNonNil<T, U>(
          arr: readonly T[],
          f: (item: T) => U | undefined
        ): readonly U[] {
          const out: U[] = [];
          for (const item of arr) {
            const mapped = f(item);
            if (mapped !== undefined) {
              out.push(mapped);
            }
          }
          return out;
        }

        export class Tests {
          map_non_nil_drops_undefined(): void {
            Assert.Equal<readonly number[]>(
              [2],
              mapNonNil([1, 2, 3], (n) => (n % 2 === 0 ? n : undefined)),
            );
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::Test.test.mapNonNil<int, double>(");
    expect(csharp).to.include(
      "(int n) => n % 2 == 0 ? (double?)n : default(double?)"
    );
  });
});
