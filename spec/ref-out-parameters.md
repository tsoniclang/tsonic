# Ref/Out Parameters

## Overview

C# supports pass-by-reference parameters (`ref`, `out`, `in`) which don't have direct equivalents in JavaScript/TypeScript. tsbindgen and Tsonic handle these using wrapper types.

**C# Reference Parameters:**
```csharp
// ref: Pass by reference (can read and write)
void Increment(ref int value) {
    value++;  // Modifies original variable
}

// out: Output parameter (must be assigned)
bool TryParse(string input, out int result) {
    result = 42;
    return true;
}

// in: Read-only reference (C# 7.2+)
void Process(in LargeStruct data) {
    // Can read but not modify data
}
```

**TypeScript/Tsonic Equivalent:**
```typescript
// Wrapper object with value property
type TSByRef<T> = { value: T };

// ref parameter
function Increment(value: TSByRef<number>): void;

// out parameter
function TryParse(input: string, result: TSByRef<number>): boolean;

// in parameter (treated like ref for simplicity)
function Process(data: TSByRef<LargeStruct>): void;

// Usage
const x = { value: 10 };
Increment(x);
console.log(x.value);  // 11

const result = { value: 0 };
if (TryParse("42", result)) {
    console.log(result.value);  // 42
}
```

---

## TSByRef Type

### Declaration (_support/types.d.ts)

```typescript
/**
 * Wrapper for C# ref/out/in parameters.
 * Allows pass-by-reference semantics in JavaScript.
 */
export type TSByRef<T> = {
    value: T;
};
```

**File Location:**
```
node_modules/@types/dotnet/
  _support/
    types.d.ts          # TSByRef, TSUnsafePointer, etc.
```

### Why TSByRef?

JavaScript/TypeScript doesn't support pass-by-reference for primitives:

```typescript
// JavaScript - primitives passed by value
function increment(x: number) {
    x++;  // Only modifies local copy
}

let num = 10;
increment(num);
console.log(num);  // Still 10 (unchanged)
```

Wrapper object allows mutation:

```typescript
// With TSByRef wrapper
function increment(x: TSByRef<number>) {
    x.value++;  // Modifies object property
}

const num = { value: 10 };
increment(num);
console.log(num.value);  // 11 (changed)
```

---

## Parameter Metadata

### In metadata.json

```typescript
type ParameterMetadata = {
  readonly name: string;
  readonly type: string;           // Base type (without ref/out)
  readonly isRef: boolean;         // ref parameter
  readonly isOut: boolean;         // out parameter
  readonly isIn?: boolean;         // in parameter (C# 7.2+)
  readonly isParams: boolean;      // params array
  readonly defaultValue?: any;
};
```

**Example:**
```json
{
  "name": "value",
  "type": "System.Int32",
  "isRef": true,
  "isOut": false,
  "isParams": false
}
```

### In TypeScript Declarations

tsbindgen wraps ref/out/in parameters in `TSByRef<T>`:

**C# method:**
```csharp
public static bool TryParse(string input, out int result);
```

**Generated .d.ts:**
```typescript
static TryParse(input: string, result: TSByRef<number>): boolean;
```

**Generic ref parameter:**
```csharp
public static void Swap<T>(ref T a, ref T b);
```

**Generated .d.ts:**
```typescript
static Swap<T>(a: TSByRef<T>, b: TSByRef<T>): void;
```

---

## Usage Patterns

### Pattern 1: Out Parameter (TryParse)

**C# usage:**
```csharp
int result;
if (int.TryParse("42", out result)) {
    Console.WriteLine(result);  // 42
}
```

**TypeScript/Tsonic usage:**
```typescript
import { Int32 } from "System";

const result = { value: 0 };
if (Int32.TryParse("42", result)) {
    console.log(result.value);  // 42
}
```

**Generated C#:**
```csharp
using System;

int result;
if (int.TryParse("42", out result)) {
    Console.WriteLine(result);
}
```

