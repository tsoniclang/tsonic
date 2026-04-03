import type { int, JsValue } from "@tsonic/core/types.js";

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

export class Array<T = JsValue> {
  public static from(source: string): string[];
  public static from<TResult>(
    source: string,
    mapfn: (value: string, index: int) => TResult
  ): TResult[];
  public static from<T>(source: Iterable<T>): T[];
  public static from<T, TResult>(
    source: Iterable<T>,
    mapfn: (value: T, index: int) => TResult
  ): TResult[];
  public static from<T, TResult>(
    source: string | Iterable<T>,
    mapfn?:
      | ((value: string, index: int) => TResult)
      | ((value: T, index: int) => TResult)
  ): string[] | T[] | TResult[] {
    if (typeof source === "string") {
      if (mapfn === undefined) {
        return mapString(source);
      }

      return mapStringMapped(
        source,
        mapfn as (value: string, index: int) => TResult
      );
    }

    if (mapfn === undefined) {
      return mapIterable(source);
    }

    return mapIterableMapped(
      source,
      mapfn as (value: T, index: int) => TResult
    );
  }
}
