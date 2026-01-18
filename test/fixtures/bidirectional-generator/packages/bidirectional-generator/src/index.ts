// Bidirectional generator test - gen.next(value)
import { Console } from "@tsonic/dotnet/System.js";

// Simple accumulator generator that receives values via next()
// Uses number for all three type arguments: Generator<Yield, Return, Next>
export function* accumulator(start: number): Generator<number, number, number> {
  let total = start;
  while (true) {
    const received = yield total;
    total = total + received;
  }
}

export function main(): void {
  const gen = accumulator(0.0);

  // First call to next() starts the generator
  const r1 = gen.next();
  Console.WriteLine(`Initial value: ${r1.value}`);

  // Subsequent calls pass values into the generator
  const r2 = gen.next(5);
  Console.WriteLine(`After adding 5: ${r2.value}`);

  const r3 = gen.next(10);
  Console.WriteLine(`After adding 10: ${r3.value}`);

  const r4 = gen.next(3);
  Console.WriteLine(`After adding 3: ${r4.value}`);
}