### Pattern 2: Ref Parameter (Swap)

**C# usage:**
```csharp
int a = 1, b = 2;
Swap(ref a, ref b);
Console.WriteLine($"{a}, {b}");  // "2, 1"
```

**TypeScript/Tsonic usage:**
```typescript
const a = { value: 1 };
const b = { value: 2 };
Swap(a, b);
console.log(`${a.value}, ${b.value}`);  // "2, 1"
```

**Generated C#:**
```csharp
int a = 1, b = 2;
Swap(ref a, ref b);
Console.WriteLine($"{a}, {b}");
```

### Pattern 3: In Parameter (Large Struct)

**C# usage:**
```csharp
LargeStruct data = GetData();
Process(in data);  // Pass by reference (efficient)
```

**TypeScript/Tsonic usage:**
```typescript
const data = { value: GetData() };
Process(data);  // Wrapped in TSByRef
```

**Generated C#:**
```csharp
var data = GetData();
Process(in data);
```

---

## Code Generation

### TypeScript → C# Transformation

When Tsonic sees `TSByRef<T>` parameter:

**Input (TypeScript AST):**
```typescript
// Call with TSByRef wrapper
const result = { value: 0 };
TryParse("42", result);
```

**Analysis:**
1. Detect parameter type: `TSByRef<number>`
2. Check metadata: `isOut: true` or `isRef: true`
3. Extract variable: `result`
4. Emit C# with appropriate keyword

