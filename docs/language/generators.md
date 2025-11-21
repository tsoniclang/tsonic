# Generators

Generator functions in Tsonic.

## Overview

TypeScript generator functions (`function*`) compile to C# iterators with bidirectional communication using exchange objects.

## Basic Generators

```typescript
function* counter(): Generator<number> {
  let i = 0;
  while (true) {
    yield i++;
  }
}

const gen = counter();
console.log(gen.next().value); // 0
console.log(gen.next().value); // 1
```

Becomes C# with `IEnumerable<T>`:

```csharp
public static IEnumerable<counter_exchange> counter()
{
    var exchange = new counter_exchange();
    var i = 0.0;
    while (true)
    {
        exchange.Output = i++;
        yield return exchange;
    }
}
```

## Bidirectional Generators

Generators can receive values via `next(value)`:

```typescript
function* accumulator(start = 0) {
  let total = start;
  while (true) {
    const value = yield total;
    total += value ?? 0;
  }
}

const gen = accumulator(10);
console.log(gen.next().value); // 10
console.log(gen.next(5).value); // 15
console.log(gen.next(3).value); // 18
```

Uses exchange objects for bidirectional communication.

## Async Generators

```typescript
async function* fetchData(): AsyncGenerator<string> {
  for (let i = 0; i < 5; i++) {
    await delay(100);
    yield `Item ${i}`;
  }
}

for await (const item of fetchData()) {
  console.log(item);
}
```

Maps to `IAsyncEnumerable<T>` in C#.

## See Also

- For implementation details, see engineering spec: `../spec/appendices/generators-deep-dive.md`
