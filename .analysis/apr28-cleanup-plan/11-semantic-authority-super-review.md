# Semantic Authority Super Review

This file incorporates the deeper review of emitter-side semantic analysis into the active cleanup plan.

The practical goal is narrow:

```text
Get upstream Tsonic run-all green without weakening the language contract.
```

The architectural goal is broader but still concrete:

```text
Frontend/type system proves source semantics.
Emitter materializes already-proven facts.
Emitter does not rediscover TypeScript semantics from source syntax, names, or emitted C# shapes.
```

## Audit Coverage

The review covered:

- `1396` TypeScript source files under `packages/*/src`.
- `330` non-test emitter TypeScript files.
- `387` non-test frontend TypeScript files.
- all files mentioning `narrowedBindings`.
- all emitter guard/narrowing producer candidates.
- all emitter type compatibility/equivalence helper users.
- all broad `unknown`/`object`/array carrier paths.
- all surface/member-gating paths found by text search.

Representative inspected files:

- `packages/frontend/src/ir/converters/statements/control/conditionals.ts`
- `packages/frontend/src/ir/converters/expressions/other.ts`
- `packages/frontend/src/ir/converters/expressions/operators.ts`
- `packages/emitter/src/core/semantic/condition-branch-narrowing.ts`
- `packages/emitter/src/core/semantic/nullable-typeof-refinements.ts`
- `packages/emitter/src/core/semantic/ternary-guards.ts`
- `packages/emitter/src/statements/control/conditionals/branch-context.ts`
- `packages/emitter/src/expressions/object-literal.ts`
- `packages/emitter/src/expressions/access-length.ts`
- `packages/emitter/src/core/semantic/type-compatibility.ts`
- `packages/emitter/src/core/semantic/type-equivalence.ts`

## SA1: Branch narrowing is duplicated in the emitter

### User source

```ts
function read(value: string | number): string {
  if (typeof value === "string") {
    return value;
  }

  return "";
}
```

### Correct semantic flow

```text
TypeScript source guard: typeof value === "string"
Frontend flow conversion: branch-local `value` type is `string`
Tsonic proof: `string` has a deterministic CLR carrier
Emitter: emits the already-proven branch value
```

### Weak architecture found

The frontend already applies branch facts in:

```text
packages/frontend/src/ir/converters/statements/control/conditionals.ts
```

The emitter also reparses condition syntax in:

```text
packages/emitter/src/core/semantic/condition-branch-narrowing.ts
packages/emitter/src/core/semantic/nullable-typeof-refinements.ts
packages/emitter/src/core/semantic/instanceof-predicate-refinements.ts
packages/emitter/src/statements/control/conditionals/if-emitter.ts
```

### Why this is wrong

Two independent semantic engines can disagree.

Example failure mode:

```ts
if (isWorkspaceOwnedEntity(value)) {
  return value.WorkspaceId;
}
```

TypeScript may prove the predicate, but an emitter parser that only understands direct `typeof` and property guards can miss it. The reverse is worse: an emitter parser can accept a syntactic pattern that TypeScript did not actually prove at the use site.

### Task

Create a frontend-owned flow-fact contract for branch-local types and access paths. Emitter-side guard parsing must become materialization-only or be removed.

### Acceptance

- The same narrowing fact feeds `if`, `else`, `&&`, `||`, and early-return flow.
- Emitter does not call a general condition parser to decide source type.
- Unsupported carrier cases become diagnostics before emission.

## SA2: Ternary narrowing has a separate semantic path

### User source

```ts
function label(value: string | null): string {
  return value !== null ? value : "";
}
```

### Correct semantic flow

```text
Condition narrows true branch: value is string
Condition narrows false branch: value is null
Conditional result type: string
Emitter: emits C# conditional expression from the proven branch types
```

### Weak architecture found

The frontend already handles ternary branch contexts in:

```text
packages/frontend/src/ir/converters/expressions/other.ts
```

The emitter has a separate ternary guard engine in:

```text
packages/emitter/src/core/semantic/ternary-guards.ts
packages/emitter/src/expressions/operators/conditional-emitter.ts
```

The ternary guard file explicitly documents that it is looser than the `if` path.

### Why this is wrong

The same source fact can emit differently depending on spelling.

```ts
if (result.success) {
  return result.value;
}

return result.success ? result.value : fallback;
```

These must use the same source proof. They must not rely on two separate emitter matchers.

### Task

Route ternary branch materialization through the same frontend flow-fact representation used by `if`.

