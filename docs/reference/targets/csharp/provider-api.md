# C# provider API

Provider packages import `@tsonic/target-csharp/provider`. The public contract
contains:

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
