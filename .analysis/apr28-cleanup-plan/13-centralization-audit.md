# Centralization Audit: Repeated Semantic Authority Outside Runtime Unions

Date: 2026-04-29

## Scope

This audit looks for compiler/platform decisions that are made in more than one place and therefore can drift. Runtime-union slot/projection analysis is intentionally not the main subject here; it is referenced only when another repeated semantic area intersects with it.

The scan covered `packages/frontend/src`, `packages/emitter/src`, `packages/backend/src`, and `packages/cli/src`, using broad searches for:

- narrowing/flow guards: `narrow`, `typeof`, `Array.isArray`, `instanceof`, `truthy`, `guard`
- surfaces/member APIs: `surfaceIncludesJs`, `JS_BUILTIN`, `length`, `slice`, `map`, `JSON`, `Promise`
- type identity: `TypeId`, `stableId`, `canonical`, `identity`, `equivalent`, `assignable`
- contextual/object lowering: `objectLiteral`, `anonymous`, `dictionary`, `expectedType`, `contextual`
- dynamic/NativeAOT risk: `unknown`, `object?`, `DynamicObject`, `reflection`, `JSON.parse`
- diagnostics and hard failures: `ICE`, `throw new Error`, validation gates
- config/schema parsing: `JSON.parse`, `unknown`, object validation, manifest parsing

## Centralization Test

A rule needs centralization when multiple modules can answer the same semantic question differently.

The repeated question is the real unit of risk, not the helper function. Local formatting helpers are fine. Repeated semantic authority is not.

Centralize when a decision answers any of these:

1. Is this source valid for the active language/surface?
2. What exact type/member/call target does this source bind to?
3. What runtime carrier/storage shape must be emitted?
4. What flow fact is true in this branch?
5. What proof is required before conversion/member/index access?
6. Is this NativeAOT-safe?
7. Is this diagnostic a user error or an internal invariant violation?

## Executive Summary

The audit found 18 centralization-worthy areas outside the already-known runtime-union projection problem.

The P0 areas are not optional cleanup. They directly affect correctness, soundness, or spec drift:

1. Flow/narrowing facts
2. Type identity/equivalence/stable keys
3. Surface API availability and member lowering
4. Member/property/indexer lookup
5. Call/overload/signature/argument resolution
6. Object literal target selection and structural materialization
7. `unknown`/`object`/`JsValue` broad-carrier policy
8. Numeric proof and numeric conversion authority

The remaining areas are still centralization work, but are either narrower or less likely to create incorrect generated code immediately.

## Findings Table

| ID    | Area                                        | Priority | Current Shape                                                                     | Central Owner Needed                                   |
| ----- | ------------------------------------------- | -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| CA-01 | Flow/narrowing facts                        | P0       | Frontend and emitter both parse guards                                            | Frontend flow fact engine; emitter consumes facts only |
| CA-02 | Type identity/equivalence/stable keys       | P0       | Multiple string/key identity systems                                              | One `TypeId`/canonical identity API                    |
| CA-03 | Surface API availability/lowering           | P0       | JS names and surface checks scattered                                             | Surface profile + binding metadata only                |
| CA-04 | Member/property/indexer lookup              | P0       | TypeSystem plus frontend/emitter fallback lookup                                  | TypeSystem member lookup only                          |
| CA-05 | Call/overload/signature/argument resolution | P0       | Frontend resolves, emitter re-adapts and re-queries                               | Resolved call plan in IR                               |
| CA-06 | Object literal target/materialization       | P0       | Frontend, validation, and emitter all choose object shape                         | Contextual object materialization plan in IR           |
| CA-07 | `unknown`/`object`/`JsValue` broad carriers | P0       | Validation, frontend, and emitter disagree                                        | One broad-carrier policy and proof model               |
| CA-08 | Numeric proof/conversion authority          | P0       | Numeric facts centralized partly, but call/member code still redoes compatibility | Numeric proof pass and type-system relation only       |
| CA-09 | JSON parse/stringify policy                 | P1       | Frontend safety and emitter JSON lowering each decide closedness                  | JSON operation semantic plan in IR                     |
| CA-10 | Truthiness/nullish boolean policy           | P1       | Boolean condition, guard extraction, emitter refinements overlap                  | One branch-condition normalization model               |
| CA-11 | Intrinsics/provenance/reserved names        | P1       | Converter and validator each know intrinsic rules                                 | Intrinsic registry/manifest                            |
| CA-12 | Async wrapper semantics                     | P1       | Promise/Task/Awaited logic repeated across frontend/emitter                       | Async-wrapper semantic service                         |
| CA-13 | Direct storage/carrier selection            | P1       | Variable, return, conditional, adaptation paths choose storage independently      | Storage-carrier plan in IR                             |
| CA-14 | Diagnostics vs ICE policy                   | P1       | Validation catches some cases; emitter still user-facing ICEs                     | Soundness gate must own user diagnostics               |
| CA-15 | Stable serialization/dedup ordering         | P1       | Several stable key/serialization implementations                                  | Shared deterministic key service                       |
| CA-16 | Config/manifest schema parsing              | P2       | CLI/frontend/package loaders manually parse schemas                               | Shared schema validator                                |
| CA-17 | Package/source/path identity                | P2       | Source package and manifest paths normalized in several places                    | Shared package identity model                          |
| CA-18 | Test fixture/generated artifact policy      | P2       | Fixture metadata and build outputs handled in multiple scripts                    | Test artifact lifecycle policy                         |