### Acceptance

- A predicate/discriminant/typeof/null guard has one proof record regardless of `if` or ternary spelling.
- Ternary-specific union member matching is removed or reduced to consuming existing facts.

## SA3: Branch merge uses emitted AST string equality

### User source

```ts
let current: Result<string, Error>;

if (ok) {
  current = { success: true, value: "done" };
} else {
  current = { success: false, error: new Error("failed") };
}
```

### Weak architecture found

`packages/emitter/src/statements/control/conditionals/branch-context.ts` uses serialized emitted AST equality as a carrier comparison.

### Why this is wrong

Emitted syntax is not semantic identity.

Two carriers can be semantically identical but printed differently:

```csharp
global::Tsonic.Internal.Union<string, Error>
Tsonic.Internal.Union<string, Error>
```

Two emitted ASTs can also look the same while referring to different source facts if they were produced from different declarations or scopes.

### Task

Replace branch merge carrier equality with stable semantic identities:

```text
source declaration id
access path id
Tsonic type id
runtime carrier id
runtime union arm id when applicable
```

### Acceptance

- No branch merge decision depends on `JSON.stringify` of emitted AST.
- Branch merge distinguishes `noMatch`, `ambiguous`, and `unsupported`.
- Ambiguous/unsupported branch merge produces diagnostics, not broad fallback.

## SA4: `Array.isArray` over broad carriers invents `object[]`

### User source

```ts
function first(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}
```

### Unsafe lowering

```text
unknown/object detected as array
=> synthesize object[]
=> emit CLR array indexing
```

### Why this is wrong

`Array.isArray` over user-facing `unknown` does not prove arbitrary CLR `object?` is a CLR `object[]`.

NativeAOT-safe support requires a closed carrier, for example:

```text
UnknownJsonArray
```

with deterministic index operations. It cannot be implemented by reflecting or guessing over arbitrary CLR objects.

### Task

Remove broad `unknown/object` to CLR `object[]` synthesis. Allow `Array.isArray` only for:

- values already carried by a known array carrier, or
- a closed compiler/runtime-owned unknown/JSON carrier.

### Acceptance

- `Array.isArray` over arbitrary nominal CLR `object` rejects.
- `Array.isArray` over a closed unknown/JSON carrier is accepted only after carrier support exists.
- No emitter path appends synthetic broad `object[]` as a fallback.

## SA5: Type compatibility in the emitter must not be source proof

### User source

```ts
type ById = { id: string };
type ByName = { name: string };

declare function use(value: ById | ByName): void;

use({ id: "a", name: "b" });
```

### Risk

If emitter compatibility helpers select a union arm by structural scoring, the compiler can pick an arm after frontend semantics should already be settled.

### Weak architecture found

Emitter helpers in:

```text
packages/emitter/src/core/semantic/type-compatibility.ts
packages/emitter/src/core/semantic/type-equivalence.ts
packages/emitter/src/core/semantic/expected-type-matching.ts
```

are used by many emission paths.

### Correct boundary

Emitter type compatibility may answer only backend questions:

```text
Can this already-proven IR value be materialized in this already-proven C# storage?
```

It must not answer source-language questions:

```text
Which overload did the source call choose?
Which union arm did this object literal mean?
Is this broad object literal acceptable?
```

### Task

Classify every emitter type-compatibility caller as:

- materialization-only and valid,
- duplicate semantic proof to move frontend,
- fallback to remove.

### Acceptance

- No source acceptance decision is made only in the emitter.
- Ambiguous source choices are diagnostics.
- Type comparisons use deterministic type IDs, not raw display strings.

## SA6: Object-literal union arm selection belongs before emission

### User source

```ts
type A = { kind: "a"; value: string };
type B = { kind: "b"; value: string };

const item: A | B = { kind: "a", value: "ok" };
```

### Correct flow

```text
Frontend proves object literal matches A exactly.
IR records selected union arm.
Emitter emits Union<A, B>.From1(new A(...)).
```

### Ambiguous source

```ts
type A = { id: string; tag?: "a" };
type B = { id: string; tag?: "b" };

const item: A | B = { id: "x" };
```

### Correct result

```text
diagnostic: object literal matches multiple union members
```

### Weak architecture found

`packages/emitter/src/expressions/object-literal.ts` invokes union member selection during emission.

### Task

Move object-literal union selection into frontend/type-system validation. Emitter consumes selected arm metadata only.

### Acceptance

