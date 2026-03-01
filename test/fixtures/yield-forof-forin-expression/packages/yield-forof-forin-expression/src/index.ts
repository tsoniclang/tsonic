import { Console } from "@tsonic/dotnet/System.js";

function* sumFromYieldedIterable(): Generator<number[], number, number[]> {
  let sum = 0.0;
  for (const value of yield [1.5, 2.5, 3.5]) {
    sum = sum + value;
  }
  return sum;
}

export function main(): void {
  const first = sumFromYieldedIterable();
  void first.next([0.5]);
  void first.next([4.5, 5.5]);

  Console.WriteLine("OK");
}
