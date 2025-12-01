# Import Examples

Organizing code across multiple files.

## Local Imports

```typescript
// User.ts
export class User {
  constructor(
    public name: string,
    public email: string
  ) {}
}

// main.ts
import { User } from "./User.ts";

export function main() {
  const user = new User("Alice", "alice@example.com");
  console.log(user.name);
}
```

**Build:**

```bash
$ tsonic build src/main.ts
$ ./main
```

## Directory Structure

```
src/
├── main.ts
├── models/
│   ├── User.ts
│   └── Post.ts
└── services/
    └── UserService.ts
```

```typescript
// models/User.ts
export class User {
  constructor(
    public id: number,
    public name: string
  ) {}
}

// services/UserService.ts
import { User } from "../models/User.ts";

export class UserService {
  getUser(id: number): User {
    return new User(id, "Alice");
  }
}

// main.ts
import { UserService } from "./services/UserService.ts";

export function main() {
  const service = new UserService();
  const user = service.getUser(1);
  console.log(user.name);
}
```

## Mixed Imports

```typescript
// Local imports (with .ts)
import { User } from "./models/User.ts";
import { UserService } from "./services/UserService.ts";

// .NET imports (no extension)
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";

export function main() {
  const user = new User(1, "Alice");
  const json = JsonSerializer.Serialize(user);
  File.WriteAllText("user.json", json);
}
```

## Multiple Exports

```typescript
// utils.ts
export const PI = 3.14159;

export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

// main.ts
import { PI, add, multiply } from "./utils.ts";

export function main() {
  console.log(PI);
  console.log(add(5, 3));
  console.log(multiply(5, 3));
}
```

## See Also

- [Module System](../language/module-system.md)
- [Namespaces](../language/namespaces.md)
- [.NET Interop](../language/dotnet-interop.md)
