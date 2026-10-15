# Sealed target programs

This document defines the shared C#/Rust record boundary. The skeletal
migration establishes the reader API without changing the analyses behind it.
Completing producer ownership and eliminating post-seal semantic decisions are
separate requirements; a folder move or a readonly interface does not prove
those requirements satisfied.

Workspace policy remains owned by `workspace-agent-policy.md`. This is a
compiler transport contract, not another language or performance policy.

## One boundary on both targets

```text
checked source and provider identities
                |
analysis calls per-construct policy through a readonly context
                |
analysis-owned record construction and source admission
                |
sealed target program with program.records.<family>.get(...)
                |
planner -> native syntax -> syntactic normalization -> printer
```

| Responsibility | Owner on both targets | Excluded responsibility |
| --- | --- | --- |
| Record payloads and reader signatures | `src/target-model/records/` | Analysis, policy selection, generated syntax |
| Container construction and mutable builders | `src/analysis/program/records/` | Runtime execution, printing |
| Semantic production | The owning `src/analysis/<family>/` module | A second decision in a reader or planner |
| Per-construct native selection | `src/policy/`, through `src/policy/model/` | Program-wide propagation or record mutation |
| Immutable record consumption | Policy contexts and planners | Key access, source rejection, lazy analysis |

Pure payload declarations may reference checked source identities and native
vocabulary. They must not import policy implementations, analysis builders or
backend syntax. The reader interface contains no writer capability. An
analysis construction context can extend a readonly policy context; passing
that mutable extension into a planner is forbidden.

The transport idiom is identical, not an instruction to fabricate identical
payloads for different native contracts. Rust lifetimes and Result transport
and C# CLR attribute applications require different payloads. Different folder
names, producer roles or competing APIs need a separate architectural reason;
the historical number of keys or queries is not that reason.

## Reader API and subject identity

The native record interfaces are `RustProgramRecords` and
`CsharpProgramRecords`, in each target's
`src/target-model/records/program.ts`. The analyzed program exposes them as
`program.records`.

Rust's family reader accepts the original checked subject:

```typescript
export interface RustRecordFamily<T> {
  readonly get: (subject: ExtensionFactSubject | undefined) => T | undefined;
}
```

For example, `program.records.runtimeCarrier.get(node)` returns the selected
carrier record; `program.records.targetOperation.get(node)` returns the
finalized operation. It neither re-runs selection nor infers a replacement from
the node's spelling when the record is absent.

C# groups its existing typed queries under the same `<family>.get` idiom. Their
parameters and result types remain exact. Not every query was a single-node,
optional lookup: required types, booleans, collections and compound contextual
queries retain their contracts. Both targets declare the getter function
property readonly; freezing the runtime object is not a substitute for this
typed boundary. Examples include:

```typescript
program.records.physicalStorageType.get(declaration, logicalType);
program.records.expressionConversion.get(expression, source, target, mode);
program.records.semanticTargetType.get(type, sourceFile);
program.records.classInitializationRegion.get(declaration, isStatic);
```

Do not replace these inputs with an allocated tuple key, discard context,
invent an optional result or manufacture a new subject identity. Preserve
selected generic instantiations and the exact source/native declaration
correspondence. A missing optional record is distinct from a present record
whose payload denotes source absence.

Checker `ExtensionFactKey` queries remain on the checked-source fact API. They
are not native plan keys and do not become additional target record families.
Native key definitions and the private lookup implementation stay inside
analysis; `getFact`, key-based `get` and convenience readers are not alternative
consumer APIs.

## Construction, specialization and sealing

Rust's constructor is `createRustProgramRecordBuilder`, in
`src/analysis/program/records/create.ts`. Analysis publishes through the exact
typed producer for each family, such as `runtimeCarriers.source` or
`sourceParameterAbis.parameter`. Reader families expose only `get`; there is
no public generic writer, key-based writer or ignored evidence argument.
Construction preserves:

1. Exact checked subject identity and each family's original equality rule.
2. Rejection of conflicting evidence rather than last-write-wins replacement.
3. Scoped/specialized child lookup with the existing parent fallback order.
4. Minimum `core`/`alloc`/`std` demand accounting for every contributing carrier,
   conversion, call and operation.
5. One-way sealing: a write after sealing fails, including through a previously
   obtained writer handle.

