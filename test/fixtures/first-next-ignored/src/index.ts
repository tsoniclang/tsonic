// Test: First next(arg) invariant - the value passed to the first next() call must be ignored
// This is a critical JavaScript generator semantics requirement
import { Console } from "@tsonic/dotnet/System";

// Simple accumulator generator that receives values via next()
// This test verifies that the first next(999) value is NOT used
export function* accumulator(start: number): Generator<number, void, number> {
  let total = start;
  // First yield: outputs start, waits for input
  const first = yield total;
  // If first next(999) was incorrectly captured, first would be 999
  // But it should be 0 (the value from second next(0) call)
  total = total + first;
  yield total;
}

export function main(): void {
  const gen = accumulator(100);

  // First next() call with value 999 - this value MUST be ignored per JS spec
  // The generator runs to the first yield and outputs 100 (the start value)
  const r1 = gen.next(999);
  Console.writeLine(`First yield: ${r1.value}`);

  // Second next() call with value 0
  // The generator resumes, first receives 0 (NOT 999 from first call)
  // So total becomes 100 + 0 = 100
  const r2 = gen.next(0);
  Console.writeLine(`Second yield: ${r2.value}`);

  // If first next(999) was incorrectly used, r2.value would be 1099
  // Since it's ignored, r2.value should be 100
}
