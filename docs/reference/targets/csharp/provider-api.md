# C# provider API

Provider packages import `@tsonic/target-csharp/provider` and compose their
capability with `createCsharpProviderPackage`. The public contract contains:

- package composition, module ownership and source-provider registration;
- C# target type and member models;
- target type factories and render shapes;
- primitive, string, void, nullable, delegate, task, JS, and broad-value
  carrier factories;
- exact provider relation and rejection catalogs;
- provider source identity, member, signature, parameter, receiver, and type
  parameter relations;
- value conversion and type-parameter substitution helpers;
- provider policy contributions and binary execution drivers;
- extern-alias application;
- the provider contract version.

## Exact relation example

A provider declaration and target member need not share a name. The provider
states their relation explicitly:

```text
provider identity
  module = @acme/source
  export = Counter
  member = increment
  signature = increment(int32)

target member
  containing type = Acme.Native.Counter
  name = Advance
  parameter = System.Int32
```

Aliases create multiple relations to one target member. Overloads create
relations from one provider member to multiple target signatures. Staticness,
generic arguments, parameter modes, conversions, and result carriers are
independent fields and must agree wherever both sides supply them.

Providers must not attach target-specific fields to closed TSTS values. They
publish only through the C# target's public relation, type, policy, and runtime
contribution contracts.

## Package shape

A provider package normally contains:

```text
package/
├── package.json
├── src/
│   ├── index.ts           # plugin entrypoint
│   └── provider/
│       ├── package.ts     # capability composition
│       └── modules/       # declarations and exact native mappings by module
└── runtimes/net10.0/      # runtime assembly, when one is required
```

The source model must be legal TypeScript declaration syntax. The target model
contains C# identities and carriers. A relation joins them explicitly; shared
spelling is never identity.

## Package factory

The plugin entry delegates to one package definition:

```ts
import { createCsharpProviderPackage } from "@tsonic/target-csharp/provider";
import { counterPackage } from "./provider/package.js";

export function createTsonicPlugin() {
  return createCsharpProviderPackage(counterPackage);
}
```

`CsharpProviderPackageDefinition` describes:

| Fields | Responsibility |
| --- | --- |
| `id`, `displayName` | Installed capability identity |
| `providerIdentity` | Exact source-provider identity and contract version |
| `modules` | Canonical module specifiers, opaque provider module IDs and declaration producers |
| `moduleSpecifiers` | Public specifiers, their canonical module and optional ownership diagnostic text |
| `virtualDeclarationFileName` | Virtual source filename for a public specifier |
| `moduleDiagnostic` | Unowned or missing-module diagnostic |
| `resolutionEvidence`, `declarationEvidence` | Optional source-provider evidence |
| `policy` | Existing exact C# type/member relations, rejections and execution-driver contribution |
| `runtime` | Declared native artifact requirements |

The factory snapshots package metadata and registers one source provider.
It does not reflect native assemblies or infer target mappings. Those remain
the producer's declared inputs, validated through the existing C# contracts.

For example, a module can have a public alias without changing its native
member identity:

```ts
const moduleSpecifiers = [
  { moduleSpecifier: "@acme/counter", canonicalModuleSpecifier: "@acme/counter" },
  { moduleSpecifier: "counter", canonicalModuleSpecifier: "@acme/counter" },
];
```

Both imports request that canonical module's declarations. Self-references
use the requested public spelling; provider module, export and signature IDs
remain explicit. Cross-module declaration imports are collected from exact
provider references, including value imports required by class inheritance.

Each module's `getExports(selectedSurfaceIds)` receives the selected surfaces.
The capability owns that selection's meaning. For example, C# Node includes
`Stats.mtime: Date` only on the JS surface; the package factory contains no
Node or `Date` special case. Runtime references remain a separate contribution.

## Compilation lifecycle

1. The host discovers the installed package.
2. The provider snapshots its immutable configuration and native inputs.
3. Requested imports produce exact virtual declaration closures.
4. Source checking selects declarations and signatures.
5. C# analysis resolves provider relations and closes carriers, conversions,
   runtime references, and safety requirements.
6. Planning consumes the sealed result and emits C# AST nodes.

The provider must not inspect generated C#, re-enter the checker during
planning, or recover a member from source spelling.

## Minimum proof

A provider change is complete only when tests prove:

- legal source declarations and exact import/export identity;
- positive and negative relation selection, including overloads and aliases;
- emitted C# for every added operation;
- native compilation against the contributed references;
- runtime behavior when the operation is executable;
- deterministic rejection for missing, ambiguous, or contradictory evidence.
