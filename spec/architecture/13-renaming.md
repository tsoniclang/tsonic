# Phase 12: Renaming and Name Transformations

## Purpose

This phase defines the name transformation rules for converting TypeScript identifiers to C# identifiers, handling naming convention differences, reserved keywords, and generating qualified names for the .NET type system.

---

## 1. Overview

**Responsibility:** TypeScript → C# identifier transformation, reserved keyword handling, qualified name generation

**Package:** All packages (cross-cutting concern)

**Location:** `packages/*/src/naming/`

**Input:** TypeScript identifiers (variables, functions, types, modules)

**Output:** C# identifiers following .NET naming conventions

---

## 2. Core Transformations

### 2.1 Case Transformations

```typescript
// camelCase → PascalCase
const toPascalCase = (identifier: string): string => {
  if (identifier.length === 0) return identifier;
  return identifier[0].toUpperCase() + identifier.slice(1);
};

// PascalCase → camelCase
const toCamelCase = (identifier: string): string => {
  if (identifier.length === 0) return identifier;
  return identifier[0].toLowerCase() + identifier.slice(1);
};

// kebab-case → PascalCase
const kebabToPascalCase = (identifier: string): string => {
  return identifier
    .split("-")
    .map((part) => toPascalCase(part))
    .join("");
};

// snake_case → PascalCase
const snakeToPascalCase = (identifier: string): string => {
  return identifier
    .split("_")
    .map((part) => toPascalCase(part))
    .join("");
};
```

**Examples:**
```typescript
toPascalCase("userName")         // "UserName"
toPascalCase("getId")            // "GetId"
toCamelCase("UserName")          // "userName"
kebabToPascalCase("user-name")   // "UserName"
snakeToPascalCase("user_name")   // "UserName"
```

---

## 3. Identifier Transformations

### 3.1 Variable Names

**TypeScript:** camelCase
**C#:** camelCase (local variables), PascalCase (fields/properties)

```typescript
const transformVariableName = (
  tsName: string,
  context: "local" | "field"
): string => {
  if (context === "local") {
    return escapeReservedKeyword(tsName); // Keep camelCase
  } else {
    return escapeReservedKeyword(toPascalCase(tsName)); // PascalCase for fields
  }
};
```

**Examples:**
```typescript
// Local variables - keep camelCase
"userName" → "userName"
"myValue" → "myValue"

// Fields/properties - convert to PascalCase
"userName" → "UserName"
"myValue" → "MyValue"
```

### 3.2 Function Names

**TypeScript:** camelCase
**C#:** PascalCase

```typescript
const transformFunctionName = (tsName: string): string => {
  return escapeReservedKeyword(toPascalCase(tsName));
};
```

**Examples:**
```typescript
"greet" → "Greet"
"getUserById" → "GetUserById"
"isActive" → "IsActive"
```

### 3.3 Type Names

**TypeScript:** PascalCase
**C#:** PascalCase (no change)

```typescript
const transformTypeName = (tsName: string): string => {
  return escapeReservedKeyword(tsName);
};
```

**Examples:**
```typescript
"User" → "User"
"PostMetadata" → "PostMetadata"
"IRepository" → "IRepository"
```

### 3.4 Parameter Names

**TypeScript:** camelCase
**C#:** camelCase (convention for parameters)

```typescript
const transformParameterName = (tsName: string): string => {
  return escapeReservedKeyword(tsName);
};
```

**Examples:**
```typescript
"userId" → "userId"
"callback" → "callback"
"value" → "value"
```

---

## 4. Reserved Keyword Handling

### 4.1 C# Reserved Keywords

