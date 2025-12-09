/**
 * Negative test: ref/out/In as type annotations should fail compilation.
 * Parameter modifiers (ref/out/in) must be expressed via syntax, not types.
 */

import { Console } from "@tsonic/dotnet/System";
import { int } from "@tsonic/types";

// Define ref locally since it's no longer exported from @tsonic/types
type ref<T> = T;
type out<T> = T;
type In<T> = T;

// ERROR TSN7420: ref<T> is not a type, it's a parameter modifier
function swap(a: ref<int>, b: ref<int>): void {
  const temp = a;
  // This would be incorrect anyway since we can't mutate
  Console.writeLine(`swap called with ${temp} and ${b}`);
}

// ERROR TSN7420: out<T> is not a type
function tryParse(s: string, result: out<int>): boolean {
  Console.writeLine(`tryParse called with ${s}`);
  return false;
}

// ERROR TSN7420: In<T> is not a type
function readOnly(data: In<int>): void {
  Console.writeLine(`readOnly called with ${data}`);
}

export function main(): void {
  Console.writeLine("This should not compile");
}