**Output (C# code):**
```csharp
// ref or out keyword based on metadata
int result = 0;
TryParse("42", out result);
```

### Compiler Steps

1. **Parameter Analysis**
```typescript
// Tsonic compiler
const paramType = checker.getTypeAtLocation(paramNode);
if (isTSByRef(paramType)) {
    const wrapped = getWrappedType(paramType);  // Extract T from TSByRef<T>
    const meta = getParameterMetadata(method, paramIndex);

    if (meta.isOut) {
        emitOutParameter(param, wrapped);
    } else if (meta.isRef) {
        emitRefParameter(param, wrapped);
    } else if (meta.isIn) {
        emitInParameter(param, wrapped);
    }
}
```

2. **Variable Declaration**
```typescript
// For out parameters, declare variable
if (isOut && !isDeclared(varName)) {
    emit(typeNameInCSharp);
    emit(" ");
    emit(varName);
    if (hasInitializer) {
        emit(" = ");
        emitExpression(initializer.value);
    }
    emit(";\n");
}
```

3. **Method Call**
```typescript
// Emit call with ref/out keyword
emitMethodCall(method, [
    // For each argument
    ...args.map((arg, i) => {
        const param = method.parameters[i];
        if (param.isOut) return `out ${extractVarName(arg)}`;
        if (param.isRef) return `ref ${extractVarName(arg)}`;
        if (param.isIn) return `in ${extractVarName(arg)}`;
        return emitExpression(arg);
    })
]);
```

---

## Common .NET Methods with Ref/Out

### Dictionary<K, V>.TryGetValue

**C#:**
```csharp
Dictionary<string, int> dict = new();
dict["key"] = 42;

int value;
if (dict.TryGetValue("key", out value)) {
    Console.WriteLine(value);  // 42
}
```

**TypeScript:**
```typescript
import { Dictionary } from "System.Collections.Generic";

const dict = new Dictionary<string, number>();
dict.Add("key", 42);

const value = { value: 0 };
if (dict.TryGetValue("key", value)) {
    console.log(value.value);  // 42
}
```

### Int32.TryParse

**C#:**
```csharp
int result;
if (int.TryParse("123", out result)) {
    Console.WriteLine(result);
}
```

**TypeScript:**
```typescript
import { Int32 } from "System";

const result = { value: 0 };
if (Int32.TryParse("123", result)) {
    console.log(result.value);
}
```

### Interlocked.CompareExchange

**C#:**
```csharp
int location = 10;
int comparand = 10;
int newValue = 20;
int original = Interlocked.CompareExchange(ref location, newValue, comparand);
// location is now 20, original is 10
```

**TypeScript:**
```typescript
import { Interlocked } from "System.Threading";

const location = { value: 10 };
const comparand = 10;
const newValue = 20;
const original = Interlocked.CompareExchange(location, newValue, comparand);
// location.value is now 20, original is 10
```

---

## Differences from C#

| Aspect | C# | TypeScript/Tsonic |
|--------|----|--------------------|
| **Syntax** | `ref`/`out`/`in` keyword at call site | Wrapper object `{ value: T }` |
| **Variable Declaration** | `out` declares variable inline | Must declare before call |
| **Type Safety** | Compiler enforces ref/out | TypeScript type system |
| **Performance** | True pass-by-reference | Object property mutation |
| **Primitive Types** | ref works on primitives | Wrapper object required |

---

## Limitations

### 1. Verbosity

**C#:**
```csharp
if (dict.TryGetValue("key", out var value)) {
    // Use value
}
```

**TypeScript:**
```typescript
const value = { value: null };
if (dict.TryGetValue("key", value)) {
    // Use value.value
}
```

TypeScript requires explicit wrapper creation and `.value` access.

### 2. Inline Declaration

C# 7.0+ allows inline `out var`:

```csharp
if (int.TryParse("42", out var result)) {
    // result is declared here
}
```

TypeScript requires pre-declaration:

```typescript
const result = { value: 0 };
if (Int32.TryParse("42", result)) {
    // result was declared above
}
```

### 3. Multiple Out Parameters

**C#:**
```csharp
void GetValues(out int x, out int y, out int z) {
    x = 1; y = 2; z = 3;
}

GetValues(out var x, out var y, out var z);
```

**TypeScript:**
```typescript
const x = { value: 0 };
const y = { value: 0 };
const z = { value: 0 };
GetValues(x, y, z);
```

---

## Best Practices

1. **Always initialize wrapper**: `const result = { value: 0 };`
2. **Type the wrapper explicitly**: `const result: TSByRef<number> = { value: 0 };`
3. **Access via .value**: Don't forget to use `result.value` after call
4. **Don't reuse wrappers** unless semantically correct
5. **Document ref/out usage** in comments

**Good:**
```typescript
// Out parameter pattern
const result: TSByRef<number> = { value: 0 };
if (Int32.TryParse(input, result)) {
    return result.value;
}
return null;
```

**Bad:**
```typescript
// Missing type annotation
const result = { value: 0 };  // ❌ Type unclear

// Forgetting .value access
if (Int32.TryParse(input, result)) {
    return result;  // ❌ Returns wrapper, not value
}
```

---

## Future: Destructuring Syntax (Post-MVP)

**Possible future enhancement:**

```typescript
// Hypothetical syntax
const [success, value] = Int32.TryParse("42");
if (success) {
    console.log(value);  // No .value needed
}
```

**Requirements:**
- Compiler must transform to wrapper-based code
- Need to handle multiple out parameters
- Maintain compatibility with existing code

**Priority:** Low (wrapper pattern works)

---

## Diagnostics

### TSN6001: Missing TSByRef Wrapper

```
Parameter 'result' requires TSByRef wrapper.
Use: const result: TSByRef<number> = { value: 0 };
```

### TSN6002: Incorrect Wrapper Type

```
TSByRef<T> wrapper type mismatch.
Expected: TSByRef<number>
Found: TSByRef<string>
```

### TSN6003: Accessing Wrapper Instead of Value

```
Accessing TSByRef wrapper directly. Did you mean '.value'?
```

---

## See Also

- [metadata.md](metadata.md) - ParameterMetadata schema (isRef, isOut, isIn)
- [support-types.md](support-types.md) - _support/types.d.ts declarations
- [type-mappings.md](type-mappings.md) - C# type to TypeScript mappings
- [tsbindgen spec/metadata.md](../../tsbindgen/spec/metadata.md) - Parameter metadata format
