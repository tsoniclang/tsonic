type int = number;

function stackalloc<T>(size: number): T {
  throw new Error("not implemented");
}

export function main(): void {
  const x: int = 1 as int;
  stackalloc<int>(10 as int);
  void x;
}
