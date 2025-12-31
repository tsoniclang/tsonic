/**
 * E2E Test: Action and Func callback types
 *
 * Tests that callback function types are correctly emitted as:
 * - Action<T> for (x: T) => void
 * - Func<T, TResult> for (x: T) => TResult
 */

import { Console } from "@tsonic/dotnet/System.js";
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";
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
  const result = new List<int>();
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
  const result = new List<int>();
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
    callback(items[i], i);
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

  const numbers = new List<int>();
  numbers.add(1);
  numbers.add(2);
  numbers.add(3);
  numbers.add(4);
  numbers.add(5);

  // Test Action<int>
  Console.writeLine("forEach:");
  forEach(numbers, n => {
    Console.writeLine(`  ${n}`);
  });

  // Test Func<int, int>
  const doubled = mapToInt(numbers, n => n * 2);
  Console.writeLine(`map (doubled): count = ${doubled.count}`);

  // Test Func<int, bool>
  const evens = filter(numbers, n => n % 2 === 0);
  Console.writeLine(`filter (evens): count = ${evens.count}`);

  // Test Action<int, int>
  Console.writeLine("forEachWithIndex:");
  forEachWithIndex(numbers, (item, index) => {
    Console.writeLine(`  [${index}] = ${item}`);
  });

  // Test Func<int, int, int>
  const sum = reduce(numbers, (acc, n) => acc + n, 0);
  Console.writeLine(`reduce (sum): ${sum}`);
}