## CA-01: Flow/Narrowing Facts

### Repeated Authority

Frontend already has narrowing resolvers:

- `packages/frontend/src/ir/converters/narrowing-resolvers.ts`
- `packages/frontend/src/ir/converters/narrowing-resolvers-typeof.ts`
- `packages/frontend/src/ir/converters/narrowing-resolvers-equality.ts`
- `packages/frontend/src/ir/converters/narrowing-truthy.ts`
- `packages/frontend/src/ir/converters/narrowing-environment.ts`

Emitter also parses and interprets guards:

- `packages/emitter/src/statements/control/conditionals/guard-detectors-structural.ts`
- `packages/emitter/src/statements/control/conditionals/guard-extraction.ts`
- `packages/emitter/src/statements/control/conditionals/branch-context.ts`
- `packages/emitter/src/core/semantic/condition-branch-narrowing.ts`
- `packages/emitter/src/core/semantic/ternary-guards.ts`
- `packages/emitter/src/core/semantic/nullable-typeof-refinements.ts`
- `packages/emitter/src/core/semantic/truthiness-evaluation.ts`

### Example

User source:

```ts
function getWorkspaceId(value: unknown): string | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }

  if (!("WorkspaceId" in value)) {
    return undefined;
  }

  if (typeof value.WorkspaceId !== "string") {
    return undefined;
  }

  return value.WorkspaceId;
}
```

The semantic questions are:

1. Does `value !== null` remove null?
2. Does `typeof value === "object"` make structural object access possible?
3. Does `"WorkspaceId" in value` prove the member exists?
4. Does `typeof value.WorkspaceId === "string"` prove the property type?
5. Is `return value.WorkspaceId` now a `string`?

Those answers must come from one frontend flow-fact engine. The emitter must not rediscover this by recognizing `typeof`, `in`, or `Array.isArray` again.

### Current Drift Risk

If frontend and emitter disagree, source can be accepted with one branch fact and emitted with another. That creates exactly the class of bugs currently seen with narrowed callable projections: the emitter makes semantic branch decisions that should already be fixed in the IR.

### Correct Central Rule

Frontend creates explicit branch-scoped facts in IR:

```ts
{
  symbol: "value",
  facts: [
    { kind: "notNullish" },
    { kind: "structuralObject" },
    { kind: "hasProperty", name: "WorkspaceId" },
    { kind: "propertyType", name: "WorkspaceId", type: "string" }
  ]
}
```

Emitter consumes the resulting narrowed type/proof. It can materialize C# control flow, but it must not be an independent narrowing parser.

### Acceptance Criteria

- No emitter code decides semantic narrowing from raw `typeof`, `in`, `Array.isArray`, predicate calls, or `instanceof`.
- Emitter condition code may read only frontend-authored flow facts/narrowed bindings.
- If TS can narrow and Tsonic supports the runtime carrier, Tsonic can use that fact.
- If Tsonic needs stronger proof than TypeScript, the frontend proof pass produces that proof or emits a diagnostic.

## CA-02: Type Identity, Equivalence, and Stable Keys

### Repeated Authority

Frontend has a unified catalog:

- `packages/frontend/src/ir/type-system/internal/universe/catalog-types.ts`
- `packages/frontend/src/ir/type-system/internal/universe/unified-universe.ts`
- `packages/frontend/src/ir/type-system/internal/universe/alias-table.ts`
- `packages/frontend/src/ir/types/type-ops.ts`

Emitter has separate identity and canonicalization helpers:

- `packages/emitter/src/core/semantic/clr-type-identity.ts`
- `packages/emitter/src/core/semantic/deterministic-type-keys.ts`
- `packages/emitter/src/core/semantic/type-equivalence.ts`
- `packages/emitter/src/core/semantic/type-compatibility.ts`
- `packages/emitter/src/core/semantic/reference-type-identity.ts`
- `packages/emitter/src/core/format/backend-ast/utils.ts`

Call conversion also contains local identity helpers:

- `packages/frontend/src/ir/converters/expressions/calls/call-general.ts`

### Example

Equivalent identities:

```ts
const source = new Span<int>(numbers);
const target = new Span<int>(destination);
source.CopyTo(target);
```

All of these may describe the same type:

```text
System.Span`1[System.Int32]
System.Span`1
global::System.Span<int>
Span<int>
Span_1<int>
```

The compiler must not compare these with local raw strings in multiple places.

### Bad Emitted Shape From Drift

```csharp
((global::System.Span<int>)(object)source).CopyTo(target);
```

