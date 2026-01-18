/**
 * Generic CLR Type Substitution E2E Test
 *
 * Tests that CLR type aliases (int, long, byte) are preserved
 * when accessed through generic type parameters.
 *
 * Box<int>.value should return `int`, not `number`
 */

import { Console } from "@tsonic/dotnet/System.js";
import { int, long } from "@tsonic/core/types.js";

// Generic container interface
interface Box<T> {
  value: T;
  label: string;
}

// Function returning Box<int>
function createIntBox(n: int, label: string): Box<int> {
  return { value: n, label: label };
}

// Function returning Box<long>
function createLongBox(n: long, label: string): Box<long> {
  return { value: n, label: label };
}

// Generic function with CLR type parameter
function getBoxValue<T>(box: Box<T>): T {
  return box.value;
}

// Function that uses the value (proves type is correct)
function doubleInt(n: int): int {
  return n * 2;
}

function doubleLong(n: long): long {
  return n * 2;
}

export function main(): void {
  Console.WriteLine("=== Generic CLR Type Substitution Tests ===");
  Console.WriteLine("");

  // Test 1: Box<int>.value should be int
  Console.WriteLine("--- Test 1: Box<int>.value ---");
  const intBox = createIntBox(42, "int box");
  const intValue = intBox.value; // Should be int, not number
  Console.WriteLine(`intBox.label = ${intBox.label}`);
  Console.WriteLine(`intBox.value = ${intValue}`);
  Console.WriteLine(`doubled = ${doubleInt(intValue)}`);
  Console.WriteLine("");

  // Test 2: Box<long>.value should be long
  Console.WriteLine("--- Test 2: Box<long>.value ---");
  const longBox = createLongBox(9999999999 as long, "long box");
  const longValue = longBox.value; // Should be long, not number
  Console.WriteLine(`longBox.label = ${longBox.label}`);
  Console.WriteLine(`longBox.value = ${longValue}`);
  Console.WriteLine(`doubled = ${doubleLong(longValue)}`);
  Console.WriteLine("");

  // Test 3: Generic function preserves type
  Console.WriteLine("--- Test 3: Generic function ---");
  const extracted = getBoxValue(intBox); // Should be int
  Console.WriteLine(`getBoxValue(intBox) = ${extracted}`);
  Console.WriteLine(`doubled = ${doubleInt(extracted)}`);
  Console.WriteLine("");

  // Test 4: Arithmetic on extracted value
  Console.WriteLine("--- Test 4: Arithmetic on generic value ---");
  const sum = intValue + 10;
  const product = intValue * 3;
  Console.WriteLine(`intValue + 10 = ${sum}`);
  Console.WriteLine(`intValue * 3 = ${product}`);
  Console.WriteLine("");

  // Test 5: Nested generic access
  Console.WriteLine("--- Test 5: Direct property access ---");
  const directValue = createIntBox(100, "direct").value;
  Console.WriteLine(`createIntBox(100, 'direct').value = ${directValue}`);
  Console.WriteLine(`doubled = ${doubleInt(directValue)}`);

  Console.WriteLine("");
  Console.WriteLine("=== All tests completed ===");
}
