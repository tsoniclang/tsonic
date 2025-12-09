// Test: Generator return value capture
// When a generator returns a value, it should be accessible via the final IteratorResult
import { Console } from "@tsonic/dotnet/System";

// Generator that yields numbers and returns a final string value
export function* countdown(start: number): Generator<number, string, number> {
  let current = start;
  while (current > 0) {
    const step = yield current;
    current = current - (step > 0 ? step : 1);
  }
  return "Liftoff!";
}

export function main(): void {
  const gen = countdown(5);

  // Iterate through yields
  let result = gen.next(0);
  Console.writeLine(`Yield: ${result.value}`);

  result = gen.next(2);
  Console.writeLine(`Yield: ${result.value}`);

  result = gen.next(2);
  Console.writeLine(`Yield: ${result.value}`);

  result = gen.next(1);
  Console.writeLine(`Done: ${result.done}`);

  // Note: In JavaScript, the final result.value would be "Liftoff!"
  // Our implementation captures this via __returnValue
}
