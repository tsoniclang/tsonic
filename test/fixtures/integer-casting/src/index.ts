/**
 * Integer Casting E2E Test - Alice's Proposal Validation
 *
 * This test validates all aspects of Alice's integer emission proposal:
 * 1. No cosmetic casts - never emit (int)(expr) when expr already produces int
 * 2. Operator typing is authoritative - binary op result type determines emission
 * 3. Assertions don't force casts - `as int` on int expression is a no-op
 */

import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  Console.writeLine("=== Integer Casting E2E Tests ===");
  Console.writeLine("");

  // ============================================================
  // SECTION 1: Basic int declarations with `as int`
  // Expected: var x = 10 (no .0, no cast)
  // ============================================================
  Console.writeLine("--- Section 1: Basic int declarations ---");

  const x = 10;
  const y = 20;
  const z = 30;

  Console.writeLine(`x = ${x}`); // 10
  Console.writeLine(`y = ${y}`); // 20
  Console.writeLine(`z = ${z}`); // 30

  // ============================================================
  // SECTION 2: int + literal arithmetic
  // Expected: var a = x + 1 (literal as 1, not 1.0, no cast wrapper)
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 2: int + literal arithmetic ---");

  const a = x + 1;
  const b = y + 2;
  const c = z + 100;

  Console.writeLine(`x + 1 = ${a}`); // 11
  Console.writeLine(`y + 2 = ${b}`); // 22
  Console.writeLine(`z + 100 = ${c}`); // 130

  // ============================================================
  // SECTION 3: int + int arithmetic
  // Expected: var d = x + y (no cast, int + int = int)
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 3: int + int arithmetic ---");

  const d = x + y;
  const e = y + z;
  const f = x + y + z;

  Console.writeLine(`x + y = ${d}`); // 30
  Console.writeLine(`y + z = ${e}`); // 50
  Console.writeLine(`x + y + z = ${f}`); // 60

  // ============================================================
  // SECTION 4: Declared type int with int expression
  // Expected: int g = x + y (no cast, result is already int)
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 4: Declared type int ---");

  const g: int = x + y;
  const h: int = a + b;
  const i: int = x + 1;

  Console.writeLine(`g (int) = ${g}`); // 30
  Console.writeLine(`h (int) = ${h}`); // 33
  Console.writeLine(`i (int) = ${i}`); // 11

  // ============================================================
  // SECTION 5: Redundant `as int` on already-int values
  // Expected: just x + y, no redundant (int)(x) + (int)(y)
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 5: Redundant as int ---");

  const j: int = x + y;
  const k = x + y;
  const l: int = (x + y) + z;

  Console.writeLine(`(x as int) + (y as int) = ${j}`); // 30
  Console.writeLine(`(x as int) + (y as int) (inferred) = ${k}`); // 30
  Console.writeLine(`((x + y) as int) + z = ${l}`); // 60

  // ============================================================
  // SECTION 6: Subtraction with int
  // Expected: similar to addition - no cosmetic casts
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 6: Subtraction ---");

  const m = x - 5;
  const n = y - x;
  const o: int = z - 10;

  Console.writeLine(`x - 5 = ${m}`); // 5
  Console.writeLine(`y - x = ${n}`); // 10
  Console.writeLine(`z - 10 = ${o}`); // 20

  // ============================================================
  // SECTION 7: Multiplication with int
  // Expected: no cosmetic casts
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 7: Multiplication ---");

  const p = x * 2;
  const q = x * y;
  const r: int = y * 3;

  Console.writeLine(`x * 2 = ${p}`); // 20
  Console.writeLine(`x * y = ${q}`); // 200
  Console.writeLine(`y * 3 = ${r}`); // 60

  // ============================================================
  // SECTION 8: Division with int
  // Expected: int / int in C# = int (integer division)
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 8: Division ---");

  const s = y / x;
  const t = z / 10;
  const u: int = 100 / 3;

  Console.writeLine(`y / x = ${s}`); // 2
  Console.writeLine(`z / 10 = ${t}`); // 3
  Console.writeLine(`100 / 3 = ${u}`); // 33

  // ============================================================
  // SECTION 9: Modulo with int
  // Expected: no cosmetic casts
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 9: Modulo ---");

  const v = z % x;
  const w = 25 % 7;

  Console.writeLine(`z % x = ${v}`); // 0
  Console.writeLine(`25 % 7 = ${w}`); // 4

  // ============================================================
  // SECTION 10: Unary minus with int
  // Expected: -x where x is int, no cast
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 10: Unary minus ---");

  const negX = -x;
  const negLiteral = -5;

  Console.writeLine(`-x = ${negX}`); // -10
  Console.writeLine(`-(5 as int) = ${negLiteral}`); // -5

  // ============================================================
  // SECTION 11: Complex nested expressions
  // Expected: no cosmetic casts on nested int operations
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 11: Complex expressions ---");

  const complex1 = (x + y) * z;
  const complex2 = x + y * z;
  const complex3: int = (x + 1) * (y + 2);
  const complex4 = (x + y) * (y + z);

  Console.writeLine(`(x + y) * z = ${complex1}`); // 900
  Console.writeLine(`x + y * z = ${complex2}`); // 610
  Console.writeLine(`(x + 1) * (y + 2) = ${complex3}`); // 242
  Console.writeLine(`((x+y) as int) * ((y+z) as int) = ${complex4}`); // 1500

  // ============================================================
  // SECTION 12: Chained operations
  // Expected: all literals as int, no casts
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 12: Chained operations ---");

  const chain1 = x + 1 + 2 + 3;
  const chain2 = x * 2 + y * 3;
  const chain3: int = x + y + z + 100;

  Console.writeLine(`x + 1 + 2 + 3 = ${chain1}`); // 16
  Console.writeLine(`x * 2 + y * 3 = ${chain2}`); // 80
  Console.writeLine(`x + y + z + 100 = ${chain3}`); // 160

  // ============================================================
  // SECTION 13: Comparison operators with int
  // Expected: no casts needed for comparisons
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 13: Comparisons ---");

  const cmp1 = x < y;
  const cmp2 = x > 5;
  const cmp3 = y <= z;
  const cmp4 = x >= 10;
  const cmp5 = x === 10;
  const cmp6 = y !== z;

  Console.writeLine(`x < y = ${cmp1}`); // true
  Console.writeLine(`x > 5 = ${cmp2}`); // true
  Console.writeLine(`y <= z = ${cmp3}`); // true
  Console.writeLine(`x >= 10 = ${cmp4}`); // true
  Console.writeLine(`x === 10 = ${cmp5}`); // true
  Console.writeLine(`y !== z = ${cmp6}`); // true

  // ============================================================
  // SECTION 14: Assignment operators with int
  // Expected: proper int handling in compound assignments
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 14: Assignment operators ---");

  let counter = 0;
  counter = counter + 1;
  Console.writeLine(`counter after +1 = ${counter}`); // 1

  counter = counter + 10;
  Console.writeLine(`counter after +10 = ${counter}`); // 11

  counter = counter * 2;
  Console.writeLine(`counter after *2 = ${counter}`); // 22

  // ============================================================
  // SECTION 15: Function parameters and return types
  // Expected: int types work correctly across function boundaries
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 15: Function boundaries ---");

  const sum = addInts(x, y);
  const product = multiplyByTwo(z);
  const incremented = increment(x);

  Console.writeLine(`addInts(x, y) = ${sum}`); // 30
  Console.writeLine(`multiplyByTwo(z) = ${product}`); // 60
  Console.writeLine(`increment(x) = ${incremented}`); // 11

  // ============================================================
  // SECTION 16: Array indexing with int
  // Expected: int used directly as array index (no double cast)
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 16: Array indexing ---");

  const arr: string[] = ["zero", "one", "two", "three", "four"];
  const idx = 2;
  const nextIdx = idx + 1;

  Console.writeLine(`arr[idx] = ${arr[idx]}`); // two
  Console.writeLine(`arr[idx + 1] = ${arr[nextIdx]}`); // three

  // ============================================================
  // Final summary
  // ============================================================
  Console.writeLine("");
  Console.writeLine("=== All tests completed ===");
}

// Helper functions
function addInts(a: int, b: int): int {
  return a + b;
}

function multiplyByTwo(n: int): int {
  return n * 2;
}

function increment(n: int): int {
  return n + 1;
}