- Exact union object construction emits the selected `FromN`.
- Ambiguous object literal union construction fails before emitter.
- Emitter has no structural scoring fallback for object literal union arms.

## SA7: Surface member resolution must not be text-and-shape based in the emitter

### Default-surface source

```ts
export function count(xs: int[]): int {
  return xs.length;
}
```

### Correct result

```text
diagnostic: property length is not available on default surface int[]
```

### JS-surface source

```ts
import "@tsonic/js/index.js";

export function count(xs: number[]): number {
  return xs.length;
}
```

### Correct lowering

```csharp
return xs.Length;
```

### Why both are true

The source spelling `.length` is valid only because the JS surface declares that member. The final C# spelling `.Length` is an implementation detail of the JS surface binding.

### Weak architecture found

Emitter access paths inspect member names such as `length` and receiver shape.

### Task

Make frontend member resolution produce an explicit member binding:

```text
source name: length
declaring surface/package: @tsonic/js
receiver source type: number[]
carrier member: System.Array.Length
```

Emitter lowers that binding. It does not decide from the text `length`.

### Acceptance

- Default-surface `.length` rejects.
- Default-surface `.Length` succeeds through CLR carrier metadata.
- JS-surface `.length` succeeds through JS surface metadata.
- `.slice`, `.push`, `.map`, and similar JS APIs follow the same rule.

## SA8: Boolean truthiness must be frontend-owned

### User source

```ts
function enabled(value: string | undefined): boolean {
  if (value) {
    return true;
  }

  return false;
}
```

### Correct flow

```text
Frontend determines whether value is allowed in boolean context.
Frontend records truthiness effect on branch type.
Tsonic verifies the value carrier can lower the truthiness check.
Emitter emits the proven check.
```

### Risk

A runtime truthiness helper over `unknown`, `any`, `object`, or broad unions reintroduces dynamic JavaScript semantics.

### Task

Separate:

- source boolean-context legality,
- TypeScript truthiness flow facts,
- Tsonic carrier-specific lowering.

Remove broad runtime truthiness fallbacks.

### Acceptance

- Primitive truthiness lowers through closed primitive checks.
- Broad `unknown/object` truthiness rejects unless a closed carrier defines the operation.
- Emitter does not infer source truthiness types.

## SA9: Assignment-flow narrowing must not be emitter-owned

### User source

```ts
let value: string | number = "a";
value = 10;

return value;
```

### Correct semantic flow

```text
Frontend/type system records the post-assignment readable type.
Tsonic verifies storage write compatibility.
Emitter emits the assignment and later reads the proven type.
```

### Weak architecture found

Emitter assignment-flow helpers update local narrowed bindings after assignment.

### Task

Move assignment flow facts to frontend IR. Emitter write adaptation remains backend-only:

```text
Can the proven RHS carrier be stored in the proven target storage?
```

### Acceptance

- Assignment updates do not mutate emitter semantic facts.
- Invalid assignment compatibility fails before or at adaptation with a diagnostic.
- No broad storage fallback hides uncertainty.

## SA10: `unknown` requires a closed carrier design, not `object?`

### User source

```ts
const value: unknown = JSON.parse(text);

if (typeof value === "string") {
  return value;
}
```

### Valid direction

This can be supported if `JSON.parse` produces a closed compiler-owned unknown/JSON carrier and the compiler can lower the `string` test deterministically.

### Invalid direction

```text
unknown => object?
typeof/property checks => runtime reflection/dynamic probing
```

### Structural example

```ts
function hasWorkspaceId(value: unknown): value is { WorkspaceId: string } {
  return value !== null &&
    typeof value === "object" &&
    "WorkspaceId" in value &&
    typeof value.WorkspaceId === "string";
}
```

### Correct rule

This is accepted only when:

- TypeScript proves the property type at the use site,
- Tsonic proves the value is the closed unknown/JSON object carrier,
- emitted code uses carrier operations such as `HasString("WorkspaceId")`, not reflection.

### Task

Implement or explicitly diagnostic-gate closed `unknown` carrier semantics. Do not allow arbitrary `object?` probing.

### Acceptance

- Opaque `unknown` storage/pass-through is allowed.
- Structural `unknown` reads require closed carrier proof.
- Numeric narrowing from `unknown` to `int` rejects unless Tsonic numeric proof exists.

## SA11: JavaScript `in` must be supported only as a proven flow fact plus carrier proof

### User source

```ts
if ("WorkspaceId" in value) {
  return value.WorkspaceId;
}
```

### Invalid broad lowering

