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
  Console.writeLine("=== Generic CLR Type Substitution Tests ===");
  Console.writeLine("");

  // Test 1: Box<int>.value should be int
  Console.writeLine("--- Test 1: Box<int>.value ---");
  const intBox = createIntBox(42, "int box");
  const intValue = intBox.value; // Should be int, not number
  Console.writeLine(`intBox.label = ${intBox.label}`);
  Console.writeLine(`intBox.value = ${intValue}`);
  Console.writeLine(`doubled = ${doubleInt(intValue)}`);
  Console.writeLine("");

  // Test 2: Box<long>.value should be long
  Console.writeLine("--- Test 2: Box<long>.value ---");
  const longBox = createLongBox(9999999999 as long, "long box");
  const longValue = longBox.value; // Should be long, not number
  Console.writeLine(`longBox.label = ${longBox.label}`);
  Console.writeLine(`longBox.value = ${longValue}`);
  Console.writeLine(`doubled = ${doubleLong(longValue)}`);
  Console.writeLine("");

  // Test 3: Generic function preserves type
  Console.writeLine("--- Test 3: Generic function ---");
  const extracted = getBoxValue(intBox); // Should be int
  Console.writeLine(`getBoxValue(intBox) = ${extracted}`);
  Console.writeLine(`doubled = ${doubleInt(extracted)}`);
  Console.writeLine("");

  // Test 4: Arithmetic on extracted value
  Console.writeLine("--- Test 4: Arithmetic on generic value ---");
  const sum = intValue + 10;
  const product = intValue * 3;
  Console.writeLine(`intValue + 10 = ${sum}`);
  Console.writeLine(`intValue * 3 = ${product}`);
  Console.writeLine("");

  // Test 5: Nested generic access
  Console.writeLine("--- Test 5: Direct property access ---");
  const directValue = createIntBox(100, "direct").value;
  Console.writeLine(`createIntBox(100, 'direct').value = ${directValue}`);
  Console.writeLine(`doubled = ${doubleInt(directValue)}`);

  Console.writeLine("");
  Console.writeLine("=== All tests completed ===");
}
