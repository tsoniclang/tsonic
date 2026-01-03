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
  Console.writeLine("=== Test 1: Chained property ===");

  const greeting = getGreeting();
  // DETERMINISTIC TYPING: string.length should be declared as int in globals
  // so no cast should be needed here.
  const n: int = greeting.length;

  Console.writeLine(`greeting.length = ${n}`);
  Console.writeLine(`doubled = ${doubleInt(n)}`);
  Console.writeLine("");
}

// =============================================================================
// Test 2: Generic inference preserves int
// =============================================================================

function identity<T>(x: T): T {
  return x;
}

function testGenericInference(): void {
  Console.writeLine("=== Test 2: Generic inference ===");

  const a: int = 42;
  const b: int = identity(a);

  Console.writeLine(`a = ${a}`);
  Console.writeLine(`identity(a) = ${b}`);
  Console.writeLine(`doubled = ${doubleInt(b)}`);
  Console.writeLine("");
}

// =============================================================================
// Test 3: Generic function with long
// =============================================================================

function testGenericLong(): void {
  Console.writeLine("=== Test 3: Generic long ===");

  const a: long = 1000000000 as long;
  const b: long = identity(a);

  Console.writeLine(`a = ${a}`);
  Console.writeLine(`identity(a) = ${b}`);
  Console.writeLine(`doubled = ${doubleLong(b)}`);
  Console.writeLine("");
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
  Console.writeLine("=== Test 4: Generic container ===");

  const intBox = createIntBox(100);
  const intVal: int = intBox.value;

  Console.writeLine(`intBox.value = ${intVal}`);
  Console.writeLine(`doubled = ${doubleInt(intVal)}`);

  const longBox = createLongBox(9999999999 as long);
  const longVal: long = longBox.value;

  Console.writeLine(`longBox.value = ${longVal}`);
  Console.writeLine(`doubled = ${doubleLong(longVal)}`);
  Console.writeLine("");
}

// =============================================================================
// Test 5: Nested generic access
// =============================================================================

function getBoxValue<T>(box: Box<T>): T {
  return box.value;
}

function testNestedGeneric(): void {
  Console.writeLine("=== Test 5: Nested generic ===");

  const box = createIntBox(42);
  const val: int = getBoxValue(box);

  Console.writeLine(`getBoxValue(box) = ${val}`);
  Console.writeLine(`doubled = ${doubleInt(val)}`);
  Console.writeLine("");
}

// =============================================================================
// Main
// =============================================================================

Console.writeLine("=== Deterministic Typing Tests ===");
Console.writeLine("");

testChainedProperty();
testGenericInference();
testGenericLong();
testGenericContainer();
testNestedGeneric();

Console.writeLine("=== All tests completed ===");
