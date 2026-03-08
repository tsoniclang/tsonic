type Getter = ({ x }: { x: number }) => number;
type Inc = (x?: number) => number;
type Count = (...xs: number[]) => number;

export function main(): void {
  const getX: Getter = ({ x }) => x;
  const inc: Inc = (x = 0) => x + 1;
  const count: Count = (...xs) => xs.length;

  console.log([getX({ x: 4 }), inc(), inc(4), count(1, 2, 3)].join(","));
}
