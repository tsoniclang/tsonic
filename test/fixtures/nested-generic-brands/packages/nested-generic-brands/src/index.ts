/**
 * Nested Generic CLR Brand Preservation E2E Test
 *
 * Tests that CLR type aliases are preserved through nested generic types:
 * - Functions returning Box<int>[] preserve int in array elements
 * - Chained property access preserves brands
 * - Multiple levels of generic nesting in return types
 */

import { Console } from "@tsonic/dotnet/System.js";
import { int, long } from "@tsonic/core/types.js";

// Simple generic container
interface Box<T> {
  value: T;
  label: string;
}

// Function returning array of Box<int>
function createIntBoxArray(): Box<int>[] {
  return [
    { value: 1, label: "first" },
    { value: 2, label: "second" },
    { value: 3, label: "third" },
  ];
}

// Function returning array of Box<long>
function createLongBoxArray(): Box<long>[] {
  return [
    { value: 1000000000 as long, label: "big1" },
    { value: 2000000000 as long, label: "big2" },
  ];
}

// Function returning single Box<int>
function createIntBox(n: int): Box<int> {
  return { value: n, label: "int box" };
}

// Function returning single Box<long>
function createLongBox(n: long): Box<long> {
  return { value: n, label: "long box" };
}

// Function that takes Box<int> and returns its value
function extractInt(box: Box<int>): int {
  return box.value;
}

// Function that takes Box<long> and returns its value
function extractLong(box: Box<long>): long {
  return box.value;
}

// Helper to double an int (proves type is int)
function doubleInt(n: int): int {
  return n * 2;
}

// Helper to double a long (proves type is long)
function doubleLong(n: long): long {
  return n * 2;
}

export function main(): void {
  Console.WriteLine("=== Nested Generic Brand Preservation Tests ===");
  Console.WriteLine("");

  // Test 1: Box<int>[] array element access
  Console.WriteLine("--- Test 1: Box<int>[] array ---");
  const intBoxes = createIntBoxArray();
  const firstBox = intBoxes[0]; // Should be Box<int>
  const firstValue = firstBox.value; // Should be int
  Console.WriteLine(`firstBox.value = ${firstValue}`);
  Console.WriteLine(`doubled = ${doubleInt(firstValue)}`);
  Console.WriteLine("");

  // Test 2: Box<long>[] array element access
  Console.WriteLine("--- Test 2: Box<long>[] array ---");
  const longBoxes = createLongBoxArray();
  const firstLongBox = longBoxes[0]; // Should be Box<long>
  const firstLongVal = firstLongBox.value; // Should be long
  Console.WriteLine(`firstLongBox.value = ${firstLongVal}`);
  Console.WriteLine(`doubled = ${doubleLong(firstLongVal)}`);
  Console.WriteLine("");

  // Test 3: Extract function preserves type
  Console.WriteLine("--- Test 3: Extract function ---");
  const box = createIntBox(42);
  const extracted = extractInt(box); // Should be int
  Console.WriteLine(`extracted = ${extracted}`);
  Console.WriteLine(`doubled = ${doubleInt(extracted)}`);
  Console.WriteLine("");

  // Test 4: Chained call preserves type
  Console.WriteLine("--- Test 4: Chained call ---");
  const chained = createIntBox(100).value; // Should be int
  Console.WriteLine(`chained = ${chained}`);
  Console.WriteLine(`doubled = ${doubleInt(chained)}`);
  Console.WriteLine("");

  // Test 5: Sum from array with int arithmetic
  Console.WriteLine("--- Test 5: Array arithmetic ---");
  const sum = intBoxes[0].value + intBoxes[1].value + intBoxes[2].value;
  Console.WriteLine(`sum = ${sum}`);
  Console.WriteLine(`sum doubled = ${doubleInt(sum)}`);
  Console.WriteLine("");

  // Test 6: Long extraction and arithmetic
  Console.WriteLine("--- Test 6: Long extraction ---");
  const longBox = createLongBox(9999999999 as long);
  const longVal = extractLong(longBox);
  Console.WriteLine(`longVal = ${longVal}`);
  Console.WriteLine(`doubled = ${doubleLong(longVal)}`);

  Console.WriteLine("");
  Console.WriteLine("=== All tests completed ===");
}
