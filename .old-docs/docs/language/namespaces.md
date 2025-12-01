# Namespaces

Tsonic maps your directory structure directly to C# namespaces.

## The Mapping Rule

**Directory path = C# namespace (case-preserved)**

```
src/models/User.ts  →  namespace MyApp.models { class User {} }
src/api/v1/endpoints.ts  →  namespace MyApp.api.v1 { class endpoints {} }
```

## How It Works

### Root Namespace

Set via CLI or config:

```bash
tsonic build src/main.ts --namespace MyApp
```

Or in `tsonic.json`:

```json
{
  "namespace": "MyApp"
}
```

### Directory Levels

Each directory becomes a namespace segment:

```
MyApp/              (root namespace)
├── models/         → MyApp.models
│   ├── User.ts     → MyApp.models.User
│   └── Post.ts     → MyApp.models.Post
└── services/       → MyApp.services
    └── api.ts      → MyApp.services.api
```

### Case Preservation

Directory names keep their exact case:

```
src/Models/User.ts     → MyApp.Models.User  (capital M)
src/models/User.ts     → MyApp.models.User  (lowercase m)
```

**Important:** Be consistent with casing across your project.

## File Name = Class Name

The file name (without `.ts`) becomes the C# class name:

```
User.ts           → class User
UserService.ts    → class UserService
api-client.ts     → class api_client  (hyphens → underscores)
```

## Static Container Classes

Files with top-level exports become static classes:

```typescript
// math.ts - top-level exports
export const PI = 3.14159;
export function add(a: number, b: number) {
  return a + b;
}
```

Becomes:

```csharp
namespace MyApp
{
    public static class math  // Lowercase from filename
    {
        public static readonly double PI = 3.14159;
        public static double add(double a, double b)
        {
            return a + b;
        }
    }
}
```

## Examples

### Simple Structure

```
src/
├── main.ts        → MyApp.main
├── config.ts      → MyApp.config
└── utils.ts       → MyApp.utils
```

### Nested Structure

```
src/
├── app/
│   ├── models/
│   │   ├── User.ts      → MyApp.app.models.User
│   │   └── Post.ts      → MyApp.app.models.Post
│   └── services/
│       └── UserService.ts → MyApp.app.services.UserService
└── main.ts              → MyApp.main
```

### Mixed Case

```
src/
├── API/
│   └── Client.ts    → MyApp.API.Client
├── models/
│   └── User.ts      → MyApp.models.User
└── Utils/
    └── helper.ts    → MyApp.Utils.helper
```

## Importing Across Namespaces

TypeScript imports with `.ts` extensions work across directories:

```typescript
// src/services/UserService.ts
import { User } from "../models/User.ts"; // Cross-namespace import

export class UserService {
  getUser(): User {
    return new User("John");
  }
}
```

Becomes C#:

```csharp
using MyApp.models;  // Namespace resolved from import

namespace MyApp.services
{
    public class UserService
    {
        public User getUser()
        {
            return new User("John");
        }
    }
}
```

## See Also

- [Module System](module-system.md) - Import rules
- [Type Mappings](type-mappings.md) - TypeScript → C# types
