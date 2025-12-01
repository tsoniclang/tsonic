# Building Real Applications

**Goal**: Learn project structure and patterns for real-world Tsonic applications

**Time**: ~30 minutes

**Prerequisites**: Completed [Using .NET Libraries](03-using-dotnet.md)

---

## Project Structure

A well-organized Tsonic project follows this structure:

```
my-app/
├── main.ts                 # Entry point
├── src/
│   ├── cli/
│   │   ├── commands.ts
│   │   └── parser.ts
│   ├── core/
│   │   ├── config.ts
│   │   └── logger.ts
│   ├── models/
│   │   ├── User.ts
│   │   └── Product.ts
│   └── services/
│       ├── database.ts
│       └── api.ts
├── tests/
│   ├── unit/
│   └── integration/
├── config/
│   ├── development.json
│   └── production.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## Module Organization

### Directory → Namespace Mapping

Tsonic maps directories to C# namespaces **exactly**:

```
src/models/User.ts       → MyApp.src.models.User
src/services/api.ts      → MyApp.src.services.api
```

**Rules**:

- Exact case preserved
- Dots in path become dots in namespace
- Use meaningful directory names

### Importing Between Modules

```typescript
// src/models/User.ts
export interface User {
  id: number;
  name: string;
  email: string;
}

// src/services/database.ts
import { User } from "../models/User.ts"; // ← .ts extension!

export function getUser(id: number): User {
  // ...
}

// main.ts
import { getUser } from "./src/services/database.ts";
import { User } from "./src/models/User.ts";

export function main(): void {
  const user = getUser(1);
  console.log(user.name);
}
```

**Key Rules**:

1. **Always use `.ts` extension** for local imports
2. **Relative paths** (`./`, `../`) for local modules
3. **No extension** for .NET imports

---

## Configuration Management

### JSON Configuration Files

```typescript
// src/core/config.ts
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";

export interface AppConfig {
  database: {
    host: string;
    port: number;
    name: string;
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
  logging: {
    level: string;
  };
}

export function loadConfig(path: string): AppConfig {
  const json = File.ReadAllText(path);
  return JsonSerializer.Deserialize<AppConfig>(json);
}
```

```json
// config/development.json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "myapp_dev"
  },
  "api": {
    "baseUrl": "http://localhost:3000",
    "timeout": 30000
  },
  "logging": {
    "level": "debug"
  }
}
```

```typescript
// main.ts
import { loadConfig } from "./src/core/config.ts";
import { Environment } from "System";

export function main(): void {
  const env = Environment.GetEnvironmentVariable("APP_ENV") ?? "development";
  const configPath = `config/${env}.json`;

  const config = loadConfig(configPath);
  console.log(`Database: ${config.database.host}:${config.database.port}`);
}
```

---

## Error Handling

### Result Type Pattern

Instead of exceptions, use Result types for recoverable errors:

```typescript
// src/core/result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

```typescript
// src/services/database.ts
import { Result, Ok, Err } from "../core/result.ts";
import { User } from "../models/User.ts";

export function getUser(id: number): Result<User, string> {
  if (id < 0) {
    return Err("Invalid user ID");
  }

  const user = findUserById(id);
  if (!user) {
    return Err("User not found");
  }

  return Ok(user);
}
```

```typescript
// main.ts
import { getUser } from "./src/services/database.ts";

export function main(): void {
  const result = getUser(123);

  if (result.ok) {
    console.log(`User: ${result.value.name}`);
  } else {
    console.log(`Error: ${result.error}`);
  }
}
```

### Try-Catch for .NET Exceptions

Use try-catch for .NET API calls that may throw:

```typescript
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";

export function loadConfig(path: string): AppConfig | null {
  try {
    const json = File.ReadAllText(path);
    return JsonSerializer.Deserialize<AppConfig>(json);
  } catch (error) {
    console.log(`Failed to load config: ${error}`);
    return null;
  }
}
```

---

## Logging

### Simple Logger

