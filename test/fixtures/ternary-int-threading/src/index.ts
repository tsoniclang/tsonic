/**
 * Ternary Int Threading E2E Test
 *
 * This test validates that expectedType is threaded through ternary branches,
 * ensuring integer literals in ternary expressions get proper int typing.
 */

import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  Console.writeLine("=== Ternary Int Threading E2E Tests ===");
  Console.writeLine("");

  // ============================================================
  // SECTION 1: Basic ternary with int type annotation
  // Both branches should be int, not double
  // ============================================================
  Console.writeLine("--- Section 1: Basic ternary with int ---");

  const ternaryInt: int = true ? 5 : 10;
  Console.writeLine(`ternaryInt = ${ternaryInt}`); // 5

  const ternaryFalse: int = false ? 5 : 10;
  Console.writeLine(`ternaryFalse = ${ternaryFalse}`); // 10

  // ============================================================
  // SECTION 2: Ternary with int division
  // This is the critical test - int division should truncate
  // If branches were double, 7/2 would be 3.5
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 2: Ternary int division (critical test) ---");

  const a = 7 as int;
  const b = 2 as int;
  const divResult: int = true ? ((a / b) as int) : 0;
  Console.writeLine(`7/2 via ternary = ${divResult}`); // 3 (not 3.5!)

  // ============================================================
  // SECTION 3: Nested ternary with int
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 3: Nested ternary ---");

  const nested: int = true ? (false ? 1 : 2) : 3;
  Console.writeLine(`nested = ${nested}`); // 2

  const deepNest: int = true ? (true ? (false ? 10 : 20) : 30) : 40;
  Console.writeLine(`deepNest = ${deepNest}`); // 20

  // ============================================================
  // SECTION 4: Ternary in function return
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 4: Ternary in function return ---");

  const result1 = ternaryReturn(true);
  const result2 = ternaryReturn(false);
  Console.writeLine(`ternaryReturn(true) = ${result1}`); // 100
  Console.writeLine(`ternaryReturn(false) = ${result2}`); // 200

  // ============================================================
  // SECTION 5: Ternary with arithmetic in branches
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 5: Ternary with arithmetic ---");

  const x = 10 as int;
  const y = 20 as int;
  const withArith: int = true ? ((x + 5) as int) : ((y - 5) as int);
  Console.writeLine(`withArith = ${withArith}`); // 15

  // ============================================================
  // SECTION 6: Assignment with ternary RHS
  // Tests expectedType threading through assignment
  // ============================================================
  Console.writeLine("");
  Console.writeLine("--- Section 6: Assignment with ternary ---");

  let mutableInt: int = 0 as int;
  mutableInt = true ? 42 : 0;
  Console.writeLine(`mutableInt after assignment = ${mutableInt}`); // 42

  // ============================================================
  // Final summary
  // ============================================================
  Console.writeLine("");
  Console.writeLine("=== All tests completed ===");
}

function ternaryReturn(flag: boolean): int {
  return flag ? 100 : 200;
}
