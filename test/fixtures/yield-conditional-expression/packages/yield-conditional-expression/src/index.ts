import { Console } from "@tsonic/dotnet/System.js";

function* condInCondition(flag: boolean): Generator<number, void, boolean> {
  const value: number = (yield 1) ? 10 : 20;
  if (flag) {
    yield value;
  }
}

function* condInBranches(flag: boolean): Generator<number, void, number> {
  const value: number = flag ? yield 2 : yield 3;
  yield value + 1;
}

export function main(): void {
  const a = condInCondition(true);
  void a.next(false);
  void a.next(true);

  const b = condInBranches(false);
  void b.next(0);
  void b.next(7);
  Console.WriteLine("ok");
}