```typescript
// src/core/logger.ts
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warning = 2,
  Error = 3,
}

export interface Logger {
  level: LogLevel;
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export function createLogger(level: LogLevel): Logger {
  const log = (lvl: LogLevel, prefix: string, message: string): void => {
    if (lvl >= level) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${prefix}: ${message}`);
    }
  };

  return {
    level,
    debug: (msg) => log(LogLevel.Debug, "DEBUG", msg),
    info: (msg) => log(LogLevel.Info, "INFO", msg),
    warn: (msg) => log(LogLevel.Warning, "WARN", msg),
    error: (msg) => log(LogLevel.Error, "ERROR", msg),
  };
}
```

```typescript
// main.ts
import { createLogger, LogLevel } from "./src/core/logger.ts";

export function main(): void {
  const logger = createLogger(LogLevel.Info);

  logger.debug("This won't show"); // Below threshold
  logger.info("Starting application");
  logger.warn("Configuration file not found");
  logger.error("Database connection failed");
}
```

### File Logging

```typescript
// src/core/logger.ts
import { File } from "System.IO";

export function createFileLogger(path: string, level: LogLevel): Logger {
  const log = (lvl: LogLevel, prefix: string, message: string): void => {
    if (lvl >= level) {
      const timestamp = new Date().toISOString();
      const line = `[${timestamp}] ${prefix}: ${message}\n`;
      File.AppendAllText(path, line);
    }
  };

  return {
    level,
    debug: (msg) => log(LogLevel.Debug, "DEBUG", msg),
    info: (msg) => log(LogLevel.Info, "INFO", msg),
    warn: (msg) => log(LogLevel.Warning, "WARN", msg),
    error: (msg) => log(LogLevel.Error, "ERROR", msg),
  };
}
```

---

## Command Line Interface

### Argument Parsing

```typescript
// src/cli/parser.ts
export interface CliArgs {
  command: string;
  options: Record<string, string>;
  flags: Set<string>;
}

export function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {
    command: args[0] ?? "help",
    options: {},
    flags: new Set(),
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      // Long option: --name=value or --flag
      const parts = arg.slice(2).split("=");
      if (parts.length === 2) {
        result.options[parts[0]] = parts[1];
      } else {
        result.flags.add(parts[0]);
      }
    } else if (arg.startsWith("-")) {
      // Short flag: -v
      result.flags.add(arg.slice(1));
    }
  }

  return result;
}
```

```typescript
// src/cli/commands.ts
import { CliArgs } from "./parser.ts";

export function runCommand(args: CliArgs): void {
  switch (args.command) {
    case "start":
      handleStart(args);
      break;
    case "stop":
      handleStop(args);
      break;
    case "status":
      handleStatus(args);
      break;
    default:
      console.log("Unknown command. Use --help for usage.");
  }
}

function handleStart(args: CliArgs): void {
  const port = args.options["port"] ?? "3000";
  const verbose = args.flags.has("verbose");

  console.log(`Starting server on port ${port}`);
  if (verbose) {
    console.log("Verbose mode enabled");
  }
}
```

```typescript
// main.ts
import { Environment } from "System";
import { parseArgs } from "./src/cli/parser.ts";
import { runCommand } from "./src/cli/commands.ts";

export function main(): void {
  const cmdLineArgs = Environment.GetCommandLineArgs();
  const args = parseArgs(cmdLineArgs.slice(1)); // Skip executable path

  runCommand(args);
}
```

Usage:

```bash
./bin/main start --port=8080 --verbose
./bin/main status
./bin/main stop
```

---

## Database Access (Example with SQLite)

### Model Layer

```typescript
// src/models/User.ts
export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export interface CreateUserRequest {
  name: string;
  email: string;
}
```

### Database Service

```typescript
// src/services/database.ts
import { Result, Ok, Err } from "../core/result.ts";
import { User, CreateUserRequest } from "../models/User.ts";
// Assume Microsoft.Data.Sqlite NuGet package
import { SqliteConnection, SqliteCommand } from "Microsoft.Data.Sqlite";

export class Database {
  private connection: SqliteConnection;

  constructor(connectionString: string) {
    this.connection = new SqliteConnection(connectionString);
    this.connection.Open();
  }

