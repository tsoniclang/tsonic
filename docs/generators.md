# Generators

Tsonic supports JavaScript generator functions with full bidirectional communication. This guide covers basic generators, async generators, and the advanced bidirectional patterns.

## Overview

Generator functions are declared with `function*` and use `yield` to produce values:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function* counter(): Generator<number> {
  yield 1;
  yield 2;
  yield 3;
}

for (const n of counter()) {
  Console.WriteLine(n); // 1, 2, 3
}
```

## Generator Type Signature

The full generator type is `Generator<TYield, TReturn, TNext>`:

| Type Parameter | Description                             | Default     |
| -------------- | --------------------------------------- | ----------- |
| `TYield`       | Type of values yielded by the generator | Required    |
| `TReturn`      | Type of the final return value          | `void`      |
| `TNext`        | Type of values passed to `next()`       | `undefined` |

### Basic Generator (Yield Only)

When you only need to yield values:

```typescript
function* range(start: number, end: number): Generator<number> {
  for (let i = start; i <= end; i++) {
    yield i;
  }
}
```

### Generator with Return Value

When the generator returns a final value:

```typescript
function* countdown(n: number): Generator<number, string> {
  while (n > 0) {
    yield n;
    n--;
  }
  return "Liftoff!";
}
```

### Bidirectional Generator

When the generator receives values from the caller:

```typescript
function* accumulator(start: number): Generator<number, void, number> {
  let total = start;
  while (true) {
    const received = yield total;
    total += received;
  }
}
```

## Using Generators

### Iteration

Use `for...of` to iterate over yielded values:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function* fibonacci(): Generator<number> {
  let a = 0,
    b = 1;
  while (a < 100) {
    yield a;
    [a, b] = [b, a + b];
  }
}

for (const n of fibonacci()) {
  Console.WriteLine(n); // 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89
}
```

### Manual Iteration with `next()`

Use `.next()` for manual control:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function* counter(): Generator<number> {
  yield 1;
  yield 2;
  yield 3;
}

const gen = counter();
Console.WriteLine(gen.next().value); // 1
Console.WriteLine(gen.next().value); // 2
Console.WriteLine(gen.next().value); // 3
Console.WriteLine(gen.next().done); // true
```

### IteratorResult

Each `next()` call returns an `IteratorResult<T>`:

```typescript
interface IteratorResult<T> {
  value: T;
  done: boolean;
}
```

- `done: false` - Generator yielded a value
- `done: true` - Generator has completed

## Bidirectional Communication

### Sending Values with `next(value)`

Pass values into the generator using `next(value)`:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function* accumulator(start: number): Generator<number, void, number> {
  let total = start;
  while (true) {
    const received = yield total;
    total = total + received;
  }
}

export function main(): void {
  const gen = accumulator(0);

  // First next() starts the generator - value is ignored
  Console.WriteLine(gen.next().value); // 0

  // Subsequent next(value) passes value to generator
  Console.WriteLine(gen.next(5).value); // 5
  Console.WriteLine(gen.next(10).value); // 15
  Console.WriteLine(gen.next(3).value); // 18
}
```

### First `next()` Semantics

The value passed to the first `next()` call is **always ignored** (per JavaScript spec):

```typescript
function* echo(): Generator<string, void, string> {
  while (true) {
    const msg = yield "ready";
    yield `Echo: ${msg}`;
  }
}

const gen = echo();
gen.next("ignored"); // First call - "ignored" is discarded
// Returns: { value: "ready", done: false }
gen.next("hello"); // "hello" is received
// Returns: { value: "Echo: hello", done: false }
```

### Practical Example: Data Processor

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function* dataProcessor(): Generator<string, number, number> {
  let sum = 0;
  let count = 0;

  while (true) {
    const value = yield `Received ${count} values, sum = ${sum}`;
    if (value < 0) {
      return sum; // Negative value signals end
    }
    sum = sum + value;
    count = count + 1;
  }
}

export function main(): void {
  const processor = dataProcessor();

  Console.WriteLine(processor.next().value); // "Received 0 values, sum = 0"
  Console.WriteLine(processor.next(10).value); // "Received 1 values, sum = 10"
  Console.WriteLine(processor.next(20).value); // "Received 2 values, sum = 30"
  Console.WriteLine(processor.next(5).value); // "Received 3 values, sum = 35"

  const final = processor.next(-1);
  Console.WriteLine(`Done: ${final.done}`); // "Done: true"
}
```

## Generator Control Methods

### `next(value?)`

Advances the generator to the next yield point:

```typescript
const gen = myGenerator();
const result = gen.next(); // Start or resume
const result2 = gen.next(42); // Resume with value 42
```

### `return(value)`

Terminates the generator with a specified return value:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function* counter(): Generator<number, string> {
  let i = 0;
  while (true) {
    yield i++;
  }
}

const gen = counter();
Console.WriteLine(gen.next().value); // 0
Console.WriteLine(gen.next().value); // 1
gen.return("done"); // Terminates generator
Console.WriteLine(gen.next().done); // true
```

**Note:** The value passed to `return()` becomes the generator's return value but does NOT appear in the `IteratorResult.value`. Access it via the `returnValue` property (Tsonic extension).

### `throw(error)` - Limitation

The `throw()` method terminates the generator, but **does NOT inject the exception at the yield point** like JavaScript does.

```typescript
// This JavaScript pattern does NOT work the same in Tsonic:
function* withTryCatch(): Generator<number> {
  try {
    yield 1;
    yield 2;
  } catch (e) {
    yield -1; // In JS, gen.throw() would resume here
  }
}

const gen = withTryCatch();
gen.next(); // { value: 1, done: false }
gen.throw(Error()); // In JS: { value: -1, done: false }
// In Tsonic: throws immediately, no catch
```

