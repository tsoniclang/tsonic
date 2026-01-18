/**
 * Deterministic IR Typing Ergonomics Tests
 *
 * These tests verify that the deterministic typing approach maintains
 * good ergonomics for common patterns while preserving CLR type brands.
 */

import { Console } from "@tsonic/dotnet/System.js";
import { int, long } from "@tsonic/core/types.js";

// Helper functions to "prove" types by requiring specific CLR types
function doubleInt(n: int): int {
  return n * 2;
}

function doubleLong(n: long): long {
  return n * 2;
}

// =============================================================================
// Test 1: Chained property call preserves types
// =============================================================================

function getGreeting(): string {
  return "Hello, World!";
}

function testChainedProperty(): void {
  Console.WriteLine("=== Test 1: Chained property ===");

  const greeting = getGreeting();
  // DETERMINISTIC TYPING: string.Length should be declared as int in globals
  // so no cast should be needed here.
  const n: int = greeting.Length;

  Console.WriteLine(`greeting.length = ${n}`);
  Console.WriteLine(`doubled = ${doubleInt(n)}`);
  Console.WriteLine("");
}

// =============================================================================
// Test 2: Generic inference preserves int
// =============================================================================

function identity<T>(x: T): T {
  return x;
}

function testGenericInference(): void {
  Console.WriteLine("=== Test 2: Generic inference ===");

  const a: int = 42;
  const b: int = identity(a);

  Console.WriteLine(`a = ${a}`);
  Console.WriteLine(`identity(a) = ${b}`);
  Console.WriteLine(`doubled = ${doubleInt(b)}`);
  Console.WriteLine("");
}

// =============================================================================
// Test 3: Generic function with long
// =============================================================================

function testGenericLong(): void {
  Console.WriteLine("=== Test 3: Generic long ===");

  const a: long = 1000000000;
  const b: long = identity(a);

  Console.WriteLine(`a = ${a}`);
  Console.WriteLine(`identity(a) = ${b}`);
  Console.WriteLine(`doubled = ${doubleLong(b)}`);
  Console.WriteLine("");

  let nextId: long = 1;
  nextId = nextId + 1;
  if (nextId === 0) {
    throw new Error("unreachable");
  }
}

// =============================================================================
// Test 4: Generic container access
// =============================================================================

interface Box<T> {
  value: T;
}

function createIntBox(value: int): Box<int> {
  return { value };
}

function createLongBox(value: long): Box<long> {
  return { value };
}

function testGenericContainer(): void {
  Console.WriteLine("=== Test 4: Generic container ===");

  const intBox = createIntBox(100);
  const intVal: int = intBox.value;

  Console.WriteLine(`intBox.value = ${intVal}`);
  Console.WriteLine(`doubled = ${doubleInt(intVal)}`);

  const longBox = createLongBox(9999999999 as long);
  const longVal: long = longBox.value;

  Console.WriteLine(`longBox.value = ${longVal}`);
  Console.WriteLine(`doubled = ${doubleLong(longVal)}`);
  Console.WriteLine("");
}

// =============================================================================
// Test 5: Nested generic access
// =============================================================================

function getBoxValue<T>(box: Box<T>): T {
  return box.value;
}

function testNestedGeneric(): void {
  Console.WriteLine("=== Test 5: Nested generic ===");

  const box = createIntBox(42);
  const val: int = getBoxValue(box);

  Console.WriteLine(`getBoxValue(box) = ${val}`);
  Console.WriteLine(`doubled = ${doubleInt(val)}`);
  Console.WriteLine("");
}

// =============================================================================
// Main
// =============================================================================

Console.WriteLine("=== Deterministic Typing Tests ===");
Console.WriteLine("");

testChainedProperty();
testGenericInference();
testGenericLong();
testGenericContainer();
testNestedGeneric();

Console.WriteLine("=== All tests completed ===");
