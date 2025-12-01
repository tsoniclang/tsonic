# Import Examples

Module imports and exports in Tsonic.

## Local Imports

Local imports **must** use the `.ts` extension:

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
import { User, UserService } from "./models/User.ts";

export function main(): void {
  const service = new UserService();
  const user = service.getUser(1);
  console.log(user.name);
}
```

## Relative Paths

```typescript
// Same directory
import { helper } from "./helper.ts";

// Parent directory
import { config } from "../config.ts";

// Nested path
import { utils } from "./lib/utils/index.ts";
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
import { PI, add, Point } from "./utils.ts";

const point: Point = { x: 10, y: 20 };
console.log(add(1, 2));
console.log(PI);
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
import * as utils from "./utils.ts";

console.log(utils.PI);
console.log(utils.add(1, 2));
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
export { User } from "./User.ts";
export { Product } from "./Product.ts";
```

```typescript
// App.ts
import { User, Product } from "./models/index.ts";
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
import type { Config } from "./types.ts";

function loadConfig(): Config {
  return { host: "localhost", port: 8080 };
}
```

## .NET Imports

.NET imports do **not** use the `.ts` extension:

```typescript
// System namespace
import { Console } from "@tsonic/dotnet/System";

// System.IO namespace
import { File, Directory } from "@tsonic/dotnet/System.IO";

// System.Collections.Generic
import { List, Dictionary } from "@tsonic/dotnet/System.Collections.Generic";
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
├── App.ts           → MyApp.src.App
├── models/
│   ├── User.ts      → MyApp.src.models.User
│   └── Product.ts   → MyApp.src.models.Product
└── services/
    └── api.ts       → MyApp.src.services.api
```

When importing across directories:

```typescript
// src/services/api.ts
import { User } from "../models/User.ts";
// Resolves to namespace MyApp.src.models

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
import { User } from "../models/User.ts";

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
import { User } from "./models/User.ts";
import { UserService } from "./services/UserService.ts";

export function main(): void {
  const service = new UserService();

  service.add({ id: 1, name: "Alice" });
  service.add({ id: 2, name: "Bob" });

  const user = service.find(1);
  if (user) {
    console.log(user.name);
  }
}
```

Build with:

```bash
tsonic build src/App.ts --namespace MyApp
```