Each accepted source/native selection independently records its required family,
exact checked `Node`, construct and producer before publication. The inventory
belongs to analysis, not the record writer or the backend. A probe owns a fresh
inventory even when its readers inherit parent records. Intentional absence is
not a missing record: for example, reachable code has no `nativeUnreachable`
fact, and a direct operation has no optional-chain fact. Selected false, zero
and empty payloads are present.

Rust's mandatory `records.seal(context.requiredRecords)` performs a linear
presence check over that supplied inventory before closing either the outer
store or selected-operation store. A missing required record raises the existing
analysis invariant at its exact source subject; it cannot reach planning or
materialization. A failed check leaves both stores open. Sealing never walks
source, reruns native selection, derives requirements from existing records or
repairs missing evidence. The old zero-argument seal is not supported.

C# composes the reader families through `createCsharpProgramRecords`, in
`src/analysis/program/records/create.ts`, from its analysis-owned classifications.
Freezing that outer container does not freeze captured maps or prove that every
query has stopped computing. The producers must close their mutable state and
semantic work before the program is published.

Required-record coverage is the same architectural obligation on both targets.
A frozen C# container does not discharge it; the corresponding admission and
seal work must demonstrate its own completed coverage before certification.

The shared rule is immutable semantics after sealing, not a prescribed storage
data structure. A private typed keyed map is permitted. Removing the map is
not a certification gate; preventing cross-layer key access, duplicate owners
and lazy decisions is. Do not replace a sound private map with 66 competing
stores merely to remove its name.

For scoped analysis, local records may override the parent only according to
the original specialization/equality contract. Sealing the child does not copy
the parent program or erase the parent's exact foundation requirements.
Reusing a source node in another analysis context cannot conflate its selected
types or leases with the first context.

Record payloads and referenced collections are published readonly. Their
analysis owner must cease mutation; a readonly TypeScript annotation alone is
not a runtime mutation guard. Sealing must not deep-clone source ASTs or native
payloads to compensate for incorrectly shared construction ownership.

## Producer map

The tables below group the actual family names, not new carrier kinds. Paths
are relative to each target's `src/`. Every listed family requires one semantic
producer owner in the indicated responsibility; helpers may contribute checked
evidence, but may not independently choose its final value. The container is
not a semantic producer merely because it stores that value.

### Rust

Rust exposes 66 native families. The row's analysis responsibility is the
destination for producer consolidation. The skeletal migration retains existing
algorithms and their call sites; the later ownership wave must prove one owner
for every family rather than claiming this table already relocates them.

| Analysis responsibility | Reader families |
| --- | --- |
| `declarations/`, `source-modules/` | `typeAliasDeclaration`, `typeOnlyDeclaration`, `compileTimeSource`, `sourceBinding` |
| `callables/` | `sourceCallableReturn`, `sourceParameterAbi`, `asyncFunction`, `generator`, `sourceCallableValue`, `directCallableReference`, `moduleCallableStorage` |
| `operations/`, with per-construct policy selection | `runtimeCarrier`, `selectedCall`, `selectedOperation`, `targetOperation`, `argumentPassing`, `conversion` |
| `errors/` and suspended-callable analysis | `yield`, `awaitValue`, `resourceManagement`, `futureValue`, `errorEffects`, `sourceErrorEffects`, `deferredProducerEffects`, `awaitSourceErrorEffects`, `fallible`, `sourceCallEffects`, `sourceAccessorEffects`, `genericCallableInvocation` |
| `conversions/` and `expected-types/` | `optionProjection`, `flowReadProjection`, `contextualValueConversion`, `callScopedLifetimeReconciliation`, `projectUpcast`, `projectDowncast`, `propertyProjection` |
| `control-flow/` | `bindingProjection`, `nativeGuardResult`, `nativeUnreachable` |
| `ownership/`, with checked mutation/use evidence | `mutatedBinding`, `mutatedReferent`, `selfMode`, `objectReferenceView` |
| `operations/` | `compoundWrite`, `computedMember`, `preparedOperationResult`, `optionalChain`, `indexedFieldKeyArgument`, `genericNumericOperands` |
| `operations/` native memory | `typedLocationPlan`, `nativeArrayStorage`, `nativeBacking`, `rawLocationPlan`, `memoryBindingPlan`, `rawAddressPlan`, `memoryLayoutObservation` |
| `storage/` with declaration/capture inputs | `bindingStorage`, `capturedFieldStorage` |
| `callables/` | `closureCapture`, `retainedEnvironment`, `retainedCallLifetimes`, `moduleBinding` |
| `project-types/` | `projectCallableAdapters` |
| `objects/` | `objectLiteralMethodAdapter`, `receiverIndependentMethod`, `classValue` |

