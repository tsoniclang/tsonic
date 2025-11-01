# Generator Translation

## Overview

TypeScript generators (`function*`) support bidirectional communication: each `yield` pauses execution and the subsequent `next(value)` call resumes the generator with a new input value. C# iterators (`yield return`) only emit values; they cannot receive data between iterations. Tsonic reconciles this gap by emitting a shared exchange object that flows between the iterator and the caller.

## Translation Model

| TypeScript Concept    | C# Translation                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `function* name(...)` | Method returning `IEnumerable<Exchange>` (or `IAsyncEnumerable<Exchange>` for async generators) |
| `yield value`         | Assign to `exchange.Output` then `yield return exchange;`                                       |
| `next(value)`         | Caller sets `exchange.Input` before `MoveNext()`                                                |
| `yield* other()`      | `foreach (var item in Other()) yield return item;`                                              |
| `return value`        | `yield break;` and handle final result outside the iterator                                     |

The exchange object carries state in both directions. The generator writes to `Output`, yields, then on resume reads `Input` provided by the caller.

## Example Translation

### TypeScript Source

```typescript
function* accumulator(start = 0) {
  let total = start;
  while (true) {
    const value = yield total;
    total += value ?? 0;
  }
}
```

### Emitted C#

```csharp
public sealed class accumulator_exchange
{
    public double? Input { get; set; }
    public double Output { get; set; }
}

public static IEnumerable<accumulator_exchange> accumulator(double start = 0)
{
    double total = start;
    var exchange = new accumulator_exchange();

    while (true)
    {
        exchange.Output = total;
        yield return exchange;
        total += exchange.Input ?? 0;
    }
}
```

### Calling Pattern

```csharp
var iterator = accumulator(10).GetEnumerator();
iterator.MoveNext();
Console.WriteLine(iterator.Current.Output); // 10

iterator.Current.Input = 5;
iterator.MoveNext();
Console.WriteLine(iterator.Current.Output); // 15
```

## Why This Works

| C# Limitation                   | Mitigation                                                       |
| ------------------------------- | ---------------------------------------------------------------- |
| No `next(value)` channel        | Exchange object supplies an `Input` property                     |
| `yield` cannot accept arguments | Generator re-reads `exchange.Input` after resuming               |
| State machine is one-way        | Mutable exchange instance persists across yields                 |
| Async generators                | Use `IAsyncEnumerable<Exchange>` and coordinate input via awaits |

## Async Generators

For `async function*`, Tsonic emits `IAsyncEnumerable<Exchange>` and uses `await foreach` in the caller. Input is assigned before awaiting the next item. If back-pressure coordination is required, a future runtime helper may wrap `IAsyncEnumerable` with channels or `TaskCompletionSource` objects.

## Limitations

- Truly stackful coroutines are not supported; iteration remains pull-based.
- The shared exchange object introduces mutable state; concurrent callers must synchronize access.
- Exhausting the iterator (`return value`) requires external handling if the result should be surfaced.

## Guidance for Callers

Tsonic will ship a small runtime helper that exposes ergonomic `Next(value)` semantics over the generated iterator. Until then, callers should:

1. Retrieve the enumerator.
2. Call `MoveNext()` to advance.
3. Read `Current.Output`.
4. Set `Current.Input` before the next `MoveNext()`.

This preserves the bidirectional data flow that TypeScript developers expect from generators.