```typescript
const CSHARP_RESERVED_KEYWORDS = new Set([
  // C# keywords
  "abstract", "as", "base", "bool", "break", "byte", "case", "catch",
  "char", "checked", "class", "const", "continue", "decimal", "default",
  "delegate", "do", "double", "else", "enum", "event", "explicit", "extern",
  "false", "finally", "fixed", "float", "for", "foreach", "goto", "if",
  "implicit", "in", "int", "interface", "internal", "is", "lock", "long",
  "namespace", "new", "null", "object", "operator", "out", "override",
  "params", "private", "protected", "public", "readonly", "ref", "return",
  "sbyte", "sealed", "short", "sizeof", "stackalloc", "static", "string",
  "struct", "switch", "this", "throw", "true", "try", "typeof", "uint",
  "ulong", "unchecked", "unsafe", "ushort", "using", "virtual", "void",
  "volatile", "while",

  // Contextual keywords
  "add", "alias", "ascending", "async", "await", "by", "descending",
  "dynamic", "equals", "from", "get", "global", "group", "into", "join",
  "let", "nameof", "on", "orderby", "partial", "remove", "select", "set",
  "value", "var", "when", "where", "yield",
]);

const escapeReservedKeyword = (identifier: string): string => {
  if (CSHARP_RESERVED_KEYWORDS.has(identifier)) {
    return `@${identifier}`; // Use @ prefix for reserved keywords
  }
  return identifier;
};
```

**Examples:**
```typescript
"class" → "@class"
"object" → "@object"
"event" → "@event"
"value" → "@value"
"async" → "@async"
```

### 4.2 Conflict Resolution

If @ prefix conflicts with existing names, use suffix:

```typescript
const escapeReservedKeywordWithConflictResolution = (
  identifier: string,
  existingNames: Set<string>
): string => {
  if (!CSHARP_RESERVED_KEYWORDS.has(identifier)) {
    return identifier;
  }

  // Try @ prefix first
  const escaped = `@${identifier}`;
  if (!existingNames.has(escaped)) {
    return escaped;
  }

  // If @ conflicts, use suffix
  let suffix = 1;
  while (existingNames.has(`${identifier}${suffix}`)) {
    suffix++;
  }
  return `${identifier}${suffix}`;
};
```

**Examples:**
```typescript
// If "@class" already exists:
"class" → "class1"

// If "@value" and "value1" already exist:
"value" → "value2"
```

---

## 5. File Name Transformations

### 5.1 File Name → Class Name

**Rule:** File stem (without .ts extension) becomes class name in PascalCase

```typescript
const fileNameToClassName = (filePath: string): string => {
  // Extract file stem (without extension)
  const fileName = path.basename(filePath, ".ts");

  // Convert to PascalCase
  const className = toPascalCase(fileName);

  return className;
};
```

**Examples:**
```typescript
"/src/models/user.ts"        → "User"
"/src/models/post-meta.ts"   → "PostMeta"
"/src/utils/string-util.ts"  → "StringUtil"
"/src/main.ts"               → "Main"
```

### 5.2 Special Cases

**kebab-case files:**
```typescript
"user-repository.ts" → "UserRepository"
"api-client.ts"      → "ApiClient"
```

**snake_case files:**
```typescript
"user_repository.ts" → "UserRepository"
"api_client.ts"      → "ApiClient"
```

**Numbers in file names:**
```typescript
"math2d.ts"     → "Math2d"
"vector3.ts"    → "Vector3"
```

---

## 6. Namespace Generation

### 6.1 Directory Path → Namespace

**Rule:** Directory structure maps to namespace hierarchy

```typescript
const directoryToNamespace = (
  filePath: string,
  sourceRoot: string,
  rootNamespace: string
): string => {
  // Get relative path from source root
  const relativePath = path.relative(sourceRoot, path.dirname(filePath));

  // Split into segments
  const segments = relativePath
    .split(path.sep)
    .filter((s) => s.length > 0 && s !== ".");

  // Convert each segment to PascalCase
  const namespaceSegments = segments.map((seg) => toPascalCase(seg));

  // Combine with root namespace
  return [rootNamespace, ...namespaceSegments].join(".");
};
```

