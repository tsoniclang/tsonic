# Mojo language support

The current proofs exercise scalar functions, records, classes, generics,
destructuring, arrays, loops, project dispatch, resource cleanup and compile-time
operations. Native emission remains separate from successful native execution.

For example, a generic source function retains its generic contract:

```ts
export function identity<T>(value: T): T {
  return value;
}
```

The target selects Mojo type requirements and ownership conventions from the
checked operation and its uses. It does not replace an unresolved generic type
with a broad runtime object.

Explicit copy/materialization and compile-time selection are covered in the
[ownership manual](../../../manual/targets/mojo/ownership-and-safety.md).
Node and JavaScript built-ins are separately supplied capabilities, not
consequences of supporting ordinary TypeScript syntax.

Generators, native async iterator protocols and some origin-bearing/native
provider contracts remain limitations. Read the [limitations](limitations.md)
before relying on one of those APIs.
