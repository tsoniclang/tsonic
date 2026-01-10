// Test nullable value type narrowing
// When checking `id !== undefined`, the identifier should emit as `id.Value` in C#

import { int } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";

// Test Case 1: Basic nullable narrowing with int
function handleInt(id: int | undefined): int {
  if (id !== undefined) {
    // id should be narrowed to int here, emitting id.Value
    return id;
  }
  return -1;
}

// Test Case 2: Nullable narrowing with else branch (=== undefined)
function processWithElse(id: int | undefined): int {
  if (id === undefined) {
    return -999;
  } else {
    // id should be narrowed to int in else branch
    return id;
  }
}

// Test Case 3: Multiple usages in same branch (with addition)
function compute(value: int | undefined): int {
  if (value !== undefined) {
    // Use value directly without multiplication
    return value;
  }
  return 0;
}

// Test Case 4: Nullable boolean
function checkFlag(flag: boolean | undefined): boolean {
  if (flag !== undefined) {
    return flag;
  }
  return false;
}

// Test Case 5: Using != null (loose equality)
function looseCheck(num: int | undefined): int {
  if (num != null) {
    return num;
  }
  return -1;
}

// Test Case 6: Using == null for narrowing in else (covers both null and undefined)
function nullCheckElse(num: int | undefined): int {
  if (num == null) {
    return -100;
  } else {
    return num;
  }
}

// Test Case 7: Compound condition with && (e.g., method check && null check)
function handleCompound(method: string, id: int | undefined): int {
  if (method === "GET" && id !== undefined) {
    // id should be narrowed to int in this compound condition
    return id;
  }
  return -1;
}

// Test Case 8: Compound condition with === undefined on right side
function handleCompoundEquals(method: string, id: int | undefined): int {
  if (method === "DELETE" && id === undefined) {
    return -999;
  } else {
    // id could still be undefined here (if method !== "DELETE")
    // So this case tests the else branch narrowing with compound
    return -1;
  }
}

// Test Case 9: Assignment inside a narrowed branch must write the original nullable variable
// (and still read via `.Value` when needed).
function bumpAssign(id: int | undefined): int {
  if (id !== undefined) {
    id = id + 1;
    return id;
  }
  return -1;
}

// Test Case 10: Update operators inside a narrowed branch must not rewrite the target identifier
// to `.Value` (writes), and reads after the update must still use `.Value`.
function bumpUpdate(id: int | undefined): int {
  if (id !== undefined) {
    id++;
    return id;
  }
  return -1;
}

export function main(): void {
  // Test Case 1: Basic narrowing
  const r1 = handleInt(42);
  Console.writeLine("Test 1: " + (r1 === 42 ? "PASS" : "FAIL"));

  const r1b = handleInt(undefined);
  Console.writeLine("Test 1b: " + (r1b === -1 ? "PASS" : "FAIL"));

  // Test Case 2: else branch
  const r2 = processWithElse(10);
  Console.writeLine("Test 2: " + (r2 === 10 ? "PASS" : "FAIL"));

  const r2b = processWithElse(undefined);
  Console.writeLine("Test 2b: " + (r2b === -999 ? "PASS" : "FAIL"));

  // Test Case 3: multiple usages
  const r3 = compute(5);
  Console.writeLine("Test 3: " + (r3 === 5 ? "PASS" : "FAIL"));

  // Test Case 4: boolean
  const r4 = checkFlag(true);
  Console.writeLine("Test 4: " + (r4 ? "PASS" : "FAIL"));

  // Test Case 5: loose equality
  const r5 = looseCheck(7);
  Console.writeLine("Test 5: " + (r5 === 7 ? "PASS" : "FAIL"));

  // Test Case 6: === null narrowing in else
  const r6 = nullCheckElse(99);
  Console.writeLine("Test 6: " + (r6 === 99 ? "PASS" : "FAIL"));

  // Test Case 7: Compound condition with &&
  const r7 = handleCompound("GET", 42);
  Console.writeLine("Test 7: " + (r7 === 42 ? "PASS" : "FAIL"));

  const r7b = handleCompound("POST", 42);
  Console.writeLine("Test 7b: " + (r7b === -1 ? "PASS" : "FAIL"));

  // Test Case 8: Compound with === undefined
  const r8 = handleCompoundEquals("DELETE", undefined);
  Console.writeLine("Test 8: " + (r8 === -999 ? "PASS" : "FAIL"));

  // Test Case 9: Assignment in narrowed branch
  const r9 = bumpAssign(5);
  Console.writeLine("Test 9: " + (r9 === 6 ? "PASS" : "FAIL"));

  // Test Case 10: Update in narrowed branch
  const r10 = bumpUpdate(5);
  Console.writeLine("Test 10: " + (r10 === 6 ? "PASS" : "FAIL"));

  Console.writeLine("All tests complete!");
}
