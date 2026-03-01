import { Console } from "@tsonic/dotnet/System.js";

function* gen(): Generator<number, number, number> {
  return yield 1;
}

export function main(): void {
  const it = gen();
  void it.next(0);
  const done = it.next(7);
  Console.WriteLine(done.value);
}