That is not NativeAOT-safe and not even legal for `Span<T>` because `Span<T>` is ref-like and cannot be boxed.

### Correct Central Rule

Every nominal/reference/CLR comparison must go through a single identity API, preferably a stable `TypeId` or catalog identity:

```ts
typeIdentity.equals(leftType, rightType);
typeIdentity.assignable(leftType, rightType);
typeIdentity.canonicalKey(type);
```

String formatting is for display/emission only, never semantic equality.

### Acceptance Criteria

- No raw CLR type-name comparison outside the identity service.
- No ad-hoc `global::` stripping outside formatting/display.
- No local metadata arity parsing outside the identity service.
- Emitter may ask for identity facts, but does not invent them from emitted C# surface strings.

## CA-03: Surface API Availability and Lowering

### Repeated Authority

Surface capability checks and JS member lists appear in:

- `packages/frontend/src/surface/profiles.ts`
- `packages/frontend/src/validation/features.ts`
- `packages/emitter/src/expressions/access-length.ts`
- `packages/emitter/src/core/semantic/js-array-surface-members.ts`
- `packages/emitter/src/expressions/calls/call-array-mutation.ts`
- `packages/emitter/src/expressions/calls/call-array-wrapper.ts`
- `packages/emitter/src/expressions/calls/call-json.ts`

### Example

User source:

```ts
function count(values: int[]): int {
  return values.length;
}
```

This must mean different things depending on surface:

- JS surface active: `length` is a JS array/member surface API and may lower to CLR `Length`.
- CLR/default surface only: `length` is not a valid member of CLR array; the user should write `values.Length` or use a surface package that declares `length`.

### Current Drift Risk

The compiler currently has separate knowledge of JS names such as:

```ts
"length";
"slice";
"map";
"filter";
"JSON";
"Array";
"Object";
```

If those names exist in validation and emitter code independently, a test can be made to pass by weakening one layer while the other layer still encodes the wrong spec.

### Correct Central Rule

Surface packages and active surface profiles own API availability:

```ts
// Conceptual resolved member binding
{
  sourceMemberName: "length",
  targetMemberName: "Length",
  surface: "js",
  receiver: "Array<T>",
  resultType: "int"
}
```

The emitter emits the resolved target. It does not decide that `length` is special.

### Acceptance Criteria

- No hardcoded JS member-name allowlists as semantic authority.
- Validation may produce diagnostics based on resolved surface metadata, not a local JS-name list.
- Emitter never decides that a source spelling is valid because it recognizes the JS name.
- Adding/removing a surface API happens in one declarative surface/binding location.

## CA-04: Member, Property, and Indexer Lookup

### Repeated Authority

Member and computed access lookup currently exists in:

- `packages/frontend/src/ir/type-system/inference-member-lookup.ts`
- `packages/frontend/src/ir/converters/expressions/access/member-resolution.ts`
- `packages/emitter/src/expressions/access-resolution-types.ts`
- `packages/emitter/src/core/semantic/property-lookup-resolution.ts`
- `packages/emitter/src/core/semantic/member-surfaces.ts`

### Example

User source:

```ts
const item = list[index];
const id = row.WorkspaceId;
const name = dictionary["name"];
```

The compiler must answer:

1. Is this array/list/tuple/dictionary/string/indexer access?
2. Is an `int` proof required for `index`?
3. What is the result type?
4. Which target member or indexer should be emitted?

### Current Drift Risk

Some paths classify based on IR type kind, some use TypeSystem indexer metadata, and some inspect reference names such as `Span` or `Array`. That creates inconsistent proof requirements.

### Correct Central Rule

TypeSystem should return an access plan:

```ts
{
  kind: "indexerAccess",
  receiverTypeId: "...",
  keyType: "int",
  valueType: T,
  requiresNumericProof: true,
  emit: { kind: "clrIndexer" }
}
```

Emitter only materializes the plan.

### Acceptance Criteria

- No duplicated numeric-key type sets.
- No local special-case member lookup for `Span`, `Array`, dictionary, or structural object outside TypeSystem.
- Computed access proof requirements are decided once.

## CA-05: Call, Overload, Signature, and Argument Resolution

### Repeated Authority

Frontend call resolution is large and partially centralized:

- `packages/frontend/src/ir/converters/expressions/calls/call-resolution.ts`
- `packages/frontend/src/ir/converters/expressions/calls/call-general.ts`
- `packages/frontend/src/ir/converters/expressions/calls/invocation-finalization.ts`
- `packages/frontend/src/ir/type-system/type-system-call-resolution.ts`
- `packages/frontend/src/ir/type-system/call-resolution-unification.ts`

Emitter still redoes call analysis/adaptation:

- `packages/emitter/src/expressions/calls/call-analysis.ts`
- `packages/emitter/src/expressions/calls/call-arguments-emit.ts`
- `packages/emitter/src/expressions/expected-type-adaptation.ts`
- `packages/emitter/src/expressions/calls/call-promise-static.ts`
- `packages/emitter/src/expressions/calls/call-array-wrapper.ts`

### Example

