# Entry Points

Defining the entry point for your Tsonic application.

## Executable Entry Point

For executables, export a `main` function:

```typescript
// main.ts
export function main(): void {
  console.log("Hello, Tsonic!");
}
```

Compile with:
```bash
tsonic build main.ts --namespace MyApp
./main
```

## Async Entry Point

For async programs:

```typescript
export async function main(): Promise<void> {
  const data = await fetchData();
  console.log(data);
}
```

## With Arguments

Command-line arguments:

```typescript
export function main(args: string[]): void {
  for (const arg of args) {
    console.log(arg);
  }
}
```

```bash
./myapp arg1 arg2 arg3
```

## Library Output

For libraries (no entry point), use `--output-type library`:

```bash
tsonic build src/index.ts --output-type library
```

This produces a `.dll` instead of an executable.

## Return Codes

Return an exit code:

```typescript
export function main(): int {
  if (errorCondition) {
    return 1;  // Error
  }
  return 0;  // Success
}
```

## See Also

- [CLI Reference](../cli.md) - Build commands
- [Build Output](../build-output.md) - What gets generated
