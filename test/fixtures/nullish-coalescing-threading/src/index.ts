/**
 * Nullish Coalescing Threading E2E Test
 *
 * Tests that expectedType threads through ?? RHS for proper int typing.
 * Uses function parameters for nullable values (mirrors nullable-narrowing test).
 */

import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Test 1: Basic ?? with nullable parameter
function getOrDefault(value: int | null): int {
  return value ?? 100; // 100 should get expectedType int, not double
}

// Test 2: Nested ?? chain
function getFirstValid(a: int | null, b: int | null): int {
  return a ?? b ?? 333; // All fallbacks should be int
}

// Test 3: ?? in return with arithmetic RHS
function divideOrDefault(value: int | null, divisor: int): int {
  const a = 10;
  const b = 3;
  return value ?? a / b; // Should use int division (3, not 3.33)
}

export function main(): void {
  Console.writeLine("=== Nullish Coalescing Threading E2E Tests ===");
  Console.writeLine("");

  // Test 1
  const r1 = getOrDefault(null);
  const r2 = getOrDefault(77);
  Console.writeLine(`getOrDefault(null) = ${r1}`); // 100
  Console.writeLine(`getOrDefault(77) = ${r2}`); // 77

  // Test 2
  const r3 = getFirstValid(null, null);
  const r4 = getFirstValid(null, 50);
  const r5 = getFirstValid(25, 50);
  Console.writeLine(`getFirstValid(null, null) = ${r3}`); // 333
  Console.writeLine(`getFirstValid(null, 50) = ${r4}`); // 50
  Console.writeLine(`getFirstValid(25, 50) = ${r5}`); // 25

  // Test 3
  const r6 = divideOrDefault(null, 3);
  const r7 = divideOrDefault(99, 3);
  Console.writeLine(`divideOrDefault(null, 3) = ${r6}`); // 3 (int division)
  Console.writeLine(`divideOrDefault(99, 3) = ${r7}`); // 99

  Console.writeLine("");
  Console.writeLine("=== All tests completed ===");
}
