# Parity Matrix To Build Before Coding

This file is the implementation checklist for current semantics that must be preserved in phase 1.

It is intentionally explicit. The team should fill/verify every row before changing policy code.

This matrix must be backed by instrumentation.

Manual enumeration alone is not sufficient for airplane-grade execution.

Required sources of truth:

- instrumented heuristic-hit logs from the current compiler
- current goldens / integration tests
- downstream verification projects

The instrumented hit set must be preserved as a checked-in artifact before implementation begins.

Recommended form:

- a generated report under `.analysis/bindings-semantics-metadata/`
- stable enough to review in code review
- derived from a deterministic instrumentation run

## A. Call-style matrix

Record every current hardcoded family or exception that affects fluent vs static emission.

| Row  | Family / Binding Type             | Member Scope        | Current Style | Owning Repo / Package       | Authoring Point For Phase 1                                     | Why It Exists                        | Must Preserve In Phase 1 |
| ---- | --------------------------------- | ------------------- | ------------- | --------------------------- | --------------------------------------------------------------- | ------------------------------------ | ------------------------ |
| `A1` | `Tsonic.JSRuntime.*`              | receiver helpers    | receiver      | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json`          | preserve JS authored shape           | yes                      |
| `A2` | `System.Linq.Queryable.*`         | query ops           | receiver      | `dotnet`                    | `dotnet/__build/templates/10/tsbindgen.bindings-semantics.json` | query/precompilation tooling         | yes                      |
| `A3` | `Microsoft.EntityFrameworkCore.*` | query ops           | receiver      | `efcore`                    | `efcore/__build/templates/10/tsbindgen.bindings-semantics.json` | EF query tooling                     | yes                      |
| `A4` | `System.Linq.Enumerable`          | default             | static        | `dotnet`                    | `dotnet/__build/templates/10/tsbindgen.bindings-semantics.json` | avoid accidental instance collisions | yes                      |
| `A5` | `System.Linq.Enumerable`          | `ToList`, `ToArray` | receiver      | `dotnet`                    | `dotnet/__build/templates/10/tsbindgen.bindings-semantics.json` | current special-case behavior        | yes                      |

For each row, add real test cases and verify emitted output before changing metadata flow.

### Required example set

#### JS receiver helper

```ts
const s = "  hi  ".trim();
```

Expected current output shape:

```csharp
s.trim()
```

#### Optional chaining case

```ts
value?.toString();
```

Expected current output shape:

```csharp
value?.toString()
```

#### EF query helper

```ts
query.Include((x) => x.posts);
```

Expected current output shape:

```csharp
query.Include(x => x.posts)
```

#### LINQ helper

```ts
const ys = xs.Where((x) => x > 1);
```

Expected current output shape should be recorded from current behavior and preserved in phase 1.

## B. Type-identity matrix

Record every simple/global alias currently treated as type-like for emitter/type-space purposes.

| Row   | Alias           | Current Type-Like? | Owning Repo / Package       | Authoring Point For Phase 1                            | Expected Reason                 | Must Preserve In Phase 1 |
| ----- | --------------- | ------------------ | --------------------------- | ------------------------------------------------------ | ------------------------------- | ------------------------ |
| `B1`  | `Array`         | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | constructor + type identity     | yes                      |
| `B2`  | `Date`          | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | constructor + type identity     | yes                      |
| `B3`  | `Error`         | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | used in type positions          | yes                      |
| `B4`  | `JSON`          | no                 | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | static/global container         | yes                      |
| `B5`  | `Map`           | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | constructor + type identity     | yes                      |
| `B6`  | `Math`          | no                 | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | static/global container         | yes                      |
| `B7`  | `Number`        | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | constructor + type identity     | yes                      |
| `B8`  | `Object`        | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | constructor + type identity     | yes                      |
| `B9`  | `RangeError`    | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | constructor + type identity     | yes                      |
| `B10` | `ReadonlyArray` | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | generic container type identity | yes                      |
| `B11` | `RegExp`        | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | constructor + type identity     | yes                      |
| `B12` | `Set`           | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | constructor + type identity     | yes                      |
| `B13` | `String`        | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | constructor + type identity     | yes                      |
| `B14` | `Uint8Array`    | yes                | `js-runtime` / `@tsonic/js` | `js-runtime/surface/10/tsbindgen.surface-package.json` | constructor + type identity     | yes                      |

### Required example set

#### `Error`

```ts
const cb: (err: Error | undefined) => void = (_err) => {};
```

#### `Date`

```ts
const now: Date = new Date();
```

#### `JSON`

```ts
const text = JSON.stringify({ ok: true });
```

#### typed array

```ts
const buf = new Uint8Array(4);
```

## C. Extension-method note

Extension-method discovery itself is not the matrix target.

The matrix target is only:

- how the resolved method is emitted

So add rows for extension families only where call-style policy currently comes from compiler heuristics.

## D. Instrumentation output requirement

Before coding:

- run the instrumented compiler against internal and downstream suites
- attach or summarize the observed heuristic-hit inventory here
- confirm that every hit maps to a row in section A or B

If an observed hit does not map to a row, the matrix is incomplete and implementation must not begin.

If a row is still unresolved for a family that appears in the preserved instrumentation artifact, implementation must not begin.
