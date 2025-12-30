/**
 * E2E Test: Action and Func callback types
 *
 * Tests that callback function types are correctly emitted as:
 * - Action<T> for (x: T) => void
 * - Func<T, TResult> for (x: T) => TResult
 */

import { Console } from "@tsonic/dotnet/System";
import { List } from "@tsonic/dotnet/System.Collections.Generic";
import { int } from "@tsonic/core/types.js";

// Action<T> - callback with no return value
export function forEach(items: List<int>, callback: (item: int) => void): void {
  const len = items.count;
  for (let i = 0; i < len; i++) {
    callback(items[i]);
  }
}

// Func<T, TResult> - callback with return value
export function mapToInt(
  items: List<int>,
  transform: (item: int) => int
): List<int> {
  const result = new List<int>() as List<int>;
  const len = items.count;
  for (let i = 0; i < len; i++) {
    result.add(transform(items[i]));
  }
  return result;
}

// Func<T, bool> - predicate callback
export function filter(
  items: List<int>,
  predicate: (item: int) => boolean
): List<int> {
  const result = new List<int>() as List<int>;
  const len = items.count;
  for (let i = 0; i < len; i++) {
    const item = items[i];
    if (predicate(item)) {
      result.add(item);
    }
  }
  return result;
}

// Multi-param Action<T1, T2>
export function forEachWithIndex(
  items: List<int>,
  callback: (item: int, index: int) => void
): void {
  const len = items.count;
  for (let i = 0; i < len; i++) {
    callback(items[i], i as int);
  }
}

// Multi-param Func<T1, T2, TResult>
export function reduce(
  items: List<int>,
  reducer: (acc: int, item: int) => int,
  initial: int
): int {
  let result = initial;
  const len = items.count;
  for (let i = 0; i < len; i++) {
    result = reducer(result, items[i]);
  }
  return result;
}

// Entry point
export function main(): void {
  Console.writeLine("=== Action/Func Callback Tests ===");

  const numbers = new List<int>() as List<int>;
  numbers.add(1 as int);
  numbers.add(2 as int);
  numbers.add(3 as int);
  numbers.add(4 as int);
  numbers.add(5 as int);

  // Test Action<int>
  Console.writeLine("forEach:");
  forEach(numbers, (n: int): void => {
    Console.writeLine(`  ${n}`);
  });

  // Test Func<int, int>
  const doubled = mapToInt(numbers, (n: int) => (n * 2) as int);
  Console.writeLine(`map (doubled): count = ${doubled.count}`);

  // Test Func<int, bool>
  const evens = filter(numbers, (n: int) => n % 2 === 0);
  Console.writeLine(`filter (evens): count = ${evens.count}`);

  // Test Action<int, int>
  Console.writeLine("forEachWithIndex:");
  forEachWithIndex(numbers, (item: int, index: int): void => {
    Console.writeLine(`  [${index}] = ${item}`);
  });

  // Test Func<int, int, int>
  const sum = reduce(numbers, (acc: int, n: int) => (acc + n) as int, 0 as int);
  Console.writeLine(`reduce (sum): ${sum}`);
}