User source:

```ts
builder.HasKey((row: AuthProvider) => ({
  WorkspaceId: row.WorkspaceId,
  Id: row.Id,
}));
```

The call target decides the lambda context:

```text
Expression<Func<AuthProvider, object>>
```

That context decides that the object literal must be emitted as a C# anonymous object:

```csharp
builder.HasKey((AuthProvider row) => new { row.WorkspaceId, row.Id });
```

If emitter redoes context/adaptation late, it can emit an invalid dictionary initializer instead:

```csharp
builder.HasKey((AuthProvider row) =>
  new Dictionary<string, object?> {
    ["WorkspaceId"] = row.WorkspaceId,
    ["Id"] = row.Id
  });
```

### Correct Central Rule

Frontend call resolution must produce a complete resolved call plan:

```ts
{
  callee: resolvedSymbol,
  overload: resolvedSignatureId,
  parameters: [
    {
      expectedType: "Expression<Func<AuthProvider, object>>",
      argumentPlan: { kind: "expressionTreeLambda" }
    }
  ],
  returnType: ...
}
```

Emitter uses that plan. It must not infer overload intent or lambda context from shape.

### Acceptance Criteria

- Emitter does not choose overloads.
- Emitter does not infer expression-tree context independently.
- Argument casts/adaptations come from an IR plan.
- Overload-family metadata such as `override` is preserved once and emitted everywhere required.

## CA-06: Object Literal Target Selection and Structural Materialization

### Repeated Authority

Object literal behavior is distributed across:

- `packages/frontend/src/ir/converters/expressions/object-literals.ts`
- `packages/frontend/src/ir/converters/expressions/object-literal-synthesis.ts`
- `packages/frontend/src/ir/validation/anonymous-type-lowering-pass.ts`
- `packages/frontend/src/validation/contextual-type-checks.ts`
- `packages/frontend/src/validation/static-safety-rules.ts`
- `packages/emitter/src/expressions/object-literal.ts`
- `packages/emitter/src/expressions/structural-anonymous-targets.ts`
- `packages/emitter/src/expressions/structural-object-adaptation.ts`
- `packages/emitter/src/expressions/expected-type-adaptation.ts`
- `packages/emitter/src/core/semantic/expected-type-matching.ts`

### Example

The same syntax has multiple valid target meanings:

```ts
const dto: UserDto = { id: user.Id, email: user.Email };

const projection = (row: AuthProvider) => ({
  WorkspaceId: row.WorkspaceId,
  Id: row.Id,
});

const bag: Record<string, object> = {
  id: user.Id,
  email: user.Email,
};
```

Correct targets differ:

```csharp
new UserDto { id = user.Id, email = user.Email }
new { row.WorkspaceId, row.Id }
new Dictionary<string, object?> { ["id"] = user.Id, ["email"] = user.Email }
```

### Current Drift Risk

If frontend says "anonymous object" but emitter sees "object/dictionary target", generated code can be invalid or semantically wrong. The EF expression-tree dictionary initializer issue is this category.

### Correct Central Rule

Object literals must carry an explicit materialization plan:

```ts
{
  kind: "objectLiteral",
  materialization: {
    kind: "anonymousObject" | "nominalObject" | "dictionary" | "structuralCarrier",
    targetTypeId: ...
  }
}
```

The emitter must treat a missing plan as a frontend bug or validation-missed diagnostic, not choose a fallback.

### Acceptance Criteria

- No late fallback from object literal to dictionary or broad `object`.
- No anonymous object type reaches emitter unless lowered to a concrete generated carrier or explicitly marked expression-tree anonymous emission.
- Dictionary emission only when the IR plan says dictionary.

## CA-07: `unknown`, `object`, and `JsValue` Broad-Carrier Policy

### Repeated Authority

Policy touches:

- `packages/frontend/src/validation/static-safety-rules.ts`
- `packages/frontend/src/validation/contextual-type-checks.ts`
- `packages/frontend/src/ir/converters/expressions/access/member-resolution.ts`
- `packages/frontend/src/ir/validation/soundness-gate-expression-validation.ts`
- `packages/emitter/src/types/emitter.ts`
- `packages/emitter/src/types/objects.ts`
- `packages/emitter/src/expressions/structural-object-adaptation.ts`
- `packages/emitter/src/statements/control/conditionals/guard-extraction.ts`

### Example

User source:

```ts
const parsed: unknown = JSON.parse(metadataJson);

if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
  throw new Error("metadata must be object");
}

if (!("WorkspaceId" in parsed)) {
  throw new Error("metadata must include WorkspaceId");
}
```

The approved direction from current discussion is not "ban `unknown`". It is:

- `unknown` can be a safe input/storage type.
- Runtime operations on `unknown` require proven narrowing.
- Unsupported broad dynamic behavior is rejected.
- No reflection/dynamic member discovery is allowed.

### Correct Central Rule

There should be one broad-carrier policy matrix:

