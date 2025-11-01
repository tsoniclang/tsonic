# Namespace Mapping

## Core Rule

**Directory path from source root = C# namespace (case-preserved)**

## Namespace Computation

```
namespace = rootNamespace + "." + relative_directory_path
```

Where:

- `rootNamespace`: From package.json `tsonic.rootNamespace` (default: `Tsonic.Compiled`)
- `relative_directory_path`: Directory path from source root, with `/` → `.`

### Examples

Given `rootNamespace: "My.App"` and source root `src/`:

| File Path                    | Namespace             | Class Name  |
| ---------------------------- | --------------------- | ----------- |
| `src/main.ts`                | `My.App`              | `main`      |
| `src/models/User.ts`         | `My.App.models`       | `User`      |
| `src/api/v1/endpoints.ts`    | `My.App.api.v1`       | `endpoints` |
| `src/utils/string/helper.ts` | `My.App.utils.string` | `helper`    |

## Case Preservation

**Directory names are preserved exactly as they appear on disk:**

```
src/
├── models/        → My.App.models
├── Models/        → ERROR TSN1010: Case collision
├── API/          → My.App.API
└── api/          → ERROR TSN1010: Case collision
```

## Class Name Inference

**File stem (without .ts) = C# class name:**

| File Name         | Class Name    | Type                      |
| ----------------- | ------------- | ------------------------- |
| `User.ts`         | `User`        | Regular class if exported |
| `user.ts`         | `user`        | Static container class    |
| `userService.ts`  | `userService` | Name exactly as-is        |
| `user-service.ts` | ERROR TSN1011 | Invalid character `-`     |

## Name Sanitization Rules

### For Namespaces

**Invalid characters → ERROR:**

```typescript
// These cause errors:
src/user-service/     // ERROR TSN1011: Invalid character '-'
src/user service/     // ERROR TSN1011: Invalid character ' '
src/user.service/     // ERROR TSN1011: Invalid character '.'
```

**C# keywords → ERROR:**

```typescript
src/namespace/        // ERROR TSN1012: C# keyword
src/class/           // ERROR TSN1012: C# keyword
```

### For File/Class Names

**Same rules apply:**

```typescript
user-service.ts      // ERROR TSN1011: Invalid character
namespace.ts         // ERROR TSN1012: C# keyword
class.ts            // ERROR TSN1012: C# keyword
```

## Static Container Classes

When a file doesn't export a class with the same name as the file, a static container class is generated:

### Example 1: File with only functions

```typescript
// src/utils/math.ts
export function add(a: number, b: number) {
  return a + b;
}
export function multiply(a: number, b: number) {
  return a * b;
}
export const PI = 3.14159;
```

Generates:

```csharp
namespace My.App.utils
{
    public static class math
    {
        public static double add(double a, double b) => a + b;
        public static double multiply(double a, double b) => a * b;
        public static readonly double PI = 3.14159;
    }
}
```

### Example 2: File with matching class

```typescript
// src/models/User.ts
export class User {
  constructor(public name: string) {}
}
```

Generates:

```csharp
namespace My.App.models
{
    public class User
    {
        public string name { get; set; }
        public User(string name) { this.name = name; }
    }
}
```

### Example 3: Mixed exports

```typescript
// src/services/UserService.ts
export class UserService {
  getUser() {
    return new User("test");
  }
}
export function createService() {
  return new UserService();
}
```

**ERROR TSN1013:** File exports class 'UserService' and other members. Either:

1. Export only the class, OR
2. Rename the class to not match the filename

## Namespace Collisions

### Local vs .NET Collisions

```typescript
// src/System/Text/Helper.ts creates namespace My.App.System.Text
// This could conflict with System.Text from .NET

// When both are imported:
import { Helper } from "./System/Text/Helper.ts";
import { JsonSerializer } from "System.Text.Json";
```

**ERROR TSN1014:** Local namespace `My.App.System.Text` conflicts with .NET namespace `System.Text`

### Case Collisions

```
src/
├── models/User.ts
└── Models/user.ts
```

**ERROR TSN1010:** Case collision - 'models' and 'Models' in the same parent directory

## Special Cases

### Root Files

Files in the source root get only the root namespace:

```typescript
// src/app.ts → namespace My.App, class app
// src/index.ts → namespace My.App, class index
```

### Nested Source Roots

If source root is `src/app/`:

```typescript
// src/app/models/User.ts → namespace My.App.models (not My.App.app.models)
```

### Unicode in Names

**Currently unsupported:**

```typescript
src/用户/    // ERROR TSN1015: Non-ASCII characters in path
```

## Configuration

### package.json

```json
{
  "name": "my-project",
  "type": "module",
  "tsonic": {
    "rootNamespace": "My.Company.Product"
  }
}
```

### CLI Override

```bash
tsonic build src/main.ts --namespace My.Custom.Namespace
```

## Examples

### Full Example

Directory structure:

```
project/
├── package.json (rootNamespace: "TodoApp")
├── src/
│   ├── main.ts
│   ├── models/
│   │   ├── Todo.ts
│   │   └── User.ts
│   ├── services/
│   │   ├── TodoService.ts
│   │   └── data/
│   │       └── Database.ts
│   └── utils/
│       └── validation.ts
```

Generates:

| File                      | Namespace             | Class       |
| ------------------------- | --------------------- | ----------- |
| main.ts                   | TodoApp               | main        |
| models/Todo.ts            | TodoApp.models        | Todo        |
| models/User.ts            | TodoApp.models        | User        |
| services/TodoService.ts   | TodoApp.services      | TodoService |
| services/data/Database.ts | TodoApp.services.data | Database    |
| utils/validation.ts       | TodoApp.utils         | validation  |
