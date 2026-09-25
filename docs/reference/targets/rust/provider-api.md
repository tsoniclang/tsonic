# Rust provider API

Provider packages import `@tsonic/target-rust/provider` and use
`createRustProviderPackage`.

The public contract includes:

- virtual source modules and exact export declarations;
- identity-keyed type and operation rows;
- Rust target type, callable, closure, collection, option, promise, and broad
  value carriers;
- exact argument/result conversions;
- type, lifetime, const, and associated-type requirements;
- fallibility and error-boundary contracts;
- evaluation purity policy;
- Cargo crate contributions and minimum foundations;
- module aliases, source dependencies, binary epilogues, and immediate
  callback definitions.

## Exact operation row

```text
source identity
  provider/module/export/member/signature
          |
          v
Rust operation row
  target form + carriers + conversions + fallibility + evaluation
          |
          v
Cargo contribution
  crate path + features + minimum foundation
```

Concrete API names exist only in provider data. Generic selection compares
exact identities and requirements; it does not branch on `HashMap`, `readFile`,
or a package spelling.

## Package shape

A provider package normally contains:

```text
package/
├── package.json
├── src/
│   ├── index.ts          # plugin entrypoint
│   └── provider/
│       ├── package.ts    # capability composition
│       └── modules/      # declarations and exact native mappings by module
└── crates/               # runtime crate, when one is required
```

The source model must be legal TypeScript declaration syntax. Rust paths,
receivers, ownership, fallibility, foundation, and Cargo dependencies live in
the Rust target model. Matching source and Rust spellings never replaces an
explicit identity.

### Borrowed string arguments

A native function taking `&str` can select
`rustStringToBorrowedStrValueConversion` from the public provider entrypoint.
Set its argument mode to `"value"`: the conversion already produces the shared
view. A `String` input becomes `value.as_str()` without copying its contents;
an existing string view stays borrowed. The source carrier must be exactly
`rustStringTargetType()`.

This is different from a generic native `&T` argument where `T` is `String`.
That argument uses mode `"ref"` without the conversion and retains `&String`.
For example, `statSync(path)` may take a string view, while
`names.includes(path)` must preserve the collection's selected element type.

## Compilation lifecycle

1. The host discovers the installed package.
2. The provider snapshots immutable configuration, Cargo, and toolchain input.
3. Requested imports produce exact virtual declaration closures.
4. Source checking selects declarations and signatures.
5. Rust analysis closes carriers, ownership, lifetimes, errors, foundations,
   and crate requirements.
6. Planning consumes the sealed result and emits Rust AST nodes.

The provider must not inspect generated Rust, re-enter the checker during
planning, or recover an item from source spelling.

## Object-literal construction

A provider-backed interface accepts an object literal only when its type row
opts into a closed construction policy and every authored field resolves to
exact readable/writable native member rows. Default completion is legal only
when the provider explicitly supplies that construction contract.

## Generic parameter boundaries

Integer const arguments retain their exact values, including values larger than
a JavaScript number can represent. Use bigint literal syntax for those values:

```ts
import { Token, makeToken } from "@tsonic/rust/crates/example/index.js";

const token: Token<9007199254740993n> = makeToken<9007199254740993n>();
```

The Rust const parameter still determines the permitted native type and range.
The bigint suffix is source syntax; it does not allocate a runtime bigint.
Provider declaration models represent an exact bigint literal as
`{ kind: "bigint-literal", value: "9007199254740993" }`.
The value is canonical signed decimal text without a suffix, leading zeros or
positive sign. Validation rejects malformed text before declaration rendering.
Ordinary numeric literals and bigint literals remain distinct checker types.

Provider operation rows preserve whether a Rust type parameter accepts
unsized arguments:

```ts
genericParameters: [
  { kind: "type", sourceName: "Q", maybeSized: true },
]
```

`maybeSized: true` represents an exact Rust `Q: ?Sized` declaration. Omit the
field for an ordinary type parameter, whose Rust contract includes the implicit
`Sized` bound. This distinction lets a borrowed native string use `str` only
when the selected Rust API permits it; it is not inferred from a method name or
argument spelling.

## Evaluation and errors

Provider operations are observable by default. `evaluation: "pure"` is legal
only when repetition with stable inputs is observably identical and no input
is writable. Fallibility is independent: the selected row supplies the error
boundary and generated Rust uses the closed `Result` path. The planner never
infers purity or fallibility from a Rust path.

A pure, infallible length property implemented as a receiver method may declare
`emptyTestMethod: "is_empty"` on its `receiver-method` form. This is an explicit
provider promise that the zero-argument method tests whether that unsigned
length is zero. The contract requires a synchronous native unsigned result,
identity result conversion, and no writable receiver or additional inputs.
The target can then emit `value.is_empty()` for a comparison with zero. It never
guesses this relationship from names such as `len` or `length`.

## Minimum proof

A provider change is complete only when tests prove:

- legal source declarations and exact import/export identity;
- positive and negative selection, including aliases and generic items;
- emitted Rust for every added operation;
- Cargo compilation with exact dependencies and minimum foundation;
- runtime behavior when the operation is executable;
- deterministic rejection for missing, ambiguous, or contradictory evidence.
