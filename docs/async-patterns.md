# Async Patterns

Tsonic supports `async` / `await` directly and now supports deterministic Promise chains.

## Basic Async

```ts
export async function load(): Promise<string> {
  return "ok";
}

export async function main(): Promise<void> {
  const value = await load();
  console.log(value);
}
```

## Promise Constructor

```ts
function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}
```

## Promise Chains

Supported:

```ts
async function load(): Promise<number> {
  return 1;
}

export async function main(): Promise<void> {
  const result = await load()
    .then((x) => x + 1)
    .catch(() => 0)
    .finally(() => console.log("done"));

  console.log(result);
}
```

Tsonic normalizes the callback result type before lowering the chain.

## `Promise.all`

```ts
const values = await Promise.all([loadA(), loadB()]);
```

## `for await`

```ts
export async function main(stream: AsyncIterable<string>): Promise<void> {
  for await (const chunk of stream) {
    console.log(chunk);
  }
}
```

## Guidance

- prefer `async` / `await` for readability
- Promise chains are now supported, but still remain part of the same strict-AOT model
- keep dynamic imports closed-world even in async flows