The mixed rows identify coordinating responsibilities, not permission for two
writers to arbitrate a value after publication. Operation selection belongs to
policy; cross-construct preparation and publication belong to analysis.
`errors/`, `ownership/` and `expected-types/` are required destination roles,
not claims that their complete relocation is part of the initial API migration.

### C#

C# exposes 117 families, grouped by their declaration module under
`target-model/records/`. The analysis column identifies their existing producer
responsibility; consolidation must preserve all compound query arguments.

| Record declaration | Analysis producer responsibility | Reader families |
| --- | --- | --- |
| `attributes.ts` | `attributes/` | `attributeApplication`, `erasedAttribute` |
| `callable-adapters.ts` | `project-types/` | `callableDispatch` |
| `capture-storage.ts` | `callables/` | `captureFrame`, `capturedBinding`, `physicalStorageType`, `captureClosure`, `namedSelf`, `lambdaCreation`, `helperAccess`, `captureFrameShape`, `lexicalValueDeclarations`, `lexicalValueCreation`, `lexicalValueName` |
| `class-factories.ts` | `project-types/` | `classFactory` |
| `class-initialization.ts` | `project-types/` | `requiresClassConstructor`, `relocatedClassField`, `classInitializationRegion` |
| `conversions.ts` | `conversions/` | `propertyProjection`, `delegateAdapters`, `delegateAdapter`, `directCallableReference`, `conversion`, `expressionConversion` |
| `declarations.ts` | `declarations/` | `returnContract`, `runtimeDefault`, `methodWrite` |
| `expected-types.ts` | `expected-types/` | `expectedType`, `requiredExpectedType`, `exactIntegerConversion`, `storageExpectedType`, `callableTarget`, `arrayLiteralCarrier`, `expectedBinary` |
| `module-initialization.ts` | `module-initialization/` | `moduleInitializationDependencies`, `requiresModuleInitializer`, `asyncModuleInitializer`, `callableVisibility` |
| `numeric.ts` | `numeric/` | `int32Remainder` |
| `operations.ts` | `operations/` | `awaitCompletion`, `classPropertyStorage`, `borrowedSequence`, `nativeGuardResult`, `nativeUnreachable`, `memoryBinding`, `operationResultType`, `selectedCall`, `selectedConstruction`, `selectedProperty`, `sourceMember`, `selectedElement`, `binaryOperation`, `switchStatement`, `unaryOperation`, `iteration`, `resource`, `nativePointer`, `typedLocation`, `nativeRefReturn`, `jsCondition`, `jsTypeof`, `typeofRuntimeKind`, `jsVoid`, `jsObjectLiteral`, `jsArrayMutation`, `elementDeletion`, `jsStringConversion`, `providerValue`, `regularExpression`, `throwable`, `throwValue`, `exactCatchRethrow` |
| `safety.ts` | `safety/` | `sourceSafetyApplication`, `safetyApplication`, `safetyOperation` |
| `source-evidence.ts` | `source-evidence/`, with declaration/type/callable inputs | `bindingProjection`, `closedArrayStorage`, `compileTimeMetadata`, `nodeTargetType`, `classConstructorType`, `storageTargetType`, `readStorageTargetType`, `expressionType`, `contextualType`, `contextualTargetType`, `semanticTargetType`, `semanticType`, `signatureDeclaration`, `contextualTuple`, `constantValue`, `valueRefinement`, `generator`, `generatorTargetType`, `yield`, `yieldTargetType`, `wellKnownSymbol`, `inferredCallableReturnType`, `pointerReturn`, `sourceArgument`, `sourceDefaultValue`, `sourceField`, `sourceStruct`, `providerVirtualDeclaration`, `typeParameterConstraints`, `sourceOwnedProjectShape` |
| `source-modules.ts` | `source-modules/` | `sourceModuleConstruction` |
| `storage.ts` | `storage/` | `nativeModuleField`, `nativeLocation`, `nativeArray`, `nativeField`, `nativeBacking`, `storageType`, `requiredStorageType`, `lambdaParameterType`, `typedLocationIdentity` |
| `type-projections.ts` | `declarations/` | `genericProjection`, `outerGenericProjection` |

The corresponding materializers are listed below. These are the actual
analysis entry points composed by `analysis/program/analyze.ts`, not new
registry callbacks. Their complete dependency closure must obey the boundary;
an entry point in analysis does not legalize a mutable policy dependency.

