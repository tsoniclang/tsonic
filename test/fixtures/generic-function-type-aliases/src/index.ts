import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Generic function type aliases
type Predicate<T> = (x: T) => boolean;
type Transform<T, U> = (x: T) => U;
type Comparer<T> = (a: T, b: T) => int;

// Functions using type aliases
function test<T>(value: T, pred: Predicate<T>): boolean {
  return pred(value);
}

function transform<T, U>(value: T, fn: Transform<T, U>): U {
  return fn(value);
}

function compare<T>(a: T, b: T, cmp: Comparer<T>): int {
  return cmp(a, b);
}

export function main(): void {
  // Test predicate type alias - T inferred from 4
  const isEven = test(4, x => x % 2 === 0);
  Console.writeLine(`Is 4 even: ${isEven}`);

  // Test transform type alias - types inferred from arguments
  const doubled = transform(5, x => x * 2);
  Console.writeLine(`5 doubled: ${doubled}`);

  // Test comparer type alias - T inferred from arguments
  const cmpResult = compare(10, 5, (a, b) => a - b);
  Console.writeLine(`Compare 10 vs 5: ${cmpResult}`);
}
