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
});
