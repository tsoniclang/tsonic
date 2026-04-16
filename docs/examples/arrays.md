---
title: Arrays and Collections
---

# Arrays and Collections

## JS-surface array methods

```ts
export function main(): void {
  const xs = [1, 2, 3];
  const ys = xs.map((x) => x + 1).filter((x) => x > 2);
  console.log(JSON.stringify(ys));
}
```

This behavior comes from the active `@tsonic/js` surface.

## CLR collections

```ts
import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

const xs = new List<number>();
xs.Add(1);
xs.Add(2);
```

This behavior comes from generated CLR binding packages, not from the JS
surface.

## LINQ contrast

```ts
import { Enumerable } from "@tsonic/dotnet/System.Linq.js";

const xs = [1, 2, 3];
const ys = Enumerable.Where(xs, (x: number): boolean => x > 1);
```

Here the array is still a normal Tsonic/TypeScript array, but LINQ behavior is
imported explicitly from CLR bindings.

## Typed arrays

On the JS surface, typed arrays come from `@tsonic/js`:

```ts
export function main(): void {
  const bytes = new Uint8Array([1, 2, 3]);
  bytes.set([4, 5], 1);
  console.log(bytes.length);
}
```

## Rule of thumb

- JS array/typed-array behavior comes from `@tsonic/js`
- CLR collections and LINQ come from generated binding packages
- keep those models separate in your mental model and in your imports