**Examples:**
```typescript
// sourceRoot: "/src", rootNamespace: "MyApp"

"/src/models/user.ts"         → "MyApp.models"
"/src/services/api/client.ts" → "MyApp.services.api"
"/src/utils/string-util.ts"   → "MyApp.utils"
"/src/main.ts"                → "MyApp"
```

### 6.2 Namespace Validation

```typescript
const validateNamespace = (namespace: string): boolean => {
  // Namespace must:
  // 1. Start with letter
  // 2. Contain only alphanumeric characters and dots
  // 3. Not have consecutive dots
  // 4. Not start/end with dot

  const pattern = /^[A-Z][a-zA-Z0-9]*(\.[A-Z][a-zA-Z0-9]*)*$/;
  return pattern.test(namespace);
};
```

---

## 7. Qualified Name Construction

### 7.1 Full Qualified Names

```typescript
const getQualifiedName = (
  namespace: string,
  className: string,
  memberName: string
): string => {
  return `${namespace}.${className}.${memberName}`;
};
```

**Examples:**
```typescript
getQualifiedName("MyApp.models", "User", "create")
// → "MyApp.models.User.create"

getQualifiedName("MyApp.services", "ApiClient", "fetch")
// → "MyApp.services.ApiClient.fetch"
```

### 7.2 Short Names (Within Same Module)

```typescript
const getShortName = (
  currentNamespace: string,
  currentClassName: string,
  targetNamespace: string,
  targetClassName: string,
  memberName: string
): string => {
  // Same module - use member name only
  if (
    currentNamespace === targetNamespace &&
    currentClassName === targetClassName
  ) {
    return memberName;
  }

  // Same namespace - use ClassName.member
  if (currentNamespace === targetNamespace) {
    return `${targetClassName}.${memberName}`;
  }

  // Different namespace - use full qualified name
  return `${targetNamespace}.${targetClassName}.${memberName}`;
};
```

---

## 8. Specialization Name Generation

### 8.1 Generic Function Specialization

**Rule:** Append type arguments to function name

```typescript
const generateSpecializationName = (
  baseName: string,
  typeArguments: readonly IrType[]
): string => {
  const typeSuffix = typeArguments
    .map((t) => irTypeToString(t))
    .map((t) => t.replace(/\./g, "_")) // Replace dots with underscores
    .map((t) => t.replace(/\[\]/g, "Array")) // Replace [] with Array
    .join("_");

  return `${baseName}__${typeSuffix}`;
};

const irTypeToString = (type: IrType): string => {
  if (type.kind === "primitive") {
    return primitiveTypeToCSharpName(type.primitive);
  }
  if (type.kind === "type-reference") {
    return type.name;
  }
  if (type.kind === "array") {
    return `${irTypeToString(type.elementType)}Array`;
  }
  return "unknown";
};

const primitiveTypeToCSharpName = (primitive: string): string => {
  const mapping: Record<string, string> = {
    number: "double",
    string: "string",
    boolean: "bool",
    void: "void",
  };
  return mapping[primitive] ?? primitive;
};
```

**Examples:**
```typescript
// map<number, string>
generateSpecializationName("map", [
  { kind: "primitive", primitive: "number" },
  { kind: "primitive", primitive: "string" },
])
// → "map__double_string"

// filter<User>
generateSpecializationName("filter", [
  { kind: "type-reference", name: "User" },
])
// → "filter__User"

// map<number[], string[]>
generateSpecializationName("map", [
  { kind: "array", elementType: { kind: "primitive", primitive: "number" } },
  { kind: "array", elementType: { kind: "primitive", primitive: "string" } },
])
// → "map__doubleArray_stringArray"
```

---

## 9. Collision Avoidance

### 9.1 Name Uniqueness

Track all generated names to avoid collisions:

```typescript
type NameRegistry = {
  readonly usedNames: Set<string>;
  register: (name: string) => string; // Returns unique name
};

const createNameRegistry = (): NameRegistry => {
  const usedNames = new Set<string>();

  return {
    usedNames,
    register: (name: string): string => {
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }

      // Name collision - add numeric suffix
      let suffix = 1;
      while (usedNames.has(`${name}${suffix}`)) {
        suffix++;
      }

      const uniqueName = `${name}${suffix}`;
      usedNames.add(uniqueName);
      return uniqueName;
    },
  };
};
```