| Operation                      | `unknown` before proof                     | `unknown` after proof                | NativeAOT rule                 |
| ------------------------------ | ------------------------------------------ | ------------------------------------ | ------------------------------ |
| assign/pass/store              | allowed if carrier known                   | allowed                              | closed carrier only            |
| equality/null checks           | allowed                                    | allowed                              | direct emitted checks          |
| `typeof`/`Array.isArray` guard | allowed if modeled                         | allowed                              | closed helper or direct C#     |
| property read                  | diagnostic                                 | allowed only with property/type fact | no reflection                  |
| method call                    | diagnostic                                 | allowed only with resolved member    | no dynamic                     |
| JSON parse into broad object   | allowed only with planned validation model | typed/narrowed result                | no dynamic serializer fallback |

### Acceptance Criteria

- `unknown` is not lowered to arbitrary dynamic reflection.
- Narrowing proof is generated in frontend.
- Emitter never decides broad-object structural access from shape alone.
- Diagnostics explain which proof is missing.

## CA-08: Numeric Proof and Numeric Conversion Authority

### Repeated Authority

Numeric proof is partly centralized:

- `packages/frontend/src/ir/validation/numeric-proof-guard-facts.ts`
- `packages/frontend/src/ir/validation/numeric-proof-expression-walk.ts`
- `packages/frontend/src/ir/validation/numeric-expression-validation.ts`

But numeric compatibility appears in other places:

- `packages/frontend/src/ir/converters/expressions/access/member-resolution.ts`
- `packages/frontend/src/ir/converters/expressions/calls/call-resolution.ts`
- `packages/frontend/src/ir/converters/expressions/calls/call-general.ts`
- `packages/emitter/src/expressions/calls/call-arguments-emit.ts`
- `packages/emitter/src/expressions/operators/binary-special-ops.ts`

### Example

User source:

```ts
function read(values: string[], index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 2147483647) {
    throw new Error("bad index");
  }

  return values[index];
}
```

TypeScript only knows `index` is `number`. Tsonic needs an `int` proof for CLR array indexing.

### Correct Central Rule

The numeric proof pass is the only place that proves:

- integralness
- bounds
- narrowing from `number` to `int`/`long`/etc.
- safe numeric conversion

Call resolution and emitter may consume numeric proof facts. They must not infer them from a local numeric compatibility table.

### Acceptance Criteria

- Numeric conversion sites require a proof token or deterministic type-system relation.
- No emitter-only cast insertion for numeric proof.
- No "all numeric types are compatible" fallback at call/member/index sites.

## CA-09: JSON Parse/Stringify Policy

### Repeated Authority

JSON policy exists in:

- `packages/frontend/src/validation/static-safety-rules.ts`
- `packages/emitter/src/expressions/calls/call-json.ts`
- type/flow code that handles `unknown`/`object` after parse

### Example

Typed parse:

```ts
const dto = JSON.parse<UserDto>(json);
```

Unknown boundary with validation:

```ts
const value: unknown = JSON.parse(json);
if (typeof value === "object" && value !== null) {
  // structural validation follows
}
```

Disallowed broad dynamic behavior:

```ts
const value = JSON.parse(json);
return value.any.deep.property;
```

### Correct Central Rule

Frontend must classify each JSON operation:

```ts
{
  kind: "jsonParse",
  target: "closedDto" | "unknownWithValidation" | "invalidBroadDynamic",
  serializerPlan: "sourceGenerated" | "closedJsonElementPlan"
}
```

Emitter cannot independently decide closedness.

### Acceptance Criteria

- Typed serializers are generated/closed.
- Broad JSON does not produce reflection or dynamic dictionary walking.
- `unknown` parse is allowed only when subsequent operations are proven.
- `JSON.stringify` requires a closed serializable source or diagnostic.

## CA-10: Truthiness and Nullish Boolean Policy

### Repeated Authority

Truthiness and nullish checks appear in:

- `packages/frontend/src/ir/converters/narrowing-truthy.ts`
- `packages/emitter/src/core/semantic/truthiness-evaluation.ts`
- `packages/emitter/src/core/semantic/boolean-condition-main.ts`
- `packages/emitter/src/core/semantic/nullable-typeof-refinements.ts`
- `packages/emitter/src/statements/control/conditionals/guard-extraction.ts`

### Example

User source:

```ts
if (value) {
  use(value);
}

const result = value ?? fallback;
```

Tsonic must define exactly what truthy means for each supported runtime carrier.

### Correct Central Rule

Boolean condition normalization should produce explicit facts:

```ts
{
  expression: "value",
  conditionKind: "truthy",
  factsWhenTrue: [{ kind: "notNullish" }],
  factsWhenFalse: [...]
}
```

Emitter lowers the normalized condition; it does not reinterpret truthiness.

### Acceptance Criteria

- One truthiness table per supported carrier.
- No emitter-specific truthy behavior that differs from frontend narrowing.
- Unsupported truthiness on CLR-only types becomes a diagnostic.

## CA-11: Intrinsics, Provenance, and Reserved Names

### Repeated Authority

Intrinsic rules exist in:

