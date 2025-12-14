// Async bidirectional generator test - async gen.next(value)
import { Console } from "@tsonic/dotnet/System";

// Async accumulator generator that receives values via next()
// Uses AsyncGenerator<Yield, Return, Next>
export async function* asyncAccumulator(
  start: number
): AsyncGenerator<number, number, number> {
  let total = start;
  while (true) {
    const received = yield total;
    total = total + received;
  }
}

export async function main(): Promise<void> {
  const gen = asyncAccumulator(10.0);

  // First call to next() starts the generator
  const r1 = await gen.next();
  Console.writeLine(`Initial value: ${r1.value}`);

  // Subsequent calls pass values into the generator
  const r2 = await gen.next(5);
  Console.writeLine(`After adding 5: ${r2.value}`);

  const r3 = await gen.next(20);
  Console.writeLine(`After adding 20: ${r3.value}`);

  const r4 = await gen.next(7);
  Console.writeLine(`After adding 7: ${r4.value}`);
}
