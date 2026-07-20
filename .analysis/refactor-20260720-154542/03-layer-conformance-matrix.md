# 03 — Layer-Conformance Matrix

Date: 2026-07-20. Status: source-audit seed; it is not a complete feature
inventory. Cleanup step 1 replaces these hand-maintained rows with a matrix
generated from the canonical inventory (`02-feature-inventory.md`).

## Matrix Schema

| Column | Meaning |
|---|---|
| L1 | compiler-owned source decision required by the feature, or `n/a` when the row concerns only target/runtime behavior |
| L2 | extension evidence transports the L1 decision exactly; the fact mechanism does not own Layer-3/4 meanings |
| L3 | shared Tsonic capability/composition role, including source-core and cross-feature analyses |
| L4 | specific provider/surface/target/backend/runtime policy and implementation |
| Verdict | `conformant` · `drift` (layer violation) · `unclassified` |
| Drift | section in `04-drift-inventory.md` |

Symbols: ✓ conforms · ✗ violates · `gap` missing required contract · `?`
unmeasured · — not applicable. A violation is recorded in the layer where the
bad behavior occurs; the existence of a lower-layer violation does not imply
that the compiler layer itself failed.

## Product-Level Conformance

| Area | L1 | L2 | L3 | L4 | Verdict | Drift |
|---|---|---|---|---|---|---|
| Host composition (`compileProject`) | — | — | ✗ two semantic paths, syntax-based runtime activation | — | drift | §2 |
| Module ownership model | — | — | ✗ ambiguous `specifierPrefix` | — | drift | §3 |
| Backend compile input (`TargetCompileInput`) | — | — | ✗ exposes checker-like escape hatch | — | drift | §4 |
| Fact authority (standard vs C#) | — | ✓ standard selection/fact framework exists | — | ✗ duplicate authority for some meanings; 19 keys require individual classification | drift | §5 |
| Plugin contribution envelope | — | — | ✗ correct generic hook exists, but preparation, owner stamping, payload validation, and conflict handling are incomplete | — | drift | §13 |
| Source-core extension | ✓ selected source evidence exists for exact producers | ✓ producer API direction is sound | ✗ re-export identity is checked by source spelling; struct fact subjects and builder identities are not exact enough | — | drift | §14 |
| Target toolchain config boundary | — | — | — | ✗ semantic provider inputs and native MSBuild knobs are not classified by owner | drift | §15 |
| Runtime artifact closure | — | — | ✗ open strings, weak dedupe | — | drift | §16 |

## Feature-Level Conformance

### Node.js provider family

| Feature | L1 | L2 | L3 | L4 | Verdict | Drift |
|---|---|---|---|---|---|---|
| `node:fs` calls (e.g. `readFileSync`) | ✓ overload selected by TSTS | ✓ selected evidence consumed | ✓ routed via contribution | ✗ custom fact recorded on second observation | drift | §5 |
| Property/element contributions | ✓ selected declaration evidence exists | ✓ evidence transport exists | ✓ generic contribution route | ✗ custom fact authority, receiver-type fallback, fabricated callable-property operation | drift | §5, §12 |
| Provider identity/aliases | ✓ checker identity exists | ✓ provider declaration fact exists | ✓ generic route | ✗ alias normalization rewrites contradiction; duplicate metadata overwrite | drift | §12 |
| Node runtime: `path.normalize` | source declaration check only | ? | ? | ✗ `Path.GetFullPath` returns absolute path | drift | §18 |
| Node runtime: `Buffer.slice/subarray` | source declaration check only | ? | ? | ✗ copies instead of sharing storage | drift | §18 |
| Node runtime: `realpathSync` | source declaration check only | ? | ? | ✗ not Node realpath semantics | drift | §18 |
| Node runtime: `path.posix`/`path.win32` | source declaration check only | ? | ? | ✗ shared host-dependent behavior | drift | §18 |
| Node runtime: `URL` | source declaration check only | ? | ? | ✗ delegates to `System.Uri` | drift | §18 |
| Node runtime: `process.versions` | source declaration check only | ? | ? | ✗ fabricated | drift | §18 |
| Node provider: `http` `IncomingMessage.readAll()` | — | — | — | ✗ invented API | drift | §18 |
| Node runtime: `assert` deep equality | source declaration check only | ? | ? | ✗ serializes arbitrary objects, CLR equality fallback | drift | §18 |

### JS surface family (csharp-js runtime)

| Feature | L1 | L2 | L3 | L4 | Verdict | Drift |
|---|---|---|---|---|---|---|
| `TsValue` / object carrier | — | — | — | ✗ finite top-level tags contain recursively unvalidated `object` payloads | drift | §17 |
| Property/object protocol (`Object.cs`) | — | — | — | ✗ partial | drift | §17 |
| Number coercion/formatting | source operation checked | ? | selected JS surface | ✗ CLR-based, e.g. `(1e20).toString()` | drift | §17 |
| Union arm selection (`TsUnion`) | source union checked | ? | selected JS surface | ✗ heuristic target/runtime arm selection | drift | §17 |
| Array identity (`Array`/`JSArrayStatics`) | source operation checked | ? | selected JS surface | ✗ storage tracks holes, but typed reads collapse absent/hole to `default(T)` | drift | §17 |
| Typed-array views (`Int8Array` etc.) | source operation checked | ? | selected JS surface | ✗ `subarray` copies storage | drift | §17 |
| `JSON` | — | — | — | ✗ closed dispatch exists, but position/context semantics are incomplete | drift | §17 |
| `Map`/`Set` iterators | source operation checked | ? | selected JS surface | ✗ mutation-invalidating CLR enumerators | drift | §17 |
| `Date` | source operation checked | ? | selected JS surface | ✗ `DateTimeOffset` as semantic state; bad date finite sentinel | drift | §17 |
| `RegExp` closed subset | source operation checked | ✓ selected operation contract | selected JS surface | ✓ validator rejects unsupported syntax and Node oracle covers the admitted subset | conformant | — |
| Timers | — | — | — | ✗ concurrent CLR timers | drift | §17 |
| `Promise<T>` → `Task<T>` | source Promise operation checked | ? | selected JS surface | carrier choice accepted; operation-level equivalence not inventoried | unclassified | §17 |
| Array carrier lifecycle policy | ✓ checker owns selected operations | ✓ retained-operation lifecycle exists | ? portable use summary not yet separated | ✗ order-dependent target policy reads | drift | §7 |
| Object-shape processing | ✓ checker structural evidence exists | gap/existing evidence use must be inventoried | ? shared shape analysis not isolated | ✗ multi-walk target fan-out across nodes/symbols/types/side indexes | drift | §7 |

### C# semantics and backend

| Feature | L1 | L2 | L3 | L4 | Verdict | Drift |
|---|---|---|---|---|---|---|
| Target type from expression | checker type exists | evidence gap or ignored evidence to classify | — | ✗ reconstructed from syntax | drift | §6 |
| `new` constructed type | selected constructed type exists | evidence gap or ignored evidence to classify | — | ✗ reconstructed from syntax | drift | §6 |
| Member selection declaration fallback | selected declaration exists when checking succeeds | gap/ignored selected evidence | — | ✗ declaration rediscovery | drift | §6 |
| Argument matching | selected parameter slots exist | exact binding/slot contract exists for checked calls | — | ✗ exact bindings are flattened to positional arrays and rematched to target parameters | drift | §6 |
| Type-candidate preference | compiler/source facts exist | provenance contract incomplete | — | ✗ "non-array wins" | drift | §6 |
| Provider overload-group identity | provider-selected signature exists | provider fact exists | — | ✗ inferred from encoded strings | drift | §6 |
| Target protocol policy (`Length`/`Count`, indexer `Item`) | selected source identity exists | exact evidence exists or needs a named contract gap | — | ✗ target policy is duplicated and `Item` is inferred as a convention instead of selected metadata | drift | §8 |
| Backend as semantic front end (type recursion, ownership inference, base-receiver class-name search, BigInt, JSON protocol, exception wrapping, attribute lookup by string, struct-marker reparsing) | source meaning belongs here | evidence/plans incomplete | shared envelopes incomplete | ✗ backend reselects semantics instead of lowering syntax | drift | §9 |
| Shadow TSTS AST contract (`source-ast-*` mirrors/casts/kinds) | compiler syntax exists | gap where public AstReader accessors are absent | — | ✗ C# mirrors raw compiler shape | drift | §10 |
| Semantic cache and side-index ownership | — | fact framework is scoped and transactional | ✗ semantic host cache omits composition context | ✗ object-shape side index is outside fact rollback/sealing | drift | §11 |
| .NET provider (slice kinds, type-expression traversal, validation, `unknown` traversal) | provider declarations are compiler inputs | ✓ provider-declaration framework exists | — | ✗ producer/validator loses exactness | drift | §12 |
| Attribute builder state (string parameter, raw expressions, shared fact) | selected call/member evidence exists | ✓ exact producer API exists | ✗ source-core state lacks final identity precision | target consumer receives weak payload | drift | §14 |

### Cross-Cutting Proof Infrastructure

Proof infrastructure is outside the four product layers; it verifies them.

| Mechanism | Current state | Verdict | Drift |
|---|---|---|---|
| Ledger rows 320 `complete` / 328 | 10 positive + 9 negative evidence paths nonexistent | drift | §19 |
| Old-suite inventory | discovery partly derives from its classification source | drift | §19 |
| Architecture scanners | whole-file/count-based blessings remain | drift | §20 |

## Reading The Matrix

- An L1 `✓` with an L4 `✗` means the checker made the decision but the target
  ignored or could not consume it. Fix the L2 exposure/lifecycle if missing,
  then delete the L4 reconstruction.
- An L2 `gap` requires a neutral TSTS contract. It does not authorize target
  inference.
- Any ✗ in L3 means a generic envelope is missing or bypassed; the fix is one
  shared contract, not another special case.
- Any ✗ in L4 means policy is expressed as algorithm branches or the backend
  acts as a semantic front end; the fix is declarative rows/finalized plans
  plus ordinary syntax lowering that makes no new semantic selection.
- Conformant rows whose descriptions state a closed subset or other limit stay
  conformant only while tests enforce that exact limit
  (`06-tests-scanners-acceptance.md`).