  createUser(req: CreateUserRequest): Result<User, string> {
    try {
      const cmd = this.connection.CreateCommand();
      cmd.CommandText = `
        INSERT INTO users (name, email, created_at)
        VALUES ($name, $email, $created_at)
        RETURNING id, name, email, created_at
      `;
      cmd.Parameters.AddWithValue("$name", req.name);
      cmd.Parameters.AddWithValue("$email", req.email);
      cmd.Parameters.AddWithValue("$created_at", DateTime.UtcNow);

      const reader = cmd.ExecuteReader();
      if (reader.Read()) {
        const user: User = {
          id: reader.GetInt32(0),
          name: reader.GetString(1),
          email: reader.GetString(2),
          createdAt: reader.GetDateTime(3),
        };
        return Ok(user);
      }

      return Err("Failed to create user");
    } catch (error) {
      return Err(`Database error: ${error}`);
    }
  }

  getUser(id: number): Result<User, string> {
    try {
      const cmd = this.connection.CreateCommand();
      cmd.CommandText = `
        SELECT id, name, email, created_at
        FROM users
        WHERE id = $id
      `;
      cmd.Parameters.AddWithValue("$id", id);

      const reader = cmd.ExecuteReader();
      if (reader.Read()) {
        const user: User = {
          id: reader.GetInt32(0),
          name: reader.GetString(1),
          email: reader.GetString(2),
          createdAt: reader.GetDateTime(3),
        };
        return Ok(user);
      }

      return Err("User not found");
    } catch (error) {
      return Err(`Database error: ${error}`);
    }
  }

  close(): void {
    this.connection.Close();
  }
}
```

---

## HTTP Server (Example with ASP.NET Core)

### Simple HTTP Server

```typescript
// src/services/server.ts
import {
  WebApplication,
  WebApplicationBuilder,
} from "Microsoft.AspNetCore.Builder";
import { Results } from "Microsoft.AspNetCore.Http";

export function createServer(port: number): WebApplication {
  const builder = WebApplication.CreateBuilder();
  const app = builder.Build();

  // GET /
  app.MapGet("/", () => Results.Ok("Hello from Tsonic!"));

  // GET /users/:id
  app.MapGet("/users/{id}", (id: number) => {
    const user = { id, name: "Alice", email: "alice@example.com" };
    return Results.Json(user);
  });

  // POST /users
  app.MapPost("/users", (req: CreateUserRequest) => {
    // Handle user creation
    const user = { id: 1, ...req };
    return Results.Created(`/users/${user.id}`, user);
  });

  return app;
}
```

```typescript
// main.ts
import { createServer } from "./src/services/server.ts";

export function main(): void {
  const port = 3000;
  const app = createServer(port);

  console.log(`Server listening on http://localhost:${port}`);
  app.Run();
}
```

---

## Testing

### Unit Tests

```typescript
// tests/unit/parser.test.ts
import { parseArgs } from "../../src/cli/parser.ts";

export function testParseCommand(): void {
  const args = ["start", "--port=8080", "--verbose"];
  const result = parseArgs(args);

  console.assert(result.command === "start");
  console.assert(result.options["port"] === "8080");
  console.assert(result.flags.has("verbose"));

  console.log("✓ testParseCommand passed");
}

export function testParseFlags(): void {
  const args = ["status", "-v", "-d"];
  const result = parseArgs(args);

  console.assert(result.command === "status");
  console.assert(result.flags.has("v"));
  console.assert(result.flags.has("d"));

  console.log("✓ testParseFlags passed");
}
```

```typescript
// tests/unit/index.ts
import { testParseCommand, testParseFlags } from "./parser.test.ts";

export function main(): void {
  testParseCommand();
  testParseFlags();

  console.log("\nAll tests passed!");
}
```

Run tests:

```bash
tsonic build tests/unit/index.ts -o tests/bin/unit-tests
./tests/bin/unit-tests
```

---

## Complete Example: CLI Task Manager

```typescript
// src/models/Task.ts
export interface Task {
  id: number;
  title: string;
  done: boolean;
  createdAt: Date;
}

// src/services/tasks.ts
import { Task } from "../models/Task.ts";
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";

const TASKS_FILE = "tasks.json";

export function loadTasks(): Task[] {
  if (!File.Exists(TASKS_FILE)) {
    return [];
  }

  const json = File.ReadAllText(TASKS_FILE);
  return JsonSerializer.Deserialize<Task[]>(json);
}

