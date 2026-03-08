# Callbacks

Tsonic lowers callbacks to concrete CLR delegate shapes.

## Plain Callbacks

```ts
const xs = [1, 2, 3];
const ys = xs.map((x) => x + 1);
```

## Contextual Typing

Supported:

```ts
const f: ({ x }: { x: number }) => number = ({ x }) => x;
const g: (x?: number) => number = (x = 0) => x + 1;
const h: (...xs: number[]) => number = (...xs) => xs.length;
```

These are strict-valid TS cases and are part of current V1 support.

## Promise Callbacks

```ts
async function load(): Promise<number> {
  return 1;
}

const next = load().then((x) => x + 1);
```

## Generic Function Values

Supported in deterministic callable contexts:

```ts
const id = <T>(x: T): T => x;
const f: (x: number) => number = id;
```

Rejected when the value stays polymorphic with no runtime callable shape:

```ts
const id = <T>(x: T): T => x;
const copy = id;
```

## Guidance

- let contextual types carry callback parameter types where possible
- when in doubt, annotate the target callable shape instead of the callback body only