**Examples:**
```typescript
const registry = createNameRegistry();

registry.register("User");        // "User"
registry.register("User");        // "User1"
registry.register("User");        // "User2"
registry.register("getValue");    // "getValue"
registry.register("getValue");    // "getValue1"
```

### 9.2 Scoped Registries

Use scoped registries for different contexts:

```typescript
type ScopedNameRegistry = {
  readonly global: NameRegistry;
  readonly perModule: Map<string, NameRegistry>;
  getModuleRegistry: (modulePath: string) => NameRegistry;
};

const createScopedNameRegistry = (): ScopedNameRegistry => {
  const global = createNameRegistry();
  const perModule = new Map<string, NameRegistry>();

  return {
    global,
    perModule,
    getModuleRegistry: (modulePath: string): NameRegistry => {
      if (!perModule.has(modulePath)) {
        perModule.set(modulePath, createNameRegistry());
      }
      return perModule.get(modulePath)!;
    },
  };
};
```

---

## 10. Complete Example

### 10.1 TypeScript Input

**File:** `/src/models/user-repository.ts`

```typescript
export class UserRepository {
  private userName: string;

  constructor(userName: string) {
    this.userName = userName;
  }

  public getUserById(id: number): User | null {
    // ...
  }

  public async fetchAll(): Promise<User[]> {
    // ...
  }
}
```

### 10.2 C# Output with Transformations

**File:** `MyApp.models.UserRepository.cs`

```csharp
namespace MyApp.models
{
  public static class UserRepository
  {
    // userName → UserName (field, PascalCase)
    private static string UserName = "";

    // constructor → Constructor (PascalCase)
    public static void Constructor(string userName)
    {
      UserName = userName;
    }

    // getUserById → GetUserById (function, PascalCase)
    // User → User (type, no change)
    public static User? GetUserById(double id)
    {
      // ...
    }

    // fetchAll → FetchAll (function, PascalCase)
    public static Task<List<User>> FetchAll()
    {
      // ...
    }
  }
}
```

### 10.3 Transformation Summary

| TypeScript          | C#                   | Rule                          |
| ------------------- | -------------------- | ----------------------------- |
| `user-repository.ts` | `UserRepository`    | File name → PascalCase        |
| `UserRepository`    | `UserRepository`     | Class name (no change)        |
| `userName` (field)  | `UserName`           | Field → PascalCase            |
| `getUserById`       | `GetUserById`        | Function → PascalCase         |
| `fetchAll`          | `FetchAll`           | Function → PascalCase         |
| `id` (param)        | `id`                 | Parameter → camelCase         |
| `User` (type)       | `User`               | Type name (no change)         |

---

## 11. Performance Characteristics

### 11.1 Transformation Complexity

**Case Conversion:**
- Time: O(n) where n = identifier length
- Space: O(n)

**Reserved Keyword Check:**
- Time: O(1) (hash set lookup)
- Space: O(1)

**Qualified Name Construction:**
- Time: O(s) where s = total namespace/class/member length
- Space: O(s)

### 11.2 Registry Performance

**Name Registration:**
- Best case: O(1) (no collision)
- Worst case: O(k) where k = number of collisions
- Space: O(n) where n = unique names

---

## 12. See Also

- [00-overview.md](00-overview.md) - System architecture
- [03-phase-resolver.md](03-phase-resolver.md) - Namespace generation from directory structure
- [07-phase-emitter.md](07-phase-emitter.md) - C# emission using transformed names
- [12-call-graphs.md](12-call-graphs.md) - Specialization name generation

---

**Document Statistics:**
- Lines: ~600
- Sections: 12
- Transformation rules: 10+
- Code examples: 20+
- Coverage: Complete name transformation system for TypeScript → C# conversion
