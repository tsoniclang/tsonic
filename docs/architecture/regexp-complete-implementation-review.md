# Complete ECMAScript RegExp Implementation Review

Date: 2026-08-23  
Branch: `feat/regex-complete-20260822`  
Isolated root: `/home/jeswin/worktrees/regex-complete-20260822`

## Review Purpose

This packet records the complete RegExp implementation boundary, every supporting non-RegExp edit, the architectural justification for each edit class, the proof matrix, and the merge checklist. It is a review artifact, not a second product contract.

The implementation goal is:

> TypeScript programs using the standard ECMAScript `RegExp` and string/RegExp protocol surface must retain exact TypeScript-selected meaning and execute with matching observable semantics on C# and Rust, without checker re-entry, spelling inference, subset fallbacks, or dual runtime paths.

## Representative Source

```ts
const expression = /(?<word>\p{Letter}+)/dgu;
const seen = expression.exec("A😀B");
const rewritten = "A😀B".replace(
  expression,
  (match, word, offset, input, groups) =>
    `${groups.word}:${offset}:${input.length}`,
);
const all = [..."A😀B".matchAll(expression)];
```

The source checker selects the exact RegExp constructor/member/string-protocol declarations. Targets consume that evidence and lower to their target runtime. Neither target rediscovers the operation from `exec`, `replace`, `matchAll`, an import name, or receiver spelling.

## End-to-End Architecture

```text
TypeScript source
      |
      v
TSTS Legacy parser/checker
  - exact authored RegExp literal syntax
  - selected call/property/well-known-symbol evidence
  - exact source receiver, arguments, result, and callback types
      |
      v
Canonical @tsonic/js-source-profile declarations and identities
  - one source contract for C# and Rust
      |
      +------------------------------+
      |                              |
      v                              v
C# target analysis/policy       Rust target analysis/policy
  - closed target carriers        - closed target carriers
  - selected member rows          - selected operation facts
  - callback adaptation           - callback ABI adaptation
      |                              |
      v                              v
C# target plan                  Rust target plan
      |                              |
      v                              v
Tsonic.CSharp.Js RegExp         tsonic_rust_js RegExp
QuickJS-derived engine          vendored regress engine
      |                              |
      +---------------+--------------+
                      |
                      v
              executable proof
```

## Semantic Coverage

| Area | Required observable behavior |
| --- | --- |
| Construction | call/construct forms, RegExp input identity where ECMAScript requires it, flags override, source normalization |
| Flags | `d g i m s u v y`, canonical flag order, duplicate/unknown/incompatible flags rejected |
| Matching | `exec`, `test`, global/sticky `lastIndex`, empty-match advancement, UTF-16 code-unit indices |
| Results | indexed captures, optional captures, named groups, `indices`, named indices, input and index |
| Strings | `match`, `matchAll`, `replace`, `replaceAll`, `search`, `split` |
| Replacement text | `$$`, `$&`, `$\``, `$'`, numbered and named captures |
| Replacement callbacks | exact positional JS arguments adapted from the runtime vector; callback errors remain in the source-program error domain |
| Protocols | exact selected `Symbol.match`, `matchAll`, `replace`, `search`, `split`, and `species` evidence |
| Grammar | modern Unicode/property/set/named-capture/lookaround/backreference behavior covered by runtime vectors and acceptance corpus |
| Safety | bounded compile/execution resources, deterministic syntax/type errors, no catastrophic unbounded fallback |
| State | compiled program reuse does not share mutable `lastIndex` or match state |

## Per-Repository Inventory

| Repository | Product purpose | Main change classes |
| --- | --- | --- |
| `tsts-legacy` | Target-neutral source evidence | Public RegExp-literal syntax accessor; complete well-known-symbol evidence inventory; neutral checker tests |
| `tsonic` | Shared host/source contract | Canonical `@tsonic/js-source-profile`; package/build wiring; vendored TSTS artifact refresh; profile contract tests |
| `tsonic-csharp` | C# target analysis and planning | Exact profile member selection, RegExp/string protocol lowering, callback/object-shape carriers, source-member keys, C# integration proofs |
| `csharp-js` | C# JS runtime | Complete RegExp protocols/results plus QuickJS-derived compiler/interpreter and Unicode data; old subset validator removed |
| `tsonic-rust` | Rust target analysis and planning | Exact selected-evidence operations, result-carrier reconciliation, callback adaptation, RegExp protocol lowering, Rust AST/printer support |
| `rust-js` | Rust JS runtime | UTF-16 `JsString`, complete RegExp protocols/results, vendored `regress`, fallible callback error-domain preservation; old parser/VM removed |
| `proof-is-in-the-pudding` | C# executable acceptance | Complete RegExp proof project |
| `rust-pudding` | Rust executable acceptance | Symmetric complete RegExp proof project |
| `tsumo` | C# downstream consumer | Consume canonical JS source-profile package only |
| `tsumo-rust` | Rust downstream consumer | Consume canonical JS source-profile package only |