- `packages/frontend/src/ir/converters/expressions/calls/call-intrinsics.ts`
- `packages/frontend/src/validation/core-intrinsics.ts`
- package/binding metadata used by resolver

### Example

User source:

```ts
const size = sizeof<MyStruct>();
const sym = Symbol("id");
```

Questions:

1. Is this intrinsic available?
2. Is this source spelling reserved?
3. What targets are allowed?
4. What IR node should be emitted?

### Correct Central Rule

An intrinsic registry should own:

```ts
{
  name: "sizeof",
  provenance: "@tsonic/core",
  arity: 1,
  allowedTargetKinds: ["unmanagedStruct", "primitive"],
  emits: "sizeofExpression"
}
```

Converter and validator query the same registry.

### Acceptance Criteria

- No duplicated intrinsic name/arity/provenance checks.
- Reserved names are derived from the registry.
- Intrinsic target eligibility is not hardcoded in converter and validator separately.

## CA-12: Async Wrapper Semantics

### Repeated Authority

Promise/Task/Awaited logic appears in:

- `packages/frontend/src/ir/types/type-ops.ts`
- `packages/frontend/src/ir/type-system/utility-type-filter-helpers.ts`
- `packages/frontend/src/ir/type-system/internal/type-converter/conditional-utility-types-extract.ts`
- `packages/frontend/src/ir/type-system/call-resolution-unification.ts`
- `packages/frontend/src/ir/validation/call-resolution-refresh-pass.ts`
- `packages/emitter/src/expressions/await-normalization.ts`
- `packages/emitter/src/core/semantic/async-wrapper-types.ts`
- `packages/emitter/src/expressions/calls/call-promise-normalization.ts`
- `packages/emitter/src/expressions/calls/call-promise-task-types.ts`
- `packages/emitter/src/expressions/calls/call-promise-static.ts`
- `packages/emitter/src/expressions/calls/new-emitter-promise.ts`
- `packages/emitter/src/types/references.ts`

### Example

User source:

```ts
async function load(): Promise<User | undefined> {
  return await repository.FindAsync();
}
```

The compiler must know:

- `Promise<T>` maps to `Task<T>`.
- `Promise<void>` maps to `Task`, not `Task<void>`.
- `ValueTask<T>` may need `.AsTask()` in some contexts.
- `Awaited<T>` unwraps `Promise`, `Task`, and `ValueTask`.

### Correct Central Rule

Async wrapper semantics should be one service:

```ts
asyncTypes.isAwaitable(type);
asyncTypes.awaitedType(type);
asyncTypes.taskCarrier(type);
asyncTypes.normalizeReturn(valueType, declaredReturnType);
```

Emitter can call this service, but must not maintain a separate type-name matrix.

### Acceptance Criteria

- One type-name/identity definition for Promise/Task/ValueTask.
- Await/return/call inference share awaited-type logic.
- Promise static methods are surface/binding-defined, not global hardcoded except by explicit approved core intrinsic.

## CA-13: Direct Storage and Carrier Selection

### Repeated Authority

Storage/carrier selection appears in:

- `packages/emitter/src/core/semantic/storage-types.ts`
- `packages/emitter/src/core/semantic/direct-storage-ir-types.ts`
- `packages/emitter/src/core/semantic/direct-value-surfaces.ts`
- `packages/emitter/src/core/semantic/variable-type-resolution.ts`
- `packages/emitter/src/expressions/direct-storage-types.ts`
- `packages/emitter/src/expressions/expected-type-adaptation.ts`
- `packages/emitter/src/expressions/operators/conditional-emitter.ts`
- `packages/emitter/src/statements/block-emitters/block-and-return.ts`

### Example

User source:

```ts
function channelIds(json: string): string[] | undefined {
  return json.length > 0 ? JSON.parse<string[]>(json) : [];
}
```

If both branches are direct `string[]` carriers, the conditional should remain direct array storage. It must not be projected as a runtime union just because the semantic type contains `undefined` elsewhere.

### Correct Central Rule

Frontend or a single semantic lowering pass should decide:

```ts
{
  expressionId: "...",
  storageCarrier: "directArray",
  semanticType: "string[] | undefined",
  runtimeProjection: "none"
}
```

### Acceptance Criteria

- Variable, return, conditional, and argument adaptation use the same storage plan.
- No local broad-storage fallback.
- If storage cannot be decided, validation emits a diagnostic.

## CA-14: Diagnostics vs ICE Policy

### Repeated Authority

User-facing invalid source is sometimes diagnosed in frontend and sometimes reaches emitter as an ICE:

- `packages/frontend/src/ir/validation/soundness-gate.ts`
- `packages/frontend/src/ir/validation/soundness-gate-expression-validation.ts`
- `packages/emitter/src/types/emitter.ts`
- `packages/emitter/src/types/objects.ts`
- `packages/emitter/src/types/dictionaries.ts`
- `packages/emitter/src/expressions/object-literal.ts`
- `packages/emitter/src/expressions/calls/call-json.ts`

### Example

Invalid broad object literal:

