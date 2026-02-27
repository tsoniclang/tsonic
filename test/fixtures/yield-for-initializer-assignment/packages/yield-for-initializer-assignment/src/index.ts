import { Console } from "@tsonic/dotnet/System.js";

function* gen(): Generator<number, void, number> {
  let x = 0;
  for (x = yield 1; x < 3; x = x + 1) {
    yield x;
  }
}

export function main(): void {
  const it = gen();
  void it.next(0);
  void it.next(2);
  void it.next(0);
  Console.WriteLine("ok");
}