No Node runtime/provider repository is changed by this branch.

## Supporting Changes Outside the Runtime Regex Engines

These are the complete non-engine change classes. They are not unrelated feature work.

| Change class | Files/layer | Why RegExp requires it | Scope decision |
| --- | --- | --- | --- |
| Canonical JS source profile | `tsonic/packages/js-source-profile/**` | Both targets need one legal TypeScript declaration and identity contract for RegExp, result objects, strings, and symbol protocols | Required shared abstraction |
| Complete well-known-symbol evidence | `tsts-legacy/.../source-control-flow-evidence.ts` | Protocol dispatch must use checker-selected symbol identity, not names such as `replace` | Required generic evidence closure; all already-public provider symbol identities are covered |
| RegExp literal syntax accessor | `tsts-legacy/.../ast-reader.ts` | Literal pattern/flags are authored values needed for target construction; access stays behind the public AstReader | Required neutral schema accessor |
| Source-member keys | C# and Rust target model/policy files | String names and well-known symbols occupy different identity domains; named groups and computed protocol members cannot collapse | Required generic target identity model |
| Object-shape and expected-type propagation | C# target analysis/planner files | Callback groups and RegExp result objects carry exact optional/named members through contextual callbacks and destructuring | Required closure of existing object-shape abstraction |
| Exact provider result carriers | Rust analysis/fact files | `RegExp` and `String` operations can select the same source type but return different closed runtime carriers; future values must preserve the selected carrier | Required generic correctness fix exposed by RegExp |
| Callback adapters | C# and Rust callable/conversion files | Source callbacks are positional while runtime protocol entry points use one closed argument-vector representation | Required at target boundary; source callback is evaluated once |
| Caller error-domain preservation | `rust-js/src/{regexp,string}.rs` and Rust target fallibility | Generated callbacks return `TsonicResult<T>`; runtime-owned RegExp errors must convert outward while callback errors remain unchanged | Required generic fallible-callback contract |
| Rust expression/printer support | Rust target AST and printer files | Callback adapters and existing generated expressions need semantic AST nodes and rustfmt-stable rendering | Kept only where semantics-free and regression-proved |
| UTF-16 `JsString` propagation | `rust-js` runtime-wide string consumers | ECMAScript RegExp offsets, captures, astral behavior, string slicing, and replacement are UTF-16 code-unit semantics, not Rust UTF-8 byte offsets | Required runtime-wide representation closure; no dual string path retained |
| Package/build wiring | package manifests, build scripts, vendored TSTS dist | All source-profile and runtime contracts must be present in packed artifacts, not only source checkouts | Required product/package closure |
| Downstream dependency refresh | Tsumo package manifests only | Downstream consumers must resolve the canonical source profile selected by both targets | Required dependency-only update; no Tsumo source behavior changed |

## Why Planner Changes Are Necessary

Runtime replacement callbacks receive one closed vector:

```rust
Fn(JsArray<JsValue>) -> Result<JsString, E>
```

TypeScript callback source is positional:

```ts
(text, capture, offset, whole, groups) => replacement
```

Target planning therefore emits a target-owned adapter approximately equivalent to:

```rust
{
    let replacement_callback = source_callback;
    move |arguments| replacement_callback.call((
        regexp_replacement_argument_string(&arguments, 0),
        regexp_replacement_argument_value(&arguments, 1),
        regexp_replacement_argument_number(&arguments, 2),
        regexp_replacement_argument_string(&arguments, 3),
        regexp_replacement_argument_groups(&arguments, 4),
    ))
}
```

This is target ABI adaptation, not semantic reconstruction. The selected callback signature and every source parameter type come from finalized source evidence. The source callback expression is evaluated exactly once before capture.

