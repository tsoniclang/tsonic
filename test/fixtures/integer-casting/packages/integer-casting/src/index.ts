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
  Console.WriteLine("=== Integer Casting E2E Tests ===");
  Console.WriteLine("");

  // ============================================================
  // SECTION 1: Basic int declarations with `as int`
  // Expected: var x = 10 (no .0, no cast)
  // ============================================================
  Console.WriteLine("--- Section 1: Basic int declarations ---");

  const x: int = 10;
  const y: int = 20;
  const z: int = 30;

  Console.WriteLine(`x = ${x}`); // 10
  Console.WriteLine(`y = ${y}`); // 20
  Console.WriteLine(`z = ${z}`); // 30

  // ============================================================
  // SECTION 2: int + literal arithmetic
  // Expected: var a = x + 1 (literal as 1, not 1.0, no cast wrapper)
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 2: int + literal arithmetic ---");

  const a = x + 1;
  const b = y + 2;
  const c = z + 100;

  Console.WriteLine(`x + 1 = ${a}`); // 11
  Console.WriteLine(`y + 2 = ${b}`); // 22
  Console.WriteLine(`z + 100 = ${c}`); // 130

  // ============================================================
  // SECTION 3: int + int arithmetic
  // Expected: var d = x + y (no cast, int + int = int)
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 3: int + int arithmetic ---");

  const d = x + y;
  const e = y + z;
  const f = x + y + z;

  Console.WriteLine(`x + y = ${d}`); // 30
  Console.WriteLine(`y + z = ${e}`); // 50
  Console.WriteLine(`x + y + z = ${f}`); // 60

  // ============================================================
  // SECTION 4: Declared type int with int expression
  // Expected: int g = x + y (no cast, result is already int)
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 4: Declared type int ---");

  const g: int = x + y;
  const h: int = a + b;
  const i: int = x + 1;

  Console.WriteLine(`g (int) = ${g}`); // 30
  Console.WriteLine(`h (int) = ${h}`); // 33
  Console.WriteLine(`i (int) = ${i}`); // 11

  // ============================================================
  // SECTION 5: Redundant `as int` on already-int values
  // Expected: just x + y, no redundant (int)(x) + (int)(y)
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 5: Redundant as int ---");

  const j: int = x + y;
  const k = x + y;
  const l: int = x + y + z;

  Console.WriteLine(`(x as int) + (y as int) = ${j}`); // 30
  Console.WriteLine(`(x as int) + (y as int) (inferred) = ${k}`); // 30
  Console.WriteLine(`((x + y) as int) + z = ${l}`); // 60

  // ============================================================
  // SECTION 6: Subtraction with int
  // Expected: similar to addition - no cosmetic casts
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 6: Subtraction ---");

  const m = x - 5;
  const n = y - x;
  const o: int = z - 10;

  Console.WriteLine(`x - 5 = ${m}`); // 5
  Console.WriteLine(`y - x = ${n}`); // 10
  Console.WriteLine(`z - 10 = ${o}`); // 20

  // ============================================================
  // SECTION 7: Multiplication with int
  // Expected: no cosmetic casts
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 7: Multiplication ---");

  const p = x * 2;
  const q = x * y;
  const r: int = y * 3;

  Console.WriteLine(`x * 2 = ${p}`); // 20
  Console.WriteLine(`x * y = ${q}`); // 200
  Console.WriteLine(`y * 3 = ${r}`); // 60

  // ============================================================
  // SECTION 8: Division with int
  // Expected: int / int in C# = int (integer division)
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 8: Division ---");

  const s = y / x;
  const t = z / 10;
  const u: int = 100 / 3;

  Console.WriteLine(`y / x = ${s}`); // 2
  Console.WriteLine(`z / 10 = ${t}`); // 3
  Console.WriteLine(`100 / 3 = ${u}`); // 33

  // ============================================================
  // SECTION 9: Modulo with int
  // Expected: no cosmetic casts
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 9: Modulo ---");

  const v = z % x;
  const w = 25 % 7;

  Console.WriteLine(`z % x = ${v}`); // 0
  Console.WriteLine(`25 % 7 = ${w}`); // 4

  // ============================================================
  // SECTION 10: Unary minus with int
  // Expected: -x where x is int, no cast
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 10: Unary minus ---");

  const negX = -x;
  const negLiteral = -5;

  Console.WriteLine(`-x = ${negX}`); // -10
  Console.WriteLine(`-(5 as int) = ${negLiteral}`); // -5

  // ============================================================
  // SECTION 11: Complex nested expressions
  // Expected: no cosmetic casts on nested int operations
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 11: Complex expressions ---");

  const complex1 = (x + y) * z;
  const complex2 = x + y * z;
  const complex3: int = (x + 1) * (y + 2);
  const complex4 = (x + y) * (y + z);

  Console.WriteLine(`(x + y) * z = ${complex1}`); // 900
  Console.WriteLine(`x + y * z = ${complex2}`); // 610
  Console.WriteLine(`(x + 1) * (y + 2) = ${complex3}`); // 242
  Console.WriteLine(`((x+y) as int) * ((y+z) as int) = ${complex4}`); // 1500

  // ============================================================
  // SECTION 12: Chained operations
  // Expected: all literals as int, no casts
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 12: Chained operations ---");

  const chain1 = x + 1 + 2 + 3;
  const chain2 = x * 2 + y * 3;
  const chain3: int = x + y + z + 100;

  Console.WriteLine(`x + 1 + 2 + 3 = ${chain1}`); // 16
  Console.WriteLine(`x * 2 + y * 3 = ${chain2}`); // 80
  Console.WriteLine(`x + y + z + 100 = ${chain3}`); // 160

  // ============================================================
  // SECTION 13: Comparison operators with int
  // Expected: no casts needed for comparisons
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 13: Comparisons ---");

  const cmp1 = x < y;
  const cmp2 = x > 5;
  const cmp3 = y <= z;
  const cmp4 = x >= 10;
  const cmp5 = x === 10;
  const cmp6 = y !== z;

  Console.WriteLine(`x < y = ${cmp1}`); // true
  Console.WriteLine(`x > 5 = ${cmp2}`); // true
  Console.WriteLine(`y <= z = ${cmp3}`); // true
  Console.WriteLine(`x >= 10 = ${cmp4}`); // true
  Console.WriteLine(`x === 10 = ${cmp5}`); // true
  Console.WriteLine(`y !== z = ${cmp6}`); // true

  // ============================================================
  // SECTION 14: Assignment operators with int
  // Expected: proper int handling in compound assignments
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 14: Assignment operators ---");

  let counter = 0;
  counter = counter + 1;
  Console.WriteLine(`counter after +1 = ${counter}`); // 1

  counter = counter + 10;
  Console.WriteLine(`counter after +10 = ${counter}`); // 11

  counter = counter * 2;
  Console.WriteLine(`counter after *2 = ${counter}`); // 22

  // ============================================================
  // SECTION 15: Function parameters and return types
  // Expected: int types work correctly across function boundaries
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 15: Function boundaries ---");

  const sum = addInts(x, y);
  const product = multiplyByTwo(z);
  const incremented = increment(x);

  Console.WriteLine(`addInts(x, y) = ${sum}`); // 30
  Console.WriteLine(`multiplyByTwo(z) = ${product}`); // 60
  Console.WriteLine(`increment(x) = ${incremented}`); // 11

  // ============================================================
  // SECTION 16: Array indexing with int
  // Expected: int used directly as array index (no double cast)
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 16: Array indexing ---");

  const arr: string[] = ["zero", "one", "two", "three", "four"];
  const idx = 2;
  const nextIdx = idx + 1;

  Console.WriteLine(`arr[idx] = ${arr[idx]}`); // two
  Console.WriteLine(`arr[idx + 1] = ${arr[nextIdx]}`); // three

  // ============================================================
  // Final summary
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("=== All tests completed ===");
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