This is a fundamental limitation of C# iterators which don't support resumption with exceptions.

## Return Values

### Capturing Return Values

Generators can return a final value using `return`:

```typescript
function* countdown(n: number): Generator<number, string, number> {
  while (n > 0) {
    const step = yield n;
    n = n - (step > 0 ? step : 1);
  }
  return "Liftoff!";
}
```

### Accessing Return Values

The return value is available after the generator completes:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

const gen = countdown(3);
Console.WriteLine(gen.next().value); // 3
Console.WriteLine(gen.next(1).value); // 2
Console.WriteLine(gen.next(1).value); // 1
const final = gen.next(1);
Console.WriteLine(final.done); // true
// final.value in JS would be "Liftoff!"
```

**Tsonic Extension:** Use the `returnValue` property to access the return value:

```typescript
const returnValue = gen.returnValue; // "Liftoff!"
```

## Async Generators

### Basic Async Generator

Use `async function*` for asynchronous generators:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

async function* fetchPages(): AsyncGenerator<string> {
  for (let page = 1; page <= 3; page++) {
    await delay(100);
    yield `Page ${page}`;
  }
}

export async function main(): Promise<void> {
  for await (const page of fetchPages()) {
    Console.WriteLine(page);
  }
}
```

### Bidirectional Async Generator

Async generators also support bidirectional communication:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

async function* asyncAccumulator(
  start: number
): AsyncGenerator<number, number, number> {
  let total = start;
  while (true) {
    const received = yield total;
    total = total + received;
  }
}

export async function main(): Promise<void> {
  const gen = asyncAccumulator(10);

  const r1 = await gen.next();
  Console.WriteLine(`Initial: ${r1.value}`); // 10

  const r2 = await gen.next(5);
  Console.WriteLine(`After +5: ${r2.value}`); // 15

  const r3 = await gen.next(20);
  Console.WriteLine(`After +20: ${r3.value}`); // 35
}
```

### For-Await Loops

Use `for await...of` to iterate over async generators:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

async function* asyncRange(start: number, end: number): AsyncGenerator<number> {
  for (let i = start; i <= end; i++) {
    await delay(100);
    yield i;
  }
}

export async function main(): Promise<void> {
  for await (const n of asyncRange(1, 5)) {
    Console.WriteLine(n); // 1, 2, 3, 4, 5 (with delays)
  }
}
```

## Yield Delegation

Use `yield*` to delegate to another generator:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function* inner(): Generator<number> {
  yield 1;
  yield 2;
}

function* outer(): Generator<number> {
  yield 0;
  yield* inner(); // Delegate to inner
  yield 3;
}

for (const n of outer()) {
  Console.WriteLine(n); // 0, 1, 2, 3
}
```

### Async Yield Delegation

Async generators can delegate to other async iterables:

```typescript
async function* asyncInner(): AsyncGenerator<string> {
  yield "a";
  yield "b";
}

async function* asyncOuter(): AsyncGenerator<string> {
  yield "start";
  yield* asyncInner();
  yield "end";
}
```

## Generated C# Code

Tsonic generates wrapper classes for bidirectional generators. Understanding this helps with debugging.

### Simple Generator

```typescript
function* counter(): Generator<number> {
  yield 1;
  yield 2;
}
```

Generates a simple `IEnumerable<double>`:

```csharp
public static IEnumerable<double> counter()
{
    yield return 1.0;
    yield return 2.0;
}
```

### Bidirectional Generator

```typescript
function* accumulator(): Generator<number, void, number> {
  let total = 0;
  while (true) {
    const v = yield total;
    total += v;
  }
}
```

Generates a wrapper class with exchange object:

```csharp
// Exchange object for bidirectional communication
public sealed class accumulator_exchange
{
    public double? Input { get; set; }
    public double Output { get; set; }
}

// Wrapper class providing next(), return(), throw()
public sealed class accumulator_Generator
{
    private readonly IEnumerator<accumulator_exchange> _enumerator;
    private readonly accumulator_exchange _exchange;
    private bool _done = false;

    public IteratorResult<double> next(double? value = default) { ... }
    public IteratorResult<double> @return(object? value = default) { ... }
    public IteratorResult<double> @throw(object e) { ... }
}
```

## Common Patterns

### Infinite Sequence

```typescript
import { Console } from "@tsonic/dotnet/System.js";

function* naturals(): Generator<number> {
  let n = 0;
  while (true) {
    yield n++;
  }
}

// Take first 5
const gen = naturals();
for (let i = 0; i < 5; i++) {
  Console.WriteLine(gen.next().value);
}
```

### State Machine

```typescript
type State = "idle" | "running" | "stopped";

function* stateMachine(): Generator<State, void, string> {
  let state: State = "idle";
  while (true) {
    const command = yield state;
    if (command === "start" && state === "idle") {
      state = "running";
    } else if (command === "stop" && state === "running") {
      state = "stopped";
    } else if (command === "reset") {
      state = "idle";
    }
  }
}
```

### Coroutine Communication

```typescript
function* producer(): Generator<number, void, void> {
  for (let i = 0; i < 5; i++) {
    yield i;
  }
}

function* consumer(gen: Generator<number>): Generator<void, number, void> {
  let sum = 0;
  for (const n of gen) {
    sum += n;
    yield;
  }
  return sum;
}
```

## Limitations

1. **`.throw()` doesn't inject exceptions** - Exceptions are thrown externally, not at yield point
2. **No generator delegation return values** - `yield*` doesn't capture delegated return values
3. **Type restrictions** - TNext must be compatible with C# nullable types

## See Also

- [Async Patterns](./async-patterns.md) - Async/await and for-await loops
- [Language Reference](./language.md) - Full language feature list
- [.NET Interop](./dotnet-interop.md) - Working with .NET async
