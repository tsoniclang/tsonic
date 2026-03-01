function sink(v: number): void {
  void v;
}

function* example(): Generator<number, number, number> {
  const n = (yield 1) + 2;
  sink((yield n) + 3);

  if ((yield 1) + 1 > 0) {
    sink(n);
  }

  for (const value of [(yield 2) + 1]) {
    sink(value);
  }

  return (yield 4) + n;
}

export function main(): void {
  const it = example();
  void it.next(0);
}
