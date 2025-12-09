// Test generic call inference with numeric literals
// This tests that integer literals infer as double (TS number semantics)
import { Console } from "@tsonic/dotnet/System";

interface Pair<T, U> {
  first: T;
  second: U;
}

function makePair<T, U>(a: T, b: U): Pair<T, U> {
  return { first: a, second: b };
}

export function main(): void {
  // Test 1: Explicit type annotation on variable
  // The literal 42 should be emitted as 42.0 to match double
  const p1: Pair<string, number> = makePair("hello", 42);
  Console.writeLine(p1.first);
  Console.writeLine(p1.second);

  // Test 2: Inferred from explicit type arguments
  const p2 = makePair<string, number>("world", 100);
  Console.writeLine(p2.first);
  Console.writeLine(p2.second);

  // Test 3: Mixed numeric and string
  const p3: Pair<number, string> = makePair(3.14, "pi");
  Console.writeLine(p3.first);
  Console.writeLine(p3.second);

  Console.writeLine("Done");
}
