# Code Generation (IR → C#)

## File Structure

Each TypeScript file produces exactly one C# file with the same relative path:

```
src/models/User.ts → out/models/User.cs
src/api/v1/endpoints.ts → out/api/v1/endpoints.cs
```

## C# File Template

```csharp
// Generated from: {relative_path}
// Generated at: {timestamp}

using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;
{using_statements}

namespace {namespace}
{
    {class_or_static_class}
}
```

## Using Statement Generation

### Order and Grouping

1. System namespaces (alphabetical)
2. Microsoft namespaces (alphabetical)
3. Third-party namespaces (alphabetical)
4. Tsonic.Runtime (always included)
5. Local project namespaces (alphabetical)

### Example

```csharp
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;
using My.App.models;
using My.App.services;
```

### Deduplication

- Combine imports from same namespace
- Remove redundant parent namespaces if not used directly

## Class Generation

### Regular Class

When file exports a class matching the filename:

```typescript
// User.ts
export class User {
    constructor(public name: string, public age: number) {}
    greet(): string {
        return `Hello, I'm ${this.name}`;
    }
}
```

```csharp
public class User
{
    public string name { get; set; }
    public double age { get; set; }

    public User(string name, double age)
    {
        this.name = name;
        this.age = age;
    }

    public string greet()
    {
        return $"Hello, I'm {this.name}";
    }
}
```

### Static Container Class

When file has top-level exports (functions, constants):

```typescript
// math.ts
export const PI = 3.14159;
export function add(a: number, b: number) {
    return a + b;
}
```

```csharp
public static class math
{
    public static readonly double PI = 3.14159;

