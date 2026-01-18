// Test Generator<TYield, TReturn, TNext> where TYield != TReturn
// This verifies @return takes TReturn (string), not TYield (number)
import { Console } from "@tsonic/dotnet/System.js";

// Generator yields numbers, accepts numbers, but returns a string
// Note: Use 0.0 for sum since it participates in double arithmetic (value is double)
// count uses integer arithmetic only, so 0 is fine
export function* dataCollector(): Generator<number, string, number> {
  let sum = 0.0;
  let count = 0;

  while (count < 3) {
    const value = yield sum;
    sum = sum + value;
    count = count + 1;
  }

  return `Collected ${count} values, total: ${sum}`;
}

export function main(): void {
  const gen = dataCollector();

  // First next() starts the generator, yields initial sum (0)
  const r1 = gen.next();
  Console.WriteLine(`Step 1 - yielded: ${r1.value}, done: ${r1.done}`);

  // Pass in value 10
  const r2 = gen.next(10);
  Console.WriteLine(`Step 2 - yielded: ${r2.value}, done: ${r2.done}`);

  // Pass in value 20
  const r3 = gen.next(20);
  Console.WriteLine(`Step 3 - yielded: ${r3.value}, done: ${r3.done}`);

  // Pass in value 15 - this triggers the return
  const r4 = gen.next(15);
  Console.WriteLine(`Step 4 - done: ${r4.done}`);

  // Note: JavaScript's IteratorResult.value is TYield | TReturn
  // When done=true, value would be the return value (string)
  // But TypeScript's standard type doesn't expose returnValue property
  // Our C# wrapper provides gen.returnValue for this

  // Test external termination with @return(value)
  const gen2 = dataCollector();
  gen2.next(); // start it
  gen2.next(5); // add 5

  // Terminate early with a custom return value (string, not number!)
  // Note: gen.return() takes TReturn type which is string
  const earlyResult = gen2.return("Early termination");
  Console.WriteLine(`Early termination result - done: ${earlyResult.done}`);
}
