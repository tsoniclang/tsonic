import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Generic function type aliases
type Predicate<T> = (x: T) => boolean;
type Transform<T, U> = (x: T) => U;
type Reducer<T, A> = (acc: A, item: T) => A;

// Functions using type aliases
function filter<T>(arr: T[], pred: Predicate<T>): T[] {
  const result: T[] = [];
  for (const item of arr) {
    if (pred(item)) {
      result.push(item);
    }
  }
  return result;
}

function mapArray<T, U>(arr: T[], fn: Transform<T, U>): U[] {
  const result: U[] = [];
  for (const item of arr) {
    result.push(fn(item));
  }
  return result;
}

function reduce<T, A>(arr: T[], fn: Reducer<T, A>, initial: A): A {
  let acc = initial;
  for (const item of arr) {
    acc = fn(acc, item);
  }
  return acc;
}

export function main(): void {
  const nums: int[] = [1 as int, 2 as int, 3 as int, 4 as int, 5 as int];

  const evens = filter(nums, (x: int): boolean => x % 2 === 0);
  Console.writeLine(`Evens count: ${evens.length}`);

  const doubled = mapArray(nums, (x: int): int => (x * 2) as int);
  Console.writeLine(`First doubled: ${doubled[0]}`);

  const sum = reduce(
    nums,
    (acc: int, x: int): int => (acc + x) as int,
    0 as int
  );
  Console.writeLine(`Sum: ${sum}`);
}
