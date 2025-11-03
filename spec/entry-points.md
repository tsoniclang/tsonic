# Entry Points & Main Functions

## Entry Point Detection

The entry file specified to the CLI determines the program entry point.

## Scenarios

### 1. Exported main() Function

**TypeScript:**

```typescript
// main.ts
export function main(): void {
  console.log("Hello from main");
}
```

**Generated C#:**

```csharp
namespace My.App
{
    public static class main
    {
        public static void main()
        {
            console.log("Hello from main");
        }
    }
}
```

**Generated Program.cs:**

```csharp
using My.App;

public static class Program
{
    public static void Main(string[] args)
    {
        main.main();
    }
}
```

### 2. Exported async main() Function

**TypeScript:**

```typescript
// main.ts
export async function main(): Promise<void> {
  await doAsyncWork();
  console.log("Done");
}
```

**Generated C#:**

```csharp
namespace My.App
{
    public static class main
    {
        public static async Task main()
        {
            await doAsyncWork();
            console.log("Done");
        }
    }
}
```

**Generated Program.cs:**

```csharp
using My.App;
using System.Threading.Tasks;

public static class Program
{
    public static async Task Main(string[] args)
    {
        await main.main();
    }
}
```

### 3. Top-Level Code Only

**TypeScript:**

```typescript
// main.ts
console.log("Starting application");
const config = loadConfig();
console.log(`Loaded config: ${config}`);
```

**Generated C#:**

```csharp
namespace My.App
{
    public static class main
    {
        public static void Main()  // Auto-generated Main for top-level code
        {
            console.log("Starting application");
            var config = loadConfig();
            console.log($"Loaded config: {config}");
        }
    }
}
```

**No Program.cs needed** - the class already has Main

### 4. Top-Level Code + Exported Functions

**TypeScript:**

```typescript
// main.ts
console.log("Initializing");
const state = { ready: false };

export function run(): void {
  console.log("Running with state:", state);
}

export function cleanup(): void {
  console.log("Cleaning up");
}
```

**Generated C#:**

```csharp
namespace My.App
{
    public static class main
    {
        private static object state;

        static main()  // Static constructor for top-level code
        {
            console.log("Initializing");
            state = new { ready = false };
        }

        public static void run()
        {
            console.log("Running with state:", state);
        }

        public static void cleanup()
        {
            console.log("Cleaning up");
        }
    }
}
```

**ERROR TSN1020:** Entry file has top-level code but no `main()` export.
Either:

1. Add `export function main()` to provide entry point, OR
2. Move top-level code into a main() function

### 5. Top-Level Code + Exported main()

**TypeScript:**

```typescript
// main.ts
console.log("Setting up");
const config = { port: 3000 };

export function main(): void {
  console.log(`Starting on port ${config.port}`);
  startServer(config);
}
```

**Generated C#:**

```csharp
namespace My.App
{
    public static class main
    {
        private static object config;

        static main()  // Static constructor for top-level initialization
        {
            console.log("Setting up");
            config = new { port = 3000 };
        }

        public static void main()
        {
            console.log($"Starting on port {config.port}");
            startServer(config);
        }
    }
}
```

**Generated Program.cs:**

```csharp
using My.App;

public static class Program
{
    public static void Main(string[] args)
    {
        // Static constructor runs automatically before main()
        main.main();
    }
}
```

### 6. Class with Static Main

**TypeScript:**

```typescript
// Application.ts
export class Application {
  static main(): void {
    const app = new Application();
    app.run();
  }

  run(): void {
    console.log("Application running");
  }
}
```

**Generated C#:**

```csharp
namespace My.App
{
    public class Application
    {
        public static void main()
        {
            var app = new Application();
            app.run();
        }

        public void run()
        {
            console.log("Application running");
        }
    }
}
```

**Generated Program.cs:**

```csharp
using My.App;

public static class Program
{
    public static void Main(string[] args)
    {
        Application.main();
    }
}
```

## Top-Level Code Handling

### Variables in Top-Level Code

Top-level `const`/`let`/`var` become static fields:

```typescript
// app.ts
const VERSION = "1.0.0";
let counter = 0;
var isReady = false;
```

```csharp
public static class app
{
    private static readonly string VERSION = "1.0.0";
    private static double counter = 0;
    private static bool isReady = false;
}
```

### Statements in Top-Level Code

Top-level statements go in:

- Static constructor if there are also exports
- Main() method if no exports

```typescript
// init.ts
console.log("Initializing");
if (checkEnvironment()) {
  setupLogging();
}
```

With exports → static constructor:

```csharp
static init()
{
    console.log("Initializing");
    if (checkEnvironment())
    {
        setupLogging();
    }
}
```

Without exports → Main():

```csharp
public static void Main()
{
    console.log("Initializing");
    if (checkEnvironment())
    {
        setupLogging();
    }
}
```

### Async Top-Level Code

**NOT SUPPORTED in MVP** - ERROR TSN1021

```typescript
// main.ts
const data = await fetchData(); // ERROR TSN1021: Top-level await not supported
```

## Entry Point Rules Summary

1. **Has `export function main()`** → Use it as entry point
2. **Has `export async function main()`** → Use it as async entry point
3. **Only top-level code, no exports** → Wrap in Main()
4. **Top-level code + exports (no main)** → ERROR TSN1020
5. **Top-level code + export main()** → Top-level in static constructor, main() as entry
6. **Class with static main()** → Use Class.main() as entry

## Program.cs Generation

Generated when entry class method needs wrapping:

```csharp
// Program.cs template
using System;
using System.Threading.Tasks;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;
using {entry_namespace};

public static class Program
{
    public static {async_modifier} {return_type} Main(string[] args)
    {
        {await_modifier} {entry_class}.{entry_method}();
    }
}
```

Where:

- `async_modifier`: "async" if entry is async, else ""
- `return_type`: "Task" if async, else "void"
- `await_modifier`: "await" if async, else ""
- `entry_class`: The entry file's class name
- `entry_method`: "main" (the exported function name)

## Command Line Arguments

**NOT SUPPORTED in MVP** - Arguments not passed to TypeScript code

Future enhancement:

```typescript
export function main(args: string[]): void {
  console.log("Args:", args);
}
```

## Exit Codes

```typescript
export function main(): number {
  if (success) return 0;
  return 1;
}
```

```csharp
public static int main()
{
    if (success) return 0;
    return 1;
}
```

**Program.cs:**

```csharp
public static int Main(string[] args)
{
    return main.main();
}
```

## Examples

### Minimal Hello World

```typescript
// hello.ts
console.log("Hello World");
```

```csharp
// hello.cs
namespace My.App
{
    public static class hello
    {
        public static void Main()
        {
            console.log("Hello World");
        }
    }
}
```

### Web Server

```typescript
// server.ts
import { createServer } from "System.Net.Http";

const PORT = 8080;

export async function main(): Promise<void> {
  console.log(`Starting server on port ${PORT}`);
  const server = createServer();
  await server.listen(PORT);
}
```

### CLI Tool

```typescript
// cli.ts
export function main(): number {
  const command = getCommand();

  switch (command) {
    case "help":
      showHelp();
      return 0;
    case "version":
      console.log("1.0.0");
      return 0;
    default:
      console.error(`Unknown command: ${command}`);
      return 1;
  }
}
```
