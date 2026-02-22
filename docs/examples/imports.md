# Import Examples

Module imports and exports in Tsonic.

## Local Imports

Local imports **must** use the `.js` extension:

```typescript
// models/User.ts
export interface User {
  id: number;
  name: string;
}

export class UserService {
  getUser(id: number): User {
    return { id, name: "Alice" };
  }
}
```

```typescript
// App.ts
import { Console } from "@tsonic/dotnet/System.js";
import { User, UserService } from "./models/User.js";

export function main(): void {
  const service = new UserService();
  const user = service.getUser(1);
  Console.WriteLine(user.name);
}
```

## Relative Paths

```typescript
// Same directory
import { helper } from "./helper.js";

// Parent directory
import { config } from "../config.js";

// Nested path
import { utils } from "./lib/utils/index.js";
```

## Named Exports

```typescript
// utils.ts
export const PI = 3.14159;

export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export interface Point {
  x: number;
  y: number;
}
```

```typescript
// App.ts
import { Console } from "@tsonic/dotnet/System.js";
import { PI, add, Point } from "./utils.js";

const point: Point = { x: 10, y: 20 };
Console.WriteLine(add(1, 2));
Console.WriteLine(PI);
```

## Namespace Import

Import all exports under a namespace:

```typescript
// utils.ts
export const PI = 3.14159;
export function add(a: number, b: number): number {
  return a + b;
}
```

```typescript
// App.ts
import { Console } from "@tsonic/dotnet/System.js";
import * as utils from "./utils.js";

Console.WriteLine(utils.PI);
Console.WriteLine(utils.add(1, 2));
```

## Re-exports (Barrel Files)

Create index files to re-export from multiple modules:

```typescript
// models/User.ts
export interface User {
  id: number;
  name: string;
}

// models/Product.ts
export interface Product {
  id: number;
  price: number;
}

// models/index.ts
export { User } from "./User.js";
export { Product } from "./Product.js";
```

```typescript
// App.ts
import { User, Product } from "./models/index.js";
```

## Type-Only Imports

Import types without runtime code:

```typescript
// types.ts
export interface Config {
  host: string;
  port: number;
}
```

```typescript
// App.ts
import type { Config } from "./types.js";

function loadConfig(): Config {
  return { host: "localhost", port: 8080 };
}
```

## .NET Imports

.NET imports use the `.js` extension (and do **not** use `.ts`):

```typescript
// System namespace
import { Console } from "@tsonic/dotnet/System.js";

// System.IO namespace
import { File, Directory } from "@tsonic/dotnet/System.IO.js";

// System.Collections.Generic
import { List, Dictionary } from "@tsonic/dotnet/System.Collections.Generic.js";
```

```typescript
export function main(): void {
  Console.WriteLine("Hello from .NET!");

  const exists = File.Exists("config.json");
  const files = Directory.GetFiles(".");
}
```

## Directory Structure and Namespaces

File paths map to C# namespaces:

```
src/
├── App.ts           → MyApp.App
├── Models/
│   ├── User.ts      → MyApp.Models.User
│   └── Product.ts   → MyApp.Models.Product
└── Services/
    └── Api.ts       → MyApp.Services.Api
```

When importing across directories:

```typescript
// src/Services/Api.ts
import { User } from "../Models/User.js";
// Resolves to namespace MyApp.Models

export function getUser(): User {
  return { id: 1, name: "Alice" };
}
```

## Multiple File Project

```typescript
// src/models/User.ts
export interface User {
  id: number;
  name: string;
}

// src/services/UserService.ts
import { User } from "../models/User.js";

export class UserService {
  private users: User[] = [];

  add(user: User): void {
    this.users.push(user);
  }

  find(id: number): User | null {
    for (const user of this.users) {
      if (user.id === id) {
        return user;
      }
    }
    return null;
  }
}

// src/App.ts
import { Console } from "@tsonic/dotnet/System.js";
import { User } from "./models/User.js";
import { UserService } from "./services/UserService.js";

export function main(): void {
  const service = new UserService();

  service.add({ id: 1, name: "Alice" });
  service.add({ id: 2, name: "Bob" });

  const user = service.find(1);
  if (user) {
    Console.WriteLine(user.name);
  }
}
```

Build with:

```bash
tsonic build src/App.ts --namespace MyApp
```
