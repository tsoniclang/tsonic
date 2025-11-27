# Types & Interfaces

Working with TypeScript interfaces and type aliases in Tsonic.

## Interface Nominalization

**Key Concept:** TypeScript interfaces become C# **classes**, not C# interfaces.

TypeScript uses structural typing - any object with matching properties satisfies an interface. C# requires nominal types for object initialization syntax. Tsonic "nominalizes" interfaces to classes to enable:

- Object literal syntax: `return { id: 1, name: "John" };` → `new User { id = 1.0, name = "John" }`
- Generic type arguments: `Container<User>` works correctly
- Variable declarations: `const user: User = ...`

### Implements Restriction

Because interfaces become classes, you **cannot** use `implements` with TypeScript interfaces:

```typescript
// ❌ ERROR: TSN7301 - Class cannot implement nominalized interface
interface Printable {
  print(): void;
}

class Document implements Printable {
  // This will fail to compile
}
```

**Alternatives:**
- Use `extends` for inheritance
- Use composition (pass interface instances as parameters)
- Use duck typing (just define matching methods)

## Interfaces

Interfaces compile to C# classes:

```typescript
interface User {
  id: number;
  name: string;
  email?: string;
}
```

```csharp
public class User
{
    public double id { get; set; }
    public string name { get; set; }
    public string? email { get; set; }
}
```

## Type Aliases

Simple type aliases are substituted directly:

```typescript
type ID = number;    // Becomes: double
type Name = string;  // Becomes: string
```

Object type aliases become classes (same as interfaces):

```typescript
type Point = { x: number; y: number };
```

```csharp
public class Point
{
    public double x { get; set; }
    public double y { get; set; }
}
```

## Optional Properties

```typescript
interface Config {
  host: string;
  port?: number;
}
```

```csharp
public class Config
{
    public string host { get; set; }
    public double? port { get; set; }
}
```

## Readonly Properties

```typescript
interface User {
  readonly id: number;
  name: string;
}
```

```csharp
public class User
{
    public double id { get; }
    public string name { get; set; }
}
```

## Inheritance

```typescript
interface Animal {
  name: string;
}

interface Dog extends Animal {
  breed: string;
}
```

```csharp
public class Animal
{
    public string name { get; set; }
}

public class Dog : Animal
{
    public string breed { get; set; }
}
```

## Not Supported (MVP)

- Union types
- Intersection types
- Conditional types
- Mapped types
- Template literal types

See [Type Mappings](type-mappings.md) for details.
