# Upstream Gate Failure Triage

Run:

```text
./test/scripts/run-all.sh
run id: 20260428-213901-3b08b1b7
trace: .tests/run-all-20260428-213901-3b08b1b7.trace.jsonl
log: .tests/run-all-20260428-213901-3b08b1b7.log
```

Result:

```text
2928 passed
150 failed
```

Breakdown:

```text
Unit/golden: 105 failed
  frontend: 7
  emitter: 44
  cli: 54
TypeScript fixture typecheck: 15 failed
E2E dotnet fixtures: 30 failed
```

## Root Cause A: Object-Literal `arguments` Rewrite Was Removed Too Broadly

Failing tests:

```text
frontend validator object-literal method arguments.length
frontend validator object-literal method arguments[n]
frontend IR builder object-literal method arguments.length
frontend IR builder object-literal method arguments[n]
object-literal-method-arguments-length e2e
object-literal-method-arguments-index e2e
```

Failing source shape:

```ts
const ops = {
  add(x: number, y: number): number {
    return arguments.length + x + y;
  },
};
```

and:

```ts
const ops = {
  add(x: number, y: number): number {
    return (arguments[0] as number) + y;
  },
};
```

Drift:

```ts
if (ts.isIdentifier(node) && node.text === "arguments") {
  reason =
    "Method shorthand cannot reference JavaScript arguments in emitted Tsonic code";
}
```

That ban is too broad. `arguments.length` and literal `arguments[n]` are JavaScript-standard syntax and can be compiled away deterministically when the method has fixed required parameters. The compiler must not keep a dynamic `arguments` object, but it may lower proven cases to compile-time/direct parameter values.

Correct policy:

```ts
foo(x: number, y: number) {
  return arguments.length;
}
```

lowers in IR as:

```ts
return 2;
```

and:

```ts
foo(x: number, y: number) {
  return arguments[0];
}
```

lowers through a captured parameter temp:

```ts
const __tsonic_object_method_argument_0 = x;
return __tsonic_object_method_argument_0;
```

Unsupported forms stay rejected:

```ts
foo(x?: number) {
  return arguments[0];
}

foo(...xs: number[]) {
  return arguments.length;
}

foo(x: number) {
  return arguments[i];
}
```

## Root Cause B: Direct Union Syntax Was Mistaken For Runtime-Carrier Layout

Failing test:

```text
frontend tsbindgen instance receiver substitution
```

Failing source shape:

```ts
interface DbSet_1$instance<TEntity> {
  Find(...keyValues: unknown[]): TEntity | undefined;
}

const post = db.posts.Find(postId);
```

Drift:

```ts
export const convertUnionType = (...) =>
  normalizedUnionType(members, { preserveRuntimeLayout: true });
```

This marks every syntactic union as runtime-layout-owned. That is too broad.

Correct policy:

```ts
Find(...): TEntity | undefined
```

is a semantic union and should canonicalize deterministically, so `TEntity | undefined` and `undefined | TEntity` compare equivalently.

Only a source-owned runtime carrier may preserve layout:

```ts
type Result<T, E> = Ok<T> | Err<E>;
```

When `Result<T, E>` becomes a CLR runtime carrier, its carrier metadata owns slot ordering. Anonymous/direct unions do not.

## Root Cause C: Parameter-Modifier Storage Was Treated As A Runtime Union

Failing test:

```text
emitter materialized narrowing does not build union Match when source is ref-wrapped
```

Failing shape:

```ts
ref<number | undefined> -> number | undefined
```

Drift:

The materializer unwraps `ref<T>` for semantic comparison, then builds runtime-union `.Match(...)` against the unwrapped type. That is unsound because the emitted C# expression is still the storage boundary, not a runtime-union value.

Correct policy:

```csharp
refValue
```

may be unwrapped/cast when materializing a concrete target, but it must not emit:

```csharp
refValue.Match(...)
```

unless the actual emitted receiver is a runtime-union carrier.

## Root Cause D: Dictionary CLR Members Were Removed With JS Property Bridging

Failing tests:

```text
emitter dictionary Count
emitter dictionary Keys
emitter dictionary Values
```

Failing IR shape:

```ts
{
  kind: "memberAccess",
  object: {
    kind: "identifier",
    name: "dict",
    inferredType: {
      kind: "dictionaryType",
      keyType: string,
      valueType: number,
    },
  },
  property: "Count",
}
```

Bad emitted shape:

```csharp
dict["Count"]
```

Correct emitted shape:

```csharp
dict.Count
dict.Keys
dict.Values
```

This is not JS bridging. `dictionaryType` is a compiler IR carrier for CLR dictionary storage, so `Count`, `Keys`, and `Values` are known CLR members. Arbitrary `dict.foo` remains JS-surface dictionary property access only when the selected surface includes JavaScript.

## Root Cause E: Default Global Surface Cleanup Exposed Fixture Drift

Failing typecheck examples:

```text
array-constructor: Array value missing
array-destructuring: number[] not iterable
attributes-comprehensive: JsValue[] not iterable
boolean-context-locals-dotnet: string[] not iterable
implements-clr-interface: Type[] not iterable
```

Failing source shapes:

```ts
const xs = new Array<int>(3);
```

and:

```ts
const [first] = values;
for (const value of values) {
  consume(value);
}
```

Policy split:

- `new Array<T>(...)` is a JavaScript constructor API and should not be part of the default CLR surface.
- Array destructuring and `for-of` are JavaScript-standard syntax the compiler can lower deterministically to CLR loops/indexing. Ambient array typing must support syntax without exposing broad JS runtime behavior.

The fixture changes must follow that split: remove or JS-surface-gate `Array` constructor usage; keep deterministic array iteration syntax supported.

## Root Cause F: First-Party Source Packages Expose Stricter-Surface Drift

Failing groups:

```text
CLI native library port regressions
JS-surface e2e fixtures that import @tsonic/js
NodeJS-surface fixtures that import @tsonic/nodejs
```

Representative TypeScript errors:

```text
../nodejs/versions/10/src/buffer/buffer.ts
Argument of type 'string | number | Buffer' is not assignable to parameter of type 'string'.
```

Representative C# errors:

```text
generated/node_modules/@tsonic/js/src/Globals.cs
CS0029: Cannot implicitly convert type 'string' to 'bool'
```

These are downstream-of-compiler-source-package failures caused by the stricter surface and broad dynamic cleanup. They must be fixed generically in source-package code or compiler narrowing, not by reintroducing dynamic bridges.

## Immediate Fix Order

1. Restore deterministic object-literal `arguments` lowering only for fixed required parameters.
2. Stop marking every direct union syntax as runtime-layout-owned; preserve runtime layout only on source-owned carriers.
3. Prevent ref/out/in storage wrappers from entering runtime-union `.Match(...)` materialization paths.
4. Restore dictionary CLR member emission for `dictionaryType` built-ins without restoring arbitrary dictionary property bridging.
5. Run focused frontend/emitter checks for the four compiler-level root causes.
6. Re-run upstream gate, then classify remaining fixture/source-package failures separately.
