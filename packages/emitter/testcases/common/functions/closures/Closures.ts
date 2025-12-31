export function makeCounter(): () => number {
  let count = 0;
  return () => {
    count++;
    return count;
  };
}

export function makeAdder(x: number): (y: number) => number {
  return y => x + y;
}
