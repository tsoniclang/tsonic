// Module A: Counter generator
// Tests that IteratorResult<T> from Tsonic.Runtime doesn't collide

export function* counter(start: number): Generator<number, string, number> {
  let value = start;
  let count = 0;

  while (count < 3) {
    const increment = yield value;
    value = value + increment;
    count = count + 1;
  }

  return `Counter finished at ${value}`;
}
