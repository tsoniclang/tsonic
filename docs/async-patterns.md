# Async Patterns

Tsonic compiles TypeScript's async/await to C#'s Task-based async pattern. This guide covers async functions, for-await loops, and async generators.

## Overview

Async functions return `Promise<T>` in TypeScript, which compiles to `Task<T>` in C#:

```typescript
export async function fetchData(): Promise<string> {
  return "data";
}
```

Generated C#:

```csharp
public static async Task<string> fetchData()
{
    return "data";
}
```

## Async Functions

### Basic Async Function

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

async function delay(ms: number): Promise<void> {
  await Task.delay(ms);
}

export async function main(): Promise<void> {
  Console.writeLine("Starting...");
  await delay(1000);
  Console.writeLine("Done!");
}
```

### Returning Values

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

type User = {
  id: number;
  name: string;
};

async function fetchUser(id: number): Promise<User> {
  await Task.delay(10);
  return { id, name: "Alice" };
}

export async function main(): Promise<void> {
  const user = await fetchUser(123);
  Console.writeLine(user.name);
}
```

### Error Handling

Use try/catch with async/await:

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { Exception } from "@tsonic/dotnet/System.js";

async function riskyOperation(): Promise<string> {
  throw new Exception("Something failed");
}

export async function main(): Promise<void> {
  try {
    const result = await riskyOperation();
    Console.writeLine(result);
  } catch (e) {
    Console.writeLine("Error occurred");
  }
}
```

## For-Await Loops

Use `for await...of` to iterate over async iterables.

### Basic For-Await

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

async function* asyncNumbers(): AsyncGenerator<number> {
  for (let i = 0; i < 5; i++) {
    await Task.delay(100);
    yield i;
  }
}

export async function main(): Promise<void> {
  for await (const n of asyncNumbers()) {
    Console.writeLine(`Got: ${n}`);
  }
}
```

Generated C#:

```csharp
await foreach (var n in asyncNumbers())
{
    Console.WriteLine($"Got: {n}");
}
```

### With IAsyncEnumerable

.NET's `IAsyncEnumerable<T>` works with for-await:

```typescript
import { Console } from "@tsonic/dotnet/System.js";

declare function getItemsAsync(): AsyncIterable<string>;

export async function main(): Promise<void> {
  const items = getItemsAsync();
  for await (const item of items) {
    Console.writeLine(item);
  }
}
```

### Collecting Async Results

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

type Page = { index: number };

async function fetchPage(index: number): Promise<Page> {
  await Task.delay(10);
  return { index };
}

async function* fetchPages(): AsyncGenerator<Page> {
  for (let i = 1; i <= 10; i++) {
    yield await fetchPage(i);
  }
}

export async function main(): Promise<void> {
  const pages: Page[] = [];
  for await (const page of fetchPages()) {
    pages.push(page);
  }
  Console.writeLine(`Fetched ${pages.length} pages`);
}
```

## Async Generators

### Basic Async Generator

```typescript
import { Console } from "@tsonic/dotnet/System.js";
import { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

async function* countdown(n: number): AsyncGenerator<number> {
  while (n > 0) {
    await Task.delay(1000);
    yield n;
    n--;
  }
}

export async function main(): Promise<void> {
  for await (const n of countdown(5)) {
    Console.writeLine(`${n}...`);
  }
  Console.writeLine("Liftoff!");
}
```

### Bidirectional Async Generator

Async generators support bidirectional communication:

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
  Console.writeLine(`Initial: ${r1.value}`); // 10

  const r2 = await gen.next(5);
  Console.writeLine(`After +5: ${r2.value}`); // 15

  const r3 = await gen.next(20);
  Console.writeLine(`After +20: ${r3.value}`); // 35
}
```

### Async Yield Delegation

Delegate to other async generators with `yield*`:

```typescript
async function* inner(): AsyncGenerator<string> {
  yield "a";
  await delay(100);
  yield "b";
}

async function* outer(): AsyncGenerator<string> {
  yield "start";
  yield* inner(); // Delegates asynchronously
  yield "end";
}

export async function main(): Promise<void> {
  for await (const s of outer()) {
    Console.writeLine(s); // start, a, b, end
  }
}
```

## Parallel Execution

### Promise.all Equivalent

Use array operations for parallel async:

```typescript
async function fetchAllUsers(ids: number[]): Promise<User[]> {
  const results: User[] = [];
  for (const id of ids) {
    const user = await fetchUser(id);
    results.push(user);
  }
  return results;
}
```

For true parallelism, use .NET's Task APIs:

```typescript
import { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

// Use Task.WhenAll for parallel execution
```

## Common Patterns

### Retry Pattern

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  retries: number
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (e) {
      if (i === retries - 1) throw e;
      await delay(1000 * (i + 1)); // Exponential backoff
    }
  }
  throw new Error("Should not reach here");
}
```

### Timeout Pattern

```typescript
import { CancellationTokenSource } from "@tsonic/dotnet/System.Threading.js";

