# Type System

Tsonic is strict-AOT and deterministic. The type system is built to answer one question:

> can this TypeScript program be lowered to one stable CLR/runtime shape?

If yes, it compiles. If not, it fails early.

## Main Principles

### 1. No `any`

Explicit `any` remains out of scope.

```ts
const value: any = 1; // rejected
```

### 2. Declared `unknown` Is Allowed

Explicit `unknown` from library contracts is valid.

```ts
const root = JSON.parse(text); // unknown by declaration

if (typeof root === "object" && root !== null) {
  console.log(Object.entries(root).length.toString());
}
```

Tsonic distinguishes:

- deliberate declared `unknown`
- failed/poisoned inference

### 3. Expected-Type Threading

Tsonic aggressively threads expected types through:

- array literals and spreads
- ternaries
- nullish coalescing
- control-flow returns
- object literal members

That keeps C# lowering deterministic and avoids fallback to weak shapes.

### 4. Deterministic Generic Function Values

Supported when a concrete callable shape exists:

```ts
const id = <T>(x: T): T => x;

const f: (x: number) => number = id;
const arr: Array<(x: number) => number> = [id];
const obj: { run: (x: number) => number } = { run: id };
```

Still rejected when the value remains polymorphic with no runtime shape:

```ts
const id = <T>(x: T): T => x;
const copy = id; // rejected
```

### 5. Union Member Access Must Be Coherent

This is allowed:

```ts
type A = { x: number };
type B = { x: number };
declare const value: A | B;
const y = value.x;
```

This is rejected:

```ts
type A = { x: number };
type B = { x: string };
declare const value: A | B;
const y = value.x;
```

### 6. Numeric Proof Is Separate From TS Typing

TypeScript cannot distinguish `int` from `double`. Tsonic proves numeric intent later.

See `numeric-types.md`.

## Source Packages

Installed packages with:

```text
node_modules/<pkg>/tsonic.package.json
```

and:

```json
{
  "kind": "tsonic-source-package"
}
```

are compiled as part of the same TS program and dependency graph, subject to surface compatibility.

Surface compatibility is based on resolved surface chains, not only exact string equality.

Example:

- active surface: `@acme/surface-node`
- resolved modes: `["@tsonic/js", "@acme/surface-node"]`
- package manifest declaring `["@tsonic/js"]` is accepted

## Object Literal Typing

Current supported deterministic cases:

- finite spreads
- method shorthand
- computed constant keys
- accessors
- behavioral selection across coherent union targets

Tsonic can synthesize nominal helper types where needed, but only when the result shape is finite and stable.

## Dynamic Import Typing

Supported:

- local closed-world dynamic imports
- side-effect imports
- namespace values when runtime export shape is representable

Rejected:

- non-literal specifiers
- package/open-world dynamic imports
- namespace shapes the runtime cannot represent deterministically

## `import.meta`

Supported:

- `import.meta`
- `import.meta.url`
- `import.meta.filename`
- `import.meta.dirname`

Rejected:

- environment/tooling-specific fields like `import.meta.env`

## Conditional / Mapped / Utility Types

The compiler now lowers a useful deterministic subset directly instead of blanket rejection.

Supported examples include:

- `Partial<T>`
- `Pick<T, K>`
- `Omit<T, K>`
- finite mapped types
- deterministic conditional aliases
- `keyof`/template-literal/indexed-access combinations that normalize to concrete shapes

The guiding rule is still representability, not “accept all TS syntax”.

## Practical Guidance

- prefer explicit imported numeric types when CLR width matters
- keep generics monomorphic at value boundaries
- keep object-literal shapes finite
- use JS surface for JS ambient APIs, not CLR fallback
