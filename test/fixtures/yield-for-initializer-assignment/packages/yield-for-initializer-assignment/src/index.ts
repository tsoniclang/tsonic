import { Console } from "@tsonic/dotnet/System.js";

function* gen(): Generator<number, void, number> {
  let x = 0;
  for (x = yield 1; x < 3; x = x + 1) {
    yield x;
  }
}

function* genNested(): Generator<number, void, number> {
  let x: number = 0;
  for (x = (yield 1) + 1; x < 4; x = x + 1) {
    yield x;
  }
}

export function main(): void {
  const it = gen();
  void it.next(0);
  void it.next(2);
  void it.next(0);

  const nested = genNested();
  void nested.next(0);
  void nested.next(2);
  void nested.next(0);
  Console.WriteLine("ok");
}