```csharp
value.GetType().GetProperty("WorkspaceId") != null
```

### Correct lowering shape for a closed JSON carrier

```csharp
if (value.IsObject && value.AsObject().HasString("WorkspaceId"))
{
    return value.AsObject().GetString("WorkspaceId");
}
```

### Task

Unban `in` as syntax only where the semantic proof exists:

- TypeScript proves the narrowed source fact.
- Tsonic proves a closed key-addressable carrier.

Otherwise produce a diagnostic.

### Acceptance

- `"prop" in nominalClrObject` rejects unless the type declares a deterministic key API.
- `"prop" in unknownJsonObject` can pass only with closed carrier support.
- The emitter never probes CLR reflection for property existence.

## SA12: Runtime-union guard materialization must consume discriminant proof

### User source

```ts
type Ok<T> = { success: true; value: T };
type Err<E> = { success: false; error: E };
type Result<T, E> = Ok<T> | Err<E>;

function unwrap(result: Result<string, Error>): string {
  if (!result.success) {
    throw result.error;
  }

  return result.value;
}
```

### Unsafe shortcut

```text
property name is success
negated truthiness
=> emit !result.Is1()
```

### Correct proof

```text
success is present on every union member
success has literal true on Ok
success has literal false on Err
no member has broad/non-literal success
runtime union arm order maps Ok to arm 1 and Err to arm 2
```

Only after this proof may the emitter output:

```csharp
if (!result.Is1())
{
    var err = result.As2();
    throw err.error;
}
```

### Task

Keep runtime-union guard emission, but make it consume explicit discriminant/arm proof from frontend/type-system metadata.

### Acceptance

- Discriminant guards emit `IsN`/`AsN` only after arm proof.
- Non-discriminant property truthiness does not become a union arm check.
- Returning a narrowed arm into the full union re-wraps with `FromN`.

## SA13: Expression-tree anonymous object lowering is aligned, but must be proven

### User source

```ts
builder.HasKey((row: AuthProvider) => ({
  WorkspaceId: row.WorkspaceId,
  Id: row.Id,
}));
```

### Correct lowering

```csharp
builder.HasKey((AuthProvider row) => new
{
    WorkspaceId = row.WorkspaceId,
    Id = row.Id
});
```

### Review result

Frontend already marks expression-tree object literals with an anonymous-object flag. Emitter has a path that consumes that flag.

### Task

Add focused proof and make sure dictionary object-literal paths do not run inside expression-tree lambda contexts.

### Acceptance

- Expression-tree object literal emits anonymous object.
- Dictionary initializer still emits only for actual dictionary contextual targets.
- No EF-specific method-name checks are introduced.

## SA14: JSON typed serialization path is aligned, but untyped/broad cases need diagnostics

### Valid source

```ts
type Metadata = {
  WorkspaceId: string;
};

const metadata = JSON.parse<Metadata>(text);
return JSON.stringify(metadata);
```

### Correct lowering

```csharp
var metadata = JsonSerializer.Deserialize<Metadata>(text, TsonicJson.Options);
return JsonSerializer.Serialize(metadata, TsonicJson.Options);
```

### Invalid source

```ts
const metadata = JSON.parse(text);
return JSON.stringify(metadata);
```

### Correct result

```text
diagnostic: JSON parse/stringify requires a closed target/source type or supported closed unknown carrier
```

### Task

Keep typed/generated serializer lowering. Convert remaining untyped/broad user-reachable cases to diagnostics before emitter.

### Acceptance

- Typed parse/stringify fixtures pass.
- Untyped parse/stringify broad values fail with diagnostics.
- No runtime dynamic JSON walker is referenced.

## Execution Order From This Review

1. Lock plan and task tracker updates.
2. Run focused inventory commands for SA1-SA14 and record any new hardcoded sites in `02-hardcoding-ledger.md`.
3. Repair frontend proof contracts for branch/ternary/assignment/truthiness facts.
4. Remove or demote emitter duplicate semantic analyzers to materialization-only.
5. Repair broad-carrier, JSON, `unknown`, and `in` diagnostics.
6. Prove Jotster P0 generic cases.
7. Run focused compiler tests grouped by root cause.
8. Run full upstream `./test/scripts/run-all.sh`.

## Non-Goals For This Branch

Downstream repositories may remain dirty or require follow-up source changes. They must not drive compiler weakening. This branch is complete when upstream Tsonic run-all is green and the plan-backed compiler behavior is strict, deterministic, and NativeAOT-compatible.
