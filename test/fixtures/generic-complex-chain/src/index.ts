import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

class Functor<T> {
  map<U>(fn: (x: T) => U): Functor<U> {
    throw new Error("Not implemented");
  }
}

class Maybe<T> extends Functor<T> {
  private value: T | null;

  constructor(value: T | null) {
    super();
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
  const result = Maybe.just(5)
    .map((x) => x * 2)
    .map((x) => `Value: ${x}`)
    .getOrElse("Nothing");

  Console.writeLine(result);

  // Test nothing case - need explicit type param since no argument to infer from
  const nothing = Maybe.nothing<int>()
    .map((x) => x * 2)
    .getOrElse(0);

  Console.writeLine(`Nothing default: ${nothing}`);

  // Test flatMap
  const flatMapped = Maybe.just(10)
    .flatMap((x) => Maybe.just(x + 5))
    .getOrElse(0);

  Console.writeLine(`FlatMapped: ${flatMapped}`);
}
