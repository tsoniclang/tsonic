import { Console } from "@tsonic/dotnet/System.js";

function* ifGen(): Generator<number, number, boolean> {
  if (yield 1) {
    return 2;
  }
  return 3;
}

function* whileGen(): Generator<number, number, boolean> {
  let x = 0;
  while (yield 1) {
    x = x + 1;
    if (x > 1) {
      break;
    }
  }
  return x;
}

function* switchGen(): Generator<number, number, number> {
  switch (yield 1) {
    case 10:
      return 10;
    default:
      return 20;
  }
}

export function main(): void {
  const a = ifGen();
  void a.next(false);
  const ar = a.next(true);
  Console.WriteLine(ar.value);

  const b = whileGen();
  void b.next(false);
  void b.next(true);
  const br = b.next(false);
  Console.WriteLine(br.value);

  const c = switchGen();
  void c.next(0);
  const cr = c.next(10);
  Console.WriteLine(cr.value);
}