| Record group | Current materializing owner, relative to `analysis/` |
| --- | --- |
| Attributes | `attributes/application-index.ts:analyzeCsharpAttributeApplications` |
| Callable adapters | `project-types/callable-adapters.ts:analyzeCsharpProjectCallableAdapters` |
| Captures | `callables/capture-storage.ts:analyzeCsharpCaptureStorage` |
| Class factories | `project-types/class-factories.ts:analyzeCsharpClassFactories` |
| Class initialization | `project-types/class-initialization.ts:analyzeCsharpClassInitialization` |
| Conversions | `conversions/analyze.ts:analyzeCsharpConversions`, then its sealed classifications |
| Declarations | `declarations/analyze.ts:analyzeCsharpDeclarations` |
| Expected types | `expected-types/analyze.ts:analyzeCsharpExpectedTypes` |
| Module initialization | `module-initialization/analyze.ts:analyzeCsharpModuleInitialization` |
| Numeric representations | `numeric/representations.ts:analyzeCsharpNumericRepresentations` |
| Operations | `operations/analyze.ts:analyzeCsharpTargetOperations` |
| Safety applications | `safety/application-index.ts:createCsharpSafetyApplicationFactIndex` |
| Source evidence | `source-evidence/analyze.ts:analyzeCsharpSourceEvidence` |
| Source module construction | `source-modules/analyze.ts:analyzeCsharpSourceModuleConstructions` |
| Storage | `storage/analyze.ts:analyzeCsharpStorage`, finalized by `storage/seal.ts:sealCsharpStorage` |
| Generic projections | `declarations/type-projections.ts:analyzeCsharpTypeProjections` |

An analysis module that delegates to an unfinished demand worklist in policy is
not yet the final owner. Native construction demand, expected-type propagation,
capture analysis and sealed conversions must satisfy the same boundary even
when their initial containers already have typed getters.

## What consumers may do

A policy consumer reads records through its readonly `policy/model/` port to
select one construct. A planner reads the admitted native form and translates
it to syntax. Both may perform pure structural projections over immutable
vocabulary. Neither may construct a record, rebuild the checker, rediscover
members by name or inspect generated syntax to repair an earlier decision.

For example, a read of a narrowed union consumes the selected physical payload
projection. The planner must not clone every variant and inspect the clone to
find its type. A numeric result consumes its selected integer or floating
carrier; the printer must not introduce a compensating float round trip.

Pure queries are not automatically lazy analysis. Reading an already-built
lifetime map, comparing exact native type identities or selecting a tuple
element from a sealed payload is permitted. Computing ownership, fallibility,
reachability, contextual result types or storage closure for the first time
after sealing is not. The call graph and data ownership determine the boundary,
not the helper's name or a `get` prefix.

Source errors must be produced before sealing. A missing required record at
planning time is an internal compiler invariant failure, not a user-facing
source restriction or a license to choose a fallback. Admission and negative
tests must establish which records are required for each accepted construct.

## Verification obligations

The skeleton checkpoint must prove identical payload shapes, equality rules,
subject identities, ordered dependencies, scoped lookup, foundation demand and
existing acceptance predicates after the mechanical API migration. The
original public source-fact reads remain separate. Unchanged inherited failures
must be recorded as failures, not a passing certification.

The completed boundary additionally requires:

1. Every reader uses the family API; no consumer imports a private key or builder.
2. Only analysis constructs records; each family has one final semantic owner.
3. A sealed writer cannot mutate, including through captured writer references.
4. Scoped override/fallback, conflicting evidence and context-distinct subjects
   have positive and negative tests.
5. Planners and syntax normalization make no ownership, error-channel,
   reachability or source-admission decisions.
6. Native output and execution remain correct for both targets and downstream
   acceptance programs; generated-code shape alone is not certification.
7. Getter and publication costs introduce no unnecessary copies, tuple keys,
   repeated graph walks or full-program clones. Measure analysis scaling and
   generated native costs separately.

The architecture checker enforces imports, exact ownership and mutation
boundaries. It must reject a disguised competing reader or mutable port, not
pass merely because identifiers were renamed. The private backing store is an
implementation detail, never an independent source of semantic authority.

## Related contracts

- [Workspace policy](workspace-agent-policy.md)
- [Compilation lifecycle](compilation-lifecycle.md)
- [Shared source-storage design](source-storage-design.md)
- [Ownership and result-use contract](ownership-contract.md)
- [JS-surface carriers](js-surface-carriers.md)
- [C#/Rust structural symmetry](csharp-rust-structure.md)