```ts
const value: object = { id: 1 };
```

Invalid unknown property read:

```ts
const value: unknown = getValue();
return value.id;
```

These should produce deterministic diagnostics before emission. Emitter ICEs are acceptable only for impossible internal invariants after a clean soundness gate.

### Correct Central Rule

The soundness gate owns all user-facing unsoundness:

```text
TSNxxxx: property 'id' cannot be read from unknown without a narrowing proof.
```

Emitter errors should mean "compiler bug after validated IR", not "source not supported".

### Acceptance Criteria

- Every emitter ICE in a user-reachable path has a corresponding frontend validation test.
- No user-facing unsupported feature is first discovered by emitter.
- Soundness gate is final authority before backend/emitter.

### 2026-05-10 Pipeline Boundary Checkpoint

The product compile path and the emitter source-to-C# integration helpers now share the same frontend pipeline boundary:

```text
createProgram
validateProgram
buildIr
runIrProcessingPipeline
emitCSharpFiles
```

The important correction is replacing a helper-local loop over `buildIrModule`:

```ts
const modules = program.sourceFiles.flatMap((sourceFile) => {
  const result = buildIrModule(sourceFile, program, options, ctx);
  return result.ok ? [result.value] : [];
});
```

That local loop was not an acceptable full-pipeline boundary because a failed module could disappear from the test project and converter diagnostics stored on `ProgramContext` were not guaranteed to be reported before emission.

The helper now uses the frontend-owned build boundary:

```ts
const buildResult = buildIr(program, options);
if (!buildResult.ok) {
  throw new Error(buildResult.error.map((d) => d.message).join("; "));
}
```

Direct `buildIrModule`, `emitModule`, and `emitCSharpFiles([manualIr])` tests remain valid only as lower-layer tests. They must not be used as evidence that a source program passed the compiler pipeline.

## CA-19: Test Helper Pipeline Boundaries

### Repeated Authority

Before this checkpoint, product graph builds and emitter source-to-C# helpers had separate pipeline authority:

- `buildModuleDependencyGraph` used the product multi-file path.
- `compileProjectToCSharp` manually created a program, built each module, ran a pass subset, and emitted C#.

That created a drift risk where an integration test could pass while a real CLI/project build failed, or a real diagnostic could be hidden by test-helper module dropping.

### Correct Central Rule

There is one source-to-C# pipeline shape:

```text
source files -> TsonicProgram -> validateProgram -> buildIr -> runIrProcessingPipeline -> emitCSharpFiles
```

Helpers may wrap this for filesystem setup or output normalization, but they cannot reimplement the pass list or build-loop semantics.

### Acceptance Criteria

- Product graph builds call `runIrProcessingPipeline`.
- Emitter source-to-C# helpers call `buildIr` and `runIrProcessingPipeline`.
- Helper-local pass sequences are removed from source-to-C# tests.
- Lower-layer IR/emitter unit tests are explicitly lower-layer and do not claim product-pipeline coverage.

## CA-15: Stable Serialization, Dedup, and Ordering

### Repeated Authority

Stable keys/serialization exist in:

- `packages/frontend/src/program/binding-registry-loading.ts`
- `packages/frontend/src/ir/types/type-ops.ts`
- `packages/frontend/src/ir/converters/expressions/calls/call-general.ts`
- `packages/emitter/src/core/semantic/deterministic-type-keys.ts`
- `packages/emitter/src/core/format/backend-ast/utils.ts`
- `packages/emitter/src/duplicate-type-suppression.ts`

### Example

Generated structural type dedup:

```ts
type A = { id: int; name: string };
type B = { name: string; id: int };
```

The compiler must decide whether these are the same structural shape deterministically. It cannot depend on local JSON serialization order or per-module WeakMap identity.

### Correct Central Rule

One deterministic key service should produce:

```ts
stableKeys.type(type);
stableKeys.member(member);
stableKeys.backendAstType(typeAst);
stableKeys.objectShape(properties);
```

### Acceptance Criteria

- No local stable stringify implementations for semantic keys.
- Key ordering is documented and test-covered.
- Dedup and union/member ordering use the same key semantics.

## CA-16: Config and Manifest Schema Parsing

### Repeated Authority

Manual schema parsing appears in:

- `packages/cli/src/config/shared.ts`
- `packages/cli/src/config/workspace-config.ts`
- `packages/cli/src/config/project-config.ts`
- `packages/cli/src/package-manifests/bindings/manifest-parsing/package-manifest.ts`
- `packages/cli/src/package-manifests/bindings/manifest-parsing/dotnet.ts`
- `packages/cli/src/package-manifests/bindings/manifest-parsing/runtime.ts`
- `packages/frontend/src/program/metadata.ts`
- `packages/frontend/src/resolver/module-resolution.ts`
- `packages/frontend/src/resolver/source-package-metadata.ts`
- `packages/frontend/src/resolver/source-package-resolution.ts`

### Example

Package manifest JSON:

