import { Console } from "@tsonic/dotnet/System.js";

function* directInit(): Generator<number, void, number> {
  for (let x: number = yield 1; x < 4; x = x + 1) {
    yield x;
  }
}

function* nestedInit(): Generator<number, void, number> {
  for (let x: number = (yield 2) + 1; x < 5; x = x + 1) {
    yield x;
  }
}

export function main(): void {
  const a = directInit();
  void a.next(0);
  void a.next(2);
  void a.next(0);

  const b = nestedInit();
  void b.next(0);
  void b.next(3);
  void b.next(0);

  Console.WriteLine("ok");
}
