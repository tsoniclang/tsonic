# Arrays and Tuples

## Native Arrays

```ts
const xs = [1, 2, 3];
const first = xs[0];
const len = xs.length;
```

## JS Surface Array Methods

```ts
const xs = [1, 2, 3];
const ys = xs.filter((x) => x > 1).map((x) => x * 2);
console.log(ys.join(","));
```

## `Array.from`

```ts
const counts = new Map<string, number>();
counts.set("alpha", 1);
counts.set("beta", 2);

const keys = Array.from(counts.keys());
console.log(keys.join(","));
```

## Tuples

```ts
const point: [number, number] = [10, 20];
console.log(point[0], point[1]);
```

## CLR Contrast

If you want explicit LINQ/BCL APIs, import them explicitly rather than relying on the JS surface:

```ts
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";

const xs = [1, 2, 3];
const ys = Enumerable.Where(xs, (x: number): boolean => x > 1);
```
