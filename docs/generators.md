# Generators

Tsonic supports generators, async generators, and broad deterministic yield lowering.

## Basic Generator

```ts
export function* numbers(): Generator<number, void, void> {
  yield 1;
  yield 2;
  yield 3;
}
```

## Generator With Return Value

```ts
export function* work(): Generator<number, string, void> {
  yield 1;
  return "done";
}
```

## Bidirectional Generator

```ts
export function* echo(): Generator<string, void, string> {
  const first = yield "ready";
  console.log(first);
}
```

## Async Generator

```ts
export async function* stream(): AsyncGenerator<number, void, void> {
  yield 1;
  yield 2;
}
```

## Yield Lowering

Supported yield contexts now include many direct and nested positions:

- return expressions
- conditional expressions
- `if` / `while` / `switch` conditions
- `for` initializer / condition / update
- `for-of` / `for-in` expression positions
- compound assignment patterns in supported target shapes

Irreducible residual cases still fail with `TSN6101`.

## Guidance

- keep generator state machines explicit
- if a yield position still fails, prefer rewriting it to a clearer statement-level shape instead of trying to force the compiler through an ambiguous nested expression