```json
{
  "name": "@tsonic/core",
  "version": "10.0.41",
  "tsonic": {
    "surface": ["clr"]
  }
}
```

Each parser manually checks object-ness, string arrays, optional fields, and unknown values.

### Correct Central Rule

Use shared schema validators:

```ts
schemas.packageManifest.parse(json);
schemas.workspaceConfig.parse(json);
schemas.projectConfig.parse(json);
```

This is build tooling, not generated user runtime, so schema parsing may be implemented in JS tooling. It still should not be duplicated.

### Acceptance Criteria

- One parser per config/manifest schema.
- CLI/frontend resolver consume the same parsed model.
- Error messages include path and expected shape.

## CA-17: Package, Source, and Path Identity

### Repeated Authority

Package/source identity and path normalization are spread across resolver, CLI config, package manifest loading, build cases, and source package metadata.

Relevant areas include:

- `packages/frontend/src/resolver`
- `packages/frontend/src/program`
- `packages/cli/src/package-manifests`
- `packages/cli/src/config`

### Example

The same package may be referenced by:

```text
@tsonic/core/lang.js
../core/dist/lang.js
node_modules/@tsonic/core/lang.js
```

The compiler must know whether these are the same package source, the same surface, or different physical files.

### Correct Central Rule

One package identity model should own:

```ts
{
  packageName: "@tsonic/core",
  version: "10.0.41",
  physicalRoot: "...",
  sourceKind: "workspace" | "node_modules" | "packed"
}
```

### Acceptance Criteria

- No resolver/CLI disagreement about source package identity.
- Packed release smoke tests use the same model as normal builds.
- Diagnostics report canonical package identity.

## CA-18: Test Fixture and Generated Artifact Policy

### Repeated Authority

Generated fixture metadata and test build artifacts are managed across:

- `test/scripts`
- `test/fixtures/**/e2e.meta.json`
- CLI build case suites
- release smoke scripts
- cleanup/hygiene scripts

### Example

An E2E fixture can produce:

```text
__build/
obj/
bin/
e2e.meta.json
node_modules/
```

The repo must distinguish checked-in fixture source/metadata from generated artifacts.

### Correct Central Rule

One test artifact policy should define:

- what is checked in,
- what is generated,
- what is ignored,
- what cleanup removes,
- what cleanup must preserve.

### Acceptance Criteria

- Hygiene script and test scripts agree.
- New checkout does not require generated artifacts.
- Test runs do not leave unbounded generated directories.

## Cross-Cutting Direction

The correct architecture is:

```text
TypeScript source
  ↓
Binding + TypeSystem + Surface metadata
  ↓
Frontend semantic IR
  - resolved members
  - resolved calls
  - flow facts
  - object materialization plans
  - storage/carrier plans
  - proof tokens
  ↓
Soundness gate
  - user diagnostics
  - no unresolved broad/dynamic behavior
  - no NativeAOT-unsafe semantics
  ↓
Emitter
  - materializes IR plans only
  - no semantic rediscovery
  - no fallback guessing
  ↓
C# / NativeAOT-safe generated code
```

## Items To Incorporate Into Current Plan

These should be added above normal feature work because they prevent continued drift:

1. Define semantic authority boundaries:
   - TypeSystem owns type/member/call identity.
   - Surface metadata owns API availability.
   - Frontend flow engine owns narrowing facts.
   - Soundness gate owns user diagnostics.
   - Emitter owns C# materialization only.
2. Add a "no semantic rediscovery in emitter" checklist to the active plan.
3. Create central services or IR plan fields for the P0 areas before continuing broad fixes.
4. Convert representative P0 sites to prove the pattern:
   - flow/narrowing guard facts,
   - object literal materialization plan,
   - member/indexer access plan,
   - call argument adaptation plan.
5. Add regression tests that fail if the emitter recognizes raw JS names, raw guard patterns, or raw type strings as semantic authority.

## Current Risk Classification

### High Risk

- Flow/narrowing: can emit wrong branch/carrier behavior.
- Type identity: can emit invalid casts, boxing, or incorrect overload/union matches.
- Surface API availability: can silently weaken the language spec.
- Object literal materialization: can generate invalid C# in expression-tree contexts.
- Numeric proof: can emit invalid or unsafe CLR indexing/conversion.

### Medium Risk

- Async wrapper semantics: likely to create incorrect return/task shapes.
- JSON policy: can accidentally introduce dynamic/NativeAOT-hostile behavior.
- Diagnostics/ICE policy: blocks user-quality but also hides soundness gaps.

### Lower Risk

- Config/schema parsing and artifact policy are not language semantics, but repeated parsing/hygiene logic still causes checkout/release failures.

## Audit Conclusion

The central architectural drift is broader than unions. The pattern is consistent:

- frontend often knows the right semantic answer,
- emitter or validation code later re-derives part of the answer from syntax/type names,
- the re-derived answer can differ under surfaces, aliases, generic identities, narrowing, or broad carriers.

The fix is not to make each local heuristic better. The fix is to remove semantic rediscovery from late layers and carry explicit, proven plans through IR.