export function saveTasks(tasks: Task[]): void {
  const json = JsonSerializer.Serialize(tasks);
  File.WriteAllText(TASKS_FILE, json);
}

export function addTask(title: string): Task {
  const tasks = loadTasks();
  const newTask: Task = {
    id: tasks.length + 1,
    title,
    done: false,
    createdAt: new Date(),
  };

  tasks.push(newTask);
  saveTasks(tasks);

  return newTask;
}

export function completeTask(id: number): boolean {
  const tasks = loadTasks();
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return false;
  }

  task.done = true;
  saveTasks(tasks);
  return true;
}

export function listTasks(): Task[] {
  return loadTasks();
}

// src/cli/commands.ts
import { addTask, completeTask, listTasks } from "../services/tasks.ts";

export function handleAdd(title: string): void {
  const task = addTask(title);
  console.log(`✓ Added task #${task.id}: ${task.title}`);
}

export function handleDone(id: number): void {
  if (completeTask(id)) {
    console.log(`✓ Completed task #${id}`);
  } else {
    console.log(`✗ Task #${id} not found`);
  }
}

export function handleList(): void {
  const tasks = listTasks();

  if (tasks.length === 0) {
    console.log('No tasks yet. Add one with: tasks add "Your task"');
    return;
  }

  console.log("\nTasks:");
  for (const task of tasks) {
    const status = task.done ? "✓" : " ";
    console.log(`  [${status}] #${task.id}: ${task.title}`);
  }
  console.log();
}

// main.ts
import { Environment } from "System";
import { handleAdd, handleDone, handleList } from "./src/cli/commands.ts";

export function main(): void {
  const args = Environment.GetCommandLineArgs().slice(1);

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  tasks list");
    console.log('  tasks add "Task title"');
    console.log("  tasks done <id>");
    return;
  }

  const command = args[0];

  switch (command) {
    case "list":
      handleList();
      break;
    case "add":
      if (args.length < 2) {
        console.log('Usage: tasks add "Task title"');
        return;
      }
      handleAdd(args[1]);
      break;
    case "done":
      if (args.length < 2) {
        console.log("Usage: tasks done <id>");
        return;
      }
      handleDone(parseInt(args[1]));
      break;
    default:
      console.log(`Unknown command: ${command}`);
  }
}
```

Build and use:

```bash
tsonic build main.ts -o bin/tasks

# Add tasks
./bin/tasks add "Buy groceries"
./bin/tasks add "Write documentation"

# List tasks
./bin/tasks list

# Complete task
./bin/tasks done 1

# List again
./bin/tasks list
```

---

## Best Practices

### 1. Organize by Feature

```
src/
├── users/
│   ├── models.ts
│   ├── service.ts
│   └── handlers.ts
├── tasks/
│   ├── models.ts
│   ├── service.ts
│   └── handlers.ts
└── auth/
    ├── models.ts
    └── service.ts
```

### 2. Use TypeScript Strict Mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### 3. Separate Business Logic from I/O

```typescript
// ✅ GOOD - Pure business logic
export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// ❌ BAD - Mixed concerns
export function calculateTotal(cartId: string): number {
  const items = database.getItems(cartId); // I/O in business logic!
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

### 4. Use Result Types for Errors

```typescript
// ✅ GOOD - Explicit error handling
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return Err("Division by zero");
  }
  return Ok(a / b);
}

// ❌ BAD - Throwing exceptions for control flow
function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Division by zero");
  }
  return a / b;
}
```

---

## Key Takeaways

1. **Organize by feature** - Group related code together
2. **Use Result types** - For recoverable errors
3. **Try-catch for .NET** - When calling .NET APIs
4. **Configuration files** - JSON with strong typing
5. **Logging** - Essential for debugging production issues
6. **CLI parsing** - Handle arguments cleanly
7. **Testing** - Write tests as separate executables

---

## Next Steps

- **[Deployment →](05-deployment.md)** - Ship your application
- **[Examples](../examples/INDEX.md)** - More complete applications
- **[Cookbook](../cookbook/INDEX.md)** - Common patterns and recipes

---

**Previous**: [← Using .NET Libraries](03-using-dotnet.md) | **Next**: [Deployment →](05-deployment.md)