The C# target performs the equivalent adaptation to its closed delegate/runtime protocol shape.

## Why Generic Printer Changes Are In Scope

A planner must allocate semantic target AST, never concatenate target source. The Rust printer then renders that AST.

The required printer fix changes only indentation depth for a multiline trailing block/match/conditional call argument on a vertically continued call. Without it, semantically valid RegExp callback adapters fail `cargo fmt --check`. The regression uses generic Rust AST and does not mention RegExp behavior.

This is the correct abstraction boundary:

```text
planner: block + binding + closure + call
printer: indentation and delimiters only
rustfmt: accepted canonical source
```

## Explicitly Rejected Paths

The branch contains no intentional path that:

- re-enters the checker from C# or Rust to select a source operation;
- selects RegExp behavior by receiver, import, method, property, or target spelling;
- parses raw TS-Go object fields outside the public AstReader;
- preserves the retired C# validator or Rust parser/VM as a compatibility path;
- falls back from complete RegExp semantics to a subset;
- suppresses unsupported operations or broad-catches checker/runtime errors;
- moves the RegExp parser into either target planner;
- changes Tsumo application source;
- modifies C#/Rust Node capability packages;
- changes Python or GPU targets.

Names used after exact identity selection are emission keys or diagnostics, not operation-selection evidence.

## Engine Provenance

### C#

The C# runtime engine is a mechanically isolated QuickJS-derived RegExp compiler/interpreter under:

`src/Tsonic.CSharp.Js/RegExp/Engine/QuickJs/**`

`UPSTREAM.md` records provenance. Tsonic-owned protocol, result, resource-limit, and host-string layers surround the engine. The retired subset validator is deleted.

### Rust

The Rust runtime vendors the `regress` engine under:

`crates/regress/**`

`UPSTREAM.md` and upstream licenses are included. Tsonic-owned UTF-16, result/protocol, replacement, state, error, and resource layers provide the ECMAScript contract. The retired local parser/VM is deleted.

## Proof Design

The C# and Rust proof projects execute unchanged TypeScript-level behaviors rather than target-specific unit fixtures. They cover:

- literal and dynamic construction;
- call versus construct identity/state;
- all flags and invalid combinations;
- captures, optional captures, named groups, and indices;
- global/sticky state and empty matches;
- replacement strings and callbacks;
- `match`, `matchAll`, `replace`, `replaceAll`, `search`, and `split`;
- Unicode/UTF-16 behavior;
- fail-closed invalid grammar;
- emitted target formatting/build/execution.

Runtime suites add engine acceptance corpus, Node oracle vectors, resource limits, compiled-program reuse, and callback error-domain mutation proofs.

## Validation Record

### Completed before final branch certification

| Gate | Result |
| --- | --- |
| TSTS Legacy source/Porter/harness/corpus | Green; full 15,626-case corpus: 12,820 pass, 0 fail, 2,806 explicit policy skips, 0 comparable-artifact mismatches |
| C# Proof Pudding | 48/48 tasks, 0 failures |
| C# JS runtime | 732/732 |
| Rust JS runtime after fallible-callback fix | `cargo test --workspace`: all executable tests green; 201 non-doc tests plus 14 passing upstream doctests; one upstream ignored doctest |
| Focused Rust target policy/printer | policy 3/3; printer 4/4 |
| Focused Rust RegExp proof | generation, `cargo fmt --check`, `cargo check`, `cargo clippy -D warnings`, and execution all pass |

### Final certification to append before merge

The branch must not be presented as complete until the final bounded target/runtime/proof gates are recorded here. Known failures outside the RegExp boundary must be listed exactly and must not be relabeled green.

## Review Checklist

- [ ] Every repository is on `feat/regex-complete-20260822`.
- [ ] Every edit is under the isolated worktree root.
- [ ] Product diffs match the inventory above.
- [ ] No compatibility or dual RegExp engine remains.
- [ ] Exact selected evidence controls every target operation.
- [ ] Callback source evaluates once and callback failures preserve their original error domain.
- [ ] UTF-16 offsets and captures are proved.
- [ ] Both proof projects execute the complete RegExp project.
- [ ] Build/package artifacts include the source profile and runtime engines.
- [ ] Bounded final certification is recorded with exact counts.
- [ ] All branch worktrees are clean and pushed before PR review.