    public static double add(double a, double b)
    {
        return a + b;
    }
}
```

## Expression Generation

### Literals

| TypeScript | C# |
|------------|-----|
| `42` | `42.0` |
| `"hello"` | `"hello"` |
| `true` | `true` |
| `null` | `null` |
| `undefined` | `default(T)` |

### String Templates

```typescript
`Hello ${name}, you are ${age} years old`
```

```csharp
$"Hello {name}, you are {age} years old"
```

### Arrays

```typescript
[1, 2, 3]
```

```csharp
new Tsonic.Runtime.Array<double>(1, 2, 3)
```

### Objects

Anonymous objects:
```typescript
{ name: "John", age: 30 }
```

```csharp
new { name = "John", age = 30.0 }
```

### Function Calls

```typescript
console.log("Hello");
Math.max(10, 20);
user.greet();
```

```csharp
console.log("Hello");
Math.max(10, 20);
user.greet();
```

### Binary Operators

| TypeScript | C# |
|------------|-----|
| `a + b` | `a + b` |
| `a - b` | `a - b` |
| `a * b` | `a * b` |
| `a / b` | `a / b` |
| `a % b` | `a % b` |
| `a === b` | `a == b` |
| `a !== b` | `a != b` |
| `a < b` | `a < b` |
| `a && b` | `a && b` |
| `a \|\| b` | `a \|\| b` |

### Type Checking

```typescript
typeof value === "string"
value instanceof User
```

```csharp
value is string
value is User
```

## Statement Generation

### Variable Declarations

```typescript
const x = 5;
let y = "hello";
var z = true;
```

```csharp
var x = 5.0;
var y = "hello";
var z = true;
```

With explicit types:
```typescript
const x: number = 5;
let arr: string[] = [];
```

```csharp
double x = 5;
var arr = new Tsonic.Runtime.Array<string>();
```

### If Statements

```typescript
if (condition) {
    doSomething();
} else if (otherCondition) {
    doOther();
} else {
    doDefault();
}
```

```csharp
if (condition)
{
    doSomething();
}
else if (otherCondition)
{
    doOther();
}
else
{
    doDefault();
}
```

### Loops

For loop:
```typescript
for (let i = 0; i < 10; i++) {
    console.log(i);
}
```

```csharp
for (var i = 0; i < 10; i++)
{
    console.log(i);
}
```

For...of:
```typescript
for (const item of items) {
    console.log(item);
}
```

```csharp
foreach (var item in items)
{
    console.log(item);
}
```

While:
```typescript
while (condition) {
    doWork();
}
```

```csharp
while (condition)
{
    doWork();
}
```

### Switch Statements

```typescript
switch (value) {
    case 1:
        doOne();
        break;
    case 2:
        doTwo();
        break;
    default:
        doDefault();
}
```

```csharp
switch (value)
{
    case 1:
        doOne();
        break;
    case 2:
        doTwo();
        break;
    default:
        doDefault();
        break;
}
```

### Try-Catch

```typescript
try {
    riskyOperation();
} catch (error) {
    console.error(error);
} finally {
    cleanup();
}
```

```csharp
try
{
    riskyOperation();
}
catch (Exception error)
{
    console.error(error);
}
finally
{
    cleanup();
}
```

### Return Statements

```typescript
return value;
return;
```

```csharp
return value;
return;
```

## Method Generation

### Regular Methods

```typescript
greet(name: string): string {
    return `Hello ${name}`;
}
```

```csharp
public string greet(string name)
{
    return $"Hello {name}";
}
```

### Async Methods

```typescript
async fetchData(): Promise<string> {
    const result = await getData();
    return result;
}
```

```csharp
public async Task<string> fetchData()
{
    var result = await getData();
    return result;
}
```

### Static Methods

```typescript
static create(): User {
    return new User("Default");
}
```

```csharp
public static User create()
{
    return new User("Default");
}
```

### Optional Parameters

```typescript
greet(name: string = "World"): string {
    return `Hello ${name}`;
}
```

```csharp
public string greet(string name = "World")
{
    return $"Hello {name}";
}
```

### Rest Parameters

```typescript
sum(...numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0);
}
```

```csharp
public double sum(params double[] numbers)
{
    // Manual implementation since reduce not supported
    double result = 0;
    foreach (var n in numbers) result += n;
    return result;
}
```

## Property Generation

### Public Properties

```typescript
class User {
    name: string;
    age: number;
}
```

```csharp
public class User
{
    public string name { get; set; }
    public double age { get; set; }
}
```

### Readonly Properties

```typescript
class User {
    readonly id: string;
}
```

```csharp
public class User
{
    public string id { get; }
}
```

### Private/Protected

```typescript
class User {
    private secret: string;
    protected internal: number;
}
```

```csharp
public class User
{
    private string secret { get; set; }
    protected double internal { get; set; }
}
```

## Access Modifiers

| TypeScript | C# |
|------------|-----|
| `public` (default) | `public` |
| `private` | `private` |
| `protected` | `protected` |
| `static` | `static` |
| `readonly` | `{ get; }` |

## Special Cases

### Constructor with Public Parameters

```typescript
constructor(public name: string, private id: number) {}
```

```csharp
public string name { get; set; }
private double id { get; set; }

public ClassName(string name, double id)
{
    this.name = name;
    this.id = id;
}
```

### Getters/Setters

```typescript
get fullName() { return `${this.first} ${this.last}`; }
set fullName(value) { /* parse */ }
```

**NOT SUPPORTED in MVP** - ERROR TSN2009

### Arrow Functions in Classes

```typescript
class Handler {
    handle = () => { console.log(this); }
}
```

**NOT SUPPORTED in MVP** - ERROR TSN2010

## Formatting Rules

1. **Indentation**: 4 spaces
2. **Braces**: Opening brace on new line (Allman style)
3. **Spaces**: Around operators, after commas
4. **Line Length**: Max 120 characters
5. **Blank Lines**: Between class members

## Comments

Preserve single-line and multi-line comments:

```typescript
// This is a comment
/* Multi-line
   comment */
```

```csharp
// This is a comment
/* Multi-line
   comment */
```

JSDoc comments:
```typescript
/**
 * Calculates sum
 * @param a First number
 * @param b Second number
 */
```

```csharp
/// <summary>
/// Calculates sum
/// </summary>
/// <param name="a">First number</param>
/// <param name="b">Second number</param>
```