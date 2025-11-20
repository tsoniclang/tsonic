# Types & Interfaces

Working with TypeScript interfaces and type aliases in Tsonic.

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

Simple type aliases work:

```typescript
type ID = number;
type Name = string;
type Point = { x: number; y: number };
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
