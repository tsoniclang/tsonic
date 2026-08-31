# Diagnostics

Tsonic diagnostics identify the owner that rejected a contract.

```text
ERROR <source>:<code> <file>:<line>:<column>: <message>
  evidence: <entry>
```

## Owners

| Source | Meaning |
| --- | --- |
| `tsts` or `TS####` | TypeScript parsing/checking diagnostic |
| extension id | Source-semantic extension diagnostic |
| `tsonic-host` | Project, plugin, or host orchestration diagnostic |
| target pack id | Target analysis, planning, artifact, or toolchain diagnostic |
| capability id | Capability declaration or runtime contribution diagnostic |

## Fail-closed behavior

For this source:

```ts
unknownApi(value);
```

Tsonic does not generate a best-effort target call. If TSTS cannot select a
valid source declaration, checking fails. If source selection succeeds but the
target lacks an exact operation, the target reports its own unsupported
contract. No artifact from the rejected target is published.

## Artifact diagnostics

Artifact reconstruction may report invalid, blocked, open, oscillating, or
budget-exceeded contracts. These are compiler consistency failures, not partial
build success. A blocked artifact cannot be published merely because an older
revision exists internally for rollback.

## Toolchain diagnostics

Tsonic reports target-toolchain failures with the target owner. Native compiler
output remains the authoritative explanation for invalid generated target code
or native project configuration.

## Reading a diagnostic

Work from left to right:

1. **Owner:** which compiler, extension, target, or capability rejected.
2. **Code:** the stable diagnostic family to search for.
3. **Source span:** the authored location when one exists.
4. **Message:** the rejected contract.
5. **Evidence:** exact selected identities or policy facts used by the owner.

Do not fix a target diagnostic by changing unrelated TypeScript spelling. For
example, a missing provider relation requires the provider or target contract
to be corrected; renaming the method cannot create semantic identity.

See the task-oriented [troubleshooting guide](../manual/troubleshooting.md).
