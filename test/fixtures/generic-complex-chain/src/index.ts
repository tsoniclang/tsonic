import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

interface Functor<T> {
  map<U>(fn: (x: T) => U): Functor<U>;
}

class Maybe<T> implements Functor<T> {
  private value: T | null;

  constructor(value: T | null) {
    this.value = value;
  }

  static just<T>(value: T): Maybe<T> {
    return new Maybe(value);
  }

  static nothing<T>(): Maybe<T> {
    return new Maybe<T>(null);
  }

  map<U>(fn: (x: T) => U): Maybe<U> {
    if (this.value === null) {
      return Maybe.nothing<U>();
    }
    return Maybe.just(fn(this.value));
  }

  flatMap<U>(fn: (x: T) => Maybe<U>): Maybe<U> {
    if (this.value === null) {
      return Maybe.nothing<U>();
    }
    return fn(this.value);
  }

  getOrElse(defaultValue: T): T {
    return this.value !== null ? this.value : defaultValue;
  }
}

export function main(): void {
  // Test chained generics with type changes
  const result = Maybe.just<int>(5 as int)
    .map((x: int): int => (x * 2) as int)
    .map((x: int): string => `Value: ${x}`)
    .getOrElse("Nothing");

  Console.writeLine(result);

  // Test nothing case
  const nothing = Maybe.nothing<int>()
    .map((x: int): int => (x * 2) as int)
    .getOrElse(0 as int);

  Console.writeLine(`Nothing default: ${nothing}`);

  // Test flatMap
  const flatMapped = Maybe.just<int>(10 as int)
    .flatMap((x: int): Maybe<int> => Maybe.just((x + 5) as int))
    .getOrElse(0 as int);

  Console.writeLine(`FlatMapped: ${flatMapped}`);
}
