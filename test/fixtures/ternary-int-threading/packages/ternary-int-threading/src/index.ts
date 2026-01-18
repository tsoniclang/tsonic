/**
 * Ternary Int Threading E2E Test
 *
 * This test validates that expectedType is threaded through ternary branches,
 * ensuring integer literals in ternary expressions get proper int typing.
 */

import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  Console.WriteLine("=== Ternary Int Threading E2E Tests ===");
  Console.WriteLine("");

  // ============================================================
  // SECTION 1: Basic ternary with int type annotation
  // Both branches should be int, not double
  // ============================================================
  Console.WriteLine("--- Section 1: Basic ternary with int ---");

  const ternaryInt: int = true ? 5 : 10;
  Console.WriteLine(`ternaryInt = ${ternaryInt}`); // 5

  const ternaryFalse: int = false ? 5 : 10;
  Console.WriteLine(`ternaryFalse = ${ternaryFalse}`); // 10

  // ============================================================
  // SECTION 2: Ternary with int division
  // This is the critical test - int division should truncate
  // If branches were double, 7/2 would be 3.5
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 2: Ternary int division (critical test) ---");

  const a = 7;
  const b = 2;
  const divResult: int = true ? a / b : 0;
  Console.WriteLine(`7/2 via ternary = ${divResult}`); // 3 (not 3.5!)

  // ============================================================
  // SECTION 3: Nested ternary with int
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 3: Nested ternary ---");

  const nested: int = true ? (false ? 1 : 2) : 3;
  Console.WriteLine(`nested = ${nested}`); // 2

  const deepNest: int = true ? (true ? (false ? 10 : 20) : 30) : 40;
  Console.WriteLine(`deepNest = ${deepNest}`); // 20

  // ============================================================
  // SECTION 4: Ternary in function return
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 4: Ternary in function return ---");

  const result1 = ternaryReturn(true);
  const result2 = ternaryReturn(false);
  Console.WriteLine(`ternaryReturn(true) = ${result1}`); // 100
  Console.WriteLine(`ternaryReturn(false) = ${result2}`); // 200

  // ============================================================
  // SECTION 5: Ternary with arithmetic in branches
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 5: Ternary with arithmetic ---");

  const x = 10;
  const y = 20;
  const withArith: int = true ? x + 5 : y - 5;
  Console.WriteLine(`withArith = ${withArith}`); // 15

  // ============================================================
  // SECTION 6: Assignment with ternary RHS
  // Tests expectedType threading through assignment
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("--- Section 6: Assignment with ternary ---");

  let mutableInt: int = 0;
  mutableInt = true ? 42 : 0;
  Console.WriteLine(`mutableInt after assignment = ${mutableInt}`); // 42

  // ============================================================
  // Final summary
  // ============================================================
  Console.WriteLine("");
  Console.WriteLine("=== All tests completed ===");
}

function ternaryReturn(flag: boolean): int {
  return flag ? 100 : 200;
}
