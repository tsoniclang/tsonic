# Mojo limitations

Mojo is a separate target with its own native constraints. Equal placement in
the documentation does not mean identical capabilities or release status.

| Boundary | Current effect |
| --- | --- |
| Public installation | The target is not published on npm; use the source workspace. The public project creator currently covers C# and Rust. |
| Toolchain/platform | The target pins Mojo `1.1.0.dev2026083005` and Linux x86-64. Other versions/platforms are not implied to work. |
| Generators and native async iteration | Not a complete supported lowering. |
| Layout-backed raw memory | `toRawPointer` and `reinterpretRawPointer` are not implemented by this target. Shared layout facts alone do not prove storage or lifetime. |
| Imported native variadic APIs | A reproduced native Mojo String-forwarding defect remains an upstream compiler issue. |
| Native provider metadata | Missing ownership, origin or ABI evidence causes rejection rather than a guessed call. |

For example, this source must not be assumed to work merely because ordinary
loops work:

```ts
function* ids() {
  yield 1;
}
```

Likewise, a shared pointer marker being declared does not certify Mojo's native
storage implementation. Callers must satisfy the selected target's contract.

Owned JS/Node collection operations use explicit list-packed arguments where
their providers declare that ABI. This avoids the variadic-forwarding path for
those operations; it does not fix or silently rewrite imported variadic APIs.

See also [shared limitations](../../limitations.md), which apply before a target
is selected.
