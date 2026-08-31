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

## Object-literal construction

A provider-backed interface accepts an object literal only when its type row
opts into a closed construction policy and every authored field resolves to
exact readable/writable native member rows. Default completion is legal only
when the provider explicitly supplies that construction contract.

## Evaluation and errors

Provider operations are observable by default. `evaluation: "pure"` is legal
only when repetition with stable inputs is observably identical and no input
is writable. Fallibility is independent: the selected row supplies the error
boundary and generated Rust uses the closed `Result` path. The planner never
infers purity or fallibility from a Rust path.
