# Generator Translation

## Overview

TypeScript and JavaScript generators (`function*`) are **bidirectional coroutines**: each `yield` pauses execution and `next(value)` resumes the generator with a new input value. C# iterators (`yield return`) are **one‑way state machines**—they can yield values but cannot receive data when resumed. C# async generators (`await foreach` / `IAsyncEnumerable<T>`) extend the model to support asynchronous work inside the generator, but they are still one‑way.

To preserve TypeScript semantics, Tsonic emits **shared exchange objects**. Each `yield` returns the same reference object; the caller mutates it (e.g., setting an `Input` property) before resuming, and the generator reads that state after `MoveNext()` (or `await foreach`).

## Translation Model

| TypeScript Concept        | C# Translation                                                                 |
| ------------------------- | ----------------------------------------------------------------------------- |
| `function* name(...)`     | Method returning `IEnumerable<Exchange>`                                      |
| `async function* name()`   | Method returning `IAsyncEnumerable<Exchange>`                                 |
| `yield value`             | Assign `exchange.Output = value; yield return exchange;`                      |
| `next(value)`             | Caller sets `exchange.Input = value;` before resuming                         |
| `yield* otherGenerator()` | `foreach (var item in Other()) yield return item;`                            |
| `await` inside generator  | Only in async version (`async IAsyncEnumerable<Exchange>`)                    |
| `return value`            | `yield break;` and handle final result externally                             |

## Synchronous Generator Example

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
        yield return exchange;           // pause generator
        total += exchange.Input ?? 0;     // consume caller input
    }
}
```

### Usage
```csharp
var iter = accumulator(10).GetEnumerator();
iter.MoveNext();
Console.WriteLine(iter.Current.Output);  // 10

iter.Current.Input = 5;
iter.MoveNext();
Console.WriteLine(iter.Current.Output);  // 15

iter.Current.Input = 3;
iter.MoveNext();
Console.WriteLine(iter.Current.Output);  // 18
```

## Asynchronous Generator Example

### TypeScript Source
```typescript
async function* asyncAccumulator(start = 0) {
  let total = start;
  while (true) {
    const value = yield total;
    await new Promise(resolve => setTimeout(resolve, 100));
    total += value ?? 0;
  }
}
```

### Emitted C#
```csharp
public sealed class asyncAccumulator_exchange
{
    public double? Input { get; set; }
    public double Output { get; set; }
}

public static async IAsyncEnumerable<asyncAccumulator_exchange> asyncAccumulator(double start = 0)
{
    double total = start;
    var exchange = new asyncAccumulator_exchange();

    while (true)
    {
        exchange.Output = total;
        yield return exchange;                  // yield reference, pause async iterator
        await Task.Delay(100);                  // perform async work
        total += exchange.Input ?? 0;           // consume caller input after resume
    }
}
```

### Usage
```csharp
await foreach (var ex in asyncAccumulator(10))
{
    Console.WriteLine(ex.Output);
    ex.Input = ex.Output + 5;   // feed next iteration
}
```

## Why This Works

| Limitation in C#                          | Mitigation in Conversion                                      |
| ----------------------------------------- | ------------------------------------------------------------- |
| No `next(value)` parameter on iterators   | Share a mutable exchange object with `Input`/`Output` fields  |
| `yield` cannot accept arguments           | Generator re-reads `exchange.Input` after `MoveNext()`        |
| Async iterators are still one-way         | Same exchange pattern with `IAsyncEnumerable<T>`              |
| No stackful coroutine semantics           | Rely on compiler-generated state machines (sync & async)      |
| Need bidirectional communication          | Caller mutates exchange object between iterations             |

## Recommended Conversion Rules

| TypeScript Construct        | Generated C# Pattern                                                        |
| --------------------------- | ---------------------------------------------------------------------------- |
| `function*`                 | `IEnumerable<Exchange>`                                                     |
| `async function*`           | `IAsyncEnumerable<Exchange>`                                                |
| `yield value`               | `exchange.Output = value; yield return exchange;`                           |
| `yield* other()`            | `foreach (var item in Other()) yield return item;`                          |
| `next(value)`               | Caller sets `Current.Input` before `MoveNext()` / `await foreach` resumes   |
| `return value`              | `yield break;` (final value handled separately if needed)                   |
| Generator declaration       | Emit typed `Exchange` class/record per generator                            |
| Async `await` inside body   | Allowed only for async generators (`async IAsyncEnumerable<Exchange>`)      |

## Use Cases

| Scenario                   | TypeScript Behaviour                                  | C# Translation Strategy                            |
| -------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Stateful accumulators      | Yield totals, accept deltas via `next(value)`          | Exchange object: `Output`/`Input` per iteration     |
| Interactive pipelines      | Send commands back to generator through `next(value)`  | Exchange carries command/response payloads          |
| Async event streams        | `async function*` streaming data with `await` delays    | `IAsyncEnumerable<Exchange>` with `await` operations |
| Delegating generators      | `yield*` re-exports another generator’s values         | `foreach` pass-through in generated C#              |

## Limitations

- No support for true stackful coroutines (multiple entry points). Execution remains caller-driven.
- Shared exchange instances introduce mutable shared state; consumers must ensure thread-safety.
- `return value` semantics require external handling (e.g., final value stored on exchange or wrapper).
- Async iteration remains pull-based (`await foreach` drives the generator).

## Summary

| TypeScript Concept      | C# Equivalent                             |
| ----------------------- | ----------------------------------------- |
| Synchronous generator   | `IEnumerable<Exchange>` + shared exchange |
| Async generator         | `IAsyncEnumerable<Exchange>` + shared exchange |
| `yield`                 | `yield return exchange`                   |
| `next(value)`           | Mutate exchange before resuming          |
| Bidirectional data flow | Maintained via exchange object            |
| `await` (async generator)| Native `await` inside `IAsyncEnumerable`  |

This approach preserves the logical behaviour of TypeScript generators while fitting within C#’s iterator and async enumerator models. Each generator gets an auto-generated exchange type to keep payloads strongly typed, and both sync and async patterns rely on the same explicit, shared mutable state.