async function withTimeout<T>(
  operation: () => Promise<T>,
  ms: number
): Promise<T> {
  const cts = new CancellationTokenSource();
  cts.cancelAfter(ms);
  // Use cancellation token with operation
  return await operation();
}
```

### Producer-Consumer

```typescript
async function* producer(): AsyncGenerator<number> {
  for (let i = 0; i < 10; i++) {
    await delay(100);
    yield i;
  }
}

async function consumer(): Promise<number> {
  let sum = 0;
  for await (const n of producer()) {
    sum = sum + n;
  }
  return sum;
}
```

## Type Mappings

| TypeScript                | C#                                 |
| ------------------------- | ---------------------------------- |
| `Promise<T>`              | `Task<T>`                          |
| `Promise<void>`           | `Task`                             |
| `AsyncGenerator<T>`       | `IAsyncEnumerable<T>` (simplified) |
| `AsyncGenerator<Y, R, N>` | Wrapper class with async methods   |

## Async Entry Points

### Main Function

```typescript
export async function main(): Promise<void> {
  await someAsyncWork();
}
```

Generates:

```csharp
public static async Task Main()
{
    await someAsyncWork();
}
```

### Sync to Async Boundary

When calling async from sync code, use `.Result` or `.Wait()`:

```typescript
// In TypeScript, this would be at the entry point
import { Console } from "@tsonic/dotnet/System.js";

declare function syncWrapper(): string;

export function main(): void {
  const result = syncWrapper();
  Console.writeLine(result);
}

// This pattern is handled by the async main support
```

## Limitations

### No Promise Chaining

Tsonic does not support `.then()`, `.catch()`, or `.finally()`:

```typescript
// NOT SUPPORTED
declare const promise: Promise<number>;

promise.then((result) => result + 1);
promise.catch(() => 0);

// USE INSTEAD
export async function usePromise(): Promise<number> {
  try {
    const result = await promise;
    return result + 1;
  } catch {
    return 0;
  }
}
```

This is a deliberate design choice to ensure clean async/await code.

### Avoid Promise Constructors

```typescript
// Avoid Promise executor-style construction when targeting .NET tasks.
const promise = new Promise<number>((resolve) => {
  resolve(123);
});

// Prefer async functions that return Promise<T>.
export async function myOperation(): Promise<number> {
  return 123;
}
```

## Best Practices

### Always Await Promises

```typescript
// Good
await asyncOperation();

// Bad - promise not awaited
asyncOperation(); // Fire-and-forget, may cause issues
```

### Use Async Main

```typescript
// Preferred
export async function main(): Promise<void> {
  await setup();
  await run();
  await cleanup();
}
```

### Handle Errors at Boundaries

```typescript
import { Console } from "@tsonic/dotnet/System.js";

export async function main(): Promise<void> {
  try {
    await application();
  } catch (e) {
    Console.writeLine("Fatal error");
    // Log and exit
  }
}
```

### Avoid Mixing Patterns

```typescript
declare function fetchA(): Promise<number>;
declare function fetchB(): Promise<number>;
declare function fetchC(): Promise<number>;

// Good - consistent async/await
export async function good(): Promise<void> {
  const a = await fetchA();
  const b = await fetchB();
  const c = await fetchC();

  void a;
  void b;
  void c;
}

// Avoid - mixing patterns
export async function bad(): Promise<void> {
  const a = await fetchA();
  void a;

  // Don't mix (also: Promise.then/catch/finally is not supported in Tsonic)
  fetchB().then(() => {
    // ...
  });
}
```

## See Also

- [Generators](./generators.md) - Async generators in detail
- [Callbacks](./callbacks.md) - Async callbacks
- [.NET Interop](./dotnet-interop.md) - Task-based APIs
- [Language Reference](./language.md) - Full language features
