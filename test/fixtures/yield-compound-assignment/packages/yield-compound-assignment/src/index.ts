import { Console } from "@tsonic/dotnet/System.js";

function* gen(): Generator<number, void, number> {
  let total: number = 0;
  total += yield 2;
  total -= yield 1;
  yield total;
}

function* genMembers(): Generator<number, void, number> {
  const counter: { count: number } = { count: 1.0 };
  const counters: Record<string, number> = { count: 1.0 };

  counter.count += yield 2;
  counters["count"] += yield 3;

  yield counter.count + counters["count"];
}

export function main(): void {
  const it = gen();
  void it.next(0);
  void it.next(5);
  void it.next(3);
  void it.next(0);

  const members = genMembers();
  void members.next(0);
  void members.next(4);
  void members.next(5);
  void members.next(0);

  Console.WriteLine("ok");
}
