// Module B: Accumulator generator
// Tests that IteratorResult<T> from Tsonic.Runtime doesn't collide

export function* accumulator(
  initial: number
): Generator<number, number, number> {
  let total = initial;
  let count = 0;

  while (count < 3) {
    const value = yield total;
    total = total + value;
    count = count + 1;
  }

  return total;
}
