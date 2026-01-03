// Test generic call inference with numeric literals
// Under the new numeric spec:
// - Integer literals (42) have type int
// - Floating literals (42.0) have type double
// - number = double in dotnet mode
// - To use an int where double is expected, write 42.0 (explicit double literal)
import { Console } from "@tsonic/dotnet/System.js";

interface Pair<T, U> {
  first: T;
  second: U;
}

function makePair<T, U>(a: T, b: U): Pair<T, U> {
  return { first: a, second: b };
}

export function main(): void {
  // Test 1: Explicit type annotation on variable with double literal
  // Use 42.0 to explicitly indicate double type
  const p1: Pair<string, number> = makePair("hello", 42.0);
  Console.writeLine(p1.first);
  Console.writeLine(p1.second);

  // Test 2: Explicit type arguments with double literal
  const p2 = makePair<string, number>("world", 100.0);
  Console.writeLine(p2.first);
  Console.writeLine(p2.second);

  // Test 3: Mixed numeric and string (3.14 is already a double literal)
  const p3: Pair<number, string> = makePair(3.14, "pi");
  Console.writeLine(p3.first);
  Console.writeLine(p3.second);

  // Test 4: Integer inference (no explicit double context)
  // 42 is int, so p4 infers as Pair<string, int>
  const p4 = makePair("integer", 42);
  Console.writeLine(p4.first);
  Console.writeLine(p4.second);

  Console.writeLine("Done");
}
