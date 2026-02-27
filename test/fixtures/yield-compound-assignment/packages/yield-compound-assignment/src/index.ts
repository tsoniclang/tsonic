import { Console } from "@tsonic/dotnet/System.js";

function* gen(): Generator<number, void, number> {
  let total: number = 0;
  total += yield 2;
  total -= yield 1;
  yield total;
}

export function main(): void {
  const it = gen();
  void it.next(0);
  void it.next(5);
  void it.next(3);
  void it.next(0);
  Console.WriteLine("ok");
}
